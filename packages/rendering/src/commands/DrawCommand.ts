import type { BackendPipelineHandle, BackendBindGroupHandle, BackendBufferHandle } from '../backends/IRendererBackend';

/**
 * Unified draw command interface.
 * Replaces legacy DrawCommand, NewDrawCommand, and ModernDrawCommand.
 *
 * @example
 * ```typescript
 * const command: DrawCommand = {
 *   pipeline,
 *   bindGroups: new Map([[0, sceneBindGroup], [1, materialBindGroup]]),
 *   geometry: {
 *     type: 'indexed',
 *     vertexBuffers: [vertexBuffer],
 *     indexBuffer,
 *     indexFormat: 'uint16',
 *     indexCount: 36
 *   }
 * };
 * ```
 */
export interface DrawCommand {
  /** Render pipeline to use for drawing */
  pipeline: BackendPipelineHandle;

  /** Bind groups mapped by slot number */
  bindGroups: Map<number, BackendBindGroupHandle>;

  /** Geometry configuration (discriminated union) */
  geometry: IndexedGeometry | NonIndexedGeometry | IndirectGeometry | ComputeGeometry;

  /** Optional debug label for GPU profiling */
  label?: string;

  /** Optional debug information for troubleshooting */
  debugInfo?: DrawDebugInfo;
}

/**
 * Indexed geometry draw configuration.
 * Uses an index buffer to reference vertices.
 */
export interface IndexedGeometry {
  type: 'indexed';

  /** Vertex buffers mapped by slot number */
  vertexBuffers: Map<number, BackendBufferHandle>;

  /** Index buffer containing vertex indices */
  indexBuffer: BackendBufferHandle;

  /**
   * Format of indices in the index buffer.
   * Must match the actual buffer data type.
   */
  indexFormat: 'uint16' | 'uint32';

  /** Number of indices to draw */
  indexCount: number;

  /** Number of instances to draw (default: 1) */
  instanceCount?: number;

  /** First index to read from index buffer (default: 0) */
  firstIndex?: number;

  /** Offset added to vertex indices fetched from the index buffer before accessing vertex data (default: 0) */
  baseVertex?: number;

  /** First instance to draw (default: 0) */
  firstInstance?: number;
}

/**
 * Non-indexed geometry draw configuration.
 * Draws vertices sequentially without an index buffer.
 */
export interface NonIndexedGeometry {
  type: 'nonIndexed';

  /** Vertex buffers mapped by slot number */
  vertexBuffers: Map<number, BackendBufferHandle>;

  /** Number of vertices to draw */
  vertexCount: number;

  /** Number of instances to draw (default: 1) */
  instanceCount?: number;

  /** First vertex to draw (default: 0) */
  firstVertex?: number;

  /** First instance to draw (default: 0) */
  firstInstance?: number;
}

/**
 * Indirect draw configuration.
 * Draw parameters are read from a GPU buffer.
 */
export interface IndirectGeometry {
  type: 'indirect';

  /** Vertex buffers mapped by slot number */
  vertexBuffers: Map<number, BackendBufferHandle>;

  /** Optional index buffer (for indexed indirect draws) */
  indexBuffer?: BackendBufferHandle;

  /**
   * Format of indices (required if indexBuffer is present).
   * Must match the actual buffer data type.
   */
  indexFormat?: 'uint16' | 'uint32';

  /** Buffer containing draw parameters */
  indirectBuffer: BackendBufferHandle;

  /** Byte offset into indirect buffer */
  indirectOffset: number;
}

/**
 * Compute dispatch configuration.
 * Dispatches compute shader workgroups.
 */
export interface ComputeGeometry {
  type: 'compute';

  /**
   * Number of workgroups to dispatch in each dimension [x, y, z].
   * Each value must not exceed device.limits.maxComputeWorkgroupsPerDimension.
   * @see https://gpuweb.github.io/gpuweb/#dom-supported-limits-maxcomputeworkgroupsperdimension
   */
  workgroups: [number, number, number];
}

/**
 * Debug information for draw commands.
 * Useful for GPU profiling and error reporting.
 */
export interface DrawDebugInfo {
  /** Unique identifier for this draw call */
  drawCallId?: string;

  /** Render pass this command belongs to */
  pass?: string;

  /** Name of the object being drawn */
  objectName?: string;
}

/**
 * Type guard to check if geometry is indexed.
 */
export function isIndexedGeometry(geometry: DrawCommand['geometry']): geometry is IndexedGeometry {
  return geometry.type === 'indexed';
}

/**
 * Type guard to check if geometry is non-indexed.
 */
export function isNonIndexedGeometry(geometry: DrawCommand['geometry']): geometry is NonIndexedGeometry {
  return geometry.type === 'nonIndexed';
}

/**
 * Type guard to check if geometry is indirect.
 */
export function isIndirectGeometry(geometry: DrawCommand['geometry']): geometry is IndirectGeometry {
  return geometry.type === 'indirect';
}

/**
 * Type guard to check if geometry is compute.
 */
export function isComputeGeometry(geometry: DrawCommand['geometry']): geometry is ComputeGeometry {
  return geometry.type === 'compute';
}

/**
 * Validate index format for buffer size.
 * Note: This cannot validate against actual index VALUES (only known at render time).
 * Use this to validate index buffer allocation size.
 *
 * @param indexFormat - Format of indices
 * @param indexCount - Number of indices in buffer
 * @returns Size in bytes required for index buffer
 */
export function getIndexBufferSize(indexFormat: 'uint16' | 'uint32', indexCount: number): number {
  const bytesPerIndex = indexFormat === 'uint16' ? 2 : 4;
  return indexCount * bytesPerIndex;
}

/**
 * Validate workgroup sizes against device limits.
 * Throws error if any dimension exceeds device limits.
 */
export function validateWorkgroups(
  workgroups: [number, number, number],
  maxPerDimension: number
): void {
  for (let i = 0; i < 3; i++) {
    if (workgroups[i] > maxPerDimension) {
      throw new Error(
        `Workgroup dimension ${i} (${workgroups[i]}) exceeds device limit (${maxPerDimension})`
      );
    }
    if (workgroups[i] < 1) {
      throw new Error(`Workgroup dimension ${i} must be at least 1, got ${workgroups[i]}`);
    }
  }
}
