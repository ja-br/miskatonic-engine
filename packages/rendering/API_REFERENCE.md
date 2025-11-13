# Rendering Engine API Reference - Advanced Topics

## Implementation Details & Internal Architecture

### Memory Management Architecture

#### Buffer Pool Implementation
```typescript
// Internal bucketing algorithm
class GPUBufferPool {
  private findBucket(requestedSize: number): number {
    // Round up to next power of 2
    const clampedSize = Math.max(this.MIN_BUCKET_SIZE, requestedSize);
    return Math.pow(2, Math.ceil(Math.log2(clampedSize)));
  }

  // Actual GPU usage flags mapping
  private getGPUBufferUsage(usage: BufferUsageType): GPUBufferUsageFlags {
    switch (usage) {
      case BufferUsageType.VERTEX:
        return GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
      case BufferUsageType.INDEX:
        return GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST;
      case BufferUsageType.UNIFORM:
        return GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
      case BufferUsageType.STORAGE:
        return GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
      case BufferUsageType.INSTANCE:
        return GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE;
    }
  }
}
```

#### UniformBufferPool Internals
```typescript
// WebGPUBackend internal uniform buffer pooling
class UniformBufferPool {
  private pool: GPUBuffer[] = [];
  private maxPoolSize = 8192;
  private nextBufferId = 0;
  private bufferIds = new WeakMap<GPUBuffer, number>();

  acquire(device: GPUDevice, size: number): GPUBuffer {
    // Uniform buffers MUST be aligned to 256 bytes per WebGPU spec
    const alignedSize = Math.ceil(size / 256) * 256;

    // Try pool reuse first
    const buffer = this.pool.pop();
    if (buffer && buffer.size >= alignedSize) {
      this.stats.buffersReused++;
      return buffer;
    }

    // Create new aligned buffer
    const newBuffer = device.createBuffer({
      size: alignedSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Assign unique ID for bind group caching
    this.bufferIds.set(newBuffer, this.nextBufferId++);
    return newBuffer;
  }

  getBufferId(buffer: GPUBuffer): number {
    return this.bufferIds.get(buffer) ?? -1;
  }
}
```

### Shader Reflection Deep Dive

#### WGSL Parsing Implementation
```typescript
class WGSLReflectionParser {
  // Security: Prevent ReDoS attacks
  private readonly MAX_SHADER_SIZE = 1_000_000; // 1MB

  parse(source: string): ShaderReflectionData {
    // Size validation
    if (source.length > this.MAX_SHADER_SIZE) {
      throw new Error(`Shader too large: ${source.length} bytes`);
    }

    // Extract bind groups with validation
    const bindGroupRegex = /@group\((\d+)\)\s+@binding\((\d+)\)/g;

    while ((match = bindGroupRegex.exec(source)) !== null) {
      const groupIndex = parseInt(match[1]);
      const bindingIndex = parseInt(match[2]);

      // WebGPU spec limits
      if (groupIndex < 0 || groupIndex > 3) {
        throw new Error(`Group index ${groupIndex} out of range [0,3]`);
      }
      if (bindingIndex < 0 || bindingIndex > 15) {
        throw new Error(`Binding index ${bindingIndex} out of range [0,15]`);
      }
    }

    // Extract vertex attributes
    const attributeRegex = /@location\((\d+)\)\s+(\w+)\s*:\s*([^,;]+)/g;

    // Detect entry points
    const entryPoints = {
      vertex: source.match(/@vertex\s+fn\s+(\w+)/) ? RegExp.$1 : undefined,
      fragment: source.match(/@fragment\s+fn\s+(\w+)/) ? RegExp.$1 : undefined,
      compute: source.match(/@compute\s+@workgroup_size\((\d+),?\s*(\d+)?,?\s*(\d+)?\)/)
        ? { x: parseInt(RegExp.$1), y: parseInt(RegExp.$2) || 1, z: parseInt(RegExp.$3) || 1 }
        : undefined
    };

    return { bindGroupLayouts, attributes, entryPoints, workgroupSize };
  }
}
```

### Render Queue Sorting Algorithm

#### Sort Key Generation
```typescript
// 32-bit sort key layout:
// [31-24: render pass] [23-16: shader] [15-8: material] [7-0: depth]

class RenderQueue {
  private generateSortKey(command: QueuedDrawCommand): number {
    // Extract 8-bit hashes
    const passKey = (this.getRenderPassId(command) & 0xFF) << 24;
    const shaderKey = (this.hash8(command.materialId) & 0xFF) << 16;
    const materialKey = (this.hash8(command.materialId + 'mat') & 0xFF) << 8;

    // Quantize depth to 8 bits
    const depthKey = Math.min(255, Math.floor(command.depth * 2.55)) & 0xFF;

    return passKey | shaderKey | materialKey | depthKey;
  }

  private hash8(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
    }
    return hash & 0xFF;
  }

  sort(): void {
    const startTime = performance.now();

    // Opaque: front-to-back (ascending depth)
    this.opaque.sort((a, b) => a.sortKey - b.sortKey);

    // Alpha-test: by material (minimize state changes)
    this.alphaTest.sort((a, b) => {
      const matDiff = a._cachedMaterialHash! - b._cachedMaterialHash!;
      return matDiff !== 0 ? matDiff : a.depth - b.depth;
    });

    // Transparent: back-to-front (descending depth)
    this.transparent.sort((a, b) => b.depth - a.depth);

    this.stats.sortTime = performance.now() - startTime;
  }
}
```

### Instance Detection Algorithm

```typescript
class InstanceDetector {
  detectInstances(commands: QueuedDrawCommand[]): InstanceGroup[] {
    const groups = new Map<string, InstanceGroup>();

    for (const cmd of commands) {
      // Generate instance key
      const meshId = this.extractMeshId(cmd);
      const materialId = cmd.materialId;
      const key = `${meshId}:${materialId}`;

      // Get or create group
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          meshId,
          materialId,
          instances: [],
          instanceCount: 0,
          worldMatrices: null!,
          canInstance: false
        });
      }

      const group = groups.get(key)!;
      group.instances.push(cmd);
    }

    // Check instance threshold and build matrices
    for (const group of groups.values()) {
      group.instanceCount = group.instances.length;

      if (group.instanceCount >= this.config.minInstanceThreshold) {
        group.canInstance = true;

        // Pack world matrices
        const matrices = new Float32Array(group.instanceCount * 16);
        for (let i = 0; i < group.instanceCount; i++) {
          matrices.set(group.instances[i].worldMatrix, i * 16);
        }
        group.worldMatrices = matrices;
      }
    }

    return Array.from(groups.values());
  }
}
```

### Shadow Cascade Split Calculation

```typescript
class DirectionalShadowCascades {
  private calculateSplits(): number[] {
    const splits: number[] = [this.config.nearPlane];
    const range = this.config.farPlane - this.config.nearPlane;
    const ratio = this.config.farPlane / this.config.nearPlane;

    for (let i = 1; i < this.config.cascadeCount; i++) {
      const p = i / this.config.cascadeCount;

      let split: number;
      switch (this.config.splitScheme) {
        case 'uniform':
          split = this.config.nearPlane + range * p;
          break;

        case 'logarithmic':
          split = this.config.nearPlane * Math.pow(ratio, p);
          break;

        case 'practical':
          // Blend between uniform and logarithmic
          const lambda = this.config.lambda!;
          const uniform = this.config.nearPlane + range * p;
          const log = this.config.nearPlane * Math.pow(ratio, p);
          split = lambda * log + (1 - lambda) * uniform;
          break;
      }

      splits.push(split);
    }

    splits.push(this.config.farPlane);
    return splits;
  }

  private computeCascadeBounds(
    viewMatrix: mat4,
    projMatrix: mat4,
    near: number,
    far: number
  ): { min: vec3; max: vec3 } {
    // Calculate frustum corners in world space
    const corners = this.getFrustumCornersWorldSpace(viewMatrix, projMatrix, near, far);

    // Find AABB in light space
    const lightView = this.getLightViewMatrix();
    const min = vec3.fromValues(Infinity, Infinity, Infinity);
    const max = vec3.fromValues(-Infinity, -Infinity, -Infinity);

    for (const corner of corners) {
      const lightSpaceCorner = vec3.transformMat4(corner, corner, lightView);
      vec3.min(min, min, lightSpaceCorner);
      vec3.max(max, max, lightSpaceCorner);
    }

    // Snap to texel grid to reduce shimmer
    const texelSize = (max[0] - min[0]) / this.config.resolution;
    min[0] = Math.floor(min[0] / texelSize) * texelSize;
    min[1] = Math.floor(min[1] / texelSize) * texelSize;
    max[0] = Math.ceil(max[0] / texelSize) * texelSize;
    max[1] = Math.ceil(max[1] / texelSize) * texelSize;

    return { min, max };
  }
}
```

### Bind Group Caching Strategy

```typescript
class WebGPUBackend {
  private bindGroupCache = new Map<string, GPUBindGroup>();
  private bindGroupCacheStats = { hits: 0, misses: 0 };

  private getOrCreateBindGroup(
    layout: GPUBindGroupLayout,
    resources: BindGroupResources
  ): GPUBindGroup {
    // Generate cache key from resource IDs
    const key = this.generateBindGroupCacheKey(layout, resources);

    // Check cache
    if (this.bindGroupCache.has(key)) {
      this.bindGroupCacheStats.hits++;
      return this.bindGroupCache.get(key)!;
    }

    // Create new bind group
    this.bindGroupCacheStats.misses++;
    const entries: GPUBindGroupEntry[] = [];

    for (const [binding, resource] of Object.entries(resources)) {
      if ('buffer' in resource) {
        entries.push({
          binding: parseInt(binding),
          resource: { buffer: resource.buffer }
        });
      } else if ('texture' in resource) {
        entries.push({
          binding: parseInt(binding),
          resource: resource.texture.createView()
        });
      } else if ('sampler' in resource) {
        entries.push({
          binding: parseInt(binding),
          resource: resource.sampler
        });
      }
    }

    const bindGroup = this.device!.createBindGroup({
      layout,
      entries
    });

    // Cache it
    this.bindGroupCache.set(key, bindGroup);

    // LRU eviction if cache too large
    if (this.bindGroupCache.size > 1000) {
      const firstKey = this.bindGroupCache.keys().next().value;
      this.bindGroupCache.delete(firstKey);
    }

    return bindGroup;
  }

  private generateBindGroupCacheKey(
    layout: GPUBindGroupLayout,
    resources: BindGroupResources
  ): string {
    const parts: string[] = ['bg'];

    // Include layout ID
    parts.push(this.getLayoutId(layout));

    // Include resource IDs
    for (const [binding, resource] of Object.entries(resources)) {
      if ('buffer' in resource) {
        parts.push(`${binding}:b${this.uniformBufferPool.getBufferId(resource.buffer)}`);
      } else if ('texture' in resource) {
        parts.push(`${binding}:t${this.getTextureId(resource.texture)}`);
      } else if ('sampler' in resource) {
        parts.push(`${binding}:s${this.getSamplerId(resource.sampler)}`);
      }
    }

    return parts.join('_');
  }
}
```

### Pipeline Variant Management

```typescript
class WebGPUBackend {
  private pipelineCache = new Map<string, PipelineCacheEntry>();

  private getOrCreatePipeline(
    shader: WebGPUShader,
    vertexLayout: VertexLayout
  ): GPURenderPipeline {
    // Generate cache key
    const vertexLayoutHash = this.hashVertexLayout(vertexLayout);
    const cacheKey = `${shader.id}:${vertexLayoutHash}`;

    // Check cache
    if (this.pipelineCache.has(cacheKey)) {
      const entry = this.pipelineCache.get(cacheKey)!;
      if (entry.vertexLayoutHash === vertexLayoutHash) {
        return entry.pipeline;
      }
    }

    // Create vertex buffer layout
    const vertexBuffers: GPUVertexBufferLayout[] = [{
      arrayStride: vertexLayout.stride,
      stepMode: 'vertex',
      attributes: vertexLayout.attributes.map(attr => ({
        shaderLocation: attr.location,
        offset: attr.offset,
        format: this.mapAttributeFormat(attr.type, attr.size)
      }))
    }];

    // Create pipeline
    const pipeline = this.device!.createRenderPipeline({
      layout: this.device!.createPipelineLayout({
        bindGroupLayouts: [shader.bindGroupLayout]
      }),
      vertex: {
        module: shader.shaderModule,
        entryPoint: 'vs_main',
        buffers: vertexBuffers
      },
      fragment: {
        module: shader.shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: this.preferredFormat,
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
        cullMode: 'back',
        frontFace: 'ccw'
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus'
      }
    });

    // Cache it
    this.pipelineCache.set(cacheKey, { pipeline, vertexLayoutHash });

    return pipeline;
  }

  private mapAttributeFormat(type: string, size: number): GPUVertexFormat {
    if (type === 'float') {
      switch (size) {
        case 1: return 'float32';
        case 2: return 'float32x2';
        case 3: return 'float32x3';
        case 4: return 'float32x4';
      }
    } else if (type === 'int') {
      switch (size) {
        case 1: return 'sint32';
        case 2: return 'sint32x2';
        case 3: return 'sint32x3';
        case 4: return 'sint32x4';
      }
    } else if (type === 'uint') {
      switch (size) {
        case 1: return 'uint32';
        case 2: return 'uint32x2';
        case 3: return 'uint32x3';
        case 4: return 'uint32x4';
      }
    }
    throw new Error(`Unsupported attribute format: ${type}x${size}`);
  }
}
```

### GPU Timestamp Query Implementation

```typescript
class WebGPUBackend {
  private timestampQuerySet: GPUQuerySet | null = null;
  private timestampBuffer: GPUBuffer | null = null;
  private timestampReadBuffers: GPUBuffer[] = [];
  private currentReadBufferIndex = 0;
  private pendingTimestampReads = new Set<GPUBuffer>();

  private setupTimestampQueries(): void {
    if (!this.hasTimestampQuery) return;

    this.timestampQuerySet = this.device!.createQuerySet({
      type: 'timestamp',
      count: 2 // Start and end of render pass
    });

    this.timestampBuffer = this.device!.createBuffer({
      size: 16, // 2 timestamps × 8 bytes
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
    });

    // Triple buffering for async reads
    for (let i = 0; i < 3; i++) {
      this.timestampReadBuffers.push(this.device!.createBuffer({
        size: 16,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      }));
    }
  }

  private measureGPUTime(commandEncoder: GPUCommandEncoder): void {
    if (!this.hasTimestampQuery || !this.timestampQuerySet) return;

    // Write timestamps
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [...],
      timestampWrites: {
        querySet: this.timestampQuerySet,
        beginningOfPassWriteIndex: 0,
        endOfPassWriteIndex: 1
      }
    });

    // ... render commands ...

    passEncoder.end();

    // Resolve timestamps
    commandEncoder.resolveQuerySet(
      this.timestampQuerySet,
      0, 2,
      this.timestampBuffer!, 0
    );

    // Copy to read buffer (triple buffered)
    const readBuffer = this.timestampReadBuffers[this.currentReadBufferIndex];

    // Skip if buffer still pending
    if (this.pendingTimestampReads.has(readBuffer)) return;

    commandEncoder.copyBufferToBuffer(
      this.timestampBuffer!, 0,
      readBuffer, 0,
      16
    );

    // Submit and read async
    this.device!.queue.onSubmittedWorkDone().then(() => {
      this.pendingTimestampReads.add(readBuffer);

      readBuffer.mapAsync(GPUMapMode.READ).then(() => {
        const times = new BigUint64Array(readBuffer.getMappedRange());
        const startNs = times[0];
        const endNs = times[1];

        // Convert to milliseconds
        this.gpuTimeMs = Number(endNs - startNs) / 1_000_000;

        readBuffer.unmap();
        this.pendingTimestampReads.delete(readBuffer);
      });
    });

    // Advance to next buffer
    this.currentReadBufferIndex = (this.currentReadBufferIndex + 1) % 3;
  }
}
```

### VRAM Tracking Implementation

```typescript
class VRAMProfiler {
  private allocations = new Map<string, Map<string, number>>();
  private totalByCategory = new Map<VRAMCategory, number>();

  allocate(category: VRAMCategory, id: string, bytes: number): void {
    if (!this.allocations.has(category)) {
      this.allocations.set(category, new Map());
    }

    const categoryMap = this.allocations.get(category)!;

    // Update or add allocation
    const oldSize = categoryMap.get(id) || 0;
    categoryMap.set(id, bytes);

    // Update totals
    const currentTotal = this.totalByCategory.get(category) || 0;
    this.totalByCategory.set(category, currentTotal - oldSize + bytes);

    // Check budget
    const totalUsed = this.getTotalUsed();
    if (totalUsed > this.budgetBytes) {
      console.warn(`VRAM budget exceeded: ${totalUsed / 1024 / 1024}MB / ${this.budgetBytes / 1024 / 1024}MB`);

      // Trigger quality reduction or eviction
      this.onBudgetExceeded?.();
    }
  }

  getLargestAllocations(count = 10): Array<{category: VRAMCategory; id: string; bytes: number}> {
    const all: Array<{category: VRAMCategory; id: string; bytes: number}> = [];

    for (const [category, allocMap] of this.allocations) {
      for (const [id, bytes] of allocMap) {
        all.push({ category: category as VRAMCategory, id, bytes });
      }
    }

    return all
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, count);
  }
}
```

### Light Culling Implementation

```typescript
class LightCuller {
  cullLights(lights: LightData[], frustum: Frustum): LightData[] {
    const culled: LightData[] = [];
    const stats = { tested: 0, passed: 0, rejected: 0 };

    for (const light of lights) {
      stats.tested++;

      // Skip lights without position (e.g., ambient)
      if (!light.position) {
        culled.push(light);
        stats.passed++;
        continue;
      }

      // Create bounding volume based on light type
      let boundingVolume: BoundingSphere;

      switch (light.type) {
        case LightType.DIRECTIONAL:
          // Directional lights always pass
          culled.push(light);
          stats.passed++;
          continue;

        case LightType.POINT:
          // Use range as radius
          boundingVolume = new BoundingSphere(
            light.position,
            light.range || 100
          );
          break;

        case LightType.SPOT:
          // Conservative sphere around cone
          const range = light.range || 100;
          const halfAngle = (light.outerCone || 45) * Math.PI / 180;
          const radius = range * Math.sin(halfAngle) + range;
          boundingVolume = new BoundingSphere(light.position, radius);
          break;
      }

      // Test against frustum
      if (frustum.intersectsSphere(boundingVolume)) {
        culled.push(light);
        stats.passed++;
      } else {
        stats.rejected++;
      }
    }

    this.lastStats = stats;
    return culled;
  }
}
```

### Texture Atlas Packing Algorithm

```typescript
class TextureAtlas {
  private packingAlgorithm = 'maxrects'; // or 'shelf', 'skyline'

  private findBestFit(width: number, height: number): AtlasRegion | null {
    switch (this.packingAlgorithm) {
      case 'maxrects':
        return this.maxRectsBestShortSideFit(width, height);
      case 'shelf':
        return this.shelfNextFit(width, height);
      case 'skyline':
        return this.skylineBottomLeft(width, height);
    }
  }

  private maxRectsBestShortSideFit(w: number, h: number): AtlasRegion | null {
    let bestShortSide = Infinity;
    let bestLongSide = Infinity;
    let bestRect: Rectangle | null = null;

    for (const rect of this.freeRects) {
      // Try both orientations
      for (const [width, height] of [[w, h], [h, w]]) {
        if (width <= rect.width && height <= rect.height) {
          const leftoverX = rect.width - width;
          const leftoverY = rect.height - height;
          const shortSide = Math.min(leftoverX, leftoverY);
          const longSide = Math.max(leftoverX, leftoverY);

          if (shortSide < bestShortSide ||
              (shortSide === bestShortSide && longSide < bestLongSide)) {
            bestShortSide = shortSide;
            bestLongSide = longSide;
            bestRect = {
              x: rect.x,
              y: rect.y,
              width,
              height,
              rotated: (width === h && height === w)
            };
          }
        }
      }
    }

    if (bestRect) {
      this.splitFreeRect(bestRect);
      return this.createRegion(bestRect);
    }

    return null;
  }
}
```

## Performance Profiling Integration

### Frame Budget Monitoring
```typescript
class RenderingEngine {
  private frameBudget = 16.67; // 60 FPS target
  private budgetWarnings = 0;
  private qualityTier: 'ultra' | 'high' | 'medium' | 'low' = 'high';

  private monitorFrameBudget(frameTime: number): void {
    if (frameTime > this.frameBudget) {
      this.budgetWarnings++;

      // Auto-adjust quality after 10 consecutive warnings
      if (this.budgetWarnings > 10) {
        this.reduceQuality();
        this.budgetWarnings = 0;
      }
    } else {
      this.budgetWarnings = Math.max(0, this.budgetWarnings - 1);
    }
  }

  private reduceQuality(): void {
    switch (this.qualityTier) {
      case 'ultra':
        this.qualityTier = 'high';
        this.applyShadowLOD(1);
        this.reduceTextureResolution(0.75);
        break;
      case 'high':
        this.qualityTier = 'medium';
        this.applyShadowLOD(2);
        this.reduceTextureResolution(0.5);
        this.disablePostProcessing();
        break;
      case 'medium':
        this.qualityTier = 'low';
        this.applyShadowLOD(3);
        this.disableShadows();
        this.reduceLightCount(8);
        break;
    }

    console.warn(`Quality reduced to ${this.qualityTier} due to performance`);
  }
}
```

## Thread Safety & Concurrency

### Web Worker Integration
```typescript
// Physics in worker thread
class PhysicsWorkerProxy {
  private worker: Worker;
  private pendingCallbacks = new Map<number, (result: any) => void>();
  private nextId = 0;

  constructor() {
    this.worker = new Worker('physics.worker.js');
    this.worker.onmessage = (e) => {
      const { id, result } = e.data;
      this.pendingCallbacks.get(id)?.(result);
      this.pendingCallbacks.delete(id);
    };
  }

  async simulate(deltaTime: number, bodies: PhysicsBody[]): Promise<PhysicsBody[]> {
    return new Promise((resolve) => {
      const id = this.nextId++;
      this.pendingCallbacks.set(id, resolve);

      // Transfer arrays for zero-copy
      const positions = new Float32Array(bodies.length * 3);
      const velocities = new Float32Array(bodies.length * 3);

      // Pack data
      for (let i = 0; i < bodies.length; i++) {
        positions.set(bodies[i].position, i * 3);
        velocities.set(bodies[i].velocity, i * 3);
      }

      // Transfer ownership to worker
      this.worker.postMessage({
        id,
        command: 'simulate',
        deltaTime,
        positions,
        velocities
      }, [positions.buffer, velocities.buffer]);
    });
  }
}
```

## Error Recovery & Resilience

### Device Loss Handling
```typescript
class WebGPUBackend {
  private async handleDeviceLoss(): Promise<void> {
    console.warn('WebGPU device lost, attempting recovery...');

    // Save current state
    const savedState = this.captureState();

    // Clean up old resources
    this.cleanup();

    // Re-initialize
    let retries = 3;
    while (retries > 0) {
      try {
        await this.initialize(this.lastConfig);
        await this.restoreState(savedState);
        console.log('Device recovery successful');
        return;
      } catch (e) {
        retries--;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    throw new Error('Device recovery failed after 3 attempts');
  }

  private captureState(): RenderState {
    return {
      shaders: Array.from(this.shaders.keys()),
      textures: Array.from(this.textures.entries()).map(([id, tex]) => ({
        id,
        width: tex.width,
        height: tex.height
      })),
      buffers: Array.from(this.buffers.entries()).map(([id, buf]) => ({
        id,
        type: buf.type,
        size: buf.size
      }))
    };
  }

  private async restoreState(state: RenderState): Promise<void> {
    // Re-create shaders
    for (const shaderId of state.shaders) {
      // Re-compile from cache
      await this.recompileShader(shaderId);
    }

    // Re-create buffers
    for (const bufferInfo of state.buffers) {
      // Allocate new buffer
      this.createBuffer(bufferInfo.id, new ArrayBuffer(bufferInfo.size), bufferInfo.type);
    }

    // Re-upload textures
    for (const textureInfo of state.textures) {
      // Re-create texture (data needs to be cached separately)
      this.createTexture(textureInfo.id, textureInfo.width, textureInfo.height);
    }
  }
}
```

---

*This document provides implementation details and advanced usage patterns for the Miskatonic rendering engine API.*
*Generated: November 2025*