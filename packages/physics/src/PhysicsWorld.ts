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
export class PhysicsWorld<TUserData = unknown> {
  private engine: IPhysicsEngine;
  private config: PhysicsWorldConfig;
  private accumulator: number = 0;
  private bodies = new Map<RigidBodyHandle, TUserData>(); // Store user data per body

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
   */
  step(deltaTime: number): void {
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
   * Dispose of the physics world
   */
  dispose(): void {
    this.engine.dispose();
    this.bodies.clear();
  }
}
