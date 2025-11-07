/**
 * @miskatonic/physics
 *
 * Physics engine with hot-swappable backends
 */

// Core
export { PhysicsWorld } from './PhysicsWorld';
export type { CollisionCallback } from './PhysicsWorld';

// Types
export type {
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
  JointAnchor,
  JointLimits,
  JointMotor,
  FixedJointDescriptor,
  RevoluteJointDescriptor,
  PrismaticJointDescriptor,
  SphericalJointDescriptor,
  GenericJointDescriptor,
} from './types';

export {
  RigidBodyType,
  CollisionShapeType,
  JointType,
  DEFAULT_PHYSICS_CONFIG,
} from './types';

// Engines
export { MockPhysicsEngine } from './engines/MockPhysicsEngine';
export { RapierPhysicsEngine } from './engines/RapierPhysicsEngine';
