/**
 * Miskatonic ECS - Entity Component System
 *
 * Archetype-based ECS implementation for the Miskatonic Engine.
 * Provides cache-efficient storage and fast iteration over entities.
 */

export { World } from './World';
export { EntityManager } from './Entity';
export { ArchetypeManager } from './Archetype';
export { SystemManager } from './System';
export { Query, QueryBuilder } from './Query';

export type {
  EntityId,
  Component,
  ComponentType,
  System,
  SystemPriority,
  QueryFilter,
  Archetype,
  EntityMetadata,
} from './types';

export { SystemPriority } from './types';

// Example components
export { Transform } from './components/Transform';
export { Velocity } from './components/Velocity';

// Example systems
export { MovementSystem } from './systems/MovementSystem';
