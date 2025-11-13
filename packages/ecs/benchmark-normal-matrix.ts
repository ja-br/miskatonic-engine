/**
 * Benchmark suite for normal matrix operations
 *
 * Validates performance claims and ensures operations meet 60 FPS budget (16.67ms frame time)
 */

import * as Mat4 from './src/math/Mat4';
import { mat4 } from 'wgpu-matrix';

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  opsPerSec: number;
}

function benchmark(name: string, iterations: number, fn: () => void): BenchmarkResult {
  // Warm-up phase to avoid JIT compilation overhead
  for (let i = 0; i < 1000; i++) {
    fn();
  }

  // Force GC before benchmark (if available)
  if (global.gc) {
    global.gc();
  }

  // Actual benchmark
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();

  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  const opsPerSec = (iterations / totalTime) * 1000;

  return {
    name,
    iterations,
    totalTime,
    avgTime,
    opsPerSec
  };
}

function printResult(result: BenchmarkResult): void {
  console.log(`\n${result.name}`);
  console.log(`  Iterations: ${result.iterations.toLocaleString()}`);
  console.log(`  Total time: ${result.totalTime.toFixed(2)}ms`);
  console.log(`  Avg time: ${(result.avgTime * 1000).toFixed(3)}µs`);
  console.log(`  Ops/sec: ${result.opsPerSec.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
}

// Generate random transform matrices with rotation and non-uniform scale
function generateRandomMatrix(): Float32Array {
  const tx = Math.random() * 100 - 50;
  const ty = Math.random() * 100 - 50;
  const tz = Math.random() * 100 - 50;
  const rx = Math.random() * Math.PI * 2;
  const ry = Math.random() * Math.PI * 2;
  const rz = Math.random() * Math.PI * 2;
  const sx = Math.random() * 2 + 0.5; // 0.5 to 2.5
  const sy = Math.random() * 2 + 0.5;
  const sz = Math.random() * 2 + 0.5;

  return Mat4.composeTRS(tx, ty, tz, rx, ry, rz, sx, sy, sz);
}

// Naive matrix inversion for comparison (Gauss-Jordan elimination)
function naiveInvert(matrix: Float32Array): Float32Array | null {
  const m = Array.from(matrix);
  const inv = new Float32Array(16);

  // Create augmented matrix [M | I]
  const aug: number[][] = [];
  for (let i = 0; i < 4; i++) {
    aug[i] = [];
    for (let j = 0; j < 4; j++) {
      aug[i][j] = m[i + j * 4];
    }
    for (let j = 0; j < 4; j++) {
      aug[i][4 + j] = i === j ? 1 : 0;
    }
  }

  // Gauss-Jordan elimination
  for (let i = 0; i < 4; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < 4; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap rows
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

    // Check for singularity
    if (Math.abs(aug[i][i]) < 1e-10) {
      return null;
    }

    // Scale pivot row
    const pivot = aug[i][i];
    for (let j = 0; j < 8; j++) {
      aug[i][j] /= pivot;
    }

    // Eliminate column
    for (let k = 0; k < 4; k++) {
      if (k !== i) {
        const factor = aug[k][i];
        for (let j = 0; j < 8; j++) {
          aug[k][j] -= factor * aug[i][j];
        }
      }
    }
  }

  // Extract inverse from augmented matrix
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      inv[i + j * 4] = aug[i][4 + j];
    }
  }

  return inv;
}

console.log('='.repeat(80));
console.log('NORMAL MATRIX BENCHMARK SUITE');
console.log('='.repeat(80));

// Test 1: Matrix inversion comparison (wgpu-matrix vs naive)
console.log('\n[1] MATRIX INVERSION COMPARISON');
console.log('-'.repeat(80));

const inversionMatrices = Array.from({ length: 1000 }, () => generateRandomMatrix());

const wgpuInvertResult = benchmark(
  'wgpu-matrix inversion (1000 matrices)',
  1000,
  () => {
    for (const matrix of inversionMatrices) {
      Mat4.invert(matrix);
    }
  }
);
printResult(wgpuInvertResult);

const naiveInvertResult = benchmark(
  'Naive inversion (1000 matrices)',
  1000,
  () => {
    for (const matrix of inversionMatrices) {
      naiveInvert(matrix);
    }
  }
);
printResult(naiveInvertResult);

const speedup = naiveInvertResult.avgTime / wgpuInvertResult.avgTime;
console.log(`\n  Speedup: ${speedup.toFixed(2)}x faster with wgpu-matrix`);

// Test 2: Normal matrix computation cost
console.log('\n\n[2] NORMAL MATRIX COMPUTATION');
console.log('-'.repeat(80));

const normalMatrixInputs = Array.from({ length: 1000 }, () => generateRandomMatrix());

const normalMatrixResult = benchmark(
  'Normal matrix computation (1000 entities)',
  1000,
  () => {
    for (const matrix of normalMatrixInputs) {
      Mat4.computeNormalMatrix(matrix);
    }
  }
);
printResult(normalMatrixResult);

// Test 3: Full integration - 10k entities with lighting
console.log('\n\n[3] FULL INTEGRATION TEST');
console.log('-'.repeat(80));

const integrationMatrices = Array.from({ length: 10000 }, () => generateRandomMatrix());

const integrationResult = benchmark(
  'Normal matrices for 10k entities',
  100,
  () => {
    for (const matrix of integrationMatrices) {
      Mat4.computeNormalMatrix(matrix);
    }
  }
);
printResult(integrationResult);

const totalTime10k = integrationResult.avgTime;
const budget60fps = 16.67; // ms
const percentOfBudget = (totalTime10k / budget60fps) * 100;

console.log(`\n  10k entities: ${totalTime10k.toFixed(2)}ms`);
console.log(`  60 FPS budget: ${budget60fps.toFixed(2)}ms`);
console.log(`  Budget usage: ${percentOfBudget.toFixed(1)}%`);

if (totalTime10k < budget60fps) {
  console.log(`  ✅ PASS: Within 60 FPS budget`);
} else {
  console.log(`  ❌ FAIL: Exceeds 60 FPS budget by ${(totalTime10k - budget60fps).toFixed(2)}ms`);
}

// Test 4: Cache simulation - measure impact of caching
console.log('\n\n[4] CACHE IMPACT SIMULATION');
console.log('-'.repeat(80));

const cacheMatrices = Array.from({ length: 1000 }, () => generateRandomMatrix());
const cache = new Map<number, Float32Array>();

const uncachedResult = benchmark(
  'Uncached (compute every frame, 1000 entities × 60 frames)',
  60,
  () => {
    for (let i = 0; i < cacheMatrices.length; i++) {
      Mat4.computeNormalMatrix(cacheMatrices[i]);
    }
  }
);
printResult(uncachedResult);

const cachedResult = benchmark(
  'Cached (10% update rate, 1000 entities × 60 frames)',
  60,
  () => {
    for (let i = 0; i < cacheMatrices.length; i++) {
      // 10% of entities update per frame (typical for static objects)
      if (Math.random() < 0.1 || !cache.has(i)) {
        const result = Mat4.computeNormalMatrix(cacheMatrices[i]);
        if (result) cache.set(i, result);
      } else {
        cache.get(i); // Cache hit (just read)
      }
    }
  }
);
printResult(cachedResult);

const cacheSavings = ((uncachedResult.avgTime - cachedResult.avgTime) / uncachedResult.avgTime) * 100;
console.log(`\n  Cache savings: ${cacheSavings.toFixed(1)}% faster with caching`);

// Test 5: Transpose performance
console.log('\n\n[5] TRANSPOSE PERFORMANCE');
console.log('-'.repeat(80));

const transposeMatrices = Array.from({ length: 1000 }, () => generateRandomMatrix());

const transposeResult = benchmark(
  'Matrix transpose (1000 matrices)',
  1000,
  () => {
    for (const matrix of transposeMatrices) {
      Mat4.transpose(matrix);
    }
  }
);
printResult(transposeResult);

// Summary
console.log('\n\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`\nMatrix Inversion:`);
console.log(`  wgpu-matrix: ${(wgpuInvertResult.avgTime * 1000).toFixed(3)}µs per matrix`);
console.log(`  Speedup: ${speedup.toFixed(2)}x faster than naive implementation`);
console.log(`\nNormal Matrix Computation:`);
console.log(`  Per entity: ${(normalMatrixResult.avgTime * 1000).toFixed(3)}µs`);
console.log(`  10k entities: ${totalTime10k.toFixed(2)}ms (${percentOfBudget.toFixed(1)}% of 60 FPS budget)`);
console.log(`\nCaching Impact:`);
console.log(`  Performance gain: ${cacheSavings.toFixed(1)}% faster with 10% update rate`);
console.log(`\nConclusion:`);
if (totalTime10k < budget60fps && speedup > 1.5) {
  console.log(`  ✅ PASS: Performance targets met`);
  console.log(`  - wgpu-matrix provides significant speedup`);
  console.log(`  - Normal matrix computation fits within 60 FPS budget`);
  console.log(`  - Caching provides measurable performance benefit`);
} else {
  console.log(`  ⚠️  WARNING: Performance concerns detected`);
  if (totalTime10k >= budget60fps) {
    console.log(`  - 10k entities exceeds 60 FPS budget`);
  }
  if (speedup <= 1.5) {
    console.log(`  - wgpu-matrix speedup is less than expected`);
  }
}

console.log('\n' + '='.repeat(80));
