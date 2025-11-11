/**
 * Light Component Tests - Epic 3.15
 */

import { describe, it, expect } from 'vitest';
import { Light } from '../src/components/Light';

describe('Light Component', () => {
  describe('constructor', () => {
    it('should create with default directional light', () => {
      const light = new Light();

      expect(light.type).toBe(0); // Directional
      expect(light.enabled).toBe(1);
      expect(light.colorR).toBe(1.0);
      expect(light.colorG).toBe(1.0);
      expect(light.colorB).toBe(1.0);
      expect(light.intensity).toBe(1.0);
    });

    it('should create with custom color and intensity', () => {
      const light = new Light(0, 0.8, 0.6, 0.4, 2.5);

      expect(light.type).toBe(0);
      expect(light.colorR).toBe(0.8);
      expect(light.colorG).toBe(0.6);
      expect(light.colorB).toBe(0.4);
      expect(light.intensity).toBe(2.5);
    });

    it('should have default direction pointing down', () => {
      const light = new Light();

      expect(light.directionX).toBe(0.0);
      expect(light.directionY).toBe(-1.0);
      expect(light.directionZ).toBe(0.0);
    });

    it('should have default position at origin', () => {
      const light = new Light();

      expect(light.positionX).toBe(0.0);
      expect(light.positionY).toBe(0.0);
      expect(light.positionZ).toBe(0.0);
    });

    it('should have default radius for positional lights', () => {
      const light = new Light();
      expect(light.radius).toBe(10.0);
    });

    it('should have default spot parameters', () => {
      const light = new Light();

      expect(light.spotAngle).toBe(Math.PI / 4);
      expect(light.spotPenumbra).toBe(0.1);
    });

    it('should not cast shadows by default', () => {
      const light = new Light();

      expect(light.castsShadows).toBe(0);
      expect(light.shadowBias).toBe(0.005);
    });

    it('should have component type marker', () => {
      const light = new Light();
      expect(light.__componentType).toBe('Light');
    });
  });

  describe('directional static factory', () => {
    it('should create directional light with default direction', () => {
      const light = Light.directional([1.0, 1.0, 1.0], 1.0);

      expect(light.type).toBe(0);
      expect(light.colorR).toBe(1.0);
      expect(light.colorG).toBe(1.0);
      expect(light.colorB).toBe(1.0);
      expect(light.intensity).toBe(1.0);
    });

    it('should normalize direction vector', () => {
      const light = Light.directional([1.0, 1.0, 1.0], 1.0, [2, 0, 0]);

      // Direction [2, 0, 0] should normalize to [1, 0, 0]
      expect(light.directionX).toBeCloseTo(1.0);
      expect(light.directionY).toBeCloseTo(0.0);
      expect(light.directionZ).toBeCloseTo(0.0);
    });

    it('should handle diagonal direction', () => {
      const light = Light.directional([1.0, 1.0, 1.0], 1.0, [1, 1, 0]);

      const sqrt2 = Math.sqrt(2);
      expect(light.directionX).toBeCloseTo(1 / sqrt2);
      expect(light.directionY).toBeCloseTo(1 / sqrt2);
      expect(light.directionZ).toBeCloseTo(0.0);
    });

    it('should throw error on zero-length direction', () => {
      expect(() => {
        Light.directional([1.0, 1.0, 1.0], 1.0, [0, 0, 0]);
      }).toThrow('Directional light direction cannot be zero-length vector');
    });

    it('should support colored directional lights', () => {
      const light = Light.directional([1.0, 0.8, 0.6], 2.0, [0, -1, 0]);

      expect(light.colorR).toBe(1.0);
      expect(light.colorG).toBe(0.8);
      expect(light.colorB).toBe(0.6);
      expect(light.intensity).toBe(2.0);
    });
  });

  describe('point static factory', () => {
    it('should create point light with default position', () => {
      const light = Light.point([1.0, 1.0, 1.0], 2.0, 15.0);

      expect(light.type).toBe(1);
      expect(light.colorR).toBe(1.0);
      expect(light.colorG).toBe(1.0);
      expect(light.colorB).toBe(1.0);
      expect(light.intensity).toBe(2.0);
      expect(light.radius).toBe(15.0);
    });

    it('should support explicit position', () => {
      const light = Light.point([1.0, 0.8, 0.6], 3.0, 20.0, [5, 10, -3]);

      expect(light.positionX).toBe(5);
      expect(light.positionY).toBe(10);
      expect(light.positionZ).toBe(-3);
    });

    it('should use default radius when not specified', () => {
      const light = Light.point([1.0, 1.0, 1.0], 1.0);

      expect(light.radius).toBe(10.0);
    });

    it('should support colored point lights', () => {
      const light = Light.point([0.8, 0.5, 0.2], 1.5, 12.0);

      expect(light.colorR).toBe(0.8);
      expect(light.colorG).toBe(0.5);
      expect(light.colorB).toBe(0.2);
      expect(light.intensity).toBe(1.5);
    });

    it('should have zero position when not specified', () => {
      const light = Light.point([1.0, 1.0, 1.0], 1.0, 10.0);

      expect(light.positionX).toBe(0);
      expect(light.positionY).toBe(0);
      expect(light.positionZ).toBe(0);
    });
  });

  describe('spot static factory', () => {
    it('should create spot light with all parameters', () => {
      const light = Light.spot(
        [1.0, 1.0, 1.0],
        3.0,
        [0, -1, 0],
        Math.PI / 3,
        0.2,
        20.0
      );

      expect(light.type).toBe(2);
      expect(light.intensity).toBe(3.0);
      expect(light.spotAngle).toBe(Math.PI / 3);
      expect(light.spotPenumbra).toBe(0.2);
      expect(light.radius).toBe(20.0);
    });

    it('should normalize direction vector', () => {
      const light = Light.spot(
        [1.0, 1.0, 1.0],
        1.0,
        [3, 0, 0],
        Math.PI / 4,
        0.1,
        10.0
      );

      expect(light.directionX).toBeCloseTo(1.0);
      expect(light.directionY).toBeCloseTo(0.0);
      expect(light.directionZ).toBeCloseTo(0.0);
    });

    it('should support custom position', () => {
      const light = Light.spot(
        [1.0, 1.0, 1.0],
        1.0,
        [0, -1, 0],
        Math.PI / 4,
        0.1,
        10.0,
        [8, 12, -5]
      );

      expect(light.positionX).toBe(8);
      expect(light.positionY).toBe(12);
      expect(light.positionZ).toBe(-5);
    });

    it('should use default spot parameters when not specified', () => {
      const light = Light.spot([1.0, 1.0, 1.0], 1.0, [0, -1, 0]);

      expect(light.spotAngle).toBe(Math.PI / 4);
      expect(light.spotPenumbra).toBe(0.1);
      expect(light.radius).toBe(10.0);
    });

    it('should support colored spot lights', () => {
      const light = Light.spot(
        [1.0, 0.9, 0.8],
        2.5,
        [0, 0, 1],
        Math.PI / 6,
        0.15,
        15.0
      );

      expect(light.colorR).toBe(1.0);
      expect(light.colorG).toBe(0.9);
      expect(light.colorB).toBe(0.8);
      expect(light.intensity).toBe(2.5);
    });

    it('should throw error on zero-length direction', () => {
      expect(() => {
        Light.spot([1.0, 1.0, 1.0], 1.0, [0, 0, 0]);
      }).toThrow('Spot light direction cannot be zero-length vector');
    });
  });

  describe('ambient static factory', () => {
    it('should create ambient light', () => {
      const light = Light.ambient([0.2, 0.2, 0.25], 0.5);

      expect(light.type).toBe(3);
      expect(light.colorR).toBe(0.2);
      expect(light.colorG).toBe(0.2);
      expect(light.colorB).toBe(0.25);
      expect(light.intensity).toBe(0.5);
    });

    it('should support white ambient light', () => {
      const light = Light.ambient([1.0, 1.0, 1.0], 0.3);

      expect(light.colorR).toBe(1.0);
      expect(light.colorG).toBe(1.0);
      expect(light.colorB).toBe(1.0);
      expect(light.intensity).toBe(0.3);
    });

    it('should support warm ambient light', () => {
      const light = Light.ambient([1.0, 0.95, 0.8], 0.4);

      expect(light.colorR).toBe(1.0);
      expect(light.colorG).toBe(0.95);
      expect(light.colorB).toBe(0.8);
      expect(light.intensity).toBe(0.4);
    });
  });

  describe('property modification', () => {
    it('should allow enabling/disabling light', () => {
      const light = new Light();

      light.enabled = 0;
      expect(light.enabled).toBe(0);

      light.enabled = 1;
      expect(light.enabled).toBe(1);
    });

    it('should allow modifying color', () => {
      const light = new Light();

      light.colorR = 0.5;
      light.colorG = 0.6;
      light.colorB = 0.7;

      expect(light.colorR).toBe(0.5);
      expect(light.colorG).toBe(0.6);
      expect(light.colorB).toBe(0.7);
    });

    it('should allow modifying intensity', () => {
      const light = new Light();

      light.intensity = 3.5;
      expect(light.intensity).toBe(3.5);
    });

    it('should allow modifying direction', () => {
      const light = Light.directional([1.0, 1.0, 1.0], 1.0);

      light.directionX = 1.0;
      light.directionY = 0.0;
      light.directionZ = 0.0;

      expect(light.directionX).toBe(1.0);
      expect(light.directionY).toBe(0.0);
      expect(light.directionZ).toBe(0.0);
    });

    it('should allow modifying position', () => {
      const light = Light.point([1.0, 1.0, 1.0], 1.0);

      light.positionX = 5.0;
      light.positionY = 10.0;
      light.positionZ = -3.0;

      expect(light.positionX).toBe(5.0);
      expect(light.positionY).toBe(10.0);
      expect(light.positionZ).toBe(-3.0);
    });

    it('should allow modifying radius', () => {
      const light = Light.point([1.0, 1.0, 1.0], 1.0);

      light.radius = 25.0;
      expect(light.radius).toBe(25.0);
    });

    it('should allow modifying spot parameters', () => {
      const light = Light.spot([1.0, 1.0, 1.0], 1.0, [0, -1, 0]);

      light.spotAngle = Math.PI / 6;
      light.spotPenumbra = 0.3;

      expect(light.spotAngle).toBe(Math.PI / 6);
      expect(light.spotPenumbra).toBe(0.3);
    });

    it('should allow enabling shadows', () => {
      const light = new Light();

      light.castsShadows = 1;
      light.shadowBias = 0.01;

      expect(light.castsShadows).toBe(1);
      expect(light.shadowBias).toBe(0.01);
    });
  });

  describe('edge cases', () => {
    it('should throw error on negative intensity for directional light', () => {
      expect(() => {
        Light.directional([1.0, 1.0, 1.0], -1.0);
      }).toThrow('Light intensity must be non-negative');
    });

    it('should throw error on negative intensity for point light', () => {
      expect(() => {
        Light.point([1.0, 1.0, 1.0], -1.0);
      }).toThrow('Light intensity must be non-negative');
    });

    it('should throw error on negative intensity for ambient light', () => {
      expect(() => {
        Light.ambient([1.0, 1.0, 1.0], -1.0);
      }).toThrow('Light intensity must be non-negative');
    });

    it('should handle zero intensity', () => {
      const light = Light.directional([1.0, 1.0, 1.0], 0.0);
      expect(light.intensity).toBe(0.0);
    });

    it('should throw error on non-positive radius for point light', () => {
      expect(() => {
        Light.point([1.0, 1.0, 1.0], 1.0, 0);
      }).toThrow('Point light radius must be positive');
    });

    it('should throw error on negative radius for point light', () => {
      expect(() => {
        Light.point([1.0, 1.0, 1.0], 1.0, -5);
      }).toThrow('Point light radius must be positive');
    });

    it('should handle very large radius', () => {
      const light = Light.point([1.0, 1.0, 1.0], 1.0, 1000.0);
      expect(light.radius).toBe(1000.0);
    });

    it('should handle very small positive radius', () => {
      const light = Light.point([1.0, 1.0, 1.0], 1.0, 0.01);
      expect(light.radius).toBe(0.01);
    });

    it('should handle wide spot angle', () => {
      const light = Light.spot([1.0, 1.0, 1.0], 1.0, [0, -1, 0], Math.PI);
      expect(light.spotAngle).toBe(Math.PI);
    });

    it('should handle narrow spot angle', () => {
      const light = Light.spot([1.0, 1.0, 1.0], 1.0, [0, -1, 0], 0.1);
      expect(light.spotAngle).toBe(0.1);
    });

    it('should throw error on zero spot angle', () => {
      expect(() => {
        Light.spot([1.0, 1.0, 1.0], 1.0, [0, -1, 0], 0);
      }).toThrow('Spot angle must be in range');
    });

    it('should throw error on negative spot angle', () => {
      expect(() => {
        Light.spot([1.0, 1.0, 1.0], 1.0, [0, -1, 0], -0.5);
      }).toThrow('Spot angle must be in range');
    });

    it('should throw error on spot angle > 2π', () => {
      expect(() => {
        Light.spot([1.0, 1.0, 1.0], 1.0, [0, -1, 0], 2 * Math.PI + 0.1);
      }).toThrow('Spot angle must be in range');
    });

    it('should handle maximum penumbra', () => {
      const light = Light.spot([1.0, 1.0, 1.0], 1.0, [0, -1, 0], Math.PI / 4, 1.0);
      expect(light.spotPenumbra).toBe(1.0);
    });

    it('should handle minimum penumbra', () => {
      const light = Light.spot([1.0, 1.0, 1.0], 1.0, [0, -1, 0], Math.PI / 4, 0.0);
      expect(light.spotPenumbra).toBe(0.0);
    });

    it('should throw error on negative penumbra', () => {
      expect(() => {
        Light.spot([1.0, 1.0, 1.0], 1.0, [0, -1, 0], Math.PI / 4, -0.1);
      }).toThrow('Spot penumbra must be in range');
    });

    it('should throw error on penumbra > 1', () => {
      expect(() => {
        Light.spot([1.0, 1.0, 1.0], 1.0, [0, -1, 0], Math.PI / 4, 1.1);
      }).toThrow('Spot penumbra must be in range');
    });
  });
});
