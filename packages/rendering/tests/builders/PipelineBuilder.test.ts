/**
 * PipelineBuilder Tests - Epic RENDERING-06 Task 6.2
 */

import { describe, it, expect } from 'vitest';
import { PipelineBuilder } from '../../src/builders/PipelineBuilder';
import type { BackendShaderHandle, BackendBindGroupLayoutHandle } from '../../src/backends/IRendererBackend';
import { VertexLayoutBuilder } from '../../src/builders/VertexLayoutBuilder';

// Mock handles
const mockShader: BackendShaderHandle = { __brand: 'BackendShader' as const, id: 'shader-1' };
const mockBindGroupLayout: BackendBindGroupLayoutHandle = { __brand: 'BackendBindGroupLayout' as const, id: 'layout-1' };

describe('PipelineBuilder', () => {
  describe('Basic Configuration', () => {
    it('should build basic opaque pipeline descriptor', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .buildDescriptor();

      expect(descriptor.shader).toBe(mockShader);
      expect(descriptor.vertexLayouts).toHaveLength(1);
      expect(descriptor.colorFormat).toBe('bgra8unorm');
      expect(descriptor.pipelineState.rasterization?.cullMode).toBe('back');
      expect(descriptor.pipelineState.blend?.enabled).toBe(false);
    });

    it('should allow setting label', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .label('MyPipeline')
        .buildDescriptor();

      expect(descriptor.label).toBe('MyPipeline');
    });

    it('should allow multiple vertex layouts', () => {
      const layout1 = VertexLayoutBuilder.Simple(0).build(); // locations 0-1
      const layout2 = VertexLayoutBuilder.Colored(2).setStepMode('instance').build(); // locations 2-3

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(layout1)
        .vertexLayout(layout2)
        .buildDescriptor();

      expect(descriptor.vertexLayouts).toHaveLength(2);
    });

    it('should allow multiple bind group layouts', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();
      const layout2: BackendBindGroupLayoutHandle = { __brand: 'BackendBindGroupLayout' as const, id: 'layout-2' };

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .bindGroupLayout(mockBindGroupLayout)
        .bindGroupLayout(layout2)
        .buildDescriptor();

      expect(descriptor.bindGroupLayouts).toHaveLength(2);
    });
  });

  describe('Color Format', () => {
    it('should default to bgra8unorm', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .buildDescriptor();

      expect(descriptor.colorFormat).toBe('bgra8unorm');
    });

    it('should allow rgba8unorm', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .colorFormat('rgba8unorm')
        .buildDescriptor();

      expect(descriptor.colorFormat).toBe('rgba8unorm');
    });
  });

  describe('Depth Stencil', () => {
    it('should configure depth testing', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .depthStencil('depth24plus', true, 'less')
        .buildDescriptor();

      expect(descriptor.depthFormat).toBe('depth24plus');
      expect(descriptor.pipelineState.depthStencil?.depthWriteEnabled).toBe(true);
      expect(descriptor.pipelineState.depthStencil?.depthCompare).toBe('less');
    });

    it('should default to depth16unorm', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .depthStencil()
        .buildDescriptor();

      expect(descriptor.depthFormat).toBe('depth16unorm');
    });

    it('should support depth24plus-stencil8', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .depthStencil('depth24plus-stencil8')
        .buildDescriptor();

      expect(descriptor.depthFormat).toBe('depth24plus-stencil8');
    });

    it('should allow disabling depth write', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .depthStencil('depth16unorm', false)
        .buildDescriptor();

      expect(descriptor.pipelineState.depthStencil?.depthWriteEnabled).toBe(false);
    });

    it('should support different depth compare functions', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .depthStencil('depth16unorm', true, 'greater')
        .buildDescriptor();

      expect(descriptor.pipelineState.depthStencil?.depthCompare).toBe('greater');
    });
  });

  describe('Blend Modes', () => {
    it('should configure opaque blend', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .blend('opaque')
        .buildDescriptor();

      expect(descriptor.pipelineState.blend.enabled).toBe(false);
    });

    it('should configure transparent blend', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .blend('transparent')
        .buildDescriptor();

      expect(descriptor.pipelineState.blend.enabled).toBe(true);
      expect(descriptor.pipelineState.blend.srcFactor).toBe('src-alpha');
      expect(descriptor.pipelineState.blend.dstFactor).toBe('one-minus-src-alpha');
    });

    it('should configure additive blend', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .blend('additive')
        .buildDescriptor();

      expect(descriptor.pipelineState.blend.enabled).toBe(true);
      expect(descriptor.pipelineState.blend.srcFactor).toBe('one');
      expect(descriptor.pipelineState.blend.dstFactor).toBe('one');
    });

    it('should configure premultiplied blend', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .blend('premultiplied')
        .buildDescriptor();

      expect(descriptor.pipelineState.blend.enabled).toBe(true);
      expect(descriptor.pipelineState.blend.srcFactor).toBe('one');
      expect(descriptor.pipelineState.blend.dstFactor).toBe('one-minus-src-alpha');
    });
  });

  describe('Topology', () => {
    it('should default to triangle-list', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .buildDescriptor();

      // Topology is part of pipeline state in our abstraction
      expect(descriptor.pipelineState.topology).toBe('triangle-list');
    });

    it('should allow line-list topology', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const builder = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .topology('line-list');

      // Topology is stored internally, verify it doesn't throw
      expect(() => builder.buildDescriptor()).not.toThrow();
    });

    it('should allow point-list topology', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const builder = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .topology('point-list');

      expect(() => builder.buildDescriptor()).not.toThrow();
    });
  });

  describe('Cull Mode', () => {
    it('should default to back culling', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .buildDescriptor();

      expect(descriptor.pipelineState.rasterization?.cullMode).toBe('back');
    });

    it('should allow front culling', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .cullMode('front')
        .buildDescriptor();

      expect(descriptor.pipelineState.rasterization?.cullMode).toBe('front');
    });

    it('should allow no culling', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .vertexLayout(vertexLayout)
        .cullMode('none')
        .buildDescriptor();

      expect(descriptor.pipelineState.rasterization?.cullMode).toBe('none');
    });
  });

  describe('Static Presets', () => {
    it('should create Opaque preset', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = PipelineBuilder.Opaque(mockShader, vertexLayout)
        .buildDescriptor();

      expect(descriptor.pipelineState.blend?.enabled).toBe(false);
      expect(descriptor.pipelineState.rasterization?.cullMode).toBe('back');
      expect(descriptor.pipelineState.depthStencil?.depthWriteEnabled).toBe(true);
      expect(descriptor.depthFormat).toBe('depth16unorm');
    });

    it('should create Transparent preset', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = PipelineBuilder.Transparent(mockShader, vertexLayout)
        .buildDescriptor();

      expect(descriptor.pipelineState.blend?.enabled).toBe(true);
      expect(descriptor.pipelineState.blend?.srcFactor).toBe('src-alpha');
      expect(descriptor.pipelineState.rasterization?.cullMode).toBe('none');
      expect(descriptor.pipelineState.depthStencil?.depthWriteEnabled).toBe(false);
    });

    it('should create Additive preset', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = PipelineBuilder.Additive(mockShader, vertexLayout)
        .buildDescriptor();

      expect(descriptor.pipelineState.blend?.enabled).toBe(true);
      expect(descriptor.pipelineState.blend?.srcFactor).toBe('one');
      expect(descriptor.pipelineState.blend?.dstFactor).toBe('one');
      expect(descriptor.pipelineState.depthStencil?.depthWriteEnabled).toBe(false);
    });

    it('should create Wireframe preset', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const builder = PipelineBuilder.Wireframe(mockShader, vertexLayout);

      expect(() => builder.buildDescriptor()).not.toThrow();
    });

    it('should create Premultiplied preset', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = PipelineBuilder.Premultiplied(mockShader, vertexLayout)
        .buildDescriptor();

      expect(descriptor.pipelineState.blend.enabled).toBe(true);
      expect(descriptor.pipelineState.blend.srcFactor).toBe('one');
      expect(descriptor.pipelineState.blend.dstFactor).toBe('one-minus-src-alpha');
    });

    it('should create PointCloud preset', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const builder = PipelineBuilder.PointCloud(mockShader, vertexLayout);

      expect(() => builder.buildDescriptor()).not.toThrow();
    });

    it('should allow extending presets with bind groups', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = PipelineBuilder.Transparent(mockShader, vertexLayout)
        .bindGroupLayout(mockBindGroupLayout)
        .buildDescriptor();

      expect(descriptor.bindGroupLayouts).toHaveLength(1);
    });
  });

  describe('Validation', () => {
    it('should throw error when building without shader', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const builder = new PipelineBuilder()
        .vertexLayout(vertexLayout);

      expect(() => builder.buildDescriptor()).toThrow('Shader not set');
    });

    it('should warn when building without vertex layouts', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      new PipelineBuilder()
        .shader(mockShader)
        .buildDescriptor();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No vertex layouts'));

      warnSpy.mockRestore();
    });

    it('should throw error for transparent blend with depth write enabled', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      expect(() => {
        new PipelineBuilder()
          .shader(mockShader)
          .vertexLayout(vertexLayout)
          .blend('transparent')
          .depthStencil('depth16unorm', true) // depth write enabled
          .buildDescriptor();
      }).toThrow('sorting artifacts');
    });

    it('should allow transparent blend with depth write disabled', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      expect(() => {
        new PipelineBuilder()
          .shader(mockShader)
          .vertexLayout(vertexLayout)
          .blend('transparent')
          .depthStencil('depth16unorm', false) // depth write disabled
          .buildDescriptor();
      }).not.toThrow();
    });

    it('should allow opaque blend with depth write enabled', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      expect(() => {
        new PipelineBuilder()
          .shader(mockShader)
          .vertexLayout(vertexLayout)
          .blend('opaque')
          .depthStencil('depth16unorm', true)
          .buildDescriptor();
      }).not.toThrow();
    });

    it('should detect duplicate shader locations across multiple layouts', () => {
      const layout1 = VertexLayoutBuilder.Simple(0).build(); // locations 0-1
      const layout2 = VertexLayoutBuilder.PBR(0).build(); // locations 0-3 (overlap!)

      expect(() => {
        new PipelineBuilder()
          .shader(mockShader)
          .vertexLayout(layout1)
          .vertexLayout(layout2)
          .buildDescriptor();
      }).toThrow('Duplicate shader location 0');
    });

    it('should allow non-overlapping shader locations across layouts', () => {
      const layout1 = VertexLayoutBuilder.Simple(0).build(); // locations 0-1
      const layout2 = VertexLayoutBuilder.Colored(2).build(); // locations 2-3 (no overlap)

      expect(() => {
        new PipelineBuilder()
          .shader(mockShader)
          .vertexLayout(layout1)
          .vertexLayout(layout2)
          .buildDescriptor();
      }).not.toThrow();
    });

    it('should accept multisample count of 2', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      expect(() => {
        new PipelineBuilder()
          .shader(mockShader)
          .vertexLayout(vertexLayout)
          .multisample(2)
          .buildDescriptor();
      }).not.toThrow();
    });

    it('should accept multisample count of 8', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      expect(() => {
        new PipelineBuilder()
          .shader(mockShader)
          .vertexLayout(vertexLayout)
          .multisample(8)
          .buildDescriptor();
      }).not.toThrow();
    });

    it('should accept multisample count of 16', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      expect(() => {
        new PipelineBuilder()
          .shader(mockShader)
          .vertexLayout(vertexLayout)
          .multisample(16)
          .buildDescriptor();
      }).not.toThrow();
    });

    it('should reject non-power-of-2 multisample count', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      expect(() => {
        new PipelineBuilder()
          .shader(mockShader)
          .vertexLayout(vertexLayout)
          .multisample(3)
          .buildDescriptor();
      }).toThrow('Must be power of 2');
    });

    it('should reject multisample count > 16', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      expect(() => {
        new PipelineBuilder()
          .shader(mockShader)
          .vertexLayout(vertexLayout)
          .multisample(32)
          .buildDescriptor();
      }).toThrow('Must be power of 2 between 1-16');
    });
  });

  describe('Fluent API', () => {
    it('should allow method chaining', () => {
      const vertexLayout = VertexLayoutBuilder.Simple().build();

      const descriptor = new PipelineBuilder()
        .shader(mockShader)
        .label('TestPipeline')
        .vertexLayout(vertexLayout)
        .bindGroupLayout(mockBindGroupLayout)
        .colorFormat('rgba8unorm')
        .depthStencil('depth24plus', false, 'less') // Disable depth write to avoid warning
        .blend('transparent')
        .cullMode('none')
        .topology('triangle-strip')
        .buildDescriptor();

      expect(descriptor.shader).toBe(mockShader);
      expect(descriptor.label).toBe('TestPipeline');
      expect(descriptor.colorFormat).toBe('rgba8unorm');
      expect(descriptor.depthFormat).toBe('depth24plus');
      expect(descriptor.pipelineState.rasterization?.cullMode).toBe('none');
    });
  });
});
