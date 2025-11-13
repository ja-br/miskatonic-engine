/**
 * WGSL Parser Tests
 * Epic 3.14 Phase 3 - Task 4
 */

import { describe, it, expect } from 'vitest';
import { WGSLParser } from '../../src/shaders/parser/WGSLParser';
import { ParseError } from '../../src/shaders/parser/AST';
import { loadCorpus } from '../helpers/ParserTestUtils';

describe('WGSLParser', () => {
  const parser = new WGSLParser();

  describe('Simple Declarations', () => {
    it('should parse struct declarations', () => {
      const source = `
        struct Uniforms {
          modelMatrix: mat4x4f,
          viewMatrix: mat4x4f
        }
      `;

      const ast = parser.parse(source);
      expect(ast.kind).toBe('ShaderModule');
      expect(ast.declarations).toHaveLength(1);

      const structDecl = ast.declarations[0];
      expect(structDecl.kind).toBe('StructDeclaration');
      expect((structDecl as any).name).toBe('Uniforms');
      expect((structDecl as any).members).toHaveLength(2);
    });

    it('should parse uniform variable declarations', () => {
      const source = `
        @group(0) @binding(0) var<uniform> uniforms: vec4f;
      `;

      const ast = parser.parse(source);
      expect(ast.declarations).toHaveLength(1);

      const varDecl = ast.declarations[0];
      expect(varDecl.kind).toBe('VariableDeclaration');
      expect((varDecl as any).name).toBe('uniforms');
      expect((varDecl as any).storageClass).toBe('uniform');
      expect((varDecl as any).attributes).toHaveLength(2);
    });

    it('should parse storage buffer declarations', () => {
      const source = `
        @group(1) @binding(0) var<storage, read_write> data: array<f32>;
      `;

      const ast = parser.parse(source);
      const varDecl = ast.declarations[0] as any;

      expect(varDecl.storageClass).toBe('storage');
      expect(varDecl.accessMode).toBe('read_write');
    });

    it('should parse function declarations', () => {
      const source = `
        @vertex
        fn vertexMain(@location(0) position: vec3f) -> @builtin(position) vec4f {
          return vec4f(position, 1.0);
        }
      `;

      const ast = parser.parse(source);
      const funcDecl = ast.declarations[0] as any;

      expect(funcDecl.kind).toBe('FunctionDeclaration');
      expect(funcDecl.name).toBe('vertexMain');
      expect(funcDecl.parameters).toHaveLength(1);
      expect(funcDecl.attributes).toHaveLength(1);
      expect(funcDecl.attributes[0].name).toBe('vertex');
    });

    it('should parse type alias declarations', () => {
      const source = `
        type Vec3 = vec3f;
      `;

      const ast = parser.parse(source);
      const typeDecl = ast.declarations[0] as any;

      expect(typeDecl.kind).toBe('TypeAliasDeclaration');
      expect(typeDecl.name).toBe('Vec3');
      expect(typeDecl.type.name).toBe('vec3f');
    });
  });

  describe('Type Parsing', () => {
    it('should parse simple types', () => {
      const source = `var<uniform> data: vec4f;`;
      const ast = parser.parse(source);
      const varDecl = ast.declarations[0] as any;

      expect(varDecl.type.kind).toBe('SimpleType');
      expect(varDecl.type.name).toBe('vec4f');
    });

    it('should parse array types with size', () => {
      const source = `var<uniform> data: array<f32, 10>;`;
      const ast = parser.parse(source);
      const varDecl = ast.declarations[0] as any;

      expect(varDecl.type.kind).toBe('ArrayType');
      expect(varDecl.type.elementType.name).toBe('f32');
      expect(varDecl.type.size).toBe(10);
    });

    it('should parse runtime-sized arrays', () => {
      const source = `var<storage> data: array<f32>;`;
      const ast = parser.parse(source);
      const varDecl = ast.declarations[0] as any;

      expect(varDecl.type.kind).toBe('ArrayType');
      expect(varDecl.type.size).toBeNull();
    });

    it('should parse template types', () => {
      const source = `var myTexture: texture_2d<f32>;`;
      const ast = parser.parse(source);
      const varDecl = ast.declarations[0] as any;

      expect(varDecl.type.kind).toBe('TemplateType');
      expect(varDecl.type.name).toBe('texture_2d');
      expect(varDecl.type.parameters).toHaveLength(1);
    });
  });

  describe('Attribute Parsing', () => {
    it('should parse attributes with numeric arguments', () => {
      const source = `@group(0) @binding(1) var<uniform> data: vec4f;`;
      const ast = parser.parse(source);
      const varDecl = ast.declarations[0] as any;

      expect(varDecl.attributes).toHaveLength(2);
      expect(varDecl.attributes[0].name).toBe('group');
      expect(varDecl.attributes[0].arguments).toEqual([0]);
      expect(varDecl.attributes[1].name).toBe('binding');
      expect(varDecl.attributes[1].arguments).toEqual([1]);
    });

    it('should parse attributes with identifier arguments', () => {
      const source = `@builtin(position) var output: vec4f;`;
      const ast = parser.parse(source);
      const varDecl = ast.declarations[0] as any;

      expect(varDecl.attributes[0].name).toBe('builtin');
      expect(varDecl.attributes[0].arguments).toEqual(['position']);
    });

    it('should parse attributes without arguments', () => {
      const source = `@vertex fn main() -> vec4f { return vec4f(0.0); }`;
      const ast = parser.parse(source);
      const funcDecl = ast.declarations[0] as any;

      expect(funcDecl.attributes[0].name).toBe('vertex');
      expect(funcDecl.attributes[0].arguments).toHaveLength(0);
    });
  });

  describe('Complex Shader Parsing', () => {
    it('should parse shader with multiple bind groups', () => {
      const source = `
        @group(0) @binding(0) var<uniform> camera: mat4x4f;
        @group(0) @binding(1) var<uniform> model: mat4x4f;
        @group(1) @binding(0) var myTexture: texture_2d<f32>;
        @group(1) @binding(1) var mySampler: sampler;

        @vertex
        fn vertexMain() -> vec4f {
          return vec4f(0.0);
        }
      `;

      const ast = parser.parse(source);
      expect(ast.declarations).toHaveLength(5);

      // Count variables by group
      const variables = ast.declarations.filter(d => d.kind === 'VariableDeclaration') as any[];
      const group0 = variables.filter(v =>
        v.attributes.some((a: any) => a.name === 'group' && a.arguments[0] === 0)
      );
      const group1 = variables.filter(v =>
        v.attributes.some((a: any) => a.name === 'group' && a.arguments[0] === 1)
      );

      expect(group0).toHaveLength(2);
      expect(group1).toHaveLength(2);
    });

    it('should parse struct with vertex attributes', () => {
      const source = `
        struct VertexInput {
          @location(0) position: vec3f,
          @location(1) normal: vec3f,
          @location(2) uv: vec2f
        }
      `;

      const ast = parser.parse(source);
      const structDecl = ast.declarations[0] as any;

      expect(structDecl.members).toHaveLength(3);
      expect(structDecl.members[0].attributes[0].name).toBe('location');
      expect(structDecl.members[0].attributes[0].arguments[0]).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw ParseError for invalid storage class', () => {
      const source = `var<invalid_storage> data: vec4f;`;

      expect(() => parser.parse(source)).toThrow(ParseError);
    });

    it('should throw ParseError for unclosed struct', () => {
      const source = `struct MyStruct { field: vec4f`;

      expect(() => parser.parse(source)).toThrow(ParseError);
    });

    it('should throw ParseError for missing semicolon', () => {
      const source = `var<uniform> data: vec4f`; // Missing semicolon

      expect(() => parser.parse(source)).toThrow(ParseError);
    });
  });

  describe('Test Corpus Compatibility', () => {
    it('should parse all valid shaders from test corpus', () => {
      const shaders = loadCorpus();
      const validShaders = shaders.filter(s => s.category !== 'invalid');

      const results = validShaders.map(shader => {
        try {
          const ast = parser.parse(shader.source);
          return { name: shader.name, success: true, ast };
        } catch (error) {
          return { name: shader.name, success: false, error };
        }
      });

      const failures = results.filter(r => !r.success);

      if (failures.length > 0) {
        console.error('Failed to parse:', failures.map(f => f.name));
        failures.forEach(f => {
          console.error(`  ${f.name}: ${(f.error as Error).message}`);
        });
      }

      expect(failures).toHaveLength(0);
    });

    it('should reject shaders with structural errors', () => {
      // Test specific known-invalid constructs
      // Note: Some semantic errors (unknown types, etc.) are caught during validation, not parsing

      // Missing semicolon
      expect(() => parser.parse('var<uniform> data: vec4f')).toThrow(ParseError);

      // Invalid storage class
      expect(() => parser.parse('var<invalid> data: vec4f;')).toThrow(ParseError);

      // Invalid access mode
      expect(() => parser.parse('var<storage, invalid_mode> data: vec4f;')).toThrow(ParseError);
    });
  });

  describe('Real-World Shader Fragments', () => {
    it('should parse PBR material shader fragment', () => {
      const source = `
        struct Material {
          baseColor: vec4f,
          metallic: f32,
          roughness: f32,
          emissive: vec3f
        }

        @group(0) @binding(0) var<uniform> material: Material;
        @group(0) @binding(1) var baseColorTexture: texture_2d<f32>;
        @group(0) @binding(2) var materialSampler: sampler;
      `;

      const ast = parser.parse(source);
      expect(ast.declarations).toHaveLength(4);

      const structDecl = ast.declarations[0] as any;
      expect(structDecl.kind).toBe('StructDeclaration');
      expect(structDecl.members).toHaveLength(4);
    });

    it('should parse compute shader with storage buffers', () => {
      const source = `
        @group(0) @binding(0) var<storage, read> input: array<f32>;
        @group(0) @binding(1) var<storage, read_write> output: array<f32>;

        @compute @workgroup_size(64)
        fn computeMain(@builtin(global_invocation_id) id: vec3u) {
          output[id.x] = input[id.x] * 2.0;
        }
      `;

      const ast = parser.parse(source);
      expect(ast.declarations).toHaveLength(3);

      const funcDecl = ast.declarations[2] as any;
      expect(funcDecl.attributes.some((a: any) => a.name === 'compute')).toBe(true);
      expect(funcDecl.attributes.some((a: any) => a.name === 'workgroup_size')).toBe(true);
    });
  });
});
