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
   * Configure indexed geometry.
   * Draws using an index buffer to reference vertices.
   *
   * @param vertexBuffers - Map of vertex buffers by slot number
   * @param indexBuffer - Index buffer handle
   * @param indexFormat - Format of indices ('uint16' or 'uint32')
   * @param indexCount - Number of indices to draw
   */
  indexed(
    vertexBuffers: Map<number, BackendBufferHandle>,
    indexBuffer: BackendBufferHandle,
    indexFormat: 'uint16' | 'uint32',
    indexCount: number
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

    if (indexCount <= 0) {
      throw new Error(`Index count must be positive, got ${indexCount}`);
    }

    // Note: Cannot validate indexFormat against buffer contents at command creation time
    // Validation must occur at render time when buffer contents are known

    this.command.geometry = {
      type: 'indexed',
      vertexBuffers,
      indexBuffer,
      indexFormat,
      indexCount
    };
    this.geometrySet = true;
    return this;
  }

  /**
   * Configure non-indexed geometry.
   * Draws vertices sequentially without an index buffer.
   *
   * @param vertexBuffers - Map of vertex buffers by slot number
   * @param vertexCount - Number of vertices to draw
   */
  nonIndexed(vertexBuffers: Map<number, BackendBufferHandle>, vertexCount: number): this {
    if (this.geometrySet) {
      throw new Error(
        `Geometry already configured as '${this.command.geometry!.type}'. ` +
        `Cannot call multiple geometry methods. Use a new builder instance.`
      );
    }

    if (vertexBuffers.size === 0) {
      throw new Error('At least one vertex buffer is required');
    }

    if (vertexCount <= 0) {
      throw new Error(`Vertex count must be positive, got ${vertexCount}`);
    }

    this.command.geometry = {
      type: 'nonIndexed',
      vertexBuffers,
      vertexCount
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

    const result = this.command as DrawCommand;

    // Reset builder to prevent accidental reuse
    this.command = { bindGroups: new Map() };
    this.geometrySet = false;

    return result;
  }
}
