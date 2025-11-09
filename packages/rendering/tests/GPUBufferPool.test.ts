/**
 * GPUBufferPool Tests - Epic 3.8
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GPUBufferPool, BufferUsageType } from '../src/GPUBufferPool';

describe('GPUBufferPool', () => {
  let pool: GPUBufferPool;

  beforeEach(() => {
    pool = new GPUBufferPool();
  });

  describe('Power-of-2 Bucketing', () => {
    it('should round up to minimum bucket size (256 bytes)', () => {
      const buffer = pool.acquire(BufferUsageType.VERTEX, 100);
      expect(buffer.byteLength).toBe(256);
    });

    it('should round up to next power of 2', () => {
      const buffer = pool.acquire(BufferUsageType.VERTEX, 500);
      expect(buffer.byteLength).toBe(512);
    });

    it('should handle exact power-of-2 sizes', () => {
      const buffer = pool.acquire(BufferUsageType.VERTEX, 1024);
      expect(buffer.byteLength).toBe(1024);
    });

    it('should cap at maximum bucket size (16MB)', () => {
      const buffer = pool.acquire(BufferUsageType.VERTEX, 32 * 1024 * 1024);
      expect(buffer.byteLength).toBe(16 * 1024 * 1024);
    });
  });

  describe('Buffer Reuse', () => {
    it('should reuse released buffers', () => {
      const buffer1 = pool.acquire(BufferUsageType.VERTEX, 1024);
      pool.release(buffer1, BufferUsageType.VERTEX);

      const stats1 = pool.getStats();
      expect(stats1.totalBuffers).toBe(1);

      const buffer2 = pool.acquire(BufferUsageType.VERTEX, 1024);
      expect(buffer2).toBe(buffer1); // Same buffer instance

      const stats2 = pool.getStats();
      expect(stats2.totalBuffers).toBe(1); // Still just 1 buffer
    });

    it('should not reuse buffers with different usage types', () => {
      const vertexBuffer = pool.acquire(BufferUsageType.VERTEX, 1024);
      pool.release(vertexBuffer, BufferUsageType.VERTEX);

      const indexBuffer = pool.acquire(BufferUsageType.INDEX, 1024);
      expect(indexBuffer).not.toBe(vertexBuffer);

      const stats = pool.getStats();
      expect(stats.totalBuffers).toBe(2);
    });

    it('should not reuse buffers with different bucket sizes', () => {
      const buffer1 = pool.acquire(BufferUsageType.VERTEX, 1024);
      pool.release(buffer1, BufferUsageType.VERTEX);

      const buffer2 = pool.acquire(BufferUsageType.VERTEX, 2048);
      expect(buffer2).not.toBe(buffer1);

      const stats = pool.getStats();
      expect(stats.totalBuffers).toBe(2);
    });
  });

  describe('Statistics', () => {
    it('should track total buffers and bytes', () => {
      pool.acquire(BufferUsageType.VERTEX, 1024);
      pool.acquire(BufferUsageType.INDEX, 2048);

      const stats = pool.getStats();
      expect(stats.totalBuffers).toBe(2);
      expect(stats.totalBytes).toBe(1024 + 2048);
    });

    it('should track allocations per usage type', () => {
      pool.acquire(BufferUsageType.VERTEX, 1024);
      pool.acquire(BufferUsageType.VERTEX, 2048);
      pool.acquire(BufferUsageType.INDEX, 512);

      const stats = pool.getStats();
      const vertexStats = stats.byUsage.get(BufferUsageType.VERTEX)!;
      const indexStats = stats.byUsage.get(BufferUsageType.INDEX)!;

      expect(vertexStats.buffers).toBe(2);
      expect(vertexStats.bytes).toBe(1024 + 2048);
      expect(vertexStats.allocations).toBe(2);

      expect(indexStats.buffers).toBe(1);
      expect(indexStats.bytes).toBe(512);
      expect(indexStats.allocations).toBe(1);
    });

    it('should track reuses', () => {
      const buffer = pool.acquire(BufferUsageType.VERTEX, 1024);
      pool.release(buffer, BufferUsageType.VERTEX);
      pool.acquire(BufferUsageType.VERTEX, 1024);

      const stats = pool.getStats();
      const vertexStats = stats.byUsage.get(BufferUsageType.VERTEX)!;

      expect(vertexStats.allocations).toBe(1); // Only allocated once
      expect(vertexStats.reuses).toBe(1); // Reused once
    });

    it('should track reallocations per frame', () => {
      pool.acquire(BufferUsageType.VERTEX, 1024);
      pool.acquire(BufferUsageType.VERTEX, 2048);

      const stats1 = pool.getStats();
      expect(stats1.reallocationsThisFrame).toBe(2);

      pool.nextFrame();

      const stats2 = pool.getStats();
      expect(stats2.reallocationsThisFrame).toBe(0);
    });
  });

  describe('Frame Management', () => {
    it('should reset reallocation counter each frame', () => {
      pool.acquire(BufferUsageType.VERTEX, 1024);
      expect(pool.getStats().reallocationsThisFrame).toBe(1);

      pool.nextFrame();
      expect(pool.getStats().reallocationsThisFrame).toBe(0);

      pool.acquire(BufferUsageType.VERTEX, 2048);
      expect(pool.getStats().reallocationsThisFrame).toBe(1);
    });

    it('should cleanup unused buffers after 300 frames', () => {
      const buffer = pool.acquire(BufferUsageType.VERTEX, 1024);
      pool.release(buffer, BufferUsageType.VERTEX);

      expect(pool.getStats().totalBuffers).toBe(1);

      // Advance 300 frames without using the buffer
      for (let i = 0; i < 300; i++) {
        pool.nextFrame();
      }

      // Buffer should still exist (threshold is > 300, not >=)
      expect(pool.getStats().totalBuffers).toBe(1);

      // One more frame pushes it over
      pool.nextFrame();
      expect(pool.getStats().totalBuffers).toBe(0);
    });

    it('should not cleanup recently used buffers', () => {
      const buffer = pool.acquire(BufferUsageType.VERTEX, 1024);
      pool.release(buffer, BufferUsageType.VERTEX);

      // Advance 299 frames, then use the buffer
      for (let i = 0; i < 299; i++) {
        pool.nextFrame();
      }

      const reusedBuffer = pool.acquire(BufferUsageType.VERTEX, 1024);
      expect(reusedBuffer).toBe(buffer);
      pool.release(reusedBuffer, BufferUsageType.VERTEX);

      // Advance 300 more frames
      for (let i = 0; i < 300; i++) {
        pool.nextFrame();
      }

      // Buffer should still exist because it was used recently
      expect(pool.getStats().totalBuffers).toBe(1);
    });
  });

  describe('Clear', () => {
    it('should clear all buffers', () => {
      pool.acquire(BufferUsageType.VERTEX, 1024);
      pool.acquire(BufferUsageType.INDEX, 2048);

      expect(pool.getStats().totalBuffers).toBe(2);

      pool.clear();

      const stats = pool.getStats();
      expect(stats.totalBuffers).toBe(0);
      expect(stats.totalBytes).toBe(0);
    });

    it('should reset all statistics', () => {
      const buffer = pool.acquire(BufferUsageType.VERTEX, 1024);
      pool.release(buffer, BufferUsageType.VERTEX);
      pool.acquire(BufferUsageType.VERTEX, 1024);

      pool.clear();

      const stats = pool.getStats();
      const vertexStats = stats.byUsage.get(BufferUsageType.VERTEX)!;

      expect(vertexStats.buffers).toBe(0);
      expect(vertexStats.bytes).toBe(0);
      expect(vertexStats.allocations).toBe(0);
      expect(vertexStats.reuses).toBe(0);
    });
  });

  describe('Memory Tracking', () => {
    it('should track total memory usage', () => {
      pool.acquire(BufferUsageType.VERTEX, 1024);
      pool.acquire(BufferUsageType.INDEX, 2048);

      expect(pool.getTotalMemory()).toBe(1024 + 2048);
    });

    it('should track memory by usage type', () => {
      pool.acquire(BufferUsageType.VERTEX, 1024);
      pool.acquire(BufferUsageType.VERTEX, 2048);
      pool.acquire(BufferUsageType.INDEX, 512);

      expect(pool.getMemoryByUsage(BufferUsageType.VERTEX)).toBe(1024 + 2048);
      expect(pool.getMemoryByUsage(BufferUsageType.INDEX)).toBe(512);
      expect(pool.getMemoryByUsage(BufferUsageType.UNIFORM)).toBe(0);
    });
  });

  describe('Performance Targets', () => {
    it('should handle 1000 acquire/release cycles efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        const buffer = pool.acquire(BufferUsageType.VERTEX, 1024);
        pool.release(buffer, BufferUsageType.VERTEX);
      }

      const elapsed = performance.now() - startTime;

      // Should complete in < 10ms
      expect(elapsed).toBeLessThan(10);

      const stats = pool.getStats();
      const vertexStats = stats.byUsage.get(BufferUsageType.VERTEX)!;

      // Should have allocated once, reused 999 times
      expect(vertexStats.allocations).toBe(1);
      expect(vertexStats.reuses).toBe(999);
    });

    it('should achieve <5 reallocations per frame in typical usage', () => {
      // Simulate frame with multiple buffer requests
      for (let frame = 0; frame < 10; frame++) {
        // Acquire buffers
        const buffers: ArrayBuffer[] = [];
        for (let i = 0; i < 10; i++) {
          buffers.push(pool.acquire(BufferUsageType.VERTEX, 1024));
        }

        // Release buffers
        for (const buffer of buffers) {
          pool.release(buffer, BufferUsageType.VERTEX);
        }

        pool.nextFrame();
      }

      // After first frame, all subsequent frames should have 0 reallocations (perfect reuse)
      const finalStats = pool.getStats();
      expect(finalStats.reallocationsThisFrame).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle releasing buffer that was never acquired', () => {
      const buffer = new ArrayBuffer(1024);

      // Should not crash
      expect(() => {
        pool.release(buffer, BufferUsageType.VERTEX);
      }).not.toThrow();
    });

    it('should handle zero-size buffer request', () => {
      const buffer = pool.acquire(BufferUsageType.VERTEX, 0);
      expect(buffer.byteLength).toBe(256); // MIN_BUCKET_SIZE
    });

    it('should handle negative size buffer request', () => {
      const buffer = pool.acquire(BufferUsageType.VERTEX, -100);
      expect(buffer.byteLength).toBe(256); // MIN_BUCKET_SIZE
    });
  });
});
