# Miskatonic Rendering Engine - Complete API Documentation

## Table of Contents
1. [Core Backend API](#core-backend-api)
2. [WebGPUBackend](#webgpubackend)
3. [Render Queue System](#render-queue-system)
4. [Shader System](#shader-system)
5. [Buffer Management](#buffer-management)
6. [Camera System](#camera-system)
7. [Light System](#light-system)
8. [Shadow Mapping](#shadow-mapping)
9. [Instance Rendering](#instance-rendering)
10. [Texture Management](#texture-management)
11. [Resource Handles](#resource-handles)
12. [Draw Commands](#draw-commands)
13. [Performance Monitoring](#performance-monitoring)

---

## Core Backend API

### IRendererBackend

The interface for WebGPU rendering operations.

```typescript
interface IRendererBackend {
  readonly name: string;

  // Initialization
  initialize(config: BackendConfig): Promise<boolean>;
  dispose(): void;

  // Frame management
  beginFrame(): void;
  endFrame(): RenderStats;

  // Resource creation
  createShader(id: string, source: ShaderSource): BackendShaderHandle;
  createBuffer(id: string, data: ArrayBuffer, usage: BufferUsage): BackendBufferHandle;
  createTexture(id: string, width: number, height: number, data?: ArrayBuffer): BackendTextureHandle;
  createFramebuffer(id: string, width: number, height: number): BackendFramebufferHandle;

  // Modern API (Epic 3.14)
  createBindGroupLayout(descriptor: BindGroupLayoutDescriptor): BackendBindGroupLayoutHandle;
  createBindGroup(layout: BackendBindGroupLayoutHandle, resources: BindGroupResources): BackendBindGroupHandle;
  createRenderPipeline(descriptor: RenderPipelineDescriptor): BackendPipelineHandle;
  createComputePipeline(descriptor: ComputePipelineDescriptor): BackendPipelineHandle;

  // Command execution
  executeCommands(commands: RenderCommand[]): void;
  executeModernRenderPass(command: ModernDrawCommand): void;

  // Resource management
  deleteShader(handle: BackendShaderHandle): void;
  deleteBuffer(handle: BackendBufferHandle): void;
  deleteTexture(handle: BackendTextureHandle): void;
  deleteFramebuffer(handle: BackendFramebufferHandle): void;

  // State management
  resize(width: number, height: number): void;
  clear(color: number[], depth: number, stencil: number): void;

  // Capabilities
  getCapabilities(): BackendCapabilities;
  isContextLost(): boolean;
}
```

#### BackendConfig
```typescript
interface BackendConfig {
  canvas: HTMLCanvasElement;
  alpha?: boolean;              // Default: false
  depth?: boolean;              // Default: true
  stencil?: boolean;            // Default: false
  antialias?: boolean;          // Default: true
  premultipliedAlpha?: boolean; // Default: true
  preserveDrawingBuffer?: boolean; // Default: false
  powerPreference?: 'default' | 'high-performance' | 'low-power';
}
```

#### BackendCapabilities
```typescript
interface BackendCapabilities {
  maxTextureSize: number;
  maxVertexAttributes: number;
  maxBindGroups: number;
  maxUniformBufferSize: number;
  maxStorageBufferSize: number;
  maxSamplers: number;
  maxColorAttachments: number;
  computeSupport: boolean;
  timestampQuerySupport: boolean;
}
```

---

## WebGPUBackend

The WebGPU rendering backend implementation.

### Usage Example
```typescript
import { WebGPUBackend } from '@miskatonic/rendering';

const backend = new WebGPUBackend();
const success = await backend.initialize({
  canvas: document.getElementById('canvas') as HTMLCanvasElement,
  powerPreference: 'high-performance',
  alpha: false
});

if (!success) {
  throw new Error('WebGPU not supported');
}

// Create shader
const shader = backend.createShader('basic', {
  vertex: vertexWGSL,
  fragment: fragmentWGSL
});

// Create buffer
const vertices = new Float32Array([...]);
const vertexBuffer = backend.createBuffer('vertices', vertices.buffer, 'vertex');

// Begin rendering
backend.beginFrame();
backend.clear([0, 0, 0, 1], 1.0, 0);

// Execute draw commands
backend.executeCommands([...]);

const stats = backend.endFrame();
console.log(`Frame time: ${stats.frameTime}ms, Draw calls: ${stats.drawCalls}`);
```

### Internal Optimizations
- **UniformBufferPool**: Reuses up to 8192 uniform buffers per frame
- **Bind Group Caching**: Hash-based caching to avoid recreation
- **Pipeline Caching**: Caches (shader, vertex layout) combinations
- **GPU Timing**: Triple-buffered timestamp queries when available

---

## Render Queue System

### RenderQueue

Organizes draw commands for optimal GPU performance.

```typescript
class RenderQueue {
  constructor();

  // Camera setup
  setCamera(camera: CameraInfo): void;

  // Submit draw commands
  submit(command: QueuedDrawCommand): void;

  // Sort and retrieve commands
  sort(): void;
  getOpaqueCommands(): QueuedDrawCommand[];
  getAlphaTestCommands(): QueuedDrawCommand[];
  getTransparentCommands(): QueuedDrawCommand[];

  // Instance rendering
  detectInstances(): void;
  getInstanceGroups(): Map<string, InstanceGroup[]>;

  // Frame management
  clear(): void;

  // Statistics
  getStats(): RenderQueueStats;
}
```

#### QueuedDrawCommand
```typescript
interface QueuedDrawCommand {
  drawCommand: DrawCommand;      // Low-level draw command
  materialId: string;            // For batching
  worldMatrix: Float32Array;     // 4x4 transform matrix
  depth: number;                 // Distance from camera
  sortKey: number;              // Precomputed sort key
  renderState?: Partial<RenderState>;
}
```

#### Usage Example
```typescript
const queue = new RenderQueue();
queue.setCamera({
  position: new Float32Array([0, 5, 10]),
  viewMatrix: viewMatrix,
  projectionMatrix: projMatrix
});

// Submit opaque object
queue.submit({
  drawCommand: drawCmd,
  materialId: 'concrete',
  worldMatrix: modelMatrix,
  depth: 10.5,
  sortKey: 0x00000000,
  renderState: { depthTest: 'less' }
});

// Sort by optimal order
queue.sort();

// Render in correct order
for (const cmd of queue.getOpaqueCommands()) {
  backend.executeCommands([cmd.drawCommand]);
}
```

### Sorting Strategy
- **Opaque**: Front-to-back (minimize overdraw)
- **Alpha-test**: By material (minimize state changes)
- **Transparent**: Back-to-front (correct blending)

---

## Shader System

### ShaderReflection

Automatic extraction of shader metadata from WGSL source.

```typescript
class WGSLReflectionParser {
  parse(source: string): ShaderReflectionData;
}

class ShaderReflectionCache {
  get(id: string): ShaderReflectionData | undefined;
  set(id: string, data: ShaderReflectionData): void;
  clear(): void;
}
```

#### ShaderReflectionData
```typescript
interface ShaderReflectionData {
  bindGroupLayouts: BindGroupLayoutDescriptor[];
  attributes: ShaderAttribute[];
  entryPoints: {
    vertex?: string;
    fragment?: string;
    compute?: string;
  };
  workgroupSize?: { x: number; y: number; z: number; };
}
```

#### Usage Example
```typescript
const parser = new WGSLReflectionParser();
const reflection = parser.parse(shaderSource);

// Automatically create bind group layouts
for (const layout of reflection.bindGroupLayouts) {
  const handle = backend.createBindGroupLayout(layout);
}

// Use vertex attributes
console.log('Vertex attributes:', reflection.attributes);
// [{ location: 0, name: 'position', format: 'float32x3', offset: 0 }]
```

### ShaderLoader (Node.js only)

Loads and processes shader files with feature variants.

```typescript
class ShaderLoader {
  constructor(config?: ShaderLoaderConfig);

  async loadShader(
    name: string,
    features?: ShaderFeatures
  ): Promise<LoadedShader>;

  clearCache(): void;
}

interface ShaderFeatures {
  instancing?: boolean;
  shadows?: boolean;
  lighting?: boolean;
  fog?: boolean;
  [key: string]: boolean | undefined;
}
```

---

## Buffer Management

### GPUBufferPool

Efficient GPU buffer allocation with power-of-2 bucketing.

```typescript
class GPUBufferPool {
  constructor();

  // Buffer lifecycle
  acquire(
    device: GPUDevice,
    usage: BufferUsageType,
    requestedSize: number
  ): GPUBuffer;

  release(
    buffer: GPUBuffer,
    usage: BufferUsageType,
    originalSize: number
  ): void;

  // Frame management
  nextFrame(): void;
  cleanup(maxUnusedFrames?: number): void;

  // Device loss
  handleDeviceLoss(): void;

  // Statistics
  getStats(): BufferPoolStats;
  resetStats(): void;
}

enum BufferUsageType {
  VERTEX = 'vertex',
  INDEX = 'index',
  UNIFORM = 'uniform',
  STORAGE = 'storage',
  INSTANCE = 'instance'
}
```

#### Usage Example
```typescript
const pool = new GPUBufferPool();

// Acquire buffer (returns nearest power-of-2 size)
const buffer = pool.acquire(device, BufferUsageType.VERTEX, 1500);
// Returns 2048-byte buffer

// Use buffer...

// Release back to pool
pool.release(buffer, BufferUsageType.VERTEX, 1500);

// Per-frame cleanup
pool.nextFrame();
pool.cleanup(300); // Clean buffers unused for 300 frames
```

### InstanceBuffer

Specialized buffer management for instanced rendering.

```typescript
class InstanceBuffer {
  constructor(capacity: number);

  addInstance(data: InstanceData): number;
  updateInstance(index: number, data: InstanceData): void;
  removeInstance(index: number): void;

  getBuffer(): Float32Array;
  getCount(): number;
  clear(): void;
}

interface InstanceData {
  transform: Float32Array;  // 4x4 matrix
  color?: Float32Array;     // vec4
  custom?: Float32Array;    // User-defined
}
```

---

## Camera System

### Camera

Core camera with view/projection matrix generation.

```typescript
class Camera {
  position: vec3;
  rotation: quat;

  constructor(config?: CameraConfig);

  // Matrix generation
  getViewMatrix(): mat4;
  getProjectionMatrix(): mat4;
  getViewProjectionMatrix(): mat4;

  // Movement
  translate(delta: vec3): void;
  rotate(yaw: number, pitch: number): void;
  lookAt(target: vec3, up?: vec3): void;

  // Projection settings
  setPerspective(fov: number, aspect: number, near: number, far: number): void;
  setOrthographic(left: number, right: number, bottom: number, top: number, near: number, far: number): void;
}
```

### CameraControllers

Pre-built camera controllers for common use cases.

```typescript
class OrbitCameraController {
  constructor(camera: Camera, config?: OrbitConfig);

  update(deltaTime: number): void;
  handleMouseMove(deltaX: number, deltaY: number): void;
  handleMouseWheel(delta: number): void;

  setTarget(target: vec3): void;
  setDistance(distance: number): void;
}

class FirstPersonCameraController {
  constructor(camera: Camera, config?: FPSConfig);

  update(deltaTime: number): void;
  handleKeyboard(keys: Set<string>): void;
  handleMouseMove(deltaX: number, deltaY: number): void;

  setSpeed(speed: number): void;
  setSensitivity(sensitivity: number): void;
}
```

#### Usage Example
```typescript
const camera = new Camera();
camera.setPerspective(60, canvas.width/canvas.height, 0.1, 1000);

const controller = new OrbitCameraController(camera, {
  distance: 10,
  minDistance: 1,
  maxDistance: 100,
  rotationSpeed: 0.01,
  zoomSpeed: 0.1
});

// In render loop
controller.update(deltaTime);
const viewProjMatrix = camera.getViewProjectionMatrix();
```

---

## Light System

### LightCollection

Manages all lights in the scene.

```typescript
class LightCollection {
  constructor(maxLights?: number);

  // Light management
  addLight(light: LightData): number;
  updateLight(id: number, light: Partial<LightData>): void;
  removeLight(id: number): void;

  // Retrieval
  getLight(id: number): LightData | undefined;
  getAllLights(): LightData[];
  getLightsByType(type: LightType): LightData[];

  // GPU data
  getGPUBuffer(device: GPUDevice): GPUBuffer;
  updateGPUBuffer(device: GPUDevice): void;

  clear(): void;
}

enum LightType {
  DIRECTIONAL = 0,
  POINT = 1,
  SPOT = 2
}

interface LightData {
  type: LightType;
  position: vec3;       // World space position
  direction: vec3;      // Normalized direction (spot/directional)
  color: vec3;          // RGB color
  intensity: number;    // Light intensity multiplier
  range?: number;       // Point/spot light range
  innerCone?: number;   // Spot light inner cone angle
  outerCone?: number;   // Spot light outer cone angle
  castShadows?: boolean;
}
```

### LightSystem (ECS Integration)

```typescript
class LightSystem extends System {
  constructor(world: World);

  update(deltaTime: number): void;

  // Access light data
  getLightCollection(): LightCollection;

  // Culling
  cullLights(frustum: Frustum): LightData[];
}
```

#### Usage Example
```typescript
const lights = new LightCollection(128);

// Add directional light (sun)
const sunId = lights.addLight({
  type: LightType.DIRECTIONAL,
  position: [0, 100, 0],
  direction: [0, -1, 0],
  color: [1, 0.9, 0.7],
  intensity: 2.0,
  castShadows: true
});

// Add point light
const torchId = lights.addLight({
  type: LightType.POINT,
  position: [5, 2, 5],
  direction: [0, 0, 0],
  color: [1, 0.5, 0],
  intensity: 10.0,
  range: 20.0
});

// Update GPU buffer for shader consumption
lights.updateGPUBuffer(device);
const buffer = lights.getGPUBuffer(device);
```

---

## Shadow Mapping

### DirectionalShadowCascades

Cascaded shadow maps for sun/directional lights.

```typescript
class DirectionalShadowCascades {
  constructor(config: CascadeConfig);

  // Setup
  allocateFromAtlas(atlas: ShadowAtlas): void;

  // Update cascades
  update(
    lightDirection: vec3,
    cameraView: mat4,
    cameraProjection: mat4
  ): void;

  // Get cascade data
  getCascades(): Cascade[];
  getCascade(index: number): Cascade;

  // For shaders
  getCascadeSplits(): Float32Array;
  getViewProjectionMatrices(): Float32Array;
}

interface CascadeConfig {
  cascadeCount: number;    // 2-4 typical
  resolution: number;       // Per-cascade resolution
  nearPlane: number;
  farPlane: number;
  splitScheme?: 'uniform' | 'logarithmic' | 'practical';
  lambda?: number;          // 0=uniform, 1=logarithmic
}
```

### PointLightShadowCubemap

Omnidirectional shadows for point lights.

```typescript
class PointLightShadowCubemap {
  constructor(resolution: number);

  // Setup
  allocateFromAtlas(atlas: ShadowAtlas): void;

  // Update all 6 faces
  updateMatrices(lightPosition: vec3, near: number, far: number): void;

  // Get face data
  getFaceMatrix(face: CubemapFace): mat4;
  getAllMatrices(): Float32Array;

  // Atlas regions
  getFaceRegion(face: CubemapFace): ShadowRegion;
}

enum CubemapFace {
  POSITIVE_X = 0,
  NEGATIVE_X = 1,
  POSITIVE_Y = 2,
  NEGATIVE_Y = 3,
  POSITIVE_Z = 4,
  NEGATIVE_Z = 5
}
```

### ShadowAtlas

Texture atlas manager for shadow maps.

```typescript
class ShadowAtlas {
  constructor(size: number, device: GPUDevice);

  // Allocation
  allocate(width: number, height: number, lightId: string): ShadowRegion | null;
  deallocate(lightId: string): void;

  // Access
  getRegion(lightId: string): ShadowRegion | undefined;
  getTexture(): GPUTexture;

  // Management
  defragment(): void;
  clear(): void;

  // Stats
  getUtilization(): number;
  getFragmentation(): number;
}

interface ShadowRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  uvOffset: vec2;
  uvScale: vec2;
}
```

#### Shadow Rendering Example
```typescript
// Setup shadow atlas
const atlas = new ShadowAtlas(4096, device);

// Setup cascades for sun
const cascades = new DirectionalShadowCascades({
  cascadeCount: 4,
  resolution: 1024,
  nearPlane: 0.1,
  farPlane: 1000,
  splitScheme: 'logarithmic'
});
cascades.allocateFromAtlas(atlas);

// Update cascades each frame
cascades.update(sunDirection, camera.viewMatrix, camera.projMatrix);

// Render shadow maps
for (const cascade of cascades.getCascades()) {
  renderShadowMap(cascade.viewProjectionMatrix, cascade.region);
}
```

---

## Instance Rendering

### InstanceDetector

Automatically detects and groups instances for batching.

```typescript
class InstanceDetector {
  constructor(config?: InstanceDetectorConfig);

  // Detection
  detectInstances(commands: QueuedDrawCommand[]): InstanceGroup[];

  // Configuration
  setThreshold(minInstances: number): void;

  // Stats
  getStats(): InstanceDetectionStats;
  clear(): void;
}

interface InstanceGroup {
  key: string;              // "meshId:materialId"
  meshId: string;
  materialId: string;
  instances: QueuedDrawCommand[];
  instanceCount: number;
  worldMatrices: Float32Array;
  canInstance: boolean;
}

interface InstanceDetectorConfig {
  minInstanceThreshold?: number;  // Default: 10
  maxInstancesPerDraw?: number;   // Default: 1000
}
```

### InstanceBufferManager

Manages GPU buffers for instance data.

```typescript
class InstanceBufferManager {
  constructor(device: GPUDevice);

  // Buffer management
  createInstanceBuffer(
    instanceData: Float32Array,
    stride: number
  ): GPUInstanceBuffer;

  updateInstanceBuffer(
    buffer: GPUInstanceBuffer,
    data: Float32Array,
    offset?: number
  ): void;

  destroyInstanceBuffer(buffer: GPUInstanceBuffer): void;

  // Frame cleanup
  cleanup(): void;
}

interface GPUInstanceBuffer {
  id: string;
  buffer: GPUBuffer;
  stride: number;
  count: number;
}
```

#### Instance Rendering Example
```typescript
const detector = new InstanceDetector({ minInstanceThreshold: 2 });
const manager = new InstanceBufferManager(device);

// Detect instances in render queue
const instances = detector.detectInstances(queue.getOpaqueCommands());

for (const group of instances) {
  if (group.canInstance) {
    // Create instance buffer
    const instanceBuffer = manager.createInstanceBuffer(
      group.worldMatrices,
      64 // mat4 size
    );

    // Render instanced
    backend.executeCommands([{
      type: RenderCommandType.DRAW,
      mode: PrimitiveMode.TRIANGLES,
      vertexBuffer: group.instances[0].drawCommand.vertexBuffer,
      indexBuffer: group.instances[0].drawCommand.indexBuffer,
      instanceCount: group.instanceCount,
      // ... shader with instancing support
    }]);
  }
}
```

---

## Texture Management

### TextureAtlas

Efficient texture packing for multiple textures.

```typescript
class TextureAtlas {
  constructor(width: number, height: number, device: GPUDevice);

  // Texture addition
  addTexture(
    id: string,
    width: number,
    height: number,
    data: Uint8Array
  ): AtlasRegion | null;

  removeTexture(id: string): void;

  // Access
  getRegion(id: string): AtlasRegion | undefined;
  getTexture(): GPUTexture;

  // UV transformation
  transformUV(region: AtlasRegion, uv: vec2): vec2;

  // Management
  defragment(): void;
  clear(): void;

  // Stats
  getStats(): TextureAtlasStats;
}

interface AtlasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  uvMin: vec2;
  uvMax: vec2;
  rotated: boolean;
}

interface TextureAtlasStats {
  textureCount: number;
  usedPixels: number;
  totalPixels: number;
  utilization: number;  // percentage
  largestFreeBlock: number;
}
```

#### Usage Example
```typescript
const atlas = new TextureAtlas(2048, 2048, device);

// Add sprite textures
const coinRegion = atlas.addTexture('coin', 64, 64, coinPixels);
const heartRegion = atlas.addTexture('heart', 32, 32, heartPixels);

// Use in shader
const atlasTexture = atlas.getTexture();
// Transform sprite UVs
const transformedUV = atlas.transformUV(coinRegion, originalUV);
```

---

## Resource Handles

Type-safe handles for GPU resources.

```typescript
// Base handle types
interface BackendShaderHandle {
  type: 'shader';
  id: string;
}

interface BackendBufferHandle {
  type: 'buffer';
  id: string;
}

interface BackendTextureHandle {
  type: 'texture';
  id: string;
}

interface BackendFramebufferHandle {
  type: 'framebuffer';
  id: string;
}

// Epic 3.14 handles
interface BackendBindGroupLayoutHandle {
  type: 'bindGroupLayout';
  id: string;
}

interface BackendBindGroupHandle {
  type: 'bindGroup';
  id: string;
}

interface BackendPipelineHandle {
  type: 'pipeline';
  id: string;
}

// Type guards
function isBackendShaderHandle(handle: any): handle is BackendShaderHandle;
function isBackendBufferHandle(handle: any): handle is BackendBufferHandle;
function isBackendTextureHandle(handle: any): handle is BackendTextureHandle;
function isBackendFramebufferHandle(handle: any): handle is BackendFramebufferHandle;
function isBackendBindGroupLayoutHandle(handle: any): handle is BackendBindGroupLayoutHandle;
function isBackendBindGroupHandle(handle: any): handle is BackendBindGroupHandle;
function isBackendPipelineHandle(handle: any): handle is BackendPipelineHandle;
```

---

## Draw Commands

### Modern Draw Command (Epic 3.14)

WebGPU-aligned draw command structure.

```typescript
interface ModernDrawCommand {
  label?: string;

  // Pipeline
  pipeline: BackendPipelineHandle;

  // Bind groups (0-3)
  bindGroups: Map<number, BackendBindGroupHandle>;

  // Vertex input
  vertexBuffers: BackendBufferHandle[];

  // Index data (optional)
  indexBuffer?: BackendBufferHandle;
  indexFormat?: 'uint16' | 'uint32';
  indexCount?: number;

  // Draw parameters
  vertexCount?: number;
  instanceCount?: number;
  firstVertex?: number;
  firstInstance?: number;
  baseVertex?: number;
}
```

### NewDrawCommand

Extended command with compute support.

```typescript
interface NewDrawCommand {
  type: 'draw' | 'drawIndexed' | 'drawIndirect' | 'compute';

  pipeline: BackendPipelineHandle;
  bindGroups: Map<number, BackendBindGroupHandle>;

  // Vertex data
  vertexBuffers?: BackendBufferHandle[];
  indexBuffer?: BackendBufferHandle;

  // Draw parameters
  vertexCount?: number;
  indexCount?: number;
  instanceCount?: number;
  firstVertex?: number;
  firstIndex?: number;
  baseVertex?: number;
  firstInstance?: number;

  // Indirect drawing
  indirectBuffer?: BackendBufferHandle;
  indirectOffset?: number;

  // Compute dispatch
  workgroupsX?: number;
  workgroupsY?: number;
  workgroupsZ?: number;
}
```

#### Usage Example
```typescript
// Create pipeline
const pipeline = backend.createRenderPipeline({
  vertex: {
    module: vertexShader,
    entryPoint: 'vs_main',
    buffers: [vertexLayout]
  },
  fragment: {
    module: fragmentShader,
    entryPoint: 'fs_main',
    targets: [{ format: 'bgra8unorm' }]
  },
  primitive: {
    topology: 'triangle-list',
    cullMode: 'back'
  },
  depthStencil: {
    depthWriteEnabled: true,
    depthCompare: 'less',
    format: 'depth24plus'
  }
});

// Create bind groups
const bindGroup0 = backend.createBindGroup(layout0, {
  0: { buffer: uniformBuffer },
  1: { texture: diffuseTexture },
  2: { sampler: sampler }
});

// Execute modern draw
backend.executeModernRenderPass({
  label: 'Main Pass',
  pipeline: pipeline,
  bindGroups: new Map([[0, bindGroup0]]),
  vertexBuffers: [vertexBuffer],
  indexBuffer: indexBuffer,
  indexFormat: 'uint16',
  indexCount: mesh.indexCount,
  instanceCount: 1
});
```

---

## Performance Monitoring

### VRAMProfiler

Tracks and manages video memory usage.

```typescript
class VRAMProfiler {
  constructor(budgetBytes: number);

  // Tracking
  allocate(category: VRAMCategory, id: string, bytes: number): void;
  deallocate(category: VRAMCategory, id: string): void;

  // Queries
  getUsage(category?: VRAMCategory): VRAMUsage;
  getStats(): VRAMStats;
  isWithinBudget(): boolean;

  // Budget management
  setBudget(bytes: number): void;
  requestAllocation(bytes: number): boolean;

  // Cleanup
  reset(): void;
}

enum VRAMCategory {
  TEXTURE = 'texture',
  BUFFER = 'buffer',
  RENDER_TARGET = 'renderTarget',
  SHADER = 'shader',
  OTHER = 'other'
}

interface VRAMStats {
  totalUsed: number;
  totalBudget: number;
  utilizationPercent: number;
  byCategory: Map<VRAMCategory, VRAMUsage>;
  largestAllocations: Array<{
    category: VRAMCategory;
    id: string;
    bytes: number;
  }>;
}
```

### PerformanceBaseline

Captures and compares rendering performance metrics.

```typescript
class PerformanceBaseline {
  start(): void;
  recordFrame(metrics: Omit<PerformanceMetrics, 'timestamp'>): void;
  getAverage(): PerformanceMetrics | null;

  compare(
    baseline: PerformanceMetrics,
    current: PerformanceMetrics
  ): {
    frameTimeChange: number;      // percentage
    drawCallsChange: number;       // percentage
    bufferUpdatesChange: number;   // percentage
    shaderSwitchesChange: number;  // percentage
  };

  export(): string;  // JSON export
}

interface PerformanceMetrics {
  frameTime: number;        // ms
  drawCalls: number;
  bufferUpdates: number;
  shaderSwitches: number;
  timestamp: number;
}
```

#### Performance Monitoring Example
```typescript
// VRAM tracking
const vramProfiler = new VRAMProfiler(512 * 1024 * 1024); // 512MB budget

vramProfiler.allocate(VRAMCategory.TEXTURE, 'albedo', 4 * 1024 * 1024);
vramProfiler.allocate(VRAMCategory.BUFFER, 'vertices', 2 * 1024 * 1024);

const stats = vramProfiler.getStats();
console.log(`VRAM Usage: ${stats.utilizationPercent}%`);

// Performance baseline
const baseline = new PerformanceBaseline();
baseline.start();

// Record frames
for (let i = 0; i < 100; i++) {
  const frameStart = performance.now();

  // ... render frame ...

  baseline.recordFrame({
    frameTime: performance.now() - frameStart,
    drawCalls: renderStats.drawCalls,
    bufferUpdates: renderStats.bufferUpdates,
    shaderSwitches: renderStats.shaderSwitches
  });
}

const avgMetrics = baseline.getAverage();
console.log(`Average frame time: ${avgMetrics.frameTime}ms`);
```

---

## Pipeline State Management

### PipelineStateDescriptor

Describes complete GPU pipeline state.

```typescript
interface PipelineStateDescriptor {
  blending?: BlendState;
  depthStencil?: DepthStencilState;
  rasterization?: RasterizationState;
  primitive?: PrimitiveState;
}

interface BlendState {
  enabled: boolean;
  color: {
    srcFactor: BlendFactor;
    dstFactor: BlendFactor;
    operation: BlendOperation;
  };
  alpha: {
    srcFactor: BlendFactor;
    dstFactor: BlendFactor;
    operation: BlendOperation;
  };
}

interface DepthStencilState {
  depthWriteEnabled: boolean;
  depthCompare: CompareFunction;
  format: GPUTextureFormat;
  stencilFront?: StencilFaceState;
  stencilBack?: StencilFaceState;
}

interface RasterizationState {
  cullMode: CullMode;
  frontFace: FrontFace;
  depthBias?: number;
  depthBiasSlopeScale?: number;
  depthBiasClamp?: number;
}

// Predefined states
const OPAQUE_PIPELINE_STATE: PipelineStateDescriptor;
const ALPHA_BLEND_PIPELINE_STATE: PipelineStateDescriptor;
const ADDITIVE_BLEND_PIPELINE_STATE: PipelineStateDescriptor;
```

---

## Bind Group Management

### BindGroupLayoutDescriptor

Describes resource layout for shaders.

```typescript
interface BindGroupLayoutDescriptor {
  entries: BindGroupLayoutEntry[];
}

interface BindGroupLayoutEntry {
  binding: number;
  visibility: ShaderStage[];
  type: BindingType;

  // Type-specific options
  buffer?: {
    type: 'uniform' | 'storage' | 'read-only-storage';
    hasDynamicOffset?: boolean;
    minBindingSize?: number;
  };

  sampler?: {
    type: 'filtering' | 'non-filtering' | 'comparison';
  };

  texture?: {
    sampleType: 'float' | 'unfilterable-float' | 'depth' | 'sint' | 'uint';
    viewDimension: '1d' | '2d' | '2d-array' | 'cube' | 'cube-array' | '3d';
    multisampled?: boolean;
  };

  storageTexture?: {
    access: 'write-only' | 'read-only' | 'read-write';
    format: GPUTextureFormat;
    viewDimension: '1d' | '2d' | '2d-array' | '3d';
  };
}

type ShaderStage = 'vertex' | 'fragment' | 'compute';
type BindingType = 'uniform' | 'storage' | 'sampler' | 'texture' | 'storageTexture';
```

### Helper Functions

```typescript
// Validation
function validateBindGroupLayout(descriptor: BindGroupLayoutDescriptor): void;

// Common layouts
function createSceneBindGroupLayout(): BindGroupLayoutDescriptor;
function createObjectBindGroupLayout(): BindGroupLayoutDescriptor;
function createMaterialBindGroupLayout(): BindGroupLayoutDescriptor;
```

---

## Complete Usage Example

Full rendering pipeline setup and usage:

```typescript
import {
  WebGPUBackend,
  RenderQueue,
  Camera,
  OrbitCameraController,
  LightCollection,
  DirectionalShadowCascades,
  ShadowAtlas,
  GPUBufferPool,
  VRAMProfiler,
  PerformanceBaseline,
  LightType,
  BufferUsageType,
  VRAMCategory
} from '@miskatonic/rendering';

// Initialize backend
const backend = new WebGPUBackend();
await backend.initialize({
  canvas: document.getElementById('canvas') as HTMLCanvasElement,
  powerPreference: 'high-performance'
});

// Setup camera
const camera = new Camera();
camera.setPerspective(60, canvas.width/canvas.height, 0.1, 1000);
const cameraController = new OrbitCameraController(camera);

// Setup lights
const lights = new LightCollection(64);
const sunId = lights.addLight({
  type: LightType.DIRECTIONAL,
  position: [0, 100, 0],
  direction: [0, -1, 0],
  color: [1, 0.95, 0.8],
  intensity: 3.0,
  castShadows: true
});

// Setup shadows
const shadowAtlas = new ShadowAtlas(4096, backend.device);
const sunShadows = new DirectionalShadowCascades({
  cascadeCount: 4,
  resolution: 1024,
  nearPlane: camera.near,
  farPlane: camera.far,
  splitScheme: 'logarithmic'
});
sunShadows.allocateFromAtlas(shadowAtlas);

// Setup render queue
const renderQueue = new RenderQueue();

// Resource management
const bufferPool = new GPUBufferPool();
const vramProfiler = new VRAMProfiler(512 * 1024 * 1024);
const perfBaseline = new PerformanceBaseline();
perfBaseline.start();

// Main render loop
function render(deltaTime: number) {
  // Update systems
  cameraController.update(deltaTime);
  lights.updateGPUBuffer(backend.device);
  sunShadows.update(
    lights.getLight(sunId).direction,
    camera.getViewMatrix(),
    camera.getProjectionMatrix()
  );

  // Submit objects to queue
  renderQueue.setCamera({
    position: camera.position,
    viewMatrix: camera.getViewMatrix(),
    projectionMatrix: camera.getProjectionMatrix()
  });

  for (const object of sceneObjects) {
    renderQueue.submit({
      drawCommand: object.drawCommand,
      materialId: object.material.id,
      worldMatrix: object.transform,
      depth: calculateDepth(object, camera),
      sortKey: generateSortKey(object)
    });
  }

  // Sort and detect instances
  renderQueue.sort();
  renderQueue.detectInstances();

  // Begin frame
  backend.beginFrame();
  backend.clear([0.1, 0.1, 0.15, 1.0], 1.0, 0);

  // Render shadow maps
  for (const cascade of sunShadows.getCascades()) {
    // Render to cascade.region in shadow atlas
  }

  // Render opaque objects
  for (const cmd of renderQueue.getOpaqueCommands()) {
    backend.executeModernRenderPass(cmd.drawCommand);
  }

  // Render transparent objects
  for (const cmd of renderQueue.getTransparentCommands()) {
    backend.executeModernRenderPass(cmd.drawCommand);
  }

  // End frame
  const stats = backend.endFrame();

  // Performance tracking
  perfBaseline.recordFrame({
    frameTime: deltaTime * 1000,
    drawCalls: stats.drawCalls,
    bufferUpdates: stats.bufferUpdates,
    shaderSwitches: stats.shaderSwitches
  });

  // Resource cleanup
  bufferPool.nextFrame();
  renderQueue.clear();

  requestAnimationFrame(() => render(deltaTime));
}

// Start rendering
render(0);
```

---

## Error Handling

All API methods include comprehensive error checking:

```typescript
// Example error scenarios
try {
  backend.createBuffer('test', null, 'vertex');
} catch (e) {
  // Error: Invalid buffer data
}

try {
  renderQueue.submit({ materialId: null });
} catch (e) {
  // Error: Invalid materialId (must be non-empty string)
}

try {
  shadowAtlas.allocate(8192, 8192, 'huge');
} catch (e) {
  // Error: Requested size exceeds atlas capacity
}
```

---

## Performance Best Practices

1. **Buffer Pooling**: Always use GPUBufferPool for dynamic buffers
2. **Instance Detection**: Enable for scenes with repeated objects
3. **Shadow Atlas**: Share single atlas across all shadow-casting lights
4. **Bind Group Caching**: Reuse bind groups across frames when possible
5. **Queue Sorting**: Always sort render queue for optimal GPU performance
6. **VRAM Budgets**: Monitor usage and reduce quality when approaching limits
7. **Frame Allocators**: Use for temporary per-frame data to avoid GC
8. **Pipeline Caching**: Create pipelines once, reuse across frames

---

## Migration from Legacy API

For code using the old DrawCommand interface:

```typescript
// Old API
const drawCommand: DrawCommand = {
  shader: 'basic',
  vertexBuffer: vertices,
  indexBuffer: indices,
  uniforms: new Map([['mvpMatrix', mvpData]])
};

// New API (Epic 3.14)
const drawCommand: ModernDrawCommand = {
  pipeline: pipeline,
  bindGroups: new Map([
    [0, sceneBindGroup],  // Camera, lights
    [1, objectBindGroup], // Model transform
    [2, materialBindGroup] // Textures, material params
  ]),
  vertexBuffers: [vertexBuffer],
  indexBuffer: indexBuffer,
  indexFormat: 'uint16',
  indexCount: mesh.indexCount
};
```

---

*Generated: November 2025*
*API Version: Epic 3.14 (Modern Rendering API)*
*Engine Version: 0.1.0*