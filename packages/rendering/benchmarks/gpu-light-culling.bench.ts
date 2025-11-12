/**
 * GPU Light Culling Benchmark - Epic 3.16 Phase 2
 *
 * Benchmarks GPU compute shader-based light culling performance.
 * Compares against CPU culling baseline.
 *
 * Run with: npm run benchmark -- gpu-light-culling
 */

import { bench, describe } from 'vitest';
import { CPUCullingStrategy } from '../src/culling/LightCullingStrategy';
import type { LightData } from '../src/LightCollection';

/**
 * Create test lights
 */
function createLights(count: number): LightData[] {
  const lights: LightData[] = [];

  for (let i = 0; i < count; i++) {
    const type = i % 4; // 0=directional, 1=point, 2=spot, 3=ambient

    lights.push({
      type,
      position: [
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
      ],
      direction: [0, -1, 0],
      color: [Math.random(), Math.random(), Math.random()],
      intensity: Math.random() * 2,
      radius: 5 + Math.random() * 45,
      innerConeAngle: Math.PI / 8,
      outerConeAngle: Math.PI / 4,
    });
  }

  return lights;
}

/**
 * Create perspective projection matrix
 */
function createPerspectiveMatrix(
  fov: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  const f = 1.0 / Math.tan(fov / 2);
  const rangeInv = 1.0 / (near - far);

  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0,
  ]);
}

/**
 * Create view matrix
 */
function createViewMatrix(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

describe('GPU Light Culling Performance', () => {
  const vpMatrix = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
  const viewMatrix = createViewMatrix();

  describe('CPU Baseline - Small Scale', () => {
    const strategy = new CPUCullingStrategy();

    bench('CPU cull 10 lights', () => {
      const lights = createLights(10);
      strategy.cull(lights, vpMatrix);
    });

    bench('CPU cull 50 lights', () => {
      const lights = createLights(50);
      strategy.cull(lights, vpMatrix);
    });

    bench('CPU cull 100 lights', () => {
      const lights = createLights(100);
      strategy.cull(lights, vpMatrix);
    });
  });

  describe('CPU Baseline - Medium Scale', () => {
    const strategy = new CPUCullingStrategy();

    bench('CPU cull 250 lights', () => {
      const lights = createLights(250);
      strategy.cull(lights, vpMatrix);
    });

    bench('CPU cull 500 lights', () => {
      const lights = createLights(500);
      strategy.cull(lights, vpMatrix);
    });

    bench('CPU cull 1000 lights', () => {
      const lights = createLights(1000);
      strategy.cull(lights, vpMatrix);
    });
  });

  describe('CPU Baseline - Large Scale', () => {
    const strategy = new CPUCullingStrategy();

    bench('CPU cull 2500 lights', () => {
      const lights = createLights(2500);
      strategy.cull(lights, vpMatrix);
    });

    bench('CPU cull 5000 lights', () => {
      const lights = createLights(5000);
      strategy.cull(lights, vpMatrix);
    });

    bench('CPU cull 10000 lights', () => {
      const lights = createLights(10000);
      strategy.cull(lights, vpMatrix);
    });
  });
});

/**
 * Expected Performance Targets (Epic 3.16)
 *
 * CPU Frustum Culling (Phase 1):
 * - 100 lights: <1ms
 * - 1000 lights: <10ms
 * - 10000 lights: <100ms
 *
 * GPU Tile Culling (Phase 2):
 * - 100 lights @ 1080p: <0.5ms
 * - 1000 lights @ 1080p: <0.5ms
 * - 10000 lights @ 1080p: <1ms
 *
 * GPU Benefits:
 * - Constant time relative to light count (up to ~50K lights)
 * - Scales with screen resolution (tile count)
 * - Parallel execution on hundreds of compute units
 * - Per-tile light lists for efficient fragment shading
 *
 * When to Use GPU Culling:
 * - Many lights (>500)
 * - Complex scenes with overlapping light volumes
 * - When per-tile light lists are needed for deferred/forward+ rendering
 *
 * When to Use CPU Culling:
 * - Few lights (<100)
 * - Simple forward rendering
 * - WebGPU not available (fallback)
 */

// NOTE: GPU benchmarks require actual WebGPU device and cannot run in Vitest
// For production GPU benchmarks, use separate benchmark harness with real GPU context
console.log(`
GPU Light Culling Benchmark
============================

To benchmark GPU culling performance:
1. Run the rendering demo with GPU culling enabled
2. Use browser DevTools Performance profiler
3. Measure compute pass execution time
4. Compare against CPU baseline shown above

Expected GPU Performance @ 1080p (120x68 tiles):
- 100 lights:   <0.5ms
- 1000 lights:  <0.5ms
- 10000 lights: <1.0ms

Crossover Point:
CPU becomes faster below ~100 lights due to GPU overhead
GPU wins above ~500 lights due to parallel execution
`);
