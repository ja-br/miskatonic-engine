/**
 * BindGroupPool Tests - Epic 3.14
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BindGroupPool } from '../src/BindGroupPool';

// Mock GPUDevice
const createMockDevice = () => ({
  lost: Promise.resolve({ reason: 'destroyed', message: 'Device lost' }),
});

// Mock GPUBindGroup
const createMockBindGroup = (id: string) => ({
  __id: id, // For test identification
  label: `bindgroup_${id}`,
});

describe('BindGroupPool', () => {
  let pool: BindGroupPool;
  let mockDevice: any;

  beforeEach(() => {
    mockDevice = createMockDevice();
    pool = new BindGroupPool(mockDevice);
  });

  describe('Acquire and Release', () => {
    it('should create new bind group on first acquire', () => {
      const createFn = vi.fn(() => createMockBindGroup('1'));

      const result = pool.acquire('layout_1', ['buffer_1'], createFn);

      expect(createFn).toHaveBeenCalledTimes(1);
      expect(result.bindGroup).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should reuse released bind group', () => {
      const createFn = vi.fn(() => createMockBindGroup('1'));

      const result1 = pool.acquire('layout_1', ['buffer_1'], createFn);
      pool.release(result1.id);

      const result2 = pool.acquire('layout_1', ['buffer_1'], createFn);

      expect(createFn).toHaveBeenCalledTimes(1); // Only called once
      expect(result2.bindGroup).toBe(result1.bindGroup);
      expect(result2.id).toBe(result1.id);
    });

    it('should create new bind group if all are in use', () => {
      const createFn = vi.fn((index) => createMockBindGroup(`${index}`));

      const result1 = pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));
      const result2 = pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('2'));

      expect(result1.id).not.toBe(result2.id);
    });

    it('should handle multiple pools with different keys', () => {
      const createFn1 = vi.fn(() => createMockBindGroup('1'));
      const createFn2 = vi.fn(() => createMockBindGroup('2'));

      pool.acquire('layout_1', ['buffer_1'], createFn1);
      pool.acquire('layout_2', ['buffer_2'], createFn2);

      expect(createFn1).toHaveBeenCalledTimes(1);
      expect(createFn2).toHaveBeenCalledTimes(1);
    });

    it('should warn on releasing unknown ID', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      pool.release(999);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown ID'));
      warnSpy.mockRestore();
    });
  });

  describe('Pool Key Generation', () => {
    it('should generate unique keys for different layouts', () => {
      const createFn = vi.fn(() => createMockBindGroup('1'));

      pool.acquire('layout_1', ['buffer_1'], createFn);
      pool.acquire('layout_2', ['buffer_1'], createFn);

      expect(createFn).toHaveBeenCalledTimes(2);
    });

    it('should generate unique keys for different resources', () => {
      const createFn = vi.fn(() => createMockBindGroup('1'));

      pool.acquire('layout_1', ['buffer_1'], createFn);
      pool.acquire('layout_1', ['buffer_2'], createFn);

      expect(createFn).toHaveBeenCalledTimes(2);
    });

    it('should generate same key for sorted resources', () => {
      const createFn = vi.fn(() => createMockBindGroup('1'));

      const result1 = pool.acquire('layout_1', ['buffer_1', 'buffer_2'], createFn);
      pool.release(result1.id);

      const result2 = pool.acquire('layout_1', ['buffer_2', 'buffer_1'], createFn);

      expect(createFn).toHaveBeenCalledTimes(1); // Reused
      expect(result2.bindGroup).toBe(result1.bindGroup);
    });
  });

  describe('Statistics', () => {
    it('should track total bind groups', () => {
      pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));
      pool.acquire('layout_1', ['buffer_2'], () => createMockBindGroup('2'));

      const stats = pool.getStats();
      expect(stats.totalBindGroups).toBe(2);
    });

    it('should track active bind groups', () => {
      const result1 = pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));
      pool.acquire('layout_1', ['buffer_2'], () => createMockBindGroup('2'));

      let stats = pool.getStats();
      expect(stats.activeBindGroups).toBe(2);
      expect(stats.freeBindGroups).toBe(0);

      pool.release(result1.id);

      stats = pool.getStats();
      expect(stats.activeBindGroups).toBe(1);
      expect(stats.freeBindGroups).toBe(1);
    });

    it('should track created and reused this frame', () => {
      const result1 = pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));

      let stats = pool.getStats();
      expect(stats.createdThisFrame).toBe(1);
      expect(stats.reusedThisFrame).toBe(0);

      pool.release(result1.id);
      pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));

      stats = pool.getStats();
      expect(stats.createdThisFrame).toBe(1); // Still 1
      expect(stats.reusedThisFrame).toBe(1);
    });

    it('should calculate reuse rate', () => {
      const result1 = pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));
      pool.release(result1.id);
      pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));

      const stats = pool.getStats();
      expect(stats.reuseRate).toBe(50); // 1 created, 1 reused = 50%
    });

    it('should track unique pools', () => {
      pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));
      pool.acquire('layout_1', ['buffer_2'], () => createMockBindGroup('2'));
      pool.acquire('layout_2', ['buffer_1'], () => createMockBindGroup('3'));

      const stats = pool.getStats();
      expect(stats.uniquePools).toBe(3);
    });
  });

  describe('Frame Management', () => {
    it('should reset per-frame statistics on nextFrame()', () => {
      pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));

      let stats = pool.getStats();
      expect(stats.createdThisFrame).toBe(1);

      pool.nextFrame();

      stats = pool.getStats();
      expect(stats.createdThisFrame).toBe(0);
      expect(stats.reusedThisFrame).toBe(0);
    });

    it('should track frame numbers for LRU', () => {
      const result1 = pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));
      pool.release(result1.id);

      // Advance 100 frames
      for (let i = 0; i < 100; i++) {
        pool.nextFrame();
      }

      // This should still be available (not cleaned up yet)
      const result2 = pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));
      expect(result2.bindGroup).toBe(result1.bindGroup);
    });
  });

  describe('Cleanup', () => {
    it('should not cleanup entries used recently', () => {
      const result1 = pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));
      pool.release(result1.id);

      // Advance 50 frames (less than 60 frame threshold)
      for (let i = 0; i < 50; i++) {
        pool.nextFrame();
      }

      const stats = pool.getStats();
      expect(stats.totalBindGroups).toBe(1); // Still there
    });

    it('should cleanup entries not used in 60 frames when pool exceeds max size', () => {
      // Create many bind groups to trigger cleanup
      const results = [];
      for (let i = 0; i < 1001; i++) {
        const result = pool.acquire(`layout_${i}`, [`buffer_${i}`], () => createMockBindGroup(`${i}`));
        pool.release(result.id);
        results.push(result);
      }

      // Advance 61 frames
      for (let i = 0; i < 61; i++) {
        pool.nextFrame();
      }

      // Create one more to trigger cleanup
      pool.acquire('layout_new', ['buffer_new'], () => createMockBindGroup('new'));

      const stats = pool.getStats();
      expect(stats.totalBindGroups).toBeLessThan(1002); // Some should be cleaned up
    });
  });

  describe('Clear', () => {
    it('should clear all pools', () => {
      pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));
      pool.acquire('layout_2', ['buffer_2'], () => createMockBindGroup('2'));

      pool.clear();

      const stats = pool.getStats();
      expect(stats.totalBindGroups).toBe(0);
      expect(stats.uniquePools).toBe(0);
    });

    it('should reset statistics', () => {
      pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));

      pool.clear();

      const stats = pool.getStats();
      expect(stats.createdThisFrame).toBe(0);
      expect(stats.reusedThisFrame).toBe(0);
    });

    it('should reset ID counter', () => {
      pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));
      pool.clear();

      const result = pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));
      expect(result.id).toBe(1); // Starts from 1 again
    });
  });

  describe('Device Loss', () => {
    it('should handle device loss', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));

      // Wait for device loss promise to resolve
      await mockDevice.lost;

      // Give time for handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Clearing pools'));
      logSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty resource array', () => {
      const result = pool.acquire('layout_1', [], () => createMockBindGroup('1'));
      expect(result.bindGroup).toBeDefined();
    });

    it('should handle single resource', () => {
      const result = pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));
      expect(result.bindGroup).toBeDefined();
    });

    it('should handle many resources', () => {
      const resources = Array.from({ length: 100 }, (_, i) => `buffer_${i}`);
      const result = pool.acquire('layout_1', resources, () => createMockBindGroup('1'));
      expect(result.bindGroup).toBeDefined();
    });

    it('should increment IDs sequentially', () => {
      const result1 = pool.acquire('layout_1', ['buffer_1'], () => createMockBindGroup('1'));
      const result2 = pool.acquire('layout_2', ['buffer_2'], () => createMockBindGroup('2'));
      const result3 = pool.acquire('layout_3', ['buffer_3'], () => createMockBindGroup('3'));

      expect(result1.id).toBe(1);
      expect(result2.id).toBe(2);
      expect(result3.id).toBe(3);
    });
  });
});
