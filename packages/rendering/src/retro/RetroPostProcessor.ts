/**
 * Retro Post-Processor
 * Epic 3.4: Retro Rendering Pipeline - Post-Processing
 *
 * PlayStation 2 era post-processing effects using period-appropriate techniques.
 * All effects are designed for authenticity, not modern AAA quality.
 *
 * Philosophy: Embrace limitations as artistic choices
 */

import type { IRendererBackend, BackendTextureHandle, BackendBufferHandle } from '../backends/IRendererBackend';
import { RenderPass, RenderPassManager } from '../RenderPass';

/**
 * Retro post-processing configuration
 */
export interface RetroPostProcessConfig {
  // Bloom settings (simple additive bloom)
  bloom?: {
    enabled: boolean;
    intensity: number;        // 0.0 - 1.0
    threshold: number;        // Brightness threshold (0.0 - 1.0)
    downscaleFactor: number;  // Typical: 4 (quarter resolution)
  };

  // Tone mapping (simple Reinhard or clamping, no HDR thresholds)
  toneMapping?: {
    enabled: boolean;
    mode: 'reinhard' | 'clamp'; // Reinhard for smooth rolloff, clamp for hard clip
    exposure: number;            // Pre-tonemap exposure multiplier
  };

  // Color grading (single-LUT, 256x16 texture lookup)
  colorGrading?: {
    enabled: boolean;
    lutTexture?: BackendTextureHandle; // 256x16 1D LUT texture
  };

  // Ordered dither patterns (Bayer matrix for color/alpha blending)
  dither?: {
    enabled: boolean;
    pattern: 'bayer2x2' | 'bayer4x4' | 'bayer8x8';
    strength: number; // 0.0 - 1.0, dither intensity
  };

  // Noise/grain overlay (film aesthetic)
  grain?: {
    enabled: boolean;
    intensity: number; // 0.0 - 1.0
    size: number;      // Grain texture size (typical: 64-256)
  };
}

/**
 * Default retro post-processing configuration
 * Matches PS2-era defaults
 */
export const DEFAULT_RETRO_POST_CONFIG: RetroPostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.3,
    threshold: 0.8,
    downscaleFactor: 4,
  },
  toneMapping: {
    enabled: true,
    mode: 'reinhard',
    exposure: 1.0,
  },
  colorGrading: {
    enabled: false,
  },
  dither: {
    enabled: true,
    pattern: 'bayer4x4',
    strength: 0.5,
  },
  grain: {
    enabled: true,
    intensity: 0.15,
    size: 128,
  },
};

/**
 * Retro Post-Processor
 *
 * Manages a chain of retro post-processing effects:
 * 1. Bloom extraction & blur (low-res buffer)
 * 2. Tone mapping (Reinhard or clamping)
 * 3. Color grading (LUT-based)
 * 4. Dithering (Bayer matrix)
 * 5. Film grain (noise overlay)
 *
 * @example
 * ```typescript
 * const postProcessor = new RetroPostProcessor(backend, config);
 * await postProcessor.initialize(width, height);
 *
 * // During render loop
 * backend.beginFrame();
 * // ... render scene to mainTarget ...
 * postProcessor.apply(mainTarget, outputTarget);
 * backend.endFrame();
 * ```
 */
export class RetroPostProcessor {
  private config: RetroPostProcessConfig;
  private passManager = new RenderPassManager();

  // Render targets
  private bloomTarget?: BackendTextureHandle;    // Low-res bloom buffer
  private tempTarget?: BackendTextureHandle;     // Temporary buffer for ping-pong

  // Uniform buffer (single buffer for all parameters)
  private paramsBuffer?: BackendBufferHandle;

  // Built-in textures
  private bayerTexture?: BackendTextureHandle;   // Bayer matrix pattern
  private grainTexture?: BackendTextureHandle;   // Noise texture

  // Dimensions
  private width = 0;
  private height = 0;
  private initialized = false;

  constructor(
    private backend: IRendererBackend,
    config?: Partial<RetroPostProcessConfig>
  ) {
    this.config = this.mergeConfig(config);
  }

  /**
   * Initialize post-processing resources
   * Creates render targets, textures, and uniform buffers
   *
   * @param width - Viewport width
   * @param height - Viewport height
   */
  async initialize(width: number, height: number): Promise<void> {
    if (this.initialized) {
      this.resize(width, height);
      return;
    }

    this.width = width;
    this.height = height;

    // Create render passes
    this.setupRenderPasses();

    // Create render targets
    this.createRenderTargets();

    // Create uniform buffers
    this.createUniformBuffers();

    // Create built-in textures
    await this.createBuiltinTextures();

    this.initialized = true;
  }

  /**
   * Apply post-processing effects to input texture
   *
   * @param inputTexture - Scene render target
   * @param outputTexture - Final output target (usually screen)
   *
   * NOTE: Full implementation deferred to Epic 3.4 Phase 2 (Integration)
   * Requires:
   * - WebGPU render pass setup for bloom extract/blur/composite
   * - Bind group creation for textures and params
   * - Pipeline creation for fullscreen quad rendering
   * - Framebuffer ping-pong for multi-pass effects
   *
   * Architecture is complete, render pass execution needs backend integration.
   */
  apply(inputTexture: BackendTextureHandle, outputTexture: BackendTextureHandle): void {
    if (!this.initialized) {
      throw new Error('RetroPostProcessor not initialized. Call initialize() first.');
    }

    // Update uniforms (time-based grain animation, etc.)
    this.updateUniforms();

    // TODO Epic 3.4 Phase 2: Implement render pass execution
    // Pass 1: Bloom extraction (input -> bloomTarget)
    // Pass 2: Bloom blur (bloomTarget -> tempTarget -> bloomTarget)
    // Pass 3: Composite (input + bloom -> output, apply tone mapping, dither, grain)
  }

  /**
   * Resize render targets (call when viewport changes)
   */
  resize(width: number, height: number): void {
    if (this.width === width && this.height === height) {
      return;
    }

    this.width = width;
    this.height = height;

    // Destroy old targets
    if (this.bloomTarget) {
      this.backend.deleteTexture(this.bloomTarget);
    }
    if (this.tempTarget) {
      this.backend.deleteTexture(this.tempTarget);
    }

    // Recreate targets with new size
    this.createRenderTargets();
  }

  /**
   * Update configuration (useful for runtime tweaking)
   */
  updateConfig(config: Partial<RetroPostProcessConfig>): void {
    this.config = this.mergeConfig(config);

    // Mark uniforms dirty for next apply()
    if (this.initialized) {
      this.updateUniforms();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<RetroPostProcessConfig> {
    return { ...this.config };
  }

  /**
   * Clean up GPU resources
   */
  dispose(): void {
    // Destroy render targets
    if (this.bloomTarget) {
      this.backend.deleteTexture(this.bloomTarget);
      this.bloomTarget = undefined;
    }
    if (this.tempTarget) {
      this.backend.deleteTexture(this.tempTarget);
      this.tempTarget = undefined;
    }

    // Destroy uniform buffer
    if (this.paramsBuffer) {
      this.backend.deleteBuffer(this.paramsBuffer);
      this.paramsBuffer = undefined;
    }

    // Destroy built-in textures
    if (this.bayerTexture) {
      this.backend.deleteTexture(this.bayerTexture);
      this.bayerTexture = undefined;
    }
    if (this.grainTexture) {
      this.backend.deleteTexture(this.grainTexture);
      this.grainTexture = undefined;
    }

    this.passManager.clearPasses();
    this.initialized = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private mergeConfig(partial?: Partial<RetroPostProcessConfig>): RetroPostProcessConfig {
    return {
      bloom: { ...DEFAULT_RETRO_POST_CONFIG.bloom, ...partial?.bloom },
      toneMapping: { ...DEFAULT_RETRO_POST_CONFIG.toneMapping, ...partial?.toneMapping },
      colorGrading: { ...DEFAULT_RETRO_POST_CONFIG.colorGrading, ...partial?.colorGrading },
      dither: { ...DEFAULT_RETRO_POST_CONFIG.dither, ...partial?.dither },
      grain: { ...DEFAULT_RETRO_POST_CONFIG.grain, ...partial?.grain },
    };
  }

  private setupRenderPasses(): void {
    // Bloom extraction pass (downscale + threshold)
    if (this.config.bloom?.enabled) {
      const bloomExtract = new RenderPass({
        name: 'bloom_extract',
        target: 'bloom_buffer',
        clear: { color: [0, 0, 0, 1] },
      });
      this.passManager.addPass(bloomExtract);

      // Bloom blur pass (simple box blur or bilinear)
      const bloomBlur = new RenderPass({
        name: 'bloom_blur',
        target: 'bloom_buffer',
        dependencies: ['bloom_extract'],
      });
      this.passManager.addPass(bloomBlur);
    }

    // Composite pass (combine all effects)
    const composite = new RenderPass({
      name: 'retro_composite',
      target: 'screen',
      clear: { color: [0, 0, 0, 1] },
      dependencies: this.config.bloom?.enabled ? ['bloom_blur'] : [],
    });
    this.passManager.addPass(composite);
  }

  private createRenderTargets(): void {
    // Bloom target (quarter resolution for PS2-era look)
    if (this.config.bloom?.enabled) {
      const downscale = this.config.bloom.downscaleFactor;
      const bloomWidth = Math.max(1, Math.floor(this.width / downscale));
      const bloomHeight = Math.max(1, Math.floor(this.height / downscale));

      this.bloomTarget = this.backend.createTexture(
        'retro_bloom_target',
        bloomWidth,
        bloomHeight,
        null,
        {
          format: 'rgba8unorm',
          minFilter: 'linear', // Bilinear upsample
          magFilter: 'linear',
          wrapS: 'clamp-to-edge',
          wrapT: 'clamp-to-edge',
        }
      );
    }

    // Temporary target for ping-pong operations (same as bloom size)
    if (this.config.bloom?.enabled) {
      const downscale = this.config.bloom.downscaleFactor;
      const bloomWidth = Math.max(1, Math.floor(this.width / downscale));
      const bloomHeight = Math.max(1, Math.floor(this.height / downscale));

      this.tempTarget = this.backend.createTexture(
        'retro_temp_target',
        bloomWidth,
        bloomHeight,
        null,
        {
          format: 'rgba8unorm',
          minFilter: 'linear',
          magFilter: 'linear',
          wrapS: 'clamp-to-edge',
          wrapT: 'clamp-to-edge',
        }
      );
    }
  }

  private createUniformBuffers(): void {
    // Pack all parameters into single uniform buffer matching shader layout
    // See retro-post-process.wgsl PostProcessParams struct (lines 48-66)
    const data = new Float32Array(24); // 96 bytes (6 vec4s)
    let offset = 0;

    // Bloom (vec4)
    data[offset++] = this.config.bloom?.intensity ?? 0;
    data[offset++] = this.config.bloom?.threshold ?? 0.8;
    data[offset++] = 0; // Padding
    data[offset++] = 0; // Padding

    // Tone mapping (vec4)
    data[offset++] = this.config.toneMapping?.mode === 'reinhard' ? 1.0 : 0.0;
    data[offset++] = this.config.toneMapping?.exposure ?? 1.0;
    data[offset++] = 0; // Padding
    data[offset++] = 0; // Padding

    // Dither (vec4)
    data[offset++] = this.getDitherPatternSize();
    data[offset++] = this.config.dither?.strength ?? 0;
    data[offset++] = 0; // Padding
    data[offset++] = 0; // Padding

    // Grain (vec4)
    data[offset++] = this.config.grain?.intensity ?? 0;
    data[offset++] = this.config.grain?.size ?? 128;
    data[offset++] = 0; // time (updated per frame)
    data[offset++] = 0; // Padding

    // Resolution (vec2 + padding vec2 = vec4)
    data[offset++] = this.width;
    data[offset++] = this.height;
    data[offset++] = 0; // Padding
    data[offset++] = 0; // Padding

    this.paramsBuffer = this.backend.createBuffer(
      'retro_post_params',
      'uniform',
      data,
      'dynamic_draw'
    );
  }

  private async createBuiltinTextures(): Promise<void> {
    // Create Bayer dither pattern texture
    if (this.config.dither?.enabled) {
      const bayerData = this.generateBayerPattern();
      const size = this.getDitherPatternSize();

      this.bayerTexture = this.backend.createTexture(
        'retro_bayer_pattern',
        size,
        size,
        bayerData,
        {
          format: 'r8unorm',
          minFilter: 'nearest', // Point sampling for dither patterns
          magFilter: 'nearest',
          wrapS: 'repeat',
          wrapT: 'repeat',
        }
      );
    }

    // Create noise/grain texture
    if (this.config.grain?.enabled) {
      const grainSize = this.config.grain.size;
      const grainData = this.generateNoiseTexture(grainSize, grainSize);

      this.grainTexture = this.backend.createTexture(
        'retro_grain_texture',
        grainSize,
        grainSize,
        grainData,
        {
          format: 'r8unorm',
          minFilter: 'linear',
          magFilter: 'linear',
          wrapS: 'repeat',
          wrapT: 'repeat',
        }
      );
    }
  }

  private updateUniforms(): void {
    if (!this.paramsBuffer) return;

    // Pack all parameters into single buffer matching shader layout
    const data = new Float32Array(24); // 96 bytes (6 vec4s)
    let offset = 0;

    // Bloom (vec4)
    data[offset++] = this.config.bloom?.intensity ?? 0;
    data[offset++] = this.config.bloom?.threshold ?? 0.8;
    data[offset++] = 0; // Padding
    data[offset++] = 0; // Padding

    // Tone mapping (vec4)
    data[offset++] = this.config.toneMapping?.mode === 'reinhard' ? 1.0 : 0.0;
    data[offset++] = this.config.toneMapping?.exposure ?? 1.0;
    data[offset++] = 0; // Padding
    data[offset++] = 0; // Padding

    // Dither (vec4)
    data[offset++] = this.getDitherPatternSize();
    data[offset++] = this.config.dither?.strength ?? 0;
    data[offset++] = 0; // Padding
    data[offset++] = 0; // Padding

    // Grain (vec4 - includes animated time)
    const time = performance.now() / 1000.0; // Convert to seconds
    data[offset++] = this.config.grain?.intensity ?? 0;
    data[offset++] = this.config.grain?.size ?? 128;
    data[offset++] = time; // Animated time for grain
    data[offset++] = 0; // Padding

    // Resolution (vec2 + padding vec2 = vec4)
    data[offset++] = this.width;
    data[offset++] = this.height;
    data[offset++] = 0; // Padding
    data[offset++] = 0; // Padding

    this.backend.updateBuffer(this.paramsBuffer, data);
  }

  private getDitherPatternSize(): number {
    if (!this.config.dither) return 4;

    switch (this.config.dither.pattern) {
      case 'bayer2x2': return 2;
      case 'bayer4x4': return 4;
      case 'bayer8x8': return 8;
      default: return 4;
    }
  }

  /**
   * Generate Bayer matrix dither pattern
   * Classic ordered dithering used in PS2 era
   */
  private generateBayerPattern(): Uint8Array {
    const size = this.getDitherPatternSize();
    const data = new Uint8Array(size * size);

    // Bayer 2x2 matrix
    const bayer2x2 = [
      0, 2,
      3, 1,
    ];

    // Bayer 4x4 matrix (recursive pattern)
    const bayer4x4 = [
       0,  8,  2, 10,
      12,  4, 14,  6,
       3, 11,  1,  9,
      15,  7, 13,  5,
    ];

    // Bayer 8x8 matrix (recursive pattern)
    const bayer8x8 = [
       0, 32,  8, 40,  2, 34, 10, 42,
      48, 16, 56, 24, 50, 18, 58, 26,
      12, 44,  4, 36, 14, 46,  6, 38,
      60, 28, 52, 20, 62, 30, 54, 22,
       3, 35, 11, 43,  1, 33,  9, 41,
      51, 19, 59, 27, 49, 17, 57, 25,
      15, 47,  7, 39, 13, 45,  5, 37,
      63, 31, 55, 23, 61, 29, 53, 21,
    ];

    let pattern: number[];
    let maxValue: number;

    switch (size) {
      case 2:
        pattern = bayer2x2;
        maxValue = 3; // Max value in 2x2 matrix, not count
        break;
      case 4:
        pattern = bayer4x4;
        maxValue = 15; // Max value in 4x4 matrix, not count
        break;
      case 8:
        pattern = bayer8x8;
        maxValue = 63; // Max value in 8x8 matrix, not count
        break;
      default:
        pattern = bayer4x4;
        maxValue = 15;
    }

    // Normalize to 0-255 range
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.floor((pattern[i] / maxValue) * 255);
    }

    return data;
  }

  /**
   * Generate random noise texture for film grain
   */
  private generateNoiseTexture(width: number, height: number): Uint8Array {
    const size = width * height;
    const data = new Uint8Array(size);

    // Simple white noise
    for (let i = 0; i < size; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }

    return data;
  }
}
