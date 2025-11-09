/**
 * Epic 3.13: Instance Rendering Demo
 *
 * Demonstrates complete instanced rendering pipeline:
 * 1. Submit 1000 identical objects to RenderQueue
 * 2. Automatic instance detection and grouping
 * 3. Instance buffer creation and GPU upload
 * 4. Instanced draw calls (1000 objects → 1 draw call)
 * 5. Draw call reduction verification
 */

import { RenderQueue } from './RenderQueue';
import { InstanceBufferManager } from './InstanceBufferManager';
import { createShaderVariants } from './InstancedShaderManager';
import { RenderCommandType, PrimitiveMode } from './types';
import type { IRendererBackend } from './backends/IRendererBackend';

/**
 * Instance rendering demo
 *
 * Usage:
 * ```typescript
 * const demo = new InstanceDemo(backend);
 * demo.run(); // Submits 1000 cubes, renders with 1 draw call
 * ```
 */
export class InstanceDemo {
  private queue: RenderQueue;
  private instanceManager: InstanceBufferManager;
  private backend: IRendererBackend;

  constructor(backend: IRendererBackend) {
    this.backend = backend;
    this.queue = new RenderQueue();
    this.instanceManager = new InstanceBufferManager(backend);
  }

  /**
   * Run the demo
   *
   * Creates 1000 cubes and renders them with instancing.
   * Expected result: 1 draw call instead of 1000.
   */
  run(): void {
    console.log('=== Epic 3.13: Instance Rendering Demo ===\n');

    // Step 1: Create shader variants
    console.log('Step 1: Creating shader variants...');
    const shaderSource = {
      vertex: `
#version 300 es
in vec3 a_position;
in vec3 a_normal;

uniform mat4 u_ModelMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ProjectionMatrix;

out vec3 v_Normal;

void main() {
  v_Normal = (u_ModelMatrix * vec4(a_normal, 0.0)).xyz;
  gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * vec4(a_position, 1.0);
}
`,
      fragment: `
#version 300 es
precision mediump float;

in vec3 v_Normal;
out vec4 fragColor;

void main() {
  vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
  float diffuse = max(dot(normalize(v_Normal), lightDir), 0.0);
  fragColor = vec4(vec3(0.5 + 0.5 * diffuse), 1.0);
}
`,
    };

    const variants = createShaderVariants('cube', shaderSource);
    console.log(`  ✓ Created standard and instanced shader variants`);
    console.log(`    - Standard: ${variants.standard.id}`);
    console.log(`    - Instanced: ${variants.instanced.id}\n`);

    // Step 2: Submit 1000 identical cubes
    console.log('Step 2: Submitting 1000 identical cubes...');
    const objectCount = 1000;

    for (let i = 0; i < objectCount; i++) {
      // Create transform matrix (spread objects in a grid)
      const x = (i % 32) * 2;
      const y = Math.floor(i / 32) * 2;
      const z = 0;

      const matrix = new Float32Array(16);
      matrix[0] = 1; matrix[5] = 1; matrix[10] = 1; matrix[15] = 1; // Identity
      matrix[12] = x; matrix[13] = y; matrix[14] = z; // Translation

      this.queue.submit({
        drawCommand: {
          type: RenderCommandType.DRAW,
          shader: 'cube', // Will use 'cube_instanced' variant
          mode: PrimitiveMode.TRIANGLES,
          vertexBufferId: 'cube_vb',
          indexBufferId: 'cube_ib',
          meshId: 'cube_mesh', // CRITICAL: Explicit mesh ID for grouping
          vertexCount: 36,
          vertexLayout: {
            attributes: [
              { name: 'a_position', size: 3, type: 'float' },
              { name: 'a_normal', size: 3, type: 'float' },
            ],
          },
        },
        materialId: 'default',
        worldMatrix: matrix,
        depth: 0,
        sortKey: 0,
      });
    }

    console.log(`  ✓ Submitted ${objectCount} draw commands\n`);

    // Step 3: Sort and detect instances
    console.log('Step 3: Sorting and detecting instances...');
    this.queue.sort();

    const groups = this.queue.getInstanceGroups('opaque');
    console.log(`  ✓ Detected ${groups.length} instance group(s)`);

    for (const group of groups) {
      if (group.instanceBuffer) {
        console.log(`    - Group: ${group.key}`);
        console.log(`      Objects: ${group.commands.length}`);
        console.log(`      Instanced: YES (buffer capacity: ${group.instanceBuffer.getCapacity()})`);
      }
    }

    // Step 4: Upload instance buffers to GPU
    console.log('\nStep 4: Uploading instance buffers to GPU...');
    let totalInstances = 0;

    for (const group of groups) {
      if (group.instanceBuffer) {
        const gpuBuffer = this.instanceManager.upload(group.instanceBuffer);
        console.log(`  ✓ Uploaded ${gpuBuffer.count} instances (GPU buffer: ${gpuBuffer.id})`);
        totalInstances += gpuBuffer.count;

        // IMPORTANT: Set instanceBufferId and instanceCount on draw command
        if (group.commands.length > 0) {
          const firstCommand = group.commands[0];
          firstCommand.drawCommand.instanceBufferId = gpuBuffer.id;
          firstCommand.drawCommand.instanceCount = gpuBuffer.count;
          // Use instanced shader variant
          firstCommand.drawCommand.shader = 'cube_instanced';
        }
      }
    }

    console.log(`  Total instances uploaded: ${totalInstances}\n`);

    // Step 5: Get statistics
    console.log('Step 5: Instance rendering statistics:');
    const stats = this.queue.getStats();

    console.log(`  Total commands submitted: ${objectCount}`);
    console.log(`  Instance groups detected: ${stats.instancedDrawCalls}`);
    console.log(`  Total instances: ${stats.totalInstances}`);
    console.log(`  Draw call reduction: ${stats.drawCallReduction.toFixed(2)}%`);

    // Calculate expected vs actual draw calls
    const beforeDrawCalls = objectCount;
    const afterDrawCalls = stats.instancedDrawCalls + (objectCount - stats.totalInstances);

    console.log(`\n  Performance Impact:`);
    console.log(`    Before (no instancing): ${beforeDrawCalls} draw calls`);
    console.log(`    After (instancing):     ${afterDrawCalls} draw call(s)`);
    console.log(`    Reduction:              ${beforeDrawCalls - afterDrawCalls} fewer draw calls`);

    // Step 6: Verify success criteria
    console.log('\n=== Success Criteria ===');
    const success = stats.drawCallReduction > 99; // Should be 99.9% for 1000 identical objects

    if (success) {
      console.log('✅ PASS: Draw call reduction > 99%');
      console.log('✅ Instance rendering working correctly!\n');
    } else {
      console.log(`❌ FAIL: Draw call reduction ${stats.drawCallReduction.toFixed(2)}% (expected > 99%)`);
      console.log('❌ Instance rendering not working as expected\n');
    }

    // Step 7: Memory usage
    const gpuMemory = this.instanceManager.getGPUMemoryUsage();
    console.log(`GPU Memory: ${(gpuMemory / 1024).toFixed(2)} KB\n`);
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.queue.clear();
  }
}

/**
 * Run demo if executed directly
 */
if (require.main === module) {
  console.log('Instance rendering demo requires a WebGL2 backend.');
  console.log('Run this in a browser environment with:');
  console.log('  import { InstanceDemo } from "@miskatonic/rendering/instance-demo";');
  console.log('  const demo = new InstanceDemo(backend);');
  console.log('  demo.run();');
}
