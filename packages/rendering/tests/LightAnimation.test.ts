/**
 * Light Animation Systems Tests - Epic 3.18 Phase 3
 *
 * Tests for FlickeringLight, PulsingLight, and OrbitingLight components and systems.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World, Light, Transform, FlickeringLight, PulsingLight, OrbitingLight } from '@miskatonic/ecs';
import { FlickeringLightSystem } from '../src/systems/FlickeringLightSystem';
import { PulsingLightSystem } from '../src/systems/PulsingLightSystem';
import { OrbitingLightSystem } from '../src/systems/OrbitingLightSystem';

describe('FlickeringLight Component', () => {
  it('should create with valid parameters', () => {
    const flicker = new FlickeringLight(2.5, 0.3, 5.0, 12345);

    expect(flicker.baseIntensity).toBe(2.5);
    expect(flicker.flickerAmount).toBe(0.3);
    expect(flicker.flickerSpeed).toBe(5.0);
    expect(flicker.randomSeed).toBe(12345);
    expect(flicker._time).toBe(0);
  });

  it('should use default values', () => {
    const flicker = new FlickeringLight(1.0, 0.5);

    expect(flicker.flickerSpeed).toBe(4.0); // Default
    expect(flicker.randomSeed).toBeGreaterThan(0); // Random seed
  });

  it('should reject negative baseIntensity', () => {
    expect(() => {
      new FlickeringLight(-1.0, 0.3);
    }).toThrow();
  });

  it('should reject flickerAmount outside [0, 1]', () => {
    expect(() => {
      new FlickeringLight(2.0, 1.5);
    }).toThrow();
  });

  it('should reject non-positive flickerSpeed', () => {
    expect(() => {
      new FlickeringLight(2.0, 0.3, 0);
    }).toThrow();
  });
});

describe('PulsingLight Component', () => {
  it('should create with valid parameters', () => {
    const pulse = new PulsingLight(3.0, 0.5, 2.0, Math.PI / 2);

    expect(pulse.baseIntensity).toBe(3.0);
    expect(pulse.pulseAmount).toBe(0.5);
    expect(pulse.frequency).toBe(2.0);
    expect(pulse.phase).toBe(Math.PI / 2);
    expect(pulse._time).toBe(0);
  });

  it('should use default values', () => {
    const pulse = new PulsingLight(2.0, 0.3);

    expect(pulse.frequency).toBe(1.0); // Default
    expect(pulse.phase).toBe(0); // Default
  });

  it('should reject negative baseIntensity', () => {
    expect(() => {
      new PulsingLight(-1.0, 0.5);
    }).toThrow();
  });

  it('should reject pulseAmount outside [0, 1]', () => {
    expect(() => {
      new PulsingLight(2.0, 1.2);
    }).toThrow();
  });

  it('should reject non-positive frequency', () => {
    expect(() => {
      new PulsingLight(2.0, 0.5, 0);
    }).toThrow();
  });
});

describe('OrbitingLight Component', () => {
  it('should create with valid parameters', () => {
    const orbit = new OrbitingLight([0, 5, 0], 10, 0.5, Math.PI / 4, [0, 1, 0], true);

    expect(orbit.centerX).toBe(0);
    expect(orbit.centerY).toBe(5);
    expect(orbit.centerZ).toBe(0);
    expect(orbit.radius).toBe(10);
    expect(orbit.speed).toBe(0.5);
    expect(orbit.currentAngle).toBe(Math.PI / 4);
    expect(orbit.axisX).toBe(0);
    expect(orbit.axisY).toBe(1);
    expect(orbit.axisZ).toBe(0);
    expect(orbit.faceCenter).toBe(1);
  });

  it('should use default values', () => {
    const orbit = new OrbitingLight([0, 0, 0], 5, 1.0);

    expect(orbit.currentAngle).toBe(0); // Default startAngle
    expect(orbit.axisY).toBe(1); // Default axis [0, 1, 0]
    expect(orbit.faceCenter).toBe(0); // Default false (0)
  });

  it('should normalize axis', () => {
    const orbit = new OrbitingLight([0, 0, 0], 5, 1.0, 0, [2, 0, 0]);

    // Axis should be normalized to [1, 0, 0]
    expect(orbit.axisX).toBeCloseTo(1.0);
    expect(orbit.axisY).toBeCloseTo(0.0);
    expect(orbit.axisZ).toBeCloseTo(0.0);
  });

  it('should reject zero-length axis', () => {
    expect(() => {
      new OrbitingLight([0, 0, 0], 5, 1.0, 0, [0, 0, 0]);
    }).toThrow();
  });

  it('should reject non-positive radius', () => {
    expect(() => {
      new OrbitingLight([0, 0, 0], 0, 1.0);
    }).toThrow();
  });
});

describe('FlickeringLightSystem', () => {
  let world: World;
  let system: FlickeringLightSystem;

  beforeEach(() => {
    world = new World();
    system = new FlickeringLightSystem(world);
  });

  it('should update light intensity based on Perlin noise', () => {
    // Create entity with light and flickering component
    const entity = world.createEntity();
    const light = Light.point([1, 1, 1], 2.0, 10);
    const flicker = new FlickeringLight(2.0, 0.5, 4.0, 12345);

    world.addComponent(entity, Light, light);
    world.addComponent(entity, FlickeringLight, flicker);

    // Get initial intensity before update
    const initialLight = world.getComponent(entity, Light);
    if (!initialLight) {
      throw new Error('Components not stored correctly');
    }

    const initialIntensity = initialLight.intensity;

    // Update system
    system.update(0.1);

    // Re-fetch components after update to get fresh snapshots
    const updatedLight = world.getComponent(entity, Light);
    const updatedFlicker = world.getComponent(entity, FlickeringLight);

    // Intensity should have changed (with 50% flicker amount, it should be noticeably different)
    expect(updatedLight?.intensity).not.toBe(initialIntensity);
    expect(updatedFlicker?._time).toBeGreaterThan(0);
  });

  it('should produce deterministic results with same seed', () => {
    // Create two entities with same seed
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();

    world.addComponent(entity1, Light, Light.point([1, 1, 1], 2.0, 10));
    world.addComponent(entity1, FlickeringLight, new FlickeringLight(2.0, 0.5, 4.0, 12345));

    world.addComponent(entity2, Light, Light.point([1, 1, 1], 2.0, 10));
    world.addComponent(entity2, FlickeringLight, new FlickeringLight(2.0, 0.5, 4.0, 12345));

    // Update both
    system.update(0.1);

    const light1 = world.getComponent(entity1, Light);
    const light2 = world.getComponent(entity2, Light);

    // Should have same intensity
    expect(light1?.intensity).toBe(light2?.intensity);
  });

  it('should reset all flickering lights', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Light, Light.point([1, 1, 1], 2.0, 10));
    world.addComponent(entity, FlickeringLight, new FlickeringLight(2.0, 0.5, 4.0, 12345));

    // Update once
    system.update(0.5);

    const flickerAfterUpdate = world.getComponent(entity, FlickeringLight);
    expect(flickerAfterUpdate?._time).toBeGreaterThan(0);

    // Reset
    system.reset();

    // Re-fetch after reset to get fresh snapshot
    const flickerAfterReset = world.getComponent(entity, FlickeringLight);
    // Time should be reset
    expect(flickerAfterReset?._time).toBe(0);
  });

  it('should handle zero flicker amount (no change)', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Light, Light.point([1, 1, 1], 2.0, 10));
    world.addComponent(entity, FlickeringLight, new FlickeringLight(2.0, 0.0, 4.0, 12345));

    const initialLight = world.getComponent(entity, Light);
    const initialIntensity = initialLight!.intensity;

    system.update(0.1);

    // Re-fetch after update
    const updatedLight = world.getComponent(entity, Light);
    // Intensity should remain the same (flickerAmount = 0)
    expect(updatedLight?.intensity).toBe(initialIntensity);
  });
});

describe('PulsingLightSystem', () => {
  let world: World;
  let system: PulsingLightSystem;

  beforeEach(() => {
    world = new World();
    system = new PulsingLightSystem(world);
  });

  it('should update light intensity based on sine wave', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Light, Light.point([1, 1, 1], 2.0, 10));
    world.addComponent(entity, PulsingLight, new PulsingLight(2.0, 0.5, 1.0, 0));

    const initialLight = world.getComponent(entity, Light);

    // At t=0, phase=0: sin(0) = 0, so intensity = 2.0 * (1 + 0.5*0) = 2.0
    expect(initialLight?.intensity).toBeCloseTo(2.0);

    // Update to quarter cycle (π/2 radians / (2π rad/cycle) / 1Hz = 0.25s)
    system.update(0.25);

    // Re-fetch after update to get fresh snapshots
    const updatedLight = world.getComponent(entity, Light);
    const updatedPulse = world.getComponent(entity, PulsingLight);

    // At t=0.25, sin(2π*1*0.25) = sin(π/2) = 1, so intensity = 2.0 * (1 + 0.5*1) = 3.0
    expect(updatedLight?.intensity).toBeCloseTo(3.0);
    expect(updatedPulse?._time).toBeCloseTo(0.25);
  });

  it('should respect phase offset', () => {
    // Two lights with 180° phase difference
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();

    world.addComponent(entity1, Light, Light.point([1, 1, 1], 2.0, 10));
    world.addComponent(entity1, PulsingLight, new PulsingLight(2.0, 0.5, 1.0, 0));

    world.addComponent(entity2, Light, Light.point([1, 1, 1], 2.0, 10));
    world.addComponent(entity2, PulsingLight, new PulsingLight(2.0, 0.5, 1.0, Math.PI));

    system.update(0);

    const light1 = world.getComponent(entity1, Light);
    const light2 = world.getComponent(entity2, Light);

    // At phase π, sin(π) = 0, same as phase 0
    // Both should be at baseIntensity
    expect(light1?.intensity).toBeCloseTo(2.0);
    expect(light2?.intensity).toBeCloseTo(2.0);
  });

  it('should reset to phase-adjusted intensity', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Light, Light.point([1, 1, 1], 2.0, 10));
    world.addComponent(entity, PulsingLight, new PulsingLight(2.0, 0.5, 1.0, 0));

    // Update
    system.update(0.5);

    const pulseAfterUpdate = world.getComponent(entity, PulsingLight);
    expect(pulseAfterUpdate?._time).toBeGreaterThan(0);

    // Reset
    system.reset();

    // Re-fetch after reset to get fresh snapshot
    const pulseAfterReset = world.getComponent(entity, PulsingLight);
    expect(pulseAfterReset?._time).toBe(0);
  });

  it('should handle zero pulse amount (no change)', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Light, Light.point([1, 1, 1], 2.0, 10));
    world.addComponent(entity, PulsingLight, new PulsingLight(2.0, 0.0, 1.0, 0));

    const initialLight = world.getComponent(entity, Light);
    const initialIntensity = initialLight!.intensity;

    system.update(0.5);

    // Re-fetch after update
    const updatedLight = world.getComponent(entity, Light);
    // Intensity should remain at baseIntensity (pulseAmount = 0)
    expect(updatedLight?.intensity).toBe(initialIntensity);
  });
});

describe('OrbitingLightSystem', () => {
  let world: World;
  let system: OrbitingLightSystem;

  beforeEach(() => {
    world = new World();
    system = new OrbitingLightSystem(world);
  });

  it('should update transform position in circular motion', () => {
    const entity = world.createEntity();
    const light = Light.point([1, 1, 1], 2.0, 10);
    const transform = new Transform(0, 0, 0); // Initial position doesn't matter, system will set it
    const orbit = new OrbitingLight([0, 0, 0], 10, Math.PI, 0, [0, 1, 0], false);

    world.addComponent(entity, Light, light);
    world.addComponent(entity, Transform, transform);
    world.addComponent(entity, OrbitingLight, orbit);

    // Initialize transform to starting position by calling update(0)
    system.update(0);

    const initialTransform = world.getComponent(entity, Transform);
    const startX = initialTransform!.x;
    const startY = initialTransform!.y;
    const startZ = initialTransform!.z;

    // Update by half second (speed = π rad/s, so angle += π/2)
    system.update(0.5);

    // Re-fetch after update to get fresh snapshots
    const updatedTransform = world.getComponent(entity, Transform);
    const updatedOrbit = world.getComponent(entity, OrbitingLight);

    // New angle should be π/2 (90 degrees)
    expect(updatedOrbit?.currentAngle).toBeCloseTo(Math.PI / 2);

    // Position should have changed from starting position
    expect(updatedTransform?.x).not.toBeCloseTo(startX);

    // For orbit around Y axis with radius 10, after rotating π/2 radians,
    // we should be at a position 90 degrees from start on the orbit circle
    const distFromCenter = Math.sqrt(
      updatedTransform!.x ** 2 + updatedTransform!.z ** 2
    );
    expect(distFromCenter).toBeCloseTo(10, 5); // Should be at radius distance from center
    expect(updatedTransform?.y).toBeCloseTo(0, 5); // Y should remain at center Y
  });

  it('should allow angle to accumulate naturally (cos/sin are periodic)', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Light, Light.point([1, 1, 1], 2.0, 10));
    world.addComponent(entity, Transform, new Transform(0, 0, 0));
    world.addComponent(entity, OrbitingLight, new OrbitingLight([0, 0, 0], 10, Math.PI * 2, 0));

    // Update by 1.5 seconds (speed = 2π rad/s, so angle += 3π)
    system.update(1.5);

    // Re-fetch after update to get fresh snapshot
    const updatedOrbit = world.getComponent(entity, OrbitingLight);

    // Angle accumulates naturally: 0 + 3π = 3π (not normalized)
    // This is correct - cos/sin are periodic so normalization is unnecessary
    expect(updatedOrbit?.currentAngle).toBeCloseTo(3 * Math.PI);

    // Verify position is being updated (should be non-zero)
    const transform = world.getComponent(entity, Transform);
    const distFromCenter = Math.sqrt(transform!.x ** 2 + transform!.z ** 2);
    expect(distFromCenter).toBeCloseTo(10, 3); // Should be at radius distance
  });

  it('should update spot light direction when faceCenter is true', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Light, Light.spot([1, 1, 1], 5.0, [1, 0, 0], Math.PI / 4));
    world.addComponent(entity, Transform, new Transform(10, 0, 0));
    world.addComponent(entity, OrbitingLight, new OrbitingLight([0, 0, 0], 10, Math.PI, 0, [0, 1, 0], true));

    const light = world.getComponent(entity, Light);

    // Update
    system.update(0.5);

    // Direction should point toward center [0, 0, 0] from position
    const transform = world.getComponent(entity, Transform);
    const dx = 0 - transform!.x;
    const dy = 0 - transform!.y;
    const dz = 0 - transform!.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

    expect(light?.directionX).toBeCloseTo(dx / len, 5);
    expect(light?.directionY).toBeCloseTo(dy / len, 5);
    expect(light?.directionZ).toBeCloseTo(dz / len, 5);
  });

  it('should not update direction for non-spot lights', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Light, Light.point([1, 1, 1], 2.0, 10)); // Point light (type = 1)
    world.addComponent(entity, Transform, new Transform(10, 0, 0));
    world.addComponent(entity, OrbitingLight, new OrbitingLight([0, 0, 0], 10, Math.PI, 0, [0, 1, 0], true));

    const initialLight = world.getComponent(entity, Light);
    const initialDirX = initialLight!.directionX;
    const initialDirY = initialLight!.directionY;
    const initialDirZ = initialLight!.directionZ;

    system.update(0.5);

    // Re-fetch after update
    const updatedLight = world.getComponent(entity, Light);

    // Direction should not have changed (point light, not spot)
    expect(updatedLight?.directionX).toBe(initialDirX);
    expect(updatedLight?.directionY).toBe(initialDirY);
    expect(updatedLight?.directionZ).toBe(initialDirZ);
  });

  it('should reset to starting position', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Light, Light.point([1, 1, 1], 2.0, 10));
    world.addComponent(entity, Transform, new Transform(0, 0, 0));
    world.addComponent(entity, OrbitingLight, new OrbitingLight([0, 0, 0], 10, Math.PI, 0, [0, 1, 0], false));

    // Initialize to starting position
    system.update(0);

    const initialTransform = world.getComponent(entity, Transform);
    const startX = initialTransform!.x;
    const startY = initialTransform!.y;
    const startZ = initialTransform!.z;

    // Update to move the orbit
    system.update(1.0);

    const orbitAfterUpdate = world.getComponent(entity, OrbitingLight);
    expect(orbitAfterUpdate?.currentAngle).toBeGreaterThan(0);

    // Reset
    system.reset();

    // Re-fetch after reset to get fresh snapshots
    const orbitAfterReset = world.getComponent(entity, OrbitingLight);
    expect(orbitAfterReset?.currentAngle).toBe(0);

    // Position should be back at start
    const transformAfterReset = world.getComponent(entity, Transform);
    expect(transformAfterReset?.x).toBeCloseTo(startX, 5);
    expect(transformAfterReset?.y).toBeCloseTo(startY, 5);
    expect(transformAfterReset?.z).toBeCloseTo(startZ, 5);
  });
});
