/**
 * Retro Post-Processor - PS1/PS2 style post-processing
 * 3-pass pipeline: bloom extract → blur → composite (tonemap + LUT + dither + grain)
 */

import type {
  IRendererBackend,
  BackendTextureHandle,
  BackendPipelineHandle,
  BackendBindGroupHandle,
  BackendShaderHandle,
  BackendBindGroupLayoutHandle,
  BackendBufferHandle,
  BackendFramebufferHandle
} from '../backends';

// Import shaders (Vite ?raw syntax)
import bloomExtractWGSL from './shaders/bloom-extract.wgsl?raw';
import bloomBlurWGSL from './shaders/bloom-blur.wgsl?raw';
import compositeWGSL from './shaders/composite.wgsl?raw';

export interface RetroPostConfig {
  /** Bloom threshold (brightness cutoff) */
  bloomThreshold: number;
  /** Bloom intensity (additive blend amount) */
  bloomIntensity: number;
  /** Film grain amount */
  grainAmount: number;
  /** Gamma for tonemapping (gamma correction only) */
  gamma: number;
  /** Dither pattern: 0 = 4x4 Bayer, 1 = 8x8 Bayer */
  ditherPattern: 0 | 1;
  /** Optional color LUT texture (256x16) */
  colorLUT?: BackendTextureHandle;
}

/**
 * Manages retro-style post-processing effects
 * Implements additive bloom, gamma tonemapping, ordered dithering, color grading
 */
export class RetroPostProcessor {
  private backend: IRendererBackend;
  private config: RetroPostConfig;

  // Render targets
  private bloomExtractTexture: BackendTextureHandle | null = null;
  private bloomBlurTexture: BackendTextureHandle | null = null;
  private bloomTempTexture: BackendTextureHandle | null = null;  // For separable blur

  // Pipelines
  private bloomExtractPipeline: BackendPipelineHandle | null = null;
  private bloomBlurPipeline: BackendPipelineHandle | null = null;
  private compositePipeline: BackendPipelineHandle | null = null;

  // Bind groups
  private bloomExtractBindGroup: BackendBindGroupHandle | null = null;
  private bloomBlurHorizontalBindGroup: BackendBindGroupHandle | null = null;
  private bloomBlurVerticalBindGroup: BackendBindGroupHandle | null = null;
  private compositeBindGroup: BackendBindGroupHandle | null = null;

  private width: number = 0;
  private height: number = 0;
  private time: number = 0;

  // Shaders
  private bloomExtractShader: BackendShaderHandle | null = null;
  private bloomBlurShader: BackendShaderHandle | null = null;
  private compositeShader: BackendShaderHandle | null = null;

  // Bind group layouts
  private extractTextureLayout: BackendBindGroupLayoutHandle | null = null;
  private extractUniformLayout: BackendBindGroupLayoutHandle | null = null;
  private blurTextureLayout: BackendBindGroupLayoutHandle | null = null;
  private blurUniformLayout: BackendBindGroupLayoutHandle | null = null;
  private compositeSceneLayout: BackendBindGroupLayoutHandle | null = null;
  private compositeBloomLayout: BackendBindGroupLayoutHandle | null = null;
  private compositeLUTLayout: BackendBindGroupLayoutHandle | null = null;
  private compositeParamsLayout: BackendBindGroupLayoutHandle | null = null;

  // Scene render target (CRITICAL: missing from original plan)
  private sceneColorTexture: BackendTextureHandle | null = null;
  private sceneDepthTexture: BackendTextureHandle | null = null;
  private sceneFramebuffer: BackendFramebufferHandle | null = null;

  // Samplers (inline creation, not backend API)
  private linearSampler: any = null;  // GPUSampler type (inline created)
  private lutSampler: any = null;     // For LUT texture

  // Uniform buffers
  private bloomParamsBuffer: BackendBufferHandle | null = null;
  private blurParamsBuffer: BackendBufferHandle | null = null;
  private postParamsBuffer: BackendBufferHandle | null = null;

  // 1x1 white fallback LUT (CRITICAL: prevents crash when colorLUT not provided)
  private fallbackLUT: BackendTextureHandle | null = null;

  constructor(backend: IRendererBackend, config: Partial<RetroPostConfig> = {}) {
    this.backend = backend;
    this.config = {
      bloomThreshold: config.bloomThreshold ?? 0.8,
      bloomIntensity: config.bloomIntensity ?? 0.3,
      grainAmount: config.grainAmount ?? 0.02,
      gamma: config.gamma ?? 2.2,
      ditherPattern: config.ditherPattern ?? 0,
      colorLUT: config.colorLUT,
    };

    // Initialize shaders and bind group layouts
    this.initializeShaders();
    this.createBindGroupLayouts();
  }

  /**
   * Initialize or resize post-processing resources
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    // Clean up old resources
    this.disposeTextures();

    // Create bloom textures at quarter resolution for performance
    const bloomWidth = Math.max(1, Math.floor(width / 4));
    const bloomHeight = Math.max(1, Math.floor(height / 4));

    // TODO: Create textures using backend API
    // this.bloomExtractTexture = this.backend.createTexture(...)
    // this.bloomBlurTexture = this.backend.createTexture(...)
    // this.bloomTempTexture = this.backend.createTexture(...)

    // For now, mark as placeholders
    console.warn('[RetroPostProcessor] Texture creation not yet implemented');
  }

  /**
   * Initialize shaders
   * Task 1: Load and validate shaders
   */
  private initializeShaders(): void {
    // Load bloom extract shader
    this.bloomExtractShader = this.backend.createShader('retro-bloom-extract', {
      vertex: bloomExtractWGSL,
      fragment: bloomExtractWGSL,
    });

    // Load bloom blur shader
    this.bloomBlurShader = this.backend.createShader('retro-bloom-blur', {
      vertex: bloomBlurWGSL,
      fragment: bloomBlurWGSL,
    });

    // Load composite shader
    this.compositeShader = this.backend.createShader('retro-composite', {
      vertex: compositeWGSL,
      fragment: compositeWGSL,
    });
  }

  /**
   * Create bind group layouts
   * Task 2: Create 7 bind group layouts matching shader declarations
   */
  private createBindGroupLayouts(): void {
    // Bloom Extract Shader
    // @group(0): texture_2d + sampler (scene texture)
    this.extractTextureLayout = this.backend.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ['fragment'], type: 'texture' },
        { binding: 1, visibility: ['fragment'], type: 'sampler' },
      ],
    });

    // @group(1): uniform buffer (BloomParams: threshold f32 + padding)
    this.extractUniformLayout = this.backend.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ['fragment'], type: 'uniform', minBindingSize: 256 },
      ],
    });

    // Bloom Blur Shader
    // @group(0): texture_2d + sampler (input texture)
    this.blurTextureLayout = this.backend.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ['fragment'], type: 'texture' },
        { binding: 1, visibility: ['fragment'], type: 'sampler' },
      ],
    });

    // @group(1): uniform buffer (BlurParams: direction vec2 + padding)
    this.blurUniformLayout = this.backend.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ['fragment'], type: 'uniform', minBindingSize: 256 },
      ],
    });

    // Composite Shader (CRITICAL: 4 bind groups!)
    // @group(0): texture_2d + sampler (scene texture)
    this.compositeSceneLayout = this.backend.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ['fragment'], type: 'texture' },
        { binding: 1, visibility: ['fragment'], type: 'sampler' },
      ],
    });

    // @group(1): texture_2d + sampler (bloom texture)
    this.compositeBloomLayout = this.backend.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ['fragment'], type: 'texture' },
        { binding: 1, visibility: ['fragment'], type: 'sampler' },
      ],
    });

    // @group(2): texture_2d + sampler (color LUT)
    this.compositeLUTLayout = this.backend.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ['fragment'], type: 'texture' },
        { binding: 1, visibility: ['fragment'], type: 'sampler' },
      ],
    });

    // @group(3): uniform buffer (PostParams: 5 floats + u32 + padding)
    this.compositeParamsLayout = this.backend.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ['fragment'], type: 'uniform', minBindingSize: 256 },
      ],
    });
  }

  /**
   * Apply post-processing to scene texture
   * Returns final composited texture
   */
  apply(sceneTexture: BackendTextureHandle): BackendTextureHandle {
    // Pass 1: Extract bright pixels
    this.bloomExtractPass(sceneTexture);

    // Pass 2: Blur bloom (separable: horizontal then vertical)
    this.bloomBlurPass();

    // Pass 3: Composite (bloom + tonemap + LUT + dither + grain)
    return this.compositePass(sceneTexture);
  }

  /**
   * Pass 1: Extract bright pixels above threshold
   */
  private bloomExtractPass(sceneTexture: BackendTextureHandle): void {
    if (!this.bloomExtractTexture) {
      console.warn('[RetroPostProcessor] Bloom extract texture not initialized');
      return;
    }

    // TODO: Bind pipeline, set uniforms, draw full-screen triangle
    // Shader: bloom-extract.wgsl
    // Output: bloomExtractTexture
  }

  /**
   * Pass 2: Gaussian blur (separable filter)
   */
  private bloomBlurPass(): void {
    if (!this.bloomBlurTexture || !this.bloomTempTexture) {
      console.warn('[RetroPostProcessor] Bloom blur textures not initialized');
      return;
    }

    // Horizontal blur: bloomExtractTexture → bloomTempTexture
    // TODO: Set direction uniform to (1, 0)

    // Vertical blur: bloomTempTexture → bloomBlurTexture
    // TODO: Set direction uniform to (0, 1)

    // Shader: bloom-blur.wgsl
  }

  /**
   * Pass 3: Composite final image
   */
  private compositePass(sceneTexture: BackendTextureHandle): BackendTextureHandle {
    if (!this.bloomBlurTexture) {
      console.warn('[RetroPostProcessor] Bloom blur texture not initialized');
      return sceneTexture;
    }

    // TODO: Bind composite pipeline
    // Inputs: sceneTexture, bloomBlurTexture, colorLUT (optional)
    // Uniforms: bloomIntensity, grainAmount, gamma, ditherPattern, time
    // Shader: composite.wgsl
    // Output: swapchain or intermediate texture

    // For now, return input
    return sceneTexture;
  }

  /**
   * Update bloom parameters at runtime
   */
  setBloomIntensity(intensity: number): void {
    this.config.bloomIntensity = Math.max(0, intensity);
  }

  setBloomThreshold(threshold: number): void {
    this.config.bloomThreshold = Math.max(0, threshold);
  }

  /**
   * Update grain amount
   */
  setGrainAmount(amount: number): void {
    this.config.grainAmount = Math.max(0, amount);
  }

  /**
   * Update gamma (tonemapping)
   */
  setGamma(gamma: number): void {
    this.config.gamma = Math.max(0.1, gamma);
  }

  /**
   * Set dither pattern
   */
  setDitherPattern(pattern: 0 | 1): void {
    this.config.ditherPattern = pattern;
  }

  /**
   * Set color LUT texture
   */
  setColorLUT(texture: BackendTextureHandle | undefined): void {
    this.config.colorLUT = texture;
  }

  /**
   * Update time for animated grain
   */
  updateTime(delta: number): void {
    this.time += delta;
  }

  /**
   * Get current configuration
   */
  getConfig(): RetroPostConfig {
    return { ...this.config };
  }

  /**
   * Clean up textures
   */
  private disposeTextures(): void {
    if (this.bloomExtractTexture) {
      // TODO: this.backend.destroyTexture(this.bloomExtractTexture);
      this.bloomExtractTexture = null;
    }
    if (this.bloomBlurTexture) {
      // TODO: this.backend.destroyTexture(this.bloomBlurTexture);
      this.bloomBlurTexture = null;
    }
    if (this.bloomTempTexture) {
      // TODO: this.backend.destroyTexture(this.bloomTempTexture);
      this.bloomTempTexture = null;
    }
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    this.disposeTextures();

    // Dispose shaders
    if (this.bloomExtractShader) {
      this.backend.deleteShader(this.bloomExtractShader);
      this.bloomExtractShader = null;
    }
    if (this.bloomBlurShader) {
      this.backend.deleteShader(this.bloomBlurShader);
      this.bloomBlurShader = null;
    }
    if (this.compositeShader) {
      this.backend.deleteShader(this.compositeShader);
      this.compositeShader = null;
    }

    // Dispose bind group layouts
    if (this.extractTextureLayout) {
      this.backend.deleteBindGroupLayout(this.extractTextureLayout);
      this.extractTextureLayout = null;
    }
    if (this.extractUniformLayout) {
      this.backend.deleteBindGroupLayout(this.extractUniformLayout);
      this.extractUniformLayout = null;
    }
    if (this.blurTextureLayout) {
      this.backend.deleteBindGroupLayout(this.blurTextureLayout);
      this.blurTextureLayout = null;
    }
    if (this.blurUniformLayout) {
      this.backend.deleteBindGroupLayout(this.blurUniformLayout);
      this.blurUniformLayout = null;
    }
    if (this.compositeSceneLayout) {
      this.backend.deleteBindGroupLayout(this.compositeSceneLayout);
      this.compositeSceneLayout = null;
    }
    if (this.compositeBloomLayout) {
      this.backend.deleteBindGroupLayout(this.compositeBloomLayout);
      this.compositeBloomLayout = null;
    }
    if (this.compositeLUTLayout) {
      this.backend.deleteBindGroupLayout(this.compositeLUTLayout);
      this.compositeLUTLayout = null;
    }
    if (this.compositeParamsLayout) {
      this.backend.deleteBindGroupLayout(this.compositeParamsLayout);
      this.compositeParamsLayout = null;
    }

    // Dispose uniform buffers
    if (this.bloomParamsBuffer) {
      this.backend.deleteBuffer(this.bloomParamsBuffer);
      this.bloomParamsBuffer = null;
    }
    if (this.blurParamsBuffer) {
      this.backend.deleteBuffer(this.blurParamsBuffer);
      this.blurParamsBuffer = null;
    }
    if (this.postParamsBuffer) {
      this.backend.deleteBuffer(this.postParamsBuffer);
      this.postParamsBuffer = null;
    }

    // Dispose fallback LUT
    if (this.fallbackLUT) {
      this.backend.deleteTexture(this.fallbackLUT);
      this.fallbackLUT = null;
    }

    // Dispose scene render target
    if (this.sceneColorTexture) {
      this.backend.deleteTexture(this.sceneColorTexture);
      this.sceneColorTexture = null;
    }
    if (this.sceneDepthTexture) {
      this.backend.deleteTexture(this.sceneDepthTexture);
      this.sceneDepthTexture = null;
    }
    if (this.sceneFramebuffer) {
      this.backend.deleteFramebuffer(this.sceneFramebuffer);
      this.sceneFramebuffer = null;
    }

    // TODO: Dispose pipelines and bind groups
    this.bloomExtractPipeline = null;
    this.bloomBlurPipeline = null;
    this.compositePipeline = null;

    this.bloomExtractBindGroup = null;
    this.bloomBlurHorizontalBindGroup = null;
    this.bloomBlurVerticalBindGroup = null;
    this.compositeBindGroup = null;
  }
}
