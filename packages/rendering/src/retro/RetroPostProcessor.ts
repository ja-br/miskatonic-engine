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

    // Create pipelines (Task 4)
    this.createPipelines();
  }

  /**
   * Initialize or resize post-processing resources
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    // Clean up old resources
    this.disposeTextures();

    console.log(`[RetroPostProcessor] Creating render targets: ${width}x${height}`);

    // 1. Create scene render target (CRITICAL - missing from original plan)
    // Scene color texture (BGRA8, full resolution) - stores rendered scene
    this.sceneColorTexture = this.backend.createTexture(
      'retro-post-scene-color',
      width,
      height,
      null,
      { format: 'bgra8unorm' as any }  // Type assertion needed - backend accepts this
    );

    // Scene depth texture (matches backend.getDepthFormat(), full resolution)
    const depthFormat = this.backend.getDepthFormat();
    this.sceneDepthTexture = this.backend.createTexture(
      'retro-post-scene-depth',
      width,
      height,
      null,
      { format: depthFormat as any }  // Type assertion needed
    );

    // Scene framebuffer - combines color + depth
    this.sceneFramebuffer = this.backend.createFramebuffer(
      'retro-post-scene-fb',
      [this.sceneColorTexture],
      this.sceneDepthTexture
    );

    // 2. Create bloom textures at quarter resolution for performance
    // Use Math.max(64, ...) to prevent tiny textures (critic's suggestion)
    const bloomWidth = Math.max(64, Math.floor(width / 4));
    const bloomHeight = Math.max(64, Math.floor(height / 4));

    console.log(`[RetroPostProcessor] Creating bloom textures: ${bloomWidth}x${bloomHeight}`);

    // Bloom extract texture - bright pixels extracted
    this.bloomExtractTexture = this.backend.createTexture(
      'retro-post-bloom-extract',
      bloomWidth,
      bloomHeight,
      null,
      { format: 'rgba' }
    );

    // Bloom temp texture - temporary for separable blur
    this.bloomTempTexture = this.backend.createTexture(
      'retro-post-bloom-temp',
      bloomWidth,
      bloomHeight,
      null,
      { format: 'rgba' }
    );

    // Bloom blur texture - final blurred result
    this.bloomBlurTexture = this.backend.createTexture(
      'retro-post-bloom-blur',
      bloomWidth,
      bloomHeight,
      null,
      { format: 'rgba' }
    );

    // 3. Create fallback 1x1 white LUT (CRITICAL)
    // This is used as identity LUT when config.colorLUT is not provided
    if (!this.fallbackLUT) {
      console.log('[RetroPostProcessor] Creating fallback 1x1 white LUT');
      const whitePix = new Uint8Array([255, 255, 255, 255]);
      this.fallbackLUT = this.backend.createTexture(
        'retro-post-fallback-lut',
        1,
        1,
        whitePix,
        { format: 'rgba', wrapS: 'clamp_to_edge', wrapT: 'clamp_to_edge' }
      );
    }

    // 4. Create uniform buffers (Task 4)
    this.createUniformBuffers();

    console.log('[RetroPostProcessor] Render targets created successfully');
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
   * Create uniform buffers with proper WGSL alignment
   * Task 4: Create 3 uniform buffers
   */
  private createUniformBuffers(): void {
    // BloomParams (16 bytes total)
    // struct BloomParams {
    //   threshold: f32,      // 4 bytes
    //   _padding: vec3<f32>, // 12 bytes
    // }
    const bloomParamsData = new Float32Array(4); // 16 bytes
    bloomParamsData[0] = this.config.bloomThreshold;
    // bloomParamsData[1-3] remain 0 (padding)

    if (this.bloomParamsBuffer) {
      this.backend.deleteBuffer(this.bloomParamsBuffer);
    }
    this.bloomParamsBuffer = this.backend.createBuffer(
      'retro-bloom-params',
      'uniform',
      bloomParamsData,
      'dynamic_draw'
    );

    // BlurParams (16 bytes total)
    // struct BlurParams {
    //   direction: vec2<f32>,  // 8 bytes
    //   _padding: vec2<f32>,   // 8 bytes
    // }
    const blurParamsData = new Float32Array(4); // 16 bytes
    // blurParamsData[0-1] will be set per-pass (horizontal/vertical)
    // blurParamsData[2-3] remain 0 (padding)

    if (this.blurParamsBuffer) {
      this.backend.deleteBuffer(this.blurParamsBuffer);
    }
    this.blurParamsBuffer = this.backend.createBuffer(
      'retro-blur-params',
      'uniform',
      blurParamsData,
      'dynamic_draw'
    );

    // PostParams (32 bytes total)
    // struct PostParams {
    //   bloomIntensity: f32,  // 4 bytes
    //   grainAmount: f32,     // 4 bytes
    //   gamma: f32,           // 4 bytes
    //   ditherPattern: u32,   // 4 bytes
    //   time: f32,            // 4 bytes
    //   _padding: vec3<f32>,  // 12 bytes
    // }
    const postParamsData = new Float32Array(8); // 32 bytes
    postParamsData[0] = this.config.bloomIntensity;
    postParamsData[1] = this.config.grainAmount;
    postParamsData[2] = this.config.gamma;
    postParamsData[3] = this.config.ditherPattern;
    postParamsData[4] = this.time;
    // postParamsData[5-7] remain 0 (padding)

    if (this.postParamsBuffer) {
      this.backend.deleteBuffer(this.postParamsBuffer);
    }
    this.postParamsBuffer = this.backend.createBuffer(
      'retro-post-params',
      'uniform',
      postParamsData,
      'dynamic_draw'
    );
  }

  /**
   * Create render pipelines
   * Task 4: Create 3 pipelines for bloom extract, blur, and composite
   */
  private createPipelines(): void {
    if (!this.bloomExtractShader || !this.bloomBlurShader || !this.compositeShader) {
      throw new Error('[RetroPostProcessor] Shaders not initialized');
    }

    if (!this.extractTextureLayout || !this.extractUniformLayout ||
        !this.blurTextureLayout || !this.blurUniformLayout ||
        !this.compositeSceneLayout || !this.compositeBloomLayout ||
        !this.compositeLUTLayout || !this.compositeParamsLayout) {
      throw new Error('[RetroPostProcessor] Bind group layouts not initialized');
    }

    // Bloom Extract Pipeline
    // Renders bright pixels to bloom extract texture
    this.bloomExtractPipeline = this.backend.createRenderPipeline({
      label: 'retro-bloom-extract',
      shader: this.bloomExtractShader,
      vertexLayouts: [], // Fullscreen triangle, no vertex buffers
      bindGroupLayouts: [this.extractTextureLayout, this.extractUniformLayout],
      pipelineState: {
        topology: 'triangle-list',
        blend: {
          enabled: false,
          srcFactor: 'one',
          dstFactor: 'zero',
          operation: 'add'
        },
        rasterization: {
          cullMode: 'none', // Fullscreen quad, no culling needed
          frontFace: 'ccw'
        }
      },
      colorFormat: 'bgra8unorm',
      depthFormat: undefined // No depth in post-processing
    });

    // Bloom Blur Pipeline
    // Applies separable Gaussian blur (horizontal then vertical)
    this.bloomBlurPipeline = this.backend.createRenderPipeline({
      label: 'retro-bloom-blur',
      shader: this.bloomBlurShader,
      vertexLayouts: [], // Fullscreen triangle, no vertex buffers
      bindGroupLayouts: [this.blurTextureLayout, this.blurUniformLayout],
      pipelineState: {
        topology: 'triangle-list',
        blend: {
          enabled: false,
          srcFactor: 'one',
          dstFactor: 'zero',
          operation: 'add'
        },
        rasterization: {
          cullMode: 'none',
          frontFace: 'ccw'
        }
      },
      colorFormat: 'bgra8unorm',
      depthFormat: undefined
    });

    // Composite Pipeline
    // Combines scene + bloom + LUT + dither + grain
    this.compositePipeline = this.backend.createRenderPipeline({
      label: 'retro-composite',
      shader: this.compositeShader,
      vertexLayouts: [], // Fullscreen triangle, no vertex buffers
      bindGroupLayouts: [
        this.compositeSceneLayout,
        this.compositeBloomLayout,
        this.compositeLUTLayout,
        this.compositeParamsLayout
      ],
      pipelineState: {
        topology: 'triangle-list',
        blend: {
          enabled: false,
          srcFactor: 'one',
          dstFactor: 'zero',
          operation: 'add'
        },
        rasterization: {
          cullMode: 'none',
          frontFace: 'ccw'
        }
      },
      colorFormat: 'bgra8unorm',
      depthFormat: undefined
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
    // Scene render target
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

    // Bloom textures
    if (this.bloomExtractTexture) {
      this.backend.deleteTexture(this.bloomExtractTexture);
      this.bloomExtractTexture = null;
    }
    if (this.bloomBlurTexture) {
      this.backend.deleteTexture(this.bloomBlurTexture);
      this.bloomBlurTexture = null;
    }
    if (this.bloomTempTexture) {
      this.backend.deleteTexture(this.bloomTempTexture);
      this.bloomTempTexture = null;
    }

    // Fallback LUT (only dispose if we're cleaning up everything)
    // Note: fallbackLUT is created once and reused across resizes
    // It will be cleaned up in dispose()
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

    // Dispose pipelines (Task 4)
    if (this.bloomExtractPipeline) {
      this.backend.deletePipeline(this.bloomExtractPipeline);
      this.bloomExtractPipeline = null;
    }
    if (this.bloomBlurPipeline) {
      this.backend.deletePipeline(this.bloomBlurPipeline);
      this.bloomBlurPipeline = null;
    }
    if (this.compositePipeline) {
      this.backend.deletePipeline(this.compositePipeline);
      this.compositePipeline = null;
    }

    // Dispose bind groups (will be created in Task 5)
    this.bloomExtractBindGroup = null;
    this.bloomBlurHorizontalBindGroup = null;
    this.bloomBlurVerticalBindGroup = null;
    this.compositeBindGroup = null;
  }

  /**
   * Get scene framebuffer for rendering the main scene
   * Demo should render to this instead of directly to swapchain
   */
  getSceneFramebuffer(): BackendFramebufferHandle {
    if (!this.sceneFramebuffer) {
      throw new Error('[RetroPostProcessor] Scene framebuffer not initialized - call resize() first');
    }
    return this.sceneFramebuffer;
  }

  /**
   * Get scene color texture (used internally for post-processing)
   * This is the rendered scene that will be post-processed
   */
  getSceneTexture(): BackendTextureHandle {
    if (!this.sceneColorTexture) {
      throw new Error('[RetroPostProcessor] Scene texture not initialized - call resize() first');
    }
    return this.sceneColorTexture;
  }
}
