/**
 * Light Culler - Epic 3.16
 *
 * CPU-based frustum culling for lights.
 * Filters lights outside the camera frustum to reduce rendering overhead.
 */

import type { LightData } from '../LightCollection';
import { LightType } from '../LightCollection';
import { Frustum } from './Frustum';

/**
 * Statistics from light culling operation
 */
export interface LightCullingStats {
  /** Total number of lights tested */
  totalLights: number;
  /** Number of lights after culling (visible) */
  visibleLights: number;
  /** Number of lights culled (outside frustum) */
  culledLights: number;
  /** CPU time spent culling (milliseconds) */
  cullTimeMs: number;
}

/**
 * CPU-based light culler using frustum culling.
 * Removes lights that are outside the camera's view frustum.
 *
 * Algorithm:
 * - Directional lights: Always visible (infinite extent)
 * - Ambient lights: Always visible (global illumination)
 * - Point lights: Test sphere (position, radius) vs frustum
 * - Spot lights: Test sphere (conservative cone approximation) vs frustum
 *
 * Performance Target: <1ms for 100 lights
 *
 * Usage:
 * ```typescript
 * const culler = new LightCuller();
 * const camera = getCamera();
 *
 * // Cull lights every frame
 * const result = culler.cull(allLights, camera.viewProjectionMatrix);
 * renderLights(result.visibleLights);
 *
 * console.log(`Culled ${result.stats.culledLights} / ${result.stats.totalLights} lights`);
 * ```
 */
export class LightCuller {
  private frustum: Frustum = new Frustum();
  private lastStats: LightCullingStats = {
    totalLights: 0,
    visibleLights: 0,
    culledLights: 0,
    cullTimeMs: 0,
  };

  /**
   * Cull lights against camera frustum.
   *
   * @param lights Array of lights to test
   * @param viewProjectionMatrix Camera's view-projection matrix (16 elements, column-major)
   * @returns Object with visibleLights array and culling stats
   */
  cull(
    lights: readonly LightData[],
    viewProjectionMatrix: Float32Array | number[]
  ): {
    visibleLights: readonly LightData[];
    stats: Readonly<LightCullingStats>;
  } {
    const startTime = performance.now();

    // Update frustum from view-projection matrix (in-place, no allocation)
    this.frustum.updateFromViewProjection(viewProjectionMatrix);

    // Filter lights
    const visibleLights = lights.filter((light) =>
      this.isLightVisible(light)
    );

    const endTime = performance.now();

    // Update stats
    this.lastStats = {
      totalLights: lights.length,
      visibleLights: visibleLights.length,
      culledLights: lights.length - visibleLights.length,
      cullTimeMs: endTime - startTime,
    };

    return {
      visibleLights,
      stats: this.lastStats,
    };
  }

  /**
   * Test if a single light is visible in the frustum.
   *
   * @param light Light data to test
   * @returns true if light is visible
   */
  private isLightVisible(light: LightData): boolean {
    switch (light.type) {
      case LightType.DIRECTIONAL:
        // Directional lights have infinite extent (like the sun)
        return true;

      case LightType.AMBIENT:
        // Ambient lights affect everything globally
        return true;

      case LightType.POINT: {
        // Point light: test sphere (position, radius) vs frustum
        if (!light.position || light.radius === undefined) {
          // Invalid light data - include by default to avoid surprises
          return true;
        }

        // Use duck-typed object (no allocation) for intersection test
        return this.frustum.intersectsSphere({
          x: light.position[0],
          y: light.position[1],
          z: light.position[2],
          radius: light.radius,
        });
      }

      case LightType.SPOT: {
        // Spot light: approximate cone as sphere (conservative test)
        // Sphere radius = sqrt(radius^2 + (radius * tan(angle/2))^2)
        // For simplicity, use light.radius as conservative bound
        if (!light.position || light.radius === undefined) {
          return true;
        }

        // Conservative sphere approximation for cone (no allocation)
        // TODO: More precise cone-frustum test in future
        return this.frustum.intersectsSphere({
          x: light.position[0],
          y: light.position[1],
          z: light.position[2],
          radius: light.radius, // Conservative: use full radius
        });
      }

      default:
        // Unknown light type - include by default
        return true;
    }
  }

  /**
   * Get statistics from the last culling operation.
   *
   * @returns Readonly culling stats
   */
  getLastStats(): Readonly<LightCullingStats> {
    return this.lastStats;
  }

  /**
   * Get the current frustum (useful for debugging).
   *
   * @returns Current frustum object
   */
  getFrustum(): Readonly<Frustum> {
    return this.frustum;
  }
}

/**
 * Batch light culler for multiple views (e.g., shadow maps, reflections).
 * Culls lights against multiple frustums simultaneously.
 *
 * Usage:
 * ```typescript
 * const batchCuller = new BatchLightCuller();
 * const results = batchCuller.cullMultiple(lights, [
 *   mainCamera.viewProjectionMatrix,
 *   shadowCamera.viewProjectionMatrix,
 * ]);
 *
 * renderMainView(results[0].visibleLights);
 * renderShadowMap(results[1].visibleLights);
 * ```
 */
export class BatchLightCuller {
  private cullers: LightCuller[] = [];

  /**
   * Cull lights against multiple view frustums.
   *
   * @param lights Array of lights to test
   * @param viewProjectionMatrices Array of camera matrices
   * @returns Array of culling results (one per camera)
   */
  cullMultiple(
    lights: readonly LightData[],
    viewProjectionMatrices: Array<Float32Array | number[]>
  ): Array<{
    visibleLights: readonly LightData[];
    stats: Readonly<LightCullingStats>;
  }> {
    // Ensure we have enough cullers
    while (this.cullers.length < viewProjectionMatrices.length) {
      this.cullers.push(new LightCuller());
    }

    // Cull for each view
    return viewProjectionMatrices.map((matrix, index) =>
      this.cullers[index].cull(lights, matrix)
    );
  }

  /**
   * Get culling statistics for all views.
   *
   * @returns Array of stats (one per view)
   */
  getAllStats(): ReadonlyArray<Readonly<LightCullingStats>> {
    return this.cullers.map((culler) => culler.getLastStats());
  }
}
