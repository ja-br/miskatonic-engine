/**
 * IRendererBackend - Epic 3.2
 *
 * Abstraction interface for WebGL2 and WebGPU rendering backends.
 * Provides a unified API for command buffer execution and resource management.
 *
 * Design Philosophy:
 * - Lowest common denominator between WebGL2 and WebGPU
 * - Command-based rendering (not immediate mode)
 * - Resource handles are backend-specific
 * - No WebGL/WebGPU types in interface (use opaque handles)
 */

import type {
  ShaderSource,
  RenderCommand,
  RenderStats,
  BufferUsage,
  TextureFormat,
  TextureFilter,
  TextureWrap,
} from '../types';

/**
 * Opaque resource handles
 * Backends can store any data they need in these
 */
export interface BackendShaderHandle {
  readonly __brand: 'BackendShader';
  readonly id: string;
}

export interface BackendBufferHandle {
  readonly __brand: 'BackendBuffer';
  readonly id: string;
}

export interface BackendTextureHandle {
  readonly __brand: 'BackendTexture';
  readonly id: string;
}

export interface BackendFramebufferHandle {
  readonly __brand: 'BackendFramebuffer';
  readonly id: string;
}

/**
 * Backend capability flags
 */
export interface BackendCapabilities {
  /** Compute shader support */
  compute: boolean;
  /** Maximum texture size */
  maxTextureSize: number;
  /** Maximum uniform buffer size */
  maxUniformBufferSize: number;
  /** Maximum vertex attributes */
  maxVertexAttributes: number;
  /** Maximum color attachments */
  maxColorAttachments: number;
  /** Supports anisotropic filtering */
  anisotropicFiltering: boolean;
  /** Maximum anisotropy level */
  maxAnisotropy: number;
  /** Supports ASTC texture compression */
  textureCompressionASTC: boolean;
  /** Supports ETC2 texture compression */
  textureCompressionETC2: boolean;
  /** Supports BC (DXT) texture compression */
  textureCompressionBC: boolean;
}

/**
 * Backend initialization config
 */
export interface BackendConfig {
  canvas: HTMLCanvasElement;
  antialias?: boolean;
  alpha?: boolean;
  depth?: boolean;
  stencil?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
}

/**
 * Renderer backend interface
 *
 * Implementations: WebGL2Backend, WebGPUBackend
 */
export interface IRendererBackend {
  /**
   * Backend name for debugging
   */
  readonly name: string;

  /**
   * Initialize the backend
   * @returns true if successful, false if backend not supported
   */
  initialize(config: BackendConfig): Promise<boolean>;

  /**
   * Get backend capabilities
   */
  getCapabilities(): BackendCapabilities;

  /**
   * Check if context is lost
   */
  isContextLost(): boolean;

  /**
   * Begin a new frame
   */
  beginFrame(): void;

  /**
   * End current frame and present
   */
  endFrame(): void;

  /**
   * Execute render commands
   */
  executeCommands(commands: RenderCommand[]): void;

  /**
   * Clear framebuffer
   */
  clear(
    color?: [number, number, number, number],
    depth?: number,
    stencil?: number
  ): void;

  /**
   * Resize viewport
   */
  resize(width: number, height: number): void;

  /**
   * Get current render statistics
   */
  getStats(): Readonly<RenderStats>;

  /**
   * Reset statistics counters
   */
  resetStats(): void;

  // Resource Management

  /**
   * Create shader program
   */
  createShader(id: string, source: ShaderSource): BackendShaderHandle;

  /**
   * Delete shader program
   */
  deleteShader(handle: BackendShaderHandle): void;

  /**
   * Create vertex or index buffer
   */
  createBuffer(
    id: string,
    type: 'vertex' | 'index' | 'uniform',
    data: ArrayBuffer | ArrayBufferView,
    usage: BufferUsage
  ): BackendBufferHandle;

  /**
   * Update buffer data
   */
  updateBuffer(
    handle: BackendBufferHandle,
    data: ArrayBuffer | ArrayBufferView,
    offset?: number
  ): void;

  /**
   * Delete buffer
   */
  deleteBuffer(handle: BackendBufferHandle): void;

  /**
   * Create texture
   */
  createTexture(
    id: string,
    width: number,
    height: number,
    data: ArrayBufferView | HTMLImageElement | HTMLCanvasElement | ImageData | null,
    config: {
      format: TextureFormat;
      minFilter?: TextureFilter;
      magFilter?: TextureFilter;
      wrapS?: TextureWrap;
      wrapT?: TextureWrap;
      generateMipmaps?: boolean;
    }
  ): BackendTextureHandle;

  /**
   * Update texture data
   */
  updateTexture(
    handle: BackendTextureHandle,
    data: ArrayBufferView | HTMLImageElement | HTMLCanvasElement | ImageData,
    x?: number,
    y?: number,
    width?: number,
    height?: number
  ): void;

  /**
   * Delete texture
   */
  deleteTexture(handle: BackendTextureHandle): void;

  /**
   * Create framebuffer (render target)
   */
  createFramebuffer(
    id: string,
    colorAttachments: BackendTextureHandle[],
    depthAttachment?: BackendTextureHandle
  ): BackendFramebufferHandle;

  /**
   * Delete framebuffer
   */
  deleteFramebuffer(handle: BackendFramebufferHandle): void;

  /**
   * Cleanup all resources
   */
  dispose(): void;
}

/**
 * Type guard for backend shader handles
 */
export function isBackendShaderHandle(handle: any): handle is BackendShaderHandle {
  return handle && handle.__brand === 'BackendShader';
}

/**
 * Type guard for backend buffer handles
 */
export function isBackendBufferHandle(handle: any): handle is BackendBufferHandle {
  return handle && handle.__brand === 'BackendBuffer';
}

/**
 * Type guard for backend texture handles
 */
export function isBackendTextureHandle(handle: any): handle is BackendTextureHandle {
  return handle && handle.__brand === 'BackendTexture';
}

/**
 * Type guard for backend framebuffer handles
 */
export function isBackendFramebufferHandle(handle: any): handle is BackendFramebufferHandle {
  return handle && handle.__brand === 'BackendFramebuffer';
}
