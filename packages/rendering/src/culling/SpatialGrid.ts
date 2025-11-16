/**
 * Spatial Grid System
 * Epic 3.5: Lightweight Culling
 *
 * Simple uniform grid for spatial queries.
 * Reduces culling complexity from O(n) to O(log n) for retro scenes.
 */

import { BoundingSphere, BoundingBox } from './BoundingVolume';

/**
 * Spatial object that can be stored in grid
 */
export interface SpatialObject {
  /** Unique identifier */
  id: number | string;

  /** Bounding sphere for fast queries */
  boundingSphere: BoundingSphere;

  /** Optional user data */
  userData?: unknown;
}

/**
 * Grid cell containing objects
 */
interface GridCell {
  objects: Set<SpatialObject>;
}

/**
 * Spatial Grid Configuration
 */
export interface SpatialGridConfig {
  /** World-space bounds of grid */
  bounds: BoundingBox;

  /** Number of cells per axis (e.g., 16 = 16x16x16 = 4096 cells) */
  cellsPerAxis: number;
}

/**
 * Spatial Grid
 *
 * Uniform 3D grid for spatial partitioning and fast queries.
 * Optimized for retro scenes with 1000-2000 objects.
 *
 * @example
 * ```typescript
 * const grid = new SpatialGrid({
 *   bounds: new BoundingBox(-100, -100, -100, 100, 100, 100),
 *   cellsPerAxis: 16,
 * });
 *
 * // Add objects
 * grid.insert(obj);
 *
 * // Query nearby objects
 * const nearby = grid.querySphere(sphere);
 * ```
 */
export class SpatialGrid {
  private config: SpatialGridConfig;
  private cells: Map<number, GridCell>;
  private objectToCells: Map<SpatialObject, Set<number>>;
  private cellSize: [number, number, number];
  private invCellSize: [number, number, number];

  constructor(config: SpatialGridConfig) {
    this.validateConfig(config);
    this.config = config;
    this.cells = new Map();
    this.objectToCells = new Map();

    // Calculate cell size
    const boundsSize: [number, number, number] = [
      config.bounds.maxX - config.bounds.minX,
      config.bounds.maxY - config.bounds.minY,
      config.bounds.maxZ - config.bounds.minZ,
    ];

    this.cellSize = [
      boundsSize[0] / config.cellsPerAxis,
      boundsSize[1] / config.cellsPerAxis,
      boundsSize[2] / config.cellsPerAxis,
    ];

    this.invCellSize = [
      1.0 / this.cellSize[0],
      1.0 / this.cellSize[1],
      1.0 / this.cellSize[2],
    ];
  }

  /**
   * Insert object into grid
   *
   * Objects are added to all cells their bounding sphere overlaps.
   *
   * @param obj Object to insert
   */
  insert(obj: SpatialObject): void {
    // CRITICAL: Validate inputs
    if (!obj) {
      throw new Error('Cannot insert null/undefined object');
    }
    if (!obj.boundingSphere) {
      throw new Error('Object must have boundingSphere property');
    }
    if (!Number.isFinite(obj.boundingSphere.x) ||
        !Number.isFinite(obj.boundingSphere.y) ||
        !Number.isFinite(obj.boundingSphere.z)) {
      throw new Error('BoundingSphere center contains NaN/Infinity');
    }
    if (obj.boundingSphere.radius < 0) {
      throw new Error(`BoundingSphere radius must be non-negative, got ${obj.boundingSphere.radius}`);
    }

    const cellKeys = this.getCellsForSphere(obj.boundingSphere);
    this.objectToCells.set(obj, cellKeys);

    for (const cellKey of cellKeys) {
      let cell = this.cells.get(cellKey);
      if (!cell) {
        cell = { objects: new Set() };
        this.cells.set(cellKey, cell);
      }
      cell.objects.add(obj);
    }
  }

  /**
   * Remove object from grid
   *
   * @param obj Object to remove
   */
  remove(obj: SpatialObject): void {
    if (!obj) {
      throw new Error('Cannot remove null/undefined object');
    }

    const cellKeys = this.objectToCells.get(obj);
    if (!cellKeys) {
      // Object not in grid - silently ignore
      return;
    }

    for (const cellKey of cellKeys) {
      const cell = this.cells.get(cellKey);
      if (cell) {
        cell.objects.delete(obj);

        // Clean up empty cells
        if (cell.objects.size === 0) {
          this.cells.delete(cellKey);
        }
      }
    }

    this.objectToCells.delete(obj);
  }

  /**
   * Update object position
   *
   * More efficient than remove + insert when object moves slightly.
   * Reads the current boundingSphere from the object.
   *
   * IMPORTANT: You must update obj.boundingSphere BEFORE calling this method.
   *
   * @param obj Object to update (must have updated boundingSphere)
   */
  update(obj: SpatialObject): void {
    if (!obj) {
      throw new Error('Cannot update null/undefined object');
    }
    if (!obj.boundingSphere) {
      throw new Error('Object must have boundingSphere property');
    }
    if (!Number.isFinite(obj.boundingSphere.x) ||
        !Number.isFinite(obj.boundingSphere.y) ||
        !Number.isFinite(obj.boundingSphere.z)) {
      throw new Error('BoundingSphere center contains NaN/Infinity');
    }
    if (obj.boundingSphere.radius < 0) {
      throw new Error(`BoundingSphere radius must be non-negative, got ${obj.boundingSphere.radius}`);
    }

    // Get old and new cell sets
    const oldCellKeys = this.objectToCells.get(obj);
    if (!oldCellKeys) {
      // Object not in grid - just insert
      this.insert(obj);
      return;
    }

    const newCellKeys = this.getCellsForSphere(obj.boundingSphere);

    // CRITICAL FIX: Use Set for O(1) lookup instead of Array.includes O(n)
    const oldCellSet = new Set(oldCellKeys);
    const newCellSet = newCellKeys;

    // Remove from cells that are no longer overlapped
    for (const cellKey of oldCellSet) {
      if (!newCellSet.has(cellKey)) {
        const cell = this.cells.get(cellKey);
        if (cell) {
          cell.objects.delete(obj);
          if (cell.objects.size === 0) {
            this.cells.delete(cellKey);
          }
        }
      }
    }

    // Add to new cells
    for (const cellKey of newCellSet) {
      if (!oldCellSet.has(cellKey)) {
        let cell = this.cells.get(cellKey);
        if (!cell) {
          cell = { objects: new Set() };
          this.cells.set(cellKey, cell);
        }
        cell.objects.add(obj);
      }
    }

    // Update tracking
    this.objectToCells.set(obj, newCellSet);
  }

  /**
   * Query objects overlapping a sphere
   *
   * Returns all unique objects whose cells overlap the query sphere.
   *
   * @param sphere Query sphere
   * @returns Array of unique objects
   */
  querySphere(sphere: BoundingSphere): SpatialObject[] {
    if (!sphere) {
      throw new Error('Query sphere cannot be null/undefined');
    }

    const cellKeys = this.getCellsForSphere(sphere);
    const results = new Set<SpatialObject>();

    for (const cellKey of cellKeys) {
      const cell = this.cells.get(cellKey);
      if (cell) {
        for (const obj of cell.objects) {
          results.add(obj);
        }
      }
    }

    return Array.from(results);
  }

  /**
   * Query objects overlapping an AABB
   *
   * @param box Query AABB
   * @returns Array of unique objects
   */
  queryBox(box: BoundingBox): SpatialObject[] {
    if (!box) {
      throw new Error('Query box cannot be null/undefined');
    }

    const cellKeys = this.getCellsForBox(box);
    const results = new Set<SpatialObject>();

    for (const cellKey of cellKeys) {
      const cell = this.cells.get(cellKey);
      if (cell) {
        for (const obj of cell.objects) {
          results.add(obj);
        }
      }
    }

    return Array.from(results);
  }

  /**
   * Clear all objects from grid
   */
  clear(): void {
    this.cells.clear();
    this.objectToCells.clear();
  }

  /**
   * Get statistics about grid usage
   */
  getStats(): {
    totalCells: number;
    activeCells: number;
    uniqueObjects: number;
    totalObjectCellPairs: number;
    averageObjectsPerCell: number;
    maxObjectsPerCell: number;
  } {
    const activeCells = this.cells.size;
    const totalCells = this.config.cellsPerAxis ** 3;

    // CRITICAL FIX: Count unique objects, not cell-object pairs
    const uniqueObjects = this.objectToCells.size;

    let totalObjectCellPairs = 0;
    let maxObjectsPerCell = 0;

    for (const cell of this.cells.values()) {
      totalObjectCellPairs += cell.objects.size;
      maxObjectsPerCell = Math.max(maxObjectsPerCell, cell.objects.size);
    }

    return {
      totalCells,
      activeCells,
      uniqueObjects,
      totalObjectCellPairs,
      averageObjectsPerCell: activeCells > 0 ? totalObjectCellPairs / activeCells : 0,
      maxObjectsPerCell,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateConfig(config: SpatialGridConfig): void {
    if (config.cellsPerAxis < 1) {
      throw new Error('cellsPerAxis must be at least 1');
    }
    // CRITICAL: 256 limit due to integer bit-packing (8 bits per axis in 32-bit key)
    // See getCellKey() for implementation details
    if (config.cellsPerAxis > 256) {
      throw new Error('cellsPerAxis cannot exceed 256 (limited by 8-bit bit-packing per axis)');
    }

    const bounds = config.bounds;
    if (bounds.minX >= bounds.maxX ||
        bounds.minY >= bounds.maxY ||
        bounds.minZ >= bounds.maxZ) {
      throw new Error('Invalid bounds: min must be less than max on all axes');
    }
  }

  private getCellsForSphere(sphere: BoundingSphere): Set<number> {
    // Find AABB that contains sphere
    const box = new BoundingBox(
      sphere.x - sphere.radius,
      sphere.y - sphere.radius,
      sphere.z - sphere.radius,
      sphere.x + sphere.radius,
      sphere.y + sphere.radius,
      sphere.z + sphere.radius
    );

    return this.getCellsForBox(box);
  }

  private getCellsForBox(box: BoundingBox): Set<number> {
    // Convert world-space AABB to grid-space indices
    const minCell = this.worldToGrid(box.minX, box.minY, box.minZ);
    const maxCell = this.worldToGrid(box.maxX, box.maxY, box.maxZ);

    const cells = new Set<number>();

    for (let x = minCell[0]; x <= maxCell[0]; x++) {
      for (let y = minCell[1]; y <= maxCell[1]; y++) {
        for (let z = minCell[2]; z <= maxCell[2]; z++) {
          cells.add(this.getCellKey(x, y, z));
        }
      }
    }

    return cells;
  }

  private worldToGrid(x: number, y: number, z: number): [number, number, number] {
    const { bounds, cellsPerAxis } = this.config;
    const maxCellIndex = cellsPerAxis - 1;

    // Convert to grid coordinates
    const gridX = Math.floor((x - bounds.minX) * this.invCellSize[0]);
    const gridY = Math.floor((y - bounds.minY) * this.invCellSize[1]);
    const gridZ = Math.floor((z - bounds.minZ) * this.invCellSize[2]);

    // Clamp to grid bounds
    return [
      Math.max(0, Math.min(maxCellIndex, gridX)),
      Math.max(0, Math.min(maxCellIndex, gridY)),
      Math.max(0, Math.min(maxCellIndex, gridZ)),
    ];
  }

  private getCellKey(x: number, y: number, z: number): number {
    // CRITICAL FIX: Use integer bit-packing instead of string concatenation
    // With cellsPerAxis <= 256, we can pack 3D coords into 32-bit integer
    // 8 bits per axis = 256 max cells per axis
    return x | (y << 8) | (z << 16);
  }
}
