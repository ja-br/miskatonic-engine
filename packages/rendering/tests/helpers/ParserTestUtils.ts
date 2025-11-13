/**
 * Parser Test Utilities
 * Epic 3.14 Phase 3 - Task 2
 *
 * Utilities for testing WGSL parsers with test corpus
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface TestShader {
  name: string;
  category: 'simple' | 'complex' | 'edge-cases' | 'invalid';
  source: string;
  size: number;
}

export interface PerformanceMetrics {
  shaderName: string;
  parseTime: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryUsed: number;
}

/**
 * Load all test shaders from the corpus
 */
export function loadCorpus(): TestShader[] {
  const corpusDir = join(__dirname, '../fixtures/wgsl-corpus');
  const categories: Array<'simple' | 'complex' | 'edge-cases' | 'invalid'> = [
    'simple',
    'complex',
    'edge-cases',
    'invalid',
  ];

  const shaders: TestShader[] = [];

  for (const category of categories) {
    const categoryDir = join(corpusDir, category);
    try {
      const files = readdirSync(categoryDir).filter(f => f.endsWith('.wgsl'));

      for (const file of files) {
        const filePath = join(categoryDir, file);
        const source = readFileSync(filePath, 'utf-8');

        shaders.push({
          name: file.replace('.wgsl', ''),
          category,
          source,
          size: source.length,
        });
      }
    } catch (error) {
      // Directory might not exist, skip
      console.warn(`Could not load shaders from ${category}:`, error);
    }
  }

  return shaders;
}

/**
 * Measure parser performance
 */
export function measurePerformance<T>(
  shaderName: string,
  source: string,
  parseFunction: (source: string) => T
): PerformanceMetrics {
  const memoryBefore = process.memoryUsage().heapUsed;
  const start = performance.now();

  parseFunction(source);

  const parseTime = performance.now() - start;
  const memoryAfter = process.memoryUsage().heapUsed;

  return {
    shaderName,
    parseTime,
    memoryBefore,
    memoryAfter,
    memoryUsed: memoryAfter - memoryBefore,
  };
}

/**
 * Generate fuzz test cases by mutating valid shaders
 * NOTE: This is a simple mutation-based fuzzer. For production use,
 * consider integrating a coverage-guided fuzzer like jsfuzz.
 */
export function generateFuzzCases(seed: number, validShaders: TestShader[], count: number = 10): string[] {
  const cases: string[] = [];
  const rng = seededRandom(seed);

  for (let i = 0; i < count; i++) {
    // Pick a random valid shader to mutate
    const baseShader = validShaders[Math.floor(rng() * validShaders.length)];
    let mutated = baseShader.source;

    // Apply random mutations
    const mutationCount = Math.floor(rng() * 3) + 1;
    for (let j = 0; j < mutationCount; j++) {
      const mutationType = Math.floor(rng() * 4);

      switch (mutationType) {
        case 0: // Delete random character
          if (mutated.length > 1) {
            const pos = Math.floor(rng() * mutated.length);
            mutated = mutated.slice(0, pos) + mutated.slice(pos + 1);
          }
          break;
        case 1: // Insert random character
          const pos = Math.floor(rng() * mutated.length);
          const chars = 'abcdefghijklmnopqrstuvwxyz0123456789<>(){}[];,.:';
          mutated = mutated.slice(0, pos) + chars[Math.floor(rng() * chars.length)] + mutated.slice(pos);
          break;
        case 2: // Flip random character
          if (mutated.length > 0) {
            const pos = Math.floor(rng() * mutated.length);
            const newChar = String.fromCharCode(mutated.charCodeAt(pos) ^ 1);
            mutated = mutated.slice(0, pos) + newChar + mutated.slice(pos + 1);
          }
          break;
        case 3: // Duplicate random substring
          if (mutated.length > 10) {
            const start = Math.floor(rng() * (mutated.length - 10));
            const length = Math.floor(rng() * 10) + 1;
            const substring = mutated.slice(start, start + length);
            const insertPos = Math.floor(rng() * mutated.length);
            mutated = mutated.slice(0, insertPos) + substring + mutated.slice(insertPos);
          }
          break;
      }
    }

    cases.push(mutated);
  }

  return cases;
}

/**
 * Seeded random number generator (LCG)
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

/**
 * Compare ASTs for equality
 * Note: This is a placeholder - actual implementation would depend on AST structure
 */
export function compareAST(a: any, b: any): boolean {
  // Deep equality check
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Extract statistics from corpus
 */
export function getCorpusStats(shaders: TestShader[]) {
  const stats = {
    total: shaders.length,
    byCategory: {
      simple: shaders.filter(s => s.category === 'simple').length,
      complex: shaders.filter(s => s.category === 'complex').length,
      'edge-cases': shaders.filter(s => s.category === 'edge-cases').length,
      invalid: shaders.filter(s => s.category === 'invalid').length,
    },
    totalSize: shaders.reduce((sum, s) => sum + s.size, 0),
    averageSize: shaders.length > 0
      ? Math.round(shaders.reduce((sum, s) => sum + s.size, 0) / shaders.length)
      : 0,
    minSize: shaders.length > 0
      ? Math.min(...shaders.map(s => s.size))
      : 0,
    maxSize: shaders.length > 0
      ? Math.max(...shaders.map(s => s.size))
      : 0,
  };

  return stats;
}
