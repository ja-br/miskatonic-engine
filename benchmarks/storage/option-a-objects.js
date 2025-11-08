/**
 * Option A: Object Arrays (AoS - Array of Structures)
 *
 * This is the CURRENT implementation in packages/ecs/
 * Components stored as array of objects: [{x, y, z}, {x, y, z}, ...]
 *
 * Characteristics:
 * - Cache unfriendly (objects scattered in memory)
 * - High GC pressure (allocates objects)
 * - Pointer chasing overhead
 * - Ergonomic API (natural JavaScript)
 *
 * Expected: Baseline performance (slowest)
 */

export function objectArrayBenchmark(entityCount, iterations, verbose = false) {
  // Setup: Create component data
  const positions = [];
  const velocities = [];

  for (let i = 0; i < entityCount; i++) {
    positions.push({ x: Math.random(), y: Math.random(), z: Math.random() });
    velocities.push({ x: Math.random(), y: Math.random(), z: Math.random() });
  }

  if (verbose) {
    console.log(`  Setup: ${entityCount} entities created`);
  }

  // Force GC before test
  if (global.gc) {
    global.gc();
  }

  const heapBefore = process.memoryUsage().heapUsed;
  const startTime = performance.now();

  // Benchmark: Movement system simulation
  for (let iter = 0; iter < iterations; iter++) {
    const dt = 0.016; // 16ms frame time

    // This is how current ECS works
    for (let i = 0; i < entityCount; i++) {
      const pos = positions[i];
      const vel = velocities[i];

      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      pos.z += vel.z * dt;
    }
  }

  const endTime = performance.now();
  const heapAfter = process.memoryUsage().heapUsed;

  const totalTime = endTime - startTime;
  const timePerIteration = totalTime / iterations;
  const heapGrowth = Math.max(0, heapAfter - heapBefore);
  const gcAllocations = Math.floor(heapGrowth / (8 * 3 * entityCount)); // Rough estimate

  if (verbose) {
    console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Time per iteration: ${timePerIteration.toFixed(3)}ms`);
    console.log(`  Heap growth: ${(heapGrowth / 1024 / 1024).toFixed(2)}MB`);
  }

  return {
    name: 'Object Arrays (AoS)',
    entityCount,
    iterations,
    totalTime,
    timePerIteration,
    heapGrowth,
    gcAllocations
  };
}
