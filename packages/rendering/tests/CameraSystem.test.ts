/**
 * CameraSystem Tests - Epic 3.10
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World, Camera, Transform } from '@miskatonic/ecs';
import { CameraSystem } from '../src/CameraSystem';

describe('CameraSystem', () => {
  let world: World;
  let cameraSystem: CameraSystem;

  beforeEach(() => {
    world = new World();
    cameraSystem = new CameraSystem(world);
  });

  describe('getActiveCamera', () => {
    it('should return null when no cameras exist', () => {
      const activeCamera = cameraSystem.getActiveCamera();
      expect(activeCamera).toBeNull();
    });

    it('should return the first active camera', () => {
      const entity1 = world.createEntity();
      const camera1 = Camera.perspective(Math.PI / 4, 0.1, 100);
      world.addComponent(entity1, Camera, camera1);
      world.addComponent(entity1, Transform, new Transform());

      const activeCamera = cameraSystem.getActiveCamera();
      expect(activeCamera).toBe(entity1);
    });

    it('should return null when camera is inactive', () => {
      const entity1 = world.createEntity();
      const camera1 = Camera.perspective(Math.PI / 4, 0.1, 100);
      camera1.active = 0;
      world.addComponent(entity1, Camera, camera1);
      world.addComponent(entity1, Transform, new Transform());

      const activeCamera = cameraSystem.getActiveCamera();
      expect(activeCamera).toBeNull();
    });

    it('should cache active camera', () => {
      const entity1 = world.createEntity();
      const camera1 = Camera.perspective(Math.PI / 4, 0.1, 100);
      world.addComponent(entity1, Camera, camera1);
      world.addComponent(entity1, Transform, new Transform());

      const firstCall = cameraSystem.getActiveCamera();
      const secondCall = cameraSystem.getActiveCamera();

      expect(firstCall).toBe(secondCall);
      expect(firstCall).toBe(entity1);
    });

    it('should invalidate cache when active camera becomes inactive', () => {
      const entity1 = world.createEntity();
      const camera1 = Camera.perspective(Math.PI / 4, 0.1, 100);
      world.addComponent(entity1, Camera, camera1);
      world.addComponent(entity1, Transform, new Transform());

      const entity2 = world.createEntity();
      const camera2 = Camera.perspective(Math.PI / 4, 0.1, 100);
      camera2.active = 0;
      world.addComponent(entity2, Camera, camera2);
      world.addComponent(entity2, Transform, new Transform());

      expect(cameraSystem.getActiveCamera()).toBe(entity1);

      // Deactivate first camera, activate second
      camera1.active = 0;
      camera2.active = 1;
      world.setComponent(entity1, Camera, camera1);
      world.setComponent(entity2, Camera, camera2);

      expect(cameraSystem.getActiveCamera()).toBe(entity2);
    });
  });

  describe('setActiveCamera', () => {
    it('should activate specified camera and deactivate others', () => {
      const entity1 = world.createEntity();
      const camera1 = Camera.perspective(Math.PI / 4, 0.1, 100);
      world.addComponent(entity1, Camera, camera1);

      const entity2 = world.createEntity();
      const camera2 = Camera.perspective(Math.PI / 4, 0.1, 100);
      world.addComponent(entity2, Camera, camera2);

      cameraSystem.setActiveCamera(entity2);

      // Re-read snapshots after setActiveCamera modifies them
      const updatedCamera1 = world.getComponent(entity1, Camera);
      const updatedCamera2 = world.getComponent(entity2, Camera);

      expect(updatedCamera1.active).toBe(0);
      expect(updatedCamera2.active).toBe(1);
      expect(cameraSystem.getActiveCamera()).toBe(entity2);
    });

    it('should handle entity without camera gracefully', () => {
      const entity1 = world.createEntity();
      cameraSystem.setActiveCamera(entity1);

      expect(cameraSystem.getActiveCamera()).toBeNull();
    });
  });

  describe('getViewMatrix', () => {
    it('should generate view matrix from transform', () => {
      const entity = world.createEntity();
      const camera = Camera.perspective(Math.PI / 4, 0.1, 100);
      const transform = new Transform();
      transform.x = 0;
      transform.y = 5;
      transform.z = 10;
      transform.rotationY = 0;
      transform.rotationX = 0;

      world.addComponent(entity, Camera, camera);
      world.addComponent(entity, Transform, transform);

      const viewMatrix = cameraSystem.getViewMatrix(entity);

      expect(viewMatrix).toBeInstanceOf(Float32Array);
      expect(viewMatrix.length).toBe(16);
    });

    it('should throw when entity has no Transform', () => {
      const entity = world.createEntity();
      const camera = Camera.perspective(Math.PI / 4, 0.1, 100);
      world.addComponent(entity, Camera, camera);

      expect(() => cameraSystem.getViewMatrix(entity)).toThrow(
        `Entity ${entity} has no Transform component`
      );
    });

    it('should generate different matrices for different rotations', () => {
      const entity1 = world.createEntity();
      const transform1 = new Transform();
      transform1.rotationY = 0;
      world.addComponent(entity1, Camera, Camera.perspective(Math.PI / 4, 0.1, 100));
      world.addComponent(entity1, Transform, transform1);

      const entity2 = world.createEntity();
      const transform2 = new Transform();
      transform2.rotationY = Math.PI / 2;
      world.addComponent(entity2, Camera, Camera.perspective(Math.PI / 4, 0.1, 100));
      world.addComponent(entity2, Transform, transform2);

      const view1 = cameraSystem.getViewMatrix(entity1);
      const view2 = cameraSystem.getViewMatrix(entity2);

      // Matrices should be different
      let allSame = true;
      for (let i = 0; i < 16; i++) {
        if (Math.abs(view1[i] - view2[i]) > 0.001) {
          allSame = false;
          break;
        }
      }
      expect(allSame).toBe(false);
    });
  });

  describe('getProjectionMatrix', () => {
    it('should generate perspective projection matrix', () => {
      const entity = world.createEntity();
      const camera = Camera.perspective(Math.PI / 4, 0.1, 100);
      const transform = new Transform();
      world.addComponent(entity, Camera, camera);
      world.addComponent(entity, Transform, transform);

      const aspectRatio = 16 / 9;
      const projMatrix = cameraSystem.getProjectionMatrix(entity, aspectRatio);

      expect(projMatrix).toBeInstanceOf(Float32Array);
      expect(projMatrix.length).toBe(16);

      // Verify it's a perspective projection (element [11] should be -1)
      expect(projMatrix[11]).toBeCloseTo(-1);
    });

    it('should generate orthographic projection matrix', () => {
      const entity = world.createEntity();
      const camera = Camera.orthographic(-10, 10, 10, -10, 0.1, 100);
      const transform = new Transform();
      world.addComponent(entity, Camera, camera);
      world.addComponent(entity, Transform, transform);

      const aspectRatio = 16 / 9;
      const projMatrix = cameraSystem.getProjectionMatrix(entity, aspectRatio);

      expect(projMatrix).toBeInstanceOf(Float32Array);
      expect(projMatrix.length).toBe(16);

      // Verify it's an orthographic projection (element [15] should be 1)
      expect(projMatrix[15]).toBeCloseTo(1);
    });

    it('should throw when entity has no Camera', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Transform, new Transform());

      expect(() => cameraSystem.getProjectionMatrix(entity, 16 / 9)).toThrow(
        `Entity ${entity} has no Camera component`
      );
    });

    it('should respect aspect ratio', () => {
      const entity = world.createEntity();
      const camera = Camera.perspective(Math.PI / 4, 0.1, 100);
      world.addComponent(entity, Camera, camera);
      world.addComponent(entity, Transform, new Transform());

      const proj1 = cameraSystem.getProjectionMatrix(entity, 16 / 9);
      const proj2 = cameraSystem.getProjectionMatrix(entity, 4 / 3);

      // Different aspect ratios should produce different matrices
      expect(proj1[0]).not.toBeCloseTo(proj2[0]);
    });
  });

  describe('getViewProjectionMatrix', () => {
    it('should generate combined VP matrix', () => {
      const entity = world.createEntity();
      const camera = Camera.perspective(Math.PI / 4, 0.1, 100);
      const transform = new Transform();
      transform.x = 0;
      transform.y = 5;
      transform.z = 10;

      world.addComponent(entity, Camera, camera);
      world.addComponent(entity, Transform, transform);

      const vpMatrix = cameraSystem.getViewProjectionMatrix(entity, 16 / 9);

      expect(vpMatrix).toBeInstanceOf(Float32Array);
      expect(vpMatrix.length).toBe(16);
    });

    it('should multiply projection by view (P * V)', () => {
      const entity = world.createEntity();
      const camera = Camera.perspective(Math.PI / 4, 0.1, 100);
      const transform = new Transform();
      // Give camera a non-identity transform so view matrix != identity
      transform.x = 5;
      transform.y = 3;
      transform.z = 10;
      transform.rotationY = Math.PI / 4;

      world.addComponent(entity, Camera, camera);
      world.addComponent(entity, Transform, transform);

      const view = cameraSystem.getViewMatrix(entity);
      const projection = cameraSystem.getProjectionMatrix(entity, 16 / 9);
      const vp = cameraSystem.getViewProjectionMatrix(entity, 16 / 9);

      // Spot check: VP should be different from both V and P
      let vpDiffersFromView = false;
      let vpDiffersFromProj = false;

      for (let i = 0; i < 16; i++) {
        if (Math.abs(vp[i] - view[i]) > 0.001) vpDiffersFromView = true;
        if (Math.abs(vp[i] - projection[i]) > 0.001) vpDiffersFromProj = true;
      }

      expect(vpDiffersFromView).toBe(true);
      expect(vpDiffersFromProj).toBe(true);
    });
  });

  describe('getAllCameras', () => {
    it('should return empty array when no cameras exist', () => {
      const cameras = cameraSystem.getAllCameras();
      expect(cameras).toEqual([]);
    });

    it('should return all camera entities', () => {
      const entity1 = world.createEntity();
      world.addComponent(entity1, Camera, Camera.perspective(Math.PI / 4, 0.1, 100));
      world.addComponent(entity1, Transform, new Transform());

      const entity2 = world.createEntity();
      world.addComponent(entity2, Camera, Camera.orthographic(-10, 10, 10, -10, 0.1, 100));
      world.addComponent(entity2, Transform, new Transform());

      const cameras = cameraSystem.getAllCameras();
      expect(cameras.length).toBe(2);
      expect(cameras).toContain(entity1);
      expect(cameras).toContain(entity2);
    });

    it('should only return entities with both Camera and Transform', () => {
      const entity1 = world.createEntity();
      world.addComponent(entity1, Camera, Camera.perspective(Math.PI / 4, 0.1, 100));
      world.addComponent(entity1, Transform, new Transform());

      const entity2 = world.createEntity();
      world.addComponent(entity2, Camera, Camera.perspective(Math.PI / 4, 0.1, 100));
      // No Transform

      const cameras = cameraSystem.getAllCameras();
      expect(cameras.length).toBe(1);
      expect(cameras).toContain(entity1);
      expect(cameras).not.toContain(entity2);
    });
  });

  describe('isValidCamera', () => {
    it('should return true for entity with Camera and Transform', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Camera, Camera.perspective(Math.PI / 4, 0.1, 100));
      world.addComponent(entity, Transform, new Transform());

      expect(cameraSystem.isValidCamera(entity)).toBe(true);
    });

    it('should return false for entity with only Camera', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Camera, Camera.perspective(Math.PI / 4, 0.1, 100));

      expect(cameraSystem.isValidCamera(entity)).toBe(false);
    });

    it('should return false for entity with only Transform', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Transform, new Transform());

      expect(cameraSystem.isValidCamera(entity)).toBe(false);
    });

    it('should return false for entity with no components', () => {
      const entity = world.createEntity();
      expect(cameraSystem.isValidCamera(entity)).toBe(false);
    });
  });
});
