import type { Component } from '../types';

/**
 * Camera component - PURE DATA SCHEMA (Epic 3.10)
 *
 * This is a data-only component with NO methods.
 * All camera operations are performed by CameraSystem.
 *
 * Projection Types:
 * - 0 = Perspective
 * - 1 = Orthographic
 *
 * Memory Layout (depends on projection type):
 * Perspective (40 bytes):
 * - projectionType: 1 byte (Uint8)
 * - fov: 4 bytes (Float32) - in radians
 * - near: 4 bytes (Float32)
 * - far: 4 bytes (Float32)
 * - viewport: 16 bytes (4 × Float32: x, y, width, height)
 * - clearColor: 16 bytes (4 × Float32: r, g, b, a)
 * - active: 1 byte (Uint8)
 * - padding: 2 bytes
 *
 * Orthographic (56 bytes):
 * - projectionType: 1 byte (Uint8)
 * - left, right, top, bottom, near, far: 24 bytes (6 × Float32)
 * - viewport: 16 bytes (4 × Float32)
 * - clearColor: 16 bytes (4 × Float32)
 * - active: 1 byte (Uint8)
 * - padding: 2 bytes
 *
 * Usage:
 * ```typescript
 * // Create perspective camera
 * const camera = world.createEntity();
 * world.addComponent(camera, Transform, new Transform(0, 0, 5));
 * world.addComponent(camera, Camera, Camera.perspective(
 *   Math.PI / 4,  // 45° FOV
 *   0.1,          // near
 *   100           // far
 * ));
 *
 * // Create orthographic camera
 * const orthoCamera = world.createEntity();
 * world.addComponent(orthoCamera, Transform, new Transform(0, 0, 10));
 * world.addComponent(orthoCamera, Camera, Camera.orthographic(
 *   -10, 10,  // left, right
 *   -10, 10,  // top, bottom
 *   0.1, 100  // near, far
 * ));
 *
 * // Get view/projection matrices via CameraSystem
 * const viewMatrix = cameraSystem.getViewMatrix(camera);
 * const projectionMatrix = cameraSystem.getProjectionMatrix(camera, aspectRatio);
 * ```
 */
export class Camera implements Component {
  readonly __componentType = 'Camera';

  // Projection type
  // 0 = perspective, 1 = orthographic
  public projectionType: number = 0;

  // Perspective projection parameters (Float32Array)
  public fov: number = Math.PI / 4; // 45 degrees in radians
  public perspectiveNear: number = 0.1;
  public perspectiveFar: number = 100.0;

  // Orthographic projection parameters (Float32Array)
  public left: number = -10;
  public right: number = 10;
  public top: number = 10;
  public bottom: number = -10;
  public orthoNear: number = 0.1;
  public orthoFar: number = 100.0;

  // Viewport (Float32Array)
  public viewportX: number = 0;      // Normalized [0,1] or pixels
  public viewportY: number = 0;
  public viewportWidth: number = 1;  // Normalized [0,1] or pixels
  public viewportHeight: number = 1;

  // Clear color (Float32Array)
  public clearColorR: number = 0.1;
  public clearColorG: number = 0.1;
  public clearColorB: number = 0.1;
  public clearColorA: number = 1.0;

  // Active flag (Uint8Array)
  // Only one camera should be active per scene
  public active: number = 1;  // 0 = inactive, 1 = active

  /**
   * Constructor for creating new Camera instances
   */
  constructor(
    projectionType: number = 0,
    fov: number = Math.PI / 4,
    near: number = 0.1,
    far: number = 100.0
  ) {
    this.projectionType = projectionType;

    if (projectionType === 0) {
      // Perspective
      this.fov = fov;
      this.perspectiveNear = near;
      this.perspectiveFar = far;
    } else {
      // Orthographic
      this.left = -10;
      this.right = 10;
      this.top = 10;
      this.bottom = -10;
      this.orthoNear = near;
      this.orthoFar = far;
    }
  }

  /**
   * Create a perspective camera
   */
  static perspective(fov: number, near: number, far: number): Camera {
    return new Camera(0, fov, near, far);
  }

  /**
   * Create an orthographic camera
   */
  static orthographic(
    left: number,
    right: number,
    top: number,
    bottom: number,
    near: number,
    far: number
  ): Camera {
    const camera = new Camera(1, 0, near, far);
    camera.left = left;
    camera.right = right;
    camera.top = top;
    camera.bottom = bottom;
    camera.orthoNear = near;
    camera.orthoFar = far;
    return camera;
  }

  // NOTE: No methods on component - pure data only (ECS principle)
  // Use direct property assignment: camera.clearColorR = 1.0;
}
