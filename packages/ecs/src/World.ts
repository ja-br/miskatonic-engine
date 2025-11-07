import { EntityManager } from './Entity';
import { ArchetypeManager } from './Archetype';
import { SystemManager } from './System';
import { Query, QueryBuilder } from './Query';
import type { ComponentType, EntityId, System } from './types';

/**
 * World - central container for the ECS
 *
 * The World owns all entities, components, and systems.
 * It provides the main API for game code.
 */
export class World {
  private entityManager: EntityManager;
  private archetypeManager: ArchetypeManager;
  private systemManager: SystemManager;
  private queries: Map<string, Query> = new Map();

  /**
   * Get the archetype manager (for query execution)
   */
  getArchetypeManager(): ArchetypeManager {
    return this.archetypeManager;
  }

  constructor() {
    this.entityManager = new EntityManager();
    this.archetypeManager = new ArchetypeManager();
    this.systemManager = new SystemManager();
  }

  /**
   * Create a new entity
   */
  createEntity(): EntityId {
    return this.entityManager.create();
  }

  /**
   * Destroy an entity and all its components
   */
  destroyEntity(entityId: EntityId): void {
    const metadata = this.entityManager.getMetadata(entityId);
    if (!metadata) {
      return;
    }

    // Validate generation to prevent use-after-free
    if (!this.entityManager.isValid(entityId, metadata.generation)) {
      console.warn(`Attempted to destroy entity ${entityId} with invalid generation`);
      return;
    }

    // Remove from archetype
    if (metadata.archetype) {
      const movedEntityId = this.archetypeManager.removeEntity(
        metadata.archetype,
        metadata.archetypeIndex
      );

      // Update moved entity's index
      if (movedEntityId !== undefined) {
        const movedMetadata = this.entityManager.getMetadata(movedEntityId);
        if (movedMetadata) {
          movedMetadata.archetypeIndex = metadata.archetypeIndex;
          this.entityManager.setMetadata(movedEntityId, movedMetadata);
        }
      }
    }

    // Destroy entity
    this.entityManager.destroy(entityId);

    // Invalidate query caches
    this.invalidateQueries();
  }

  /**
   * Check if entity exists
   */
  hasEntity(entityId: EntityId): boolean {
    return this.entityManager.exists(entityId);
  }

  /**
   * Add a component to an entity
   */
  addComponent<T>(entityId: EntityId, type: ComponentType<T>, component: T): void {
    const metadata = this.entityManager.getMetadata(entityId);
    if (!metadata) {
      throw new Error(`Entity ${entityId} does not exist`);
    }

    // Validate generation to prevent use-after-free
    if (!this.entityManager.isValid(entityId, metadata.generation)) {
      throw new Error(`Entity ${entityId} has invalid generation (use-after-free detected)`);
    }

    // Collect existing components - clone them to avoid shared state
    const components = new Map<ComponentType, any>();
    if (metadata.archetype) {
      for (const [componentType, componentArray] of metadata.archetype.components) {
        const existingComponent = componentArray[metadata.archetypeIndex];
        // Clone component if it has a clone method, otherwise use the reference
        const clonedComponent = existingComponent?.clone ? existingComponent.clone() : existingComponent;
        components.set(componentType, clonedComponent);
      }

      // Remove from old archetype
      const movedEntityId = this.archetypeManager.removeEntity(
        metadata.archetype,
        metadata.archetypeIndex
      );

      // Update moved entity's index
      if (movedEntityId !== undefined) {
        const movedMetadata = this.entityManager.getMetadata(movedEntityId);
        if (movedMetadata) {
          movedMetadata.archetypeIndex = metadata.archetypeIndex;
          this.entityManager.setMetadata(movedEntityId, movedMetadata);
        }
      }
    }

    // Add new component
    components.set(type, component);

    // Get or create new archetype
    const newArchetype = this.archetypeManager.getOrCreateArchetype(
      Array.from(components.keys())
    );

    // Add to new archetype
    const newIndex = this.archetypeManager.addEntity(newArchetype, entityId, components);

    // Update metadata
    metadata.archetype = newArchetype;
    metadata.archetypeIndex = newIndex;
    this.entityManager.setMetadata(entityId, metadata);

    // Invalidate query caches
    this.invalidateQueries();
  }

  /**
   * Remove a component from an entity
   */
  removeComponent<T>(entityId: EntityId, type: ComponentType<T>): void {
    const metadata = this.entityManager.getMetadata(entityId);
    if (!metadata || !metadata.archetype) {
      return;
    }

    // Validate generation to prevent use-after-free
    if (!this.entityManager.isValid(entityId, metadata.generation)) {
      console.warn(`Attempted to remove component from entity ${entityId} with invalid generation`);
      return;
    }

    // Collect remaining components - clone them to avoid shared state
    const components = new Map<ComponentType, any>();
    for (const [componentType, componentArray] of metadata.archetype.components) {
      if (componentType !== type) {
        const component = componentArray[metadata.archetypeIndex];
        // Clone component if it has a clone method, otherwise use the reference
        const clonedComponent = component?.clone ? component.clone() : component;
        components.set(componentType, clonedComponent);
      }
    }

    // Remove from old archetype
    const movedEntityId = this.archetypeManager.removeEntity(
      metadata.archetype,
      metadata.archetypeIndex
    );

    // Update moved entity's index
    if (movedEntityId !== undefined) {
      const movedMetadata = this.entityManager.getMetadata(movedEntityId);
      if (movedMetadata) {
        movedMetadata.archetypeIndex = metadata.archetypeIndex;
        this.entityManager.setMetadata(movedEntityId, movedMetadata);
      }
    }

    // If no components left, just update metadata
    if (components.size === 0) {
      metadata.archetype = null;
      metadata.archetypeIndex = -1;
      this.entityManager.setMetadata(entityId, metadata);
      this.invalidateQueries();
      return;
    }

    // Get or create new archetype
    const newArchetype = this.archetypeManager.getOrCreateArchetype(
      Array.from(components.keys())
    );

    // Add to new archetype
    const newIndex = this.archetypeManager.addEntity(newArchetype, entityId, components);

    // Update metadata
    metadata.archetype = newArchetype;
    metadata.archetypeIndex = newIndex;
    this.entityManager.setMetadata(entityId, metadata);

    // Invalidate query caches
    this.invalidateQueries();
  }

  /**
   * Get a component from an entity
   */
  getComponent<T>(entityId: EntityId, type: ComponentType<T>): T | undefined {
    const metadata = this.entityManager.getMetadata(entityId);
    if (!metadata || !metadata.archetype) {
      return undefined;
    }

    // Validate generation to prevent use-after-free
    if (!this.entityManager.isValid(entityId, metadata.generation)) {
      console.warn(`Attempted to get component from entity ${entityId} with invalid generation`);
      return undefined;
    }

    return this.archetypeManager.getComponent(metadata.archetype, type, metadata.archetypeIndex);
  }

  /**
   * Check if entity has a component
   */
  hasComponent<T>(entityId: EntityId, type: ComponentType<T>): boolean {
    return this.getComponent(entityId, type) !== undefined;
  }

  /**
   * Create a query builder
   */
  query(): QueryBuilder {
    return new QueryBuilder();
  }

  /**
   * Execute a query
   */
  executeQuery(query: Query): Array<{ entity: EntityId; components: Map<ComponentType, any> }> {
    return query.getEntities(this.archetypeManager);
  }

  /**
   * Register a system
   */
  registerSystem(system: System): void {
    this.systemManager.register(system);
  }

  /**
   * Unregister a system
   */
  unregisterSystem(systemName: string): void {
    this.systemManager.unregister(systemName);
  }

  /**
   * Initialize all systems
   */
  init(): void {
    this.systemManager.init(this);
  }

  /**
   * Update all systems
   */
  update(deltaTime: number): void {
    this.systemManager.update(this, deltaTime);
  }

  /**
   * Cleanup all systems
   */
  cleanup(): void {
    this.systemManager.cleanup(this);
  }

  /**
   * Invalidate all query caches
   */
  private invalidateQueries(): void {
    for (const query of this.queries.values()) {
      query.invalidateCache();
    }
  }

  /**
   * Clear the entire world
   */
  clear(): void {
    this.systemManager.cleanup(this);
    this.entityManager.clear();
    this.archetypeManager.clear();
    this.systemManager.clear();
    this.queries.clear();
  }

  /**
   * Get statistics for debugging
   */
  getStats() {
    return {
      entities: this.entityManager.getStats(),
      archetypes: this.archetypeManager.getStats(),
      systems: this.systemManager.getStats(),
    };
  }
}
