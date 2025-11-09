/**
 * TextureAtlas Tests - Epic 3.8
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TextureAtlas } from '../src/TextureAtlas';

describe('TextureAtlas', () => {
  let atlas: TextureAtlas;

  beforeEach(() => {
    atlas = new TextureAtlas(1024); // 1024x1024 atlas
  });

  describe('Basic Packing', () => {
    it('should pack a single texture', () => {
      const region = atlas.addTexture('texture1', 256, 256);

      expect(region).not.toBeNull();
      expect(region!.x).toBe(0);
      expect(region!.y).toBe(0);
      expect(region!.width).toBe(256);
      expect(region!.height).toBe(256);
    });

    it('should pack multiple textures horizontally on same shelf', () => {
      const region1 = atlas.addTexture('texture1', 256, 256);
      const region2 = atlas.addTexture('texture2', 256, 256);

      expect(region1!.x).toBe(0);
      expect(region1!.y).toBe(0);
      expect(region2!.x).toBe(256); // Next to first texture
      expect(region2!.y).toBe(0); // Same row
    });

    it('should create new shelf when row is full', () => {
      // Fill first row (1024 / 256 = 4 textures)
      atlas.addTexture('tex1', 256, 256);
      atlas.addTexture('tex2', 256, 256);
      atlas.addTexture('tex3', 256, 256);
      atlas.addTexture('tex4', 256, 256);

      // 5th texture goes on new shelf
      const region5 = atlas.addTexture('tex5', 256, 256);

      expect(region5!.x).toBe(0);
      expect(region5!.y).toBe(256); // New row
    });

    it('should pack textures of different sizes', () => {
      const region1 = atlas.addTexture('large', 512, 512);
      const region2 = atlas.addTexture('small', 256, 256);

      expect(region1!.x).toBe(0);
      expect(region1!.y).toBe(0);
      expect(region2!.x).toBe(512); // Fits next to large texture
      expect(region2!.y).toBe(0); // Same shelf (height 512)
    });
  });

  describe('UV Coordinates', () => {
    it('should calculate correct UV coordinates', () => {
      const region = atlas.addTexture('texture1', 256, 256);

      expect(region!.u0).toBe(0 / 1024);
      expect(region!.v0).toBe(0 / 1024);
      expect(region!.u1).toBe(256 / 1024);
      expect(region!.v1).toBe(256 / 1024);
    });

    it('should have UVs in 0-1 range', () => {
      const region = atlas.addTexture('texture1', 512, 512);

      expect(region!.u0).toBeGreaterThanOrEqual(0);
      expect(region!.u0).toBeLessThanOrEqual(1);
      expect(region!.v0).toBeGreaterThanOrEqual(0);
      expect(region!.v0).toBeLessThanOrEqual(1);
      expect(region!.u1).toBeGreaterThanOrEqual(0);
      expect(region!.u1).toBeLessThanOrEqual(1);
      expect(region!.v1).toBeGreaterThanOrEqual(0);
      expect(region!.v1).toBeLessThanOrEqual(1);
    });
  });

  describe('Duplicate Handling', () => {
    it('should return same region for duplicate texture ID', () => {
      const region1 = atlas.addTexture('texture1', 256, 256);
      const region2 = atlas.addTexture('texture1', 256, 256);

      expect(region2).toBe(region1); // Same object reference
    });

    it('should not allocate space twice for duplicates', () => {
      atlas.addTexture('texture1', 256, 256);
      atlas.addTexture('texture1', 256, 256);

      const stats = atlas.getStats();
      expect(stats.textureCount).toBe(1); // Only 1 unique texture
    });
  });

  describe('Atlas Creation', () => {
    it('should create new atlas when first is full', () => {
      // Fill first 1024x1024 atlas (4x4 grid of 256x256 textures = 16 textures)
      for (let i = 0; i < 16; i++) {
        atlas.addTexture(`tex${i}`, 256, 256);
      }

      const stats1 = atlas.getStats();
      expect(stats1.atlasCount).toBe(1);

      // Add one more texture - should create new atlas
      atlas.addTexture('tex16', 256, 256);

      const stats2 = atlas.getStats();
      expect(stats2.atlasCount).toBe(2);
    });

    it('should assign different atlasId to different atlases', () => {
      // Fill first atlas
      for (let i = 0; i < 16; i++) {
        atlas.addTexture(`tex${i}`, 256, 256);
      }

      const region1 = atlas.getRegion('tex0')!;
      const region2 = atlas.addTexture('tex16', 256, 256)!;

      expect(region1.atlasId).not.toBe(region2.atlasId);
    });
  });

  describe('Size Limits', () => {
    it('should reject textures larger than max atlas size', () => {
      const region = atlas.addTexture('toobig', 2048, 2048);

      expect(region).toBeNull();
    });

    it('should accept textures equal to max atlas size', () => {
      const region = atlas.addTexture('maxsize', 1024, 1024);

      expect(region).not.toBeNull();
    });

    it('should handle textures with one dimension larger than max', () => {
      const region = atlas.addTexture('toolong', 2048, 512);

      expect(region).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should track texture count', () => {
      atlas.addTexture('tex1', 256, 256);
      atlas.addTexture('tex2', 256, 256);
      atlas.addTexture('tex3', 256, 256);

      const stats = atlas.getStats();
      expect(stats.textureCount).toBe(3);
    });

    it('should calculate coverage correctly', () => {
      // Add one 512x512 texture to 1024x1024 atlas
      atlas.addTexture('tex1', 512, 512);

      const stats = atlas.getStats();
      const expectedCoverage = (512 * 512) / (1024 * 1024);

      expect(stats.coverage).toBeCloseTo(expectedCoverage, 4);
    });

    it('should track total and used pixels', () => {
      atlas.addTexture('tex1', 256, 256);
      atlas.addTexture('tex2', 512, 512);

      const stats = atlas.getStats();
      expect(stats.totalPixels).toBe(1024 * 1024); // One atlas
      expect(stats.usedPixels).toBe(256 * 256 + 512 * 512);
    });

    it('should calculate average waste', () => {
      // Add tall texture first to create 512-height shelf
      atlas.addTexture('tall', 256, 512);
      // Add small texture on same shelf (waste = (512-256) * 256 = 65536)
      atlas.addTexture('small', 256, 256);

      const stats = atlas.getStats();
      expect(stats.averageWaste).toBeGreaterThan(0);
    });
  });

  describe('Removal', () => {
    it('should remove texture from atlas', () => {
      atlas.addTexture('tex1', 256, 256);

      expect(atlas.getRegion('tex1')).not.toBeNull();

      atlas.removeTexture('tex1');

      expect(atlas.getRegion('tex1')).toBeNull();
    });

    it('should update texture count after removal', () => {
      atlas.addTexture('tex1', 256, 256);
      atlas.addTexture('tex2', 256, 256);

      atlas.removeTexture('tex1');

      const stats = atlas.getStats();
      expect(stats.textureCount).toBe(1);
    });
  });

  describe('Clear', () => {
    it('should clear all textures', () => {
      atlas.addTexture('tex1', 256, 256);
      atlas.addTexture('tex2', 256, 256);

      atlas.clear();

      const stats = atlas.getStats();
      expect(stats.textureCount).toBe(0);
      expect(stats.atlasCount).toBe(0);
    });

    it('should clear all regions', () => {
      atlas.addTexture('tex1', 256, 256);
      atlas.clear();

      expect(atlas.getRegion('tex1')).toBeNull();
    });
  });

  describe('Memory Tracking', () => {
    it('should calculate total memory (RGBA8 format)', () => {
      // One 1024x1024 atlas = 1024 * 1024 * 4 bytes
      atlas.addTexture('tex1', 256, 256);

      const memory = atlas.getTotalMemory();
      expect(memory).toBe(1024 * 1024 * 4);
    });

    it('should track memory for multiple atlases', () => {
      // Fill first atlas and create second
      for (let i = 0; i < 17; i++) {
        atlas.addTexture(`tex${i}`, 256, 256);
      }

      const memory = atlas.getTotalMemory();
      expect(memory).toBe(2 * 1024 * 1024 * 4); // 2 atlases
    });
  });

  describe('Coverage Targets', () => {
    it('should achieve >90% coverage with well-packed textures', () => {
      // Pack 15 textures of 256x256 into 1024x1024 atlas
      // 15 * 256 * 256 = 983,040 pixels
      // 1024 * 1024 = 1,048,576 pixels
      // Coverage = 93.75%
      for (let i = 0; i < 15; i++) {
        atlas.addTexture(`tex${i}`, 256, 256);
      }

      const coverage = atlas.getCoverage();
      expect(coverage).toBeGreaterThan(90);
    });
  });

  describe('Shelf Packing Algorithm', () => {
    it('should pack shorter textures on taller shelves', () => {
      // Create tall shelf with 512-height texture
      const tall = atlas.addTexture('tall', 256, 512);

      // Add short texture - should fit on same shelf
      const short = atlas.addTexture('short', 256, 256);

      expect(tall!.y).toBe(0);
      expect(short!.y).toBe(0); // Same shelf
      expect(short!.x).toBe(256); // Next to tall texture
    });

    it('should create minimal number of shelves', () => {
      // All same-height textures should go on same shelf
      atlas.addTexture('tex1', 256, 256);
      atlas.addTexture('tex2', 256, 256);
      atlas.addTexture('tex3', 256, 256);

      // All should be on first shelf (y=0)
      expect(atlas.getRegion('tex1')!.y).toBe(0);
      expect(atlas.getRegion('tex2')!.y).toBe(0);
      expect(atlas.getRegion('tex3')!.y).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should pack 100 textures in <100ms', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        atlas.addTexture(`tex${i}`, 64, 64);
      }

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-size texture', () => {
      const region = atlas.addTexture('zero', 0, 0);

      // Should either reject or pack at minimum size
      if (region) {
        expect(region.width).toBeGreaterThanOrEqual(0);
        expect(region.height).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle single-pixel texture', () => {
      const region = atlas.addTexture('pixel', 1, 1);

      expect(region).not.toBeNull();
      expect(region!.width).toBe(1);
      expect(region!.height).toBe(1);
    });

    it('should handle extremely wide texture', () => {
      const region = atlas.addTexture('wide', 1024, 1);

      expect(region).not.toBeNull();
    });

    it('should handle extremely tall texture', () => {
      const region = atlas.addTexture('tall', 1, 1024);

      expect(region).not.toBeNull();
    });
  });
});
