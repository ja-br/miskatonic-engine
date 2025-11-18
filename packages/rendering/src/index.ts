/**
 * @miskatonic/rendering
 * WebGPU rendering engine for Miskatonic
 */

// Core rendering classes
export { CameraSystem } from './CameraSystem';      // ECS system (Epic 3.10)
export { OrbitCameraController, FirstPersonCameraController } from './CameraControllers';
export {
  createCube,
  createSphere,
  createPlane,
  loadOBJ,
  loadOBJWithMaterials,
  loadOBJWithMaterialsFromContent,
  parseOBJ,
  parseOBJWithMaterials,
  parseMTL,
  type GeometryData,
  type MaterialData,
  type MaterialGroup,
  type ModelData,
} from './Geometry';

// Epic 3.15: Light Component & Integration
export { LightCollection, LightType, type LightData } from './LightCollection';
export { LightSystem } from './LightSystem';
export type { LightComponentData, TransformComponentData } from './LightTypes';

// Epic 3.16: Light Culling (Phase 1: CPU Frustum Culling)
export {
  Frustum,
  FrustumPlane,
  type Plane,
  BoundingSphere,
  BoundingBox,
  LightCuller,
  BatchLightCuller,
  type LightCullingStats,
} from './culling';

// Epic 3.5: Lightweight Object Culling
export {
  ObjectCuller,
  type ObjectCullerConfig,
  type CullResult,
  type CullStats,
  SortOrder,
  SpatialGrid,
  type SpatialGridConfig,
  type SpatialObject,
  OccluderVolumeManager,
  type OccluderVolume,
  OcclusionResult,
  SoftwareOcclusionTest,
  type SoftwareOcclusionConfig,
  type DepthOccluder,
  DepthOcclusionResult,
} from './culling';
export { RenderPass, RenderPassManager, type RenderPassConfig, type RenderTarget } from './RenderPass';

// Epic 3.8: GPU Memory Management
export { GPUBufferPool, BufferUsageType, type BufferPoolStats } from './GPUBufferPool';
export { TextureAtlas, type AtlasRegion, type TextureAtlasStats } from './TextureAtlas';
export { VRAMProfiler, VRAMCategory, type VRAMBudget, type VRAMUsage, type VRAMStats } from './VRAMProfiler';

// Epic 3.18: Lighting Performance & Utilities (Profiling)
// NOTE: GPUTimingProfiler and LightingBenchmark removed - API was broken (used non-existent encoder.writeTimestamp())
// TODO Epic 3.18: Re-implement GPU timing using GPURenderPassEncoder.writeTimestamp() if needed

// Epic 3.18 Phase 3: Light Animation Systems
export { FlickeringLightSystem } from './systems/FlickeringLightSystem';
export { PulsingLightSystem } from './systems/PulsingLightSystem';
export { OrbitingLightSystem } from './systems/OrbitingLightSystem';

// Epic 3.13: Instance rendering and batching
export { InstanceBuffer, InstanceBufferPool, globalInstanceBufferPool, type InstanceData } from './InstanceBuffer';
export { InstanceBufferManager, type GPUInstanceBuffer } from './InstanceBufferManager';
export { InstancedShaderManager, createShaderVariants, type ShaderVariant, type InstancedShaderConfig } from './InstancedShaderManager';

// Backend abstraction (Epic 3.2 + Epic 3.14)
export {
  // Backend interface and implementations
  type IRendererBackend,
  type BackendConfig,
  type BackendCapabilities,
  type BackendShaderHandle,
  type BackendBufferHandle,
  type BackendTextureHandle,
  type BackendFramebufferHandle,
  // Epic 3.14: New handle types
  type BackendBindGroupHandle,
  type BackendBindGroupLayoutHandle,
  type BackendPipelineHandle,
  type RenderPipelineDescriptor,
  type ComputePipelineDescriptor,
  type BindGroupResources,
  type VertexBufferLayout,
  isBackendShaderHandle,
  isBackendBufferHandle,
  isBackendTextureHandle,
  isBackendFramebufferHandle,
  // Epic 3.14: New type guards
  isBackendBindGroupHandle,
  isBackendBindGroupLayoutHandle,
  isBackendPipelineHandle,
  WebGPUBackend,
  BackendFactory,
  type BackendFactoryOptions,
  type BackendSupport,
} from './backends';

// Demo UI utilities
export { DemoUI, type DemoUICallbacks, type DemoPerformanceMetrics, type QualityTier } from './DemoUI';

// Epic 3.14: Modern Rendering API
export {
  // Bind group descriptors
  type BindGroupLayoutDescriptor,
  type BindGroupLayoutEntry,
  type BindGroupDescriptor,
  type BindGroupResourceBinding,
  type BindingType,
  type ShaderStage,
  validateBindGroupLayout,
  createSceneBindGroupLayout,
  createObjectBindGroupLayout,
} from './BindGroupDescriptors';

export {
  // Pipeline state descriptors
  type PipelineStateDescriptor,
  type BlendState,
  type DepthStencilState,
  type RasterizationState,
  type BlendFactor,
  type BlendOperation,
  type CompareFunction,
  type CullMode as PipelineCullMode,
  type FrontFace,
  type PrimitiveTopology,
  // Presets
  OPAQUE_PIPELINE_STATE,
  ALPHA_BLEND_PIPELINE_STATE,
  ADDITIVE_BLEND_PIPELINE_STATE,
  ALPHA_CUTOUT_PIPELINE_STATE,
  WIREFRAME_PIPELINE_STATE,
  // Validation
  type PipelineStateValidationError,
  PipelineStateValidator,
} from './PipelineStateDescriptor';

export {
  // Shader reflection
  type ShaderReflectionData,
  type ShaderBinding,
  type ShaderAttribute,
  type CompiledShader,
  WGSLReflectionParser,
  ShaderReflectionCache,
  // Epic 3.14 Phase 3: WGSL Parser & Tokenizer
  type BindGroupLayoutInfo,
  type BindingInfo,
} from './ShaderReflection';

// Epic 3.14 Phase 3: WGSL Parser & AST-based Reflection
export {
  // Tokenizer
  WGSLTokenizer,
  Token,
  TokenType,
  type SourceLocation,
} from './shaders/tokenizer';

export {
  // Parser and AST
  WGSLParser,
  ParseError,
  type ShaderModule,
  type Declaration,
  type VariableDeclaration,
  type FunctionDeclaration,
  type StructDeclaration,
  type TypeAliasDeclaration,
  type TypeExpression,
  type Attribute,
} from './shaders/parser';

export {
  // Shader Reflector (AST-based)
  ShaderReflector,
  WGSLShaderStage,
  type ShaderReflectionResult,
} from './shaders/ShaderReflector';

// Epic 3.14: Unified Draw Command API
export {
  type DrawCommand,
  type IndexedGeometry,
  type NonIndexedGeometry,
  type IndirectGeometry,
  type ComputeGeometry,
  type DrawDebugInfo,
  isIndexedGeometry,
  isNonIndexedGeometry,
  isIndirectGeometry,
  isComputeGeometry,
  getIndexBufferSize,
  validateWorkgroups,
  DrawCommandBuilder,
} from './commands';


export {
  // Performance monitoring
  type PerformanceMetrics,
  PerformanceBaseline,
  performanceBaseline,
} from './PerformanceBaseline';

// Epic 3.14 Phase 2: High-Level Rendering API
// Simplified API that reduces boilerplate from 30+ lines to 5 lines
// Import from '@miskatonic/rendering/highlevel' for the simplified API
export * as highlevel from './highlevel';


// Import from '@miskatonic/rendering/retro' for retro rendering features
export * as retro from './retro';

// Epic RENDERING-06: Builder patterns for ergonomic API
export { VertexLayoutBuilder } from './builders/VertexLayoutBuilder';
export { PipelineBuilder, type TopologyMode, type DepthCompare } from './builders/PipelineBuilder';

// Epic 3.4: Retro Rendering Pipeline
export {
  RetroLightingSystem,
  type RetroLightingConfig,
  type FogConfig,
  type RetroLight,
  RetroPostProcessor,
  type RetroPostConfig,
  RetroMaterial,
  type RetroMaterialConfig,
  type RetroMaterialType,
  type RetroFilterMode,
  RetroLODSystem,
  type LODLevel,
  type LODGroup,
  type LODStats,
} from './retro';

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
