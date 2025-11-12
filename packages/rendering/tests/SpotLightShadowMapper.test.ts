/**
 * Tests for SpotLightShadowMapper - Epic 3.17 Phase 2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpotLightShadowMapper } from '../src/shadows/SpotLightShadowMapper';
import { ShadowAtlas } from '../src/shadows/ShadowAtlas';

describe('SpotLightShadowMapper', () => {
  describe('Construction', () => {
    it('should create spot shadow with default resolution', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 5, 0],
        direction: [0, -1, 0],
        coneAngle: Math.PI / 4, // 45°
        range: 10.0,
      });

      expect(spot.getPosition()).toEqual([0, 5, 0]);
      expect(spot.getDirection()).toEqual([0, -1, 0]);
      expect(spot.getConeAngle()).toBe(Math.PI / 4);
      expect(spot.getRange()).toBe(10.0);
      expect(spot.getResolution()).toBe(512); // Default
    });

    it('should create spot shadow with custom resolution', () => {
      const spot = new SpotLightShadowMapper({
        position: [1, 2, 3],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 3,
        range: 15.0,
        resolution: 1024,
      });

      expect(spot.getResolution()).toBe(1024);
    });

    it('should throw on non-power-of-2 resolution', () => {
      expect(() => {
        new SpotLightShadowMapper({
          position: [0, 0, 0],
          direction: [0, 0, 1],
          coneAngle: Math.PI / 4,
          range: 10,
          resolution: 300,
        });
      }).toThrow('Resolution must be power of 2');
    });

    it('should throw on zero-length direction', () => {
      expect(() => {
        new SpotLightShadowMapper({
          position: [0, 0, 0],
          direction: [0, 0, 0], // Zero-length
          coneAngle: Math.PI / 4,
          range: 10,
        });
      }).toThrow('direction vector has zero length');
    });

    it('should handle penumbra parameter', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4,
        range: 10,
        penumbra: 0.2,
      });

      expect(spot.getPenumbra()).toBe(0.2);
    });
  });

  describe('Projection Matrix', () => {
    it('should create perspective projection for cone', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 2, // 90°
        range: 10.0,
        nearPlane: 0.1,
      });

      const matrix = spot.getViewProjectionMatrix();
      expect(matrix).toBeInstanceOf(Float32Array);
      expect(matrix).toHaveLength(16);

      // Verify no NaN values
      for (let i = 0; i < 16; i++) {
        expect(Number.isNaN(matrix[i])).toBe(false);
        expect(Number.isFinite(matrix[i])).toBe(true);
      }
    });

    it('should handle narrow cone angle', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 8, // 22.5°
        range: 10.0,
      });

      const matrix = spot.getViewProjectionMatrix();

      // Verify valid matrix
      for (let i = 0; i < 16; i++) {
        expect(Number.isFinite(matrix[i])).toBe(true);
      }
    });

    it('should handle wide cone angle', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: (Math.PI * 3) / 4, // 135°
        range: 10.0,
      });

      const matrix = spot.getViewProjectionMatrix();

      // Verify valid matrix
      for (let i = 0; i < 16; i++) {
        expect(Number.isFinite(matrix[i])).toBe(true);
      }
    });
  });

  describe('Atlas Allocation', () => {
    let atlas: ShadowAtlas;

    beforeEach(() => {
      atlas = new ShadowAtlas({
        size: 2048,
        format: 'depth32float',
      });
    });

    it('should allocate region in atlas', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4,
        range: 10.0,
        resolution: 512,
      });

      const success = spot.allocateFromAtlas(atlas);
      expect(success).toBe(true);
      expect(spot.isAllocated()).toBe(true);

      const region = spot.getRegion();
      expect(region).not.toBeNull();
      expect(region!.width).toBe(512);
      expect(region!.height).toBe(512);
    });

    it('should fail allocation if atlas is full', () => {
      atlas.allocate(2048, 2048);

      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4,
        range: 10.0,
        resolution: 512,
      });

      const success = spot.allocateFromAtlas(atlas);
      expect(success).toBe(false);
      expect(spot.isAllocated()).toBe(false);
    });

    it('should throw if already allocated', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4,
        range: 10.0,
      });

      spot.allocateFromAtlas(atlas);

      expect(() => {
        spot.allocateFromAtlas(atlas);
      }).toThrow('Already allocated');
    });

    it('should free region from atlas', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4,
        range: 10.0,
        resolution: 512,
      });

      spot.allocateFromAtlas(atlas);
      const statsBefore = atlas.getStats();
      expect(statsBefore.allocatedRegions).toBe(1);

      spot.freeFromAtlas();
      expect(spot.isAllocated()).toBe(false);

      const statsAfter = atlas.getStats();
      expect(statsAfter.allocatedRegions).toBe(0);
    });
  });

  describe('Update', () => {
    let atlas: ShadowAtlas;

    beforeEach(() => {
      atlas = new ShadowAtlas({
        size: 2048,
        format: 'depth32float',
      });
    });

    it('should update position', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4,
        range: 10.0,
      });

      spot.update({ position: [5, 10, 3] });
      expect(spot.getPosition()).toEqual([5, 10, 3]);
    });

    it('should update direction', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4,
        range: 10.0,
      });

      spot.update({ direction: [1, 0, 0] });
      expect(spot.getDirection()).toEqual([1, 0, 0]);
    });

    it('should update cone angle', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4,
        range: 10.0,
      });

      spot.update({ coneAngle: Math.PI / 2 });
      expect(spot.getConeAngle()).toBe(Math.PI / 2);
    });

    it('should update range', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4,
        range: 10.0,
      });

      spot.update({ range: 20.0 });
      expect(spot.getRange()).toBe(20.0);
    });

    it('should rebuild matrices on update', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4,
        range: 10.0,
      });

      const oldMatrix = spot.getViewProjectionMatrix();

      spot.update({ position: [10, 0, 0] });

      const newMatrix = spot.getViewProjectionMatrix();

      // Matrices should be different instances
      expect(oldMatrix).not.toBe(newMatrix);
    });

    it('should maintain allocation on update', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4,
        range: 10.0,
        resolution: 512,
      });

      spot.allocateFromAtlas(atlas);
      const regionBefore = spot.getRegion();

      spot.update({ position: [5, 0, 0] });

      const regionAfter = spot.getRegion();
      expect(regionAfter).toBe(regionBefore); // Same region
      expect(spot.isAllocated()).toBe(true);
    });
  });

  describe('World to Shadow Coordinates', () => {
    it('should convert world position to shadow coords', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 2,
        range: 10.0,
      });

      // Point in front of light
      const coords = spot.worldToShadowCoords([0, 0, 5]);
      expect(coords).not.toBeNull();

      if (coords) {
        // Should be in [0, 1] range
        expect(coords[0]).toBeGreaterThanOrEqual(0);
        expect(coords[0]).toBeLessThanOrEqual(1);
        expect(coords[1]).toBeGreaterThanOrEqual(0);
        expect(coords[1]).toBeLessThanOrEqual(1);
        expect(coords[2]).toBeGreaterThanOrEqual(0);
        expect(coords[2]).toBeLessThanOrEqual(1);
      }
    });

    it('should return null for point behind light', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 2,
        range: 10.0,
      });

      // Point behind light
      const coords = spot.worldToShadowCoords([0, 0, -5]);
      expect(coords).toBeNull();
    });

    it('should return null for point outside frustum', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4, // Narrow cone
        range: 10.0,
      });

      // Point far to the side
      const coords = spot.worldToShadowCoords([10, 0, 5]);
      expect(coords).toBeNull();
    });

    it('should return null for point beyond range', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 2,
        range: 10.0,
      });

      // Point beyond range
      const coords = spot.worldToShadowCoords([0, 0, 15]);
      expect(coords).toBeNull();
    });

    it('should handle point at light position', () => {
      const spot = new SpotLightShadowMapper({
        position: [5, 5, 5],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 2,
        range: 10.0,
      });

      const coords = spot.worldToShadowCoords([5, 5, 5]);

      // Should handle gracefully (may be null or center)
      if (coords) {
        expect(Number.isFinite(coords[0])).toBe(true);
        expect(Number.isFinite(coords[1])).toBe(true);
        expect(Number.isFinite(coords[2])).toBe(true);
      }
    });
  });

  describe('Memory Usage', () => {
    it('should calculate memory for 512x512 shadow map', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4,
        range: 10.0,
        resolution: 512,
      });

      const memory = spot.getMemoryUsage();
      expect(memory).toBe(512 * 512 * 4); // 1MB
    });

    it('should calculate memory for 1024x1024 shadow map', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4,
        range: 10.0,
        resolution: 1024,
      });

      const memory = spot.getMemoryUsage();
      expect(memory).toBe(1024 * 1024 * 4); // 4MB
    });
  });

  describe('Edge Cases', () => {
    it('should handle vertical downward direction', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 10, 0],
        direction: [0, -1, 0], // Straight down
        coneAngle: Math.PI / 4,
        range: 10.0,
      });

      const matrix = spot.getViewProjectionMatrix();

      // Should have valid matrix (no NaN)
      for (let i = 0; i < 16; i++) {
        expect(Number.isNaN(matrix[i])).toBe(false);
      }
    });

    it('should handle vertical upward direction', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 1, 0], // Straight up
        coneAngle: Math.PI / 4,
        range: 10.0,
      });

      const matrix = spot.getViewProjectionMatrix();

      // Should have valid matrix (no NaN)
      for (let i = 0; i < 16; i++) {
        expect(Number.isNaN(matrix[i])).toBe(false);
      }
    });

    it('should normalize non-unit direction vector', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [5, 0, 0], // Length 5, will be normalized
        coneAngle: Math.PI / 4,
        range: 10.0,
      });

      // Should have normalized direction
      const dir = spot.getDirection();
      const length = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]);
      expect(length).toBeCloseTo(1.0, 5);
    });

    it('should handle very small cone angle', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 180, // 1°
        range: 10.0,
      });

      const matrix = spot.getViewProjectionMatrix();

      // Should still be valid
      for (let i = 0; i < 16; i++) {
        expect(Number.isFinite(matrix[i])).toBe(true);
      }
    });

    it('should handle very large cone angle', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: (Math.PI * 179) / 180, // 179°
        range: 10.0,
      });

      const matrix = spot.getViewProjectionMatrix();

      // Should still be valid
      for (let i = 0; i < 16; i++) {
        expect(Number.isFinite(matrix[i])).toBe(true);
      }
    });
  });
});
