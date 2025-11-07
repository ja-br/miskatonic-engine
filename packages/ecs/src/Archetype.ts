import type { Archetype, ComponentType, EntityId } from './types';

/**
 * Archetype Manager - manages entity archetypes for cache-efficient storage
 *
 * Archetype-based ECS stores entities with the same component combination together.
 * This provides excellent cache locality and performance for iteration.
 */
export class ArchetypeManager {
  private archetypes: Map<string, Archetype> = new Map();
  private nextArchetypeId = 1;

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

    // Create new archetype
    const archetype: Archetype = {
      id: this.nextArchetypeId++,
      types: sortedTypes,
      signature,
      entities: [],
      components: new Map(),
    };

    // Initialize component arrays
    for (const type of sortedTypes) {
      archetype.components.set(type, []);
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
   */
  addEntity(archetype: Archetype, entityId: EntityId, components: Map<ComponentType, any>): number {
    const index = archetype.entities.length;

    // Add entity ID
    archetype.entities.push(entityId);

    // Add components to respective arrays
    for (const [type, component] of components) {
      const componentArray = archetype.components.get(type);
      if (componentArray) {
        componentArray.push(component);
      }
    }

    return index;
  }

  /**
   * Remove entity from archetype
   * Uses swap-and-pop for O(1) removal
   */
  removeEntity(archetype: Archetype, index: number): EntityId | undefined {
    if (index < 0 || index >= archetype.entities.length) {
      return undefined;
    }

    const lastIndex = archetype.entities.length - 1;
    const movedEntityId = archetype.entities[lastIndex];

    // Swap with last entity
    if (index !== lastIndex) {
      archetype.entities[index] = movedEntityId;

      // Swap components
      for (const [type, componentArray] of archetype.components) {
        componentArray[index] = componentArray[lastIndex];
      }
    }

    // Pop last element
    archetype.entities.pop();
    for (const componentArray of archetype.components.values()) {
      componentArray.pop();
    }

    // Return the entity that was moved (if any)
    return index !== lastIndex ? movedEntityId : undefined;
  }

  /**
   * Get component for entity at index
   */
  getComponent<T>(archetype: Archetype, type: ComponentType<T>, index: number): T | undefined {
    const componentArray = archetype.components.get(type);
    return componentArray ? componentArray[index] : undefined;
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
    const componentArray = archetype.components.get(type);
    if (componentArray) {
      componentArray[index] = component;
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
      archetypes: [] as Array<{ signature: string; entityCount: number; components: string[] }>,
    };

    for (const archetype of this.archetypes.values()) {
      stats.totalEntities += archetype.entities.length;
      stats.archetypes.push({
        signature: archetype.signature,
        entityCount: archetype.entities.length,
        components: archetype.types.map((t) => t.name),
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
}
