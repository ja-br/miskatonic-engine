import type { Archetype, ComponentType, EntityId } from './types';
import { ComponentStorage } from './ComponentStorage';
import { ComponentRegistry } from './ComponentRegistry';

/**
 * Archetype Manager - manages entity archetypes for cache-efficient storage
 *
 * Archetype-based ECS stores entities with the same component combination together.
 * This refactored version uses Structure of Arrays (SoA) with typed arrays for:
 * - 4.16x faster iteration (validated in Epic 2.10)
 * - Zero GC pressure
 * - Cache-friendly sequential memory access
 *
 * Implementation based on Epic 2.10 benchmark results.
 */
export class ArchetypeManager {
  private archetypes: Map<string, Archetype> = new Map();
  private nextArchetypeId = 1;
  private readonly initialCapacity: number;

  constructor(initialCapacity: number = 256) {
    this.initialCapacity = initialCapacity;
  }

  /**
   * Get or create an archetype for a set of component types
   */
  getOrCreateArchetype(types: ComponentType[]): Archetype {
    // Sort types for consistent signature
    const sortedTypes = [...types].sort((a, b) => a.name.localeCompare(b.name));

    // Create signature from type names
    const signature = sortedTypes.map((t) => t.name).join(',');

    // Return existing archetype if found
    if (this.archetypes.has(signature)) {
      return this.archetypes.get(signature)!;
    }

    // Validate all component types are registered
    for (const type of sortedTypes) {
      if (!ComponentRegistry.isRegistered(type)) {
        throw new Error(
          `Component ${type.name} is not registered. ` +
            `Call ComponentRegistry.register(${type.name}, fields) or ` +
            `ComponentRegistry.autoRegister(${type.name}) before use.`
        );
      }
    }

    // Create new archetype with SoA storage
    const archetype: Archetype = {
      id: this.nextArchetypeId++,
      types: sortedTypes,
      signature,
      entities: new Uint32Array(this.initialCapacity),
      count: 0,
      capacity: this.initialCapacity,
      components: new Map(),
    };

    // Initialize component storage for each type
    for (const type of sortedTypes) {
      const fields = ComponentRegistry.getFields(type);
      if (!fields) {
        throw new Error(`Component ${type.name} has no registered fields`);
      }

      archetype.components.set(type, new ComponentStorage(fields, this.initialCapacity));
    }

    this.archetypes.set(signature, archetype);
    return archetype;
  }

  /**
   * Get archetype by signature
   */
  getArchetype(signature: string): Archetype | undefined {
    return this.archetypes.get(signature);
  }

  /**
   * Get all archetypes
   */
  getAllArchetypes(): Archetype[] {
    return Array.from(this.archetypes.values());
  }

  /**
   * Add entity to archetype
   *
   * @param archetype - Target archetype
   * @param entityId - Entity ID to add
   * @param components - Component data map
   * @returns Index where entity was added
   */
  addEntity(archetype: Archetype, entityId: EntityId, components: Map<ComponentType, any>): number {
    // Grow archetype if needed
    if (archetype.count >= archetype.capacity) {
      this.growArchetype(archetype);
    }

    const index = archetype.count++;

    // Add entity ID
    archetype.entities[index] = entityId;

    // Add components to typed array storage
    for (const [type, component] of components) {
      const storage = archetype.components.get(type);
      if (storage) {
        // ComponentStorage handles adding at correct index
        storage.add(component);
      }
    }

    return index;
  }

  /**
   * Remove entity from archetype
   * Uses swap-and-pop for O(1) removal
   *
   * @param archetype - Target archetype
   * @param index - Index to remove
   * @returns EntityId that was moved (swapped), or undefined if removed last element
   */
  removeEntity(archetype: Archetype, index: number): EntityId | undefined {
    if (index < 0 || index >= archetype.count) {
      return undefined;
    }

    const lastIndex = archetype.count - 1;
    const movedEntityId = archetype.entities[lastIndex];

    // Swap with last entity (or just decrement if removing last)
    if (index !== lastIndex) {
      archetype.entities[index] = movedEntityId;
    }

    // Swap/remove components in all storages
    for (const storage of archetype.components.values()) {
      storage.remove(index);
    }

    archetype.count--;

    // Return the entity that was moved (if any)
    return index !== lastIndex ? movedEntityId : undefined;
  }

  /**
   * Get component for entity at index
   */
  getComponent<T>(archetype: Archetype, type: ComponentType<T>, index: number): T | undefined {
    const storage = archetype.components.get(type);
    if (!storage) {
      return undefined;
    }

    return storage.getComponent(index) as T;
  }

  /**
   * Set component for entity at index
   */
  setComponent<T>(
    archetype: Archetype,
    type: ComponentType<T>,
    index: number,
    component: T
  ): void {
    const storage = archetype.components.get(type);
    if (storage) {
      storage.setComponent(index, component);
    }
  }

  /**
   * Check if archetype contains all specified types
   */
  hasAllTypes(archetype: Archetype, types: ComponentType[]): boolean {
    return types.every((type) => archetype.components.has(type));
  }

  /**
   * Check if archetype contains any of the specified types
   */
  hasAnyType(archetype: Archetype, types: ComponentType[]): boolean {
    return types.some((type) => archetype.components.has(type));
  }

  /**
   * Check if archetype contains none of the specified types
   */
  hasNoneOfTypes(archetype: Archetype, types: ComponentType[]): boolean {
    return !types.some((type) => archetype.components.has(type));
  }

  /**
   * Get statistics for debugging
   */
  getStats() {
    const stats = {
      totalArchetypes: this.archetypes.size,
      totalEntities: 0,
      totalCapacity: 0,
      memoryUsageBytes: 0,
      archetypes: [] as Array<{
        signature: string;
        entityCount: number;
        capacity: number;
        utilization: number;
        components: string[];
        memoryBytes: number;
      }>,
    };

    for (const archetype of this.archetypes.values()) {
      stats.totalEntities += archetype.count;
      stats.totalCapacity += archetype.capacity;

      // Calculate memory usage
      let archetypeMemory = archetype.capacity * 4; // Uint32Array for entities

      for (const storage of archetype.components.values()) {
        archetypeMemory += storage.getMemoryStats().totalBytes;
      }

      stats.memoryUsageBytes += archetypeMemory;

      stats.archetypes.push({
        signature: archetype.signature,
        entityCount: archetype.count,
        capacity: archetype.capacity,
        utilization: (archetype.count / archetype.capacity) * 100,
        components: archetype.types.map((t) => t.name),
        memoryBytes: archetypeMemory,
      });
    }

    return stats;
  }

  /**
   * Clear all archetypes
   */
  clear(): void {
    this.archetypes.clear();
    this.nextArchetypeId = 1;
  }

  /**
   * Grow archetype capacity (doubles current capacity)
   */
  private growArchetype(archetype: Archetype): void {
    const newCapacity = archetype.capacity * 2;

    // Grow entity ID array
    const newEntities = new Uint32Array(newCapacity);
    newEntities.set(archetype.entities);
    archetype.entities = newEntities;

    // Component storage will grow automatically when adding
    // But we need to pre-grow to maintain capacity alignment
    // This is handled by ComponentStorage.grow() internally

    archetype.capacity = newCapacity;
  }
}
