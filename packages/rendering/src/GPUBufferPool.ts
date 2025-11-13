/**
 * Epic 3.8: GPU Memory Management - Buffer Pool
 *
 * GPUBufferPool manages reusable GPU buffers with power-of-2 bucketing.
 * Eliminates buffer allocation overhead by reusing buffers from pools.
 *
 * Performance targets:
 * - <5 buffer reallocations per frame
 * - Zero allocation overhead for pooled buffers
 * - Automatic cleanup of unused buffers
 */

export enum BufferUsageType {
  VERTEX = 'vertex',
  INDEX = 'index',
  UNIFORM = 'uniform',
  STORAGE = 'storage',
  INSTANCE = 'instance',
}

export interface BufferPoolStats {
  totalBuffers: number;
  totalBytes: number;
  byUsage: Map<BufferUsageType, {
    buffers: number;
    bytes: number;
    allocations: number;
    reuses: number;
  }>;
  reallocationsThisFrame: number;
}

interface PooledBuffer {
  buffer: GPUBuffer;
  sizeBytes: number;
  usage: BufferUsageType;
  lastUsedFrame: number;
  bufferId: number; // Track buffer ID for debugging
}

/**
 * GPUBufferPool - Reusable GPU buffer allocation with power-of-2 bucketing
 *
 * Usage:
 * ```typescript
 * const pool = new GPUBufferPool();
 * const buffer = pool.acquire(device, BufferUsageType.VERTEX, 1024);
 * // ... use buffer ...
 * pool.release(buffer, BufferUsageType.VERTEX, 1024);
 *
 * // Device loss handling:
 * device.lost.then(() => pool.handleDeviceLoss());
 * ```
 */
export class GPUBufferPool {
  // Pools: Map<usage, Map<bucketSize, PooledBuffer[]>>
  private pools = new Map<BufferUsageType, Map<number, PooledBuffer[]>>();

  private stats = {
    totalBuffers: 0,
    totalBytes: 0,
    byUsage: new Map<BufferUsageType, {
      buffers: number;
      bytes: number;
      allocations: number;
      reuses: number;
    }>(),
    reallocationsThisFrame: 0,
  };

  private currentFrame = 0;
  private maxUnusedFrames = 300; // ~5 seconds at 60 FPS

  // Power-of-2 buckets from 256 bytes to 16MB
  private readonly MIN_BUCKET_SIZE = 256;
  private readonly MAX_BUCKET_SIZE = 16 * 1024 * 1024; // 16MB

  // Track buffer IDs and device loss
  private nextBufferId = 1;
  private bufferToId = new Map<GPUBuffer, number>(); // Regular Map instead of WeakMap
  private deviceLost = false;

  constructor() {
    // Initialize usage stats
    for (const usage of Object.values(BufferUsageType)) {
      this.stats.byUsage.set(usage as BufferUsageType, {
        buffers: 0,
        bytes: 0,
        allocations: 0,
        reuses: 0,
      });
    }
  }

  /**
   * Acquire a buffer from the pool
   * Returns a buffer >= requestedSize (rounded up to power-of-2)
   */
  acquire(device: GPUDevice, usage: BufferUsageType, requestedSize: number): GPUBuffer {
    if (this.deviceLost) {
      throw new Error('GPUBufferPool: Cannot acquire buffer after device loss');
    }

    const bucketSize = this.findBucket(requestedSize);

    // Get or create usage pool
    if (!this.pools.has(usage)) {
      this.pools.set(usage, new Map());
    }
    const usagePool = this.pools.get(usage)!;

    // Get or create bucket pool
    if (!usagePool.has(bucketSize)) {
      usagePool.set(bucketSize, []);
    }
    const bucketPool = usagePool.get(bucketSize)!;

    const usageStats = this.stats.byUsage.get(usage)!;

    // Try to reuse existing buffer
    if (bucketPool.length > 0) {
      const pooled = bucketPool.pop()!;
      pooled.lastUsedFrame = this.currentFrame;
      usageStats.reuses++;
      return pooled.buffer;
    }

    // Allocate new GPUBuffer
    const gpuUsage = this.getGPUBufferUsage(usage);
    const buffer = device.createBuffer({
      label: `Pool: ${usage} (${bucketSize} bytes)`,
      size: bucketSize,
      usage: gpuUsage,
    });

    // Track buffer ID
    const bufferId = this.nextBufferId++;
    this.bufferToId.set(buffer, bufferId);

    // Update stats
    this.stats.totalBuffers++;
    this.stats.totalBytes += bucketSize;
    this.stats.reallocationsThisFrame++;
    usageStats.buffers++;
    usageStats.bytes += bucketSize;
    usageStats.allocations++;

    return buffer;
  }

  /**
   * Convert BufferUsageType to GPUBufferUsage flags
   */
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
        return GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST; // Instance buffers are vertex buffers
      default:
        throw new Error(`Unknown buffer usage type: ${usage}`);
    }
  }

  /**
   * Release a buffer back to the pool for reuse
   */
  release(buffer: GPUBuffer, usage: BufferUsageType, requestedSize: number): void {
    if (this.deviceLost) {
      // Device lost - just destroy the buffer, don't pool it
      try {
        buffer.destroy();
      } catch (e) {
        // Buffer may already be destroyed
      }
      return;
    }

    const bucketSize = this.findBucket(requestedSize);

    // Ensure usage pool exists
    let usagePool = this.pools.get(usage);
    if (!usagePool) {
      usagePool = new Map();
      this.pools.set(usage, usagePool);
    }

    // Ensure bucket pool exists
    let bucketPool = usagePool.get(bucketSize);
    if (!bucketPool) {
      bucketPool = [];
      usagePool.set(bucketSize, bucketPool);
    }

    // Get buffer ID (should exist if this buffer came from acquire())
    const bufferId = this.bufferToId.get(buffer) ?? 0;

    bucketPool.push({
      buffer,
      sizeBytes: bucketSize,
      usage,
      lastUsedFrame: this.currentFrame,
      bufferId,
    });
  }

  /**
   * Advance to next frame and cleanup unused buffers
   * Call this once per frame (e.g., in game loop)
   */
  nextFrame(): void {
    this.currentFrame++;
    this.stats.reallocationsThisFrame = 0;

    // Cleanup buffers unused for maxUnusedFrames
    this.cleanup();
  }

  /**
   * Remove buffers that haven't been used recently
   */
  private cleanup(): void {
    const threshold = this.currentFrame - this.maxUnusedFrames;

    for (const [usage, usagePool] of this.pools.entries()) {
      for (const [bucketSize, bucketPool] of usagePool.entries()) {
        // Separate old buffers from kept buffers
        const kept: PooledBuffer[] = [];
        const toDestroy: PooledBuffer[] = [];

        for (const pooled of bucketPool) {
          if (pooled.lastUsedFrame >= threshold) {
            kept.push(pooled);
          } else {
            toDestroy.push(pooled);
          }
        }

        const removed = toDestroy.length;

        if (removed > 0) {
          // Destroy old GPU buffers
          for (const pooled of toDestroy) {
            try {
              pooled.buffer.destroy();
              this.bufferToId.delete(pooled.buffer);
            } catch (e) {
              // Buffer may already be destroyed
              console.warn('GPUBufferPool: Error destroying buffer during cleanup', e);
            }
          }

          // Update stats
          this.stats.totalBuffers -= removed;
          this.stats.totalBytes -= removed * bucketSize;

          const usageStats = this.stats.byUsage.get(usage)!;
          usageStats.buffers -= removed;
          usageStats.bytes -= removed * bucketSize;

          // Update pool
          usagePool.set(bucketSize, kept);
        }
      }
    }
  }

  /**
   * Find the appropriate power-of-2 bucket size for requested size
   */
  private findBucket(sizeBytes: number): number {
    if (sizeBytes <= this.MIN_BUCKET_SIZE) {
      return this.MIN_BUCKET_SIZE;
    }

    if (sizeBytes >= this.MAX_BUCKET_SIZE) {
      return this.MAX_BUCKET_SIZE;
    }

    // Round up to next power of 2
    return Math.pow(2, Math.ceil(Math.log2(sizeBytes)));
  }

  /**
   * Get current pool statistics
   */
  getStats(): BufferPoolStats {
    return {
      totalBuffers: this.stats.totalBuffers,
      totalBytes: this.stats.totalBytes,
      byUsage: new Map(this.stats.byUsage),
      reallocationsThisFrame: this.stats.reallocationsThisFrame,
    };
  }

  /**
   * Clear all pooled buffers
   * Use sparingly (e.g., when switching scenes)
   */
  clear(): void {
    // Destroy all pooled GPU buffers
    for (const [_usage, usagePool] of this.pools.entries()) {
      for (const [_bucketSize, bucketPool] of usagePool.entries()) {
        for (const pooled of bucketPool) {
          try {
            pooled.buffer.destroy();
            this.bufferToId.delete(pooled.buffer);
          } catch (e) {
            // Buffer may already be destroyed
            console.warn('GPUBufferPool: Error destroying buffer during clear', e);
          }
        }
      }
    }

    this.pools.clear();
    this.bufferToId.clear();
    this.stats.totalBuffers = 0;
    this.stats.totalBytes = 0;
    this.stats.reallocationsThisFrame = 0;

    for (const stats of this.stats.byUsage.values()) {
      stats.buffers = 0;
      stats.bytes = 0;
      stats.allocations = 0;
      stats.reuses = 0;
    }
  }

  /**
   * Get total memory used by pool (in bytes)
   */
  getTotalMemory(): number {
    return this.stats.totalBytes;
  }

  /**
   * Get memory used by specific usage type (in bytes)
   */
  getMemoryByUsage(usage: BufferUsageType): number {
    return this.stats.byUsage.get(usage)?.bytes ?? 0;
  }

  /**
   * Handle device loss - mark pool as invalid and clear all buffers
   * Call this when GPUDevice.lost promise resolves
   */
  handleDeviceLoss(): void {
    this.deviceLost = true;
    this.clear(); // Destroys all buffers and clears tracking
  }

  /**
   * Get buffer ID for debugging
   */
  getBufferId(buffer: GPUBuffer): number | undefined {
    return this.bufferToId.get(buffer);
  }
}
