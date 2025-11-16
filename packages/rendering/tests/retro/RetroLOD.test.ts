/**
 * RetroLOD System Tests
 * Epic 3.4: Retro Rendering Pipeline - LOD System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RetroLODSystem,
  DEFAULT_LOD_DISTANCES,
  calculateLODBias,
  type LODGroupConfig,
  type LODLevel,
} from '../../src/retro/RetroLOD';
import { createMockBackend } from '../test-utils/mockBackend';
import type { IRendererBackend } from '../../src/backends/IRendererBackend';

describe('RetroLODSystem', () => {
  let backend: IRendererBackend;
  let lodSystem: RetroLODSystem;

  beforeEach(() => {
    backend = createMockBackend();
    lodSystem = new RetroLODSystem(backend);
  });

  afterEach(() => {
    lodSystem.dispose();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(() => lodSystem.initialize()).not.toThrow();
    });

    it('should not re-initialize if already initialized', () => {
      lodSystem.initialize();
      lodSystem.initialize(); // Should not throw
      expect(true).toBe(true);
    });

    it('should start with zero groups', () => {
      lodSystem.initialize();
      const stats = lodSystem.getStats();
      expect(stats.totalGroups).toBe(0);
    });
  });

  describe('LOD Group Registration', () => {
    const validGroup: LODGroupConfig = {
      id: 'test_object',
      levels: [
        { minDistance: 0, maxDistance: 30, vertexCount: 1000 },
        { minDistance: 30, maxDistance: 100, vertexCount: 300 },
        { minDistance: 100, maxDistance: 200, vertexCount: 50 },
      ],
      crossfadeDistance: 10,
    };

    it('should register valid LOD group', () => {
      expect(() => lodSystem.registerGroup(validGroup)).not.toThrow();
      expect(lodSystem.getGroup('test_object')).toEqual(validGroup);
    });

    it('should update total groups count', () => {
      lodSystem.initialize();
      lodSystem.registerGroup(validGroup);
      const stats = lodSystem.getStats();
      expect(stats.totalGroups).toBe(1);
    });

    it('should register multiple groups', () => {
      const group2: LODGroupConfig = {
        id: 'tree',
        levels: [
          { minDistance: 0, maxDistance: 50, vertexCount: 500 },
          { minDistance: 50, maxDistance: 150, vertexCount: 100 },
        ],
        crossfadeDistance: 15,
      };

      lodSystem.registerGroup(validGroup);
      lodSystem.registerGroup(group2);

      expect(lodSystem.getGroup('test_object')).toEqual(validGroup);
      expect(lodSystem.getGroup('tree')).toEqual(group2);

      const stats = lodSystem.getStats();
      expect(stats.totalGroups).toBe(2);
    });

    it('should reject LOD group with negative minDistance', () => {
      const invalidGroup: LODGroupConfig = {
        id: 'invalid',
        levels: [
          { minDistance: -10, maxDistance: 30, vertexCount: 1000 },
        ],
        crossfadeDistance: 10,
      };

      expect(() => lodSystem.registerGroup(invalidGroup)).toThrow(
        'LOD level 0 has negative minDistance: -10'
      );
    });

    it('should reject LOD group with inverted range (min >= max)', () => {
      const invalidGroup: LODGroupConfig = {
        id: 'invalid',
        levels: [
          { minDistance: 100, maxDistance: 50, vertexCount: 1000 },
        ],
        crossfadeDistance: 10,
      };

      expect(() => lodSystem.registerGroup(invalidGroup)).toThrow(
        'LOD level 0 has inverted range: [100, 50]'
      );
    });

    it('should reject LOD group with equal min and max', () => {
      const invalidGroup: LODGroupConfig = {
        id: 'invalid',
        levels: [
          { minDistance: 50, maxDistance: 50, vertexCount: 1000 },
        ],
        crossfadeDistance: 10,
      };

      expect(() => lodSystem.registerGroup(invalidGroup)).toThrow(
        'LOD level 0 has inverted range: [50, 50]'
      );
    });

    it('should reject LOD group with overlapping levels', () => {
      const invalidGroup: LODGroupConfig = {
        id: 'invalid',
        levels: [
          { minDistance: 0, maxDistance: 50, vertexCount: 1000 },
          { minDistance: 40, maxDistance: 100, vertexCount: 300 }, // Overlaps with previous
        ],
        crossfadeDistance: 10,
      };

      expect(() => lodSystem.registerGroup(invalidGroup)).toThrow(
        'LOD level 1 overlaps with level 0'
      );
    });
  });

  describe('LOD Group Unregistration', () => {
    const group: LODGroupConfig = {
      id: 'test_object',
      levels: [
        { minDistance: 0, maxDistance: 30, vertexCount: 1000 },
      ],
      crossfadeDistance: 10,
    };

    it('should unregister LOD group', () => {
      lodSystem.registerGroup(group);
      expect(lodSystem.getGroup('test_object')).toBeDefined();

      lodSystem.unregisterGroup('test_object');
      expect(lodSystem.getGroup('test_object')).toBeUndefined();
    });

    it('should update total groups count on unregister', () => {
      lodSystem.initialize();
      lodSystem.registerGroup(group);
      expect(lodSystem.getStats().totalGroups).toBe(1);

      lodSystem.unregisterGroup('test_object');
      expect(lodSystem.getStats().totalGroups).toBe(0);
    });

    it('should handle unregistering non-existent group gracefully', () => {
      expect(() => lodSystem.unregisterGroup('does_not_exist')).not.toThrow();
    });
  });

  describe('LOD Selection', () => {
    const group: LODGroupConfig = {
      id: 'test_object',
      levels: [
        { minDistance: 0, maxDistance: 30, vertexCount: 1000 },
        { minDistance: 30, maxDistance: 100, vertexCount: 300 },
        { minDistance: 100, maxDistance: 200, vertexCount: 50 },
      ],
      crossfadeDistance: 10,
    };

    beforeEach(() => {
      lodSystem.registerGroup(group);
    });

    it('should select LOD 0 for close distances', () => {
      const selection = lodSystem.selectLOD('test_object', 15);
      expect(selection.primaryLOD).toBe(0);
      expect(selection.crossfadeFactor).toBe(0);
      expect(selection.secondaryLOD).toBeUndefined();
    });

    it('should select LOD 1 for medium distances', () => {
      const selection = lodSystem.selectLOD('test_object', 50);
      expect(selection.primaryLOD).toBe(1);
      expect(selection.crossfadeFactor).toBe(0);
      expect(selection.secondaryLOD).toBeUndefined();
    });

    it('should select LOD 2 for far distances', () => {
      const selection = lodSystem.selectLOD('test_object', 150);
      expect(selection.primaryLOD).toBe(2);
      expect(selection.crossfadeFactor).toBe(0);
      expect(selection.secondaryLOD).toBeUndefined();
    });

    it('should return -1 for distances beyond all LOD ranges (culling)', () => {
      const selection = lodSystem.selectLOD('test_object', 250);
      expect(selection.primaryLOD).toBe(-1);
      expect(selection.crossfadeFactor).toBe(0);
      expect(selection.secondaryLOD).toBeUndefined();
    });

    it('should crossfade between LOD 0 and LOD 1', () => {
      // Crossfade region: [20, 30] (maxDistance=30, crossfadeDistance=10)
      const selection = lodSystem.selectLOD('test_object', 25);

      expect(selection.primaryLOD).toBe(0);
      expect(selection.secondaryLOD).toBe(1);
      expect(selection.crossfadeFactor).toBeCloseTo(0.5, 5);
    });

    it('should crossfade between LOD 1 and LOD 2', () => {
      // Crossfade region: [90, 100]
      const selection = lodSystem.selectLOD('test_object', 95);

      expect(selection.primaryLOD).toBe(1);
      expect(selection.secondaryLOD).toBe(2);
      expect(selection.crossfadeFactor).toBeCloseTo(0.5, 5);
    });

    it('should not crossfade from last LOD level', () => {
      // At boundary of last LOD
      const selection = lodSystem.selectLOD('test_object', 195);

      expect(selection.primaryLOD).toBe(2);
      expect(selection.secondaryLOD).toBeUndefined();
      expect(selection.crossfadeFactor).toBe(0);
    });

    it('should calculate correct crossfade factor at start of region', () => {
      // Start of crossfade region: distance = 20
      const selection = lodSystem.selectLOD('test_object', 20);

      expect(selection.crossfadeFactor).toBeCloseTo(0.0, 5);
    });

    it('should calculate correct crossfade factor at end of region', () => {
      // End of crossfade region: distance = 30
      const selection = lodSystem.selectLOD('test_object', 30);

      // At exactly maxDistance, we're at the boundary - should still be in LOD 0
      expect(selection.primaryLOD).toBe(0);
      expect(selection.crossfadeFactor).toBeCloseTo(1.0, 5);
    });

    it('should throw for non-existent group', () => {
      expect(() => lodSystem.selectLOD('does_not_exist', 50)).toThrow(
        'LOD group not found: does_not_exist'
      );
    });
  });

  describe('Statistics', () => {
    const group: LODGroupConfig = {
      id: 'test_object',
      levels: [
        { minDistance: 0, maxDistance: 30, vertexCount: 1000 },
        { minDistance: 30, maxDistance: 100, vertexCount: 300 },
      ],
      crossfadeDistance: 10,
    };

    beforeEach(() => {
      lodSystem.initialize();
      lodSystem.registerGroup(group);
    });

    it('should track crossfading groups', () => {
      lodSystem.resetFrameStats();

      // Select in crossfade region
      lodSystem.selectLOD('test_object', 25);

      const stats = lodSystem.getStats();
      expect(stats.crossfadingGroups).toBe(1);
    });

    it('should reset frame statistics', () => {
      lodSystem.selectLOD('test_object', 25); // Triggers crossfading

      lodSystem.resetFrameStats();

      const stats = lodSystem.getStats();
      expect(stats.crossfadingGroups).toBe(0);
      expect(stats.visibleGroups).toBe(0);
      expect(stats.trianglesSaved).toBe(0);
    });

    it('should maintain total groups count across resets', () => {
      lodSystem.resetFrameStats();

      const stats = lodSystem.getStats();
      expect(stats.totalGroups).toBe(1);
    });

    it('should return defensive copy of stats', () => {
      const stats1 = lodSystem.getStats();
      const stats2 = lodSystem.getStats();

      expect(stats1).not.toBe(stats2); // Different objects
      expect(stats1).toEqual(stats2); // Same values
    });
  });

  describe('Default LOD Distances', () => {
    it('should provide PS2-era default distances', () => {
      expect(DEFAULT_LOD_DISTANCES.close).toEqual({ min: 0, max: 30 });
      expect(DEFAULT_LOD_DISTANCES.medium).toEqual({ min: 30, max: 100 });
      expect(DEFAULT_LOD_DISTANCES.far).toEqual({ min: 100, max: 200 });
      expect(DEFAULT_LOD_DISTANCES.crossfade).toBe(10);
    });

    it('should create valid LOD group from defaults', () => {
      const group: LODGroupConfig = {
        id: 'using_defaults',
        levels: [
          {
            minDistance: DEFAULT_LOD_DISTANCES.close.min,
            maxDistance: DEFAULT_LOD_DISTANCES.close.max,
            vertexCount: 1000
          },
          {
            minDistance: DEFAULT_LOD_DISTANCES.medium.min,
            maxDistance: DEFAULT_LOD_DISTANCES.medium.max,
            vertexCount: 300
          },
          {
            minDistance: DEFAULT_LOD_DISTANCES.far.min,
            maxDistance: DEFAULT_LOD_DISTANCES.far.max,
            vertexCount: 50
          },
        ],
        crossfadeDistance: DEFAULT_LOD_DISTANCES.crossfade,
      };

      expect(() => lodSystem.registerGroup(group)).not.toThrow();
    });
  });

  describe('calculateLODBias', () => {
    it('should return bias of 1.0 for object at threshold size', () => {
      const bias = calculateLODBias(
        1.0,        // boundingRadius
        10.0,       // distance
        Math.PI / 3, // fov (60 degrees)
        1080        // screenHeight
      );

      // At threshold (50 pixels), bias should be around 1.0
      expect(bias).toBeGreaterThanOrEqual(0.5);
      expect(bias).toBeLessThanOrEqual(2.0);
    });

    it('should return higher bias for small objects (bias towards lower LOD)', () => {
      const smallBias = calculateLODBias(
        0.1,        // Small bounding radius
        100.0,      // Far distance
        Math.PI / 3,
        1080
      );

      // Small object far away should have high bias (push to lower LOD)
      expect(smallBias).toBeGreaterThan(1.0);
      expect(smallBias).toBeLessThanOrEqual(2.0); // Clamped to max 2.0
    });

    it('should return lower bias for large objects (bias towards higher LOD)', () => {
      const largeBias = calculateLODBias(
        10.0,       // Large bounding radius
        20.0,       // Close distance
        Math.PI / 3,
        1080
      );

      // Large object close should have low bias (push to higher LOD)
      expect(largeBias).toBeLessThan(1.0);
      expect(largeBias).toBeGreaterThanOrEqual(0.5); // Clamped to min 0.5
    });

    it('should clamp bias to minimum 0.5', () => {
      const bias = calculateLODBias(
        100.0,      // Huge bounding radius
        10.0,       // Very close
        Math.PI / 3,
        1080
      );

      expect(bias).toBeGreaterThanOrEqual(0.5);
    });

    it('should clamp bias to maximum 2.0', () => {
      const bias = calculateLODBias(
        0.01,       // Tiny bounding radius
        1000.0,     // Very far
        Math.PI / 3,
        1080
      );

      expect(bias).toBeLessThanOrEqual(2.0);
    });

    it('should handle different FOV values', () => {
      const narrowFOV = calculateLODBias(1.0, 10.0, Math.PI / 6, 1080); // 30 degrees
      const wideFOV = calculateLODBias(1.0, 10.0, Math.PI / 2, 1080);   // 90 degrees

      // Narrow FOV should make objects appear larger (lower bias)
      expect(narrowFOV).toBeLessThanOrEqual(wideFOV);
    });

    it('should handle different screen heights', () => {
      const lowRes = calculateLODBias(1.0, 10.0, Math.PI / 3, 720);  // 720p
      const highRes = calculateLODBias(1.0, 10.0, Math.PI / 3, 1440); // 1440p

      // Higher resolution means more pixels, lower bias needed
      expect(lowRes).toBeGreaterThanOrEqual(highRes);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single LOD level', () => {
      const singleLODGroup: LODGroupConfig = {
        id: 'single',
        levels: [
          { minDistance: 0, maxDistance: 100, vertexCount: 500 },
        ],
        crossfadeDistance: 10,
      };

      lodSystem.registerGroup(singleLODGroup);

      const selection = lodSystem.selectLOD('single', 50);
      expect(selection.primaryLOD).toBe(0);
      expect(selection.secondaryLOD).toBeUndefined();
    });

    it('should handle zero crossfade distance', () => {
      const noCrossfadeGroup: LODGroupConfig = {
        id: 'no_crossfade',
        levels: [
          { minDistance: 0, maxDistance: 50, vertexCount: 1000 },
          { minDistance: 50, maxDistance: 100, vertexCount: 300 },
        ],
        crossfadeDistance: 0,
      };

      lodSystem.registerGroup(noCrossfadeGroup);

      // At boundary, no crossfade should occur
      const selection = lodSystem.selectLOD('no_crossfade', 49);
      expect(selection.primaryLOD).toBe(0);
      expect(selection.secondaryLOD).toBeUndefined();
    });

    it('should handle distance exactly at LOD boundary', () => {
      const group: LODGroupConfig = {
        id: 'boundary',
        levels: [
          { minDistance: 0, maxDistance: 50, vertexCount: 1000 },
          { minDistance: 50, maxDistance: 100, vertexCount: 300 },
        ],
        crossfadeDistance: 10,
      };

      lodSystem.registerGroup(group);

      // Distance exactly at 50
      const selection = lodSystem.selectLOD('boundary', 50);

      // With inclusive bounds on both ends, distance 50 matches LOD 0's [0, 50]
      // Implementation returns first match
      expect(selection.primaryLOD).toBe(0);
    });

    it('should handle distance at zero (minimum boundary)', () => {
      const group: LODGroupConfig = {
        id: 'zero_dist',
        levels: [
          { minDistance: 0, maxDistance: 50, vertexCount: 1000 },
        ],
        crossfadeDistance: 10,
      };

      lodSystem.registerGroup(group);

      const selection = lodSystem.selectLOD('zero_dist', 0);
      expect(selection.primaryLOD).toBe(0);
    });

    it('should handle very large distances (culling)', () => {
      const group: LODGroupConfig = {
        id: 'far',
        levels: [
          { minDistance: 0, maxDistance: 100, vertexCount: 1000 },
        ],
        crossfadeDistance: 10,
      };

      lodSystem.registerGroup(group);

      // Beyond furthest LOD should be culled
      const selection = lodSystem.selectLOD('far', 1000);
      expect(selection.primaryLOD).toBe(-1);
    });

    it('should handle negative distances', () => {
      const group: LODGroupConfig = {
        id: 'negative',
        levels: [
          { minDistance: 0, maxDistance: 100, vertexCount: 1000 },
        ],
        crossfadeDistance: 10,
      };

      lodSystem.registerGroup(group);

      // Negative distance should select LOD 0 (before closest LOD)
      const selection = lodSystem.selectLOD('negative', -10);
      expect(selection.primaryLOD).toBe(0);
    });
  });
});
