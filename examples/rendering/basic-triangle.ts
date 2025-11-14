/**
 * Basic Triangle Example
 *
 * Demonstrates:
 * - WebGPUBackend initialization
 * - Creating vertex buffers
 * - Creating shaders (WGSL)
 * - Basic rendering loop
 * - Automatic device recovery
 */

import { WebGPUBackend } from '@miskatonic/rendering';

// WGSL Shader
const TRIANGLE_SHADER = `
@vertex
fn vs_main(@location(0) position: vec3f) -> @builtin(position) vec4f {
  return vec4f(position, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return vec4f(1.0, 0.5, 0.2, 1.0); // Orange color
}
`;

async function main() {
  // Get canvas
  const canvas = document.querySelector('canvas');
  if (!canvas) {
    throw new Error('Canvas not found');
  }

  // Initialize backend
  const backend = new WebGPUBackend();
  const success = await backend.initialize({
    canvas,
    powerPreference: 'high-performance'
  });

  if (!success) {
    throw new Error('Failed to initialize WebGPU');
  }

  console.log('WebGPU initialized successfully');

  // Create triangle vertices (in NDC space: -1 to 1)
  const vertices = new Float32Array([
    // x,    y,   z
    0.0,  0.5, 0.0,  // Top
   -0.5, -0.5, 0.0,  // Bottom-left
    0.5, -0.5, 0.0   // Bottom-right
  ]);

  // Create vertex buffer
  const vertexBuffer = backend.createBuffer(
    'triangle-vertices',
    'vertex',
    vertices,
    'static_draw'
  );

  // Create shader
  const shader = backend.createShader('triangle-shader', {
    vertex: TRIANGLE_SHADER
  });

  console.log('Resources created successfully');

  // Optional: Monitor device recovery
  if (backend.recoverySystem) {
    backend.recoverySystem.onRecovery((progress) => {
      if (progress.phase === 'detecting') {
        console.warn('⚠️ GPU device lost, recovering...');
      } else if (progress.phase === 'complete') {
        console.log(`✅ Recovery complete! Recreated ${progress.resourcesRecreated} resources`);
      } else if (progress.phase === 'failed') {
        console.error('❌ Recovery failed:', progress.error);
      }
    });
  }

  // Render loop
  let frameCount = 0;
  function render() {
    backend.beginFrame();

    // Execute draw command
    backend.executeDrawCommand({
      type: 'non-indexed',
      vertexCount: 3,
      instanceCount: 1,
      firstVertex: 0,
      firstInstance: 0,
      shader,
      buffers: [{ buffer: vertexBuffer, offset: 0 }],
      vertexLayout: {
        arrayStride: 12, // 3 floats * 4 bytes
        stepMode: 'vertex',
        attributes: [
          {
            format: 'float32x3',
            offset: 0,
            shaderLocation: 0
          }
        ]
      },
      topology: 'triangle-list',
      bindGroups: []
    });

    const stats = backend.endFrame();

    // Log stats every 60 frames
    if (frameCount % 60 === 0) {
      console.log(`Frame ${frameCount}: ${stats.cpuTimeMs.toFixed(2)}ms, ${stats.drawCalls} draw calls`);
    }

    frameCount++;
    requestAnimationFrame(render);
  }

  // Start rendering
  render();
}

// Run when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
