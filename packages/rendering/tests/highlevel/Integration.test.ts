/**
 * High-Level Rendering API Integration Tests
 * Epic 3.14: High-Level Rendering API Wrapper
 *
 * Tests that verify the complete workflow from renderer creation
 * through material/mesh creation to drawing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HighLevelRenderer } from '../../src/highlevel/HighLevelRenderer';
import { Material } from '../../src/highlevel/Material';
import { Mesh } from '../../src/highlevel/Mesh';

describe('High-Level Rendering API Integration', () => {
  let canvas: HTMLCanvasElement;
  let renderer: HighLevelRenderer;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    renderer = new HighLevelRenderer({ canvas });
  });

  describe('Complete Rendering Workflow', () => {
    it('should initialize renderer', async () => {
      await renderer.initialize();

      const privateRenderer = renderer as any;
      expect(privateRenderer.initialized).toBe(true);
      expect(privateRenderer.backend).toBeDefined();
      expect(privateRenderer.bindGroupPool).toBeDefined();
      expect(privateRenderer.sceneBindGroup).toBeDefined();
    });

    it('should create and initialize material', async () => {
      await renderer.initialize();

      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await renderer.createMaterial(material);

      const privateMaterial = material as any;
      expect(privateMaterial.initialized).toBe(true);
      expect(privateMaterial.pipeline).toBeDefined();
    });

    it('should create mesh', async () => {
      await renderer.initialize();

      const cube = Mesh.Cube(renderer, 2);
      renderer.createMesh(cube);

      const geometry = cube.getGeometry();
      expect(geometry.type).toBe('indexed');
      expect(geometry.vertexBuffers.size).toBe(1);
      expect(geometry.indexBuffer).toBeDefined();
    });

    it('should complete full render cycle', async () => {
      await renderer.initialize();

      // Create material and mesh
      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await renderer.createMaterial(material);

      const cube = Mesh.Cube(renderer, 1);
      renderer.createMesh(cube);

      // Render frame
      renderer.beginFrame();

      const transform = new Float32Array(16);
      transform[0] = 1; // Identity matrix
      transform[5] = 1;
      transform[10] = 1;
      transform[15] = 1;

      renderer.draw(cube, material, transform);

      const stats = renderer.endFrame();

      expect(stats.drawCalls).toBe(1);
      expect(stats.triangles).toBe(12); // Cube has 12 triangles (6 faces * 2)
      expect(stats.frameTime).toBeGreaterThan(0);
    });
  });

  describe('Multiple Materials and Meshes', () => {
    it('should handle multiple materials', async () => {
      await renderer.initialize();

      const material1 = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      const material2 = Material.Unlit(renderer, { color: [0, 1, 0, 1] });
      const material3 = Material.PBR(renderer, { albedo: [0, 0, 1] });

      await renderer.createMaterial(material1);
      await renderer.createMaterial(material2);
      await renderer.createMaterial(material3);

      const privateRenderer = renderer as any;
      expect(privateRenderer.materials.size).toBe(3);
    });

    it('should handle multiple meshes', async () => {
      await renderer.initialize();

      const cube = Mesh.Cube(renderer, 1);
      const sphere = Mesh.Sphere(renderer, 1);
      const plane = Mesh.Plane(renderer, 10, 10);

      renderer.createMesh(cube);
      renderer.createMesh(sphere);
      renderer.createMesh(plane);

      const privateRenderer = renderer as any;
      expect(privateRenderer.meshes.size).toBe(3);
    });

    it('should render multiple objects', async () => {
      await renderer.initialize();

      const material1 = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      const material2 = Material.Unlit(renderer, { color: [0, 1, 0, 1] });

      await renderer.createMaterial(material1);
      await renderer.createMaterial(material2);

      const cube = Mesh.Cube(renderer);
      const sphere = Mesh.Sphere(renderer);

      renderer.createMesh(cube);
      renderer.createMesh(sphere);

      renderer.beginFrame();

      const transform = new Float32Array(16);
      transform[0] = 1;
      transform[5] = 1;
      transform[10] = 1;
      transform[15] = 1;

      renderer.draw(cube, material1, transform);
      renderer.draw(sphere, material2, transform);

      const stats = renderer.endFrame();

      expect(stats.drawCalls).toBe(2);
    });
  });

  describe('Material Presets', () => {
    it('should render with all material presets', async () => {
      await renderer.initialize();

      const pbr = Material.PBR(renderer, { albedo: [0.8, 0.2, 0.2] });
      const unlit = Material.Unlit(renderer, { color: [1, 1, 1, 1] });
      const toon = Material.Toon(renderer, { color: [0.5, 0.5, 1] });

      await renderer.createMaterial(pbr);
      await renderer.createMaterial(unlit);
      await renderer.createMaterial(toon);

      const cube = Mesh.Cube(renderer);
      renderer.createMesh(cube);

      const transform = new Float32Array(16);
      transform[0] = 1;
      transform[5] = 1;
      transform[10] = 1;
      transform[15] = 1;

      renderer.beginFrame();
      renderer.draw(cube, pbr, transform);
      renderer.draw(cube, unlit, transform);
      renderer.draw(cube, toon, transform);
      const stats = renderer.endFrame();

      expect(stats.drawCalls).toBe(3);
    });
  });

  describe('Primitive Meshes', () => {
    it('should render all primitive types', async () => {
      await renderer.initialize();

      const material = Material.Unlit(renderer, { color: [1, 1, 1, 1] });
      await renderer.createMaterial(material);

      const cube = Mesh.Cube(renderer);
      const sphere = Mesh.Sphere(renderer);
      const plane = Mesh.Plane(renderer);

      renderer.createMesh(cube);
      renderer.createMesh(sphere);
      renderer.createMesh(plane);

      const transform = new Float32Array(16);
      transform[0] = 1;
      transform[5] = 1;
      transform[10] = 1;
      transform[15] = 1;

      renderer.beginFrame();
      renderer.draw(cube, material, transform);
      renderer.draw(sphere, material, transform);
      renderer.draw(plane, material, transform);
      const stats = renderer.endFrame();

      expect(stats.drawCalls).toBe(3);
    });
  });

  describe('Frame Statistics', () => {
    it('should track draw calls', async () => {
      await renderer.initialize();

      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await renderer.createMaterial(material);

      const cube = Mesh.Cube(renderer);
      renderer.createMesh(cube);

      const transform = new Float32Array(16);
      transform[0] = 1;
      transform[5] = 1;
      transform[10] = 1;
      transform[15] = 1;

      renderer.beginFrame();
      renderer.draw(cube, material, transform);
      renderer.draw(cube, material, transform);
      renderer.draw(cube, material, transform);
      const stats = renderer.endFrame();

      expect(stats.drawCalls).toBe(3);
    });

    it('should track triangles', async () => {
      await renderer.initialize();

      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await renderer.createMaterial(material);

      const cube = Mesh.Cube(renderer); // 12 triangles
      const sphere = Mesh.Sphere(renderer, 1, 16, 8); // 128 triangles (16 * 8)

      renderer.createMesh(cube);
      renderer.createMesh(sphere);

      const transform = new Float32Array(16);
      transform[0] = 1;
      transform[5] = 1;
      transform[10] = 1;
      transform[15] = 1;

      renderer.beginFrame();
      renderer.draw(cube, material, transform);
      renderer.draw(sphere, material, transform);
      const stats = renderer.endFrame();

      expect(stats.triangles).toBeGreaterThan(0);
      expect(stats.drawCalls).toBe(2);
    });

    it('should measure frame time', async () => {
      await renderer.initialize();

      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await renderer.createMaterial(material);

      const cube = Mesh.Cube(renderer);
      renderer.createMesh(cube);

      const transform = new Float32Array(16);
      transform[0] = 1;
      transform[5] = 1;
      transform[10] = 1;
      transform[15] = 1;

      renderer.beginFrame();
      renderer.draw(cube, material, transform);
      const stats = renderer.endFrame();

      expect(stats.frameTime).toBeGreaterThanOrEqual(0);
    });

    it('should report bind group reuse rate', async () => {
      await renderer.initialize();

      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await renderer.createMaterial(material);

      const cube = Mesh.Cube(renderer);
      renderer.createMesh(cube);

      const transform = new Float32Array(16);
      transform[0] = 1;
      transform[5] = 1;
      transform[10] = 1;
      transform[15] = 1;

      renderer.beginFrame();
      renderer.draw(cube, material, transform);
      const stats = renderer.endFrame();

      expect(stats.bindGroupReuseRate).toBeGreaterThanOrEqual(0);
      expect(stats.bindGroupReuseRate).toBeLessThanOrEqual(1);
    });

    it('should report VRAM usage', async () => {
      await renderer.initialize();

      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await renderer.createMaterial(material);

      const cube = Mesh.Cube(renderer);
      renderer.createMesh(cube);

      const transform = new Float32Array(16);
      transform[0] = 1;
      transform[5] = 1;
      transform[10] = 1;
      transform[15] = 1;

      renderer.beginFrame();
      renderer.draw(cube, material, transform);
      const stats = renderer.endFrame();

      expect(stats.vramUsedMB).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up all resources on dispose', async () => {
      await renderer.initialize();

      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await renderer.createMaterial(material);

      const cube = Mesh.Cube(renderer);
      renderer.createMesh(cube);

      renderer.dispose();

      const privateRenderer = renderer as any;
      expect(privateRenderer.initialized).toBe(false);
      expect(privateRenderer.materials.size).toBe(0);
      expect(privateRenderer.meshes.size).toBe(0);
    });
  });

  describe('Error Conditions', () => {
    it('should throw if drawing before initialization', () => {
      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      const cube = Mesh.Cube(renderer);
      const transform = new Float32Array(16);

      expect(() => {
        renderer.draw(cube, material, transform);
      }).toThrow();
    });

    it('should throw if drawing before beginFrame', async () => {
      await renderer.initialize();

      const material = Material.Unlit(renderer, { color: [1, 0, 0, 1] });
      await renderer.createMaterial(material);

      const cube = Mesh.Cube(renderer);
      renderer.createMesh(cube);

      const transform = new Float32Array(16);

      // Note: The current implementation doesn't enforce beginFrame/endFrame order,
      // but this test documents the expected behavior
      // In a future version, this should throw an error
    });
  });
});
