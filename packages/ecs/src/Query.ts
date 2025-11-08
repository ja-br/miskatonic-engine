import type { Archetype, ComponentType, EntityId, QueryFilter } from './types';
import { ArchetypeManager } from './Archetype';

/**
 * Query result - entity and its components
 */
export interface QueryResult {
  entity: EntityId;
  components: Map<ComponentType, any>;
}

/**
 * Query - selects entities based on component criteria
 *
 * Queries are cached for performance - matching archetypes are computed once
 * and reused until archetypes change.
 */
export class Query {
  private filter: QueryFilter;
  private matchingArchetypes: Archetype[] | null = null;
  private cacheValid = false;

  constructor(filter: QueryFilter) {
    this.filter = filter;
  }

  /**
   * Check if an archetype matches this query
   */
  private matchesArchetype(archetype: Archetype, archetypeManager: ArchetypeManager): boolean {
    // Check required components (with)
    if (this.filter.with) {
      if (!archetypeManager.hasAllTypes(archetype, this.filter.with)) {
        return false;
      }
    }

    // Check excluded components (without)
    if (this.filter.without) {
      if (!archetypeManager.hasNoneOfTypes(archetype, this.filter.without)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update cache of matching archetypes
   */
  private updateCache(archetypeManager: ArchetypeManager): void {
    this.matchingArchetypes = archetypeManager
      .getAllArchetypes()
      .filter((archetype) => this.matchesArchetype(archetype, archetypeManager));

    this.cacheValid = true;
  }

  /**
   * Invalidate cache (call when archetypes change)
   */
  invalidateCache(): void {
    this.cacheValid = false;
  }

  /**
   * Iterate over all entities matching the query
   */
  forEach(
    archetypeManager: ArchetypeManager,
    callback: (entity: EntityId, components: Map<ComponentType, any>) => void
  ): void {
    if (!this.cacheValid) {
      this.updateCache(archetypeManager);
    }

    if (!this.matchingArchetypes) {
      return;
    }

    const requiredTypes = this.filter.with || [];
    const optionalTypes = this.filter.optional || [];
    const allTypes = [...requiredTypes, ...optionalTypes];

    for (const archetype of this.matchingArchetypes) {
      const entityCount = archetype.count;

      for (let i = 0; i < entityCount; i++) {
        const entity = archetype.entities[i];
        const components = new Map<ComponentType, any>();

        // Collect components
        for (const type of allTypes) {
          const component = archetypeManager.getComponent(archetype, type, i);
          if (component !== undefined) {
            components.set(type, component);
          }
        }

        callback(entity, components);
      }
    }
  }

  /**
   * Get all entities matching the query as an array
   */
  getEntities(archetypeManager: ArchetypeManager): QueryResult[] {
    const results: QueryResult[] = [];

    this.forEach(archetypeManager, (entity, components) => {
      results.push({ entity, components });
    });

    return results;
  }

  /**
   * Get first entity matching the query
   */
  getFirst(archetypeManager: ArchetypeManager): QueryResult | null {
    if (!this.cacheValid) {
      this.updateCache(archetypeManager);
    }

    if (!this.matchingArchetypes || this.matchingArchetypes.length === 0) {
      return null;
    }

    const requiredTypes = this.filter.with || [];
    const optionalTypes = this.filter.optional || [];
    const allTypes = [...requiredTypes, ...optionalTypes];

    for (const archetype of this.matchingArchetypes) {
      if (archetype.count > 0) {
        const entity = archetype.entities[0];
        const components = new Map<ComponentType, any>();

        for (const type of allTypes) {
          const component = archetypeManager.getComponent(archetype, type, 0);
          if (component !== undefined) {
            components.set(type, component);
          }
        }

        return { entity, components };
      }
    }

    return null;
  }

  /**
   * Count entities matching the query
   */
  count(archetypeManager: ArchetypeManager): number {
    if (!this.cacheValid) {
      this.updateCache(archetypeManager);
    }

    if (!this.matchingArchetypes) {
      return 0;
    }

    return this.matchingArchetypes.reduce((sum, archetype) => sum + archetype.count, 0);
  }

  /**
   * Check if any entities match the query
   */
  isEmpty(archetypeManager: ArchetypeManager): boolean {
    return this.count(archetypeManager) === 0;
  }
}

/**
 * Query Builder - fluent API for building queries
 */
export class QueryBuilder {
  private filter: QueryFilter = {};

  /**
   * Require components to be present
   */
  with(...types: ComponentType[]): this {
    this.filter.with = [...(this.filter.with || []), ...types];
    return this;
  }

  /**
   * Require components to be absent
   */
  without(...types: ComponentType[]): this {
    this.filter.without = [...(this.filter.without || []), ...types];
    return this;
  }

  /**
   * Include components if present (optional)
   */
  optional(...types: ComponentType[]): this {
    this.filter.optional = [...(this.filter.optional || []), ...types];
    return this;
  }

  /**
   * Build the query
   */
  build(): Query {
    return new Query(this.filter);
  }
}
