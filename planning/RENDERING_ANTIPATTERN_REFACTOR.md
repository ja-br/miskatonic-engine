# Rendering Engine Anti-Pattern Refactoring Plan

## Executive Summary

Complete refactoring of the Miskatonic rendering engine to eliminate identified anti-patterns, reduce API complexity, and improve developer experience while maintaining the high-performance characteristics of the WebGPU-only implementation.

## Current State Analysis

### Critical Anti-Patterns Identified

#### 1. Multiple Command Types Anti-Pattern
**Problem:** Three overlapping command interfaces causing confusion
- `DrawCommand` - Legacy command with shader ID + uniforms Map
- `NewDrawCommand` - Epic 3.14 with bind groups and pipelines
- `ModernDrawCommand` - Backend-specific variant

**Impact:**
- 39 instances of `as any` casts to bypass type errors
- Confusing API surface for developers
- Risk of using wrong command type
- Duplicate code paths in backend

#### 2. Regex Shader Parsing Anti-Pattern
**Problem:** Fragile WGSL parsing using regex instead of proper parser
```typescript
const bindGroupRegex = /@group\((\d+)\)\s+@binding\((\d+)\)\s+var(?:<([^>]+)>)?\s+(\w+)\s*:\s*([^;]+);/g;
```

**Issues:**
- Fails with whitespace variations, comments, multi-line declarations
- Can't handle complex WGSL syntax
- No validation until runtime
- Security concerns (mitigated with 1MB limit)

#### 3. Manual Resource Management Anti-Pattern
**Problem:** Excessive boilerplate for basic operations
- No Material abstraction
- Manual bind group creation every frame
- Verbose pipeline state configuration
- 7+ steps required to draw a simple textured cube

#### 4. Performance Bottlenecks
- Bind group creation per frame despite caching
- No pipeline state sorting in render queue
- Missing persistent bind group pools

## Goals & Success Metrics

### Primary Goals
1. **Consolidate draw command interfaces into single ModernDrawCommand**
   - Eliminate all 3 overlapping types
   - Remove 39 `as any` casts
   - Type-safe, unified API

2. **Implement persistent bind group pools**
   - Reduce per-frame allocations
   - Improve cache hit rate from 70% to 95%+
   - Minimize GPU state changes

3. **Create high-level API wrapper for common operations**
   - Reduce setup from 30+ lines to 5 lines for textured cube
   - Hide WebGPU complexity for typical use cases
   - Maintain access to low-level API for advanced users

### Secondary Goals
- Replace regex shader parsing with robust WGSL parser
- Implement automatic device loss recovery
- Add intuitive pipeline state management
- Create Material/Mesh/RenderObject abstractions

### Success Metrics
- **Developer Experience:** 30+ lines → 5 lines for common operations
- **Type Safety:** 39 `as any` casts → 0
- **Performance:** Bind group cache hit rate 70% → 95%+
- **Robustness:** Handle all valid WGSL syntax variations
- **API Surface:** 3 command types → 1 unified type

## Implementation Plan

### Phase 1: Core API Consolidation (Week 1, 20 hours)

#### 1.1 Unified DrawCommand (12 hours)

**Goal:** Single, type-safe command interface

```typescript
// packages/rendering/src/commands/DrawCommand.ts
export interface DrawCommand {
  // Core (required)
  pipeline: BackendPipelineHandle;
  bindGroups: Map<number, BackendBindGroupHandle>;

  // Geometry (discriminated union)
  geometry: IndexedGeometry | NonIndexedGeometry | IndirectGeometry;

  // Optional
  label?: string;
  debugInfo?: DrawDebugInfo;
}

export interface IndexedGeometry {
  type: 'indexed';
  vertexBuffers: BackendBufferHandle[];
  indexBuffer: BackendBufferHandle;
  indexFormat: 'uint16' | 'uint32';
  indexCount: number;
  instanceCount?: number;
  firstIndex?: number;
  baseVertex?: number;
}

// Builder pattern for ergonomics
export class DrawCommandBuilder {
  static indexed(): IndexedDrawCommandBuilder { ... }
  static nonIndexed(): NonIndexedDrawCommandBuilder { ... }
  static compute(): ComputeDrawCommandBuilder { ... }
}
```

**Tasks:**
- [ ] Define unified `DrawCommand` interface with discriminated unions
- [ ] Implement builder pattern for type-safe construction
- [ ] Create migration utilities from old types
- [ ] Update `IRendererBackend` interface
- [ ] Update `WebGPUBackend` implementation
- [ ] Update all call sites in demos and tests
- [ ] Delete old command types

**Breaking Changes:**
- Remove `DrawCommand` from types.ts
- Remove `NewDrawCommand.ts`
- Remove `ModernDrawCommand` from IRendererBackend.ts
- Update all executeCommands() signatures

#### 1.2 Persistent Bind Group Pools (8 hours)

**Goal:** Eliminate per-frame bind group creation

```typescript
// packages/rendering/src/pools/BindGroupPool.ts
export class BindGroupPool {
  private pools = new Map<string, BindGroupPoolEntry[]>();
  private activeBindGroups = new WeakSet<GPUBindGroup>();

  acquire(
    layout: BackendBindGroupLayoutHandle,
    resources: BindGroupResources,
    cacheKey?: string
  ): BackendBindGroupHandle {
    const key = cacheKey ?? this.generateCacheKey(layout, resources);

    // Check persistent pool first
    const pool = this.pools.get(key) ?? [];
    const available = pool.find(entry => !this.activeBindGroups.has(entry.bindGroup));

    if (available) {
      this.activeBindGroups.add(available.bindGroup);
      this.stats.poolHits++;
      return available.handle;
    }

    // Create new bind group
    const bindGroup = this.createBindGroup(layout, resources);
    pool.push({ bindGroup, handle, lastUsed: Date.now() });
    this.pools.set(key, pool);

    return handle;
  }

  release(handle: BackendBindGroupHandle): void {
    // Mark as available for reuse
    const entry = this.findEntry(handle);
    if (entry) {
      this.activeBindGroups.delete(entry.bindGroup);
    }
  }

  // Periodic cleanup of unused bind groups
  cleanup(maxAge: number = 5000): void {
    const now = Date.now();
    for (const [key, pool] of this.pools) {
      const active = pool.filter(entry =>
        this.activeBindGroups.has(entry.bindGroup) ||
        now - entry.lastUsed < maxAge
      );

      if (active.length === 0) {
        this.pools.delete(key);
      } else {
        this.pools.set(key, active);
      }
    }
  }
}
```

**Tasks:**
- [ ] Design BindGroupPool interface
- [ ] Implement persistent pooling with WeakSet tracking
- [ ] Add LRU eviction for memory management
- [ ] Integrate with WebGPUBackend
- [ ] Add performance metrics and monitoring
- [ ] Create cleanup strategy for unused bind groups
- [ ] Write comprehensive tests

**Expected Impact:**
- Bind group cache hit rate: 70% → 95%+
- Reduce per-frame allocations by 80%
- Eliminate bind group creation stutters

### Phase 2: High-Level API Wrapper (Week 2, 32 hours)

#### 2.1 Material System (16 hours)

**Goal:** Simple material API hiding bind group complexity

```typescript
// packages/rendering/src/highlevel/Material.ts
export class Material {
  private pipeline: BackendPipelineHandle;
  private bindGroups: Map<number, BackendBindGroupHandle>;
  private uniformBuffers: Map<string, BackendBufferHandle>;
  private dirty = new Set<string>();

  constructor(
    private renderer: HighLevelRenderer,
    private config: MaterialConfig
  ) {
    this.initialize();
  }

  // Simple uniform setting
  setUniform(name: string, value: any): void {
    this.uniformData.set(name, value);
    this.dirty.add(name);
  }

  setTexture(slot: string, texture: Texture): void {
    this.textures.set(slot, texture);
    this.dirty.add('textures');
  }

  // Auto-update before draw
  prepare(): DrawCommand {
    if (this.dirty.size > 0) {
      this.updateBindGroups();
      this.dirty.clear();
    }

    return {
      pipeline: this.pipeline,
      bindGroups: this.bindGroups,
      // Geometry added by Mesh
    };
  }

  // Presets for common materials
  static PBR(renderer: HighLevelRenderer, textures: PBRTextures): Material {
    return new Material(renderer, {
      shader: 'pbr',
      textures,
      uniforms: { metallic: 0.5, roughness: 0.5 }
    });
  }

  static Unlit(renderer: HighLevelRenderer, color: Color): Material {
    return new Material(renderer, {
      shader: 'unlit',
      uniforms: { color }
    });
  }
}
```

**Tasks:**
- [ ] Define Material interface and config
- [ ] Implement automatic shader compilation
- [ ] Add uniform buffer management with dirty tracking
- [ ] Implement texture slot management
- [ ] Create bind group auto-generation
- [ ] Add common material presets (PBR, Unlit, Toon, etc.)
- [ ] Write usage examples and tests

#### 2.2 Mesh Abstraction (8 hours)

**Goal:** Simplified geometry management

```typescript
// packages/rendering/src/highlevel/Mesh.ts
export class Mesh {
  private vertexBuffers: BackendBufferHandle[];
  private indexBuffer?: BackendBufferHandle;
  private vertexCount: number;
  private indexCount?: number;
  private bounds: BoundingBox;

  static fromGeometry(
    renderer: HighLevelRenderer,
    geometry: GeometryData
  ): Mesh {
    const vertexBuffer = renderer.createBuffer({
      type: 'vertex',
      data: geometry.vertices,
      usage: 'static'
    });

    const indexBuffer = geometry.indices ?
      renderer.createBuffer({
        type: 'index',
        data: geometry.indices,
        usage: 'static'
      }) : undefined;

    return new Mesh({
      vertexBuffers: [vertexBuffer],
      indexBuffer,
      vertexCount: geometry.vertexCount,
      indexCount: geometry.indices?.length,
      bounds: geometry.bounds
    });
  }

  // Primitives
  static Cube(renderer: HighLevelRenderer, size = 1): Mesh {
    return Mesh.fromGeometry(renderer, createCube(size));
  }

  static Sphere(renderer: HighLevelRenderer, radius = 1, segments = 32): Mesh {
    return Mesh.fromGeometry(renderer, createSphere(radius, segments));
  }

  // Add to draw command
  applyToCommand(command: Partial<DrawCommand>): void {
    command.geometry = this.indexBuffer ? {
      type: 'indexed',
      vertexBuffers: this.vertexBuffers,
      indexBuffer: this.indexBuffer,
      indexFormat: 'uint16', // Auto-detect
      indexCount: this.indexCount!
    } : {
      type: 'nonIndexed',
      vertexBuffers: this.vertexBuffers,
      vertexCount: this.vertexCount
    };
  }
}
```

**Tasks:**
- [ ] Define Mesh interface
- [ ] Implement fromGeometry factory
- [ ] Add primitive generators (cube, sphere, plane, etc.)
- [ ] Implement vertex layout auto-detection
- [ ] Add bounding box calculation
- [ ] Create LOD support structure
- [ ] Write tests

#### 2.3 High-Level Renderer (8 hours)

**Goal:** Simple API for common rendering operations

```typescript
// packages/rendering/src/highlevel/HighLevelRenderer.ts
export class HighLevelRenderer {
  private backend: IRendererBackend;
  private bindGroupPool: BindGroupPool;
  private materials = new Map<string, Material>();
  private meshes = new Map<string, Mesh>();
  private renderQueue: RenderQueue;

  constructor(canvas: HTMLCanvasElement, config?: HighLevelConfig) {
    this.backend = new WebGPUBackend();
    this.bindGroupPool = new BindGroupPool();
    this.renderQueue = new RenderQueue();
  }

  // Resource creation helpers
  createMaterial(config: MaterialConfig): Material {
    return new Material(this, config);
  }

  createMesh(geometry: GeometryData): Mesh {
    return Mesh.fromGeometry(this, geometry);
  }

  // Simple draw call
  draw(mesh: Mesh, material: Material, transform: mat4): void {
    const command = material.prepare();
    mesh.applyToCommand(command);

    this.renderQueue.submit({
      drawCommand: command,
      materialId: material.id,
      worldMatrix: transform,
      depth: this.calculateDepth(transform)
    });
  }

  // Batch drawing
  drawInstanced(
    mesh: Mesh,
    material: Material,
    transforms: mat4[]
  ): void {
    // Auto-detect instancing opportunity
    const instanceBuffer = this.createInstanceBuffer(transforms);
    const command = material.prepare();
    mesh.applyToCommand(command);
    command.geometry.instanceCount = transforms.length;
    command.geometry.instanceBuffer = instanceBuffer;

    this.backend.executeDrawCommand(command);
  }

  // Frame management
  beginFrame(): void {
    this.backend.beginFrame();
    this.bindGroupPool.beginFrame();
  }

  endFrame(): RenderStats {
    this.renderQueue.sort();
    this.renderQueue.detectInstances();

    // Execute sorted commands
    for (const cmd of this.renderQueue.getSortedCommands()) {
      this.backend.executeDrawCommand(cmd);
    }

    const stats = this.backend.endFrame();
    this.bindGroupPool.cleanup();
    this.renderQueue.clear();

    return stats;
  }
}
```

**Tasks:**
- [ ] Design HighLevelRenderer interface
- [ ] Implement resource management layer
- [ ] Add automatic sorting and instancing
- [ ] Create simple draw() API
- [ ] Implement drawInstanced() helper
- [ ] Add scene graph support (future)
- [ ] Write comprehensive examples

### Phase 3: Parser & Pipeline Improvements (Week 3, 24 hours)

#### 3.1 WGSL Parser Replacement (16 hours)

**Goal:** Robust shader parsing using proper tokenization

```typescript
// packages/rendering/src/shaders/WGSLParser.ts
export class WGSLParser {
  async parse(device: GPUDevice, source: string): Promise<ShaderReflectionData> {
    // Use WebGPU for validation
    const module = device.createShaderModule({
      code: source,
      compilationHints: [] // Future: optimization hints
    });

    const info = await module.getCompilationInfo();

    // Check for errors
    const errors = info.messages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      throw new ShaderCompilationError(errors);
    }

    // Parse with tokenizer (not regex)
    const tokens = this.tokenize(source);
    const ast = this.parseAST(tokens);

    return this.extractReflection(ast, module);
  }

  private tokenize(source: string): Token[] {
    const tokens: Token[] = [];
    let current = 0;

    while (current < source.length) {
      // Proper tokenization logic
      // Handle comments, strings, identifiers, etc.
    }

    return tokens;
  }
}
```

**Tasks:**
- [ ] Implement WGSL tokenizer
- [ ] Create AST parser for bind group extraction
- [ ] Use WebGPU validation for error checking
- [ ] Add comprehensive WGSL test suite
- [ ] Handle all valid WGSL syntax variations
- [ ] Improve error messages
- [ ] Remove regex-based parser

#### 3.2 Pipeline State Simplification (8 hours)

**Goal:** Intuitive pipeline configuration

```typescript
// packages/rendering/src/pipeline/PipelinePresets.ts
export class PipelinePresets {
  static readonly OPAQUE: PipelineStateDescriptor = {
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less'
    },
    rasterization: {
      cullMode: 'back'
    }
  };

  static readonly TRANSPARENT: PipelineStateDescriptor = {
    blending: {
      enabled: true,
      color: {
        srcFactor: 'src-alpha',
        dstFactor: 'one-minus-src-alpha'
      }
    },
    depthStencil: {
      depthWriteEnabled: false,
      depthCompare: 'less'
    }
  };

  static readonly ADDITIVE: PipelineStateDescriptor = {
    blending: {
      enabled: true,
      color: {
        srcFactor: 'one',
        dstFactor: 'one'
      }
    }
  };

  // Helper to create from render mode
  static fromRenderMode(mode: RenderMode): PipelineStateDescriptor {
    switch (mode) {
      case 'opaque': return this.OPAQUE;
      case 'transparent': return this.TRANSPARENT;
      case 'additive': return this.ADDITIVE;
      case 'cutout': return { ...this.OPAQUE, alphaToCoverage: true };
    }
  }
}
```

**Tasks:**
- [ ] Define common pipeline presets
- [ ] Add renderMode enum for simple selection
- [ ] Create validation for common mistakes
- [ ] Add helpful error messages
- [ ] Document best practices
- [ ] Integration tests

### Phase 4: Resilience & Polish (Week 4, 16 hours)

#### 4.1 Device Loss Recovery (12 hours)

**Goal:** Automatic recovery from GPU device loss

```typescript
// packages/rendering/src/recovery/DeviceRecovery.ts
export class DeviceRecoverySystem {
  private resourceRegistry = new Map<string, ResourceDescriptor>();
  private recoveryCallbacks: Array<() => void> = [];

  register(resource: ResourceDescriptor): string {
    const id = generateId();
    this.resourceRegistry.set(id, resource);
    return id;
  }

  async handleDeviceLoss(): Promise<void> {
    console.warn('GPU device lost, attempting recovery...');

    // Re-initialize device
    const newDevice = await this.reinitializeDevice();

    // Recreate all resources
    for (const [id, descriptor] of this.resourceRegistry) {
      await this.recreateResource(newDevice, id, descriptor);
    }

    // Notify callbacks
    for (const callback of this.recoveryCallbacks) {
      callback();
    }

    console.log('GPU device recovery successful');
  }

  onRecovery(callback: () => void): void {
    this.recoveryCallbacks.push(callback);
  }
}
```

**Tasks:**
- [ ] Design ResourceDescriptor interface
- [ ] Implement resource registration system
- [ ] Add automatic recreation logic
- [ ] Create recovery event system
- [ ] Test with simulated device loss
- [ ] Add retry logic with backoff
- [ ] Document recovery behavior

#### 4.2 Documentation & Examples (4 hours)

**Tasks:**
- [ ] Write migration guide from old API
- [ ] Create example: Basic triangle
- [ ] Create example: Textured cube
- [ ] Create example: Instanced rendering
- [ ] Create example: Shadow mapping
- [ ] Update API documentation
- [ ] Add performance best practices guide

## Timeline & Resource Allocation

### Week 1: Core API Cleanup (20 hours)
- **Monday-Tuesday:** Unified DrawCommand (12 hours)
- **Wednesday-Thursday:** Persistent Bind Group Pools (8 hours)
- **Friday:** Integration testing

### Week 2: High-Level API (32 hours)
- **Monday-Tuesday:** Material System (16 hours)
- **Wednesday:** Mesh Abstraction (8 hours)
- **Thursday-Friday:** High-Level Renderer (8 hours)

### Week 3: Parser & Pipeline (24 hours)
- **Monday-Wednesday:** WGSL Parser (16 hours)
- **Thursday-Friday:** Pipeline State Simplification (8 hours)

### Week 4: Resilience & Polish (16 hours)
- **Monday-Wednesday:** Device Loss Recovery (12 hours)
- **Thursday-Friday:** Documentation & Examples (4 hours)

**Total Estimated Time:** 92 hours (4 weeks)

## Risk Assessment & Mitigation

### High Risk
- **WGSL Parser Complexity:** May need to use external library (naga-oil)
  - *Mitigation:* Start with simple tokenizer, enhance incrementally

### Medium Risk
- **Breaking Changes Impact:** May break existing demos
  - *Mitigation:* Update all demos in same PR, provide migration guide

- **Performance Regression:** New abstractions may add overhead
  - *Mitigation:* Profile continuously, maintain performance benchmarks

### Low Risk
- **Device Loss Recovery:** May not cover all edge cases
  - *Mitigation:* Log unrecoverable scenarios, document limitations

## Success Criteria

### Quantitative Metrics
- [ ] API calls reduced: 30+ → 5 lines for textured cube
- [ ] Type casts eliminated: 39 → 0 `as any` casts
- [ ] Cache hit rate improved: 70% → 95%+ for bind groups
- [ ] Test coverage: >80% for new code
- [ ] Performance: No regression in frame time

### Qualitative Metrics
- [ ] API intuitive for WebGPU beginners
- [ ] Documentation clear and comprehensive
- [ ] Examples cover common use cases
- [ ] Migration path well-documented
- [ ] Code review approval from team

## Migration Strategy

### Breaking Changes (Per CLAUDE.md Alpha Policy)
Since we're in version 0.x.x with explicit "break early and often" philosophy:

1. **Immediate Removal:** Delete all deprecated APIs in single PR
2. **No Compatibility Layer:** Don't maintain old interfaces
3. **Force Migration:** Update all code to use new API

### Migration Guide Structure
```markdown
## Migrating to Unified Rendering API

### Command Types
**Before:**
DrawCommand | NewDrawCommand | ModernDrawCommand

**After:**
DrawCommand (single unified type)

### High-Level API
**Before:** 30+ lines of boilerplate
**After:**
const material = new Material(renderer, { shader: 'pbr' });
const mesh = Mesh.Cube(renderer);
renderer.draw(mesh, material, transform);
```

## Code Examples

### Before (Current API)
```typescript
// 30+ lines to draw a textured cube
const shaderSource = await loadShader('textured.wgsl');
const { handle: shader, reflection } = backend.createShaderWithReflection('shader', shaderSource);

const sceneLayout = backend.createBindGroupLayout(reflection.bindGroupLayouts[0]);
const materialLayout = backend.createBindGroupLayout(reflection.bindGroupLayouts[1]);

const vertexLayout = {
  arrayStride: 24,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x2' }
  ]
};

const pipeline = backend.createRenderPipeline({
  shader,
  bindGroupLayouts: [sceneLayout, materialLayout],
  vertexLayouts: [vertexLayout],
  pipelineState: OPAQUE_PIPELINE_STATE
});

const uniformBuffer = backend.createBuffer('uniforms', ...);
const sceneBindGroup = backend.createBindGroup(sceneLayout, {
  bindings: [{ binding: 0, resource: { buffer: uniformBuffer } }]
});

const texture = await backend.createTexture('texture', ...);
const sampler = backend.createSampler('sampler', ...);
const materialBindGroup = backend.createBindGroup(materialLayout, {
  bindings: [
    { binding: 0, resource: texture },
    { binding: 1, resource: sampler }
  ]
});

const vertexBuffer = backend.createBuffer('vertices', ...);
const indexBuffer = backend.createBuffer('indices', ...);

const command: ModernDrawCommand = {
  pipeline,
  bindGroups: new Map([
    [0, sceneBindGroup],
    [1, materialBindGroup]
  ]),
  vertexBuffers: [vertexBuffer],
  indexBuffer,
  indexFormat: 'uint16',
  indexCount: 36
};

backend.executeModernRenderPass(command);
```

### After (New High-Level API)
```typescript
// 5 lines to draw a textured cube
const renderer = new HighLevelRenderer(canvas);
const material = Material.Textured(renderer, { texture: 'assets/texture.png' });
const cube = Mesh.Cube(renderer);

renderer.draw(cube, material, transform);
```

### After (New Low-Level API)
```typescript
// Unified command with builder pattern
const command = DrawCommandBuilder.indexed()
  .pipeline(pipeline)
  .bindGroup(0, sceneBindGroup)
  .bindGroup(1, materialBindGroup)
  .vertexBuffer(vertexBuffer)
  .indexBuffer(indexBuffer, 'uint16', 36)
  .build();

backend.executeDrawCommand(command);
```

## Appendix: Technical Details

### Bind Group Pool Algorithm
```typescript
// Cache key generation for persistent pools
function generateCacheKey(
  layout: BackendBindGroupLayoutHandle,
  resources: BindGroupResources
): string {
  const parts = [`layout:${layout.id}`];

  for (const [binding, resource] of Object.entries(resources)) {
    if ('buffer' in resource) {
      parts.push(`${binding}:b${resource.buffer.id}`);
    } else if ('texture' in resource) {
      parts.push(`${binding}:t${resource.texture.id}`);
    } else if ('sampler' in resource) {
      parts.push(`${binding}:s${resource.sampler.id}`);
    }
  }

  return parts.join('_');
}
```

### WGSL Tokenizer Structure
```typescript
enum TokenType {
  KEYWORD,     // var, fn, struct, etc.
  IDENTIFIER,  // Variable names
  ANNOTATION,  // @group, @binding, etc.
  OPERATOR,    // +, -, *, /, etc.
  LITERAL,     // Numbers, strings
  PUNCTUATION, // {, }, (, ), ;, ,
  COMMENT,     // // and /* */
  WHITESPACE
}

interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}
```

### Performance Profiling Points
```typescript
interface PerformanceMetrics {
  bindGroupCreation: number;      // Time spent creating bind groups
  bindGroupCacheHitRate: number;  // Percentage of cache hits
  pipelineCreation: number;       // Time spent creating pipelines
  pipelineCacheHitRate: number;   // Percentage of cache hits
  bufferAllocation: number;       // Time spent allocating buffers
  bufferPoolHitRate: number;      // Percentage of pool hits
  drawCallOverhead: number;       // Time per draw call
  totalFrameTime: number;         // Total frame time
}
```

---

*Document Version: 1.0*
*Created: November 2025*
*Last Updated: November 2025*
*Status: Planning Phase*