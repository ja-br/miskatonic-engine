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
  JointDescriptor,
  JointHandle,
  JointMotor,
} from '../types';
import { RigidBodyType, CollisionShapeType, JointType } from '../types';

/**
 * Validate that a vector contains finite numbers
 */
function validateVector3(vec: Vector3, name: string): void {
  if (!Number.isFinite(vec.x) || !Number.isFinite(vec.y) || !Number.isFinite(vec.z)) {
    throw new Error(`${name} must contain finite numbers (got: x=${vec.x}, y=${vec.y}, z=${vec.z})`);
  }
}

/**
 * Validate that a quaternion contains finite numbers
 * Note: Non-normalized quaternions are allowed - the physics engine will normalize them internally
 */
function validateQuaternion(quat: Quaternion, name: string): void {
  if (!Number.isFinite(quat.x) || !Number.isFinite(quat.y) ||
      !Number.isFinite(quat.z) || !Number.isFinite(quat.w)) {
    throw new Error(`${name} must contain finite numbers (got: x=${quat.x}, y=${quat.y}, z=${quat.z}, w=${quat.w})`);
  }
  // Check for zero quaternion which is invalid
  const magnitudeSq = quat.x * quat.x + quat.y * quat.y + quat.z * quat.z + quat.w * quat.w;
  if (magnitudeSq < 1e-12) {
    throw new Error(`${name} has zero magnitude (all components are zero)`);
  }
}

/**
 * Validate that a number is finite and positive
 */
function validatePositiveNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite positive number (got: ${value})`);
  }
}

/**
 * Validate that a number is finite and non-negative
 */
function validateNonNegativeNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite non-negative number (got: ${value})`);
  }
}

/**
 * Validate rigid body handle
 */
function validateHandle(handle: RigidBodyHandle, name: string): void {
  if (!Number.isInteger(handle) || handle <= 0) {
    throw new Error(`${name} must be a positive integer (got: ${handle})`);
  }
}

/**
 * Rapier physics engine implementation
 */
export class RapierPhysicsEngine implements IPhysicsEngine {
  private world: RAPIER.World | null = null;
  private eventQueue: RAPIER.EventQueue | null = null;
  private bodies = new Map<RigidBodyHandle, RAPIER.RigidBody>();
  private colliders = new Map<RigidBodyHandle, RAPIER.Collider[]>(); // Array for compound shapes
  private colliderHandleToBodyHandle = new Map<number, RigidBodyHandle>(); // Rapier collider handle -> our handle
  private collisionEvents: CollisionEvent[] = [];
  private nextHandle: RigidBodyHandle = 1;
  private static readonly MAX_HANDLE = 2147483647; // 2^31 - 1 (max safe positive integer for handle)

  // Joint constraint tracking
  private joints = new Map<JointHandle, RAPIER.ImpulseJoint>();
  private jointMetadata = new Map<JointHandle, {
    type: JointType;
    bodyA: RigidBodyHandle;
    bodyB: RigidBodyHandle;
    anchorA: JointAnchor;
    anchorB: JointAnchor;
    axis?: Vector3; // For revolute/prismatic joints
    breakForce?: number; // Maximum force before breaking
  }>();
  private nextJointHandle: JointHandle = 1;

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
    // Clear array without reallocating (performance optimization)
    this.collisionEvents.length = 0;

    this.eventQueue.drainCollisionEvents((handle1: number, handle2: number, started: boolean) => {
      if (!started) return; // Only process collision start events

      // Find the handles using optimized lookup
      const bodyA = this.colliderHandleToBodyHandle.get(handle1);
      const bodyB = this.colliderHandleToBodyHandle.get(handle2);

      if (bodyA === undefined || bodyB === undefined) return;

      // Create collision event with minimal allocations
      //
      // LIMITATION: Contact data (contactPoint, contactNormal, penetrationDepth, impulse)
      // is currently NOT implemented. All values are defaults (zeros).
      //
      // Rationale: Querying Rapier's contact manifold API requires iterating through
      // the contact graph which adds O(n) overhead per collision. For high-frequency
      // collision events (100s per frame), this becomes a performance bottleneck.
      //
      // If you need detailed contact information:
      // 1. Query Rapier directly via engine.getEngine().world.contactsWith()
      // 2. Or implement a filtered contact query for specific body pairs
      // 3. Consider adding a "detailed collision mode" flag if needed
      //
      // For most gameplay code, knowing "which bodies collided" is sufficient.
      // Detailed contact data is mainly needed for:
      // - Particle effects at exact contact points
      // - Custom physics constraints
      // - Audio occlusion/reflection
      //
      this.collisionEvents.push({
        bodyA,
        bodyB,
        contactPoint: { x: 0, y: 0, z: 0 },       // NOT IMPLEMENTED - always zero
        contactNormal: { x: 0, y: 1, z: 0 },      // NOT IMPLEMENTED - always up vector
        penetrationDepth: 0,                       // NOT IMPLEMENTED - always zero
        impulse: 0,                                // NOT IMPLEMENTED - always zero
      });
    });
  }

  createRigidBody(descriptor: RigidBodyDescriptor): RigidBodyHandle {
    if (!this.world) {
      throw new Error('Physics engine not initialized');
    }

    // Validate descriptor parameters
    if (descriptor.position) {
      validateVector3(descriptor.position, 'descriptor.position');
    }
    if (descriptor.rotation) {
      validateQuaternion(descriptor.rotation, 'descriptor.rotation');
    }
    if (descriptor.linearVelocity) {
      validateVector3(descriptor.linearVelocity, 'descriptor.linearVelocity');
    }
    if (descriptor.angularVelocity) {
      validateVector3(descriptor.angularVelocity, 'descriptor.angularVelocity');
    }
    if (descriptor.mass !== undefined) {
      validatePositiveNumber(descriptor.mass, 'descriptor.mass');
    }
    if (descriptor.linearDamping !== undefined) {
      validateNonNegativeNumber(descriptor.linearDamping, 'descriptor.linearDamping');
    }
    if (descriptor.angularDamping !== undefined) {
      validateNonNegativeNumber(descriptor.angularDamping, 'descriptor.angularDamping');
    }
    if (descriptor.friction !== undefined) {
      validateNonNegativeNumber(descriptor.friction, 'descriptor.friction');
    }
    if (descriptor.restitution !== undefined) {
      validateNonNegativeNumber(descriptor.restitution, 'descriptor.restitution');
    }

    // Check for handle overflow before allocation
    if (this.nextHandle >= RapierPhysicsEngine.MAX_HANDLE) {
      throw new Error('Physics engine handle limit reached. Cannot create more rigid bodies.');
    }

    const handle = this.nextHandle++;

    // Create rigid body
    const rigidBodyDesc = this.createRigidBodyDesc(descriptor);

    // Enable continuous collision detection if requested
    if (descriptor.enableCCD) {
      rigidBodyDesc.setCcdEnabled(true);
    }

    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    // Create collider(s) - compound shapes have multiple colliders
    const colliders: RAPIER.Collider[] = [];

    if (descriptor.collisionShape.type === CollisionShapeType.COMPOUND) {
      // Compound shape - create multiple colliders
      if (!descriptor.collisionShape.shapes || descriptor.collisionShape.shapes.length === 0) {
        throw new Error('COMPOUND shape requires at least one child shape');
      }

      for (const childShape of descriptor.collisionShape.shapes) {
        // Prevent recursive compound shapes - Rapier doesn't support this
        if (childShape.shape.type === CollisionShapeType.COMPOUND) {
          throw new Error('COMPOUND shapes cannot contain other COMPOUND shapes (recursive nesting not supported)');
        }

        // Validate child shape transforms
        validateVector3(childShape.position, 'compound child shape position');
        validateQuaternion(childShape.rotation, 'compound child shape rotation');

        const colliderDesc = this.createColliderDesc(childShape.shape);
        colliderDesc.setDensity(descriptor.mass || 1.0);
        colliderDesc.setFriction(descriptor.friction ?? 0.5);
        colliderDesc.setRestitution(descriptor.restitution ?? 0.3);
        colliderDesc.setTranslation(childShape.position.x, childShape.position.y, childShape.position.z);
        colliderDesc.setRotation(childShape.rotation);

        if (descriptor.isSensor) {
          colliderDesc.setSensor(true);
        }

        if (descriptor.collisionGroups !== undefined && descriptor.collisionMask !== undefined) {
          colliderDesc.setCollisionGroups(
            (descriptor.collisionGroups & 0xFFFF) | ((descriptor.collisionMask & 0xFFFF) << 16)
          );
        }

        const collider = this.world.createCollider(colliderDesc, rigidBody);
        colliders.push(collider);
        this.colliderHandleToBodyHandle.set(collider.handle, handle);
      }
    } else {
      // Single shape
      const colliderDesc = this.createColliderDesc(descriptor.collisionShape);
      colliderDesc.setDensity(descriptor.mass || 1.0);
      colliderDesc.setFriction(descriptor.friction ?? 0.5);
      colliderDesc.setRestitution(descriptor.restitution ?? 0.3);

      if (descriptor.isSensor) {
        colliderDesc.setSensor(true);
      }

      if (descriptor.collisionGroups !== undefined && descriptor.collisionMask !== undefined) {
        colliderDesc.setCollisionGroups(
          (descriptor.collisionGroups & 0xFFFF) | ((descriptor.collisionMask & 0xFFFF) << 16)
        );
      }

      const collider = this.world.createCollider(colliderDesc, rigidBody);
      colliders.push(collider);
      this.colliderHandleToBodyHandle.set(collider.handle, handle);
    }

    // Store references
    this.bodies.set(handle, rigidBody);
    this.colliders.set(handle, colliders);

    return handle;
  }

  removeRigidBody(handle: RigidBodyHandle): void {
    if (!this.world) return;

    try {
      // Store collider handles first to ensure complete cleanup even on failure
      const colliders = this.colliders.get(handle);
      const colliderHandles = colliders ? colliders.map(c => c.handle) : [];

      // Delete from maps first
      this.colliders.delete(handle);

      // Clean up collider mappings atomically
      for (const colliderHandle of colliderHandles) {
        this.colliderHandleToBodyHandle.delete(colliderHandle);
      }

      // Remove rigid body from physics world
      const body = this.bodies.get(handle);
      if (body) {
        this.world.removeRigidBody(body); // Rapier automatically removes colliders
        this.bodies.delete(handle);
      }
    } catch (error) {
      // Ensure cleanup completes even on partial failure
      this.bodies.delete(handle);
      this.colliders.delete(handle);
      throw error;
    }
  }

  getPosition(handle: RigidBodyHandle): Vector3 {
    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);

    const pos = body.translation();
    return { x: pos.x, y: pos.y, z: pos.z };
  }

  setPosition(handle: RigidBodyHandle, position: Vector3): void {
    validateHandle(handle, 'handle');
    validateVector3(position, 'position');

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
    validateHandle(handle, 'handle');
    validateQuaternion(rotation, 'rotation');

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
    validateHandle(handle, 'handle');
    validateVector3(velocity, 'velocity');

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
    validateHandle(handle, 'handle');
    validateVector3(velocity, 'velocity');

    const body = this.bodies.get(handle);
    if (!body) throw new Error(`Invalid body handle: ${handle}`);

    body.setAngvel(new RAPIER.Vector3(velocity.x, velocity.y, velocity.z), true);
  }

  applyForce(handle: RigidBodyHandle, force: Vector3): void {
    validateHandle(handle, 'handle');
    validateVector3(force, 'force');

    const body = this.bodies.get(handle);
    if (!body) {
      throw new Error(`Invalid body handle: ${handle}`);
    }

    body.addForce(new RAPIER.Vector3(force.x, force.y, force.z), true);
  }

  applyImpulse(handle: RigidBodyHandle, impulse: Vector3): void {
    validateHandle(handle, 'handle');
    validateVector3(impulse, 'impulse');

    const body = this.bodies.get(handle);
    if (!body) {
      throw new Error(`Invalid body handle: ${handle}`);
    }

    body.applyImpulse(new RAPIER.Vector3(impulse.x, impulse.y, impulse.z), true);
  }

  applyTorque(handle: RigidBodyHandle, torque: Vector3): void {
    validateHandle(handle, 'handle');
    validateVector3(torque, 'torque');

    const body = this.bodies.get(handle);
    if (!body) {
      throw new Error(`Invalid body handle: ${handle}`);
    }

    body.addTorque(new RAPIER.Vector3(torque.x, torque.y, torque.z), true);
  }

  raycast(origin: Vector3, direction: Vector3, maxDistance: number): RaycastHit | null {
    if (!this.world) return null;

    validateVector3(origin, 'origin');
    validateVector3(direction, 'direction');
    validatePositiveNumber(maxDistance, 'maxDistance');

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
    validateVector3(gravity, 'gravity');
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
    this.joints.clear();
    this.jointMetadata.clear();
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
        // Infinite plane - Rapier uses a cuboid with very large extents
        // Normal is always (0, 1, 0) pointing up
        return RAPIER.ColliderDesc.cuboid(1000, 0.01, 1000);

      case CollisionShapeType.MESH:
        if (!shape.vertices || !shape.indices) {
          throw new Error('MESH collision shape requires vertices and indices');
        }
        return RAPIER.ColliderDesc.trimesh(shape.vertices, shape.indices);

      case CollisionShapeType.CONVEX_HULL:
        if (!shape.vertices) {
          throw new Error('CONVEX_HULL collision shape requires vertices');
        }
        const convexHullDesc = RAPIER.ColliderDesc.convexHull(shape.vertices);
        if (!convexHullDesc) {
          throw new Error('Failed to create convex hull - vertices may be coplanar, degenerate, or insufficient (need at least 4 non-coplanar points)');
        }
        return convexHullDesc;

      case CollisionShapeType.HEIGHTFIELD:
        if (!shape.heights || !shape.rows || !shape.cols) {
          throw new Error('HEIGHTFIELD collision shape requires heights, rows, and cols');
        }
        const scale = shape.scale || { x: 1, y: 1, z: 1 };
        validateVector3(scale, 'heightfield scale');
        return RAPIER.ColliderDesc.heightfield(
          shape.rows,
          shape.cols,
          shape.heights,
          scale
        );

      case CollisionShapeType.COMPOUND:
        throw new Error('COMPOUND shapes must be handled at the rigid body level, not in createColliderDesc');

      default:
        throw new Error(`Unknown collision shape type: ${shape.type}`);
    }
  }

  // ===== Joint Constraint Methods =====

  /**
   * Normalize and validate an axis vector
   * @throws Error if axis is zero-length
   */
  private normalizeAxis(axis: Vector3): Vector3 {
    const length = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);

    if (length < 0.0001) {
      throw new Error(
        `Invalid axis vector: length is ${length}. ` +
        `Axis must be non-zero. Provided: (${axis.x}, ${axis.y}, ${axis.z})`
      );
    }

    // Normalize
    return {
      x: axis.x / length,
      y: axis.y / length,
      z: axis.z / length,
    };
  }

  createJoint(descriptor: JointDescriptor): JointHandle {
    if (!this.world) {
      throw new Error('Physics engine not initialized');
    }

    // Get rigid bodies
    const bodyA = this.bodies.get(descriptor.bodyA);
    const bodyB = this.bodies.get(descriptor.bodyB);

    if (!bodyA || !bodyB) {
      throw new Error(`Invalid body handles: ${descriptor.bodyA}, ${descriptor.bodyB}`);
    }

    // Create joint params based on type
    let jointParams: RAPIER.JointData;

    switch (descriptor.type) {
      case JointType.FIXED: {
        // Fixed joint - weld two bodies together
        const anchorA = new RAPIER.Vector3(
          descriptor.anchorA.position.x,
          descriptor.anchorA.position.y,
          descriptor.anchorA.position.z
        );
        const anchorB = new RAPIER.Vector3(
          descriptor.anchorB.position.x,
          descriptor.anchorB.position.y,
          descriptor.anchorB.position.z
        );

        const frameA = descriptor.anchorA.rotation
          ? descriptor.anchorA.rotation
          : { x: 0, y: 0, z: 0, w: 1 };
        const frameB = descriptor.anchorB.rotation
          ? descriptor.anchorB.rotation
          : { x: 0, y: 0, z: 0, w: 1 };

        jointParams = RAPIER.JointData.fixed(anchorA, frameA, anchorB, frameB);
        break;
      }

      case JointType.REVOLUTE: {
        // Revolute joint (hinge)
        const anchorA = new RAPIER.Vector3(
          descriptor.anchorA.position.x,
          descriptor.anchorA.position.y,
          descriptor.anchorA.position.z
        );
        const anchorB = new RAPIER.Vector3(
          descriptor.anchorB.position.x,
          descriptor.anchorB.position.y,
          descriptor.anchorB.position.z
        );

        // Normalize axis vector to ensure valid joint behavior
        const normalizedAxis = this.normalizeAxis(descriptor.axis);
        const axis = new RAPIER.Vector3(
          normalizedAxis.x,
          normalizedAxis.y,
          normalizedAxis.z
        );

        jointParams = RAPIER.JointData.revolute(anchorA, anchorB, axis);

        // Apply limits if specified
        if (descriptor.limits) {
          jointParams.limitsEnabled = true;
          jointParams.limits = [descriptor.limits.min, descriptor.limits.max];
        }

        break;
      }

      case JointType.PRISMATIC: {
        // Prismatic joint (slider)
        const anchorA = new RAPIER.Vector3(
          descriptor.anchorA.position.x,
          descriptor.anchorA.position.y,
          descriptor.anchorA.position.z
        );
        const anchorB = new RAPIER.Vector3(
          descriptor.anchorB.position.x,
          descriptor.anchorB.position.y,
          descriptor.anchorB.position.z
        );

        // Normalize axis vector to ensure valid joint behavior
        const normalizedAxis = this.normalizeAxis(descriptor.axis);
        const axis = new RAPIER.Vector3(
          normalizedAxis.x,
          normalizedAxis.y,
          normalizedAxis.z
        );

        jointParams = RAPIER.JointData.prismatic(anchorA, anchorB, axis);

        // Apply limits if specified
        if (descriptor.limits) {
          jointParams.limitsEnabled = true;
          jointParams.limits = [descriptor.limits.min, descriptor.limits.max];
        }

        break;
      }

      case JointType.SPHERICAL: {
        // Spherical joint (ball-and-socket)
        const anchorA = new RAPIER.Vector3(
          descriptor.anchorA.position.x,
          descriptor.anchorA.position.y,
          descriptor.anchorA.position.z
        );
        const anchorB = new RAPIER.Vector3(
          descriptor.anchorB.position.x,
          descriptor.anchorB.position.y,
          descriptor.anchorB.position.z
        );

        jointParams = RAPIER.JointData.spherical(anchorA, anchorB);
        break;
      }

      case JointType.GENERIC: {
        // Generic 6-DOF joint
        const anchorA = new RAPIER.Vector3(
          descriptor.anchorA.position.x,
          descriptor.anchorA.position.y,
          descriptor.anchorA.position.z
        );
        const anchorB = new RAPIER.Vector3(
          descriptor.anchorB.position.x,
          descriptor.anchorB.position.y,
          descriptor.anchorB.position.z
        );

        const frameA = descriptor.anchorA.rotation
          ? descriptor.anchorA.rotation
          : { x: 0, y: 0, z: 0, w: 1 };
        const frameB = descriptor.anchorB.rotation
          ? descriptor.anchorB.rotation
          : { x: 0, y: 0, z: 0, w: 1 };

        jointParams = RAPIER.JointData.generic(anchorA, frameA, anchorB, frameB);

        // Configure linear limits (per-axis)
        // Rapier's generic joint uses axis indices: 0=X, 1=Y, 2=Z for translation
        if (descriptor.linearLimits) {
          const { x, y, z } = descriptor.linearLimits;
          if (x) {
            jointParams.limitsEnabled = true;
            jointParams.setLinearLimits?.(0, [x.min, x.max]);
          }
          if (y) {
            jointParams.limitsEnabled = true;
            jointParams.setLinearLimits?.(1, [y.min, y.max]);
          }
          if (z) {
            jointParams.limitsEnabled = true;
            jointParams.setLinearLimits?.(2, [z.min, z.max]);
          }
        }

        // Configure angular limits (per-axis)
        // Rapier's generic joint uses axis indices: 0=X, 1=Y, 2=Z for rotation
        if (descriptor.angularLimits) {
          const { x, y, z } = descriptor.angularLimits;
          if (x) {
            jointParams.limitsEnabled = true;
            jointParams.setAngularLimits?.(0, [x.min, x.max]);
          }
          if (y) {
            jointParams.limitsEnabled = true;
            jointParams.setAngularLimits?.(1, [y.min, y.max]);
          }
          if (z) {
            jointParams.limitsEnabled = true;
            jointParams.setAngularLimits?.(2, [z.min, z.max]);
          }
        }

        break;
      }

      case JointType.SPRING: {
        // Spring joint (soft distance constraint)

        // Validate spring parameters
        if (descriptor.stiffness < 0) {
          throw new Error(`Spring stiffness must be non-negative, got ${descriptor.stiffness}`);
        }
        if (descriptor.damping < 0) {
          throw new Error(`Spring damping must be non-negative, got ${descriptor.damping}`);
        }
        if (descriptor.stiffness === 0 && descriptor.damping === 0) {
          throw new Error('Spring must have non-zero stiffness or damping');
        }

        const anchorA = new RAPIER.Vector3(
          descriptor.anchorA.position.x,
          descriptor.anchorA.position.y,
          descriptor.anchorA.position.z
        );
        const anchorB = new RAPIER.Vector3(
          descriptor.anchorB.position.x,
          descriptor.anchorB.position.y,
          descriptor.anchorB.position.z
        );

        // Calculate rest length if not specified
        let restLength = descriptor.restLength ?? 0;
        if (restLength === 0) {
          // Use current distance between anchors as rest length
          const posA = bodyA.translation();
          const posB = bodyB.translation();
          const rotA = bodyA.rotation();
          const rotB = bodyB.rotation();

          // Transform anchors to world space
          const anchorAWorld = this.transformPointToWorld(
            { x: posA.x, y: posA.y, z: posA.z },
            rotA,
            descriptor.anchorA.position
          );
          const anchorBWorld = this.transformPointToWorld(
            { x: posB.x, y: posB.y, z: posB.z },
            rotB,
            descriptor.anchorB.position
          );

          // Calculate distance
          const dx = anchorBWorld.x - anchorAWorld.x;
          const dy = anchorBWorld.y - anchorAWorld.y;
          const dz = anchorBWorld.z - anchorAWorld.z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // Ensure minimum safe rest length to avoid numerical instability
          restLength = Math.max(distance, 0.01);
        } else if (restLength < 0) {
          throw new Error(`Spring rest length must be non-negative, got ${restLength}`);
        }

        jointParams = RAPIER.JointData.spring(
          restLength,
          descriptor.stiffness,
          descriptor.damping,
          anchorA,
          anchorB
        );
        break;
      }

      default:
        throw new Error(`Unknown joint type: ${(descriptor as any).type}`);
    }

    // Set collision between connected bodies
    jointParams.contactsEnabled = descriptor.collideConnected ?? false;

    // Create the joint
    const joint = this.world.createImpulseJoint(jointParams, bodyA, bodyB, true);

    // Store joint with unique handle
    const handle = this.nextJointHandle++;
    this.joints.set(handle, joint);

    // Store joint metadata for value calculations and debug visualization
    this.jointMetadata.set(handle, {
      type: descriptor.type,
      bodyA: descriptor.bodyA,
      bodyB: descriptor.bodyB,
      anchorA: descriptor.anchorA,
      anchorB: descriptor.anchorB,
      axis: ('axis' in descriptor) ? descriptor.axis : undefined,
      breakForce: descriptor.breakForce
    });

    // Apply motor if specified (for revolute and prismatic joints)
    if ('motor' in descriptor && descriptor.motor) {
      this.setJointMotor(handle, descriptor.motor);
    }

    return handle;
  }

  removeJoint(handle: JointHandle): void {
    if (!this.world) {
      throw new Error('Physics engine not initialized');
    }

    const joint = this.joints.get(handle);
    if (!joint) {
      throw new Error(`Invalid joint handle: ${handle}`);
    }

    // Remove joint from Rapier world
    this.world.removeImpulseJoint(joint, true);

    // Remove from our tracking
    this.joints.delete(handle);
    this.jointMetadata.delete(handle);
  }

  setJointMotor(handle: JointHandle, motor: JointMotor | null): void {
    const joint = this.joints.get(handle);
    if (!joint) {
      throw new Error(`Invalid joint handle: ${handle}`);
    }

    if (motor === null) {
      // Disable motor
      joint.configureMotorVelocity(0, 0);
    } else {
      // Enable motor with target velocity and max force
      joint.configureMotorVelocity(motor.targetVelocity, motor.maxForce);
    }
  }

  /**
   * Get current joint value (angle for revolute, position for prismatic)
   *
   * Calculates joint state from relative body transforms:
   * - REVOLUTE: Returns angle in radians around joint axis
   * - PRISMATIC: Returns distance along joint axis
   * - Other joint types: Returns 0
   *
   * The calculation uses the relative transforms of connected bodies since Rapier
   * doesn't directly expose joint values in its API.
   *
   * @param handle Handle to the joint
   * @returns Current joint value (angle in radians or distance in units)
   */
  getJointValue(handle: JointHandle): number {
    const joint = this.joints.get(handle);
    if (!joint) {
      throw new Error(`Invalid joint handle: ${handle}`);
    }

    const metadata = this.jointMetadata.get(handle);
    if (!metadata) {
      return 0;
    }

    // Only calculate for revolute and prismatic joints
    if (metadata.type !== JointType.REVOLUTE && metadata.type !== JointType.PRISMATIC) {
      return 0;
    }

    if (!metadata.axis) {
      return 0; // No axis defined
    }

    // Get body transforms
    const bodyA = this.bodies.get(metadata.bodyA);
    const bodyB = this.bodies.get(metadata.bodyB);

    if (!bodyA || !bodyB) {
      return 0;
    }

    const posA = bodyA.translation();
    const rotA = bodyA.rotation();
    const posB = bodyB.translation();
    const rotB = bodyB.rotation();

    if (metadata.type === JointType.PRISMATIC) {
      // Calculate distance along axis using actual anchor points (not body centers)
      // Transform anchors to world space
      const anchorAWorld = this.transformPointToWorld(
        { x: posA.x, y: posA.y, z: posA.z },
        rotA,
        metadata.anchorA.position
      );
      const anchorBWorld = this.transformPointToWorld(
        { x: posB.x, y: posB.y, z: posB.z },
        rotB,
        metadata.anchorB.position
      );

      // Calculate relative position between anchors
      const relativePos = {
        x: anchorBWorld.x - anchorAWorld.x,
        y: anchorBWorld.y - anchorAWorld.y,
        z: anchorBWorld.z - anchorAWorld.z
      };

      // Project relative position onto joint axis
      const distance =
        relativePos.x * metadata.axis.x +
        relativePos.y * metadata.axis.y +
        relativePos.z * metadata.axis.z;

      return distance;
    } else if (metadata.type === JointType.REVOLUTE) {
      // Calculate relative rotation around axis
      // Compute inverse of rotation A
      const invRotA = {
        x: -rotA.x,
        y: -rotA.y,
        z: -rotA.z,
        w: rotA.w
      };

      // Relative rotation = invRotA * rotB
      const relRot = this.multiplyQuaternions(invRotA, rotB);

      // Convert quaternion to axis-angle representation
      // Clamp to avoid numerical issues with acos
      const w = Math.min(1, Math.max(-1, relRot.w));
      const angle = 2 * Math.acos(w);

      // Handle near-zero rotation
      const sinHalfAngle = Math.sqrt(1 - w * w);
      if (sinHalfAngle < 0.001) {
        return 0; // Near-identity rotation
      }

      // Extract rotation axis from quaternion
      const qAxis = {
        x: relRot.x / sinHalfAngle,
        y: relRot.y / sinHalfAngle,
        z: relRot.z / sinHalfAngle
      };

      // Project rotation axis onto joint constraint axis to get signed angle
      const axisDot =
        qAxis.x * metadata.axis.x +
        qAxis.y * metadata.axis.y +
        qAxis.z * metadata.axis.z;

      // Return signed angle (positive/negative based on rotation direction)
      return angle * Math.sign(axisDot);
    }

    return 0;
  }

  /**
   * Get debug information for visualizing a joint
   *
   * Returns world-space positions of anchor points and joint axis for rendering
   * debug visualization lines showing constraint connections and axes.
   *
   * @param handle Handle to the joint
   * @returns Debug info with world-space anchors and axis, or null if joint doesn't exist
   */
  getJointDebugInfo(handle: JointHandle): JointDebugInfo | null {
    const joint = this.joints.get(handle);
    if (!joint) {
      return null;
    }

    const metadata = this.jointMetadata.get(handle);
    if (!metadata) {
      return null;
    }

    // Get body transforms
    const bodyA = this.bodies.get(metadata.bodyA);
    const bodyB = this.bodies.get(metadata.bodyB);

    if (!bodyA || !bodyB) {
      return null;
    }

    const posA = bodyA.translation();
    const rotA = bodyA.rotation();
    const posB = bodyB.translation();
    const rotB = bodyB.rotation();

    // Transform local anchor positions to world space
    const anchorAWorld = this.transformPointToWorld(
      { x: posA.x, y: posA.y, z: posA.z },
      rotA,
      metadata.anchorA.position
    );

    const anchorBWorld = this.transformPointToWorld(
      { x: posB.x, y: posB.y, z: posB.z },
      rotB,
      metadata.anchorB.position
    );

    // Transform axis to world space if it exists
    let axisWorld: Vector3 | undefined;
    if (metadata.axis) {
      axisWorld = this.transformVectorToWorld(rotA, metadata.axis);
    }

    // Get current joint value
    const value = this.getJointValue(handle);

    return {
      type: metadata.type,
      anchorA: anchorAWorld,
      anchorB: anchorBWorld,
      axis: axisWorld,
      value
    };
  }

  /**
   * Transform a point from local space to world space
   */
  private transformPointToWorld(position: Vector3, rotation: Quaternion, localPoint: Vector3): Vector3 {
    // Rotate local point by quaternion
    const rotated = this.rotateVectorByQuaternion(localPoint, rotation);

    // Add to position
    return {
      x: position.x + rotated.x,
      y: position.y + rotated.y,
      z: position.z + rotated.z
    };
  }

  /**
   * Transform a direction vector from local space to world space (no translation)
   */
  private transformVectorToWorld(rotation: Quaternion, localVector: Vector3): Vector3 {
    return this.rotateVectorByQuaternion(localVector, rotation);
  }

  /**
   * Rotate a vector by a quaternion
   */
  private rotateVectorByQuaternion(v: Vector3, q: Quaternion): Vector3 {
    // v' = q * v * q^-1
    // For unit quaternions, q^-1 = q*
    // Using: v' = v + 2 * cross(q.xyz, cross(q.xyz, v) + q.w * v)

    const qx = q.x;
    const qy = q.y;
    const qz = q.z;
    const qw = q.w;

    // First cross: q.xyz × v
    const cx1 = qy * v.z - qz * v.y;
    const cy1 = qz * v.x - qx * v.z;
    const cz1 = qx * v.y - qy * v.x;

    // Add q.w * v
    const tx = cx1 + qw * v.x;
    const ty = cy1 + qw * v.y;
    const tz = cz1 + qw * v.z;

    // Second cross: q.xyz × t
    const cx2 = qy * tz - qz * ty;
    const cy2 = qz * tx - qx * tz;
    const cz2 = qx * ty - qy * tx;

    // Add to original vector with scale 2
    return {
      x: v.x + 2 * cx2,
      y: v.y + 2 * cy2,
      z: v.z + 2 * cz2
    };
  }

  /**
   * Multiply two quaternions: result = q1 * q2
   */
  private multiplyQuaternions(q1: Quaternion, q2: Quaternion): Quaternion {
    return {
      w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z,
      x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
      y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
      z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w
    };
  }

  /**
   * Check joints for breaking based on force thresholds
   *
   * Returns events for joints that exceeded their breakForce limit.
   * Broken joints are automatically removed from the simulation.
   */
  checkJointBreaking(): Array<{
    jointHandle: JointHandle;
    bodyA: RigidBodyHandle;
    bodyB: RigidBodyHandle;
    force: number;
  }> {
    const brokenJoints: Array<{
      jointHandle: JointHandle;
      bodyA: RigidBodyHandle;
      bodyB: RigidBodyHandle;
      force: number;
    }> = [];

    // Check each joint with a breakForce threshold
    for (const [handle, metadata] of this.jointMetadata.entries()) {
      if (!metadata.breakForce || metadata.breakForce <= 0) {
        continue; // Unbreakable joint
      }

      const joint = this.joints.get(handle);
      if (!joint) {
        continue;
      }

      // Get bodies
      const bodyA = this.bodies.get(metadata.bodyA);
      const bodyB = this.bodies.get(metadata.bodyB);
      if (!bodyA || !bodyB) {
        continue;
      }

      // Calculate force magnitude between bodies
      // This is an approximation based on relative velocity and distance
      const posA = bodyA.translation();
      const posB = bodyB.translation();
      const velA = bodyA.linvel();
      const velB = bodyB.linvel();

      // Relative velocity
      const relVel = {
        x: velB.x - velA.x,
        y: velB.y - velA.y,
        z: velB.z - velA.z
      };

      // Relative position (for direction)
      const relPos = {
        x: posB.x - posA.x,
        y: posB.y - posA.y,
        z: posB.z - posA.z
      };

      const relPosLen = Math.sqrt(relPos.x * relPos.x + relPos.y * relPos.y + relPos.z * relPos.z);
      if (relPosLen < 0.0001) {
        continue; // Bodies are too close
      }

      // Normalize direction
      const dir = {
        x: relPos.x / relPosLen,
        y: relPos.y / relPosLen,
        z: relPos.z / relPosLen
      };

      // Project relative velocity onto direction
      const relSpeed = Math.abs(
        relVel.x * dir.x + relVel.y * dir.y + relVel.z * dir.z
      );

      // Estimate force as mass * acceleration
      // Acceleration = velocity change / timestep
      // Use config timestep for accuracy
      const timestep = 1 / 60; // TODO: Use actual physics timestep from config
      const relAcceleration = relSpeed / timestep;

      const massA = bodyA.mass();
      const massB = bodyB.mass();
      const avgMass = (massA + massB) / 2;

      // Force = mass * acceleration (F = ma)
      const approximateForce = avgMass * relAcceleration;

      // Check if force exceeds threshold
      if (approximateForce > metadata.breakForce) {
        brokenJoints.push({
          jointHandle: handle,
          bodyA: metadata.bodyA,
          bodyB: metadata.bodyB,
          force: approximateForce
        });

        // Remove the broken joint
        this.removeJoint(handle);
      }
    }

    return brokenJoints;
  }
}
