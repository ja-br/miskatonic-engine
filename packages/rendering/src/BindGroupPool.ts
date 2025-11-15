/**
 * BindGroupPool - Epic 3.14 Consolidation
 *
 * Persistent bind group pooling with automatic cleanup and device loss handling.
 * Reduces WebGPU API overhead by reusing bind groups across frames.
 *
 * Key features:
 * - ID-based tracking (no WeakSet)
 * - Automatic LRU cleanup when pool size exceeds limit
 * - Device loss recovery
 * - Frame-based statistics
 */

import {
  BIND_GROUP_CACHE_SIZE,
  BIND_GROUP_CLEANUP_FRAME_THRESHOLD,
} from './constants/RenderingConstants.js';

export interface BindGroupPoolEntry {
  /** The WebGPU bind group */
  bindGroup: GPUBindGroup;
  /** Unique numeric ID for release tracking */
  id: number;
  /** Frame number of last use (for LRU cleanup) */
  lastUsedFrame: number;
  /** Whether this bind group is currently in use */
  inUse: boolean;
}

export interface BindGroupPoolStats {
  /** Total bind groups across all pools */
  totalBindGroups: number;
  /** Number of bind groups currently in use */
  activeBindGroups: number;
  /** Number of free bind groups ready for reuse */
  freeBindGroups: number;
  /** Number of unique pool keys */
  uniquePools: number;
  /** Bind groups created this frame */
  createdThisFrame: number;
  /** Bind groups reused this frame */
  reusedThisFrame: number;
  /** Bind group reuse rate (percentage) */
  reuseRate: number;
}

export class BindGroupPool {
  /** Pools organized by configuration hash */
  private pools = new Map<string, BindGroupPoolEntry[]>();

  /** Next bind group ID */
  private nextId = 1;

  /** Maximum bind groups per pool before LRU cleanup triggers */
  private maxPoolSize = BIND_GROUP_CACHE_SIZE;

  /** Current frame number for LRU tracking */
  private currentFrame = 0;

  /** Statistics */
  private stats = {
    createdThisFrame: 0,
    reusedThisFrame: 0,
    totalCreated: 0,
    totalReused: 0,
  };

  /**
   * Create a new bind group pool
   * @param device - WebGPU device (for device loss handling)
   */
  constructor(private device: GPUDevice) {
    // Register device loss handler
    this.device.lost.then((info) => {
      console.warn(`Device lost: ${info.message}`);
      this.handleDeviceLoss();
    });
  }

  /**
   * Acquire a bind group from the pool or create a new one
   *
   * @param layoutId - Stable bind group layout ID (from WebGPUBackend tracking)
   * @param resources - Array of resource handles (buffer/texture IDs)
   * @param createFn - Function to create bind group if not in pool
   * @returns Bind group and tracking ID
   *
   * ⚠️ CRITICAL LIMITATION (Epic 3.14 Alpha):
   * Caller is responsible for ensuring layoutId is stable and unique per layout.
   * Reusing the same layoutId for different bind group layouts will cause rendering
   * corruption or WebGPU validation errors when pooled bind groups are reused.
   *
   * This is acceptable in alpha as layout management is centralized in WebGPUBackend.
   * Future work (Epic 3.15+): Accept GPUBindGroupLayout directly and generate stable
   * IDs internally using WeakMap<GPUBindGroupLayout, string>.
   */
  acquire(
    layoutId: string,
    resources: string[],
    createFn: () => GPUBindGroup
  ): { bindGroup: GPUBindGroup; id: number} {
    // Generate pool key from layout ID and resources
    const poolKey = this.generatePoolKey(layoutId, resources);

    // Get or create pool for this configuration
    let pool = this.pools.get(poolKey);
    if (!pool) {
      pool = [];
      this.pools.set(poolKey, pool);
    }

    // Find a free bind group in the pool
    for (const entry of pool) {
      if (!entry.inUse) {
        entry.inUse = true;
        entry.lastUsedFrame = this.currentFrame;
        this.stats.reusedThisFrame++;
        this.stats.totalReused++;
        return { bindGroup: entry.bindGroup, id: entry.id };
      }
    }

    // No free bind group found, create a new one
    const bindGroup = createFn();
    const id = this.nextId++;

    const entry: BindGroupPoolEntry = {
      bindGroup,
      id,
      lastUsedFrame: this.currentFrame,
      inUse: true,
    };

    pool.push(entry);
    this.stats.createdThisFrame++;
    this.stats.totalCreated++;

    // Check if cleanup is needed
    if (pool.length > this.maxPoolSize) {
      this.cleanup();
    }

    return { bindGroup, id };
  }

  /**
   * Release a bind group back to the pool
   * @param id - Bind group ID returned from acquire()
   */
  release(id: number): void {
    // Find and mark as not in use
    for (const pool of this.pools.values()) {
      const entry = pool.find((e) => e.id === id);
      if (entry) {
        entry.inUse = false;
        return;
      }
    }

    console.warn(`BindGroupPool: Attempted to release unknown ID ${id}`);
  }

  /**
   * Advance to next frame (resets per-frame statistics)
   * Call this at the beginning of each frame
   */
  nextFrame(): void {
    this.currentFrame++;
    this.stats.createdThisFrame = 0;
    this.stats.reusedThisFrame = 0;
  }

  /**
   * Get pool statistics
   */
  getStats(): BindGroupPoolStats {
    let totalBindGroups = 0;
    let activeBindGroups = 0;
    let freeBindGroups = 0;

    for (const pool of this.pools.values()) {
      totalBindGroups += pool.length;
      for (const entry of pool) {
        if (entry.inUse) {
          activeBindGroups++;
        } else {
          freeBindGroups++;
        }
      }
    }

    const totalRequests = this.stats.totalCreated + this.stats.totalReused;
    const reuseRate = totalRequests > 0 ? (this.stats.totalReused / totalRequests) * 100 : 0;

    return {
      totalBindGroups,
      activeBindGroups,
      freeBindGroups,
      uniquePools: this.pools.size,
      createdThisFrame: this.stats.createdThisFrame,
      reusedThisFrame: this.stats.reusedThisFrame,
      reuseRate,
    };
  }

  /**
   * Clear all pools (call on device loss or disposal)
   */
  clear(): void {
    this.pools.clear();
    this.nextId = 1;
    this.stats = {
      createdThisFrame: 0,
      reusedThisFrame: 0,
      totalCreated: 0,
      totalReused: 0,
    };
  }

  /**
   * Generate pool key from layout ID and resources
   * @private
   */
  private generatePoolKey(layoutId: string, resources: string[]): string {
    // Sort resources for consistent hashing
    const sortedResources = resources.slice().sort();
    return `${layoutId}:${sortedResources.join(',')}`;
  }

  /**
   * Cleanup old bind groups using LRU eviction
   * Removes bind groups not used recently
   * @private
   */
  private cleanup(): void {
    const frameCutoff = this.currentFrame - BIND_GROUP_CLEANUP_FRAME_THRESHOLD;

    for (const [key, pool] of this.pools.entries()) {
      // Remove entries that are not in use and haven't been used recently
      const filtered = pool.filter((entry) => {
        return entry.inUse || entry.lastUsedFrame > frameCutoff;
      });

      if (filtered.length === 0) {
        // Remove empty pools
        this.pools.delete(key);
      } else if (filtered.length < pool.length) {
        // Update pool with filtered entries
        this.pools.set(key, filtered);
      }
    }
  }

  /**
   * Handle device loss by clearing all pools
   * @private
   */
  private handleDeviceLoss(): void {
    console.log('BindGroupPool: Clearing pools due to device loss');
    this.clear();
  }
}
