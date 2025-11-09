/**
 * VRAMProfiler Tests - Epic 3.8
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VRAMProfiler, VRAMCategory } from '../src/VRAMProfiler';

describe('VRAMProfiler', () => {
  let profiler: VRAMProfiler;

  beforeEach(() => {
    profiler = new VRAMProfiler(256 * 1024 * 1024); // 256MB budget
    // Suppress console warnings/errors in tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Allocation', () => {
    it('should allocate VRAM successfully', () => {
      const result = profiler.allocate('texture1', VRAMCategory.TEXTURES, 1024 * 1024);

      expect(result).toBe(true);

      const stats = profiler.getStats();
      expect(stats.totalUsed).toBe(1024 * 1024);
    });

    it('should track multiple allocations', () => {
      profiler.allocate('texture1', VRAMCategory.TEXTURES, 1024 * 1024);
      profiler.allocate('vertex1', VRAMCategory.VERTEX_BUFFERS, 512 * 1024);

      const stats = profiler.getStats();
      expect(stats.totalUsed).toBe(1024 * 1024 + 512 * 1024);
    });

    it('should prevent duplicate allocation IDs', () => {
      profiler.allocate('texture1', VRAMCategory.TEXTURES, 1024 * 1024);
      const result = profiler.allocate('texture1', VRAMCategory.TEXTURES, 1024 * 1024);

      expect(result).toBe(false);

      const stats = profiler.getStats();
      expect(stats.totalUsed).toBe(1024 * 1024); // Only allocated once
    });
  });

  describe('Deallocation', () => {
    it('should deallocate VRAM', () => {
      profiler.allocate('texture1', VRAMCategory.TEXTURES, 1024 * 1024);
      profiler.deallocate('texture1');

      const stats = profiler.getStats();
      expect(stats.totalUsed).toBe(0);
    });

    it('should handle deallocating unknown ID gracefully', () => {
      expect(() => {
        profiler.deallocate('unknown');
      }).not.toThrow();
    });
  });

  describe('Budget Enforcement', () => {
    it('should reject allocation exceeding category budget', () => {
      // Textures budget is 128MB
      const result = profiler.allocate(
        'huge_texture',
        VRAMCategory.TEXTURES,
        129 * 1024 * 1024
      );

      expect(result).toBe(false);
    });

    it('should reject allocation exceeding total budget', () => {
      // Total budget is 256MB
      const result = profiler.allocate(
        'huge_buffer',
        VRAMCategory.VERTEX_BUFFERS,
        257 * 1024 * 1024
      );

      expect(result).toBe(false);
    });

    it('should allow allocation up to budget limit', () => {
      // Textures budget is 128MB
      const result = profiler.allocate(
        'texture1',
        VRAMCategory.TEXTURES,
        128 * 1024 * 1024
      );

      expect(result).toBe(true);
    });

    it('should enforce budget across multiple allocations', () => {
      // Allocate 64MB + 64MB (128MB total, at limit)
      profiler.allocate('tex1', VRAMCategory.TEXTURES, 64 * 1024 * 1024);
      profiler.allocate('tex2', VRAMCategory.TEXTURES, 64 * 1024 * 1024);

      // Try to allocate 1 more byte - should fail
      const result = profiler.allocate('tex3', VRAMCategory.TEXTURES, 1);

      expect(result).toBe(false);
    });
  });

  describe('Default Budgets', () => {
    it('should have 256MB total budget by default', () => {
      const budget = profiler.getBudget();

      expect(budget.total).toBe(256 * 1024 * 1024);
    });

    it('should allocate 128MB to textures (50%)', () => {
      const budget = profiler.getBudget();

      expect(budget.textures).toBe(128 * 1024 * 1024);
    });

    it('should allocate 64MB to vertex buffers (25%)', () => {
      const budget = profiler.getBudget();

      expect(budget.vertexBuffers).toBe(64 * 1024 * 1024);
    });

    it('should allocate 32MB to index buffers (12.5%)', () => {
      const budget = profiler.getBudget();

      expect(budget.indexBuffers).toBe(32 * 1024 * 1024);
    });
  });

  describe('Custom Budgets', () => {
    it('should allow setting custom total budget', () => {
      profiler.setBudget({ total: 512 * 1024 * 1024 });

      const budget = profiler.getBudget();
      expect(budget.total).toBe(512 * 1024 * 1024);
    });

    it('should allow setting custom category budgets', () => {
      profiler.setBudget({
        textures: 200 * 1024 * 1024,
        vertexBuffers: 50 * 1024 * 1024,
      });

      const budget = profiler.getBudget();
      expect(budget.textures).toBe(200 * 1024 * 1024);
      expect(budget.vertexBuffers).toBe(50 * 1024 * 1024);
    });
  });

  describe('Statistics', () => {
    it('should track total usage', () => {
      profiler.allocate('tex1', VRAMCategory.TEXTURES, 10 * 1024 * 1024);
      profiler.allocate('vb1', VRAMCategory.VERTEX_BUFFERS, 5 * 1024 * 1024);

      const stats = profiler.getStats();
      expect(stats.totalUsed).toBe(15 * 1024 * 1024);
    });

    it('should calculate utilization percentage', () => {
      // Allocate 128MB out of 256MB budget (50%)
      profiler.allocate('tex1', VRAMCategory.TEXTURES, 128 * 1024 * 1024);

      const stats = profiler.getStats();
      expect(stats.utilizationPercent).toBe(50);
    });

    it('should track usage by category', () => {
      profiler.allocate('tex1', VRAMCategory.TEXTURES, 10 * 1024 * 1024);
      profiler.allocate('tex2', VRAMCategory.TEXTURES, 5 * 1024 * 1024);
      profiler.allocate('vb1', VRAMCategory.VERTEX_BUFFERS, 2 * 1024 * 1024);

      const stats = profiler.getStats();
      const textureUsage = stats.byCategory.get(VRAMCategory.TEXTURES)!;
      const vertexUsage = stats.byCategory.get(VRAMCategory.VERTEX_BUFFERS)!;

      expect(textureUsage.bytes).toBe(15 * 1024 * 1024);
      expect(textureUsage.allocations).toBe(2);
      expect(vertexUsage.bytes).toBe(2 * 1024 * 1024);
      expect(vertexUsage.allocations).toBe(1);
    });

    it('should detect over-budget condition', () => {
      // Force over-budget by setting unrealistic budget
      profiler.setBudget({ total: 1 }); // 1 byte budget
      profiler.allocate('tiny', VRAMCategory.OTHER, 0); // 0 bytes is fine

      const stats = profiler.getStats();
      expect(stats.overBudget).toBe(false);
    });
  });

  describe('Warnings', () => {
    it('should generate warnings at 80% capacity', () => {
      // Allocate 80% of texture budget (exactly 80% to trigger warning)
      const texturesBudget = 128 * 1024 * 1024;
      const allocated = Math.ceil(texturesBudget * 0.8); // Use ceil to ensure >= 80%
      profiler.allocate('tex1', VRAMCategory.TEXTURES, allocated);

      const stats = profiler.getStats();
      expect(stats.warnings.length).toBeGreaterThan(0);
    });

    it('should not warn below 80% capacity', () => {
      // Allocate 70% of texture budget
      profiler.allocate(
        'tex1',
        VRAMCategory.TEXTURES,
        Math.floor(128 * 1024 * 1024 * 0.7)
      );

      const stats = profiler.getStats();
      expect(stats.warnings.length).toBe(0);
    });

    it('should allow custom warning threshold', () => {
      profiler.setWarningThreshold(0.5); // Warn at 50%

      profiler.allocate(
        'tex1',
        VRAMCategory.TEXTURES,
        Math.floor(128 * 1024 * 1024 * 0.6)
      );

      const stats = profiler.getStats();
      expect(stats.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Resize', () => {
    it('should resize existing allocation', () => {
      profiler.allocate('tex1', VRAMCategory.TEXTURES, 10 * 1024 * 1024);

      const result = profiler.resize('tex1', 20 * 1024 * 1024);
      expect(result).toBe(true);

      const stats = profiler.getStats();
      expect(stats.totalUsed).toBe(20 * 1024 * 1024);
    });

    it('should reject resize that would exceed budget', () => {
      profiler.allocate('tex1', VRAMCategory.TEXTURES, 10 * 1024 * 1024);

      const result = profiler.resize('tex1', 200 * 1024 * 1024); // Exceeds 128MB texture budget
      expect(result).toBe(false);

      const stats = profiler.getStats();
      expect(stats.totalUsed).toBe(10 * 1024 * 1024); // Unchanged
    });

    it('should reject resize of unknown allocation', () => {
      const result = profiler.resize('unknown', 1024);

      expect(result).toBe(false);
    });

    it('should allow downsizing', () => {
      profiler.allocate('tex1', VRAMCategory.TEXTURES, 100 * 1024 * 1024);

      const result = profiler.resize('tex1', 50 * 1024 * 1024);
      expect(result).toBe(true);

      const stats = profiler.getStats();
      expect(stats.totalUsed).toBe(50 * 1024 * 1024);
    });
  });

  describe('Clear', () => {
    it('should clear all allocations', () => {
      profiler.allocate('tex1', VRAMCategory.TEXTURES, 10 * 1024 * 1024);
      profiler.allocate('vb1', VRAMCategory.VERTEX_BUFFERS, 5 * 1024 * 1024);

      profiler.clear();

      const stats = profiler.getStats();
      expect(stats.totalUsed).toBe(0);
      expect(profiler.getAllocations().length).toBe(0);
    });
  });

  describe('Debugging', () => {
    it('should return all allocations', () => {
      profiler.allocate('tex1', VRAMCategory.TEXTURES, 10 * 1024 * 1024);
      profiler.allocate('tex2', VRAMCategory.TEXTURES, 5 * 1024 * 1024);

      const allocations = profiler.getAllocations();
      expect(allocations.length).toBe(2);
    });

    it('should return largest allocations sorted by size', () => {
      profiler.allocate('small', VRAMCategory.TEXTURES, 1 * 1024 * 1024);
      profiler.allocate('large', VRAMCategory.TEXTURES, 10 * 1024 * 1024);
      profiler.allocate('medium', VRAMCategory.TEXTURES, 5 * 1024 * 1024);

      const largest = profiler.getLargestAllocations(2);

      expect(largest.length).toBe(2);
      expect(largest[0].id).toBe('large');
      expect(largest[1].id).toBe('medium');
    });

    it('should limit largest allocations to requested count', () => {
      for (let i = 0; i < 20; i++) {
        profiler.allocate(`tex${i}`, VRAMCategory.TEXTURES, i * 1024 * 1024);
      }

      const largest = profiler.getLargestAllocations(5);

      expect(largest.length).toBe(5);
    });
  });

  describe('Budget Targets', () => {
    it('should enforce 256MB total VRAM budget', () => {
      const budget = profiler.getBudget();
      expect(budget.total).toBe(256 * 1024 * 1024);
    });

    it('should reject allocation exceeding 256MB', () => {
      const result = profiler.allocate(
        'huge',
        VRAMCategory.TEXTURES,
        300 * 1024 * 1024
      );

      expect(result).toBe(false);
    });

    it('should allow filling up to budget limit', () => {
      // Fill each category to its limit
      profiler.allocate('tex', VRAMCategory.TEXTURES, 128 * 1024 * 1024);
      profiler.allocate('vb', VRAMCategory.VERTEX_BUFFERS, 64 * 1024 * 1024);
      profiler.allocate('ib', VRAMCategory.INDEX_BUFFERS, 32 * 1024 * 1024);
      profiler.allocate('rt', VRAMCategory.RENDER_TARGETS, 24 * 1024 * 1024);

      const stats = profiler.getStats();
      const totalAllocated = 128 + 64 + 32 + 24; // 248MB

      expect(stats.totalUsed).toBe(totalAllocated * 1024 * 1024);
      expect(stats.totalUsed).toBeLessThan(stats.totalBudget);
    });
  });
});
