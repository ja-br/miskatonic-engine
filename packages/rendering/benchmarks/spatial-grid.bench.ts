/**
 * SpatialGrid Performance Benchmark
 * Epic 3.5: Lightweight Culling
 *
 * Validates <2ms query budget for 1000-2000 objects
 */

import { bench, describe } from 'vitest';
import { SpatialGrid } from '../src/culling/SpatialGrid';
import { BoundingSphere, BoundingBox } from '../src/culling/BoundingVolume';

describe('SpatialGrid Performance', () => {
  // Create grid matching retro game scale (200x200x200 unit world)
  const grid = new SpatialGrid({
    bounds: new BoundingBox(-100, -100, -100, 100, 100, 100),
    cellsPerAxis: 16,
  });

  // Populate with 1000 objects (retro scene scale)
  const objects = [];
  for (let i = 0; i < 1000; i++) {
    const obj = {
      id: i,
      boundingSphere: new BoundingSphere(
        Math.random() * 200 - 100,
        Math.random() * 200 - 100,
        Math.random() * 200 - 100,
        Math.random() * 5 + 1 // 1-6 unit radius
      ),
    };
    grid.insert(obj);
    objects.push(obj);
  }

  bench('Query 1000 objects (sphere)', () => {
    // Typical frustum query - ~50 unit radius sphere
    grid.querySphere(new BoundingSphere(0, 0, 0, 50));
  });

  bench('Query 1000 objects (box)', () => {
    // Typical frustum AABB
    grid.queryBox(new BoundingBox(-50, -50, -50, 50, 50, 50));
  });

  bench('Update 100 moving objects', () => {
    // Simulate 100 objects moving per frame
    for (let i = 0; i < 100; i++) {
      const obj = objects[i];
      obj.boundingSphere = new BoundingSphere(
        obj.boundingSphere.x + Math.random() * 2 - 1, // Small movement
        obj.boundingSphere.y + Math.random() * 2 - 1,
        obj.boundingSphere.z + Math.random() * 2 - 1,
        obj.boundingSphere.radius
      );
      grid.update(obj);
    }
  });

  // ============================================================================
  // Stress Test: 2000 objects (upper bound)
  // ============================================================================

  const largeGrid = new SpatialGrid({
    bounds: new BoundingBox(-100, -100, -100, 100, 100, 100),
    cellsPerAxis: 16,
  });

  const largeObjects = [];
  for (let i = 0; i < 2000; i++) {
    const obj = {
      id: i,
      boundingSphere: new BoundingSphere(
        Math.random() * 200 - 100,
        Math.random() * 200 - 100,
        Math.random() * 200 - 100,
        Math.random() * 5 + 1
      ),
    };
    largeGrid.insert(obj);
    largeObjects.push(obj);
  }

  bench('Query 2000 objects (stress test)', () => {
    largeGrid.querySphere(new BoundingSphere(0, 0, 0, 50));
  });

  bench('Update 200 moving objects (stress test)', () => {
    for (let i = 0; i < 200; i++) {
      const obj = largeObjects[i];
      obj.boundingSphere = new BoundingSphere(
        obj.boundingSphere.x + Math.random() * 2 - 1,
        obj.boundingSphere.y + Math.random() * 2 - 1,
        obj.boundingSphere.z + Math.random() * 2 - 1,
        obj.boundingSphere.radius
      );
      largeGrid.update(obj);
    }
  });

  // ============================================================================
  // Insertion Benchmark
  // ============================================================================

  bench('Insert 1000 objects', () => {
    const tempGrid = new SpatialGrid({
      bounds: new BoundingBox(-100, -100, -100, 100, 100, 100),
      cellsPerAxis: 16,
    });

    for (let i = 0; i < 1000; i++) {
      tempGrid.insert({
        id: i,
        boundingSphere: new BoundingSphere(
          Math.random() * 200 - 100,
          Math.random() * 200 - 100,
          Math.random() * 200 - 100,
          Math.random() * 5 + 1
        ),
      });
    }
  });

  // ============================================================================
  // Worst Case: Large Objects Spanning Many Cells
  // ============================================================================

  const worstCaseGrid = new SpatialGrid({
    bounds: new BoundingBox(-100, -100, -100, 100, 100, 100),
    cellsPerAxis: 16,
  });

  for (let i = 0; i < 100; i++) {
    worstCaseGrid.insert({
      id: i,
      boundingSphere: new BoundingSphere(
        Math.random() * 200 - 100,
        Math.random() * 200 - 100,
        Math.random() * 200 - 100,
        25 // Large radius - spans many cells
      ),
    });
  }

  bench('Query with large overlapping objects (worst case)', () => {
    worstCaseGrid.querySphere(new BoundingSphere(0, 0, 0, 50));
  });
});
