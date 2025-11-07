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
 * Joint constraint types
 */
export enum JointType {
  FIXED = 'fixed',           // Fixed/weld joint - bodies welded together
  REVOLUTE = 'revolute',     // Hinge joint - rotation around single axis
  PRISMATIC = 'prismatic',   // Slider joint - translation along single axis
  SPHERICAL = 'spherical',   // Ball-and-socket joint - free rotation
  GENERIC = 'generic',       // Generic 6-DOF joint with configurable limits
  SPRING = 'spring',         // Spring joint - soft distance constraint with stiffness and damping
}

/**
 * Joint handle (opaque ID)
 */
export type JointHandle = number;

/**
 * Joint anchor point (attachment point on a body)
 */
export interface JointAnchor {
  position: Vector3;  // Local position relative to body center
  rotation?: Quaternion; // Local rotation (optional, for oriented joints)
}

/**
 * Joint limits for revolute and prismatic joints
 */
export interface JointLimits {
  min: number;  // Minimum value (angle in radians for revolute, distance for prismatic)
  max: number;  // Maximum value
}

/**
 * Motor parameters for powered joints
 */
export interface JointMotor {
  targetVelocity: number;  // Desired velocity (rad/s for revolute, m/s for prismatic)
  maxForce: number;        // Maximum force/torque the motor can apply
}

/**
 * Base joint descriptor
 */
export interface BaseJointDescriptor {
  type: JointType;
  bodyA: RigidBodyHandle;
  bodyB: RigidBodyHandle;
  anchorA: JointAnchor;
  anchorB: JointAnchor;
  collideConnected?: boolean; // Allow connected bodies to collide (default: false)
  /** Maximum force (N) before joint breaks (0 or undefined = unbreakable) */
  breakForce?: number;
}

/**
 * Fixed joint descriptor
 * Welds two bodies together at their anchor points
 */
export interface FixedJointDescriptor extends BaseJointDescriptor {
  type: JointType.FIXED;
}

/**
 * Revolute joint descriptor
 * Constrains bodies to rotate around a single axis (hinge)
 */
export interface RevoluteJointDescriptor extends BaseJointDescriptor {
  type: JointType.REVOLUTE;
  axis: Vector3;           // Rotation axis in local space of bodyA
  limits?: JointLimits;    // Optional angular limits
  motor?: JointMotor;      // Optional motor
}

/**
 * Prismatic joint descriptor
 * Constrains bodies to slide along a single axis (slider)
 */
export interface PrismaticJointDescriptor extends BaseJointDescriptor {
  type: JointType.PRISMATIC;
  axis: Vector3;           // Slide axis in local space of bodyA
  limits?: JointLimits;    // Optional distance limits
  motor?: JointMotor;      // Optional motor
}

/**
 * Spherical joint descriptor
 * Allows free rotation around a point (ball-and-socket)
 */
export interface SphericalJointDescriptor extends BaseJointDescriptor {
  type: JointType.SPHERICAL;
}

/**
 * Generic joint descriptor
 * 6-DOF joint with configurable linear and angular constraints
 */
export interface GenericJointDescriptor extends BaseJointDescriptor {
  type: JointType.GENERIC;
  linearLimits?: {
    x?: JointLimits;
    y?: JointLimits;
    z?: JointLimits;
  };
  angularLimits?: {
    x?: JointLimits;
    y?: JointLimits;
    z?: JointLimits;
  };
}

/**
 * Spring joint descriptor
 * Soft distance constraint that behaves like a spring
 */
export interface SpringJointDescriptor extends BaseJointDescriptor {
  type: JointType.SPRING;
  /** Rest length of the spring (0 = distance between anchors at creation time) */
  restLength?: number;
  /** Spring stiffness coefficient (higher = stiffer spring) */
  stiffness: number;
  /** Damping coefficient (higher = more damping, reduces oscillation) */
  damping: number;
}

/**
 * Union type for all joint descriptors
 */
export type JointDescriptor =
  | FixedJointDescriptor
  | RevoluteJointDescriptor
  | PrismaticJointDescriptor
  | SphericalJointDescriptor
  | GenericJointDescriptor
  | SpringJointDescriptor;

/**
 * Joint debug information for visualization
 * Used to render constraint lines and axes in debug views
 */
export interface JointDebugInfo {
  /** Joint type */
  type: JointType;
  /** World-space position of anchor point on body A */
  anchorA: Vector3;
  /** World-space position of anchor point on body B */
  anchorB: Vector3;
  /** Joint axis in world space (for revolute/prismatic joints) */
  axis?: Vector3;
  /** Current joint value (angle or distance) */
  value: number;
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

  /**
   * Create a joint constraint between two rigid bodies
   * @returns Handle to the created joint
   */
  createJoint(descriptor: JointDescriptor): JointHandle;

  /**
   * Remove a joint constraint
   */
  removeJoint(handle: JointHandle): void;

  /**
   * Set motor parameters for a joint (revolute or prismatic)
   * @param handle Joint handle
   * @param motor Motor parameters (velocity and max force)
   */
  setJointMotor(handle: JointHandle, motor: JointMotor | null): void;

  /**
   * Get current angle/position of a joint
   * @param handle Joint handle
   * @returns Current value (angle in radians for revolute, position for prismatic)
   */
  getJointValue(handle: JointHandle): number;

  /**
   * Get debug information for visualizing a joint
   * @param handle Joint handle
   * @returns Debug info including anchor points and axis, or null if joint doesn't exist
   */
  getJointDebugInfo(handle: JointHandle): JointDebugInfo | null;

  /**
   * Check joints for breaking and return broken joint events
   * Joints break when forces exceed their breakForce threshold
   * @returns Array of joint break events
   */
  checkJointBreaking(): Array<{
    jointHandle: JointHandle;
    bodyA: RigidBodyHandle;
    bodyB: RigidBodyHandle;
    force: number;
  }>;

  /**
   * Serialize the current physics world state
   * Captures all rigid bodies, joints, and simulation state for deterministic replay
   * @returns Complete serialized physics state
   */
  serializeState(): SerializedPhysicsState;

  /**
   * Restore physics world state from serialized data
   * Used for replay, rollback, and network synchronization
   * WARNING: This completely replaces the current physics state
   * @param state Previously serialized physics state
   * @returns Handle mapping for updating external references
   */
  deserializeState(state: SerializedPhysicsState): DeserializationResult;
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

// ============================================================================
// Physics State Serialization (Deterministic Simulation)
// ============================================================================

/**
 * Serialized collider shape for deterministic simulation
 */
export interface SerializedCollider {
  /** Collision shape descriptor */
  shape: CollisionShape;
  /** Friction coefficient (0-1) */
  friction: number;
  /** Restitution/bounciness (0-1) */
  restitution: number;
  /** Density (kg/m³) - used to calculate mass */
  density: number;
  /** Whether this is a sensor (trigger) that doesn't cause physical collision response */
  isSensor: boolean;
  /** Collision groups bitmask - which groups this collider belongs to */
  collisionGroups: number;
  /** Collision mask bitmask - which groups this collider can collide with */
  collisionMask: number;
}

/**
 * Serialized rigid body state for deterministic simulation
 */
export interface SerializedRigidBody {
  /** Unique handle identifier */
  handle: RigidBodyHandle;
  /** Body type (dynamic/kinematic/static) */
  type: RigidBodyType;
  /** Position in world space */
  position: Vector3;
  /** Rotation as quaternion */
  rotation: Quaternion;
  /** Linear velocity */
  linearVelocity: Vector3;
  /** Angular velocity */
  angularVelocity: Vector3;
  /** Whether body is currently sleeping */
  isSleeping: boolean;
  /** Whether body is enabled */
  isEnabled: boolean;
  /** Mass of the body (kg) */
  mass: number;
  /** Linear damping coefficient */
  linearDamping: number;
  /** Angular damping coefficient */
  angularDamping: number;
  /** All colliders attached to this body */
  colliders: SerializedCollider[];
}

/**
 * Serialized joint state for deterministic simulation
 */
export interface SerializedJoint {
  /** Unique handle identifier */
  handle: JointHandle;
  /** Full joint descriptor for reconstruction */
  descriptor: JointDescriptor;
  /** Current joint value (angle or distance) - for verification */
  value: number;
}

/**
 * Complete serialized physics world state
 * Used for deterministic simulation, replay, and network synchronization
 */
export interface SerializedPhysicsState {
  /** Version number for compatibility checking */
  version: number;
  /** Simulation time in seconds */
  time: number;
  /** Step counter for determinism verification */
  step: number;
  /** Gravity vector */
  gravity: Vector3;
  /** All rigid bodies in the simulation */
  bodies: SerializedRigidBody[];
  /** All joints in the simulation */
  joints: SerializedJoint[];
}

/**
 * Result of deserialization containing handle mapping for external reference updates
 */
export interface DeserializationResult {
  /** Mapping from old handles to new handles for rigid bodies */
  bodyHandleMap: Map<RigidBodyHandle, RigidBodyHandle>;
  /** Mapping from old handles to new handles for joints */
  jointHandleMap: Map<JointHandle, JointHandle>;
}

/**
 * Physics snapshot for replay and rollback
 * Lightweight structure for storing physics state at specific frames
 */
export interface PhysicsSnapshot {
  /** Frame number */
  frame: number;
  /** Simulation time */
  time: number;
  /** Serialized state */
  state: SerializedPhysicsState;
}
