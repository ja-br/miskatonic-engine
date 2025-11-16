/**
 * Comprehensive SpatialGrid Tests
 * Epic 3.5: Lightweight Culling
 *
 * Tests all operations and edge cases identified by code-critic review.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialGrid, SpatialObject, SpatialGridConfig } from '../../src/culling/SpatialGrid';
import { BoundingSphere, BoundingBox } from '../../src/culling/BoundingVolume';

describe('SpatialGrid', () => {
  let grid: SpatialGrid;
  let config: SpatialGridConfig;

  beforeEach(() => {
    config = {
      bounds: new BoundingBox(-100, -100, -100, 100, 100, 100),
      cellsPerAxis: 16,
    };
    grid = new SpatialGrid(config);
  });

  // ============================================================================
  // Configuration Validation Tests
  // ============================================================================

  describe('Configuration Validation', () => {
    it('should reject cellsPerAxis < 1', () => {
      expect(() => new SpatialGrid({
        bounds: new BoundingBox(-100, -100, -100, 100, 100, 100),
        cellsPerAxis: 0,
      })).toThrow('cellsPerAxis must be at least 1');
    });

    it('should reject cellsPerAxis > 256', () => {
      expect(() => new SpatialGrid({
        bounds: new BoundingBox(-100, -100, -100, 100, 100, 100),
        cellsPerAxis: 257,
      })).toThrow('cellsPerAxis cannot exceed 256');
    });

    it('should reject invalid bounds (minX >= maxX)', () => {
      expect(() => new SpatialGrid({
        bounds: new BoundingBox(100, -100, -100, 100, 100, 100), // minX === maxX
        cellsPerAxis: 16,
      })).toThrow('Invalid bounds: min must be less than max on all axes');
    });

    it('should reject invalid bounds (minY >= maxY)', () => {
      expect(() => new SpatialGrid({
        bounds: new BoundingBox(-100, 100, -100, 100, 100, 100), // minY === maxY
        cellsPerAxis: 16,
      })).toThrow('Invalid bounds: min must be less than max on all axes');
    });

    it('should reject invalid bounds (minZ >= maxZ)', () => {
      expect(() => new SpatialGrid({
        bounds: new BoundingBox(-100, -100, 100, 100, 100, 100), // minZ === maxZ
        cellsPerAxis: 16,
      })).toThrow('Invalid bounds: min must be less than max on all axes');
    });

    it('should accept valid configuration', () => {
      expect(() => new SpatialGrid(config)).not.toThrow();
    });
  });

  // ============================================================================
  // Insert Operation Tests
  // ============================================================================

  describe('Insert Operations', () => {
    it('should insert object successfully', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };

      expect(() => grid.insert(obj)).not.toThrow();

      const stats = grid.getStats();
      expect(stats.uniqueObjects).toBe(1);
      expect(stats.activeCells).toBeGreaterThan(0);
    });

    it('should reject null/undefined object', () => {
      expect(() => grid.insert(null as any)).toThrow('Cannot insert null/undefined object');
      expect(() => grid.insert(undefined as any)).toThrow('Cannot insert null/undefined object');
    });

    it('should reject object without boundingSphere', () => {
      const obj: any = { id: 1 };
      expect(() => grid.insert(obj)).toThrow('Object must have boundingSphere property');
    });

    it('should reject object with NaN in boundingSphere', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(NaN, 0, 0, 5),
      };
      expect(() => grid.insert(obj)).toThrow('BoundingSphere center contains NaN/Infinity');
    });

    it('should reject object with Infinity in boundingSphere', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(Infinity, 0, 0, 5),
      };
      expect(() => grid.insert(obj)).toThrow('BoundingSphere center contains NaN/Infinity');
    });

    it('should reject object with negative radius', () => {
      // Manually create object with negative radius (bypassing constructor validation)
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: { x: 0, y: 0, z: 0, radius: -5 } as any,
      };
      expect(() => grid.insert(obj)).toThrow('BoundingSphere radius must be non-negative');
    });

    it('should insert multiple objects', () => {
      const obj1: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };
      const obj2: SpatialObject = {
        id: 2,
        boundingSphere: new BoundingSphere(10, 10, 10, 5),
      };

      grid.insert(obj1);
      grid.insert(obj2);

      const stats = grid.getStats();
      expect(stats.uniqueObjects).toBe(2);
    });

    it('should insert object into multiple cells when sphere overlaps cells', () => {
      // Large sphere that spans multiple cells
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 50), // Large radius
      };

      grid.insert(obj);

      const stats = grid.getStats();
      expect(stats.totalObjectCellPairs).toBeGreaterThan(1);
    });

    it('should handle object at grid boundary', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(100, 100, 100, 5), // At max boundary
      };

      expect(() => grid.insert(obj)).not.toThrow();

      const stats = grid.getStats();
      expect(stats.uniqueObjects).toBe(1);
    });

    it('should handle object outside grid bounds (clamped)', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(200, 200, 200, 5), // Outside bounds
      };

      expect(() => grid.insert(obj)).not.toThrow();

      const stats = grid.getStats();
      expect(stats.uniqueObjects).toBe(1);
    });
  });

  // ============================================================================
  // Remove Operation Tests
  // ============================================================================

  describe('Remove Operations', () => {
    it('should remove object successfully', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };

      grid.insert(obj);
      expect(grid.getStats().uniqueObjects).toBe(1);

      grid.remove(obj);
      expect(grid.getStats().uniqueObjects).toBe(0);
    });

    it('should reject null/undefined object', () => {
      expect(() => grid.remove(null as any)).toThrow('Cannot remove null/undefined object');
      expect(() => grid.remove(undefined as any)).toThrow('Cannot remove null/undefined object');
    });

    it('should handle removing non-existent object (silent)', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };

      // Should not throw
      expect(() => grid.remove(obj)).not.toThrow();
      expect(grid.getStats().uniqueObjects).toBe(0);
    });

    it('should clean up empty cells after removal', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };

      grid.insert(obj);
      const statsBeforeRemove = grid.getStats();
      expect(statsBeforeRemove.activeCells).toBeGreaterThan(0);

      grid.remove(obj);
      const statsAfterRemove = grid.getStats();
      expect(statsAfterRemove.activeCells).toBe(0); // All cells should be cleaned up
    });

    it('should remove object from all cells it occupies', () => {
      // Large sphere that spans multiple cells
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 50),
      };

      grid.insert(obj);
      const statsBeforeRemove = grid.getStats();
      const cellsBeforeRemove = statsBeforeRemove.activeCells;

      grid.remove(obj);
      const statsAfterRemove = grid.getStats();
      expect(statsAfterRemove.activeCells).toBe(0);
      expect(statsAfterRemove.totalObjectCellPairs).toBe(0);
    });
  });

  // ============================================================================
  // Update Operation Tests
  // ============================================================================

  describe('Update Operations', () => {
    it('should update object position successfully', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };

      grid.insert(obj);

      // Update object's boundingSphere, then update grid tracking
      // Cell size = 200/16 = 12.5 units, so move 50 units to guarantee different cells
      obj.boundingSphere = new BoundingSphere(50, 50, 50, 5);
      grid.update(obj);

      // Query old position - should not find object (it's been moved in grid tracking)
      const oldResults = grid.querySphere(new BoundingSphere(0, 0, 0, 10));
      expect(oldResults).toHaveLength(0);

      // Query new position - should find object
      const newResults = grid.querySphere(new BoundingSphere(50, 50, 50, 10));
      expect(newResults).toContain(obj);
    });

    it('should reject null/undefined object', () => {
      expect(() => grid.update(null as any)).toThrow('Cannot update null/undefined object');
      expect(() => grid.update(undefined as any)).toThrow('Cannot update null/undefined object');
    });

    it('should reject object without boundingSphere', () => {
      const obj: any = { id: 1 };
      expect(() => grid.update(obj)).toThrow('Object must have boundingSphere property');
    });

    it('should reject boundingSphere with NaN', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };
      grid.insert(obj);

      obj.boundingSphere = new BoundingSphere(NaN, 0, 0, 5);
      expect(() => grid.update(obj)).toThrow('BoundingSphere center contains NaN/Infinity');
    });

    it('should reject boundingSphere with Infinity', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };
      grid.insert(obj);

      obj.boundingSphere = new BoundingSphere(Infinity, 0, 0, 5);
      expect(() => grid.update(obj)).toThrow('BoundingSphere center contains NaN/Infinity');
    });

    it('should reject negative radius', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };
      grid.insert(obj);

      // Manually set negative radius (bypassing constructor validation)
      obj.boundingSphere = { x: 0, y: 0, z: 0, radius: -5 } as any;
      expect(() => grid.update(obj)).toThrow('BoundingSphere radius must be non-negative');
    });

    it('should handle updating non-existent object (inserts it)', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(10, 10, 10, 5),
      };

      grid.update(obj);

      expect(grid.getStats().uniqueObjects).toBe(1);
    });

    it('should efficiently update when object stays in same cells', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };

      grid.insert(obj);
      const cellsBefore = grid.getStats().activeCells;

      // Small move within same cells
      obj.boundingSphere = new BoundingSphere(0.1, 0.1, 0.1, 5);
      grid.update(obj);

      const cellsAfter = grid.getStats().activeCells;
      expect(cellsAfter).toBe(cellsBefore); // Should be same cells
    });

    it('should add to new cells when object moves to new region', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };

      grid.insert(obj);

      // Move to completely different region
      obj.boundingSphere = new BoundingSphere(50, 50, 50, 5);
      grid.update(obj);

      // Should be findable at new location
      const results = grid.querySphere(new BoundingSphere(50, 50, 50, 5));
      expect(results).toContain(obj);
    });

    it('should read position from object boundingSphere', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };

      grid.insert(obj);

      // Update the object's boundingSphere
      obj.boundingSphere = new BoundingSphere(50, 50, 50, 5);
      grid.update(obj);

      // Grid should use the NEW position from object
      const oldResults = grid.querySphere(new BoundingSphere(0, 0, 0, 10));
      expect(oldResults).toHaveLength(0);

      const newResults = grid.querySphere(new BoundingSphere(50, 50, 50, 10));
      expect(newResults).toContain(obj);
    });
  });

  // ============================================================================
  // Query Operations Tests
  // ============================================================================

  describe('Query Operations', () => {
    beforeEach(() => {
      // Insert some test objects
      grid.insert({
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      });
      grid.insert({
        id: 2,
        boundingSphere: new BoundingSphere(20, 20, 20, 5),
      });
      grid.insert({
        id: 3,
        boundingSphere: new BoundingSphere(-50, -50, -50, 5),
      });
    });

    it('should query sphere successfully', () => {
      const results = grid.querySphere(new BoundingSphere(0, 0, 0, 10));
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(obj => obj.id === 1)).toBe(true);
    });

    it('should reject null/undefined query sphere', () => {
      expect(() => grid.querySphere(null as any)).toThrow('Query sphere cannot be null/undefined');
      expect(() => grid.querySphere(undefined as any)).toThrow('Query sphere cannot be null/undefined');
    });

    it('should query box successfully', () => {
      const results = grid.queryBox(new BoundingBox(-10, -10, -10, 10, 10, 10));
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(obj => obj.id === 1)).toBe(true);
    });

    it('should reject null/undefined query box', () => {
      expect(() => grid.queryBox(null as any)).toThrow('Query box cannot be null/undefined');
      expect(() => grid.queryBox(undefined as any)).toThrow('Query box cannot be null/undefined');
    });

    it('should return unique objects (no duplicates)', () => {
      // Large query that might hit same object in multiple cells
      const results = grid.querySphere(new BoundingSphere(0, 0, 0, 100));

      const ids = results.map(obj => obj.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size); // No duplicates
    });

    it('should return empty array when no objects match', () => {
      const results = grid.querySphere(new BoundingSphere(1000, 1000, 1000, 5));
      expect(results).toEqual([]);
    });

    it('should find all objects in overlapping region', () => {
      // Clear and add objects in same region
      grid.clear();
      grid.insert({
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      });
      grid.insert({
        id: 2,
        boundingSphere: new BoundingSphere(5, 5, 5, 5),
      });

      const results = grid.querySphere(new BoundingSphere(0, 0, 0, 20));
      expect(results.length).toBe(2);
    });
  });

  // ============================================================================
  // Clear Operation Tests
  // ============================================================================

  describe('Clear Operations', () => {
    it('should clear all objects', () => {
      grid.insert({
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      });
      grid.insert({
        id: 2,
        boundingSphere: new BoundingSphere(10, 10, 10, 5),
      });

      expect(grid.getStats().uniqueObjects).toBe(2);

      grid.clear();

      const stats = grid.getStats();
      expect(stats.uniqueObjects).toBe(0);
      expect(stats.activeCells).toBe(0);
      expect(stats.totalObjectCellPairs).toBe(0);
    });

    it('should allow reuse after clear', () => {
      grid.insert({
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      });

      grid.clear();
      expect(grid.getStats().uniqueObjects).toBe(0);

      grid.insert({
        id: 2,
        boundingSphere: new BoundingSphere(10, 10, 10, 5),
      });

      expect(grid.getStats().uniqueObjects).toBe(1);
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('Statistics', () => {
    it('should return correct statistics for empty grid', () => {
      const stats = grid.getStats();

      expect(stats.totalCells).toBe(16 * 16 * 16); // 4096 total cells
      expect(stats.activeCells).toBe(0);
      expect(stats.uniqueObjects).toBe(0);
      expect(stats.totalObjectCellPairs).toBe(0);
      expect(stats.averageObjectsPerCell).toBe(0);
      expect(stats.maxObjectsPerCell).toBe(0);
    });

    it('should return correct statistics with objects', () => {
      grid.insert({
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      });

      const stats = grid.getStats();

      expect(stats.uniqueObjects).toBe(1);
      expect(stats.activeCells).toBeGreaterThan(0);
      expect(stats.totalObjectCellPairs).toBeGreaterThan(0);
      expect(stats.averageObjectsPerCell).toBeGreaterThan(0);
      expect(stats.maxObjectsPerCell).toBeGreaterThan(0);
    });

    it('should count unique objects, not cell-object pairs', () => {
      // Large sphere that spans many cells
      grid.insert({
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 50),
      });

      const stats = grid.getStats();

      expect(stats.uniqueObjects).toBe(1); // Only 1 unique object
      expect(stats.totalObjectCellPairs).toBeGreaterThan(1); // But in many cells
    });

    it('should calculate average objects per cell correctly', () => {
      grid.insert({
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      });
      grid.insert({
        id: 2,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      });

      const stats = grid.getStats();

      expect(stats.averageObjectsPerCell).toBeCloseTo(
        stats.totalObjectCellPairs / stats.activeCells,
        5
      );
    });

    it('should track max objects per cell', () => {
      // Add many objects to same cell
      for (let i = 0; i < 10; i++) {
        grid.insert({
          id: i,
          boundingSphere: new BoundingSphere(0, 0, 0, 1),
        });
      }

      const stats = grid.getStats();
      expect(stats.maxObjectsPerCell).toBeGreaterThanOrEqual(10);
    });
  });

  // ============================================================================
  // Cell Boundary Tests
  // ============================================================================

  describe('Cell Boundary Conditions', () => {
    it('should handle object exactly at cell boundary', () => {
      // Calculate cell size: 200 / 16 = 12.5 units per cell
      const cellSize = 200 / 16; // (maxX - minX) / cellsPerAxis

      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(cellSize, cellSize, cellSize, 1),
      };

      expect(() => grid.insert(obj)).not.toThrow();

      const results = grid.querySphere(new BoundingSphere(cellSize, cellSize, cellSize, 2));
      expect(results).toContain(obj);
    });

    it('should handle objects at grid corners', () => {
      const corners = [
        new BoundingSphere(-100, -100, -100, 5), // Min corner
        new BoundingSphere(100, 100, 100, 5),     // Max corner
        new BoundingSphere(-100, -100, 100, 5),
        new BoundingSphere(-100, 100, -100, 5),
        new BoundingSphere(100, -100, -100, 5),
        new BoundingSphere(-100, 100, 100, 5),
        new BoundingSphere(100, -100, 100, 5),
        new BoundingSphere(100, 100, -100, 5),
      ];

      corners.forEach((sphere, i) => {
        grid.insert({
          id: i,
          boundingSphere: sphere,
        });
      });

      expect(grid.getStats().uniqueObjects).toBe(8);
    });
  });

  // ============================================================================
  // Performance Characteristics Tests
  // ============================================================================

  describe('Performance Characteristics', () => {
    it('should handle many objects efficiently', () => {
      const objectCount = 1000;

      // Insert 1000 objects
      for (let i = 0; i < objectCount; i++) {
        grid.insert({
          id: i,
          boundingSphere: new BoundingSphere(
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            5
          ),
        });
      }

      const stats = grid.getStats();
      expect(stats.uniqueObjects).toBe(objectCount);

      // Query should be fast (no timeout)
      const results = grid.querySphere(new BoundingSphere(0, 0, 0, 50));
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle many updates efficiently', () => {
      const objects: SpatialObject[] = [];

      // Insert 100 objects
      for (let i = 0; i < 100; i++) {
        const obj: SpatialObject = {
          id: i,
          boundingSphere: new BoundingSphere(
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            5
          ),
        };
        grid.insert(obj);
        objects.push(obj);
      }

      // Update all objects (simulating moving objects)
      objects.forEach(obj => {
        obj.boundingSphere = new BoundingSphere(
          Math.random() * 200 - 100,
          Math.random() * 200 - 100,
          Math.random() * 200 - 100,
          5
        );
        grid.update(obj);
      });

      expect(grid.getStats().uniqueObjects).toBe(100);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should treat objects by reference identity, not value equality', () => {
      // Insert first object with id=1
      const obj1: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };
      grid.insert(obj1);

      // Create DIFFERENT object with same id=1
      const obj2: SpatialObject = {
        id: 1, // Same id!
        boundingSphere: new BoundingSphere(50, 50, 50, 5),
      };
      grid.insert(obj2);

      // Grid should have TWO objects (different references)
      const stats = grid.getStats();
      expect(stats.uniqueObjects).toBe(2);

      // Both should be queryable at their respective positions
      const results1 = grid.querySphere(new BoundingSphere(0, 0, 0, 10));
      expect(results1).toContain(obj1);

      const results2 = grid.querySphere(new BoundingSphere(50, 50, 50, 10));
      expect(results2).toContain(obj2);

      // Removing one should not affect the other
      grid.remove(obj1);
      expect(grid.getStats().uniqueObjects).toBe(1);

      const afterRemove = grid.querySphere(new BoundingSphere(50, 50, 50, 10));
      expect(afterRemove).toContain(obj2);
    });

    it('should handle update() with object not in grid (replaced by value)', () => {
      // Insert original object
      const original: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };
      grid.insert(original);

      // Create "replacement" object with same id but different reference
      const replacement: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(50, 50, 50, 5),
      };

      // update() on replacement will INSERT it (not in grid yet)
      grid.update(replacement);

      // Grid should now have TWO objects with id=1
      expect(grid.getStats().uniqueObjects).toBe(2);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Scenarios', () => {
    it('should handle complete lifecycle: insert, query, update, remove', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };

      // Insert
      grid.insert(obj);
      expect(grid.getStats().uniqueObjects).toBe(1);

      // Query
      let results = grid.querySphere(new BoundingSphere(0, 0, 0, 10));
      expect(results).toContain(obj);

      // Update
      obj.boundingSphere = new BoundingSphere(50, 50, 50, 5);
      grid.update(obj);

      results = grid.querySphere(new BoundingSphere(50, 50, 50, 10));
      expect(results).toContain(obj);

      // Remove
      grid.remove(obj);
      expect(grid.getStats().uniqueObjects).toBe(0);
    });

    it('should handle spatial queries with mixed object sizes', () => {
      grid.insert({
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 1), // Small
      });
      grid.insert({
        id: 2,
        boundingSphere: new BoundingSphere(0, 0, 0, 50), // Large
      });

      const smallQuery = grid.querySphere(new BoundingSphere(0, 0, 0, 2));
      expect(smallQuery.some(obj => obj.id === 1)).toBe(true);

      const largeQuery = grid.querySphere(new BoundingSphere(0, 0, 0, 100));
      expect(largeQuery.length).toBe(2);
    });

    it('should maintain correctness under stress', () => {
      const objects: SpatialObject[] = [];

      // Insert 500 objects
      for (let i = 0; i < 500; i++) {
        const obj: SpatialObject = {
          id: i,
          boundingSphere: new BoundingSphere(
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            Math.random() * 10 + 1
          ),
        };
        grid.insert(obj);
        objects.push(obj);
      }

      // Update 250 random objects
      for (let i = 0; i < 250; i++) {
        const obj = objects[Math.floor(Math.random() * objects.length)];
        obj.boundingSphere = new BoundingSphere(
          Math.random() * 200 - 100,
          Math.random() * 200 - 100,
          Math.random() * 200 - 100,
          obj.boundingSphere.radius
        );
        grid.update(obj);
      }

      // Remove 100 random objects
      for (let i = 0; i < 100; i++) {
        const idx = Math.floor(Math.random() * objects.length);
        grid.remove(objects[idx]);
        objects.splice(idx, 1);
      }

      const stats = grid.getStats();
      expect(stats.uniqueObjects).toBe(400); // 500 - 100 = 400
    });
  });
});
