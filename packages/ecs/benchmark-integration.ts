/**
 * Epic 2.11 Integration Benchmark
 *
 * Tests the actual refactored ECS implementation (ArchetypeManager + ComponentStorage)
 * to validate that production code achieves the expected 4.16x speedup from Epic 2.10.
 *
 * This benchmarks the REAL code, not standalone test implementations.
 */

import { ArchetypeManager } from './src/Archetype';
import { ComponentRegistry } from './src/ComponentRegistry';
import { createFieldDescriptor } from './src/ComponentStorage';
import type { ComponentType } from './src/types';

// Test component types
class Transform {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class Velocity {
  constructor(vx = 0, vy = 0, vz = 0) {
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
  }
}

// Register components
ComponentRegistry.register(Transform, [
  createFieldDescriptor('x', 0),
  createFieldDescriptor('y', 0),
  createFieldDescriptor('z', 0),
]);

ComponentRegistry.register(Velocity, [
  createFieldDescriptor('vx', 0),
  createFieldDescriptor('vy', 0),
  createFieldDescriptor('vz', 0),
]);

function benchmark(entityCount, iterations) {
  const manager = new ArchetypeManager();
  const archetype = manager.getOrCreateArchetype([Transform, Velocity]);

  // Setup: Add entities
  console.log(`  Setting up ${entityCount.toLocaleString()} entities...`);
  for (let i = 0; i < entityCount; i++) {
    manager.addEntity(
      archetype,
      i,
      new Map([
        [Transform, new Transform(i, i * 2, i * 3)],
        [Velocity, new Velocity(i * 0.1, i * 0.2, i * 0.3)],
      ])
    );
  }

  // Warmup
  for (let i = 0; i < 10; i++) {
    for (let idx = 0; idx < archetype.count; idx++) {
      const transform = manager.getComponent(archetype, Transform, idx);
      const velocity = manager.getComponent(archetype, Velocity, idx);
      transform.x += velocity.vx;
      transform.y += velocity.vy;
      transform.z += velocity.vz;
    }
  }

  // Benchmark: Component iteration (typical system update pattern)
  console.log(`  Running ${iterations} iterations...`);

  // Force GC before measurement
  if (global.gc) {
    global.gc();
  }

  const startTime = performance.now();
  const startMem = process.memoryUsage().heapUsed;

  for (let iter = 0; iter < iterations; iter++) {
    // Typical system pattern: iterate all entities, read components, update positions
    for (let idx = 0; idx < archetype.count; idx++) {
      const transform = manager.getComponent(archetype, Transform, idx);
      const velocity = manager.getComponent(archetype, Velocity, idx);

      // Simulate physics update
      transform.x += velocity.vx * 0.016;
      transform.y += velocity.vy * 0.016;
      transform.z += velocity.vz * 0.016;
    }
  }

  const endTime = performance.now();
  const endMem = process.memoryUsage().heapUsed;

  const totalTime = endTime - startTime;
  const timePerIteration = totalTime / iterations;
  const componentsPerMs = (entityCount * 2) / timePerIteration; // 2 components per entity
  const memDelta = Math.max(0, endMem - startMem);

  return {
    entityCount,
    iterations,
    totalTime,
    timePerIteration,
    componentsPerMs,
    memoryDelta: memDelta,
  };
}

console.log('='.repeat(80));
console.log('Epic 2.11: ECS Integration Benchmark');
console.log('Testing actual refactored ArchetypeManager + ComponentStorage');
console.log('='.repeat(80));
console.log();

const SIZES = [1000, 10000, 100000];
const ITERATIONS = 1000;

const results = {};

for (const size of SIZES) {
  console.log(`Testing ${size.toLocaleString()} entities:`);
  const result = benchmark(size, ITERATIONS);
  results[size] = result;

  console.log(`  Time per iteration: ${result.timePerIteration.toFixed(3)}ms`);
  console.log(`  Components/ms: ${result.componentsPerMs.toFixed(0)}`);
  console.log(`  Memory delta: ${(result.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
  console.log();
}

// Summary
console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log();

console.log('Performance at scale:');
for (const size of SIZES) {
  const result = results[size];
  console.log(`  ${size.toLocaleString().padStart(7)} entities: ${result.timePerIteration.toFixed(3)}ms/iter, ${result.componentsPerMs.toFixed(0)} components/ms`);
}
console.log();

// Validation against Epic 2.10 targets
const target100k = results[100000];
console.log('Epic 2.10 Validation (100k entities):');
console.log(`  Measured: ${target100k.componentsPerMs.toFixed(0)} components/ms`);
console.log(`  Epic 2.10 target: >100,000 components/ms`);
console.log(`  Epic 2.10 actual: 680,000 components/ms (standalone benchmark)`);
console.log();

if (target100k.componentsPerMs > 100000) {
  console.log('✅ VALIDATION PASSED: Exceeds minimum target (100k components/ms)');
} else {
  console.log('❌ VALIDATION FAILED: Below minimum target');
}
console.log();

// Note about comparison
console.log('NOTE: This benchmarks the integrated ECS (ArchetypeManager + ComponentStorage).');
console.log('Epic 2.10 benchmarked standalone storage implementations.');
console.log('Production code includes additional overhead (entity ID lookup, archetype traversal).');
console.log('Expected: ~100-200k components/ms (vs 680k in standalone benchmark)');
console.log('='.repeat(80));
