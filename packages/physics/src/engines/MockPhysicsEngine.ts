/**
 * Mock Physics Engine
 *
 * Simple implementation for testing and as a reference
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
  JointDescriptor,
  JointHandle,
  JointMotor,
  JointDebugInfo,
  SerializedPhysicsState,
  DeserializationResult,
} from '../types';
import { RigidBodyType } from '../types';

interface MockRigidBody {
  handle: RigidBodyHandle;
  type: RigidBodyType;
  position: Vector3;
  rotation: Quaternion;
  linearVelocity: Vector3;
  angularVelocity: Vector3;
  mass: number;
  enabled: boolean;
  sleeping: boolean;
}

/**
 * Mock physics engine for testing
 *
 * Implements basic Euler integration without collision detection
 */
export class MockPhysicsEngine implements IPhysicsEngine {
  private bodies = new Map<RigidBodyHandle, MockRigidBody>();
  private nextHandle: RigidBodyHandle = 1;
  private gravity: Vector3 = { x: 0, y: -9.81, z: 0 };
  private collisionEvents: CollisionEvent[] = [];

  initialize(config: PhysicsWorldConfig): void {
    if (config.gravity) {
      this.gravity = config.gravity;
    }
  }

  step(deltaTime: number): void {
    // Clear collision events
    this.collisionEvents = [];

    // Simple Euler integration
    for (const body of this.bodies.values()) {
      if (!body.enabled || body.sleeping || body.type !== RigidBodyType.DYNAMIC) {
        continue;
      }

      // Apply gravity
      body.linearVelocity.x += this.gravity.x * deltaTime;
      body.linearVelocity.y += this.gravity.y * deltaTime;
      body.linearVelocity.z += this.gravity.z * deltaTime;

      // Update position
      body.position.x += body.linearVelocity.x * deltaTime;
      body.position.y += body.linearVelocity.y * deltaTime;
      body.position.z += body.linearVelocity.z * deltaTime;

      // Simple sleep detection (if velocity is very low)
      const speed = Math.sqrt(
        body.linearVelocity.x ** 2 +
        body.linearVelocity.y ** 2 +
        body.linearVelocity.z ** 2
      );
      if (speed < 0.01) {
        body.sleeping = true;
      }
    }
  }

  createRigidBody(descriptor: RigidBodyDescriptor): RigidBodyHandle {
    const handle = this.nextHandle++;
    const body: MockRigidBody = {
      handle,
      type: descriptor.type,
      position: descriptor.position || { x: 0, y: 0, z: 0 },
      rotation: descriptor.rotation || { x: 0, y: 0, z: 0, w: 1 },
      linearVelocity: descriptor.linearVelocity || { x: 0, y: 0, z: 0 },
      angularVelocity: descriptor.angularVelocity || { x: 0, y: 0, z: 0 },
      mass: descriptor.mass || 1.0,
      enabled: true,
      sleeping: false,
    };
    this.bodies.set(handle, body);
    return handle;
  }

  removeRigidBody(handle: RigidBodyHandle): void {
    this.bodies.delete(handle);
  }

  getPosition(handle: RigidBodyHandle): Vector3 {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);
    return { ...body.position };
  }

  setPosition(handle: RigidBodyHandle, position: Vector3): void {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);
    body.position = { ...position };
  }

  getRotation(handle: RigidBodyHandle): Quaternion {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);
    return { ...body.rotation };
  }

  setRotation(handle: RigidBodyHandle, rotation: Quaternion): void {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);
    body.rotation = { ...rotation };
  }

  getLinearVelocity(handle: RigidBodyHandle): Vector3 {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);
    return { ...body.linearVelocity };
  }

  setLinearVelocity(handle: RigidBodyHandle, velocity: Vector3): void {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);
    body.linearVelocity = { ...velocity };
    body.sleeping = false;
  }

  getAngularVelocity(handle: RigidBodyHandle): Vector3 {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);
    return { ...body.angularVelocity };
  }

  setAngularVelocity(handle: RigidBodyHandle, velocity: Vector3): void {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);
    body.angularVelocity = { ...velocity };
    body.sleeping = false;
  }

  applyForce(handle: RigidBodyHandle, force: Vector3): void {
    const body = this.bodies.get(handle);
    if (!body || body.type !== RigidBodyType.DYNAMIC) return;

    // F = ma, so a = F/m
    const accel = {
      x: force.x / body.mass,
      y: force.y / body.mass,
      z: force.z / body.mass,
    };

    // Apply as velocity change (simple Euler)
    body.linearVelocity.x += accel.x;
    body.linearVelocity.y += accel.y;
    body.linearVelocity.z += accel.z;
    body.sleeping = false;
  }

  applyImpulse(handle: RigidBodyHandle, impulse: Vector3): void {
    const body = this.bodies.get(handle);
    if (!body || body.type !== RigidBodyType.DYNAMIC) return;

    // Impulse = mass * velocity change
    body.linearVelocity.x += impulse.x / body.mass;
    body.linearVelocity.y += impulse.y / body.mass;
    body.linearVelocity.z += impulse.z / body.mass;
    body.sleeping = false;
  }

  applyTorque(handle: RigidBodyHandle, torque: Vector3): void {
    const body = this.bodies.get(handle);
    if (!body || body.type !== RigidBodyType.DYNAMIC) return;

    // Simple torque (not physically accurate)
    body.angularVelocity.x += torque.x;
    body.angularVelocity.y += torque.y;
    body.angularVelocity.z += torque.z;
    body.sleeping = false;
  }

  raycast(_origin: Vector3, _direction: Vector3, _maxDistance: number): RaycastHit | null {
    // Mock implementation - no actual raycasting
    return null;
  }

  getCollisionEvents(): CollisionEvent[] {
    return this.collisionEvents;
  }

  setGravity(gravity: Vector3): void {
    this.gravity = { ...gravity };
  }

  setEnabled(handle: RigidBodyHandle, enabled: boolean): void {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);
    body.enabled = enabled;
  }

  isSleeping(handle: RigidBodyHandle): boolean {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);
    return body.sleeping;
  }

  wakeUp(handle: RigidBodyHandle): void {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);
    body.sleeping = false;
  }

  dispose(): void {
    this.bodies.clear();
    this.collisionEvents = [];
  }

  // Joint constraint methods (stub implementations)
  createJoint(_descriptor: JointDescriptor): JointHandle {
    // Mock implementation - just return a unique ID
    console.warn('MockPhysicsEngine: createJoint() is a stub implementation');
    return Math.random();
  }

  removeJoint(_handle: JointHandle): void {
    // Mock implementation - no-op
    console.warn('MockPhysicsEngine: removeJoint() is a stub implementation');
  }

  setJointMotor(_handle: JointHandle, _motor: JointMotor | null): void {
    // Mock implementation - no-op
    console.warn('MockPhysicsEngine: setJointMotor() is a stub implementation');
  }

  getJointValue(_handle: JointHandle): number {
    // Mock implementation - return 0
    console.warn('MockPhysicsEngine: getJointValue() is a stub implementation');
    return 0;
  }

  getJointDebugInfo(_handle: JointHandle): JointDebugInfo | null {
    // Mock implementation - return null
    console.warn('MockPhysicsEngine: getJointDebugInfo() is a stub implementation');
    return null;
  }

  checkJointBreaking(): Array<{
    jointHandle: JointHandle;
    bodyA: RigidBodyHandle;
    bodyB: RigidBodyHandle;
    force: number;
  }> {
    // Mock implementation - return empty array
    return [];
  }

  serializeState(): SerializedPhysicsState {
    // Mock implementation - return minimal state
    return {
      version: 1,
      time: 0,
      step: 0,
      gravity: this.gravity,
      bodies: [],
      joints: [],
    };
  }

  deserializeState(_state: SerializedPhysicsState): DeserializationResult {
    // Mock implementation - return empty maps
    console.warn('MockPhysicsEngine: deserializeState() is a stub implementation');
    return {
      bodyHandleMap: new Map(),
      jointHandleMap: new Map(),
    };
  }
}
