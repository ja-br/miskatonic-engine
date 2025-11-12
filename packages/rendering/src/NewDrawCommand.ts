/**
 * New DrawCommand Interface for Epic 3.14
 *
 * Proper WebGPU-aligned structure with bind groups, storage buffers, and compute support.
 * This REPLACES the old DrawCommand interface.
 */

import type {
  BackendShaderHandle,
  BackendBufferHandle,
  BackendBindGroupHandle,
  BackendPipelineHandle,
} from './backends/IRendererBackend';

/**
 * Bind group entry - one resource binding
 */
export interface BindGroupEntry {
  binding: number;
  resource: BackendBufferHandle | { texture: any; sampler?: any };
}

/**
 * New DrawCommand - WebGPU-aligned structure
 */
export interface NewDrawCommand {
  type: 'draw' | 'drawIndexed' | 'drawIndirect' | 'compute';

  // Pipeline state
  pipeline: BackendPipelineHandle;

  // Bind groups (WebGPU style)
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

  // Compute specific
  workgroupsX?: number;
  workgroupsY?: number;
  workgroupsZ?: number;
}

/**
 * Type guard for NewDrawCommand
 */
export function isNewDrawCommand(cmd: any): cmd is NewDrawCommand {
  return (
    cmd &&
    typeof cmd === 'object' &&
    ('type' in cmd) &&
    (cmd.type === 'draw' || cmd.type === 'drawIndexed' || cmd.type === 'drawIndirect' || cmd.type === 'compute') &&
    ('pipeline' in cmd) &&
    ('bindGroups' in cmd)
  );
}
