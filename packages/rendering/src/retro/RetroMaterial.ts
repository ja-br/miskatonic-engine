/**
 * Retro Material System
 * Epic 3.4: Retro Rendering Pipeline - Materials & Textures
 *
 * PlayStation 2 era material constraints:
 * - 256px maximum texture resolution
 * - Point filtering / nearest-neighbor sampling option
 * - Texture dithering for smooth gradients
 * - Separate retro/unlit shader variants (not PBR extension)
 */

import type {
  IRendererBackend,
  BackendTextureHandle,
  BackendBufferHandle,
  BackendShaderHandle,
  BackendPipelineHandle,
} from '../backends/IRendererBackend';

/**
 * Retro texture constraints (PS2-era)
 */
export const RETRO_TEXTURE_CONSTRAINTS = {
  /** Maximum texture resolution (256x256) */
  MAX_RESOLUTION: 256,
  /** Typical resolutions used in PS2 games */
  COMMON_RESOLUTIONS: [16, 32, 64, 128, 256] as const,
  /** Force power-of-two dimensions */
  FORCE_POT: true,
} as const;

/**
 * Texture filtering mode (PS2-era)
 */
export enum TextureFilter {
  /** Point/nearest-neighbor (pixelated, authentic retro) */
  Point = 'nearest',
  /** Bilinear (smoother, but still retro) */
  Bilinear = 'linear',
}

/**
 * Retro material type
 */
export enum RetroMaterialType {
  /** Standard lit material (vertex colors, lightmaps, fog) */
  Lit = 'lit',
  /** Unlit emissive material (neon signs, UI) */
  Unlit = 'unlit',
  /** Vertex-colored material (no textures, baked lighting) */
  VertexColored = 'vertex_colored',
}

/**
 * Retro material configuration
 */
export interface RetroMaterialConfig {
  type: RetroMaterialType;

  // Albedo/diffuse
  albedoColor?: [number, number, number]; // RGB color
  albedoTexture?: string | BackendTextureHandle; // Texture path or handle

  // Emissive (for unlit materials)
  emissiveColor?: [number, number, number];

  // Texture filtering
  textureFilter?: TextureFilter;

  // Lightmap (for lit materials)
  lightmapTexture?: BackendTextureHandle;

  // Material properties
  roughness?: number; // 0.0 - 1.0 (for simple specular)
  metallic?: number;  // 0.0 - 1.0 (for cube map reflections)

  // Retro constraints
  enforceMaxResolution?: boolean; // Enforce 256px limit
  useDithering?: boolean;         // Apply dithering to gradients
}

/**
 * Default retro material configuration
 */
export const DEFAULT_RETRO_MATERIAL: RetroMaterialConfig = {
  type: RetroMaterialType.Lit,
  albedoColor: [0.8, 0.8, 0.8],
  emissiveColor: [0, 0, 0],
  textureFilter: TextureFilter.Bilinear,
  roughness: 0.5,
  metallic: 0.0,
  enforceMaxResolution: true,
  useDithering: true,
};

/**
 * Retro Material
 *
 * Manages materials with PS2-era constraints:
 * - Enforces 256px texture limit
 * - Provides point/bilinear filtering options
 * - Separate shader variants for lit/unlit
 * - No PBR (no IBL, no normal maps, no complex BRDF)
 *
 * @example
 * ```typescript
 * const material = new RetroMaterial(backend, {
 *   type: RetroMaterialType.Lit,
 *   albedoTexture: 'crate_diffuse.png',
 *   textureFilter: TextureFilter.Point,
 *   roughness: 0.7,
 * });
 *
 * await material.initialize();
 * ```
 */
export class RetroMaterial {
  private config: RetroMaterialConfig;
  private initialized = false;
  private initializationPromise?: Promise<void>;

  // GPU resources
  private albedoTexture?: BackendTextureHandle;
  private lightmapTexture?: BackendTextureHandle;
  private uniformBuffer?: BackendBufferHandle;
  private shader?: BackendShaderHandle;
  private pipeline?: BackendPipelineHandle;

  // Texture loading
  private externalTextures = new Set<string>(); // Paths to load

  constructor(
    private backend: IRendererBackend,
    config: RetroMaterialConfig
  ) {
    this.config = { ...DEFAULT_RETRO_MATERIAL, ...config };
  }

  /**
   * Initialize material (load textures, create resources)
   * Safe to call multiple times - will return existing promise if already initializing
   */
  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.initialized) return;

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization and store the promise
    this.initializationPromise = this.doInitialize();

    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = undefined;
    }
  }

  private async doInitialize(): Promise<void> {
    // Load textures
    await this.loadTextures();

    // Create uniform buffer
    this.createUniformBuffer();

    // Create shader and pipeline
    this.createShaderAndPipeline();

    this.initialized = true;
  }

  /**
   * Get pipeline handle for rendering
   */
  getPipeline(): BackendPipelineHandle {
    if (!this.pipeline) {
      throw new Error('RetroMaterial not initialized. Call initialize() first.');
    }
    return this.pipeline;
  }

  /**
   * Get uniform buffer handle
   */
  getUniformBuffer(): BackendBufferHandle {
    if (!this.uniformBuffer) {
      throw new Error('RetroMaterial not initialized. Call initialize() first.');
    }
    return this.uniformBuffer;
  }

  /**
   * Get albedo texture handle (if any)
   */
  getAlbedoTexture(): BackendTextureHandle | undefined {
    return this.albedoTexture;
  }

  /**
   * Get lightmap texture handle (if any)
   */
  getLightmapTexture(): BackendTextureHandle | undefined {
    return this.lightmapTexture;
  }

  /**
   * Update material properties
   */
  updateProperties(props: Partial<RetroMaterialConfig>): void {
    this.config = { ...this.config, ...props };

    if (this.uniformBuffer) {
      this.updateUniformBuffer();
    }
  }

  /**
   * Clean up GPU resources
   */
  dispose(): void {
    if (this.albedoTexture) {
      this.backend.deleteTexture(this.albedoTexture);
      this.albedoTexture = undefined;
    }
    if (this.lightmapTexture) {
      this.backend.deleteTexture(this.lightmapTexture);
      this.lightmapTexture = undefined;
    }
    if (this.uniformBuffer) {
      this.backend.deleteBuffer(this.uniformBuffer);
      this.uniformBuffer = undefined;
    }
    if (this.shader) {
      this.backend.deleteShader(this.shader);
      this.shader = undefined;
    }

    // Pipeline is managed by backend, no manual deletion needed
    this.pipeline = undefined;

    this.initialized = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async loadTextures(): Promise<void> {
    // Load albedo texture
    if (this.config.albedoTexture) {
      if (typeof this.config.albedoTexture === 'string') {
        // Load from path
        this.albedoTexture = await this.loadTextureFromPath(this.config.albedoTexture);
      } else {
        // Use existing handle
        this.albedoTexture = this.config.albedoTexture;
      }
    } else {
      // Create default white texture
      this.albedoTexture = this.createDefaultTexture([255, 255, 255, 255]);
    }

    // Load lightmap texture
    if (this.config.lightmapTexture) {
      this.lightmapTexture = this.config.lightmapTexture;
    } else {
      // Create default white lightmap (no shadowing)
      this.lightmapTexture = this.createDefaultTexture([255, 255, 255, 255]);
    }
  }

  private async loadTextureFromPath(path: string): Promise<BackendTextureHandle> {
    // This is a placeholder - actual implementation would use image loading
    // For now, create a simple procedural texture

    const size = this.enforceTextureConstraints(256);
    const data = this.generatePlaceholderTexture(size, size);

    return this.backend.createTexture(
      `retro_texture_${path}`,
      size,
      size,
      data,
      {
        format: 'rgba8unorm',
        minFilter: this.config.textureFilter || 'linear',
        magFilter: this.config.textureFilter || 'linear',
        wrapS: 'repeat',
        wrapT: 'repeat',
        generateMipmaps: this.config.textureFilter === TextureFilter.Bilinear,
      }
    );
  }

  private createDefaultTexture(color: [number, number, number, number]): BackendTextureHandle {
    const data = new Uint8Array(color);

    return this.backend.createTexture(
      'retro_default_texture',
      1,
      1,
      data,
      {
        format: 'rgba8unorm',
        minFilter: 'nearest',
        magFilter: 'nearest',
        wrapS: 'repeat',
        wrapT: 'repeat',
      }
    );
  }

  private createUniformBuffer(): void {
    const data = this.packUniformData();

    this.uniformBuffer = this.backend.createBuffer(
      'retro_material_uniforms',
      'uniform',
      data,
      'dynamic_draw'
    );
  }

  private updateUniformBuffer(): void {
    if (!this.uniformBuffer) return;

    const data = this.packUniformData();
    this.backend.updateBuffer(this.uniformBuffer, data);
  }

  /**
   * Pack material uniforms into Float32Array
   * Follows WebGPU alignment rules (16-byte for vec3/vec4)
   */
  private packUniformData(): Float32Array {
    const data = new Float32Array(16); // 64 bytes (4 vec4s)
    let offset = 0;

    // Albedo color (vec3 + padding)
    data[offset++] = this.config.albedoColor?.[0] ?? 0.8;
    data[offset++] = this.config.albedoColor?.[1] ?? 0.8;
    data[offset++] = this.config.albedoColor?.[2] ?? 0.8;
    data[offset++] = 0; // Padding

    // Emissive color (vec3 + padding)
    data[offset++] = this.config.emissiveColor?.[0] ?? 0;
    data[offset++] = this.config.emissiveColor?.[1] ?? 0;
    data[offset++] = this.config.emissiveColor?.[2] ?? 0;
    data[offset++] = 0; // Padding

    // Material properties (vec4)
    data[offset++] = this.config.roughness ?? 0.5;
    data[offset++] = this.config.metallic ?? 0.0;
    data[offset++] = 0; // Padding
    data[offset++] = 0; // Padding

    return data;
  }

  private createShaderAndPipeline(): void {
    // TODO Epic 3.4: Create retro shader variants
    // For now, this is a placeholder
    // Actual implementation will load retro-lighting.wgsl
  }

  /**
   * Enforce PS2-era texture constraints
   * Clamps resolution to max 256px and ensures power-of-two
   */
  private enforceTextureConstraints(size: number): number {
    if (!this.config.enforceMaxResolution) {
      return size;
    }

    // Clamp to max resolution
    size = Math.min(size, RETRO_TEXTURE_CONSTRAINTS.MAX_RESOLUTION);

    // Round down to nearest power of two
    if (RETRO_TEXTURE_CONSTRAINTS.FORCE_POT) {
      size = Math.pow(2, Math.floor(Math.log2(size)));
    }

    return size;
  }

  /**
   * Generate placeholder texture for testing
   */
  private generatePlaceholderTexture(width: number, height: number): Uint8Array {
    const data = new Uint8Array(width * height * 4);

    // Checkerboard pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const checker = ((x >> 4) + (y >> 4)) & 1;

        if (checker) {
          data[i] = 200; // R
          data[i + 1] = 200; // G
          data[i + 2] = 200; // B
        } else {
          data[i] = 100; // R
          data[i + 1] = 100; // G
          data[i + 2] = 100; // B
        }

        data[i + 3] = 255; // A
      }
    }

    return data;
  }
}

/**
 * Utility: Apply texture dithering to smooth gradients
 * Prevents banding artifacts in low-resolution textures
 *
 * @param imageData - RGBA image data
 * @param width - Image width
 * @param height - Image height
 * @param strength - Dither strength (0.0 - 1.0)
 * @returns Dithered image data
 */
export function applyTextureDithering(
  imageData: Uint8Array,
  width: number,
  height: number,
  strength: number = 0.5
): Uint8Array {
  const output = new Uint8Array(imageData);

  // Bayer 4x4 matrix
  const bayer4x4 = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5,
  ];

  const ditherScale = strength * 16; // Max dither value

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      // Get Bayer pattern value
      const bayerX = x % 4;
      const bayerY = y % 4;
      const bayerValue = bayer4x4[bayerY * 4 + bayerX];

      // Apply dither to each color channel
      const ditherOffset = (bayerValue / 16.0 - 0.5) * ditherScale;

      output[i] = Math.max(0, Math.min(255, imageData[i] + ditherOffset));     // R
      output[i + 1] = Math.max(0, Math.min(255, imageData[i + 1] + ditherOffset)); // G
      output[i + 2] = Math.max(0, Math.min(255, imageData[i + 2] + ditherOffset)); // B
      // Alpha unchanged
    }
  }

  return output;
}

/**
 * Utility: Downscale texture to retro resolution
 * Ensures texture meets PS2-era constraints
 *
 * @param imageData - RGBA image data
 * @param width - Current width
 * @param height - Current height
 * @param targetSize - Target size (will be clamped to 256px)
 * @returns Downscaled image data and new dimensions
 */
export function downscaleToRetroResolution(
  imageData: Uint8Array,
  width: number,
  height: number,
  targetSize: number = 256
): { data: Uint8Array; width: number; height: number } {
  // Input validation
  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid dimensions: width=${width}, height=${height}. Must be positive.`);
  }

  if (targetSize <= 0) {
    throw new Error(`Invalid targetSize: ${targetSize}. Must be positive.`);
  }

  const expectedSize = width * height * 4;
  if (imageData.length < expectedSize) {
    throw new Error(
      `ImageData too small: expected ${expectedSize} bytes (${width}x${height} RGBA), got ${imageData.length}`
    );
  }

  // Clamp to max resolution
  const maxSize = RETRO_TEXTURE_CONSTRAINTS.MAX_RESOLUTION;
  targetSize = Math.min(targetSize, maxSize);

  // Ensure power of two
  targetSize = Math.pow(2, Math.floor(Math.log2(targetSize)));

  // Simple nearest-neighbor downscaling
  const newData = new Uint8Array(targetSize * targetSize * 4);
  const scaleX = width / targetSize;
  const scaleY = height / targetSize;

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const srcX = Math.floor(x * scaleX);
      const srcY = Math.floor(y * scaleY);

      const srcI = (srcY * width + srcX) * 4;
      const dstI = (y * targetSize + x) * 4;

      newData[dstI] = imageData[srcI];
      newData[dstI + 1] = imageData[srcI + 1];
      newData[dstI + 2] = imageData[srcI + 2];
      newData[dstI + 3] = imageData[srcI + 3];
    }
  }

  return {
    data: newData,
    width: targetSize,
    height: targetSize,
  };
}
