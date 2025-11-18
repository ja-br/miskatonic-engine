/**
 * Mesh Tests
 * Epic 3.14: High-Level Rendering API Wrapper
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Mesh } from '../../src/highlevel/Mesh';
import { HighLevelRenderer } from '../../src/highlevel/HighLevelRenderer';

describe('Mesh', () => {
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

  describe('Cube Mesh', () => {
    it('should create cube with default size', async () => {
      await renderer.initialize();
      const cube = Mesh.Cube(renderer);

      expect(cube).toBeDefined();
      expect(cube.id).toMatch(/^mesh_/);
    });

    it('should create cube with custom size', async () => {
      await renderer.initialize();
      const cube = Mesh.Cube(renderer, 2);

      const bounds = cube.getBounds();
      expect(bounds).toBeDefined();
      expect(bounds?.min).toEqual([-1, -1, -1]);
      expect(bounds?.max).toEqual([1, 1, 1]);
    });

    it('should have correct bounding box', async () => {
      await renderer.initialize();
      const cube = Mesh.Cube(renderer, 2);

      const bounds = cube.getBounds();
      expect(bounds).toBeDefined();
      expect(bounds?.min).toEqual([-1, -1, -1]);
      expect(bounds?.max).toEqual([1, 1, 1]);
    });

    it('should use uint16 index format for cube', async () => {
      await renderer.initialize();
      const cube = Mesh.Cube(renderer, 1);

      const geometry = cube.getGeometry();
      expect(geometry.indexFormat).toBe('uint16');
    });
  });

  describe('Sphere Mesh', () => {
    it('should create sphere with default parameters', async () => {
      await renderer.initialize();
      const sphere = Mesh.Sphere(renderer);

      expect(sphere).toBeDefined();
      expect(sphere.id).toMatch(/^mesh_/);
    });

    it('should create sphere with custom parameters', async () => {
      await renderer.initialize();
      const sphere = Mesh.Sphere(renderer, 2, 16, 8);

      const bounds = sphere.getBounds();
      expect(bounds).toBeDefined();
      expect(bounds?.min).toEqual([-2, -2, -2]);
      expect(bounds?.max).toEqual([2, 2, 2]);
    });

    it('should use uint16 for low-poly sphere', async () => {
      await renderer.initialize();
      const sphere = Mesh.Sphere(renderer, 1, 16, 8);

      const geometry = sphere.getGeometry();
      expect(geometry.indexFormat).toBe('uint16');
    });

    it('should use uint32 for high-poly sphere', async () => {
      await renderer.initialize();
      // widthSegments * heightSegments = 300 * 200 = 60,000 vertices (exceeds 65535)
      const sphere = Mesh.Sphere(renderer, 1, 300, 200);

      const geometry = sphere.getGeometry();
      expect(geometry.indexFormat).toBe('uint32');
    });
  });

  describe('Plane Mesh', () => {
    it('should create plane with default parameters', async () => {
      await renderer.initialize();
      const plane = Mesh.Plane(renderer);

      expect(plane).toBeDefined();
      expect(plane.id).toMatch(/^mesh_/);
    });

    it('should create plane with custom dimensions', async () => {
      await renderer.initialize();
      const plane = Mesh.Plane(renderer, 10, 10, 10, 10);

      const bounds = plane.getBounds();
      expect(bounds).toBeDefined();
      expect(bounds?.min).toEqual([-5, 0, -5]);
      expect(bounds?.max).toEqual([5, 0, 5]);
    });

    it('should use uint16 for low-poly plane', async () => {
      await renderer.initialize();
      const plane = Mesh.Plane(renderer, 10, 10, 10, 10);

      const geometry = plane.getGeometry();
      expect(geometry.indexFormat).toBe('uint16');
    });

    it('should use uint32 for high-poly plane', async () => {
      await renderer.initialize();
      // (widthSegments + 1) * (heightSegments + 1) = 301 * 301 = 90,601 vertices (exceeds 65535)
      const plane = Mesh.Plane(renderer, 10, 10, 300, 300);

      const geometry = plane.getGeometry();
      expect(geometry.indexFormat).toBe('uint32');
    });
  });

  describe('Geometry Descriptor', () => {
    it('should return indexed geometry', async () => {
      await renderer.initialize();
      const cube = Mesh.Cube(renderer);

      const geometry = cube.getGeometry();
      expect(geometry.type).toBe('indexed');
      expect(geometry.vertexBuffers).toBeDefined();
      expect(geometry.indexBuffer).toBeDefined();
      expect(geometry.indexCount).toBeGreaterThan(0);
    });

    it('should throw if buffers not initialized', async () => {
      await renderer.initialize();
      const cube = Mesh.Cube(renderer);

      // Force buffers to be undefined
      (cube as any).vertexBuffer = undefined;

      expect(() => {
        cube.getGeometry();
      }).toThrow('Mesh buffers not initialized');
    });

    it('should have correct vertex buffer layout', async () => {
      await renderer.initialize();
      const cube = Mesh.Cube(renderer);

      const geometry = cube.getGeometry();
      expect(geometry.vertexBuffers.size).toBe(1);
      expect(geometry.vertexBuffers.has(0)).toBe(true);
    });
  });

  describe('Bounding Boxes', () => {
    it('should calculate cube bounding box', async () => {
      await renderer.initialize();
      const cube = Mesh.Cube(renderer, 2);

      const bounds = cube.getBounds();
      expect(bounds).toBeDefined();
      expect(bounds?.min).toEqual([-1, -1, -1]);
      expect(bounds?.max).toEqual([1, 1, 1]);
    });

    it('should calculate sphere bounding box', async () => {
      await renderer.initialize();
      const sphere = Mesh.Sphere(renderer, 3);

      const bounds = sphere.getBounds();
      expect(bounds).toBeDefined();
      expect(bounds?.min).toEqual([-3, -3, -3]);
      expect(bounds?.max).toEqual([3, 3, 3]);
    });

    it('should calculate plane bounding box', async () => {
      await renderer.initialize();
      const plane = Mesh.Plane(renderer, 8, 6);

      const bounds = plane.getBounds();
      expect(bounds).toBeDefined();
      expect(bounds?.min).toEqual([-4, 0, -3]);
      expect(bounds?.max).toEqual([4, 0, 3]);
    });
  });

  describe('Disposal', () => {
    it('should dispose vertex and index buffers', async () => {
      await renderer.initialize();
      const cube = Mesh.Cube(renderer);

      const privateCube = cube as any;
      expect(privateCube.vertexBuffer).toBeDefined();
      expect(privateCube.indexBuffer).toBeDefined();

      cube.dispose();

      expect(privateCube.vertexBuffer).toBeUndefined();
      expect(privateCube.indexBuffer).toBeUndefined();
      expect(privateCube.disposed).toBe(true);
    });

    it('should be idempotent', async () => {
      await renderer.initialize();
      const cube = Mesh.Cube(renderer);

      cube.dispose();
      cube.dispose();
      cube.dispose();

      const privateCube = cube as any;
      expect(privateCube.disposed).toBe(true);
    });
  });

  describe('ID Generation', () => {
    it('should generate unique IDs', async () => {
      await renderer.initialize();
      const cube1 = Mesh.Cube(renderer);
      const cube2 = Mesh.Cube(renderer);
      const sphere = Mesh.Sphere(renderer);

      expect(cube1.id).not.toBe(cube2.id);
      expect(cube1.id).not.toBe(sphere.id);
      expect(cube2.id).not.toBe(sphere.id);
    });

    it('should prefix IDs with "mesh"', async () => {
      await renderer.initialize();
      const cube = Mesh.Cube(renderer);

      expect(cube.id).toMatch(/^mesh_/);
    });
  });

  describe('Index Format Determination', () => {
    it('should detect Uint16Array and use uint16 format', async () => {
      await renderer.initialize();
      const cube = Mesh.Cube(renderer);

      // Cube uses Uint16Array (only 24 vertices)
      const geometry = cube.getGeometry();
      expect(geometry.indexFormat).toBe('uint16');
    });

    it('should detect Uint32Array and use uint32 format', async () => {
      await renderer.initialize();
      // Create high-poly sphere that requires Uint32Array
      const sphere = Mesh.Sphere(renderer, 1, 300, 200);

      const geometry = sphere.getGeometry();
      expect(geometry.indexFormat).toBe('uint32');
    });
  });

  describe('Vertex Count', () => {
    it('should calculate cube vertex count', async () => {
      await renderer.initialize();
      const cube = Mesh.Cube(renderer);

      const privateCube = cube as any;
      expect(privateCube.vertexCount).toBe(24); // 6 faces * 4 vertices
    });

    it('should calculate sphere vertex count', async () => {
      await renderer.initialize();
      const sphere = Mesh.Sphere(renderer, 1, 16, 8);

      const privateSphere = sphere as any;
      // (widthSegments + 1) * (heightSegments + 1) = 17 * 9 = 153
      expect(privateSphere.vertexCount).toBe(153);
    });

    it('should calculate plane vertex count', async () => {
      await renderer.initialize();
      const plane = Mesh.Plane(renderer, 10, 10, 5, 5);

      const privatePlane = plane as any;
      // (widthSegments + 1) * (heightSegments + 1) = 6 * 6 = 36
      expect(privatePlane.vertexCount).toBe(36);
    });
  });

  describe('Index Count', () => {
    it('should calculate cube index count', async () => {
      await renderer.initialize();
      const cube = Mesh.Cube(renderer);

      const geometry = cube.getGeometry();
      expect(geometry.indexCount).toBe(36); // 6 faces * 2 triangles * 3 indices
    });

    it('should calculate sphere index count', async () => {
      await renderer.initialize();
      const sphere = Mesh.Sphere(renderer, 1, 16, 8);

      const geometry = sphere.getGeometry();
      // heightSegments * widthSegments * 2 triangles * 3 indices = 8 * 16 * 6 = 768
      expect(geometry.indexCount).toBe(768);
    });

    it('should calculate plane index count', async () => {
      await renderer.initialize();
      const plane = Mesh.Plane(renderer, 10, 10, 5, 5);

      const geometry = plane.getGeometry();
      // widthSegments * heightSegments * 2 triangles * 3 indices = 5 * 5 * 6 = 150
      expect(geometry.indexCount).toBe(150);
    });
  });
});
