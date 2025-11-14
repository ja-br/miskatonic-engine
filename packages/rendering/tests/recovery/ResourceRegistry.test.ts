/**
 * ResourceRegistry Tests - Epic RENDERING-04, Task 4.2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceRegistry, ResourceType } from '../../src/recovery/ResourceRegistry';
import type {
  ResourceDescriptor,
  BufferDescriptor,
  TextureDescriptor,
  ShaderDescriptor,
  PipelineDescriptor
} from '../../src/recovery/ResourceRegistry';

describe('ResourceRegistry', () => {
  let registry: ResourceRegistry;

  beforeEach(() => {
    registry = new ResourceRegistry();
  });

  describe('Registration', () => {
    it('should register a buffer resource', () => {
      const buffer: BufferDescriptor = {
        type: ResourceType.BUFFER,
        id: 'vertex-buffer-1',
        creationParams: {
          bufferType: 'vertex',
          size: 1024,
          usage: 'static_draw'
        }
      };

      const id = registry.register(buffer);

      expect(id).toBe('vertex-buffer-1');
      expect(registry.has('vertex-buffer-1')).toBe(true);
      expect(registry.get('vertex-buffer-1')).toEqual(buffer);
    });

    it('should register a texture resource', () => {
      const texture: TextureDescriptor = {
        type: ResourceType.TEXTURE,
        id: 'diffuse-map',
        creationParams: {
          width: 512,
          height: 512,
          format: 'rgba'
        }
      };

      registry.register(texture);

      expect(registry.has('diffuse-map')).toBe(true);
      expect(registry.get('diffuse-map')).toEqual(texture);
    });

    it('should register a shader resource', () => {
      const shader: ShaderDescriptor = {
        type: ResourceType.SHADER,
        id: 'pbr-shader',
        creationParams: {
          source: 'struct Vertex { @location(0) position: vec3f };'
        }
      };

      registry.register(shader);

      expect(registry.has('pbr-shader')).toBe(true);
    });

    it('should update existing resource on re-register', () => {
      const buffer1: BufferDescriptor = {
        type: ResourceType.BUFFER,
        id: 'test-buffer',
        creationParams: {
          bufferType: 'vertex',
          size: 1024,
          usage: 'static_draw'
        }
      };

      const buffer2: BufferDescriptor = {
        type: ResourceType.BUFFER,
        id: 'test-buffer',
        creationParams: {
          bufferType: 'vertex',
          size: 2048,
          usage: 'dynamic_draw'
        }
      };

      registry.register(buffer1);
      registry.register(buffer2);

      const retrieved = registry.get('test-buffer') as BufferDescriptor;
      expect(retrieved.creationParams.size).toBe(2048);
    });
  });

  describe('Unregistration', () => {
    it('should unregister a resource', () => {
      const buffer: BufferDescriptor = {
        type: ResourceType.BUFFER,
        id: 'temp-buffer',
        creationParams: {
          bufferType: 'vertex',
          size: 512,
          usage: 'static_draw'
        }
      };

      registry.register(buffer);
      expect(registry.has('temp-buffer')).toBe(true);

      registry.unregister('temp-buffer');
      expect(registry.has('temp-buffer')).toBe(false);
      expect(registry.get('temp-buffer')).toBeUndefined();
    });

    it('should remove from type index on unregister', () => {
      const buffer: BufferDescriptor = {
        type: ResourceType.BUFFER,
        id: 'temp-buffer',
        creationParams: {
          bufferType: 'vertex',
          size: 512,
          usage: 'static_draw'
        }
      };

      registry.register(buffer);
      expect(registry.getTypeCount(ResourceType.BUFFER)).toBe(1);

      registry.unregister('temp-buffer');
      expect(registry.getTypeCount(ResourceType.BUFFER)).toBe(0);
    });

    it('should handle unregister of non-existent resource', () => {
      expect(() => {
        registry.unregister('non-existent');
      }).not.toThrow();
    });
  });

  describe('Query by ID', () => {
    it('should return undefined for non-existent ID', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });

    it('should return correct resource for valid ID', () => {
      const shader: ShaderDescriptor = {
        type: ResourceType.SHADER,
        id: 'test-shader',
        creationParams: {
          source: 'test source'
        }
      };

      registry.register(shader);
      expect(registry.get('test-shader')).toEqual(shader);
    });
  });

  describe('Query by Type', () => {
    beforeEach(() => {
      // Register multiple resources of different types
      registry.register({
        type: ResourceType.BUFFER,
        id: 'buffer-1',
        creationParams: { bufferType: 'vertex', size: 1024, usage: 'static_draw' }
      } as BufferDescriptor);

      registry.register({
        type: ResourceType.BUFFER,
        id: 'buffer-2',
        creationParams: { bufferType: 'index', size: 512, usage: 'static_draw' }
      } as BufferDescriptor);

      registry.register({
        type: ResourceType.TEXTURE,
        id: 'texture-1',
        creationParams: { width: 256, height: 256, format: 'rgba' }
      } as TextureDescriptor);

      registry.register({
        type: ResourceType.SHADER,
        id: 'shader-1',
        creationParams: { source: 'test' }
      } as ShaderDescriptor);
    });

    it('should return all buffers', () => {
      const buffers = registry.getByType(ResourceType.BUFFER);
      expect(buffers).toHaveLength(2);
      expect(buffers.every(b => b.type === ResourceType.BUFFER)).toBe(true);
    });

    it('should return all textures', () => {
      const textures = registry.getByType(ResourceType.TEXTURE);
      expect(textures).toHaveLength(1);
      expect(textures[0].id).toBe('texture-1');
    });

    it('should return empty array for type with no resources', () => {
      const pipelines = registry.getByType(ResourceType.PIPELINE);
      expect(pipelines).toEqual([]);
    });

    it('should return correct count by type', () => {
      expect(registry.getTypeCount(ResourceType.BUFFER)).toBe(2);
      expect(registry.getTypeCount(ResourceType.TEXTURE)).toBe(1);
      expect(registry.getTypeCount(ResourceType.SHADER)).toBe(1);
      expect(registry.getTypeCount(ResourceType.PIPELINE)).toBe(0);
    });
  });

  describe('Get All Resources', () => {
    it('should return empty array when no resources', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered resources', () => {
      registry.register({
        type: ResourceType.BUFFER,
        id: 'buffer-1',
        creationParams: { bufferType: 'vertex', size: 1024, usage: 'static_draw' }
      } as BufferDescriptor);

      registry.register({
        type: ResourceType.TEXTURE,
        id: 'texture-1',
        creationParams: { width: 256, height: 256, format: 'rgba' }
      } as TextureDescriptor);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('Statistics', () => {
    it('should return zero stats for empty registry', () => {
      const stats = registry.getStats();
      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({});
    });

    it('should return correct total count', () => {
      registry.register({
        type: ResourceType.BUFFER,
        id: 'b1',
        creationParams: { bufferType: 'vertex', size: 1024, usage: 'static_draw' }
      } as BufferDescriptor);

      registry.register({
        type: ResourceType.BUFFER,
        id: 'b2',
        creationParams: { bufferType: 'vertex', size: 1024, usage: 'static_draw' }
      } as BufferDescriptor);

      registry.register({
        type: ResourceType.TEXTURE,
        id: 't1',
        creationParams: { width: 256, height: 256, format: 'rgba' }
      } as TextureDescriptor);

      const stats = registry.getStats();
      expect(stats.total).toBe(3);
    });

    it('should return correct breakdown by type', () => {
      registry.register({
        type: ResourceType.BUFFER,
        id: 'b1',
        creationParams: { bufferType: 'vertex', size: 1024, usage: 'static_draw' }
      } as BufferDescriptor);

      registry.register({
        type: ResourceType.BUFFER,
        id: 'b2',
        creationParams: { bufferType: 'vertex', size: 1024, usage: 'static_draw' }
      } as BufferDescriptor);

      registry.register({
        type: ResourceType.TEXTURE,
        id: 't1',
        creationParams: { width: 256, height: 256, format: 'rgba' }
      } as TextureDescriptor);

      registry.register({
        type: ResourceType.SHADER,
        id: 's1',
        creationParams: { source: 'test' }
      } as ShaderDescriptor);

      const stats = registry.getStats();
      expect(stats.byType[ResourceType.BUFFER]).toBe(2);
      expect(stats.byType[ResourceType.TEXTURE]).toBe(1);
      expect(stats.byType[ResourceType.SHADER]).toBe(1);
    });
  });

  describe('Clear', () => {
    it('should clear all resources', () => {
      registry.register({
        type: ResourceType.BUFFER,
        id: 'b1',
        creationParams: { bufferType: 'vertex', size: 1024, usage: 'static_draw' }
      } as BufferDescriptor);

      registry.register({
        type: ResourceType.TEXTURE,
        id: 't1',
        creationParams: { width: 256, height: 256, format: 'rgba' }
      } as TextureDescriptor);

      expect(registry.getStats().total).toBe(2);

      registry.clear();

      expect(registry.getStats().total).toBe(0);
      expect(registry.has('b1')).toBe(false);
      expect(registry.has('t1')).toBe(false);
    });

    it('should clear type index', () => {
      registry.register({
        type: ResourceType.BUFFER,
        id: 'b1',
        creationParams: { bufferType: 'vertex', size: 1024, usage: 'static_draw' }
      } as BufferDescriptor);

      registry.clear();

      expect(registry.getTypeCount(ResourceType.BUFFER)).toBe(0);
      expect(registry.getByType(ResourceType.BUFFER)).toEqual([]);
    });
  });

  describe('Data Storage', () => {
    it('should store buffer data', () => {
      const data = new Float32Array([1, 2, 3, 4]).buffer;
      const buffer: BufferDescriptor = {
        type: ResourceType.BUFFER,
        id: 'data-buffer',
        creationParams: {
          bufferType: 'vertex',
          size: 16,
          usage: 'static_draw'
        },
        data
      };

      registry.register(buffer);

      const retrieved = registry.get('data-buffer') as BufferDescriptor;
      expect(retrieved.data).toBe(data);
    });

    it('should store texture data', () => {
      const data = new Uint8Array([255, 0, 0, 255]).buffer;
      const texture: TextureDescriptor = {
        type: ResourceType.TEXTURE,
        id: 'tex-with-data',
        creationParams: {
          width: 1,
          height: 1,
          format: 'rgba'
        },
        data
      };

      registry.register(texture);

      const retrieved = registry.get('tex-with-data') as TextureDescriptor;
      expect(retrieved.data).toBe(data);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle pipeline with dependencies', () => {
      const shader: ShaderDescriptor = {
        type: ResourceType.SHADER,
        id: 'pbr-shader',
        creationParams: {
          source: 'struct Vertex {};'
        }
      };

      const pipeline: PipelineDescriptor = {
        type: ResourceType.PIPELINE,
        id: 'pbr-pipeline',
        creationParams: {
          shader: 'pbr-shader',
          bindGroupLayouts: ['layout-0', 'layout-1'],
          vertexLayouts: [],
          pipelineState: {} as any
        }
      };

      registry.register(shader);
      registry.register(pipeline);

      expect(registry.has('pbr-shader')).toBe(true);
      expect(registry.has('pbr-pipeline')).toBe(true);

      const retrievedPipeline = registry.get('pbr-pipeline') as PipelineDescriptor;
      expect(retrievedPipeline.creationParams.shader).toBe('pbr-shader');
    });

    it('should maintain consistency after multiple operations', () => {
      // Register resources
      for (let i = 0; i < 10; i++) {
        registry.register({
          type: ResourceType.BUFFER,
          id: `buffer-${i}`,
          creationParams: { bufferType: 'vertex', size: 1024, usage: 'static_draw' }
        } as BufferDescriptor);
      }

      expect(registry.getStats().total).toBe(10);

      // Unregister some
      registry.unregister('buffer-3');
      registry.unregister('buffer-7');

      expect(registry.getStats().total).toBe(8);
      expect(registry.has('buffer-3')).toBe(false);
      expect(registry.has('buffer-0')).toBe(true);

      // Clear and verify
      registry.clear();
      expect(registry.getStats().total).toBe(0);
    });
  });
});
