/**
 * Sequential vs Random Access Benchmark
 *
 * Tests cache penalty for random memory access patterns.
 *
 * Cache Analysis Prediction: ~10x difference
 *
 * Sequential: [0, 1, 2, 3, 4, ...] - Cache friendly
 * Random: [42, 7, 103, 2, 99, ...] - Cache unfriendly
 *
 * This validates the fundamental assumption of cache-efficient design.
 */

export function sequentialVsRandomBenchmark(entityCount, iterations, verbose = false) {
  // Setup: Create typed array (best case for cache)
  const data = new Float32Array(entityCount);
  for (let i = 0; i < entityCount; i++) {
    data[i] = Math.random();
  }

  // Create random index array (shuffle)
  const randomIndices = Array.from({ length: entityCount }, (_, i) => i);
  for (let i = randomIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [randomIndices[i], randomIndices[j]] = [randomIndices[j], randomIndices[i]];
  }

  if (verbose) {
    console.log(`  Setup: ${entityCount} elements for access pattern test`);
  }

  // Force GC
  if (global.gc) {
    global.gc();
  }

  // Test 1: Sequential Access (Cache Friendly)
  let sequentialStart = performance.now();
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < entityCount; i++) {
      data[i] *= 1.001; // Modify in-place
    }
  }
  let sequentialEnd = performance.now();
  const sequentialTime = (sequentialEnd - sequentialStart) / iterations;

  // Test 2: Random Access (Cache Unfriendly)
  let randomStart = performance.now();
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < entityCount; i++) {
      const idx = randomIndices[i];
      data[idx] *= 1.001; // Random access pattern
    }
  }
  let randomEnd = performance.now();
  const randomTime = (randomEnd - randomStart) / iterations;

  const penalty = randomTime / sequentialTime;

  if (verbose) {
    console.log(`  Sequential: ${sequentialTime.toFixed(3)}ms`);
    console.log(`  Random: ${randomTime.toFixed(3)}ms`);
    console.log(`  Penalty: ${penalty.toFixed(2)}x`);
  }

  return {
    name: 'Sequential vs Random Access',
    entityCount,
    iterations,
    sequentialTime,
    randomTime,
    penalty
  };
}
