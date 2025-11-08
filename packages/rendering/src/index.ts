/**
 * @miskatonic/rendering
 * WebGL2/WebGPU rendering engine for Miskatonic
 */

// Main renderer
export { Renderer } from './Renderer';

// Core rendering classes
export { RenderContext } from './RenderContext';
export { Camera, OrbitControls } from './Camera';  // Standalone (legacy)
export { CameraSystem } from './CameraSystem';      // ECS system (Epic 3.10)
export { OrbitCameraController, FirstPersonCameraController } from './CameraControllers';
export { createCube, createSphere, createPlane, type GeometryData } from './Geometry';
export { ShaderManager, type ShaderManagerConfig } from './ShaderManager';
// ShaderLoader is Node.js-only (uses fs/promises), not for browser use
// export { ShaderLoader, type ShaderFeatures, type LoadedShader, type ShaderLoaderConfig, type ShaderSourceFile } from './ShaderLoader';
export { BufferManager, type BufferDescriptor } from './BufferManager';
export { TextureManager, type TextureConfig, type TextureDescriptor } from './TextureManager';
export { FramebufferManager, type FramebufferConfig, type FramebufferDescriptor, type FramebufferAttachment, type TextureMetadata } from './FramebufferManager';
export { CommandBuffer } from './CommandBuffer';
export { RenderPass, RenderPassManager, type RenderPassConfig, type RenderTarget } from './RenderPass';
export { MaterialManager, type Material, type MaterialConfig, type PBRMaterialProperties, type MaterialTextures } from './Material';
export { RenderQueue, type QueuedDrawCommand, type CameraInfo, type RenderQueueStats } from './RenderQueue';

// Backend abstraction (Epic 3.2)
export {
  // Backend interface and implementations
  type IRendererBackend,
  type BackendConfig,
  type BackendCapabilities,
  type BackendShaderHandle,
  type BackendBufferHandle,
  type BackendTextureHandle,
  type BackendFramebufferHandle,
  isBackendShaderHandle,
  isBackendBufferHandle,
  isBackendTextureHandle,
  isBackendFramebufferHandle,
  WebGL2Backend,
  WebGPUBackend,
  BackendFactory,
  type BackendFactoryOptions,
  type BackendSupport,
} from './backends';

// Types and enums
export {
  // Enums
  RenderBackend,
  PrimitiveMode,
  AttributeType,
  UniformType,
  RenderCommandType,

  // Type aliases
  type ShaderType,
  type TextureFormat,
  type TextureFilter,
  type TextureWrap,
  type BlendMode,
  type DepthTest,
  type CullMode,
  type BufferUsage,

  // Interfaces
  type VertexAttribute,
  type Uniform,
  type ShaderSource,
  type ShaderProgram,
  type RenderState,
  type VertexLayout,
  type IndexType,
  type DrawCommand,
  type ClearCommand,
  type SetStateCommand,
  type SetShaderCommand,
  type SetUniformCommand,
  type BindTextureCommand,
  type BindFramebufferCommand,
  type RenderCommand,
  type RenderStats,
  type RendererConfig,

  // Constants
  DEFAULT_RENDER_STATE,
} from './types';
