/**
 * LightCollection - Epic 3.15
 *
 * Manages efficient queries and access to lights in the ECS world.
 * Provides type-specific light lists for rendering optimizations.
 */

import type { EntityId } from '@miskatonic/ecs';
import type { LightComponentData, TransformComponentData } from './LightTypes';

/**
 * Light types enum for type-safe queries
 */
export enum LightType {
  DIRECTIONAL = 0,
  POINT = 1,
  SPOT = 2,
  AMBIENT = 3,
}

/**
 * Light data structure for efficient access
 * Stores entity ID and precomputed light properties
 */
export interface LightData {
  /** Entity ID of the light */
  entity: EntityId;

  /** Light type (0-3) */
  type: LightType;

  /** Enabled flag */
  enabled: boolean;

  /** Color RGB (0-1 range) */
  color: [number, number, number];

  /** Intensity multiplier */
  intensity: number;

  /** Direction (for directional/spot) */
  direction?: [number, number, number];

  /** Position (for point/spot) */
  position?: [number, number, number];

  /** Radius (for point/spot) */
  radius?: number;

  /** Spot angle (for spot) */
  spotAngle?: number;

  /** Spot penumbra (for spot) */
  spotPenumbra?: number;

  /** Casts shadows flag */
  castsShadows: boolean;

  /** Shadow bias */
  shadowBias: number;
}

/**
 * LightCollection manager
 *
 * Provides efficient queries for lights by type.
 * Maintains separate lists for each light type for fast iteration.
 *
 * Usage:
 * ```typescript
 * const collection = new LightCollection();
 *
 * // Add lights
 * collection.add(entity, lightComponent, transformComponent);
 *
 * // Query by type
 * const directionalLights = collection.getDirectionalLights();
 * const pointLights = collection.getPointLights();
 *
 * // Get all active lights
 * const activeLights = collection.getActiveLights();
 *
 * // Update light
 * collection.update(entity, lightComponent, transformComponent);
 *
 * // Remove light
 * collection.remove(entity);
 *
 * // Clear all
 * collection.clear();
 * ```
 */
export class LightCollection {
  private lights = new Map<EntityId, LightData>();

  // Type-specific lists for fast iteration
  private directionalLights: LightData[] = [];
  private pointLights: LightData[] = [];
  private spotLights: LightData[] = [];
  private ambientLights: LightData[] = [];

  // Cached combined array to avoid allocations
  private activeLightsCache: LightData[] = [];

  // Dirty flags for incremental updates
  private dirty = true;

  /**
   * Add a light to the collection
   *
   * @param entity - Entity ID
   * @param light - Light component data
   * @param transform - Optional Transform component for position (point/spot lights)
   */
  add(entity: EntityId, light: LightComponentData, transform?: TransformComponentData): void {
    const lightData = this.createLightData(entity, light, transform);
    this.lights.set(entity, lightData);
    this.dirty = true;
  }

  /**
   * Update an existing light
   *
   * @param entity - Entity ID
   * @param light - Light component data
   * @param transform - Optional Transform component
   */
  update(entity: EntityId, light: LightComponentData, transform?: TransformComponentData): void {
    const lightData = this.createLightData(entity, light, transform);
    this.lights.set(entity, lightData);
    this.dirty = true;
  }

  /**
   * Remove a light from the collection
   *
   * @param entity - Entity ID
   */
  remove(entity: EntityId): void {
    this.lights.delete(entity);
    this.dirty = true;
  }

  /**
   * Clear all lights
   */
  clear(): void {
    this.lights.clear();
    this.directionalLights = [];
    this.pointLights = [];
    this.spotLights = [];
    this.ambientLights = [];
    this.dirty = false;
  }

  /**
   * Rebuild type-specific lists if dirty
   * Called automatically by getter methods
   */
  private rebuild(): void {
    if (!this.dirty) return;

    this.directionalLights = [];
    this.pointLights = [];
    this.spotLights = [];
    this.ambientLights = [];

    for (const lightData of this.lights.values()) {
      if (!lightData.enabled) continue;

      switch (lightData.type) {
        case LightType.DIRECTIONAL:
          this.directionalLights.push(lightData);
          break;
        case LightType.POINT:
          this.pointLights.push(lightData);
          break;
        case LightType.SPOT:
          this.spotLights.push(lightData);
          break;
        case LightType.AMBIENT:
          this.ambientLights.push(lightData);
          break;
      }
    }

    // Rebuild cached combined array
    this.activeLightsCache = [
      ...this.directionalLights,
      ...this.pointLights,
      ...this.spotLights,
      ...this.ambientLights,
    ];

    this.dirty = false;
  }

  /**
   * Get all directional lights
   */
  getDirectionalLights(): readonly LightData[] {
    this.rebuild();
    return this.directionalLights;
  }

  /**
   * Get all point lights
   */
  getPointLights(): readonly LightData[] {
    this.rebuild();
    return this.pointLights;
  }

  /**
   * Get all spot lights
   */
  getSpotLights(): readonly LightData[] {
    this.rebuild();
    return this.spotLights;
  }

  /**
   * Get all ambient lights
   */
  getAmbientLights(): readonly LightData[] {
    this.rebuild();
    return this.ambientLights;
  }

  /**
   * Get all active lights (all types combined)
   *
   * Returns a cached array - no allocations after first call.
   */
  getActiveLights(): readonly LightData[] {
    this.rebuild();
    return this.activeLightsCache;
  }

  /**
   * Get lights by type
   *
   * @param type - Light type
   */
  getLightsByType(type: LightType): readonly LightData[] {
    switch (type) {
      case LightType.DIRECTIONAL:
        return this.getDirectionalLights();
      case LightType.POINT:
        return this.getPointLights();
      case LightType.SPOT:
        return this.getSpotLights();
      case LightType.AMBIENT:
        return this.getAmbientLights();
      default:
        return [];
    }
  }

  /**
   * Get total count of active lights
   */
  getCount(): number {
    this.rebuild();
    return (
      this.directionalLights.length +
      this.pointLights.length +
      this.spotLights.length +
      this.ambientLights.length
    );
  }

  /**
   * Get count by type
   */
  getCountByType(type: LightType): number {
    return this.getLightsByType(type).length;
  }

  /**
   * Get light data for specific entity
   */
  get(entity: EntityId): LightData | undefined {
    return this.lights.get(entity);
  }

  /**
   * Check if entity has a light
   */
  has(entity: EntityId): boolean {
    return this.lights.has(entity);
  }

  /**
   * Create LightData from component data
   */
  private createLightData(
    entity: EntityId,
    light: LightComponentData,
    transform?: TransformComponentData
  ): LightData {
    const data: LightData = {
      entity,
      type: light.type as LightType,
      enabled: light.enabled === 1,
      color: [light.colorR, light.colorG, light.colorB],
      intensity: light.intensity,
      castsShadows: light.castsShadows === 1,
      shadowBias: light.shadowBias,
    };

    // Add type-specific properties
    switch (light.type) {
      case LightType.DIRECTIONAL:
        data.direction = [light.directionX, light.directionY, light.directionZ];
        break;

      case LightType.POINT:
        // Use Transform position if available, fallback to Light position
        if (transform) {
          data.position = [transform.x, transform.y, transform.z];
        } else {
          data.position = [light.positionX, light.positionY, light.positionZ];
        }
        data.radius = light.radius;
        break;

      case LightType.SPOT:
        // Use Transform position if available
        if (transform) {
          data.position = [transform.x, transform.y, transform.z];
        } else {
          data.position = [light.positionX, light.positionY, light.positionZ];
        }
        data.direction = [light.directionX, light.directionY, light.directionZ];
        data.radius = light.radius;
        data.spotAngle = light.spotAngle;
        data.spotPenumbra = light.spotPenumbra;
        break;

      case LightType.AMBIENT:
        // No additional properties for ambient lights
        break;
    }

    return data;
  }
}
