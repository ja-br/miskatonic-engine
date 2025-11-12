/**
 * FlickeringLightSystem - Epic 3.18 Phase 3
 *
 * Updates Light intensity for entities with FlickeringLight component using
 * smooth Perlin noise for realistic flickering effects.
 */

import type { World } from '@miskatonic/ecs';
import { Light, FlickeringLight } from '@miskatonic/ecs';
import type { LightComponentData } from '../LightTypes';

/**
 * 1D smooth noise implementation
 *
 * Generates smooth pseudo-random values in [-1, 1] range.
 * Uses linear interpolation between random values with smoothstep.
 *
 * Note: This is NOT true Perlin noise (which uses gradient vectors).
 * It's a simpler smoothed random walk sufficient for light flickering.
 *
 * @param x - Input coordinate
 * @param seed - Random seed for reproducibility
 * @returns Noise value in [-1, 1]
 */
function smoothNoise1D(x: number, seed: number): number {
  // Get integer and fractional parts
  const xi = Math.floor(x);
  const xf = x - xi;

  // Smooth interpolation (smoothstep: 3t² - 2t³)
  const t = xf * xf * (3.0 - 2.0 * xf);

  // Pseudo-random value function
  const random = (n: number): number => {
    const val = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
    return val - Math.floor(val); // Fractional part [0, 1]
  };

  // Get random values at grid points
  const v0 = random(xi) * 2.0 - 1.0; // [-1, 1]
  const v1 = random(xi + 1) * 2.0 - 1.0;

  // Interpolate
  return v0 * (1.0 - t) + v1 * t;
}

/**
 * FlickeringLightSystem
 *
 * Updates light intensity based on smooth noise for natural flickering.
 * Uses smoothstep-interpolated random values (not true Perlin noise).
 *
 * @example
 * ```typescript
 * const system = new FlickeringLightSystem(world);
 *
 * // Update every frame
 * function gameLoop(dt: number) {
 *   system.update(dt);
 * }
 * ```
 */
export class FlickeringLightSystem {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Update all flickering lights
   *
   * @param dt - Delta time in seconds
   */
  update(dt: number): void {
    // Query entities with both Light and FlickeringLight components
    const query = this.world.query().with(Light as any).with(FlickeringLight as any).build();
    const results = this.world.executeQuery(query);

    for (const result of results) {
      const light = this.world.getComponent(result.entity, Light as any) as LightComponentData | undefined;
      const flicker = this.world.getComponent(result.entity, FlickeringLight as any) as any;

      if (!light || !flicker) continue;

      // Update time accumulator
      flicker._time += dt;

      // Generate smooth noise value [-1, 1]
      const noiseValue = smoothNoise1D(
        flicker._time * flicker.flickerSpeed,
        flicker.randomSeed
      );

      // Apply flicker amount (0 = no flicker, 1 = full range)
      const intensityDelta = noiseValue * flicker.flickerAmount;

      // Update light intensity
      light.intensity = flicker.baseIntensity * (1.0 + intensityDelta);

      // Clamp to prevent negative intensity
      if (light.intensity < 0) {
        light.intensity = 0;
      }

      // Write back modified components
      this.world.setComponent(result.entity, Light as any, light as any);
      this.world.setComponent(result.entity, FlickeringLight as any, flicker as any);
    }
  }

  /**
   * Reset all flickering light timers
   *
   * Useful for deterministic playback or testing.
   */
  reset(): void {
    const query = this.world.query().with(Light as any).with(FlickeringLight as any).build();
    const results = this.world.executeQuery(query);

    for (const result of results) {
      const light = this.world.getComponent(result.entity, Light as any) as LightComponentData | undefined;
      const flicker = this.world.getComponent(result.entity, FlickeringLight as any) as any;

      if (!light || !flicker) continue;

      flicker._time = 0;
      light.intensity = flicker.baseIntensity;

      // Write back modified components
      this.world.setComponent(result.entity, Light as any, light as any);
      this.world.setComponent(result.entity, FlickeringLight as any, flicker as any);
    }
  }
}
