/**
 * Parser Performance Baseline
 * Epic 3.14 Phase 3 - Task 0
 *
 * Measures current regex parser performance to establish baseline
 * before implementing new tokenizer/AST-based parser.
 */

import { describe, it, expect } from 'vitest';
import { WGSLReflectionParser } from '../../src/ShaderReflection';
import { readFileSync } from 'fs';
import { join } from 'path';

interface BenchmarkResult {
  shader: string;
  size: number;
  parseTime: number;
  memoryBefore: number;
  memoryAfter: number;
  bindGroupCount: number;
  attributeCount: number;
}

describe('Parser Performance Baseline', () => {
  const parser = new WGSLReflectionParser();
  const results: BenchmarkResult[] = [];

  // Load all project WGSL shaders
  const shaderFiles = [
    '../../src/highlevel/shaders/builtins.ts', // Contains 5 WGSL shaders
    '../../src/shaders/shadow-advanced.wgsl',
    '../../src/shaders/light-culling.wgsl',
    '../../src/shaders/shadow-map-common.wgsl',
    '../../../renderer/src/shaders/multi-light.wgsl',
    '../../../renderer/src/shaders/basic-lighting.wgsl',
    '../../../renderer/src/shaders/basic-lighting_instanced.wgsl',
  ];

  const loadShader = (path: string): { name: string; source: string }[] => {
    const fullPath = join(__dirname, path);
    const content = readFileSync(fullPath, 'utf-8');

    // If it's a .ts file, extract WGSL strings
    if (path.endsWith('.ts')) {
      const shaders: { name: string; source: string }[] = [];
      const regex = /export const (\w+)_SHADER = \/\* wgsl \*\/ `([\s\S]*?)`;/g;
      let match;

      while ((match = regex.exec(content)) !== null) {
        shaders.push({
          name: match[1].toLowerCase(),
          source: match[2],
        });
      }

      return shaders;
    }

    // Direct WGSL file
    return [
      {
        name: path.split('/').pop()!.replace('.wgsl', ''),
        source: content,
      },
    ];
  };

  const measureParse = (name: string, source: string, iterations: number = 100): BenchmarkResult => {
    // Force GC before measurement if available
    if (global.gc) {
      global.gc();
    }

    const memoryBefore = process.memoryUsage().heapUsed;
    const times: number[] = [];

    // Run multiple iterations to get reliable timing
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const reflection = parser.parse(source);
      const parseTime = performance.now() - start;
      times.push(parseTime);

      // Keep reference to prevent GC of result
      if (i === 0) {
        // Store first result for validation
        results.push({
          shader: name,
          size: source.length,
          parseTime: 0, // Will be updated with median
          memoryBefore,
          memoryAfter: 0, // Will be updated
          bindGroupCount: reflection.bindGroupLayouts.length,
          attributeCount: reflection.attributes.length,
        });
      }
    }

    if (global.gc) {
      global.gc();
    }
    const memoryAfter = process.memoryUsage().heapUsed;

    // Use median time to filter GC spikes
    times.sort((a, b) => a - b);
    const medianTime = times[Math.floor(times.length / 2)];

    const lastResult = results[results.length - 1];
    lastResult.parseTime = medianTime;
    lastResult.memoryAfter = memoryAfter;

    return lastResult;
  };

  it('should measure regex parser baseline performance', () => {
    const allShaders: { name: string; source: string }[] = [];

    // Load all shaders
    for (const file of shaderFiles) {
      try {
        const shaders = loadShader(file);
        allShaders.push(...shaders);
      } catch (error) {
        console.warn(`Could not load ${file}:`, error);
      }
    }

    expect(allShaders.length).toBeGreaterThan(0);

    // Warm up JIT (20 iterations)
    for (let i = 0; i < 20; i++) {
      for (const { source } of allShaders) {
        parser.parse(source);
      }
    }

    // Measure each shader (100 iterations per shader for reliable stats)
    for (const { name, source } of allShaders) {
      measureParse(name, source, 100);

      // Individual shader targets (median of 100 runs)
      const result = results[results.length - 1];
      expect(result.parseTime).toBeLessThan(10); // <10ms median per shader
    }

    // Calculate statistics across all shaders
    const parseTimes = results.map(r => r.parseTime);
    const sortedTimes = [...parseTimes].sort((a, b) => a - b);
    const average = parseTimes.reduce((a, b) => a + b, 0) / parseTimes.length;
    const median = sortedTimes[Math.floor(sortedTimes.length / 2)];
    const max = sortedTimes[sortedTimes.length - 1];

    console.log('\n=== Parser Performance Baseline ===');
    console.log(`Shaders tested: ${results.length}`);
    console.log(`Iterations per shader: 100`);
    console.log(`Average parse time: ${average.toFixed(3)}ms`);
    console.log(`Median parse time: ${median.toFixed(3)}ms`);
    console.log(`Max parse time: ${max.toFixed(3)}ms`);
    console.log('===================================\n');

    // Save baseline to file
    const baseline = {
      date: new Date().toISOString(),
      parser: 'regex',
      shaderCount: results.length,
      iterationsPerShader: 100,
      stats: {
        average,
        median,
        min: Math.min(...parseTimes),
        max,
      },
      results,
    };

    // Note: In real implementation, would write to file
    // writeFileSync(join(__dirname, 'baseline.json'), JSON.stringify(baseline, null, 2));

    // Performance targets (median across 100 iterations per shader)
    expect(median).toBeLessThan(5); // Current: <5ms median
    expect(max).toBeLessThan(10); // Current: <10ms max
  });

  it('should handle large shaders', () => {
    // Create a synthetic large shader (100KB)
    const largeShader = `
      struct Data {
        values: array<vec4f, 1000>
      };

      @group(0) @binding(0) var<storage> data: Data;

      ${Array(500)
        .fill(0)
        .map(
          (_, i) => `
      @compute @workgroup_size(64)
      fn compute${i}() {
        let val = data.values[0];
      }
      `
        )
        .join('\n')}
    `;

    const memoryBefore = process.memoryUsage().heapUsed;
    const start = performance.now();

    const reflection = parser.parse(largeShader);

    const parseTime = performance.now() - start;
    const memoryAfter = process.memoryUsage().heapUsed;

    console.log(`\nLarge shader (${largeShader.length} bytes):`);
    console.log(`Parse time: ${parseTime.toFixed(3)}ms`);
    console.log(`Memory used: ${((memoryAfter - memoryBefore) / 1024 / 1024).toFixed(2)}MB`);

    expect(parseTime).toBeLessThan(50); // Large shaders: <50ms
    expect(memoryAfter - memoryBefore).toBeLessThan(10 * 1024 * 1024); // <10MB
    expect(reflection).toBeDefined();
  });

  it('should handle malformed shaders gracefully', () => {
    const malformedShaders = [
      '// Empty shader',
      '@group(0) @binding(', // Incomplete
      '@group(999) @binding(999) var data: u32;', // Valid but unusual
      '/* Nested /* comment */ */', // Nested comment
      '@group(0) @binding(0) var<uniform> data: vec4f; // Comment',
    ];

    for (const shader of malformedShaders) {
      const start = performance.now();

      try {
        parser.parse(shader);
      } catch (error) {
        // Expected to fail
      }

      const parseTime = performance.now() - start;

      // Should fail fast
      expect(parseTime).toBeLessThan(5);
    }
  });

  it('should report baseline summary', () => {
    expect(results.length).toBeGreaterThan(0);

    const totalSize = results.reduce((sum, r) => sum + r.size, 0);
    const totalTime = results.reduce((sum, r) => sum + r.parseTime, 0);

    console.log('\n=== Baseline Summary ===');
    console.log(`Total shaders: ${results.length}`);
    console.log(`Total size: ${(totalSize / 1024).toFixed(2)}KB`);
    console.log(`Total time: ${totalTime.toFixed(3)}ms`);
    console.log(`Throughput: ${((totalSize / 1024) / (totalTime / 1000)).toFixed(2)}KB/s`);
    console.log('========================\n');
  });
});
