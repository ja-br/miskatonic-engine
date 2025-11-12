/**
 * Tests for PointLightShadowCubemap - Epic 3.17 Phase 2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PointLightShadowCubemap, CubeFace } from '../src/shadows/PointLightShadowCubemap';
import { ShadowAtlas } from '../src/shadows/ShadowAtlas';

describe('PointLightShadowCubemap', () => {
  describe('Construction', () => {
    it('should create cubemap with default resolution', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 5, 0],
        radius: 10.0,
      });

      expect(cubemap.getPosition()).toEqual([0, 5, 0]);
      expect(cubemap.getRadius()).toBe(10.0);
      expect(cubemap.getResolution()).toBe(256); // Default
    });

    it('should create cubemap with custom resolution', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [1, 2, 3],
        radius: 15.0,
        resolution: 512,
      });

      expect(cubemap.getResolution()).toBe(512);
    });

    it('should throw on non-power-of-2 resolution', () => {
      expect(() => {
        new PointLightShadowCubemap({
          position: [0, 0, 0],
          radius: 10,
          resolution: 300, // Not power of 2
        });
      }).toThrow('Resolution must be power of 2');
    });

    it('should throw on zero resolution', () => {
      expect(() => {
        new PointLightShadowCubemap({
          position: [0, 0, 0],
          radius: 10,
          resolution: 0,
        });
      }).toThrow('Resolution must be power of 2');
    });

    it('should throw on negative resolution', () => {
      expect(() => {
        new PointLightShadowCubemap({
          position: [0, 0, 0],
          radius: 10,
          resolution: -256,
        });
      }).toThrow('Resolution must be power of 2');
    });
  });

  describe('Face Initialization', () => {
    it('should initialize all 6 cubemap faces', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
      });

      const faces = cubemap.getFaces();
      expect(faces).toHaveLength(6);

      // Verify all faces present
      const faceIndices = faces.map(f => f.face);
      expect(faceIndices).toContain(CubeFace.POSITIVE_X);
      expect(faceIndices).toContain(CubeFace.NEGATIVE_X);
      expect(faceIndices).toContain(CubeFace.POSITIVE_Y);
      expect(faceIndices).toContain(CubeFace.NEGATIVE_Y);
      expect(faceIndices).toContain(CubeFace.POSITIVE_Z);
      expect(faceIndices).toContain(CubeFace.NEGATIVE_Z);
    });

    it('should initialize all faces with no atlas allocation', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
      });

      const faces = cubemap.getFaces();
      for (const face of faces) {
        expect(face.region).toBeNull();
      }

      expect(cubemap.isAllocated()).toBe(false);
    });

    it('should create view matrices for all faces', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
      });

      const faces = cubemap.getFaces();
      for (const face of faces) {
        expect(face.viewMatrix).toBeInstanceOf(Float32Array);
        expect(face.viewMatrix).toHaveLength(16);
        expect(face.projectionMatrix).toBeInstanceOf(Float32Array);
        expect(face.projectionMatrix).toHaveLength(16);
        expect(face.viewProjectionMatrix).toBeInstanceOf(Float32Array);
        expect(face.viewProjectionMatrix).toHaveLength(16);
      }
    });

    it('should create perspective projection with 90° FOV', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
        nearPlane: 0.1,
      });

      const face = cubemap.getFace(CubeFace.POSITIVE_X);
      const proj = face.projectionMatrix;

      // For 90° FOV, f = 1.0 / tan(45°) = 1.0
      expect(proj[0]).toBeCloseTo(1.0, 5); // x scale
      expect(proj[5]).toBeCloseTo(1.0, 5); // y scale
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

    it('should allocate all 6 faces in atlas', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
        resolution: 256,
      });

      const success = cubemap.allocateFromAtlas(atlas);
      expect(success).toBe(true);
      expect(cubemap.isAllocated()).toBe(true);

      const faces = cubemap.getFaces();
      for (const face of faces) {
        expect(face.region).not.toBeNull();
        expect(face.region!.width).toBe(256);
        expect(face.region!.height).toBe(256);
      }
    });

    it('should fail allocation if atlas is full', () => {
      // Fill atlas with large allocation
      atlas.allocate(2048, 2048);

      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
        resolution: 256,
      });

      const success = cubemap.allocateFromAtlas(atlas);
      expect(success).toBe(false);
      expect(cubemap.isAllocated()).toBe(false);
    });

    it('should rollback partial allocation on failure', () => {
      // Create small atlas that can fit 3 faces but not 6
      const smallAtlas = new ShadowAtlas({
        size: 512,
        format: 'depth32float',
      });

      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
        resolution: 256,
      });

      const success = cubemap.allocateFromAtlas(smallAtlas);
      expect(success).toBe(false);

      // Verify no regions leaked (all freed)
      const stats = smallAtlas.getStats();
      expect(stats.allocatedRegions).toBe(0);
    });

    it('should throw if already allocated', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
        resolution: 256,
      });

      cubemap.allocateFromAtlas(atlas);

      expect(() => {
        cubemap.allocateFromAtlas(atlas);
      }).toThrow('Already allocated');
    });

    it('should free all faces from atlas', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
        resolution: 256,
      });

      cubemap.allocateFromAtlas(atlas);
      const statsBefore = atlas.getStats();
      expect(statsBefore.allocatedRegions).toBe(6);

      cubemap.freeFromAtlas();
      expect(cubemap.isAllocated()).toBe(false);

      const statsAfter = atlas.getStats();
      expect(statsAfter.allocatedRegions).toBe(0);
    });

    it('should handle free without allocation', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
      });

      expect(() => {
        cubemap.freeFromAtlas();
      }).not.toThrow();
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
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
      });

      cubemap.update({ position: [5, 10, 3] });
      expect(cubemap.getPosition()).toEqual([5, 10, 3]);
    });

    it('should update radius', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
      });

      cubemap.update({ radius: 20.0 });
      expect(cubemap.getRadius()).toBe(20.0);
    });

    it('should update nearPlane', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
        nearPlane: 0.1,
      });

      cubemap.update({ nearPlane: 0.5 });

      // Verify projection matrix updated (far plane = radius)
      const face = cubemap.getFace(CubeFace.POSITIVE_X);
      const proj = face.projectionMatrix;

      // Check near/far encoding in projection matrix
      const far = 10.0;
      const near = 0.5;
      expect(proj[10]).toBeCloseTo(-(far + near) / (far - near), 5);
    });

    it('should rebuild matrices on update', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
      });

      const oldMatrix = cubemap.getFace(CubeFace.POSITIVE_X).viewProjectionMatrix;

      cubemap.update({ position: [10, 0, 0] });

      const newMatrix = cubemap.getFace(CubeFace.POSITIVE_X).viewProjectionMatrix;

      // Matrices should be different
      expect(oldMatrix).not.toBe(newMatrix); // Different instances
    });

    it('should free and re-allocate on update if allocated', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
        resolution: 256,
      });

      cubemap.allocateFromAtlas(atlas);
      const regionIdsBefore = cubemap.getFaces().map(f => f.region?.id);

      cubemap.update({ position: [5, 0, 0] });

      expect(cubemap.isAllocated()).toBe(true);

      const regionIdsAfter = cubemap.getFaces().map(f => f.region?.id);

      // Should have new region IDs (re-allocated)
      expect(regionIdsAfter).not.toEqual(regionIdsBefore);
    });

    it('should not leak regions on update', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
        resolution: 256,
      });

      cubemap.allocateFromAtlas(atlas);

      cubemap.update({ position: [5, 0, 0] });
      cubemap.update({ position: [10, 0, 0] });
      cubemap.update({ position: [15, 0, 0] });

      const stats = atlas.getStats();
      expect(stats.allocatedRegions).toBe(6); // Only current allocation
    });
  });

  describe('Face Retrieval', () => {
    it('should get specific face by index', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
      });

      const face = cubemap.getFace(CubeFace.POSITIVE_X);
      expect(face.face).toBe(CubeFace.POSITIVE_X);
    });

    it('should get all faces', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
      });

      const faces = cubemap.getFaces();
      expect(faces).toHaveLength(6);
    });
  });

  describe('Memory Usage', () => {
    it('should calculate memory for 256x256 cubemap', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
        resolution: 256,
      });

      const memory = cubemap.getMemoryUsage();
      expect(memory).toBe(256 * 256 * 4 * 6); // 1.5MB
    });

    it('should calculate memory for 512x512 cubemap', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
        resolution: 512,
      });

      const memory = cubemap.getMemoryUsage();
      expect(memory).toBe(512 * 512 * 4 * 6); // 6MB
    });

    it('should calculate memory for 1024x1024 cubemap', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
        resolution: 1024,
      });

      const memory = cubemap.getMemoryUsage();
      expect(memory).toBe(1024 * 1024 * 4 * 6); // 24MB
    });
  });

  describe('Vertical Light Orientation', () => {
    it('should handle +Y face (looking up)', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
      });

      const face = cubemap.getFace(CubeFace.POSITIVE_Y);

      // Should have valid view matrix (no NaN)
      for (let i = 0; i < 16; i++) {
        expect(Number.isNaN(face.viewMatrix[i])).toBe(false);
        expect(Number.isFinite(face.viewMatrix[i])).toBe(true);
      }
    });

    it('should handle -Y face (looking down)', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
      });

      const face = cubemap.getFace(CubeFace.NEGATIVE_Y);

      // Should have valid view matrix (no NaN)
      for (let i = 0; i < 16; i++) {
        expect(Number.isNaN(face.viewMatrix[i])).toBe(false);
        expect(Number.isFinite(face.viewMatrix[i])).toBe(true);
      }
    });

    it('should use different up vectors for +Y and -Y', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10.0,
      });

      const posY = cubemap.getFace(CubeFace.POSITIVE_Y).viewMatrix;
      const negY = cubemap.getFace(CubeFace.NEGATIVE_Y).viewMatrix;

      // Matrices should be different (different up vectors)
      let different = false;
      for (let i = 0; i < 16; i++) {
        if (Math.abs(posY[i] - negY[i]) > 0.001) {
          different = true;
          break;
        }
      }
      expect(different).toBe(true);
    });
  });
});
