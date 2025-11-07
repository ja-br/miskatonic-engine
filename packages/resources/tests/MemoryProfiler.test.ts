import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryProfiler } from '../src/MemoryProfiler';
import { ResourceManager } from '../src/ResourceManager';
import { EvictionPolicy } from '../src/types';
import type { ResourceLoader, Resource } from '../src/types';

// Mock loader
class MockTextLoader implements ResourceLoader<string> {
  readonly type = 'text';

  async load(id: string): Promise<Resource<string>> {
    return {
      id,
      type: 'text',
      data: `Mock data for ${id}`,
      size: 1024, // 1 KB
    };
  }
}

class MockImageLoader implements ResourceLoader<string> {
  readonly type = 'image';

  async load(id: string): Promise<Resource<string>> {
    return {
      id,
      type: 'image',
      data: `Mock image for ${id}`,
      size: 10240, // 10 KB
    };
  }
}

describe('MemoryProfiler', () => {
  let profiler: MemoryProfiler;
  let manager: ResourceManager;
  let textLoader: MockTextLoader;
  let imageLoader: MockImageLoader;

  beforeEach(() => {
    profiler = new MemoryProfiler({
      enabled: true,
      maxSnapshots: 10,
      maxEvents: 100,
      leakAgeThreshold: 1000, // 1 second for testing
    });

    manager = new ResourceManager({
      maxSize: 100000,
      evictionPolicy: EvictionPolicy.LRU,
    });

    textLoader = new MockTextLoader();
    imageLoader = new MockImageLoader();

    manager.registerLoader(textLoader);
    manager.registerLoader(imageLoader);
  });

  afterEach(() => {
    profiler.stop();
  });

  describe('configuration', () => {
    it('should store configuration', () => {
      const config = profiler.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.maxSnapshots).toBe(10);
      expect(config.maxEvents).toBe(100);
      expect(config.leakAgeThreshold).toBe(1000);
    });
  });

  describe('snapshots', () => {
    it('should take memory snapshot', async () => {
      await manager.load('test1', 'text');
      await manager.load('test2', 'text');
      await manager.load('image1', 'image');

      const snapshot = profiler.takeSnapshot(manager);

      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.resourceCount).toBe(3);
      expect(snapshot.totalMemory).toBe(1024 + 1024 + 10240);
      expect(snapshot.byType.size).toBe(2);
      expect(snapshot.byState.size).toBeGreaterThan(0);
      expect(snapshot.topConsumers.length).toBeGreaterThan(0);
    });

    it('should track memory by type', async () => {
      await manager.load('test1', 'text');
      await manager.load('test2', 'text');
      await manager.load('image1', 'image');

      const snapshot = profiler.takeSnapshot(manager);

      const textInfo = snapshot.byType.get('text');
      expect(textInfo).toBeDefined();
      expect(textInfo!.count).toBe(2);
      expect(textInfo!.totalSize).toBe(2048);
      expect(textInfo!.avgSize).toBe(1024);

      const imageInfo = snapshot.byType.get('image');
      expect(imageInfo).toBeDefined();
      expect(imageInfo!.count).toBe(1);
      expect(imageInfo!.totalSize).toBe(10240);
    });

    it('should identify top memory consumers', async () => {
      await manager.load('text1', 'text');
      await manager.load('image1', 'image'); // Larger
      await manager.load('image2', 'image'); // Larger

      const snapshot = profiler.takeSnapshot(manager);

      expect(snapshot.topConsumers[0].type).toBe('image');
      expect(snapshot.topConsumers[0].size).toBe(10240);
    });

    it('should limit snapshot history', async () => {
      for (let i = 0; i < 15; i++) {
        profiler.takeSnapshot(manager);
      }

      const snapshots = profiler.getSnapshots();
      expect(snapshots.length).toBe(10); // maxSnapshots = 10
    });

    it('should get latest snapshot', async () => {
      profiler.takeSnapshot(manager);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const snapshot = profiler.takeSnapshot(manager);

      const latest = profiler.getLatestSnapshot();
      expect(latest).toBe(snapshot);
    });
  });

  describe('allocation tracking', () => {
    it('should record allocations', () => {
      profiler.recordAllocation('resource1', 'text', 1024);
      profiler.recordAllocation('resource2', 'image', 2048);

      const events = profiler.getAllocationEvents();
      expect(events.length).toBe(2);
      expect(events[0].action).toBe('allocated');
      expect(events[0].size).toBe(1024);
    });

    it('should record deallocations', () => {
      profiler.recordDeallocation('resource1', 'text', 1024);

      const events = profiler.getAllocationEvents();
      expect(events.length).toBe(1);
      expect(events[0].action).toBe('freed');
    });

    it('should limit event history', () => {
      for (let i = 0; i < 150; i++) {
        profiler.recordAllocation(`resource${i}`, 'text', 1024);
      }

      const events = profiler.getAllocationEvents();
      expect(events.length).toBe(100); // maxEvents = 100
    });
  });

  describe('leak detection', () => {
    it('should detect old unreferenced resources', async () => {
      const handle = await manager.load('test1', 'text');
      handle.release();

      // Wait for age threshold
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const leaks = profiler.detectLeaks(manager);
      expect(leaks.length).toBeGreaterThan(0);
      expect(leaks[0].reason).toContain('Old unreferenced resource');
    });

    it('should detect high reference counts', async () => {
      const handle = await manager.load('test1', 'text');

      // Mock high reference count by directly modifying entry
      const manager_any = manager as any;
      const entry = manager_any.cache.get('test1');
      entry.refCount = 150;

      const leaks = profiler.detectLeaks(manager);
      const highRefLeak = leaks.find((l) => l.reason.includes('high reference count'));

      expect(highRefLeak).toBeDefined();
      expect(highRefLeak!.refCount).toBe(150);

      // Restore for cleanup
      entry.refCount = 1;
      handle.release();
    });

    it('should not detect leaks for recent resources', async () => {
      const handle = await manager.load('test1', 'text');
      handle.release();

      // Don't wait for age threshold
      const leaks = profiler.detectLeaks(manager);

      // Should not have the "old unreferenced" leak
      const oldUnrefLeak = leaks.find((l) => l.reason.includes('Old unreferenced'));
      expect(oldUnrefLeak).toBeUndefined();
    });
  });

  describe('growth rate', () => {
    it('should calculate memory growth rate', async () => {
      profiler.takeSnapshot(manager);
      await manager.load('test1', 'text');

      await new Promise((resolve) => setTimeout(resolve, 100));

      profiler.takeSnapshot(manager);

      const growthRate = profiler.getGrowthRate();
      expect(growthRate).not.toBeNull();
      expect(typeof growthRate).toBe('number');
    });

    it('should return null with insufficient snapshots', () => {
      const growthRate = profiler.getGrowthRate();
      expect(growthRate).toBeNull();
    });
  });

  describe('automatic snapshotting', () => {
    it('should take snapshots at intervals', async () => {
      const intervalProfiler = new MemoryProfiler({
        enabled: true,
        snapshotInterval: 100,
      });

      intervalProfiler.start(manager);

      await new Promise((resolve) => setTimeout(resolve, 350));

      const snapshots = intervalProfiler.getSnapshots();
      expect(snapshots.length).toBeGreaterThanOrEqual(3);

      intervalProfiler.stop();
    });

    it('should not start with snapshotInterval = 0', () => {
      const manualProfiler = new MemoryProfiler({
        enabled: true,
        snapshotInterval: 0,
      });

      manualProfiler.start(manager);

      // Should not start timer
      const config = manualProfiler.getConfig();
      expect(config.snapshotInterval).toBe(0);

      manualProfiler.stop();
    });

    it('should stop automatic snapshotting', async () => {
      const intervalProfiler = new MemoryProfiler({
        enabled: true,
        snapshotInterval: 100,
      });

      intervalProfiler.start(manager);
      await new Promise((resolve) => setTimeout(resolve, 150));
      intervalProfiler.stop();

      const snapshotCount = intervalProfiler.getSnapshots().length;

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should not have taken more snapshots after stop
      expect(intervalProfiler.getSnapshots().length).toBe(snapshotCount);
    });
  });

  describe('report generation', () => {
    it('should generate profiling report', async () => {
      await manager.load('test1', 'text');
      await manager.load('image1', 'image');

      const report = profiler.generateReport(manager);

      expect(report).toContain('Resource Memory Profiling Report');
      expect(report).toContain('Total Memory:');
      expect(report).toContain('Resource Count:');
      expect(report).toContain('Memory by Type');
      expect(report).toContain('Top Memory Consumers');
    });

    it('should include leak information in report', async () => {
      const handle = await manager.load('test1', 'text');
      handle.release();

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const report = profiler.generateReport(manager);

      expect(report).toContain('Potential Memory Leaks');
    });

    it('should show no leaks when none detected', async () => {
      await manager.load('test1', 'text');

      const report = profiler.generateReport(manager);

      expect(report).toContain('No Memory Leaks Detected');
    });
  });

  describe('clear', () => {
    it('should clear all profiling data', async () => {
      await manager.load('test1', 'text');
      profiler.takeSnapshot(manager);
      profiler.recordAllocation('test1', 'text', 1024);

      profiler.clear();

      expect(profiler.getSnapshots().length).toBe(0);
      expect(profiler.getAllocationEvents().length).toBe(0);
      expect(profiler.getLatestSnapshot()).toBeNull();
      expect(profiler.getGrowthRate()).toBeNull();
    });
  });
});
