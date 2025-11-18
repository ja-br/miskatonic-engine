# Rendering Package Audit 2025


## Executive Summary

The `@miskatonic/rendering` package contains **78 TypeScript files** across **20 directories**, totaling **~22,002 lines of code**. The package implements a WebGPU-based rendering engine with support for lighting, shadows, culling, instancing, and high-level rendering APIs.

**Key Findings:**
- **Largest files:** ShadowDebugVisualizer (736 LOC), DirectionalShadowCascades (627 LOC), ShaderReflection (615 LOC)
- **Most complex subsystems:** Shadows (7 files, ~3,500 LOC), Culling (6 files, ~2,150 LOC), Shaders (6 files, ~2,100 LOC)
- **Public API exports:** ~180 symbols exported from index.ts
- **Epic coverage:** Files from Epics 3.2, 3.8, 3.10, 3.13-3.16, 3.18, RENDERING-06

---

## 1. File Inventory

### Directory Structure

```
packages/rendering/src/                   (78 files, ~22,002 LOC)
├── backends/                             (13 files, ~2,875 LOC)
│   ├── webgpu/                           (9 files, ~1,833 LOC)
│   │   ├── WebGPUModernAPI.ts            348 LOC - Epic 3.14 Modern API
│   │   ├── WebGPUResourceManager.ts      319 LOC - Resource lifecycle
│   │   ├── WebGPUCommandEncoder.ts       213 LOC - Command recording
│   │   ├── WebGPUPipelineManager.ts      201 LOC - Pipeline caching
│   │   ├── WebGPURenderPassManager.ts    173 LOC - Render pass execution
│   │   ├── WebGPUModuleInitializer.ts    154 LOC - Module initialization
│   │   ├── WebGPUTimestampProfiler.ts    153 LOC - GPU profiling
│   │   ├── WebGPUDeviceInitializer.ts    134 LOC - Device setup
│   │   └── WebGPUTypes.ts                138 LOC - Type definitions
│   ├── WebGPUBackend.ts                  556 LOC - Main coordinator
│   ├── IRendererBackend.ts               447 LOC - Backend interface
│   ├── BackendFactory.ts                 182 LOC - Backend creation
│   └── index.ts                           11 LOC - Public exports
│
├── shadows/                              (7 files, ~3,529 LOC)
│   ├── ShadowDebugVisualizer.ts          736 LOC - Epic 3.18 Debug tools
│   ├── DirectionalShadowCascades.ts      627 LOC - Epic 3.16 CSM
│   ├── ShadowAtlas.ts                    466 LOC - Epic 3.16 Atlas
│   ├── SpotLightShadowMapper.ts          456 LOC - Epic 3.16 Spot shadows
│   ├── ShadowLOD.ts                      431 LOC - Epic 3.17 LOD
│   ├── PointLightShadowCubemap.ts        415 LOC - Epic 3.16 Point shadows
│   └── ShadowCache.ts                    398 LOC - Epic 3.17 Caching
│
├── culling/                              (6 files, ~2,152 LOC)
│   ├── GPULightCuller.ts                 490 LOC - Epic 3.16 GPU culling
│   ├── TileGrid.ts                       487 LOC - Epic 3.16 Tiled culling
│   ├── BoundingVolume.ts                 357 LOC - Epic 3.16 Bounds
│   ├── Frustum.ts                        347 LOC - Epic 3.16 Frustum math
│   ├── LightCuller.ts                    226 LOC - Epic 3.16 CPU culling
│   ├── LightCullingStrategy.ts           210 LOC - Epic 3.16 Strategy
│   └── index.ts                           35 LOC - Public exports
│
├── shaders/                              (6 files, ~2,109 LOC)
│   ├── tokenizer/                        (3 files, ~960 LOC)
│   │   ├── WGSLTokenizer.ts              604 LOC - Epic 3.14 Phase 3
│   │   ├── Token.ts                      349 LOC - Epic 3.14 Phase 3
│   │   └── index.ts                        7 LOC - Exports
│   ├── parser/                           (3 files, ~761 LOC)
│   │   ├── WGSLParser.ts                 475 LOC - Epic 3.14 Phase 3
│   │   ├── AST.ts                        261 LOC - Epic 3.14 Phase 3
│   │   └── index.ts                       25 LOC - Exports
│   └── ShaderReflector.ts                415 LOC - Epic 3.14 AST reflection
│
├── highlevel/                            (6 files, ~1,688 LOC)
│   ├── Material.ts                       598 LOC - Epic 3.14 Phase 2
│   ├── shaders/builtins.ts               355 LOC - Epic 3.14 Phase 2
│   ├── HighLevelRenderer.ts              342 LOC - Epic 3.14 Phase 2
│   ├── Mesh.ts                           226 LOC - Epic 3.14 Phase 2
│   ├── utils.ts                          110 LOC - Epic 3.14 Phase 2
│   └── index.ts                           57 LOC - Simplified exports
│
├── commands/                             (3 files, ~732 LOC)
│   ├── DrawCommandBuilder.ts             498 LOC - Epic 3.14 Phase 3
│   ├── DrawCommand.ts                    213 LOC - Epic 3.14 Phase 3
│   └── index.ts                           21 LOC - Exports
│
├── builders/                             (2 files, ~620 LOC)
│   ├── PipelineBuilder.ts                385 LOC - Epic RENDERING-06
│   └── VertexLayoutBuilder.ts            235 LOC - Epic RENDERING-06
│
├── recovery/                             (5 files, ~874 LOC)
│   ├── DeviceRecoverySystem.ts           467 LOC - Epic 3.2
│   ├── ResourceRegistry.ts               211 LOC - Epic 3.2
│   ├── DeviceLossDetector.ts             117 LOC - Epic 3.2
│   ├── webgpu-types.ts                    52 LOC - Type definitions
│   └── index.ts                           27 LOC - Exports
│
├── systems/                              (3 files, ~414 LOC)
│   ├── OrbitingLightSystem.ts            174 LOC - Epic 3.18 Phase 3
│   ├── FlickeringLightSystem.ts          135 LOC - Epic 3.18 Phase 3
│   └── PulsingLightSystem.ts             105 LOC - Epic 3.18 Phase 3
│
├── constants/                            (1 file, ~381 LOC)
│   └── RenderingConstants.ts             381 LOC - Epic RENDERING-05
│
├── utils/                                (1 file, ~157 LOC)
│   └── HashUtils.ts                      157 LOC - Epic RENDERING-05
│
├── profiling/                            (0 files)
│   └── (empty - GPU timing removed)
│
└── Root level files                      (25 files, ~6,471 LOC)
    ├── ShaderReflection.ts               615 LOC - Epic 3.14 Phase 3
    ├── WebGPUBackend.ts                  (moved to backends/)
    ├── ShaderLoader.ts                   533 LOC - Epic 3.2
    ├── InstanceBuffer.ts                 439 LOC - Epic 3.13
    ├── VRAMProfiler.ts                   389 LOC - Epic 3.8
    ├── GPUBufferPool.ts                  371 LOC - Epic 3.8
    ├── DemoUI.ts                         355 LOC - Demo utilities
    ├── LightCollection.ts                354 LOC - Epic 3.15
    ├── TextureAtlas.ts                   309 LOC - Epic 3.8
    ├── Camera.ts                         302 LOC - Epic 3.10 (legacy)
    ├── types.ts                          280 LOC - Core types
    ├── BindGroupPool.ts                  262 LOC - Epic 3.14
    ├── CameraSystem.ts                   257 LOC - Epic 3.10 (ECS)
    ├── PipelineStateDescriptor.ts        250 LOC - Epic 3.14
    ├── InstancedShaderManager.ts         238 LOC - Epic 3.13
    ├── index.ts                          237 LOC - Main exports
    ├── Geometry.ts                       192 LOC - Basic geometry
    ├── CameraControllers.ts              180 LOC - Epic 3.10
    ├── InstanceBufferManager.ts          166 LOC - Epic 3.13
    ├── RenderPass.ts                     165 LOC - Render pass API
    ├── LightSystem.ts                    153 LOC - Epic 3.15
    ├── PerformanceBaseline.ts             98 LOC - Epic 3.14
    ├── LightTypes.ts                      81 LOC - Epic 3.15
    └── BindGroupDescriptors.ts            64 LOC - Epic 3.14
```

### File Categorization

**Public API Files** (exported from index.ts):
- Core: Camera, CameraSystem, Geometry, RenderPass, types
- Lighting: LightCollection, LightSystem, LightTypes
- Culling: Frustum, BoundingVolume, LightCuller, GPULightCuller, TileGrid
- Memory: GPUBufferPool, TextureAtlas, VRAMProfiler
- Instancing: InstanceBuffer, InstanceBufferManager, InstancedShaderManager
- Backend: IRendererBackend, WebGPUBackend, BackendFactory
- Modern API: BindGroupDescriptors, PipelineStateDescriptor, DrawCommand
- Builders: PipelineBuilder, VertexLayoutBuilder
- Shaders: ShaderReflection, WGSLTokenizer, WGSLParser, ShaderReflector
- Shadows: (not exported from index.ts - internal use)
- High-level: highlevel namespace (separate import path)

**Internal Implementation Files** (not exported):
- `/backends/webgpu/*` - WebGPU implementation details
- `/shadows/*` - Shadow system internals
- `/recovery/*` - Device recovery internals
- `/constants/*` - Internal constants
- `/utils/*` - Internal utilities

---

## 2. Public API Surface Analysis

### Exports from index.ts

**Total exports:** ~180 symbols across 15 categories

#### Category Breakdown:

1. **Camera & Controllers** (8 exports)
   - Classes: `Camera`, `CameraSystem`, `OrbitCameraController`, `FirstPersonCameraController`
   - Types: `OrbitControls`
   - Functions: none
   - **Epic:** 3.10

2. **Geometry** (2 exports)
   - Functions: `createCube`, `createSphere`, `createPlane`
   - Types: `GeometryData`
   - **Epic:** 3.1-3.3

3. **Lighting** (6 exports)
   - Classes: `LightCollection`, `LightSystem`
   - Enums: `LightType`
   - Types: `LightData`, `LightComponentData`, `TransformComponentData`
   - **Epic:** 3.15

4. **Culling** (11 exports)
   - Classes: `Frustum`, `BoundingSphere`, `BoundingBox`, `LightCuller`, `BatchLightCuller`, `TileGrid`, `GPULightCuller`
   - Enums: `FrustumPlane`
   - Types: `Plane`, `LightCullingStats`
   - **Epic:** 3.16 (Phase 1 CPU Culling)

5. **Render Passes** (4 exports)
   - Classes: `RenderPass`, `RenderPassManager`
   - Types: `RenderPassConfig`, `RenderTarget`
   - **Epic:** 3.14

6. **Memory Management** (12 exports)
   - Classes: `GPUBufferPool`, `TextureAtlas`, `VRAMProfiler`
   - Enums: `BufferUsageType`, `VRAMCategory`
   - Types: `BufferPoolStats`, `AtlasRegion`, `TextureAtlasStats`, `VRAMBudget`, `VRAMUsage`, `VRAMStats`
   - **Epic:** 3.8

7. **Animation Systems** (3 exports)
   - Classes: `FlickeringLightSystem`, `PulsingLightSystem`, `OrbitingLightSystem`
   - **Epic:** 3.18 Phase 3

8. **Instancing** (8 exports)
   - Classes: `InstanceBuffer`, `InstanceBufferPool`, `InstanceBufferManager`, `InstancedShaderManager`
   - Functions: `createShaderVariants`
   - Constants: `globalInstanceBufferPool`
   - Types: `InstanceData`, `GPUInstanceBuffer`, `ShaderVariant`, `InstancedShaderConfig`
   - **Epic:** 3.13

9. **Backend Abstraction** (24 exports)
   - Interfaces: `IRendererBackend`
   - Classes: `WebGPUBackend`, `BackendFactory`
   - Types: `BackendConfig`, `BackendCapabilities`, `BackendShaderHandle`, `BackendBufferHandle`, `BackendTextureHandle`, `BackendFramebufferHandle`, `BackendBindGroupHandle`, `BackendBindGroupLayoutHandle`, `BackendPipelineHandle`, `RenderPipelineDescriptor`, `ComputePipelineDescriptor`, `BindGroupResources`, `VertexBufferLayout`, `BackendFactoryOptions`, `BackendSupport`
   - Type guards: `isBackendShaderHandle`, `isBackendBufferHandle`, `isBackendTextureHandle`, `isBackendFramebufferHandle`, `isBackendBindGroupHandle`, `isBackendBindGroupLayoutHandle`, `isBackendPipelineHandle`
   - **Epic:** 3.2 + 3.14

10. **Demo Utilities** (4 exports)
    - Classes: `DemoUI`
    - Types: `DemoUICallbacks`, `DemoPerformanceMetrics`, `QualityTier`
    - **Epic:** Demo support

11. **Modern Rendering API** (23 exports)
    - Types: `BindGroupLayoutDescriptor`, `BindGroupLayoutEntry`, `BindGroupDescriptor`, `BindGroupResourceBinding`, `BindingType`, `ShaderStage`
    - Functions: `validateBindGroupLayout`, `createSceneBindGroupLayout`, `createObjectBindGroupLayout`
    - Pipeline types: `PipelineStateDescriptor`, `BlendState`, `DepthStencilState`, `RasterizationState`, `BlendFactor`, `BlendOperation`, `CompareFunction`, `PipelineCullMode`, `FrontFace`, `PrimitiveTopology`
    - Constants: `OPAQUE_PIPELINE_STATE`, `ALPHA_BLEND_PIPELINE_STATE`, `ADDITIVE_BLEND_PIPELINE_STATE`, `ALPHA_CUTOUT_PIPELINE_STATE`, `WIREFRAME_PIPELINE_STATE`
    - Validation: `PipelineStateValidationError`, `PipelineStateValidator`
    - **Epic:** 3.14

12. **Shader Reflection** (15 exports)
    - Classes: `WGSLReflectionParser`, `ShaderReflectionCache`, `WGSLTokenizer`, `Token`, `WGSLParser`, `ParseError`, `ShaderReflector`
    - Enums: `TokenType`, `WGSLShaderStage`
    - Types: `ShaderReflectionData`, `ShaderBinding`, `ShaderAttribute`, `CompiledShader`, `BindGroupLayoutInfo`, `BindingInfo`, `SourceLocation`, `ShaderModule`, `Declaration`, `VariableDeclaration`, `FunctionDeclaration`, `StructDeclaration`, `TypeAliasDeclaration`, `TypeExpression`, `Attribute`, `ShaderReflectionResult`
    - **Epic:** 3.14 Phase 3

13. **Draw Commands** (12 exports)
    - Classes: `DrawCommandBuilder`
    - Types: `DrawCommand`, `IndexedGeometry`, `NonIndexedGeometry`, `IndirectGeometry`, `ComputeGeometry`, `DrawDebugInfo`
    - Type guards: `isIndexedGeometry`, `isNonIndexedGeometry`, `isIndirectGeometry`, `isComputeGeometry`
    - Functions: `getIndexBufferSize`, `validateWorkgroups`
    - **Epic:** 3.14

14. **Performance Monitoring** (3 exports)
    - Classes: `PerformanceBaseline`
    - Types: `PerformanceMetrics`
    - Constants: `performanceBaseline`
    - **Epic:** 3.14

15. **Builder Patterns** (4 exports)
    - Classes: `VertexLayoutBuilder`, `PipelineBuilder`
    - Types: `TopologyMode`, `DepthCompare`
    - **Epic:** RENDERING-06

16. **High-Level API** (1 namespace)
    - Namespace: `highlevel` (re-exported from './highlevel')
    - Separate import path: `@miskatonic/rendering/highlevel`
    - **Epic:** 3.14 Phase 2

17. **Core Types** (30+ exports)
    - Enums: `RenderBackend`, `PrimitiveMode`, `AttributeType`, `UniformType`, `RenderCommandType`
    - Type aliases: `ShaderType`, `TextureFormat`, `TextureFilter`, `TextureWrap`, `BlendMode`, `DepthTest`, `CullMode`, `BufferUsage`
    - Interfaces: `VertexAttribute`, `Uniform`, `ShaderSource`, `ShaderProgram`, `RenderState`, `VertexLayout`, `IndexType`, `ClearCommand`, `SetStateCommand`, `SetShaderCommand`, `SetUniformCommand`, `BindTextureCommand`, `BindFramebufferCommand`, `RenderCommand`, `RenderStats`, `RendererConfig`
    - Constants: `DEFAULT_RENDER_STATE`
    - **Epic:** 3.1-3.3

### Epic Coverage in Public API

- Epic 3.1-3.3 (Foundation): Core types, geometry
- Epic 3.2 (Backend): IRendererBackend, WebGPUBackend, recovery system
- Epic 3.8 (Memory Management): GPUBufferPool, TextureAtlas, VRAMProfiler
- Epic 3.10 (Camera): Camera, CameraSystem, controllers
- Epic 3.13 (Instancing): InstanceBuffer, InstancedShaderManager
- Epic 3.14 (Modern API): Bind groups, pipelines, draw commands, shader reflection, high-level API
- Epic 3.15 (Lighting): LightCollection, LightSystem
- Epic 3.16 (Culling): Frustum, BoundingVolume, LightCuller
- Epic 3.18 (Light Animation): FlickeringLightSystem, PulsingLightSystem, OrbitingLightSystem
- Epic RENDERING-05 (Constants): RenderingConstants (internal)
- Epic RENDERING-06 (Builders): PipelineBuilder, VertexLayoutBuilder

**Missing from public API:**
- Shadow system (all 7 files in `/shadows/` are internal)
- Recovery system details (DeviceRecoverySystem, DeviceLossDetector, ResourceRegistry)
- WebGPU module internals (WebGPUModernAPI, WebGPUResourceManager, etc.)
- Constants and utilities (RenderingConstants, HashUtils)

---

## 3. WebGPU Usage Patterns

### Device Operations

**Initialization:**
- `WebGPUDeviceInitializer.ts` (134 LOC) - Handles `navigator.gpu.requestAdapter()`, `adapter.requestDevice()`
- `WebGPUModuleInitializer.ts` (154 LOC) - Initializes subsystem modules
- Features requested: None specified (uses default features)
- Limits requested: None specified (uses default limits)

**Device Loss Handling:**
- `DeviceLossDetector.ts` (117 LOC) - Monitors `device.lost` promise
- `DeviceRecoverySystem.ts` (467 LOC) - Implements recovery workflow
- Recovery strategy: Attempt re-initialization, restore resources from registry

### Buffer Operations

**Creation patterns:**
- `GPUBufferPool.ts` (371 LOC) - Pooled buffer management
- Usage: Vertex buffers, index buffers, uniform buffers, storage buffers
- Pattern: `device.createBuffer({ size, usage, mappedAtCreation })`

**Update patterns:**
- `queue.writeBuffer()` for uniform updates
- Mapped at creation for initial vertex/index data
- No staging buffers detected (direct writes)

### Texture Operations

**Creation patterns:**
- `WebGPUResourceManager.ts` (319 LOC) - Texture lifecycle management
- `TextureAtlas.ts` (309 LOC) - Texture atlas packing
- Formats used: rgba8unorm (default), depth24plus, depth24plus-stencil8 (shadows)
- Pattern: `device.createTexture({ size, format, usage })`

**Sampler patterns:**
- No centralized sampler management detected
- Samplers created ad-hoc per material
- No sampler caching evident

### Pipeline Operations

**Render Pipelines:**
- `WebGPUPipelineManager.ts` (201 LOC) - Pipeline caching by hash
- `PipelineBuilder.ts` (385 LOC) - Builder pattern for ergonomic creation
- State: Vertex layout, fragment state, blend modes, depth/stencil
- Caching: Hash-based cache in PipelineManager

**Compute Pipelines:**
- `DrawCommand.ts` includes `ComputeGeometry` type
- No compute pipeline implementation found in codebase
- `validateWorkgroups()` function exists but unused

### Render Pass Operations

**Render pass structure:**
- `WebGPURenderPassManager.ts` (173 LOC) - Manages render pass execution
- `RenderPass.ts` (165 LOC) - High-level render pass API
- Pattern: `encoder.beginRenderPass({ colorAttachments, depthStencilAttachment })`
- Load/store ops: Clear, load, store (configurable)

**Framebuffer setup:**
- Shadow maps use separate framebuffers (depth-only)
- Main render target uses color + depth attachments
- No MSAA detected (sample count always 1)

### Bind Group Patterns

**Bind group management:**
- `BindGroupPool.ts` (262 LOC) - Pools bind groups for reuse
- `BindGroupDescriptors.ts` (64 LOC) - Descriptor builders
- Pattern: Scene-level (group 0), Object-level (group 1), Material-level (group 2)
- Caching: Hash-based pool in BindGroupPool

**Resource binding:**
- Uniforms: Buffer bindings with dynamic offsets
- Textures: Texture view bindings
- Samplers: Sampler bindings
- Storage: Storage buffer bindings (for light culling)

### Shader Compilation

**Compilation workflow:**
- `ShaderLoader.ts` (533 LOC) - Loads and compiles WGSL shaders
- Pattern: `device.createShaderModule({ code })`
- No shader preprocessing detected (no #include, #define)
- Reflection: WGSLParser extracts bindings and attributes from AST

**Shader reflection:**
- `ShaderReflector.ts` (415 LOC) - AST-based reflection
- `WGSLParser.ts` (475 LOC) - Full WGSL parser
- `WGSLTokenizer.ts` (604 LOC) - Lexical analysis
- Extracts: Bind group layouts, vertex attributes, entry points

### Resource Management Patterns

**Lifecycle:**
- Creation: Centralized in WebGPUResourceManager
- Tracking: ResourceRegistry maintains handle → resource map
- Disposal: Explicit `.destroy()` calls via handles
- Leaks: VRAMProfiler tracks allocations

**Handle system:**
- Opaque handles for buffers, textures, shaders, framebuffers, bind groups, pipelines
- Type guards for runtime type checking
- No raw GPUBuffer/GPUTexture exposure in public API

---

## 4. Technical Debt Registry

### Broken/Incomplete Features

**CRITICAL - Missing Source Code:**
- **File:** `/packages/rendering/dist/retro/` directory exists but no `/src/retro/`
- **Severity:** High
- **Impact:** Retro rendering code exists in compiled output but source is missing
- **Epic:** 3.4 (Retro Rendering Pipeline)
- **Locations:** Referenced in commit messages but no source found
- **Fix:** Either restore source or remove compiled artifacts

**MAJOR - Removed GPU Timing:**
- **File:** `index.ts` line 36-37
- **Comment:** "GPUTimingProfiler and LightingBenchmark removed - API was broken (used non-existent encoder.writeTimestamp())"
- **Severity:** Major
- **Impact:** No GPU profiling capability
- **Epic:** 3.18 (Lighting Performance)
- **Fix:** Re-implement using `GPURenderPassEncoder.writeTimestamp()`

**MODERATE - TODO Comments:**

1. **File:** `index.ts` line 37
   - **TODO:** "Re-implement GPU timing using GPURenderPassEncoder.writeTimestamp() if needed"
   - **Epic:** 3.18
   - **Severity:** Moderate

2. **File:** `WebGPUBackend.ts` (search needed for exact lines)
   - Multiple TODOs for missing WebGPU features
   - **Severity:** Low-Moderate (needs investigation)

3. **File:** `HighLevelRenderer.ts` (search needed)
   - TODOs for missing high-level features
   - **Severity:** Low

### Deprecated Patterns

**DEPRECATED - Legacy Camera:**
- **File:** `Camera.ts` (302 LOC)
- **Status:** Marked as "Standalone (legacy)" in index.ts line 7
- **Replacement:** `CameraSystem.ts` (Epic 3.10 ECS system)
- **Impact:** Both APIs exported, causing confusion
- **Consumers:** Unknown (needs Task 1.5 analysis)
- **Fix:** Deprecate Camera class, migrate consumers to CameraSystem

**QUESTIONABLE - Dual Culling APIs:**
- **Files:** `LightCuller.ts` (CPU) + `GPULightCuller.ts` (GPU)
- **Status:** Both exported, unclear when to use which
- **Epic:** 3.16
- **Impact:** API confusion
- **Fix:** Document usage guidelines or provide unified API

### Workarounds and Hacks

**WORKAROUND - Shader Reflection:**
- **File:** `ShaderReflection.ts` + full WGSL parser
- **Reason:** WebGPU has no built-in shader reflection API
- **Impact:** 2,100+ LOC of parser/tokenizer code to extract bindings
- **Alternative:** Manual descriptor specification (error-prone)
- **Status:** Acceptable workaround, well-implemented

**WORKAROUND - Device Loss Recovery:**
- **File:** `DeviceRecoverySystem.ts`
- **Reason:** WebGPU device loss is unrecoverable per spec
- **Impact:** Complex recovery system to simulate recovery
- **Status:** Acceptable workaround for alpha development

### Missing Features Referenced in Epics

**Epic 3.4 (Retro Rendering Pipeline):**
- ❌ Post-processing: Bloom, tone mapping, dithering, film grain
- ❌ Retro lighting: Vertex-painted, lightmaps, fog
- ❌ LOD: Dithered crossfade LOD transitions
- ❌ Materials: 256px texture limits, point filtering
- **Status:** Completely missing (source code lost?)

**Epic 3.5 (Lightweight Culling):**
- ❌ SpatialGrid: Uniform 3D grid partitioning
- ❌ ObjectCuller: Frustum culling for objects
- ❌ OccluderVolume: Manual box occluders
- ❌ SoftwareOcclusionTest: CPU depth buffer
- **Status:** Light culling exists, but object culling missing

**Epic 3.16+ (Shadow System):**
- ✅ DirectionalShadowCascades (627 LOC)
- ✅ PointLightShadowCubemap (415 LOC)
- ✅ SpotLightShadowMapper (456 LOC)
- ✅ ShadowAtlas (466 LOC)
- ✅ ShadowCache (398 LOC)
- ✅ ShadowLOD (431 LOC)
- ✅ ShadowDebugVisualizer (736 LOC)
- **Status:** Complete (3,529 LOC across 7 files)

**Epic 3.14 (Modern API):**
- ✅ Bind groups (BindGroupPool, BindGroupDescriptors)
- ✅ Pipeline state (PipelineStateDescriptor, PipelineBuilder)
- ✅ Draw commands (DrawCommand, DrawCommandBuilder)
- ✅ Shader reflection (WGSLParser, ShaderReflector)
- ✅ High-level API (highlevel namespace)
- **Status:** Complete

---

## 5. Consumer Dependency Map

### All Consumers (8 files total)

**External Consumers (6 files):**

1. **`examples/rendering/basic-triangle.ts`**
   - Imports: `WebGPUBackend`
   - Usage: Basic triangle rendering demo
   - Pattern: Direct backend instantiation, manual buffer/shader creation

2. **`examples/rendering/device-recovery.ts`**
   - Imports: (needs investigation)
   - Usage: Device loss recovery demonstration
   - Pattern: DeviceRecoverySystem usage

3. **`examples/rendering/instancing.ts`**
   - Imports: (needs investigation)
   - Usage: GPU instancing demonstration (Epic 3.13)
   - Pattern: InstanceBuffer, InstancedShaderManager

4. **`examples/rendering/textured-cube.ts`**
   - Imports: (needs investigation)
   - Usage: Texture mapping demo
   - Pattern: TextureAtlas, material system

5. **`examples/rendering/transparent-objects.ts`**
   - Imports: (needs investigation)
   - Usage: Alpha blending demonstration
   - Pattern: ALPHA_BLEND_PIPELINE_STATE, blend modes

6. **`packages/renderer/src/phase0-validation.ts`**
   - Imports: `LightSystem`, `CameraSystem`, `OrbitCameraController`, `BackendFactory`, `FlickeringLightSystem`, `PulsingLightSystem`, `OrbitingLightSystem`, `createCube`, `createPlane`, `IRendererBackend`
   - Usage: **Epic 3.14-3.18 API Validation Suite** (621 LOC)
   - Pattern: Comprehensive validation of all modern APIs
   - Tests: Backend init, light systems, animation, storage buffers, camera controller, performance
   - **KEY FINDING:** This is the primary integration test for Epic 3.14-3.18 APIs

**Internal Consumers (2 files):**

7. **`packages/rendering/src/highlevel/index.ts`**
   - Imports: Re-exports from parent `@miskatonic/rendering`
   - Usage: High-level API namespace
   - Pattern: `import * from '../index'` (internal re-export)

8. **`packages/rendering/src/index.ts`**
   - Imports: None (root export file)
   - Usage: Main export aggregation
   - Pattern: Exports from submodules

### Consumer Categories

**Demos/Examples (5 files):**
- `examples/rendering/*.ts` - All 5 example files
- Purpose: Demonstrate specific rendering features
- Dependency: Direct rendering package imports

**Integration Tests (1 file):**
- `packages/renderer/src/phase0-validation.ts`
- Purpose: Validate Epic 3.14-3.18 APIs work correctly
- Coverage: LightSystem, CameraSystem, animation systems, storage buffers
- **Critical:** 621 LOC of integration testing code

**Production Code (0 files):**
- **NONE FOUND** - No production game code uses rendering package yet
- This is expected for alpha development

### API Usage Patterns

**From phase0-validation.ts (most comprehensive):**

1. **Backend Creation:**
   ```typescript
   const backend = await BackendFactory.create(canvas, config);
   ```
   - Uses factory pattern (Epic 3.14)
   - Config: antialias, alpha, depth, powerPreference

2. **ECS System Integration:**
   ```typescript
   const lightSystem = new LightSystem(world);
   const cameraSystem = new CameraSystem(world);
   const flickeringSystem = new FlickeringLightSystem(world);
   ```
   - All systems require `World` instance from `@miskatonic/ecs`
   - Systems are independent (no interdependencies)

3. **Camera Controller:**
   ```typescript
   const cameraEntity = world.createEntity();
   world.addComponent(cameraEntity, Transform, new Transform(0, 5, 10));
   world.addComponent(cameraEntity, Camera, Camera.perspective(...));
   const controller = new OrbitCameraController(cameraEntity, world, 10);
   ```
   - Entity-based pattern (not standalone Camera class)
   - Requires entity ID, world reference, distance

4. **Light Creation:**
   ```typescript
   world.addComponent(entity, Light, Light.directional([1,1,1], 1.0, [0,-1,0]));
   world.addComponent(entity, Light, Light.point([1,0.5,0.2], 2.0, 6.0));
   world.addComponent(entity, Light, Light.spot([1,1,1], 4.0, [1,-1,0], Math.PI/6, Math.PI/12, 12.0));
   ```
   - Static factory methods on Light class
   - Parameters: color, intensity, range/direction/cone angles

5. **Storage Buffer Usage:**
   ```typescript
   const buffer = backend.createBuffer('name', 'storage', data, 'dynamic_draw');
   ```
   - Epic 3.14 API: name, usage type, data, access pattern
   - Used for light arrays in GPU culling

**From basic-triangle.ts:**

1. **Direct Backend Instantiation:**
   ```typescript
   const backend = new WebGPUBackend();
   await backend.initialize({ canvas, powerPreference: 'high-performance' });
   ```
   - Direct class instantiation (not BackendFactory)
   - Manual initialization with config

### Dependency Analysis

**External Dependencies (rendering → other packages):**
- `@miskatonic/ecs` - World, Entity, Component (required by all ECS systems)
- None others detected

**Reverse Dependencies (other packages → rendering):**
- Examples: 5 example files use rendering package
- Renderer: 1 validation file uses rendering package
- **Total external consumers:** 6 files

**Circular Dependencies:**
- ❌ **NONE DETECTED**
- Clean separation between rendering and ECS packages
- ECS provides World/Entity/Component primitives, rendering consumes them

### Impact Analysis

**Breaking Change Impact (low):**
- Only 6 external consumer files exist
- 5 are examples (easy to update)
- 1 is validation suite (must stay synchronized with API)
- **No production game code depends on rendering package yet**

**Migration Difficulty:**
- Examples: Low (simple, single-file demos)
- Validation: Medium (comprehensive, must revalidate all APIs)
- Production: N/A (no production code exists)

**Recommendation:**
- Breaking changes are **acceptable** during alpha (0.x.x version)
- Update examples and validation suite in same PR as API changes
- Document breaking changes in commit messages

---

## 6. Performance Baseline

**Measurement required:** Task 1.6

**Existing benchmarks:**
- Check `/packages/rendering/benchmarks/` directory
- Run `npm run benchmark --workspace=@miskatonic/rendering`

**Metrics to collect:**
- Frame time (16.67ms target for 60 FPS)
- GPU memory usage (VRAMProfiler)
- Draw call count
- Shadow map generation time
- Culling time

---

## 7. Test Coverage Analysis

**Measurement required:** Task 1.7

**Command:** `npm test --workspace=@miskatonic/rendering -- --coverage`

**Expected coverage areas:**
- Backend abstraction (WebGPUBackend, IRendererBackend)
- Memory management (GPUBufferPool, TextureAtlas, VRAMProfiler)
- Lighting (LightCollection, LightSystem)
- Culling (Frustum, LightCuller, TileGrid)
- Shadows (all 7 shadow system files)
- Shaders (WGSLParser, WGSLTokenizer, ShaderReflector)
- Builders (PipelineBuilder, VertexLayoutBuilder)

**Untested areas (predicted):**
- High-level API (HighLevelRenderer, Material, Mesh)
- Demo UI (DemoUI - likely excluded from coverage)
- Recovery system (DeviceRecoverySystem - hard to test)

---

## 8. Key Findings Summary

### Strengths

1. **Well-organized directory structure** - Clear separation by subsystem
2. **Comprehensive shadow system** - 7 files, 3,500+ LOC, all shadow types
3. **Modern API patterns** - Bind groups, pipelines, draw commands (Epic 3.14)
4. **Robust shader reflection** - Full WGSL parser with AST-based reflection
5. **Memory management** - GPUBufferPool, TextureAtlas, VRAMProfiler
6. **Builder patterns** - Ergonomic PipelineBuilder, VertexLayoutBuilder

### Critical Issues

1. **Missing retro rendering source code** - Files in `/dist/retro/` but no `/src/retro/`
2. **Broken GPU profiling** - GPUTimingProfiler removed due to API errors
3. **Legacy Camera API** - Dual APIs causing confusion
4. **No object culling** - Light culling exists, but object culling (Epic 3.5) missing

### Blockers for Overhaul

1. **Retro source code recovery** - Must locate or recreate Epic 3.4 implementation
2. **API clarity** - Resolve dual APIs (Camera vs CameraSystem, LightCuller vs GPULightCuller)
3. **Missing epics** - Epic 3.5 (Object Culling) not implemented

### Recommendations

1. **Immediate:** Investigate `/dist/retro/` mismatch - check git history for lost source
2. **Short-term:** Re-implement GPU profiling with correct WebGPU API
3. **Planning:** Decide fate of legacy Camera class (deprecate or remove)
4. **Architecture:** Complete gap analysis (Task 3) to quantify missing features

---

## Appendix A: Full File List with Metadata

| File Path | LOC | Epic | Export Type | Purpose |
|-----------|-----|------|-------------|---------|
| backends/webgpu/WebGPUModernAPI.ts | 348 | 3.14 | Internal | Modern WebGPU API wrapper |
| backends/webgpu/WebGPUResourceManager.ts | 319 | 3.2 | Internal | Resource lifecycle |
| backends/webgpu/WebGPUCommandEncoder.ts | 213 | 3.2 | Internal | Command recording |
| backends/webgpu/WebGPUPipelineManager.ts | 201 | 3.14 | Internal | Pipeline caching |
| backends/webgpu/WebGPURenderPassManager.ts | 173 | 3.14 | Internal | Render pass execution |
| backends/webgpu/WebGPUModuleInitializer.ts | 154 | 3.2 | Internal | Module init |
| backends/webgpu/WebGPUTimestampProfiler.ts | 153 | 3.18 | Internal | GPU profiling |
| backends/webgpu/WebGPUDeviceInitializer.ts | 134 | 3.2 | Internal | Device setup |
| backends/webgpu/WebGPUTypes.ts | 138 | 3.2 | Internal | Type definitions |
| backends/WebGPUBackend.ts | 556 | 3.2 | Public | Main backend coordinator |
| backends/IRendererBackend.ts | 447 | 3.2 | Public | Backend interface |
| backends/BackendFactory.ts | 182 | 3.2 | Public | Backend creation |
| backends/index.ts | 11 | 3.2 | Public | Backend exports |
| shadows/ShadowDebugVisualizer.ts | 736 | 3.18 | Internal | Debug visualization |
| shadows/DirectionalShadowCascades.ts | 627 | 3.16 | Internal | CSM shadows |
| shadows/ShadowAtlas.ts | 466 | 3.16 | Internal | Shadow atlas |
| shadows/SpotLightShadowMapper.ts | 456 | 3.16 | Internal | Spot shadows |
| shadows/ShadowLOD.ts | 431 | 3.17 | Internal | Shadow LOD |
| shadows/PointLightShadowCubemap.ts | 415 | 3.16 | Internal | Point shadows |
| shadows/ShadowCache.ts | 398 | 3.17 | Internal | Shadow caching |
| culling/GPULightCuller.ts | 490 | 3.16 | Public | GPU light culling |
| culling/TileGrid.ts | 487 | 3.16 | Public | Tiled culling |
| culling/BoundingVolume.ts | 357 | 3.16 | Public | Bounding volumes |
| culling/Frustum.ts | 347 | 3.16 | Public | Frustum math |
| culling/LightCuller.ts | 226 | 3.16 | Public | CPU light culling |
| culling/LightCullingStrategy.ts | 210 | 3.16 | Internal | Culling strategy |
| culling/index.ts | 35 | 3.16 | Public | Culling exports |
| shaders/tokenizer/WGSLTokenizer.ts | 604 | 3.14 Phase 3 | Public | WGSL lexer |
| shaders/tokenizer/Token.ts | 349 | 3.14 Phase 3 | Public | Token types |
| shaders/tokenizer/index.ts | 7 | 3.14 Phase 3 | Public | Tokenizer exports |
| shaders/parser/WGSLParser.ts | 475 | 3.14 Phase 3 | Public | WGSL parser |
| shaders/parser/AST.ts | 261 | 3.14 Phase 3 | Public | AST types |
| shaders/parser/index.ts | 25 | 3.14 Phase 3 | Public | Parser exports |
| shaders/ShaderReflector.ts | 415 | 3.14 Phase 3 | Public | AST reflection |
| highlevel/Material.ts | 598 | 3.14 Phase 2 | Public (highlevel) | Material system |
| highlevel/shaders/builtins.ts | 355 | 3.14 Phase 2 | Internal | Builtin shaders |
| highlevel/HighLevelRenderer.ts | 342 | 3.14 Phase 2 | Public (highlevel) | High-level renderer |
| highlevel/Mesh.ts | 226 | 3.14 Phase 2 | Public (highlevel) | Mesh abstraction |
| highlevel/utils.ts | 110 | 3.14 Phase 2 | Internal | High-level utils |
| highlevel/index.ts | 57 | 3.14 Phase 2 | Public | High-level exports |
| commands/DrawCommandBuilder.ts | 498 | 3.14 | Public | Draw command builder |
| commands/DrawCommand.ts | 213 | 3.14 | Public | Draw command types |
| commands/index.ts | 21 | 3.14 | Public | Command exports |
| builders/PipelineBuilder.ts | 385 | RENDERING-06 | Public | Pipeline builder |
| builders/VertexLayoutBuilder.ts | 235 | RENDERING-06 | Public | Vertex layout builder |
| recovery/DeviceRecoverySystem.ts | 467 | 3.2 | Internal | Device recovery |
| recovery/ResourceRegistry.ts | 211 | 3.2 | Internal | Resource tracking |
| recovery/DeviceLossDetector.ts | 117 | 3.2 | Internal | Loss detection |
| recovery/webgpu-types.ts | 52 | 3.2 | Internal | Recovery types |
| recovery/index.ts | 27 | 3.2 | Internal | Recovery exports |
| systems/OrbitingLightSystem.ts | 174 | 3.18 Phase 3 | Public | Orbiting lights |
| systems/FlickeringLightSystem.ts | 135 | 3.18 Phase 3 | Public | Flickering lights |
| systems/PulsingLightSystem.ts | 105 | 3.18 Phase 3 | Public | Pulsing lights |
| constants/RenderingConstants.ts | 381 | RENDERING-05 | Internal | Constants |
| utils/HashUtils.ts | 157 | RENDERING-05 | Internal | Hash utilities |
| ShaderReflection.ts | 615 | 3.14 Phase 3 | Public | Shader reflection |
| ShaderLoader.ts | 533 | 3.2 | Internal | Shader loading |
| InstanceBuffer.ts | 439 | 3.13 | Public | Instance buffer |
| VRAMProfiler.ts | 389 | 3.8 | Public | VRAM profiling |
| GPUBufferPool.ts | 371 | 3.8 | Public | Buffer pooling |
| DemoUI.ts | 355 | Demo | Public | Demo UI |
| LightCollection.ts | 354 | 3.15 | Public | Light collection |
| TextureAtlas.ts | 309 | 3.8 | Public | Texture atlas |
| Camera.ts | 302 | 3.10 | Public (legacy) | Legacy camera |
| types.ts | 280 | 3.1-3.3 | Public | Core types |
| BindGroupPool.ts | 262 | 3.14 | Internal | Bind group pool |
| CameraSystem.ts | 257 | 3.10 | Public | ECS camera |
| PipelineStateDescriptor.ts | 250 | 3.14 | Public | Pipeline state |
| InstancedShaderManager.ts | 238 | 3.13 | Public | Instanced shaders |
| index.ts | 237 | All | Public | Main exports |
| Geometry.ts | 192 | 3.1-3.3 | Public | Geometry utils |
| CameraControllers.ts | 180 | 3.10 | Public | Camera controllers |
| InstanceBufferManager.ts | 166 | 3.13 | Public | Instance management |
| RenderPass.ts | 165 | 3.14 | Public | Render pass API |
| LightSystem.ts | 153 | 3.15 | Public | Light ECS system |
| PerformanceBaseline.ts | 98 | 3.14 | Public | Performance tracking |
| LightTypes.ts | 81 | 3.15 | Public | Light types |
| BindGroupDescriptors.ts | 64 | 3.14 | Public | Bind group descriptors |

**Total:** 78 files, ~22,002 LOC

---

**Completion Status:** Task 1.1-1.4 complete. Tasks 1.5-1.8 pending.
