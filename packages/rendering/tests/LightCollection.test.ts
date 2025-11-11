/**
 * LightCollection Tests - Epic 3.15
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LightCollection, LightType } from '../src/LightCollection';

// Mock light and transform components
const createMockLight = (
  type: LightType,
  color: [number, number, number] = [1, 1, 1],
  intensity: number = 1.0,
  enabled: boolean = true
) => ({
  type,
  enabled: enabled ? 1 : 0,
  colorR: color[0],
  colorG: color[1],
  colorB: color[2],
  intensity,
  directionX: 0,
  directionY: -1,
  directionZ: 0,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  radius: 10.0,
  spotAngle: Math.PI / 4,
  spotPenumbra: 0.1,
  castsShadows: 0,
  shadowBias: 0.005,
});

const createMockTransform = (x: number, y: number, z: number) => ({
  x,
  y,
  z,
});

describe('LightCollection', () => {
  let collection: LightCollection;

  beforeEach(() => {
    collection = new LightCollection();
  });

  describe('add', () => {
    it('should add directional light', () => {
      const light = createMockLight(LightType.DIRECTIONAL);
      collection.add(1, light);

      expect(collection.has(1)).toBe(true);
      expect(collection.getCount()).toBe(1);
    });

    it('should add point light', () => {
      const light = createMockLight(LightType.POINT);
      collection.add(2, light);

      expect(collection.has(2)).toBe(true);
      expect(collection.getCount()).toBe(1);
    });

    it('should add spot light', () => {
      const light = createMockLight(LightType.SPOT);
      collection.add(3, light);

      expect(collection.has(3)).toBe(true);
      expect(collection.getCount()).toBe(1);
    });

    it('should add ambient light', () => {
      const light = createMockLight(LightType.AMBIENT);
      collection.add(4, light);

      expect(collection.has(4)).toBe(true);
      expect(collection.getCount()).toBe(1);
    });

    it('should add multiple lights', () => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL));
      collection.add(2, createMockLight(LightType.POINT));
      collection.add(3, createMockLight(LightType.SPOT));

      expect(collection.getCount()).toBe(3);
    });

    it('should use transform position for point light', () => {
      const light = createMockLight(LightType.POINT);
      const transform = createMockTransform(5, 10, -3);
      collection.add(1, light, transform);

      const lightData = collection.get(1);
      expect(lightData?.position).toEqual([5, 10, -3]);
    });

    it('should use transform position for spot light', () => {
      const light = createMockLight(LightType.SPOT);
      const transform = createMockTransform(8, 12, -5);
      collection.add(1, light, transform);

      const lightData = collection.get(1);
      expect(lightData?.position).toEqual([8, 12, -5]);
    });

    it('should fallback to light position when no transform', () => {
      const light = createMockLight(LightType.POINT);
      light.positionX = 3;
      light.positionY = 7;
      light.positionZ = -2;
      collection.add(1, light);

      const lightData = collection.get(1);
      expect(lightData?.position).toEqual([3, 7, -2]);
    });
  });

  describe('update', () => {
    it('should update existing light', () => {
      const light1 = createMockLight(LightType.DIRECTIONAL, [1, 1, 1], 1.0);
      collection.add(1, light1);

      const light2 = createMockLight(LightType.DIRECTIONAL, [1, 0, 0], 2.0);
      collection.update(1, light2);

      const lightData = collection.get(1);
      expect(lightData?.color).toEqual([1, 0, 0]);
      expect(lightData?.intensity).toBe(2.0);
    });

    it('should update with new transform', () => {
      const light = createMockLight(LightType.POINT);
      const transform1 = createMockTransform(1, 2, 3);
      collection.add(1, light, transform1);

      const transform2 = createMockTransform(4, 5, 6);
      collection.update(1, light, transform2);

      const lightData = collection.get(1);
      expect(lightData?.position).toEqual([4, 5, 6]);
    });
  });

  describe('remove', () => {
    it('should remove light', () => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL));
      expect(collection.has(1)).toBe(true);

      collection.remove(1);
      expect(collection.has(1)).toBe(false);
      expect(collection.getCount()).toBe(0);
    });

    it('should handle removing non-existent light', () => {
      collection.remove(999);
      expect(collection.getCount()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all lights', () => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL));
      collection.add(2, createMockLight(LightType.POINT));
      collection.add(3, createMockLight(LightType.SPOT));

      collection.clear();

      expect(collection.getCount()).toBe(0);
      expect(collection.has(1)).toBe(false);
      expect(collection.has(2)).toBe(false);
      expect(collection.has(3)).toBe(false);
    });
  });

  describe('getDirectionalLights', () => {
    it('should return only directional lights', () => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL));
      collection.add(2, createMockLight(LightType.POINT));
      collection.add(3, createMockLight(LightType.DIRECTIONAL));

      const directionalLights = collection.getDirectionalLights();
      expect(directionalLights).toHaveLength(2);
      expect(directionalLights[0].type).toBe(LightType.DIRECTIONAL);
      expect(directionalLights[1].type).toBe(LightType.DIRECTIONAL);
    });

    it('should return empty array when no directional lights', () => {
      collection.add(1, createMockLight(LightType.POINT));
      collection.add(2, createMockLight(LightType.SPOT));

      const directionalLights = collection.getDirectionalLights();
      expect(directionalLights).toHaveLength(0);
    });

    it('should exclude disabled directional lights', () => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL, [1, 1, 1], 1.0, true));
      collection.add(2, createMockLight(LightType.DIRECTIONAL, [1, 1, 1], 1.0, false));

      const directionalLights = collection.getDirectionalLights();
      expect(directionalLights).toHaveLength(1);
      expect(directionalLights[0].entity).toBe(1);
    });
  });

  describe('getPointLights', () => {
    it('should return only point lights', () => {
      collection.add(1, createMockLight(LightType.POINT));
      collection.add(2, createMockLight(LightType.DIRECTIONAL));
      collection.add(3, createMockLight(LightType.POINT));

      const pointLights = collection.getPointLights();
      expect(pointLights).toHaveLength(2);
      expect(pointLights[0].type).toBe(LightType.POINT);
      expect(pointLights[1].type).toBe(LightType.POINT);
    });

    it('should exclude disabled point lights', () => {
      collection.add(1, createMockLight(LightType.POINT, [1, 1, 1], 1.0, true));
      collection.add(2, createMockLight(LightType.POINT, [1, 1, 1], 1.0, false));

      const pointLights = collection.getPointLights();
      expect(pointLights).toHaveLength(1);
    });
  });

  describe('getSpotLights', () => {
    it('should return only spot lights', () => {
      collection.add(1, createMockLight(LightType.SPOT));
      collection.add(2, createMockLight(LightType.POINT));
      collection.add(3, createMockLight(LightType.SPOT));

      const spotLights = collection.getSpotLights();
      expect(spotLights).toHaveLength(2);
      expect(spotLights[0].type).toBe(LightType.SPOT);
      expect(spotLights[1].type).toBe(LightType.SPOT);
    });

    it('should exclude disabled spot lights', () => {
      collection.add(1, createMockLight(LightType.SPOT, [1, 1, 1], 1.0, true));
      collection.add(2, createMockLight(LightType.SPOT, [1, 1, 1], 1.0, false));

      const spotLights = collection.getSpotLights();
      expect(spotLights).toHaveLength(1);
    });
  });

  describe('getAmbientLights', () => {
    it('should return only ambient lights', () => {
      collection.add(1, createMockLight(LightType.AMBIENT));
      collection.add(2, createMockLight(LightType.POINT));
      collection.add(3, createMockLight(LightType.AMBIENT));

      const ambientLights = collection.getAmbientLights();
      expect(ambientLights).toHaveLength(2);
      expect(ambientLights[0].type).toBe(LightType.AMBIENT);
      expect(ambientLights[1].type).toBe(LightType.AMBIENT);
    });

    it('should exclude disabled ambient lights', () => {
      collection.add(1, createMockLight(LightType.AMBIENT, [1, 1, 1], 1.0, true));
      collection.add(2, createMockLight(LightType.AMBIENT, [1, 1, 1], 1.0, false));

      const ambientLights = collection.getAmbientLights();
      expect(ambientLights).toHaveLength(1);
    });
  });

  describe('getActiveLights', () => {
    it('should return all enabled lights', () => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL));
      collection.add(2, createMockLight(LightType.POINT));
      collection.add(3, createMockLight(LightType.SPOT));
      collection.add(4, createMockLight(LightType.AMBIENT));

      const activeLights = collection.getActiveLights();
      expect(activeLights).toHaveLength(4);
    });

    it('should exclude disabled lights', () => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL, [1, 1, 1], 1.0, true));
      collection.add(2, createMockLight(LightType.POINT, [1, 1, 1], 1.0, false));
      collection.add(3, createMockLight(LightType.SPOT, [1, 1, 1], 1.0, true));

      const activeLights = collection.getActiveLights();
      expect(activeLights).toHaveLength(2);
      expect(activeLights[0].entity).toBe(1);
      expect(activeLights[1].entity).toBe(3);
    });
  });

  describe('getLightsByType', () => {
    beforeEach(() => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL));
      collection.add(2, createMockLight(LightType.POINT));
      collection.add(3, createMockLight(LightType.SPOT));
      collection.add(4, createMockLight(LightType.AMBIENT));
    });

    it('should return directional lights by type', () => {
      const lights = collection.getLightsByType(LightType.DIRECTIONAL);
      expect(lights).toHaveLength(1);
      expect(lights[0].type).toBe(LightType.DIRECTIONAL);
    });

    it('should return point lights by type', () => {
      const lights = collection.getLightsByType(LightType.POINT);
      expect(lights).toHaveLength(1);
      expect(lights[0].type).toBe(LightType.POINT);
    });

    it('should return spot lights by type', () => {
      const lights = collection.getLightsByType(LightType.SPOT);
      expect(lights).toHaveLength(1);
      expect(lights[0].type).toBe(LightType.SPOT);
    });

    it('should return ambient lights by type', () => {
      const lights = collection.getLightsByType(LightType.AMBIENT);
      expect(lights).toHaveLength(1);
      expect(lights[0].type).toBe(LightType.AMBIENT);
    });
  });

  describe('getCount', () => {
    it('should return zero for empty collection', () => {
      expect(collection.getCount()).toBe(0);
    });

    it('should return correct count', () => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL));
      collection.add(2, createMockLight(LightType.POINT));
      collection.add(3, createMockLight(LightType.SPOT));

      expect(collection.getCount()).toBe(3);
    });

    it('should exclude disabled lights from count', () => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL, [1, 1, 1], 1.0, true));
      collection.add(2, createMockLight(LightType.POINT, [1, 1, 1], 1.0, false));

      expect(collection.getCount()).toBe(1);
    });
  });

  describe('getCountByType', () => {
    beforeEach(() => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL));
      collection.add(2, createMockLight(LightType.DIRECTIONAL));
      collection.add(3, createMockLight(LightType.POINT));
      collection.add(4, createMockLight(LightType.SPOT));
    });

    it('should count directional lights', () => {
      expect(collection.getCountByType(LightType.DIRECTIONAL)).toBe(2);
    });

    it('should count point lights', () => {
      expect(collection.getCountByType(LightType.POINT)).toBe(1);
    });

    it('should count spot lights', () => {
      expect(collection.getCountByType(LightType.SPOT)).toBe(1);
    });

    it('should count ambient lights', () => {
      expect(collection.getCountByType(LightType.AMBIENT)).toBe(0);
    });
  });

  describe('get', () => {
    it('should return light data for entity', () => {
      const light = createMockLight(LightType.POINT, [1, 0.5, 0.2], 2.0);
      collection.add(1, light);

      const lightData = collection.get(1);
      expect(lightData?.entity).toBe(1);
      expect(lightData?.type).toBe(LightType.POINT);
      expect(lightData?.color).toEqual([1, 0.5, 0.2]);
      expect(lightData?.intensity).toBe(2.0);
    });

    it('should return undefined for non-existent entity', () => {
      const lightData = collection.get(999);
      expect(lightData).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing light', () => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL));
      expect(collection.has(1)).toBe(true);
    });

    it('should return false for non-existent light', () => {
      expect(collection.has(999)).toBe(false);
    });
  });

  describe('incremental updates', () => {
    it('should rebuild lists only when dirty', () => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL));

      // First call triggers rebuild
      const lights1 = collection.getDirectionalLights();
      expect(lights1).toHaveLength(1);

      // Second call should use cached result (no rebuild)
      const lights2 = collection.getDirectionalLights();
      expect(lights2).toBe(lights1); // Same reference = no rebuild
    });

    it('should mark dirty after add', () => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL));
      const lights1 = collection.getDirectionalLights();

      collection.add(2, createMockLight(LightType.DIRECTIONAL));
      const lights2 = collection.getDirectionalLights();

      expect(lights2).toHaveLength(2);
      expect(lights2).not.toBe(lights1); // Different reference = rebuilt
    });

    it('should mark dirty after update', () => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL));
      const lights1 = collection.getDirectionalLights();

      collection.update(1, createMockLight(LightType.DIRECTIONAL, [1, 0, 0], 2.0));
      const lights2 = collection.getDirectionalLights();

      expect(lights2[0].intensity).toBe(2.0);
    });

    it('should mark dirty after remove', () => {
      collection.add(1, createMockLight(LightType.DIRECTIONAL));
      collection.add(2, createMockLight(LightType.DIRECTIONAL));
      const lights1 = collection.getDirectionalLights();

      collection.remove(1);
      const lights2 = collection.getDirectionalLights();

      expect(lights2).toHaveLength(1);
      expect(lights2).not.toBe(lights1);
    });
  });

  describe('light data extraction', () => {
    it('should extract directional light data', () => {
      const light = createMockLight(LightType.DIRECTIONAL, [1, 0.8, 0.6], 1.5);
      light.directionX = 0.5;
      light.directionY = -0.7;
      light.directionZ = 0.3;
      light.castsShadows = 1;
      light.shadowBias = 0.01;
      collection.add(1, light);

      const lightData = collection.get(1);
      expect(lightData?.direction).toEqual([0.5, -0.7, 0.3]);
      expect(lightData?.castsShadows).toBe(true);
      expect(lightData?.shadowBias).toBe(0.01);
    });

    it('should extract point light data with radius', () => {
      const light = createMockLight(LightType.POINT);
      light.radius = 15.0;
      collection.add(1, light);

      const lightData = collection.get(1);
      expect(lightData?.radius).toBe(15.0);
    });

    it('should extract spot light data', () => {
      const light = createMockLight(LightType.SPOT);
      light.spotAngle = Math.PI / 3;
      light.spotPenumbra = 0.2;
      light.directionX = 0;
      light.directionY = 0;
      light.directionZ = 1;
      collection.add(1, light);

      const lightData = collection.get(1);
      expect(lightData?.spotAngle).toBe(Math.PI / 3);
      expect(lightData?.spotPenumbra).toBe(0.2);
      expect(lightData?.direction).toEqual([0, 0, 1]);
    });
  });
});
