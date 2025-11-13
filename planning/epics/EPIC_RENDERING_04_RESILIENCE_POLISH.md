# EPIC: Device Recovery & Final Polish

**Epic ID:** RENDERING-04
**Status:** Not Started
**Priority:** MEDIUM
**Depends On:** RENDERING-01, RENDERING-02, RENDERING-03

## Objective

Implement automatic GPU device loss recovery, finalize documentation, create comprehensive examples, and ensure production readiness. This epic focuses on resilience, developer experience, and preparing the rendering engine for real-world usage.

## Success Criteria

- [x] Automatic device loss detection and recovery
- [x] Resource recreation without application restart
- [x] Recovery event system for application notification
- [x] Comprehensive documentation (API, guides, examples)
- [x] Migration guide from old API to new API
- [x] Complete example collection (5+ demos)
- [x] Performance validation (all targets met)
- [x] Production readiness checklist completed

## Current State

### Problems

#### 1. Incomplete Device Loss Handling
Current implementation in WebGPUBackend.ts:
```typescript
device.lost.then((info) => {
  console.error('Device lost:', info.message);
  // TODO: Implement recovery
});
```

**Issues:**
- No resource recreation
- No application notification
- No retry logic
- Application must restart

#### 2. Documentation Gaps
- README examples use old API
- No migration guide
- Missing best practices guide
- Incomplete API reference

#### 3. Missing Examples
- No comprehensive demo application
- No real-world usage patterns
- No performance optimization examples

### Impact
- Production applications vulnerable to device loss
- Developer confusion about API migration
- Difficult to learn best practices

## Implementation Tasks

### Task 4.1: Device Loss Detection (3 hours)

**Deliverable:** `/packages/rendering/src/recovery/DeviceLossDetector.ts`

```typescript
export interface DeviceLossInfo {
  reason: 'unknown' | 'destroyed' | 'validation-error' | 'out-of-memory';
  message: string;
  timestamp: number;
}

export type DeviceLossCallback = (info: DeviceLossInfo) => void;

export class DeviceLossDetector {
  private callbacks: DeviceLossCallback[] = [];
  private device: GPUDevice;
  private lostPromise: Promise<GPUDeviceLostInfo>;

  constructor(device: GPUDevice) {
    this.device = device;
    this.lostPromise = device.lost;
    this.startMonitoring();
  }

  /**
   * Register callback for device loss events
   */
  onDeviceLost(callback: DeviceLossCallback): () => void {
    this.callbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index !== -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Start monitoring for device loss
   */
  private async startMonitoring(): Promise<void> {
    try {
      const info = await this.lostPromise;

      const lossInfo: DeviceLossInfo = {
        reason: info.reason as any,
        message: info.message,
        timestamp: Date.now()
      };

      // Notify all callbacks
      for (const callback of this.callbacks) {
        try {
          callback(lossInfo);
        } catch (error) {
          console.error('Error in device loss callback:', error);
        }
      }
    } catch (error) {
      console.error('Error monitoring device loss:', error);
    }
  }

  /**
   * Check if device is still valid
   */
  isDeviceValid(): boolean {
    // Device is valid if lost promise hasn't resolved
    return this.device && !this.device.destroyed;
  }
}
```

**Acceptance Criteria:**
- [ ] Detect device loss via device.lost promise
- [ ] Parse loss reason (destroyed, validation-error, OOM)
- [ ] Callback registration system
- [ ] Unsubscribe mechanism
- [ ] Error handling in callbacks
- [ ] Unit tests with mocked GPUDevice

**Dependencies:** None

---

### Task 4.2: Resource Registry (4 hours)

**Deliverable:** `/packages/rendering/src/recovery/ResourceRegistry.ts`

```typescript
export enum ResourceType {
  BUFFER = 'buffer',
  TEXTURE = 'texture',
  SAMPLER = 'sampler',
  SHADER = 'shader',
  PIPELINE = 'pipeline',
  BIND_GROUP = 'bind_group',
  BIND_GROUP_LAYOUT = 'bind_group_layout'
}

export interface ResourceDescriptor {
  type: ResourceType;
  id: string;
  label?: string;
  creationParams: any; // Type depends on resource type
}

export interface BufferDescriptor extends ResourceDescriptor {
  type: ResourceType.BUFFER;
  creationParams: {
    size: number;
    usage: BufferUsage;
    mapped?: boolean;
  };
  data?: ArrayBuffer; // Store data for recreation
}

export interface TextureDescriptor extends ResourceDescriptor {
  type: ResourceType.TEXTURE;
  creationParams: {
    width: number;
    height: number;
    format: TextureFormat;
    usage: TextureUsage;
    mipLevelCount?: number;
  };
  data?: ImageBitmap | ArrayBuffer;
}

export interface ShaderDescriptor extends ResourceDescriptor {
  type: ResourceType.SHADER;
  creationParams: {
    source: string;
  };
}

export interface PipelineDescriptor extends ResourceDescriptor {
  type: ResourceType.PIPELINE;
  creationParams: {
    shader: string; // Shader ID
    bindGroupLayouts: string[]; // Layout IDs
    vertexLayouts: VertexLayoutDescriptor[];
    pipelineState: PipelineStateDescriptor;
  };
}

export class ResourceRegistry {
  private resources = new Map<string, ResourceDescriptor>();
  private resourcesByType = new Map<ResourceType, Set<string>>();

  /**
   * Register resource for recovery
   */
  register(descriptor: ResourceDescriptor): string {
    this.resources.set(descriptor.id, descriptor);

    // Add to type index
    if (!this.resourcesByType.has(descriptor.type)) {
      this.resourcesByType.set(descriptor.type, new Set());
    }
    this.resourcesByType.get(descriptor.type)!.add(descriptor.id);

    return descriptor.id;
  }

  /**
   * Unregister resource (when explicitly destroyed)
   */
  unregister(id: string): void {
    const descriptor = this.resources.get(id);
    if (descriptor) {
      this.resources.delete(id);
      this.resourcesByType.get(descriptor.type)?.delete(id);
    }
  }

  /**
   * Get resource descriptor
   */
  get(id: string): ResourceDescriptor | undefined {
    return this.resources.get(id);
  }

  /**
   * Get all resources of type
   */
  getByType(type: ResourceType): ResourceDescriptor[] {
    const ids = this.resourcesByType.get(type);
    if (!ids) return [];

    return Array.from(ids)
      .map(id => this.resources.get(id))
      .filter((d): d is ResourceDescriptor => d !== undefined);
  }

  /**
   * Get all resources (for full recreation)
   */
  getAll(): ResourceDescriptor[] {
    return Array.from(this.resources.values());
  }

  /**
   * Clear registry (after successful recovery)
   */
  clear(): void {
    this.resources.clear();
    this.resourcesByType.clear();
  }

  /**
   * Get statistics
   */
  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};

    for (const [type, ids] of this.resourcesByType) {
      byType[type] = ids.size;
    }

    return {
      total: this.resources.size,
      byType
    };
  }
}
```

**Acceptance Criteria:**
- [ ] Register/unregister resources
- [ ] Store creation parameters
- [ ] Query by ID or type
- [ ] Type-safe descriptors
- [ ] Statistics tracking
- [ ] Unit tests for all operations

**Dependencies:** None

---

### Task 4.3: Device Recovery System (5 hours)

**Deliverable:** `/packages/rendering/src/recovery/DeviceRecoverySystem.ts`

```typescript
export interface RecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  logProgress?: boolean;
}

export interface RecoveryProgress {
  phase: 'detecting' | 'reinitializing' | 'recreating' | 'complete' | 'failed';
  resourcesRecreated: number;
  totalResources: number;
  error?: Error;
}

export type RecoveryCallback = (progress: RecoveryProgress) => void;

export class DeviceRecoverySystem {
  private detector: DeviceLossDetector;
  private registry: ResourceRegistry;
  private callbacks: RecoveryCallback[] = [];
  private recovering = false;

  constructor(
    private backend: IRendererBackend,
    private options: RecoveryOptions = {}
  ) {
    this.detector = new DeviceLossDetector(backend.device);
    this.registry = new ResourceRegistry();

    // Set defaults
    this.options.maxRetries ??= 3;
    this.options.retryDelay ??= 1000;
    this.options.logProgress ??= true;

    // Register device loss handler
    this.detector.onDeviceLost((info) => {
      this.handleDeviceLoss(info);
    });
  }

  /**
   * Register resource for recovery
   */
  registerResource(descriptor: ResourceDescriptor): string {
    return this.registry.register(descriptor);
  }

  /**
   * Unregister resource (when destroyed)
   */
  unregisterResource(id: string): void {
    this.registry.unregister(id);
  }

  /**
   * Register recovery progress callback
   */
  onRecovery(callback: RecoveryCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index !== -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Handle device loss and attempt recovery
   */
  private async handleDeviceLoss(info: DeviceLossInfo): Promise<void> {
    if (this.recovering) {
      console.warn('Recovery already in progress');
      return;
    }

    this.recovering = true;

    if (this.options.logProgress) {
      console.warn(`GPU device lost: ${info.reason} - ${info.message}`);
      console.log('Attempting automatic recovery...');
    }

    this.notifyProgress({
      phase: 'detecting',
      resourcesRecreated: 0,
      totalResources: this.registry.getAll().length
    });

    // Attempt recovery with retries
    for (let attempt = 1; attempt <= this.options.maxRetries!; attempt++) {
      try {
        if (this.options.logProgress && attempt > 1) {
          console.log(`Recovery attempt ${attempt}/${this.options.maxRetries}...`);
        }

        await this.performRecovery();

        if (this.options.logProgress) {
          console.log('Device recovery successful!');
        }

        this.notifyProgress({
          phase: 'complete',
          resourcesRecreated: this.registry.getAll().length,
          totalResources: this.registry.getAll().length
        });

        this.recovering = false;
        return;

      } catch (error) {
        if (this.options.logProgress) {
          console.error(`Recovery attempt ${attempt} failed:`, error);
        }

        if (attempt < this.options.maxRetries!) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelay!));
        } else {
          // Final attempt failed
          if (this.options.logProgress) {
            console.error('Device recovery failed after all retries');
          }

          this.notifyProgress({
            phase: 'failed',
            resourcesRecreated: 0,
            totalResources: this.registry.getAll().length,
            error: error as Error
          });

          this.recovering = false;
          throw error;
        }
      }
    }
  }

  /**
   * Perform actual recovery
   */
  private async performRecovery(): Promise<void> {
    // Phase 1: Reinitialize device
    this.notifyProgress({
      phase: 'reinitializing',
      resourcesRecreated: 0,
      totalResources: this.registry.getAll().length
    });

    await this.backend.reinitialize();

    // Phase 2: Recreate resources in dependency order
    this.notifyProgress({
      phase: 'recreating',
      resourcesRecreated: 0,
      totalResources: this.registry.getAll().length
    });

    const resourceOrder = [
      ResourceType.SAMPLER,
      ResourceType.BUFFER,
      ResourceType.TEXTURE,
      ResourceType.SHADER,
      ResourceType.BIND_GROUP_LAYOUT,
      ResourceType.BIND_GROUP,
      ResourceType.PIPELINE
    ];

    let recreated = 0;

    for (const type of resourceOrder) {
      const resources = this.registry.getByType(type);

      for (const descriptor of resources) {
        await this.recreateResource(descriptor);
        recreated++;

        this.notifyProgress({
          phase: 'recreating',
          resourcesRecreated: recreated,
          totalResources: this.registry.getAll().length
        });
      }
    }
  }

  /**
   * Recreate individual resource
   */
  private async recreateResource(descriptor: ResourceDescriptor): Promise<void> {
    switch (descriptor.type) {
      case ResourceType.BUFFER:
        await this.recreateBuffer(descriptor as BufferDescriptor);
        break;

      case ResourceType.TEXTURE:
        await this.recreateTexture(descriptor as TextureDescriptor);
        break;

      case ResourceType.SHADER:
        await this.recreateShader(descriptor as ShaderDescriptor);
        break;

      case ResourceType.PIPELINE:
        await this.recreatePipeline(descriptor as PipelineDescriptor);
        break;

      // Add other resource types...

      default:
        console.warn(`Don't know how to recreate resource type: ${descriptor.type}`);
    }
  }

  private async recreateBuffer(descriptor: BufferDescriptor): Promise<void> {
    const buffer = this.backend.createBuffer(
      descriptor.id,
      descriptor.creationParams.size,
      descriptor.creationParams.usage,
      'static'
    );

    // Restore data if available
    if (descriptor.data) {
      this.backend.updateBuffer(buffer, descriptor.data, 0);
    }
  }

  private async recreateTexture(descriptor: TextureDescriptor): Promise<void> {
    const texture = this.backend.createTexture(
      descriptor.id,
      descriptor.creationParams.width,
      descriptor.creationParams.height,
      descriptor.creationParams.format,
      descriptor.creationParams.usage
    );

    // Restore data if available
    if (descriptor.data) {
      this.backend.updateTexture(texture, descriptor.data);
    }
  }

  private async recreateShader(descriptor: ShaderDescriptor): Promise<void> {
    await this.backend.createShaderWithReflection(
      descriptor.id,
      descriptor.creationParams.source
    );
  }

  private async recreatePipeline(descriptor: PipelineDescriptor): Promise<void> {
    // Look up dependent resources
    const shader = this.backend.getShader(descriptor.creationParams.shader);
    const layouts = descriptor.creationParams.bindGroupLayouts.map(id =>
      this.backend.getBindGroupLayout(id)
    );

    this.backend.createRenderPipeline({
      shader,
      bindGroupLayouts: layouts,
      vertexLayouts: descriptor.creationParams.vertexLayouts,
      pipelineState: descriptor.creationParams.pipelineState
    });
  }

  private notifyProgress(progress: RecoveryProgress): void {
    for (const callback of this.callbacks) {
      try {
        callback(progress);
      } catch (error) {
        console.error('Error in recovery callback:', error);
      }
    }
  }

  /**
   * Get recovery statistics
   */
  getStats(): { registered: number; byType: Record<string, number> } {
    return this.registry.getStats();
  }
}
```

**Acceptance Criteria:**
- [ ] Automatic device loss detection
- [ ] Resource recreation in correct order
- [ ] Retry logic with exponential backoff
- [ ] Progress callbacks
- [ ] Error handling and logging
- [ ] Integration tests with simulated device loss
- [ ] Recovery completes within 5 seconds

**Dependencies:** Task 4.1, Task 4.2

---

### Task 4.4: Integration with WebGPUBackend (2 hours)

**Deliverable:** Update `/packages/rendering/src/backends/WebGPUBackend.ts`

**Changes:**
- Add DeviceRecoverySystem integration
- Register resources on creation
- Unregister resources on destruction
- Expose recovery events

```typescript
export class WebGPUBackend implements IRendererBackend {
  private recoverySystem?: DeviceRecoverySystem;

  async initialize(options?: InitOptions): Promise<void> {
    // ... existing initialization ...

    // Initialize recovery system
    if (options?.enableDeviceRecovery !== false) {
      this.recoverySystem = new DeviceRecoverySystem(this, {
        maxRetries: 3,
        retryDelay: 1000,
        logProgress: true
      });

      this.recoverySystem.onRecovery((progress) => {
        if (progress.phase === 'complete') {
          console.log('Device recovery complete');
        } else if (progress.phase === 'failed') {
          console.error('Device recovery failed:', progress.error);
        }
      });
    }
  }

  createBuffer(id: string, size: number, usage: BufferUsage, mode: 'static' | 'dynamic'): BackendBufferHandle {
    const buffer = /* ... create buffer ... */;

    // Register for recovery
    this.recoverySystem?.registerResource({
      type: ResourceType.BUFFER,
      id,
      creationParams: { size, usage }
    });

    return buffer;
  }

  // Similar for other resource creation methods...
}
```

**Acceptance Criteria:**
- [ ] Recovery system integrated
- [ ] All resource creation registers with recovery
- [ ] All resource destruction unregisters
- [ ] Recovery events exposed
- [ ] Optional (can be disabled)
- [ ] Integration tests pass

**Dependencies:** Task 4.3

---

### Task 4.5: Documentation (4 hours)

**Deliverable:**
- `/packages/rendering/MIGRATION_GUIDE.md`
- `/packages/rendering/BEST_PRACTICES.md`
- Update `/packages/rendering/README.md`
- Create `/packages/rendering/examples/`

#### Migration Guide
```markdown
# Migration Guide: Old API → New API

## Command Types Consolidation

### Before (Multiple Types)
DrawCommand | NewDrawCommand | ModernDrawCommand

### After (Unified)
DrawCommand (single type)

## High-Level API

### Before (30+ lines)
[Full verbose example...]

### After (5 lines)
const renderer = new HighLevelRenderer(canvas);
const material = Material.Textured(renderer, { texture: 'crate.png' });
const cube = Mesh.Cube(renderer);
renderer.draw(cube, material, transform);

## Pipeline State Presets

### Before (Verbose)
[Full pipeline state config...]

### After (Preset)
pipelineState: PipelinePresets.TRANSPARENT

## Breaking Changes
- `parseShaderReflection()` now async
- Old command types removed
- ...
```

#### Best Practices Guide
```markdown
# Rendering Engine Best Practices

## Performance

### DO: Use High-Level API for Prototyping
- Fast iteration
- Automatic optimization
- Less boilerplate

### DO: Use Instancing for Repeated Geometry
const transforms = [/* ... */];
renderer.drawInstanced(mesh, material, transforms);

### DO: Sort Transparent Objects
Render queue automatically sorts, but manual control:
renderer.renderQueue.sort();

### DON'T: Create Resources Every Frame
Cache materials, meshes, textures

### DON'T: Update Uniforms Unnecessarily
Use dirty tracking (Material does this automatically)

## Resource Management

### DO: Dispose Resources When Done
material.dispose();
mesh.dispose();
renderer.dispose();

### DO: Use Built-in Shaders
Material.PBR(), Material.Unlit(), etc.

### DON'T: Ignore Device Loss
Always enable device recovery in production

## Shader Development

### DO: Use Pipeline Presets
PipelinePresets.TRANSPARENT, OPAQUE, etc.

### DON'T: Use Regex to Parse WGSL
Use WGSLParser instead

## Testing

### DO: Test with Device Loss Simulation
[Example code...]

### DO: Profile Performance
Use RenderStats from endFrame()
```

**Acceptance Criteria:**
- [ ] Migration guide covers all breaking changes
- [ ] Best practices with DO/DON'T examples
- [ ] README updated to reflect new API
- [ ] Code examples tested and working
- [ ] Clear, concise writing

**Dependencies:** None

---

### Task 4.6: Example Collection (2 hours)

**Deliverable:** `/packages/rendering/examples/`

Create 5 comprehensive examples:

1. **basic-triangle.ts** - Minimal example (20 lines)
2. **textured-cube.ts** - Textured object with lighting (40 lines)
3. **instancing.ts** - Draw 1000 cubes efficiently (60 lines)
4. **transparent-objects.ts** - Proper transparent rendering (50 lines)
5. **device-recovery.ts** - Demonstrate recovery (80 lines)

```typescript
// Example: textured-cube.ts
import { HighLevelRenderer, Material, Mesh } from '@miskatonic/rendering';

async function main() {
  const canvas = document.querySelector('canvas')!;
  const renderer = new HighLevelRenderer({ canvas });
  await renderer.initialize();

  // Create resources
  const material = await renderer.createMaterial(
    Material.Textured(renderer, {
      texture: 'assets/crate.png'
    }).config
  );

  const cube = Mesh.Cube(renderer);

  // Animation loop
  let rotation = 0;
  function animate() {
    rotation += 0.01;

    const transform = mat4.create();
    mat4.rotateY(transform, transform, rotation);

    renderer.beginFrame();
    renderer.draw(cube, material, transform);
    const stats = renderer.endFrame();

    console.log(`${stats.drawCalls} draw calls, ${stats.frameTime.toFixed(2)}ms`);

    requestAnimationFrame(animate);
  }

  animate();
}

main();
```

**Acceptance Criteria:**
- [ ] 5 examples implemented
- [ ] All examples tested and working
- [ ] Progressive complexity (basic → advanced)
- [ ] Comments explain key concepts
- [ ] README.md in examples/ directory

**Dependencies:** Task 4.4 (for device recovery example)

---

## Breaking Changes

### None (Polish Epic)

This epic focuses on resilience and documentation, with no breaking API changes.

## Testing Requirements

### Unit Tests
- [ ] DeviceLossDetector callback system
- [ ] ResourceRegistry all operations
- [ ] DeviceRecoverySystem retry logic
- [ ] Resource recreation by type

### Integration Tests
- [ ] Simulated device loss triggers recovery
- [ ] Resources recreated correctly
- [ ] Application continues functioning after recovery
- [ ] Multiple recovery cycles

### Manual Tests
- [ ] Force device loss (browser DevTools)
- [ ] Verify visual output after recovery
- [ ] Test all 5 examples

### Coverage Target
**>80% line coverage** for recovery code

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Recovery time | <5s | <10s |
| Resource recreation | <100ms | <500ms |
| Memory overhead | <5MB | <20MB |
| No runtime impact | 0% | <1% |

## Dependencies

### Blocks
- Production deployment (must complete before v1.0)

### Blocked By
- RENDERING-01, RENDERING-02, RENDERING-03 (should complete first)

## Risks & Mitigation

### Medium Risk
**Resource recreation may fail for complex pipelines**
- *Mitigation:* Store all creation parameters
- *Mitigation:* Test with complex demo scenes
- *Mitigation:* Fallback to application restart

**Documentation may become outdated**
- *Mitigation:* Link to TypeDoc for API reference
- *Mitigation:* Examples in version control
- *Mitigation:* CI checks for broken examples

### Low Risk
**Recovery system overhead**
- *Mitigation:* Lazy initialization
- *Mitigation:* Optional (can be disabled)
- *Mitigation:* Profile to ensure <1% impact

## Production Readiness Checklist

### Code Quality
- [ ] All code reviewed
- [ ] No `TODO` comments in critical paths
- [ ] No `console.log` statements (use proper logging)
- [ ] Error handling in all async code
- [ ] Input validation for public APIs

### Testing
- [ ] Unit tests: >80% coverage
- [ ] Integration tests: All pass
- [ ] Performance tests: All targets met
- [ ] Manual testing: Device loss recovery
- [ ] Cross-browser testing: Chrome, Firefox, Edge

### Documentation
- [ ] API documentation complete
- [ ] Migration guide published
- [ ] Best practices guide published
- [ ] Examples tested and working
- [ ] README accurate and up-to-date

### Performance
- [ ] Frame time <16.67ms (60 FPS)
- [ ] Memory usage <500MB
- [ ] No memory leaks
- [ ] GPU resource cleanup verified

### Security
- [ ] Input validation on all user data
- [ ] Shader size limits enforced
- [ ] No arbitrary code execution
- [ ] WebGPU validation enabled

## Definition of Done

- [ ] All 6 tasks completed
- [ ] Device recovery system fully working
- [ ] Resource registry with all resource types
- [ ] Recovery completes in <5 seconds
- [ ] All tests passing with >80% coverage
- [ ] Migration guide published
- [ ] Best practices guide published
- [ ] 5 examples working and documented
- [ ] Production readiness checklist complete
- [ ] Code reviewed and approved

---

*Epic created: November 2025*

