/**
 * Camera Controllers - Epic 3.10
 *
 * ECS-based camera controllers for common control schemes.
 */

import type { World, EntityId } from '@miskatonic/ecs';
import { Transform } from '@miskatonic/ecs';

/**
 * Orbit Camera Controller
 *
 * Mouse-based camera that orbits around a target point.
 * - Left mouse drag: Rotate
 * - Mouse wheel: Zoom in/out
 */
export class OrbitCameraController {
  private entity: EntityId;
  private world: World;

  private distance: number = 10;
  private azimuth: number = 0;      // Horizontal rotation (radians)
  private elevation: number = Math.PI / 6;   // Vertical rotation (radians)
  private targetX: number = 0;
  private targetY: number = 0;
  private targetZ: number = 0;

  constructor(entity: EntityId, world: World, distance: number = 10) {
    this.entity = entity;
    this.world = world;
    this.distance = distance;
    this.updatePosition();
  }

  /**
   * Set orbit target point
   */
  setTarget(x: number, y: number, z: number): void {
    this.targetX = x;
    this.targetY = y;
    this.targetZ = z;
    this.updatePosition();
  }

  /**
   * Rotate camera
   * @param deltaAzimuth - Horizontal rotation delta (radians)
   * @param deltaElevation - Vertical rotation delta (radians)
   */
  rotate(deltaAzimuth: number, deltaElevation: number): void {
    this.azimuth += deltaAzimuth;
    this.elevation += deltaElevation;

    // Clamp elevation to avoid gimbal lock
    this.elevation = Math.max(0.1, Math.min(Math.PI - 0.1, this.elevation));

    this.updatePosition();
  }

  /**
   * Zoom camera in/out
   * @param delta - Distance delta (negative = zoom in, positive = zoom out)
   */
  zoom(delta: number): void {
    this.distance += delta;
    this.distance = Math.max(1, Math.min(100, this.distance));
    this.updatePosition();
  }

  /**
   * Pan camera (move target point)
   * @param deltaX - Horizontal pan delta (screen space)
   * @param deltaY - Vertical pan delta (screen space)
   */
  pan(deltaX: number, deltaY: number): void {
    // Calculate camera's right and up vectors based on current orientation
    // Right vector is perpendicular to view direction in XZ plane
    const rightX = Math.cos(this.azimuth);
    const rightZ = Math.sin(this.azimuth);

    // Up vector in world space (simplified - just Y axis for orbit camera)
    // For more accurate pan, we'd use the camera's actual up vector
    const upX = -Math.cos(this.elevation) * Math.sin(this.azimuth);
    const upY = Math.sin(this.elevation);
    const upZ = Math.cos(this.elevation) * Math.cos(this.azimuth);

    // Scale pan amount based on distance (further = larger movements)
    const panScale = this.distance * 0.002;

    // Move target in camera-relative directions
    this.targetX += (rightX * deltaX + upX * deltaY) * panScale;
    this.targetY += upY * deltaY * panScale;
    this.targetZ += (rightZ * deltaX + upZ * deltaY) * panScale;

    this.updatePosition();
  }

  /**
   * Reset camera to default view
   */
  reset(distance: number = 10, azimuth: number = 0, elevation: number = Math.PI / 6): void {
    this.distance = distance;
    this.azimuth = azimuth;
    this.elevation = elevation;
    this.targetX = 0;
    this.targetY = 0;
    this.targetZ = 0;
    this.updatePosition();
  }

  /**
   * Get current camera state
   */
  getState(): { distance: number; azimuth: number; elevation: number; target: [number, number, number] } {
    return {
      distance: this.distance,
      azimuth: this.azimuth,
      elevation: this.elevation,
      target: [this.targetX, this.targetY, this.targetZ]
    };
  }

  /**
   * Update camera position based on orbit parameters
   */
  private updatePosition(): void {
    const transform = this.world.getComponent(this.entity, Transform);
    if (!transform) return;

    // Calculate position from spherical coordinates
    // Convention: elevation = angle from +Y axis (0 = up, π/2 = horizon, π = down)
    //             azimuth = rotation around Y axis
    // Formula: x = r*sin(φ)*cos(θ), y = r*cos(φ), z = r*sin(φ)*sin(θ)
    const x = this.targetX + this.distance * Math.sin(this.elevation) * Math.cos(this.azimuth);
    const y = this.targetY + this.distance * Math.cos(this.elevation);
    const z = this.targetZ + this.distance * Math.sin(this.elevation) * Math.sin(this.azimuth);

    // Update transform
    transform.x = x;
    transform.y = y;
    transform.z = z;

    // Calculate rotation to look at target
    const dx = this.targetX - x;
    const dy = this.targetY - y;
    const dz = this.targetZ - z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    transform.rotationY = Math.atan2(dx, -dz);
    transform.rotationX = Math.atan2(dy, dist);
    transform.rotationZ = 0;

    transform.dirty = 1;

    // Write back changes to ECS storage
    this.world.setComponent(this.entity, Transform, transform);
  }
}

/**
 * First-Person Camera Controller
 *
 * WASD movement + mouse look for FPS-style controls.
 */
export class FirstPersonCameraController {
  private entity: EntityId;
  private world: World;

  private yaw: number = 0;    // Horizontal rotation (radians)
  private pitch: number = 0;  // Vertical rotation (radians)
  private moveSpeed: number = 5.0;

  constructor(entity: EntityId, world: World, moveSpeed: number = 5.0) {
    this.entity = entity;
    this.world = world;
    this.moveSpeed = moveSpeed;
  }

  /**
   * Update camera rotation from mouse movement
   * @param deltaX - Mouse X delta
   * @param deltaY - Mouse Y delta
   * @param sensitivity - Mouse sensitivity
   */
  look(deltaX: number, deltaY: number, sensitivity: number = 0.002): void {
    this.yaw += deltaX * sensitivity;
    this.pitch -= deltaY * sensitivity;

    // Clamp pitch to avoid flipping
    this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));

    const transform = this.world.getComponent(this.entity, Transform);
    if (!transform) return;

    transform.rotationX = this.pitch;
    transform.rotationY = this.yaw;
    transform.rotationZ = 0;
    transform.dirty = 1;

    // Write back changes to ECS storage
    this.world.setComponent(this.entity, Transform, transform);
  }

  /**
   * Move camera based on input direction
   * @param forward - Forward/backward movement (-1 to 1)
   * @param right - Right/left movement (-1 to 1)
   * @param dt - Delta time in seconds
   */
  move(forward: number, right: number, dt: number): void {
    const transform = this.world.getComponent(this.entity, Transform);
    if (!transform) return;

    // Calculate forward and right vectors from rotation
    const forwardX = Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = Math.sin(this.yaw);

    // Calculate movement
    const speed = this.moveSpeed * dt;
    const moveX = (forwardX * forward + rightX * right) * speed;
    const moveZ = (forwardZ * forward + rightZ * right) * speed;

    // Update position
    transform.x += moveX;
    transform.z += moveZ;
    transform.dirty = 1;

    // Write back changes to ECS storage
    this.world.setComponent(this.entity, Transform, transform);
  }
}
