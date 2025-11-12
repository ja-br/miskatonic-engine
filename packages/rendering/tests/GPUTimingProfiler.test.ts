/**
 * Tests for GPUTimingProfiler - Epic 3.18 Phase 1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GPUTimingProfiler } from '../src/profiling/GPUTimingProfiler';

// Mock WebGPU globals
(global as any).GPUBufferUsage = {
  QUERY_RESOLVE: 0x0200,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  MAP_READ: 0x0001,
};

(global as any).GPUMapMode = {
  READ: 0x0001,
  WRITE: 0x0002,
};

describe('GPUTimingProfiler', () => {
  let mockDevice: GPUDevice;
  let profiler: GPUTimingProfiler;

  beforeEach(() => {
    // Mock GPUDevice
    mockDevice = {
      features: new Set<string>(['timestamp-query']),
      createQuerySet: vi.fn(() => ({
        destroy: vi.fn(),
      })) as any,
      createBuffer: vi.fn(() => ({
        destroy: vi.fn(),
        mapAsync: vi.fn().mockResolvedValue(undefined),
        getMappedRange: vi.fn(() => new ArrayBuffer(256)),
        unmap: vi.fn(),
      })) as any,
      createCommandEncoder: vi.fn(() => ({
        resolveQuerySet: vi.fn(),
        copyBufferToBuffer: vi.fn(),
        finish: vi.fn(() => ({})),
      })) as any,
      queue: {
        submit: vi.fn(),
      } as any,
    } as any as GPUDevice;
  });

  afterEach(() => {
    profiler?.destroy();
  });

  describe('Construction', () => {
    it('should create with default config', () => {
      profiler = new GPUTimingProfiler(mockDevice);

      expect(profiler.isTimestampSupported()).toBe(true);
      expect(profiler.getFrameNumber()).toBe(0);
    });

    it('should create with custom config', () => {
      profiler = new GPUTimingProfiler(mockDevice, {
        frameAverageCount: 120,
        maxConcurrentQueries: 64,
      });

      expect(profiler.isTimestampSupported()).toBe(true);
    });

    it('should detect when timestamps are unsupported', () => {
      const mockDeviceNoTimestamp = {
        ...mockDevice,
        features: new Set<string>(),
      } as any as GPUDevice;

      profiler = new GPUTimingProfiler(mockDeviceNoTimestamp);

      expect(profiler.isTimestampSupported()).toBe(false);
    });

    it('should allow disabling timestamps', () => {
      profiler = new GPUTimingProfiler(mockDevice, {
        enableTimestamps: false,
      });

      expect(profiler.isTimestampSupported()).toBe(false);
    });

    it('should create query set when timestamps supported', () => {
      profiler = new GPUTimingProfiler(mockDevice, {
        maxConcurrentQueries: 16,
      });

      expect(mockDevice.createQuerySet).toHaveBeenCalledWith({
        type: 'timestamp',
        count: 32, // 16 * 2 (begin + end)
      });
    });

    it('should create resolve and readback buffers', () => {
      profiler = new GPUTimingProfiler(mockDevice);

      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(2);
    });
  });

  describe('CPU Timing (Fallback Mode)', () => {
    beforeEach(() => {
      const mockDeviceNoTimestamp = {
        ...mockDevice,
        features: new Set<string>(),
      } as any as GPUDevice;

      profiler = new GPUTimingProfiler(mockDeviceNoTimestamp);
    });

    it('should record CPU timing without encoder', () => {
      profiler.begin('test');
      profiler.end('test');

      const stats = profiler.getStatistics('test');
      expect(stats).not.toBeNull();
      expect(stats!.sampleCount).toBe(1);
      expect(stats!.avgCpuTime).toBeGreaterThanOrEqual(0);
    });

    it('should use CPU time as GPU fallback', () => {
      profiler.begin('test');
      profiler.end('test');

      const stats = profiler.getStatistics('test');
      expect(stats!.avgGpuTime).toBe(stats!.avgCpuTime);
    });

    it('should warn on unmatched end()', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      profiler.end('nonexistent');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No matching begin()')
      );

      warnSpy.mockRestore();
    });
  });

  describe('GPU Timing', () => {
    let mockEncoder: GPUCommandEncoder;

    beforeEach(() => {
      profiler = new GPUTimingProfiler(mockDevice);

      mockEncoder = {
        writeTimestamp: vi.fn(),
        resolveQuerySet: vi.fn(),
        copyBufferToBuffer: vi.fn(),
        finish: vi.fn(() => ({})),
      } as any as GPUCommandEncoder;
    });

    it('should insert timestamp queries', () => {
      profiler.begin('test', mockEncoder);
      profiler.end('test', mockEncoder);

      expect(mockEncoder.writeTimestamp).toHaveBeenCalledTimes(2);
    });

    it('should use sequential query indices', () => {
      profiler.begin('op1', mockEncoder);
      profiler.begin('op2', mockEncoder);

      expect(mockEncoder.writeTimestamp).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        0 // First begin
      );
      expect(mockEncoder.writeTimestamp).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        2 // Second begin
      );
    });

    it('should warn when max concurrent queries exceeded', () => {
      profiler = new GPUTimingProfiler(mockDevice, {
        maxConcurrentQueries: 2,
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      profiler.begin('op1', mockEncoder);
      profiler.begin('op2', mockEncoder);
      profiler.begin('op3', mockEncoder); // Exceeds limit

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Max concurrent queries')
      );

      warnSpy.mockRestore();
    });
  });

  describe('Frame Resolution', () => {
    let mockEncoder: GPUCommandEncoder;

    beforeEach(() => {
      profiler = new GPUTimingProfiler(mockDevice);

      mockEncoder = {
        writeTimestamp: vi.fn(),
      } as any as GPUCommandEncoder;
    });

    it('should increment frame number after resolve', async () => {
      expect(profiler.getFrameNumber()).toBe(0);

      await profiler.resolveFrame();

      expect(profiler.getFrameNumber()).toBe(1);
    });

    it('should resolve without timestamps', async () => {
      const mockDeviceNoTimestamp = {
        ...mockDevice,
        features: new Set<string>(),
      } as any as GPUDevice;

      profiler = new GPUTimingProfiler(mockDeviceNoTimestamp);

      await profiler.resolveFrame();

      expect(profiler.getFrameNumber()).toBe(1);
    });

    it('should clear active queries after resolve', async () => {
      profiler.begin('test', mockEncoder);
      await profiler.resolveFrame();

      // Should be able to reuse query index
      profiler.begin('test2', mockEncoder);
      expect(mockEncoder.writeTimestamp).toHaveBeenCalledWith(
        expect.anything(),
        0 // Reused first query
      );
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      const mockDeviceNoTimestamp = {
        ...mockDevice,
        features: new Set<string>(),
      } as any as GPUDevice;

      profiler = new GPUTimingProfiler(mockDeviceNoTimestamp);
    });

    it('should return null for unknown operation', () => {
      const stats = profiler.getStatistics('unknown');
      expect(stats).toBeNull();
    });

    it('should calculate average GPU time', () => {
      // Simulate multiple measurements
      for (let i = 0; i < 10; i++) {
        profiler.begin('test');
        profiler.end('test');
      }

      const stats = profiler.getStatistics('test');
      expect(stats).not.toBeNull();
      expect(stats!.avgGpuTime).toBeGreaterThanOrEqual(0);
      expect(stats!.sampleCount).toBe(10);
    });

    it('should calculate min/max GPU time', () => {
      for (let i = 0; i < 5; i++) {
        profiler.begin('test');
        profiler.end('test');
      }

      const stats = profiler.getStatistics('test');
      expect(stats!.minGpuTime).toBeLessThanOrEqual(stats!.avgGpuTime);
      expect(stats!.maxGpuTime).toBeGreaterThanOrEqual(stats!.avgGpuTime);
    });

    it('should calculate standard deviation', () => {
      for (let i = 0; i < 10; i++) {
        profiler.begin('test');
        profiler.end('test');
      }

      const stats = profiler.getStatistics('test');
      expect(stats!.stdDevGpuTime).toBeGreaterThanOrEqual(0);
    });

    it('should track multiple operations independently', () => {
      profiler.begin('op1');
      profiler.end('op1');

      profiler.begin('op2');
      profiler.end('op2');

      const stats1 = profiler.getStatistics('op1');
      const stats2 = profiler.getStatistics('op2');

      expect(stats1).not.toBeNull();
      expect(stats2).not.toBeNull();
      expect(stats1!.name).toBe('op1');
      expect(stats2!.name).toBe('op2');
    });

    it('should accumulate samples over frames', async () => {
      for (let frame = 0; frame < 3; frame++) {
        profiler.begin('test');
        profiler.end('test');
        await profiler.resolveFrame();
      }

      const stats = profiler.getStatistics('test');
      expect(stats!.sampleCount).toBe(3);
    });
  });

  describe('getAllStatistics', () => {
    beforeEach(() => {
      const mockDeviceNoTimestamp = {
        ...mockDevice,
        features: new Set<string>(),
      } as any as GPUDevice;

      profiler = new GPUTimingProfiler(mockDeviceNoTimestamp);
    });

    it('should return empty array when no measurements', () => {
      const allStats = profiler.getAllStatistics();
      expect(allStats).toEqual([]);
    });

    it('should return stats for all operations', () => {
      profiler.begin('op1');
      profiler.end('op1');

      profiler.begin('op2');
      profiler.end('op2');

      profiler.begin('op3');
      profiler.end('op3');

      const allStats = profiler.getAllStatistics();
      expect(allStats).toHaveLength(3);

      const names = allStats.map((s) => s.name);
      expect(names).toContain('op1');
      expect(names).toContain('op2');
      expect(names).toContain('op3');
    });

    it('should sort by average GPU time descending', () => {
      // Create operations with predictable timing
      const start1 = performance.now();
      profiler.begin('slow');
      const delay1 = 10;
      while (performance.now() - start1 < delay1) {} // Busy wait
      profiler.end('slow');

      profiler.begin('fast');
      profiler.end('fast');

      const allStats = profiler.getAllStatistics();
      expect(allStats[0].name).toBe('slow');
      expect(allStats[1].name).toBe('fast');
    });
  });

  describe('getTotalGpuTime', () => {
    beforeEach(() => {
      const mockDeviceNoTimestamp = {
        ...mockDevice,
        features: new Set<string>(),
      } as any as GPUDevice;

      profiler = new GPUTimingProfiler(mockDeviceNoTimestamp);
    });

    it('should return zero for first frame', () => {
      const total = profiler.getTotalGpuTime();
      expect(total).toBe(0);
    });

    it('should sum all operation times', async () => {
      profiler.begin('op1');
      profiler.end('op1');

      profiler.begin('op2');
      profiler.end('op2');

      await profiler.resolveFrame();

      const total = profiler.getTotalGpuTime();
      expect(total).toBeGreaterThan(0);

      const stats1 = profiler.getStatistics('op1');
      const stats2 = profiler.getStatistics('op2');
      const expected = stats1!.avgGpuTime + stats2!.avgGpuTime;

      expect(total).toBeCloseTo(expected, 1);
    });
  });

  describe('Measurement Pruning', () => {
    beforeEach(() => {
      profiler = new GPUTimingProfiler(mockDevice, {
        frameAverageCount: 3,
      });
    });

    it('should prune measurements older than frameAverageCount', async () => {
      // Add more frames than frameAverageCount (3)
      for (let i = 0; i < 10; i++) {
        profiler.begin('test');
        profiler.end('test');
        await profiler.resolveFrame();
      }

      const stats = profiler.getStatistics('test');
      // Should only keep last 3 frames worth of measurements
      // frameAverageCount = 3, so keep frames > (10 - 3) = frames 8, 9, 10
      expect(stats!.sampleCount).toBeLessThanOrEqual(3);
      expect(stats!.sampleCount).toBeGreaterThan(0);
    });
  });

  describe('Reset', () => {
    beforeEach(() => {
      const mockDeviceNoTimestamp = {
        ...mockDevice,
        features: new Set<string>(),
      } as any as GPUDevice;

      profiler = new GPUTimingProfiler(mockDeviceNoTimestamp);
    });

    it('should clear all measurements', () => {
      profiler.begin('test');
      profiler.end('test');

      profiler.reset();

      const stats = profiler.getStatistics('test');
      expect(stats).toBeNull();
    });

    it('should reset frame number', async () => {
      await profiler.resolveFrame();
      await profiler.resolveFrame();
      expect(profiler.getFrameNumber()).toBe(2);

      profiler.reset();

      expect(profiler.getFrameNumber()).toBe(0);
    });

    it('should allow new measurements after reset', () => {
      profiler.begin('test1');
      profiler.end('test1');

      profiler.reset();

      profiler.begin('test2');
      profiler.end('test2');

      const stats = profiler.getStatistics('test2');
      expect(stats).not.toBeNull();
      expect(stats!.sampleCount).toBe(1);
    });
  });

  describe('Destroy', () => {
    it('should destroy GPU resources', () => {
      profiler = new GPUTimingProfiler(mockDevice);

      const destroySpy1 = vi.fn();
      const destroySpy2 = vi.fn();
      const destroySpy3 = vi.fn();

      (mockDevice.createQuerySet as any).mockReturnValue({
        destroy: destroySpy1,
      });
      (mockDevice.createBuffer as any).mockReturnValueOnce({
        destroy: destroySpy2,
      });
      (mockDevice.createBuffer as any).mockReturnValueOnce({
        destroy: destroySpy3,
      });

      // Re-create to get mocked resources
      profiler.destroy();
      profiler = new GPUTimingProfiler(mockDevice);

      profiler.destroy();

      expect(destroySpy1).toHaveBeenCalled();
      expect(destroySpy2).toHaveBeenCalled();
      expect(destroySpy3).toHaveBeenCalled();
    });

    it('should clear measurements on destroy', () => {
      profiler = new GPUTimingProfiler(mockDevice);

      profiler.begin('test');
      profiler.end('test');

      profiler.destroy();

      const stats = profiler.getStatistics('test');
      expect(stats).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      const mockDeviceNoTimestamp = {
        ...mockDevice,
        features: new Set<string>(),
      } as any as GPUDevice;

      profiler = new GPUTimingProfiler(mockDeviceNoTimestamp);
    });

    it('should handle duplicate begin() calls', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      profiler.begin('test');
      profiler.begin('test'); // Duplicate
      profiler.end('test');

      const stats = profiler.getStatistics('test');
      expect(stats!.sampleCount).toBe(1);

      warnSpy.mockRestore();
    });

    it('should handle zero-duration operations', () => {
      profiler.begin('instant');
      profiler.end('instant');

      const stats = profiler.getStatistics('instant');
      expect(stats).not.toBeNull();
      expect(stats!.avgGpuTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle operations with no encoder', () => {
      profiler.begin('test');
      profiler.end('test');

      const stats = profiler.getStatistics('test');
      expect(stats).not.toBeNull();
    });
  });
});
