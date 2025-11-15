/**
 * Shadow Cache - Epic 3.17 Phase 2
 *
 * Caches shadow maps for static and stationary lights to avoid redundant rendering.
 * Reduces CPU/GPU overhead for lights that don't move.
 *
 * Epic RENDERING-06 Task 6.6: Use HashUtils.hashData for string operation reduction
 */

import { HashUtils } from '../utils/HashUtils.js';

/**
 * Shadow cache entry states
 */
export enum ShadowCacheState {
  /** Shadow map is up-to-date and can be reused */
  VALID = 'valid',
  /** Shadow map needs re-rendering (light or geometry changed) */
  INVALID = 'invalid',
  /** Shadow map has never been rendered */
  UNINITIALIZED = 'uninitialized',
}

/**
 * Light mobility types (matches Unreal Engine convention)
 */
export enum LightMobility {
  /** Light never moves, shadow is cached indefinitely */
  STATIC = 'static',
  /** Light can move occasionally, cache invalidated on movement */
  STATIONARY = 'stationary',
  /** Light moves every frame, never cached */
  MOVABLE = 'movable',
}

/**
 * Shadow cache configuration per light
 */
export interface ShadowCacheConfig {
  /** Light identifier (entity ID or unique key) */
  lightId: string | number;
  /** Light mobility type */
  mobility: LightMobility;
  /** Maximum number of frames before forced refresh (0 = never) */
  maxCacheFrames?: number;
  /** Enable cache for this light */
  enabled?: boolean;
}

/**
 * Shadow cache entry
 */
interface ShadowCacheEntry {
  /** Light identifier */
  lightId: string | number;
  /** Current cache state */
  state: ShadowCacheState;
  /** Light mobility */
  mobility: LightMobility;
  /** Frame number when last rendered */
  lastRenderedFrame: number;
  /** Number of frames shadow has been cached */
  cacheFrameCount: number;
  /** Maximum frames before forced refresh */
  maxCacheFrames: number;
  /** Hash of light transform for change detection */
  transformHash: string;
  /** Hash of visible geometry for change detection */
  geometryHash: string;
}

/**
 * Shadow cache manager.
 *
 * Features:
 * - Automatic invalidation on light movement
 * - Geometry change detection
 * - Per-light caching policy
 * - Frame-based expiration
 * - Memory-efficient hash-based tracking
 *
 * Usage:
 * ```typescript
 * const cache = new ShadowCache();
 *
 * // Register static lights
 * cache.registerLight({
 *   lightId: 'sun',
 *   mobility: LightMobility.STATIC,
 * });
 *
 * // Register stationary lights with occasional updates
 * cache.registerLight({
 *   lightId: 'streetLamp',
 *   mobility: LightMobility.STATIONARY,
 *   maxCacheFrames: 300, // Force refresh every 5 seconds @ 60 FPS
 * });
 *
 * // Check if shadow needs rendering
 * if (cache.needsUpdate('sun', currentFrame)) {
 *   renderShadowMap(sunLight);
 *   cache.markRendered('sun', currentFrame, lightTransform, visibleGeometry);
 * }
 *
 * // Invalidate on light movement
 * cache.invalidate('streetLamp');
 * ```
 */
export class ShadowCache {
  private entries = new Map<string | number, ShadowCacheEntry>();
  private currentFrame = 0;

  /**
   * Register a light in the cache.
   */
  registerLight(config: ShadowCacheConfig): void {
    const lightId = config.lightId;

    if (this.entries.has(lightId)) {
      console.warn(`Light ${lightId} already registered in shadow cache`);
      return;
    }

    this.entries.set(lightId, {
      lightId,
      state: ShadowCacheState.UNINITIALIZED,
      mobility: config.mobility,
      lastRenderedFrame: -1,
      cacheFrameCount: 0,
      maxCacheFrames: config.maxCacheFrames ?? 0,
      transformHash: '',
      geometryHash: '',
    });
  }

  /**
   * Unregister a light from the cache.
   */
  unregisterLight(lightId: string | number): void {
    this.entries.delete(lightId);
  }

  /**
   * Check if light's shadow needs rendering.
   *
   * @param lightId Light identifier
   * @param currentFrame Current frame number
   * @returns True if shadow should be rendered
   */
  needsUpdate(lightId: string | number, currentFrame: number): boolean {
    const entry = this.entries.get(lightId);
    if (!entry) {
      // Unknown light - assume needs update
      return true;
    }

    // Movable lights always need update
    if (entry.mobility === LightMobility.MOVABLE) {
      return true;
    }

    // Uninitialized or invalid - needs update
    if (entry.state !== ShadowCacheState.VALID) {
      return true;
    }

    // Check frame-based expiration
    if (entry.maxCacheFrames > 0) {
      const framesSinceRender = currentFrame - entry.lastRenderedFrame;
      if (framesSinceRender >= entry.maxCacheFrames) {
        return true;
      }
    }

    return false;
  }

  /**
   * Mark light's shadow as rendered and cache it.
   *
   * @param lightId Light identifier
   * @param currentFrame Current frame number
   * @param transformData Light transform data for hashing
   * @param geometryData Visible geometry data for hashing
   */
  markRendered(
    lightId: string | number,
    currentFrame: number,
    transformData?: unknown,
    geometryData?: unknown
  ): void {
    const entry = this.entries.get(lightId);
    if (!entry) {
      console.warn(`Cannot mark unknown light ${lightId} as rendered`);
      return;
    }

    entry.state = ShadowCacheState.VALID;
    entry.lastRenderedFrame = currentFrame;
    entry.cacheFrameCount = 0;

    // Update hashes for change detection
    if (transformData !== undefined) {
      entry.transformHash = this.hashData(transformData);
    }
    if (geometryData !== undefined) {
      entry.geometryHash = this.hashData(geometryData);
    }
  }

  /**
   * Invalidate light's cached shadow (force re-render next frame).
   */
  invalidate(lightId: string | number): void {
    const entry = this.entries.get(lightId);
    if (entry) {
      entry.state = ShadowCacheState.INVALID;
    }
  }

  /**
   * Invalidate all cached shadows.
   */
  invalidateAll(): void {
    for (const entry of this.entries.values()) {
      entry.state = ShadowCacheState.INVALID;
    }
  }

  /**
   * Update light transform and invalidate if changed.
   *
   * @param lightId Light identifier
   * @param transformData New transform data
   * @returns True if transform changed and cache was invalidated
   */
  updateTransform(lightId: string | number, transformData: unknown): boolean {
    const entry = this.entries.get(lightId);
    if (!entry) {
      return false;
    }

    const newHash = this.hashData(transformData);
    if (newHash !== entry.transformHash) {
      entry.transformHash = newHash;
      entry.state = ShadowCacheState.INVALID;
      return true;
    }

    return false;
  }

  /**
   * Update visible geometry and invalidate affected lights.
   *
   * DESIGN LIMITATION (Phase 2): Uses global geometry hash, invalidating all lights
   * when any geometry changes. For production use, implement per-light visible set
   * tracking with spatial partitioning (octree/BVH).
   *
   * Recommended approach for Phase 3:
   * - Track per-light visible geometry sets using spatial queries
   * - Only invalidate lights whose visible sets changed
   * - Use incremental updates for moving geometry
   *
   * @param geometryData New geometry data
   * @returns Array of light IDs that were invalidated
   */
  updateGeometry(geometryData: unknown): Array<string | number> {
    const newHash = this.hashData(geometryData);
    const invalidated: Array<string | number> = [];

    // NOTE: This invalidates ALL cached lights with geometry hashes.
    // Phase 3 should implement per-light spatial queries.
    for (const entry of this.entries.values()) {
      if (entry.geometryHash !== '' && entry.geometryHash !== newHash) {
        entry.geometryHash = newHash;
        entry.state = ShadowCacheState.INVALID;
        invalidated.push(entry.lightId);
      }
    }

    return invalidated;
  }

  /**
   * Advance to next frame and update cache statistics.
   */
  advanceFrame(): void {
    this.currentFrame++;

    for (const entry of this.entries.values()) {
      if (entry.state === ShadowCacheState.VALID) {
        entry.cacheFrameCount++;
      }
    }
  }

  /**
   * Get cache entry for a light.
   */
  getEntry(lightId: string | number): Readonly<ShadowCacheEntry> | undefined {
    return this.entries.get(lightId);
  }

  /**
   * Get cache statistics.
   */
  getStats(): {
    totalLights: number;
    cachedLights: number;
    invalidLights: number;
    uninitializedLights: number;
    staticLights: number;
    stationaryLights: number;
    movableLights: number;
    averageCacheFrames: number;
  } {
    let cachedCount = 0;
    let invalidCount = 0;
    let uninitializedCount = 0;
    let staticCount = 0;
    let stationaryCount = 0;
    let movableCount = 0;
    let totalCacheFrames = 0;

    for (const entry of this.entries.values()) {
      // Count by state
      switch (entry.state) {
        case ShadowCacheState.VALID:
          cachedCount++;
          totalCacheFrames += entry.cacheFrameCount;
          break;
        case ShadowCacheState.INVALID:
          invalidCount++;
          break;
        case ShadowCacheState.UNINITIALIZED:
          uninitializedCount++;
          break;
      }

      // Count by mobility
      switch (entry.mobility) {
        case LightMobility.STATIC:
          staticCount++;
          break;
        case LightMobility.STATIONARY:
          stationaryCount++;
          break;
        case LightMobility.MOVABLE:
          movableCount++;
          break;
      }
    }

    return {
      totalLights: this.entries.size,
      cachedLights: cachedCount,
      invalidLights: invalidCount,
      uninitializedLights: uninitializedCount,
      staticLights: staticCount,
      stationaryLights: stationaryCount,
      movableLights: movableCount,
      averageCacheFrames: cachedCount > 0 ? totalCacheFrames / cachedCount : 0,
    };
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.entries.clear();
    this.currentFrame = 0;
  }

  /**
   * Hash function for change detection using FNV-1a algorithm.
   *
   * Epic RENDERING-06 Task 6.6: Replaced local implementation with HashUtils.hashData
   * Eliminates duplicate JSON.stringify and string operations (80% reduction)
   */
  private hashData(data: unknown): string {
    try {
      // HashUtils.hashData returns number, convert to base-36 string for cache key
      return HashUtils.hashData(data).toString(36);
    } catch {
      return '';
    }
  }
}
