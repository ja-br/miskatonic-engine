/**
 * Tests for ShadowCache - Epic 3.17 Phase 2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ShadowCache, ShadowCacheState, LightMobility } from '../src/shadows/ShadowCache';

describe('ShadowCache', () => {
  let cache: ShadowCache;

  beforeEach(() => {
    cache = new ShadowCache();
  });

  describe('Light Registration', () => {
    it('should register static light', () => {
      cache.registerLight({
        lightId: 'sun',
        mobility: LightMobility.STATIC,
      });

      const entry = cache.getEntry('sun');
      expect(entry).not.toBeUndefined();
      expect(entry!.mobility).toBe(LightMobility.STATIC);
      expect(entry!.state).toBe(ShadowCacheState.UNINITIALIZED);
    });

    it('should register stationary light', () => {
      cache.registerLight({
        lightId: 'lamp',
        mobility: LightMobility.STATIONARY,
        maxCacheFrames: 300,
      });

      const entry = cache.getEntry('lamp');
      expect(entry).not.toBeUndefined();
      expect(entry!.mobility).toBe(LightMobility.STATIONARY);
      expect(entry!.maxCacheFrames).toBe(300);
    });

    it('should register movable light', () => {
      cache.registerLight({
        lightId: 'flashlight',
        mobility: LightMobility.MOVABLE,
      });

      const entry = cache.getEntry('flashlight');
      expect(entry).not.toBeUndefined();
      expect(entry!.mobility).toBe(LightMobility.MOVABLE);
    });

    it('should warn on duplicate registration', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      cache.registerLight({ lightId: 'test', mobility: LightMobility.STATIC });
      cache.registerLight({ lightId: 'test', mobility: LightMobility.STATIC });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already registered')
      );

      consoleSpy.mockRestore();
    });

    it('should unregister light', () => {
      cache.registerLight({ lightId: 'test', mobility: LightMobility.STATIC });
      cache.unregisterLight('test');

      const entry = cache.getEntry('test');
      expect(entry).toBeUndefined();
    });

    it('should handle unregister of non-existent light', () => {
      expect(() => {
        cache.unregisterLight('nonexistent');
      }).not.toThrow();
    });
  });

  describe('Update Detection', () => {
    beforeEach(() => {
      cache.registerLight({
        lightId: 'sun',
        mobility: LightMobility.STATIC,
      });
    });

    it('should require update for uninitialized light', () => {
      expect(cache.needsUpdate('sun', 0)).toBe(true);
    });

    it('should not require update for valid cached shadow', () => {
      cache.markRendered('sun', 0);
      expect(cache.needsUpdate('sun', 1)).toBe(false);
    });

    it('should always require update for movable lights', () => {
      cache.registerLight({
        lightId: 'flashlight',
        mobility: LightMobility.MOVABLE,
      });

      cache.markRendered('flashlight', 0);
      expect(cache.needsUpdate('flashlight', 1)).toBe(true);
    });

    it('should require update after frame-based expiration', () => {
      cache.registerLight({
        lightId: 'lamp',
        mobility: LightMobility.STATIONARY,
        maxCacheFrames: 10,
      });

      cache.markRendered('lamp', 0);
      expect(cache.needsUpdate('lamp', 5)).toBe(false);
      expect(cache.needsUpdate('lamp', 10)).toBe(true);
    });

    it('should require update for unknown light', () => {
      expect(cache.needsUpdate('unknown', 0)).toBe(true);
    });

    it('should require update for invalid state', () => {
      cache.invalidate('sun');
      expect(cache.needsUpdate('sun', 0)).toBe(true);
    });
  });

  describe('Mark Rendered', () => {
    beforeEach(() => {
      cache.registerLight({
        lightId: 'sun',
        mobility: LightMobility.STATIC,
      });
    });

    it('should mark shadow as valid', () => {
      cache.markRendered('sun', 0);

      const entry = cache.getEntry('sun');
      expect(entry!.state).toBe(ShadowCacheState.VALID);
      expect(entry!.lastRenderedFrame).toBe(0);
    });

    it('should update transform hash', () => {
      const transform = { position: [1, 2, 3], rotation: [0, 0, 0, 1] };

      cache.markRendered('sun', 0, transform);

      const entry = cache.getEntry('sun');
      expect(entry!.transformHash).not.toBe('');
    });

    it('should update geometry hash', () => {
      const geometry = { meshes: ['mesh1', 'mesh2'] };

      cache.markRendered('sun', 0, undefined, geometry);

      const entry = cache.getEntry('sun');
      expect(entry!.geometryHash).not.toBe('');
    });

    it('should warn on marking unknown light', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      cache.markRendered('unknown', 0);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown light')
      );

      consoleSpy.mockRestore();
    });

    it('should reset cache frame count', () => {
      cache.markRendered('sun', 0);
      cache.advanceFrame();
      cache.advanceFrame();

      const entryBefore = cache.getEntry('sun');
      expect(entryBefore!.cacheFrameCount).toBe(2);

      cache.markRendered('sun', 2);

      const entryAfter = cache.getEntry('sun');
      expect(entryAfter!.cacheFrameCount).toBe(0);
    });
  });

  describe('Invalidation', () => {
    beforeEach(() => {
      cache.registerLight({ lightId: 'sun', mobility: LightMobility.STATIC });
      cache.markRendered('sun', 0);
    });

    it('should invalidate specific light', () => {
      cache.invalidate('sun');

      const entry = cache.getEntry('sun');
      expect(entry!.state).toBe(ShadowCacheState.INVALID);
    });

    it('should invalidate all lights', () => {
      cache.registerLight({ lightId: 'lamp', mobility: LightMobility.STATIONARY });
      cache.markRendered('lamp', 0);

      cache.invalidateAll();

      expect(cache.getEntry('sun')!.state).toBe(ShadowCacheState.INVALID);
      expect(cache.getEntry('lamp')!.state).toBe(ShadowCacheState.INVALID);
    });

    it('should handle invalidate of unregistered light', () => {
      expect(() => {
        cache.invalidate('unknown');
      }).not.toThrow();
    });
  });

  describe('Transform Update', () => {
    beforeEach(() => {
      cache.registerLight({ lightId: 'sun', mobility: LightMobility.STATIC });
    });

    it('should detect transform change', () => {
      const transform1 = { position: [0, 0, 0] };
      const transform2 = { position: [1, 0, 0] };

      cache.markRendered('sun', 0, transform1);
      const changed = cache.updateTransform('sun', transform2);

      expect(changed).toBe(true);
      expect(cache.getEntry('sun')!.state).toBe(ShadowCacheState.INVALID);
    });

    it('should not invalidate on identical transform', () => {
      const transform = { position: [0, 0, 0] };

      cache.markRendered('sun', 0, transform);
      const changed = cache.updateTransform('sun', transform);

      expect(changed).toBe(false);
      expect(cache.getEntry('sun')!.state).toBe(ShadowCacheState.VALID);
    });

    it('should return false for unknown light', () => {
      const changed = cache.updateTransform('unknown', {});
      expect(changed).toBe(false);
    });

    it('should use FNV-1a hash (no collisions)', () => {
      // Two different objects should have different hashes
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };

      cache.markRendered('sun', 0, obj1);
      const changed = cache.updateTransform('sun', obj2);

      expect(changed).toBe(true);
    });
  });

  describe('Geometry Update', () => {
    beforeEach(() => {
      cache.registerLight({ lightId: 'sun', mobility: LightMobility.STATIC });
      cache.registerLight({ lightId: 'lamp', mobility: LightMobility.STATIONARY });

      cache.markRendered('sun', 0, undefined, { meshes: ['a'] });
      cache.markRendered('lamp', 0, undefined, { meshes: ['a'] });
    });

    it('should invalidate all lights with geometry hash', () => {
      const invalidated = cache.updateGeometry({ meshes: ['b'] });

      expect(invalidated).toContain('sun');
      expect(invalidated).toContain('lamp');
      expect(cache.getEntry('sun')!.state).toBe(ShadowCacheState.INVALID);
      expect(cache.getEntry('lamp')!.state).toBe(ShadowCacheState.INVALID);
    });

    it('should not invalidate lights without geometry hash', () => {
      cache.registerLight({ lightId: 'point', mobility: LightMobility.STATIC });
      cache.markRendered('point', 0); // No geometry hash

      const invalidated = cache.updateGeometry({ meshes: ['b'] });

      expect(invalidated).not.toContain('point');
      expect(cache.getEntry('point')!.state).toBe(ShadowCacheState.VALID);
    });

    it('should return empty array if geometry unchanged', () => {
      const invalidated = cache.updateGeometry({ meshes: ['a'] });

      expect(invalidated).toHaveLength(0);
    });
  });

  describe('Frame Advancement', () => {
    beforeEach(() => {
      cache.registerLight({ lightId: 'sun', mobility: LightMobility.STATIC });
      cache.markRendered('sun', 0);
    });

    it('should increment cache frame count for valid shadows', () => {
      cache.advanceFrame();
      expect(cache.getEntry('sun')!.cacheFrameCount).toBe(1);

      cache.advanceFrame();
      expect(cache.getEntry('sun')!.cacheFrameCount).toBe(2);
    });

    it('should not increment cache frame count for invalid shadows', () => {
      cache.invalidate('sun');

      cache.advanceFrame();
      expect(cache.getEntry('sun')!.cacheFrameCount).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should report empty stats initially', () => {
      const stats = cache.getStats();

      expect(stats.totalLights).toBe(0);
      expect(stats.cachedLights).toBe(0);
      expect(stats.invalidLights).toBe(0);
      expect(stats.uninitializedLights).toBe(0);
    });

    it('should count lights by state', () => {
      cache.registerLight({ lightId: 'sun', mobility: LightMobility.STATIC });
      cache.registerLight({ lightId: 'lamp', mobility: LightMobility.STATIONARY });
      cache.registerLight({ lightId: 'point', mobility: LightMobility.MOVABLE });

      cache.markRendered('sun', 0);
      cache.invalidate('lamp');

      const stats = cache.getStats();

      expect(stats.totalLights).toBe(3);
      expect(stats.cachedLights).toBe(1); // sun
      expect(stats.invalidLights).toBe(1); // lamp
      expect(stats.uninitializedLights).toBe(1); // point
    });

    it('should count lights by mobility', () => {
      cache.registerLight({ lightId: 'sun', mobility: LightMobility.STATIC });
      cache.registerLight({ lightId: 'lamp', mobility: LightMobility.STATIONARY });
      cache.registerLight({ lightId: 'point', mobility: LightMobility.MOVABLE });

      const stats = cache.getStats();

      expect(stats.staticLights).toBe(1);
      expect(stats.stationaryLights).toBe(1);
      expect(stats.movableLights).toBe(1);
    });

    it('should calculate average cache frames', () => {
      cache.registerLight({ lightId: 'sun', mobility: LightMobility.STATIC });
      cache.registerLight({ lightId: 'lamp', mobility: LightMobility.STATIONARY });

      cache.markRendered('sun', 0);
      cache.markRendered('lamp', 0);

      cache.advanceFrame();
      cache.advanceFrame();
      cache.advanceFrame();

      const stats = cache.getStats();

      expect(stats.averageCacheFrames).toBe(3);
    });

    it('should handle zero cached lights for average', () => {
      cache.registerLight({ lightId: 'sun', mobility: LightMobility.STATIC });

      const stats = cache.getStats();

      expect(stats.averageCacheFrames).toBe(0);
    });
  });

  describe('Clear', () => {
    it('should clear all entries', () => {
      cache.registerLight({ lightId: 'sun', mobility: LightMobility.STATIC });
      cache.registerLight({ lightId: 'lamp', mobility: LightMobility.STATIONARY });

      cache.clear();

      const stats = cache.getStats();
      expect(stats.totalLights).toBe(0);
    });

    it('should reset frame counter', () => {
      cache.advanceFrame();
      cache.advanceFrame();
      cache.clear();

      cache.registerLight({ lightId: 'sun', mobility: LightMobility.STATIC });
      cache.markRendered('sun', 0);

      const entry = cache.getEntry('sun');
      expect(entry!.lastRenderedFrame).toBe(0);
    });
  });

  describe('Hash Collision Resistance', () => {
    beforeEach(() => {
      cache.registerLight({ lightId: 'test', mobility: LightMobility.STATIC });
    });

    it('should differentiate similar objects', () => {
      const obj1 = { x: 1, y: 2, z: 3 };
      const obj2 = { x: 1, y: 2, z: 4 };

      cache.markRendered('test', 0, obj1);
      const changed = cache.updateTransform('test', obj2);

      expect(changed).toBe(true);
    });

    it('should differentiate nested objects', () => {
      const obj1 = { transform: { position: [0, 0, 0] } };
      const obj2 = { transform: { position: [0, 0, 1] } };

      cache.markRendered('test', 0, obj1);
      const changed = cache.updateTransform('test', obj2);

      expect(changed).toBe(true);
    });

    it('should handle array order', () => {
      const obj1 = { items: [1, 2, 3] };
      const obj2 = { items: [3, 2, 1] };

      cache.markRendered('test', 0, obj1);
      const changed = cache.updateTransform('test', obj2);

      expect(changed).toBe(true);
    });

    it('should match identical objects', () => {
      const obj = { a: 1, b: { c: 2, d: [3, 4] } };

      cache.markRendered('test', 0, obj);
      const changed = cache.updateTransform('test', obj);

      expect(changed).toBe(false);
    });
  });
});
