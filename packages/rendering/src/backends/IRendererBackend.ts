/**
 * IRendererBackend - Epic 3.2
 *
 * Abstraction interface for WebGPU rendering backends.
 * Provides a unified API for command buffer execution and resource management.
 *
 * Design Philosophy:
 * - Command-based rendering (not immediate mode)
 * - Resource handles are backend-specific
 * - No WebGL/WebGPU types in interface (use opaque handles)
 */

import type {
  ShaderSource,
  RenderStats,
  BufferUsage,
  TextureFormat,
  TextureFilter,
  TextureWrap,
} from '../types';
import type { VRAMStats } from '../VRAMProfiler';
import type {
  BindGroupLayoutDescriptor,
} from '../BindGroupDescriptors';
import type { PipelineStateDescriptor } from '../PipelineStateDescriptor';
import type { ShaderReflectionData } from '../ShaderReflection';
import type { DrawCommand } from '../commands/DrawCommand';

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
 * Epic 3.14: Bind group handle for resource bindings
 */
export interface BackendBindGroupHandle {
  readonly __brand: 'BackendBindGroup';
  readonly id: string;
}

/**
 * Epic 3.14: Bind group layout handle
 */
export interface BackendBindGroupLayoutHandle {
  readonly __brand: 'BackendBindGroupLayout';
  readonly id: string;
}

/**
 * Epic 3.14: Pipeline handle for render and compute pipelines
 */
export interface BackendPipelineHandle {
  readonly __brand: 'BackendPipeline';
  readonly id: string;
  readonly type: 'render' | 'compute';
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
 * Epic 3.14: Vertex buffer layout (backend-agnostic)
 */
export interface VertexBufferLayout {
  arrayStride: number;
  stepMode: 'vertex' | 'instance';
  attributes: Array<{
    shaderLocation: number;
    offset: number;
    format: string; // e.g., 'float32x3', 'float32x4'
  }>;
}

/**
 * Epic 3.14: Render pipeline descriptor
 */
export interface RenderPipelineDescriptor {
  label?: string;
  shader: BackendShaderHandle;
  vertexLayouts: VertexBufferLayout[];
  bindGroupLayouts: BackendBindGroupLayoutHandle[];
  pipelineState: PipelineStateDescriptor;
  colorFormat: 'bgra8unorm' | 'rgba8unorm';
  depthFormat?: 'depth24plus' | 'depth24plus-stencil8';
}

/**
 * Epic 3.14: Compute pipeline descriptor
 */
export interface ComputePipelineDescriptor {
  label?: string;
  shader: BackendShaderHandle;
  bindGroupLayouts: BackendBindGroupLayoutHandle[];
  entryPoint?: string;
}

/**
 * Epic 3.14: Bind group resource bindings
 */
export interface BindGroupResources {
  bindings: Array<{
    binding: number;
    resource: BackendBufferHandle | { texture: BackendTextureHandle; sampler?: any };
  }>;
}


/**
 * Renderer backend interface
 *
 * Implementations: WebGPUBackend
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
   * Reinitialize the backend after device loss (Epic 3.19 - RENDERING-04)
   * Recreates the GPU device and context without destroying the backend instance
   * All resources must be recreated after this call
   */
  reinitialize(): Promise<void>;

  /**
   * Begin a new frame
   */
  beginFrame(): void;

  /**
   * End current frame and present
   */
  endFrame(): void;

  /**
   * Execute unified draw command (Epic 3.14 Consolidation)
   * Supports indexed, non-indexed, indirect, and compute dispatches
   * Uses explicit bind groups and pipelines
   */
  executeDrawCommand(command: DrawCommand): void;

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

  /**
   * Get VRAM usage statistics (Epic 3.8)
   */
  getVRAMStats(): VRAMStats;

  /**
   * Get VRAM profiler (for debugging)
   */
  getVRAMProfiler(): VRAMProfiler;

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
   * Create vertex, index, uniform, or storage buffer
   */
  createBuffer(
    id: string,
    type: 'vertex' | 'index' | 'uniform' | 'storage',
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
   * Set vertex attribute divisor for instanced rendering (Epic 3.13)
   *
   * WebGL2: Calls gl.vertexAttribDivisor(location, divisor)
   * WebGPU: Configures stepMode in vertex buffer layout
   *
   * @param shader - Shader handle to get attribute location from
   * @param attributeName - Name of the attribute (e.g., 'a_InstanceTransform')
   * @param divisor - Divisor value (0 = per-vertex, 1 = per-instance, N = per N instances)
   */
  setVertexAttributeDivisor(
    shader: BackendShaderHandle,
    attributeName: string,
    divisor: number
  ): void;

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

  // Epic 3.14: Modern Rendering API Methods

  /**
   * Create bind group layout from descriptor
   * Defines the structure of resource bindings for a bind group
   */
  createBindGroupLayout(descriptor: BindGroupLayoutDescriptor): BackendBindGroupLayoutHandle;

  /**
   * Delete bind group layout
   */
  deleteBindGroupLayout(handle: BackendBindGroupLayoutHandle): void;

  /**
   * Create bind group with actual resource bindings
   * Must match the layout structure
   */
  createBindGroup(
    layout: BackendBindGroupLayoutHandle,
    resources: BindGroupResources
  ): BackendBindGroupHandle;

  /**
   * Delete bind group
   */
  deleteBindGroup(handle: BackendBindGroupHandle): void;

  /**
   * Create render pipeline
   * Defines complete rendering state and shaders
   */
  createRenderPipeline(descriptor: RenderPipelineDescriptor): BackendPipelineHandle;

  /**
   * Create compute pipeline
   * For GPU compute workloads (particle systems, light culling, etc.)
   */
  createComputePipeline(descriptor: ComputePipelineDescriptor): BackendPipelineHandle;

  /**
   * Delete pipeline (render or compute)
   */
  deletePipeline(handle: BackendPipelineHandle): void;

  /**
   * Create shader with automatic reflection
   * Extracts bind group layouts and vertex attributes from shader source
   */
  createShaderWithReflection(
    id: string,
    source: ShaderSource
  ): { handle: BackendShaderHandle; reflection: ShaderReflectionData };

  /**
   * Dispatch compute shader
   * Executes compute workloads on the GPU
   */
  dispatchCompute(
    pipeline: BackendPipelineHandle,
    workgroupsX: number,
    workgroupsY: number,
    workgroupsZ: number
  ): void;

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

/**
 * Type guard for backend bind group handles
 */
export function isBackendBindGroupHandle(handle: any): handle is BackendBindGroupHandle {
  return handle && handle.__brand === 'BackendBindGroup';
}

/**
 * Type guard for backend bind group layout handles
 */
export function isBackendBindGroupLayoutHandle(handle: any): handle is BackendBindGroupLayoutHandle {
  return handle && handle.__brand === 'BackendBindGroupLayout';
}

/**
 * Type guard for backend pipeline handles
 */
export function isBackendPipelineHandle(handle: any): handle is BackendPipelineHandle {
  return handle && handle.__brand === 'BackendPipeline';
}
