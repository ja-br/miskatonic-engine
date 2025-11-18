/**
 * Retro Material System - PS1/PS2 style material constraints
 * Enforces 256px max texture resolution, point/bilinear filtering only
 */

import type { IRendererBackend, BackendTextureHandle } from '../backends';

export type RetroMaterialType = 'vertex-color' | 'unlit' | 'lambert' | 'emissive' | 'specular-cubemap';
export type RetroFilterMode = 'point' | 'bilinear';

export interface RetroMaterialConfig {
  /** Material type (determines which shader to use) */
  type: RetroMaterialType;
  /** Base color/albedo */
  color: [number, number, number, number];
  /** Base texture (optional, max 256px) */
  texture?: BackendTextureHandle;
  /** Texture filtering mode */
  filtering: RetroFilterMode;
  /** Enable vertex colors */
  vertexColors: boolean;
  /** Emissive intensity (for emissive materials) */
  emissiveIntensity?: number;
  /** Specular intensity (for specular-cubemap materials) */
  specularIntensity?: number;
  /** Environment cubemap (for specular-cubemap materials) */
  envCubemap?: BackendTextureHandle;
}

/**
 * Retro material with texture size constraints
 * Enforces 256px maximum resolution and limited filtering modes
 */
export class RetroMaterial {
  private backend: IRendererBackend;
  private config: RetroMaterialConfig;

  constructor(backend: IRendererBackend, config: Partial<RetroMaterialConfig> = {}) {
    this.backend = backend;
    this.config = {
      type: config.type ?? 'lambert',
      color: config.color ?? [1, 1, 1, 1],
      texture: config.texture,
      filtering: config.filtering ?? 'point',
      vertexColors: config.vertexColors ?? true,
      emissiveIntensity: config.emissiveIntensity ?? 1.0,
      specularIntensity: config.specularIntensity ?? 0.5,
      envCubemap: config.envCubemap,
    };
  }

  /**
   * Set texture with automatic 256px constraint enforcement
   * If texture is larger than 256px, it should be downsampled
   */
  setTexture(texture: BackendTextureHandle | undefined): void {
    if (texture) {
      // TODO: Query texture dimensions from backend
      // TODO: If > 256px, downsample or warn
      // For now, just accept it
      this.config.texture = texture;
    } else {
      this.config.texture = undefined;
    }
  }

  /**
   * Set filtering mode (point or bilinear only)
   */
  setFiltering(mode: RetroFilterMode): void {
    this.config.filtering = mode;
  }

  /**
   * Set material color
   */
  setColor(color: [number, number, number, number]): void {
    this.config.color = color;
  }

  /**
   * Enable/disable vertex colors
   */
  setVertexColors(enabled: boolean): void {
    this.config.vertexColors = enabled;
  }

  /**
   * Set emissive intensity (for emissive materials)
   */
  setEmissiveIntensity(intensity: number): void {
    this.config.emissiveIntensity = Math.max(0, intensity);
  }

  /**
   * Set specular intensity (for specular-cubemap materials)
   */
  setSpecularIntensity(intensity: number): void {
    this.config.specularIntensity = Math.max(0, intensity);
  }

  /**
   * Set environment cubemap (for specular-cubemap materials)
   */
  setEnvCubemap(cubemap: BackendTextureHandle | undefined): void {
    this.config.envCubemap = cubemap;
  }

  /**
   * Get material type (determines shader selection)
   */
  getType(): RetroMaterialType {
    return this.config.type;
  }

  /**
   * Get material configuration
   */
  getConfig(): RetroMaterialConfig {
    return { ...this.config };
  }

  /**
   * Get shader name for this material type
   */
  getShaderName(): string {
    switch (this.config.type) {
      case 'vertex-color':
        return 'vertex-color.wgsl';
      case 'unlit':
        return 'unlit.wgsl';
      case 'lambert':
        return 'simple-lambert.wgsl';
      case 'emissive':
        return 'emissive.wgsl';
      case 'specular-cubemap':
        return 'specular-cubemap.wgsl';
    }
  }

  /**
   * Check if material requires vertex colors
   */
  requiresVertexColors(): boolean {
    return this.config.vertexColors || this.config.type === 'vertex-color';
  }

  /**
   * Check if material requires texture
   */
  requiresTexture(): boolean {
    return this.config.type !== 'vertex-color';
  }

  /**
   * Check if material requires cubemap
   */
  requiresCubemap(): boolean {
    return this.config.type === 'specular-cubemap';
  }

  /**
   * Validate material configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check texture requirements
    if (this.requiresTexture() && !this.config.texture) {
      errors.push(`Material type '${this.config.type}' requires a texture`);
    }

    // Check cubemap requirements
    if (this.requiresCubemap() && !this.config.envCubemap) {
      errors.push(`Material type 'specular-cubemap' requires an environment cubemap`);
    }

    // Check texture size (TODO: query actual dimensions from backend)
    // if (this.config.texture) {
    //   const dims = this.backend.getTextureDimensions(this.config.texture);
    //   if (dims.width > 256 || dims.height > 256) {
    //     errors.push(`Texture exceeds 256px limit: ${dims.width}x${dims.height}`);
    //   }
    // }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Materials don't own textures, so nothing to dispose
    // Textures are managed externally
  }
}
