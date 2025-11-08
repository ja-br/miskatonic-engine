/**
 * Camera Component Tests - Epic 3.10
 */

import { describe, it, expect } from 'vitest';
import { Camera } from '../src/components/Camera';

describe('Camera Component', () => {
  describe('constructor', () => {
    it('should create with default perspective projection', () => {
      const camera = new Camera();

      expect(camera.projectionType).toBe(0); // Perspective
      expect(camera.fov).toBe(Math.PI / 4);
      expect(camera.perspectiveNear).toBe(0.1);
      expect(camera.perspectiveFar).toBe(100.0);
    });

    it('should create with custom perspective values', () => {
      const camera = new Camera(0, Math.PI / 3, 0.5, 200.0);

      expect(camera.projectionType).toBe(0);
      expect(camera.fov).toBe(Math.PI / 3);
      expect(camera.perspectiveNear).toBe(0.5);
      expect(camera.perspectiveFar).toBe(200.0);
    });

    it('should create with orthographic projection', () => {
      const camera = new Camera(1, 0, 0.1, 100.0);

      expect(camera.projectionType).toBe(1); // Orthographic
    });

    it('should set active flag by default', () => {
      const camera = new Camera();
      expect(camera.active).toBe(1);
    });

    it('should have component type marker', () => {
      const camera = new Camera();
      expect(camera.__componentType).toBe('Camera');
    });
  });

  describe('perspective static factory', () => {
    it('should create perspective camera', () => {
      const camera = Camera.perspective(Math.PI / 3, 0.5, 200.0);

      expect(camera.projectionType).toBe(0);
      expect(camera.fov).toBe(Math.PI / 3);
      expect(camera.perspectiveNear).toBe(0.5);
      expect(camera.perspectiveFar).toBe(200.0);
    });

    it('should create with default viewport', () => {
      const camera = Camera.perspective(Math.PI / 4, 0.1, 100.0);

      expect(camera.viewportX).toBe(0);
      expect(camera.viewportY).toBe(0);
      expect(camera.viewportWidth).toBe(1);
      expect(camera.viewportHeight).toBe(1);
    });

    it('should create with default clear color', () => {
      const camera = Camera.perspective(Math.PI / 4, 0.1, 100.0);

      expect(camera.clearColorR).toBe(0.1);
      expect(camera.clearColorG).toBe(0.1);
      expect(camera.clearColorB).toBe(0.1);
      expect(camera.clearColorA).toBe(1.0);
    });
  });

  describe('orthographic static factory', () => {
    it('should create orthographic camera', () => {
      const camera = Camera.orthographic(-10, 10, 10, -10, 0.1, 100.0);

      expect(camera.projectionType).toBe(1);
      expect(camera.left).toBe(-10);
      expect(camera.right).toBe(10);
      expect(camera.top).toBe(10);
      expect(camera.bottom).toBe(-10);
      expect(camera.orthoNear).toBe(0.1);
      expect(camera.orthoFar).toBe(100.0);
    });

    it('should handle asymmetric bounds', () => {
      const camera = Camera.orthographic(-5, 15, 20, -8, 0.5, 50.0);

      expect(camera.left).toBe(-5);
      expect(camera.right).toBe(15);
      expect(camera.top).toBe(20);
      expect(camera.bottom).toBe(-8);
    });

    it('should create with default viewport', () => {
      const camera = Camera.orthographic(-10, 10, 10, -10, 0.1, 100.0);

      expect(camera.viewportX).toBe(0);
      expect(camera.viewportY).toBe(0);
      expect(camera.viewportWidth).toBe(1);
      expect(camera.viewportHeight).toBe(1);
    });
  });

  describe('viewport properties', () => {
    it('should allow viewport customization', () => {
      const camera = new Camera();
      camera.viewportX = 0.25;
      camera.viewportY = 0.25;
      camera.viewportWidth = 0.5;
      camera.viewportHeight = 0.5;

      expect(camera.viewportX).toBe(0.25);
      expect(camera.viewportY).toBe(0.25);
      expect(camera.viewportWidth).toBe(0.5);
      expect(camera.viewportHeight).toBe(0.5);
    });
  });

  describe('clear color properties', () => {
    it('should allow clear color customization', () => {
      const camera = new Camera();
      camera.clearColorR = 0.5;
      camera.clearColorG = 0.3;
      camera.clearColorB = 0.8;
      camera.clearColorA = 0.9;

      expect(camera.clearColorR).toBe(0.5);
      expect(camera.clearColorG).toBe(0.3);
      expect(camera.clearColorB).toBe(0.8);
      expect(camera.clearColorA).toBe(0.9);
    });

    it('should default to dark gray opaque', () => {
      const camera = new Camera();

      expect(camera.clearColorR).toBe(0.1);
      expect(camera.clearColorG).toBe(0.1);
      expect(camera.clearColorB).toBe(0.1);
      expect(camera.clearColorA).toBe(1.0);
    });
  });

  describe('active flag', () => {
    it('should allow toggling active state', () => {
      const camera = new Camera();

      expect(camera.active).toBe(1);

      camera.active = 0;
      expect(camera.active).toBe(0);

      camera.active = 1;
      expect(camera.active).toBe(1);
    });
  });

  describe('projection type switching', () => {
    it('should allow changing from perspective to orthographic', () => {
      const camera = Camera.perspective(Math.PI / 4, 0.1, 100.0);

      expect(camera.projectionType).toBe(0);

      camera.projectionType = 1;
      camera.left = -10;
      camera.right = 10;
      camera.top = 10;
      camera.bottom = -10;

      expect(camera.projectionType).toBe(1);
      expect(camera.left).toBe(-10);
    });

    it('should preserve independent projection parameters', () => {
      const camera = new Camera();

      // Set perspective parameters
      camera.fov = Math.PI / 3;
      camera.perspectiveNear = 0.5;
      camera.perspectiveFar = 200.0;

      // Set orthographic parameters
      camera.left = -15;
      camera.right = 15;

      // Both sets should coexist
      expect(camera.fov).toBe(Math.PI / 3);
      expect(camera.left).toBe(-15);
    });
  });
});
