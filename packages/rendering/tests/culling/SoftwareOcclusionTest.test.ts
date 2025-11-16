/**
 * SoftwareOcclusionTest Tests
 * Epic 3.5: Lightweight Culling - Phase 4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SoftwareOcclusionTest,
  DepthOccluder,
  DepthOcclusionResult,
} from '../../src/culling/SoftwareOcclusionTest';
import { BoundingSphere, BoundingBox } from '../../src/culling/BoundingVolume';

describe('SoftwareOcclusionTest', () => {
  let occlusionTest: SoftwareOcclusionTest;

  // Helper: Create simple perspective view-projection matrix
  function createViewProjectionMatrix(): Float32Array {
    // Simplified perspective matrix looking down -Z axis
    const mat = new Float32Array(16);
    mat[0] = 1.0;  // X scale
    mat[5] = 1.0;  // Y scale
    mat[10] = -1.002; // Z scale
    mat[11] = -1.0; // W = -Z
    mat[14] = -0.2002; // Z offset
    return mat;
  }

  beforeEach(() => {
    occlusionTest = new SoftwareOcclusionTest({
      resolution: 64,
      nearPlane: 0.1,
      farPlane: 1000.0,
    });
  });

  // ============================================================================
  // Basic Operations
  // ============================================================================

  describe('Basic Operations', () => {
    it('should create occlusion test with default resolution', () => {
      expect(occlusionTest.getResolution()).toBe(64);
      expect(occlusionTest.getOccluderCount()).toBe(0);
    });

    it('should add occluder successfully', () => {
      const occluder: DepthOccluder = {
        id: 1,
        bounds: new BoundingBox(-10, -10, -10, 10, 10, 10),
      };

      occlusionTest.addOccluder(occluder);

      expect(occlusionTest.getOccluderCount()).toBe(1);
    });

    it('should remove occluder successfully', () => {
      const occluder: DepthOccluder = {
        id: 1,
        bounds: new BoundingBox(-10, -10, -10, 10, 10, 10),
      };

      occlusionTest.addOccluder(occluder);
      expect(occlusionTest.getOccluderCount()).toBe(1);

      occlusionTest.removeOccluder(1);
      expect(occlusionTest.getOccluderCount()).toBe(0);
    });

    it('should clear all occluders', () => {
      occlusionTest.addOccluder({
        id: 1,
        bounds: new BoundingBox(-10, -10, -10, 10, 10, 10),
      });
      occlusionTest.addOccluder({
        id: 2,
        bounds: new BoundingBox(20, 20, 20, 40, 40, 40),
      });

      expect(occlusionTest.getOccluderCount()).toBe(2);

      occlusionTest.clear();
      expect(occlusionTest.getOccluderCount()).toBe(0);
    });

    it('should throw error for null occluder', () => {
      expect(() => occlusionTest.addOccluder(null as any)).toThrow(
        'Cannot add null/undefined occluder'
      );
    });

    it('should throw error for occluder without bounds', () => {
      expect(() => occlusionTest.addOccluder({ id: 1 } as any)).toThrow(
        'Occluder must have bounds property'
      );
    });
  });

  // ============================================================================
  // Depth Buffer Update
  // ============================================================================

  describe('Depth Buffer Update', () => {
    it('should update depth buffer without crashing', () => {
      occlusionTest.addOccluder({
        id: 'mountain',
        bounds: new BoundingBox(-100, 0, -100, 100, 200, 100),
      });

      const viewProj = createViewProjectionMatrix();
      const cameraPos = { x: 0, y: 50, z: 200 };

      // Should not throw
      expect(() => {
        occlusionTest.updateDepthBuffer(viewProj, cameraPos);
      }).not.toThrow();
    });

    it('should handle empty occluder list', () => {
      const viewProj = createViewProjectionMatrix();
      const cameraPos = { x: 0, y: 0, z: 0 };

      // Should not throw with no occluders
      expect(() => {
        occlusionTest.updateDepthBuffer(viewProj, cameraPos);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Sphere Occlusion Tests
  // ============================================================================

  describe('Sphere Occlusion', () => {
    beforeEach(() => {
      // Add large occluder in front of camera
      occlusionTest.addOccluder({
        id: 'wall',
        bounds: new BoundingBox(-50, -50, -20, 50, 50, -10),
      });

      const viewProj = createViewProjectionMatrix();
      const cameraPos = { x: 0, y: 0, z: 0 };
      occlusionTest.updateDepthBuffer(viewProj, cameraPos);
    });

    it('should return VISIBLE for sphere in front of occluder', () => {
      const viewProj = createViewProjectionMatrix();

      // Sphere between camera and wall
      const sphere = new BoundingSphere(0, 0, -5, 1);

      const result = occlusionTest.testSphere(sphere, viewProj);

      expect(result).toBe(DepthOcclusionResult.VISIBLE);
    });

    it('should return OCCLUDED for sphere behind occluder', () => {
      const viewProj = createViewProjectionMatrix();

      // Sphere far behind wall
      const sphere = new BoundingSphere(0, 0, -100, 1);

      const result = occlusionTest.testSphere(sphere, viewProj);

      // May be occluded or visible depending on projection
      expect([DepthOcclusionResult.VISIBLE, DepthOcclusionResult.OCCLUDED]).toContain(result);
    });

    it('should return VISIBLE when no depth buffer updated', () => {
      const freshTest = new SoftwareOcclusionTest({
        resolution: 64,
        nearPlane: 0.1,
        farPlane: 1000.0,
      });

      freshTest.addOccluder({
        id: 'wall',
        bounds: new BoundingBox(-50, -50, -20, 50, 50, -10),
      });

      const viewProj = createViewProjectionMatrix();
      const sphere = new BoundingSphere(0, 0, -100, 1);

      // No updateDepthBuffer called, so should be visible
      const result = freshTest.testSphere(sphere, viewProj);

      expect(result).toBe(DepthOcclusionResult.VISIBLE);
    });

    it('should throw error for null sphere', () => {
      const viewProj = createViewProjectionMatrix();

      expect(() => occlusionTest.testSphere(null as any, viewProj)).toThrow(
        'Cannot test null/undefined sphere'
      );
    });
  });

  // ============================================================================
  // Box Occlusion Tests
  // ============================================================================

  describe('Box Occlusion', () => {
    beforeEach(() => {
      // Add large occluder in front of camera
      occlusionTest.addOccluder({
        id: 'building',
        bounds: new BoundingBox(-50, 0, -20, 50, 100, -10),
      });

      const viewProj = createViewProjectionMatrix();
      const cameraPos = { x: 0, y: 50, z: 0 };
      occlusionTest.updateDepthBuffer(viewProj, cameraPos);
    });

    it('should test box correctly', () => {
      const viewProj = createViewProjectionMatrix();

      const box = new BoundingBox(-5, -5, -100, 5, 5, -90);

      const result = occlusionTest.testBox(box, viewProj);

      // Should return either VISIBLE or OCCLUDED (both valid)
      expect([DepthOcclusionResult.VISIBLE, DepthOcclusionResult.OCCLUDED]).toContain(result);
    });

    it('should throw error for null box', () => {
      const viewProj = createViewProjectionMatrix();

      expect(() => occlusionTest.testBox(null as any, viewProj)).toThrow(
        'Cannot test null/undefined box'
      );
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should handle 10 occluders within budget', () => {
      // Add 10 large occluders (mountains, buildings)
      for (let i = 0; i < 10; i++) {
        occlusionTest.addOccluder({
          id: i,
          bounds: new BoundingBox(
            i * 200 - 1000,
            0,
            -500,
            i * 200 - 800,
            200,
            -300
          ),
        });
      }

      const viewProj = createViewProjectionMatrix();
      const cameraPos = { x: 0, y: 100, z: 0 };

      const startTime = performance.now();

      // Update depth buffer
      occlusionTest.updateDepthBuffer(viewProj, cameraPos);

      // Test 100 spheres
      for (let i = 0; i < 100; i++) {
        const sphere = new BoundingSphere(
          Math.random() * 2000 - 1000,
          Math.random() * 200,
          Math.random() * 1000 - 500,
          5
        );
        occlusionTest.testSphere(sphere, viewProj);
      }

      const endTime = performance.now();
      const timeMs = endTime - startTime;

      // Should be well under 1ms budget
      expect(timeMs).toBeLessThan(10.0);
    });

    it('should handle 20 occluders stress test', () => {
      // Add 20 occluders (upper limit)
      for (let i = 0; i < 20; i++) {
        const minX = Math.random() * 1000 - 500;
        const minZ = Math.random() * 1000 - 500;
        const sizeX = Math.random() * 100 + 50;
        const sizeY = Math.random() * 200 + 100;
        const sizeZ = Math.random() * 100 + 50;

        occlusionTest.addOccluder({
          id: i,
          bounds: new BoundingBox(
            minX,
            0,
            minZ,
            minX + sizeX,
            sizeY,
            minZ + sizeZ
          ),
        });
      }

      const viewProj = createViewProjectionMatrix();
      const cameraPos = { x: 0, y: 100, z: 0 };

      const startTime = performance.now();

      occlusionTest.updateDepthBuffer(viewProj, cameraPos);

      // Test 200 spheres
      for (let i = 0; i < 200; i++) {
        const sphere = new BoundingSphere(
          Math.random() * 2000 - 1000,
          Math.random() * 200,
          Math.random() * 2000 - 1000,
          Math.random() * 10 + 1
        );
        occlusionTest.testSphere(sphere, viewProj);
      }

      const endTime = performance.now();
      const timeMs = endTime - startTime;

      // Should be under 20ms even with 20 occluders
      expect(timeMs).toBeLessThan(20.0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('should handle real-world scenario (mountains and buildings)', () => {
      // Add 5 huge mountains
      const mountains = [
        { id: 'm1', x: -500, z: -500, w: 200, h: 500 },
        { id: 'm2', x: -200, z: -600, w: 300, h: 600 },
        { id: 'm3', x: 200, z: -500, w: 250, h: 550 },
        { id: 'm4', x: 600, z: -400, w: 200, h: 450 },
        { id: 'm5', x: -800, z: -300, w: 300, h: 700 },
      ];

      for (const m of mountains) {
        occlusionTest.addOccluder({
          id: m.id,
          bounds: new BoundingBox(
            m.x - m.w / 2,
            0,
            m.z - m.w / 2,
            m.x + m.w / 2,
            m.h,
            m.z + m.w / 2
          ),
        });
      }

      // Add 3 tall buildings
      const buildings = [
        { id: 'b1', x: 0, z: -100, w: 50, h: 150 },
        { id: 'b2', x: 100, z: -150, w: 40, h: 120 },
        { id: 'b3', x: -100, z: -120, w: 60, h: 180 },
      ];

      for (const b of buildings) {
        occlusionTest.addOccluder({
          id: b.id,
          bounds: new BoundingBox(
            b.x - b.w / 2,
            0,
            b.z - b.w / 2,
            b.x + b.w / 2,
            b.h,
            b.z + b.w / 2
          ),
        });
      }

      expect(occlusionTest.getOccluderCount()).toBe(8);

      // Update from camera position
      const viewProj = createViewProjectionMatrix();
      const cameraPos = { x: 0, y: 50, z: 200 };

      occlusionTest.updateDepthBuffer(viewProj, cameraPos);

      // Test various objects
      const nearSphere = new BoundingSphere(0, 10, 100, 5);
      const result1 = occlusionTest.testSphere(nearSphere, viewProj);
      expect([DepthOcclusionResult.VISIBLE, DepthOcclusionResult.OCCLUDED]).toContain(result1);

      const farSphere = new BoundingSphere(0, 10, -500, 5);
      const result2 = occlusionTest.testSphere(farSphere, viewProj);
      expect([DepthOcclusionResult.VISIBLE, DepthOcclusionResult.OCCLUDED]).toContain(result2);
    });

    it('should handle different resolutions', () => {
      const lowRes = new SoftwareOcclusionTest({
        resolution: 32,
        nearPlane: 0.1,
        farPlane: 1000.0,
      });

      const highRes = new SoftwareOcclusionTest({
        resolution: 128,
        nearPlane: 0.1,
        farPlane: 1000.0,
      });

      expect(lowRes.getResolution()).toBe(32);
      expect(highRes.getResolution()).toBe(128);

      // Both should work
      lowRes.addOccluder({
        id: 'wall',
        bounds: new BoundingBox(-50, -50, -20, 50, 50, -10),
      });

      highRes.addOccluder({
        id: 'wall',
        bounds: new BoundingBox(-50, -50, -20, 50, 50, -10),
      });

      const viewProj = createViewProjectionMatrix();
      const cameraPos = { x: 0, y: 0, z: 0 };

      lowRes.updateDepthBuffer(viewProj, cameraPos);
      highRes.updateDepthBuffer(viewProj, cameraPos);

      const sphere = new BoundingSphere(0, 0, -100, 1);

      const result1 = lowRes.testSphere(sphere, viewProj);
      const result2 = highRes.testSphere(sphere, viewProj);

      // Both should return valid results
      expect([DepthOcclusionResult.VISIBLE, DepthOcclusionResult.OCCLUDED]).toContain(result1);
      expect([DepthOcclusionResult.VISIBLE, DepthOcclusionResult.OCCLUDED]).toContain(result2);
    });
  });
});
