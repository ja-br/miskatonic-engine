import type {
  DrawCommand,
  IndexedGeometry,
  NonIndexedGeometry,
  DrawDebugInfo
} from './DrawCommand';
import type { BackendPipelineHandle, BackendBindGroupHandle, BackendBufferHandle } from '../backends/IRendererBackend';
import { validateWorkgroups } from './DrawCommand';

/**
 * Fluent builder for creating DrawCommand objects.
 * Provides type-safe, ergonomic API for constructing draw commands.
 *
 * @example
 * ```typescript
 * const command = new DrawCommandBuilder()
 *   .pipeline(pipelineHandle)
 *   .bindGroup(0, sceneBindGroup)
 *   .bindGroup(1, materialBindGroup)
 *   .indexed([vertexBuffer], indexBuffer, 'uint16', 36)
 *   .build();
 * ```
 */
export class DrawCommandBuilder {
  private command: Partial<DrawCommand> = {
    bindGroups: new Map()
  };
  private geometrySet = false;

  /**
   * Set the render pipeline.
   */
  pipeline(handle: BackendPipelineHandle): this {
    this.command.pipeline = handle;
    return this;
  }

  /**
   * Add a bind group at the specified slot.
   * @param slot - Bind group slot (0-3)
   * @param handle - Bind group handle
   */
  bindGroup(slot: number, handle: BackendBindGroupHandle): this {
    if (slot < 0 || slot > 3) {
      throw new Error(`Bind group slot must be 0-3, got ${slot}`);
    }
    this.command.bindGroups!.set(slot, handle);
    return this;
  }

  /**
   * Add multiple bind groups at once.
   * Epic RENDERING-06 Task 6.3: Batch bind group setting
   *
   * @param groups - Map of slot to bind group handle
   * @example
   * ```typescript
   * builder.bindGroups(new Map([
   *   [0, sceneBindGroup],
   *   [1, materialBindGroup]
   * ]))
   * ```
   */
  bindGroups(groups: Map<number, BackendBindGroupHandle>): this {
    for (const [slot, handle] of groups) {
      this.bindGroup(slot, handle); // Reuse validation
    }
    return this;
  }

  /**
   * Configure indexed geometry.
   * Draws using an index buffer to reference vertices.
   * Epic RENDERING-06 Task 6.3: Enhanced with array support and options object
   *
   * @param vertexBuffers - Map or array of vertex buffers
   * @param indexBuffer - Index buffer handle
   * @param indexFormat - Format of indices ('uint16' or 'uint32')
   * @param indexCount - Number of indices to draw
   * @param options - Optional parameters
   */
  indexed(
    vertexBuffers: Map<number, BackendBufferHandle> | BackendBufferHandle[],
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
    if (this.geometrySet) {
      throw new Error(
        `Geometry already configured as '${this.command.geometry!.type}'. ` +
        `Cannot call multiple geometry methods. Use a new builder instance.`
      );
    }

    // Convert array to Map if needed
    const bufferMap = Array.isArray(vertexBuffers)
      ? new Map(vertexBuffers.map((buf, idx) => [idx, buf]))
      : vertexBuffers;

    if (bufferMap.size === 0) {
      throw new Error('At least one vertex buffer is required');
    }

    if (indexCount <= 0) {
      throw new Error(`Index count must be positive, got ${indexCount}`);
    }

    // Note: Cannot validate indexFormat against buffer contents at command creation time
    // Validation must occur at render time when buffer contents are known

    this.command.geometry = {
      type: 'indexed',
      vertexBuffers: bufferMap,
      indexBuffer,
      indexFormat,
      indexCount,
      ...options
    };
    this.geometrySet = true;
    return this;
  }

  /**
   * Configure non-indexed geometry.
   * Draws vertices sequentially without an index buffer.
   * Epic RENDERING-06 Task 6.3: Enhanced with array support and options object
   *
   * @param vertexBuffers - Map or array of vertex buffers
   * @param vertexCount - Number of vertices to draw
   * @param options - Optional parameters
   */
  nonIndexed(
    vertexBuffers: Map<number, BackendBufferHandle> | BackendBufferHandle[],
    vertexCount: number,
    options?: {
      instanceCount?: number;
      firstVertex?: number;
      firstInstance?: number;
    }
  ): this {
    if (this.geometrySet) {
      throw new Error(
        `Geometry already configured as '${this.command.geometry!.type}'. ` +
        `Cannot call multiple geometry methods. Use a new builder instance.`
      );
    }

    // Convert array to Map if needed
    const bufferMap = Array.isArray(vertexBuffers)
      ? new Map(vertexBuffers.map((buf, idx) => [idx, buf]))
      : vertexBuffers;

    if (bufferMap.size === 0) {
      throw new Error('At least one vertex buffer is required');
    }

    if (vertexCount <= 0) {
      throw new Error(`Vertex count must be positive, got ${vertexCount}`);
    }

    this.command.geometry = {
      type: 'nonIndexed',
      vertexBuffers: bufferMap,
      vertexCount,
      ...options
    };
    this.geometrySet = true;
    return this;
  }

  /**
   * Configure indirect draw.
   * Draw parameters are read from a GPU buffer.
   *
   * @param vertexBuffers - Map of vertex buffers by slot number
   * @param indirectBuffer - Buffer containing draw parameters
   * @param indirectOffset - Byte offset into indirect buffer (must be 4-byte aligned)
   * @param indexBuffer - Optional index buffer for indexed indirect draws
   * @param indexFormat - Format of indices (required if indexBuffer is present)
   */
  indirect(
    vertexBuffers: Map<number, BackendBufferHandle>,
    indirectBuffer: BackendBufferHandle,
    indirectOffset: number,
    indexBuffer?: BackendBufferHandle,
    indexFormat?: 'uint16' | 'uint32'
  ): this {
    if (this.geometrySet) {
      throw new Error(
        `Geometry already configured as '${this.command.geometry!.type}'. ` +
        `Cannot call multiple geometry methods. Use a new builder instance.`
      );
    }

    if (vertexBuffers.size === 0) {
      throw new Error('At least one vertex buffer is required');
    }

    if (indirectOffset < 0) {
      throw new Error(`Indirect offset must be non-negative, got ${indirectOffset}`);
    }

    if (indirectOffset % 4 !== 0) {
      throw new Error(`Indirect offset must be 4-byte aligned, got ${indirectOffset}`);
    }

    // Validate indexFormat when indexBuffer is present
    if (indexBuffer && !indexFormat) {
      throw new Error('indexFormat required when indexBuffer is provided for indexed indirect draws');
    }

    if (!indexBuffer && indexFormat) {
      throw new Error('indexFormat only valid when indexBuffer is provided');
    }

    this.command.geometry = {
      type: 'indirect',
      vertexBuffers,
      indirectBuffer,
      indirectOffset,
      indexBuffer,
      indexFormat
    };
    this.geometrySet = true;
    return this;
  }

  /**
   * Configure compute dispatch.
   * Dispatches compute shader workgroups.
   *
   * @param workgroups - Number of workgroups [x, y, z]
   * @param maxPerDimension - Device limit for workgroups per dimension (optional, for validation)
   */
  compute(workgroups: [number, number, number], maxPerDimension?: number): this {
    if (this.geometrySet) {
      throw new Error('Geometry already set. Cannot call multiple geometry methods.');
    }

    // Validate if limit provided
    if (maxPerDimension !== undefined) {
      validateWorkgroups(workgroups, maxPerDimension);
    }

    this.command.geometry = {
      type: 'compute',
      workgroups
    };
    this.geometrySet = true;
    return this;
  }

  /**
   * Set instance count for instanced rendering.
   * Must be called after geometry configuration.
   */
  instanceCount(count: number): this {
    if (!this.command.geometry) {
      throw new Error('Set geometry before configuring instance count');
    }

    const geom = this.command.geometry;
    if (geom.type === 'indexed' || geom.type === 'nonIndexed') {
      (geom as IndexedGeometry | NonIndexedGeometry).instanceCount = count;
    } else {
      throw new Error('Instance count only valid for indexed/non-indexed geometry');
    }

    return this;
  }

  /**
   * Set first index for indexed draws.
   */
  firstIndex(index: number): this {
    if (!this.command.geometry || this.command.geometry.type !== 'indexed') {
      throw new Error('firstIndex only valid for indexed geometry');
    }
    (this.command.geometry as IndexedGeometry).firstIndex = index;
    return this;
  }

  /**
   * Set base vertex for indexed draws.
   */
  baseVertex(vertex: number): this {
    if (!this.command.geometry || this.command.geometry.type !== 'indexed') {
      throw new Error('baseVertex only valid for indexed geometry');
    }
    (this.command.geometry as IndexedGeometry).baseVertex = vertex;
    return this;
  }

  /**
   * Set first vertex for non-indexed draws.
   */
  firstVertex(vertex: number): this {
    if (!this.command.geometry || this.command.geometry.type !== 'nonIndexed') {
      throw new Error('firstVertex only valid for non-indexed geometry');
    }
    (this.command.geometry as NonIndexedGeometry).firstVertex = vertex;
    return this;
  }

  /**
   * Set first instance for instanced draws.
   */
  firstInstance(instance: number): this {
    if (!this.command.geometry) {
      throw new Error('Set geometry before configuring first instance');
    }

    const geom = this.command.geometry;
    if (geom.type === 'indexed' || geom.type === 'nonIndexed') {
      (geom as IndexedGeometry | NonIndexedGeometry).firstInstance = instance;
    } else {
      throw new Error('firstInstance only valid for indexed/non-indexed geometry');
    }

    return this;
  }

  /**
   * Set debug label for GPU profiling.
   */
  label(label: string): this {
    this.command.label = label;
    return this;
  }

  /**
   * Add debug information for troubleshooting.
   */
  debugInfo(info: DrawDebugInfo): this {
    this.command.debugInfo = info;
    return this;
  }

  /**
   * Build the final DrawCommand.
   * Validates that all required fields are set and prevents builder reuse.
   * Epic RENDERING-06: Clones bindGroups Map to prevent mutation leaks between builds.
   */
  build(): DrawCommand {
    if (!this.command.pipeline) {
      throw new Error('Pipeline is required. Call pipeline() before build().');
    }
    if (!this.command.geometry) {
      throw new Error('No geometry configured. Call indexed/nonIndexed/indirect/compute() before build().');
    }
    if (this.command.bindGroups!.size === 0) {
      console.warn('No bind groups added. Did you forget to call bindGroup()?');
    }

    // Validate geometry-specific requirements
    const geom = this.command.geometry;
    if (geom.type === 'indexed' || geom.type === 'nonIndexed' || geom.type === 'indirect') {
      if (geom.vertexBuffers.size === 0) {
        throw new Error('At least one vertex buffer is required');
      }
    }

    if (geom.type === 'indexed') {
      if (!geom.indexBuffer) {
        throw new Error('Index buffer is required for indexed geometry');
      }
      if (geom.indexCount <= 0) {
        throw new Error(`Index count must be positive, got ${geom.indexCount}`);
      }
    }

    if (geom.type === 'nonIndexed') {
      if (geom.vertexCount <= 0) {
        throw new Error(`Vertex count must be positive, got ${geom.vertexCount}`);
      }
    }

    // Create result with cloned bindGroups Map to prevent mutation leaks
    const result: DrawCommand = {
      pipeline: this.command.pipeline,
      bindGroups: new Map(this.command.bindGroups), // CLONE to prevent shared state
      geometry: this.command.geometry,
      label: this.command.label,
      debugInfo: this.command.debugInfo
    };

    // Reset builder to prevent accidental reuse
    this.command = { bindGroups: new Map() };
    this.geometrySet = false;

    return result;
  }

  // Epic RENDERING-06 Task 6.3: Quick builder static methods

  /**
   * Quick builder for simple indexed draws.
   * Reduces common case from ~10 lines to 1 line.
   *
   * @param pipeline - Render pipeline handle (NOT compute)
   * @param bindGroup - Bind group (will be bound to slot 0)
   * @param vertexBuffer - Single vertex buffer
   * @param indexBuffer - Index buffer
   * @param indexCount - Number of indices
   * @param indexFormat - Format of indices (default: 'uint16')
   * @example
   * ```typescript
   * const cmd = DrawCommandBuilder.quickIndexed(
   *   pipeline, bindGroup, vertexBuf, indexBuf, 36
   * );
   * ```
   */
  static quickIndexed(
    pipeline: BackendPipelineHandle,
    bindGroup: BackendBindGroupHandle,
    vertexBuffer: BackendBufferHandle,
    indexBuffer: BackendBufferHandle,
    indexCount: number,
    indexFormat: 'uint16' | 'uint32' = 'uint16'
  ): DrawCommand {
    if (pipeline.type !== 'render') {
      throw new Error(`quickIndexed requires render pipeline, got ${pipeline.type} pipeline`);
    }
    return new DrawCommandBuilder()
      .pipeline(pipeline)
      .bindGroup(0, bindGroup)
      .indexed([vertexBuffer], indexBuffer, indexFormat, indexCount)
      .build();
  }

  /**
   * Quick builder for simple non-indexed draws.
   * Reduces common case from ~10 lines to 1 line.
   *
   * @param pipeline - Render pipeline handle (NOT compute)
   * @param bindGroup - Bind group (will be bound to slot 0)
   * @param vertexBuffer - Single vertex buffer
   * @param vertexCount - Number of vertices
   * @example
   * ```typescript
   * const cmd = DrawCommandBuilder.quickNonIndexed(
   *   pipeline, bindGroup, vertexBuf, 36
   * );
   * ```
   */
  static quickNonIndexed(
    pipeline: BackendPipelineHandle,
    bindGroup: BackendBindGroupHandle,
    vertexBuffer: BackendBufferHandle,
    vertexCount: number
  ): DrawCommand {
    if (pipeline.type !== 'render') {
      throw new Error(`quickNonIndexed requires render pipeline, got ${pipeline.type} pipeline`);
    }
    return new DrawCommandBuilder()
      .pipeline(pipeline)
      .bindGroup(0, bindGroup)
      .nonIndexed([vertexBuffer], vertexCount)
      .build();
  }

  /**
   * Quick builder for instanced indexed draws.
   * Common pattern for particle systems, crowds, etc.
   *
   * @param pipeline - Render pipeline handle (NOT compute)
   * @param bindGroup - Bind group (will be bound to slot 0)
   * @param vertexBuffer - Single vertex buffer
   * @param indexBuffer - Index buffer
   * @param indexCount - Number of indices per instance
   * @param instanceCount - Number of instances
   * @param indexFormat - Format of indices (default: 'uint16')
   */
  static quickInstanced(
    pipeline: BackendPipelineHandle,
    bindGroup: BackendBindGroupHandle,
    vertexBuffer: BackendBufferHandle,
    indexBuffer: BackendBufferHandle,
    indexCount: number,
    instanceCount: number,
    indexFormat: 'uint16' | 'uint32' = 'uint16'
  ): DrawCommand {
    if (pipeline.type !== 'render') {
      throw new Error(`quickInstanced requires render pipeline, got ${pipeline.type} pipeline`);
    }
    return new DrawCommandBuilder()
      .pipeline(pipeline)
      .bindGroup(0, bindGroup)
      .indexed([vertexBuffer], indexBuffer, indexFormat, indexCount, { instanceCount })
      .build();
  }
}
