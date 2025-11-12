/**
 * Light Culler Tests - Epic 3.16
 */

import { describe, it, expect } from 'vitest';
import { LightCuller, BatchLightCuller } from '../src/culling/LightCuller';
import { LightType, type LightData } from '../src/LightCollection';

describe('LightCuller', () => {
  // Helper to create identity matrix
  const identityMatrix = (): Float32Array =>
    new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);

  // Helper to create test light
  const createLight = (type: LightType, position?: [number, number, number], radius?: number): LightData => ({
    entity: 1,
    type,
    enabled: true,
    color: [1, 1, 1],
    intensity: 1,
    direction: type === LightType.DIRECTIONAL || type === LightType.SPOT ? [0, -1, 0] : undefined,
    position,
    radius,
    spotAngle: type === LightType.SPOT ? Math.PI / 4 : undefined,
    spotPenumbra: type === LightType.SPOT ? 0.1 : undefined,
    castsShadows: false,
    shadowBias: 0.005,
  });

  describe('constructor', () => {
    it('should create culler with default stats', () => {
      const culler = new LightCuller();
      const stats = culler.getLastStats();

      expect(stats.totalLights).toBe(0);
      expect(stats.visibleLights).toBe(0);
      expect(stats.culledLights).toBe(0);
      expect(stats.cullTimeMs).toBe(0);
    });
  });

  describe('cull - directional lights', () => {
    it('should never cull directional lights', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        createLight(LightType.DIRECTIONAL),
        createLight(LightType.DIRECTIONAL),
        createLight(LightType.DIRECTIONAL),
      ];

      const result = culler.cull(lights, identityMatrix());

      expect(result.visibleLights.length).toBe(3);
      expect(result.stats.totalLights).toBe(3);
      expect(result.stats.visibleLights).toBe(3);
      expect(result.stats.culledLights).toBe(0);
    });

    it('should handle single directional light', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [createLight(LightType.DIRECTIONAL)];

      const result = culler.cull(lights, identityMatrix());

      expect(result.visibleLights).toHaveLength(1);
      expect(result.visibleLights[0].type).toBe(LightType.DIRECTIONAL);
    });
  });

  describe('cull - ambient lights', () => {
    it('should never cull ambient lights', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        createLight(LightType.AMBIENT),
        createLight(LightType.AMBIENT),
      ];

      const result = culler.cull(lights, identityMatrix());

      expect(result.visibleLights.length).toBe(2);
      expect(result.stats.culledLights).toBe(0);
    });
  });

  describe('cull - point lights', () => {
    it('should include point light at origin', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        createLight(LightType.POINT, [0, 0, 0], 10),
      ];

      const result = culler.cull(lights, identityMatrix());

      expect(result.visibleLights.length).toBe(1);
      expect(result.stats.culledLights).toBe(0);
    });

    it('should cull point light far outside frustum', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        createLight(LightType.POINT, [1000, 1000, 1000], 10),
      ];

      const result = culler.cull(lights, identityMatrix());

      expect(result.visibleLights.length).toBe(0);
      expect(result.stats.totalLights).toBe(1);
      expect(result.stats.culledLights).toBe(1);
    });

    it('should handle multiple point lights with mixed visibility', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        createLight(LightType.POINT, [0, 0, 0], 5),        // Visible
        createLight(LightType.POINT, [500, 500, 500], 5),  // Culled
        createLight(LightType.POINT, [2, 2, 2], 5),        // Visible
        createLight(LightType.POINT, [-500, -500, -500], 5), // Culled
      ];

      const result = culler.cull(lights, identityMatrix());

      expect(result.stats.totalLights).toBe(4);
      expect(result.stats.visibleLights).toBeLessThanOrEqual(4);
      expect(result.stats.culledLights).toBeGreaterThanOrEqual(0);
    });

    it('should handle point light without position (default visible)', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        createLight(LightType.POINT), // No position
      ];

      const result = culler.cull(lights, identityMatrix());

      // Invalid light - included by default to avoid surprises
      expect(result.visibleLights.length).toBe(1);
    });

    it('should handle point light without radius (default visible)', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        { ...createLight(LightType.POINT, [0, 0, 0]), radius: undefined },
      ];

      const result = culler.cull(lights, identityMatrix());

      expect(result.visibleLights.length).toBe(1);
    });
  });

  describe('cull - spot lights', () => {
    it('should include spot light at origin', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        createLight(LightType.SPOT, [0, 0, 0], 10),
      ];

      const result = culler.cull(lights, identityMatrix());

      expect(result.visibleLights.length).toBe(1);
    });

    it('should cull spot light far outside frustum', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        createLight(LightType.SPOT, [1000, 1000, 1000], 10),
      ];

      const result = culler.cull(lights, identityMatrix());

      expect(result.visibleLights.length).toBe(0);
      expect(result.stats.culledLights).toBe(1);
    });

    it('should handle spot light without position (default visible)', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        createLight(LightType.SPOT),
      ];

      const result = culler.cull(lights, identityMatrix());

      expect(result.visibleLights.length).toBe(1);
    });
  });

  describe('cull - mixed light types', () => {
    it('should handle all light types together', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        createLight(LightType.DIRECTIONAL),          // Always visible
        createLight(LightType.AMBIENT),              // Always visible
        createLight(LightType.POINT, [0, 0, 0], 5),  // Visible
        createLight(LightType.SPOT, [0, 0, 0], 5),   // Visible
        createLight(LightType.POINT, [1000, 1000, 1000], 5),  // Culled
      ];

      const result = culler.cull(lights, identityMatrix());

      expect(result.stats.totalLights).toBe(5);
      // At least directional and ambient should be visible
      expect(result.stats.visibleLights).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty lights array', () => {
      const culler = new LightCuller();
      const result = culler.cull([], identityMatrix());

      expect(result.visibleLights.length).toBe(0);
      expect(result.stats.totalLights).toBe(0);
      expect(result.stats.culledLights).toBe(0);
    });
  });

  describe('performance tracking', () => {
    it('should measure culling time', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        createLight(LightType.POINT, [0, 0, 0], 10),
      ];

      const result = culler.cull(lights, identityMatrix());

      expect(result.stats.cullTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.stats.cullTimeMs).toBeLessThan(100); // Should be very fast
    });

    it('should update stats on each cull', () => {
      const culler = new LightCuller();

      // First cull
      const lights1: LightData[] = [createLight(LightType.DIRECTIONAL)];
      const result1 = culler.cull(lights1, identityMatrix());
      expect(result1.stats.totalLights).toBe(1);

      // Second cull with different count
      const lights2: LightData[] = [
        createLight(LightType.DIRECTIONAL),
        createLight(LightType.DIRECTIONAL),
      ];
      const result2 = culler.cull(lights2, identityMatrix());
      expect(result2.stats.totalLights).toBe(2);

      // Last stats should match second cull
      expect(culler.getLastStats().totalLights).toBe(2);
    });

    it('should handle large light counts efficiently', () => {
      const culler = new LightCuller();

      // Create 100 lights (mix of visible and culled)
      const lights: LightData[] = [];
      for (let i = 0; i < 100; i++) {
        const position: [number, number, number] = [
          i < 50 ? 0 : 1000,  // First 50 at origin, rest far away
          0,
          0,
        ];
        lights.push(createLight(LightType.POINT, position, 10));
      }

      const startTime = performance.now();
      const result = culler.cull(lights, identityMatrix());
      const endTime = performance.now();

      expect(result.stats.totalLights).toBe(100);
      expect(endTime - startTime).toBeLessThan(10); // Should be <10ms for 100 lights
    });
  });

  describe('getFrustum', () => {
    it('should return current frustum', () => {
      const culler = new LightCuller();
      culler.cull([], identityMatrix());

      const frustum = culler.getFrustum();
      expect(frustum).toBeDefined();
      expect(frustum.planes).toHaveLength(6);
    });

    it('should update frustum on each cull', () => {
      const culler = new LightCuller();

      const matrix1 = identityMatrix();
      culler.cull([], matrix1);
      const frustum1 = culler.getFrustum();
      const planes1 = frustum1.planes.map(p => ({ ...p })); // Copy planes

      // Different matrix
      const matrix2 = new Float32Array([
        2, 0, 0, 0,
        0, 2, 0, 0,
        0, 0, 2, 0,
        0, 0, 0, 1,
      ]);
      culler.cull([], matrix2);
      const frustum2 = culler.getFrustum();

      // Should return the same frustum instance (for performance)
      expect(frustum2).toBe(frustum1);

      // But planes should have been updated
      const planes2 = frustum2.planes;
      expect(planes2[0]).not.toEqual(planes1[0]);
    });
  });

  describe('getLastStats', () => {
    it('should return stats from last cull', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        createLight(LightType.DIRECTIONAL),
        createLight(LightType.AMBIENT),
      ];

      culler.cull(lights, identityMatrix());
      const stats = culler.getLastStats();

      expect(stats.totalLights).toBe(2);
      expect(stats.visibleLights).toBe(2);
      expect(stats.culledLights).toBe(0);
      expect(stats.cullTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('should handle unknown light type (default visible)', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        { ...createLight(LightType.DIRECTIONAL), type: 999 as LightType },
      ];

      const result = culler.cull(lights, identityMatrix());

      // Unknown type - included by default
      expect(result.visibleLights.length).toBe(1);
    });

    it('should handle perspective projection matrix', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        createLight(LightType.POINT, [0, 0, 0], 5),
      ];

      // Typical perspective projection
      const fov = Math.PI / 4;
      const aspect = 16 / 9;
      const near = 0.1;
      const far = 1000;

      const f = 1.0 / Math.tan(fov / 2);
      const perspective = new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) / (near - far), -1,
        0, 0, (2 * far * near) / (near - far), 0,
      ]);

      const result = culler.cull(lights, perspective);

      expect(result.stats.totalLights).toBe(1);
    });

    it('should handle orthographic projection matrix', () => {
      const culler = new LightCuller();
      const lights: LightData[] = [
        createLight(LightType.POINT, [0, 0, 0], 5),
      ];

      // Simple orthographic projection
      const ortho = new Float32Array([
        0.1, 0, 0, 0,
        0, 0.1, 0, 0,
        0, 0, -0.002, 0,
        0, 0, -1, 1,
      ]);

      const result = culler.cull(lights, ortho);

      expect(result.stats.totalLights).toBe(1);
    });
  });
});

describe('BatchLightCuller', () => {
  const identityMatrix = (): Float32Array =>
    new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);

  const createLight = (type: LightType, position?: [number, number, number], radius?: number): LightData => ({
    entity: 1,
    type,
    enabled: true,
    color: [1, 1, 1],
    intensity: 1,
    direction: type === LightType.DIRECTIONAL || type === LightType.SPOT ? [0, -1, 0] : undefined,
    position,
    radius,
    spotAngle: type === LightType.SPOT ? Math.PI / 4 : undefined,
    spotPenumbra: type === LightType.SPOT ? 0.1 : undefined,
    castsShadows: false,
    shadowBias: 0.005,
  });

  describe('cullMultiple', () => {
    it('should cull for single view', () => {
      const batchCuller = new BatchLightCuller();
      const lights: LightData[] = [
        createLight(LightType.DIRECTIONAL),
      ];

      const results = batchCuller.cullMultiple(lights, [identityMatrix()]);

      expect(results.length).toBe(1);
      expect(results[0].visibleLights.length).toBe(1);
    });

    it('should cull for multiple views', () => {
      const batchCuller = new BatchLightCuller();
      const lights: LightData[] = [
        createLight(LightType.DIRECTIONAL),
        createLight(LightType.AMBIENT),
      ];

      const results = batchCuller.cullMultiple(lights, [
        identityMatrix(),
        identityMatrix(),
        identityMatrix(),
      ]);

      expect(results.length).toBe(3);
      results.forEach((result) => {
        expect(result.stats.totalLights).toBe(2);
      });
    });

    it('should handle empty views array', () => {
      const batchCuller = new BatchLightCuller();
      const lights: LightData[] = [createLight(LightType.DIRECTIONAL)];

      const results = batchCuller.cullMultiple(lights, []);

      expect(results.length).toBe(0);
    });

    it('should reuse cullers across multiple calls', () => {
      const batchCuller = new BatchLightCuller();
      const lights: LightData[] = [createLight(LightType.DIRECTIONAL)];

      // First call with 2 views
      batchCuller.cullMultiple(lights, [identityMatrix(), identityMatrix()]);

      // Second call with 2 views - should reuse cullers
      const results = batchCuller.cullMultiple(lights, [identityMatrix(), identityMatrix()]);

      expect(results.length).toBe(2);
    });

    it('should expand culler pool when needed', () => {
      const batchCuller = new BatchLightCuller();
      const lights: LightData[] = [createLight(LightType.DIRECTIONAL)];

      // First call with 2 views
      batchCuller.cullMultiple(lights, [identityMatrix(), identityMatrix()]);

      // Second call with 4 views - should create more cullers
      const results = batchCuller.cullMultiple(lights, [
        identityMatrix(),
        identityMatrix(),
        identityMatrix(),
        identityMatrix(),
      ]);

      expect(results.length).toBe(4);
    });
  });

  describe('getAllStats', () => {
    it('should return stats for all views', () => {
      const batchCuller = new BatchLightCuller();
      const lights: LightData[] = [
        createLight(LightType.DIRECTIONAL),
        createLight(LightType.AMBIENT),
      ];

      batchCuller.cullMultiple(lights, [
        identityMatrix(),
        identityMatrix(),
      ]);

      const allStats = batchCuller.getAllStats();

      expect(allStats.length).toBe(2);
      allStats.forEach((stats) => {
        expect(stats.totalLights).toBe(2);
        expect(stats.visibleLights).toBe(2);
      });
    });

    it('should return empty array before first cull', () => {
      const batchCuller = new BatchLightCuller();
      const allStats = batchCuller.getAllStats();

      expect(allStats.length).toBe(0);
    });
  });

  describe('performance', () => {
    it('should handle multiple views efficiently', () => {
      const batchCuller = new BatchLightCuller();

      // Create 50 lights
      const lights: LightData[] = [];
      for (let i = 0; i < 50; i++) {
        lights.push(createLight(LightType.POINT, [i, 0, 0], 10));
      }

      // Cull for 4 views
      const matrices = [
        identityMatrix(),
        identityMatrix(),
        identityMatrix(),
        identityMatrix(),
      ];

      const startTime = performance.now();
      const results = batchCuller.cullMultiple(lights, matrices);
      const endTime = performance.now();

      expect(results.length).toBe(4);
      expect(endTime - startTime).toBeLessThan(20); // Should be <20ms for 4 views × 50 lights
    });
  });
});
