/**
 * Directional Shadow Cascades Tests - Epic 3.17 Phase 1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DirectionalShadowCascades } from '../src/shadows/DirectionalShadowCascades';
import { ShadowAtlas, ShadowQuality } from '../src/shadows/ShadowAtlas';
import { createMockGPUDevice } from './mocks/mockWebGPU';

describe('DirectionalShadowCascades', () => {
  let device: GPUDevice;

  beforeEach(() => {
    device = createMockGPUDevice();
  });

  describe('Construction', () => {
    it('should create cascades with specified count', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 4,
        resolution: 1024,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      expect(cascades.getCascades()).toHaveLength(4);

      cascades.destroy();
    });

    it('should create cascades with logarithmic split by default', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 3,
        resolution: 512,
        nearPlane: 1.0,
        farPlane: 1000.0,
      });

      const config = cascades.getConfig();
      expect(config.splitScheme).toBe('logarithmic');

      cascades.destroy();
    });

    it('should create cascades with uniform split', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 3,
        resolution: 512,
        nearPlane: 1.0,
        farPlane: 100.0,
        splitScheme: 'uniform',
      });

      const config = cascades.getConfig();
      expect(config.splitScheme).toBe('uniform');

      cascades.destroy();
    });

    it('should create cascades with practical split', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 3,
        resolution: 512,
        nearPlane: 1.0,
        farPlane: 100.0,
        splitScheme: 'practical',
        lambda: 0.7,
      });

      const config = cascades.getConfig();
      expect(config.splitScheme).toBe('practical');
      expect(config.lambda).toBe(0.7);

      cascades.destroy();
    });

    it('should throw on invalid cascade count (too few)', () => {
      expect(() => {
        new DirectionalShadowCascades({
          cascadeCount: 0,
          resolution: 512,
          nearPlane: 0.1,
          farPlane: 100.0,
        });
      }).toThrow('Cascade count must be 1-8');
    });

    it('should throw on invalid cascade count (too many)', () => {
      expect(() => {
        new DirectionalShadowCascades({
          cascadeCount: 10,
          resolution: 512,
          nearPlane: 0.1,
          farPlane: 100.0,
        });
      }).toThrow('Cascade count must be 1-8');
    });

    it('should throw on non-power-of-2 resolution', () => {
      expect(() => {
        new DirectionalShadowCascades({
          cascadeCount: 4,
          resolution: 1000,
          nearPlane: 0.1,
          farPlane: 100.0,
        });
      }).toThrow('power of 2');
    });

    it('should accept single cascade', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 1,
        resolution: 1024,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      expect(cascades.getCascades()).toHaveLength(1);

      cascades.destroy();
    });
  });

  describe('Cascade Split Distances', () => {
    it('should compute uniform split correctly', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 4,
        resolution: 512,
        nearPlane: 0.0,
        farPlane: 100.0,
        splitScheme: 'uniform',
      });

      const splits = cascades.getCascades();

      // Uniform: [0, 25, 50, 75, 100]
      expect(splits[0].near).toBeCloseTo(0.0);
      expect(splits[0].far).toBeCloseTo(25.0);
      expect(splits[1].near).toBeCloseTo(25.0);
      expect(splits[1].far).toBeCloseTo(50.0);
      expect(splits[2].near).toBeCloseTo(50.0);
      expect(splits[2].far).toBeCloseTo(75.0);
      expect(splits[3].near).toBeCloseTo(75.0);
      expect(splits[3].far).toBeCloseTo(100.0);

      cascades.destroy();
    });

    it('should compute logarithmic split correctly', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 3,
        resolution: 512,
        nearPlane: 1.0,
        farPlane: 1000.0,
        splitScheme: 'logarithmic',
      });

      const splits = cascades.getCascades();

      // Logarithmic: more splits near camera
      expect(splits[0].near).toBe(1.0);
      expect(splits[0].far).toBeCloseTo(10.0, 0); // 1 * (1000/1)^(1/3) = 10
      expect(splits[1].near).toBeCloseTo(10.0, 0);
      expect(splits[1].far).toBeCloseTo(100.0, 0); // 1 * (1000/1)^(2/3) = 100
      expect(splits[2].near).toBeCloseTo(100.0, 0);
      expect(splits[2].far).toBe(1000.0);

      cascades.destroy();
    });

    it('should have contiguous cascades', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 4,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      const splits = cascades.getCascades();

      for (let i = 0; i < splits.length - 1; i++) {
        expect(splits[i].far).toBeCloseTo(splits[i + 1].near);
      }

      cascades.destroy();
    });

    it('should cover entire near-far range', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 3,
        resolution: 512,
        nearPlane: 0.5,
        farPlane: 500.0,
      });

      const splits = cascades.getCascades();

      expect(splits[0].near).toBe(0.5);
      expect(splits[splits.length - 1].far).toBe(500.0);

      cascades.destroy();
    });
  });

  describe('Atlas Allocation', () => {
    it('should allocate regions from atlas', () => {
      const atlas = new ShadowAtlas({
        device,
        quality: ShadowQuality.MEDIUM,
      });

      const cascades = new DirectionalShadowCascades({
        cascadeCount: 4,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      const success = cascades.allocateFromAtlas(atlas);
      expect(success).toBe(true);

      const splits = cascades.getCascades();
      for (const cascade of splits) {
        expect(cascade.region).not.toBeNull();
        expect(cascade.region!.width).toBe(512);
        expect(cascade.region!.height).toBe(512);
      }

      cascades.destroy();
      atlas.destroy();
    });

    it('should fail when atlas is too small', () => {
      const atlas = new ShadowAtlas({
        device,
        size: 256, // Too small for 4x 512x512 regions
      });

      const cascades = new DirectionalShadowCascades({
        cascadeCount: 4,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      const success = cascades.allocateFromAtlas(atlas);
      expect(success).toBe(false);

      cascades.destroy();
      atlas.destroy();
    });

    it('should free regions on failed allocation', () => {
      const atlas = new ShadowAtlas({
        device,
        size: 256, // Too small for 4x 512x512
      });

      const cascades = new DirectionalShadowCascades({
        cascadeCount: 4,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      const success = cascades.allocateFromAtlas(atlas);
      expect(success).toBe(false);

      // Atlas should be empty (no partial allocation)
      const stats = atlas.getStats();
      expect(stats.allocatedRegions).toBe(0);

      cascades.destroy();
      atlas.destroy();
    });

    it('should handle reallocation', () => {
      const atlas = new ShadowAtlas({
        device,
        quality: ShadowQuality.MEDIUM,
      });

      const cascades = new DirectionalShadowCascades({
        cascadeCount: 2,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      cascades.allocateFromAtlas(atlas);
      cascades.freeFromAtlas();
      const success = cascades.allocateFromAtlas(atlas);

      expect(success).toBe(true);

      cascades.destroy();
      atlas.destroy();
    });
  });

  describe('Atlas Deallocation', () => {
    it('should free regions from atlas', () => {
      const atlas = new ShadowAtlas({
        device,
        quality: ShadowQuality.MEDIUM,
      });

      const cascades = new DirectionalShadowCascades({
        cascadeCount: 2,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      cascades.allocateFromAtlas(atlas);
      cascades.freeFromAtlas();

      const stats = atlas.getStats();
      expect(stats.allocatedRegions).toBe(0);

      cascades.destroy();
      atlas.destroy();
    });

    it('should handle free without allocation', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 2,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      // Should not throw
      expect(() => cascades.freeFromAtlas()).not.toThrow();

      cascades.destroy();
    });
  });

  describe('Update', () => {
    it('should update cascade matrices', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 2,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      const lightDir: [number, number, number] = [0, -1, 0]; // Down
      const viewMatrix = new Float32Array(16);
      const projMatrix = new Float32Array(16);

      // Identity matrices for test
      viewMatrix[0] = viewMatrix[5] = viewMatrix[10] = viewMatrix[15] = 1;
      projMatrix[0] = projMatrix[5] = projMatrix[10] = projMatrix[15] = 1;

      // Should not throw
      expect(() => {
        cascades.update(lightDir, viewMatrix, projMatrix);
      }).not.toThrow();

      // Matrices should be populated
      const splits = cascades.getCascades();
      for (const cascade of splits) {
        expect(cascade.viewProjectionMatrix).toBeDefined();
        expect(cascade.viewProjectionMatrix.length).toBe(16);
      }

      cascades.destroy();
    });

    it('should handle different light directions', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 2,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      const viewMatrix = new Float32Array(16);
      const projMatrix = new Float32Array(16);
      viewMatrix[0] = viewMatrix[5] = viewMatrix[10] = viewMatrix[15] = 1;
      projMatrix[0] = projMatrix[5] = projMatrix[10] = projMatrix[15] = 1;

      const directions: Array<[number, number, number]> = [
        [0, -1, 0], // Down
        [1, 0, 0], // Right
        [0, 0, -1], // Forward
        [0.707, -0.707, 0], // Diagonal
      ];

      for (const dir of directions) {
        expect(() => {
          cascades.update(dir, viewMatrix, projMatrix);
        }).not.toThrow();
      }

      cascades.destroy();
    });
  });

  describe('Cascade Access', () => {
    it('should get cascade by index', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 3,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      const cascade = cascades.getCascade(1);
      expect(cascade).toBeDefined();
      expect(cascade!.index).toBe(1);

      cascades.destroy();
    });

    it('should return undefined for invalid index', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 3,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      const cascade = cascades.getCascade(10);
      expect(cascade).toBeUndefined();

      cascades.destroy();
    });

    it('should get all cascades', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 4,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      const all = cascades.getCascades();
      expect(all).toHaveLength(4);

      cascades.destroy();
    });

    it('should get configuration', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 3,
        resolution: 1024,
        nearPlane: 0.5,
        farPlane: 200.0,
        splitScheme: 'uniform',
      });

      const config = cascades.getConfig();
      expect(config.cascadeCount).toBe(3);
      expect(config.resolution).toBe(1024);
      expect(config.nearPlane).toBe(0.5);
      expect(config.farPlane).toBe(200.0);
      expect(config.splitScheme).toBe('uniform');

      cascades.destroy();
    });
  });

  describe('Resize', () => {
    it('should resize cascade resolution', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 2,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      cascades.resize(1024);

      const config = cascades.getConfig();
      expect(config.resolution).toBe(1024);

      cascades.destroy();
    });

    it('should reallocate atlas regions on resize', () => {
      const atlas = new ShadowAtlas({
        device,
        quality: ShadowQuality.MEDIUM,
      });

      const cascades = new DirectionalShadowCascades({
        cascadeCount: 2,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      cascades.allocateFromAtlas(atlas);
      cascades.resize(256);

      const splits = cascades.getCascades();
      for (const cascade of splits) {
        expect(cascade.region).not.toBeNull();
        expect(cascade.region!.width).toBe(256);
      }

      cascades.destroy();
      atlas.destroy();
    });

    it('should throw on non-power-of-2 resize', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 2,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      expect(() => cascades.resize(1000)).toThrow('power of 2');

      cascades.destroy();
    });
  });

  describe('Destroy', () => {
    it('should clean up resources', () => {
      const atlas = new ShadowAtlas({
        device,
        quality: ShadowQuality.MEDIUM,
      });

      const cascades = new DirectionalShadowCascades({
        cascadeCount: 2,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      cascades.allocateFromAtlas(atlas);
      cascades.destroy();

      // Atlas should have regions freed
      const stats = atlas.getStats();
      expect(stats.allocatedRegions).toBe(0);

      atlas.destroy();
    });

    it('should clear cascade list', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 4,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 100.0,
      });

      cascades.destroy();

      const splits = cascades.getCascades();
      expect(splits).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small near-far range', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 2,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 0.2,
      });

      expect(cascades.getCascades()).toHaveLength(2);

      cascades.destroy();
    });

    it('should handle very large near-far range', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 4,
        resolution: 512,
        nearPlane: 0.1,
        farPlane: 10000.0,
      });

      expect(cascades.getCascades()).toHaveLength(4);

      cascades.destroy();
    });

    it('should handle practical split with lambda=0 (uniform)', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 3,
        resolution: 512,
        nearPlane: 0.1,  // Non-zero to avoid log(0)
        farPlane: 100.0,
        splitScheme: 'practical',
        lambda: 0.0,
      });

      const splits = cascades.getCascades();

      // Lambda=0 should be equivalent to uniform
      expect(splits[0].far).toBeCloseTo(33.4, 0);
      expect(splits[1].far).toBeCloseTo(66.8, 0);

      cascades.destroy();
    });

    it('should handle practical split with lambda=1 (logarithmic)', () => {
      const cascades = new DirectionalShadowCascades({
        cascadeCount: 3,
        resolution: 512,
        nearPlane: 1.0,
        farPlane: 1000.0,
        splitScheme: 'practical',
        lambda: 1.0,
      });

      const splits = cascades.getCascades();

      // Lambda=1 should be equivalent to logarithmic
      expect(splits[0].far).toBeCloseTo(10.0, 0);
      expect(splits[1].far).toBeCloseTo(100.0, 0);

      cascades.destroy();
    });
  });
});
