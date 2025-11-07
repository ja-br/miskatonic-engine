/**
 * Core ECS type definitions
 */

/**
 * Entity ID type - unique identifier for entities
 * Uses number for performance, with generation counter for recycling
 */
export type EntityId = number;

/**
 * Component type identifier
 */
export type ComponentType<T extends Component = Component> = new (...args: unknown[]) => T;

/**
 * Component instance
 */
export interface Component {
  /** Component type name for debugging */
  readonly __componentType?: string;
}

/**
 * System priority for execution ordering
 */
export enum SystemPriority {
  FIRST = -1000,
  PRE_UPDATE = -100,
  UPDATE = 0,
  POST_UPDATE = 100,
  RENDER = 200,
  LAST = 1000,
}

/**
 * System lifecycle hooks
 */
export interface System {
  /** System name for debugging */
  readonly name: string;

  /** Execution priority */
  readonly priority: SystemPriority;

  /** Initialize system (called once) */
  init?(world: any): void;

  /** Update system (called every frame) */
  update(world: any, deltaTime: number): void;

  /** Cleanup system (called on removal) */
  cleanup?(world: any): void;
}

/**
 * Query filter for entity selection
 */
export interface QueryFilter {
  /** Components that must be present */
  with?: ComponentType[];

  /** Components that must not be present */
  without?: ComponentType[];

  /** Optional components (included if present) */
  optional?: ComponentType[];
}

/**
 * Archetype - unique combination of component types
 * Entities with the same components share an archetype
 */
export interface Archetype {
  /** Unique archetype ID */
  id: number;

  /** Component types in this archetype (sorted) */
  types: ComponentType[];

  /** Type signature for fast comparison */
  signature: string;

  /** Entities in this archetype */
  entities: EntityId[];

  /** Component storage arrays (one per component type) */
  components: Map<ComponentType, any[]>;
}

/**
 * Entity metadata
 */
export interface EntityMetadata {
  /** Entity ID */
  id: EntityId;

  /** Generation counter for ID recycling */
  generation: number;

  /** Current archetype */
  archetype: Archetype | null;

  /** Index within archetype arrays */
  archetypeIndex: number;
}
