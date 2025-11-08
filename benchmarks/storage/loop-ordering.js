/**
 * Loop Ordering Benchmark (Row-major vs Column-major)
 *
 * Tests the impact of loop ordering on cache performance.
 * This is the example from the cache analysis article.
 *
 * Cache Analysis Prediction: 10-100x difference
 *
 * Good ordering (row-major): Iterates memory sequentially
 * Bad ordering (column-major): Jumps across cache lines
 *
 * Example: 2D array access [i][j] vs [j][i]
 */

export function loopOrderingBenchmark(entityCount, iterations, verbose = false) {
  // Setup: Create 2D grid (simulating spatial partitioning)
  const gridSize = Math.floor(Math.sqrt(entityCount));
  const actualSize = gridSize * gridSize;

  // Row-major storage (cache-friendly for row iteration)
  const grid = new Float32Array(actualSize);
  for (let i = 0; i < actualSize; i++) {
    grid[i] = Math.random();
  }

  if (verbose) {
    console.log(`  Setup: ${gridSize}x${gridSize} grid (${actualSize} total)`);
  }

  // Force GC
  if (global.gc) {
    global.gc();
  }

  // Test 1: Good Loop Order (Row-major iteration - Sequential)
  let goodStart = performance.now();
  for (let iter = 0; iter < iterations; iter++) {
    // Iterate rows first, then columns (sequential memory access)
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const idx = row * gridSize + col;
        grid[idx] *= 1.001;
      }
    }
  }
  let goodEnd = performance.now();
  const goodOrderTime = (goodEnd - goodStart) / iterations;

  // Test 2: Bad Loop Order (Column-major iteration - Strided)
  let badStart = performance.now();
  for (let iter = 0; iter < iterations; iter++) {
    // Iterate columns first, then rows (strided memory access - cache unfriendly)
    for (let col = 0; col < gridSize; col++) {
      for (let row = 0; row < gridSize; row++) {
        const idx = row * gridSize + col;
        grid[idx] *= 1.001;
      }
    }
  }
  let badEnd = performance.now();
  const badOrderTime = (badEnd - badStart) / iterations;

  const penalty = badOrderTime / goodOrderTime;

  if (verbose) {
    console.log(`  Good order (row-major): ${goodOrderTime.toFixed(3)}ms`);
    console.log(`  Bad order (column-major): ${badOrderTime.toFixed(3)}ms`);
    console.log(`  Penalty: ${penalty.toFixed(2)}x`);
  }

  return {
    name: 'Loop Ordering',
    entityCount: actualSize,
    gridSize,
    iterations,
    goodOrderTime,
    badOrderTime,
    penalty
  };
}
