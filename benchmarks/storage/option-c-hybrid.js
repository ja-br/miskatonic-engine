/**
 * Option C: Hybrid (Objects backed by Typed Arrays)
 *
 * Objects with getters/setters that access typed arrays:
 * class Position {
 *   get x() { return this.storage[this.index * 3]; }
 *   set x(v) { this.storage[this.index * 3] = v; }
 * }
 *
 * Characteristics:
 * - Cache friendly storage (typed arrays)
 * - Ergonomic API (objects)
 * - Getter/setter overhead
 * - Moderate GC pressure (object wrappers)
 *
 * Expected: 3-5x faster than Option A, slower than Option B
 */

class Position {
  constructor(storage, index) {
    this.storage = storage;
    this.index = index;
  }

  get x() { return this.storage[this.index * 3]; }
  set x(v) { this.storage[this.index * 3] = v; }

  get y() { return this.storage[this.index * 3 + 1]; }
  set y(v) { this.storage[this.index * 3 + 1] = v; }

  get z() { return this.storage[this.index * 3 + 2]; }
  set z(v) { this.storage[this.index * 3 + 2] = v; }
}

class Velocity {
  constructor(storage, index) {
    this.storage = storage;
    this.index = index;
  }

  get x() { return this.storage[this.index * 3]; }
  set x(v) { this.storage[this.index * 3] = v; }

  get y() { return this.storage[this.index * 3 + 1]; }
  set y(v) { this.storage[this.index * 3 + 1] = v; }

  get z() { return this.storage[this.index * 3 + 2]; }
  set z(v) { this.storage[this.index * 3 + 2] = v; }
}

export function hybridBenchmark(entityCount, iterations, verbose = false) {
  // Setup: Create typed array storage
  const posStorage = new Float32Array(entityCount * 3);
  const velStorage = new Float32Array(entityCount * 3);

  // Create wrapper objects
  const positions = [];
  const velocities = [];

  for (let i = 0; i < entityCount; i++) {
    // Initialize storage
    posStorage[i * 3] = Math.random();
    posStorage[i * 3 + 1] = Math.random();
    posStorage[i * 3 + 2] = Math.random();

    velStorage[i * 3] = Math.random();
    velStorage[i * 3 + 1] = Math.random();
    velStorage[i * 3 + 2] = Math.random();

    // Create wrappers
    positions.push(new Position(posStorage, i));
    velocities.push(new Velocity(velStorage, i));
  }

  if (verbose) {
    console.log(`  Setup: ${entityCount} hybrid entities created`);
  }

  // Force GC before test
  if (global.gc) {
    global.gc();
  }

  const heapBefore = process.memoryUsage().heapUsed;
  const startTime = performance.now();

  // Benchmark: Movement system simulation (hybrid style)
  for (let iter = 0; iter < iterations; iter++) {
    const dt = 0.016; // 16ms frame time

    // Access through object API (with getter/setter overhead)
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
  const gcAllocations = entityCount * 2; // Wrapper objects

  if (verbose) {
    console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Time per iteration: ${timePerIteration.toFixed(3)}ms`);
    console.log(`  Heap growth: ${(heapGrowth / 1024 / 1024).toFixed(2)}MB`);
  }

  return {
    name: 'Hybrid (Objects + Typed Arrays)',
    entityCount,
    iterations,
    totalTime,
    timePerIteration,
    heapGrowth,
    gcAllocations
  };
}
