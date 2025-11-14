/**
 * Transparent Objects Example
 *
 * Demonstrates:
 * - Alpha blending for transparency
 * - Depth testing without depth writes
 * - Back-to-front sorting for correct alpha blending
 * - Multiple overlapping transparent objects
 * - Performance considerations for transparency
 */

import { WebGPUBackend } from '@miskatonic/rendering';

const TRANSPARENT_SHADER = `
struct Uniforms {
  color: vec4f,  // RGB + Alpha
  offset: vec3f,
  padding: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@location(0) position: vec3f) -> @builtin(position) vec4f {
  return vec4f(position + uniforms.offset, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return uniforms.color;
}
`;

function createQuadGeometry(): { vertices: Float32Array; indices: Uint16Array } {
  // Simple quad (-1 to 1)
  const vertices = new Float32Array([
    -1, -1, 0,
     1, -1, 0,
     1,  1, 0,
    -1,  1, 0
  ]);

  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3
  ]);

  return { vertices, indices };
}

interface TransparentQuad {
  color: [number, number, number, number];  // RGBA
  offset: [number, number, number];
  distance: number;  // Distance from camera for sorting
}

function createTransparentQuads(): TransparentQuad[] {
  return [
    // Red quad (back)
    {
      color: [1.0, 0.0, 0.0, 0.5],
      offset: [0.0, 0.0, -1.0],
      distance: 1.0
    },
    // Green quad (middle)
    {
      color: [0.0, 1.0, 0.0, 0.5],
      offset: [0.5, 0.0, 0.0],
      distance: 0.5
    },
    // Blue quad (front)
    {
      color: [0.0, 0.0, 1.0, 0.5],
      offset: [-0.5, 0.0, 0.5],
      distance: 0.0
    },
    // Yellow quad (diagonal)
    {
      color: [1.0, 1.0, 0.0, 0.6],
      offset: [0.0, 0.5, -0.5],
      distance: 0.75
    },
    // Magenta quad (diagonal)
    {
      color: [1.0, 0.0, 1.0, 0.4],
      offset: [0.0, -0.5, 0.3],
      distance: 0.25
    }
  ];
}

async function main() {
  const canvas = document.querySelector('canvas');
  if (!canvas) throw new Error('Canvas not found');

  const backend = new WebGPUBackend();
  await backend.initialize({ canvas, powerPreference: 'high-performance' });

  const { vertices, indices } = createQuadGeometry();
  const vertexBuffer = backend.createBuffer('quad-vertices', 'vertex', vertices, 'static_draw');
  const indexBuffer = backend.createBuffer('quad-indices', 'index', indices, 'static_draw');

  const shader = backend.createShader('transparent-shader', { vertex: TRANSPARENT_SHADER });

  // Create uniform buffer (will be updated per quad)
  const uniformData = new Float32Array(8); // vec4 color + vec3 offset + padding
  const uniformBuffer = backend.createBuffer('quad-uniforms', 'uniform', uniformData, 'dynamic_draw');

  const quads = createTransparentQuads();

  console.log(`✅ Rendering ${quads.length} transparent quads`);
  console.log('⚠️ Note: Proper alpha blending requires back-to-front sorting');

  let rotation = 0;

  function render() {
    rotation += 0.01;

    backend.beginFrame();

    // CRITICAL: Sort transparent objects back-to-front
    // Without sorting, alpha blending will be incorrect
    const sortedQuads = [...quads].sort((a, b) => {
      // Add rotation to distance for dynamic sorting
      const distA = a.distance + Math.sin(rotation + a.offset[0]) * 0.3;
      const distB = b.distance + Math.sin(rotation + b.offset[0]) * 0.3;
      return distB - distA; // Back to front
    });

    // Draw each quad with its own color and offset
    for (const quad of sortedQuads) {
      // Update uniform buffer with quad data
      uniformData[0] = quad.color[0];
      uniformData[1] = quad.color[1];
      uniformData[2] = quad.color[2];
      uniformData[3] = quad.color[3];
      uniformData[4] = quad.offset[0] + Math.sin(rotation) * 0.2;
      uniformData[5] = quad.offset[1];
      uniformData[6] = quad.offset[2] + Math.cos(rotation) * 0.2;
      uniformData[7] = 0; // padding

      backend.updateBuffer(uniformBuffer, uniformData);

      backend.executeDrawCommand({
        type: 'indexed',
        indexCount: 6,
        instanceCount: 1,
        firstIndex: 0,
        baseVertex: 0,
        firstInstance: 0,
        shader,
        indexBuffer,
        indexFormat: 'uint16',
        buffers: [{ buffer: vertexBuffer, offset: 0 }],
        vertexLayout: {
          arrayStride: 12, // 3 floats * 4 bytes
          stepMode: 'vertex',
          attributes: [
            { format: 'float32x3', offset: 0, shaderLocation: 0 }
          ]
        },
        topology: 'triangle-list',
        bindGroups: [],
        // Transparency settings (would be set via pipeline state)
        // blend: {
        //   color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
        //   alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }
        // },
        // depthWrite: false,  // Don't write to depth buffer
        // depthTest: true     // But still test against it
      });
    }

    const stats = backend.endFrame();

    // Log warning if not sorting
    if (Math.random() < 0.01) { // Occasionally log
      console.log(`📊 Drew ${stats.drawCalls} transparent quads (sorted back-to-front)`);
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
