/**
 * PulsingLight component - Epic 3.18 Phase 3
 * PURE DATA SCHEMA (no methods on component instances)
 *
 * Adds smooth sine-wave intensity variation to lights for pulsing effects
 * (magic orbs, indicators, heartbeats, alarms).
 */

import { ComponentRegistry } from '../ComponentRegistry';
import type { Component } from '../types';

/**
 * PulsingLight component
 *
 * Adds smooth sine-wave intensity variation to lights.
 * Useful for magic effects, warning lights, indicators, heartbeat effects, etc.
 *
 * @example
 * ```typescript
 * const orb = world.createEntity();
 * world.addComponent(orb, Light, Light.point([0.5, 0.5, 1.0], 2.0, 8.0));
 * world.addComponent(orb, PulsingLight, new PulsingLight(2.0, 0.5, 1.0, 0));
 * ```
 */
export class PulsingLight implements Component {
  readonly __componentType = 'PulsingLight';

  public readonly baseIntensity: number;   // Original light intensity (validated, immutable)
  public readonly pulseAmount: number;     // Pulse amplitude (0-1, validated, immutable)
  public readonly frequency: number;       // Pulse frequency in Hz (validated, immutable)
  public readonly phase: number;           // Phase offset in radians (validated, immutable)
  public _time: number;                    // Internal time accumulator (mutable by system)

  /**
   * Constructor for creating new PulsingLight instances
   *
   * @param baseIntensity - Original light intensity (must be >= 0)
   * @param pulseAmount - Pulse amplitude (0-1 range)
   * @param frequency - Pulse frequency in Hz (default: 1.0)
   * @param phase - Phase offset in radians (default: 0)
   */
  constructor(
    baseIntensity: number = 1.0,
    pulseAmount: number = 0.5,
    frequency: number = 1.0,
    phase: number = 0
  ) {
    // Validate baseIntensity
    if (!Number.isFinite(baseIntensity) || baseIntensity < 0) {
      throw new Error(
        `PulsingLight.baseIntensity must be finite and non-negative, got ${baseIntensity}`
      );
    }

    // Validate pulseAmount (0-1 range)
    if (
      !Number.isFinite(pulseAmount) ||
      pulseAmount < 0 ||
      pulseAmount > 1
    ) {
      throw new Error(
        `PulsingLight.pulseAmount must be in [0, 1] range, got ${pulseAmount}`
      );
    }

    // Validate frequency
    if (!Number.isFinite(frequency) || frequency <= 0) {
      throw new Error(
        `PulsingLight.frequency must be finite and positive, got ${frequency}`
      );
    }

    // Validate phase
    if (!Number.isFinite(phase)) {
      throw new Error(
        `PulsingLight.phase must be finite, got ${phase}`
      );
    }

    this.baseIntensity = baseIntensity;
    this.pulseAmount = pulseAmount;
    this.frequency = frequency;
    this.phase = phase;
    this._time = 0;
  }
}

/**
 * Helper type for PulsingLight data retrieved from ComponentStorage
 */
export type PulsingLightData = {
  baseIntensity: number;
  pulseAmount: number;
  frequency: number;
  phase: number;
  _time: number;
};

// Register component with ECS (auto-register will introspect fields)
ComponentRegistry.autoRegister(PulsingLight);
