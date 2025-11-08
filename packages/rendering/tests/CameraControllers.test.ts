/**
 * CameraControllers Tests - Epic 3.10
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World, Camera, Transform } from '@miskatonic/ecs';
import { OrbitCameraController, FirstPersonCameraController } from '../src/CameraControllers';

describe('OrbitCameraController', () => {
  let world: World;
  let entity: number;
  let controller: OrbitCameraController;

  beforeEach(() => {
    world = new World();
    entity = world.createEntity();
    world.addComponent(entity, Camera, Camera.perspective(Math.PI / 4, 0.1, 100));
    world.addComponent(entity, Transform, new Transform());
    controller = new OrbitCameraController(entity, world, 10);
  });

  describe('setTarget', () => {
    it('should update target position', () => {
      const initialTransform = world.getComponent(entity, Transform);
      const initialX = initialTransform.x;
      const initialY = initialTransform.y;
      const initialZ = initialTransform.z;

      controller.setTarget(5, 2, 3);

      // Position should change after target change - fetch fresh snapshot
      const transform = world.getComponent(entity, Transform);
      expect(transform.x).not.toBe(initialX);
      expect(transform.y).not.toBe(initialY);
      expect(transform.z).not.toBe(initialZ);
    });

    it('should maintain distance from target', () => {
      controller.setTarget(10, 5, 3);

      const transform = world.getComponent(entity, Transform);
      const dx = transform.x - 10;
      const dy = transform.y - 5;
      const dz = transform.z - 3;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      expect(distance).toBeCloseTo(10, 2); // 10 is initial distance
    });
  });

  describe('rotate', () => {
    it('should update camera position on rotation', () => {
      const initialTransform = world.getComponent(entity, Transform);
      const initialX = initialTransform.x;
      const initialZ = initialTransform.z;

      controller.rotate(Math.PI / 4, 0);

      const transform = world.getComponent(entity, Transform);
      expect(transform.x).not.toBeCloseTo(initialX);
      expect(transform.z).not.toBeCloseTo(initialZ);
    });

    it('should clamp elevation to prevent gimbal lock', () => {
      // Try to rotate way past vertical
      controller.rotate(0, Math.PI);
      const y1 = world.getComponent(entity, Transform).y;

      controller.rotate(0, Math.PI);
      const y2 = world.getComponent(entity, Transform).y;

      // Y should stabilize (clamped)
      expect(y2).toBeCloseTo(y1, 1);
    });

    it('should update rotation to look at target', () => {
      controller.rotate(Math.PI / 4, 0);

      const transform = world.getComponent(entity, Transform);
      // Rotation should be set (not default 0)
      expect(Math.abs(transform.rotationY) > 0.01 || Math.abs(transform.rotationX) > 0.01).toBe(true);
    });

    it('should mark transform as dirty', () => {
      controller.rotate(0.1, 0.1);

      const transform = world.getComponent(entity, Transform);
      expect(transform.dirty).toBe(1);
    });
  });

  describe('zoom', () => {
    it('should move camera closer on negative delta', () => {
      controller.setTarget(0, 0, 0);

      const initialTransform = world.getComponent(entity, Transform);
      const initialDist = Math.sqrt(
        initialTransform.x * initialTransform.x +
        initialTransform.y * initialTransform.y +
        initialTransform.z * initialTransform.z
      );

      controller.zoom(-2);

      const transform = world.getComponent(entity, Transform);
      const newDist = Math.sqrt(
        transform.x * transform.x +
        transform.y * transform.y +
        transform.z * transform.z
      );

      expect(newDist).toBeLessThan(initialDist);
    });

    it('should move camera farther on positive delta', () => {
      controller.setTarget(0, 0, 0);

      const initialTransform = world.getComponent(entity, Transform);
      const initialDist = Math.sqrt(
        initialTransform.x * initialTransform.x +
        initialTransform.y * initialTransform.y +
        initialTransform.z * initialTransform.z
      );

      controller.zoom(2);

      const transform = world.getComponent(entity, Transform);
      const newDist = Math.sqrt(
        transform.x * transform.x +
        transform.y * transform.y +
        transform.z * transform.z
      );

      expect(newDist).toBeGreaterThan(initialDist);
    });

    it('should clamp minimum distance', () => {
      controller.setTarget(0, 0, 0);

      controller.zoom(-100); // Zoom way in

      const transform = world.getComponent(entity, Transform);
      const dist = Math.sqrt(
        transform.x * transform.x +
        transform.y * transform.y +
        transform.z * transform.z
      );

      // Use toBeCloseTo to handle floating-point precision errors
      expect(dist).toBeCloseTo(1, 1); // Min distance is 1
    });

    it('should clamp maximum distance', () => {
      controller.setTarget(0, 0, 0);

      controller.zoom(200); // Zoom way out

      const transform = world.getComponent(entity, Transform);
      const dist = Math.sqrt(
        transform.x * transform.x +
        transform.y * transform.y +
        transform.z * transform.z
      );

      expect(dist).toBeLessThanOrEqual(100); // Max distance is 100
    });

    it('should mark transform as dirty', () => {
      controller.zoom(1);

      const transform = world.getComponent(entity, Transform);
      expect(transform.dirty).toBe(1);
    });
  });

  describe('constructor', () => {
    it('should accept custom initial distance', () => {
      const controller2 = new OrbitCameraController(entity, world, 20);
      controller2.setTarget(0, 0, 0);

      const transform = world.getComponent(entity, Transform);
      const dist = Math.sqrt(
        transform.x * transform.x +
        transform.y * transform.y +
        transform.z * transform.z
      );

      expect(dist).toBeCloseTo(20, 1);
    });

    it('should update position on construction', () => {
      const entity2 = world.createEntity();
      world.addComponent(entity2, Camera, Camera.perspective(Math.PI / 4, 0.1, 100));
      const transform2 = new Transform();
      world.addComponent(entity2, Transform, transform2);

      // Transform should be identity initially
      expect(transform2.x).toBe(0);
      expect(transform2.y).toBe(0);
      expect(transform2.z).toBe(0);

      const controller2 = new OrbitCameraController(entity2, world, 15);

      // Position should be updated after controller creation
      const updated = world.getComponent(entity2, Transform);
      expect(
        updated.x !== 0 || updated.y !== 0 || updated.z !== 0
      ).toBe(true);
    });
  });
});

describe('FirstPersonCameraController', () => {
  let world: World;
  let entity: number;
  let controller: FirstPersonCameraController;

  beforeEach(() => {
    world = new World();
    entity = world.createEntity();
    world.addComponent(entity, Camera, Camera.perspective(Math.PI / 4, 0.1, 100));
    world.addComponent(entity, Transform, new Transform());
    controller = new FirstPersonCameraController(entity, world, 5.0);
  });

  describe('look', () => {
    it('should update rotation from mouse movement', () => {
      const initialTransform = world.getComponent(entity, Transform);
      const initialYaw = initialTransform.rotationY;
      const initialPitch = initialTransform.rotationX;

      controller.look(100, 50);

      const transform = world.getComponent(entity, Transform);
      expect(transform.rotationY).not.toBe(initialYaw);
      expect(transform.rotationX).not.toBe(initialPitch);
    });

    it('should respect sensitivity parameter', () => {
      const entity2 = world.createEntity();
      world.addComponent(entity2, Camera, Camera.perspective(Math.PI / 4, 0.1, 100));
      world.addComponent(entity2, Transform, new Transform());
      const controller2 = new FirstPersonCameraController(entity2, world);

      controller.look(100, 0, 0.001);
      controller2.look(100, 0, 0.002);

      // Re-read transforms after controller updates
      const transform1 = world.getComponent(entity, Transform);
      const transform2 = world.getComponent(entity2, Transform);

      // Controller2 should have rotated more (higher sensitivity)
      expect(Math.abs(transform2.rotationY)).toBeGreaterThan(Math.abs(transform1.rotationY));
    });

    it('should clamp pitch to prevent flipping', () => {
      // Try to look way up
      controller.look(0, -10000);
      const transform1 = world.getComponent(entity, Transform);
      const pitch1 = transform1.rotationX;

      controller.look(0, -10000);
      const transform2 = world.getComponent(entity, Transform);
      const pitch2 = transform2.rotationX;

      // Pitch should stabilize at limit
      expect(pitch1).toBeCloseTo(pitch2, 5);
      expect(Math.abs(pitch1)).toBeLessThanOrEqual(Math.PI / 2 + 0.01);
    });

    it('should allow yaw to rotate freely', () => {
      controller.look(1000, 0, 0.01);
      const transform1 = world.getComponent(entity, Transform);
      const yaw1 = transform1.rotationY;

      controller.look(1000, 0, 0.01);
      const transform2 = world.getComponent(entity, Transform);
      const yaw2 = transform2.rotationY;

      // Yaw should keep changing (no clamping)
      expect(yaw2).not.toBeCloseTo(yaw1);
    });

    it('should mark transform as dirty', () => {
      controller.look(10, 10);

      const transform = world.getComponent(entity, Transform);
      expect(transform.dirty).toBe(1);
    });
  });

  describe('move', () => {
    it('should move forward', () => {
      const initialTransform = world.getComponent(entity, Transform);
      const initialX = initialTransform.x;
      const initialZ = initialTransform.z;

      controller.move(1, 0, 0.1);

      const transform = world.getComponent(entity, Transform);
      // Position should change
      expect(transform.x !== initialX || transform.z !== initialZ).toBe(true);
    });

    it('should move backward', () => {
      let transform = world.getComponent(entity, Transform);
      transform.x = 0;
      transform.z = 0;
      world.setComponent(entity, Transform, transform);

      controller.move(1, 0, 0.1);
      transform = world.getComponent(entity, Transform);
      const forwardX = transform.x;
      const forwardZ = transform.z;

      transform.x = 0;
      transform.z = 0;
      world.setComponent(entity, Transform, transform);

      controller.move(-1, 0, 0.1);
      transform = world.getComponent(entity, Transform);
      const backwardX = transform.x;
      const backwardZ = transform.z;

      // Forward and backward should be opposite directions
      expect(Math.abs(forwardX + backwardX)).toBeLessThan(0.01);
      expect(Math.abs(forwardZ + backwardZ)).toBeLessThan(0.01);
    });

    it('should strafe right', () => {
      const initialTransform = world.getComponent(entity, Transform);
      const initialX = initialTransform.x;
      const initialZ = initialTransform.z;

      controller.move(0, 1, 0.1);

      const transform = world.getComponent(entity, Transform);
      expect(transform.x !== initialX || transform.z !== initialZ).toBe(true);
    });

    it('should strafe left', () => {
      let transform = world.getComponent(entity, Transform);
      transform.x = 0;
      transform.z = 0;
      world.setComponent(entity, Transform, transform);

      controller.move(0, 1, 0.1);
      transform = world.getComponent(entity, Transform);
      const rightX = transform.x;
      const rightZ = transform.z;

      transform.x = 0;
      transform.z = 0;
      world.setComponent(entity, Transform, transform);

      controller.move(0, -1, 0.1);
      transform = world.getComponent(entity, Transform);
      const leftX = transform.x;
      const leftZ = transform.z;

      // Right and left should be opposite directions
      expect(Math.abs(rightX + leftX)).toBeLessThan(0.01);
      expect(Math.abs(rightZ + leftZ)).toBeLessThan(0.01);
    });

    it('should respect move speed', () => {
      const entity2 = world.createEntity();
      world.addComponent(entity2, Camera, Camera.perspective(Math.PI / 4, 0.1, 100));
      world.addComponent(entity2, Transform, new Transform());
      const controller2 = new FirstPersonCameraController(entity2, world, 10.0);

      controller.move(1, 0, 0.1); // Speed 5.0
      controller2.move(1, 0, 0.1); // Speed 10.0

      // Re-read transforms after controller updates
      const transform1 = world.getComponent(entity, Transform);
      const transform2 = world.getComponent(entity2, Transform);

      const dist1 = Math.sqrt(transform1.x ** 2 + transform1.z ** 2);
      const dist2 = Math.sqrt(transform2.x ** 2 + transform2.z ** 2);

      // Controller2 should move farther (higher speed)
      expect(dist2).toBeGreaterThan(dist1);
    });

    it('should scale movement by delta time', () => {
      controller.move(1, 0, 0.1);
      let transform = world.getComponent(entity, Transform);
      const dist1 = Math.sqrt(transform.x ** 2 + transform.z ** 2);

      transform.x = 0;
      transform.z = 0;
      world.setComponent(entity, Transform, transform);

      controller.move(1, 0, 0.2); // Double the delta time
      transform = world.getComponent(entity, Transform);
      const dist2 = Math.sqrt(transform.x ** 2 + transform.z ** 2);

      // Larger dt should result in more movement
      expect(dist2).toBeGreaterThan(dist1);
    });

    it('should combine forward and strafe movement', () => {
      controller.move(1, 1, 0.1);

      const transform = world.getComponent(entity, Transform);
      const dist = Math.sqrt(transform.x ** 2 + transform.z ** 2);
      expect(dist).toBeGreaterThan(0);
    });

    it('should respect camera rotation', () => {
      let transform = world.getComponent(entity, Transform);
      transform.x = 0;
      transform.z = 0;
      world.setComponent(entity, Transform, transform);

      // Face default direction and move forward
      controller.move(1, 0, 0.1);
      transform = world.getComponent(entity, Transform);
      const x1 = transform.x;
      const z1 = transform.z;

      // Rotate 90 degrees and move forward
      transform.x = 0;
      transform.z = 0;
      world.setComponent(entity, Transform, transform);
      controller.look(1000, 0, Math.PI / 2000); // Rotate ~90 degrees
      controller.move(1, 0, 0.1);
      transform = world.getComponent(entity, Transform);
      const x2 = transform.x;
      const z2 = transform.z;

      // Movement direction should be different after rotation
      const dot = x1 * x2 + z1 * z2;
      const mag1 = Math.sqrt(x1 ** 2 + z1 ** 2);
      const mag2 = Math.sqrt(x2 ** 2 + z2 ** 2);
      const cosAngle = dot / (mag1 * mag2);

      // Should not be parallel (cosAngle should not be close to 1 or -1)
      expect(Math.abs(cosAngle)).toBeLessThan(0.9);
    });

    it('should mark transform as dirty', () => {
      controller.move(1, 0, 0.1);

      const transform = world.getComponent(entity, Transform);
      expect(transform.dirty).toBe(1);
    });
  });

  describe('constructor', () => {
    it('should accept custom move speed', () => {
      const controller2 = new FirstPersonCameraController(entity, world, 20.0);

      let transform = world.getComponent(entity, Transform);
      transform.x = 0;
      transform.z = 0;
      world.setComponent(entity, Transform, transform);

      controller2.move(1, 0, 0.1);

      transform = world.getComponent(entity, Transform);
      const dist = Math.sqrt(transform.x ** 2 + transform.z ** 2);
      expect(dist).toBeCloseTo(20.0 * 0.1, 1); // Speed * dt
    });

    it('should initialize with zero rotation', () => {
      const entity2 = world.createEntity();
      world.addComponent(entity2, Camera, Camera.perspective(Math.PI / 4, 0.1, 100));
      world.addComponent(entity2, Transform, new Transform());

      const controller2 = new FirstPersonCameraController(entity2, world);

      const transform = world.getComponent(entity2, Transform);
      expect(transform.rotationX).toBe(0);
      expect(transform.rotationY).toBe(0);
      expect(transform.rotationZ).toBe(0);
    });
  });
});
