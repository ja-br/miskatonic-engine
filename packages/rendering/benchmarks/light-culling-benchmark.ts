/**
 * Light Culling Benchmark - Epic 3.16
 *
 * Measures CPU-based frustum culling performance.
 * Target: <1ms for 100 lights
 */

import { LightCuller, LightType, type LightCullingStats } from '../src/culling/LightCuller';
import type { LightData } from '../src/LightCollection';

interface BenchmarkResult {
  lightCount: number;
  iterations: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  culledPercent: number;
}

/**
 * Create test lights in a scene (mix of visible and culled).
 *
 * @param count Number of lights to create
 * @returns Array of test lights
 */
function createTestLights(count: number): LightData[] {
  const lights: LightData[] = [];

  // 1 directional light (always visible)
  lights.push({
    entity: 1,
    type: LightType.DIRECTIONAL,
    enabled: true,
    color: [1, 1, 1],
    intensity: 1,
    direction: [0, -1, 0],
    position: undefined,
    radius: undefined,
    spotAngle: undefined,
    spotPenumbra: undefined,
    castsShadows: true,
    shadowBias: 0.005,
  });

  // 1 ambient light (always visible)
  lights.push({
    entity: 2,
    type: LightType.AMBIENT,
    enabled: true,
    color: [0.2, 0.2, 0.25],
    intensity: 0.5,
    direction: undefined,
    position: undefined,
    radius: undefined,
    spotAngle: undefined,
    spotPenumbra: undefined,
    castsShadows: false,
    shadowBias: 0.005,
  });

  // Rest are point lights (mix of visible and culled)
  for (let i = 2; i < count; i++) {
    // Create grid of lights: some visible (near origin), some culled (far away)
    const x = (i % 10) * 20 - 100; // -100 to 80
    const y = (Math.floor(i / 10) % 10) * 20 - 100;
    const z = (Math.floor(i / 100) % 10) * 20 - 100;

    lights.push({
      entity: i + 1,
      type: LightType.POINT,
      enabled: true,
      color: [Math.random(), Math.random(), Math.random()],
      intensity: 1 + Math.random() * 2,
      direction: undefined,
      position: [x, y, z],
      radius: 10 + Math.random() * 20,
      spotAngle: undefined,
      spotPenumbra: undefined,
      castsShadows: Math.random() > 0.5,
      shadowBias: 0.005,
    });
  }

  return lights;
}

/**
 * Create a perspective projection matrix.
 *
 * @param fov Field of view in radians
 * @param aspect Aspect ratio
 * @param near Near plane distance
 * @param far Far plane distance
 * @returns 16-element projection matrix (column-major)
 */
function createPerspectiveMatrix(
  fov: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  const f = 1.0 / Math.tan(fov / 2);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ]);
}

/**
 * Run benchmark for a specific light count.
 *
 * @param lightCount Number of lights to test
 * @param iterations Number of culling iterations
 * @returns Benchmark result
 */
function benchmarkLightCount(lightCount: number, iterations: number): BenchmarkResult {
  const lights = createTestLights(lightCount);
  const culler = new LightCuller();
  const matrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 1000);

  const times: number[] = [];
  let totalCulled = 0;

  // Warm-up (5 iterations)
  for (let i = 0; i < 5; i++) {
    culler.cull(lights, matrix);
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    const result = culler.cull(lights, matrix);
    const endTime = performance.now();

    times.push(endTime - startTime);
    totalCulled += result.stats.culledLights;
  }

  // Compute statistics
  const avgTimeMs = times.reduce((sum, t) => sum + t, 0) / times.length;
  const minTimeMs = Math.min(...times);
  const maxTimeMs = Math.max(...times);
  const avgCulled = totalCulled / iterations;
  const culledPercent = (avgCulled / lightCount) * 100;

  return {
    lightCount,
    iterations,
    avgTimeMs,
    minTimeMs,
    maxTimeMs,
    culledPercent,
  };
}

/**
 * Print benchmark result table.
 *
 * @param results Array of benchmark results
 */
function printResults(results: BenchmarkResult[]): void {
  console.log('\n=== Light Culling Benchmark Results (Epic 3.16) ===\n');
  console.log('Target: <1ms for 100 lights\n');

  console.log('Lights | Iterations | Avg (ms) | Min (ms) | Max (ms) | Culled % | Status');
  console.log('-------|------------|----------|----------|----------|----------|--------');

  for (const result of results) {
    const avgStr = result.avgTimeMs.toFixed(3).padStart(8);
    const minStr = result.minTimeMs.toFixed(3).padStart(8);
    const maxStr = result.maxTimeMs.toFixed(3).padStart(8);
    const culledStr = result.culledPercent.toFixed(1).padStart(8);

    // Check if within target (<1ms for 100 lights, proportional scaling)
    const targetMs = (result.lightCount / 100) * 1.0;
    const status = result.avgTimeMs < targetMs ? '✅ PASS' : '❌ FAIL';

    console.log(
      `${result.lightCount.toString().padStart(6)} | ` +
      `${result.iterations.toString().padStart(10)} | ` +
      `${avgStr} | ` +
      `${minStr} | ` +
      `${maxStr} | ` +
      `${culledStr} | ` +
      status
    );
  }

  console.log('\n=== Summary ===\n');

  const result100 = results.find(r => r.lightCount === 100);
  if (result100) {
    console.log(`Performance for 100 lights: ${result100.avgTimeMs.toFixed(3)}ms`);
    console.log(`Target: <1ms`);
    console.log(`Status: ${result100.avgTimeMs < 1.0 ? '✅ PASS - Within target!' : '❌ FAIL - Exceeds target'}`);
  }

  const maxLights = results[results.length - 1];
  console.log(`\nMax tested: ${maxLights.lightCount} lights in ${maxLights.avgTimeMs.toFixed(3)}ms`);
  console.log(`Throughput: ${(maxLights.lightCount / maxLights.avgTimeMs * 1000).toFixed(0)} lights/second`);
  console.log(`Average culling rate: ${maxLights.culledPercent.toFixed(1)}%`);
}

/**
 * Run complete benchmark suite.
 */
function runBenchmark(): void {
  console.log('Starting light culling benchmark...\n');
  console.log('CPU: ' + (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency + ' cores' : 'Unknown'));
  console.log('Platform: ' + (typeof process !== 'undefined' ? process.platform : 'browser'));
  console.log('');

  const testCases = [
    { lightCount: 10, iterations: 10000 },
    { lightCount: 50, iterations: 5000 },
    { lightCount: 100, iterations: 2000 },
    { lightCount: 250, iterations: 1000 },
    { lightCount: 500, iterations: 500 },
    { lightCount: 1000, iterations: 200 },
  ];

  const results: BenchmarkResult[] = [];

  for (const testCase of testCases) {
    process.stdout.write(`Testing ${testCase.lightCount} lights...`);
    const result = benchmarkLightCount(testCase.lightCount, testCase.iterations);
    results.push(result);
    process.stdout.write(` ${result.avgTimeMs.toFixed(3)}ms\n`);
  }

  printResults(results);
}

// Run benchmark if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmark();
}

export { runBenchmark, benchmarkLightCount, createTestLights };
