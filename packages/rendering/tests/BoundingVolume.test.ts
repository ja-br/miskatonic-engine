/**
 * Bounding Volume Tests - Epic 3.16
 */

import { describe, it, expect } from 'vitest';
import { BoundingSphere, BoundingBox } from '../src/culling/BoundingVolume';

describe('BoundingSphere', () => {
  describe('constructor', () => {
    it('should create sphere with given parameters', () => {
      const sphere = new BoundingSphere(5, 10, 15, 20);

      expect(sphere.x).toBe(5);
      expect(sphere.y).toBe(10);
      expect(sphere.z).toBe(15);
      expect(sphere.radius).toBe(20);
    });

    it('should allow zero radius (point sphere)', () => {
      const sphere = new BoundingSphere(0, 0, 0, 0);
      expect(sphere.radius).toBe(0);
    });

    it('should throw error on negative radius', () => {
      expect(() => {
        new BoundingSphere(0, 0, 0, -5);
      }).toThrow('Sphere radius must be non-negative, got -5');
    });

    it('should accept very small positive radius', () => {
      const sphere = new BoundingSphere(0, 0, 0, 0.001);
      expect(sphere.radius).toBe(0.001);
    });
  });

  describe('intersectsSphere', () => {
    it('should detect overlapping spheres', () => {
      const sphere1 = new BoundingSphere(0, 0, 0, 5);
      const sphere2 = new BoundingSphere(3, 0, 0, 5);

      expect(sphere1.intersectsSphere(sphere2)).toBe(true);
      expect(sphere2.intersectsSphere(sphere1)).toBe(true);
    });

    it('should detect touching spheres', () => {
      const sphere1 = new BoundingSphere(0, 0, 0, 5);
      const sphere2 = new BoundingSphere(10, 0, 0, 5);

      // Distance = 10, radius sum = 10 (exactly touching)
      expect(sphere1.intersectsSphere(sphere2)).toBe(true);
    });

    it('should detect non-intersecting spheres', () => {
      const sphere1 = new BoundingSphere(0, 0, 0, 5);
      const sphere2 = new BoundingSphere(20, 0, 0, 5);

      expect(sphere1.intersectsSphere(sphere2)).toBe(false);
      expect(sphere2.intersectsSphere(sphere1)).toBe(false);
    });

    it('should detect sphere containing another sphere', () => {
      const large = new BoundingSphere(0, 0, 0, 100);
      const small = new BoundingSphere(5, 5, 5, 1);

      expect(large.intersectsSphere(small)).toBe(true);
      expect(small.intersectsSphere(large)).toBe(true);
    });

    it('should handle identical spheres', () => {
      const sphere1 = new BoundingSphere(10, 20, 30, 5);
      const sphere2 = new BoundingSphere(10, 20, 30, 5);

      expect(sphere1.intersectsSphere(sphere2)).toBe(true);
    });
  });

  describe('intersectsAABB', () => {
    it('should detect sphere intersecting box', () => {
      const sphere = new BoundingSphere(0, 0, 0, 5);
      const box = new BoundingBox(-10, -10, -10, 10, 10, 10);

      expect(sphere.intersectsAABB(box)).toBe(true);
    });

    it('should detect sphere outside box', () => {
      const sphere = new BoundingSphere(20, 20, 20, 2);
      const box = new BoundingBox(-10, -10, -10, 10, 10, 10);

      expect(sphere.intersectsAABB(box)).toBe(false);
    });

    it('should detect sphere touching box corner', () => {
      const sphere = new BoundingSphere(15, 15, 15, 5);
      const box = new BoundingBox(-10, -10, -10, 10, 10, 10);

      // Sphere center at (15, 15, 15), radius 5
      // Box corner at (10, 10, 10)
      // Distance = sqrt(25 + 25 + 25) = sqrt(75) ≈ 8.66 > 5
      expect(sphere.intersectsAABB(box)).toBe(false);
    });

    it('should detect sphere touching box face', () => {
      const sphere = new BoundingSphere(15, 0, 0, 6);
      const box = new BoundingBox(-10, -10, -10, 10, 10, 10);

      // Sphere center at (15, 0, 0), radius 6
      // Closest point on box: (10, 0, 0)
      // Distance = 5 < 6
      expect(sphere.intersectsAABB(box)).toBe(true);
    });

    it('should detect sphere inside box', () => {
      const sphere = new BoundingSphere(0, 0, 0, 2);
      const box = new BoundingBox(-10, -10, -10, 10, 10, 10);

      expect(sphere.intersectsAABB(box)).toBe(true);
    });

    it('should detect large sphere encompassing box', () => {
      const sphere = new BoundingSphere(0, 0, 0, 100);
      const box = new BoundingBox(-5, -5, -5, 5, 5, 5);

      expect(sphere.intersectsAABB(box)).toBe(true);
    });
  });

  describe('containsPoint', () => {
    it('should detect point inside sphere', () => {
      const sphere = new BoundingSphere(0, 0, 0, 10);

      expect(sphere.containsPoint(0, 0, 0)).toBe(true);
      expect(sphere.containsPoint(5, 0, 0)).toBe(true);
    });

    it('should detect point on sphere surface', () => {
      const sphere = new BoundingSphere(0, 0, 0, 10);

      expect(sphere.containsPoint(10, 0, 0)).toBe(true);
      expect(sphere.containsPoint(0, 10, 0)).toBe(true);
      expect(sphere.containsPoint(0, 0, 10)).toBe(true);
    });

    it('should detect point outside sphere', () => {
      const sphere = new BoundingSphere(0, 0, 0, 10);

      expect(sphere.containsPoint(15, 0, 0)).toBe(false);
      expect(sphere.containsPoint(100, 100, 100)).toBe(false);
    });
  });

  describe('fromPoint', () => {
    it('should create sphere from position and radius', () => {
      const sphere = BoundingSphere.fromPoint([5, 10, 15], 20);

      expect(sphere.x).toBe(5);
      expect(sphere.y).toBe(10);
      expect(sphere.z).toBe(15);
      expect(sphere.radius).toBe(20);
    });
  });

  describe('fromPoints', () => {
    it('should return null for empty points array', () => {
      const sphere = BoundingSphere.fromPoints([]);
      expect(sphere).toBeNull();
    });

    it('should create sphere from single point', () => {
      const sphere = BoundingSphere.fromPoints([[5, 10, 15]]);

      expect(sphere).not.toBeNull();
      expect(sphere!.x).toBe(5);
      expect(sphere!.y).toBe(10);
      expect(sphere!.z).toBe(15);
      // Degenerate case - zero radius (point)
      expect(sphere!.radius).toBe(0);
    });

    it('should create sphere encompassing multiple points', () => {
      const points: Array<[number, number, number]> = [
        [0, 0, 0],
        [10, 0, 0],
        [0, 10, 0],
        [0, 0, 10],
      ];

      const sphere = BoundingSphere.fromPoints(points);

      expect(sphere).not.toBeNull();
      // Should contain all points
      for (const [x, y, z] of points) {
        expect(sphere!.containsPoint(x, y, z)).toBe(true);
      }
    });
  });

  describe('clone', () => {
    it('should create independent copy', () => {
      const original = new BoundingSphere(5, 10, 15, 20);
      const copy = original.clone();

      expect(copy.x).toBe(original.x);
      expect(copy.y).toBe(original.y);
      expect(copy.z).toBe(original.z);
      expect(copy.radius).toBe(original.radius);
      expect(copy).not.toBe(original);
    });

    it('should not affect original when copy is modified', () => {
      const original = new BoundingSphere(5, 10, 15, 20);
      const copy = original.clone();

      copy.x = 999;
      copy.radius = 1;

      expect(original.x).toBe(5);
      expect(original.radius).toBe(20);
    });
  });
});

describe('BoundingBox', () => {
  describe('constructor', () => {
    it('should create box with given parameters', () => {
      const box = new BoundingBox(-10, -20, -30, 10, 20, 30);

      expect(box.minX).toBe(-10);
      expect(box.minY).toBe(-20);
      expect(box.minZ).toBe(-30);
      expect(box.maxX).toBe(10);
      expect(box.maxY).toBe(20);
      expect(box.maxZ).toBe(30);
    });

    it('should throw error if min > max on X axis', () => {
      expect(() => {
        new BoundingBox(10, 0, 0, 5, 0, 0);
      }).toThrow('Invalid bounding box: min must be <= max');
    });

    it('should throw error if min > max on Y axis', () => {
      expect(() => {
        new BoundingBox(0, 10, 0, 0, 5, 0);
      }).toThrow('Invalid bounding box: min must be <= max');
    });

    it('should throw error if min > max on Z axis', () => {
      expect(() => {
        new BoundingBox(0, 0, 10, 0, 0, 5);
      }).toThrow('Invalid bounding box: min must be <= max');
    });

    it('should allow min == max (degenerate box)', () => {
      const box = new BoundingBox(5, 5, 5, 5, 5, 5);

      expect(box.minX).toBe(5);
      expect(box.maxX).toBe(5);
    });
  });

  describe('intersectsAABB', () => {
    it('should detect overlapping boxes', () => {
      const box1 = new BoundingBox(-10, -10, -10, 10, 10, 10);
      const box2 = new BoundingBox(5, 5, 5, 15, 15, 15);

      expect(box1.intersectsAABB(box2)).toBe(true);
      expect(box2.intersectsAABB(box1)).toBe(true);
    });

    it('should detect touching boxes', () => {
      const box1 = new BoundingBox(-10, -10, -10, 0, 10, 10);
      const box2 = new BoundingBox(0, -10, -10, 10, 10, 10);

      // Boxes touch at X = 0
      expect(box1.intersectsAABB(box2)).toBe(true);
    });

    it('should detect non-intersecting boxes', () => {
      const box1 = new BoundingBox(-10, -10, -10, -5, 10, 10);
      const box2 = new BoundingBox(5, -10, -10, 10, 10, 10);

      expect(box1.intersectsAABB(box2)).toBe(false);
      expect(box2.intersectsAABB(box1)).toBe(false);
    });

    it('should detect box inside another box', () => {
      const large = new BoundingBox(-100, -100, -100, 100, 100, 100);
      const small = new BoundingBox(-5, -5, -5, 5, 5, 5);

      expect(large.intersectsAABB(small)).toBe(true);
      expect(small.intersectsAABB(large)).toBe(true);
    });

    it('should handle identical boxes', () => {
      const box1 = new BoundingBox(-10, -10, -10, 10, 10, 10);
      const box2 = new BoundingBox(-10, -10, -10, 10, 10, 10);

      expect(box1.intersectsAABB(box2)).toBe(true);
    });
  });

  describe('intersectsSphere', () => {
    it('should detect sphere intersecting box', () => {
      const box = new BoundingBox(-10, -10, -10, 10, 10, 10);
      const sphere = new BoundingSphere(0, 0, 0, 5);

      expect(box.intersectsSphere(sphere)).toBe(true);
    });

    it('should detect sphere outside box', () => {
      const box = new BoundingBox(-10, -10, -10, 10, 10, 10);
      const sphere = new BoundingSphere(50, 50, 50, 5);

      expect(box.intersectsSphere(sphere)).toBe(false);
    });
  });

  describe('containsPoint', () => {
    it('should detect point inside box', () => {
      const box = new BoundingBox(-10, -10, -10, 10, 10, 10);

      expect(box.containsPoint(0, 0, 0)).toBe(true);
      expect(box.containsPoint(5, 5, 5)).toBe(true);
    });

    it('should detect point on box boundary', () => {
      const box = new BoundingBox(-10, -10, -10, 10, 10, 10);

      expect(box.containsPoint(-10, 0, 0)).toBe(true);
      expect(box.containsPoint(10, 0, 0)).toBe(true);
      expect(box.containsPoint(0, -10, 0)).toBe(true);
    });

    it('should detect point outside box', () => {
      const box = new BoundingBox(-10, -10, -10, 10, 10, 10);

      expect(box.containsPoint(15, 0, 0)).toBe(false);
      expect(box.containsPoint(0, 0, 100)).toBe(false);
    });
  });

  describe('containsAABB', () => {
    it('should detect box fully inside another box', () => {
      const large = new BoundingBox(-100, -100, -100, 100, 100, 100);
      const small = new BoundingBox(-5, -5, -5, 5, 5, 5);

      expect(large.containsAABB(small)).toBe(true);
      expect(small.containsAABB(large)).toBe(false);
    });

    it('should detect partially overlapping boxes as not contained', () => {
      const box1 = new BoundingBox(-10, -10, -10, 10, 10, 10);
      const box2 = new BoundingBox(5, 5, 5, 15, 15, 15);

      expect(box1.containsAABB(box2)).toBe(false);
      expect(box2.containsAABB(box1)).toBe(false);
    });

    it('should detect identical boxes as contained', () => {
      const box1 = new BoundingBox(-10, -10, -10, 10, 10, 10);
      const box2 = new BoundingBox(-10, -10, -10, 10, 10, 10);

      expect(box1.containsAABB(box2)).toBe(true);
      expect(box2.containsAABB(box1)).toBe(true);
    });
  });

  describe('getCenter', () => {
    it('should compute center of box', () => {
      const box = new BoundingBox(-10, -20, -30, 10, 20, 30);
      const center = box.getCenter();

      expect(center).toEqual([0, 0, 0]);
    });

    it('should compute center of offset box', () => {
      const box = new BoundingBox(5, 10, 15, 15, 20, 25);
      const center = box.getCenter();

      expect(center).toEqual([10, 15, 20]);
    });
  });

  describe('getSize', () => {
    it('should compute size of box', () => {
      const box = new BoundingBox(-10, -20, -30, 10, 20, 30);
      const size = box.getSize();

      expect(size).toEqual([20, 40, 60]);
    });

    it('should return zero size for degenerate box', () => {
      const box = new BoundingBox(5, 5, 5, 5, 5, 5);
      const size = box.getSize();

      expect(size).toEqual([0, 0, 0]);
    });
  });

  describe('fromCenterAndExtents', () => {
    it('should create box from center and half-extents', () => {
      const box = BoundingBox.fromCenterAndExtents([0, 0, 0], [10, 20, 30]);

      expect(box.minX).toBe(-10);
      expect(box.minY).toBe(-20);
      expect(box.minZ).toBe(-30);
      expect(box.maxX).toBe(10);
      expect(box.maxY).toBe(20);
      expect(box.maxZ).toBe(30);
    });

    it('should create box from offset center', () => {
      const box = BoundingBox.fromCenterAndExtents([10, 20, 30], [5, 5, 5]);

      expect(box.minX).toBe(5);
      expect(box.minY).toBe(15);
      expect(box.minZ).toBe(25);
      expect(box.maxX).toBe(15);
      expect(box.maxY).toBe(25);
      expect(box.maxZ).toBe(35);
    });
  });

  describe('fromPoints', () => {
    it('should return null for empty points array', () => {
      const box = BoundingBox.fromPoints([]);
      expect(box).toBeNull();
    });

    it('should create box from single point', () => {
      const box = BoundingBox.fromPoints([[5, 10, 15]]);

      expect(box).not.toBeNull();
      expect(box!.minX).toBe(5);
      expect(box!.minY).toBe(10);
      expect(box!.minZ).toBe(15);
      expect(box!.maxX).toBe(5);
      expect(box!.maxY).toBe(10);
      expect(box!.maxZ).toBe(15);
    });

    it('should create box encompassing multiple points', () => {
      const points: Array<[number, number, number]> = [
        [0, 0, 0],
        [10, 20, 30],
        [-5, -10, -15],
      ];

      const box = BoundingBox.fromPoints(points);

      expect(box).not.toBeNull();
      expect(box!.minX).toBe(-5);
      expect(box!.minY).toBe(-10);
      expect(box!.minZ).toBe(-15);
      expect(box!.maxX).toBe(10);
      expect(box!.maxY).toBe(20);
      expect(box!.maxZ).toBe(30);

      // Should contain all points
      for (const [x, y, z] of points) {
        expect(box!.containsPoint(x, y, z)).toBe(true);
      }
    });
  });

  describe('union', () => {
    it('should expand box to include another box', () => {
      const box1 = new BoundingBox(-10, -10, -10, 10, 10, 10);
      const box2 = new BoundingBox(5, 5, 5, 20, 20, 20);

      const union = box1.union(box2);

      expect(union.minX).toBe(-10);
      expect(union.minY).toBe(-10);
      expect(union.minZ).toBe(-10);
      expect(union.maxX).toBe(20);
      expect(union.maxY).toBe(20);
      expect(union.maxZ).toBe(20);

      // Union should contain both original boxes
      expect(union.containsAABB(box1)).toBe(true);
      expect(union.containsAABB(box2)).toBe(true);
    });

    it('should handle non-overlapping boxes', () => {
      const box1 = new BoundingBox(-10, -10, -10, -5, -5, -5);
      const box2 = new BoundingBox(5, 5, 5, 10, 10, 10);

      const union = box1.union(box2);

      expect(union.minX).toBe(-10);
      expect(union.maxX).toBe(10);
      expect(union.containsAABB(box1)).toBe(true);
      expect(union.containsAABB(box2)).toBe(true);
    });
  });

  describe('clone', () => {
    it('should create independent copy', () => {
      const original = new BoundingBox(-10, -20, -30, 10, 20, 30);
      const copy = original.clone();

      expect(copy.minX).toBe(original.minX);
      expect(copy.minY).toBe(original.minY);
      expect(copy.minZ).toBe(original.minZ);
      expect(copy.maxX).toBe(original.maxX);
      expect(copy.maxY).toBe(original.maxY);
      expect(copy.maxZ).toBe(original.maxZ);
      expect(copy).not.toBe(original);
    });

    it('should not affect original when copy is modified', () => {
      const original = new BoundingBox(-10, -20, -30, 10, 20, 30);
      const copy = original.clone();

      copy.minX = 999;
      copy.maxX = 1000;

      expect(original.minX).toBe(-10);
      expect(original.maxX).toBe(10);
    });
  });
});
