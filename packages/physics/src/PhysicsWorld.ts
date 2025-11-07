/**
 * Physics World
 *
 * High-level physics simulation manager with hot-swappable backends
 */

import type {
  IPhysicsEngine,
  PhysicsWorldConfig,
  RigidBodyDescriptor,
  RigidBodyHandle,
  Vector3,
  Quaternion,
  CollisionEvent,
  RaycastHit,
} from './types';
import { DEFAULT_PHYSICS_CONFIG } from './types';

/**
 * Physics world that manages the simulation
 *
 * Design: Follows "swappable preferred" - physics engine can be changed at runtime
 * @template TUserData Type of user data to attach to rigid bodies
 */
/**
 * Collision callback function
 */
export type CollisionCallback = (event: CollisionEvent) => void;

/**
 * Joint break event
 */
export interface JointBreakEvent {
  /** Handle of the joint that broke */
  jointHandle: import('./types').JointHandle;
  /** Body A handle */
  bodyA: RigidBodyHandle;
  /** Body B handle */
  bodyB: RigidBodyHandle;
  /** Force magnitude that caused the break */
  force: number;
}

/**
 * Joint break callback function
 */
export type JointBreakCallback = (event: JointBreakEvent) => void;

export class PhysicsWorld<TUserData = unknown> {
  private engine: IPhysicsEngine;
  private config: PhysicsWorldConfig;
  private accumulator: number = 0;
  private bodies = new Map<RigidBodyHandle, TUserData>(); // Store user data per body
  private collisionCallbacks: CollisionCallback[] = [];
  private jointBreakCallbacks: JointBreakCallback[] = [];

  private constructor(engine: IPhysicsEngine, config: PhysicsWorldConfig) {
    this.engine = engine;
    this.config = config;
  }

  /**
   * Create a new physics world
   * Use this instead of constructor to handle async initialization
   */
  static async create<TUserData = unknown>(
    engine: IPhysicsEngine,
    config: Partial<PhysicsWorldConfig> = {}
  ): Promise<PhysicsWorld<TUserData>> {
    const finalConfig = { ...DEFAULT_PHYSICS_CONFIG, ...config };
    const world = new PhysicsWorld<TUserData>(engine, finalConfig);
    await engine.initialize(finalConfig);
    return world;
  }

  /**
   * Step the physics simulation with fixed timestep
   *
   * Uses accumulator pattern for deterministic physics
   *
   * @returns interpolation factor (alpha) for smooth rendering between physics steps
   */
  step(deltaTime: number): number {
    const timestep = this.config.timestep!;
    const maxSubsteps = this.config.maxSubsteps!;

    this.accumulator += deltaTime;

    // Clamp accumulator to prevent spiral of death
    const maxAccumulator = timestep * maxSubsteps;
    if (this.accumulator > maxAccumulator) {
      this.accumulator = maxAccumulator;
    }

    // Step physics in fixed increments
    let substeps = 0;
    while (this.accumulator >= timestep && substeps < maxSubsteps) {
      this.engine.step(timestep);
      this.accumulator -= timestep;
      substeps++;
    }

    // Process collision events and trigger callbacks
    const collisionEvents = this.engine.getCollisionEvents();
    for (const event of collisionEvents) {
      for (const callback of this.collisionCallbacks) {
        callback(event);
      }
    }

    // Check for broken joints and trigger callbacks
    this.checkJointBreaking();

    // Return interpolation factor for smooth rendering
    // alpha = 0 means exactly on a physics step
    // alpha = 1 means almost at the next physics step
    // Use this to interpolate visual positions: renderPos = prevPos + alpha * (currentPos - prevPos)
    return this.accumulator / timestep;
  }

  /**
   * Create a rigid body
   */
  createRigidBody(descriptor: RigidBodyDescriptor, userData?: TUserData): RigidBodyHandle {
    const handle = this.engine.createRigidBody(descriptor);
    if (userData !== undefined) {
      this.bodies.set(handle, userData);
    }
    return handle;
  }

  /**
   * Remove a rigid body
   */
  removeRigidBody(handle: RigidBodyHandle): void {
    this.engine.removeRigidBody(handle);
    this.bodies.delete(handle);
  }

  /**
   * Get user data associated with a body
   */
  getUserData(handle: RigidBodyHandle): TUserData | undefined {
    return this.bodies.get(handle);
  }

  /**
   * Set user data for a body
   */
  setUserData(handle: RigidBodyHandle, userData: TUserData): void {
    this.bodies.set(handle, userData);
  }

  /**
   * Get rigid body position
   */
  getPosition(handle: RigidBodyHandle): Vector3 {
    return this.engine.getPosition(handle);
  }

  /**
   * Set rigid body position
   */
  setPosition(handle: RigidBodyHandle, position: Vector3): void {
    this.engine.setPosition(handle, position);
  }

  /**
   * Get rigid body rotation
   */
  getRotation(handle: RigidBodyHandle): Quaternion {
    return this.engine.getRotation(handle);
  }

  /**
   * Set rigid body rotation
   */
  setRotation(handle: RigidBodyHandle, rotation: Quaternion): void {
    this.engine.setRotation(handle, rotation);
  }

  /**
   * Get linear velocity
   */
  getLinearVelocity(handle: RigidBodyHandle): Vector3 {
    return this.engine.getLinearVelocity(handle);
  }

  /**
   * Set linear velocity
   */
  setLinearVelocity(handle: RigidBodyHandle, velocity: Vector3): void {
    this.engine.setLinearVelocity(handle, velocity);
  }

  /**
   * Get angular velocity
   */
  getAngularVelocity(handle: RigidBodyHandle): Vector3 {
    return this.engine.getAngularVelocity(handle);
  }

  /**
   * Set angular velocity
   */
  setAngularVelocity(handle: RigidBodyHandle, velocity: Vector3): void {
    this.engine.setAngularVelocity(handle, velocity);
  }

  /**
   * Apply force at center of mass
   */
  applyForce(handle: RigidBodyHandle, force: Vector3): void {
    this.engine.applyForce(handle, force);
  }

  /**
   * Apply impulse at center of mass
   */
  applyImpulse(handle: RigidBodyHandle, impulse: Vector3): void {
    this.engine.applyImpulse(handle, impulse);
  }

  /**
   * Apply torque
   */
  applyTorque(handle: RigidBodyHandle, torque: Vector3): void {
    this.engine.applyTorque(handle, torque);
  }

  /**
   * Perform a raycast
   */
  raycast(origin: Vector3, direction: Vector3, maxDistance: number): RaycastHit | null {
    return this.engine.raycast(origin, direction, maxDistance);
  }

  /**
   * Get all collision events since last step
   */
  getCollisionEvents(): CollisionEvent[] {
    return this.engine.getCollisionEvents();
  }

  /**
   * Set gravity
   */
  setGravity(gravity: Vector3): void {
    this.engine.setGravity(gravity);
    this.config.gravity = gravity;
  }

  /**
   * Enable/disable a rigid body
   */
  setEnabled(handle: RigidBodyHandle, enabled: boolean): void {
    this.engine.setEnabled(handle, enabled);
  }

  /**
   * Check if a rigid body is sleeping
   */
  isSleeping(handle: RigidBodyHandle): boolean {
    return this.engine.isSleeping(handle);
  }

  /**
   * Wake up a sleeping rigid body
   */
  wakeUp(handle: RigidBodyHandle): void {
    this.engine.wakeUp(handle);
  }

  /**
   * Register a collision event callback
   * @returns unsubscribe function
   */
  onCollision(callback: CollisionCallback): () => void {
    this.collisionCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.collisionCallbacks.indexOf(callback);
      if (index !== -1) {
        this.collisionCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Remove all collision callbacks
   */
  clearCollisionCallbacks(): void {
    this.collisionCallbacks.length = 0;
  }

  /**
   * Register a joint break event callback
   * @returns unsubscribe function
   */
  onJointBreak(callback: JointBreakCallback): () => void {
    this.jointBreakCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.jointBreakCallbacks.indexOf(callback);
      if (index !== -1) {
        this.jointBreakCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Remove all joint break callbacks
   */
  clearJointBreakCallbacks(): void {
    this.jointBreakCallbacks.length = 0;
  }

  /**
   * Check joints for breaking and trigger callbacks
   * Called internally each physics step
   */
  private checkJointBreaking(): void {
    const brokenJoints = this.engine.checkJointBreaking();
    for (const event of brokenJoints) {
      // Trigger callbacks
      for (const callback of this.jointBreakCallbacks) {
        callback(event);
      }
    }
  }

  /**
   * Get the current physics engine
   */
  getEngine(): IPhysicsEngine {
    return this.engine;
  }

  /**
   * Hot-swap the physics engine
   *
   * WARNING: This will clear all bodies. Transfer state manually if needed.
   */
  async swapEngine(newEngine: IPhysicsEngine): Promise<void> {
    // Dispose old engine
    this.engine.dispose();

    // Initialize new engine
    this.engine = newEngine;
    await this.engine.initialize(this.config);

    // Clear body map (user must recreate bodies)
    this.bodies.clear();
    this.accumulator = 0;
  }

  /**
   * Create a joint constraint between two rigid bodies
   *
   * Supported joint types:
   * - FIXED: Weld joints that rigidly connect bodies
   * - REVOLUTE: Hinge joints with optional angle limits and motors
   * - PRISMATIC: Slider joints with optional distance limits and motors
   * - SPHERICAL: Ball-and-socket joints with free rotation
   * - GENERIC: 6-DOF joints with per-axis configuration
   * - SPRING: Soft distance constraints with stiffness and damping
   *
   * @param descriptor Joint configuration including type, bodies, anchors, and constraints
   * @returns Handle to the created joint
   *
   * @example
   * // Create a door hinge
   * const doorJoint = physicsWorld.createJoint({
   *   type: JointType.REVOLUTE,
   *   bodyA: doorFrameHandle,
   *   bodyB: doorHandle,
   *   anchorA: { position: { x: 0, y: 0, z: 0 } },
   *   anchorB: { position: { x: -0.5, y: 0, z: 0 } },
   *   axis: { x: 0, y: 1, z: 0 },
   *   limits: { min: 0, max: Math.PI / 2 }
   * });
   */
  createJoint(descriptor: import('./types').JointDescriptor): import('./types').JointHandle {
    return this.engine.createJoint(descriptor);
  }

  /**
   * Remove a joint constraint and free its resources
   *
   * @param handle Handle to the joint to remove
   */
  removeJoint(handle: import('./types').JointHandle): void {
    this.engine.removeJoint(handle);
  }

  /**
   * Set or update motor parameters for a revolute or prismatic joint
   *
   * Motors apply continuous forces to maintain a target velocity.
   * Pass null to disable the motor.
   *
   * @param handle Handle to the joint
   * @param motor Motor configuration with target velocity and max force, or null to disable
   *
   * @example
   * // Enable motor with 2.0 rad/s target velocity
   * physicsWorld.setJointMotor(jointHandle, {
   *   targetVelocity: 2.0,
   *   maxForce: 10.0
   * });
   *
   * // Disable motor
   * physicsWorld.setJointMotor(jointHandle, null);
   */
  setJointMotor(handle: import('./types').JointHandle, motor: import('./types').JointMotor | null): void {
    this.engine.setJointMotor(handle, motor);
  }

  /**
   * Get current angle (revolute) or position (prismatic) of a joint
   *
   * Returns the current state of the joint calculated from body transforms:
   * - REVOLUTE joints: angle in radians
   * - PRISMATIC joints: distance in world units
   * - Other joint types: 0
   *
   * @param handle Handle to the joint
   * @returns Current joint value (angle in radians or position in units)
   *
   * @example
   * // Get door angle
   * const doorAngle = physicsWorld.getJointValue(doorJointHandle);
   * const degrees = (doorAngle * 180) / Math.PI;
   *
   * // Get elevator position
   * const elevatorY = physicsWorld.getJointValue(elevatorJointHandle);
   */
  getJointValue(handle: import('./types').JointHandle): number {
    return this.engine.getJointValue(handle);
  }

  /**
   * Get debug information for visualizing a joint
   *
   * Returns world-space anchor positions and axis direction for rendering
   * debug visualization lines. Useful for debugging joint setup and behavior.
   *
   * @param handle Handle to the joint
   * @returns Debug info with world-space positions and axis, or null if joint doesn't exist
   *
   * @example
   * // Get debug info for rendering constraint lines
   * const debugInfo = physicsWorld.getJointDebugInfo(jointHandle);
   * if (debugInfo) {
   *   // Draw line from anchorA to anchorB
   *   drawLine(debugInfo.anchorA, debugInfo.anchorB, 'yellow');
   *
   *   // Draw axis direction if available (revolute/prismatic)
   *   if (debugInfo.axis) {
   *     const axisEnd = {
   *       x: debugInfo.anchorA.x + debugInfo.axis.x,
   *       y: debugInfo.anchorA.y + debugInfo.axis.y,
   *       z: debugInfo.anchorA.z + debugInfo.axis.z
   *     };
   *     drawLine(debugInfo.anchorA, axisEnd, 'cyan');
   *   }
   * }
   */
  getJointDebugInfo(handle: import('./types').JointHandle): import('./types').JointDebugInfo | null {
    return this.engine.getJointDebugInfo(handle);
  }

  /**
   * Dispose of the physics world
   */
  dispose(): void {
    this.engine.dispose();
    this.bodies.clear();
  }
}
