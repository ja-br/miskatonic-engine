import type { Component } from '../types';

/**
 * Light component - PURE DATA SCHEMA (Epic 3.15)
 *
 * This is a data-only component with NO methods.
 * All light operations are performed by LightSystem.
 *
 * Light Types:
 * - 0 = Directional (sun/moon - parallel rays)
 * - 1 = Point (omnidirectional from position)
 * - 2 = Spot (cone from position)
 * - 3 = Ambient (constant global illumination)
 *
 * Memory Layout (varies by type):
 * All types (base): 64 bytes
 * - type: 1 byte (Uint8)
 * - enabled: 1 byte (Uint8)
 * - padding: 2 bytes
 * - color: 12 bytes (3 × Float32: r, g, b)
 * - intensity: 4 bytes (Float32)
 * - direction: 12 bytes (3 × Float32: x, y, z) [directional/spot only]
 * - position: 12 bytes (3 × Float32: x, y, z) [point/spot only]
 * - radius: 4 bytes (Float32) [point/spot only]
 * - spotAngle: 4 bytes (Float32) [spot only]
 * - spotPenumbra: 4 bytes (Float32) [spot only]
 * - castsShadows: 1 byte (Uint8)
 * - shadowBias: 4 bytes (Float32)
 * - padding: 3 bytes
 *
 * Usage:
 * ```typescript
 * // Create directional light (sun)
 * const sun = world.createEntity();
 * world.addComponent(sun, Light, Light.directional(
 *   [1.0, 1.0, 1.0],   // white color
 *   1.0,               // intensity
 *   [0, -1, 0]         // direction (downward)
 * ));
 *
 * // Create point light (lamp)
 * const lamp = world.createEntity();
 * world.addComponent(lamp, Transform, new Transform(5, 2, 0));
 * world.addComponent(lamp, Light, Light.point(
 *   [1.0, 0.8, 0.6],   // warm white
 *   2.0,               // intensity
 *   10.0               // radius
 * ));
 *
 * // Create spot light (flashlight)
 * const flashlight = world.createEntity();
 * world.addComponent(flashlight, Transform, new Transform(0, 5, 0));
 * world.addComponent(flashlight, Light, Light.spot(
 *   [1.0, 1.0, 1.0],   // white
 *   3.0,               // intensity
 *   [0, -1, 0],        // direction
 *   Math.PI / 4,       // 45° cone angle
 *   0.1,               // penumbra softness
 *   15.0               // radius
 * ));
 *
 * // Create ambient light (global illumination)
 * const ambient = world.createEntity();
 * world.addComponent(ambient, Light, Light.ambient(
 *   [0.2, 0.2, 0.25],  // cool ambient
 *   0.5                // intensity
 * ));
 * ```
 */
export class Light implements Component {
  readonly __componentType = 'Light';

  // Light type
  // 0 = directional, 1 = point, 2 = spot, 3 = ambient
  public type: number = 0;

  // Enabled flag (0 = disabled, 1 = enabled)
  public enabled: number = 1;

  // Color (RGB, each component 0-1)
  public colorR: number = 1.0;
  public colorG: number = 1.0;
  public colorB: number = 1.0;

  // Intensity multiplier
  public intensity: number = 1.0;

  // Direction (for directional and spot lights)
  // Normalized direction vector
  public directionX: number = 0.0;
  public directionY: number = -1.0; // Default: pointing down
  public directionZ: number = 0.0;

  // Position (for point and spot lights)
  // Note: For spot lights, position comes from Transform component if attached
  // This is only used for lights without Transform
  public positionX: number = 0.0;
  public positionY: number = 0.0;
  public positionZ: number = 0.0;

  // Radius (for point and spot lights)
  // Distance at which light intensity falls to zero
  public radius: number = 10.0;

  // Spot light specific parameters
  // spotAngle: Full cone angle in radians (not half-angle)
  public spotAngle: number = Math.PI / 4; // 45°
  // spotPenumbra: Softness of the spotlight edge (0 = hard, 1 = very soft)
  public spotPenumbra: number = 0.1;

  // Shadow configuration
  public castsShadows: number = 0; // 0 = no shadows, 1 = cast shadows
  public shadowBias: number = 0.005; // Prevents shadow acne

  /**
   * Constructor for creating new Light instances
   * Default: directional light pointing down
   */
  constructor(
    type: number = 0,
    colorR: number = 1.0,
    colorG: number = 1.0,
    colorB: number = 1.0,
    intensity: number = 1.0
  ) {
    this.type = type;
    this.colorR = colorR;
    this.colorG = colorG;
    this.colorB = colorB;
    this.intensity = intensity;
  }

  /**
   * Create a directional light (sun/moon)
   * Parallel light rays from a direction
   *
   * @param color RGB color [r, g, b] (0-1 range)
   * @param intensity Light intensity multiplier (must be >= 0)
   * @param direction Normalized direction vector [x, y, z]
   * @throws Error if intensity is negative or direction is zero-length
   */
  static directional(
    color: [number, number, number],
    intensity: number,
    direction: [number, number, number] = [0, -1, 0]
  ): Light {
    // Validate intensity
    if (intensity < 0) {
      throw new Error(
        `Light intensity must be non-negative, got ${intensity}`
      );
    }

    const light = new Light(0, color[0], color[1], color[2], intensity);

    // Normalize direction
    const len = Math.sqrt(
      direction[0] * direction[0] +
      direction[1] * direction[1] +
      direction[2] * direction[2]
    );

    if (len === 0) {
      throw new Error(
        'Directional light direction cannot be zero-length vector. ' +
        `Got: [${direction[0]}, ${direction[1]}, ${direction[2]}]`
      );
    }

    light.directionX = direction[0] / len;
    light.directionY = direction[1] / len;
    light.directionZ = direction[2] / len;

    return light;
  }

  /**
   * Create a point light (lamp, bulb)
   * Omnidirectional light from a position
   *
   * @param color RGB color [r, g, b] (0-1 range)
   * @param intensity Light intensity multiplier (must be >= 0)
   * @param radius Maximum distance for light influence (must be > 0)
   * @param position Optional position [x, y, z] (use Transform component instead if possible)
   * @throws Error if intensity is negative or radius is non-positive
   */
  static point(
    color: [number, number, number],
    intensity: number,
    radius: number = 10.0,
    position?: [number, number, number]
  ): Light {
    // Validate parameters
    if (intensity < 0) {
      throw new Error(
        `Light intensity must be non-negative, got ${intensity}`
      );
    }
    if (radius <= 0) {
      throw new Error(
        `Point light radius must be positive, got ${radius}`
      );
    }

    const light = new Light(1, color[0], color[1], color[2], intensity);
    light.radius = radius;

    if (position) {
      light.positionX = position[0];
      light.positionY = position[1];
      light.positionZ = position[2];
    }

    return light;
  }

  /**
   * Create a spot light (flashlight, spotlight)
   * Cone of light from a position in a direction
   *
   * @param color RGB color [r, g, b] (0-1 range)
   * @param intensity Light intensity multiplier (must be >= 0)
   * @param direction Normalized direction vector [x, y, z]
   * @param spotAngle Full cone angle in radians (must be > 0 and <= 2π)
   * @param spotPenumbra Edge softness (0 = hard, 1 = very soft, must be in [0, 1])
   * @param radius Maximum distance for light influence (must be > 0)
   * @param position Optional position [x, y, z] (use Transform component instead if possible)
   * @throws Error if parameters are out of valid ranges
   */
  static spot(
    color: [number, number, number],
    intensity: number,
    direction: [number, number, number],
    spotAngle: number = Math.PI / 4,
    spotPenumbra: number = 0.1,
    radius: number = 10.0,
    position?: [number, number, number]
  ): Light {
    // Validate parameters
    if (intensity < 0) {
      throw new Error(
        `Light intensity must be non-negative, got ${intensity}`
      );
    }
    if (radius <= 0) {
      throw new Error(
        `Spot light radius must be positive, got ${radius}`
      );
    }
    if (spotAngle <= 0 || spotAngle > 2 * Math.PI) {
      throw new Error(
        `Spot angle must be in range (0, 2π], got ${spotAngle}`
      );
    }
    if (spotPenumbra < 0 || spotPenumbra > 1) {
      throw new Error(
        `Spot penumbra must be in range [0, 1], got ${spotPenumbra}`
      );
    }

    const light = new Light(2, color[0], color[1], color[2], intensity);

    // Normalize direction
    const len = Math.sqrt(
      direction[0] * direction[0] +
      direction[1] * direction[1] +
      direction[2] * direction[2]
    );

    if (len === 0) {
      throw new Error(
        'Spot light direction cannot be zero-length vector. ' +
        `Got: [${direction[0]}, ${direction[1]}, ${direction[2]}]`
      );
    }

    light.directionX = direction[0] / len;
    light.directionY = direction[1] / len;
    light.directionZ = direction[2] / len;

    light.spotAngle = spotAngle;
    light.spotPenumbra = spotPenumbra;
    light.radius = radius;

    if (position) {
      light.positionX = position[0];
      light.positionY = position[1];
      light.positionZ = position[2];
    }

    return light;
  }

  /**
   * Create an ambient light (global illumination)
   * Constant light applied to all surfaces
   *
   * @param color RGB color [r, g, b] (0-1 range)
   * @param intensity Light intensity multiplier (must be >= 0)
   * @throws Error if intensity is negative
   */
  static ambient(
    color: [number, number, number],
    intensity: number
  ): Light {
    // Validate intensity
    if (intensity < 0) {
      throw new Error(
        `Light intensity must be non-negative, got ${intensity}`
      );
    }

    return new Light(3, color[0], color[1], color[2], intensity);
  }

  // NOTE: No methods on component - pure data only (ECS principle)
  // Use direct property assignment: light.intensity = 2.0;
}
