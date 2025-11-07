import type { EntityId, EntityMetadata } from './types';

/**
 * Entity Manager - handles entity creation, destruction, and ID recycling
 *
 * Entities are just IDs - all data is stored in components.
 * Uses generation counters to detect use-after-free bugs.
 */
export class EntityManager {
  private nextEntityId: EntityId = 1;
  private recycledIds: EntityId[] = [];
  private entities: Map<EntityId, EntityMetadata> = new Map();
  private generations: Map<EntityId, number> = new Map();

  /**
   * Create a new entity
   */
  create(): EntityId {
    let id: EntityId;
    let generation: number;

    // Reuse recycled IDs if available
    if (this.recycledIds.length > 0) {
      id = this.recycledIds.pop()!;
      generation = (this.generations.get(id) || 0) + 1;
      this.generations.set(id, generation);
    } else {
      id = this.nextEntityId++;
      generation = 0;
      this.generations.set(id, generation);
    }

    // Create entity metadata
    const metadata: EntityMetadata = {
      id,
      generation,
      archetype: null,
      archetypeIndex: -1,
    };

    this.entities.set(id, metadata);
    return id;
  }

  /**
   * Destroy an entity
   */
  destroy(id: EntityId): void {
    if (!this.entities.has(id)) {
      return;
    }

    this.entities.delete(id);
    this.recycledIds.push(id);
  }

  /**
   * Check if entity exists and is valid
   */
  exists(id: EntityId): boolean {
    return this.entities.has(id);
  }

  /**
   * Check if entity ID matches current generation
   * Detects use-after-free bugs
   */
  isValid(id: EntityId, generation: number): boolean {
    return this.generations.get(id) === generation;
  }

  /**
   * Get entity metadata
   */
  getMetadata(id: EntityId): EntityMetadata | undefined {
    return this.entities.get(id);
  }

  /**
   * Update entity metadata
   */
  setMetadata(id: EntityId, metadata: EntityMetadata): void {
    this.entities.set(id, metadata);
  }

  /**
   * Get all active entity IDs
   */
  getAllEntities(): EntityId[] {
    return Array.from(this.entities.keys());
  }

  /**
   * Get total entity count
   */
  getCount(): number {
    return this.entities.size;
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entities.clear();
    this.recycledIds = [];
    this.nextEntityId = 1;
  }

  /**
   * Get statistics for debugging
   */
  getStats() {
    return {
      active: this.entities.size,
      recycled: this.recycledIds.length,
      nextId: this.nextEntityId,
    };
  }
}
