/**
 * Parser Test Corpus Tests
 * Epic 3.14 Phase 3 - Task 2
 *
 * Verifies test corpus and utilities
 */

import { describe, it, expect } from 'vitest';
import { loadCorpus, getCorpusStats, generateFuzzCases, measurePerformance } from './helpers/ParserTestUtils';

describe('Parser Test Corpus', () => {
  describe('Corpus Loading', () => {
    it('should load test shaders', () => {
      const shaders = loadCorpus();
      expect(shaders.length).toBeGreaterThan(0);
    });

    it('should load shaders from all categories', () => {
      const shaders = loadCorpus();
      const categories = new Set(shaders.map(s => s.category));

      expect(categories.has('simple')).toBe(true);
      expect(categories.has('edge-cases')).toBe(true);
      expect(categories.has('invalid')).toBe(true);
    });

    it('should include shader metadata', () => {
      const shaders = loadCorpus();
      const shader = shaders[0];

      expect(shader).toHaveProperty('name');
      expect(shader).toHaveProperty('category');
      expect(shader).toHaveProperty('source');
      expect(shader).toHaveProperty('size');
      expect(shader.source.length).toBe(shader.size);
    });
  });

  describe('Corpus Statistics', () => {
    it('should calculate corpus statistics', () => {
      const shaders = loadCorpus();
      const stats = getCorpusStats(shaders);

      expect(stats.total).toBe(shaders.length);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.averageSize).toBeGreaterThan(0);
      expect(stats.minSize).toBeGreaterThan(0);
      expect(stats.maxSize).toBeGreaterThanOrEqual(stats.minSize);
    });

    it('should count shaders by category', () => {
      const shaders = loadCorpus();
      const stats = getCorpusStats(shaders);

      expect(stats.byCategory.simple).toBeGreaterThan(0);
      expect(stats.byCategory['edge-cases']).toBeGreaterThan(0);
      expect(stats.byCategory.invalid).toBeGreaterThan(0);
    });
  });

  describe('Performance Measurement', () => {
    it('should measure parse performance', () => {
      const source = '@group(0) @binding(0) var<uniform> data: vec4f;';

      const metrics = measurePerformance('test-shader', source, (src) => {
        // Simulate parsing
        return src.split(' ');
      });

      expect(metrics.shaderName).toBe('test-shader');
      expect(metrics.parseTime).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryBefore).toBeGreaterThan(0);
      expect(metrics.memoryAfter).toBeGreaterThan(0);
    });
  });

  describe('Fuzz Test Generation', () => {
    it('should generate fuzz cases by mutating valid shaders', () => {
      const shaders = loadCorpus();
      const cases = generateFuzzCases(42, shaders, 5);

      expect(cases).toHaveLength(5);
      cases.forEach(c => {
        expect(c.length).toBeGreaterThan(0);
      });
    });

    it('should generate consistent results with same seed', () => {
      const shaders = loadCorpus();
      const cases1 = generateFuzzCases(123, shaders, 3);
      const cases2 = generateFuzzCases(123, shaders, 3);

      expect(cases1).toEqual(cases2);
    });

    it('should generate different results with different seeds', () => {
      const shaders = loadCorpus();
      const cases1 = generateFuzzCases(111, shaders, 3);
      const cases2 = generateFuzzCases(222, shaders, 3);

      expect(cases1).not.toEqual(cases2);
    });

    it('should produce mutations different from original', () => {
      const shaders = loadCorpus();
      const cases = generateFuzzCases(999, shaders, 5);

      // At least some mutations should differ from originals
      const hasDifferences = cases.some(mutated =>
        !shaders.some(s => s.source === mutated)
      );
      expect(hasDifferences).toBe(true);
    });
  });

  describe('Shader Content Validation', () => {
    it('should load valid simple shaders', () => {
      const shaders = loadCorpus();
      const simpleShaders = shaders.filter(s => s.category === 'simple');

      expect(simpleShaders.length).toBeGreaterThan(0);

      // At least one shader should have bind groups
      const hasBindGroups = simpleShaders.some(s =>
        s.source.includes('@group') && s.source.includes('@binding')
      );
      expect(hasBindGroups).toBe(true);
    });

    it('should load edge case shaders', () => {
      const shaders = loadCorpus();
      const edgeCases = shaders.filter(s => s.category === 'edge-cases');

      expect(edgeCases.length).toBeGreaterThan(0);
    });

    it('should load invalid shaders for error testing', () => {
      const shaders = loadCorpus();
      const invalidShaders = shaders.filter(s => s.category === 'invalid');

      expect(invalidShaders.length).toBeGreaterThan(0);
    });
  });

  describe('Coverage of WGSL Features', () => {
    it('should include uniform buffers', () => {
      const shaders = loadCorpus();
      const hasUniform = shaders.some(s => s.source.includes('var<uniform>'));
      expect(hasUniform).toBe(true);
    });

    it('should include storage buffers', () => {
      const shaders = loadCorpus();
      const hasStorage = shaders.some(s => s.source.includes('var<storage>'));
      expect(hasStorage).toBe(true);
    });

    it('should include texture sampling', () => {
      const shaders = loadCorpus();
      const hasTexture = shaders.some(s => s.source.includes('texture_2d') || s.source.includes('sampler'));
      expect(hasTexture).toBe(true);
    });

    it('should include vertex attributes', () => {
      const shaders = loadCorpus();
      const hasAttributes = shaders.some(s => s.source.includes('@location'));
      expect(hasAttributes).toBe(true);
    });

    it('should include multiple bind groups', () => {
      const shaders = loadCorpus();
      const hasMultipleGroups = shaders.some(s => {
        return s.source.includes('@group(0)') && s.source.includes('@group(1)');
      });
      expect(hasMultipleGroups).toBe(true);
    });

    it('should include comments', () => {
      const shaders = loadCorpus();
      const hasComments = shaders.some(s => s.source.includes('//') || s.source.includes('/*'));
      expect(hasComments).toBe(true);
    });
  });
});
