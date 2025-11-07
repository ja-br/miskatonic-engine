import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResourceManager } from '../src/ResourceManager';
import { EvictionPolicy, ResourceState } from '../src/types';
import type { ResourceLoader, Resource } from '../src/types';

// Mock loader
class MockTextLoader implements ResourceLoader<string> {
  readonly type = 'text';

  async load(id: string): Promise<Resource<string>> {
    return {
      id,
      type: 'text',
      data: `Mock data for ${id}`,
      size: 100,
    };
  }
}

describe('ResourceManager', () => {
  let manager: ResourceManager;
  let loader: MockTextLoader;

  beforeEach(() => {
    manager = new ResourceManager({
      maxSize: 10000,
      evictionPolicy: EvictionPolicy.LRU,
    });
    loader = new MockTextLoader();
    manager.registerLoader(loader);
  });

  describe('loader registration', () => {
    it('should register a loader', () => {
      const newLoader: ResourceLoader = {
        type: 'image',
        async load(id) {
          return { id, type: 'image', data: null, size: 0 };
        },
      };

      manager.registerLoader(newLoader);
      // No direct way to check, but shouldn't throw
      expect(true).toBe(true);
    });

    it('should unregister a loader', () => {
      const removed = manager.unregisterLoader('text');
      expect(removed).toBe(true);

      const notRemoved = manager.unregisterLoader('nonexistent');
      expect(notRemoved).toBe(false);
    });
  });

  describe('resource loading', () => {
    it('should load a resource and return handle', async () => {
      const handle = await manager.load('test-resource', 'text');

      expect(handle).toBeDefined();
      expect(handle.id).toBe('test-resource');
      expect(handle.isLoaded()).toBe(true);
      expect(handle.get()).toBe('Mock data for test-resource');
    });

    it('should throw when no loader registered for type', async () => {
      await expect(manager.load('test', 'unknown-type')).rejects.toThrow(
        /No loader registered/
      );
    });

    it('should cache loaded resources', async () => {
      const handle1 = await manager.load('test-resource', 'text');
      const handle2 = await manager.load('test-resource', 'text');

      expect(handle1.get()).toBe(handle2.get());

      const stats = manager.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
    });

    it('should handle concurrent loads of same resource', async () => {
      const [handle1, handle2, handle3] = await Promise.all([
        manager.load('test-resource', 'text'),
        manager.load('test-resource', 'text'),
        manager.load('test-resource', 'text'),
      ]);

      expect(handle1.get()).toBe(handle2.get());
      expect(handle2.get()).toBe(handle3.get());
    });

    it('should force reload when requested', async () => {
      const loadSpy = vi.spyOn(loader, 'load');

      await manager.load('test-resource', 'text');
      await manager.load('test-resource', 'text', { forceReload: true });

      expect(loadSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle load timeout', async () => {
      const slowLoader: ResourceLoader = {
        type: 'slow',
        async load(id) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return { id, type: 'slow', data: null, size: 0 };
        },
      };

      manager.registerLoader(slowLoader);

      await expect(
        manager.load('test', 'slow', { timeout: 10 })
      ).rejects.toThrow(/timeout/);
    });

    it('should handle loader errors', async () => {
      const errorLoader: ResourceLoader = {
        type: 'error',
        async load() {
          throw new Error('Load failed');
        },
      };

      manager.registerLoader(errorLoader);

      await expect(manager.load('test', 'error')).rejects.toThrow();
    });
  });

  describe('resource unloading', () => {
    it('should unload a resource', async () => {
      const handle = await manager.load('test-resource', 'text');
      handle.release();

      await manager.unload('test-resource');

      expect(manager.isLoaded('test-resource')).toBe(false);
    });

    it('should call loader unload if available', async () => {
      const unloadSpy = vi.fn();
      const customLoader: ResourceLoader<string> = {
        type: 'custom',
        async load(id) {
          return { id, type: 'custom', data: 'test', size: 100 };
        },
        unload: unloadSpy,
      };

      manager.registerLoader(customLoader);

      const handle = await manager.load('test', 'custom');
      handle.release();
      await manager.unload('test');

      expect(unloadSpy).toHaveBeenCalled();
    });

    it('should unload all resources', async () => {
      await manager.load('test1', 'text');
      await manager.load('test2', 'text');
      await manager.load('test3', 'text');

      await manager.unloadAll();

      expect(manager.isLoaded('test1')).toBe(false);
      expect(manager.isLoaded('test2')).toBe(false);
      expect(manager.isLoaded('test3')).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should track resource statistics', async () => {
      const handle1 = await manager.load('test1', 'text');
      const handle2 = await manager.load('test2', 'text');

      const stats = manager.getStats();

      expect(stats.totalResources).toBe(2);
      expect(stats.loadedResources).toBe(2);
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0); // Size depends on loaded resources
      expect(stats.avgLoadTime).toBeGreaterThanOrEqual(0);
      expect(stats.byType.get('text')).toBe(2);

      // Release handles for cleanup
      handle1.release();
      handle2.release();
    });
  });

  describe('reference counting', () => {
    it('should track references correctly', async () => {
      const handle1 = await manager.load('test', 'text');
      const handle2 = handle1.addRef();

      expect(handle1.getRefCount()).toBe(2);

      handle1.release();
      expect(handle2.getRefCount()).toBe(1);

      handle2.release();
      // Resource can now be evicted
    });
  });

  describe('clear', () => {
    it('should clear all resources and stats', async () => {
      await manager.load('test1', 'text');
      await manager.load('test2', 'text');

      await manager.clear();

      const stats = manager.getStats();
      expect(stats.totalResources).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });
  });

  describe('isLoaded', () => {
    it('should check if resource is loaded', async () => {
      expect(manager.isLoaded('test')).toBe(false);

      await manager.load('test', 'text');

      expect(manager.isLoaded('test')).toBe(true);
    });
  });
});
