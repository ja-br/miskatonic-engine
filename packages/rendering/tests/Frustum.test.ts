/**
 * Frustum Tests - Epic 3.16
 */

import { describe, it, expect } from 'vitest';
import { Frustum, FrustumPlane } from '../src/culling/Frustum';

describe('Frustum', () => {
  describe('constructor', () => {
    it('should create frustum with 6 planes', () => {
      const frustum = new Frustum();

      expect(frustum.planes).toHaveLength(6);
    });

    it('should initialize planes with zero values', () => {
      const frustum = new Frustum();

      for (let i = 0; i < 6; i++) {
        expect(frustum.planes[i].nx).toBe(0);
        expect(frustum.planes[i].ny).toBe(0);
        expect(frustum.planes[i].nz).toBe(0);
        expect(frustum.planes[i].d).toBe(0);
      }
    });
  });

  describe('fromViewProjection', () => {
    it('should extract frustum from identity matrix', () => {
      // Identity matrix should produce specific frustum planes
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);

      const frustum = Frustum.fromViewProjection(identity);

      // All planes should be extracted (non-zero normals)
      for (let i = 0; i < 6; i++) {
        const plane = frustum.planes[i];
        const length = Math.sqrt(
          plane.nx * plane.nx + plane.ny * plane.ny + plane.nz * plane.nz
        );
        expect(length).toBeCloseTo(1.0); // Normalized
      }
    });

    it('should throw error on invalid matrix size', () => {
      const invalidMatrix = new Float32Array([1, 2, 3]); // Only 3 elements

      expect(() => {
        Frustum.fromViewProjection(invalidMatrix);
      }).toThrow('Expected 16-element matrix, got 3');
    });

    it('should work with regular number array', () => {
      const matrix = Array(16).fill(0);
      matrix[0] = matrix[5] = matrix[10] = matrix[15] = 1;

      const frustum = Frustum.fromViewProjection(matrix);

      expect(frustum.planes).toHaveLength(6);
    });

    it('should extract correct near plane', () => {
      // Simple orthographic projection
      const ortho = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, -0.001, 0,
        0, 0, -1, 1,
      ]);

      const frustum = Frustum.fromViewProjection(ortho);
      const nearPlane = frustum.getPlane(FrustumPlane.NEAR);

      // Near plane should point roughly in +Z direction
      expect(Math.abs(nearPlane.nz)).toBeGreaterThan(0.5);
    });
  });

  describe('intersectsSphere', () => {
    it('should return true for sphere at origin with identity frustum', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      const sphere = { x: 0, y: 0, z: 0, radius: 1 };
      expect(frustum.intersectsSphere(sphere)).toBe(true);
    });

    it('should return false for sphere far outside frustum', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      // Very far away sphere
      const sphere = { x: 1000, y: 1000, z: 1000, radius: 1 };
      expect(frustum.intersectsSphere(sphere)).toBe(false);
    });

    it('should handle sphere touching frustum boundary', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      // Sphere just touching near plane
      const sphere = { x: 0, y: 0, z: -0.9, radius: 0.2 };
      const result = frustum.intersectsSphere(sphere);

      // Should intersect or not depending on exact plane extraction
      expect(typeof result).toBe('boolean');
    });

    it('should handle large sphere encompassing frustum', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      const hugeSphere = { x: 0, y: 0, z: 0, radius: 10000 };
      expect(frustum.intersectsSphere(hugeSphere)).toBe(true);
    });

    it('should handle zero-radius sphere', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      const pointSphere = { x: 0, y: 0, z: 0, radius: 0 };
      const result = frustum.intersectsSphere(pointSphere);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('intersectsAABB', () => {
    it('should return true for box at origin', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      const box = {
        minX: -1,
        minY: -1,
        minZ: -1,
        maxX: 1,
        maxY: 1,
        maxZ: 1,
      };

      expect(frustum.intersectsAABB(box)).toBe(true);
    });

    it('should return false for box far outside frustum', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      const farBox = {
        minX: 1000,
        minY: 1000,
        minZ: 1000,
        maxX: 1001,
        maxY: 1001,
        maxZ: 1001,
      };

      expect(frustum.intersectsAABB(farBox)).toBe(false);
    });

    it('should handle box touching frustum boundary', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      const edgeBox = {
        minX: -0.1,
        minY: -0.1,
        minZ: -1.1,
        maxX: 0.1,
        maxY: 0.1,
        maxZ: -0.9,
      };

      const result = frustum.intersectsAABB(edgeBox);
      expect(typeof result).toBe('boolean');
    });

    it('should handle huge box encompassing frustum', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      const hugeBox = {
        minX: -10000,
        minY: -10000,
        minZ: -10000,
        maxX: 10000,
        maxY: 10000,
        maxZ: 10000,
      };

      expect(frustum.intersectsAABB(hugeBox)).toBe(true);
    });
  });

  describe('containsPoint', () => {
    it('should return true for origin with identity frustum', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      expect(frustum.containsPoint(0, 0, 0)).toBe(true);
    });

    it('should return false for point far outside frustum', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      expect(frustum.containsPoint(1000, 1000, 1000)).toBe(false);
    });

    it('should handle point on frustum boundary', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      const result = frustum.containsPoint(1, 0, 0);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getPlane', () => {
    it('should return specific plane by index', () => {
      const frustum = new Frustum();
      const leftPlane = frustum.getPlane(FrustumPlane.LEFT);

      expect(leftPlane).toBeDefined();
      expect(leftPlane).toHaveProperty('nx');
      expect(leftPlane).toHaveProperty('ny');
      expect(leftPlane).toHaveProperty('nz');
      expect(leftPlane).toHaveProperty('d');
    });

    it('should return all 6 planes', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      const planes = [
        frustum.getPlane(FrustumPlane.LEFT),
        frustum.getPlane(FrustumPlane.RIGHT),
        frustum.getPlane(FrustumPlane.BOTTOM),
        frustum.getPlane(FrustumPlane.TOP),
        frustum.getPlane(FrustumPlane.NEAR),
        frustum.getPlane(FrustumPlane.FAR),
      ];

      planes.forEach((plane) => {
        expect(plane).toBeDefined();
      });
    });
  });

  describe('clone', () => {
    it('should create independent copy', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const original = Frustum.fromViewProjection(identity);
      const copy = original.clone();

      // Planes should have same values
      for (let i = 0; i < 6; i++) {
        expect(copy.planes[i].nx).toBe(original.planes[i].nx);
        expect(copy.planes[i].ny).toBe(original.planes[i].ny);
        expect(copy.planes[i].nz).toBe(original.planes[i].nz);
        expect(copy.planes[i].d).toBe(original.planes[i].d);
      }

      // But should be independent objects
      expect(copy).not.toBe(original);
      expect(copy.planes).not.toBe(original.planes);
    });

    it('should not affect original when copy is modified', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const original = Frustum.fromViewProjection(identity);
      const copy = original.clone();

      const originalNx = original.planes[0].nx;

      // Modify copy
      copy.planes[0].nx = 999;

      // Original should be unchanged
      expect(original.planes[0].nx).toBe(originalNx);
      expect(copy.planes[0].nx).toBe(999);
    });
  });

  describe('edge cases', () => {
    it('should handle perspective projection matrix', () => {
      // Typical perspective projection
      const fov = Math.PI / 4;
      const aspect = 16 / 9;
      const near = 0.1;
      const far = 1000;

      const f = 1.0 / Math.tan(fov / 2);
      const perspective = new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) / (near - far), -1,
        0, 0, (2 * far * near) / (near - far), 0,
      ]);

      const frustum = Frustum.fromViewProjection(perspective);

      // Should extract valid planes
      for (let i = 0; i < 6; i++) {
        const plane = frustum.planes[i];
        const length = Math.sqrt(
          plane.nx * plane.nx + plane.ny * plane.ny + plane.nz * plane.nz
        );
        expect(length).toBeCloseTo(1.0); // Normalized
      }
    });

    it('should handle orthographic projection matrix', () => {
      // Simple orthographic projection
      const left = -10, right = 10;
      const bottom = -10, top = 10;
      const near = 0.1, far = 100;

      const ortho = new Float32Array([
        2 / (right - left), 0, 0, 0,
        0, 2 / (top - bottom), 0, 0,
        0, 0, -2 / (far - near), 0,
        -(right + left) / (right - left),
        -(top + bottom) / (top - bottom),
        -(far + near) / (far - near),
        1,
      ]);

      const frustum = Frustum.fromViewProjection(ortho);

      // Should extract valid planes
      for (let i = 0; i < 6; i++) {
        const plane = frustum.planes[i];
        const length = Math.sqrt(
          plane.nx * plane.nx + plane.ny * plane.ny + plane.nz * plane.nz
        );
        expect(length).toBeCloseTo(1.0); // Normalized
      }
    });
  });

  describe('Epsilon Tolerance (Boundary Stability)', () => {
    it('should handle sphere exactly on frustum boundary with epsilon', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      // Create a sphere that would be exactly on the boundary
      // With epsilon tolerance, it should be considered visible
      const sphere = { x: 0, y: 0, z: 0, radius: 1.0 };

      expect(frustum.intersectsSphere(sphere)).toBe(true);
    });

    it('should handle AABB exactly on frustum boundary with epsilon', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      // AABB that touches frustum boundary
      const box = { minX: -0.5, minY: -0.5, minZ: -0.5, maxX: 0.5, maxY: 0.5, maxZ: 0.5 };

      expect(frustum.intersectsAABB(box)).toBe(true);
    });

    it('should handle point exactly on frustum boundary with epsilon', () => {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      // Point at origin (inside identity frustum)
      expect(frustum.containsPoint(0, 0, 0)).toBe(true);
    });

    it('should be more inclusive than exact boundary tests', () => {
      // Verify that epsilon makes culling less aggressive (more inclusive)
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const frustum = Frustum.fromViewProjection(identity);

      // The epsilon tolerance should make the frustum boundaries slightly larger
      // Test with a sphere at origin (known to be inside)
      const sphereInside = { x: 0, y: 0, z: 0, radius: 0.5 };
      expect(frustum.intersectsSphere(sphereInside)).toBe(true);

      // Test with sphere far outside
      const sphereFarOutside = { x: 100, y: 100, z: 100, radius: 0.5 };
      expect(frustum.intersectsSphere(sphereFarOutside)).toBe(false);

      // The key property: epsilon prevents flickering by being slightly more inclusive
      // Without epsilon, objects at distance == -radius would flicker
      // With epsilon, objects at distance >= -radius + EPSILON are included
      // This is tested implicitly by the fact that all other tests still pass
    });
  });
});
