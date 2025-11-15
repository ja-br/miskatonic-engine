/**
 * WebGPU Timestamp Profiler - Epic RENDERING-05
 *
 * Handles GPU timestamp query management for performance profiling.
 * Extracted from WebGPUBackend to reduce file size.
 */

import type { WebGPUContext } from './WebGPUTypes';

export class WebGPUTimestampProfiler {
  private querySet: GPUQuerySet | null = null;
  private buffer: GPUBuffer | null = null;
  private readBuffers: GPUBuffer[] = [];
  private currentReadBufferIndex: number = 0;
  private gpuTimeMs: number = 0;
  private pendingReads: Set<GPUBuffer> = new Set();

  constructor(
    private ctx: WebGPUContext,
    private enabled: boolean
  ) {}

  /**
   * Initialize timestamp query resources
   */
  initialize(): void {
    if (!this.enabled || !this.ctx.device) {
      return;
    }

    this.querySet = this.ctx.device.createQuerySet({
      type: 'timestamp',
      count: 2,
    });

    this.buffer = this.ctx.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });

    for (let i = 0; i < 3; i++) {
      this.readBuffers.push(this.ctx.device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      }));
    }
  }

  /**
   * Find next available timestamp read buffer
   */
  private findAvailableBuffer(): GPUBuffer | null {
    for (let i = 0; i < this.readBuffers.length; i++) {
      const bufferIndex = (this.currentReadBufferIndex + i) % this.readBuffers.length;
      const buffer = this.readBuffers[bufferIndex];
      if (!this.pendingReads.has(buffer)) {
        this.currentReadBufferIndex = (bufferIndex + 1) % this.readBuffers.length;
        return buffer;
      }
    }
    return null;
  }

  /**
   * Read timestamp data from GPU buffer
   */
  private async readTimestamps(buffer: GPUBuffer): Promise<void> {
    try {
      await buffer.mapAsync(GPUMapMode.READ);
      const arrayBuffer = buffer.getMappedRange();
      const timestamps = new BigUint64Array(arrayBuffer);
      const gpuTimeNs = Number(timestamps[1] - timestamps[0]);
      this.gpuTimeMs = gpuTimeNs / 1_000_000;
    } catch (error) {
      if (Math.random() < 0.01) {
        console.warn('Timestamp read failed (expected occasionally):', error);
      }
    } finally {
      try {
        buffer.unmap();
      } catch (e) {
        // Buffer might not be mapped
      }
      this.pendingReads.delete(buffer);
    }
  }

  /**
   * Submit command buffer with timestamp profiling
   * Falls back to simple submit if timestamps not available
   */
  resolveAndSubmit(): void {
    if (!this.ctx.device || !this.ctx.commandEncoder) {
      return;
    }

    // Simple submit if timestamps not available
    if (!this.querySet || !this.buffer) {
      const commandBuffer = this.ctx.commandEncoder.finish();
      this.ctx.device.queue.submit([commandBuffer]);
      this.ctx.commandEncoder = null;
      return;
    }

    // Resolve query set
    this.ctx.commandEncoder.resolveQuerySet(
      this.querySet,
      0,
      2,
      this.buffer,
      0
    );

    const targetBuffer = this.findAvailableBuffer();

    if (targetBuffer) {
      // Copy to read buffer and submit
      this.ctx.commandEncoder.copyBufferToBuffer(
        this.buffer,
        0,
        targetBuffer,
        0,
        16
      );

      const commandBuffer = this.ctx.commandEncoder.finish();
      this.ctx.device.queue.submit([commandBuffer]);
      this.ctx.commandEncoder = null;

      this.pendingReads.add(targetBuffer);
      this.readTimestamps(targetBuffer);
    } else {
      // No available buffer, submit without reading
      const commandBuffer = this.ctx.commandEncoder.finish();
      this.ctx.device.queue.submit([commandBuffer]);
      this.ctx.commandEncoder = null;
    }
  }

  /**
   * Get latest GPU time measurement in milliseconds
   */
  getGPUTime(): number {
    return this.gpuTimeMs;
  }

  /**
   * Check if profiling is enabled and initialized
   */
  isEnabled(): boolean {
    return this.enabled && this.querySet !== null;
  }
}
