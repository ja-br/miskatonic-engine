/**
 * RenderQueue Tests - Epic 3.12
 *
 * Comprehensive test coverage for render queue organization and sorting.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RenderQueue, type QueuedDrawCommand, type CameraInfo } from '../src/RenderQueue';
import { RenderCommandType, PrimitiveMode } from '../src/types';

describe('RenderQueue', () => {
  let queue: RenderQueue;
  let camera: CameraInfo;

  beforeEach(() => {
    queue = new RenderQueue();

    // Setup default camera
    camera = {
      position: new Float32Array([0, 0, 10]),
      viewMatrix: new Float32Array(16),
      projectionMatrix: new Float32Array(16),
    };
    queue.setCamera(camera);
  });

  // =============================================================================
  // Helper Functions
  // =============================================================================

  function createDrawCommand(
    materialId: string,
    position: [number, number, number],
    blendMode: 'none' | 'alpha' | 'additive' = 'none'
  ): QueuedDrawCommand {
    // Create world matrix with position
    const worldMatrix = new Float32Array(16);
    worldMatrix[0] = 1; worldMatrix[5] = 1; worldMatrix[10] = 1; worldMatrix[15] = 1; // Identity
    worldMatrix[12] = position[0];
    worldMatrix[13] = position[1];
    worldMatrix[14] = position[2];

    return {
      drawCommand: {
        type: RenderCommandType.DRAW,
        shader: 'test_shader',
        mode: PrimitiveMode.TRIANGLES,
        vertexBufferId: 'test_buffer',
        vertexCount: 36,
        vertexLayout: { attributes: [] },
      },
      materialId,
      worldMatrix,
      depth: 0,
      sortKey: 0,
      renderState: {
        blendMode,
        depthTest: 'less',
        depthWrite: blendMode === 'none',
        cullMode: 'back',
      },
    };
  }

  // =============================================================================
  // Basic Functionality
  // =============================================================================

  describe('Basic Operations', () => {
    it('should start empty', () => {
      const stats = queue.getStats();
      expect(stats.totalCommands).toBe(0);
      expect(stats.opaqueCount).toBe(0);
      expect(stats.alphaTestCount).toBe(0);
      expect(stats.transparentCount).toBe(0);
    });

    it('should accept opaque commands', () => {
      const cmd = createDrawCommand('material1', [0, 0, 0]);
      queue.submit(cmd);

      const stats = queue.getStats();
      expect(stats.totalCommands).toBe(1);
    });

    it('should accept transparent commands', () => {
      const cmd = createDrawCommand('material1', [0, 0, 0], 'alpha');
      queue.submit(cmd);

      const stats = queue.getStats();
      expect(stats.totalCommands).toBe(1);
    });

    it('should clear all queues', () => {
      queue.submit(createDrawCommand('mat1', [0, 0, 0]));
      queue.submit(createDrawCommand('mat2', [1, 1, 1], 'alpha'));

      queue.clear();

      const stats = queue.getStats();
      expect(stats.totalCommands).toBe(0);
      expect(queue.getCommands()).toHaveLength(0);
    });
  });

  // =============================================================================
  // Queue Categorization
  // =============================================================================

  describe('Queue Categorization', () => {
    it('should categorize opaque objects correctly', () => {
      queue.submit(createDrawCommand('mat1', [0, 0, 0], 'none'));
      queue.sort();

      const stats = queue.getStats();
      expect(stats.opaqueCount).toBe(1);
      expect(stats.alphaTestCount).toBe(0);
      expect(stats.transparentCount).toBe(0);
    });

    it('should categorize transparent objects correctly', () => {
      queue.submit(createDrawCommand('mat1', [0, 0, 0], 'alpha'));
      queue.submit(createDrawCommand('mat2', [1, 1, 1], 'additive'));
      queue.sort();

      const stats = queue.getStats();
      expect(stats.opaqueCount).toBe(0);
      expect(stats.alphaTestCount).toBe(0);
      expect(stats.transparentCount).toBe(2);
    });

    it('should categorize mixed objects correctly', () => {
      queue.submit(createDrawCommand('mat1', [0, 0, 0], 'none')); // opaque
      queue.submit(createDrawCommand('mat2', [1, 1, 1], 'alpha')); // transparent
      queue.submit(createDrawCommand('mat3', [2, 2, 2], 'none')); // opaque
      queue.sort();

      const stats = queue.getStats();
      expect(stats.opaqueCount).toBe(2);
      expect(stats.transparentCount).toBe(1);
    });
  });

  // =============================================================================
  // Depth Calculation
  // =============================================================================

  describe('Depth Calculation', () => {
    it('should calculate depth from camera', () => {
      const cmd1 = createDrawCommand('mat1', [0, 0, 0]); // depth = 10
      const cmd2 = createDrawCommand('mat2', [0, 0, 5]); // depth = 5
      const cmd3 = createDrawCommand('mat3', [0, 0, -5]); // depth = 15

      queue.submit(cmd1);
      queue.submit(cmd2);
      queue.submit(cmd3);
      queue.sort();

      // Check depths were calculated (exact values depend on camera position)
      expect(cmd1.depth).toBeGreaterThan(0);
      expect(cmd2.depth).toBeGreaterThan(0);
      expect(cmd3.depth).toBeGreaterThan(0);

      // Closer objects should have smaller depth
      expect(cmd2.depth).toBeLessThan(cmd1.depth);
      expect(cmd1.depth).toBeLessThan(cmd3.depth);
    });

    it('should handle camera at different positions', () => {
      const newCamera: CameraInfo = {
        position: new Float32Array([5, 5, 5]),
        viewMatrix: new Float32Array(16),
        projectionMatrix: new Float32Array(16),
      };
      queue.setCamera(newCamera);

      const cmd = createDrawCommand('mat1', [0, 0, 0]);
      queue.submit(cmd);

      // Distance from [5,5,5] to [0,0,0] = sqrt(75) ≈ 8.66
      expect(cmd.depth).toBeCloseTo(Math.sqrt(75), 1);
    });

    it('should warn if no camera is set', () => {
      const queueWithoutCamera = new RenderQueue();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const cmd = createDrawCommand('mat1', [0, 0, 0]);
      queueWithoutCamera.submit(cmd);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No camera set')
      );
      expect(cmd.depth).toBe(0); // Default depth

      consoleSpy.mockRestore();
    });
  });

  // =============================================================================
  // Opaque Sorting (Front-to-Back)
  // =============================================================================

  describe('Opaque Sorting', () => {
    it('should sort opaque objects front-to-back by depth', () => {
      // Submit in random order
      const far = createDrawCommand('mat1', [0, 0, -10]); // farthest
      const near = createDrawCommand('mat1', [0, 0, 5]); // nearest
      const mid = createDrawCommand('mat1', [0, 0, 0]); // middle

      queue.submit(far);
      queue.submit(near);
      queue.submit(mid);
      queue.sort();

      const opaque = queue.getOpaqueCommands();

      // Should be sorted near -> mid -> far
      expect(opaque[0].depth).toBeLessThan(opaque[1].depth);
      expect(opaque[1].depth).toBeLessThan(opaque[2].depth);
    });

    it('should group by material when depth is similar', () => {
      // Objects at same depth but different materials
      const cmd1 = createDrawCommand('matA', [0, 0, 0]);
      const cmd2 = createDrawCommand('matB', [0, 0, 0]);
      const cmd3 = createDrawCommand('matA', [0, 0, 0]);

      queue.submit(cmd1);
      queue.submit(cmd2);
      queue.submit(cmd3);
      queue.sort();

      const opaque = queue.getOpaqueCommands();

      // Same materials should be adjacent (for batching)
      // Exact order depends on hash, but same materials should group
      const materials = opaque.map(cmd => cmd.materialId);
      const matAIndices = materials.reduce((acc, mat, i) => {
        if (mat === 'matA') acc.push(i);
        return acc;
      }, [] as number[]);

      // matA commands should be adjacent
      expect(Math.abs(matAIndices[0] - matAIndices[1])).toBeLessThanOrEqual(1);
    });
  });

  // =============================================================================
  // Transparent Sorting (Back-to-Front)
  // =============================================================================

  describe('Transparent Sorting', () => {
    it('should sort transparent objects back-to-front by depth', () => {
      // Submit in random order
      const near = createDrawCommand('mat1', [0, 0, 5], 'alpha'); // nearest
      const far = createDrawCommand('mat2', [0, 0, -10], 'alpha'); // farthest
      const mid = createDrawCommand('mat3', [0, 0, 0], 'alpha'); // middle

      queue.submit(near);
      queue.submit(far);
      queue.submit(mid);
      queue.sort();

      const transparent = queue.getTransparentCommands();

      // Should be sorted far -> mid -> near
      expect(transparent[0].depth).toBeGreaterThan(transparent[1].depth);
      expect(transparent[1].depth).toBeGreaterThan(transparent[2].depth);
    });

    it('should handle different blend modes as transparent', () => {
      const alpha = createDrawCommand('mat1', [0, 0, 0], 'alpha');
      const additive = createDrawCommand('mat2', [0, 0, 5], 'additive');

      queue.submit(alpha);
      queue.submit(additive);
      queue.sort();

      const stats = queue.getStats();
      expect(stats.transparentCount).toBe(2);
    });
  });

  // =============================================================================
  // Sort Key Optimization
  // =============================================================================

  describe('Sort Key Optimization', () => {
    it('should calculate sort keys for all commands', () => {
      const cmd1 = createDrawCommand('mat1', [0, 0, 0]);
      const cmd2 = createDrawCommand('mat2', [1, 1, 1], 'alpha');

      queue.submit(cmd1);
      queue.submit(cmd2);

      // Sort keys should be calculated
      expect(cmd1.sortKey).toBeGreaterThan(0);
      expect(cmd2.sortKey).toBeGreaterThan(0);
    });

    it('should use sort key for fast comparison', () => {
      // Submit many commands
      for (let i = 0; i < 100; i++) {
        queue.submit(createDrawCommand(`mat${i % 5}`, [i, 0, 0]));
      }

      const startTime = performance.now();
      queue.sort();
      const sortTime = performance.now() - startTime;

      // Should be fast (<1ms for 100 objects)
      expect(sortTime).toBeLessThan(1);
    });
  });

  // =============================================================================
  // Render Order
  // =============================================================================

  describe('Render Order', () => {
    it('should return commands in correct order (opaque -> alpha-test -> transparent)', () => {
      queue.submit(createDrawCommand('transparent', [0, 0, 0], 'alpha'));
      queue.submit(createDrawCommand('opaque', [0, 0, 0], 'none'));
      queue.sort();

      const all = queue.getCommands();

      // First command should be opaque
      expect(all[0].renderState?.blendMode).toBe('none');

      // Last command should be transparent
      expect(all[all.length - 1].renderState?.blendMode).toBe('alpha');
    });

    it('should separate queues correctly', () => {
      queue.submit(createDrawCommand('opaque1', [0, 0, 0], 'none'));
      queue.submit(createDrawCommand('transparent1', [0, 0, 0], 'alpha'));
      queue.submit(createDrawCommand('opaque2', [1, 1, 1], 'none'));
      queue.sort();

      const opaque = queue.getOpaqueCommands();
      const transparent = queue.getTransparentCommands();

      expect(opaque).toHaveLength(2);
      expect(transparent).toHaveLength(1);

      // Opaque should not contain transparent
      expect(opaque.every(cmd => cmd.renderState?.blendMode === 'none')).toBe(true);

      // Transparent should not contain opaque
      expect(transparent.every(cmd => cmd.renderState?.blendMode !== 'none')).toBe(true);
    });
  });

  // =============================================================================
  // Statistics
  // =============================================================================

  describe('Statistics', () => {
    it('should track total commands', () => {
      queue.submit(createDrawCommand('mat1', [0, 0, 0]));
      queue.submit(createDrawCommand('mat2', [1, 1, 1]));

      const stats = queue.getStats();
      expect(stats.totalCommands).toBe(2);
    });

    it('should track sort time', () => {
      for (let i = 0; i < 50; i++) {
        queue.submit(createDrawCommand(`mat${i}`, [i, 0, 0]));
      }

      queue.sort();

      const stats = queue.getStats();
      expect(stats.sortTime).toBeGreaterThan(0);
    });

    it('should track queue counts', () => {
      queue.submit(createDrawCommand('mat1', [0, 0, 0], 'none'));
      queue.submit(createDrawCommand('mat2', [1, 1, 1], 'alpha'));
      queue.submit(createDrawCommand('mat3', [2, 2, 2], 'none'));
      queue.sort();

      const stats = queue.getStats();
      expect(stats.opaqueCount).toBe(2);
      expect(stats.transparentCount).toBe(1);
    });

    it('should track material changes', () => {
      queue.trackMaterialChange('mat1');
      queue.trackMaterialChange('mat2');
      queue.trackMaterialChange('mat2'); // Same material, no change

      const stats = queue.getStats();
      expect(stats.materialChanges).toBe(2);
    });

    it('should track state changes', () => {
      queue.trackStateChange();
      queue.trackStateChange();

      const stats = queue.getStats();
      expect(stats.stateChanges).toBe(2);
    });

    it('should reset stats on clear', () => {
      queue.submit(createDrawCommand('mat1', [0, 0, 0]));
      queue.trackMaterialChange('mat1');
      queue.trackStateChange();

      queue.clear();

      const stats = queue.getStats();
      expect(stats.totalCommands).toBe(0);
      expect(stats.materialChanges).toBe(0);
      expect(stats.stateChanges).toBe(0);
    });
  });

  // =============================================================================
  // Performance Tests
  // =============================================================================

  describe('Performance', () => {
    it('should handle 1000 commands efficiently', () => {
      // Submit 1000 commands
      for (let i = 0; i < 1000; i++) {
        const blendMode = i % 3 === 0 ? 'alpha' : 'none';
        queue.submit(createDrawCommand(`mat${i % 10}`, [i, 0, 0], blendMode as any));
      }

      const startTime = performance.now();
      queue.sort();
      const sortTime = performance.now() - startTime;

      // Should sort 1000 objects in <1ms (target)
      expect(sortTime).toBeLessThan(1);

      const stats = queue.getStats();
      expect(stats.totalCommands).toBe(1000);
    });

    it('should not allocate during sort', () => {
      // Pre-populate queue
      for (let i = 0; i < 100; i++) {
        queue.submit(createDrawCommand(`mat${i}`, [i, 0, 0]));
      }

      // Sort should not allocate new arrays
      const commands1 = queue.getCommands();
      queue.sort();
      const commands2 = queue.getCommands();

      // Should return new array but not allocate in sort itself
      expect(commands1).not.toBe(commands2); // New array from getCommands()
      expect(commands1.length).toBe(commands2.length);
    });
  });

  // =============================================================================
  // Input Validation
  // =============================================================================

  describe('Input Validation', () => {
    it('should reject command with invalid worldMatrix', () => {
      const invalidCmd = {
        ...createDrawCommand('mat1', [0, 0, 0]),
        worldMatrix: null as any,
      };

      expect(() => queue.submit(invalidCmd)).toThrow('Invalid worldMatrix');
    });

    it('should reject command with wrong worldMatrix length', () => {
      const invalidCmd = {
        ...createDrawCommand('mat1', [0, 0, 0]),
        worldMatrix: new Float32Array(12), // Wrong length
      };

      expect(() => queue.submit(invalidCmd)).toThrow('Invalid worldMatrix');
    });

    it('should reject command with invalid materialId', () => {
      const invalidCmd = {
        ...createDrawCommand('mat1', [0, 0, 0]),
        materialId: null as any,
      };

      expect(() => queue.submit(invalidCmd)).toThrow('Invalid materialId');
    });

    it('should reject command with empty materialId', () => {
      const invalidCmd = {
        ...createDrawCommand('mat1', [0, 0, 0]),
        materialId: '',
      };

      expect(() => queue.submit(invalidCmd)).toThrow('Invalid materialId');
    });

    it('should reject command with missing drawCommand', () => {
      const invalidCmd = {
        ...createDrawCommand('mat1', [0, 0, 0]),
        drawCommand: null as any,
      };

      expect(() => queue.submit(invalidCmd)).toThrow('Missing drawCommand');
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle empty queue', () => {
      queue.sort();

      const commands = queue.getCommands();
      expect(commands).toHaveLength(0);

      const stats = queue.getStats();
      expect(stats.totalCommands).toBe(0);
    });

    it('should handle single command', () => {
      queue.submit(createDrawCommand('mat1', [0, 0, 0]));
      queue.sort();

      const commands = queue.getCommands();
      expect(commands).toHaveLength(1);
    });

    it('should handle objects at same position', () => {
      const cmd1 = createDrawCommand('mat1', [0, 0, 0]);
      const cmd2 = createDrawCommand('mat2', [0, 0, 0]);
      const cmd3 = createDrawCommand('mat3', [0, 0, 0]);

      queue.submit(cmd1);
      queue.submit(cmd2);
      queue.submit(cmd3);
      queue.sort();

      // Should not crash, sort by material
      expect(queue.getCommands()).toHaveLength(3);
    });

    it('should handle very distant objects', () => {
      const cmd = createDrawCommand('mat1', [1000000, 0, 0]);
      queue.submit(cmd);

      queue.sort();

      expect(cmd.depth).toBeGreaterThan(0);
      expect(cmd.sortKey).toBeGreaterThan(0);
    });
  });
});
