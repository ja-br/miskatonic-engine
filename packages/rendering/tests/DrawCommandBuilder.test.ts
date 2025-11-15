/**
 * DrawCommandBuilder Tests - Epic 3.14
 */

import { describe, it, expect } from 'vitest';
import { DrawCommandBuilder } from '../src/commands/DrawCommandBuilder';
import type { BackendPipelineHandle, BackendBindGroupHandle, BackendBufferHandle } from '../src/backends/IRendererBackend';

// Mock handles
const mockPipeline: BackendPipelineHandle = { __brand: 'BackendPipeline' as const, id: 'pipeline_1', type: 'render' };
const mockBindGroup: BackendBindGroupHandle = { __brand: 'BackendBindGroup' as const, id: 'bindgroup_1' };
const mockVertexBuffer: BackendBufferHandle = { __brand: 'BackendBuffer' as const, id: 'vb_1' };
const mockIndexBuffer: BackendBufferHandle = { __brand: 'BackendBuffer' as const, id: 'ib_1' };
const mockIndirectBuffer: BackendBufferHandle = { __brand: 'BackendBuffer' as const, id: 'indirect_1' };

describe('DrawCommandBuilder', () => {
  describe('Indexed Geometry', () => {
    it('should build valid indexed draw command', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      const command = new DrawCommandBuilder()
        .pipeline(mockPipeline)
        .bindGroup(0, mockBindGroup)
        .indexed(vertexBuffers, mockIndexBuffer, 'uint16', 36)
        .build();

      expect(command.pipeline).toBe(mockPipeline);
      expect(command.bindGroups.get(0)).toBe(mockBindGroup);
      expect(command.geometry.type).toBe('indexed');

      if (command.geometry.type === 'indexed') {
        expect(command.geometry.vertexBuffers.get(0)).toBe(mockVertexBuffer);
        expect(command.geometry.indexBuffer).toBe(mockIndexBuffer);
        expect(command.geometry.indexFormat).toBe('uint16');
        expect(command.geometry.indexCount).toBe(36);
      }
    });

    it('should accept optional indexed parameters', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      const command = new DrawCommandBuilder()
        .pipeline(mockPipeline)
        .bindGroup(0, mockBindGroup)
        .indexed(vertexBuffers, mockIndexBuffer, 'uint32', 100)
        .instanceCount(10)
        .firstIndex(5)
        .baseVertex(2)
        .firstInstance(1)
        .build();

      if (command.geometry.type === 'indexed') {
        expect(command.geometry.instanceCount).toBe(10);
        expect(command.geometry.firstIndex).toBe(5);
        expect(command.geometry.baseVertex).toBe(2);
        expect(command.geometry.firstInstance).toBe(1);
      }
    });

    it('should throw on empty vertex buffers', () => {
      const vertexBuffers = new Map<number, BackendBufferHandle>();

      expect(() => {
        new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(0, mockBindGroup)
          .indexed(vertexBuffers, mockIndexBuffer, 'uint16', 36)
          .build();
      }).toThrow('At least one vertex buffer is required');
    });

    it('should throw on zero index count', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      expect(() => {
        new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(0, mockBindGroup)
          .indexed(vertexBuffers, mockIndexBuffer, 'uint16', 0)
          .build();
      }).toThrow('Index count must be positive');
    });

    it('should throw on negative index count', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      expect(() => {
        new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(0, mockBindGroup)
          .indexed(vertexBuffers, mockIndexBuffer, 'uint16', -10)
          .build();
      }).toThrow('Index count must be positive');
    });
  });

  describe('Non-Indexed Geometry', () => {
    it('should build valid non-indexed draw command', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      const command = new DrawCommandBuilder()
        .pipeline(mockPipeline)
        .bindGroup(0, mockBindGroup)
        .nonIndexed(vertexBuffers, 36)
        .build();

      expect(command.geometry.type).toBe('nonIndexed');

      if (command.geometry.type === 'nonIndexed') {
        expect(command.geometry.vertexBuffers.get(0)).toBe(mockVertexBuffer);
        expect(command.geometry.vertexCount).toBe(36);
      }
    });

    it('should accept optional non-indexed parameters', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      const command = new DrawCommandBuilder()
        .pipeline(mockPipeline)
        .bindGroup(0, mockBindGroup)
        .nonIndexed(vertexBuffers, 100)
        .instanceCount(5)
        .firstVertex(10)
        .firstInstance(2)
        .build();

      if (command.geometry.type === 'nonIndexed') {
        expect(command.geometry.instanceCount).toBe(5);
        expect(command.geometry.firstVertex).toBe(10);
        expect(command.geometry.firstInstance).toBe(2);
      }
    });

    it('should throw on zero vertex count', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      expect(() => {
        new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(0, mockBindGroup)
          .nonIndexed(vertexBuffers, 0)
          .build();
      }).toThrow('Vertex count must be positive');
    });
  });

  describe('Indirect Geometry', () => {
    it('should build valid indirect draw command', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      const command = new DrawCommandBuilder()
        .pipeline(mockPipeline)
        .bindGroup(0, mockBindGroup)
        .indirect(vertexBuffers, mockIndirectBuffer, 0)
        .build();

      expect(command.geometry.type).toBe('indirect');

      if (command.geometry.type === 'indirect') {
        expect(command.geometry.vertexBuffers.get(0)).toBe(mockVertexBuffer);
        expect(command.geometry.indirectBuffer).toBe(mockIndirectBuffer);
        expect(command.geometry.indirectOffset).toBe(0);
      }
    });

    it('should accept indexed indirect with index buffer', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      const command = new DrawCommandBuilder()
        .pipeline(mockPipeline)
        .bindGroup(0, mockBindGroup)
        .indirect(vertexBuffers, mockIndirectBuffer, 0, mockIndexBuffer, 'uint32')
        .build();

      if (command.geometry.type === 'indirect') {
        expect(command.geometry.indexBuffer).toBe(mockIndexBuffer);
        expect(command.geometry.indexFormat).toBe('uint32');
      }
    });

    it('should throw on negative indirect offset', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      expect(() => {
        new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(0, mockBindGroup)
          .indirect(vertexBuffers, mockIndirectBuffer, -4)
          .build();
      }).toThrow('Indirect offset must be non-negative');
    });

    it('should throw on misaligned indirect offset', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      expect(() => {
        new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(0, mockBindGroup)
          .indirect(vertexBuffers, mockIndirectBuffer, 7)
          .build();
      }).toThrow('Indirect offset must be 4-byte aligned');
    });

    it('should accept 4-byte aligned offsets', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      const command = new DrawCommandBuilder()
        .pipeline(mockPipeline)
        .bindGroup(0, mockBindGroup)
        .indirect(vertexBuffers, mockIndirectBuffer, 16)
        .build();

      if (command.geometry.type === 'indirect') {
        expect(command.geometry.indirectOffset).toBe(16);
      }
    });
  });

  describe('Compute Geometry', () => {
    it('should build valid compute dispatch command', () => {
      const command = new DrawCommandBuilder()
        .pipeline(mockPipeline)
        .bindGroup(0, mockBindGroup)
        .compute([8, 8, 1])
        .build();

      expect(command.geometry.type).toBe('compute');

      if (command.geometry.type === 'compute') {
        expect(command.geometry.workgroups).toEqual([8, 8, 1]);
      }
    });

    it('should validate workgroups if maxPerDimension provided', () => {
      expect(() => {
        new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(0, mockBindGroup)
          .compute([100000, 1, 1], 65535)
          .build();
      }).toThrow('exceeds device limit');
    });
  });

  describe('Builder Validation', () => {
    it('should throw if pipeline not set', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      expect(() => {
        new DrawCommandBuilder()
          .bindGroup(0, mockBindGroup)
          .indexed(vertexBuffers, mockIndexBuffer, 'uint16', 36)
          .build();
      }).toThrow('Pipeline is required');
    });

    it('should throw if geometry not set', () => {
      expect(() => {
        new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(0, mockBindGroup)
          .build();
      }).toThrow('No geometry configured');
    });

    it('should warn if no bind groups', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      new DrawCommandBuilder()
        .pipeline(mockPipeline)
        .indexed(vertexBuffers, mockIndexBuffer, 'uint16', 36)
        .build();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No bind groups added'));
      warnSpy.mockRestore();
    });

    it('should throw if multiple geometry methods called', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      expect(() => {
        new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(0, mockBindGroup)
          .indexed(vertexBuffers, mockIndexBuffer, 'uint16', 36)
          .nonIndexed(vertexBuffers, 36)
          .build();
      }).toThrow('Geometry already configured');
    });

    it('should throw on invalid bind group slot (negative)', () => {
      expect(() => {
        new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(-1, mockBindGroup);
      }).toThrow('Bind group slot must be 0-3');
    });

    it('should throw on invalid bind group slot (too high)', () => {
      expect(() => {
        new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(4, mockBindGroup);
      }).toThrow('Bind group slot must be 0-3');
    });
  });

  describe('Builder Reuse Protection', () => {
    it('should reset state after build()', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);
      const builder = new DrawCommandBuilder();

      builder
        .pipeline(mockPipeline)
        .bindGroup(0, mockBindGroup)
        .indexed(vertexBuffers, mockIndexBuffer, 'uint16', 36)
        .build();

      // Builder should be reset, so this should throw
      expect(() => {
        builder.build();
      }).toThrow('Pipeline is required');
    });

    it('should isolate bind groups between successive builds', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);
      const builder = new DrawCommandBuilder();
      const bindGroup2: BackendBindGroupHandle = {
        __brand: 'BackendBindGroup' as const,
        id: 'bg-2'
      };

      // First build
      const cmd1 = builder
        .pipeline(mockPipeline)
        .bindGroup(0, mockBindGroup)
        .indexed(vertexBuffers, mockIndexBuffer, 'uint16', 36)
        .build();

      // Attempt to mutate cmd1's bind groups (should not affect cmd2)
      const hackGroup: BackendBindGroupHandle = {
        __brand: 'BackendBindGroup' as const,
        id: 'hack-group'
      };
      cmd1.bindGroups.set(999, hackGroup);

      // Second build
      const cmd2 = builder
        .pipeline(mockPipeline)
        .bindGroup(0, bindGroup2)
        .indexed(vertexBuffers, mockIndexBuffer, 'uint16', 36)
        .build();

      // cmd2 should NOT have the hacked bind group
      expect(cmd2.bindGroups.has(999)).toBe(false);
      expect(cmd2.bindGroups.get(0)).toBe(bindGroup2);
      expect(cmd1.bindGroups.get(0)).toBe(mockBindGroup);
      expect(cmd1.bindGroups.get(999)).toBe(hackGroup); // cmd1 was mutated
    });
  });

  describe('Label and Debug Info', () => {
    it('should accept label', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      const command = new DrawCommandBuilder()
        .pipeline(mockPipeline)
        .bindGroup(0, mockBindGroup)
        .indexed(vertexBuffers, mockIndexBuffer, 'uint16', 36)
        .label('Test Draw')
        .build();

      expect(command.label).toBe('Test Draw');
    });

    it('should accept debug info', () => {
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      const command = new DrawCommandBuilder()
        .pipeline(mockPipeline)
        .bindGroup(0, mockBindGroup)
        .indexed(vertexBuffers, mockIndexBuffer, 'uint16', 36)
        .debugInfo({ drawCallId: 'draw_1', pass: 'main' })
        .build();

      expect(command.debugInfo).toEqual({ drawCallId: 'draw_1', pass: 'main' });
    });
  });

  describe('Multiple Vertex Buffer Slots', () => {
    it('should handle multiple vertex buffers in different slots', () => {
      const vb1: BackendBufferHandle = { __brand: 'BackendBuffer' as const, id: 'vb_1' };
      const vb2: BackendBufferHandle = { __brand: 'BackendBuffer' as const, id: 'vb_2' };
      const vertexBuffers = new Map([[0, vb1], [1, vb2]]);

      const command = new DrawCommandBuilder()
        .pipeline(mockPipeline)
        .bindGroup(0, mockBindGroup)
        .indexed(vertexBuffers, mockIndexBuffer, 'uint16', 36)
        .build();

      if (command.geometry.type === 'indexed') {
        expect(command.geometry.vertexBuffers.size).toBe(2);
        expect(command.geometry.vertexBuffers.get(0)).toBe(vb1);
        expect(command.geometry.vertexBuffers.get(1)).toBe(vb2);
      }
    });
  });

  describe('Multiple Bind Groups', () => {
    it('should handle multiple bind groups in different slots', () => {
      const bg0: BackendBindGroupHandle = { __brand: 'BackendBindGroup' as const, id: 'bg_0' };
      const bg1: BackendBindGroupHandle = { __brand: 'BackendBindGroup' as const, id: 'bg_1' };
      const vertexBuffers = new Map([[0, mockVertexBuffer]]);

      const command = new DrawCommandBuilder()
        .pipeline(mockPipeline)
        .bindGroup(0, bg0)
        .bindGroup(1, bg1)
        .indexed(vertexBuffers, mockIndexBuffer, 'uint16', 36)
        .build();

      expect(command.bindGroups.size).toBe(2);
      expect(command.bindGroups.get(0)).toBe(bg0);
      expect(command.bindGroups.get(1)).toBe(bg1);
    });
  });

  // Epic RENDERING-06 Task 6.3: Enhanced DrawCommandBuilder tests

  describe('Enhanced Features (Epic RENDERING-06)', () => {
    describe('bindGroups() - Batch binding', () => {
      it('should add multiple bind groups at once', () => {
        const vertexBuffers = new Map([[0, mockVertexBuffer]]);
        const bindGroups = new Map([
          [0, mockBindGroup],
          [1, mockBindGroup],
          [2, mockBindGroup]
        ]);

        const command = new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroups(bindGroups)
          .indexed(vertexBuffers, mockIndexBuffer, 'uint16', 36)
          .build();

        expect(command.bindGroups.size).toBe(3);
        expect(command.bindGroups.get(0)).toBe(mockBindGroup);
        expect(command.bindGroups.get(1)).toBe(mockBindGroup);
        expect(command.bindGroups.get(2)).toBe(mockBindGroup);
      });

      it('should validate bind group slots', () => {
        const badBindGroups = new Map([[5, mockBindGroup]]); // Invalid slot

        expect(() => {
          new DrawCommandBuilder()
            .pipeline(mockPipeline)
            .bindGroups(badBindGroups);
        }).toThrow('Bind group slot must be 0-3');
      });
    });

    describe('Array vertex buffer support', () => {
      it('should accept array of vertex buffers in indexed()', () => {
        const command = new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(0, mockBindGroup)
          .indexed([mockVertexBuffer], mockIndexBuffer, 'uint16', 36)
          .build();

        expect(command.geometry.type).toBe('indexed');
        expect(command.geometry.vertexBuffers.size).toBe(1);
        expect(command.geometry.vertexBuffers.get(0)).toBe(mockVertexBuffer);
      });

      it('should accept array of vertex buffers in nonIndexed()', () => {
        const command = new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(0, mockBindGroup)
          .nonIndexed([mockVertexBuffer], 36)
          .build();

        expect(command.geometry.type).toBe('nonIndexed');
        expect(command.geometry.vertexBuffers.size).toBe(1);
        expect(command.geometry.vertexBuffers.get(0)).toBe(mockVertexBuffer);
      });
    });

    describe('Options objects', () => {
      it('should accept options in indexed()', () => {
        const command = new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(0, mockBindGroup)
          .indexed([mockVertexBuffer], mockIndexBuffer, 'uint16', 36, {
            instanceCount: 100,
            firstIndex: 10,
            baseVertex: 5,
            firstInstance: 2
          })
          .build();

        const geom = command.geometry as any;
        expect(geom.instanceCount).toBe(100);
        expect(geom.firstIndex).toBe(10);
        expect(geom.baseVertex).toBe(5);
        expect(geom.firstInstance).toBe(2);
      });

      it('should accept options in nonIndexed()', () => {
        const command = new DrawCommandBuilder()
          .pipeline(mockPipeline)
          .bindGroup(0, mockBindGroup)
          .nonIndexed([mockVertexBuffer], 36, {
            instanceCount: 50,
            firstVertex: 10,
            firstInstance: 1
          })
          .build();

        const geom = command.geometry as any;
        expect(geom.instanceCount).toBe(50);
        expect(geom.firstVertex).toBe(10);
        expect(geom.firstInstance).toBe(1);
      });
    });

    describe('Quick builder static methods', () => {
      it('should create simple indexed draw with quickIndexed()', () => {
        const command = DrawCommandBuilder.quickIndexed(
          mockPipeline,
          mockBindGroup,
          mockVertexBuffer,
          mockIndexBuffer,
          36
        );

        expect(command.pipeline).toBe(mockPipeline);
        expect(command.bindGroups.get(0)).toBe(mockBindGroup);
        expect(command.geometry.type).toBe('indexed');
        const geom = command.geometry as any;
        expect(geom.indexCount).toBe(36);
        expect(geom.indexFormat).toBe('uint16');
      });

      it('should create simple non-indexed draw with quickNonIndexed()', () => {
        const command = DrawCommandBuilder.quickNonIndexed(
          mockPipeline,
          mockBindGroup,
          mockVertexBuffer,
          36
        );

        expect(command.pipeline).toBe(mockPipeline);
        expect(command.bindGroups.get(0)).toBe(mockBindGroup);
        expect(command.geometry.type).toBe('nonIndexed');
        const geom = command.geometry as any;
        expect(geom.vertexCount).toBe(36);
      });

      it('should create instanced draw with quickInstanced()', () => {
        const command = DrawCommandBuilder.quickInstanced(
          mockPipeline,
          mockBindGroup,
          mockVertexBuffer,
          mockIndexBuffer,
          36,
          100
        );

        expect(command.pipeline).toBe(mockPipeline);
        expect(command.bindGroups.get(0)).toBe(mockBindGroup);
        expect(command.geometry.type).toBe('indexed');
        const geom = command.geometry as any;
        expect(geom.indexCount).toBe(36);
        expect(geom.instanceCount).toBe(100);
      });

      it('should support custom indexFormat in quickIndexed()', () => {
        const command = DrawCommandBuilder.quickIndexed(
          mockPipeline,
          mockBindGroup,
          mockVertexBuffer,
          mockIndexBuffer,
          36,
          'uint32'
        );

        const geom = command.geometry as any;
        expect(geom.indexFormat).toBe('uint32');
      });

      it('should reject compute pipeline in quickIndexed()', () => {
        const computePipeline: BackendPipelineHandle = {
          __brand: 'BackendPipeline' as const,
          id: 'compute-1',
          type: 'compute'
        };

        expect(() => {
          DrawCommandBuilder.quickIndexed(
            computePipeline,
            mockBindGroup,
            mockVertexBuffer,
            mockIndexBuffer,
            36
          );
        }).toThrow('quickIndexed requires render pipeline');
      });

      it('should reject compute pipeline in quickNonIndexed()', () => {
        const computePipeline: BackendPipelineHandle = {
          __brand: 'BackendPipeline' as const,
          id: 'compute-1',
          type: 'compute'
        };

        expect(() => {
          DrawCommandBuilder.quickNonIndexed(
            computePipeline,
            mockBindGroup,
            mockVertexBuffer,
            36
          );
        }).toThrow('quickNonIndexed requires render pipeline');
      });

      it('should reject compute pipeline in quickInstanced()', () => {
        const computePipeline: BackendPipelineHandle = {
          __brand: 'BackendPipeline' as const,
          id: 'compute-1',
          type: 'compute'
        };

        expect(() => {
          DrawCommandBuilder.quickInstanced(
            computePipeline,
            mockBindGroup,
            mockVertexBuffer,
            mockIndexBuffer,
            36,
            100
          );
        }).toThrow('quickInstanced requires render pipeline');
      });
    });
  });
});
