/**
 * FlickeringLight component - Epic 3.18 Phase 3
 * PURE DATA SCHEMA (no methods on component instances)
 *
 * Adds flickering intensity variation to lights using Perlin noise.
 * Requires Light component on the same entity.
 */

import { ComponentRegistry } from '../ComponentRegistry';
import type { Component } from '../types';

/**
 * FlickeringLight component
 *
 * Adds realistic flickering to lights using Perlin noise.
 * Commonly used for torches, candles, damaged lights.
 *
 * @example
 * ```typescript
 * const torch = world.createEntity();
 * world.addComponent(torch, Light, Light.point([1.0, 0.5, 0.2], 2.0, 5.0));
 * world.addComponent(torch, FlickeringLight, new FlickeringLight(2.0, 0.3, 4.0));
 * ```
 */
export class FlickeringLight implements Component {
  readonly __componentType = 'FlickeringLight';

  public readonly baseIntensity: number;   // Original light intensity (validated, immutable)
  public readonly flickerAmount: number;   // Flicker strength (0-1, validated, immutable)
  public readonly flickerSpeed: number;    // Flicker frequency in Hz (validated, immutable)
  public readonly randomSeed: number;      // Random seed for deterministic flickering (immutable)
  public _time: number;                    // Internal time accumulator (mutable by system)

  /**
   * Constructor for creating new FlickeringLight instances
   *
   * @param baseIntensity - Original light intensity (must be >= 0)
   * @param flickerAmount - Flicker strength (0-1 range)
   * @param flickerSpeed - Flicker frequency in Hz (default: 4.0)
   * @param randomSeed - Random seed for deterministic flickering (default: random)
   */
  constructor(
    baseIntensity: number = 1.0,
    flickerAmount: number = 0.3,
    flickerSpeed: number = 4.0,
    randomSeed: number = Math.floor(Math.random() * 2147483647)
  ) {
    // Validate baseIntensity
    if (!Number.isFinite(baseIntensity) || baseIntensity < 0) {
      throw new Error(
        `FlickeringLight.baseIntensity must be finite and non-negative, got ${baseIntensity}`
      );
    }

    // Validate flickerAmount (0-1 range)
    if (
      !Number.isFinite(flickerAmount) ||
      flickerAmount < 0 ||
      flickerAmount > 1
    ) {
      throw new Error(
        `FlickeringLight.flickerAmount must be in [0, 1] range, got ${flickerAmount}`
      );
    }

    // Validate flickerSpeed
    if (!Number.isFinite(flickerSpeed) || flickerSpeed <= 0) {
      throw new Error(
        `FlickeringLight.flickerSpeed must be finite and positive, got ${flickerSpeed}`
      );
    }

    // Validate randomSeed
    if (!Number.isFinite(randomSeed)) {
      throw new Error(
        `FlickeringLight.randomSeed must be finite, got ${randomSeed}`
      );
    }

    this.baseIntensity = baseIntensity;
    this.flickerAmount = flickerAmount;
    this.flickerSpeed = flickerSpeed;
    this.randomSeed = randomSeed;
    this._time = 0;
  }
}

/**
 * Helper type for FlickeringLight data retrieved from ComponentStorage
 */
export type FlickeringLightData = {
  baseIntensity: number;
  flickerAmount: number;
  flickerSpeed: number;
  randomSeed: number;
  _time: number;
};

// Register component with ECS (auto-register will introspect fields)
ComponentRegistry.autoRegister(FlickeringLight);
