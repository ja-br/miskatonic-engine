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
  buffer: ArrayBuffer;
  sizeBytes: number;
  usage: BufferUsageType;
  lastUsedFrame: number;
}

/**
 * GPUBufferPool - Reusable buffer allocation with power-of-2 bucketing
 *
 * Usage:
 * ```typescript
 * const pool = new GPUBufferPool();
 * const buffer = pool.acquire(BufferUsageType.VERTEX, 1024);
 * // ... use buffer ...
 * pool.release(buffer);
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
  acquire(usage: BufferUsageType, requestedSize: number): ArrayBuffer {
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

    // Allocate new buffer
    const buffer = new ArrayBuffer(bucketSize);
    this.stats.totalBuffers++;
    this.stats.totalBytes += bucketSize;
    this.stats.reallocationsThisFrame++;
    usageStats.buffers++;
    usageStats.bytes += bucketSize;
    usageStats.allocations++;

    return buffer;
  }

  /**
   * Release a buffer back to the pool for reuse
   */
  release(buffer: ArrayBuffer, usage: BufferUsageType): void {
    const bucketSize = this.findBucket(buffer.byteLength);

    const usagePool = this.pools.get(usage);
    if (!usagePool) {
      console.warn(`GPUBufferPool: Cannot release buffer with unknown usage: ${usage}`);
      return;
    }

    const bucketPool = usagePool.get(bucketSize);
    if (!bucketPool) {
      console.warn(`GPUBufferPool: Cannot release buffer with unknown bucket: ${bucketSize}`);
      return;
    }

    bucketPool.push({
      buffer,
      sizeBytes: bucketSize,
      usage,
      lastUsedFrame: this.currentFrame,
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
        const before = bucketPool.length;

        // Filter out old buffers
        const kept = bucketPool.filter(pooled => pooled.lastUsedFrame >= threshold);
        const removed = before - kept.length;

        if (removed > 0) {
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
    this.pools.clear();
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
}
