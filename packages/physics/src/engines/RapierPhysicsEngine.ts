/**
 * Rapier Physics Engine Implementation
 *
 * High-performance 3D physics using Rapier.js
 */

import RAPIER from '@dimforge/rapier3d-compat';
import type {
  IPhysicsEngine,
  PhysicsWorldConfig,
  RigidBodyDescriptor,
  RigidBodyHandle,
  Vector3,
  Quaternion,
  CollisionEvent,
  RaycastHit,
  CollisionShape,
} from '../types';
import { RigidBodyType, CollisionShapeType } from '../types';

/**
 * Rapier physics engine implementation
 */
export class RapierPhysicsEngine implements IPhysicsEngine {
  private world: RAPIER.World | null = null;
  private eventQueue: RAPIER.EventQueue | null = null;
  private bodies = new Map<RigidBodyHandle, RAPIER.RigidBody>();
  private colliders = new Map<RigidBodyHandle, RAPIER.Collider>();
  private colliderHandleToBodyHandle = new Map<number, RigidBodyHandle>(); // Rapier collider handle -> our handle
  private collisionEvents: CollisionEvent[] = [];
  private nextHandle: RigidBodyHandle = 1;

  async initialize(config: PhysicsWorldConfig): Promise<void> {
    // Initialize Rapier WASM module
    await RAPIER.init();

    // Create world with gravity
    const gravity = config.gravity || { x: 0, y: -9.81, z: 0 };
    this.world = new RAPIER.World(new RAPIER.Vector3(gravity.x, gravity.y, gravity.z));

    // Create event queue for collision events
    this.eventQueue = new RAPIER.EventQueue(true);
  }

  step(_deltaTime: number): void {
    if (!this.world || !this.eventQueue) {
      throw new Error('Physics engine not initialized');
    }

    // Step the simulation
    this.world.step(this.eventQueue);

    // Process collision events
    this.collisionEvents = [];
    this.eventQueue.drainCollisionEvents((handle1: number, handle2: number, started: boolean) => {
      if (!started) return; // Only process collision start events

      // Find the handles using optimized lookup
      const bodyA = this.colliderHandleToBodyHandle.get(handle1);
      const bodyB = this.colliderHandleToBodyHandle.get(handle2);

      if (bodyA === undefined || bodyB === undefined) return;

      // Create collision event (simplified - would need contact point data from Rapier)
      this.collisionEvents.push({
        bodyA,
        bodyB,
        contactPoint: { x: 0, y: 0, z: 0 }, // Would get from manifold
        contactNormal: { x: 0, y: 1, z: 0 }, // Would get from manifold
        penetrationDepth: 0,
        impulse: 0,
      });
    });
  }

  createRigidBody(descriptor: RigidBodyDescriptor): RigidBodyHandle {
    if (!this.world) {
      throw new Error('Physics engine not initialized');
    }

    const handle = this.nextHandle++;

    // Create rigid body
    const rigidBodyDesc = this.createRigidBodyDesc(descriptor);
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    // Create collider
    const colliderDesc = this.createColliderDesc(descriptor.collisionShape);
    colliderDesc.setDensity(descriptor.mass || 1.0);
    colliderDesc.setFriction(descriptor.friction ?? 0.5);
    colliderDesc.setRestitution(descriptor.restitution ?? 0.3);

    if (descriptor.isSensor) {
      colliderDesc.setSensor(true);
    }

    // Set collision filtering
    if (descriptor.collisionGroups !== undefined && descriptor.collisionMask !== undefined) {
      colliderDesc.setCollisionGroups(
        (descriptor.collisionGroups & 0xFFFF) | ((descriptor.collisionMask & 0xFFFF) << 16)
      );
    }

    const collider = this.world.createCollider(colliderDesc, rigidBody);

    // Store references
    this.bodies.set(handle, rigidBody);
    this.colliders.set(handle, collider);
    this.colliderHandleToBodyHandle.set(collider.handle, handle);

    return handle;
  }

  removeRigidBody(handle: RigidBodyHandle): void {
    if (!this.world) return;

    const collider = this.colliders.get(handle);
    if (collider) {
      this.colliderHandleToBodyHandle.delete(collider.handle);
      this.colliders.delete(handle);
    }

    const body = this.bodies.get(handle);
    if (body) {
      // Rapier automatically removes colliders when removing a rigid body
      this.world.removeRigidBody(body);
      this.bodies.delete(handle);
    }
  }

  getPosition(handle: RigidBodyHandle): Vector3 {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);

    const pos = body.translation();
    return { x: pos.x, y: pos.y, z: pos.z };
  }

  setPosition(handle: RigidBodyHandle, position: Vector3): void {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);

    body.setTranslation(new RAPIER.Vector3(position.x, position.y, position.z), true);
  }

  getRotation(handle: RigidBodyHandle): Quaternion {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);

    const rot = body.rotation();
    return { x: rot.x, y: rot.y, z: rot.z, w: rot.w };
  }

  setRotation(handle: RigidBodyHandle, rotation: Quaternion): void {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);

    body.setRotation(new RAPIER.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w), true);
  }

  getLinearVelocity(handle: RigidBodyHandle): Vector3 {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);

    const vel = body.linvel();
    return { x: vel.x, y: vel.y, z: vel.z };
  }

  setLinearVelocity(handle: RigidBodyHandle, velocity: Vector3): void {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);

    body.setLinvel(new RAPIER.Vector3(velocity.x, velocity.y, velocity.z), true);
  }

  getAngularVelocity(handle: RigidBodyHandle): Vector3 {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);

    const vel = body.angvel();
    return { x: vel.x, y: vel.y, z: vel.z };
  }

  setAngularVelocity(handle: RigidBodyHandle, velocity: Vector3): void {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);

    body.setAngvel(new RAPIER.Vector3(velocity.x, velocity.y, velocity.z), true);
  }

  applyForce(handle: RigidBodyHandle, force: Vector3): void {
    const body = this.bodies.get(handle);
    if (!body) return;

    body.addForce(new RAPIER.Vector3(force.x, force.y, force.z), true);
  }

  applyImpulse(handle: RigidBodyHandle, impulse: Vector3): void {
    const body = this.bodies.get(handle);
    if (!body) return;

    body.applyImpulse(new RAPIER.Vector3(impulse.x, impulse.y, impulse.z), true);
  }

  applyTorque(handle: RigidBodyHandle, torque: Vector3): void {
    const body = this.bodies.get(handle);
    if (!body) return;

    body.addTorque(new RAPIER.Vector3(torque.x, torque.y, torque.z), true);
  }

  raycast(origin: Vector3, direction: Vector3, maxDistance: number): RaycastHit | null {
    if (!this.world) return null;

    const ray = new RAPIER.Ray(
      new RAPIER.Vector3(origin.x, origin.y, origin.z),
      new RAPIER.Vector3(direction.x, direction.y, direction.z)
    );

    const hit = this.world.castRayAndGetNormal(ray, maxDistance, true);
    if (!hit) return null;

    // Find the body handle for this collider using optimized lookup
    const bodyHandle = this.colliderHandleToBodyHandle.get(hit.collider.handle);
    if (bodyHandle === undefined) return null;

    const hitPoint = ray.pointAt(hit.toi);
    const normal = hit.normal;
    return {
      body: bodyHandle,
      point: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
      normal: { x: normal.x, y: normal.y, z: normal.z },
      distance: hit.toi,
    };
  }

  getCollisionEvents(): CollisionEvent[] {
    return this.collisionEvents;
  }

  setGravity(gravity: Vector3): void {
    if (!this.world) return;
    this.world.gravity = new RAPIER.Vector3(gravity.x, gravity.y, gravity.z);
  }

  setEnabled(handle: RigidBodyHandle, enabled: boolean): void {
    const body = this.bodies.get(handle);
    if (!body) return;

    body.setEnabled(enabled);
  }

  isSleeping(handle: RigidBodyHandle): boolean {
    const body = this.bodies.get(handle);
    if (!body) return false;

    return body.isSleeping();
  }

  wakeUp(handle: RigidBodyHandle): void {
    const body = this.bodies.get(handle);
    if (!body) return;

    body.wakeUp();
  }

  dispose(): void {
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    if (this.eventQueue) {
      this.eventQueue.free();
      this.eventQueue = null;
    }
    this.bodies.clear();
    this.colliders.clear();
    this.colliderHandleToBodyHandle.clear();
    this.collisionEvents = [];
  }

  /**
   * Create Rapier rigid body descriptor from our descriptor
   */
  private createRigidBodyDesc(descriptor: RigidBodyDescriptor): RAPIER.RigidBodyDesc {
    let desc: RAPIER.RigidBodyDesc;

    switch (descriptor.type) {
      case RigidBodyType.DYNAMIC:
        desc = RAPIER.RigidBodyDesc.dynamic();
        break;
      case RigidBodyType.KINEMATIC:
        desc = RAPIER.RigidBodyDesc.kinematicPositionBased();
        break;
      case RigidBodyType.STATIC:
        desc = RAPIER.RigidBodyDesc.fixed();
        break;
      default:
        desc = RAPIER.RigidBodyDesc.dynamic();
    }

    if (descriptor.position) {
      desc.setTranslation(descriptor.position.x, descriptor.position.y, descriptor.position.z);
    }

    if (descriptor.rotation) {
      desc.setRotation(descriptor.rotation);
    }

    if (descriptor.linearVelocity) {
      desc.setLinvel(descriptor.linearVelocity.x, descriptor.linearVelocity.y, descriptor.linearVelocity.z);
    }

    if (descriptor.angularVelocity) {
      desc.setAngvel(descriptor.angularVelocity);
    }

    if (descriptor.linearDamping !== undefined) {
      desc.setLinearDamping(descriptor.linearDamping);
    }

    if (descriptor.angularDamping !== undefined) {
      desc.setAngularDamping(descriptor.angularDamping);
    }

    return desc;
  }

  /**
   * Create Rapier collider descriptor from collision shape
   */
  private createColliderDesc(shape: CollisionShape): RAPIER.ColliderDesc {
    switch (shape.type) {
      case CollisionShapeType.BOX:
        if (!shape.halfExtents) throw new Error('Box shape requires halfExtents');
        return RAPIER.ColliderDesc.cuboid(
          shape.halfExtents.x,
          shape.halfExtents.y,
          shape.halfExtents.z
        );

      case CollisionShapeType.SPHERE:
        if (!shape.radius) throw new Error('Sphere shape requires radius');
        return RAPIER.ColliderDesc.ball(shape.radius);

      case CollisionShapeType.CAPSULE:
        if (!shape.height || !shape.radius) {
          throw new Error('Capsule shape requires height and radius');
        }
        return RAPIER.ColliderDesc.capsule(shape.height / 2, shape.radius);

      case CollisionShapeType.CYLINDER:
        if (!shape.height || !shape.radius) {
          throw new Error('Cylinder shape requires height and radius');
        }
        return RAPIER.ColliderDesc.cylinder(shape.height / 2, shape.radius);

      case CollisionShapeType.CONE:
        if (!shape.height || !shape.radius) {
          throw new Error('Cone shape requires height and radius');
        }
        return RAPIER.ColliderDesc.cone(shape.height / 2, shape.radius);

      case CollisionShapeType.PLANE:
        throw new Error('PLANE collision shape is not yet implemented in RapierPhysicsEngine');

      case CollisionShapeType.MESH:
        throw new Error('MESH collision shape is not yet implemented in RapierPhysicsEngine');

      case CollisionShapeType.CONVEX_HULL:
        throw new Error('CONVEX_HULL collision shape is not yet implemented in RapierPhysicsEngine');

      case CollisionShapeType.HEIGHTFIELD:
        throw new Error('HEIGHTFIELD collision shape is not yet implemented in RapierPhysicsEngine');

      default:
        throw new Error(`Unknown collision shape type: ${shape.type}`);
    }
  }
}
