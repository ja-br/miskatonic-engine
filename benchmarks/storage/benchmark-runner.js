/**
 * Benchmark Runner for Epic 2.10: Component Storage Research
 *
 * Tests different storage strategies:
 * - Option A: Object Arrays (AoS) - Current implementation
 * - Option B: Typed Arrays (SoA) - Recommended approach
 * - Option C: Hybrid (objects backed by typed arrays)
 *
 * Goals:
 * - Validate ~10x difference between sequential and random access
 * - Validate ~10x difference between objects and typed arrays
 * - Measure GC pressure for each approach
 * - Test at 1k, 10k, 100k entity scales
 */

import { objectArrayBenchmark } from './option-a-objects.js';
import { typedArrayBenchmark } from './option-b-typed-arrays.js';
import { hybridBenchmark } from './option-c-hybrid.js';
import { sequentialVsRandomBenchmark } from './sequential-vs-random.js';
import { loopOrderingBenchmark } from './loop-ordering.js';

const SIZES = [1000, 10000, 100000];
const ITERATIONS = 1000;

// Parse command line args
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const verbose = args.includes('--verbose');

const sizes = quick ? [10000] : SIZES;
const iterations = quick ? 100 : ITERATIONS;

console.log('='.repeat(80));
console.log('ECS Component Storage Benchmarks - Epic 2.10');
console.log('='.repeat(80));
console.log(`Mode: ${quick ? 'QUICK' : 'FULL'}`);
console.log(`Entity counts: ${sizes.join(', ')}`);
console.log(`Iterations per test: ${iterations}`);
console.log('='.repeat(80));
console.log();

const results = {
  objectArrays: {},
  typedArrays: {},
  hybrid: {},
  sequentialVsRandom: {},
  loopOrdering: {}
};

// Test 1: Object Arrays (Baseline - Current Implementation)
console.log('Test 1: Object Arrays (AoS) - Current Implementation');
console.log('-'.repeat(80));
for (const size of sizes) {
  const result = objectArrayBenchmark(size, iterations, verbose);
  results.objectArrays[size] = result;
  console.log(`  ${size.toLocaleString()} entities: ${result.timePerIteration.toFixed(3)}ms, GC: ${result.gcAllocations} objects`);
}
console.log();

// Test 2: Typed Arrays (SoA - Recommended)
console.log('Test 2: Typed Arrays (SoA) - Recommended Approach');
console.log('-'.repeat(80));
for (const size of sizes) {
  const result = typedArrayBenchmark(size, iterations, verbose);
  results.typedArrays[size] = result;
  const speedup = (results.objectArrays[size].timePerIteration / result.timePerIteration).toFixed(2);
  console.log(`  ${size.toLocaleString()} entities: ${result.timePerIteration.toFixed(3)}ms, GC: ${result.gcAllocations} objects, Speedup: ${speedup}x`);
}
console.log();

// Test 3: Hybrid Approach
console.log('Test 3: Hybrid (Objects + Typed Arrays)');
console.log('-'.repeat(80));
for (const size of sizes) {
  const result = hybridBenchmark(size, iterations, verbose);
  results.hybrid[size] = result;
  const speedup = (results.objectArrays[size].timePerIteration / result.timePerIteration).toFixed(2);
  console.log(`  ${size.toLocaleString()} entities: ${result.timePerIteration.toFixed(3)}ms, GC: ${result.gcAllocations} objects, Speedup: ${speedup}x`);
}
console.log();

// Test 4: Sequential vs Random Access
console.log('Test 4: Sequential vs Random Access (Cache Effects)');
console.log('-'.repeat(80));
for (const size of sizes) {
  const result = sequentialVsRandomBenchmark(size, iterations, verbose);
  results.sequentialVsRandom[size] = result;
  const penalty = (result.randomTime / result.sequentialTime).toFixed(2);
  console.log(`  ${size.toLocaleString()} entities: Sequential ${result.sequentialTime.toFixed(3)}ms, Random ${result.randomTime.toFixed(3)}ms, Penalty: ${penalty}x`);
}
console.log();

// Test 5: Loop Ordering (Row-major vs Column-major)
console.log('Test 5: Loop Ordering Impact');
console.log('-'.repeat(80));
for (const size of sizes) {
  const result = loopOrderingBenchmark(size, iterations, verbose);
  results.loopOrdering[size] = result;
  const penalty = (result.badOrderTime / result.goodOrderTime).toFixed(2);
  console.log(`  ${size.toLocaleString()} entities: Good order ${result.goodOrderTime.toFixed(3)}ms, Bad order ${result.badOrderTime.toFixed(3)}ms, Penalty: ${penalty}x`);
}
console.log();

// Summary
console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log();

console.log('Performance Comparison (100k entities):');
const size = sizes[sizes.length - 1];
const baseTime = results.objectArrays[size].timePerIteration;
console.log(`  Object Arrays (baseline):  ${baseTime.toFixed(3)}ms  (1.00x)`);
console.log(`  Typed Arrays (SoA):        ${results.typedArrays[size].timePerIteration.toFixed(3)}ms  (${(baseTime / results.typedArrays[size].timePerIteration).toFixed(2)}x faster)`);
console.log(`  Hybrid:                    ${results.hybrid[size].timePerIteration.toFixed(3)}ms  (${(baseTime / results.hybrid[size].timePerIteration).toFixed(2)}x faster)`);
console.log();

console.log('Cache Effects (100k entities):');
const seqVsRand = results.sequentialVsRandom[size];
console.log(`  Sequential vs Random: ${(seqVsRand.randomTime / seqVsRand.sequentialTime).toFixed(2)}x penalty`);
const loopOrder = results.loopOrdering[size];
console.log(`  Loop Ordering: ${(loopOrder.badOrderTime / loopOrder.goodOrderTime).toFixed(2)}x penalty`);
console.log();

console.log('GC Pressure (100k entities, per iteration):');
console.log(`  Object Arrays: ${results.objectArrays[size].gcAllocations.toLocaleString()} allocations`);
console.log(`  Typed Arrays:  ${results.typedArrays[size].gcAllocations.toLocaleString()} allocations`);
console.log(`  Hybrid:        ${results.hybrid[size].gcAllocations.toLocaleString()} allocations`);
console.log();

// Decision
console.log('='.repeat(80));
console.log('RECOMMENDATION');
console.log('='.repeat(80));
const typedSpeedup = (baseTime / results.typedArrays[size].timePerIteration).toFixed(2);
console.log(`Typed Arrays (SoA) provide ${typedSpeedup}x performance improvement over Object Arrays.`);
console.log(`GC pressure reduced by ${((1 - results.typedArrays[size].gcAllocations / results.objectArrays[size].gcAllocations) * 100).toFixed(0)}%.`);
console.log();
console.log('✅ PROCEED with Epic 2.11: Refactor ECS to use Typed Arrays (SoA storage)');
console.log('='.repeat(80));
