/**
 * IPhysicsAdapter
 *
 * Generic interface for physics engines used by PhysicsSyncSystem.
 * This allows PhysicsSyncSystem to work with any physics engine
 * (Rapier, Cannon-es, Box2D, etc.) without hard dependencies.
 *
 * To use a physics engine with PhysicsSyncSystem, implement this interface
 * as a thin adapter over your physics engine's API.
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Minimal physics adapter interface for syncing physics state to ECS
 */
export interface IPhysicsAdapter {
  /**
   * Get position of a physics body
   * @param bodyHandle - Opaque handle to physics body
   * @returns Position vector or undefined if body doesn't exist
   */
  getPosition(bodyHandle: number): Vector3 | undefined;

  /**
   * Get rotation of a physics body
   * @param bodyHandle - Opaque handle to physics body
   * @returns Rotation quaternion or undefined if body doesn't exist
   */
  getRotation(bodyHandle: number): Quaternion | undefined;
}
