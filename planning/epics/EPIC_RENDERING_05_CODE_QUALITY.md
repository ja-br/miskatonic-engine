# EPIC: Rendering Code Quality & Modularization

**Epic ID:** RENDERING-05
**Status:** Not Started
**Priority:** HIGH (Technical Debt)
**Depends On:** None (can start immediately)

## Objective

Eliminate dead code, split the monolithic WebGPUBackend.ts (1929 lines) into 6 focused modules, extract shared utilities, and consolidate magic numbers into constants. Improve code maintainability, readability, and adherence to Single Responsibility Principle.

## Success Criteria

- [x] WebGPUBackend.ts split into 6 modules (<400 lines each)
- [x] All dead code removed (no-op methods, unused queues)
- [x] Hash functions consolidated into HashUtils.ts (3 → 1)
- [x] Magic numbers extracted to RenderingConstants.ts (50+ constants)
- [x] Long methods refactored (no methods >50 lines)
- [x] All imports updated and working
- [x] Test coverage maintained (>80%)
- [x] No performance regression

## Current State

### Problems

#### 1. Monolithic WebGPUBackend.ts (1929 lines)
**Issues:**
- Violates Single Responsibility Principle
- Difficult to navigate and maintain
- Hard to test individual concerns
- Merge conflicts inevitable
- Cyclomatic complexity too high

#### 2. Dead Code Scattered Throughout
**WebGPUBackend.ts:**
- Lines 1057-1066: `setVertexAttributeDivisor()` - no-op method
- Lines 679-686: `clear()` - empty implementation
- Lines 115-142: Stats methods never exposed or used

**RenderQueue.ts:**
- Lines 537-541: `hasAlphaTest()` always returns false
- Lines 404-416: Material/state change tracking never read
- Alpha-test queue allocated but never used

**index.ts:**
- Line 29: Commented ShaderLoader export
- Lines 38-40: GPUTimingProfiler/LightingBenchmark dead references

#### 3. Duplicate Code
- **3 hash function implementations** (WebGPUBackend, RenderQueue, BindGroupDescriptors)
- Same hash logic copied in 3 places

#### 4. Magic Numbers Everywhere
```typescript
// Scattered throughout code:
256     // Uniform buffer alignment
8192    // Pool size
65536   // Max buffer size
1000    // Cache sizes
0.95    // Target cache hit rate
```

### Impact
- High maintenance cost
- Difficult to onboard new developers
- Hard to test in isolation
- Technical debt accumulating
- Code duplication increases bug risk

## Implementation Tasks

### Task 5.1: Remove Dead Code (4 hours)

**Deliverable:** Clean WebGPUBackend.ts, RenderQueue.ts, index.ts

#### Dead Code to Remove:

**WebGPUBackend.ts:**
```typescript
// REMOVE: Lines 1057-1066
setVertexAttributeDivisor(
  location: number,
  divisor: number,
  gpuVertexState?: GPUVertexState
): void {
  // No-op: WebGPU doesn't support per-attribute divisors
  // Use stepMode: 'instance' on vertex buffer layout instead
}

// REMOVE: Lines 679-686
clear(): void {
  // Empty implementation - TODO: implement or remove
}

// REMOVE: Lines 115-142 (UniformBufferPool internal stats)
getStats(): PoolStats {
  return {
    buffersCreated: this.stats.buffersCreated,
    buffersReused: this.stats.buffersReused
  };
}

resetStats(): void {
  this.stats = { buffersCreated: 0, buffersReused: 0 };
}
```

**RenderQueue.ts:**
```typescript
// REMOVE: Lines 537-541
private hasAlphaTest(command: DrawCommand): boolean {
  return false; // Always false, alpha-test queue never used
}

// REMOVE OR IMPLEMENT: Alpha-test queue infrastructure
private alphaTestQueue: QueuedDrawCommand[] = [];
// ... all alpha-test related code
```

**index.ts:**
```typescript
// REMOVE: Commented exports
// export { ShaderLoader } from './ShaderLoader'; // Node.js only
// export { GPUTimingProfiler } from './profiling/GPUTimingProfiler';
// export { LightingBenchmark } from './profiling/LightingBenchmark';
```

**Acceptance Criteria:**
- [ ] All no-op methods removed
- [ ] All commented code removed
- [ ] Alpha-test queue either implemented or removed
- [ ] No compilation errors after removal
- [ ] All tests still pass
- [ ] Git diff shows clear deletions

**Dependencies:** None

---

### Task 5.2: Extract Utility Classes (8 hours)

**Deliverable:** `/packages/rendering/src/utils/HashUtils.ts`
**Deliverable:** `/packages/rendering/src/constants/RenderingConstants.ts`

#### HashUtils.ts

```typescript
/**
 * Consolidated hash utilities for rendering engine.
 * Eliminates 3 duplicate implementations across WebGPUBackend, RenderQueue, BindGroupDescriptors.
 */
export class HashUtils {
  /**
   * Fast 16-bit hash for short strings (shader IDs, resource names)
   * Based on djb2 algorithm
   */
  static hash16Bit(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
    }
    return hash & 0xFFFF;
  }

  /**
   * FNV-1a hash for larger strings (shader source, JSON)
   * Better distribution than djb2 for longer inputs
   */
  static fnv1a(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  /**
   * Combine multiple hash values into single hash
   * Used for composite cache keys (shader + layout, etc.)
   */
  static combineHashes(...hashes: number[]): number {
    let result = 17;
    for (const hash of hashes) {
      result = result * 31 + hash;
    }
    return result >>> 0;
  }

  /**
   * Hash vertex layout descriptor
   */
  static hashVertexLayout(layout: VertexLayoutDescriptor): number {
    const parts = [
      layout.arrayStride.toString(),
      ...layout.attributes.map(attr =>
        `${attr.shaderLocation}:${attr.offset}:${attr.format}`
      )
    ];
    return this.fnv1a(parts.join('_'));
  }

  /**
   * Hash bind group layout
   */
  static hashBindGroupLayout(layout: BindGroupLayoutDescriptor): number {
    const entries = layout.entries.map(entry =>
      `${entry.binding}:${entry.visibility}:${entry.type || 'buffer'}`
    ).join('_');
    return this.fnv1a(entries);
  }

  /**
   * Create cache key from multiple components
   */
  static createCacheKey(...parts: (string | number)[]): string {
    return parts.map(p => typeof p === 'number' ? p.toString(16) : p).join('_');
  }
}
```

#### RenderingConstants.ts

```typescript
/**
 * Consolidated rendering constants.
 * Replaces 50+ magic numbers scattered throughout codebase.
 */

// ============================================================================
// Buffer Configuration
// ============================================================================

/** WebGPU uniform buffer alignment requirement (bytes) */
export const UNIFORM_BUFFER_ALIGNMENT = 256;

/** Default size for uniform buffer pool */
export const DEFAULT_UNIFORM_POOL_SIZE = 8192;

/** Maximum size for a single uniform buffer (64KB) */
export const MAX_UNIFORM_BUFFER_SIZE = 65536;

/** Minimum buffer size for pooling (256 bytes) */
export const MIN_POOLED_BUFFER_SIZE = 256;

/** Maximum buffer size for pooling (16MB) */
export const MAX_POOLED_BUFFER_SIZE = 16 * 1024 * 1024;

// ============================================================================
// Memory Management
// ============================================================================

/** Default VRAM budget for integrated GPUs (MB) */
export const DEFAULT_VRAM_BUDGET_MB = 256;

/** Default VRAM budget for discrete GPUs (MB) */
export const DISCRETE_VRAM_BUDGET_MB = 2048;

/** Bind group cache size (number of entries) */
export const BIND_GROUP_CACHE_SIZE = 1000;

/** Pipeline cache size (number of entries) */
export const PIPELINE_CACHE_SIZE = 500;

/** Shader cache size (number of entries) */
export const SHADER_CACHE_SIZE = 200;

/** Number of frames to keep unused buffers before cleanup */
export const BUFFER_CLEANUP_FRAME_THRESHOLD = 300;

// ============================================================================
// Instance Rendering
// ============================================================================

/** Power-of-2 bucket sizes for instance buffers */
export const INSTANCE_BUFFER_BUCKETS = [64, 128, 256, 512, 1024, 2048, 4096];

/** Minimum instances to trigger instanced rendering (production) */
export const MIN_INSTANCE_THRESHOLD = 10;

/** Minimum instances for demos (lower for testing) */
export const MIN_INSTANCE_THRESHOLD_DEMO = 2;

/** Maximum instances per draw call */
export const MAX_INSTANCES_PER_DRAW = 1000;

/** Instance buffer alignment (bytes) */
export const INSTANCE_BUFFER_ALIGNMENT = 256;

// ============================================================================
// Shader Configuration
// ============================================================================

/** Default vertex shader entry point */
export const DEFAULT_VERTEX_ENTRY = 'vs_main';

/** Default fragment shader entry point */
export const DEFAULT_FRAGMENT_ENTRY = 'fs_main';

/** Default compute shader entry point */
export const DEFAULT_COMPUTE_ENTRY = 'compute_main';

/** Maximum shader source size (1MB) - security limit */
export const MAX_SHADER_SOURCE_SIZE = 1024 * 1024;

/** Maximum bind group index (WebGPU spec limit) */
export const MAX_BIND_GROUP_INDEX = 3;

/** Maximum binding index per group (WebGPU spec limit) */
export const MAX_BINDING_INDEX = 15;

// ============================================================================
// Performance Targets
// ============================================================================

/** Target frame time for 60 FPS (milliseconds) */
export const TARGET_FRAME_TIME_MS = 16.67;

/** Critical frame time threshold (30 FPS) */
export const CRITICAL_FRAME_TIME_MS = 33.33;

/** Maximum draw calls per frame (performance target) */
export const MAX_DRAW_CALLS_PER_FRAME = 1000;

/** Maximum draw calls per frame (critical limit) */
export const CRITICAL_MAX_DRAW_CALLS = 2000;

/** Target bind group cache hit rate (95%) */
export const TARGET_CACHE_HIT_RATE = 0.95;

/** Minimum acceptable cache hit rate (80%) */
export const MIN_CACHE_HIT_RATE = 0.80;

/** Target buffer pool reuse rate */
export const TARGET_POOL_REUSE_RATE = 0.90;

// ============================================================================
// Render Queue Configuration
// ============================================================================

/** Initial capacity for opaque queue */
export const OPAQUE_QUEUE_INITIAL_CAPACITY = 1000;

/** Initial capacity for transparent queue */
export const TRANSPARENT_QUEUE_INITIAL_CAPACITY = 100;

/** Depth sorting precision (bits for depth in sort key) */
export const DEPTH_SORT_PRECISION_BITS = 20;

/** Material hash bits in sort key */
export const MATERIAL_HASH_BITS = 12;

// ============================================================================
// Shadow Mapping
// ============================================================================

/** Shadow cascade count options */
export const SHADOW_CASCADE_COUNTS = [2, 3, 4] as const;

/** Default shadow cascade split lambda (logarithmic distribution) */
export const SHADOW_CASCADE_SPLIT_LAMBDA = 0.5;

/** Shadow map resolution options */
export const SHADOW_MAP_RESOLUTIONS = [512, 1024, 2048, 4096] as const;

/** Default shadow map resolution */
export const DEFAULT_SHADOW_MAP_RESOLUTION = 1024;

// ============================================================================
// Texture Configuration
// ============================================================================

/** Maximum texture dimension (WebGPU limit) */
export const MAX_TEXTURE_DIMENSION = 8192;

/** Maximum mip levels for textures */
export const MAX_TEXTURE_MIP_LEVELS = 14;

/** Default texture format for color targets */
export const DEFAULT_COLOR_FORMAT: GPUTextureFormat = 'bgra8unorm';

/** Default depth format */
export const DEFAULT_DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';

// ============================================================================
// Validation & Debugging
// ============================================================================

/** Enable validation in development */
export const ENABLE_VALIDATION = process.env.NODE_ENV !== 'production';

/** Enable GPU timing queries */
export const ENABLE_GPU_TIMING = true;

/** Enable verbose logging */
export const ENABLE_VERBOSE_LOGGING = process.env.DEBUG === 'rendering';

/** Maximum errors to log before silencing */
export const MAX_ERROR_LOG_COUNT = 100;
```

**Acceptance Criteria:**
- [ ] HashUtils.ts with 3 hash functions consolidated
- [ ] RenderingConstants.ts with 50+ constants
- [ ] All magic numbers replaced with named constants
- [ ] All duplicate hash code removed
- [ ] JSDoc comments on all utilities
- [ ] Unit tests for hash functions
- [ ] No hardcoded numbers in main code

**Dependencies:** None

---

### Task 5.3: Split WebGPUBackend into Modules (16 hours)

**Deliverable:** 6 new files in `/packages/rendering/src/backends/webgpu/`

#### Module Structure:

```typescript
// 1. WebGPUBackend.ts (~300 lines) - Main coordinator
export class WebGPUBackend implements IRendererBackend {
  private resourceManager: WebGPUResourceManager;
  private pipelineManager: WebGPUPipelineManager;
  private commandEncoder: WebGPUCommandEncoder;
  private modernAPI: WebGPUModernAPI;
  private renderPassManager: WebGPURenderPassManager;

  constructor(config: WebGPUBackendConfig = {}) {
    // Dependency injection for testability
  }

  async initialize(config: BackendConfig): Promise<boolean> {
    // Delegate to resource manager
    return await this.resourceManager.initialize(config);
  }

  beginFrame(): void {
    this.commandEncoder.beginFrame();
  }

  endFrame(): RenderStats {
    const stats = this.commandEncoder.endFrame();
    return this.aggregateStats(stats);
  }

  executeDrawCommand(command: DrawCommand): void {
    this.commandEncoder.executeDrawCommand(command);
  }

  // Delegate all resource creation to managers
  createShader(id: string, source: string): BackendShaderHandle {
    return this.resourceManager.createShader(id, source);
  }

  createBuffer(...): BackendBufferHandle {
    return this.resourceManager.createBuffer(...);
  }

  // ... etc
}
```

```typescript
// 2. WebGPUResourceManager.ts (~400 lines) - Resource lifecycle
export class WebGPUResourceManager {
  private device: GPUDevice;
  private shaders = new Map<string, ShaderResource>();
  private buffers = new Map<string, BufferResource>();
  private textures = new Map<string, TextureResource>();
  private samplers = new Map<string, SamplerResource>();

  constructor(
    private bufferPool: GPUBufferPool,
    private shaderLoader: ShaderLoader
  ) {}

  async initialize(config: BackendConfig): Promise<boolean> {
    const adapter = await this.requestAdapter(config);
    if (!adapter) return false;

    this.device = await this.requestDevice(adapter, config);
    return true;
  }

  createShader(id: string, source: string): BackendShaderHandle {
    const module = this.device.createShaderModule({
      code: source,
      label: id
    });

    const reflection = this.parseShaderReflection(source);

    this.shaders.set(id, {
      module,
      reflection,
      source
    });

    return { id, type: 'shader' };
  }

  createBuffer(
    id: string,
    size: number,
    usage: BufferUsage,
    mode: 'static' | 'dynamic'
  ): BackendBufferHandle {
    // Use buffer pool for dynamic buffers
    const gpuBuffer = mode === 'dynamic'
      ? this.bufferPool.acquire(this.device, size, this.toGPUUsage(usage))
      : this.device.createBuffer({
          size,
          usage: this.toGPUUsage(usage),
          label: id
        });

    this.buffers.set(id, {
      gpuBuffer,
      size,
      usage,
      mode
    });

    return { id, type: 'buffer' };
  }

  destroyBuffer(handle: BackendBufferHandle): void {
    const buffer = this.buffers.get(handle.id);
    if (!buffer) return;

    if (buffer.mode === 'dynamic') {
      this.bufferPool.release(buffer.gpuBuffer);
    } else {
      buffer.gpuBuffer.destroy();
    }

    this.buffers.delete(handle.id);
  }

  // Similar for textures, samplers...

  getShader(id: string): ShaderResource | undefined {
    return this.shaders.get(id);
  }

  getBuffer(id: string): BufferResource | undefined {
    return this.buffers.get(id);
  }

  private async requestAdapter(config: BackendConfig): Promise<GPUAdapter | null> {
    if (!navigator.gpu) {
      console.error('WebGPU not supported');
      return null;
    }

    return await navigator.gpu.requestAdapter({
      powerPreference: config.powerPreference || 'high-performance'
    });
  }

  private async requestDevice(adapter: GPUAdapter, config: BackendConfig): Promise<GPUDevice> {
    return await adapter.requestDevice({
      label: 'Miskatonic Rendering Device',
      requiredFeatures: config.requiredFeatures || [],
      requiredLimits: config.requiredLimits || {}
    });
  }
}
```

```typescript
// 3. WebGPUPipelineManager.ts (~350 lines) - Pipeline caching and management
export class WebGPUPipelineManager {
  private device: GPUDevice;
  private pipelineCache = new Map<number, GPURenderPipeline>();
  private bindGroupLayoutCache = new Map<number, GPUBindGroupLayout>();
  private stats = {
    pipelineHits: 0,
    pipelineMisses: 0,
    layoutHits: 0,
    layoutMisses: 0
  };

  constructor(device: GPUDevice) {
    this.device = device;
  }

  createBindGroupLayout(descriptor: BindGroupLayoutDescriptor): BackendBindGroupLayoutHandle {
    const hash = HashUtils.hashBindGroupLayout(descriptor);

    let layout = this.bindGroupLayoutCache.get(hash);
    if (layout) {
      this.stats.layoutHits++;
      return { id: hash.toString(), type: 'bind_group_layout' };
    }

    layout = this.device.createBindGroupLayout({
      entries: descriptor.entries.map(this.toGPUBindGroupLayoutEntry)
    });

    this.bindGroupLayoutCache.set(hash, layout);
    this.stats.layoutMisses++;

    return { id: hash.toString(), type: 'bind_group_layout' };
  }

  createRenderPipeline(descriptor: RenderPipelineDescriptor): BackendPipelineHandle {
    const hash = this.computePipelineHash(descriptor);

    let pipeline = this.pipelineCache.get(hash);
    if (pipeline) {
      this.stats.pipelineHits++;
      return { id: hash.toString(), type: 'pipeline' };
    }

    // Get shader module
    const shader = this.resourceManager.getShader(descriptor.shader.id);
    if (!shader) {
      throw new Error(`Shader not found: ${descriptor.shader.id}`);
    }

    // Create pipeline
    pipeline = this.device.createRenderPipeline({
      layout: this.createPipelineLayout(descriptor.bindGroupLayouts),
      vertex: {
        module: shader.module,
        entryPoint: DEFAULT_VERTEX_ENTRY,
        buffers: descriptor.vertexLayouts.map(this.toGPUVertexBufferLayout)
      },
      fragment: {
        module: shader.module,
        entryPoint: DEFAULT_FRAGMENT_ENTRY,
        targets: [{ format: DEFAULT_COLOR_FORMAT }]
      },
      primitive: {
        topology: descriptor.pipelineState.topology || 'triangle-list',
        cullMode: descriptor.pipelineState.rasterization?.cullMode || 'back'
      },
      depthStencil: descriptor.pipelineState.depthStencil ? {
        format: DEFAULT_DEPTH_FORMAT,
        depthWriteEnabled: descriptor.pipelineState.depthStencil.depthWriteEnabled,
        depthCompare: descriptor.pipelineState.depthStencil.depthCompare
      } : undefined
    });

    this.pipelineCache.set(hash, pipeline);
    this.stats.pipelineMisses++;

    return { id: hash.toString(), type: 'pipeline' };
  }

  getPipeline(handle: BackendPipelineHandle): GPURenderPipeline | undefined {
    const hash = parseInt(handle.id);
    return this.pipelineCache.get(hash);
  }

  getBindGroupLayout(handle: BackendBindGroupLayoutHandle): GPUBindGroupLayout | undefined {
    const hash = parseInt(handle.id);
    return this.bindGroupLayoutCache.get(hash);
  }

  getStats() {
    return {
      ...this.stats,
      pipelineCacheHitRate: this.stats.pipelineHits / (this.stats.pipelineHits + this.stats.pipelineMisses),
      layoutCacheHitRate: this.stats.layoutHits / (this.stats.layoutHits + this.stats.layoutMisses)
    };
  }

  private computePipelineHash(descriptor: RenderPipelineDescriptor): number {
    const shaderHash = HashUtils.hash16Bit(descriptor.shader.id);
    const layoutHashes = descriptor.vertexLayouts.map(HashUtils.hashVertexLayout);
    const stateHash = this.hashPipelineState(descriptor.pipelineState);

    return HashUtils.combineHashes(shaderHash, ...layoutHashes, stateHash);
  }

  private hashPipelineState(state: PipelineStateDescriptor): number {
    const parts = [
      state.depthStencil?.depthCompare || 'none',
      state.depthStencil?.depthWriteEnabled ? '1' : '0',
      state.rasterization?.cullMode || 'none',
      state.blending?.enabled ? '1' : '0'
    ];
    return HashUtils.fnv1a(parts.join('_'));
  }
}
```

```typescript
// 4. WebGPUCommandEncoder.ts (~400 lines) - Draw command execution
export class WebGPUCommandEncoder {
  private device: GPUDevice;
  private currentEncoder?: GPUCommandEncoder;
  private currentPassEncoder?: GPURenderPassEncoder;
  private frameStats = {
    drawCalls: 0,
    triangles: 0,
    bufferUpdates: 0
  };

  constructor(
    private device: GPUDevice,
    private resourceManager: WebGPUResourceManager,
    private pipelineManager: WebGPUPipelineManager,
    private bindGroupPool: BindGroupPool
  ) {}

  beginFrame(): void {
    this.currentEncoder = this.device.createCommandEncoder();
    this.frameStats = { drawCalls: 0, triangles: 0, bufferUpdates: 0 };
  }

  endFrame(): RenderStats {
    if (this.currentPassEncoder) {
      this.currentPassEncoder.end();
      this.currentPassEncoder = undefined;
    }

    if (this.currentEncoder) {
      const commandBuffer = this.currentEncoder.finish();
      this.device.queue.submit([commandBuffer]);
      this.currentEncoder = undefined;
    }

    return this.frameStats;
  }

  executeDrawCommand(command: DrawCommand): void {
    if (!this.currentPassEncoder) {
      throw new Error('No active render pass');
    }

    // Get pipeline
    const pipeline = this.pipelineManager.getPipeline(command.pipeline);
    if (!pipeline) {
      throw new Error('Pipeline not found');
    }

    this.currentPassEncoder.setPipeline(pipeline);

    // Set bind groups
    for (const [slot, bindGroupHandle] of command.bindGroups) {
      const bindGroup = this.bindGroupPool.getBindGroup(bindGroupHandle);
      this.currentPassEncoder.setBindGroup(slot, bindGroup);
    }

    // Set geometry and draw
    this.executeGeometry(command.geometry);

    this.frameStats.drawCalls++;
  }

  private executeGeometry(geometry: DrawCommand['geometry']): void {
    switch (geometry.type) {
      case 'indexed':
        this.executeIndexedDraw(geometry);
        break;
      case 'nonIndexed':
        this.executeNonIndexedDraw(geometry);
        break;
      case 'indirect':
        this.executeIndirectDraw(geometry);
        break;
    }
  }

  private executeIndexedDraw(geometry: IndexedGeometry): void {
    // Set vertex buffers
    for (let i = 0; i < geometry.vertexBuffers.length; i++) {
      const buffer = this.resourceManager.getBuffer(geometry.vertexBuffers[i].id);
      this.currentPassEncoder!.setVertexBuffer(i, buffer!.gpuBuffer);
    }

    // Set index buffer
    const indexBuffer = this.resourceManager.getBuffer(geometry.indexBuffer.id);
    this.currentPassEncoder!.setIndexBuffer(
      indexBuffer!.gpuBuffer,
      geometry.indexFormat
    );

    // Draw
    this.currentPassEncoder!.drawIndexed(
      geometry.indexCount,
      geometry.instanceCount || 1,
      geometry.firstIndex || 0,
      geometry.baseVertex || 0,
      geometry.firstInstance || 0
    );

    this.frameStats.triangles += geometry.indexCount / 3;
  }
}
```

```typescript
// 5. WebGPUModernAPI.ts (~250 lines) - Epic 3.14 modern API
export class WebGPUModernAPI {
  constructor(
    private device: GPUDevice,
    private pipelineManager: WebGPUPipelineManager,
    private bindGroupPool: BindGroupPool
  ) {}

  createBindGroupLayout(descriptor: BindGroupLayoutDescriptor): BackendBindGroupLayoutHandle {
    return this.pipelineManager.createBindGroupLayout(descriptor);
  }

  createBindGroup(
    layout: BackendBindGroupLayoutHandle,
    resources: BindGroupResources
  ): BackendBindGroupHandle {
    const gpuLayout = this.pipelineManager.getBindGroupLayout(layout);
    if (!gpuLayout) {
      throw new Error('Bind group layout not found');
    }

    return this.bindGroupPool.acquire(gpuLayout, resources);
  }

  createRenderPipeline(descriptor: RenderPipelineDescriptor): BackendPipelineHandle {
    return this.pipelineManager.createRenderPipeline(descriptor);
  }

  createComputePipeline(descriptor: ComputePipelineDescriptor): BackendPipelineHandle {
    // Implementation...
  }
}
```

```typescript
// 6. WebGPURenderPassManager.ts (~250 lines) - Render pass management
export class WebGPURenderPassManager {
  private activePass?: GPURenderPassEncoder;
  private passStack: GPURenderPassEncoder[] = [];

  beginRenderPass(
    encoder: GPUCommandEncoder,
    descriptor: RenderPassDescriptor
  ): GPURenderPassEncoder {
    this.activePass = encoder.beginRenderPass({
      colorAttachments: descriptor.colorAttachments.map(att => ({
        view: att.view,
        loadOp: att.loadOp || 'clear',
        storeOp: att.storeOp || 'store',
        clearValue: att.clearValue || { r: 0, g: 0, b: 0, a: 1 }
      })),
      depthStencilAttachment: descriptor.depthStencilAttachment ? {
        view: descriptor.depthStencilAttachment.view,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        depthClearValue: 1.0
      } : undefined
    });

    this.passStack.push(this.activePass);
    return this.activePass;
  }

  endRenderPass(): void {
    if (this.activePass) {
      this.activePass.end();
      this.passStack.pop();
      this.activePass = this.passStack[this.passStack.length - 1];
    }
  }

  getActivePass(): GPURenderPassEncoder | undefined {
    return this.activePass;
  }
}
```

**Acceptance Criteria:**
- [ ] 6 separate module files created
- [ ] Each module <400 lines
- [ ] Clear responsibilities per module
- [ ] Dependency injection used
- [ ] All imports updated
- [ ] All tests pass
- [ ] No functionality lost
- [ ] Module exports through index.ts

**Dependencies:** Task 5.2 (needs HashUtils, RenderingConstants)

---

### Task 5.4: Refactor Long Methods (8 hours)

**Deliverable:** Split long methods into focused functions

#### Target Methods:

**WebGPUBackend.initialize() (107 lines → 4 methods):**
```typescript
// BEFORE: 107 line method
async initialize(config: BackendConfig): Promise<boolean> {
  // 30 lines of WebGPU support check
  // 25 lines of adapter request
  // 35 lines of device creation
  // 17 lines of context setup
}

// AFTER: 4 focused methods
async initialize(config: BackendConfig): Promise<boolean> {
  if (!await this.checkWebGPUSupport()) return false;
  if (!await this.requestAdapter(config)) return false;
  if (!await this.createDevice(config)) return false;
  await this.setupContext(config);
  return true;
}

private async checkWebGPUSupport(): Promise<boolean> {
  if (!navigator.gpu) {
    console.error('WebGPU not supported in this browser');
    return false;
  }
  return true;
}

private async requestAdapter(config: BackendConfig): Promise<boolean> {
  this.adapter = await navigator.gpu.requestAdapter({
    powerPreference: config.powerPreference || 'high-performance'
  });

  if (!this.adapter) {
    console.error('Failed to request WebGPU adapter');
    return false;
  }

  return true;
}

private async createDevice(config: BackendConfig): Promise<boolean> {
  try {
    this.device = await this.adapter!.requestDevice({
      label: 'Miskatonic Rendering Device',
      requiredFeatures: config.requiredFeatures || [],
      requiredLimits: config.requiredLimits || {}
    });

    this.device.lost.then((info) => {
      console.error('Device lost:', info.message, info.reason);
      this.handleDeviceLoss(info);
    });

    return true;
  } catch (error) {
    console.error('Failed to create WebGPU device:', error);
    return false;
  }
}

private async setupContext(config: BackendConfig): Promise<void> {
  this.context = config.canvas.getContext('webgpu');
  if (!this.context) {
    throw new Error('Failed to get WebGPU context');
  }

  const format = navigator.gpu.getPreferredCanvasFormat();
  this.context.configure({
    device: this.device!,
    format,
    alphaMode: 'premultiplied'
  });
}
```

**Similar refactoring for:**
- `executeDrawCommandInternal()` (213 lines → 6 methods)
- `createRenderPipeline()` (87 lines → 3 methods)
- `updateBuffer()` (62 lines → 2 methods)

**Acceptance Criteria:**
- [ ] No methods >50 lines
- [ ] Each method does one thing
- [ ] Clear method names
- [ ] Proper error handling maintained
- [ ] All tests pass
- [ ] Cyclomatic complexity <10 per method

**Dependencies:** Task 5.3

---

### Task 5.5: Update Imports and Tests (4 hours)

**Deliverable:** All imports updated, tests passing

**Changes:**
```typescript
// Before
import { WebGPUBackend } from '@miskatonic/rendering';

// After
import { WebGPUBackend } from '@miskatonic/rendering';
// Internal imports now reference sub-modules
import { HashUtils } from '@miskatonic/rendering/utils';
import { UNIFORM_BUFFER_ALIGNMENT } from '@miskatonic/rendering/constants';
```

**Test Updates:**
```typescript
// Mock the new module structure
jest.mock('@miskatonic/rendering/backends/webgpu/WebGPUResourceManager');
jest.mock('@miskatonic/rendering/backends/webgpu/WebGPUPipelineManager');
```

**Acceptance Criteria:**
- [ ] All imports resolve correctly
- [ ] No circular dependencies
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Test coverage maintained (>80%)
- [ ] No new warnings or errors

**Dependencies:** Task 5.3, Task 5.4

---

## Breaking Changes

### None (Internal Refactoring Only)

This epic is **internal refactoring** with no public API changes. The WebGPUBackend interface remains identical.

**Public API unchanged:**
```typescript
// Before and After - same interface
const backend = new WebGPUBackend();
await backend.initialize(config);
backend.createBuffer(...);
backend.executeDrawCommand(command);
```

## Testing Requirements

### Unit Tests
- [ ] HashUtils: All hash functions
- [ ] Module boundaries: Each module tested independently
- [ ] Resource lifecycle: Create/destroy paths
- [ ] Pipeline caching: Hit/miss scenarios

### Integration Tests
- [ ] Full rendering pipeline still works
- [ ] All demos render correctly
- [ ] Performance benchmarks pass
- [ ] Memory usage unchanged

### Regression Tests
- [ ] All existing tests still pass
- [ ] Visual output unchanged
- [ ] Performance metrics maintained

### Coverage Target
**>80% line coverage** maintained after refactoring

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Module load time | <10ms | <50ms |
| Memory overhead | +0% | +5% |
| Frame time | No change | +1% |
| Initialization | No change | +10% |

## Dependencies

### Blocks
- RENDERING-06 (needs modular structure)
- All future backend work (cleaner architecture)

### Blocked By
- None (can start immediately)

## Risks & Mitigation

### High Risk
**Breaking internal dependencies**
- *Mitigation:* Comprehensive test suite before refactoring
- *Mitigation:* Refactor one module at a time
- *Mitigation:* Feature flag for gradual rollout

### Medium Risk
**Circular dependencies between modules**
- *Mitigation:* Clear dependency graph designed first
- *Mitigation:* Use dependency injection
- *Mitigation:* Avoid cross-module state

### Low Risk
**Performance regression from module boundaries**
- *Mitigation:* Profile before/after
- *Mitigation:* Inline hot paths if needed
- *Mitigation:* Monitor bundle size

## Definition of Done

- [ ] All 5 tasks completed
- [ ] WebGPUBackend.ts split into 6 modules (<400 lines each)
- [ ] All dead code removed
- [ ] HashUtils.ts and RenderingConstants.ts created
- [ ] All magic numbers replaced with constants
- [ ] No methods >50 lines
- [ ] All tests passing with >80% coverage
- [ ] No performance regression
- [ ] All imports working
- [ ] Code reviewed and approved

---

*Epic created: November 2025*
*Priority: HIGH (Technical Debt)*
