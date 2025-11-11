/**
 * LightSystem Tests - Epic 3.15
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@miskatonic/ecs';
import { Light, Transform } from '@miskatonic/ecs';
import { LightSystem } from '../src/LightSystem';
import { LightType } from '../src/LightCollection';

describe('LightSystem', () => {
  let world: World;
  let lightSystem: LightSystem;

  beforeEach(() => {
    world = new World();
    lightSystem = new LightSystem(world);
  });

  describe('initialization', () => {
    it('should create with empty light collection', () => {
      expect(lightSystem.getLightCount()).toBe(0);
    });

    it('should return empty arrays for all light types', () => {
      expect(lightSystem.getDirectionalLights()).toHaveLength(0);
      expect(lightSystem.getPointLights()).toHaveLength(0);
      expect(lightSystem.getSpotLights()).toHaveLength(0);
      expect(lightSystem.getAmbientLights()).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should add directional light to collection', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Light, Light.directional([1, 1, 1], 1.0));

      lightSystem.update();

      expect(lightSystem.getLightCount()).toBe(1);
      expect(lightSystem.getDirectionalLights()).toHaveLength(1);
    });

    it('should add point light with transform position', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Transform, new Transform(5, 10, -3));
      world.addComponent(entity, Light, Light.point([1, 1, 1], 2.0, 15.0));

      lightSystem.update();

      const lightData = lightSystem.getLight(entity);
      expect(lightData?.position).toEqual([5, 10, -3]);
    });

    it('should add spot light with transform', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Transform, new Transform(8, 12, -5));
      world.addComponent(entity, Light, Light.spot([1, 1, 1], 3.0, [0, -1, 0]));

      lightSystem.update();

      const lightData = lightSystem.getLight(entity);
      expect(lightData?.type).toBe(LightType.SPOT);
      expect(lightData?.position).toEqual([8, 12, -5]);
    });

    it('should add ambient light', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Light, Light.ambient([0.2, 0.2, 0.25], 0.5));

      lightSystem.update();

      expect(lightSystem.getAmbientLights()).toHaveLength(1);
    });

    it('should add multiple lights of different types', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Light, Light.directional([1, 1, 1], 1.0));

      const e2 = world.createEntity();
      world.addComponent(e2, Transform, new Transform(0, 0, 0));
      world.addComponent(e2, Light, Light.point([1, 0.8, 0.6], 2.0));

      const e3 = world.createEntity();
      world.addComponent(e3, Light, Light.ambient([0.2, 0.2, 0.25], 0.5));

      lightSystem.update();

      expect(lightSystem.getLightCount()).toBe(3);
      expect(lightSystem.getDirectionalLights()).toHaveLength(1);
      expect(lightSystem.getPointLights()).toHaveLength(1);
      expect(lightSystem.getAmbientLights()).toHaveLength(1);
    });

    it('should update existing light when modified', () => {
      const entity = world.createEntity();
      const light = Light.directional([1, 1, 1], 1.0);
      world.addComponent(entity, Light, light);

      lightSystem.update();
      expect(lightSystem.getLight(entity)?.intensity).toBe(1.0);

      // Modify light
      light.intensity = 3.0;
      world.setComponent(entity, Light, light);

      lightSystem.update();
      expect(lightSystem.getLight(entity)?.intensity).toBe(3.0);
    });

    it('should update light position when transform changes', () => {
      const entity = world.createEntity();
      const transform = new Transform(1, 2, 3);
      world.addComponent(entity, Transform, transform);
      world.addComponent(entity, Light, Light.point([1, 1, 1], 1.0));

      lightSystem.update();
      expect(lightSystem.getLight(entity)?.position).toEqual([1, 2, 3]);

      // Update transform
      transform.x = 5;
      transform.y = 10;
      transform.z = -3;
      world.setComponent(entity, Transform, transform);

      lightSystem.update();
      expect(lightSystem.getLight(entity)?.position).toEqual([5, 10, -3]);
    });

    it('should remove deleted lights from collection', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Light, Light.directional([1, 1, 1], 1.0));

      const e2 = world.createEntity();
      world.addComponent(e2, Light, Light.point([1, 1, 1], 1.0));

      lightSystem.update();
      expect(lightSystem.getLightCount()).toBe(2);

      // Remove one light
      world.removeComponent(e1, Light);

      lightSystem.update();
      expect(lightSystem.getLightCount()).toBe(1);
      expect(lightSystem.hasLight(e1)).toBe(false);
      expect(lightSystem.hasLight(e2)).toBe(true);
    });

    it('should handle entity deletion', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Light, Light.directional([1, 1, 1], 1.0));

      lightSystem.update();
      expect(lightSystem.getLightCount()).toBe(1);

      // Delete entity
      world.destroyEntity(entity);

      lightSystem.update();
      expect(lightSystem.getLightCount()).toBe(0);
    });

    it('should only include enabled lights', () => {
      const e1 = world.createEntity();
      const light1 = Light.directional([1, 1, 1], 1.0);
      world.addComponent(e1, Light, light1);

      const e2 = world.createEntity();
      const light2 = Light.point([1, 1, 1], 1.0);
      light2.enabled = 0; // Disabled
      world.addComponent(e2, Light, light2);

      lightSystem.update();

      expect(lightSystem.getLightCount()).toBe(1);
      expect(lightSystem.getDirectionalLights()).toHaveLength(1);
      expect(lightSystem.getPointLights()).toHaveLength(0);
    });
  });

  describe('getDirectionalLights', () => {
    it('should return only directional lights', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Light, Light.directional([1, 1, 1], 1.0));

      const e2 = world.createEntity();
      world.addComponent(e2, Light, Light.point([1, 1, 1], 1.0));

      lightSystem.update();

      const directionalLights = lightSystem.getDirectionalLights();
      expect(directionalLights).toHaveLength(1);
      expect(directionalLights[0].type).toBe(LightType.DIRECTIONAL);
    });

    it('should return empty array when no directional lights', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Light, Light.point([1, 1, 1], 1.0));

      lightSystem.update();

      expect(lightSystem.getDirectionalLights()).toHaveLength(0);
    });
  });

  describe('getPointLights', () => {
    it('should return only point lights', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Light, Light.point([1, 1, 1], 1.0));

      const e2 = world.createEntity();
      world.addComponent(e2, Light, Light.directional([1, 1, 1], 1.0));

      lightSystem.update();

      const pointLights = lightSystem.getPointLights();
      expect(pointLights).toHaveLength(1);
      expect(pointLights[0].type).toBe(LightType.POINT);
    });
  });

  describe('getSpotLights', () => {
    it('should return only spot lights', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Light, Light.spot([1, 1, 1], 1.0, [0, -1, 0]));

      const e2 = world.createEntity();
      world.addComponent(e2, Light, Light.point([1, 1, 1], 1.0));

      lightSystem.update();

      const spotLights = lightSystem.getSpotLights();
      expect(spotLights).toHaveLength(1);
      expect(spotLights[0].type).toBe(LightType.SPOT);
    });
  });

  describe('getAmbientLights', () => {
    it('should return only ambient lights', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Light, Light.ambient([0.2, 0.2, 0.25], 0.5));

      const e2 = world.createEntity();
      world.addComponent(e2, Light, Light.directional([1, 1, 1], 1.0));

      lightSystem.update();

      const ambientLights = lightSystem.getAmbientLights();
      expect(ambientLights).toHaveLength(1);
      expect(ambientLights[0].type).toBe(LightType.AMBIENT);
    });
  });

  describe('getActiveLights', () => {
    it('should return all enabled lights', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Light, Light.directional([1, 1, 1], 1.0));

      const e2 = world.createEntity();
      world.addComponent(e2, Light, Light.point([1, 1, 1], 1.0));

      const e3 = world.createEntity();
      world.addComponent(e3, Light, Light.spot([1, 1, 1], 1.0, [0, -1, 0]));

      lightSystem.update();

      const activeLights = lightSystem.getActiveLights();
      expect(activeLights).toHaveLength(3);
    });

    it('should exclude disabled lights', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Light, Light.directional([1, 1, 1], 1.0));

      const e2 = world.createEntity();
      const light2 = Light.point([1, 1, 1], 1.0);
      light2.enabled = 0;
      world.addComponent(e2, Light, light2);

      lightSystem.update();

      const activeLights = lightSystem.getActiveLights();
      expect(activeLights).toHaveLength(1);
    });
  });

  describe('getLightCount', () => {
    it('should return zero for empty collection', () => {
      expect(lightSystem.getLightCount()).toBe(0);
    });

    it('should return correct count', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Light, Light.directional([1, 1, 1], 1.0));

      const e2 = world.createEntity();
      world.addComponent(e2, Light, Light.point([1, 1, 1], 1.0));

      lightSystem.update();

      expect(lightSystem.getLightCount()).toBe(2);
    });

    it('should exclude disabled lights from count', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Light, Light.directional([1, 1, 1], 1.0));

      const e2 = world.createEntity();
      const light2 = Light.point([1, 1, 1], 1.0);
      light2.enabled = 0;
      world.addComponent(e2, Light, light2);

      lightSystem.update();

      expect(lightSystem.getLightCount()).toBe(1);
    });
  });

  describe('getLight', () => {
    it('should return light data for entity', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Light, Light.directional([1, 0.8, 0.6], 2.0));

      lightSystem.update();

      const lightData = lightSystem.getLight(entity);
      expect(lightData?.entity).toBe(entity);
      expect(lightData?.type).toBe(LightType.DIRECTIONAL);
      // Use toBeCloseTo for floating-point values that go through ECS storage
      expect(lightData?.color[0]).toBeCloseTo(1.0);
      expect(lightData?.color[1]).toBeCloseTo(0.8);
      expect(lightData?.color[2]).toBeCloseTo(0.6);
      expect(lightData?.intensity).toBeCloseTo(2.0);
    });

    it('should return undefined for non-existent entity', () => {
      const lightData = lightSystem.getLight(999);
      expect(lightData).toBeUndefined();
    });

    it('should return undefined before update', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Light, Light.directional([1, 1, 1], 1.0));

      // Before update
      expect(lightSystem.getLight(entity)).toBeUndefined();

      // After update
      lightSystem.update();
      expect(lightSystem.getLight(entity)).toBeDefined();
    });
  });

  describe('hasLight', () => {
    it('should return true for existing light', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Light, Light.directional([1, 1, 1], 1.0));

      lightSystem.update();

      expect(lightSystem.hasLight(entity)).toBe(true);
    });

    it('should return false for non-existent light', () => {
      expect(lightSystem.hasLight(999)).toBe(false);
    });

    it('should return false before update', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Light, Light.directional([1, 1, 1], 1.0));

      expect(lightSystem.hasLight(entity)).toBe(false);

      lightSystem.update();

      expect(lightSystem.hasLight(entity)).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all lights', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Light, Light.directional([1, 1, 1], 1.0));

      const e2 = world.createEntity();
      world.addComponent(e2, Light, Light.point([1, 1, 1], 1.0));

      lightSystem.update();
      expect(lightSystem.getLightCount()).toBe(2);

      lightSystem.clear();

      expect(lightSystem.getLightCount()).toBe(0);
      expect(lightSystem.hasLight(e1)).toBe(false);
      expect(lightSystem.hasLight(e2)).toBe(false);
    });
  });

  describe('incremental updates', () => {
    it('should handle adding light after initial update', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Light, Light.directional([1, 1, 1], 1.0));

      lightSystem.update();
      expect(lightSystem.getLightCount()).toBe(1);

      // Add another light
      const e2 = world.createEntity();
      world.addComponent(e2, Light, Light.point([1, 1, 1], 1.0));

      lightSystem.update();
      expect(lightSystem.getLightCount()).toBe(2);
    });

    it('should handle removing light after initial update', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Light, Light.directional([1, 1, 1], 1.0));

      const e2 = world.createEntity();
      world.addComponent(e2, Light, Light.point([1, 1, 1], 1.0));

      lightSystem.update();
      expect(lightSystem.getLightCount()).toBe(2);

      // Remove one light
      world.removeComponent(e1, Light);

      lightSystem.update();
      expect(lightSystem.getLightCount()).toBe(1);
    });

    it('should handle multiple updates without changes', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Light, Light.directional([1, 1, 1], 1.0));

      lightSystem.update();
      const count1 = lightSystem.getLightCount();

      lightSystem.update();
      const count2 = lightSystem.getLightCount();

      lightSystem.update();
      const count3 = lightSystem.getLightCount();

      expect(count1).toBe(1);
      expect(count2).toBe(1);
      expect(count3).toBe(1);
    });
  });

  describe('complex scenarios', () => {
    it('should handle mixed light types with transforms', () => {
      // Directional light (no transform needed)
      const e1 = world.createEntity();
      world.addComponent(e1, Light, Light.directional([1, 1, 0.8], 1.0, [0.5, -0.7, 0.3]));

      // Point light with transform
      const e2 = world.createEntity();
      world.addComponent(e2, Transform, new Transform(5, 10, -3));
      world.addComponent(e2, Light, Light.point([1, 0.8, 0.6], 2.0, 15.0));

      // Spot light with transform
      const e3 = world.createEntity();
      world.addComponent(e3, Transform, new Transform(8, 12, -5));
      world.addComponent(e3, Light, Light.spot([1, 1, 1], 3.0, [0, -1, 0], Math.PI / 3));

      // Ambient light
      const e4 = world.createEntity();
      world.addComponent(e4, Light, Light.ambient([0.2, 0.2, 0.25], 0.5));

      lightSystem.update();

      expect(lightSystem.getLightCount()).toBe(4);
      expect(lightSystem.getDirectionalLights()).toHaveLength(1);
      expect(lightSystem.getPointLights()).toHaveLength(1);
      expect(lightSystem.getSpotLights()).toHaveLength(1);
      expect(lightSystem.getAmbientLights()).toHaveLength(1);

      // Verify positions
      const pointLight = lightSystem.getLight(e2);
      expect(pointLight?.position).toEqual([5, 10, -3]);

      const spotLight = lightSystem.getLight(e3);
      expect(spotLight?.position).toEqual([8, 12, -5]);
    });

    it('should handle enabling and disabling lights', () => {
      const entity = world.createEntity();
      const light = Light.directional([1, 1, 1], 1.0);
      world.addComponent(entity, Light, light);

      lightSystem.update();
      expect(lightSystem.getLightCount()).toBe(1);

      // Disable light
      light.enabled = 0;
      world.setComponent(entity, Light, light);

      lightSystem.update();
      expect(lightSystem.getLightCount()).toBe(0);

      // Re-enable light
      light.enabled = 1;
      world.setComponent(entity, Light, light);

      lightSystem.update();
      expect(lightSystem.getLightCount()).toBe(1);
    });

    it('should handle shadow configuration', () => {
      const entity = world.createEntity();
      const light = Light.directional([1, 1, 1], 1.0);
      light.castsShadows = 1;
      light.shadowBias = 0.01;
      world.addComponent(entity, Light, light);

      lightSystem.update();

      const lightData = lightSystem.getLight(entity);
      expect(lightData?.castsShadows).toBe(true);
      expect(lightData?.shadowBias).toBeCloseTo(0.01);
    });
  });
});
