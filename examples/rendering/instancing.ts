/**
 * GPU Instancing Example
 *
 * Demonstrates:
 * - Drawing multiple instances with one draw call
 * - Instance-specific data (per-instance transforms/colors)
 * - Performance benefits of instancing vs individual draws
 * - Automatic resource recovery for instanced rendering
 *
 * Renders 10,000 colored cubes in a grid using GPU instancing.
 */

import { WebGPUBackend } from '@miskatonic/rendering';

const INSTANCED_SHADER = `
struct InstanceData {
  @location(2) offset: vec3f,
  @location(3) color: vec3f,
};

@vertex
fn vs_main(
  @location(0) position: vec3f,
  @location(2) offset: vec3f,
  @location(3) color: vec3f,
  @builtin(instance_index) instanceIdx: u32
) -> @builtin(position) vec4f, @location(0) vec3f {
  // Apply instance offset to position
  let worldPos = position * 0.05 + offset;  // Scale down cubes
  return vec4f(worldPos, 1.0), color;
}

@fragment
fn fs_main(@location(0) color: vec3f) -> @location(0) vec4f {
  return vec4f(color, 1.0);
}
`;

function createCubeGeometry(): { vertices: Float32Array; indices: Uint16Array } {
  const vertices = new Float32Array([
    // Front
    -1, -1,  1,
     1, -1,  1,
     1,  1,  1,
    -1,  1,  1,
    // Back
    -1, -1, -1,
    -1,  1, -1,
     1,  1, -1,
     1, -1, -1,
    // Top
    -1,  1, -1,
    -1,  1,  1,
     1,  1,  1,
     1,  1, -1,
    // Bottom
    -1, -1, -1,
     1, -1, -1,
     1, -1,  1,
    -1, -1,  1,
    // Right
     1, -1, -1,
     1,  1, -1,
     1,  1,  1,
     1, -1,  1,
    // Left
    -1, -1, -1,
    -1, -1,  1,
    -1,  1,  1,
    -1,  1, -1,
  ]);

  const indices = new Uint16Array([
    0,  1,  2,   0,  2,  3,
    4,  5,  6,   4,  6,  7,
    8,  9, 10,   8, 10, 11,
   12, 13, 14,  12, 14, 15,
   16, 17, 18,  16, 18, 19,
   20, 21, 22,  20, 22, 23
  ]);

  return { vertices, indices };
}

function generateInstanceData(count: number): Float32Array {
  const gridSize = Math.ceil(Math.cbrt(count));
  const data = new Float32Array(count * 6); // 3 for offset + 3 for color

  let index = 0;
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      for (let z = 0; z < gridSize; z++) {
        if (index >= count) break;

        const offset = index * 6;

        // Position offset (spread out in grid)
        data[offset + 0] = (x - gridSize / 2) * 0.15;
        data[offset + 1] = (y - gridSize / 2) * 0.15;
        data[offset + 2] = (z - gridSize / 2) * 0.15;

        // Color (rainbow based on position)
        data[offset + 3] = x / gridSize;  // R
        data[offset + 4] = y / gridSize;  // G
        data[offset + 5] = z / gridSize;  // B

        index++;
      }
    }
  }

  return data;
}

async function main() {
  const canvas = document.querySelector('canvas');
  if (!canvas) throw new Error('Canvas not found');

  const backend = new WebGPUBackend();
  await backend.initialize({ canvas, powerPreference: 'high-performance' });

  const INSTANCE_COUNT = 10000;
  console.log(`Creating ${INSTANCE_COUNT} instances...`);

  // Create cube geometry
  const { vertices, indices } = createCubeGeometry();
  const vertexBuffer = backend.createBuffer('cube-vertices', 'vertex', vertices, 'static_draw');
  const indexBuffer = backend.createBuffer('cube-indices', 'index', indices, 'static_draw');

  // Create instance data buffer (per-instance transforms and colors)
  const instanceData = generateInstanceData(INSTANCE_COUNT);
  const instanceBuffer = backend.createBuffer('instance-data', 'vertex', instanceData, 'static_draw');

  // Create shader
  const shader = backend.createShader('instanced-shader', { vertex: INSTANCED_SHADER });

  console.log(`✅ Ready to render ${INSTANCE_COUNT} instances with 1 draw call`);

  // Monitor device recovery
  if (backend.recoverySystem) {
    backend.recoverySystem.onRecovery((progress) => {
      if (progress.phase === 'detecting') {
        console.warn(`⚠️ Device lost! Recovering ${progress.totalResources} resources...`);
      } else if (progress.phase === 'complete') {
        console.log(`✅ Recovered! ${progress.resourcesRecreated} resources recreated`);
      }
    });
  }

  let frameCount = 0;
  let lastTime = performance.now();
  let fps = 0;

  function render() {
    backend.beginFrame();

    // Single instanced draw call for all cubes
    backend.executeDrawCommand({
      type: 'indexed',
      indexCount: 36, // 12 triangles per cube
      instanceCount: INSTANCE_COUNT,
      firstIndex: 0,
      baseVertex: 0,
      firstInstance: 0,
      shader,
      indexBuffer,
      indexFormat: 'uint16',
      buffers: [
        { buffer: vertexBuffer, offset: 0 },    // Per-vertex data
        { buffer: instanceBuffer, offset: 0 }   // Per-instance data
      ],
      vertexLayout: {
        arrayStride: 12, // 3 floats * 4 bytes (position only)
        stepMode: 'vertex',
        attributes: [
          { format: 'float32x3', offset: 0, shaderLocation: 0 }  // position
        ]
      },
      topology: 'triangle-list',
      bindGroups: []
    });

    const stats = backend.endFrame();

    // Calculate FPS
    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      fps = frameCount;
      frameCount = 0;
      lastTime = now;

      console.log(`FPS: ${fps}, Frame time: ${stats.cpuTimeMs.toFixed(2)}ms, Triangles: ${stats.triangles.toLocaleString()}`);
    }

    requestAnimationFrame(render);
  }

  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
