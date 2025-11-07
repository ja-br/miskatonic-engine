/**
 * @miskatonic/physics
 *
 * Physics engine with hot-swappable backends
 */

// Core
export { PhysicsWorld } from './PhysicsWorld';
export type { CollisionCallback } from './PhysicsWorld';
export { PhysicsSnapshotManager } from './PhysicsSnapshotManager';
export type { SnapshotManagerConfig } from './PhysicsSnapshotManager';
export { PhysicsDeterminismVerifier } from './PhysicsDeterminismVerifier';
export type {
  DeterminismVerificationResult,
  DeterminismMismatch,
  DeterminismVerifierConfig
} from './PhysicsDeterminismVerifier';
export { PhysicsReplayPlayer, ReplayPlayerState } from './PhysicsReplayPlayer';
export type { ReplayPlayerConfig } from './PhysicsReplayPlayer';

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
  SerializedPhysicsState,
  SerializedRigidBody,
  SerializedJoint,
  SerializedCollider,
  DeserializationResult,
  PhysicsSnapshot,
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
