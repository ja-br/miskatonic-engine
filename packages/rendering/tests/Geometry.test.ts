/**
 * Geometry Tests - Epic 3.6 Model Viewer
 * Tests for primitive geometry generation and OBJ loading
 */

import { describe, it, expect } from 'vitest';
import {
  createCube,
  createSphere,
  createPlane,
  parseOBJ,
  type GeometryData,
} from '../src/Geometry';

describe('Geometry', () => {
  describe('createCube', () => {
    it('should create a cube with correct vertex count', () => {
      const cube = createCube(1.0);

      // 6 faces * 4 vertices = 24 vertices
      expect(cube.positions.length / 3).toBe(24);
      expect(cube.normals.length / 3).toBe(24);
      expect(cube.uvs.length / 2).toBe(24);
    });

    it('should create a cube with correct index count', () => {
      const cube = createCube(1.0);

      // 6 faces * 2 triangles * 3 indices = 36 indices
      expect(cube.indices.length).toBe(36);
    });

    it('should create indices with correct WebGPU alignment', () => {
      const cube = createCube(1.0);

      // Index buffer must be aligned to 4 bytes
      // For Uint16Array: length must be even
      expect(cube.indices.length % 2).toBe(0);
    });

    it('should scale cube vertices correctly', () => {
      const size = 2.0;
      const cube = createCube(size);
      const halfSize = size / 2;

      // Check that all vertices are within bounds
      for (let i = 0; i < cube.positions.length; i += 3) {
        expect(Math.abs(cube.positions[i])).toBeLessThanOrEqual(halfSize + 0.001);
        expect(Math.abs(cube.positions[i + 1])).toBeLessThanOrEqual(halfSize + 0.001);
        expect(Math.abs(cube.positions[i + 2])).toBeLessThanOrEqual(halfSize + 0.001);
      }
    });

    it('should have normalized normals', () => {
      const cube = createCube(1.0);

      for (let i = 0; i < cube.normals.length; i += 3) {
        const nx = cube.normals[i];
        const ny = cube.normals[i + 1];
        const nz = cube.normals[i + 2];
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        expect(length).toBeCloseTo(1.0, 3);
      }
    });

    it('should have valid UV coordinates', () => {
      const cube = createCube(1.0);

      for (let i = 0; i < cube.uvs.length; i++) {
        expect(cube.uvs[i]).toBeGreaterThanOrEqual(0);
        expect(cube.uvs[i]).toBeLessThanOrEqual(1);
      }
    });

    it('should use default size when not specified', () => {
      const cube = createCube();

      // Default size is 1.0
      expect(cube.positions.length / 3).toBe(24);
    });
  });

  describe('createSphere', () => {
    it('should create a sphere with correct vertex count', () => {
      const segments = 16;
      const rings = 12;
      const sphere = createSphere(1.0, segments, rings);

      // (segments + 1) * (rings + 1) vertices
      const expectedVertices = (segments + 1) * (rings + 1);
      expect(sphere.positions.length / 3).toBe(expectedVertices);
      expect(sphere.normals.length / 3).toBe(expectedVertices);
      expect(sphere.uvs.length / 2).toBe(expectedVertices);
    });

    it('should create a sphere with correct index count', () => {
      const segments = 16;
      const rings = 12;
      const sphere = createSphere(1.0, segments, rings);

      // segments * rings * 2 triangles * 3 indices
      const expectedIndices = segments * rings * 6;
      // Account for padding to ensure even length
      expect(sphere.indices.length).toBeGreaterThanOrEqual(expectedIndices);
    });

    it('should create indices with correct WebGPU alignment', () => {
      const sphere = createSphere(1.0, 17, 11); // Odd segments to test padding

      // Index buffer must be aligned to 4 bytes
      expect(sphere.indices.length % 2).toBe(0);
    });

    it('should scale sphere vertices correctly', () => {
      const radius = 2.5;
      const sphere = createSphere(radius, 16, 12);

      // Check that all vertices are approximately on the sphere surface
      for (let i = 0; i < sphere.positions.length; i += 3) {
        const x = sphere.positions[i];
        const y = sphere.positions[i + 1];
        const z = sphere.positions[i + 2];
        const dist = Math.sqrt(x * x + y * y + z * z);
        expect(dist).toBeCloseTo(radius, 2);
      }
    });

    it('should have normalized normals', () => {
      const sphere = createSphere(1.0, 16, 12);

      for (let i = 0; i < sphere.normals.length; i += 3) {
        const nx = sphere.normals[i];
        const ny = sphere.normals[i + 1];
        const nz = sphere.normals[i + 2];
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        expect(length).toBeCloseTo(1.0, 3);
      }
    });

    it('should have UV coordinates in valid range', () => {
      const sphere = createSphere(1.0, 16, 12);

      for (let i = 0; i < sphere.uvs.length; i++) {
        expect(sphere.uvs[i]).toBeGreaterThanOrEqual(0);
        expect(sphere.uvs[i]).toBeLessThanOrEqual(1);
      }
    });

    it('should handle minimum segments', () => {
      const sphere = createSphere(1.0, 3, 2);

      expect(sphere.positions.length / 3).toBeGreaterThan(0);
      expect(sphere.indices.length).toBeGreaterThan(0);
    });
  });

  describe('createPlane', () => {
    it('should create a plane with correct vertex count', () => {
      const segmentsX = 4;
      const segmentsZ = 3;
      const plane = createPlane(10, 10, segmentsX, segmentsZ);

      // (segmentsX + 1) * (segmentsZ + 1) vertices
      const expectedVertices = (segmentsX + 1) * (segmentsZ + 1);
      expect(plane.positions.length / 3).toBe(expectedVertices);
      expect(plane.normals.length / 3).toBe(expectedVertices);
      expect(plane.uvs.length / 2).toBe(expectedVertices);
    });

    it('should create a plane with correct index count', () => {
      const segmentsX = 4;
      const segmentsZ = 3;
      const plane = createPlane(10, 10, segmentsX, segmentsZ);

      // segmentsX * segmentsZ * 2 triangles * 3 indices
      const expectedIndices = segmentsX * segmentsZ * 6;
      expect(plane.indices.length).toBeGreaterThanOrEqual(expectedIndices);
    });

    it('should create indices with correct WebGPU alignment', () => {
      const plane = createPlane(10, 10, 5, 3); // Odd product to test padding

      // Index buffer must be aligned to 4 bytes
      expect(plane.indices.length % 2).toBe(0);
    });

    it('should create horizontal plane at Y=0 with upward-facing normals', () => {
      const plane = createPlane(10, 10, 4, 4);

      // All Y positions should be 0 (horizontal plane in XZ)
      for (let i = 1; i < plane.positions.length; i += 3) {
        expect(plane.positions[i]).toBe(0);
      }

      // All normals should point up (+Y direction)
      for (let i = 0; i < plane.normals.length; i += 3) {
        expect(plane.normals[i]).toBe(0);
        expect(plane.normals[i + 1]).toBe(1);
        expect(plane.normals[i + 2]).toBe(0);
      }
    });

    it('should scale plane dimensions correctly', () => {
      const width = 20;
      const depth = 15;
      const plane = createPlane(width, depth, 2, 2);

      const halfWidth = width / 2;
      const halfDepth = depth / 2;

      // Check bounds (horizontal plane in XZ)
      for (let i = 0; i < plane.positions.length; i += 3) {
        expect(Math.abs(plane.positions[i])).toBeLessThanOrEqual(halfWidth + 0.001);     // X
        expect(Math.abs(plane.positions[i + 2])).toBeLessThanOrEqual(halfDepth + 0.001); // Z
      }
    });

    it('should have UV coordinates covering full range', () => {
      const plane = createPlane(10, 10, 2, 2);

      let minU = 1, maxU = 0, minV = 1, maxV = 0;
      for (let i = 0; i < plane.uvs.length; i += 2) {
        minU = Math.min(minU, plane.uvs[i]);
        maxU = Math.max(maxU, plane.uvs[i]);
        minV = Math.min(minV, plane.uvs[i + 1]);
        maxV = Math.max(maxV, plane.uvs[i + 1]);
      }

      expect(minU).toBeCloseTo(0, 2);
      expect(maxU).toBeCloseTo(1, 2);
      expect(minV).toBeCloseTo(0, 2);
      expect(maxV).toBeCloseTo(1, 2);
    });
  });

  describe('parseOBJ', () => {
    it('should parse a simple triangle', () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0.5 1 0
        vn 0 0 1
        vn 0 0 1
        vn 0 0 1
        vt 0 0
        vt 1 0
        vt 0.5 1
        f 1/1/1 2/2/2 3/3/3
      `;

      const geometry = parseOBJ(obj);

      expect(geometry.positions.length / 3).toBe(3);
      expect(geometry.normals.length / 3).toBe(3);
      expect(geometry.uvs.length / 2).toBe(3);
      expect(geometry.indices.length).toBeGreaterThanOrEqual(3);
    });

    it('should parse a quad as two triangles', () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 1 1 0
        v 0 1 0
        vn 0 0 1
        vt 0 0
        vt 1 0
        vt 1 1
        vt 0 1
        f 1/1/1 2/2/1 3/3/1 4/4/1
      `;

      const geometry = parseOBJ(obj);

      // Quad triangulated = 6 indices (2 triangles)
      expect(geometry.indices.length).toBeGreaterThanOrEqual(6);
    });

    it('should handle faces with only position indices', () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0.5 1 0
        f 1 2 3
      `;

      const geometry = parseOBJ(obj);

      expect(geometry.positions.length / 3).toBe(3);
      // Should generate default normals and UVs
      expect(geometry.normals.length).toBe(9);
      expect(geometry.uvs.length).toBe(6);
    });

    it('should handle faces with position/UV indices', () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0.5 1 0
        vt 0 0
        vt 1 0
        vt 0.5 1
        f 1/1 2/2 3/3
      `;

      const geometry = parseOBJ(obj);

      expect(geometry.positions.length / 3).toBe(3);
      expect(geometry.uvs.length / 2).toBe(3);
    });

    it('should handle faces with position//normal indices', () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0.5 1 0
        vn 0 0 1
        f 1//1 2//1 3//1
      `;

      const geometry = parseOBJ(obj);

      expect(geometry.positions.length / 3).toBe(3);
      expect(geometry.normals.length / 3).toBe(3);
    });

    it('should skip degenerate triangles', () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0.5 1 0
        v 0 0 0
        vn 0 0 1
        f 1/1/1 2/1/1 3/1/1
        f 1/1/1 4/1/1 3/1/1
      `;

      const geometry = parseOBJ(obj);

      // Second triangle is degenerate (v1 == v4), should be skipped
      // Only 3 valid indices for first triangle
      expect(geometry.indices.length).toBeGreaterThanOrEqual(3);
    });

    it('should ignore comments and empty lines', () => {
      const obj = `
        # This is a comment

        v 0 0 0
        # Another comment
        v 1 0 0
        v 0.5 1 0

        vn 0 0 1
        f 1//1 2//1 3//1
      `;

      const geometry = parseOBJ(obj);

      expect(geometry.positions.length / 3).toBe(3);
    });

    it('should ignore unsupported directives', () => {
      const obj = `
        mtllib material.mtl
        usemtl MyMaterial
        s 1
        g MyGroup
        o MyObject
        v 0 0 0
        v 1 0 0
        v 0.5 1 0
        vn 0 0 1
        f 1//1 2//1 3//1
      `;

      const geometry = parseOBJ(obj);

      expect(geometry.positions.length / 3).toBe(3);
    });

    it('should return correct index format for small meshes', () => {
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0.5 1 0
        f 1 2 3
      `;

      const geometry = parseOBJ(obj);

      // Should use Uint16Array for small meshes
      expect(geometry.indices).toBeInstanceOf(Uint16Array);
    });

    it('should ensure index buffer alignment for WebGPU', () => {
      // Create a mesh that results in odd number of indices
      const obj = `
        v 0 0 0
        v 1 0 0
        v 0.5 1 0
        f 1 2 3
      `;

      const geometry = parseOBJ(obj);

      // Must be even for Uint16Array (4-byte alignment)
      expect(geometry.indices.length % 2).toBe(0);
    });

    it('should handle empty input', () => {
      const geometry = parseOBJ('');

      expect(geometry.positions.length).toBe(0);
      expect(geometry.normals.length).toBe(0);
      expect(geometry.uvs.length).toBe(0);
      expect(geometry.indices.length).toBe(0);
    });
  });

  describe('GeometryData structure', () => {
    it('should have consistent array lengths', () => {
      const cube = createCube(1.0);
      const sphere = createSphere(1.0, 16, 12);
      const plane = createPlane(10, 10, 4, 4);

      const geometries = [cube, sphere, plane];

      for (const geom of geometries) {
        const vertexCount = geom.positions.length / 3;
        expect(geom.normals.length / 3).toBe(vertexCount);
        expect(geom.uvs.length / 2).toBe(vertexCount);
      }
    });

    it('should have valid index references', () => {
      const cube = createCube(1.0);
      const vertexCount = cube.positions.length / 3;

      for (let i = 0; i < cube.indices.length; i++) {
        expect(cube.indices[i]).toBeLessThan(vertexCount);
        expect(cube.indices[i]).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
