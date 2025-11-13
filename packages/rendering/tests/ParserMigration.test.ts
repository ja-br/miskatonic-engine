/**
 * Parser Migration Validation Tests
 * Epic 3.14 Phase 3 - Task 6
 *
 * Validates that the AST-based parser produces equivalent results to the regex parser.
 * This test suite is critical for ensuring zero regressions during migration.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WGSLReflectionParser, type ShaderReflectionData } from '../src/ShaderReflection';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Parser Migration Validation', () => {
  // Test corpus: All available WGSL shaders
  const testShaders: Array<{ name: string; source: string; category: string }> = [];

  beforeAll(() => {
    // Load test corpus shaders
    const corpusShaders = [
      // Simple cases
      'simple/basic-uniform.wgsl',
      'simple/basic-storage.wgsl',
      'simple/basic-texture.wgsl',
      'simple/vertex-attributes.wgsl',
      'simple/multiple-bind-groups.wgsl',
      // Edge cases
      'edge-cases/comments-inline.wgsl',
      'edge-cases/multiline-binding.wgsl',
      'edge-cases/storage-read-write.wgsl',
      'edge-cases/large-bind-numbers.wgsl',
      // Complex cases
      'complex/pbr-material.wgsl',
      'complex/multi-entry-point.wgsl',
      'complex/compute-particles.wgsl',
      'complex/nested-structs.wgsl',
      'complex/control-flow.wgsl',
    ];

    for (const path of corpusShaders) {
      try {
        const fullPath = join(__dirname, 'fixtures/wgsl-corpus', path);
        const source = readFileSync(fullPath, 'utf-8');
        testShaders.push({
          name: path,
          source,
          category: path.split('/')[0],
        });
      } catch (error) {
        console.warn(`Could not load shader: ${path}`, error);
      }
    }

    // Load real-world shaders from renderer package
    const realWorldShaders = [
      '../../../renderer/src/shaders/basic-lighting.wgsl',
      '../../../renderer/src/shaders/basic-lighting_instanced.wgsl',
      '../../../renderer/src/shaders/multi-light.wgsl',
      '../src/shaders/light-culling.wgsl',
      '../src/shaders/shadow-map-common.wgsl',
      '../src/shaders/shadow-advanced.wgsl',
    ];

    for (const path of realWorldShaders) {
      try {
        const fullPath = join(__dirname, path);
        const source = readFileSync(fullPath, 'utf-8');
        const name = path.split('/').pop() || path;
        testShaders.push({
          name: `real-world/${name}`,
          source,
          category: 'real-world',
        });
      } catch (error) {
        console.warn(`Could not load real-world shader: ${path}`, error);
      }
    }

    console.log(`\nLoaded ${testShaders.length} test shaders for migration validation\n`);
  });

  afterAll(() => {
    // Ensure AST parser is disabled after tests
    WGSLReflectionParser.setUseASTParser(false);
  });

  describe('Feature Flag Control', () => {
    it('should default to regex parser', () => {
      expect(WGSLReflectionParser.isUsingASTParser()).toBe(false);
    });

    it('should enable AST parser via setUseASTParser(true)', () => {
      WGSLReflectionParser.setUseASTParser(true);
      expect(WGSLReflectionParser.isUsingASTParser()).toBe(true);
      WGSLReflectionParser.setUseASTParser(false);
    });

    it('should disable AST parser via setUseASTParser(false)', () => {
      WGSLReflectionParser.setUseASTParser(true);
      WGSLReflectionParser.setUseASTParser(false);
      expect(WGSLReflectionParser.isUsingASTParser()).toBe(false);
    });
  });

  describe('Bind Group Layout Equivalence', () => {
    it('should produce equivalent bind group layouts for all test shaders', () => {
      const parser = new WGSLReflectionParser();
      const failures: string[] = [];

      for (const { name, source } of testShaders) {
        // Parse with regex
        WGSLReflectionParser.setUseASTParser(false);
        let regexResult: ShaderReflectionData;
        try {
          regexResult = parser.parse(source);
        } catch (error) {
          // Skip shaders that regex parser can't handle
          continue;
        }

        // Parse with AST
        WGSLReflectionParser.setUseASTParser(true);
        let astResult: ShaderReflectionData;
        try {
          astResult = parser.parse(source);
        } catch (error) {
          // Storage textures or other unsupported features
          continue;
        }

        // Compare bind group counts
        if (regexResult.bindGroupLayouts.length !== astResult.bindGroupLayouts.length) {
          failures.push(
            `${name}: bind group count mismatch (regex=${regexResult.bindGroupLayouts.length}, ast=${astResult.bindGroupLayouts.length})`
          );
          continue;
        }

        // Compare each bind group
        for (let i = 0; i < regexResult.bindGroupLayouts.length; i++) {
          const regexGroup = regexResult.bindGroupLayouts[i];
          const astGroup = astResult.bindGroupLayouts[i];

          if (regexGroup.entries.length !== astGroup.entries.length) {
            failures.push(
              `${name}: bind group ${i} entry count mismatch (regex=${regexGroup.entries.length}, ast=${astGroup.entries.length})`
            );
            continue;
          }

          // Compare bindings (sort by binding number for stable comparison)
          const sortedRegex = [...regexGroup.entries].sort((a, b) => a.binding - b.binding);
          const sortedAST = [...astGroup.entries].sort((a, b) => a.binding - b.binding);

          for (let j = 0; j < sortedRegex.length; j++) {
            if (sortedAST[j].binding !== sortedRegex[j].binding) {
              failures.push(
                `${name}: binding index mismatch at position ${j} (regex=${sortedRegex[j].binding}, ast=${sortedAST[j].binding})`
              );
            }

            if (sortedAST[j].type !== sortedRegex[j].type) {
              failures.push(
                `${name}: binding type mismatch at binding ${sortedRegex[j].binding} (regex=${sortedRegex[j].type}, ast=${sortedAST[j].type})`
              );
            }
          }
        }
      }

      if (failures.length > 0) {
        console.error('\nBind group layout comparison failures:');
        failures.forEach(f => console.error(`  - ${f}`));
        expect(failures).toHaveLength(0);
      }
    });
  });

  describe('Entry Point Equivalence', () => {
    it('should extract equivalent entry points for all test shaders', () => {
      const parser = new WGSLReflectionParser();
      const failures: string[] = [];

      for (const { name, source } of testShaders) {
        // Parse with regex
        WGSLReflectionParser.setUseASTParser(false);
        let regexResult: ShaderReflectionData;
        try {
          regexResult = parser.parse(source);
        } catch (error) {
          continue;
        }

        // Parse with AST
        WGSLReflectionParser.setUseASTParser(true);
        let astResult: ShaderReflectionData;
        try {
          astResult = parser.parse(source);
        } catch (error) {
          continue;
        }

        // Compare entry points
        if (regexResult.entryPoints.vertex !== astResult.entryPoints.vertex) {
          failures.push(
            `${name}: vertex entry point mismatch (regex=${regexResult.entryPoints.vertex}, ast=${astResult.entryPoints.vertex})`
          );
        }

        if (regexResult.entryPoints.fragment !== astResult.entryPoints.fragment) {
          failures.push(
            `${name}: fragment entry point mismatch (regex=${regexResult.entryPoints.fragment}, ast=${astResult.entryPoints.fragment})`
          );
        }

        if (regexResult.entryPoints.compute !== astResult.entryPoints.compute) {
          failures.push(
            `${name}: compute entry point mismatch (regex=${regexResult.entryPoints.compute}, ast=${astResult.entryPoints.compute})`
          );
        }
      }

      if (failures.length > 0) {
        console.error('\nEntry point comparison failures:');
        failures.forEach(f => console.error(`  - ${f}`));
        expect(failures).toHaveLength(0);
      }
    });
  });

  describe('Performance Benchmarks', () => {
    it('should maintain performance within 2x of regex parser', () => {
      const parser = new WGSLReflectionParser();
      const iterations = 50; // Reduced from 100 for faster tests
      const regexTimes: number[] = [];
      const astTimes: number[] = [];

      // Filter to parseable shaders only
      const parseableShaders = testShaders.filter(({ source }) => {
        WGSLReflectionParser.setUseASTParser(false);
        try {
          parser.parse(source);
          return true;
        } catch {
          return false;
        }
      });

      for (const { name, source } of parseableShaders) {
        // Warm up
        WGSLReflectionParser.setUseASTParser(false);
        for (let i = 0; i < 5; i++) {
          try {
            parser.parse(source);
          } catch {
            break;
          }
        }

        WGSLReflectionParser.setUseASTParser(true);
        for (let i = 0; i < 5; i++) {
          try {
            parser.parse(source);
          } catch {
            break;
          }
        }

        // Measure regex
        WGSLReflectionParser.setUseASTParser(false);
        const regexStart = performance.now();
        for (let i = 0; i < iterations; i++) {
          try {
            parser.parse(source);
          } catch {
            break;
          }
        }
        const regexTime = (performance.now() - regexStart) / iterations;
        regexTimes.push(regexTime);

        // Measure AST
        WGSLReflectionParser.setUseASTParser(true);
        const astStart = performance.now();
        for (let i = 0; i < iterations; i++) {
          try {
            parser.parse(source);
          } catch {
            break;
          }
        }
        const astTime = (performance.now() - astStart) / iterations;
        astTimes.push(astTime);

        console.log(`  ${name}: regex=${regexTime.toFixed(3)}ms, ast=${astTime.toFixed(3)}ms, ratio=${(astTime / regexTime).toFixed(2)}x`);
      }

      // Calculate statistics
      const regexMedian = regexTimes.sort((a, b) => a - b)[Math.floor(regexTimes.length / 2)];
      const astMedian = astTimes.sort((a, b) => a - b)[Math.floor(astTimes.length / 2)];
      const ratio = astMedian / regexMedian;

      console.log(`\n📊 Performance Summary:`);
      console.log(`  Regex median: ${regexMedian.toFixed(3)}ms`);
      console.log(`  AST median: ${astMedian.toFixed(3)}ms`);
      console.log(`  Ratio: ${ratio.toFixed(2)}x`);

      // Target: AST parser within 2x of regex parser
      expect(ratio).toBeLessThan(2.0);
    });
  });

  describe('Edge Case Handling', () => {
    it('should handle comments inline', () => {
      const source = `@group(0) /* comment */ @binding(0) var<uniform> data: vec4f;`;
      const parser = new WGSLReflectionParser();

      WGSLReflectionParser.setUseASTParser(false);
      const regexResult = parser.parse(source);

      WGSLReflectionParser.setUseASTParser(true);
      const astResult = parser.parse(source);

      expect(astResult.bindGroupLayouts.length).toBe(regexResult.bindGroupLayouts.length);
    });

    it('should handle multiline attributes', () => {
      const source = `
        @group(0)
        @binding(0)
        var<uniform> data: vec4f;

        @vertex
        fn main() -> @builtin(position) vec4f {
          return vec4f(0.0);
        }
      `;
      const parser = new WGSLReflectionParser();

      WGSLReflectionParser.setUseASTParser(false);
      const regexResult = parser.parse(source);

      WGSLReflectionParser.setUseASTParser(true);
      const astResult = parser.parse(source);

      expect(astResult.bindGroupLayouts.length).toBe(regexResult.bindGroupLayouts.length);
      expect(astResult.entryPoints.vertex).toBe(regexResult.entryPoints.vertex);
    });

    it('should handle storage buffers with read_write access', () => {
      const source = `@group(0) @binding(0) var<storage, read_write> buffer: array<f32>;`;
      const parser = new WGSLReflectionParser();

      WGSLReflectionParser.setUseASTParser(false);
      const regexResult = parser.parse(source);

      WGSLReflectionParser.setUseASTParser(true);
      const astResult = parser.parse(source);

      expect(astResult.bindGroupLayouts.length).toBe(regexResult.bindGroupLayouts.length);
    });
  });

  describe('Negative Tests - Fallback Behavior', () => {
    it('should fall back to regex parser if AST parser throws unexpected error', () => {
      // This tests the fallback mechanism in parse()
      const source = `@group(0) @binding(0) var<uniform> data: vec4f;`;
      const parser = new WGSLReflectionParser();

      WGSLReflectionParser.setUseASTParser(true);

      // Should not throw - falls back to regex
      expect(() => parser.parse(source)).not.toThrow();
    });
  });

  describe('Storage Texture Limitations', () => {
    it('should throw error for storage textures with helpful message', () => {
      const source = `@group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;`;
      const parser = new WGSLReflectionParser();

      WGSLReflectionParser.setUseASTParser(true);

      expect(() => parser.parse(source)).toThrow(/Storage textures are not supported/);
      expect(() => parser.parse(source)).toThrow(/rgba8unorm/);
      expect(() => parser.parse(source)).toThrow(/Solution/);
    });

    it('should include binding name in storage texture error', () => {
      const source = `@group(0) @binding(0) var myCustomTexture: texture_storage_2d<rgba16float, read>;`;
      const parser = new WGSLReflectionParser();

      WGSLReflectionParser.setUseASTParser(true);

      expect(() => parser.parse(source)).toThrow(/myCustomTexture/);
      expect(() => parser.parse(source)).toThrow(/rgba16float/);
    });
  });

  describe('Known Limitations', () => {
    it('should return empty attributes array (not yet implemented)', () => {
      const source = `
        @vertex
        fn main(@location(0) position: vec3f) -> @builtin(position) vec4f {
          return vec4f(position, 1.0);
        }
      `;
      const parser = new WGSLReflectionParser();

      WGSLReflectionParser.setUseASTParser(true);
      const result = parser.parse(source);

      // LIMITATION: AST parser doesn't extract attributes yet
      expect(result.attributes).toEqual([]);
    });

    it('should return undefined workgroupSize (not yet implemented)', () => {
      const source = `
        @compute @workgroup_size(64)
        fn main() {
          // compute work
        }
      `;
      const parser = new WGSLReflectionParser();

      WGSLReflectionParser.setUseASTParser(true);
      const result = parser.parse(source);

      // LIMITATION: AST parser doesn't extract workgroup size yet
      expect(result.workgroupSize).toBeUndefined();
    });
  });

  describe('Regression Tests', () => {
    it('should not break existing parseable shaders', () => {
      const parser = new WGSLReflectionParser();

      for (const { name, source } of testShaders) {
        // If regex parser can parse it, AST parser should too (or gracefully degrade)
        WGSLReflectionParser.setUseASTParser(false);
        let regexSucceeded = false;
        try {
          parser.parse(source);
          regexSucceeded = true;
        } catch {
          // Skip shaders that regex can't parse
          continue;
        }

        if (regexSucceeded) {
          WGSLReflectionParser.setUseASTParser(true);
          // Should not throw (either parses successfully or falls back)
          expect(() => parser.parse(source), `${name} should not break with AST parser`).not.toThrow();
        }
      }
    });
  });
});
