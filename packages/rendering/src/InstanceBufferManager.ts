/**
 * InstanceBufferManager - Epic 3.13
 *
 * Manages GPU buffers for instance rendering.
 * Handles buffer creation, upload, and binding for both WebGL2 and WebGPU.
 */

import type { IRendererBackend, BackendBufferHandle } from './backends';
import type { InstanceBuffer } from './InstanceBuffer';

/**
 * GPU instance buffer handle
 *
 * Wraps backend buffer handle with instance-specific metadata
 */
export interface GPUInstanceBuffer {
  /**
   * Backend buffer handle (GPU-side)
   */
  handle: BackendBufferHandle;

  /**
   * Instance capacity (max instances this buffer can hold)
   */
  capacity: number;

  /**
   * Current instance count
   */
  count: number;

  /**
   * Buffer ID for identification
   */
  id: string;
}

/**
 * Instance buffer manager
 *
 * Bridges CPU-side InstanceBuffer and GPU-side backend buffers
 */
export class InstanceBufferManager {
  private gpuBuffers = new Map<InstanceBuffer, GPUInstanceBuffer>();
  private nextBufferId = 0;

  constructor(private backend: IRendererBackend) {}

  /**
   * Upload instance buffer to GPU
   *
   * Creates or updates GPU buffer with instance data.
   *
   * @param instanceBuffer - CPU-side instance buffer
   * @returns GPU buffer handle
   */
  upload(instanceBuffer: InstanceBuffer): GPUInstanceBuffer {
    // Check if buffer already exists on GPU
    let gpuBuffer = this.gpuBuffers.get(instanceBuffer);

    const data = instanceBuffer.getData();
    const count = instanceBuffer.getCount();
    const capacity = instanceBuffer.getCapacity();

    // Re-create buffer if capacity changed (resize occurred)
    if (gpuBuffer && gpuBuffer.capacity !== capacity) {
      // console.log(`[InstanceBufferManager] Capacity changed: ${gpuBuffer.capacity} -> ${capacity}, re-creating buffer`);
      this.backend.deleteBuffer(gpuBuffer.handle);
      this.gpuBuffers.delete(instanceBuffer);
      gpuBuffer = undefined;
    }

    // Create new buffer if needed
    if (!gpuBuffer) {
      const id = `instance_buffer_${this.nextBufferId++}`;
      // console.log(`[InstanceBufferManager] Creating NEW GPU buffer: ${id}, capacity=${capacity}`);
      const handle = this.backend.createBuffer(
        id,
        'vertex',
        data,
        'dynamic_draw' // Dynamic because instances change every frame
      );

      gpuBuffer = {
        handle,
        capacity,
        count,
        id,
      };

      this.gpuBuffers.set(instanceBuffer, gpuBuffer);
    } else {
      // Update existing buffer if dirty
      if (instanceBuffer.isDirty()) {
        this.backend.updateBuffer(gpuBuffer.handle, data);
        gpuBuffer.count = count;
      }
    }

    // Mark buffer as clean after upload
    instanceBuffer.markClean();

    return gpuBuffer;
  }

  /**
   * Release instance buffer (mark as ready, don't delete)
   *
   * Call this after rendering is complete to mark buffer as ready for reuse.
   * The GPU buffer remains allocated for next frame.
   *
   * @param instanceBuffer - Instance buffer to release
   */
  release(instanceBuffer: InstanceBuffer): void {
    instanceBuffer.markReady();
  }

  /**
   * Delete GPU buffer
   *
   * @param instanceBuffer - CPU-side instance buffer
   */
  delete(instanceBuffer: InstanceBuffer): void {
    const gpuBuffer = this.gpuBuffers.get(instanceBuffer);
    if (gpuBuffer) {
      this.backend.deleteBuffer(gpuBuffer.handle);
      this.gpuBuffers.delete(instanceBuffer);
    }
  }

  /**
   * Get GPU buffer for instance buffer
   *
   * @param instanceBuffer - CPU-side instance buffer
   * @returns GPU buffer handle or undefined
   */
  get(instanceBuffer: InstanceBuffer): GPUInstanceBuffer | undefined {
    return this.gpuBuffers.get(instanceBuffer);
  }

  /**
   * Clear all GPU buffers
   */
  clear(): void {
    const buffers = Array.from(this.gpuBuffers.values());
    for (let i = 0; i < buffers.length; i++) {
      this.backend.deleteBuffer(buffers[i].handle);
    }
    this.gpuBuffers.clear();
  }

  /**
   * Get total GPU memory usage
   *
   * @returns Memory usage in bytes
   */
  getGPUMemoryUsage(): number {
    let total = 0;
    const buffers = Array.from(this.gpuBuffers.values());
    for (let i = 0; i < buffers.length; i++) {
      // Each instance = mat4 = 16 floats = 64 bytes
      total += buffers[i].capacity * 64;
    }
    return total;
  }
}
