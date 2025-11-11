/**
 * LightSystem - Epic 3.15
 *
 * ECS system for managing lights and providing efficient access to light data.
 *
 * Features:
 * - Light collection management
 * - Automatic position updates from Transform components
 * - Type-specific light queries
 * - Incremental updates (only rebuilds when dirty)
 *
 * Usage:
 * ```typescript
 * const lightSystem = new LightSystem(world);
 *
 * // Update light collection (call once per frame)
 * lightSystem.update();
 *
 * // Get lights by type for rendering
 * const directionalLights = lightSystem.getDirectionalLights();
 * const pointLights = lightSystem.getPointLights();
 * const spotLights = lightSystem.getSpotLights();
 * const ambientLights = lightSystem.getAmbientLights();
 *
 * // Get all active lights
 * const allLights = lightSystem.getActiveLights();
 *
 * // Get light count
 * const count = lightSystem.getLightCount();
 * ```
 */

import type { World, EntityId } from '@miskatonic/ecs';
import { Light, Transform } from '@miskatonic/ecs';
import { LightCollection, type LightData } from './LightCollection';
import type { LightComponentData, TransformComponentData } from './LightTypes';

export class LightSystem {
  private world: World;
  private collection: LightCollection;

  // Track entities with lights for change detection
  private lightEntities = new Set<EntityId>();

  constructor(world: World) {
    this.world = world;
    this.collection = new LightCollection();
  }

  /**
   * Update light collection from ECS world
   *
   * Call this once per frame to sync lights with the ECS.
   * Uses incremental updates - only rebuilds when entities change.
   */
  update(): void {
    const query = this.world.query().with(Light as any).build();
    const results = this.world.executeQuery(query);

    const currentEntities = new Set<EntityId>();

    // Update or add lights
    for (const result of results) {
      currentEntities.add(result.entity);

      const light = this.world.getComponent(result.entity, Light as any) as LightComponentData | undefined;
      if (!light) continue;

      // Get optional Transform for position (point/spot lights)
      const transform = this.world.getComponent(result.entity, Transform as any) as TransformComponentData | undefined;

      // Update or add to collection
      if (this.collection.has(result.entity)) {
        this.collection.update(result.entity, light, transform);
      } else {
        this.collection.add(result.entity, light, transform);
      }
    }

    // Remove lights that no longer exist
    for (const entity of this.lightEntities) {
      if (!currentEntities.has(entity)) {
        this.collection.remove(entity);
      }
    }

    this.lightEntities = currentEntities;
  }

  /**
   * Get all directional lights
   */
  getDirectionalLights(): readonly LightData[] {
    return this.collection.getDirectionalLights();
  }

  /**
   * Get all point lights
   */
  getPointLights(): readonly LightData[] {
    return this.collection.getPointLights();
  }

  /**
   * Get all spot lights
   */
  getSpotLights(): readonly LightData[] {
    return this.collection.getSpotLights();
  }

  /**
   * Get all ambient lights
   */
  getAmbientLights(): readonly LightData[] {
    return this.collection.getAmbientLights();
  }

  /**
   * Get all active lights (all types combined)
   */
  getActiveLights(): readonly LightData[] {
    return this.collection.getActiveLights();
  }

  /**
   * Get total count of active lights
   */
  getLightCount(): number {
    return this.collection.getCount();
  }

  /**
   * Get light data for specific entity
   */
  getLight(entity: EntityId): LightData | undefined {
    return this.collection.get(entity);
  }

  /**
   * Check if entity has a light
   */
  hasLight(entity: EntityId): boolean {
    return this.collection.has(entity);
  }

  /**
   * Clear all lights from collection
   */
  clear(): void {
    this.collection.clear();
    this.lightEntities.clear();
  }
}
