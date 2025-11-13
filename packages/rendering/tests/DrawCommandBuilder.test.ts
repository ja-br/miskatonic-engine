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
});
