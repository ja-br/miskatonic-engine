/**
 * Lighting Benchmark Framework - Epic 3.18 Phase 2
 *
 * Comprehensive benchmarking system for measuring lighting and shadow
 * performance across various scenarios. Uses GPUTimingProfiler for accurate
 * measurements and provides statistical analysis for performance regression
 * detection.
 */

import { GPUTimingProfiler } from './GPUTimingProfiler';

/**
 * Benchmark scenario configuration
 */
export interface BenchmarkScenario {
  /** Scenario name */
  name: string;
  /** Description of what's being tested */
  description: string;
  /** Number of directional lights */
  directionalLights: number;
  /** Number of point lights */
  pointLights: number;
  /** Number of spot lights */
  spotLights: number;
  /** Number of shadowed lights */
  shadowedLights: number;
  /** Enable light culling */
  enableCulling: boolean;
  /** Number of objects in scene */
  objectCount: number;
  /** Number of frames to run */
  frameCount: number;
}

/**
 * Detailed timing breakdown for a single operation
 */
export interface OperationTiming {
  /** Operation name */
  name: string;
  /** Average GPU time (ms) */
  avgGpuTime: number;
  /** Minimum GPU time (ms) */
  minGpuTime: number;
  /** Maximum GPU time (ms) */
  maxGpuTime: number;
  /** Average CPU time (ms) */
  avgCpuTime: number;
  /** Standard deviation */
  stdDevGpuTime: number;
  /** Sample count */
  sampleCount: number;
}

/**
 * Benchmark execution results
 */
export interface BenchmarkResult {
  /** Scenario that was run */
  scenario: BenchmarkScenario;
  /** Timestamp when benchmark completed */
  timestamp: number;
  /** Total frames executed */
  framesExecuted: number;
  /** Average frame time (ms) */
  avgFrameTime: number;
  /** Minimum frame time (ms) */
  minFrameTime: number;
  /** Maximum frame time (ms) */
  maxFrameTime: number;
  /** 95th percentile frame time (ms) */
  p95FrameTime: number;
  /** 99th percentile frame time (ms) */
  p99FrameTime: number;
  /** Average FPS */
  avgFps: number;
  /** Total lighting time (ms) */
  totalLightingTime: number;
  /** Total shadow time (ms) */
  totalShadowTime: number;
  /** Total culling time (ms) */
  totalCullingTime: number;
  /** Detailed timing for each operation */
  operations: OperationTiming[];
  /** Did benchmark pass performance targets? */
  passed: boolean;
  /** Reasons for failure (if any) */
  failures: string[];
}

/**
 * Performance targets for validation
 */
export interface PerformanceTargets {
  /** Maximum acceptable frame time (ms) */
  maxFrameTime: number;
  /** Maximum acceptable lighting time (ms) */
  maxLightingTime: number;
  /** Maximum acceptable shadow time (ms) */
  maxShadowTime: number;
  /** Maximum acceptable culling time (ms) */
  maxCullingTime: number;
  /** Minimum acceptable FPS */
  minFps: number;
}

/**
 * Configuration for LightingBenchmark
 */
export interface LightingBenchmarkConfig {
  /** Number of warmup frames (default: 30) */
  warmupFrames?: number;
  /** Timeout for GPU operations in milliseconds (default: 5000) */
  gpuTimeout?: number;
  /** Performance targets (default: 60 FPS baseline) */
  targets?: PerformanceTargets;
}

/**
 * Predefined benchmark scenarios
 */
export const BenchmarkScenarios = {
  /** Best case: Single directional light, no shadows */
  BEST_CASE: {
    name: 'Best Case',
    description: 'Single directional light, no shadows',
    directionalLights: 1,
    pointLights: 0,
    spotLights: 0,
    shadowedLights: 0,
    enableCulling: false,
    objectCount: 100,
    frameCount: 120,
  } as BenchmarkScenario,

  /** Typical: Mixed lights with shadows */
  TYPICAL: {
    name: 'Typical',
    description: '1 directional + 8 point + 2 spot, all shadowed',
    directionalLights: 1,
    pointLights: 8,
    spotLights: 2,
    shadowedLights: 11,
    enableCulling: true,
    objectCount: 500,
    frameCount: 120,
  } as BenchmarkScenario,

  /** Heavy: Many shadowed point lights */
  HEAVY: {
    name: 'Heavy',
    description: '16 point lights, 4 with shadows',
    directionalLights: 0,
    pointLights: 16,
    spotLights: 0,
    shadowedLights: 4,
    enableCulling: true,
    objectCount: 1000,
    frameCount: 120,
  } as BenchmarkScenario,

  /** Pathological: Extreme light count with culling */
  PATHOLOGICAL: {
    name: 'Pathological',
    description: '100 point lights, culled to ~16 visible',
    directionalLights: 0,
    pointLights: 100,
    spotLights: 0,
    shadowedLights: 0,
    enableCulling: true,
    objectCount: 2000,
    frameCount: 120,
  } as BenchmarkScenario,

  /** Stress: Maximum light count */
  STRESS: {
    name: 'Stress Test',
    description: '1000 point lights with tile culling',
    directionalLights: 0,
    pointLights: 1000,
    spotLights: 0,
    shadowedLights: 0,
    enableCulling: true,
    objectCount: 5000,
    frameCount: 60,
  } as BenchmarkScenario,
};

/**
 * Default performance targets (60 FPS baseline)
 */
export const DefaultPerformanceTargets: PerformanceTargets = {
  maxFrameTime: 16.67, // 60 FPS
  maxLightingTime: 4.0, // <4ms for lighting
  maxShadowTime: 8.0, // <8ms for shadows
  maxCullingTime: 1.0, // <1ms for culling
  minFps: 60.0,
};

/**
 * Lighting Benchmark Runner
 *
 * Executes benchmark scenarios and collects detailed performance metrics
 * using GPUTimingProfiler. Provides statistical analysis and validation
 * against performance targets.
 *
 * @example
 * ```typescript
 * const benchmark = new LightingBenchmark(device);
 *
 * // Run single scenario
 * const result = await benchmark.run(BenchmarkScenarios.TYPICAL);
 * console.log(`Avg Frame Time: ${result.avgFrameTime.toFixed(2)}ms`);
 * console.log(`Passed: ${result.passed}`);
 *
 * // Run all scenarios
 * const results = await benchmark.runAll();
 * benchmark.generateReport(results);
 * ```
 */
export class LightingBenchmark {
  private profiler: GPUTimingProfiler;
  private targets: PerformanceTargets;
  private warmupFrames: number;
  private gpuTimeout: number;
  private frameTimings: number[] = [];

  /**
   * Create lighting benchmark runner
   *
   * @param device - WebGPU device for timing
   * @param config - Benchmark configuration
   */
  constructor(device: GPUDevice, config: LightingBenchmarkConfig = {}) {
    // 120 frames = 2 seconds @ 60 FPS, provides stable averaging for benchmark analysis
    this.profiler = new GPUTimingProfiler(device, {
      frameAverageCount: 120,
      maxConcurrentQueries: 64,
    });

    this.warmupFrames = config.warmupFrames ?? 30;
    this.gpuTimeout = config.gpuTimeout ?? 5000;

    const finalTargets = config.targets ?? DefaultPerformanceTargets;
    this.validateTargets(finalTargets);
    this.targets = finalTargets;
  }

  /**
   * Validate performance targets
   */
  private validateTargets(targets: PerformanceTargets): void {
    // Check all values are finite and positive
    if (!Number.isFinite(targets.maxFrameTime) || targets.maxFrameTime <= 0) {
      throw new Error(`maxFrameTime must be finite and positive (got ${targets.maxFrameTime})`);
    }
    if (!Number.isFinite(targets.maxLightingTime) || targets.maxLightingTime < 0) {
      throw new Error(`maxLightingTime must be finite and non-negative (got ${targets.maxLightingTime})`);
    }
    if (!Number.isFinite(targets.maxShadowTime) || targets.maxShadowTime < 0) {
      throw new Error(`maxShadowTime must be finite and non-negative (got ${targets.maxShadowTime})`);
    }
    if (!Number.isFinite(targets.maxCullingTime) || targets.maxCullingTime < 0) {
      throw new Error(`maxCullingTime must be finite and non-negative (got ${targets.maxCullingTime})`);
    }
    if (!Number.isFinite(targets.minFps) || targets.minFps <= 0) {
      throw new Error(`minFps must be finite and positive (got ${targets.minFps})`);
    }

    // Check reasonable upper bounds to catch obvious errors
    if (targets.maxFrameTime > 60000) {
      throw new Error(`maxFrameTime seems unreasonably large (${targets.maxFrameTime}ms > 60s)`);
    }
    if (targets.minFps > 1000000) {
      throw new Error(`minFps seems unreasonably large (${targets.minFps} > 1M FPS)`);
    }

    // Check operation times don't exceed frame time
    if (targets.maxLightingTime > targets.maxFrameTime) {
      throw new Error(`maxLightingTime (${targets.maxLightingTime}ms) cannot exceed maxFrameTime (${targets.maxFrameTime}ms)`);
    }
    if (targets.maxShadowTime > targets.maxFrameTime) {
      throw new Error(`maxShadowTime (${targets.maxShadowTime}ms) cannot exceed maxFrameTime (${targets.maxFrameTime}ms)`);
    }
    if (targets.maxCullingTime > targets.maxFrameTime) {
      throw new Error(`maxCullingTime (${targets.maxCullingTime}ms) cannot exceed maxFrameTime (${targets.maxFrameTime}ms)`);
    }
  }

  /**
   * Run a single benchmark scenario
   *
   * @param scenario - Scenario configuration
   * @param setupFn - Function to set up the scene
   * @param renderFn - Function to render a frame (receives encoder)
   * @returns Benchmark results with detailed timing
   */
  async run(
    scenario: BenchmarkScenario,
    setupFn: () => void | Promise<void>,
    renderFn: (encoder: GPUCommandEncoder) => void
  ): Promise<BenchmarkResult> {
    // Validate frameCount
    if (!Number.isInteger(scenario.frameCount) || scenario.frameCount < 1 || scenario.frameCount > 10000) {
      throw new Error(`frameCount must be integer in [1, 10000] (got ${scenario.frameCount})`);
    }

    // Reset profiler for clean measurements
    this.profiler.reset();
    this.frameTimings = [];

    // Set up scene with error handling
    try {
      await Promise.resolve(setupFn());
    } catch (error) {
      throw new Error(`Benchmark setup failed for "${scenario.name}": ${error}`);
    }

    // Warm-up frames (not measured)
    for (let i = 0; i < this.warmupFrames; i++) {
      try {
        const encoder = this.profiler.createCommandEncoder();
        renderFn(encoder);
        await this.submitAndResolveWithTimeout(encoder);
      } catch (error) {
        throw new Error(`Benchmark warmup failed at frame ${i}: ${error}`);
      }
    }

    // Measured frames
    for (let frame = 0; frame < scenario.frameCount; frame++) {
      try {
        const frameStart = performance.now();

        const encoder = this.profiler.createCommandEncoder();

        // Begin frame timing
        this.profiler.begin('frame', encoder);

        // Render frame
        renderFn(encoder);

        // End frame timing
        this.profiler.end('frame', encoder);

        await this.submitAndResolveWithTimeout(encoder);

        const frameTime = performance.now() - frameStart;
        this.frameTimings.push(frameTime);
      } catch (error) {
        throw new Error(`Benchmark failed at frame ${frame}/${scenario.frameCount}: ${error}`);
      }
    }

    // Collect and analyze results
    return this.analyzeResults(scenario);
  }

  /**
   * Submit encoder and resolve with timeout
   */
  private async submitAndResolveWithTimeout(encoder: GPUCommandEncoder): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('GPU operation timeout')), this.gpuTimeout)
    );

    try {
      await Promise.race([
        this.profiler.submitAndResolve(encoder),
        timeoutPromise
      ]);
    } catch (error) {
      throw new Error(`GPU operation failed or timed out: ${error}`);
    }
  }

  /**
   * Run all predefined benchmark scenarios
   *
   * @param setupFn - Function to set up scenes (receives scenario)
   * @param renderFn - Function to render frames
   * @returns Results for all scenarios
   */
  async runAll(
    setupFn: (scenario: BenchmarkScenario) => void,
    renderFn: (encoder: GPUCommandEncoder) => void
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const scenario of Object.values(BenchmarkScenarios)) {
      const result = await this.run(scenario, () => setupFn(scenario), renderFn);
      results.push(result);
    }

    return results;
  }

  /**
   * Get profiler statistics for specific operation
   *
   * @param name - Operation name
   * @returns Timing statistics or null
   */
  getOperationStats(name: string): OperationTiming | null {
    const stats = this.profiler.getStatistics(name);
    if (!stats) return null;

    return {
      name: stats.name,
      avgGpuTime: stats.avgGpuTime,
      minGpuTime: stats.minGpuTime,
      maxGpuTime: stats.maxGpuTime,
      avgCpuTime: stats.avgCpuTime,
      stdDevGpuTime: stats.stdDevGpuTime,
      sampleCount: stats.sampleCount,
    };
  }

  /**
   * Begin timing an operation within current frame
   *
   * @param name - Operation name
   * @param encoder - Command encoder
   */
  beginOperation(name: string, encoder: GPUCommandEncoder): void {
    this.profiler.begin(name, encoder);
  }

  /**
   * End timing an operation within current frame
   *
   * @param name - Operation name
   * @param encoder - Command encoder
   */
  endOperation(name: string, encoder: GPUCommandEncoder): void {
    this.profiler.end(name, encoder);
  }

  /**
   * Generate human-readable report from benchmark results
   *
   * @param results - Benchmark results to report
   * @returns Formatted report string
   */
  generateReport(results: BenchmarkResult[]): string {
    let report = '# Lighting Performance Benchmark Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    for (const result of results) {
      report += `## ${result.scenario.name}\n`;
      report += `${result.scenario.description}\n\n`;

      report += `**Configuration:**\n`;
      report += `- Directional: ${result.scenario.directionalLights}, `;
      report += `Point: ${result.scenario.pointLights}, `;
      report += `Spot: ${result.scenario.spotLights}\n`;
      report += `- Shadowed: ${result.scenario.shadowedLights}, `;
      report += `Objects: ${result.scenario.objectCount}\n`;
      report += `- Culling: ${result.scenario.enableCulling ? 'Enabled' : 'Disabled'}\n\n`;

      report += `**Frame Timing:**\n`;
      report += `- Average: ${result.avgFrameTime.toFixed(2)}ms (${result.avgFps.toFixed(1)} FPS)\n`;
      report += `- Min/Max: ${result.minFrameTime.toFixed(2)}ms / ${result.maxFrameTime.toFixed(2)}ms\n`;
      report += `- P95: ${result.p95FrameTime.toFixed(2)}ms, `;
      report += `P99: ${result.p99FrameTime.toFixed(2)}ms\n\n`;

      report += `**Subsystem Timing:**\n`;
      report += `- Lighting: ${result.totalLightingTime.toFixed(2)}ms\n`;
      report += `- Shadows: ${result.totalShadowTime.toFixed(2)}ms\n`;
      report += `- Culling: ${result.totalCullingTime.toFixed(2)}ms\n\n`;

      if (result.operations.length > 0) {
        report += `**Operation Breakdown:**\n`;
        for (const op of result.operations) {
          report += `- ${op.name}: ${op.avgGpuTime.toFixed(2)}ms `;
          report += `(min: ${op.minGpuTime.toFixed(2)}ms, max: ${op.maxGpuTime.toFixed(2)}ms)\n`;
        }
        report += '\n';
      }

      report += `**Result:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
      if (!result.passed) {
        for (const failure of result.failures) {
          report += `  - ${failure}\n`;
        }
      }
      report += '\n---\n\n';
    }

    return report;
  }

  /**
   * Export results as JSON for CI/CD
   *
   * @param results - Benchmark results
   * @returns JSON string
   */
  exportJson(results: BenchmarkResult[]): string {
    return JSON.stringify(results, null, 2);
  }

  /**
   * Compare results against baseline for regression detection
   *
   * @param current - Current benchmark results
   * @param baseline - Baseline results
   * @param threshold - Regression threshold (default: 10%)
   * @returns Regression report
   */
  compareWithBaseline(
    current: BenchmarkResult[],
    baseline: BenchmarkResult[],
    threshold = 0.1
  ): string {
    let report = '# Performance Regression Analysis\n\n';
    let regressions = 0;

    // Check array length mismatch
    if (current.length !== baseline.length) {
      report += `⚠️ Array length mismatch: current ${current.length}, baseline ${baseline.length}\n\n`;
    }

    // Create lookup map for baseline by scenario name
    const baselineMap = new Map<string, BenchmarkResult>();
    for (const result of baseline) {
      baselineMap.set(result.scenario.name, result);
    }

    for (const curr of current) {
      const base = baselineMap.get(curr.scenario.name);
      if (!base) {
        report += `⚠️ No baseline for scenario: ${curr.scenario.name}\n\n`;
        continue;
      }

      report += `## ${curr.scenario.name}\n`;

      const frameTimeDelta = (curr.avgFrameTime - base.avgFrameTime) / base.avgFrameTime;
      const lightingDelta = (curr.totalLightingTime - base.totalLightingTime) / base.totalLightingTime;
      const shadowDelta = (curr.totalShadowTime - base.totalShadowTime) / base.totalShadowTime;

      if (Math.abs(frameTimeDelta) > threshold) {
        const sign = frameTimeDelta > 0 ? '[REGRESSION]' : '[IMPROVEMENT]';
        report += `${sign} Frame Time: ${base.avgFrameTime.toFixed(2)}ms → ${curr.avgFrameTime.toFixed(2)}ms `;
        report += `(${(frameTimeDelta * 100).toFixed(1)}%)\n`;
        if (frameTimeDelta > threshold) regressions++;
      }

      if (Math.abs(lightingDelta) > threshold) {
        const sign = lightingDelta > 0 ? '[REGRESSION]' : '[IMPROVEMENT]';
        report += `${sign} Lighting: ${base.totalLightingTime.toFixed(2)}ms → ${curr.totalLightingTime.toFixed(2)}ms `;
        report += `(${(lightingDelta * 100).toFixed(1)}%)\n`;
        if (lightingDelta > threshold) regressions++;
      }

      if (Math.abs(shadowDelta) > threshold) {
        const sign = shadowDelta > 0 ? '[REGRESSION]' : '[IMPROVEMENT]';
        report += `${sign} Shadows: ${base.totalShadowTime.toFixed(2)}ms → ${curr.totalShadowTime.toFixed(2)}ms `;
        report += `(${(shadowDelta * 100).toFixed(1)}%)\n`;
        if (shadowDelta > threshold) regressions++;
      }

      report += '\n';
    }

    report += `\n**Summary:** ${regressions} regression(s) detected\n`;
    return report;
  }

  /**
   * Clean up GPU resources
   */
  destroy(): void {
    this.profiler.destroy();
  }

  /**
   * Analyze collected data and generate result
   */
  private analyzeResults(scenario: BenchmarkScenario): BenchmarkResult {
    // Validate frame timings collected
    if (this.frameTimings.length === 0) {
      throw new Error('Benchmark collected zero frames - this indicates a critical failure');
    }

    if (this.frameTimings.length < 100) {
      console.warn(`Benchmark only collected ${this.frameTimings.length} frames - percentiles may be unreliable`);
    }
    // Calculate frame time statistics
    const sortedFrames = [...this.frameTimings].sort((a, b) => a - b);
    const avgFrameTime = sortedFrames.reduce((a, b) => a + b, 0) / sortedFrames.length;
    const minFrameTime = sortedFrames[0];
    const maxFrameTime = sortedFrames[sortedFrames.length - 1];

    // Fix percentile calculation (subtract 1 for 0-based indexing)
    const p95Index = Math.max(0, Math.floor(sortedFrames.length * 0.95) - 1);
    const p99Index = Math.max(0, Math.floor(sortedFrames.length * 0.99) - 1);
    const p95FrameTime = sortedFrames[p95Index];
    const p99FrameTime = sortedFrames[p99Index];
    const avgFps = 1000 / avgFrameTime;

    // Collect operation timings
    const allStats = this.profiler.getAllStatistics();
    const operations: OperationTiming[] = allStats.map((s) => ({
      name: s.name,
      avgGpuTime: s.avgGpuTime,
      minGpuTime: s.minGpuTime,
      maxGpuTime: s.maxGpuTime,
      avgCpuTime: s.avgCpuTime,
      stdDevGpuTime: s.stdDevGpuTime,
      sampleCount: s.sampleCount,
    }));

    // Calculate subsystem totals using prefix matching
    // Convention: operation names should start with category prefix
    // Examples: "lighting-pbr", "shadow-csm", "culling-frustum"
    const lightingOps = operations.filter((op) =>
      op.name.startsWith('lighting') || op.name.startsWith('light-')
    );
    const shadowOps = operations.filter((op) =>
      op.name.startsWith('shadow') || op.name.startsWith('shadow-')
    );
    const cullingOps = operations.filter((op) =>
      op.name.startsWith('culling') || op.name.startsWith('cull-')
    );

    const totalLightingTime = lightingOps.reduce((sum, op) => sum + op.avgGpuTime, 0);
    const totalShadowTime = shadowOps.reduce((sum, op) => sum + op.avgGpuTime, 0);
    const totalCullingTime = cullingOps.reduce((sum, op) => sum + op.avgGpuTime, 0);

    // Warn if expected operations not found
    if (lightingOps.length === 0 && operations.length > 0) {
      console.warn('Benchmark collected zero lighting operations - validation may be incomplete');
    }
    if (shadowOps.length === 0 && scenario.shadowedLights > 0) {
      console.warn(`Benchmark expected ${scenario.shadowedLights} shadowed lights but collected no shadow operations`);
    }

    // Validate against performance targets
    const failures: string[] = [];

    if (avgFrameTime > this.targets.maxFrameTime) {
      failures.push(
        `Frame time ${avgFrameTime.toFixed(2)}ms exceeds target ${this.targets.maxFrameTime.toFixed(2)}ms`
      );
    }

    if (totalLightingTime > this.targets.maxLightingTime) {
      failures.push(
        `Lighting time ${totalLightingTime.toFixed(2)}ms exceeds target ${this.targets.maxLightingTime.toFixed(2)}ms`
      );
    }

    if (totalShadowTime > this.targets.maxShadowTime) {
      failures.push(
        `Shadow time ${totalShadowTime.toFixed(2)}ms exceeds target ${this.targets.maxShadowTime.toFixed(2)}ms`
      );
    }

    if (totalCullingTime > this.targets.maxCullingTime) {
      failures.push(
        `Culling time ${totalCullingTime.toFixed(2)}ms exceeds target ${this.targets.maxCullingTime.toFixed(2)}ms`
      );
    }

    if (avgFps < this.targets.minFps) {
      failures.push(
        `FPS ${avgFps.toFixed(1)} below target ${this.targets.minFps.toFixed(1)}`
      );
    }

    return {
      scenario,
      timestamp: Date.now(),
      framesExecuted: scenario.frameCount,
      avgFrameTime,
      minFrameTime,
      maxFrameTime,
      p95FrameTime,
      p99FrameTime,
      avgFps,
      totalLightingTime,
      totalShadowTime,
      totalCullingTime,
      operations,
      passed: failures.length === 0,
      failures,
    };
  }
}
