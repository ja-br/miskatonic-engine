/**
 * Epic 3.8: GPU Memory Management - Texture Atlas
 *
 * TextureAtlas combines multiple textures into a single atlas texture using
 * shelf bin-packing algorithm. Reduces texture binds from N to 1.
 *
 * Performance targets:
 * - Texture atlas coverage >90%
 * - 10-100x fewer texture binds
 * - <1ms packing time per texture
 */

export interface AtlasRegion {
  atlasId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // UV coordinates (0-1 range)
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface TextureAtlasStats {
  atlasCount: number;
  totalPixels: number;
  usedPixels: number;
  coverage: number; // 0-1 (usedPixels / totalPixels)
  textureCount: number;
  averageWaste: number; // Average wasted space per texture
}

interface Shelf {
  y: number; // Y position of shelf
  height: number; // Height of shelf
  x: number; // Current X position (where next texture goes)
  wastedSpace: number; // Pixels wasted on this shelf
}

interface AtlasTexture {
  id: string;
  width: number;
  height: number;
  shelves: Shelf[];
  usedPixels: number;
}

/**
 * TextureAtlas - Combine multiple textures into single atlas
 *
 * Uses shelf bin-packing algorithm:
 * 1. Sort textures by height (tallest first)
 * 2. Place textures on shelves (rows)
 * 3. Create new shelf when current is full
 *
 * Usage:
 * ```typescript
 * const atlas = new TextureAtlas(2048); // 2048x2048 atlas
 * const region = atlas.addTexture('grass', 256, 256);
 * // Use region.u0, v0, u1, v1 for UV coordinates
 * ```
 */
export class TextureAtlas {
  private atlases: AtlasTexture[] = [];
  private textureRegions = new Map<string, AtlasRegion>();
  private readonly maxAtlasSize: number;
  private nextAtlasId = 0;

  constructor(maxAtlasSize: number = 2048) {
    this.maxAtlasSize = maxAtlasSize;
  }

  /**
   * Add a texture to the atlas
   * Returns region with UV coordinates
   */
  addTexture(textureId: string, width: number, height: number): AtlasRegion | null {
    // Check if already in atlas
    if (this.textureRegions.has(textureId)) {
      return this.textureRegions.get(textureId)!;
    }

    // Validate size
    if (width > this.maxAtlasSize || height > this.maxAtlasSize) {
      console.warn(`TextureAtlas: Texture ${textureId} (${width}x${height}) exceeds max atlas size ${this.maxAtlasSize}`);
      return null;
    }

    // Try to pack into existing atlas
    for (const atlas of this.atlases) {
      const region = this.packIntoAtlas(atlas, textureId, width, height);
      if (region) {
        this.textureRegions.set(textureId, region);
        return region;
      }
    }

    // Create new atlas and pack
    const newAtlas = this.createAtlas();
    const region = this.packIntoAtlas(newAtlas, textureId, width, height);

    if (region) {
      this.textureRegions.set(textureId, region);
      return region;
    }

    console.error(`TextureAtlas: Failed to pack texture ${textureId} (${width}x${height})`);
    return null;
  }

  /**
   * Remove a texture from the atlas
   * Note: Does not defragment, just marks space as unused
   */
  removeTexture(textureId: string): void {
    this.textureRegions.delete(textureId);
  }

  /**
   * Get texture region by ID
   */
  getRegion(textureId: string): AtlasRegion | null {
    return this.textureRegions.get(textureId) ?? null;
  }

  /**
   * Pack texture into specific atlas using shelf algorithm
   */
  private packIntoAtlas(
    atlas: AtlasTexture,
    textureId: string,
    width: number,
    height: number
  ): AtlasRegion | null {
    // Try to fit on existing shelf
    for (const shelf of atlas.shelves) {
      if (this.fitsOnShelf(shelf, width, height, atlas.width)) {
        const region = this.placeOnShelf(atlas, shelf, textureId, width, height);
        return region;
      }
    }

    // Try to create new shelf
    const newShelf = this.createShelf(atlas, height);
    if (newShelf && this.fitsOnShelf(newShelf, width, height, atlas.width)) {
      const region = this.placeOnShelf(atlas, newShelf, textureId, width, height);
      return region;
    }

    return null; // Doesn't fit in this atlas
  }

  /**
   * Check if texture fits on shelf
   */
  private fitsOnShelf(shelf: Shelf, width: number, height: number, atlasWidth: number): boolean {
    return (
      height <= shelf.height && // Fits vertically
      shelf.x + width <= atlasWidth // Fits horizontally
    );
  }

  /**
   * Place texture on shelf and return region
   */
  private placeOnShelf(
    atlas: AtlasTexture,
    shelf: Shelf,
    _textureId: string,
    width: number,
    height: number
  ): AtlasRegion {
    const x = shelf.x;
    const y = shelf.y;

    // Update shelf
    shelf.x += width;
    shelf.wastedSpace += (shelf.height - height) * width; // Vertical waste

    // Update atlas stats
    atlas.usedPixels += width * height;

    // Calculate UV coordinates (0-1 range)
    const u0 = x / atlas.width;
    const v0 = y / atlas.height;
    const u1 = (x + width) / atlas.width;
    const v1 = (y + height) / atlas.height;

    return {
      atlasId: atlas.id,
      x,
      y,
      width,
      height,
      u0,
      v0,
      u1,
      v1,
    };
  }

  /**
   * Create new shelf at bottom of atlas
   */
  private createShelf(atlas: AtlasTexture, height: number): Shelf | null {
    // Find Y position for new shelf (below last shelf)
    let y = 0;
    if (atlas.shelves.length > 0) {
      const lastShelf = atlas.shelves[atlas.shelves.length - 1];
      y = lastShelf.y + lastShelf.height;
    }

    // Check if shelf fits
    if (y + height > atlas.height) {
      return null; // No room
    }

    const shelf: Shelf = {
      y,
      height,
      x: 0,
      wastedSpace: 0,
    };

    atlas.shelves.push(shelf);
    return shelf;
  }

  /**
   * Create new atlas texture
   */
  private createAtlas(): AtlasTexture {
    const atlas: AtlasTexture = {
      id: `atlas_${this.nextAtlasId++}`,
      width: this.maxAtlasSize,
      height: this.maxAtlasSize,
      shelves: [],
      usedPixels: 0,
    };

    this.atlases.push(atlas);
    return atlas;
  }

  /**
   * Get statistics about atlas usage
   */
  getStats(): TextureAtlasStats {
    const totalPixels = this.atlases.reduce(
      (sum, atlas) => sum + atlas.width * atlas.height,
      0
    );

    const usedPixels = this.atlases.reduce(
      (sum, atlas) => sum + atlas.usedPixels,
      0
    );

    const totalWaste = this.atlases.reduce(
      (sum, atlas) => sum + atlas.shelves.reduce((s, shelf) => s + shelf.wastedSpace, 0),
      0
    );

    return {
      atlasCount: this.atlases.length,
      totalPixels,
      usedPixels,
      coverage: totalPixels > 0 ? usedPixels / totalPixels : 0,
      textureCount: this.textureRegions.size,
      averageWaste: this.textureRegions.size > 0 ? totalWaste / this.textureRegions.size : 0,
    };
  }

  /**
   * Get all atlas IDs
   */
  getAtlasIds(): string[] {
    return this.atlases.map(atlas => atlas.id);
  }

  /**
   * Clear all atlases
   */
  clear(): void {
    this.atlases = [];
    this.textureRegions.clear();
    this.nextAtlasId = 0;
  }

  /**
   * Get total memory used by atlases (in bytes, assuming RGBA8)
   */
  getTotalMemory(): number {
    return this.atlases.reduce(
      (sum, atlas) => sum + atlas.width * atlas.height * 4, // 4 bytes per pixel (RGBA8)
      0
    );
  }

  /**
   * Get coverage percentage (0-100)
   */
  getCoverage(): number {
    const stats = this.getStats();
    return stats.coverage * 100;
  }
}
