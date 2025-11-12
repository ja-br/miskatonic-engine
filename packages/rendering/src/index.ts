/**
 * @miskatonic/rendering
 * WebGPU rendering engine for Miskatonic
 */

// Core rendering classes
export { Camera, OrbitControls } from './Camera';  // Standalone (legacy)
export { CameraSystem } from './CameraSystem';      // ECS system (Epic 3.10)
export { OrbitCameraController, FirstPersonCameraController } from './CameraControllers';
export { createCube, createSphere, createPlane, type GeometryData } from './Geometry';

// Epic 3.15: Light Component & Integration
export { LightCollection, LightType, type LightData } from './LightCollection';
export { LightSystem } from './LightSystem';
export type { LightComponentData, TransformComponentData } from './LightTypes';
export {
  createLightingDemo,
  animateLightingDemo,
  getLightingStats,
  type LightingDemo,
} from './lighting-demo';

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
// ShaderLoader is Node.js-only (uses fs/promises), not for browser use
// export { ShaderLoader, type ShaderFeatures, type LoadedShader, type ShaderLoaderConfig, type ShaderSourceFile } from './ShaderLoader';
export { RenderPass, RenderPassManager, type RenderPassConfig, type RenderTarget } from './RenderPass';
export { RenderQueue, type QueuedDrawCommand, type CameraInfo, type RenderQueueStats } from './RenderQueue';

// Epic 3.8: GPU Memory Management
export { GPUBufferPool, BufferUsageType, type BufferPoolStats } from './GPUBufferPool';
export { TextureAtlas, type AtlasRegion, type TextureAtlasStats } from './TextureAtlas';
export { VRAMProfiler, VRAMCategory, type VRAMBudget, type VRAMUsage, type VRAMStats } from './VRAMProfiler';

// Epic 3.18: Lighting Performance & Utilities (Profiling)
export {
  GPUTimingProfiler,
  type GPUTimingConfig,
  type TimingMeasurement,
  type TimingStatistics,
} from './profiling/GPUTimingProfiler';
export {
  LightingBenchmark,
  BenchmarkScenarios,
  DefaultPerformanceTargets,
  type BenchmarkScenario,
  type BenchmarkResult,
  type OperationTiming,
  type PerformanceTargets,
  type LightingBenchmarkConfig,
} from './profiling/LightingBenchmark';

// Epic 3.18 Phase 3: Light Animation Systems
export { FlickeringLightSystem } from './systems/FlickeringLightSystem';
export { PulsingLightSystem } from './systems/PulsingLightSystem';
export { OrbitingLightSystem } from './systems/OrbitingLightSystem';

// Epic 3.13: Instance rendering and batching
export { InstanceBuffer, InstanceBufferPool, globalInstanceBufferPool, type InstanceData } from './InstanceBuffer';
export { InstanceDetector, type InstanceGroup, type InstanceDetectorConfig } from './InstanceDetector';
export { InstanceBufferManager, type GPUInstanceBuffer } from './InstanceBufferManager';
export { InstancedShaderManager, createShaderVariants, type ShaderVariant, type InstancedShaderConfig } from './InstancedShaderManager';

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
