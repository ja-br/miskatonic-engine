/**
 * Occluder Volume System
 * Epic 3.5: Lightweight Culling - Phase 3
 *
 * Manual box occluders for hiding geometry behind large objects.
 * Retro-appropriate: Simple AABB containment test, no complex occlusion queries.
 *
 * Performance Budget: <0.5ms for 10-20 occluders
 */

import { BoundingBox, BoundingSphere } from './BoundingVolume';

/**
 * Occluder volume (axis-aligned bounding box)
 */
export interface OccluderVolume {
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
export enum OcclusionResult {
  /** Object is fully visible (not occluded) */
  VISIBLE = 'visible',

  /** Object is fully occluded (can be culled) */
  OCCLUDED = 'occluded',

  /** Object is partially visible (conservative - render it) */
  PARTIAL = 'partial',
}

/**
 * Occluder Volume Manager
 *
 * Tests objects against manual occluder volumes (large buildings, terrain).
 * Uses conservative AABB containment test - only culls fully contained objects.
 *
 * @example
 * ```typescript
 * const occluders = new OccluderVolumeManager();
 *
 * // Add large building as occluder
 * occluders.addOccluder({
 *   id: 'building1',
 *   bounds: new BoundingBox(-50, 0, -50, 50, 100, 50),
 * });
 *
 * // Test if object is occluded
 * const result = occluders.testSphere(objectBounds);
 * if (result === OcclusionResult.OCCLUDED) {
 *   // Skip rendering this object
 * }
 * ```
 */
export class OccluderVolumeManager {
  private occluders: Map<number | string, OccluderVolume>;

  constructor() {
    this.occluders = new Map();
  }

  /**
   * Add occluder volume
   *
   * @param occluder Occluder to add
   */
  addOccluder(occluder: OccluderVolume): void {
    if (!occluder) {
      throw new Error('Cannot add null/undefined occluder');
    }
    if (!occluder.bounds) {
      throw new Error('Occluder must have bounds property');
    }

    this.occluders.set(occluder.id, occluder);
  }

  /**
   * Remove occluder volume
   *
   * @param id Occluder ID to remove
   */
  removeOccluder(id: number | string): void {
    this.occluders.delete(id);
  }

  /**
   * Test if sphere is occluded by any occluder
   *
   * CONSERVATIVE: Only returns OCCLUDED if sphere is fully contained.
   * Partially visible objects return PARTIAL (render them).
   *
   * @param sphere Bounding sphere to test
   * @returns Occlusion result
   */
  testSphere(sphere: BoundingSphere): OcclusionResult {
    if (!sphere) {
      throw new Error('Cannot test null/undefined sphere');
    }

    // Test against all occluders
    for (const occluder of this.occluders.values()) {
      const result = this.testSphereAgainstBox(sphere, occluder.bounds);

      if (result === OcclusionResult.OCCLUDED) {
        // Fully occluded by this occluder - can cull
        return OcclusionResult.OCCLUDED;
      }
    }

    // Not occluded by any occluder
    return OcclusionResult.VISIBLE;
  }

  /**
   * Test if AABB is occluded by any occluder
   *
   * CONSERVATIVE: Only returns OCCLUDED if box is fully contained.
   *
   * @param box Bounding box to test
   * @returns Occlusion result
   */
  testBox(box: BoundingBox): OcclusionResult {
    if (!box) {
      throw new Error('Cannot test null/undefined box');
    }

    // Test against all occluders
    for (const occluder of this.occluders.values()) {
      const result = this.testBoxAgainstBox(box, occluder.bounds);

      if (result === OcclusionResult.OCCLUDED) {
        // Fully occluded by this occluder - can cull
        return OcclusionResult.OCCLUDED;
      }
    }

    // Not occluded by any occluder
    return OcclusionResult.VISIBLE;
  }

  /**
   * Clear all occluders
   */
  clear(): void {
    this.occluders.clear();
  }

  /**
   * Get number of active occluders
   */
  getOccluderCount(): number {
    return this.occluders.size;
  }

  /**
   * Get all occluders (for debugging)
   */
  getOccluders(): OccluderVolume[] {
    return Array.from(this.occluders.values());
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Test sphere against single occluder box
   *
   * Returns OCCLUDED only if sphere is fully contained within box.
   * This is conservative - we never accidentally cull visible objects.
   *
   * @param sphere Sphere to test
   * @param box Occluder box
   * @returns Occlusion result
   */
  private testSphereAgainstBox(
    sphere: BoundingSphere,
    box: BoundingBox
  ): OcclusionResult {
    // Inline containment check to avoid allocating BoundingBox in hot path
    // Check if sphere's AABB is fully contained within occluder box
    const sphereMinX = sphere.x - sphere.radius;
    const sphereMaxX = sphere.x + sphere.radius;
    const sphereMinY = sphere.y - sphere.radius;
    const sphereMaxY = sphere.y + sphere.radius;
    const sphereMinZ = sphere.z - sphere.radius;
    const sphereMaxZ = sphere.z + sphere.radius;

    const fullyContained =
      sphereMinX >= box.minX &&
      sphereMaxX <= box.maxX &&
      sphereMinY >= box.minY &&
      sphereMaxY <= box.maxY &&
      sphereMinZ >= box.minZ &&
      sphereMaxZ <= box.maxZ;

    if (fullyContained) {
      return OcclusionResult.OCCLUDED;
    }

    return OcclusionResult.VISIBLE;
  }

  /**
   * Test box against single occluder box
   *
   * Returns OCCLUDED only if testBox is fully contained within occluderBox.
   *
   * @param testBox Box to test
   * @param occluderBox Occluder box
   * @returns Occlusion result
   */
  private testBoxAgainstBox(
    testBox: BoundingBox,
    occluderBox: BoundingBox
  ): OcclusionResult {
    // Check if testBox is fully contained within occluderBox
    const fullyContained =
      testBox.minX >= occluderBox.minX &&
      testBox.maxX <= occluderBox.maxX &&
      testBox.minY >= occluderBox.minY &&
      testBox.maxY <= occluderBox.maxY &&
      testBox.minZ >= occluderBox.minZ &&
      testBox.maxZ <= occluderBox.maxZ;

    if (fullyContained) {
      return OcclusionResult.OCCLUDED;
    }

    // Conservative: if not fully contained, consider it visible
    // (Even if partially overlapping, we render it to avoid artifacts)
    return OcclusionResult.VISIBLE;
  }
}
