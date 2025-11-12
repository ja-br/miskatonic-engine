/**
 * PulsingLightSystem - Epic 3.18 Phase 3
 *
 * Updates Light intensity for entities with PulsingLight component using
 * sine wave for smooth, periodic pulsing effects.
 */

import type { World } from '@miskatonic/ecs';
import { Light, PulsingLight } from '@miskatonic/ecs';
import type { LightComponentData } from '../LightTypes';

/**
 * PulsingLightSystem
 *
 * Updates light intensity based on sine wave for smooth, periodic pulsing.
 * Supports phase offsets for synchronized multi-light pulsing effects.
 *
 * @example
 * ```typescript
 * const system = new PulsingLightSystem(world);
 *
 * // Update every frame
 * function gameLoop(dt: number) {
 *   system.update(dt);
 * }
 * ```
 */
export class PulsingLightSystem {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Update all pulsing lights
   *
   * @param dt - Delta time in seconds
   */
  update(dt: number): void {
    // Query entities with both Light and PulsingLight components
    const query = this.world.query().with(Light as any).with(PulsingLight as any).build();
    const results = this.world.executeQuery(query);

    for (const result of results) {
      const light = this.world.getComponent(result.entity, Light as any) as LightComponentData | undefined;
      const pulse = this.world.getComponent(result.entity, PulsingLight as any) as any;

      if (!light || !pulse) continue;

      // Update time accumulator
      pulse._time += dt;

      // Calculate sine wave with frequency and phase
      // sin(2π × frequency × time + phase)
      const angle = 2.0 * Math.PI * pulse.frequency * pulse._time + pulse.phase;
      const sineValue = Math.sin(angle); // [-1, 1]

      // Apply pulse amount (0 = no pulse, 1 = full range)
      const intensityDelta = sineValue * pulse.pulseAmount;

      // Update light intensity
      light.intensity = pulse.baseIntensity * (1.0 + intensityDelta);

      // Clamp to prevent negative intensity
      if (light.intensity < 0) {
        light.intensity = 0;
      }

      // Write back modified components
      this.world.setComponent(result.entity, Light as any, light as any);
      this.world.setComponent(result.entity, PulsingLight as any, pulse as any);
    }
  }

  /**
   * Reset all pulsing light timers
   *
   * Useful for deterministic playback or testing.
   */
  reset(): void {
    const query = this.world.query().with(Light as any).with(PulsingLight as any).build();
    const results = this.world.executeQuery(query);

    for (const result of results) {
      const light = this.world.getComponent(result.entity, Light as any) as LightComponentData | undefined;
      const pulse = this.world.getComponent(result.entity, PulsingLight as any) as any;

      if (!light || !pulse) continue;

      pulse._time = 0;
      // Reset to phase-adjusted intensity
      const sineValue = Math.sin(pulse.phase);
      light.intensity = pulse.baseIntensity * (1.0 + sineValue * pulse.pulseAmount);

      if (light.intensity < 0) {
        light.intensity = 0;
      }

      // Write back modified components
      this.world.setComponent(result.entity, Light as any, light as any);
      this.world.setComponent(result.entity, PulsingLight as any, pulse as any);
    }
  }
}
