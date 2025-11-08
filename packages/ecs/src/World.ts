import { EntityManager } from './Entity';
import { ArchetypeManager } from './Archetype';
import { SystemManager } from './System';
import { Query, QueryBuilder } from './Query';
import type { ComponentType, EntityId, System } from './types';
import type { TransformSystem } from './systems/TransformSystem';
import { Transform } from './components/Transform';

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

    // Cleanup TransformSystem matrix indices if entity has Transform (Epic 3.11.5)
    const transformSystem = this.getTransformSystem();
    if (transformSystem && this.hasComponent(entityId, Transform)) {
      transformSystem.onEntityDestroyed(entityId);
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
      for (const [componentType, storage] of metadata.archetype.components) {
        const existingComponent = storage.getComponent(metadata.archetypeIndex);
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
    for (const [componentType, storage] of metadata.archetype.components) {
      if (componentType !== type) {
        const component = storage.getComponent(metadata.archetypeIndex);
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
   * Get a system by name
   */
  getSystem<T extends System>(systemName: string): T | undefined {
    return this.systemManager.get(systemName) as T | undefined;
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

  // =============================================================================
  // TRANSFORM SYSTEM CONVENIENCE API (Epic 3.11.5)
  // =============================================================================

  /**
   * Get TransformSystem instance
   * Returns undefined if TransformSystem is not registered
   */
  private getTransformSystem(): TransformSystem | undefined {
    return this.getSystem<TransformSystem>('TransformSystem');
  }

  /**
   * Set entity position
   *
   * Convenience method for transformSystem.setPosition()
   *
   * @param entityId - Entity to modify
   * @param x - X position
   * @param y - Y position
   * @param z - Z position
   */
  setPosition(entityId: EntityId, x: number, y: number, z: number): void {
    const transformSystem = this.getTransformSystem();
    if (!transformSystem) {
      console.warn('TransformSystem not registered. Call world.registerSystem(transformSystem) first.');
      return;
    }
    transformSystem.setPosition(entityId, x, y, z);
  }

  /**
   * Set entity rotation (Euler angles in radians)
   *
   * Convenience method for transformSystem.setRotation()
   *
   * @param entityId - Entity to modify
   * @param x - Rotation around X axis (pitch)
   * @param y - Rotation around Y axis (yaw)
   * @param z - Rotation around Z axis (roll)
   */
  setRotation(entityId: EntityId, x: number, y: number, z: number): void {
    const transformSystem = this.getTransformSystem();
    if (!transformSystem) {
      console.warn('TransformSystem not registered. Call world.registerSystem(transformSystem) first.');
      return;
    }
    transformSystem.setRotation(entityId, x, y, z);
  }

  /**
   * Set entity scale
   *
   * Convenience method for transformSystem.setScale()
   *
   * @param entityId - Entity to modify
   * @param x - X scale
   * @param y - Y scale
   * @param z - Z scale
   */
  setScale(entityId: EntityId, x: number, y: number, z: number): void {
    const transformSystem = this.getTransformSystem();
    if (!transformSystem) {
      console.warn('TransformSystem not registered. Call world.registerSystem(transformSystem) first.');
      return;
    }
    transformSystem.setScale(entityId, x, y, z);
  }

  /**
   * Set parent-child relationship
   *
   * Convenience method for transformSystem.setParent()
   *
   * @param childId - Child entity
   * @param parentId - Parent entity (undefined to clear parent)
   */
  setParent(childId: EntityId, parentId?: EntityId): void {
    const transformSystem = this.getTransformSystem();
    if (!transformSystem) {
      console.warn('TransformSystem not registered. Call world.registerSystem(transformSystem) first.');
      return;
    }
    transformSystem.setParent(childId, parentId);
  }

  /**
   * Get children of entity
   *
   * Convenience method for transformSystem.getChildren()
   *
   * @param entityId - Parent entity
   * @returns Array of child entity IDs
   */
  getChildren(entityId: EntityId): EntityId[] {
    const transformSystem = this.getTransformSystem();
    if (!transformSystem) {
      console.warn('TransformSystem not registered. Call world.registerSystem(transformSystem) first.');
      return [];
    }
    return transformSystem.getChildren(entityId);
  }

  /**
   * Get world matrix for entity
   *
   * Convenience method for transformSystem.getWorldMatrix()
   *
   * @param entityId - Entity to get matrix for
   * @returns World matrix or undefined if entity has no Transform
   */
  getWorldMatrix(entityId: EntityId): Float32Array | undefined {
    const transformSystem = this.getTransformSystem();
    if (!transformSystem) {
      console.warn('TransformSystem not registered. Call world.registerSystem(transformSystem) first.');
      return undefined;
    }
    return transformSystem.getWorldMatrix(entityId);
  }

  /**
   * Get local matrix for entity
   *
   * Convenience method for transformSystem.getLocalMatrix()
   *
   * @param entityId - Entity to get matrix for
   * @returns Local matrix or undefined if entity has no Transform
   */
  getLocalMatrix(entityId: EntityId): Float32Array | undefined {
    const transformSystem = this.getTransformSystem();
    if (!transformSystem) {
      console.warn('TransformSystem not registered. Call world.registerSystem(transformSystem) first.');
      return undefined;
    }
    return transformSystem.getLocalMatrix(entityId);
  }
}
