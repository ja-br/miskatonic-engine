/**
 * Object Culling System
 * Epic 3.5: Lightweight Culling
 *
 * CPU-side object culling for retro games (1000-2000 game objects).
 * Combines frustum culling with spatial grid for O(log n) performance.
 *
 * Performance Budget: <2ms per frame for 1000-2000 objects
 */

import { Frustum } from './Frustum';
import { SpatialGrid, SpatialObject, SpatialGridConfig } from './SpatialGrid';
import { BoundingSphere, BoundingBox } from './BoundingVolume';

/**
 * Culling result for an object
 */
export interface CullResult {
  /** The culled object */
  object: SpatialObject;

  /** Distance from camera (for sorting) */
  distance: number;
}

/**
 * Culling statistics for performance monitoring
 */
export interface CullStats {
  /** Total objects in spatial grid */
  totalObjects: number;

  /** Objects tested after spatial query */
  objectsTested: number;

  /** Objects that passed frustum test */
  visibleObjects: number;

  /** Time spent culling (ms) */
  cullingTimeMs: number;

  /** Rejection rate (objects culled / objects tested) */
  rejectionRate: number;
}

/**
 * Sorting order for visible objects
 */
export enum SortOrder {
  /** Near to far (for early-Z optimization) */
  NEAR_TO_FAR = 'near-to-far',

  /** Far to near (for painter's algorithm / alpha blending) */
  FAR_TO_NEAR = 'far-to-near',

  /** No sorting (fastest) */
  NONE = 'none',
}

/**
 * Object Culler Configuration
 */
export interface ObjectCullerConfig {
  /** Spatial grid configuration */
  spatialGrid: SpatialGridConfig;

  /** Enable performance stats tracking (slight overhead) */
  enableStats?: boolean;

  /** Sorting order for visible objects (default: NEAR_TO_FAR) */
  sortOrder?: SortOrder;
}

/**
 * Object Culler
 *
 * High-level API for CPU-side object culling.
 * Combines spatial grid (coarse culling) with frustum test (fine culling).
 *
 * @example
 * ```typescript
 * const culler = new ObjectCuller({
 *   spatialGrid: {
 *     bounds: new BoundingBox(-100, -100, -100, 100, 100, 100),
 *     cellsPerAxis: 16,
 *   },
 * });
 *
 * // Add game objects
 * culler.addObject(player);
 * culler.addObject(enemy);
 *
 * // Every frame: cull objects
 * const visible = culler.cull(camera.viewProjectionMatrix, camera.position);
 *
 * // Render only visible objects
 * visible.forEach(result => {
 *   renderer.drawObject(result.object);
 * });
 * ```
 */
export class ObjectCuller {
  private grid: SpatialGrid;
  private frustum: Frustum;
  private config: ObjectCullerConfig;
  private stats: CullStats;

  constructor(config: ObjectCullerConfig) {
    this.config = {
      enableStats: false,
      sortOrder: SortOrder.NEAR_TO_FAR,
      ...config,
    };

    this.grid = new SpatialGrid(config.spatialGrid);
    this.frustum = new Frustum();

    this.stats = {
      totalObjects: 0,
      objectsTested: 0,
      visibleObjects: 0,
      cullingTimeMs: 0,
      rejectionRate: 0,
    };
  }

  /**
   * Add object to culling system
   *
   * @param obj Object to track for culling
   */
  addObject(obj: SpatialObject): void {
    this.grid.insert(obj);
  }

  /**
   * Remove object from culling system
   *
   * @param obj Object to stop tracking
   */
  removeObject(obj: SpatialObject): void {
    this.grid.remove(obj);
  }

  /**
   * Update object position
   *
   * IMPORTANT: You must update obj.boundingSphere BEFORE calling this method.
   *
   * @param obj Object with updated boundingSphere
   */
  updateObject(obj: SpatialObject): void {
    this.grid.update(obj);
  }

  /**
   * Perform culling against camera frustum
   *
   * Two-phase culling:
   * 1. Spatial grid query (coarse): Reduce candidates from O(n) to O(log n)
   * 2. Frustum test (fine): Exact visibility test on candidates
   *
   * @param viewProjectionMatrix Camera view-projection matrix (column-major)
   * @param cameraPosition Camera world position (for distance sorting)
   * @returns Array of visible objects, sorted according to config.sortOrder
   */
  cull(
    viewProjectionMatrix: Float32Array | number[],
    cameraPosition: { x: number; y: number; z: number }
  ): CullResult[] {
    // Fast path: no stats overhead when disabled
    if (!this.config.enableStats) {
      return this.performCull(viewProjectionMatrix, cameraPosition);
    }

    // Stats path: measure performance
    const startTime = performance.now();
    const results = this.performCull(viewProjectionMatrix, cameraPosition);
    const endTime = performance.now();

    // Update stats
    this.stats.cullingTimeMs = endTime - startTime;
    this.stats.visibleObjects = results.length;

    return results;
  }

  /**
   * Internal culling implementation (no stats overhead)
   */
  private performCull(
    viewProjectionMatrix: Float32Array | number[],
    cameraPosition: { x: number; y: number; z: number }
  ): CullResult[] {
    // Phase 1: Update frustum from camera
    this.frustum.updateFromViewProjection(viewProjectionMatrix);

    // Phase 2: Spatial query (coarse culling)
    // Calculate tight AABB from frustum for efficient spatial query
    const frustumAABB = this.calculateFrustumAABB();
    const candidates = this.grid.queryBox(frustumAABB);

    // Update candidate stats
    if (this.config.enableStats) {
      const gridStats = this.grid.getStats();
      this.stats.totalObjects = gridStats.uniqueObjects;
      this.stats.objectsTested = candidates.length;
    }

    // Phase 3: Frustum test (fine culling)
    const results: CullResult[] = [];

    for (const obj of candidates) {
      if (this.frustum.intersectsSphere(obj.boundingSphere)) {
        // Calculate SQUARED distance (avoid expensive sqrt)
        const dx = obj.boundingSphere.x - cameraPosition.x;
        const dy = obj.boundingSphere.y - cameraPosition.y;
        const dz = obj.boundingSphere.z - cameraPosition.z;
        const distanceSquared = dx * dx + dy * dy + dz * dz;

        results.push({
          object: obj,
          distance: distanceSquared, // Stored as squared distance
        });
      }
    }

    // Phase 4: Sort if requested
    if (this.config.sortOrder === SortOrder.NEAR_TO_FAR) {
      // Ascending order (near to far)
      results.sort((a, b) => a.distance - b.distance);
    } else if (this.config.sortOrder === SortOrder.FAR_TO_NEAR) {
      // Descending order (far to near)
      results.sort((a, b) => b.distance - a.distance);
    }
    // NONE: no sorting, fastest

    // Phase 5: Convert squared distances to actual distances (if needed for caller)
    // NOTE: distance is stored as squared to avoid sqrt during sorting
    // Caller can compute sqrt(distance) if they need actual distance
    // For now, we leave it squared for performance

    // Update rejection rate stats
    if (this.config.enableStats) {
      this.stats.rejectionRate = candidates.length > 0
        ? (candidates.length - results.length) / candidates.length
        : 0;
    }

    return results;
  }

  /**
   * Calculate tight AABB from frustum planes
   *
   * Computes the 8 corner points of the frustum view volume by intersecting
   * the 6 frustum planes, then builds an AABB that contains all corners.
   *
   * This is much tighter than a conservative sphere query and allows the
   * spatial grid to efficiently cull objects outside the view frustum.
   */
  private calculateFrustumAABB(): BoundingBox {
    const planes = this.frustum.planes;

    // Get the 8 frustum corners by intersecting plane triplets
    // Frustum has 6 planes: left, right, bottom, top, near, far
    // 8 corners are formed by all combinations of opposing planes
    const corners = [
      // Near plane corners (4 points)
      this.intersectThreePlanes(planes[4], planes[0], planes[2]), // near-left-bottom
      this.intersectThreePlanes(planes[4], planes[1], planes[2]), // near-right-bottom
      this.intersectThreePlanes(planes[4], planes[0], planes[3]), // near-left-top
      this.intersectThreePlanes(planes[4], planes[1], planes[3]), // near-right-top

      // Far plane corners (4 points)
      this.intersectThreePlanes(planes[5], planes[0], planes[2]), // far-left-bottom
      this.intersectThreePlanes(planes[5], planes[1], planes[2]), // far-right-bottom
      this.intersectThreePlanes(planes[5], planes[0], planes[3]), // far-left-top
      this.intersectThreePlanes(planes[5], planes[1], planes[3]), // far-right-top
    ];

    // Find AABB that contains all corners
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const corner of corners) {
      if (corner) {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        minZ = Math.min(minZ, corner.z);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
        maxZ = Math.max(maxZ, corner.z);
      }
    }

    // Clamp to grid bounds (frustum might extend beyond world)
    const gridBounds = this.config.spatialGrid.bounds;
    minX = Math.max(minX, gridBounds.minX);
    minY = Math.max(minY, gridBounds.minY);
    minZ = Math.max(minZ, gridBounds.minZ);
    maxX = Math.min(maxX, gridBounds.maxX);
    maxY = Math.min(maxY, gridBounds.maxY);
    maxZ = Math.min(maxZ, gridBounds.maxZ);

    return new BoundingBox(minX, minY, minZ, maxX, maxY, maxZ);
  }

  /**
   * Find intersection point of three planes
   *
   * Solves the system of equations:
   *   p1.nx * x + p1.ny * y + p1.nz * z + p1.d = 0
   *   p2.nx * x + p2.ny * y + p2.nz * z + p2.d = 0
   *   p3.nx * x + p3.ny * y + p3.nz * z + p3.d = 0
   *
   * Uses Cramer's rule to solve the 3x3 linear system.
   *
   * @returns Intersection point, or null if planes don't intersect at a single point
   */
  private intersectThreePlanes(
    p1: { nx: number; ny: number; nz: number; d: number },
    p2: { nx: number; ny: number; nz: number; d: number },
    p3: { nx: number; ny: number; nz: number; d: number }
  ): { x: number; y: number; z: number } | null {
    // Calculate determinant of the normal matrix
    // det = p1.n · (p2.n × p3.n)
    const cross_x = p2.ny * p3.nz - p2.nz * p3.ny;
    const cross_y = p2.nz * p3.nx - p2.nx * p3.nz;
    const cross_z = p2.nx * p3.ny - p2.ny * p3.nx;

    const det = p1.nx * cross_x + p1.ny * cross_y + p1.nz * cross_z;

    // Planes are parallel or don't intersect at a single point
    if (Math.abs(det) < 1e-6) {
      return null;
    }

    // Solve using Cramer's rule
    const invDet = 1.0 / det;

    // x = [(-d1, n1.y, n1.z), (-d2, n2.y, n2.z), (-d3, n3.y, n3.z)] / det
    const x = (
      -p1.d * (p2.ny * p3.nz - p2.nz * p3.ny) -
      -p2.d * (p3.ny * p1.nz - p3.nz * p1.ny) -
      -p3.d * (p1.ny * p2.nz - p1.nz * p2.ny)
    ) * invDet;

    // y = [(n1.x, -d1, n1.z), (n2.x, -d2, n2.z), (n3.x, -d3, n3.z)] / det
    const y = (
      -p1.d * (p2.nz * p3.nx - p2.nx * p3.nz) -
      -p2.d * (p3.nz * p1.nx - p3.nx * p1.nz) -
      -p3.d * (p1.nz * p2.nx - p1.nx * p2.nz)
    ) * invDet;

    // z = [(n1.x, n1.y, -d1), (n2.x, n2.y, -d2), (n3.x, n3.y, -d3)] / det
    const z = (
      -p1.d * (p2.nx * p3.ny - p2.ny * p3.nx) -
      -p2.d * (p3.nx * p1.ny - p3.ny * p1.nx) -
      -p3.d * (p1.nx * p2.ny - p1.ny * p2.nx)
    ) * invDet;

    return { x, y, z };
  }

  /**
   * Get culling statistics
   *
   * Only available if enableStats=true in config.
   *
   * @returns Current stats (snapshot)
   */
  getStats(): Readonly<CullStats> {
    return { ...this.stats };
  }

  /**
   * Get spatial grid statistics (for debugging)
   */
  getGridStats() {
    return this.grid.getStats();
  }

  /**
   * Clear all objects from culling system
   */
  clear(): void {
    this.grid.clear();
  }
}
