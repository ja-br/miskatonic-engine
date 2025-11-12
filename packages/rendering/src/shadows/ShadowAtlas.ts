/**
 * Shadow Atlas - Epic 3.17 Phase 1
 *
 * Manages a texture atlas for shadow maps with dynamic allocation.
 * Supports multiple shadow map resolutions packed into a single texture.
 */

/**
 * Quality tier for shadow maps
 */
export enum ShadowQuality {
  /** 4096x4096 atlas, 64MB memory */
  HIGH = 'high',
  /** 2048x2048 atlas, 16MB memory */
  MEDIUM = 'medium',
  /** 1024x1024 atlas, 4MB memory */
  LOW = 'low',
}

/**
 * Configuration for shadow atlas
 */
export interface ShadowAtlasConfig {
  /** WebGPU device */
  device: GPUDevice;
  /** Quality tier (determines atlas size) */
  quality?: ShadowQuality;
  /** Custom atlas size (overrides quality tier) */
  size?: number;
  /** Texture format (default: 'depth32float') */
  format?: GPUTextureFormat;
}

/**
 * Allocated region within the shadow atlas
 */
export interface ShadowRegion {
  /** Unique region ID */
  id: number;
  /** X offset in pixels */
  x: number;
  /** Y offset in pixels */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** UV coordinates for sampling: [minU, minV, maxU, maxV] */
  uvBounds: [number, number, number, number];
}

/**
 * Shadow atlas manages a single depth texture for all shadow maps.
 *
 * Features:
 * - Dynamic allocation/deallocation of shadow map regions
 * - Multiple quality tiers (HIGH: 4096x4096, MEDIUM: 2048x2048, LOW: 1024x1024)
 * - R32F depth format for precise shadow comparisons
 * - Efficient packing using simple grid allocator
 *
 * Usage:
 * ```typescript
 * const atlas = new ShadowAtlas({
 *   device: gpuDevice,
 *   quality: ShadowQuality.HIGH,
 * });
 *
 * // Allocate region for 1024x1024 shadow map
 * const region = atlas.allocate(1024, 1024);
 *
 * // Use region.uvBounds in shader
 * // ... render shadows to region ...
 *
 * // Free when done
 * atlas.free(region.id);
 * ```
 */
export class ShadowAtlas {
  private device: GPUDevice;
  private size: number;
  private format: GPUTextureFormat;

  // GPU resources
  private texture?: GPUTexture;
  private view?: GPUTextureView;

  // Allocation tracking
  private nextRegionId = 1;
  private regions = new Map<number, ShadowRegion>();
  private freeRects: Array<{ x: number; y: number; width: number; height: number }> = [];

  constructor(config: ShadowAtlasConfig) {
    this.device = config.device;
    this.format = config.format ?? 'depth32float';

    // Determine atlas size from quality tier
    if (config.size !== undefined) {
      this.size = config.size;
    } else {
      const quality = config.quality ?? ShadowQuality.MEDIUM;
      switch (quality) {
        case ShadowQuality.HIGH:
          this.size = 4096;
          break;
        case ShadowQuality.MEDIUM:
          this.size = 2048;
          break;
        case ShadowQuality.LOW:
          this.size = 1024;
          break;
      }
    }

    // Validate size
    if (!Number.isInteger(this.size) || this.size <= 0 || (this.size & (this.size - 1)) !== 0) {
      throw new Error(`Atlas size must be a power of 2, got ${this.size}`);
    }

    this.initializeTexture();
    this.initializeAllocator();
  }

  /**
   * Create GPU texture for shadow atlas.
   */
  private initializeTexture(): void {
    this.texture = this.device.createTexture({
      label: `Shadow Atlas ${this.size}x${this.size}`,
      size: { width: this.size, height: this.size, depthOrArrayLayers: 1 },
      format: this.format,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC,
    });

    // CRITICAL FIX: Only use 'depth-only' for pure depth formats
    // For depth-stencil formats, must use 'all' or handle stencil separately
    const aspect = this.format.includes('stencil') ? 'all' : 'depth-only';

    this.view = this.texture.createView({
      label: 'Shadow Atlas View',
      format: this.format,
      dimension: '2d',
      aspect,
    });
  }

  /**
   * Initialize allocator with full atlas as free space.
   */
  private initializeAllocator(): void {
    this.freeRects = [{ x: 0, y: 0, width: this.size, height: this.size }];
  }

  /**
   * Allocate a region in the atlas.
   *
   * @param width Region width in pixels (must be power of 2)
   * @param height Region height in pixels (must be power of 2)
   * @returns Allocated region, or null if no space available
   */
  allocate(width: number, height: number): ShadowRegion | null {
    // Validate dimensions (including integer check)
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      width > this.size ||
      height > this.size
    ) {
      return null;
    }

    // Find best-fitting free rectangle (smallest that fits)
    let bestIdx = -1;
    let bestArea = Infinity;

    for (let i = 0; i < this.freeRects.length; i++) {
      const rect = this.freeRects[i];
      if (rect.width >= width && rect.height >= height) {
        const area = rect.width * rect.height;
        if (area < bestArea) {
          bestArea = area;
          bestIdx = i;
        }
      }
    }

    if (bestIdx === -1) {
      return null; // No space available
    }

    // Allocate from best rectangle
    const rect = this.freeRects[bestIdx];
    const region: ShadowRegion = {
      id: this.nextRegionId++,
      x: rect.x,
      y: rect.y,
      width,
      height,
      uvBounds: [
        rect.x / this.size,
        rect.y / this.size,
        (rect.x + width) / this.size,
        (rect.y + height) / this.size,
      ],
    };

    this.regions.set(region.id, region);

    // Remove allocated rectangle and add remaining splits
    this.freeRects.splice(bestIdx, 1);

    // Split remaining space (guillotine method)
    // CRITICAL FIX: Correct dimensions to avoid overlapping splits
    const rightWidth = rect.width - width;
    const bottomHeight = rect.height - height;

    if (rightWidth > 0) {
      this.freeRects.push({
        x: rect.x + width,
        y: rect.y,
        width: rightWidth,
        height: height, // Use allocated height, not original rect.height
      });
    }

    if (bottomHeight > 0) {
      this.freeRects.push({
        x: rect.x,
        y: rect.y + height,
        width: rect.width, // Use original width for full bottom strip
        height: bottomHeight,
      });
    }

    return region;
  }

  /**
   * Free an allocated region.
   *
   * @param regionId Region ID to free
   * @returns True if region was freed, false if not found
   */
  free(regionId: number): boolean {
    const region = this.regions.get(regionId);
    if (!region) {
      return false;
    }

    this.regions.delete(regionId);

    // Add back to free list
    this.freeRects.push({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    });

    // Merge adjacent free rectangles to reduce fragmentation
    this.mergeFreeRects();

    return true;
  }

  /**
   * Merge adjacent free rectangles to reduce fragmentation.
   * Uses simple horizontal and vertical merging.
   */
  private mergeFreeRects(): void {
    let merged = true;

    // Repeat until no more merges are possible
    while (merged) {
      merged = false;

      for (let i = 0; i < this.freeRects.length; i++) {
        for (let j = i + 1; j < this.freeRects.length; j++) {
          const a = this.freeRects[i];
          const b = this.freeRects[j];

          // Check for horizontal merge (same y, height, adjacent x)
          if (
            a.y === b.y &&
            a.height === b.height &&
            ((a.x + a.width === b.x) || (b.x + b.width === a.x))
          ) {
            // Merge horizontally
            const minX = Math.min(a.x, b.x);
            a.x = minX;
            a.width = a.width + b.width;
            this.freeRects.splice(j, 1);
            merged = true;
            break;
          }

          // Check for vertical merge (same x, width, adjacent y)
          if (
            a.x === b.x &&
            a.width === b.width &&
            ((a.y + a.height === b.y) || (b.y + b.height === a.y))
          ) {
            // Merge vertically
            const minY = Math.min(a.y, b.y);
            a.y = minY;
            a.height = a.height + b.height;
            this.freeRects.splice(j, 1);
            merged = true;
            break;
          }
        }

        if (merged) break;
      }
    }
  }

  /**
   * Get a region by ID.
   *
   * @param regionId Region ID
   * @returns Region, or undefined if not found
   */
  getRegion(regionId: number): ShadowRegion | undefined {
    return this.regions.get(regionId);
  }

  /**
   * Get all allocated regions.
   */
  getRegions(): readonly ShadowRegion[] {
    return Array.from(this.regions.values());
  }

  /**
   * Get atlas utilization statistics.
   */
  getStats(): {
    size: number;
    format: GPUTextureFormat;
    allocatedRegions: number;
    allocatedPixels: number;
    freePixels: number;
    utilization: number;
    memoryUsageBytes: number;
  } {
    const totalPixels = this.size * this.size;
    const allocatedPixels = Array.from(this.regions.values()).reduce(
      (sum, r) => sum + r.width * r.height,
      0
    );
    const freePixels = this.freeRects.reduce((sum, r) => sum + r.width * r.height, 0);

    // R32F = 4 bytes per pixel
    const bytesPerPixel = 4;
    const memoryUsageBytes = totalPixels * bytesPerPixel;

    return {
      size: this.size,
      format: this.format,
      allocatedRegions: this.regions.size,
      allocatedPixels,
      freePixels,
      utilization: allocatedPixels / totalPixels,
      memoryUsageBytes,
    };
  }

  /**
   * Get the atlas texture for binding in shaders.
   */
  getTexture(): GPUTexture {
    if (!this.texture) {
      throw new Error('Atlas texture not initialized');
    }
    return this.texture;
  }

  /**
   * Get the atlas texture view for render attachments.
   */
  getView(): GPUTextureView {
    if (!this.view) {
      throw new Error('Atlas view not initialized');
    }
    return this.view;
  }

  /**
   * Clear the entire atlas (all regions to max depth).
   *
   * CRITICAL: This method submits GPU commands asynchronously.
   * The clear operation is NOT guaranteed to complete when this method returns.
   * WebGPU's command queue ensures proper ordering with subsequent operations,
   * but if you need to wait for completion, track the command buffer separately.
   *
   * For typical shadow rendering, this is fine - just call at frame start
   * before rendering shadow maps.
   */
  clear(): void {
    const commandEncoder = this.device.createCommandEncoder({
      label: 'Shadow Atlas Clear',
    });

    const passEncoder = commandEncoder.beginRenderPass({
      label: 'Shadow Atlas Clear Pass',
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.getView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Resize the atlas (destroys all allocations).
   *
   * @param newSize New atlas size (must be power of 2)
   */
  resize(newSize: number): void {
    if (!Number.isInteger(newSize) || newSize <= 0 || (newSize & (newSize - 1)) !== 0) {
      throw new Error(`Atlas size must be a power of 2, got ${newSize}`);
    }

    // CRITICAL FIX: Store old state in case new initialization fails
    const oldTexture = this.texture;
    const oldView = this.view;
    const oldSize = this.size;

    try {
      // Update size and create new resources
      this.size = newSize;
      this.initializeTexture();
      this.initializeAllocator();

      // Success - now destroy old resources and clear allocations
      oldTexture?.destroy();
      this.regions.clear();
      this.nextRegionId = 1;
    } catch (error) {
      // Restore old state on failure
      this.texture = oldTexture;
      this.view = oldView;
      this.size = oldSize;
      throw error;
    }
  }

  /**
   * Clean up GPU resources.
   */
  destroy(): void {
    this.texture?.destroy();
    this.texture = undefined;
    this.view = undefined;
  }
}
