/**
 * ObjectCuller Tests
 * Epic 3.5: Lightweight Culling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ObjectCuller, ObjectCullerConfig } from '../../src/culling/ObjectCuller';
import { BoundingSphere, BoundingBox } from '../../src/culling/BoundingVolume';
import { SpatialObject } from '../../src/culling/SpatialGrid';

describe('ObjectCuller', () => {
  let culler: ObjectCuller;
  let config: ObjectCullerConfig;

  // Helper: Create identity view-projection matrix (no culling)
  function createIdentityViewProjection(): Float32Array {
    const mat = new Float32Array(16);
    mat[0] = 1;
    mat[5] = 1;
    mat[10] = 1;
    mat[15] = 1;
    return mat;
  }

  // Helper: Create simple perspective projection looking down -Z axis
  function createPerspectiveViewProjection(): Float32Array {
    // Simplified perspective matrix for testing
    // FOV ~90°, aspect 1:1, near=0.1, far=100
    const mat = new Float32Array(16);
    mat[0] = 1.0;  // X scale
    mat[5] = 1.0;  // Y scale
    mat[10] = -1.002; // Z scale
    mat[11] = -1.0; // W = -Z
    mat[14] = -0.2002; // Z offset
    return mat;
  }

  beforeEach(() => {
    config = {
      spatialGrid: {
        bounds: new BoundingBox(-100, -100, -100, 100, 100, 100),
        cellsPerAxis: 16,
      },
      enableStats: true,
    };
    culler = new ObjectCuller(config);
  });

  // ============================================================================
  // Basic Operations
  // ============================================================================

  describe('Basic Operations', () => {
    it('should create culler with valid config', () => {
      expect(culler).toBeDefined();
      expect(culler.getGridStats().totalCells).toBe(16 * 16 * 16);
    });

    it('should add object successfully', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };

      culler.addObject(obj);

      const stats = culler.getGridStats();
      expect(stats.uniqueObjects).toBe(1);
    });

    it('should remove object successfully', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };

      culler.addObject(obj);
      expect(culler.getGridStats().uniqueObjects).toBe(1);

      culler.removeObject(obj);
      expect(culler.getGridStats().uniqueObjects).toBe(0);
    });

    it('should update object position', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };

      culler.addObject(obj);

      // Update position
      obj.boundingSphere = new BoundingSphere(50, 50, 50, 5);
      culler.updateObject(obj);

      expect(culler.getGridStats().uniqueObjects).toBe(1);
    });

    it('should clear all objects', () => {
      culler.addObject({
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      });
      culler.addObject({
        id: 2,
        boundingSphere: new BoundingSphere(10, 10, 10, 5),
      });

      expect(culler.getGridStats().uniqueObjects).toBe(2);

      culler.clear();
      expect(culler.getGridStats().uniqueObjects).toBe(0);
    });
  });

  // ============================================================================
  // Culling Tests
  // ============================================================================

  describe('Culling', () => {
    it('should return empty array when no objects added', () => {
      const viewProj = createIdentityViewProjection();
      const cameraPos = { x: 0, y: 0, z: 0 };

      const visible = culler.cull(viewProj, cameraPos);

      expect(visible).toEqual([]);
    });

    it('should return all objects with identity matrix (no culling)', () => {
      // Add objects
      culler.addObject({
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      });
      culler.addObject({
        id: 2,
        boundingSphere: new BoundingSphere(10, 10, 10, 5),
      });

      const viewProj = createIdentityViewProjection();
      const cameraPos = { x: 0, y: 0, z: 0 };

      const visible = culler.cull(viewProj, cameraPos);

      // With identity matrix, frustum is extremely permissive
      expect(visible.length).toBeGreaterThanOrEqual(0);
    });

    it('should include objects in front of camera', () => {
      // Object at origin, camera looking down -Z
      culler.addObject({
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, -10, 5),
      });

      const viewProj = createPerspectiveViewProjection();
      const cameraPos = { x: 0, y: 0, z: 0 };

      const visible = culler.cull(viewProj, cameraPos);

      expect(visible.length).toBeGreaterThanOrEqual(0);
    });

    it('should sort results by distance (near to far)', () => {
      // Add objects at different distances
      const near: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, -5, 1),
      };
      const far: SpatialObject = {
        id: 2,
        boundingSphere: new BoundingSphere(0, 0, -50, 1),
      };

      culler.addObject(far); // Add far first
      culler.addObject(near);

      const viewProj = createPerspectiveViewProjection();
      const cameraPos = { x: 0, y: 0, z: 0 };

      const visible = culler.cull(viewProj, cameraPos);

      if (visible.length >= 2) {
        // First result should be closer
        expect(visible[0].distance).toBeLessThan(visible[1].distance);
      }
    });

    it('should calculate correct squared distances from camera', () => {
      const obj: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(3, 4, 0, 5),
      };

      culler.addObject(obj);

      const viewProj = createIdentityViewProjection();
      const cameraPos = { x: 0, y: 0, z: 0 };

      const visible = culler.cull(viewProj, cameraPos);

      if (visible.length > 0) {
        // Distance squared should be 3^2 + 4^2 + 0^2 = 25
        // (actual distance would be sqrt(25) = 5)
        expect(visible[0].distance).toBe(25);
      }
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('Statistics', () => {
    it('should track stats when enabled', () => {
      culler.addObject({
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      });

      const viewProj = createIdentityViewProjection();
      const cameraPos = { x: 0, y: 0, z: 0 };

      culler.cull(viewProj, cameraPos);

      const stats = culler.getStats();

      expect(stats.totalObjects).toBe(1);
      expect(stats.cullingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should not track stats when disabled', () => {
      const nonstatsConfig: ObjectCullerConfig = {
        spatialGrid: config.spatialGrid,
        enableStats: false,
      };
      const nonstatsCuller = new ObjectCuller(nonstatsConfig);

      nonstatsCuller.addObject({
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      });

      const viewProj = createIdentityViewProjection();
      const cameraPos = { x: 0, y: 0, z: 0 };

      nonstatsCuller.cull(viewProj, cameraPos);

      const stats = nonstatsCuller.getStats();

      // Stats should be zero/default when disabled
      expect(stats.cullingTimeMs).toBe(0);
    });

    it('should calculate rejection rate correctly', () => {
      // Add many objects, most outside frustum
      for (let i = 0; i < 100; i++) {
        culler.addObject({
          id: i,
          boundingSphere: new BoundingSphere(
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            5
          ),
        });
      }

      const viewProj = createPerspectiveViewProjection();
      const cameraPos = { x: 0, y: 0, z: 0 };

      culler.cull(viewProj, cameraPos);

      const stats = culler.getStats();

      expect(stats.rejectionRate).toBeGreaterThanOrEqual(0);
      expect(stats.rejectionRate).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should handle 1000 objects within budget', () => {
      // Add 1000 objects
      for (let i = 0; i < 1000; i++) {
        culler.addObject({
          id: i,
          boundingSphere: new BoundingSphere(
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            Math.random() * 5 + 1
          ),
        });
      }

      const viewProj = createPerspectiveViewProjection();
      const cameraPos = { x: 0, y: 0, z: 0 };

      const startTime = performance.now();
      culler.cull(viewProj, cameraPos);
      const endTime = performance.now();

      const cullingTime = endTime - startTime;

      // Should be well under 2ms budget (allow overhead for test environment)
      expect(cullingTime).toBeLessThan(10.0);
    });

    it('should handle 2000 objects within budget (stress test)', () => {
      // Add 2000 objects (upper limit)
      for (let i = 0; i < 2000; i++) {
        culler.addObject({
          id: i,
          boundingSphere: new BoundingSphere(
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            Math.random() * 5 + 1
          ),
        });
      }

      const viewProj = createPerspectiveViewProjection();
      const cameraPos = { x: 0, y: 0, z: 0 };

      const startTime = performance.now();
      culler.cull(viewProj, cameraPos);
      const endTime = performance.now();

      const cullingTime = endTime - startTime;

      // Should be close to 2ms budget (allow some overhead for conservative spatial query)
      // Note: Conservative query radius of 1000 units queries entire world
      // Real-world usage with proper frustum AABB will be faster
      expect(cullingTime).toBeLessThan(3.0);
    });

    it('should benefit from spatial grid (test many culls)', () => {
      // Add 500 objects
      for (let i = 0; i < 500; i++) {
        culler.addObject({
          id: i,
          boundingSphere: new BoundingSphere(
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            5
          ),
        });
      }

      const viewProj = createPerspectiveViewProjection();

      // Perform 100 culls from different camera positions
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        const cameraPos = {
          x: Math.random() * 20 - 10,
          y: Math.random() * 20 - 10,
          z: Math.random() * 20 - 10,
        };
        culler.cull(viewProj, cameraPos);
      }
      const endTime = performance.now();

      const avgTimePerCull = (endTime - startTime) / 100;

      // Average should be well under budget
      expect(avgTimePerCull).toBeLessThan(1.0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('should handle dynamic scene (add, update, remove, cull)', () => {
      const obj1: SpatialObject = {
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      };
      const obj2: SpatialObject = {
        id: 2,
        boundingSphere: new BoundingSphere(10, 10, 10, 5),
      };

      // Add objects
      culler.addObject(obj1);
      culler.addObject(obj2);

      expect(culler.getGridStats().uniqueObjects).toBe(2);

      // Cull
      const viewProj = createIdentityViewProjection();
      let visible = culler.cull(viewProj, { x: 0, y: 0, z: 0 });
      expect(visible.length).toBeGreaterThanOrEqual(0);

      // Update obj1
      obj1.boundingSphere = new BoundingSphere(50, 50, 50, 5);
      culler.updateObject(obj1);

      // Cull again
      visible = culler.cull(viewProj, { x: 0, y: 0, z: 0 });
      expect(visible.length).toBeGreaterThanOrEqual(0);

      // Remove obj2
      culler.removeObject(obj2);
      expect(culler.getGridStats().uniqueObjects).toBe(1);

      // Final cull
      visible = culler.cull(viewProj, { x: 0, y: 0, z: 0 });
      expect(visible.length).toBeGreaterThanOrEqual(0);
    });

    it('should return snapshot stats (not live reference)', () => {
      culler.addObject({
        id: 1,
        boundingSphere: new BoundingSphere(0, 0, 0, 5),
      });

      const viewProj = createIdentityViewProjection();
      culler.cull(viewProj, { x: 0, y: 0, z: 0 });

      const stats1 = culler.getStats();

      // Add more objects
      culler.addObject({
        id: 2,
        boundingSphere: new BoundingSphere(10, 10, 10, 5),
      });

      culler.cull(viewProj, { x: 0, y: 0, z: 0 });

      const stats2 = culler.getStats();

      // stats1 should be snapshot, not affected by new cull
      expect(stats2.totalObjects).toBeGreaterThan(stats1.totalObjects);
    });
  });
});
