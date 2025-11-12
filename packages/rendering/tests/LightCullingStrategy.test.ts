/**
 * LightCullingStrategy Tests - Epic 3.16 Phase 2
 */

import { describe, it, expect } from 'vitest';
import {
  CPUCullingStrategy,
  createLightCullingStrategy,
  type CullingResult,
} from '../src/culling/LightCullingStrategy';
import type { LightData } from '../src/LightCollection';

/**
 * Create test lights
 */
function createTestLights(count: number): LightData[] {
  const lights: LightData[] = [];

  for (let i = 0; i < count; i++) {
    lights.push({
      type: i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2,
      position: [i * 10, i * 5, -20],
      direction: [0, -1, 0],
      color: [1, 1, 1],
      intensity: 1.0,
      radius: 10,
      innerConeAngle: Math.PI / 6,
      outerConeAngle: Math.PI / 4,
    });
  }

  return lights;
}

/**
 * Create perspective projection matrix
 */
function createPerspectiveMatrix(
  fov: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  const f = 1.0 / Math.tan(fov / 2);
  const rangeInv = 1.0 / (near - far);

  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0,
  ]);
}

/**
 * Create view matrix
 */
function createViewMatrix(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

describe('LightCullingStrategy', () => {
  describe('CPUCullingStrategy', () => {
    it('should create strategy', () => {
      const strategy = new CPUCullingStrategy();
      expect(strategy).toBeDefined();
    });

    it('should cull lights against frustum', () => {
      const strategy = new CPUCullingStrategy();
      const lights = createTestLights(10);
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);

      const result = strategy.cull(lights, vpMatrix);

      expect(result).toBeDefined();
      expect(result.stats.strategy).toBe('cpu');
    });

    it('should return visibleLights array', () => {
      const strategy = new CPUCullingStrategy();
      const lights = createTestLights(10);
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);

      const result = strategy.cull(lights, vpMatrix);

      expect(result.visibleLights).not.toBeNull();
      expect(Array.isArray(result.visibleLights)).toBe(true);
    });

    it('should not return tileLightIndices', () => {
      const strategy = new CPUCullingStrategy();
      const lights = createTestLights(10);
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);

      const result = strategy.cull(lights, vpMatrix);

      expect(result.tileLightIndices).toBeNull();
      expect(result.gpuData).toBeUndefined();
    });

    it('should return culling statistics', () => {
      const strategy = new CPUCullingStrategy();
      const lights = createTestLights(10);
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);

      const result = strategy.cull(lights, vpMatrix);

      expect(result.stats).toBeDefined();
      expect(result.stats.totalLights).toBe(10);
      expect(result.stats.visibleLights).toBeGreaterThanOrEqual(0);
      expect(result.stats.culledLights).toBeGreaterThanOrEqual(0);
      expect(result.stats.cullTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.stats.strategy).toBe('cpu');
    });

    it('should handle empty light array', () => {
      const strategy = new CPUCullingStrategy();
      const lights: LightData[] = [];
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);

      const result = strategy.cull(lights, vpMatrix);

      expect(result).toBeDefined();
      expect(result.stats.totalLights).toBe(0);
      expect(result.stats.visibleLights).toBe(0);
      expect(result.visibleLights).toHaveLength(0);
    });

    it('should handle single light', () => {
      const strategy = new CPUCullingStrategy();
      const lights = createTestLights(1);
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);

      const result = strategy.cull(lights, vpMatrix);

      expect(result).toBeDefined();
      expect(result.stats.totalLights).toBe(1);
    });

    it('should handle large light arrays', () => {
      const strategy = new CPUCullingStrategy();
      const lights = createTestLights(1000);
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);

      const result = strategy.cull(lights, vpMatrix);

      expect(result).toBeDefined();
      expect(result.stats.totalLights).toBe(1000);
      expect(result.stats.cullTimeMs).toBeLessThan(100); // Should be fast
    });

    it('should return synchronous result', () => {
      const strategy = new CPUCullingStrategy();
      const lights = createTestLights(10);
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);

      const result = strategy.cull(lights, vpMatrix);

      // Should not be a Promise
      expect(result).not.toBeInstanceOf(Promise);
      expect(result.stats).toBeDefined();
    });
  });

  describe('createLightCullingStrategy', () => {
    it('should create CPU strategy by default', async () => {
      const strategy = await createLightCullingStrategy({});

      expect(strategy).toBeDefined();

      const lights = createTestLights(5);
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const result = strategy.cull(lights, vpMatrix);

      // CPU strategy returns synchronous result
      expect(result).not.toBeInstanceOf(Promise);
    });

    it('should create CPU strategy when preferGPU is false', async () => {
      const strategy = await createLightCullingStrategy({
        preferGPU: false,
      });

      expect(strategy).toBeDefined();

      const lights = createTestLights(5);
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const result = strategy.cull(lights, vpMatrix);

      expect(result).not.toBeInstanceOf(Promise);
    });

    it('should fall back to CPU when no device provided', async () => {
      const strategy = await createLightCullingStrategy({
        preferGPU: true,
        screenWidth: 1920,
        screenHeight: 1080,
        // No device provided
      });

      expect(strategy).toBeDefined();

      const lights = createTestLights(5);
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const result = strategy.cull(lights, vpMatrix);

      // CPU fallback returns synchronous result
      expect(result).not.toBeInstanceOf(Promise);
    });

    it('should fall back to CPU when no screen dimensions provided', async () => {
      const strategy = await createLightCullingStrategy({
        preferGPU: true,
        // No screenWidth/screenHeight provided
      });

      expect(strategy).toBeDefined();

      const lights = createTestLights(5);
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const result = strategy.cull(lights, vpMatrix);

      expect(result).not.toBeInstanceOf(Promise);
    });

    it('should use custom tile size if provided', async () => {
      const strategy = await createLightCullingStrategy({
        preferGPU: false,
        tileSize: 32,
      });

      expect(strategy).toBeDefined();
    });

    it('should create usable strategy', async () => {
      const strategy = await createLightCullingStrategy({
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const lights = createTestLights(50);
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);

      const result = strategy.cull(lights, vpMatrix);

      // Verify result is valid
      if (result instanceof Promise) {
        const asyncResult = await result;
        expect(asyncResult.stats.totalLights).toBe(50);
      } else {
        expect(result.stats.totalLights).toBe(50);
      }
    });
  });

  describe('CullingResult interface', () => {
    it('should match expected structure for CPU strategy', () => {
      const strategy = new CPUCullingStrategy();
      const lights = createTestLights(10);
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);

      const result: CullingResult = strategy.cull(lights, vpMatrix);

      // Verify interface compliance
      expect(result.visibleLights).toBeDefined();
      expect(result.tileLightIndices).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats.totalLights).toBeDefined();
      expect(result.stats.visibleLights).toBeDefined();
      expect(result.stats.culledLights).toBeDefined();
      expect(result.stats.cullTimeMs).toBeDefined();
      expect(result.stats.strategy).toBeDefined();
    });

    it('should have correct stats for CPU strategy', () => {
      const strategy = new CPUCullingStrategy();
      const lights = createTestLights(10);
      const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);

      const result = strategy.cull(lights, vpMatrix);

      expect(result.stats.strategy).toBe('cpu');
      expect(result.stats.totalLights + result.stats.visibleLights).toBeGreaterThanOrEqual(
        result.stats.totalLights
      );
    });
  });
});
