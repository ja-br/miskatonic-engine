/**
 * InstanceDetector Tests - Epic 3.13
 *
 * Tests for instance detection and material compatibility checking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InstanceDetector } from '../src/InstanceDetector';
import type { QueuedDrawCommand } from '../src/RenderQueue';
import { RenderCommandType, PrimitiveMode } from '../src/types';

describe('InstanceDetector', () => {
  let detector: InstanceDetector;

  beforeEach(() => {
    detector = new InstanceDetector();
  });

  describe('constructor', () => {
    it('should create detector with default config', () => {
      const config = detector.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.minInstanceThreshold).toBe(10);
      expect(config.checkMaterialCompatibility).toBe(true);
    });

    it('should create detector with custom config', () => {
      const custom = new InstanceDetector({
        enabled: false,
        minInstanceThreshold: 5,
        checkMaterialCompatibility: false,
      });

      const config = custom.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.minInstanceThreshold).toBe(5);
      expect(config.checkMaterialCompatibility).toBe(false);
    });
  });

  describe('detectGroups', () => {
    it('should group identical commands', () => {
      const commands: QueuedDrawCommand[] = [];

      // Create 10 identical commands
      for (let i = 0; i < 10; i++) {
        commands.push(createCommand('mesh1', 'mat1'));
      }

      const groups = detector.detectGroups(commands);

      expect(groups.length).toBe(1);
      expect(groups[0].commands.length).toBe(10);
      expect(groups[0].meshId).toBe('mesh1');
      expect(groups[0].materialId).toBe('mat1');
    });

    it('should separate different meshes', () => {
      const commands: QueuedDrawCommand[] = [
        ...Array(10).fill(null).map(() => createCommand('mesh1', 'mat1')),
        ...Array(10).fill(null).map(() => createCommand('mesh2', 'mat1')),
      ];

      const groups = detector.detectGroups(commands);

      expect(groups.length).toBe(2);
      expect(groups[0].commands.length).toBe(10);
      expect(groups[1].commands.length).toBe(10);
    });

    it('should separate different materials', () => {
      const commands: QueuedDrawCommand[] = [
        ...Array(10).fill(null).map(() => createCommand('mesh1', 'mat1')),
        ...Array(10).fill(null).map(() => createCommand('mesh1', 'mat2')),
      ];

      const groups = detector.detectGroups(commands);

      expect(groups.length).toBe(2);
    });

    it('should separate commands with different uniforms', () => {
      const cmd1 = createCommand('mesh1', 'mat1');
      cmd1.drawCommand.uniforms = new Map([['u_color', { type: 'vec3', value: [1, 0, 0] }]]);
      cmd1._cachedMaterialHash = computeMaterialHash(cmd1); // Recompute hash

      const cmd2 = createCommand('mesh1', 'mat1');
      cmd2.drawCommand.uniforms = new Map([['u_color', { type: 'vec3', value: [0, 1, 0] }]]);
      cmd2._cachedMaterialHash = computeMaterialHash(cmd2); // Recompute hash

      const commands = [
        ...Array(10).fill(null).map(() => ({ ...cmd1 })),
        ...Array(10).fill(null).map(() => ({ ...cmd2 })),
      ];

      const groups = detector.detectGroups(commands);

      // Should create 2 groups due to different uniform values
      expect(groups.length).toBe(2);
    });

    it('should handle empty command list', () => {
      const groups = detector.detectGroups([]);
      expect(groups.length).toBe(0);
    });

    it('should handle single command', () => {
      const commands = [createCommand('mesh1', 'mat1')];
      const groups = detector.detectGroups(commands);

      expect(groups.length).toBe(1);
      expect(groups[0].commands.length).toBe(1);
    });
  });

  describe('shouldInstance', () => {
    it('should instance when above threshold', () => {
      const commands = Array(10).fill(null).map(() => createCommand('mesh1', 'mat1'));
      const groups = detector.detectGroups(commands);

      expect(detector.shouldInstance(groups[0])).toBe(true);
    });

    it('should not instance when below threshold', () => {
      const commands = Array(9).fill(null).map(() => createCommand('mesh1', 'mat1'));
      const groups = detector.detectGroups(commands);

      expect(detector.shouldInstance(groups[0])).toBe(false);
    });

    it('should respect custom threshold', () => {
      const custom = new InstanceDetector({ minInstanceThreshold: 5 });
      const commands = Array(5).fill(null).map(() => createCommand('mesh1', 'mat1'));
      const groups = custom.detectGroups(commands);

      expect(custom.shouldInstance(groups[0])).toBe(true);
    });
  });

  describe('getInstanceCount', () => {
    it('should return correct instance count', () => {
      const commands = Array(15).fill(null).map(() => createCommand('mesh1', 'mat1'));
      const groups = detector.detectGroups(commands);

      expect(detector.getInstanceCount(groups[0])).toBe(15);
    });
  });

  describe('getStats', () => {
    it('should calculate correct statistics', () => {
      const commands: QueuedDrawCommand[] = [
        ...Array(100).fill(null).map(() => createCommand('mesh1', 'mat1')), // Will instance
        ...Array(50).fill(null).map(() => createCommand('mesh2', 'mat1')),  // Will instance
        ...Array(5).fill(null).map(() => createCommand('mesh3', 'mat1')),   // Won't instance (below threshold)
      ];

      detector.detectGroups(commands);
      const stats = detector.getStats();

      expect(stats.totalGroups).toBe(3);
      expect(stats.instancedGroups).toBe(2); // mesh1 and mesh2
      expect(stats.totalInstances).toBe(150); // 100 + 50

      // Draw call reduction: (155 individual - (2 instanced + 5 individual)) / 155 * 100
      // = (155 - 7) / 155 * 100 = 95.48%
      expect(stats.drawCallReduction).toBeCloseTo(95.48, 1);
    });

    it('should handle no instanceable commands', () => {
      const commands = Array(5).fill(null).map(() => createCommand('mesh1', 'mat1'));
      detector.detectGroups(commands);
      const stats = detector.getStats();

      expect(stats.instancedGroups).toBe(0);
      expect(stats.totalInstances).toBe(0);
      expect(stats.drawCallReduction).toBe(0);
    });
  });

  describe('material compatibility', () => {
    it('should not instance commands with different textures', () => {
      const cmd1 = createCommand('mesh1', 'mat1');
      cmd1.drawCommand.textures = new Map([[0, 'texture1']]);
      cmd1._cachedMaterialHash = computeMaterialHash(cmd1); // Recompute hash

      const cmd2 = createCommand('mesh1', 'mat1');
      cmd2.drawCommand.textures = new Map([[0, 'texture2']]);
      cmd2._cachedMaterialHash = computeMaterialHash(cmd2); // Recompute hash

      const commands = [
        ...Array(10).fill(null).map(() => ({ ...cmd1 })),
        ...Array(10).fill(null).map(() => ({ ...cmd2 })),
      ];

      const groups = detector.detectGroups(commands);
      expect(groups.length).toBe(2);
    });

    it('should not instance commands with different render state', () => {
      const cmd1 = createCommand('mesh1', 'mat1');
      cmd1.renderState = { blendMode: 'alpha' };
      cmd1._cachedMaterialHash = computeMaterialHash(cmd1); // Recompute hash

      const cmd2 = createCommand('mesh1', 'mat1');
      cmd2.renderState = { blendMode: 'additive' };
      cmd2._cachedMaterialHash = computeMaterialHash(cmd2); // Recompute hash

      const commands = [
        ...Array(10).fill(null).map(() => ({ ...cmd1 })),
        ...Array(10).fill(null).map(() => ({ ...cmd2 })),
      ];

      const groups = detector.detectGroups(commands);
      expect(groups.length).toBe(2);
    });

    it('should allow disabling compatibility checking', () => {
      const fast = new InstanceDetector({ checkMaterialCompatibility: false });

      const cmd1 = createCommand('mesh1', 'mat1');
      cmd1.drawCommand.uniforms = new Map([['u_color', { type: 'vec3', value: [1, 0, 0] }]]);

      const cmd2 = createCommand('mesh1', 'mat1');
      cmd2.drawCommand.uniforms = new Map([['u_color', { type: 'vec3', value: [0, 1, 0] }]]);

      const commands = [
        ...Array(10).fill(null).map(() => ({ ...cmd1 })),
        ...Array(10).fill(null).map(() => ({ ...cmd2 })),
      ];

      const groups = fast.detectGroups(commands);

      // Without compatibility checking, should group together (potentially buggy but fast)
      expect(groups.length).toBe(1);
      expect(groups[0].commands.length).toBe(20);
    });
  });

  describe('updateConfig', () => {
    it('should update threshold', () => {
      detector.updateConfig({ minInstanceThreshold: 5 });
      expect(detector.getConfig().minInstanceThreshold).toBe(5);
    });

    it('should update enabled flag', () => {
      detector.updateConfig({ enabled: false });
      expect(detector.getConfig().enabled).toBe(false);
    });

    it('should update compatibility checking', () => {
      detector.updateConfig({ checkMaterialCompatibility: false });
      expect(detector.getConfig().checkMaterialCompatibility).toBe(false);
    });
  });

  describe('disabled mode', () => {
    it('should return individual groups when disabled', () => {
      detector.updateConfig({ enabled: false });
      const commands = Array(20).fill(null).map(() => createCommand('mesh1', 'mat1'));
      const groups = detector.detectGroups(commands);

      expect(groups.length).toBe(20); // One group per command
      expect(groups[0].commands.length).toBe(1);
    });
  });
});

// Helper function to create test commands
function createCommand(meshId: string, materialId: string): QueuedDrawCommand {
  const command: QueuedDrawCommand = {
    drawCommand: {
      type: RenderCommandType.DRAW,
      shader: 'test_shader',
      mode: PrimitiveMode.TRIANGLES,
      vertexBufferId: 'vb_' + meshId,
      indexBufferId: 'ib_' + meshId,
      meshId: meshId,
      vertexCount: 36,
      vertexLayout: {
        attributes: [
          { name: 'a_position', size: 3, type: 'float' },
        ],
      },
    },
    materialId: materialId,
    worldMatrix: new Float32Array(16),
    depth: 0,
    sortKey: 0,
  };

  // Compute material hash (same algorithm as RenderQueue)
  command._cachedMaterialHash = computeMaterialHash(command);

  return command;
}

// Helper to compute material hash (replicates RenderQueue logic)
function computeMaterialHash(command: QueuedDrawCommand): number {
  let hash = 2166136261; // FNV offset basis

  // Hash uniforms
  if (command.drawCommand.uniforms) {
    const uniformEntries = Array.from(command.drawCommand.uniforms.entries());
    for (let i = 0; i < uniformEntries.length; i++) {
      const [key, uniform] = uniformEntries[i];
      hash ^= hashString(key);
      hash = Math.imul(hash, 16777619);
      hash ^= hashUniformValue(uniform.value);
      hash = Math.imul(hash, 16777619);
    }
  }

  // Hash textures
  if (command.drawCommand.textures) {
    const textureEntries = Array.from(command.drawCommand.textures.entries());
    for (let i = 0; i < textureEntries.length; i++) {
      const [unit, textureId] = textureEntries[i];
      hash ^= unit;
      hash = Math.imul(hash, 16777619);
      hash ^= hashString(textureId);
      hash = Math.imul(hash, 16777619);
    }
  }

  // Hash render state
  if (command.renderState) {
    if (command.renderState.blendMode) {
      hash ^= hashString(command.renderState.blendMode);
      hash = Math.imul(hash, 16777619);
    }
    if (command.renderState.depthTest) {
      hash ^= hashString(command.renderState.depthTest);
      hash = Math.imul(hash, 16777619);
    }
    if (command.renderState.cullMode) {
      hash ^= hashString(command.renderState.cullMode);
      hash = Math.imul(hash, 16777619);
    }
  }

  return hash >>> 0;
}

function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashUniformValue(value: number | number[] | Float32Array): number {
  if (typeof value === 'number') {
    return Math.floor(value * 1000000);
  }

  let hash = 0;
  const length = Array.isArray(value) ? value.length : value.length;
  for (let i = 0; i < length; i++) {
    const v = Array.isArray(value) ? value[i] : value[i];
    hash ^= Math.floor(v * 1000000);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
