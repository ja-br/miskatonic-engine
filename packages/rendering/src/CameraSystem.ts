/**
 * CameraSystem - Epic 3.10
 *
 * ECS system for managing cameras and generating view/projection matrices.
 *
 * Features:
 * - View matrix generation from Transform component
 * - Perspective and orthographic projections
 * - Active camera management
 * - Multiple camera support
 *
 * Usage:
 * ```typescript
 * const cameraSystem = new CameraSystem(world);
 *
 * // Get active camera
 * const activeCamera = cameraSystem.getActiveCamera();
 *
 * // Get matrices for rendering
 * const viewMatrix = cameraSystem.getViewMatrix(cameraEntity);
 * const projectionMatrix = cameraSystem.getProjectionMatrix(cameraEntity, aspectRatio);
 *
 * // Set active camera
 * cameraSystem.setActiveCamera(cameraEntity);
 * ```
 */

import type { World, EntityId } from '@miskatonic/ecs';
import { Camera, Transform, Mat4 } from '@miskatonic/ecs';

export class CameraSystem {
  private world: World;
  private activeCameraId: EntityId | null = null;

  // Scratch buffers for view matrix calculation (avoid allocations in hot path)
  private scratchEye = new Float32Array(3);
  private scratchForward = new Float32Array(3);
  private scratchTarget = new Float32Array(3);
  private scratchUp = new Float32Array([0, 1, 0]);

  // Projection matrix cache to avoid redundant recalculations
  private projectionCache = new Map<EntityId, {
    matrix: Float32Array;
    fov: number;
    aspect: number;
    near: number;
    far: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
    projectionType: number;
  }>();

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Get the active camera entity
   */
  getActiveCamera(): EntityId | null {
    // Check if cached active camera is still valid
    if (this.activeCameraId !== null) {
      const camera = this.world.getComponent(this.activeCameraId, Camera);
      if (camera && camera.active === 1) {
        return this.activeCameraId;
      }
    }

    // Find first active camera
    const query = this.world.query().with(Camera).with(Transform).build();
    const results = this.world.executeQuery(query);

    for (const result of results) {
      const camera = this.world.getComponent(result.entity, Camera);
      if (camera && camera.active === 1) {
        this.activeCameraId = result.entity;
        return result.entity;
      }
    }

    this.activeCameraId = null;
    return null;
  }

  /**
   * Set the active camera
   */
  setActiveCamera(entity: EntityId): void {
    // Deactivate all cameras
    const query = this.world.query().with(Camera).build();
    const results = this.world.executeQuery(query);

    for (const result of results) {
      const camera = this.world.getComponent(result.entity, Camera);
      if (camera) {
        camera.active = 0;
        // Write back changes to ECS storage
        this.world.setComponent(result.entity, Camera, camera);
      }
    }

    // Activate the specified camera
    const camera = this.world.getComponent(entity, Camera);
    if (camera) {
      camera.active = 1;
      // Write back changes to ECS storage
      this.world.setComponent(entity, Camera, camera);
      this.activeCameraId = entity;
    } else {
      this.activeCameraId = null;
    }
  }

  /**
   * Get view matrix for a camera entity
   *
   * Generates lookAt matrix from Transform component position and rotation.
   */
  getViewMatrix(entity: EntityId): Float32Array {
    const transform = this.world.getComponent(entity, Transform);
    if (!transform) {
      throw new Error(`Entity ${entity} has no Transform component`);
    }

    // Camera position from transform (reuse scratch buffer)
    this.scratchEye[0] = transform.x;
    this.scratchEye[1] = transform.y;
    this.scratchEye[2] = transform.z;

    // Calculate forward vector from rotation
    const yaw = transform.rotationY;
    const pitch = transform.rotationX;

    this.scratchForward[0] = Math.sin(yaw) * Math.cos(pitch);
    this.scratchForward[1] = Math.sin(pitch);
    this.scratchForward[2] = -Math.cos(yaw) * Math.cos(pitch);

    // Target = eye + forward (reuse scratch buffer)
    this.scratchTarget[0] = this.scratchEye[0] + this.scratchForward[0];
    this.scratchTarget[1] = this.scratchEye[1] + this.scratchForward[1];
    this.scratchTarget[2] = this.scratchEye[2] + this.scratchForward[2];

    // Generate lookAt matrix (scratchUp is already initialized to [0, 1, 0])
    return Mat4.lookAt(this.scratchEye, this.scratchTarget, this.scratchUp);
  }

  /**
   * Get projection matrix for a camera entity
   *
   * @param entity - Camera entity
   * @param aspectRatio - Viewport aspect ratio (width / height)
   */
  getProjectionMatrix(entity: EntityId, aspectRatio: number): Float32Array {
    const camera = this.world.getComponent(entity, Camera);
    if (!camera) {
      throw new Error(`Entity ${entity} has no Camera component`);
    }

    // Check if cached matrix is still valid
    const cached = this.projectionCache.get(entity);
    if (cached && cached.projectionType === camera.projectionType) {
      if (camera.projectionType === 0) {
        // Perspective - check FOV, aspect, near, far
        if (
          cached.fov === camera.fov &&
          cached.aspect === aspectRatio &&
          cached.near === camera.perspectiveNear &&
          cached.far === camera.perspectiveFar
        ) {
          return cached.matrix;
        }
      } else {
        // Orthographic - check left, right, top, bottom, near, far
        if (
          cached.left === camera.left &&
          cached.right === camera.right &&
          cached.top === camera.top &&
          cached.bottom === camera.bottom &&
          cached.near === camera.orthoNear &&
          cached.far === camera.orthoFar
        ) {
          return cached.matrix;
        }
      }
    }

    // Recalculate and cache
    let matrix: Float32Array;
    if (camera.projectionType === 0) {
      // Perspective projection
      matrix = Mat4.perspective(
        camera.fov,
        aspectRatio,
        camera.perspectiveNear,
        camera.perspectiveFar
      );
    } else {
      // Orthographic projection
      matrix = Mat4.orthographic(
        camera.left,
        camera.right,
        camera.top,
        camera.bottom,
        camera.orthoNear,
        camera.orthoFar
      );
    }

    // Update cache
    this.projectionCache.set(entity, {
      matrix,
      fov: camera.fov,
      aspect: aspectRatio,
      near: camera.projectionType === 0 ? camera.perspectiveNear : camera.orthoNear,
      far: camera.projectionType === 0 ? camera.perspectiveFar : camera.orthoFar,
      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
      projectionType: camera.projectionType,
    });

    return matrix;
  }

  /**
   * Get combined view-projection matrix
   */
  getViewProjectionMatrix(entity: EntityId, aspectRatio: number): Float32Array {
    const view = this.getViewMatrix(entity);
    const projection = this.getProjectionMatrix(entity, aspectRatio);

    // VP = P * V
    return Mat4.multiply(projection, view);
  }

  /**
   * Get all camera entities
   */
  getAllCameras(): EntityId[] {
    const query = this.world.query().with(Camera).with(Transform).build();
    const results = this.world.executeQuery(query);
    return results.map((result) => result.entity);
  }

  /**
   * Check if entity has both Camera and Transform components
   */
  isValidCamera(entity: EntityId): boolean {
    return (
      this.world.hasComponent(entity, Camera) &&
      this.world.hasComponent(entity, Transform)
    );
  }
}
