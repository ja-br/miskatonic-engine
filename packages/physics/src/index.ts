/**
 * @miskatonic/physics
 *
 * Physics engine with hot-swappable backends
 */

// Core
export { PhysicsWorld } from './PhysicsWorld';

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
} from './types';

export {
  RigidBodyType,
  CollisionShapeType,
  DEFAULT_PHYSICS_CONFIG,
} from './types';

// Engines
export { MockPhysicsEngine } from './engines/MockPhysicsEngine';
export { RapierPhysicsEngine } from './engines/RapierPhysicsEngine';
