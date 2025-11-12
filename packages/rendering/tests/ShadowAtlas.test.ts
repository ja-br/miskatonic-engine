/**
 * Shadow Atlas Tests - Epic 3.17 Phase 1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ShadowAtlas, ShadowQuality } from '../src/shadows/ShadowAtlas';
import { createMockGPUDevice } from './mocks/mockWebGPU';

describe('ShadowAtlas', () => {
  let device: GPUDevice;

  beforeEach(() => {
    device = createMockGPUDevice();
  });

  describe('Construction', () => {
    it('should create atlas with HIGH quality (4096x4096)', () => {
      const atlas = new ShadowAtlas({
        device,
        quality: ShadowQuality.HIGH,
      });

      const stats = atlas.getStats();
      expect(stats.size).toBe(4096);
      expect(stats.format).toBe('depth32float');
      expect(stats.memoryUsageBytes).toBe(4096 * 4096 * 4); // 64MB

      atlas.destroy();
    });

    it('should create atlas with MEDIUM quality (2048x2048)', () => {
      const atlas = new ShadowAtlas({
        device,
        quality: ShadowQuality.MEDIUM,
      });

      const stats = atlas.getStats();
      expect(stats.size).toBe(2048);
      expect(stats.memoryUsageBytes).toBe(2048 * 2048 * 4); // 16MB

      atlas.destroy();
    });

    it('should create atlas with LOW quality (1024x1024)', () => {
      const atlas = new ShadowAtlas({
        device,
        quality: ShadowQuality.LOW,
      });

      const stats = atlas.getStats();
      expect(stats.size).toBe(1024);
      expect(stats.memoryUsageBytes).toBe(1024 * 1024 * 4); // 4MB

      atlas.destroy();
    });

    it('should create atlas with custom size', () => {
      const atlas = new ShadowAtlas({
        device,
        size: 512,
      });

      const stats = atlas.getStats();
      expect(stats.size).toBe(512);

      atlas.destroy();
    });

    it('should default to MEDIUM quality', () => {
      const atlas = new ShadowAtlas({ device });
      expect(atlas.getStats().size).toBe(2048);
      atlas.destroy();
    });

    it('should throw on non-power-of-2 size', () => {
      expect(() => {
        new ShadowAtlas({ device, size: 1000 });
      }).toThrow('power of 2');
    });

    it('should throw on zero size', () => {
      expect(() => {
        new ShadowAtlas({ device, size: 0 });
      }).toThrow('power of 2');
    });

    it('should throw on negative size', () => {
      expect(() => {
        new ShadowAtlas({ device, size: -1024 });
      }).toThrow('power of 2');
    });

    it('should accept custom texture format', () => {
      const atlas = new ShadowAtlas({
        device,
        size: 1024,
        format: 'depth24plus',
      });

      expect(atlas.getStats().format).toBe('depth24plus');
      atlas.destroy();
    });
  });

  describe('Allocation', () => {
    it('should allocate single region', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const region = atlas.allocate(512, 512);
      expect(region).not.toBeNull();
      expect(region!.width).toBe(512);
      expect(region!.height).toBe(512);
      expect(region!.x).toBe(0);
      expect(region!.y).toBe(0);

      atlas.destroy();
    });

    it('should allocate multiple regions', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const r1 = atlas.allocate(512, 512);
      const r2 = atlas.allocate(512, 512);
      const r3 = atlas.allocate(256, 256);

      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
      expect(r3).not.toBeNull();

      // Verify unique IDs
      expect(r1!.id).not.toBe(r2!.id);
      expect(r2!.id).not.toBe(r3!.id);

      atlas.destroy();
    });

    it('should compute correct UV bounds', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const region = atlas.allocate(512, 512);
      expect(region!.uvBounds).toEqual([0, 0, 0.5, 0.5]);

      atlas.destroy();
    });

    it('should return null when atlas is full', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      // Fill atlas
      const r1 = atlas.allocate(1024, 1024);
      expect(r1).not.toBeNull();

      // Try to allocate more
      const r2 = atlas.allocate(256, 256);
      expect(r2).toBeNull();

      atlas.destroy();
    });

    it('should return null for oversized allocation', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const region = atlas.allocate(2048, 2048);
      expect(region).toBeNull();

      atlas.destroy();
    });

    it('should return null for zero size allocation', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const region = atlas.allocate(0, 512);
      expect(region).toBeNull();

      atlas.destroy();
    });

    it('should return null for negative size allocation', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const region = atlas.allocate(-256, 256);
      expect(region).toBeNull();

      atlas.destroy();
    });

    it('should use best-fit allocation strategy', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      // Allocate and free to create gaps
      const r1 = atlas.allocate(512, 512);
      const r2 = atlas.allocate(256, 256);
      atlas.free(r1!.id);

      // Small allocation should use smaller free rect if available
      const r3 = atlas.allocate(128, 128);
      expect(r3).not.toBeNull();

      atlas.destroy();
    });
  });

  describe('Deallocation', () => {
    it('should free allocated region', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const region = atlas.allocate(512, 512);
      expect(region).not.toBeNull();

      const freed = atlas.free(region!.id);
      expect(freed).toBe(true);

      // Should be able to allocate again
      const region2 = atlas.allocate(512, 512);
      expect(region2).not.toBeNull();

      atlas.destroy();
    });

    it('should return false for invalid region ID', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const freed = atlas.free(999);
      expect(freed).toBe(false);

      atlas.destroy();
    });

    it('should handle double free gracefully', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const region = atlas.allocate(512, 512);
      atlas.free(region!.id);

      const freed2 = atlas.free(region!.id);
      expect(freed2).toBe(false);

      atlas.destroy();
    });

    it('should allow reallocation after free', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const r1 = atlas.allocate(512, 512);
      atlas.free(r1!.id);

      const r2 = atlas.allocate(512, 512);
      expect(r2).not.toBeNull();

      atlas.destroy();
    });
  });

  describe('Region Management', () => {
    it('should get region by ID', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const allocated = atlas.allocate(512, 512);
      const retrieved = atlas.getRegion(allocated!.id);

      expect(retrieved).toEqual(allocated);

      atlas.destroy();
    });

    it('should return undefined for non-existent region', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const region = atlas.getRegion(999);
      expect(region).toBeUndefined();

      atlas.destroy();
    });

    it('should get all allocated regions', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const r1 = atlas.allocate(512, 512);
      const r2 = atlas.allocate(256, 256);

      const regions = atlas.getRegions();
      expect(regions).toHaveLength(2);
      expect(regions).toContainEqual(r1);
      expect(regions).toContainEqual(r2);

      atlas.destroy();
    });

    it('should return empty array when no regions allocated', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const regions = atlas.getRegions();
      expect(regions).toHaveLength(0);

      atlas.destroy();
    });
  });

  describe('Statistics', () => {
    it('should track allocated pixels', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      atlas.allocate(512, 512);
      atlas.allocate(256, 256);

      const stats = atlas.getStats();
      expect(stats.allocatedPixels).toBe(512 * 512 + 256 * 256);

      atlas.destroy();
    });

    it('should compute utilization', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      atlas.allocate(512, 512); // 25% of atlas

      const stats = atlas.getStats();
      expect(stats.utilization).toBeCloseTo(0.25);

      atlas.destroy();
    });

    it('should track allocated region count', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      atlas.allocate(512, 512);
      atlas.allocate(256, 256);

      const stats = atlas.getStats();
      expect(stats.allocatedRegions).toBe(2);

      atlas.destroy();
    });

    it('should update stats after deallocation', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const r1 = atlas.allocate(512, 512);
      atlas.allocate(256, 256);
      atlas.free(r1!.id);

      const stats = atlas.getStats();
      expect(stats.allocatedRegions).toBe(1);
      expect(stats.allocatedPixels).toBe(256 * 256);

      atlas.destroy();
    });

    it('should report 64MB memory for HIGH quality', () => {
      const atlas = new ShadowAtlas({
        device,
        quality: ShadowQuality.HIGH,
      });

      const stats = atlas.getStats();
      expect(stats.memoryUsageBytes).toBe(64 * 1024 * 1024);

      atlas.destroy();
    });

    it('should report 16MB memory for MEDIUM quality', () => {
      const atlas = new ShadowAtlas({
        device,
        quality: ShadowQuality.MEDIUM,
      });

      const stats = atlas.getStats();
      expect(stats.memoryUsageBytes).toBe(16 * 1024 * 1024);

      atlas.destroy();
    });

    it('should report 4MB memory for LOW quality', () => {
      const atlas = new ShadowAtlas({
        device,
        quality: ShadowQuality.LOW,
      });

      const stats = atlas.getStats();
      expect(stats.memoryUsageBytes).toBe(4 * 1024 * 1024);

      atlas.destroy();
    });
  });

  describe('GPU Resources', () => {
    it('should provide texture for binding', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const texture = atlas.getTexture();
      expect(texture).toBeDefined();

      atlas.destroy();
    });

    it('should provide view for render attachments', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      const view = atlas.getView();
      expect(view).toBeDefined();

      atlas.destroy();
    });

    it('should throw when accessing destroyed texture', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });
      atlas.destroy();

      expect(() => atlas.getTexture()).toThrow('not initialized');
    });

    it('should throw when accessing destroyed view', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });
      atlas.destroy();

      expect(() => atlas.getView()).toThrow('not initialized');
    });
  });

  describe('Clear', () => {
    it('should clear entire atlas', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      // Should not throw
      expect(() => atlas.clear()).not.toThrow();

      atlas.destroy();
    });
  });

  describe('Resize', () => {
    it('should resize atlas', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      atlas.resize(2048);

      const stats = atlas.getStats();
      expect(stats.size).toBe(2048);

      atlas.destroy();
    });

    it('should clear allocations on resize', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      atlas.allocate(512, 512);
      atlas.resize(2048);

      const stats = atlas.getStats();
      expect(stats.allocatedRegions).toBe(0);

      atlas.destroy();
    });

    it('should throw on non-power-of-2 resize', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      expect(() => atlas.resize(1000)).toThrow('power of 2');

      atlas.destroy();
    });
  });

  describe('Stress Tests', () => {
    it('should handle many small allocations', () => {
      const atlas = new ShadowAtlas({ device, size: 2048 });

      const regions: number[] = [];
      for (let i = 0; i < 16; i++) {
        const region = atlas.allocate(256, 256);
        if (region) {
          regions.push(region.id);
        }
      }

      expect(regions.length).toBeGreaterThan(0);

      atlas.destroy();
    });

    it('should handle allocation/deallocation cycles', () => {
      const atlas = new ShadowAtlas({ device, size: 1024 });

      for (let cycle = 0; cycle < 10; cycle++) {
        const r1 = atlas.allocate(256, 256);
        const r2 = atlas.allocate(256, 256);

        if (r1) atlas.free(r1.id);
        if (r2) atlas.free(r2.id);
      }

      // Should still be usable
      const region = atlas.allocate(512, 512);
      expect(region).not.toBeNull();

      atlas.destroy();
    });

    it('should handle mixed sizes', () => {
      const atlas = new ShadowAtlas({ device, size: 2048 });

      const sizes = [1024, 512, 256, 128, 64];
      const allocated: number[] = [];

      for (const size of sizes) {
        const region = atlas.allocate(size, size);
        if (region) {
          allocated.push(region.id);
        }
      }

      expect(allocated.length).toBe(sizes.length);

      atlas.destroy();
    });
  });
});
