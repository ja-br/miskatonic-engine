/**
 * InstanceBuffer Tests - Epic 3.13
 *
 * Tests for instance buffer management and pooling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InstanceBuffer, InstanceBufferPool } from '../src/InstanceBuffer';

describe('InstanceBuffer', () => {
  describe('constructor', () => {
    it('should create buffer with default capacity', () => {
      const buffer = new InstanceBuffer();
      expect(buffer.getCapacity()).toBe(1000);
      expect(buffer.getCount()).toBe(0);
      expect(buffer.isDirty()).toBe(false);
    });

    it('should create buffer with custom capacity', () => {
      const buffer = new InstanceBuffer(500);
      expect(buffer.getCapacity()).toBe(500);
      expect(buffer.getCount()).toBe(0);
    });
  });

  describe('setInstanceTransform', () => {
    let buffer: InstanceBuffer;

    beforeEach(() => {
      buffer = new InstanceBuffer(100);
    });

    it('should set transform at index', () => {
      const matrix = new Float32Array(16).fill(1.0);
      buffer.setInstanceTransform(0, matrix);

      expect(buffer.getCount()).toBe(1);
      expect(buffer.isDirty()).toBe(true);

      const data = buffer.getData();
      for (let i = 0; i < 16; i++) {
        expect(data[i]).toBe(1.0);
      }
    });

    it('should set multiple transforms', () => {
      const matrix1 = new Float32Array(16).fill(1.0);
      const matrix2 = new Float32Array(16).fill(2.0);

      buffer.setInstanceTransform(0, matrix1);
      buffer.setInstanceTransform(1, matrix2);

      expect(buffer.getCount()).toBe(2);

      const data = buffer.getData();
      // First matrix
      for (let i = 0; i < 16; i++) {
        expect(data[i]).toBe(1.0);
      }
      // Second matrix
      for (let i = 16; i < 32; i++) {
        expect(data[i]).toBe(2.0);
      }
    });

    it('should throw on invalid matrix size', () => {
      const invalid = new Float32Array(15); // Should be 16
      expect(() => buffer.setInstanceTransform(0, invalid)).toThrow('Invalid matrix size');
    });

    it('should throw on out of bounds index', () => {
      const matrix = new Float32Array(16);
      expect(() => buffer.setInstanceTransform(100, matrix)).toThrow('out of bounds');
    });

    it('should throw on negative index', () => {
      const matrix = new Float32Array(16);
      expect(() => buffer.setInstanceTransform(-1, matrix)).toThrow('out of bounds');
    });
  });

  describe('setInstanceTransforms', () => {
    let buffer: InstanceBuffer;

    beforeEach(() => {
      buffer = new InstanceBuffer(100);
    });

    it('should set multiple transforms at once', () => {
      const matrices = [
        new Float32Array(16).fill(1.0),
        new Float32Array(16).fill(2.0),
        new Float32Array(16).fill(3.0),
      ];

      buffer.setInstanceTransforms(matrices);

      expect(buffer.getCount()).toBe(3);
      expect(buffer.isDirty()).toBe(true);
    });

    it('should set transforms starting at offset', () => {
      const matrix1 = new Float32Array(16).fill(1.0);
      const matrix2 = new Float32Array(16).fill(2.0);

      buffer.setInstanceTransform(0, matrix1);
      buffer.setInstanceTransforms([matrix2], 1);

      expect(buffer.getCount()).toBe(2);
    });

    it('should throw if transforms exceed capacity', () => {
      const matrices = new Array(101).fill(new Float32Array(16));
      expect(() => buffer.setInstanceTransforms(matrices)).toThrow('Cannot fit');
    });
  });

  describe('clear', () => {
    it('should reset count and mark dirty', () => {
      const buffer = new InstanceBuffer(100);
      const matrix = new Float32Array(16).fill(1.0);

      buffer.setInstanceTransform(0, matrix);
      expect(buffer.getCount()).toBe(1);

      buffer.clear();
      expect(buffer.getCount()).toBe(0);
      expect(buffer.isDirty()).toBe(true);
    });
  });

  describe('resize', () => {
    it('should increase capacity', () => {
      const buffer = new InstanceBuffer(100);
      const matrix = new Float32Array(16).fill(1.0);
      buffer.setInstanceTransform(0, matrix);

      buffer.resize(200);
      expect(buffer.getCapacity()).toBe(200);
      expect(buffer.getCount()).toBe(1);
      expect(buffer.isDirty()).toBe(true);

      // Data should be preserved
      const data = buffer.getData();
      for (let i = 0; i < 16; i++) {
        expect(data[i]).toBe(1.0);
      }
    });

    it('should throw if new capacity is less than count', () => {
      const buffer = new InstanceBuffer(100);
      const matrix = new Float32Array(16).fill(1.0);
      buffer.setInstanceTransform(0, matrix);
      buffer.setInstanceTransform(1, matrix);

      expect(() => buffer.resize(1)).toThrow('Cannot resize');
    });

    it('should no-op if capacity unchanged', () => {
      const buffer = new InstanceBuffer(100);
      const originalData = buffer.getData();

      buffer.resize(100);
      expect(buffer.getData()).toBe(originalData); // Same reference
    });
  });

  describe('markClean', () => {
    it('should mark buffer as clean', () => {
      const buffer = new InstanceBuffer(100);
      const matrix = new Float32Array(16).fill(1.0);
      buffer.setInstanceTransform(0, matrix);

      expect(buffer.isDirty()).toBe(true);
      buffer.markClean();
      expect(buffer.isDirty()).toBe(false);
    });
  });

  describe('getMemoryUsage', () => {
    it('should calculate memory usage', () => {
      const buffer = new InstanceBuffer(1000);
      // 1000 instances * 16 floats * 4 bytes = 64000 bytes
      expect(buffer.getMemoryUsage()).toBe(64000);
    });

    it('should scale with capacity', () => {
      const small = new InstanceBuffer(100);
      const large = new InstanceBuffer(1000);

      expect(large.getMemoryUsage()).toBe(small.getMemoryUsage() * 10);
    });
  });
});

describe('InstanceBufferPool', () => {
  let pool: InstanceBufferPool;

  beforeEach(() => {
    pool = new InstanceBufferPool();
    pool.clearPool();
  });

  describe('acquire', () => {
    it('should create new buffer if pool empty', () => {
      const buffer = pool.acquire(100);
      expect(buffer.getCapacity()).toBeGreaterThanOrEqual(100);
    });

    it('should round up to power-of-2 bucket', () => {
      const buffer = pool.acquire(100);
      expect(buffer.getCapacity()).toBe(128); // Next power of 2 above 100
    });

    it('should reuse buffer from pool', () => {
      const buffer1 = pool.acquire(64);
      buffer1.setInstanceTransform(0, new Float32Array(16).fill(1.0));
      pool.release(buffer1);

      const buffer2 = pool.acquire(64);
      expect(buffer2.getCapacity()).toBe(64);
      expect(buffer2.getCount()).toBe(0); // Should be cleared
    });

    it('should handle various sizes', () => {
      const sizes = [10, 64, 100, 256, 500, 1024, 2000, 4096, 5000];
      const expectedBuckets = [64, 64, 128, 256, 512, 1024, 2048, 4096, 8192];

      for (let i = 0; i < sizes.length; i++) {
        const buffer = pool.acquire(sizes[i]);
        expect(buffer.getCapacity()).toBe(expectedBuckets[i]);
      }
    });
  });

  describe('release', () => {
    it('should return buffer to pool', () => {
      const buffer = pool.acquire(128);
      pool.release(buffer);

      const stats = pool.getPoolStats();
      const bucket128 = stats.find(s => s.bucketSize === 128);
      expect(bucket128?.count).toBe(1);
    });

    it('should clear buffer before pooling', () => {
      const buffer = pool.acquire(64);
      buffer.setInstanceTransform(0, new Float32Array(16).fill(1.0));

      pool.release(buffer);

      const reused = pool.acquire(64);
      expect(reused.getCount()).toBe(0);
    });

    it('should not pool odd-sized buffers', () => {
      const buffer = new InstanceBuffer(77); // Odd size
      pool.release(buffer);

      const stats = pool.getPoolStats();
      const bucket77 = stats.find(s => s.bucketSize === 77);
      expect(bucket77).toBeUndefined();
    });
  });

  describe('getPoolStats', () => {
    it('should return pool statistics', () => {
      pool.acquire(64);
      pool.acquire(128);
      const buffer1 = pool.acquire(64);
      const buffer2 = pool.acquire(128);

      pool.release(buffer1);
      pool.release(buffer2);

      const stats = pool.getPoolStats();
      expect(stats.length).toBeGreaterThan(0);

      const bucket64 = stats.find(s => s.bucketSize === 64);
      expect(bucket64?.count).toBe(1);

      const bucket128 = stats.find(s => s.bucketSize === 128);
      expect(bucket128?.count).toBe(1);
    });
  });

  describe('getPoolMemoryUsage', () => {
    it('should calculate total pool memory', () => {
      const buffer1 = pool.acquire(64);
      const buffer2 = pool.acquire(128);

      pool.release(buffer1);
      pool.release(buffer2);

      const usage = pool.getPoolMemoryUsage();
      // 64 * 16 * 4 + 128 * 16 * 4 = 4096 + 8192 = 12288
      expect(usage).toBe(12288);
    });
  });

  describe('clearPool', () => {
    it('should remove all pooled buffers', () => {
      const buffer = pool.acquire(64);
      pool.release(buffer);

      expect(pool.getPoolStats().length).toBeGreaterThan(0);

      pool.clearPool();
      expect(pool.getPoolStats().length).toBe(0);
    });
  });
});
