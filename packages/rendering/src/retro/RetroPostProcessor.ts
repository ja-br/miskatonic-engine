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
import bloomDownsampleWGSL from './shaders/bloom-downsample.wgsl?raw';
import bloomUpsampleWGSL from './shaders/bloom-upsample.wgsl?raw';
import compositeWGSL from './shaders/composite.wgsl?raw';
import crtYahWGSL from './shaders/crt-yah.wgsl?raw';

/** CRT phosphor mask type */
export type MaskType = 'aperture-grille' | 'slot-mask' | 'shadow-mask';

/** CRT-Yah effect configuration */
export interface CRTYahConfig {
  /** Enable CRT effect */
  enabled: boolean;

  /** Master intensity (0=off, 1=normal, 2=intense) */
  masterIntensity: number;

  /** Brightness adjustment */
  brightness: number;
  /** Contrast adjustment */
  contrast: number;
  /** Saturation adjustment */
  saturation: number;

  /** Scanline strength (0-1) */
  scanlinesStrength: number;
  /** Minimum beam width */
  beamWidthMin: number;
  /** Maximum beam width */
  beamWidthMax: number;
  /** Beam shape: 0=sharp, 1=smooth */
  beamShape: number;

  /** Phosphor mask intensity (0-1) */
  maskIntensity: number;
  /** Phosphor mask type */
  maskType: MaskType;

  /** Screen curvature amount (0-1) */
  curvatureAmount: number;
  /** Vignette amount (0-1) */
  vignetteAmount: number;
  /** Corner radius (0-0.25) */
  cornerRadius: number;

  /** Color overflow / phosphor bloom intensity (0-1) */
  colorOverflow: number;
}

export interface RetroPostConfig {
  /** Bloom threshold (brightness cutoff) */
  bloomThreshold: number;
  /** Bloom intensity (additive blend amount) */
  bloomIntensity: number;
  /** Number of mip levels for bloom pyramid (default: 5) */
  bloomMipLevels: number;
  /** Film grain amount */
  grainAmount: number;
  /** Gamma for tonemapping (gamma correction only) */
  gamma: number;
  /** Dither pattern: 0 = 4x4 Bayer, 1 = 8x8 Bayer */
  ditherPattern: 0 | 1;
  /** Optional color LUT texture (256x16) */
  colorLUT?: BackendTextureHandle;
  /** Internal render resolution (if undefined, uses display resolution) */
  internalResolution?: { width: number; height: number };
  /** Optional CRT-Yah effect configuration */
  crt?: CRTYahConfig;
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
  private bloomMip0Texture: BackendTextureHandle | null = null;  // 80x60 (quarter-res of extract)
  private bloomMip1Texture: BackendTextureHandle | null = null;  // 40x30 (half of mip0)
  private bloomMip2Texture: BackendTextureHandle | null = null;  // 20x15 (half of mip1)
  private bloomMip3Texture: BackendTextureHandle | null = null;  // 10x8 (half of mip2)
  private bloomMip4Texture: BackendTextureHandle | null = null;  // 5x4 (half of mip3)

  // Framebuffers for bloom textures
  private bloomExtractFramebuffer: BackendFramebufferHandle | null = null;
  private bloomMip0Framebuffer: BackendFramebufferHandle | null = null;
  private bloomMip1Framebuffer: BackendFramebufferHandle | null = null;
  private bloomMip2Framebuffer: BackendFramebufferHandle | null = null;
  private bloomMip3Framebuffer: BackendFramebufferHandle | null = null;
  private bloomMip4Framebuffer: BackendFramebufferHandle | null = null;

  // Pipelines
  private bloomExtractPipeline: BackendPipelineHandle | null = null;
  private bloomDownsamplePipeline: BackendPipelineHandle | null = null;
  private bloomUpsamplePipeline: BackendPipelineHandle | null = null;
  private compositePipeline: BackendPipelineHandle | null = null;

  // Bind groups
  private bloomExtractBindGroup: BackendBindGroupHandle | null = null;
  private bloomDownsampleBindGroup: BackendBindGroupHandle | null = null;
  private bloomUpsampleBindGroup: BackendBindGroupHandle | null = null;
  private compositeBindGroup: BackendBindGroupHandle | null = null;

  private width: number = 0;           // Internal render resolution width
  private height: number = 0;          // Internal render resolution height
  private displayWidth: number = 0;    // Display resolution width
  private displayHeight: number = 0;   // Display resolution height
  private time: number = 0;

  // Shaders
  private bloomExtractShader: BackendShaderHandle | null = null;
  private bloomDownsampleShader: BackendShaderHandle | null = null;
  private bloomUpsampleShader: BackendShaderHandle | null = null;
  private compositeShader: BackendShaderHandle | null = null;

  // Bind group layouts
  private extractTextureLayout: BackendBindGroupLayoutHandle | null = null;
  private extractUniformLayout: BackendBindGroupLayoutHandle | null = null;
  private downsampleTextureLayout: BackendBindGroupLayoutHandle | null = null;
  private downsampleUniformLayout: BackendBindGroupLayoutHandle | null = null;
  private upsampleTextureLayout: BackendBindGroupLayoutHandle | null = null;
  private upsampleUniformLayout: BackendBindGroupLayoutHandle | null = null;
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
  private downsampleParamsBuffer: BackendBufferHandle | null = null;
  private upsampleParamsBuffer: BackendBufferHandle | null = null;
  private postParamsBuffer: BackendBufferHandle | null = null;

  // 1x1 white fallback LUT (CRITICAL: prevents crash when colorLUT not provided)
  private fallbackLUT: BackendTextureHandle | null = null;

  // CRT-Yah resources
  private crtShader: BackendShaderHandle | null = null;
  private crtPipeline: BackendPipelineHandle | null = null;
  private crtTextureLayout: BackendBindGroupLayoutHandle | null = null;
  private crtParamsLayout: BackendBindGroupLayoutHandle | null = null;
  private crtParamsBuffer: BackendBufferHandle | null = null;
  private compositeTexture: BackendTextureHandle | null = null;  // Intermediate texture for CRT input
  private compositeFramebuffer: BackendFramebufferHandle | null = null;

  constructor(backend: IRendererBackend, config: Partial<RetroPostConfig> = {}) {
    this.backend = backend;
    this.config = {
      bloomThreshold: config.bloomThreshold ?? 0.8,
      bloomIntensity: config.bloomIntensity ?? 0.3,
      bloomMipLevels: config.bloomMipLevels ?? 5,
      grainAmount: config.grainAmount ?? 0.02,
      gamma: config.gamma ?? 2.2,
      ditherPattern: config.ditherPattern ?? 0,
      colorLUT: config.colorLUT,
      internalResolution: config.internalResolution,
      crt: config.crt ? {
        enabled: config.crt.enabled ?? true,
        masterIntensity: config.crt.masterIntensity ?? 1.0,
        brightness: config.crt.brightness ?? 0.0,
        contrast: config.crt.contrast ?? 0.0,
        saturation: config.crt.saturation ?? 1.0,
        scanlinesStrength: config.crt.scanlinesStrength ?? 0.65,  // Visible but not overpowering
        beamWidthMin: config.crt.beamWidthMin ?? 0.8,
        beamWidthMax: config.crt.beamWidthMax ?? 1.0,
        beamShape: config.crt.beamShape ?? 0.7,
        maskIntensity: config.crt.maskIntensity ?? 0.45,  // Clear RGB triads without over-darkening
        maskType: config.crt.maskType ?? 'aperture-grille',
        curvatureAmount: config.crt.curvatureAmount ?? 0.10,  // Noticeable curve, not extreme
        vignetteAmount: config.crt.vignetteAmount ?? 0.35,  // Mild edge darkening
        cornerRadius: config.crt.cornerRadius ?? 0.08,  // Soft rounded corners
        colorOverflow: config.crt.colorOverflow ?? 0.0,  // Phosphor bloom intensity
      } : undefined,
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
  resize(displayWidth: number, displayHeight: number): void {
    // Store display resolution
    this.displayWidth = displayWidth;
    this.displayHeight = displayHeight;

    // Determine internal rendering resolution
    if (this.config.internalResolution) {
      this.width = this.config.internalResolution.width;
      this.height = this.config.internalResolution.height;
    } else {
      // Default: use display resolution (no scaling)
      this.width = displayWidth;
      this.height = displayHeight;
    }

    // Clean up old resources
    this.disposeTextures();

    console.log(`[RetroPostProcessor] Internal render resolution: ${this.width}x${this.height}`);
    console.log(`[RetroPostProcessor] Display resolution: ${displayWidth}x${displayHeight}`);

    // 1. Create scene render target at INTERNAL resolution
    // Scene color texture (BGRA8) - stores rendered scene
    this.sceneColorTexture = this.backend.createTexture(
      'retro-post-scene-color',
      this.width,  // Internal resolution
      this.height, // Internal resolution
      null,
      { format: 'bgra8unorm' as any }
    );

    // Scene depth texture (backend chooses optimal format: depth16unorm or depth24plus)
    this.sceneDepthTexture = this.backend.createDepthTexture(
      'retro-post-scene-depth',
      this.width,  // Internal resolution
      this.height  // Internal resolution
    );

    // Scene framebuffer - combines color + depth
    this.sceneFramebuffer = this.backend.createFramebuffer(
      'retro-post-scene-fb',
      [this.sceneColorTexture],
      this.sceneDepthTexture
    );

    // 2. Create bloom textures at quarter of INTERNAL resolution for performance
    // Use Math.max(64, ...) to prevent tiny textures
    const bloomWidth = Math.max(64, Math.floor(this.width / 4));
    const bloomHeight = Math.max(64, Math.floor(this.height / 4));

    console.log(`[RetroPostProcessor] Creating bloom textures: ${bloomWidth}x${bloomHeight}`);

    // Bloom extract texture - bright pixels extracted
    this.bloomExtractTexture = this.backend.createTexture(
      'retro-post-bloom-extract',
      bloomWidth,
      bloomHeight,
      null,
      { format: 'rgba' }
    );

    // Mip pyramid for bloom (5-level: mip0 through mip4)
    const mip0Width = Math.max(32, Math.floor(bloomWidth / 2));
    const mip0Height = Math.max(32, Math.floor(bloomHeight / 2));
    const mip1Width = Math.max(16, Math.floor(mip0Width / 2));
    const mip1Height = Math.max(16, Math.floor(mip0Height / 2));
    const mip2Width = Math.max(8, Math.floor(mip1Width / 2));
    const mip2Height = Math.max(8, Math.floor(mip1Height / 2));
    const mip3Width = Math.max(4, Math.floor(mip2Width / 2));
    const mip3Height = Math.max(4, Math.floor(mip2Height / 2));
    const mip4Width = Math.max(2, Math.floor(mip3Width / 2));
    const mip4Height = Math.max(2, Math.floor(mip3Height / 2));

    console.log(`[RetroPostProcessor] Creating 5-level mip pyramid:`);
    console.log(`  mip0=${mip0Width}x${mip0Height}, mip1=${mip1Width}x${mip1Height}`);
    console.log(`  mip2=${mip2Width}x${mip2Height}, mip3=${mip3Width}x${mip3Height}, mip4=${mip4Width}x${mip4Height}`);

    // Mip0 texture (half of extract)
    this.bloomMip0Texture = this.backend.createTexture(
      'retro-post-bloom-mip0',
      mip0Width,
      mip0Height,
      null,
      { format: 'rgba' }
    );

    // Mip1 texture (half of mip0)
    this.bloomMip1Texture = this.backend.createTexture(
      'retro-post-bloom-mip1',
      mip1Width,
      mip1Height,
      null,
      { format: 'rgba' }
    );

    // Mip2 texture (half of mip1)
    this.bloomMip2Texture = this.backend.createTexture(
      'retro-post-bloom-mip2',
      mip2Width,
      mip2Height,
      null,
      { format: 'rgba' }
    );

    // Mip3 texture (half of mip2)
    this.bloomMip3Texture = this.backend.createTexture(
      'retro-post-bloom-mip3',
      mip3Width,
      mip3Height,
      null,
      { format: 'rgba' }
    );

    // Mip4 texture (half of mip3, smallest mip)
    this.bloomMip4Texture = this.backend.createTexture(
      'retro-post-bloom-mip4',
      mip4Width,
      mip4Height,
      null,
      { format: 'rgba' }
    );

    // Create framebuffers for each bloom texture
    this.bloomExtractFramebuffer = this.backend.createFramebuffer(
      'retro-post-bloom-extract-fb',
      [this.bloomExtractTexture],
      undefined // No depth attachment for post-processing
    );

    this.bloomMip0Framebuffer = this.backend.createFramebuffer(
      'retro-post-bloom-mip0-fb',
      [this.bloomMip0Texture],
      undefined
    );

    this.bloomMip1Framebuffer = this.backend.createFramebuffer(
      'retro-post-bloom-mip1-fb',
      [this.bloomMip1Texture],
      undefined
    );

    this.bloomMip2Framebuffer = this.backend.createFramebuffer(
      'retro-post-bloom-mip2-fb',
      [this.bloomMip2Texture],
      undefined
    );

    this.bloomMip3Framebuffer = this.backend.createFramebuffer(
      'retro-post-bloom-mip3-fb',
      [this.bloomMip3Texture],
      undefined
    );

    this.bloomMip4Framebuffer = this.backend.createFramebuffer(
      'retro-post-bloom-mip4-fb',
      [this.bloomMip4Texture],
      undefined
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

    // 4. Create samplers (needed for bind groups)
    // We need to access the WebGPU device directly to create samplers
    // The backend interface doesn't expose sampler creation
    const device = (this.backend as any).getDevice?.() as GPUDevice;
    if (!device) {
      throw new Error('[RetroPostProcessor] Cannot access GPU device for sampler creation');
    }

    // Linear sampler for post-processing textures
    this.linearSampler = device.createSampler({
      minFilter: 'linear',
      magFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    // Nearest sampler for LUT texture (no interpolation for color grading)
    this.lutSampler = device.createSampler({
      minFilter: 'nearest',
      magFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    // 5. Create composite output texture (if CRT enabled)
    // CRT pass needs a texture to render composite output to, then applies CRT effect to swapchain
    // Uses internal resolution (width×height) to match the scene/bloom textures
    if (this.config.crt?.enabled) {
      console.log(`[RetroPostProcessor] Creating composite texture for CRT input: ${this.width}x${this.height}`);
      this.compositeTexture = this.backend.createTexture(
        'retro-post-composite-output',
        this.width,   // Internal resolution (e.g., 640×480)
        this.height,  // Internal resolution (e.g., 640×480)
        null,
        { format: 'bgra8unorm' as any }
      );

      this.compositeFramebuffer = this.backend.createFramebuffer(
        'retro-post-composite-fb',
        [this.compositeTexture],
        undefined // No depth attachment for post-processing
      );
    }

    // 6. Create uniform buffers (Task 4)
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

    // Load bloom downsample shader
    this.bloomDownsampleShader = this.backend.createShader('retro-bloom-downsample', {
      vertex: bloomDownsampleWGSL,
      fragment: bloomDownsampleWGSL,
    });

    // Load bloom upsample shader
    this.bloomUpsampleShader = this.backend.createShader('retro-bloom-upsample', {
      vertex: bloomUpsampleWGSL,
      fragment: bloomUpsampleWGSL,
    });

    // Load composite shader
    this.compositeShader = this.backend.createShader('retro-composite', {
      vertex: compositeWGSL,
      fragment: compositeWGSL,
    });

    // Load CRT shader (if CRT configured)
    if (this.config.crt?.enabled) {
      this.crtShader = this.backend.createShader('retro-crt-yah', {
        vertex: crtYahWGSL,
        fragment: crtYahWGSL,
      });
    }
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
        { binding: 0, visibility: ['fragment'], type: 'uniform' },
      ],
    });

    // Bloom Downsample Shader
    // @group(0): texture_2d + sampler (input texture)
    this.downsampleTextureLayout = this.backend.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ['fragment'], type: 'texture' },
        { binding: 1, visibility: ['fragment'], type: 'sampler' },
      ],
    });

    // @group(1): uniform buffer (DownsampleParams: texelSize vec2 + padding)
    this.downsampleUniformLayout = this.backend.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ['fragment'], type: 'uniform' },
      ],
    });

    // Bloom Upsample Shader
    // @group(0): texture_2d + sampler (input texture)
    this.upsampleTextureLayout = this.backend.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ['fragment'], type: 'texture' },
        { binding: 1, visibility: ['fragment'], type: 'sampler' },
      ],
    });

    // @group(1): uniform buffer (UpsampleParams: texelSize vec2 + blendFactor f32 + padding)
    this.upsampleUniformLayout = this.backend.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ['fragment'], type: 'uniform' },
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
        { binding: 0, visibility: ['fragment'], type: 'uniform' },
      ],
    });

    // CRT Shader (if configured)
    if (this.config.crt?.enabled) {
      // @group(0): texture_2d + sampler (input texture - composite output)
      this.crtTextureLayout = this.backend.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: ['fragment'], type: 'texture' },
          { binding: 1, visibility: ['fragment'], type: 'sampler' },
        ],
      });

      // @group(1): uniform buffer (CRTParams)
      this.crtParamsLayout = this.backend.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: ['fragment'], type: 'uniform' },
        ],
      });
    }
  }

  /**
   * Create uniform buffers with proper WGSL alignment
   * Task 4: Create 3 uniform buffers
   */
  private createUniformBuffers(): void {
    // BloomParams (32 bytes to meet WebGPU alignment requirements)
    // struct BloomParams {
    //   threshold: f32,      // 4 bytes
    //   _padding: vec3<f32>, // 12 bytes
    // }
    // WebGPU rounds uniform buffers to 32 byte minimum
    const bloomParamsData = new Float32Array(8); // 32 bytes
    bloomParamsData[0] = this.config.bloomThreshold;
    // bloomParamsData[1-7] remain 0 (padding)

    if (this.bloomParamsBuffer) {
      this.backend.deleteBuffer(this.bloomParamsBuffer);
    }
    this.bloomParamsBuffer = this.backend.createBuffer(
      'retro-bloom-params',
      'uniform',
      bloomParamsData,
      'dynamic_draw'
    );

    // DownsampleParams (16 bytes)
    // struct DownsampleParams {
    //   texelSize: vec2<f32>,  // 8 bytes
    //   _padding: vec2<f32>,   // 8 bytes
    // }
    const downsampleParamsData = new Float32Array(4); // 16 bytes
    // downsampleParamsData[0-1] will be set per-pass (texelSize)
    // downsampleParamsData[2-3] remain 0 (padding)

    if (this.downsampleParamsBuffer) {
      this.backend.deleteBuffer(this.downsampleParamsBuffer);
    }
    this.downsampleParamsBuffer = this.backend.createBuffer(
      'retro-downsample-params',
      'uniform',
      downsampleParamsData,
      'dynamic_draw'
    );

    // UpsampleParams (16 bytes)
    // struct UpsampleParams {
    //   texelSize: vec2<f32>,  // 8 bytes
    //   blendFactor: f32,      // 4 bytes
    //   _padding: f32,         // 4 bytes
    // }
    const upsampleParamsData = new Float32Array(4); // 16 bytes
    // upsampleParamsData[0-1] will be set per-pass (texelSize)
    // upsampleParamsData[2] will be set per-pass (blendFactor)
    // upsampleParamsData[3] remains 0 (padding)

    if (this.upsampleParamsBuffer) {
      this.backend.deleteBuffer(this.upsampleParamsBuffer);
    }
    this.upsampleParamsBuffer = this.backend.createBuffer(
      'retro-upsample-params',
      'uniform',
      upsampleParamsData,
      'dynamic_draw'
    );

    // PostParams (48 bytes - WebGPU requires 48 bytes for this uniform buffer)
    // struct PostParams {
    //   bloomIntensity: f32,  // 4 bytes
    //   grainAmount: f32,     // 4 bytes
    //   gamma: f32,           // 4 bytes
    //   ditherPattern: u32,   // 4 bytes
    //   time: f32,            // 4 bytes
    //   _padding: vec3<f32>,  // 12 bytes
    //   _padding2: vec2<f32>, // 8 bytes additional padding
    // }
    const postParamsData = new Float32Array(12); // 48 bytes
    postParamsData[0] = this.config.bloomIntensity;
    postParamsData[1] = this.config.grainAmount;
    postParamsData[2] = this.config.gamma;
    postParamsData[3] = this.config.ditherPattern;
    postParamsData[4] = this.time;
    // postParamsData[5-11] remain 0 (padding)

    if (this.postParamsBuffer) {
      this.backend.deleteBuffer(this.postParamsBuffer);
    }
    this.postParamsBuffer = this.backend.createBuffer(
      'retro-post-params',
      'uniform',
      postParamsData,
      'dynamic_draw'
    );

    // CRTParams (96 bytes - WebGPU requires 96 bytes for this struct)
    // struct CRTParams {
    //   resolution: vec2<f32>,     // 8 bytes
    //   sourceSize: vec2<f32>,     // 8 bytes
    //   masterIntensity: f32,      // 4 bytes
    //   ... (13 more f32 params)   // 52 bytes
    //   _padding: vec3<f32>,       // 12 bytes
    // }
    if (this.config.crt?.enabled) {
      const crtParamsData = new Float32Array(24); // 96 bytes (WebGPU alignment)
      crtParamsData[0] = this.displayWidth;   // params.resolution - output swapchain size (for phosphor mask)
      crtParamsData[1] = this.displayHeight;
      crtParamsData[2] = this.width;          // params.sourceSize - composite texture size being sampled (for scanlines)
      crtParamsData[3] = this.height;
      crtParamsData[4] = this.config.crt.masterIntensity;
      crtParamsData[5] = this.config.crt.brightness;
      crtParamsData[6] = this.config.crt.contrast;
      crtParamsData[7] = this.config.crt.saturation;
      crtParamsData[8] = this.config.crt.scanlinesStrength;
      crtParamsData[9] = this.config.crt.beamWidthMin;
      crtParamsData[10] = this.config.crt.beamWidthMax;
      crtParamsData[11] = this.config.crt.beamShape;
      crtParamsData[12] = this.config.crt.maskIntensity;
      // Map mask type string to float (1=aperture-grille, 2=slot-mask, 3=shadow-mask)
      crtParamsData[13] = this.config.crt.maskType === 'aperture-grille' ? 1.0 :
                          this.config.crt.maskType === 'slot-mask' ? 2.0 : 3.0;
      crtParamsData[14] = this.config.crt.curvatureAmount;
      crtParamsData[15] = this.config.crt.vignetteAmount;
      crtParamsData[16] = this.config.crt.cornerRadius;
      crtParamsData[17] = this.config.crt.colorOverflow;
      // crtParamsData[18-23] remain 0 (padding vec3)

      if (this.crtParamsBuffer) {
        this.backend.deleteBuffer(this.crtParamsBuffer);
      }
      this.crtParamsBuffer = this.backend.createBuffer(
        'retro-crt-params',
        'uniform',
        crtParamsData,
        'dynamic_draw'
      );
    }
  }

  /**
   * Create render pipelines
   * Task 4: Create 3 pipelines for bloom extract, blur, and composite
   */
  private createPipelines(): void {
    if (!this.bloomExtractShader || !this.bloomDownsampleShader ||
        !this.bloomUpsampleShader || !this.compositeShader) {
      throw new Error('[RetroPostProcessor] Shaders not initialized');
    }

    if (!this.extractTextureLayout || !this.extractUniformLayout ||
        !this.downsampleTextureLayout || !this.downsampleUniformLayout ||
        !this.upsampleTextureLayout || !this.upsampleUniformLayout ||
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
      colorFormat: 'rgba8unorm', // Bloom textures use RGBA format
      depthFormat: undefined // No depth in post-processing
    });

    // Bloom Downsample Pipeline
    // 13-tap filter for downsampling bloom to mip pyramid
    this.bloomDownsamplePipeline = this.backend.createRenderPipeline({
      label: 'retro-bloom-downsample',
      shader: this.bloomDownsampleShader,
      vertexLayouts: [], // Fullscreen triangle, no vertex buffers
      bindGroupLayouts: [this.downsampleTextureLayout, this.downsampleUniformLayout],
      pipelineState: {
        topology: 'triangle-list',
        blend: {
          enabled: false, // Replace, don't blend
          srcFactor: 'one',
          dstFactor: 'zero',
          operation: 'add'
        },
        rasterization: {
          cullMode: 'none',
          frontFace: 'ccw'
        }
      },
      colorFormat: 'rgba8unorm', // Bloom textures use RGBA format
      depthFormat: undefined
    });

    // Bloom Upsample Pipeline
    // 3x3 tent filter for upsampling with ADDITIVE BLENDING (critical!)
    this.bloomUpsamplePipeline = this.backend.createRenderPipeline({
      label: 'retro-bloom-upsample',
      shader: this.bloomUpsampleShader,
      vertexLayouts: [], // Fullscreen triangle, no vertex buffers
      bindGroupLayouts: [this.upsampleTextureLayout, this.upsampleUniformLayout],
      pipelineState: {
        topology: 'triangle-list',
        blend: {
          enabled: true, // ADDITIVE BLENDING - accumulates mip levels!
          srcFactor: 'one',
          dstFactor: 'one',
          operation: 'add'
        },
        rasterization: {
          cullMode: 'none',
          frontFace: 'ccw'
        }
      },
      colorFormat: 'rgba8unorm', // Bloom textures use RGBA format
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
      depthFormat: undefined  // No depth testing for fullscreen post-processing
    });

    // CRT Pipeline (if configured)
    if (this.config.crt?.enabled && this.crtShader && this.crtTextureLayout && this.crtParamsLayout) {
      this.crtPipeline = this.backend.createRenderPipeline({
        label: 'retro-crt-yah',
        shader: this.crtShader,
        vertexLayouts: [], // Fullscreen triangle, no vertex buffers
        bindGroupLayouts: [this.crtTextureLayout, this.crtParamsLayout],
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
  }

  /**
   * Apply post-processing to scene texture
   * Returns final composited texture
   */
  apply(sceneTexture: BackendTextureHandle): BackendTextureHandle {
    // console.log('[POST] Starting apply()');
    // Pass 1: Extract bright pixels
    this.bloomExtractPass(sceneTexture);
    // console.log('[POST] Bloom extract pass complete');

    // Pass 2a: Downsample mip pyramid (Extract → Mip0 → Mip1)
    this.bloomDownsamplePass();
    // console.log('[POST] Bloom downsample pass complete');

    // Pass 2b: Upsample with additive blending (Mip1 → Mip0 → Extract)
    this.bloomUpsamplePass();
    // console.log('[POST] Bloom upsample pass complete');

    // NOTE: Old blur pass removed, replaced with mip pyramid downsample/upsample
    // this.bloomBlurPass();

    // Pass 3: Composite (bloom + tonemap + LUT + dither + grain)
    const result = this.compositePass(sceneTexture);
    // console.log('[POST] Composite pass complete, returning:', !!result);

    // Pass 4: CRT effect (if enabled)
    if (this.config.crt && this.config.crt.enabled) {
      // console.log('[POST] Applying CRT-Yah effect');
      this.crtPass();
    }

    return result;
  }

  /**
   * Pass 1: Extract bright pixels above threshold
   */
  private bloomExtractPass(sceneTexture: BackendTextureHandle): void {
    if (!this.bloomExtractTexture || !this.bloomExtractFramebuffer || !this.bloomExtractPipeline) {
      console.warn('[RetroPostProcessor] Bloom extract resources not initialized');
      return;
    }

    if (!this.bloomParamsBuffer || !this.linearSampler) {
      console.warn('[RetroPostProcessor] Bloom extract uniforms/samplers not initialized');
      return;
    }

    if (!this.extractTextureLayout || !this.extractUniformLayout) {
      console.warn('[RetroPostProcessor] Bloom extract bind group layouts not initialized');
      return;
    }

    // Update bloom params uniform with current threshold
    const bloomParamsData = new Float32Array(4);
    bloomParamsData[0] = this.config.bloomThreshold;
    this.backend.updateBuffer(this.bloomParamsBuffer, bloomParamsData);

    // Create bind group for scene texture (group 0)
    // CRITICAL: WebGPU requires separate bindings for texture (binding 0) and sampler (binding 1)
    const textureBindGroup = this.backend.createBindGroup(this.extractTextureLayout, {
      bindings: [
        { binding: 0, resource: sceneTexture }, // Texture at binding 0
        { binding: 1, resource: this.linearSampler as any }, // Sampler at binding 1 (raw GPUSampler)
      ],
    });

    // Create bind group for bloom params (group 1)
    const uniformBindGroup = this.backend.createBindGroup(this.extractUniformLayout, {
      bindings: [
        { binding: 0, resource: this.bloomParamsBuffer },
      ],
    });

    // Begin render pass to bloom extract framebuffer
    this.backend.beginRenderPass(
      this.bloomExtractFramebuffer,
      [0, 0, 0, 0], // Clear to black
      undefined,
      undefined,
      'Bloom Extract Pass'
    );

    // Execute draw command (fullscreen triangle, 3 vertices)
    this.backend.executeDrawCommand({
      pipeline: this.bloomExtractPipeline,
      bindGroups: new Map([
        [0, textureBindGroup],
        [1, uniformBindGroup],
      ]),
      geometry: {
        type: 'nonIndexed',
        vertexBuffers: new Map(), // No vertex buffers - fullscreen triangle generated in shader
        vertexCount: 3, // 3 vertices for fullscreen triangle
      },
      label: 'Bloom Extract Draw',
    });

    // End render pass
    this.backend.endRenderPass();

    // Clean up bind groups (they're one-time use)
    this.backend.deleteBindGroup(textureBindGroup);
    this.backend.deleteBindGroup(uniformBindGroup);
  }

  /**
   * Execute a single downsample step
   */
  private executeDownsampleStep(
    sourceTexture: BackendTextureHandle,
    targetFramebuffer: BackendFramebufferHandle,
    sourceWidth: number,
    sourceHeight: number,
    label: string
  ): void {
    // Update params with source texel size
    const params = new Float32Array(4);
    params[0] = 1.0 / sourceWidth;
    params[1] = 1.0 / sourceHeight;
    this.backend.updateBuffer(this.downsampleParamsBuffer!, params);

    // Create bind groups
    const textureBindGroup = this.backend.createBindGroup(this.downsampleTextureLayout!, {
      bindings: [
        { binding: 0, resource: sourceTexture },
        { binding: 1, resource: this.linearSampler as any },
      ],
    });

    const uniformBindGroup = this.backend.createBindGroup(this.downsampleUniformLayout!, {
      bindings: [
        { binding: 0, resource: this.downsampleParamsBuffer! },
      ],
    });

    // Render pass
    this.backend.beginRenderPass(targetFramebuffer, [0, 0, 0, 0], undefined, undefined, label);

    this.backend.executeDrawCommand({
      pipeline: this.bloomDownsamplePipeline!,
      bindGroups: new Map([
        [0, textureBindGroup],
        [1, uniformBindGroup],
      ]),
      geometry: {
        type: 'nonIndexed',
        vertexBuffers: new Map(),
        vertexCount: 3,
      },
      label: `${label} Draw`,
    });

    this.backend.endRenderPass();

    // Clean up
    this.backend.deleteBindGroup(textureBindGroup);
    this.backend.deleteBindGroup(uniformBindGroup);
  }

  /**
   * Execute a single upsample step with additive blending
   */
  private executeUpsampleStep(
    sourceTexture: BackendTextureHandle,
    targetFramebuffer: BackendFramebufferHandle,
    sourceWidth: number,
    sourceHeight: number,
    blendFactor: number,
    label: string
  ): void {
    // Update params with source texel size and blend factor
    const params = new Float32Array(4);
    params[0] = 1.0 / sourceWidth;
    params[1] = 1.0 / sourceHeight;
    params[2] = blendFactor;
    this.backend.updateBuffer(this.upsampleParamsBuffer!, params);

    // Create bind groups
    const textureBindGroup = this.backend.createBindGroup(this.upsampleTextureLayout!, {
      bindings: [
        { binding: 0, resource: sourceTexture },
        { binding: 1, resource: this.linearSampler as any },
      ],
    });

    const uniformBindGroup = this.backend.createBindGroup(this.upsampleUniformLayout!, {
      bindings: [
        { binding: 0, resource: this.upsampleParamsBuffer! },
      ],
    });

    // Render pass with additive blending
    this.backend.beginRenderPass(targetFramebuffer, [0, 0, 0, 0], undefined, undefined, label);

    this.backend.executeDrawCommand({
      pipeline: this.bloomUpsamplePipeline!,
      bindGroups: new Map([
        [0, textureBindGroup],
        [1, uniformBindGroup],
      ]),
      geometry: {
        type: 'nonIndexed',
        vertexBuffers: new Map(),
        vertexCount: 3,
      },
      label: `${label} Draw`,
    });

    this.backend.endRenderPass();

    // Clean up
    this.backend.deleteBindGroup(textureBindGroup);
    this.backend.deleteBindGroup(uniformBindGroup);
  }

  /**
   * Bloom Downsample Pass (Mip Pyramid)
   * Downsamples bloom extract through mip chain with 13-tap filter
   * 5-level pyramid: Extract (160x120) → Mip0 (80x60) → Mip1 (40x30) → Mip2 (20x15) → Mip3 (10x8) → Mip4 (5x4)
   */
  private bloomDownsamplePass(): void {
    if (!this.bloomExtractTexture || !this.bloomMip0Texture || !this.bloomMip1Texture ||
        !this.bloomMip2Texture || !this.bloomMip3Texture || !this.bloomMip4Texture) {
      console.warn('[RetroPostProcessor] Bloom mip textures not initialized');
      return;
    }

    if (!this.bloomMip0Framebuffer || !this.bloomMip1Framebuffer ||
        !this.bloomMip2Framebuffer || !this.bloomMip3Framebuffer || !this.bloomMip4Framebuffer) {
      console.warn('[RetroPostProcessor] Bloom mip framebuffers not initialized');
      return;
    }

    if (!this.bloomDownsamplePipeline || !this.downsampleParamsBuffer || !this.linearSampler) {
      console.warn('[RetroPostProcessor] Downsample resources not initialized');
      return;
    }

    if (!this.downsampleTextureLayout || !this.downsampleUniformLayout) {
      console.warn('[RetroPostProcessor] Downsample bind group layouts not initialized');
      return;
    }

    // Define downsample chain: [sourceTexture, targetFramebuffer, sourceWidth, sourceHeight, minMipLevel]
    const downsampleChain: [BackendTextureHandle, BackendFramebufferHandle, number, number, number][] = [
      [this.bloomExtractTexture, this.bloomMip0Framebuffer, 160, 120, 1],
      [this.bloomMip0Texture, this.bloomMip1Framebuffer, 80, 60, 2],
      [this.bloomMip1Texture, this.bloomMip2Framebuffer, 40, 30, 3],
      [this.bloomMip2Texture, this.bloomMip3Framebuffer, 20, 15, 4],
      [this.bloomMip3Texture, this.bloomMip4Framebuffer, 10, 8, 5],
    ];

    for (let i = 0; i < downsampleChain.length; i++) {
      const [srcTex, dstFB, srcW, srcH, minLevel] = downsampleChain[i];
      if (this.config.bloomMipLevels >= minLevel) {
        this.executeDownsampleStep(srcTex, dstFB, srcW, srcH, `Bloom Downsample ${i}`);
      }
    }
  }

  /**
   * Bloom Upsample Pass (Mip Pyramid)
   * Upsamples and accumulates mip levels with 3x3 tent filter and additive blending
   * 5-level pyramid (reverse): Mip4 → Mip3 → Mip2 → Mip1 → Mip0 → Extract
   */
  private bloomUpsamplePass(): void {
    if (!this.bloomMip0Texture || !this.bloomMip1Texture || !this.bloomMip2Texture ||
        !this.bloomMip3Texture || !this.bloomMip4Texture || !this.bloomExtractTexture) {
      console.warn('[RetroPostProcessor] Bloom mip textures not initialized');
      return;
    }

    if (!this.bloomMip0Framebuffer || !this.bloomMip1Framebuffer || !this.bloomMip2Framebuffer ||
        !this.bloomMip3Framebuffer || !this.bloomExtractFramebuffer) {
      console.warn('[RetroPostProcessor] Bloom upsample framebuffers not initialized');
      return;
    }

    if (!this.bloomUpsamplePipeline || !this.upsampleParamsBuffer || !this.linearSampler) {
      console.warn('[RetroPostProcessor] Upsample resources not initialized');
      return;
    }

    if (!this.upsampleTextureLayout || !this.upsampleUniformLayout) {
      console.warn('[RetroPostProcessor] Upsample bind group layouts not initialized');
      return;
    }

    // Define upsample chain: [sourceTexture, targetFramebuffer, sourceWidth, sourceHeight, blendFactor, minMipLevel]
    const upsampleChain: [BackendTextureHandle, BackendFramebufferHandle, number, number, number, number][] = [
      [this.bloomMip4Texture, this.bloomMip3Framebuffer, 5, 4, 0.3, 5],
      [this.bloomMip3Texture, this.bloomMip2Framebuffer, 10, 8, 0.5, 4],
      [this.bloomMip2Texture, this.bloomMip1Framebuffer, 20, 15, 0.6, 3],
      [this.bloomMip1Texture, this.bloomMip0Framebuffer, 40, 30, 0.8, 2],
      [this.bloomMip0Texture, this.bloomExtractFramebuffer, 80, 60, 1.0, 1],
    ];

    for (let i = 0; i < upsampleChain.length; i++) {
      const [srcTex, dstFB, srcW, srcH, blend, minLevel] = upsampleChain[i];
      if (this.config.bloomMipLevels >= minLevel) {
        this.executeUpsampleStep(srcTex, dstFB, srcW, srcH, blend, `Bloom Upsample ${i}`);
      }
    }
  }

  /**
   * Pass 3: Composite final image
   */
  private compositePass(sceneTexture: BackendTextureHandle): BackendTextureHandle {
    if (!this.bloomExtractTexture || !this.compositePipeline) {
      console.warn('[RetroPostProcessor] Composite resources not initialized');
      return sceneTexture;
    }

    if (!this.postParamsBuffer || !this.linearSampler || !this.lutSampler) {
      console.warn('[RetroPostProcessor] Composite uniforms/samplers not initialized');
      return sceneTexture;
    }

    if (!this.compositeSceneLayout || !this.compositeBloomLayout ||
        !this.compositeLUTLayout || !this.compositeParamsLayout) {
      console.warn('[RetroPostProcessor] Composite bind group layouts not initialized');
      return sceneTexture;
    }

    // Update post params uniform with current settings
    // struct PostParams {
    //   bloomIntensity: f32,  // 4 bytes
    //   grainAmount: f32,     // 4 bytes
    //   gamma: f32,           // 4 bytes
    //   ditherPattern: u32,   // 4 bytes
    //   time: f32,            // 4 bytes
    //   _padding: vec3<f32>,  // 12 bytes
    //   _padding2: vec2<f32>, // 8 bytes additional padding
    // }
    const postParamsData = new Float32Array(12); // 48 bytes
    postParamsData[0] = this.config.bloomIntensity;
    postParamsData[1] = this.config.grainAmount;
    postParamsData[2] = this.config.gamma;
    // ditherPattern is u32, but we store in Float32Array (bit pattern preserved)
    const ditherU32View = new Uint32Array(postParamsData.buffer, 12, 1);
    ditherU32View[0] = this.config.ditherPattern;
    postParamsData[4] = this.time;
    // postParamsData[5-11] remain 0 (padding)
    this.backend.updateBuffer(this.postParamsBuffer, postParamsData);

    // Create bind group for scene texture (group 0)
    const sceneBindGroup = this.backend.createBindGroup(this.compositeSceneLayout, {
      bindings: [
        { binding: 0, resource: sceneTexture },
        { binding: 1, resource: this.linearSampler as any },
      ],
    });

    // Create bind group for bloom texture (group 1)
    const bloomBindGroup = this.backend.createBindGroup(this.compositeBloomLayout, {
      bindings: [
        { binding: 0, resource: this.bloomExtractTexture },
        { binding: 1, resource: this.linearSampler as any },
      ],
    });

    // Create bind group for color LUT (group 2)
    // Use fallback 1x1 white texture if no LUT provided
    const lutTexture = this.config.colorLUT || this.fallbackLUT;
    if (!lutTexture) {
      console.warn('[RetroPostProcessor] No LUT texture available (not even fallback)');
      return sceneTexture;
    }

    const lutBindGroup = this.backend.createBindGroup(this.compositeLUTLayout, {
      bindings: [
        { binding: 0, resource: lutTexture },
        { binding: 1, resource: this.lutSampler as any }, // Nearest filtering for LUT
      ],
    });

    // Create bind group for post params (group 3)
    const paramsBindGroup = this.backend.createBindGroup(this.compositeParamsLayout, {
      bindings: [
        { binding: 0, resource: this.postParamsBuffer },
      ],
    });

    // Render to CRT intermediate texture if CRT enabled, otherwise directly to swapchain
    const renderTarget = (this.config.crt && this.compositeFramebuffer) ? this.compositeFramebuffer : null;
    this.backend.beginRenderPass(
      renderTarget,
      [0, 0, 0, 1], // Clear to black (shouldn't be visible since we draw fullscreen)
      undefined,
      undefined,
      'Retro Composite Pass',
      false // NO depth attachment for post-processing
    );

    // Execute draw command
    this.backend.executeDrawCommand({
      pipeline: this.compositePipeline,
      bindGroups: new Map([
        [0, sceneBindGroup],
        [1, bloomBindGroup],
        [2, lutBindGroup],
        [3, paramsBindGroup],
      ]),
      geometry: {
        type: 'nonIndexed',
        vertexBuffers: new Map(),
        vertexCount: 3, // Fullscreen triangle
      },
      label: 'Retro Composite Draw',
    });

    // End render pass
    this.backend.endRenderPass();

    // Clean up bind groups
    this.backend.deleteBindGroup(sceneBindGroup);
    this.backend.deleteBindGroup(bloomBindGroup);
    this.backend.deleteBindGroup(lutBindGroup);
    this.backend.deleteBindGroup(paramsBindGroup);

    return sceneTexture;
  }

  /**
   * CRT Pass: Apply CRT-Yah effect to composite output
   * Renders composite texture to swapchain with CRT effects
   */
  private crtPass(): void {
    if (!this.config.crt || !this.crtPipeline || !this.compositeTexture || !this.crtParamsBuffer) {
      console.warn('[RetroPostProcessor] CRT pass skipped - resources not initialized');
      return;
    }

    if (!this.linearSampler || !this.crtTextureLayout || !this.crtParamsLayout) {
      console.warn('[RetroPostProcessor] CRT pass skipped - samplers/layouts not initialized');
      return;
    }

    // Update CRT params uniform with current settings
    const crtParamsData = new Float32Array(24); // 96 bytes (WebGPU alignment)
    crtParamsData[0] = this.displayWidth;   // params.resolution - output swapchain size (for phosphor mask)
    crtParamsData[1] = this.displayHeight;
    crtParamsData[2] = this.width;          // params.sourceSize - composite texture size being sampled (for scanlines)
    crtParamsData[3] = this.height;
    crtParamsData[4] = this.config.crt.masterIntensity;
    crtParamsData[5] = this.config.crt.brightness;
    crtParamsData[6] = this.config.crt.contrast;
    crtParamsData[7] = this.config.crt.saturation;
    crtParamsData[8] = this.config.crt.scanlinesStrength;
    crtParamsData[9] = this.config.crt.beamWidthMin;
    crtParamsData[10] = this.config.crt.beamWidthMax;
    crtParamsData[11] = this.config.crt.beamShape;
    crtParamsData[12] = this.config.crt.maskIntensity;
    crtParamsData[13] = this.config.crt.maskType === 'aperture-grille' ? 1.0 :
                        this.config.crt.maskType === 'slot-mask' ? 2.0 : 3.0;
    crtParamsData[14] = this.config.crt.curvatureAmount;
    crtParamsData[15] = this.config.crt.vignetteAmount;
    crtParamsData[16] = this.config.crt.cornerRadius;
    crtParamsData[17] = this.config.crt.colorOverflow;
    this.backend.updateBuffer(this.crtParamsBuffer, crtParamsData);

    // Create bind group for composite texture (group 0)
    const textureBindGroup = this.backend.createBindGroup(this.crtTextureLayout, {
      bindings: [
        { binding: 0, resource: this.compositeTexture },
        { binding: 1, resource: this.linearSampler as any },
      ],
    });

    // Create bind group for CRT params (group 1)
    const paramsBindGroup = this.backend.createBindGroup(this.crtParamsLayout, {
      bindings: [
        { binding: 0, resource: this.crtParamsBuffer },
      ],
    });

    // Render to swapchain
    this.backend.beginRenderPass(
      null, // null = swapchain
      [0, 0, 0, 1],
      undefined,
      undefined,
      'CRT-Yah Pass',
      false
    );

    // Execute draw command
    this.backend.executeDrawCommand({
      pipeline: this.crtPipeline,
      bindGroups: new Map([
        [0, textureBindGroup],
        [1, paramsBindGroup],
      ]),
      geometry: {
        type: 'nonIndexed',
        vertexBuffers: new Map(),
        vertexCount: 3, // Fullscreen triangle
      },
      label: 'CRT-Yah Draw',
    });

    // End render pass
    this.backend.endRenderPass();

    // Clean up bind groups
    this.backend.deleteBindGroup(textureBindGroup);
    this.backend.deleteBindGroup(paramsBindGroup);
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

  setBloomMipLevels(levels: number): void {
    this.config.bloomMipLevels = Math.max(1, Math.min(5, Math.floor(levels)));
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
   * Enable or disable CRT effect at runtime
   *
   * When enabling: Allocates CRT intermediate texture and framebuffer
   * When disabling: Deallocates texture and framebuffer to free VRAM (~24 MB)
   *
   * Note: Shader, pipeline, and layouts remain loaded for fast re-enable
   */
  setCRTEnabled(enabled: boolean): void {
    if (!this.config.crt) return;

    const wasEnabled = this.config.crt.enabled;
    this.config.crt.enabled = enabled;

    // If enabling and texture doesn't exist, allocate it
    if (enabled && !wasEnabled) {
      if (!this.compositeTexture) {
        // Allocate at internal resolution to match scene/bloom textures
        this.compositeTexture = this.backend.createTexture(
          'retro-post-composite-output',
          this.width,   // Internal resolution (e.g., 640×480)
          this.height,  // Internal resolution (e.g., 640×480)
          null,
          { format: 'bgra8unorm' as any }
        );

        this.compositeFramebuffer = this.backend.createFramebuffer(
          'retro-post-composite-fb',
          [this.compositeTexture],
          undefined // No depth attachment for post-processing
        );
      }
    }

    // If disabling, deallocate to free VRAM
    if (!enabled && wasEnabled) {
      if (this.compositeTexture) {
        this.backend.deleteTexture(this.compositeTexture);
        this.compositeTexture = null;
      }
      if (this.compositeFramebuffer) {
        this.backend.deleteFramebuffer(this.compositeFramebuffer);
        this.compositeFramebuffer = null;
      }
    }
  }

  /**
   * Update CRT color overflow amount
   */
  setColorOverflow(value: number): void {
    if (!this.config.crt) return;
    this.config.crt.colorOverflow = Math.max(0, Math.min(1, value));
    this.updateCRTBuffer();
  }

  /**
   * Update CRT scanlines strength
   */
  setScanlinesStrength(value: number): void {
    if (!this.config.crt) return;
    this.config.crt.scanlinesStrength = Math.max(0, Math.min(1, value));
    this.updateCRTBuffer();
  }

  /**
   * Update CRT mask intensity
   */
  setMaskIntensity(value: number): void {
    if (!this.config.crt) return;
    this.config.crt.maskIntensity = Math.max(0, Math.min(1, value));
    this.updateCRTBuffer();
  }

  /**
   * Update CRT curvature amount
   */
  setCurvatureAmount(value: number): void {
    if (!this.config.crt) return;
    this.config.crt.curvatureAmount = Math.max(0, Math.min(1, value));
    this.updateCRTBuffer();
  }

  /**
   * Update CRT vignette amount
   */
  setVignetteAmount(value: number): void {
    if (!this.config.crt) return;
    this.config.crt.vignetteAmount = Math.max(0, Math.min(1, value));
    this.updateCRTBuffer();
  }

  /**
   * Helper method to update CRT uniform buffer with current config
   */
  private updateCRTBuffer(): void {
    if (!this.config.crt || !this.crtParamsBuffer) return;

    const crtParamsData = new Float32Array(24); // 96 bytes (WebGPU alignment)
    crtParamsData[0] = this.displayWidth;   // params.resolution - output swapchain size (for phosphor mask)
    crtParamsData[1] = this.displayHeight;
    crtParamsData[2] = this.width;          // params.sourceSize - composite texture size being sampled (for scanlines)
    crtParamsData[3] = this.height;
    crtParamsData[4] = this.config.crt.masterIntensity;
    crtParamsData[5] = this.config.crt.brightness;
    crtParamsData[6] = this.config.crt.contrast;
    crtParamsData[7] = this.config.crt.saturation;
    crtParamsData[8] = this.config.crt.scanlinesStrength;
    crtParamsData[9] = this.config.crt.beamWidthMin;
    crtParamsData[10] = this.config.crt.beamWidthMax;
    crtParamsData[11] = this.config.crt.beamShape;
    crtParamsData[12] = this.config.crt.maskIntensity;
    crtParamsData[13] = this.config.crt.maskType === 'aperture-grille' ? 1.0 :
                        this.config.crt.maskType === 'slot-mask' ? 2.0 : 3.0;
    crtParamsData[14] = this.config.crt.curvatureAmount;
    crtParamsData[15] = this.config.crt.vignetteAmount;
    crtParamsData[16] = this.config.crt.cornerRadius;
    crtParamsData[17] = this.config.crt.colorOverflow;
    // crtParamsData[18-23] remain 0 (padding)

    this.backend.updateBuffer(this.crtParamsBuffer, crtParamsData);
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
    if (this.bloomMip0Texture) {
      this.backend.deleteTexture(this.bloomMip0Texture);
      this.bloomMip0Texture = null;
    }
    if (this.bloomMip1Texture) {
      this.backend.deleteTexture(this.bloomMip1Texture);
      this.bloomMip1Texture = null;
    }
    if (this.bloomMip2Texture) {
      this.backend.deleteTexture(this.bloomMip2Texture);
      this.bloomMip2Texture = null;
    }
    if (this.bloomMip3Texture) {
      this.backend.deleteTexture(this.bloomMip3Texture);
      this.bloomMip3Texture = null;
    }
    if (this.bloomMip4Texture) {
      this.backend.deleteTexture(this.bloomMip4Texture);
      this.bloomMip4Texture = null;
    }

    // Bloom framebuffers
    if (this.bloomExtractFramebuffer) {
      this.backend.deleteFramebuffer(this.bloomExtractFramebuffer);
      this.bloomExtractFramebuffer = null;
    }
    if (this.bloomMip0Framebuffer) {
      this.backend.deleteFramebuffer(this.bloomMip0Framebuffer);
      this.bloomMip0Framebuffer = null;
    }
    if (this.bloomMip1Framebuffer) {
      this.backend.deleteFramebuffer(this.bloomMip1Framebuffer);
      this.bloomMip1Framebuffer = null;
    }
    if (this.bloomMip2Framebuffer) {
      this.backend.deleteFramebuffer(this.bloomMip2Framebuffer);
      this.bloomMip2Framebuffer = null;
    }
    if (this.bloomMip3Framebuffer) {
      this.backend.deleteFramebuffer(this.bloomMip3Framebuffer);
      this.bloomMip3Framebuffer = null;
    }
    if (this.bloomMip4Framebuffer) {
      this.backend.deleteFramebuffer(this.bloomMip4Framebuffer);
      this.bloomMip4Framebuffer = null;
    }

    // Fallback LUT (only dispose if we're cleaning up everything)
    // Note: fallbackLUT is created once and reused across resizes
    // It will be cleaned up in dispose()

    // CRT intermediate texture (created per-resize)
    if (this.compositeTexture) {
      this.backend.deleteTexture(this.compositeTexture);
      this.compositeTexture = null;
    }
    if (this.compositeFramebuffer) {
      this.backend.deleteFramebuffer(this.compositeFramebuffer);
      this.compositeFramebuffer = null;
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
    if (this.bloomDownsampleShader) {
      this.backend.deleteShader(this.bloomDownsampleShader);
      this.bloomDownsampleShader = null;
    }
    if (this.bloomUpsampleShader) {
      this.backend.deleteShader(this.bloomUpsampleShader);
      this.bloomUpsampleShader = null;
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
    if (this.downsampleTextureLayout) {
      this.backend.deleteBindGroupLayout(this.downsampleTextureLayout);
      this.downsampleTextureLayout = null;
    }
    if (this.downsampleUniformLayout) {
      this.backend.deleteBindGroupLayout(this.downsampleUniformLayout);
      this.downsampleUniformLayout = null;
    }
    if (this.upsampleTextureLayout) {
      this.backend.deleteBindGroupLayout(this.upsampleTextureLayout);
      this.upsampleTextureLayout = null;
    }
    if (this.upsampleUniformLayout) {
      this.backend.deleteBindGroupLayout(this.upsampleUniformLayout);
      this.upsampleUniformLayout = null;
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
    if (this.downsampleParamsBuffer) {
      this.backend.deleteBuffer(this.downsampleParamsBuffer);
      this.downsampleParamsBuffer = null;
    }
    if (this.upsampleParamsBuffer) {
      this.backend.deleteBuffer(this.upsampleParamsBuffer);
      this.upsampleParamsBuffer = null;
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
    if (this.bloomDownsamplePipeline) {
      this.backend.deletePipeline(this.bloomDownsamplePipeline);
      this.bloomDownsamplePipeline = null;
    }
    if (this.bloomUpsamplePipeline) {
      this.backend.deletePipeline(this.bloomUpsamplePipeline);
      this.bloomUpsamplePipeline = null;
    }
    if (this.compositePipeline) {
      this.backend.deletePipeline(this.compositePipeline);
      this.compositePipeline = null;
    }

    // Dispose bind groups (will be created in Task 5)
    this.bloomExtractBindGroup = null;
    this.compositeBindGroup = null;

    // Dispose CRT resources
    if (this.crtShader) {
      this.backend.deleteShader(this.crtShader);
      this.crtShader = null;
    }
    if (this.crtPipeline) {
      this.backend.deletePipeline(this.crtPipeline);
      this.crtPipeline = null;
    }
    if (this.crtTextureLayout) {
      this.backend.deleteBindGroupLayout(this.crtTextureLayout);
      this.crtTextureLayout = null;
    }
    if (this.crtParamsLayout) {
      this.backend.deleteBindGroupLayout(this.crtParamsLayout);
      this.crtParamsLayout = null;
    }
    if (this.crtParamsBuffer) {
      this.backend.deleteBuffer(this.crtParamsBuffer);
      this.crtParamsBuffer = null;
    }
    if (this.compositeTexture) {
      this.backend.deleteTexture(this.compositeTexture);
      this.compositeTexture = null;
    }
    if (this.compositeFramebuffer) {
      this.backend.deleteFramebuffer(this.compositeFramebuffer);
      this.compositeFramebuffer = null;
    }
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
