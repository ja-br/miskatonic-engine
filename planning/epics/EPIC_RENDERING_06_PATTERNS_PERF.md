# EPIC: API Patterns & Performance Optimization

**Epic ID:** RENDERING-06
**Status:** Not Started
**Priority:** MEDIUM
**Depends On:** RENDERING-05 (Code Quality & Modularization)

## Objective

Implement ergonomic builder patterns for complex objects, add dependency injection for testability, and optimize hot paths for performance. Reduce string operations, implement lazy evaluation, and add resource caching to achieve 20% performance improvement in draw command execution.

## Success Criteria

- [x] VertexLayoutBuilder, PipelineBuilder, DrawCommandBuilder implemented
- [x] Dependency injection in RenderQueue and WebGPUBackend
- [x] Hot path optimization (executeDrawCommand 20% faster)
- [x] String operations reduced by 80% (numeric IDs)
- [x] Lazy evaluation for expensive computations
- [x] Resource cache hit rate >95%
- [x] Test coverage >80% with dependency injection mocks
- [x] No breaking changes to public API

## Current State

### Problems

#### 1. Verbose Object Construction
```typescript
// Current: 15+ lines to create vertex layout
const vertexLayout: GPUVertexBufferLayout = {
  arrayStride: 32,
  stepMode: 'vertex',
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' },
    { shaderLocation: 2, offset: 24, format: 'float32x2' }
  ]
};
```

#### 2. Difficult to Test (No Dependency Injection)
```typescript
// Current: Hard-coded dependencies
export class WebGPUBackend {
  private uniformPool = new UniformBufferPool(8192);
  private bufferPool = new GPUBufferPool();
  // Can't mock these for testing
}
```

#### 3. Performance Bottlenecks
- String concatenation in hot paths
- Repeated hash computation
- No resource caching in executeDrawCommand
- Material hash computed every frame
- JSON.stringify for cache keys

### Impact
- Verbose, error-prone code
- Difficult unit testing
- 20-30% performance overhead in hot paths
- Unnecessary CPU cycles for string operations

## Implementation Tasks

### Task 6.1: VertexLayoutBuilder (8 hours)

**Deliverable:** `/packages/rendering/src/builders/VertexLayoutBuilder.ts`

```typescript
/**
 * Fluent builder for vertex layouts.
 * Reduces 15+ lines of layout code to 5 lines with type safety.
 */
export class VertexLayoutBuilder {
  private attributes: GPUVertexAttribute[] = [];
  private stride = 0;
  private stepMode: GPUVertexStepMode = 'vertex';
  private autoOffset = true;

  /**
   * Add position attribute (float32x3)
   */
  position(location: number, offset?: number): this {
    return this.addAttribute(location, 'float32x3', offset, 12);
  }

  /**
   * Add normal attribute (float32x3)
   */
  normal(location: number, offset?: number): this {
    return this.addAttribute(location, 'float32x3', offset, 12);
  }

  /**
   * Add UV coordinate attribute (float32x2)
   */
  uv(location: number, offset?: number): this {
    return this.addAttribute(location, 'float32x2', offset, 8);
  }

  /**
   * Add color attribute (float32x4)
   */
  color(location: number, offset?: number): this {
    return this.addAttribute(location, 'float32x4', offset, 16);
  }

  /**
   * Add tangent attribute (float32x4)
   */
  tangent(location: number, offset?: number): this {
    return this.addAttribute(location, 'float32x4', offset, 16);
  }

  /**
   * Add custom attribute
   */
  custom(location: number, format: GPUVertexFormat, offset?: number): this {
    const size = this.getFormatSize(format);
    return this.addAttribute(location, format, offset, size);
  }

  /**
   * Add instance matrix (4x vec4) starting at location
   */
  instanceMatrix(startLocation: number): this {
    this.stepMode = 'instance';
    for (let i = 0; i < 4; i++) {
      this.addAttribute(startLocation + i, 'float32x4', undefined, 16);
    }
    return this;
  }

  /**
   * Add instance color
   */
  instanceColor(location: number): this {
    this.stepMode = 'instance';
    return this.addAttribute(location, 'float32x4', undefined, 16);
  }

  /**
   * Set step mode explicitly
   */
  setStepMode(mode: GPUVertexStepMode): this {
    this.stepMode = mode;
    return this;
  }

  /**
   * Disable automatic offset calculation
   */
  manualOffsets(): this {
    this.autoOffset = false;
    return this;
  }

  /**
   * Build final vertex buffer layout
   */
  build(): GPUVertexBufferLayout {
    if (this.attributes.length === 0) {
      throw new Error('No attributes added to vertex layout');
    }

    return {
      arrayStride: this.stride,
      stepMode: this.stepMode,
      attributes: this.attributes
    };
  }

  /**
   * Create common PBR vertex layout (position, normal, uv, tangent)
   */
  static PBR(startLocation = 0): VertexLayoutBuilder {
    return new VertexLayoutBuilder()
      .position(startLocation)
      .normal(startLocation + 1)
      .uv(startLocation + 2)
      .tangent(startLocation + 3);
  }

  /**
   * Create simple vertex layout (position, uv)
   */
  static Simple(startLocation = 0): VertexLayoutBuilder {
    return new VertexLayoutBuilder()
      .position(startLocation)
      .uv(startLocation + 1);
  }

  /**
   * Create colored vertex layout (position, color)
   */
  static Colored(startLocation = 0): VertexLayoutBuilder {
    return new VertexLayoutBuilder()
      .position(startLocation)
      .color(startLocation + 1);
  }

  // Private implementation
  private addAttribute(
    location: number,
    format: GPUVertexFormat,
    offset: number | undefined,
    size: number
  ): this {
    const actualOffset = offset ?? (this.autoOffset ? this.stride : 0);

    this.attributes.push({
      shaderLocation: location,
      offset: actualOffset,
      format
    });

    this.stride = Math.max(this.stride, actualOffset + size);

    return this;
  }

  private getFormatSize(format: GPUVertexFormat): number {
    const sizes: Record<string, number> = {
      'float32': 4,
      'float32x2': 8,
      'float32x3': 12,
      'float32x4': 16,
      'sint32': 4,
      'sint32x2': 8,
      'sint32x3': 12,
      'sint32x4': 16,
      'uint32': 4,
      'uint32x2': 8,
      'uint32x3': 12,
      'uint32x4': 16
    };
    return sizes[format] || 4;
  }
}
```

**Usage Example:**
```typescript
// Before (15 lines)
const layout: GPUVertexBufferLayout = {
  arrayStride: 32,
  stepMode: 'vertex',
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' },
    { shaderLocation: 2, offset: 24, format: 'float32x2' }
  ]
};

// After (2 lines)
const layout = VertexLayoutBuilder.PBR().build();
// or custom:
const layout = new VertexLayoutBuilder()
  .position(0)
  .normal(1)
  .uv(2)
  .tangent(3)
  .build();
```

**Acceptance Criteria:**
- [ ] VertexLayoutBuilder with fluent API
- [ ] position(), normal(), uv(), color(), tangent() helpers
- [ ] instanceMatrix() for instanced rendering
- [ ] Automatic offset calculation
- [ ] Static factory methods (PBR, Simple, Colored)
- [ ] Validation (no attributes = error)
- [ ] Unit tests for all methods
- [ ] JSDoc documentation

**Dependencies:** None

---

### Task 6.2: PipelineBuilder (12 hours)

**Deliverable:** `/packages/rendering/src/builders/PipelineBuilder.ts`

```typescript
/**
 * Fluent builder for render pipelines.
 * Simplifies pipeline creation with sensible defaults and validation.
 */
export class PipelineBuilder {
  private descriptor: Partial<GPURenderPipelineDescriptor> = {
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
      frontFace: 'ccw'
    }
  };

  private shaderModule?: GPUShaderModule;
  private vertexBuffers: GPUVertexBufferLayout[] = [];
  private bindGroupLayouts: GPUBindGroupLayout[] = [];

  /**
   * Set shader module
   */
  shader(module: GPUShaderModule, vertexEntry = 'vs_main', fragmentEntry = 'fs_main'): this {
    this.shaderModule = module;
    this.descriptor.vertex = {
      module,
      entryPoint: vertexEntry,
      buffers: []
    };
    this.descriptor.fragment = {
      module,
      entryPoint: fragmentEntry,
      targets: []
    };
    return this;
  }

  /**
   * Add vertex buffer layout
   */
  vertexLayout(layout: GPUVertexBufferLayout): this {
    this.vertexBuffers.push(layout);
    return this;
  }

  /**
   * Add bind group layout
   */
  bindGroupLayout(layout: GPUBindGroupLayout): this {
    this.bindGroupLayouts.push(layout);
    return this;
  }

  /**
   * Set color attachment format
   */
  colorFormat(format: GPUTextureFormat = 'bgra8unorm'): this {
    if (!this.descriptor.fragment) {
      throw new Error('Call shader() before colorFormat()');
    }
    this.descriptor.fragment.targets = [{ format }];
    return this;
  }

  /**
   * Enable depth testing
   */
  depthStencil(
    format: GPUTextureFormat = 'depth24plus',
    depthWrite = true,
    depthCompare: GPUCompareFunction = 'less'
  ): this {
    this.descriptor.depthStencil = {
      format,
      depthWriteEnabled: depthWrite,
      depthCompare
    };
    return this;
  }

  /**
   * Configure blending
   */
  blend(mode: 'opaque' | 'transparent' | 'additive' | 'premultiplied'): this {
    if (!this.descriptor.fragment?.targets?.[0]) {
      throw new Error('Call colorFormat() before blend()');
    }

    const target = this.descriptor.fragment.targets[0];

    switch (mode) {
      case 'transparent':
        target.blend = {
          color: {
            srcFactor: 'src-alpha',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add'
          },
          alpha: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add'
          }
        };
        break;

      case 'additive':
        target.blend = {
          color: {
            srcFactor: 'one',
            dstFactor: 'one',
            operation: 'add'
          },
          alpha: {
            srcFactor: 'one',
            dstFactor: 'one',
            operation: 'add'
          }
        };
        break;

      case 'premultiplied':
        target.blend = {
          color: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add'
          },
          alpha: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add'
          }
        };
        break;

      case 'opaque':
      default:
        target.blend = undefined;
        break;
    }

    return this;
  }

  /**
   * Set primitive topology
   */
  topology(topology: GPUPrimitiveTopology): this {
    this.descriptor.primitive!.topology = topology;
    return this;
  }

  /**
   * Set culling mode
   */
  cullMode(mode: GPUCullMode): this {
    this.descriptor.primitive!.cullMode = mode;
    return this;
  }

  /**
   * Enable alpha to coverage (MSAA required)
   */
  alphaToCoverage(enabled = true): this {
    this.descriptor.multisample = {
      count: 4,
      alphaToCoveragEnabled: enabled
    };
    return this;
  }

  /**
   * Set multisampling
   */
  multisample(count: number, alphaToCoverage = false): this {
    this.descriptor.multisample = {
      count,
      alphaToCoveragEnabled: alphaToCoverage
    };
    return this;
  }

  /**
   * Build the pipeline
   */
  build(device: GPUDevice): GPURenderPipeline {
    this.validate();

    // Set vertex buffers
    if (this.descriptor.vertex) {
      this.descriptor.vertex.buffers = this.vertexBuffers;
    }

    // Create pipeline layout
    if (this.bindGroupLayouts.length > 0) {
      this.descriptor.layout = device.createPipelineLayout({
        bindGroupLayouts: this.bindGroupLayouts
      });
    } else {
      this.descriptor.layout = 'auto';
    }

    return device.createRenderPipeline(this.descriptor as GPURenderPipelineDescriptor);
  }

  /**
   * Preset: Opaque rendering (default)
   */
  static Opaque(shader: GPUShaderModule, layout: GPUVertexBufferLayout): PipelineBuilder {
    return new PipelineBuilder()
      .shader(shader)
      .vertexLayout(layout)
      .colorFormat('bgra8unorm')
      .depthStencil('depth24plus', true, 'less')
      .cullMode('back');
  }

  /**
   * Preset: Transparent rendering
   */
  static Transparent(shader: GPUShaderModule, layout: GPUVertexBufferLayout): PipelineBuilder {
    return new PipelineBuilder()
      .shader(shader)
      .vertexLayout(layout)
      .colorFormat('bgra8unorm')
      .depthStencil('depth24plus', false, 'less') // No depth write!
      .cullMode('none')
      .blend('transparent');
  }

  /**
   * Preset: Additive blending (particles, lights)
   */
  static Additive(shader: GPUShaderModule, layout: GPUVertexBufferLayout): PipelineBuilder {
    return new PipelineBuilder()
      .shader(shader)
      .vertexLayout(layout)
      .colorFormat('bgra8unorm')
      .depthStencil('depth24plus', false, 'less')
      .cullMode('none')
      .blend('additive');
  }

  /**
   * Preset: Wireframe rendering
   */
  static Wireframe(shader: GPUShaderModule, layout: GPUVertexBufferLayout): PipelineBuilder {
    return new PipelineBuilder()
      .shader(shader)
      .vertexLayout(layout)
      .colorFormat('bgra8unorm')
      .depthStencil('depth24plus', true, 'less')
      .topology('line-list')
      .cullMode('none');
  }

  // Validation
  private validate(): void {
    if (!this.shaderModule) {
      throw new Error('Shader module not set. Call shader() first.');
    }
    if (!this.descriptor.vertex) {
      throw new Error('Vertex stage not configured. Call shader() first.');
    }
    if (!this.descriptor.fragment?.targets?.length) {
      throw new Error('No color targets. Call colorFormat() first.');
    }
    if (this.vertexBuffers.length === 0) {
      console.warn('No vertex layouts added. Did you forget vertexLayout()?');
    }
  }
}
```

**Usage Example:**
```typescript
// Before (30+ lines)
const pipeline = device.createRenderPipeline({
  layout: device.createPipelineLayout({
    bindGroupLayouts: [sceneLayout, materialLayout]
  }),
  vertex: {
    module: shaderModule,
    entryPoint: 'vs_main',
    buffers: [vertexLayout]
  },
  fragment: {
    module: shaderModule,
    entryPoint: 'fs_main',
    targets: [{
      format: 'bgra8unorm',
      blend: {
        color: {
          srcFactor: 'src-alpha',
          dstFactor: 'one-minus-src-alpha'
        },
        alpha: {
          srcFactor: 'one',
          dstFactor: 'one-minus-src-alpha'
        }
      }
    }]
  },
  primitive: {
    topology: 'triangle-list',
    cullMode: 'none'
  },
  depthStencil: {
    format: 'depth24plus',
    depthWriteEnabled: false,
    depthCompare: 'less'
  }
});

// After (7 lines)
const pipeline = PipelineBuilder.Transparent(shaderModule, vertexLayout)
  .bindGroupLayout(sceneLayout)
  .bindGroupLayout(materialLayout)
  .build(device);
```

**Acceptance Criteria:**
- [ ] PipelineBuilder with fluent API
- [ ] shader(), vertexLayout(), bindGroupLayout() configuration
- [ ] depthStencil(), blend(), cullMode() helpers
- [ ] Static presets (Opaque, Transparent, Additive, Wireframe)
- [ ] Validation before build
- [ ] Helpful error messages
- [ ] Unit tests for all methods
- [ ] JSDoc documentation

**Dependencies:** None

---

### Task 6.3: Enhanced DrawCommandBuilder (8 hours)

**Deliverable:** Update `/packages/rendering/src/commands/DrawCommandBuilder.ts`

```typescript
/**
 * Enhanced DrawCommandBuilder with additional ergonomics
 */
export class DrawCommandBuilder {
  private command: Partial<DrawCommand> = {
    bindGroups: new Map()
  };

  /**
   * Set pipeline
   */
  pipeline(handle: BackendPipelineHandle): this {
    this.command.pipeline = handle;
    return this;
  }

  /**
   * Add bind group at slot
   */
  bindGroup(slot: number, handle: BackendBindGroupHandle): this {
    this.command.bindGroups!.set(slot, handle);
    return this;
  }

  /**
   * Add multiple bind groups
   */
  bindGroups(groups: Map<number, BackendBindGroupHandle>): this {
    for (const [slot, handle] of groups) {
      this.command.bindGroups!.set(slot, handle);
    }
    return this;
  }

  /**
   * Configure indexed geometry
   */
  indexed(
    vertexBuffers: BackendBufferHandle[],
    indexBuffer: BackendBufferHandle,
    indexFormat: 'uint16' | 'uint32',
    indexCount: number,
    options?: {
      instanceCount?: number;
      firstIndex?: number;
      baseVertex?: number;
      firstInstance?: number;
    }
  ): this {
    this.command.geometry = {
      type: 'indexed',
      vertexBuffers,
      indexBuffer,
      indexFormat,
      indexCount,
      ...options
    };
    return this;
  }

  /**
   * Configure non-indexed geometry
   */
  nonIndexed(
    vertexBuffers: BackendBufferHandle[],
    vertexCount: number,
    options?: {
      instanceCount?: number;
      firstVertex?: number;
      firstInstance?: number;
    }
  ): this {
    this.command.geometry = {
      type: 'nonIndexed',
      vertexBuffers,
      vertexCount,
      ...options
    };
    return this;
  }

  /**
   * Configure indirect drawing
   */
  indirect(
    vertexBuffers: BackendBufferHandle[],
    indirectBuffer: BackendBufferHandle,
    indirectOffset: number,
    indexBuffer?: BackendBufferHandle
  ): this {
    this.command.geometry = {
      type: 'indirect',
      vertexBuffers,
      indirectBuffer,
      indirectOffset,
      indexBuffer
    };
    return this;
  }

  /**
   * Set debug label
   */
  label(label: string): this {
    this.command.label = label;
    return this;
  }

  /**
   * Add debug info
   */
  debugInfo(info: DrawDebugInfo): this {
    this.command.debugInfo = info;
    return this;
  }

  /**
   * Build final draw command
   */
  build(): DrawCommand {
    if (!this.command.pipeline) {
      throw new Error('Pipeline is required');
    }
    if (!this.command.geometry) {
      throw new Error('Geometry is required');
    }
    if (this.command.bindGroups!.size === 0) {
      console.warn('No bind groups added. Did you forget bindGroup()?');
    }

    return this.command as DrawCommand;
  }

  /**
   * Quick builder for simple indexed draw
   */
  static quickIndexed(
    pipeline: BackendPipelineHandle,
    bindGroup: BackendBindGroupHandle,
    vertexBuffer: BackendBufferHandle,
    indexBuffer: BackendBufferHandle,
    indexCount: number
  ): DrawCommand {
    return new DrawCommandBuilder()
      .pipeline(pipeline)
      .bindGroup(0, bindGroup)
      .indexed([vertexBuffer], indexBuffer, 'uint16', indexCount)
      .build();
  }

  /**
   * Quick builder for simple non-indexed draw
   */
  static quickNonIndexed(
    pipeline: BackendPipelineHandle,
    bindGroup: BackendBindGroupHandle,
    vertexBuffer: BackendBufferHandle,
    vertexCount: number
  ): DrawCommand {
    return new DrawCommandBuilder()
      .pipeline(pipeline)
      .bindGroup(0, bindGroup)
      .nonIndexed([vertexBuffer], vertexCount)
      .build();
  }
}
```

**Acceptance Criteria:**
- [ ] Enhanced with additional helpers
- [ ] bindGroups() for batch adding
- [ ] Options objects for optional parameters
- [ ] Quick builders for common cases
- [ ] Validation with helpful warnings
- [ ] Unit tests for all methods

**Dependencies:** RENDERING-01

---

### Task 6.4: Dependency Injection (8 hours)

**Deliverable:** Update constructors for RenderQueue and WebGPUBackend

#### RenderQueue with DI:

```typescript
export interface RenderQueueDependencies {
  instanceDetectorFactory?: () => InstanceDetector;
  materialHasher?: MaterialHasher;
  sortKeyGenerator?: SortKeyGenerator;
}

export class RenderQueue {
  private opaqueDetector: InstanceDetector;
  private transparentDetector: InstanceDetector;
  private materialHasher: MaterialHasher;
  private sortKeyGenerator: SortKeyGenerator;

  constructor(
    config: RenderQueueConfig = {},
    dependencies: RenderQueueDependencies = {}
  ) {
    // Use injected dependencies or defaults
    const detectorFactory = dependencies.instanceDetectorFactory ||
      (() => new InstanceDetector(config.instanceConfig));

    this.opaqueDetector = detectorFactory();
    this.transparentDetector = detectorFactory();
    this.materialHasher = dependencies.materialHasher || new MaterialHasher();
    this.sortKeyGenerator = dependencies.sortKeyGenerator || new SortKeyGenerator();
  }

  // ... rest of implementation
}
```

#### WebGPUBackend with DI:

```typescript
export interface WebGPUBackendDependencies {
  uniformPool?: UniformBufferPool;
  bufferPool?: GPUBufferPool;
  bindGroupPool?: BindGroupPool;
  resourceManager?: WebGPUResourceManager;
  pipelineManager?: WebGPUPipelineManager;
}

export class WebGPUBackend implements IRendererBackend {
  private uniformPool: UniformBufferPool;
  private bufferPool: GPUBufferPool;
  private bindGroupPool: BindGroupPool;
  private resourceManager: WebGPUResourceManager;
  private pipelineManager: WebGPUPipelineManager;

  constructor(
    config: WebGPUBackendConfig = {},
    dependencies: WebGPUBackendDependencies = {}
  ) {
    // Use injected dependencies or create defaults
    this.uniformPool = dependencies.uniformPool ||
      new UniformBufferPool(config.uniformPoolSize || DEFAULT_UNIFORM_POOL_SIZE);

    this.bufferPool = dependencies.bufferPool ||
      new GPUBufferPool();

    this.bindGroupPool = dependencies.bindGroupPool ||
      new BindGroupPool();

    // Managers can be injected for testing
    if (dependencies.resourceManager) {
      this.resourceManager = dependencies.resourceManager;
    }

    if (dependencies.pipelineManager) {
      this.pipelineManager = dependencies.pipelineManager;
    }
  }

  // ... rest of implementation
}
```

#### Test Example:

```typescript
// Unit test with mocks
describe('WebGPUBackend', () => {
  it('should execute draw command', () => {
    const mockResourceManager = new MockResourceManager();
    const mockPipelineManager = new MockPipelineManager();

    const backend = new WebGPUBackend({}, {
      resourceManager: mockResourceManager,
      pipelineManager: mockPipelineManager
    });

    // Test with mocks
    backend.executeDrawCommand(command);

    expect(mockResourceManager.getShader).toHaveBeenCalled();
    expect(mockPipelineManager.getPipeline).toHaveBeenCalled();
  });
});
```

**Acceptance Criteria:**
- [ ] RenderQueue accepts dependency injection
- [ ] WebGPUBackend accepts dependency injection
- [ ] Backward compatible (defaults work without DI)
- [ ] Clear interfaces for dependencies
- [ ] Mock implementations for testing
- [ ] All tests updated to use mocks
- [ ] Documentation on testing with DI

**Dependencies:** RENDERING-05 (needs modular structure)

---

### Task 6.5: Hot Path Optimization (8 hours)

**Deliverable:** Optimized executeDrawCommand with caching

```typescript
interface CachedDrawResources {
  pipeline: GPURenderPipeline;
  bindGroups: GPUBindGroup[];
  vertexBuffers: GPUBuffer[];
  indexBuffer?: GPUBuffer;
  cacheKey: number;
}

export class WebGPUCommandEncoder {
  private resourceCache = new Map<number, CachedDrawResources>();
  private cacheHits = 0;
  private cacheMisses = 0;

  /**
   * Optimized draw command execution with resource caching
   */
  executeDrawCommand(command: DrawCommand): void {
    // Generate cache key from command
    const cacheKey = this.computeResourceCacheKey(command);

    // Check cache first
    let resources = this.resourceCache.get(cacheKey);

    if (!resources) {
      // Cache miss - prepare resources
      resources = this.prepareDrawResources(command);
      resources.cacheKey = cacheKey;
      this.resourceCache.set(cacheKey, resources);
      this.cacheMisses++;
    } else {
      this.cacheHits++;
    }

    // Execute with cached resources
    this.executeWithCachedResources(resources, command.geometry);
  }

  /**
   * Compute numeric cache key (fast)
   */
  private computeResourceCacheKey(command: DrawCommand): number {
    // Use numeric IDs instead of string concatenation
    const pipelineId = parseInt(command.pipeline.id);
    const bindGroupIds = Array.from(command.bindGroups.values())
      .map(bg => parseInt(bg.id));

    return HashUtils.combineHashes(pipelineId, ...bindGroupIds);
  }

  /**
   * Prepare resources (cold path)
   */
  private prepareDrawResources(command: DrawCommand): CachedDrawResources {
    const pipeline = this.pipelineManager.getPipeline(command.pipeline);
    if (!pipeline) {
      throw new Error('Pipeline not found');
    }

    const bindGroups: GPUBindGroup[] = [];
    for (const [slot, handle] of command.bindGroups) {
      const bindGroup = this.bindGroupPool.getBindGroup(handle);
      bindGroups[slot] = bindGroup;
    }

    const vertexBuffers: GPUBuffer[] = [];
    if (command.geometry.type === 'indexed' || command.geometry.type === 'nonIndexed') {
      for (const handle of command.geometry.vertexBuffers) {
        const buffer = this.resourceManager.getBuffer(handle.id);
        vertexBuffers.push(buffer!.gpuBuffer);
      }
    }

    let indexBuffer: GPUBuffer | undefined;
    if (command.geometry.type === 'indexed') {
      const buffer = this.resourceManager.getBuffer(command.geometry.indexBuffer.id);
      indexBuffer = buffer!.gpuBuffer;
    }

    return {
      pipeline,
      bindGroups,
      vertexBuffers,
      indexBuffer,
      cacheKey: 0 // Will be set by caller
    };
  }

  /**
   * Execute with cached resources (hot path)
   */
  private executeWithCachedResources(
    resources: CachedDrawResources,
    geometry: DrawCommand['geometry']
  ): void {
    const pass = this.currentPassEncoder!;

    // Set pipeline
    pass.setPipeline(resources.pipeline);

    // Set bind groups
    for (let i = 0; i < resources.bindGroups.length; i++) {
      if (resources.bindGroups[i]) {
        pass.setBindGroup(i, resources.bindGroups[i]);
      }
    }

    // Set vertex buffers
    for (let i = 0; i < resources.vertexBuffers.length; i++) {
      pass.setVertexBuffer(i, resources.vertexBuffers[i]);
    }

    // Execute geometry
    switch (geometry.type) {
      case 'indexed':
        pass.setIndexBuffer(resources.indexBuffer!, geometry.indexFormat);
        pass.drawIndexed(
          geometry.indexCount,
          geometry.instanceCount || 1,
          geometry.firstIndex || 0,
          geometry.baseVertex || 0,
          geometry.firstInstance || 0
        );
        break;

      case 'nonIndexed':
        pass.draw(
          geometry.vertexCount,
          geometry.instanceCount || 1,
          geometry.firstVertex || 0,
          geometry.firstInstance || 0
        );
        break;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses),
      size: this.resourceCache.size
    };
  }

  /**
   * Clear resource cache (call at end of frame)
   */
  clearResourceCache(): void {
    this.resourceCache.clear();
  }
}
```

**Acceptance Criteria:**
- [ ] Resource cache for executeDrawCommand
- [ ] Numeric cache keys (no string operations)
- [ ] Cache hit rate >95%
- [ ] 20% performance improvement measured
- [ ] Cache cleared each frame
- [ ] Stats tracking for monitoring
- [ ] Benchmark tests prove improvement

**Dependencies:** RENDERING-05 (needs modular structure)

---

### Task 6.6: String Operation Reduction (4 hours)

**Deliverable:** Replace string keys with numeric IDs throughout

```typescript
// Before: String keys everywhere
const key = `${shader.id}_${JSON.stringify(layout)}`;
this.pipelineCache.set(key, pipeline);

// After: Numeric hashing
const key = HashUtils.combineHashes(
  shader.numericId,
  HashUtils.hashVertexLayout(layout)
);
this.pipelineCache.set(key, pipeline);
```

**Changes:**
- Add numeric ID generation for all resources
- Replace string concatenation with HashUtils
- Use numeric Map keys where possible
- Profile before/after to measure improvement

**Acceptance Criteria:**
- [ ] All resource handles have numeric IDs
- [ ] String concatenation reduced by 80%
- [ ] JSON.stringify eliminated from hot paths
- [ ] Performance improvement measured
- [ ] No functionality lost

**Dependencies:** RENDERING-05 (needs HashUtils)

---

## Breaking Changes

### Minimal (Opt-in Builders)

**New APIs (additive):**
- `VertexLayoutBuilder` - optional, ergonomic alternative
- `PipelineBuilder` - optional, ergonomic alternative
- `DrawCommandBuilder` - enhanced, backward compatible

**Constructor Changes:**
- `WebGPUBackend(config, dependencies?)` - dependencies optional
- `RenderQueue(config, dependencies?)` - dependencies optional

**Migration:**
```typescript
// Old (still works)
const backend = new WebGPUBackend(config);

// New (with DI for testing)
const backend = new WebGPUBackend(config, {
  uniformPool: mockPool,
  bufferPool: mockPool
});
```

## Testing Requirements

### Unit Tests
- [ ] VertexLayoutBuilder: All methods
- [ ] PipelineBuilder: All methods, presets
- [ ] DrawCommandBuilder: Enhanced methods
- [ ] Dependency injection: Mock-based tests
- [ ] Resource caching: Hit/miss scenarios
- [ ] Hash utilities: Numeric ID generation

### Integration Tests
- [ ] Builders create valid WebGPU objects
- [ ] DI doesn't break existing code
- [ ] Resource cache improves performance
- [ ] Numeric IDs work correctly

### Performance Tests
- [ ] executeDrawCommand: 20% improvement
- [ ] String operations: 80% reduction
- [ ] Cache hit rate: >95%
- [ ] Frame time: No regression

### Coverage Target
**>80% line coverage** for all new code

## Performance Targets

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| executeDrawCommand time | 100% | 80% | 20% faster |
| String operations count | 100% | 20% | 80% reduction |
| Resource cache hit rate | 0% | 95%+ | >90% |
| Hash computation time | 100% | 30% | 70% faster |

## Dependencies

### Blocks
- None (improves existing code)

### Blocked By
- **RENDERING-05** (needs modular structure, HashUtils)

## Risks & Mitigation

### Medium Risk
**Resource cache memory usage**
- *Mitigation:* Clear cache each frame
- *Mitigation:* Add LRU eviction if needed
- *Mitigation:* Monitor memory usage

**Builder pattern adoption**
- *Mitigation:* Optional, backward compatible
- *Mitigation:* Clear examples and documentation
- *Mitigation:* Gradual migration strategy

### Low Risk
**Numeric ID collisions**
- *Mitigation:* Use good hash functions
- *Mitigation:* Test with large number of resources
- *Mitigation:* Add collision detection in dev mode

## Definition of Done

- [ ] All 6 tasks completed
- [ ] VertexLayoutBuilder, PipelineBuilder implemented
- [ ] Enhanced DrawCommandBuilder
- [ ] Dependency injection in RenderQueue, WebGPUBackend
- [ ] Resource caching with >95% hit rate
- [ ] String operations reduced by 80%
- [ ] 20% performance improvement measured
- [ ] All tests passing with >80% coverage
- [ ] Backward compatibility maintained
- [ ] Documentation and examples complete
- [ ] Code reviewed and approved

---

*Epic created: November 2025*
*Priority: MEDIUM*
