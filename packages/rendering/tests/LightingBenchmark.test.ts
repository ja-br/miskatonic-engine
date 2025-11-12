/**
 * Tests for LightingBenchmark - Epic 3.18 Phase 2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LightingBenchmark,
  BenchmarkScenarios,
  DefaultPerformanceTargets,
  BenchmarkResult,
} from '../src/profiling/LightingBenchmark';

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

describe('LightingBenchmark', () => {
  let mockDevice: GPUDevice;
  let benchmark: LightingBenchmark;

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
        getMappedRange: vi.fn(() => new ArrayBuffer(512)),
        unmap: vi.fn(),
      })) as any,
      createCommandEncoder: vi.fn(() => ({
        writeTimestamp: vi.fn(),
        resolveQuerySet: vi.fn(),
        copyBufferToBuffer: vi.fn(),
        finish: vi.fn(() => ({})),
      })) as any,
      queue: {
        submit: vi.fn(),
      } as any,
    } as any as GPUDevice;

    benchmark = new LightingBenchmark(mockDevice);
  });

  afterEach(() => {
    benchmark?.destroy();
  });

  describe('Construction', () => {
    it('should create with default targets', () => {
      expect(benchmark).toBeDefined();
    });

    it('should create with custom config', () => {
      const customConfig = {
        warmupFrames: 10,
        gpuTimeout: 3000,
        targets: {
          maxFrameTime: 20.0,
          maxLightingTime: 5.0,
          maxShadowTime: 10.0,
          maxCullingTime: 2.0,
          minFps: 50.0,
        },
      };

      const customBenchmark = new LightingBenchmark(mockDevice, customConfig);
      expect(customBenchmark).toBeDefined();
      customBenchmark.destroy();
    });
  });

  describe('Benchmark Scenarios', () => {
    it('should have BEST_CASE scenario', () => {
      expect(BenchmarkScenarios.BEST_CASE).toBeDefined();
      expect(BenchmarkScenarios.BEST_CASE.name).toBe('Best Case');
      expect(BenchmarkScenarios.BEST_CASE.directionalLights).toBe(1);
      expect(BenchmarkScenarios.BEST_CASE.pointLights).toBe(0);
      expect(BenchmarkScenarios.BEST_CASE.shadowedLights).toBe(0);
    });

    it('should have TYPICAL scenario', () => {
      expect(BenchmarkScenarios.TYPICAL).toBeDefined();
      expect(BenchmarkScenarios.TYPICAL.name).toBe('Typical');
      expect(BenchmarkScenarios.TYPICAL.directionalLights).toBe(1);
      expect(BenchmarkScenarios.TYPICAL.pointLights).toBe(8);
      expect(BenchmarkScenarios.TYPICAL.spotLights).toBe(2);
      expect(BenchmarkScenarios.TYPICAL.shadowedLights).toBe(11);
    });

    it('should have HEAVY scenario', () => {
      expect(BenchmarkScenarios.HEAVY).toBeDefined();
      expect(BenchmarkScenarios.HEAVY.name).toBe('Heavy');
      expect(BenchmarkScenarios.HEAVY.pointLights).toBe(16);
      expect(BenchmarkScenarios.HEAVY.shadowedLights).toBe(4);
    });

    it('should have PATHOLOGICAL scenario', () => {
      expect(BenchmarkScenarios.PATHOLOGICAL).toBeDefined();
      expect(BenchmarkScenarios.PATHOLOGICAL.name).toBe('Pathological');
      expect(BenchmarkScenarios.PATHOLOGICAL.pointLights).toBe(100);
      expect(BenchmarkScenarios.PATHOLOGICAL.enableCulling).toBe(true);
    });

    it('should have STRESS scenario', () => {
      expect(BenchmarkScenarios.STRESS).toBeDefined();
      expect(BenchmarkScenarios.STRESS.name).toBe('Stress Test');
      expect(BenchmarkScenarios.STRESS.pointLights).toBe(1000);
    });
  });

  describe('Performance Targets', () => {
    it('should have default 60 FPS targets', () => {
      expect(DefaultPerformanceTargets.maxFrameTime).toBe(16.67);
      expect(DefaultPerformanceTargets.minFps).toBe(60.0);
    });

    it('should have lighting time target', () => {
      expect(DefaultPerformanceTargets.maxLightingTime).toBe(4.0);
    });

    it('should have shadow time target', () => {
      expect(DefaultPerformanceTargets.maxShadowTime).toBe(8.0);
    });

    it('should have culling time target', () => {
      expect(DefaultPerformanceTargets.maxCullingTime).toBe(1.0);
    });
  });

  describe('Benchmark Execution', () => {
    it('should run single scenario', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10, // Small for fast test
      };

      const setupFn = vi.fn();
      const renderFn = vi.fn();

      const result = await benchmark.run(scenario, setupFn, renderFn);

      expect(setupFn).toHaveBeenCalledOnce();
      expect(renderFn).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.scenario.name).toBe('Best Case');
      expect(result.framesExecuted).toBe(10);
    });

    it('should collect frame timings', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const result = await benchmark.run(
        scenario,
        () => {},
        () => {}
      );

      expect(result.avgFrameTime).toBeGreaterThan(0);
      expect(result.minFrameTime).toBeGreaterThanOrEqual(0);
      expect(result.maxFrameTime).toBeGreaterThanOrEqual(result.minFrameTime);
    });

    it('should calculate FPS', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const result = await benchmark.run(
        scenario,
        () => {},
        () => {}
      );

      expect(result.avgFps).toBeGreaterThan(0);
      expect(result.avgFps).toBeCloseTo(1000 / result.avgFrameTime, 1);
    });

    it('should calculate percentiles', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 100,
      };

      const result = await benchmark.run(
        scenario,
        () => {},
        () => {}
      );

      // P95 should be in the 95th percentile range
      expect(result.p95FrameTime).toBeGreaterThanOrEqual(result.minFrameTime);
      expect(result.p95FrameTime).toBeLessThanOrEqual(result.maxFrameTime);

      // P99 should be between P95 and max
      expect(result.p99FrameTime).toBeGreaterThanOrEqual(result.p95FrameTime);
      expect(result.p99FrameTime).toBeLessThanOrEqual(result.maxFrameTime);
    });

    it('should perform warmup frames', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 5,
      };

      let renderCount = 0;
      const renderFn = () => {
        renderCount++;
      };

      await benchmark.run(scenario, () => {}, renderFn);

      // Should render warmup (30) + measured (5) frames
      expect(renderCount).toBe(35);
    });
  });

  describe('Operation Timing', () => {
    it('should track operation timing', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const renderFn = (encoder: GPUCommandEncoder) => {
        benchmark.beginOperation('lighting', encoder);
        benchmark.endOperation('lighting', encoder);
      };

      await benchmark.run(scenario, () => {}, renderFn);

      const lightingStats = benchmark.getOperationStats('lighting');
      expect(lightingStats).not.toBeNull();
      expect(lightingStats!.name).toBe('lighting');
    });

    it('should return null for unknown operation', () => {
      const stats = benchmark.getOperationStats('nonexistent');
      expect(stats).toBeNull();
    });

    it('should collect multiple operations', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const renderFn = (encoder: GPUCommandEncoder) => {
        benchmark.beginOperation('lighting', encoder);
        benchmark.endOperation('lighting', encoder);

        benchmark.beginOperation('shadow', encoder);
        benchmark.endOperation('shadow', encoder);
      };

      const result = await benchmark.run(scenario, () => {}, renderFn);

      expect(result.operations.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Performance Validation', () => {
    it('should pass when within targets', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const result = await benchmark.run(
        scenario,
        () => {},
        () => {}
      );

      // Fast scenario should pass
      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should fail when frame time exceeds target', async () => {
      const strictBenchmark = new LightingBenchmark(mockDevice, {
        warmupFrames: 0, // Skip warmup in tests
        targets: {
          maxFrameTime: 0.001, // Impossible target (1 microsecond)
          maxLightingTime: 0.0005, // Half of frame time
          maxShadowTime: 0.0003,
          maxCullingTime: 0.0002,
          minFps: 1000000.0, // 1M FPS (impossible)
        },
      });

      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const result = await strictBenchmark.run(
        scenario,
        () => {},
        () => {}
      );

      expect(result.passed).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);

      strictBenchmark.destroy();
    });

    it('should sum lighting operations for validation', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const renderFn = (encoder: GPUCommandEncoder) => {
        benchmark.beginOperation('lighting-pass1', encoder);
        benchmark.endOperation('lighting-pass1', encoder);

        benchmark.beginOperation('lighting-pass2', encoder);
        benchmark.endOperation('lighting-pass2', encoder);
      };

      const result = await benchmark.run(scenario, () => {}, renderFn);

      // Should have 2 lighting operations
      const lightingOps = result.operations.filter(op => op.name.includes('lighting'));
      expect(lightingOps.length).toBeGreaterThanOrEqual(2);

      // Total lighting time should be sum of all lighting operations
      const expectedTotal = lightingOps.reduce((sum, op) => sum + op.avgGpuTime, 0);
      expect(result.totalLightingTime).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe('Report Generation', () => {
    it('should generate report for single result', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const result = await benchmark.run(
        scenario,
        () => {},
        () => {}
      );

      const report = benchmark.generateReport([result]);

      expect(report).toContain('Lighting Performance Benchmark Report');
      expect(report).toContain('Best Case');
      expect(report).toContain('Frame Timing');
      expect(report).toContain('FPS');
    });

    it('should include configuration details', async () => {
      const scenario = BenchmarkScenarios.TYPICAL;
      scenario.frameCount = 10;

      const result = await benchmark.run(
        scenario,
        () => {},
        () => {}
      );

      const report = benchmark.generateReport([result]);

      expect(report).toContain('Directional: 1');
      expect(report).toContain('Point: 8');
      expect(report).toContain('Spot: 2');
    });

    it('should show pass/fail status', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const result = await benchmark.run(
        scenario,
        () => {},
        () => {}
      );

      const report = benchmark.generateReport([result]);

      if (result.passed) {
        expect(report).toContain('✅ PASSED');
      } else {
        expect(report).toContain('❌ FAILED');
      }
    });
  });

  describe('JSON Export', () => {
    it('should export results as JSON', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const result = await benchmark.run(
        scenario,
        () => {},
        () => {}
      );

      const json = benchmark.exportJson([result]);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].scenario.name).toBe('Best Case');
    });

    it('should include all timing data', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const result = await benchmark.run(
        scenario,
        () => {},
        () => {}
      );

      const json = benchmark.exportJson([result]);
      const parsed = JSON.parse(json);

      expect(parsed[0].avgFrameTime).toBeDefined();
      expect(parsed[0].p95FrameTime).toBeDefined();
      expect(parsed[0].operations).toBeDefined();
    });
  });

  describe('Baseline Comparison', () => {
    it('should detect no regressions for identical results', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const result1 = await benchmark.run(
        scenario,
        () => {},
        () => {}
      );
      const result2 = { ...result1 };

      const report = benchmark.compareWithBaseline([result1], [result2]);

      expect(report).toContain('0 regression(s) detected');
    });

    it('should detect frame time regression', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const baseline = await benchmark.run(
        scenario,
        () => {},
        () => {}
      );

      const current = { ...baseline };
      current.avgFrameTime = baseline.avgFrameTime * 1.5; // 50% slower

      const report = benchmark.compareWithBaseline([current], [baseline], 0.1);

      expect(report).toContain('[REGRESSION]');
      expect(report).toContain('regression(s) detected');
    });

    it('should detect improvement', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const baseline = await benchmark.run(
        scenario,
        () => {},
        () => {}
      );

      const current = { ...baseline };
      current.avgFrameTime = baseline.avgFrameTime * 0.5; // 50% faster

      const report = benchmark.compareWithBaseline([current], [baseline], 0.1);

      expect(report).toContain('[IMPROVEMENT]');
    });

    it('should use custom threshold', async () => {
      const scenario = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };

      const baseline = await benchmark.run(
        scenario,
        () => {},
        () => {}
      );

      const current = { ...baseline };
      current.avgFrameTime = baseline.avgFrameTime * 1.05; // 5% slower

      // With 10% threshold, should not detect
      const report1 = benchmark.compareWithBaseline([current], [baseline], 0.1);
      expect(report1).toContain('0 regression(s)');

      // With 1% threshold, should detect
      const report2 = benchmark.compareWithBaseline([current], [baseline], 0.01);
      expect(report2).toContain('regression(s) detected');
    });

    it('should warn on scenario mismatch', async () => {
      const scenario1 = {
        ...BenchmarkScenarios.BEST_CASE,
        frameCount: 10,
      };
      const scenario2 = {
        ...BenchmarkScenarios.TYPICAL,
        frameCount: 10,
      };

      const result1 = await benchmark.run(
        scenario1,
        () => {},
        () => {}
      );
      const result2 = await benchmark.run(
        scenario2,
        () => {},
        () => {}
      );

      const report = benchmark.compareWithBaseline([result1], [result2]);

      expect(report).toContain('No baseline for scenario');
    });
  });

  describe('Resource Cleanup', () => {
    it('should destroy profiler on destroy', () => {
      const destroySpy = vi.fn();
      (benchmark as any).profiler.destroy = destroySpy;

      benchmark.destroy();

      expect(destroySpy).toHaveBeenCalled();
    });
  });
});
