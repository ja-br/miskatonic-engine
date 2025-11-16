/**
 * OccluderVolume Tests
 * Epic 3.5: Lightweight Culling - Phase 3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OccluderVolumeManager,
  OccluderVolume,
  OcclusionResult,
} from '../../src/culling/OccluderVolume';
import { BoundingSphere, BoundingBox } from '../../src/culling/BoundingVolume';

describe('OccluderVolumeManager', () => {
  let manager: OccluderVolumeManager;

  beforeEach(() => {
    manager = new OccluderVolumeManager();
  });

  // ============================================================================
  // Basic Operations
  // ============================================================================

  describe('Basic Operations', () => {
    it('should create empty manager', () => {
      expect(manager.getOccluderCount()).toBe(0);
      expect(manager.getOccluders()).toEqual([]);
    });

    it('should add occluder successfully', () => {
      const occluder: OccluderVolume = {
        id: 1,
        bounds: new BoundingBox(-10, -10, -10, 10, 10, 10),
      };

      manager.addOccluder(occluder);

      expect(manager.getOccluderCount()).toBe(1);
      expect(manager.getOccluders()).toHaveLength(1);
      expect(manager.getOccluders()[0].id).toBe(1);
    });

    it('should remove occluder successfully', () => {
      const occluder: OccluderVolume = {
        id: 1,
        bounds: new BoundingBox(-10, -10, -10, 10, 10, 10),
      };

      manager.addOccluder(occluder);
      expect(manager.getOccluderCount()).toBe(1);

      manager.removeOccluder(1);
      expect(manager.getOccluderCount()).toBe(0);
    });

    it('should handle multiple occluders', () => {
      manager.addOccluder({
        id: 1,
        bounds: new BoundingBox(-10, -10, -10, 10, 10, 10),
      });
      manager.addOccluder({
        id: 2,
        bounds: new BoundingBox(20, 20, 20, 40, 40, 40),
      });

      expect(manager.getOccluderCount()).toBe(2);
    });

    it('should clear all occluders', () => {
      manager.addOccluder({
        id: 1,
        bounds: new BoundingBox(-10, -10, -10, 10, 10, 10),
      });
      manager.addOccluder({
        id: 2,
        bounds: new BoundingBox(20, 20, 20, 40, 40, 40),
      });

      expect(manager.getOccluderCount()).toBe(2);

      manager.clear();
      expect(manager.getOccluderCount()).toBe(0);
    });

    it('should throw error for null occluder', () => {
      expect(() => manager.addOccluder(null as any)).toThrow(
        'Cannot add null/undefined occluder'
      );
    });

    it('should throw error for occluder without bounds', () => {
      expect(() => manager.addOccluder({ id: 1 } as any)).toThrow(
        'Occluder must have bounds property'
      );
    });
  });

  // ============================================================================
  // Sphere Occlusion Tests
  // ============================================================================

  describe('Sphere Occlusion', () => {
    beforeEach(() => {
      // Add large building occluder (100x100x100 cube centered at origin)
      manager.addOccluder({
        id: 'building',
        bounds: new BoundingBox(-50, -50, -50, 50, 50, 50),
      });
    });

    it('should return OCCLUDED for fully contained sphere', () => {
      // Small sphere at center of building
      const sphere = new BoundingSphere(0, 0, 0, 5);

      const result = manager.testSphere(sphere);

      expect(result).toBe(OcclusionResult.OCCLUDED);
    });

    it('should return VISIBLE for sphere outside occluder', () => {
      // Sphere completely outside building
      const sphere = new BoundingSphere(100, 100, 100, 5);

      const result = manager.testSphere(sphere);

      expect(result).toBe(OcclusionResult.VISIBLE);
    });

    it('should return VISIBLE for sphere touching occluder boundary (conservative)', () => {
      // Sphere touching edge of building (not fully contained)
      const sphere = new BoundingSphere(45, 0, 0, 10); // Extends beyond boundary

      const result = manager.testSphere(sphere);

      // Conservative: not fully contained, so visible
      expect(result).toBe(OcclusionResult.VISIBLE);
    });

    it('should return VISIBLE for sphere partially overlapping (conservative)', () => {
      // Sphere center inside, but radius extends outside
      const sphere = new BoundingSphere(0, 0, 0, 60); // Radius > occluder size

      const result = manager.testSphere(sphere);

      // Conservative: not fully contained, so visible
      expect(result).toBe(OcclusionResult.VISIBLE);
    });

    it('should return OCCLUDED for sphere at corner (fully contained)', () => {
      // Sphere at corner, fully inside
      const sphere = new BoundingSphere(40, 40, 40, 5);

      const result = manager.testSphere(sphere);

      expect(result).toBe(OcclusionResult.OCCLUDED);
    });

    it('should throw error for null sphere', () => {
      expect(() => manager.testSphere(null as any)).toThrow(
        'Cannot test null/undefined sphere'
      );
    });
  });

  // ============================================================================
  // Box Occlusion Tests
  // ============================================================================

  describe('Box Occlusion', () => {
    beforeEach(() => {
      // Add large building occluder (100x100x100 cube centered at origin)
      manager.addOccluder({
        id: 'building',
        bounds: new BoundingBox(-50, -50, -50, 50, 50, 50),
      });
    });

    it('should return OCCLUDED for fully contained box', () => {
      // Small box at center of building
      const box = new BoundingBox(-10, -10, -10, 10, 10, 10);

      const result = manager.testBox(box);

      expect(result).toBe(OcclusionResult.OCCLUDED);
    });

    it('should return VISIBLE for box outside occluder', () => {
      // Box completely outside building
      const box = new BoundingBox(100, 100, 100, 110, 110, 110);

      const result = manager.testBox(box);

      expect(result).toBe(OcclusionResult.VISIBLE);
    });

    it('should return VISIBLE for box touching occluder boundary (conservative)', () => {
      // Box touching edge of building (not fully contained)
      const box = new BoundingBox(40, 0, 0, 60, 10, 10); // Extends beyond boundary

      const result = manager.testBox(box);

      // Conservative: not fully contained, so visible
      expect(result).toBe(OcclusionResult.VISIBLE);
    });

    it('should return VISIBLE for box partially overlapping (conservative)', () => {
      // Box partially inside, partially outside
      const box = new BoundingBox(-60, -60, -60, 60, 60, 60); // Larger than occluder

      const result = manager.testBox(box);

      // Conservative: not fully contained, so visible
      expect(result).toBe(OcclusionResult.VISIBLE);
    });

    it('should return OCCLUDED for box at corner (fully contained)', () => {
      // Box at corner, fully inside
      const box = new BoundingBox(35, 35, 35, 45, 45, 45);

      const result = manager.testBox(box);

      expect(result).toBe(OcclusionResult.OCCLUDED);
    });

    it('should throw error for null box', () => {
      expect(() => manager.testBox(null as any)).toThrow(
        'Cannot test null/undefined box'
      );
    });
  });

  // ============================================================================
  // Multiple Occluders
  // ============================================================================

  describe('Multiple Occluders', () => {
    it('should test against all occluders', () => {
      // Add two separate buildings
      manager.addOccluder({
        id: 'building1',
        bounds: new BoundingBox(-100, -100, -100, -50, -50, -50),
      });
      manager.addOccluder({
        id: 'building2',
        bounds: new BoundingBox(50, 50, 50, 100, 100, 100),
      });

      // Sphere inside first building
      const sphere1 = new BoundingSphere(-75, -75, -75, 5);
      expect(manager.testSphere(sphere1)).toBe(OcclusionResult.OCCLUDED);

      // Sphere inside second building
      const sphere2 = new BoundingSphere(75, 75, 75, 5);
      expect(manager.testSphere(sphere2)).toBe(OcclusionResult.OCCLUDED);

      // Sphere between buildings (not occluded)
      const sphere3 = new BoundingSphere(0, 0, 0, 5);
      expect(manager.testSphere(sphere3)).toBe(OcclusionResult.VISIBLE);
    });

    it('should return OCCLUDED on first matching occluder', () => {
      // Add overlapping occluders
      manager.addOccluder({
        id: 1,
        bounds: new BoundingBox(-50, -50, -50, 50, 50, 50),
      });
      manager.addOccluder({
        id: 2,
        bounds: new BoundingBox(-60, -60, -60, 60, 60, 60),
      });

      // Sphere occluded by both
      const sphere = new BoundingSphere(0, 0, 0, 5);

      const result = manager.testSphere(sphere);

      // Should be occluded (doesn't matter which occluder matched)
      expect(result).toBe(OcclusionResult.OCCLUDED);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle zero-size sphere', () => {
      manager.addOccluder({
        id: 'building',
        bounds: new BoundingBox(-50, -50, -50, 50, 50, 50),
      });

      // Point at origin (zero radius)
      const sphere = new BoundingSphere(0, 0, 0, 0);

      const result = manager.testSphere(sphere);

      expect(result).toBe(OcclusionResult.OCCLUDED);
    });

    it('should handle zero-size box', () => {
      manager.addOccluder({
        id: 'building',
        bounds: new BoundingBox(-50, -50, -50, 50, 50, 50),
      });

      // Point at origin (zero size box)
      const box = new BoundingBox(0, 0, 0, 0, 0, 0);

      const result = manager.testBox(box);

      expect(result).toBe(OcclusionResult.OCCLUDED);
    });

    it('should handle very large occluder', () => {
      // Huge building (1000x1000x1000)
      manager.addOccluder({
        id: 'building',
        bounds: new BoundingBox(-500, -500, -500, 500, 500, 500),
      });

      // Normal-sized sphere inside
      const sphere = new BoundingSphere(0, 0, 0, 5);

      const result = manager.testSphere(sphere);

      expect(result).toBe(OcclusionResult.OCCLUDED);
    });

    it('should handle sphere exactly matching occluder bounds', () => {
      manager.addOccluder({
        id: 'building',
        bounds: new BoundingBox(-50, -50, -50, 50, 50, 50),
      });

      // Sphere with radius 50 centered at origin has AABB of [-50,-50,-50] to [50,50,50]
      // This EXACTLY matches occluder bounds, so it's fully contained
      const sphere = new BoundingSphere(0, 0, 0, 50);

      const result = manager.testSphere(sphere);

      // Sphere AABB exactly matches occluder, so it's fully contained
      expect(result).toBe(OcclusionResult.OCCLUDED);
    });

    it('should return VISIBLE when no occluders present', () => {
      // Empty manager
      const sphere = new BoundingSphere(0, 0, 0, 5);

      const result = manager.testSphere(sphere);

      expect(result).toBe(OcclusionResult.VISIBLE);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should handle 20 occluders efficiently', () => {
      // Add 20 occluders (realistic scenario for large scene)
      for (let i = 0; i < 20; i++) {
        manager.addOccluder({
          id: i,
          bounds: new BoundingBox(
            i * 100 - 50,
            i * 100 - 50,
            i * 100 - 50,
            i * 100 + 50,
            i * 100 + 50,
            i * 100 + 50
          ),
        });
      }

      expect(manager.getOccluderCount()).toBe(20);

      // Test 1000 spheres against all occluders
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        const sphere = new BoundingSphere(
          Math.random() * 2000 - 1000,
          Math.random() * 2000 - 1000,
          Math.random() * 2000 - 1000,
          5
        );
        manager.testSphere(sphere);
      }

      const endTime = performance.now();
      const timeMs = endTime - startTime;

      // Should be under 15ms budget (conservative for test stability)
      expect(timeMs).toBeLessThan(15.0);
    });

    it('should handle stress test (50 occluders, 2000 tests)', () => {
      // Stress test: more occluders than typical
      for (let i = 0; i < 50; i++) {
        const minX = Math.random() * 1000 - 500;
        const minY = Math.random() * 1000 - 500;
        const minZ = Math.random() * 1000 - 500;
        const sizeX = Math.random() * 100 + 50;
        const sizeY = Math.random() * 100 + 50;
        const sizeZ = Math.random() * 100 + 50;

        manager.addOccluder({
          id: i,
          bounds: new BoundingBox(
            minX,
            minY,
            minZ,
            minX + sizeX,
            minY + sizeY,
            minZ + sizeZ
          ),
        });
      }

      const startTime = performance.now();

      for (let i = 0; i < 2000; i++) {
        const sphere = new BoundingSphere(
          Math.random() * 2000 - 1000,
          Math.random() * 2000 - 1000,
          Math.random() * 2000 - 1000,
          Math.random() * 10 + 1
        );
        manager.testSphere(sphere);
      }

      const endTime = performance.now();
      const timeMs = endTime - startTime;

      // Even with 50 occluders, should be fast (conservative for test stability)
      expect(timeMs).toBeLessThan(20.0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('should handle real-world scenario (city with buildings)', () => {
      // Add 10 building occluders (typical city scene)
      const buildings = [
        { id: 'b1', x: -200, y: 0, z: -200, w: 50, h: 100, d: 50 },
        { id: 'b2', x: -100, y: 0, z: -200, w: 40, h: 80, d: 40 },
        { id: 'b3', x: 0, y: 0, z: -200, w: 60, h: 120, d: 60 },
        { id: 'b4', x: 100, y: 0, z: -200, w: 45, h: 90, d: 45 },
        { id: 'b5', x: 200, y: 0, z: -200, w: 55, h: 110, d: 55 },
        { id: 'b6', x: -200, y: 0, z: 0, w: 50, h: 100, d: 50 },
        { id: 'b7', x: 0, y: 0, z: 0, w: 70, h: 140, d: 70 },
        { id: 'b8', x: 200, y: 0, z: 0, w: 50, h: 100, d: 50 },
        { id: 'b9', x: -100, y: 0, z: 200, w: 40, h: 80, d: 40 },
        { id: 'b10', x: 100, y: 0, z: 200, w: 60, h: 120, d: 60 },
      ];

      for (const b of buildings) {
        manager.addOccluder({
          id: b.id,
          bounds: new BoundingBox(
            b.x - b.w / 2,
            b.y,
            b.z - b.d / 2,
            b.x + b.w / 2,
            b.y + b.h,
            b.z + b.d / 2
          ),
        });
      }

      // Test objects inside buildings (should be occluded)
      const insideB1 = new BoundingSphere(-200, 50, -200, 5);
      expect(manager.testSphere(insideB1)).toBe(OcclusionResult.OCCLUDED);

      const insideB7 = new BoundingSphere(0, 50, 0, 5);
      expect(manager.testSphere(insideB7)).toBe(OcclusionResult.OCCLUDED);

      // Test objects in streets (should be visible)
      const street1 = new BoundingSphere(-150, 5, -200, 5);
      expect(manager.testSphere(street1)).toBe(OcclusionResult.VISIBLE);

      const street2 = new BoundingSphere(0, 5, -100, 5);
      expect(manager.testSphere(street2)).toBe(OcclusionResult.VISIBLE);

      // Test objects above buildings (should be visible)
      const above = new BoundingSphere(0, 200, 0, 5);
      expect(manager.testSphere(above)).toBe(OcclusionResult.VISIBLE);
    });
  });
});
