/**
 * OrbitingLight component - Epic 3.18 Phase 3
 * PURE DATA SCHEMA (no methods on component instances)
 *
 * Moves lights in circular orbits around a center point (celestial bodies,
 * patrol lights, rotating stage lights, searchlights).
 * Requires Transform component on the same entity.
 */

import { ComponentRegistry } from '../ComponentRegistry';
import type { Component } from '../types';

/**
 * OrbitingLight component
 *
 * Moves light in circular motion around a center point by updating Transform position.
 * Useful for rotating stage lights, orbiting celestial bodies, patrol searchlights, etc.
 *
 * Note: Requires entity to have a Transform component.
 *
 * @example
 * ```typescript
 * const searchlight = world.createEntity();
 * world.addComponent(searchlight, Transform, new Transform(10, 5, 0));
 * world.addComponent(searchlight, Light, Light.spot([1, 1, 1], 10.0, [0, -1, 0], Math.PI/4));
 * world.addComponent(searchlight, OrbitingLight, new OrbitingLight(
 *   [0, 5, 0],    // center
 *   10,           // radius
 *   0.5,          // speed
 *   0,            // startAngle
 *   [0, 1, 0],    // axis
 *   true          // faceCenter
 * ));
 * ```
 */
export class OrbitingLight implements Component {
  readonly __componentType = 'OrbitingLight';

  public readonly centerX: number;         // Center point X coordinate (validated, immutable)
  public readonly centerY: number;         // Center point Y coordinate (validated, immutable)
  public readonly centerZ: number;         // Center point Z coordinate (validated, immutable)
  public readonly radius: number;          // Orbit radius in world units (validated, immutable)
  public readonly speed: number;           // Orbit speed in radians per second (validated, immutable)
  public currentAngle: number;             // Current angle in radians (mutable by system)
  public readonly axisX: number;           // Orbit axis X, normalized (validated, immutable)
  public readonly axisY: number;           // Orbit axis Y, normalized (validated, immutable)
  public readonly axisZ: number;           // Orbit axis Z, normalized (validated, immutable)
  public readonly faceCenter: number;      // Update spot direction to face center (0 or 1, immutable)

  /**
   * Constructor for creating new OrbitingLight instances
   *
   * @param center - Center point of orbit [x, y, z]
   * @param radius - Orbit radius in world units
   * @param speed - Orbit speed in radians per second
   * @param startAngle - Starting angle in radians (default: 0)
   * @param axis - Orbit axis (default: [0, 1, 0] for horizontal orbit)
   * @param faceCenter - Update spot direction to face center (default: false)
   */
  constructor(
    center: [number, number, number] = [0, 0, 0],
    radius: number = 10.0,
    speed: number = 1.0,
    startAngle: number = 0,
    axis: [number, number, number] = [0, 1, 0],
    faceCenter: boolean = false
  ) {
    // Validate center
    if (
      !center ||
      center.length !== 3 ||
      !center.every(Number.isFinite)
    ) {
      throw new Error(
        `OrbitingLight.center must be [x, y, z] with finite values`
      );
    }

    // Validate radius
    if (!Number.isFinite(radius) || radius <= 0) {
      throw new Error(
        `OrbitingLight.radius must be finite and positive, got ${radius}`
      );
    }

    // Validate speed
    if (!Number.isFinite(speed)) {
      throw new Error(
        `OrbitingLight.speed must be finite, got ${speed}`
      );
    }

    // Validate startAngle
    if (!Number.isFinite(startAngle)) {
      throw new Error(
        `OrbitingLight.startAngle must be finite, got ${startAngle}`
      );
    }

    // Validate and normalize axis
    if (!axis || axis.length !== 3 || !axis.every(Number.isFinite)) {
      throw new Error(
        `OrbitingLight.axis must be [x, y, z] with finite values`
      );
    }

    // Check for zero-length axis
    const axisLength = Math.sqrt(
      axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]
    );
    if (axisLength < 1e-6) {
      throw new Error(
        `OrbitingLight.axis must have non-zero length`
      );
    }

    // Normalize axis
    const normalizedAxis: [number, number, number] = [
      axis[0] / axisLength,
      axis[1] / axisLength,
      axis[2] / axisLength,
    ];

    this.centerX = center[0];
    this.centerY = center[1];
    this.centerZ = center[2];
    this.radius = radius;
    this.speed = speed;
    this.currentAngle = startAngle;
    this.axisX = normalizedAxis[0];
    this.axisY = normalizedAxis[1];
    this.axisZ = normalizedAxis[2];
    this.faceCenter = faceCenter ? 1 : 0;
  }
}

/**
 * Helper type for OrbitingLight data retrieved from ComponentStorage
 */
export type OrbitingLightData = {
  centerX: number;
  centerY: number;
  centerZ: number;
  radius: number;
  speed: number;
  currentAngle: number;
  axisX: number;
  axisY: number;
  axisZ: number;
  faceCenter: number;
};

// Register component with ECS (auto-register will introspect fields)
ComponentRegistry.autoRegister(OrbitingLight);
