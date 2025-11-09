/**
 * Instance Rendering Integration Tests - Epic 3.13
 *
 * End-to-end tests for the complete instance rendering pipeline.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RenderQueue } from '../src/RenderQueue';
import { InstanceBufferManager } from '../src/InstanceBufferManager';
import { createShaderVariants } from '../src/InstancedShaderManager';
import { RenderCommandType, PrimitiveMode } from '../src/types';
import type { QueuedDrawCommand } from '../src/RenderQueue';

// Mock backend for testing
class MockBackend {
  private buffers = new Map<string, any>();

  createBuffer(id: string, type: string, data: any, usage: string): any {
    const buffer = { __brand: 'BackendBuffer', id };
    this.buffers.set(id, { buffer, data, type, usage });
    return buffer;
  }

  updateBuffer(handle: any, data: any): void {
    const bufferData = this.buffers.get(handle.id);
    if (bufferData) {
      bufferData.data = data;
    }
  }

  deleteBuffer(handle: any): void {
    this.buffers.delete(handle.id);
  }

  getBufferCount(): number {
    return this.buffers.size;
  }
}

describe('Instance Rendering Integration', () => {
  let queue: RenderQueue;
  let backend: MockBackend;
  let instanceManager: InstanceBufferManager;

  beforeEach(() => {
    queue = new RenderQueue();
    backend = new MockBackend();
    instanceManager = new InstanceBufferManager(backend as any);
  });

  describe('Complete Pipeline', () => {
    it('should handle 1000 identical objects with 99.9% draw call reduction', () => {
      // Create 1000 identical cube commands
      const objectCount = 1000;
      const commands: QueuedDrawCommand[] = [];

      for (let i = 0; i < objectCount; i++) {
        const x = (i % 32) * 2;
        const y = Math.floor(i / 32) * 2;

        const matrix = new Float32Array(16);
        matrix[0] = 1; matrix[5] = 1; matrix[10] = 1; matrix[15] = 1;
        matrix[12] = x; matrix[13] = y; matrix[14] = 0;

        commands.push({
          drawCommand: {
            type: RenderCommandType.DRAW,
            shader: 'cube',
            mode: PrimitiveMode.TRIANGLES,
            vertexBufferId: 'cube_vb',
            indexBufferId: 'cube_ib',
            meshId: 'cube_mesh',
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

      // Submit all commands
      for (const command of commands) {
        queue.submit(command);
      }

      // Sort and detect instances
      queue.sort();

      // Get instance groups
      const groups = queue.getInstanceGroups('opaque');

      // Should have 1 group with 1000 objects
      expect(groups.length).toBe(1);
      expect(groups[0].commands.length).toBe(objectCount);
      expect(groups[0].instanceBuffer).toBeDefined();

      // Upload to GPU
      const gpuBuffer = instanceManager.upload(groups[0].instanceBuffer!);

      // Verify GPU buffer
      expect(gpuBuffer.count).toBe(objectCount);
      expect(backend.getBufferCount()).toBe(1);

      // Check statistics
      const stats = queue.getStats();
      expect(stats.totalGroups).toBe(1);
      expect(stats.instancedGroups).toBe(1);
      expect(stats.totalInstances).toBe(objectCount);

      // Draw call reduction: (1000 - 1) / 1000 * 100 = 99.9%
      expect(stats.drawCallReduction).toBeCloseTo(99.9, 1);
    });

    it('should separate objects with different materials', () => {
      // Create objects with 2 different materials
      const commands: QueuedDrawCommand[] = [];

      for (let i = 0; i < 100; i++) {
        const materialId = i < 50 ? 'material_a' : 'material_b';

        commands.push({
          drawCommand: {
            type: RenderCommandType.DRAW,
            shader: 'cube',
            mode: PrimitiveMode.TRIANGLES,
            vertexBufferId: 'cube_vb',
            indexBufferId: 'cube_ib',
            meshId: 'cube_mesh',
            vertexCount: 36,
            vertexLayout: {
              attributes: [
                { name: 'a_position', size: 3, type: 'float' },
              ],
            },
          },
          materialId,
          worldMatrix: new Float32Array(16),
          depth: 0,
          sortKey: 0,
        });
      }

      // Submit all commands
      for (const command of commands) {
        queue.submit(command);
      }

      queue.sort();

      // Should have 2 groups (different materials)
      const groups = queue.getInstanceGroups('opaque');
      expect(groups.length).toBe(2);

      // Each group should have 50 objects
      expect(groups[0].commands.length).toBe(50);
      expect(groups[1].commands.length).toBe(50);

      // Both should be instanced
      expect(groups[0].instanceBuffer).toBeDefined();
      expect(groups[1].instanceBuffer).toBeDefined();
    });

    it('should handle mixed instanceable and non-instanceable objects', () => {
      // Create 100 instanceable objects + 5 unique objects
      const commands: QueuedDrawCommand[] = [];

      // 100 identical cubes
      for (let i = 0; i < 100; i++) {
        commands.push({
          drawCommand: {
            type: RenderCommandType.DRAW,
            shader: 'cube',
            mode: PrimitiveMode.TRIANGLES,
            vertexBufferId: 'cube_vb',
            indexBufferId: 'cube_ib',
            meshId: 'cube_mesh',
            vertexCount: 36,
            vertexLayout: {
              attributes: [
                { name: 'a_position', size: 3, type: 'float' },
              ],
            },
          },
          materialId: 'default',
          worldMatrix: new Float32Array(16),
          depth: 0,
          sortKey: 0,
        });
      }

      // 5 unique spheres (below threshold)
      for (let i = 0; i < 5; i++) {
        commands.push({
          drawCommand: {
            type: RenderCommandType.DRAW,
            shader: 'sphere',
            mode: PrimitiveMode.TRIANGLES,
            vertexBufferId: 'sphere_vb',
            indexBufferId: 'sphere_ib',
            meshId: `sphere_mesh_${i}`, // Unique mesh ID
            vertexCount: 128,
            vertexLayout: {
              attributes: [
                { name: 'a_position', size: 3, type: 'float' },
              ],
            },
          },
          materialId: 'default',
          worldMatrix: new Float32Array(16),
          depth: 0,
          sortKey: 0,
        });
      }

      // Submit all commands
      for (const command of commands) {
        queue.submit(command);
      }

      queue.sort();

      // Check statistics
      const stats = queue.getStats();
      expect(stats.totalGroups).toBe(6); // 1 cube group + 5 sphere groups
      expect(stats.instancedGroups).toBe(1); // Only cubes instanced
      expect(stats.totalInstances).toBe(100); // 100 cubes

      // Draw call reduction: (105 - (1 + 5)) / 105 * 100 = 94.29%
      expect(stats.drawCallReduction).toBeCloseTo(94.29, 1);
    });

    it('should update instance buffers when objects change', () => {
      const commands: QueuedDrawCommand[] = [];

      // Create 100 objects
      for (let i = 0; i < 100; i++) {
        commands.push({
          drawCommand: {
            type: RenderCommandType.DRAW,
            shader: 'cube',
            mode: PrimitiveMode.TRIANGLES,
            vertexBufferId: 'cube_vb',
            meshId: 'cube_mesh',
            vertexCount: 36,
            vertexLayout: {
              attributes: [
                { name: 'a_position', size: 3, type: 'float' },
              ],
            },
          },
          materialId: 'default',
          worldMatrix: new Float32Array(16),
          depth: 0,
          sortKey: 0,
        });
      }

      // First frame
      for (const command of commands) {
        queue.submit(command);
      }
      queue.sort();

      let groups = queue.getInstanceGroups('opaque');
      const buffer1 = groups[0].instanceBuffer!;
      const gpuBuffer1 = instanceManager.upload(buffer1);

      expect(gpuBuffer1.count).toBe(100);

      // Clear and submit again
      queue.clear();

      // Second frame: Add 50 more objects
      for (let i = 0; i < 150; i++) {
        commands.push({
          drawCommand: {
            type: RenderCommandType.DRAW,
            shader: 'cube',
            mode: PrimitiveMode.TRIANGLES,
            vertexBufferId: 'cube_vb',
            meshId: 'cube_mesh',
            vertexCount: 36,
            vertexLayout: {
              attributes: [
                { name: 'a_position', size: 3, type: 'float' },
              ],
            },
          },
          materialId: 'default',
          worldMatrix: new Float32Array(16),
          depth: 0,
          sortKey: 0,
        });
      }

      for (const command of commands) {
        queue.submit(command);
      }
      queue.sort();

      groups = queue.getInstanceGroups('opaque');
      const buffer2 = groups[0].instanceBuffer!;
      const gpuBuffer2 = instanceManager.upload(buffer2);

      expect(gpuBuffer2.count).toBe(150);
    });
  });

  describe('Shader Variants', () => {
    it('should create standard and instanced shader variants', () => {
      const source = {
        vertex: `
uniform mat4 u_ModelMatrix;
void main() {
  gl_Position = u_ModelMatrix * vec4(1.0);
}
`,
        fragment: 'void main() {}',
      };

      const variants = createShaderVariants('test', source);

      expect(variants.standard.id).toBe('test');
      expect(variants.standard.source).toBe(source);

      expect(variants.instanced.id).toBe('test_instanced');
      expect(variants.instanced.source.vertex).toContain('a_InstanceTransform');
      expect(variants.instanced.source.vertex).not.toContain('u_ModelMatrix');
    });
  });

  describe('Memory Management', () => {
    it('should release buffers properly', () => {
      // Create and upload buffer
      const commands: QueuedDrawCommand[] = [];

      for (let i = 0; i < 100; i++) {
        commands.push({
          drawCommand: {
            type: RenderCommandType.DRAW,
            shader: 'cube',
            mode: PrimitiveMode.TRIANGLES,
            vertexBufferId: 'cube_vb',
            meshId: 'cube_mesh',
            vertexCount: 36,
            vertexLayout: {
              attributes: [
                { name: 'a_position', size: 3, type: 'float' },
              ],
            },
          },
          materialId: 'default',
          worldMatrix: new Float32Array(16),
          depth: 0,
          sortKey: 0,
        });
      }

      for (const command of commands) {
        queue.submit(command);
      }
      queue.sort();

      const groups = queue.getInstanceGroups('opaque');
      const buffer = groups[0].instanceBuffer!;

      // Upload
      instanceManager.upload(buffer);
      expect(backend.getBufferCount()).toBe(1);

      // Release
      instanceManager.release(buffer);

      // Buffer should be marked as not in-flight
      expect(buffer.isInFlight()).toBe(false);
    });

    it('should track GPU memory usage', () => {
      const commands: QueuedDrawCommand[] = [];

      // 100 objects = 100 * 64 bytes = 6400 bytes
      for (let i = 0; i < 100; i++) {
        commands.push({
          drawCommand: {
            type: RenderCommandType.DRAW,
            shader: 'cube',
            mode: PrimitiveMode.TRIANGLES,
            vertexBufferId: 'cube_vb',
            meshId: 'cube_mesh',
            vertexCount: 36,
            vertexLayout: {
              attributes: [
                { name: 'a_position', size: 3, type: 'float' },
              ],
            },
          },
          materialId: 'default',
          worldMatrix: new Float32Array(16),
          depth: 0,
          sortKey: 0,
        });
      }

      for (const command of commands) {
        queue.submit(command);
      }
      queue.sort();

      const groups = queue.getInstanceGroups('opaque');
      instanceManager.upload(groups[0].instanceBuffer!);

      const memoryUsage = instanceManager.getGPUMemoryUsage();

      // Should be at least 6400 bytes (may be more due to power-of-2 pooling)
      expect(memoryUsage).toBeGreaterThanOrEqual(6400);
    });
  });
});
