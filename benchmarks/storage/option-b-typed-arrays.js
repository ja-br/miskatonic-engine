/**
 * Option B: Typed Arrays (SoA - Structure of Arrays)
 *
 * Components stored in separate typed arrays:
 * - posX: Float32Array
 * - posY: Float32Array
 * - posZ: Float32Array
 *
 * Characteristics:
 * - Cache friendly (sequential memory layout)
 * - Low GC pressure (no object allocations)
 * - SIMD optimization potential
 * - Slightly less ergonomic API
 *
 * Expected: 10x faster than Option A (cache analysis prediction)
 */

export function typedArrayBenchmark(entityCount, iterations, verbose = false) {
  // Setup: Create component storage
  const posX = new Float32Array(entityCount);
  const posY = new Float32Array(entityCount);
  const posZ = new Float32Array(entityCount);

  const velX = new Float32Array(entityCount);
  const velY = new Float32Array(entityCount);
  const velZ = new Float32Array(entityCount);

  // Initialize with random values
  for (let i = 0; i < entityCount; i++) {
    posX[i] = Math.random();
    posY[i] = Math.random();
    posZ[i] = Math.random();

    velX[i] = Math.random();
    velY[i] = Math.random();
    velZ[i] = Math.random();
  }

  if (verbose) {
    console.log(`  Setup: ${entityCount} entities in typed arrays`);
  }

  // Force GC before test
  if (global.gc) {
    global.gc();
  }

  const heapBefore = process.memoryUsage().heapUsed;
  const startTime = performance.now();

  // Benchmark: Movement system simulation (SoA style)
  for (let iter = 0; iter < iterations; iter++) {
    const dt = 0.016; // 16ms frame time

    // Sequential iteration over typed arrays
    // This is MUCH more cache-friendly than object arrays
    for (let i = 0; i < entityCount; i++) {
      posX[i] += velX[i] * dt;
      posY[i] += velY[i] * dt;
      posZ[i] += velZ[i] * dt;
    }
  }

  const endTime = performance.now();
  const heapAfter = process.memoryUsage().heapUsed;

  const totalTime = endTime - startTime;
  const timePerIteration = totalTime / iterations;
  const heapGrowth = Math.max(0, heapAfter - heapBefore);
  const gcAllocations = 0; // Typed arrays don't cause GC pressure

  if (verbose) {
    console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Time per iteration: ${timePerIteration.toFixed(3)}ms`);
    console.log(`  Heap growth: ${(heapGrowth / 1024 / 1024).toFixed(2)}MB`);
  }

  return {
    name: 'Typed Arrays (SoA)',
    entityCount,
    iterations,
    totalTime,
    timePerIteration,
    heapGrowth,
    gcAllocations
  };
}
