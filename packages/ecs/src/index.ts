/**
 * Miskatonic ECS - Entity Component System
 *
 * Archetype-based ECS implementation for the Miskatonic Engine.
 * Provides cache-efficient storage and fast iteration over entities.
 *
 * Epic 2.11: Refactored to use Structure of Arrays (SoA) with typed arrays
 * - 4.16x faster iteration (validated in Epic 2.10)
 * - Zero GC pressure
 * - Cache-friendly sequential access
 */

// Auto-register components
import './registerComponents';

export { World } from './World';
export { EntityManager } from './Entity';
export { ArchetypeManager } from './Archetype';
export { SystemManager } from './System';
export { Query, QueryBuilder } from './Query';
export { ComponentStorage } from './ComponentStorage';
export { ComponentRegistry, RegisterComponent } from './ComponentRegistry';

export type {
  EntityId,
  Component,
  ComponentType,
  System,
  QueryFilter,
  Archetype,
  EntityMetadata,
} from './types';

export type {
  FieldDescriptor,
  TypedArrayConstructor,
  TypedArray,
  ComponentSchema,
} from './ComponentStorage';

export { SystemPriority } from './types';
export { createFieldDescriptor, inferArrayType } from './ComponentStorage';

// Example components (auto-registered)
export { Transform } from './components/Transform';
export { Velocity } from './components/Velocity';
export { Camera } from './components/Camera';
export { Light } from './components/Light';

// Example systems
export { MovementSystem } from './systems/MovementSystem';
export { TransformSystem } from './systems/TransformSystem';

// Math utilities (Epic 3.11 + 3.11.5)
export * as Mat4 from './math/Mat4';
export { MatrixStorage } from './math/MatrixStorage';
