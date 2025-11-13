/**
 * Shader Reflector Tests
 * Epic 3.14 Phase 3 - Task 5
 */

import { describe, it, expect } from 'vitest';
import { ShaderReflector } from '../src/shaders/ShaderReflector';

describe('ShaderReflector', () => {
  const reflector = new ShaderReflector();

  describe('Bind Group Extraction', () => {
    it('should extract uniform buffer bindings', () => {
      const source = `
        @group(0) @binding(0) var<uniform> camera: mat4x4f;
        @group(0) @binding(1) var<uniform> model: mat4x4f;
      `;

      const result = reflector.reflect(source);

      expect(result.bindGroups.size).toBe(1);
      expect(result.bindGroups.has(0)).toBe(true);

      const group0 = result.bindGroups.get(0)!;
      expect(group0.bindings).toHaveLength(2);
      expect(group0.bindings[0].name).toBe('camera');
      expect(group0.bindings[0].binding).toBe(0);
      expect(group0.bindings[0].type).toBe('buffer');
      expect(group0.bindings[0].bufferType).toBe('uniform');
    });

    it('should extract storage buffer bindings', () => {
      const source = `
        @group(0) @binding(0) var<storage, read> input: array<f32>;
        @group(0) @binding(1) var<storage, read_write> output: array<f32>;
      `;

      const result = reflector.reflect(source);

      const group0 = result.bindGroups.get(0)!;
      expect(group0.bindings[0].bufferType).toBe('read-only-storage');
      expect(group0.bindings[1].bufferType).toBe('storage');
    });

    it('should extract texture bindings', () => {
      const source = `
        @group(1) @binding(0) var myTexture: texture_2d<f32>;
        @group(1) @binding(1) var depthTexture: texture_depth_2d;
      `;

      const result = reflector.reflect(source);

      const group1 = result.bindGroups.get(1)!;
      expect(group1.bindings[0].type).toBe('texture');
      expect(group1.bindings[0].textureSampleType).toBe('float');
      expect(group1.bindings[1].textureSampleType).toBe('depth');
    });

    it('should extract sampler bindings', () => {
      const source = `
        @group(1) @binding(2) var mySampler: sampler;
        @group(1) @binding(3) var shadowSampler: sampler_comparison;
      `;

      const result = reflector.reflect(source);

      const group1 = result.bindGroups.get(1)!;
      expect(group1.bindings[0].type).toBe('sampler');
      expect(group1.bindings[0].samplerType).toBe('filtering');
      expect(group1.bindings[1].samplerType).toBe('comparison');
    });

    it('should handle multiple bind groups', () => {
      const source = `
        @group(0) @binding(0) var<uniform> camera: mat4x4f;
        @group(1) @binding(0) var myTexture: texture_2d<f32>;
        @group(1) @binding(1) var mySampler: sampler;
        @group(2) @binding(0) var<storage> data: array<f32>;
      `;

      const result = reflector.reflect(source);

      expect(result.bindGroups.size).toBe(3);
      expect(result.bindGroups.has(0)).toBe(true);
      expect(result.bindGroups.has(1)).toBe(true);
      expect(result.bindGroups.has(2)).toBe(true);

      expect(result.bindGroups.get(0)!.bindings).toHaveLength(1);
      expect(result.bindGroups.get(1)!.bindings).toHaveLength(2);
      expect(result.bindGroups.get(2)!.bindings).toHaveLength(1);
    });
  });

  describe('Entry Point Extraction', () => {
    it('should extract vertex entry point', () => {
      const source = `
        @vertex
        fn vertexMain() -> @builtin(position) vec4f {
          return vec4f(0.0);
        }
      `;

      const result = reflector.reflect(source);

      expect(result.entryPoints.vertex).toBe('vertexMain');
      expect(result.entryPoints.fragment).toBeUndefined();
      expect(result.entryPoints.compute).toBeUndefined();
    });

    it('should extract fragment entry point', () => {
      const source = `
        @fragment
        fn fragmentMain() -> @location(0) vec4f {
          return vec4f(1.0);
        }
      `;

      const result = reflector.reflect(source);

      expect(result.entryPoints.fragment).toBe('fragmentMain');
      expect(result.entryPoints.vertex).toBeUndefined();
    });

    it('should extract compute entry point', () => {
      const source = `
        @compute @workgroup_size(64)
        fn computeMain() {
          // compute work
        }
      `;

      const result = reflector.reflect(source);

      expect(result.entryPoints.compute).toBe('computeMain');
    });

    it('should extract multiple entry points', () => {
      const source = `
        @vertex
        fn vs_main() -> @builtin(position) vec4f {
          return vec4f(0.0);
        }

        @fragment
        fn fs_main() -> @location(0) vec4f {
          return vec4f(1.0);
        }
      `;

      const result = reflector.reflect(source);

      expect(result.entryPoints.vertex).toBe('vs_main');
      expect(result.entryPoints.fragment).toBe('fs_main');
    });
  });

  describe('Struct Extraction', () => {
    it('should extract struct definitions', () => {
      const source = `
        struct Uniforms {
          modelMatrix: mat4x4f,
          viewMatrix: mat4x4f
        }

        struct Material {
          baseColor: vec4f,
          metallic: f32
        }
      `;

      const result = reflector.reflect(source);

      expect(result.structs.size).toBe(2);
      expect(result.structs.has('Uniforms')).toBe(true);
      expect(result.structs.has('Material')).toBe(true);

      const uniforms = result.structs.get('Uniforms')!;
      expect(uniforms.members).toHaveLength(2);
    });
  });

  describe('Validation', () => {
    it('should validate bind group count limits', () => {
      const source = `
        @group(0) @binding(0) var<uniform> data0: vec4f;
        @group(1) @binding(0) var<uniform> data1: vec4f;
        @group(2) @binding(0) var<uniform> data2: vec4f;
        @group(3) @binding(0) var<uniform> data3: vec4f;
        @group(4) @binding(0) var<uniform> data4: vec4f;
      `;

      const result = reflector.reflect(source);
      const errors = reflector.validateBindGroupLayout(result);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('bind groups'))).toBe(true);
    });

    it('should validate duplicate binding indices', () => {
      const source = `
        @group(0) @binding(0) var<uniform> data1: vec4f;
        @group(0) @binding(0) var<uniform> data2: vec4f;
      `;

      const result = reflector.reflect(source);
      const errors = reflector.validateBindGroupLayout(result);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('duplicate'))).toBe(true);
    });

    it('should validate entry point existence', () => {
      const source = `
        struct Data {
          value: f32
        }
      `;

      const result = reflector.reflect(source);
      const errors = reflector.validateBindGroupLayout(result);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('entry points'))).toBe(true);
    });

    it('should pass validation for valid shader', () => {
      const source = `
        @group(0) @binding(0) var<uniform> camera: mat4x4f;
        @group(1) @binding(0) var myTexture: texture_2d<f32>;
        @group(1) @binding(1) var mySampler: sampler;

        @vertex
        fn vs_main() -> @builtin(position) vec4f {
          return vec4f(0.0);
        }

        @fragment
        fn fs_main() -> @location(0) vec4f {
          return vec4f(1.0);
        }
      `;

      const result = reflector.reflect(source);
      const errors = reflector.validateBindGroupLayout(result);

      expect(errors).toHaveLength(0);
    });
  });

  describe('WebGPU Descriptor Conversion', () => {
    it('should convert to GPUBindGroupLayoutDescriptor', () => {
      const source = `
        @group(0) @binding(0) var<uniform> camera: mat4x4f;
        @group(0) @binding(1) var myTexture: texture_2d<f32>;
        @group(0) @binding(2) var mySampler: sampler;
      `;

      const result = reflector.reflect(source);
      const bindGroup = result.bindGroups.get(0)!;
      const descriptor = reflector.toBindGroupLayoutDescriptor(bindGroup);

      expect(descriptor.entries).toHaveLength(3);

      // Check buffer entry
      expect(descriptor.entries[0].binding).toBe(0);
      expect(descriptor.entries[0].buffer).toBeDefined();
      expect(descriptor.entries[0].buffer!.type).toBe('uniform');

      // Check texture entry
      expect(descriptor.entries[1].binding).toBe(1);
      expect(descriptor.entries[1].texture).toBeDefined();
      expect(descriptor.entries[1].texture!.sampleType).toBe('float');

      // Check sampler entry
      expect(descriptor.entries[2].binding).toBe(2);
      expect(descriptor.entries[2].sampler).toBeDefined();
      expect(descriptor.entries[2].sampler!.type).toBe('filtering');
    });
  });

  describe('Storage Texture Handling', () => {
    it('should extract storage texture with rgba8unorm format and write access', () => {
      const source = `
        @group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
      `;

      const result = reflector.reflect(source);

      const group0 = result.bindGroups.get(0)!;
      expect(group0.bindings).toHaveLength(1);
      expect(group0.bindings[0].type).toBe('storage-texture');
      expect(group0.bindings[0].name).toBe('outputTexture');
      expect(group0.bindings[0].storageTextureFormat).toBe('rgba8unorm');
      expect(group0.bindings[0].storageTextureAccess).toBe('write-only');
    });

    it('should extract storage texture with rgba16float format', () => {
      const source = `
        @group(1) @binding(0) var storageArray: texture_storage_2d_array<rgba16float, write>;
      `;

      const result = reflector.reflect(source);

      const group1 = result.bindGroups.get(1)!;
      expect(group1.bindings[0].type).toBe('storage-texture');
      expect(group1.bindings[0].storageTextureFormat).toBe('rgba16float');
      expect(group1.bindings[0].storageTextureAccess).toBe('write-only');
    });

    it('should extract storage texture with r32float format', () => {
      const source = `
        @group(0) @binding(0) var outputR32: texture_storage_2d<r32float, write>;
      `;

      const result = reflector.reflect(source);

      const group0 = result.bindGroups.get(0)!;
      expect(group0.bindings[0].storageTextureFormat).toBe('r32float');
      expect(group0.bindings[0].storageTextureAccess).toBe('write-only');
    });

    it('should extract storage texture with read access', () => {
      const source = `
        @group(0) @binding(0) var inputTexture: texture_storage_2d<rgba8unorm, read>;
      `;

      const result = reflector.reflect(source);

      const group0 = result.bindGroups.get(0)!;
      expect(group0.bindings[0].type).toBe('storage-texture');
      expect(group0.bindings[0].storageTextureFormat).toBe('rgba8unorm');
      expect(group0.bindings[0].storageTextureAccess).toBe('read-only');
    });

    it('should extract storage texture with read_write access', () => {
      const source = `
        @group(0) @binding(0) var rwTexture: texture_storage_2d<rgba32uint, read_write>;
      `;

      const result = reflector.reflect(source);

      const group0 = result.bindGroups.get(0)!;
      expect(group0.bindings[0].storageTextureFormat).toBe('rgba32uint');
      expect(group0.bindings[0].storageTextureAccess).toBe('read-write');
    });

    it('should default to write-only when access mode omitted', () => {
      const source = `
        @group(0) @binding(0) var defaultTexture: texture_storage_2d<rgba8unorm>;
      `;

      const result = reflector.reflect(source);

      const group0 = result.bindGroups.get(0)!;
      expect(group0.bindings[0].storageTextureAccess).toBe('write-only');
    });

    it('should throw error for invalid storage texture format', () => {
      const source = `
        @group(0) @binding(0) var badTexture: texture_storage_2d<invalid_format, write>;
      `;

      expect(() => reflector.reflect(source)).toThrow('Invalid storage texture format');
    });

    it('should throw error for missing storage texture format', () => {
      const source = `
        @group(0) @binding(0) var badTexture: texture_storage_2d<, write>;
      `;

      // Parser should fail on empty template parameter
      expect(() => reflector.reflect(source)).toThrow();
    });

    it('should throw error for invalid access mode', () => {
      const source = `
        @group(0) @binding(0) var badTexture: texture_storage_2d<rgba8unorm, invalid>;
      `;

      expect(() => reflector.reflect(source)).toThrow('Invalid storage texture access mode');
    });

    it('should validate sint texture sample types', () => {
      const source = `
        @group(0) @binding(0) var intTexture: texture_2d<i32>;
      `;

      const result = reflector.reflect(source);

      const group0 = result.bindGroups.get(0)!;
      expect(group0.bindings[0].type).toBe('texture');
      expect(group0.bindings[0].textureSampleType).toBe('sint');
    });

    it('should validate uint texture sample types', () => {
      const source = `
        @group(0) @binding(0) var uintTexture: texture_2d<u32>;
      `;

      const result = reflector.reflect(source);

      const group0 = result.bindGroups.get(0)!;
      expect(group0.bindings[0].type).toBe('texture');
      expect(group0.bindings[0].textureSampleType).toBe('uint');
    });
  });

  describe('Real-World Shader Reflection', () => {
    it('should reflect PBR material shader', () => {
      const source = `
        struct Material {
          baseColor: vec4f,
          metallic: f32,
          roughness: f32,
          emissive: vec3f
        }

        @group(0) @binding(0) var<uniform> camera: mat4x4f;
        @group(1) @binding(0) var<uniform> material: Material;
        @group(1) @binding(1) var baseColorTexture: texture_2d<f32>;
        @group(1) @binding(2) var normalTexture: texture_2d<f32>;
        @group(1) @binding(3) var materialSampler: sampler;

        @vertex
        fn vs_main(@location(0) position: vec3f) -> @builtin(position) vec4f {
          return vec4f(position, 1.0);
        }

        @fragment
        fn fs_main() -> @location(0) vec4f {
          return vec4f(1.0);
        }
      `;

      const result = reflector.reflect(source);

      // Check bind groups
      expect(result.bindGroups.size).toBe(2);
      expect(result.bindGroups.get(0)!.bindings).toHaveLength(1);
      expect(result.bindGroups.get(1)!.bindings).toHaveLength(4);

      // Check entry points
      expect(result.entryPoints.vertex).toBe('vs_main');
      expect(result.entryPoints.fragment).toBe('fs_main');

      // Check structs
      expect(result.structs.has('Material')).toBe(true);

      // Validate
      const errors = reflector.validateBindGroupLayout(result);
      expect(errors).toHaveLength(0);
    });
  });
});
