import type { TextureFormat, TextureFilter, TextureWrap } from './types';

/**
 * Texture configuration
 */
export interface TextureConfig {
  format: TextureFormat;
  minFilter?: TextureFilter;
  magFilter?: TextureFilter;
  wrapS?: TextureWrap;
  wrapT?: TextureWrap;
  generateMipmaps?: boolean;
  anisotropy?: number;
}

/**
 * Texture descriptor
 */
export interface TextureDescriptor {
  id: string;
  texture: WebGLTexture;
  width: number;
  height: number;
  config: TextureConfig;
}

/**
 * Texture manager for texture loading and management
 *
 * Features:
 * - Texture caching by ID
 * - Automatic mipmap generation
 * - Anisotropic filtering support
 * - Memory usage tracking
 * - Multiple format support (RGB, RGBA, Depth, etc.)
 */
export class TextureManager {
  private gl: WebGL2RenderingContext;
  private textures = new Map<string, TextureDescriptor>();
  private anisotropyExt: EXT_texture_filter_anisotropic | null = null;
  private maxAnisotropy = 1;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;

    // Try to get anisotropic filtering extension
    this.anisotropyExt = gl.getExtension('EXT_texture_filter_anisotropic');
    if (this.anisotropyExt) {
      this.maxAnisotropy = gl.getParameter(this.anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    }
  }

  /**
   * Create texture from image data
   */
  createTexture(
    id: string,
    width: number,
    height: number,
    data: ArrayBufferView | HTMLImageElement | HTMLCanvasElement | ImageData | null,
    config: TextureConfig
  ): TextureDescriptor {
    // Check if texture already exists
    const existing = this.textures.get(id);
    if (existing) {
      throw new Error(`Texture already exists: ${id}`);
    }

    // Create texture
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error(`Failed to create texture: ${id}`);
    }

    // Bind texture
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    // Upload data
    const format = this.mapFormat(config.format);
    const type = this.mapType(config.format);

    if (data instanceof HTMLImageElement || data instanceof HTMLCanvasElement || data instanceof ImageData) {
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, format.internal, format.format, type, data);
    } else {
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, format.internal, width, height, 0, format.format, type, data);
    }

    // Generate mipmaps if requested
    if (config.generateMipmaps) {
      this.gl.generateMipmap(this.gl.TEXTURE_2D);
    }

    // Set filtering
    this.setTextureFiltering(config.minFilter ?? 'linear', config.magFilter ?? 'linear');

    // Set wrapping
    this.setTextureWrapping(config.wrapS ?? 'repeat', config.wrapT ?? 'repeat');

    // Set anisotropic filtering
    if (config.anisotropy && this.anisotropyExt) {
      const anisotropy = Math.min(config.anisotropy, this.maxAnisotropy);
      this.gl.texParameterf(this.gl.TEXTURE_2D, this.anisotropyExt.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);
    }

    // Create descriptor
    const descriptor: TextureDescriptor = {
      id,
      texture,
      width,
      height,
      config,
    };

    this.textures.set(id, descriptor);
    return descriptor;
  }

  /**
   * Create empty texture
   */
  createEmptyTexture(id: string, width: number, height: number, config: TextureConfig): TextureDescriptor {
    return this.createTexture(id, width, height, null, config);
  }

  /**
   * Update texture data
   */
  updateTexture(
    id: string,
    data: ArrayBufferView | HTMLImageElement | HTMLCanvasElement | ImageData,
    x: number = 0,
    y: number = 0,
    width?: number,
    height?: number
  ): void {
    const descriptor = this.textures.get(id);
    if (!descriptor) {
      throw new Error(`Texture not found: ${id}`);
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, descriptor.texture);

    const format = this.mapFormat(descriptor.config.format);
    const type = this.mapType(descriptor.config.format);

    if (data instanceof HTMLImageElement || data instanceof HTMLCanvasElement || data instanceof ImageData) {
      this.gl.texSubImage2D(this.gl.TEXTURE_2D, 0, x, y, format.format, type, data);
    } else {
      if (width === undefined || height === undefined) {
        throw new Error('Width and height required for raw data updates');
      }
      this.gl.texSubImage2D(this.gl.TEXTURE_2D, 0, x, y, width, height, format.format, type, data);
    }

    // Regenerate mipmaps if needed
    if (descriptor.config.generateMipmaps) {
      this.gl.generateMipmap(this.gl.TEXTURE_2D);
    }
  }

  /**
   * Get texture descriptor
   */
  getTexture(id: string): TextureDescriptor | null {
    return this.textures.get(id) ?? null;
  }

  /**
   * Check if texture exists
   */
  hasTexture(id: string): boolean {
    return this.textures.has(id);
  }

  /**
   * Delete texture
   */
  deleteTexture(id: string): void {
    const descriptor = this.textures.get(id);
    if (descriptor) {
      this.gl.deleteTexture(descriptor.texture);
      this.textures.delete(id);
    }
  }

  /**
   * Get all texture IDs
   */
  getTextureIds(): string[] {
    return Array.from(this.textures.keys());
  }

  /**
   * Get texture count
   */
  getTextureCount(): number {
    return this.textures.size;
  }

  /**
   * Get estimated memory usage in bytes
   */
  getEstimatedMemory(): number {
    let total = 0;
    for (const descriptor of this.textures.values()) {
      const bytesPerPixel = this.getBytesPerPixel(descriptor.config.format);
      let size = descriptor.width * descriptor.height * bytesPerPixel;

      // Account for mipmaps (roughly 1/3 additional)
      if (descriptor.config.generateMipmaps) {
        size = Math.floor(size * 1.33);
      }

      total += size;
    }
    return total;
  }

  /**
   * Map texture format to WebGL constants
   */
  private mapFormat(format: TextureFormat): { internal: number; format: number } {
    switch (format) {
      case 'rgb':
        return { internal: this.gl.RGB8, format: this.gl.RGB };
      case 'rgba':
        return { internal: this.gl.RGBA8, format: this.gl.RGBA };
      case 'depth':
        return { internal: this.gl.DEPTH_COMPONENT24, format: this.gl.DEPTH_COMPONENT };
      case 'depth_stencil':
        return { internal: this.gl.DEPTH24_STENCIL8, format: this.gl.DEPTH_STENCIL };
      default:
        return { internal: this.gl.RGBA8, format: this.gl.RGBA };
    }
  }

  /**
   * Map texture format to data type
   */
  private mapType(format: TextureFormat): number {
    switch (format) {
      case 'rgb':
      case 'rgba':
        return this.gl.UNSIGNED_BYTE;
      case 'depth':
        return this.gl.UNSIGNED_INT;
      case 'depth_stencil':
        return this.gl.UNSIGNED_INT_24_8;
      default:
        return this.gl.UNSIGNED_BYTE;
    }
  }

  /**
   * Get bytes per pixel for format
   */
  private getBytesPerPixel(format: TextureFormat): number {
    switch (format) {
      case 'rgb':
        return 3;
      case 'rgba':
        return 4;
      case 'depth':
        return 3;
      case 'depth_stencil':
        return 4;
      default:
        return 4;
    }
  }

  /**
   * Set texture filtering
   */
  private setTextureFiltering(minFilter: TextureFilter, magFilter: TextureFilter): void {
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.mapFilter(minFilter));
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.mapMagFilter(magFilter));
  }

  /**
   * Map filter mode to WebGL constant
   */
  private mapFilter(filter: TextureFilter): number {
    switch (filter) {
      case 'nearest':
        return this.gl.NEAREST;
      case 'linear':
        return this.gl.LINEAR;
      case 'nearest_mipmap_nearest':
        return this.gl.NEAREST_MIPMAP_NEAREST;
      case 'linear_mipmap_nearest':
        return this.gl.LINEAR_MIPMAP_NEAREST;
      case 'nearest_mipmap_linear':
        return this.gl.NEAREST_MIPMAP_LINEAR;
      case 'linear_mipmap_linear':
        return this.gl.LINEAR_MIPMAP_LINEAR;
      default:
        return this.gl.LINEAR;
    }
  }

  /**
   * Map mag filter (only nearest/linear supported)
   */
  private mapMagFilter(filter: TextureFilter): number {
    switch (filter) {
      case 'nearest':
        return this.gl.NEAREST;
      default:
        return this.gl.LINEAR;
    }
  }

  /**
   * Set texture wrapping
   */
  private setTextureWrapping(wrapS: TextureWrap, wrapT: TextureWrap): void {
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.mapWrap(wrapS));
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.mapWrap(wrapT));
  }

  /**
   * Map wrap mode to WebGL constant
   */
  private mapWrap(wrap: TextureWrap): number {
    switch (wrap) {
      case 'repeat':
        return this.gl.REPEAT;
      case 'clamp_to_edge':
        return this.gl.CLAMP_TO_EDGE;
      case 'mirrored_repeat':
        return this.gl.MIRRORED_REPEAT;
      default:
        return this.gl.REPEAT;
    }
  }

  /**
   * Clean up all textures
   */
  dispose(): void {
    for (const descriptor of this.textures.values()) {
      this.gl.deleteTexture(descriptor.texture);
    }
    this.textures.clear();
  }
}
