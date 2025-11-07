import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResourceCache } from '../src/ResourceCache';
import { ResourceEntry } from '../src/ResourceHandle';
import { EvictionPolicy } from '../src/types';

describe('ResourceCache', () => {
  let cache: ResourceCache;

  beforeEach(() => {
    cache = new ResourceCache({
      maxSize: 1000,
      maxCount: 5,
      evictionPolicy: EvictionPolicy.LRU,
    });
  });

  describe('basic operations', () => {
    it('should add entry to cache', () => {
      const entry = new ResourceEntry('test', 'text');
      entry.size = 100;

      cache.add(entry);

      expect(cache.has('test')).toBe(true);
      expect(cache.getCount()).toBe(1);
      expect(cache.getSize()).toBe(100);
    });

    it('should get entry from cache', () => {
      const entry = new ResourceEntry('test', 'text');
      entry.size = 100;

      cache.add(entry);
      const retrieved = cache.get('test');

      expect(retrieved).toBe(entry);
    });

    it('should remove entry from cache', () => {
      const entry = new ResourceEntry('test', 'text');
      entry.size = 100;

      cache.add(entry);
      expect(cache.has('test')).toBe(true);

      const removed = cache.remove('test');

      expect(removed).toBe(entry);
      expect(cache.has('test')).toBe(false);
      expect(cache.getSize()).toBe(0);
    });

    it('should return keys and values', () => {
      const entry1 = new ResourceEntry('test1', 'text');
      const entry2 = new ResourceEntry('test2', 'text');

      cache.add(entry1);
      cache.add(entry2);

      const keys = cache.keys();
      const values = cache.values();

      expect(keys).toContain('test1');
      expect(keys).toContain('test2');
      expect(values).toContain(entry1);
      expect(values).toContain(entry2);
    });

    it('should clear cache', () => {
      cache.add(new ResourceEntry('test1', 'text'));
      cache.add(new ResourceEntry('test2', 'text'));

      cache.clear();

      expect(cache.getCount()).toBe(0);
      expect(cache.getSize()).toBe(0);
    });
  });

  describe('eviction by size limit', () => {
    it('should evict LRU when size limit exceeded', () => {
      const entry1 = new ResourceEntry('test1', 'text');
      entry1.size = 400;
      entry1.lastAccessed = 100;

      const entry2 = new ResourceEntry('test2', 'text');
      entry2.size = 400;
      entry2.lastAccessed = 200;

      const entry3 = new ResourceEntry('test3', 'text');
      entry3.size = 400;
      entry3.lastAccessed = 300;

      cache.add(entry1);
      cache.add(entry2);
      cache.add(entry3); // This should evict entry1 (oldest)

      expect(cache.has('test1')).toBe(false);
      expect(cache.has('test2')).toBe(true);
      expect(cache.has('test3')).toBe(true);
      expect(cache.getEvictions()).toBe(1);
    });

    it('should not evict resources with refCount > 0', () => {
      const entry1 = new ResourceEntry('test1', 'text');
      entry1.size = 400;
      entry1.refCount = 1; // Has reference

      const entry2 = new ResourceEntry('test2', 'text');
      entry2.size = 400;

      cache.add(entry1);
      cache.add(entry2);

      const entry3 = new ResourceEntry('test3', 'text');
      entry3.size = 400;

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      cache.add(entry3); // Should try to evict but fail

      // All should still be in cache (eviction blocked by refCount)
      expect(cache.has('test1')).toBe(true);
      expect(cache.has('test2')).toBe(false); // This one gets evicted
      expect(cache.has('test3')).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('eviction by count limit', () => {
    it('should evict when count limit exceeded', () => {
      // Max count is 5
      for (let i = 0; i < 6; i++) {
        const entry = new ResourceEntry(`test${i}`, 'text');
        entry.size = 10;
        entry.lastAccessed = i * 100;
        cache.add(entry);
      }

      expect(cache.getCount()).toBe(5);
      expect(cache.has('test0')).toBe(false); // Oldest evicted
      expect(cache.has('test5')).toBe(true);
    });
  });

  describe('eviction policies', () => {
    it('should use LFU policy', () => {
      const lfulCache = new ResourceCache({
        maxSize: 800,
        evictionPolicy: EvictionPolicy.LFU,
      });

      const entry1 = new ResourceEntry('test1', 'text');
      entry1.size = 400;
      entry1.accessCount = 1; // Least frequently used

      const entry2 = new ResourceEntry('test2', 'text');
      entry2.size = 400;
      entry2.accessCount = 10; // More frequently used

      lfulCache.add(entry1);
      lfulCache.add(entry2);

      const entry3 = new ResourceEntry('test3', 'text');
      entry3.size = 400;
      entry3.accessCount = 5;

      lfulCache.add(entry3); // Should evict entry1 (lowest accessCount)

      expect(lfulCache.has('test1')).toBe(false);
      expect(lfulCache.has('test2')).toBe(true);
      expect(lfulCache.has('test3')).toBe(true);
    });

    it('should use FIFO policy', () => {
      const fifoCache = new ResourceCache({
        maxSize: 800,
        evictionPolicy: EvictionPolicy.FIFO,
      });

      const entry1 = new ResourceEntry('test1', 'text');
      entry1.size = 400;
      entry1.loadedAt = 100;

      const entry2 = new ResourceEntry('test2', 'text');
      entry2.size = 400;
      entry2.loadedAt = 200;

      fifoCache.add(entry1);
      fifoCache.add(entry2);

      const entry3 = new ResourceEntry('test3', 'text');
      entry3.size = 400;
      entry3.loadedAt = 300;

      fifoCache.add(entry3); // Should evict entry1 (first in)

      expect(fifoCache.has('test1')).toBe(false);
      expect(fifoCache.has('test2')).toBe(true);
      expect(fifoCache.has('test3')).toBe(true);
    });

    it('should use SIZE policy', () => {
      const sizeCache = new ResourceCache({
        maxSize: 1000,
        evictionPolicy: EvictionPolicy.SIZE,
      });

      const entry1 = new ResourceEntry('test1', 'text');
      entry1.size = 600; // Largest

      const entry2 = new ResourceEntry('test2', 'text');
      entry2.size = 300;

      sizeCache.add(entry1);
      sizeCache.add(entry2);

      const entry3 = new ResourceEntry('test3', 'text');
      entry3.size = 400;

      sizeCache.add(entry3); // Should evict entry1 (largest)

      expect(sizeCache.has('test1')).toBe(false);
      expect(sizeCache.has('test2')).toBe(true);
      expect(sizeCache.has('test3')).toBe(true);
    });
  });

  describe('TTL-based eviction', () => {
    it('should evict expired resources', () => {
      const ttlCache = new ResourceCache({
        maxSize: 10000,
        evictionPolicy: EvictionPolicy.LRU,
        ttl: 1000, // 1 second TTL
      });

      const entry1 = new ResourceEntry('test1', 'text');
      entry1.size = 100;
      entry1.lastAccessed = Date.now() - 2000; // 2 seconds ago (expired)

      const entry2 = new ResourceEntry('test2', 'text');
      entry2.size = 100;
      entry2.lastAccessed = Date.now() - 500; // 0.5 seconds ago (not expired)

      ttlCache.add(entry1);
      ttlCache.add(entry2);

      // Add a new entry to trigger TTL check
      const entry3 = new ResourceEntry('test3', 'text');
      entry3.size = 100;
      ttlCache.add(entry3);

      expect(ttlCache.has('test1')).toBe(false); // Evicted by TTL
      expect(ttlCache.has('test2')).toBe(true);
      expect(ttlCache.has('test3')).toBe(true);
    });
  });

  describe('force eviction', () => {
    it('should force evict even with active references', () => {
      const entry = new ResourceEntry('test', 'text');
      entry.size = 100;
      entry.refCount = 5; // Has active references

      cache.add(entry);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const evicted = cache.forceEvict('test');

      expect(evicted).toBe(true);
      expect(cache.has('test')).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Force evicted resource with active references')
      );

      consoleSpy.mockRestore();
    });

    it('should return false when force evicting non-existent resource', () => {
      const evicted = cache.forceEvict('nonexistent');
      expect(evicted).toBe(false);
    });
  });

  describe('access tracking', () => {
    it('should update lastAccessed on get', () => {
      const entry = new ResourceEntry('test', 'text');
      entry.size = 100;
      entry.lastAccessed = 100;

      cache.add(entry);
      cache.get('test');

      expect(entry.lastAccessed).toBeGreaterThan(100);
    });
  });
});
