/**
 * Physics types and interfaces
 *
 * Following "swappable preferred" design - abstract interface for multiple physics engines
 */

/**
 * 3D Vector
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Quaternion rotation
 */
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Rigid body types
 */
export enum RigidBodyType {
  DYNAMIC = 'dynamic',     // Affected by forces and gravity
  KINEMATIC = 'kinematic', // Not affected by forces, manually controlled
  STATIC = 'static',       // Fixed in place, zero velocity
}

/**
 * Collision shape types
 */
export enum CollisionShapeType {
  BOX = 'box',
  SPHERE = 'sphere',
  CAPSULE = 'capsule',
  CYLINDER = 'cylinder',
  CONE = 'cone',
  PLANE = 'plane',
  MESH = 'mesh',
  CONVEX_HULL = 'convex_hull',
  HEIGHTFIELD = 'heightfield',
  COMPOUND = 'compound',
}

/**
 * Collision shape descriptor
 */
export interface CollisionShape {
  type: CollisionShapeType;
  // Box
  halfExtents?: Vector3;
  // Sphere
  radius?: number;
  // Capsule/Cylinder/Cone
  height?: number;
  // Mesh/ConvexHull
  vertices?: Float32Array;
  indices?: Uint32Array;
  // Heightfield
  heights?: Float32Array;
  rows?: number;
  cols?: number;
  scale?: Vector3; // Scale for heightfield terrain
  // Compound - multiple shapes with relative transforms
  shapes?: Array<{
    shape: CollisionShape;
    position: Vector3;
    rotation: Quaternion;
  }>;
}

/**
 * Rigid body descriptor
 */
export interface RigidBodyDescriptor {
  type: RigidBodyType;
  position?: Vector3;
  rotation?: Quaternion;
  mass?: number;
  linearVelocity?: Vector3;
  angularVelocity?: Vector3;
  linearDamping?: number;
  angularDamping?: number;
  friction?: number;
  restitution?: number;
  collisionShape: CollisionShape;
  isSensor?: boolean; // Trigger zone (no physical response)
  collisionGroups?: number; // Bitmask for collision filtering
  collisionMask?: number;   // Bitmask for what to collide with
  enableCCD?: boolean; // Continuous Collision Detection (prevents tunneling for fast objects)
}

/**
 * Rigid body handle (opaque ID)
 */
export type RigidBodyHandle = number;

/**
 * Collision event
 */
export interface CollisionEvent {
  bodyA: RigidBodyHandle;
  bodyB: RigidBodyHandle;
  contactPoint: Vector3;
  contactNormal: Vector3;
  penetrationDepth: number;
  impulse: number;
}

/**
 * Raycast hit result
 */
export interface RaycastHit {
  body: RigidBodyHandle;
  point: Vector3;
  normal: Vector3;
  distance: number;
}

/**
 * Physics world configuration
 */
export interface PhysicsWorldConfig {
  gravity?: Vector3;
  timestep?: number; // Fixed timestep in seconds (default: 1/60)
  maxSubsteps?: number; // Max substeps per frame (default: 4)
  solverIterations?: number; // Constraint solver iterations (default: 10)
  enableCCD?: boolean; // Continuous collision detection (default: true)
  enableSleeping?: boolean; // Sleep inactive bodies (default: true)
}

/**
 * Abstract physics engine interface
 *
 * All physics engines must implement this interface to be swappable
 */
export interface IPhysicsEngine {
  /**
   * Initialize the physics engine
   * May be async for engines that need to load WASM modules
   */
  initialize(config: PhysicsWorldConfig): void | Promise<void>;

  /**
   * Step the physics simulation
   * @param deltaTime Time since last frame in seconds
   */
  step(deltaTime: number): void;

  /**
   * Create a rigid body
   * @returns Handle to the created body
   */
  createRigidBody(descriptor: RigidBodyDescriptor): RigidBodyHandle;

  /**
   * Remove a rigid body
   */
  removeRigidBody(handle: RigidBodyHandle): void;

  /**
   * Get rigid body position
   */
  getPosition(handle: RigidBodyHandle): Vector3;

  /**
   * Set rigid body position
   */
  setPosition(handle: RigidBodyHandle, position: Vector3): void;

  /**
   * Get rigid body rotation
   */
  getRotation(handle: RigidBodyHandle): Quaternion;

  /**
   * Set rigid body rotation
   */
  setRotation(handle: RigidBodyHandle, rotation: Quaternion): void;

  /**
   * Get linear velocity
   */
  getLinearVelocity(handle: RigidBodyHandle): Vector3;

  /**
   * Set linear velocity
   */
  setLinearVelocity(handle: RigidBodyHandle, velocity: Vector3): void;

  /**
   * Get angular velocity
   */
  getAngularVelocity(handle: RigidBodyHandle): Vector3;

  /**
   * Set angular velocity
   */
  setAngularVelocity(handle: RigidBodyHandle, velocity: Vector3): void;

  /**
   * Apply force at center of mass
   */
  applyForce(handle: RigidBodyHandle, force: Vector3): void;

  /**
   * Apply impulse at center of mass
   */
  applyImpulse(handle: RigidBodyHandle, impulse: Vector3): void;

  /**
   * Apply torque
   */
  applyTorque(handle: RigidBodyHandle, torque: Vector3): void;

  /**
   * Perform a raycast
   * @returns First hit, or null if no hit
   */
  raycast(origin: Vector3, direction: Vector3, maxDistance: number): RaycastHit | null;

  /**
   * Get all collision events since last step
   */
  getCollisionEvents(): CollisionEvent[];

  /**
   * Set gravity
   */
  setGravity(gravity: Vector3): void;

  /**
   * Enable/disable a rigid body
   */
  setEnabled(handle: RigidBodyHandle, enabled: boolean): void;

  /**
   * Check if a rigid body is sleeping (inactive)
   */
  isSleeping(handle: RigidBodyHandle): boolean;

  /**
   * Wake up a sleeping rigid body
   */
  wakeUp(handle: RigidBodyHandle): void;

  /**
   * Dispose of the physics engine and free resources
   */
  dispose(): void;
}

/**
 * Default physics world configuration
 */
export const DEFAULT_PHYSICS_CONFIG: PhysicsWorldConfig = {
  gravity: { x: 0, y: -9.81, z: 0 },
  timestep: 1 / 60,
  maxSubsteps: 4,
  solverIterations: 10,
  enableCCD: true,
  enableSleeping: true,
};
