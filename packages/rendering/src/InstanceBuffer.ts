/**
 * InstanceBuffer - Epic 3.13
 *
 * Manages GPU buffers for per-instance rendering data.
 *
 * Features:
 * - Instance buffer allocation and resizing
 * - Per-instance transform matrices (mat4) + colors (vec4)
 * - Buffer pooling to avoid reallocation
 * - Dirty tracking for efficient updates
 *
 * Performance Targets:
 * - <1ms to update 1000 instances
 * - Zero allocation in hot path (reuse buffers)
 * - <100KB memory overhead for pooling
 *
 * Layout (80 bytes per instance):
 * - Transform (mat4): 16 floats = 64 bytes (offset 0)
 * - Color (vec4):     4 floats  = 16 bytes (offset 64)
 *
 * Usage:
 * ```typescript
 * const instanceBuffer = new InstanceBuffer(1000); // Max 1000 instances
 * instanceBuffer.setInstanceTransform(0, transform1);
 * instanceBuffer.setInstanceColor(0, 1.0, 0.0, 0.0, 1.0);
 * instanceBuffer.upload(gl); // Upload to GPU
 * ```
 */

import { INSTANCE_BUFFER_BUCKETS } from './constants/RenderingConstants.js';

// Stride per instance: mat4 (64 bytes) + vec4 (16 bytes) = 80 bytes
const FLOATS_PER_INSTANCE = 20; // 16 (mat4) + 4 (vec4)
const BYTES_PER_INSTANCE = 80;  // 20 floats * 4 bytes

export interface InstanceData {
  /**
   * Number of instances currently stored
   */
  count: number;

  /**
   * Maximum instances this buffer can hold
   */
  capacity: number;

  /**
   * Packed per-instance data (mat4 + vec4 per instance)
   * Layout: [mat4_0, vec4_color_0, mat4_1, vec4_color_1, ...]
   * Size: capacity * 20 floats * 4 bytes = capacity * 80 bytes
   */
  data: Float32Array;

  /**
   * Dirty flag - true if data changed since last upload
   */
  dirty: boolean;

  /**
   * In-flight flag - true if buffer is currently being used by GPU
   * Prevents modification while GPU is reading
   */
  inFlight: boolean;
}

/**
 * Instance buffer manager
 *
 * Manages a pool of instance buffers for efficient instanced rendering.
 */
export class InstanceBuffer {
  private data: InstanceData;

  /**
   * Create instance buffer
   *
   * @param capacity - Maximum number of instances (default: 1000)
   */
  constructor(capacity: number = 1000) {
    this.data = {
      count: 0,
      capacity,
      data: new Float32Array(capacity * FLOATS_PER_INSTANCE), // mat4 + vec4 = 20 floats
      dirty: false,
      inFlight: false,
    };
  }

  /**
   * Get current instance count
   */
  getCount(): number {
    return this.data.count;
  }

  /**
   * Get buffer capacity
   */
  getCapacity(): number {
    return this.data.capacity;
  }

  /**
   * Get packed instance data
   *
   * @returns Float32Array of instance matrices
   */
  getData(): Float32Array {
    return this.data.data;
  }

  /**
   * Check if buffer needs upload
   */
  isDirty(): boolean {
    return this.data.dirty;
  }

  /**
   * Mark buffer as clean (after upload)
   */
  markClean(): void {
    this.data.dirty = false;
  }

  /**
   * Set transform for specific instance
   *
   * @param index - Instance index (0 to count-1)
   * @param matrix - Transform matrix (mat4, 16 floats)
   */
  setInstanceTransform(index: number, matrix: Float32Array): void {
    if (matrix.length !== 16) {
      throw new Error(`InstanceBuffer: Invalid matrix size ${matrix.length} (expected 16)`);
    }

    if (index < 0 || index >= this.data.capacity) {
      throw new Error(
        `InstanceBuffer: Index ${index} out of bounds (capacity: ${this.data.capacity})`
      );
    }

    // Copy matrix to instance slot (offset by stride)
    const offset = index * FLOATS_PER_INSTANCE;
    this.data.data.set(matrix, offset);

    // Update count if this is a new instance
    if (index >= this.data.count) {
      this.data.count = index + 1;
    }

    this.data.dirty = true;
  }

  /**
   * Set color for specific instance
   *
   * @param index - Instance index (0 to count-1)
   * @param r - Red component (0.0 to 1.0)
   * @param g - Green component (0.0 to 1.0)
   * @param b - Blue component (0.0 to 1.0)
   * @param a - Alpha component (0.0 to 1.0, default: 1.0)
   */
  setInstanceColor(index: number, r: number, g: number, b: number, a: number = 1.0): void {
    if (index < 0 || index >= this.data.capacity) {
      throw new Error(
        `InstanceBuffer: Index ${index} out of bounds (capacity: ${this.data.capacity})`
      );
    }

    // Copy color to instance slot (after mat4, at offset 16)
    const offset = index * FLOATS_PER_INSTANCE + 16;
    this.data.data[offset + 0] = r;
    this.data.data[offset + 1] = g;
    this.data.data[offset + 2] = b;
    this.data.data[offset + 3] = a;

    // Update count if this is a new instance
    if (index >= this.data.count) {
      this.data.count = index + 1;
    }

    this.data.dirty = true;
  }

  /**
   * Set multiple instance transforms at once (optimized bulk operation)
   *
   * @param matrices - Array of transform matrices
   * @param startIndex - Starting instance index (default: 0)
   */
  setInstanceTransforms(matrices: Float32Array[], startIndex: number = 0): void {
    if (startIndex + matrices.length > this.data.capacity) {
      throw new Error(
        `InstanceBuffer.setInstanceTransforms: Cannot fit ${matrices.length} instances starting at ${startIndex} (capacity: ${this.data.capacity})`
      );
    }

    // Validate all matrices first (fail fast)
    for (let i = 0; i < matrices.length; i++) {
      if (matrices[i].length !== 16) {
        throw new Error(`InstanceBuffer.setInstanceTransforms: Invalid matrix at index ${i} (size: ${matrices[i].length}, expected: 16)`);
      }
    }

    // Bulk copy (optimized) - account for stride
    for (let i = 0; i < matrices.length; i++) {
      const offset = (startIndex + i) * FLOATS_PER_INSTANCE;
      this.data.data.set(matrices[i], offset);
    }

    // Update count once
    const endIndex = startIndex + matrices.length;
    if (endIndex > this.data.count) {
      this.data.count = endIndex;
    }

    // Mark dirty once
    this.data.dirty = true;
  }

  /**
   * Clear all instances
   */
  clear(): void {
    if (this.data.inFlight) {
      console.warn('InstanceBuffer: Clearing buffer while GPU is using it (potential race condition)');
    }
    this.data.count = 0;
    this.data.dirty = true;
  }

  /**
   * Mark buffer as in-flight (GPU is using it)
   */
  markInFlight(): void {
    this.data.inFlight = true;
  }

  /**
   * Mark buffer as no longer in-flight (GPU finished)
   */
  markReady(): void {
    this.data.inFlight = false;
  }

  /**
   * Check if buffer is in-flight
   */
  isInFlight(): boolean {
    return this.data.inFlight;
  }

  /**
   * Resize buffer capacity
   *
   * WARNING: This reallocates the buffer and is expensive.
   * Only call when necessary (e.g., instance count grows beyond capacity).
   *
   * @param newCapacity - New capacity (must be >= current count)
   */
  resize(newCapacity: number): void {
    if (newCapacity < this.data.count) {
      throw new Error(
        `InstanceBuffer: Cannot resize to ${newCapacity} (current count: ${this.data.count})`
      );
    }

    if (newCapacity === this.data.capacity) {
      return; // No-op
    }

    // Allocate new buffer
    const newData = new Float32Array(newCapacity * FLOATS_PER_INSTANCE);

    // Copy existing data
    const copyCount = Math.min(this.data.count, newCapacity);
    if (copyCount > 0) {
      newData.set(this.data.data.subarray(0, copyCount * FLOATS_PER_INSTANCE));
    }

    // Replace buffer
    this.data.data = newData;
    this.data.capacity = newCapacity;
    this.data.dirty = true;
  }

  /**
   * Get memory usage in bytes
   */
  getMemoryUsage(): number {
    return this.data.capacity * BYTES_PER_INSTANCE; // capacity * 80 bytes
  }
}

/**
 * Instance buffer pool
 *
 * Pools instance buffers by capacity to avoid reallocation.
 * Uses power-of-2 bucket sizes: 64, 128, 256, 512, 1024, 2048, 4096.
 */
export class InstanceBufferPool {
  private pools: Map<number, InstanceBuffer[]> = new Map();

  // Bucket sizes (power of 2, from RenderingConstants)
  private static readonly BUCKET_SIZES: number[] = [...INSTANCE_BUFFER_BUCKETS];

  // Maximum capacity (5MB = 65536 instances * 80 bytes)
  private static readonly MAX_CAPACITY = 65536;

  /**
   * Acquire an instance buffer
   *
   * Returns a buffer from the pool if available, otherwise creates a new one.
   *
   * @param requiredCapacity - Minimum required capacity
   * @returns Instance buffer with capacity >= requiredCapacity
   */
  acquire(requiredCapacity: number): InstanceBuffer {
    const bucketSize = this.findBucket(requiredCapacity);

    // Check if pool has available buffer that's NOT in-flight
    const pool = this.pools.get(bucketSize);
    if (pool && pool.length > 0) {
      // Find first buffer that's not in-flight
      for (let i = pool.length - 1; i >= 0; i--) {
        const buffer = pool[i];
        if (!buffer.isInFlight()) {
          pool.splice(i, 1);
          buffer.clear(); // Reset buffer
          return buffer;
        }
      }
    }

    // No available buffer, create new one
    return new InstanceBuffer(bucketSize);
  }

  /**
   * Release instance buffer back to pool
   *
   * @param buffer - Buffer to release
   */
  release(buffer: InstanceBuffer): void {
    const capacity = buffer.getCapacity();

    // Only pool if capacity matches a bucket size
    if (!InstanceBufferPool.BUCKET_SIZES.includes(capacity)) {
      return; // Odd size, don't pool
    }

    // Add to pool
    if (!this.pools.has(capacity)) {
      this.pools.set(capacity, []);
    }

    buffer.clear();
    this.pools.get(capacity)!.push(buffer);
  }

  /**
   * Clear all pooled buffers
   */
  clearPool(): void {
    this.pools.clear();
  }

  /**
   * Get total memory usage of pooled buffers
   */
  getPoolMemoryUsage(): number {
    let total = 0;
    for (const [_size, pool] of Array.from(this.pools.entries())) {
      for (const buffer of pool) {
        total += buffer.getMemoryUsage();
      }
    }
    return total;
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): { bucketSize: number; count: number; memoryBytes: number }[] {
    const stats: { bucketSize: number; count: number; memoryBytes: number }[] = [];

    for (const [bucketSize, pool] of Array.from(this.pools.entries())) {
      stats.push({
        bucketSize,
        count: pool.length,
        memoryBytes: pool.length * bucketSize * BYTES_PER_INSTANCE,
      });
    }

    return stats;
  }

  /**
   * Find appropriate bucket size for required capacity
   *
   * Uses power-of-2 buckets to minimize wasted space.
   *
   * @param requiredCapacity - Required capacity
   * @returns Bucket size >= requiredCapacity
   */
  private findBucket(requiredCapacity: number): number {
    // Prevent overflow
    if (requiredCapacity > InstanceBufferPool.MAX_CAPACITY) {
      throw new Error(
        `InstanceBufferPool.findBucket: Requested capacity ${requiredCapacity} exceeds maximum ${InstanceBufferPool.MAX_CAPACITY}`
      );
    }

    for (const size of InstanceBufferPool.BUCKET_SIZES) {
      if (size >= requiredCapacity) {
        return size;
      }
    }

    // Exceeds largest bucket, round up to next power of 2
    const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(requiredCapacity)));

    if (nextPowerOf2 > InstanceBufferPool.MAX_CAPACITY) {
      throw new Error(
        `InstanceBufferPool.findBucket: Required bucket size ${nextPowerOf2} exceeds maximum ${InstanceBufferPool.MAX_CAPACITY}`
      );
    }

    return nextPowerOf2;
  }
}

/**
 * Global instance buffer pool
 *
 * Singleton instance for the entire rendering system.
 */
export const globalInstanceBufferPool = new InstanceBufferPool();
