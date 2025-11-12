/**
 * Epic 3.14: Modern Rendering API Tests
 *
 * Tests for bind groups, pipelines, storage buffers, compute shaders, and shader reflection.
 */

import { describe, it, expect } from 'vitest';
import {
  BindGroupLayoutDescriptor,
  validateBindGroupLayout,
  createSceneBindGroupLayout,
  createObjectBindGroupLayout,
} from '../src/BindGroupDescriptors';
import {
  PipelineStateDescriptor,
  OPAQUE_PIPELINE_STATE,
  ALPHA_BLEND_PIPELINE_STATE,
  ADDITIVE_BLEND_PIPELINE_STATE,
} from '../src/PipelineStateDescriptor';
import { WGSLReflectionParser, ShaderReflectionCache } from '../src/ShaderReflection';
import { featureFlags } from '../src/FeatureFlags';
import { PerformanceBaseline } from '../src/PerformanceBaseline';
import { VRAMCategory } from '../src/VRAMProfiler';

describe('Epic 3.14: Modern Rendering API', () => {
  describe('BindGroupDescriptors', () => {
    it('should create valid scene bind group layout', () => {
      const layout = createSceneBindGroupLayout();
      expect(layout.entries).toBeDefined();
      expect(layout.entries.length).toBe(1);
      expect(layout.entries[0].binding).toBe(0);
      expect(layout.entries[0].type).toBe('uniform');
    });

    it('should create valid object bind group layout', () => {
      const layout = createObjectBindGroupLayout();
      expect(layout.entries).toBeDefined();
      expect(layout.entries.length).toBe(1);
      expect(layout.entries[0].binding).toBe(0);
      expect(layout.entries[0].type).toBe('uniform');
    });

    it('should validate 256-byte alignment requirement', () => {
      const validLayout: BindGroupLayoutDescriptor = {
        entries: [
          { binding: 0, visibility: ['vertex'], type: 'uniform', minBindingSize: 256 },
        ],
      };
      expect(() => validateBindGroupLayout(validLayout)).not.toThrow();

      const invalidLayout: BindGroupLayoutDescriptor = {
        entries: [
          { binding: 0, visibility: ['vertex'], type: 'uniform', minBindingSize: 100 },
        ],
      };
      expect(() => validateBindGroupLayout(invalidLayout)).toThrow(/256-byte aligned/);
    });

    it('should support storage buffer bindings', () => {
      const layout: BindGroupLayoutDescriptor = {
        entries: [
          { binding: 0, visibility: ['vertex', 'fragment'], type: 'storage', minBindingSize: 512 },
        ],
      };
      expect(() => validateBindGroupLayout(layout)).not.toThrow();
    });
  });

  describe('PipelineStateDescriptor', () => {
    it('should provide opaque pipeline preset', () => {
      expect(OPAQUE_PIPELINE_STATE.topology).toBe('triangle-list');
      expect(OPAQUE_PIPELINE_STATE.blend?.enabled).toBe(false);
      expect(OPAQUE_PIPELINE_STATE.depthStencil?.depthWriteEnabled).toBe(true);
      expect(OPAQUE_PIPELINE_STATE.rasterization?.cullMode).toBe('back');
    });

    it('should provide alpha blend pipeline preset', () => {
      expect(ALPHA_BLEND_PIPELINE_STATE.blend?.enabled).toBe(true);
      expect(ALPHA_BLEND_PIPELINE_STATE.blend?.srcFactor).toBe('src-alpha');
      expect(ALPHA_BLEND_PIPELINE_STATE.blend?.dstFactor).toBe('one-minus-src-alpha');
      expect(ALPHA_BLEND_PIPELINE_STATE.depthStencil?.depthWriteEnabled).toBe(false);
    });

    it('should provide additive blend pipeline preset', () => {
      expect(ADDITIVE_BLEND_PIPELINE_STATE.blend?.enabled).toBe(true);
      expect(ADDITIVE_BLEND_PIPELINE_STATE.blend?.srcFactor).toBe('one');
      expect(ADDITIVE_BLEND_PIPELINE_STATE.blend?.dstFactor).toBe('one');
      expect(ADDITIVE_BLEND_PIPELINE_STATE.depthStencil?.depthWriteEnabled).toBe(false);
    });
  });

  describe('ShaderReflection', () => {
    const parser = new WGSLReflectionParser();

    it('should parse simple WGSL shader bind groups', () => {
      const shaderSource = `
        @group(0) @binding(0) var<uniform> sceneData: mat4x4<f32>;
        @group(0) @binding(1) var<storage, read> lightData: array<vec4<f32>>;

        @vertex
        fn vs_main(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
          return vec4<f32>(0.0);
        }

        @fragment
        fn fs_main() -> @location(0) vec4<f32> {
          return vec4<f32>(1.0);
        }
      `;

      const reflection = parser.parse(shaderSource);

      expect(reflection.bindGroupLayouts).toBeDefined();
      expect(reflection.bindGroupLayouts.length).toBeGreaterThan(0);
      expect(reflection.entryPoints.vertex).toBe('vs_main');
      expect(reflection.entryPoints.fragment).toBe('fs_main');
    });

    it('should parse compute shader with workgroup size', () => {
      const shaderSource = `
        @group(0) @binding(0) var<storage, read_write> data: array<f32>;

        @compute @workgroup_size(64, 1, 1)
        fn compute_main() {
          // Compute logic
        }
      `;

      const reflection = parser.parse(shaderSource);

      expect(reflection.entryPoints.compute).toBe('compute_main');
      expect(reflection.workgroupSize).toBeDefined();
      expect(reflection.workgroupSize?.x).toBe(64);
    });

    it('should parse vertex attributes', () => {
      const shaderSource = `
        @vertex
        fn vs_main(
          @location(0) position: vec3<f32>,
          @location(1) normal: vec3<f32>,
          @location(2) uv: vec2<f32>
        ) -> @builtin(position) vec4<f32> {
          return vec4<f32>(0.0);
        }
      `;

      const reflection = parser.parse(shaderSource);

      expect(reflection.attributes.length).toBeGreaterThan(0);
    });

    it('should cache reflection data', () => {
      const cache = new ShaderReflectionCache();
      const source = `
        @group(0) @binding(0) var<uniform> data: vec4<f32>;
        @vertex
        fn vs_main() -> @builtin(position) vec4<f32> {
          return vec4<f32>(0.0);
        }
      `;

      const reflection1 = cache.getOrCompute(source, parser);
      const reflection2 = cache.getOrCompute(source, parser);

      // Should return the same cached instance
      expect(reflection1).toBe(reflection2);
    });
  });

  describe('FeatureFlags', () => {
    it('should have all Epic 3.14 flags disabled by default', () => {
      const flags = featureFlags.getFlags();
      expect(flags.useNewDrawCommand).toBe(false);
      expect(flags.useNewBindGroups).toBe(false);
      expect(flags.enableStorageBuffers).toBe(false);
      expect(flags.enableComputePipelines).toBe(false);
    });

    it('should allow enabling individual features', () => {
      featureFlags.enable('useNewDrawCommand');
      expect(featureFlags.isEnabled('useNewDrawCommand')).toBe(true);
      featureFlags.disable('useNewDrawCommand');
      expect(featureFlags.isEnabled('useNewDrawCommand')).toBe(false);
    });

    it('should enable all Epic 3.14 features at once', () => {
      featureFlags.enableAllEpic314Features();
      expect(featureFlags.isEnabled('useNewDrawCommand')).toBe(true);
      expect(featureFlags.isEnabled('useNewBindGroups')).toBe(true);
      expect(featureFlags.isEnabled('enableStorageBuffers')).toBe(true);
      expect(featureFlags.isEnabled('enableComputePipelines')).toBe(true);

      featureFlags.disableAllEpic314Features(); // Cleanup
    });

    it('should disable all Epic 3.14 features for rollback', () => {
      featureFlags.enableAllEpic314Features();
      featureFlags.disableAllEpic314Features();
      expect(featureFlags.isEnabled('useNewDrawCommand')).toBe(false);
      expect(featureFlags.isEnabled('useNewBindGroups')).toBe(false);
    });
  });

  describe('PerformanceBaseline', () => {
    it('should record and average performance metrics', () => {
      const baseline = new PerformanceBaseline();
      baseline.start();

      baseline.recordFrame({
        frameTime: 16.0,
        drawCalls: 100,
        bufferUpdates: 10,
        shaderSwitches: 5,
      });
      baseline.recordFrame({
        frameTime: 18.0,
        drawCalls: 120,
        bufferUpdates: 12,
        shaderSwitches: 6,
      });

      const avg = baseline.getAverage();
      expect(avg).not.toBeNull();
      expect(avg!.frameTime).toBe(17.0);
      expect(avg!.drawCalls).toBe(110);
    });

    it('should compare performance against baseline', () => {
      const baseline = new PerformanceBaseline();
      const baselineMetrics = {
        frameTime: 16.0,
        drawCalls: 100,
        bufferUpdates: 10,
        shaderSwitches: 5,
        timestamp: Date.now(),
      };

      const currentMetrics = {
        frameTime: 17.0,
        drawCalls: 105,
        bufferUpdates: 12,
        shaderSwitches: 5,
        timestamp: Date.now(),
      };

      const comparison = baseline.compare(baselineMetrics, currentMetrics);
      expect(comparison.frameTimeChange).toBeCloseTo(6.25, 1); // ~6.25% slower
      expect(comparison.drawCallsChange).toBeCloseTo(5.0, 1);  // 5% more draw calls
    });

    it('should export baseline to JSON', () => {
      const baseline = new PerformanceBaseline();
      baseline.start();
      baseline.recordFrame({
        frameTime: 16.0,
        drawCalls: 100,
        bufferUpdates: 10,
        shaderSwitches: 5,
      });

      const exported = baseline.export();
      expect(exported).toContain('"frameTime"');
      expect(exported).toContain('"drawCalls"');
      const parsed = JSON.parse(exported);
      expect(parsed.average).toBeDefined();
      expect(parsed.samples).toBeDefined();
    });
  });

  describe('VRAMCategory', () => {
    it('should include STORAGE_BUFFERS category', () => {
      expect(VRAMCategory.STORAGE_BUFFERS).toBe('storage_buffers');
    });

    it('should have all required categories', () => {
      expect(VRAMCategory.TEXTURES).toBeDefined();
      expect(VRAMCategory.VERTEX_BUFFERS).toBeDefined();
      expect(VRAMCategory.INDEX_BUFFERS).toBeDefined();
      expect(VRAMCategory.UNIFORM_BUFFERS).toBeDefined();
      expect(VRAMCategory.STORAGE_BUFFERS).toBeDefined();
      expect(VRAMCategory.RENDER_TARGETS).toBeDefined();
      expect(VRAMCategory.OTHER).toBeDefined();
    });
  });
});
