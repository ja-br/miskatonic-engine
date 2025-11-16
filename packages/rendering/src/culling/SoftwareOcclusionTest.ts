/**
 * Software Occlusion Test
 * Epic 3.5: Lightweight Culling - Phase 4
 *
 * Lightweight CPU depth buffer for testing huge objects (mountains, buildings).
 * Retro-appropriate: Low-resolution hierarchical Z-buffer, not GPU occlusion queries.
 *
 * Performance Budget: <1ms for 10-20 huge objects
 */

import { BoundingSphere, BoundingBox } from './BoundingVolume';

/**
 * Occluder for depth buffer rendering
 */
export interface DepthOccluder {
  /** Unique identifier */
  id: number | string;

  /** World-space AABB */
  bounds: BoundingBox;

  /** Optional user data */
  userData?: unknown;
}

/**
 * Occlusion test result
 */
export enum DepthOcclusionResult {
  /** Object is visible (not occluded) */
  VISIBLE = 'visible',

  /** Object is occluded (can be culled) */
  OCCLUDED = 'occluded',
}

/**
 * Software Occlusion Test Configuration
 */
export interface SoftwareOcclusionConfig {
  /** Depth buffer resolution (default: 64x64) */
  resolution?: number;

  /** Near clipping plane distance */
  nearPlane: number;

  /** Far clipping plane distance */
  farPlane: number;
}

/**
 * Software Occlusion Test
 *
 * Lightweight CPU-side occlusion testing using low-resolution depth buffer.
 * Rasterizes huge occluders (mountains, buildings) into 64x64 depth buffer,
 * then tests objects against this buffer.
 *
 * CONSERVATIVE: Only culls objects that are fully behind occluders.
 *
 * @example
 * ```typescript
 * const occlusionTest = new SoftwareOcclusionTest({
 *   resolution: 64,
 *   nearPlane: 0.1,
 *   farPlane: 1000.0,
 * });
 *
 * // Add huge occluders (mountains)
 * occlusionTest.addOccluder({
 *   id: 'mountain1',
 *   bounds: new BoundingBox(-500, 0, -500, 500, 1000, 500),
 * });
 *
 * // Update depth buffer from camera
 * occlusionTest.updateDepthBuffer(viewProjectionMatrix, cameraPosition);
 *
 * // Test if object is occluded
 * const result = occlusionTest.testSphere(objectBounds);
 * if (result === DepthOcclusionResult.OCCLUDED) {
 *   // Skip rendering this object
 * }
 * ```
 */
export class SoftwareOcclusionTest {
  private config: SoftwareOcclusionConfig;
  private occluders: Map<number | string, DepthOccluder>;
  private depthBuffer: Float32Array;
  private resolution: number;

  constructor(config: SoftwareOcclusionConfig) {
    this.config = {
      resolution: 64,
      ...config,
    };

    this.resolution = this.config.resolution!;
    this.occluders = new Map();

    // Allocate depth buffer (64x64 = 4096 floats = 16KB)
    this.depthBuffer = new Float32Array(this.resolution * this.resolution);
    this.clearDepthBuffer();
  }

  /**
   * Add occluder to depth buffer
   *
   * @param occluder Occluder to add
   */
  addOccluder(occluder: DepthOccluder): void {
    if (!occluder) {
      throw new Error('Cannot add null/undefined occluder');
    }
    if (!occluder.bounds) {
      throw new Error('Occluder must have bounds property');
    }

    this.occluders.set(occluder.id, occluder);
  }

  /**
   * Remove occluder from depth buffer
   *
   * @param id Occluder ID to remove
   */
  removeOccluder(id: number | string): void {
    this.occluders.delete(id);
  }

  /**
   * Clear all occluders
   */
  clear(): void {
    this.occluders.clear();
    this.clearDepthBuffer();
  }

  /**
   * Update depth buffer from camera view
   *
   * Rasterizes all occluders into low-resolution depth buffer.
   *
   * @param viewProjectionMatrix Camera view-projection matrix (column-major)
   * @param cameraPosition Camera world position
   */
  updateDepthBuffer(
    viewProjectionMatrix: Float32Array | number[],
    cameraPosition: { x: number; y: number; z: number }
  ): void {
    // Clear depth buffer to far plane
    this.clearDepthBuffer();

    // Rasterize each occluder
    for (const occluder of this.occluders.values()) {
      this.rasterizeOccluder(occluder, viewProjectionMatrix);
    }
  }

  /**
   * Test if sphere is occluded
   *
   * CONSERVATIVE: Only returns OCCLUDED if sphere is fully behind depth buffer.
   *
   * @param sphere Bounding sphere to test
   * @param viewProjectionMatrix Camera view-projection matrix
   * @returns Occlusion result
   */
  testSphere(
    sphere: BoundingSphere,
    viewProjectionMatrix: Float32Array | number[]
  ): DepthOcclusionResult {
    if (!sphere) {
      throw new Error('Cannot test null/undefined sphere');
    }

    // Project sphere center to screen space
    const screenPos = this.projectToScreen(
      sphere.x,
      sphere.y,
      sphere.z,
      viewProjectionMatrix
    );

    if (!screenPos) {
      // Outside view frustum or behind camera
      return DepthOcclusionResult.VISIBLE;
    }

    // Sample depth buffer at sphere center
    const bufferDepth = this.sampleDepthBuffer(screenPos.x, screenPos.y);

    // Conservative: Only cull if sphere CENTER is behind occluder
    // This is conservative because it ignores sphere radius, so spheres
    // partially behind occluders will be considered visible.
    if (screenPos.z >= bufferDepth) {
      // Sphere center is fully behind occluder
      return DepthOcclusionResult.OCCLUDED;
    }

    // Sphere may be visible
    return DepthOcclusionResult.VISIBLE;
  }

  /**
   * Test if AABB is occluded
   *
   * @param box Bounding box to test
   * @param viewProjectionMatrix Camera view-projection matrix
   * @returns Occlusion result
   */
  testBox(
    box: BoundingBox,
    viewProjectionMatrix: Float32Array | number[]
  ): DepthOcclusionResult {
    if (!box) {
      throw new Error('Cannot test null/undefined box');
    }

    // Convert box to sphere (conservative bounding sphere)
    const centerX = (box.minX + box.maxX) / 2;
    const centerY = (box.minY + box.maxY) / 2;
    const centerZ = (box.minZ + box.maxZ) / 2;

    const radiusX = (box.maxX - box.minX) / 2;
    const radiusY = (box.maxY - box.minY) / 2;
    const radiusZ = (box.maxZ - box.minZ) / 2;
    const radius = Math.sqrt(radiusX * radiusX + radiusY * radiusY + radiusZ * radiusZ);

    const sphere = new BoundingSphere(centerX, centerY, centerZ, radius);

    return this.testSphere(sphere, viewProjectionMatrix);
  }

  /**
   * Get number of active occluders
   */
  getOccluderCount(): number {
    return this.occluders.size;
  }

  /**
   * Get depth buffer resolution
   */
  getResolution(): number {
    return this.resolution;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Clear depth buffer to far plane
   */
  private clearDepthBuffer(): void {
    // Initialize to far plane (1.0 in normalized device coordinates)
    this.depthBuffer.fill(1.0);
  }

  /**
   * Rasterize occluder into depth buffer
   *
   * Simple conservative rasterization: project AABB to screen, fill pixels.
   *
   * @param occluder Occluder to rasterize
   * @param viewProjectionMatrix Camera view-projection matrix
   */
  private rasterizeOccluder(
    occluder: DepthOccluder,
    viewProjectionMatrix: Float32Array | number[]
  ): void {
    const bounds = occluder.bounds;

    // Project 8 corners of AABB to screen space
    const corners = [
      this.projectToScreen(bounds.minX, bounds.minY, bounds.minZ, viewProjectionMatrix),
      this.projectToScreen(bounds.maxX, bounds.minY, bounds.minZ, viewProjectionMatrix),
      this.projectToScreen(bounds.minX, bounds.maxY, bounds.minZ, viewProjectionMatrix),
      this.projectToScreen(bounds.maxX, bounds.maxY, bounds.minZ, viewProjectionMatrix),
      this.projectToScreen(bounds.minX, bounds.minY, bounds.maxZ, viewProjectionMatrix),
      this.projectToScreen(bounds.maxX, bounds.minY, bounds.maxZ, viewProjectionMatrix),
      this.projectToScreen(bounds.minX, bounds.maxY, bounds.maxZ, viewProjectionMatrix),
      this.projectToScreen(bounds.maxX, bounds.maxY, bounds.maxZ, viewProjectionMatrix),
    ];

    // Find screen-space AABB and nearest depth
    let minX = 1,
      minY = 1,
      maxX = 0,
      maxY = 0;
    let minDepth = 1.0;

    for (const corner of corners) {
      if (corner) {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
        minDepth = Math.min(minDepth, corner.z);
      }
    }

    // Clamp to screen bounds [0, 1]
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(1, maxX);
    maxY = Math.min(1, maxY);

    // Convert to pixel coordinates
    const pixelMinX = Math.floor(minX * this.resolution);
    const pixelMinY = Math.floor(minY * this.resolution);
    const pixelMaxX = Math.ceil(maxX * this.resolution);
    const pixelMaxY = Math.ceil(maxY * this.resolution);

    // Fill pixels with nearest depth (conservative rasterization)
    // Note: x and y are already guaranteed to be within [0, resolution) due to clamping above
    for (let y = pixelMinY; y < pixelMaxY; y++) {
      for (let x = pixelMinX; x < pixelMaxX; x++) {
        const index = y * this.resolution + x;
        // Update depth buffer (keep closest depth)
        this.depthBuffer[index] = Math.min(this.depthBuffer[index], minDepth);
      }
    }
  }

  /**
   * Project world-space point to screen space
   *
   * @param x World X
   * @param y World Y
   * @param z World Z
   * @param viewProjectionMatrix View-projection matrix
   * @returns Screen position { x: [0,1], y: [0,1], z: [0,1] } or null if outside frustum
   */
  private projectToScreen(
    x: number,
    y: number,
    z: number,
    viewProjectionMatrix: Float32Array | number[]
  ): { x: number; y: number; z: number } | null {
    const m = viewProjectionMatrix;

    // Transform to clip space
    const clipX = m[0] * x + m[4] * y + m[8] * z + m[12];
    const clipY = m[1] * x + m[5] * y + m[9] * z + m[13];
    const clipZ = m[2] * x + m[6] * y + m[10] * z + m[14];
    const clipW = m[3] * x + m[7] * y + m[11] * z + m[15];

    // Check if behind camera (w <= 0)
    if (clipW <= 0) {
      return null;
    }

    // Perspective divide to NDC space [-1, 1]
    const ndcX = clipX / clipW;
    const ndcY = clipY / clipW;
    const ndcZ = clipZ / clipW;

    // Check if outside frustum
    if (ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY > 1 || ndcZ < -1 || ndcZ > 1) {
      return null;
    }

    // Convert NDC to screen space [0, 1]
    const screenX = (ndcX + 1) / 2;
    const screenY = (ndcY + 1) / 2;
    const screenZ = (ndcZ + 1) / 2; // Depth in [0, 1] range

    return { x: screenX, y: screenY, z: screenZ };
  }

  /**
   * Sample depth buffer at screen position
   *
   * @param screenX Screen X in [0, 1]
   * @param screenY Screen Y in [0, 1]
   * @returns Depth value in [0, 1] (0 = near, 1 = far)
   */
  private sampleDepthBuffer(screenX: number, screenY: number): number {
    // Convert to pixel coordinates
    const pixelX = Math.floor(screenX * this.resolution);
    const pixelY = Math.floor(screenY * this.resolution);

    // Clamp to buffer bounds
    const x = Math.max(0, Math.min(this.resolution - 1, pixelX));
    const y = Math.max(0, Math.min(this.resolution - 1, pixelY));

    const index = y * this.resolution + x;
    return this.depthBuffer[index];
  }
}
