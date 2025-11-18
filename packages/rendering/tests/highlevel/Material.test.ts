/**
 * Material Tests
 * Epic 3.14: High-Level Rendering API Wrapper
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Material } from '../../src/highlevel/Material';
import { HighLevelRenderer } from '../../src/highlevel/HighLevelRenderer';

describe('Material', () => {
  let renderer: HighLevelRenderer;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    // Mock document
    const mockCanvas = {
      getContext: vi.fn(() => null),
      width: 800,
      height: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const mockDocument = {
      createElement: vi.fn((tag: string) => {
        if (tag === 'canvas') {
          return mockCanvas;
        }
        return {};
      }),
      getElementById: vi.fn(() => null),
    };
    vi.stubGlobal('document', mockDocument);

    canvas = document.createElement('canvas') as any;
    canvas.width = 800;
    canvas.height = 600;
    renderer = new HighLevelRenderer({ canvas });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Factory Methods', () => {
    it('should create PBR material', () => {
      const material = Material.PBR(renderer, {
        albedo: [0.8, 0.2, 0.2],
        metallic: 0.9,
        roughness: 0.1,
      });

      expect(material).toBeDefined();
      expect(material.config.shader).toBe('pbr');
      expect(material.config.uniforms?.albedo.value).toEqual([0.8, 0.2, 0.2]);
      expect(material.config.uniforms?.metallic.value).toBe(0.9);
      expect(material.config.uniforms?.roughness.value).toBe(0.1);
    });

    it('should create Unlit material', () => {
      const material = Material.Unlit(renderer, {
        color: [1, 0, 0, 1],
      });

      expect(material).toBeDefined();
      expect(material.config.shader).toBe('unlit');
      expect(material.config.uniforms?.color.value).toEqual([1, 0, 0, 1]);
    });

    it('should create Textured material', () => {
      const material = Material.Textured(renderer, {
        texture: 'test.png',
        tint: [1, 1, 1, 1],
      });

      expect(material).toBeDefined();
      expect(material.config.shader).toBe('textured');
      expect(material.config.textures?.colorMap.texture).toBe('test.png');
    });

    it('should create Transparent material', () => {
      const material = Material.Transparent(renderer, {
        texture: 'glass.png',
        opacity: 0.5,
      });

      expect(material).toBeDefined();
      expect(material.config.shader).toBe('transparent');
      expect(material.config.uniforms?.opacity.value).toBe(0.5);
    });

    it('should create Toon material', () => {
      const material = Material.Toon(renderer, {
        color: [0.2, 0.6, 1.0],
        bands: 4,
      });

      expect(material).toBeDefined();
      expect(material.config.shader).toBe('toon');
      expect(material.config.uniforms?.color.value).toEqual([0.2, 0.6, 1.0]);
      expect(material.config.uniforms?.bands.value).toBe(4);
    });
  });

  describe('Default Values', () => {
    it('should use default metallic for PBR', () => {
      const material = Material.PBR(renderer, {
        albedo: [1, 1, 1],
      });

      expect(material.config.uniforms?.metallic.value).toBe(0.5);
      expect(material.config.uniforms?.roughness.value).toBe(0.5);
    });

    it('should use default color for Unlit', () => {
      const material = Material.Unlit(renderer, {});

      expect(material.config.uniforms?.color.value).toEqual([1, 1, 1, 1]);
    });

    it('should use default tint for Textured', () => {
      const material = Material.Textured(renderer, {
        texture: 'test.png',
      });

      expect(material.config.uniforms?.tint.value).toEqual([1, 1, 1, 1]);
    });

    it('should use default opacity for Transparent', () => {
      const material = Material.Transparent(renderer, {
        texture: 'glass.png',
      });

      expect(material.config.uniforms?.opacity.value).toBe(1.0);
    });

    it('should use default bands for Toon', () => {
      const material = Material.Toon(renderer, {
        color: [1, 1, 1],
      });

      expect(material.config.uniforms?.bands.value).toBe(3);
    });
  });

  describe('Pipeline States', () => {
    it('should use opaque pipeline for PBR', () => {
      const material = Material.PBR(renderer, { albedo: [1, 1, 1] });
      expect(material.config.pipelineState).toBe('opaque');
    });

    it('should use opaque pipeline for Unlit', () => {
      const material = Material.Unlit(renderer, { color: [1, 1, 1, 1] });
      expect(material.config.pipelineState).toBe('opaque');
    });

    it('should use opaque pipeline for Textured', () => {
      const material = Material.Textured(renderer, { texture: 'test.png' });
      expect(material.config.pipelineState).toBe('opaque');
    });

    it('should use transparent pipeline for Transparent', () => {
      const material = Material.Transparent(renderer, { texture: 'glass.png' });
      expect(material.config.pipelineState).toBe('transparent');
    });

    it('should use opaque pipeline for Toon', () => {
      const material = Material.Toon(renderer, { color: [1, 1, 1] });
      expect(material.config.pipelineState).toBe('opaque');
    });
  });

  describe('Uniform Setters', () => {
    it('should set uniform value', async () => {
      await renderer.initialize();
      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await material.initialize();

      material.setUniform('color', [0, 1, 0, 1]);

      const privateData = (material as any).uniformData.get('color');
      expect(privateData.value).toEqual([0, 1, 0, 1]);
    });

    it('should throw if uniform does not exist', async () => {
      await renderer.initialize();
      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await material.initialize();

      expect(() => {
        material.setUniform('nonexistent', 1.0);
      }).toThrow("Uniform 'nonexistent' not found");
    });

    it('should mark dirty when uniform is set', async () => {
      await renderer.initialize();
      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await material.initialize();

      material.setUniform('color', [0, 1, 0, 1]);

      const privateMaterial = material as any;
      expect(privateMaterial.dirty.has('uniforms')).toBe(true);
    });
  });

  describe('Texture Management', () => {
    it('should accept texture string in PBR', () => {
      const material = Material.PBR(renderer, {
        albedo: 'albedo.png',
      });

      expect(typeof material.config.textures?.albedoMap?.texture).toBe('string');
    });

    it('should accept normal map in PBR', () => {
      const material = Material.PBR(renderer, {
        albedo: [1, 1, 1],
        normal: 'normal.png',
      });

      expect(material.config.textures?.normalMap?.texture).toBe('normal.png');
    });

    it('should accept AO map in PBR', () => {
      const material = Material.PBR(renderer, {
        albedo: [1, 1, 1],
        ao: 'ao.png',
      });

      expect(material.config.textures?.aoMap?.texture).toBe('ao.png');
    });
  });

  describe('Label', () => {
    it('should have label for PBR', () => {
      const material = Material.PBR(renderer, { albedo: [1, 1, 1] });
      expect(material.config.label).toBe('PBR_Material');
    });

    it('should have label for Unlit', () => {
      const material = Material.Unlit(renderer, { color: [1, 1, 1, 1] });
      expect(material.config.label).toBe('Unlit_Material');
    });

    it('should have label for Textured', () => {
      const material = Material.Textured(renderer, { texture: 'test.png' });
      expect(material.config.label).toBe('Textured_Material');
    });

    it('should have label for Transparent', () => {
      const material = Material.Transparent(renderer, { texture: 'glass.png' });
      expect(material.config.label).toBe('Transparent_Material');
    });

    it('should have label for Toon', () => {
      const material = Material.Toon(renderer, { color: [1, 1, 1] });
      expect(material.config.label).toBe('Toon_Material');
    });
  });

  describe('Initialization', () => {
    it('should not be initialized on creation', () => {
      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      const privateMaterial = material as any;
      expect(privateMaterial.initialized).toBe(false);
    });

    it('should be idempotent', async () => {
      await renderer.initialize();
      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });

      await material.initialize();
      await material.initialize();
      await material.initialize();

      const privateMaterial = material as any;
      expect(privateMaterial.initialized).toBe(true);
    });

    it('should clean up on initialization failure', async () => {
      await renderer.initialize();

      // Create material with invalid shader to force failure
      const material = new Material(renderer, {
        shader: 'nonexistent_shader',
        uniforms: {},
      });

      await expect(material.initialize()).rejects.toThrow();

      const privateMaterial = material as any;
      expect(privateMaterial.initialized).toBe(false);
    });
  });

  describe('Disposal', () => {
    it('should clean up uniform buffers', async () => {
      await renderer.initialize();
      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await material.initialize();

      const privateMaterial = material as any;
      const bufferCountBefore = privateMaterial.uniformBuffers.size;
      expect(bufferCountBefore).toBeGreaterThan(0);

      material.dispose();

      expect(privateMaterial.uniformBuffers.size).toBe(0);
      expect(privateMaterial.initialized).toBe(false);
    });

    it('should release bind group back to pool', async () => {
      await renderer.initialize();
      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await material.initialize();

      // Trigger bind group creation
      const sceneBindGroup = (renderer as any).sceneBindGroup;
      material.prepare(sceneBindGroup);

      const privateMaterial = material as any;
      const bindGroupId = privateMaterial.materialBindGroupId;
      expect(bindGroupId).toBeDefined();

      material.dispose();

      expect(privateMaterial.materialBindGroupId).toBeUndefined();
    });
  });
});
