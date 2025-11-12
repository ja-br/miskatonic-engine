/**
 * TileGrid Tests - Epic 3.16 Phase 2
 */

import { describe, it, expect } from 'vitest';
import { TileGrid } from '../src/culling/TileGrid';

describe('TileGrid', () => {
  describe('constructor', () => {
    it('should create grid with correct dimensions', () => {
      const grid = new TileGrid({
        screenWidth: 1920,
        screenHeight: 1080,
        tileSize: 16,
      });

      const dims = grid.getDimensions();
      expect(dims.tilesX).toBe(120); // 1920 / 16
      expect(dims.tilesY).toBe(68);  // 1080 / 16 (rounded up)
      expect(dims.totalTiles).toBe(120 * 68);
      expect(dims.screenWidth).toBe(1920);
      expect(dims.screenHeight).toBe(1080);
      expect(dims.tileSize).toBe(16);
    });

    it('should use default tile size of 16', () => {
      const grid = new TileGrid({
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const dims = grid.getDimensions();
      expect(dims.tileSize).toBe(16);
    });

    it('should round up for non-divisible screen sizes', () => {
      const grid = new TileGrid({
        screenWidth: 1921,
        screenHeight: 1081,
        tileSize: 16,
      });

      const dims = grid.getDimensions();
      expect(dims.tilesX).toBe(121); // ceil(1921 / 16)
      expect(dims.tilesY).toBe(68);  // ceil(1081 / 16)
    });

    it('should throw error for invalid screen dimensions', () => {
      expect(() => {
        new TileGrid({
          screenWidth: 0,
          screenHeight: 1080,
        });
      }).toThrow(/Invalid screen dimensions/);

      expect(() => {
        new TileGrid({
          screenWidth: -100,
          screenHeight: 1080,
        });
      }).toThrow(/Invalid screen dimensions/);
    });

    it('should throw error for invalid tile size', () => {
      expect(() => {
        new TileGrid({
          screenWidth: 1920,
          screenHeight: 1080,
          tileSize: 0,
        });
      }).toThrow(/Invalid tile size/);

      expect(() => {
        new TileGrid({
          screenWidth: 1920,
          screenHeight: 1080,
          tileSize: -16,
        });
      }).toThrow(/Invalid tile size/);

      expect(() => {
        new TileGrid({
          screenWidth: 1920,
          screenHeight: 1080,
          tileSize: 2000, // larger than screen
        });
      }).toThrow(/Invalid tile size/);
    });
  });

  describe('update', () => {
    it('should accept valid projection and view matrices', () => {
      const grid = new TileGrid({
        screenWidth: 1920,
        screenHeight: 1080,
        tileSize: 16,
      });

      const projection = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);

      const view = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);

      expect(() => {
        grid.update(projection, view);
      }).not.toThrow();
    });

    it('should throw error for invalid projection matrix size', () => {
      const grid = new TileGrid({
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const badProjection = new Float32Array(15); // wrong size
      const view = new Float32Array(16);

      expect(() => {
        grid.update(badProjection, view);
      }).toThrow(/Expected 16-element projection matrix/);
    });

    it('should throw error for invalid view matrix size', () => {
      const grid = new TileGrid({
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const projection = new Float32Array(16);
      const badView = new Float32Array(10); // wrong size

      expect(() => {
        grid.update(projection, badView);
      }).toThrow(/Expected 16-element view matrix/);
    });
  });

  describe('getTiles', () => {
    it('should return readonly array of tiles', () => {
      const grid = new TileGrid({
        screenWidth: 32,
        screenHeight: 32,
        tileSize: 16,
      });

      const projection = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const view = new Float32Array(16).fill(0);
      view[0] = view[5] = view[10] = view[15] = 1;

      grid.update(projection, view);

      const tiles = grid.getTiles();
      expect(tiles).toHaveLength(4); // 2x2 tiles
    });
  });

  describe('getTile', () => {
    it('should return specific tile by index', () => {
      const grid = new TileGrid({
        screenWidth: 32,
        screenHeight: 32,
        tileSize: 16,
      });

      const projection = new Float32Array(16).fill(0);
      projection[0] = projection[5] = projection[10] = projection[15] = 1;
      const view = new Float32Array(16).fill(0);
      view[0] = view[5] = view[10] = view[15] = 1;

      grid.update(projection, view);

      const tile = grid.getTile(0);
      expect(tile.index).toBe(0);
      expect(tile.x).toBe(0);
      expect(tile.y).toBe(0);
    });

    it('should throw error for out-of-bounds index', () => {
      const grid = new TileGrid({
        screenWidth: 32,
        screenHeight: 32,
        tileSize: 16,
      });

      expect(() => {
        grid.getTile(-1);
      }).toThrow(/Tile index -1 out of bounds/);

      expect(() => {
        grid.getTile(100);
      }).toThrow(/Tile index 100 out of bounds/);
    });
  });

  describe('resize', () => {
    it('should update grid dimensions', () => {
      const grid = new TileGrid({
        screenWidth: 1920,
        screenHeight: 1080,
        tileSize: 16,
      });

      let dims = grid.getDimensions();
      expect(dims.tilesX).toBe(120);
      expect(dims.tilesY).toBe(68);

      grid.resize(1280, 720);

      dims = grid.getDimensions();
      expect(dims.screenWidth).toBe(1280);
      expect(dims.screenHeight).toBe(720);
      expect(dims.tilesX).toBe(80);  // 1280 / 16
      expect(dims.tilesY).toBe(45);  // 720 / 16
    });
  });

  describe('tile bounds', () => {
    it('should have correct pixel bounds for first tile', () => {
      const grid = new TileGrid({
        screenWidth: 64,
        screenHeight: 64,
        tileSize: 16,
      });

      const projection = new Float32Array(16).fill(0);
      projection[0] = projection[5] = projection[10] = projection[15] = 1;
      const view = new Float32Array(16).fill(0);
      view[0] = view[5] = view[10] = view[15] = 1;

      grid.update(projection, view);

      const tile = grid.getTile(0); // Top-left tile
      expect(tile.minX).toBe(0);
      expect(tile.minY).toBe(0);
      expect(tile.maxX).toBe(16);
      expect(tile.maxY).toBe(16);
    });

    it('should clamp tiles at screen edges', () => {
      const grid = new TileGrid({
        screenWidth: 60,  // Not divisible by 16
        screenHeight: 60,
        tileSize: 16,
      });

      const projection = new Float32Array(16).fill(0);
      projection[0] = projection[5] = projection[10] = projection[15] = 1;
      const view = new Float32Array(16).fill(0);
      view[0] = view[5] = view[10] = view[15] = 1;

      grid.update(projection, view);

      // Last tile in X direction (index 3: x=3, y=0)
      const dims = grid.getDimensions();
      const lastXTile = grid.getTile(dims.tilesX - 1);
      expect(lastXTile.maxX).toBe(60); // Clamped to screen width
    });
  });

  describe('matrix inversion', () => {
    it('should properly invert identity matrix', () => {
      const grid = new TileGrid({
        screenWidth: 16,
        screenHeight: 16,
        tileSize: 16,
      });

      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);

      // Should not throw
      expect(() => {
        grid.update(identity, identity);
      }).not.toThrow();
    });

    it('should throw error for non-invertible matrix', () => {
      const grid = new TileGrid({
        screenWidth: 16,
        screenHeight: 16,
        tileSize: 16,
      });

      // Zero matrix is not invertible
      const zero = new Float32Array(16).fill(0);
      const view = new Float32Array(16).fill(0);
      view[0] = view[5] = view[10] = view[15] = 1;

      expect(() => {
        grid.update(zero, view);
      }).toThrow(/Matrix is not invertible/);
    });
  });

  describe('frustum generation', () => {
    it('should generate frustum for each tile', () => {
      const grid = new TileGrid({
        screenWidth: 32,
        screenHeight: 32,
        tileSize: 16,
      });

      const projection = new Float32Array(16).fill(0);
      projection[0] = projection[5] = projection[10] = projection[15] = 1;
      const view = new Float32Array(16).fill(0);
      view[0] = view[5] = view[10] = view[15] = 1;

      grid.update(projection, view);

      const tiles = grid.getTiles();
      for (const tile of tiles) {
        expect(tile.frustum).toBeDefined();
        expect(tile.frustum.planes).toHaveLength(6);
      }
    });
  });
});
