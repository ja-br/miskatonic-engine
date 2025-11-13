/**
 * High-Level Renderer Tests
 * Epic 3.14: High-Level Rendering API Wrapper
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HighLevelRenderer } from '../../src/highlevel/HighLevelRenderer';
import { Material } from '../../src/highlevel/Material';
import { Mesh } from '../../src/highlevel/Mesh';

describe('HighLevelRenderer', () => {
  let canvas: HTMLCanvasElement;
  let renderer: HighLevelRenderer;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    renderer = new HighLevelRenderer({ canvas });
  });

  describe('Initialization', () => {
    it('should create renderer with canvas', () => {
      expect(renderer).toBeDefined();
      expect(renderer.config.canvas).toBe(canvas);
    });

    it('should have default configuration', () => {
      expect(renderer.config.antialias).toBeUndefined();
      expect(renderer.config.powerPreference).toBeUndefined();
    });

    it('should accept custom configuration', () => {
      const customRenderer = new HighLevelRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
      });
      expect(customRenderer.config.antialias).toBe(true);
      expect(customRenderer.config.powerPreference).toBe('high-performance');
    });

    it('should initialize bufferPool and vramProfiler', () => {
      expect(renderer.bufferPool).toBeDefined();
      expect(renderer.vramProfiler).toBeDefined();
    });
  });

  describe('Resource Management', () => {
    it('should track materials', async () => {
      await renderer.initialize();
      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await renderer.createMaterial(material);

      expect((renderer as any).materials.has(material.id)).toBe(true);
    });

    it('should track meshes', async () => {
      await renderer.initialize();
      const mesh = Mesh.Cube(renderer, 1);
      renderer.createMesh(mesh);

      expect((renderer as any).meshes.has(mesh.id)).toBe(true);
    });

    it('should cache textures', async () => {
      await renderer.initialize();
      const mockImageBitmap = {} as ImageBitmap;

      // Mock loadImage to return same path
      vi.spyOn(global, 'fetch').mockResolvedValue({
        blob: () => Promise.resolve(new Blob()),
      } as Response);

      vi.spyOn(global, 'createImageBitmap').mockResolvedValue(mockImageBitmap);

      const texture1 = await renderer.loadTexture('test.png');
      const texture2 = await renderer.loadTexture('test.png');

      expect(texture1).toBe(texture2); // Same reference = cached
    });
  });

  describe('Frame Management', () => {
    it('should reset stats on beginFrame', async () => {
      await renderer.initialize();
      renderer.beginFrame();

      const privateRenderer = renderer as any;
      expect(privateRenderer.stats.drawCalls).toBe(0);
      expect(privateRenderer.stats.triangles).toBe(0);
    });

    it('should return stats on endFrame', async () => {
      await renderer.initialize();
      renderer.beginFrame();
      const stats = renderer.endFrame();

      expect(stats).toHaveProperty('drawCalls');
      expect(stats).toHaveProperty('triangles');
      expect(stats).toHaveProperty('frameTime');
      expect(stats).toHaveProperty('bindGroupReuseRate');
      expect(stats).toHaveProperty('vramUsedMB');
    });

    it('should track frame time', async () => {
      await renderer.initialize();
      renderer.beginFrame();

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = renderer.endFrame();
      expect(stats.frameTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw if draw called before initialization', () => {
      const mesh = Mesh.Cube(renderer, 1);
      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      const transform = new Float32Array(16);

      expect(() => {
        renderer.draw(mesh, material, transform);
      }).toThrow('HighLevelRenderer not initialized');
    });

    it('should throw if scene bind group not created', async () => {
      await renderer.initialize();
      const privateRenderer = renderer as any;
      privateRenderer.sceneBindGroup = undefined;

      const mesh = Mesh.Cube(renderer, 1);
      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      const transform = new Float32Array(16);

      expect(() => {
        renderer.draw(mesh, material, transform);
      }).toThrow('Scene bind group not created');
    });
  });

  describe('Cleanup', () => {
    it('should dispose all resources', async () => {
      await renderer.initialize();

      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await renderer.createMaterial(material);

      const mesh = Mesh.Cube(renderer, 1);
      renderer.createMesh(mesh);

      renderer.dispose();

      const privateRenderer = renderer as any;
      expect(privateRenderer.materials.size).toBe(0);
      expect(privateRenderer.meshes.size).toBe(0);
      expect(privateRenderer.textureCache.size).toBe(0);
      expect(privateRenderer.initialized).toBe(false);
    });

    it('should clean up scene uniform buffer', async () => {
      await renderer.initialize();
      const privateRenderer = renderer as any;
      const sceneBuffer = privateRenderer.sceneUniformBuffer;
      expect(sceneBuffer).toBeDefined();

      renderer.dispose();
      expect(privateRenderer.sceneUniformBuffer).toBeUndefined();
    });
  });

  describe('Builtin Shaders', () => {
    it('should provide builtin shaders', () => {
      const shaders = renderer.getBuiltinShaders();
      expect(shaders.has('unlit')).toBe(true);
      expect(shaders.has('textured')).toBe(true);
      expect(shaders.has('pbr')).toBe(true);
      expect(shaders.has('toon')).toBe(true);
      expect(shaders.has('transparent')).toBe(true);
    });

    it('should return same shader map instance', () => {
      const shaders1 = renderer.getBuiltinShaders();
      const shaders2 = renderer.getBuiltinShaders();
      expect(shaders1).toBe(shaders2);
    });
  });
});
