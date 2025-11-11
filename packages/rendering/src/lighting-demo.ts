/**
 * Lighting System Demo - Epic 3.15
 *
 * Demonstrates the Light component, LightCollection, and LightSystem.
 *
 * Features:
 * - Directional light (sun)
 * - Point lights (lamps)
 * - Spot light (flashlight)
 * - Ambient light (global illumination)
 * - Dynamic light updates
 * - Transform-based positioning
 *
 * Usage:
 * ```typescript
 * import { createLightingDemo } from '@miskatonic/rendering';
 *
 * const { world, lightSystem, entities } = createLightingDemo();
 *
 * // Update loop
 * function update(deltaTime: number) {
 *   lightSystem.update();
 *   // ... render scene with lights
 * }
 * ```
 */

import { World } from '@miskatonic/ecs';
import { Light, Transform } from '@miskatonic/ecs';
import { LightSystem } from './LightSystem';

export interface LightingDemo {
  world: World;
  lightSystem: LightSystem;
  entities: {
    sun: number;
    pointLight1: number;
    pointLight2: number;
    spotLight: number;
    ambient: number;
  };
}

/**
 * Create a lighting demo scene
 *
 * Sets up a scene with:
 * - Directional light (sun) from above
 * - Two point lights at different positions
 * - Spot light pointing down
 * - Ambient light for global illumination
 */
export function createLightingDemo(): LightingDemo {
  const world = new World();
  const lightSystem = new LightSystem(world);

  // Sun (directional light from above-right)
  const sun = world.createEntity();
  world.addComponent(
    sun,
    Light as any,
    Light.directional(
      [1.0, 1.0, 0.95], // Warm white
      1.0,
      [0.5, -0.7, 0.3] // Direction vector
    )
  );

  // Point light 1 (left side)
  const pointLight1 = world.createEntity();
  world.addComponent(pointLight1, Transform as any, new Transform(-5, 2, 0));
  world.addComponent(
    pointLight1,
    Light as any,
    Light.point(
      [1.0, 0.6, 0.4], // Warm orange
      2.0,
      15.0
    )
  );

  // Point light 2 (right side)
  const pointLight2 = world.createEntity();
  world.addComponent(pointLight2, Transform as any, new Transform(5, 2, 0));
  world.addComponent(
    pointLight2,
    Light as any,
    Light.point(
      [0.4, 0.6, 1.0], // Cool blue
      2.0,
      15.0
    )
  );

  // Spot light (ceiling light pointing down)
  const spotLight = world.createEntity();
  world.addComponent(spotLight, Transform as any, new Transform(0, 8, 0));
  world.addComponent(
    spotLight,
    Light as any,
    Light.spot(
      [1.0, 1.0, 1.0], // White
      3.0,
      [0, -1, 0], // Pointing down
      Math.PI / 3, // 60° cone
      0.2, // Soft edge
      20.0
    )
  );

  // Ambient light (global illumination)
  const ambient = world.createEntity();
  world.addComponent(
    ambient,
    Light as any,
    Light.ambient(
      [0.2, 0.2, 0.25], // Cool ambient
      0.5
    )
  );

  // Initial update to populate LightSystem
  lightSystem.update();

  return {
    world,
    lightSystem,
    entities: {
      sun,
      pointLight1,
      pointLight2,
      spotLight,
      ambient,
    },
  };
}

/**
 * Animate lights in the demo
 *
 * Example animation that moves point lights in a circle
 * and pulses the spot light intensity.
 *
 * @param demo - The lighting demo instance
 * @param time - Current time in seconds
 */
export function animateLightingDemo(demo: LightingDemo, time: number): void {
  const { world, lightSystem, entities } = demo;

  // Orbit point lights
  const radius = 5;
  const speed = 0.5;

  // Point light 1 (counter-clockwise)
  const transform1 = world.getComponent(entities.pointLight1, Transform as any);
  if (transform1) {
    transform1.x = Math.cos(time * speed) * radius;
    transform1.z = Math.sin(time * speed) * radius;
    world.setComponent(entities.pointLight1, Transform as any, transform1);
  }

  // Point light 2 (clockwise, opposite side)
  const transform2 = world.getComponent(entities.pointLight2, Transform as any);
  if (transform2) {
    transform2.x = Math.cos(time * speed + Math.PI) * radius;
    transform2.z = Math.sin(time * speed + Math.PI) * radius;
    world.setComponent(entities.pointLight2, Transform as any, transform2);
  }

  // Pulse spot light intensity
  const spotLight = world.getComponent(entities.spotLight, Light as any);
  if (spotLight) {
    spotLight.intensity = 2.0 + Math.sin(time * 2) * 1.0; // 1.0 to 3.0
    world.setComponent(entities.spotLight, Light as any, spotLight);
  }

  // Update light system with new positions/intensities
  lightSystem.update();
}

/**
 * Get lighting statistics from the demo
 */
export function getLightingStats(demo: LightingDemo): {
  totalLights: number;
  directionalLights: number;
  pointLights: number;
  spotLights: number;
  ambientLights: number;
} {
  const { lightSystem } = demo;

  return {
    totalLights: lightSystem.getLightCount(),
    directionalLights: lightSystem.getDirectionalLights().length,
    pointLights: lightSystem.getPointLights().length,
    spotLights: lightSystem.getSpotLights().length,
    ambientLights: lightSystem.getAmbientLights().length,
  };
}
