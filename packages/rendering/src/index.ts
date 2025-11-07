/**
 * @miskatonic/rendering
 * WebGL2/WebGPU rendering engine for Miskatonic
 */

// Main renderer
export { Renderer } from './Renderer';

// Core rendering classes
export { RenderContext } from './RenderContext';
export { ShaderManager, type ShaderManagerConfig } from './ShaderManager';
export { BufferManager, type BufferDescriptor } from './BufferManager';
export { TextureManager, type TextureConfig, type TextureDescriptor } from './TextureManager';
export { FramebufferManager, type FramebufferConfig, type FramebufferDescriptor, type FramebufferAttachment, type TextureMetadata } from './FramebufferManager';
export { CommandBuffer } from './CommandBuffer';
export { RenderPass, RenderPassManager, type RenderPassConfig, type RenderTarget } from './RenderPass';

// Types and enums
export {
  // Enums
  RenderBackend,
  PrimitiveMode,
  ShaderType,
  TextureFormat,
  TextureFilter,
  TextureWrap,
  BlendMode,
  DepthTest,
  CullMode,
  AttributeType,
  UniformType,
  BufferUsage,
  RenderCommandType,

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
  type RenderCommand,
  type RenderStats,
  type RendererConfig,

  // Constants
  DEFAULT_RENDER_STATE,
} from './types';
