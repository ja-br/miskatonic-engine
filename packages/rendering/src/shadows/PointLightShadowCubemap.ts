/**
 * Point Light Shadow Cubemap - Epic 3.17 Phase 2
 *
 * Manages omnidirectional shadow mapping for point lights using cubemaps.
 * Each point light renders to 6 faces in the shadow atlas.
 */

import type { ShadowAtlas, ShadowRegion } from './ShadowAtlas';

/**
 * Cubemap face enumeration (matches WebGPU texture array layer convention)
 */
export enum CubeFace {
  POSITIVE_X = 0, // Right
  NEGATIVE_X = 1, // Left
  POSITIVE_Y = 2, // Top
  NEGATIVE_Y = 3, // Bottom
  POSITIVE_Z = 4, // Front
  NEGATIVE_Z = 5, // Back
}

/**
 * Configuration for point light shadow cubemap
 */
export interface PointShadowConfig {
  /** Light position in world space */
  position: readonly [number, number, number];
  /** Shadow range (equal to light radius) */
  radius: number;
  /** Resolution per cubemap face (must be power of 2) */
  resolution?: number;
  /** Near plane for projection */
  nearPlane?: number;
}

/**
 * Per-face data for cubemap shadow mapping
 */
export interface CubeFaceData {
  /** Face identifier */
  face: CubeFace;
  /** Atlas region for this face */
  region: ShadowRegion | null;
  /** View matrix for this face (looking in face direction) */
  viewMatrix: Float32Array;
  /** Projection matrix (perspective, 90° FOV) */
  projectionMatrix: Float32Array;
  /** Combined view-projection matrix */
  viewProjectionMatrix: Float32Array;
}

/**
 * Point light shadow cubemap manages 6-face omnidirectional shadows.
 *
 * Features:
 * - 6 atlas allocations (one per cube face)
 * - Perspective projection (90° FOV per face)
 * - View matrices for each cubemap direction
 * - Omnidirectional shadow sampling
 *
 * Memory per light:
 * - 256x256: 6 × 256KB = 1.5MB per light
 * - 512x512: 6 × 1MB = 6MB per light
 * - 1024x1024: 6 × 4MB = 24MB per light
 *
 * Usage:
 * ```typescript
 * const cubemap = new PointLightShadowCubemap({
 *   position: [5, 10, 3],
 *   radius: 20.0,
 *   resolution: 256,
 * });
 *
 * cubemap.allocateFromAtlas(atlas);
 * cubemap.update({ position: [6, 10, 3], radius: 20.0 });
 *
 * // Render shadows for each face
 * for (const face of cubemap.getFaces()) {
 *   // Use face.viewProjectionMatrix for rendering
 * }
 *
 * cubemap.freeFromAtlas();
 * ```
 */
export class PointLightShadowCubemap {
  private config: Required<PointShadowConfig>;
  private faces: CubeFaceData[] = [];
  private atlas: ShadowAtlas | null = null;

  constructor(config: PointShadowConfig) {
    this.config = {
      position: config.position,
      radius: config.radius,
      resolution: config.resolution ?? 256,
      nearPlane: config.nearPlane ?? 0.1,
    };

    // Validate resolution
    const res = this.config.resolution;
    if (!Number.isInteger(res) || res <= 0 || (res & (res - 1)) !== 0) {
      throw new Error(`Resolution must be power of 2, got ${res}`);
    }

    // Initialize all 6 faces
    this.initializeFaces();
  }

  /**
   * Initialize cubemap face data with view and projection matrices.
   */
  private initializeFaces(): void {
    // Define cubemap face directions and up vectors
    const faceDirections: Array<{
      face: CubeFace;
      target: [number, number, number];
      up: [number, number, number];
    }> = [
      // +X (Right): look right, up is +Y
      { face: CubeFace.POSITIVE_X, target: [1, 0, 0], up: [0, 1, 0] },
      // -X (Left): look left, up is +Y
      { face: CubeFace.NEGATIVE_X, target: [-1, 0, 0], up: [0, 1, 0] },
      // +Y (Top): look up, up is -Z (toward viewer)
      { face: CubeFace.POSITIVE_Y, target: [0, 1, 0], up: [0, 0, -1] },
      // -Y (Bottom): look down, up is +Z (away from viewer)
      { face: CubeFace.NEGATIVE_Y, target: [0, -1, 0], up: [0, 0, 1] },
      // +Z (Front): look forward, up is +Y
      { face: CubeFace.POSITIVE_Z, target: [0, 0, 1], up: [0, 1, 0] },
      // -Z (Back): look backward, up is +Y
      { face: CubeFace.NEGATIVE_Z, target: [0, 0, -1], up: [0, 1, 0] },
    ];

    const projection = this.createPerspectiveProjection();

    for (const { face, target, up } of faceDirections) {
      const view = this.createLookAtMatrix(this.config.position, target, up);
      const viewProj = new Float32Array(16);
      this.multiplyMatrices(projection, view, viewProj);

      this.faces.push({
        face,
        region: null,
        viewMatrix: view,
        projectionMatrix: projection,
        viewProjectionMatrix: viewProj,
      });
    }
  }

  /**
   * Create perspective projection matrix for 90° FOV cubemap face.
   *
   * Uses symmetric frustum with 90° horizontal and vertical FOV.
   */
  private createPerspectiveProjection(): Float32Array {
    const matrix = new Float32Array(16);
    const near = this.config.nearPlane;
    const far = this.config.radius;

    // Perspective projection: 90° FOV, aspect ratio 1:1
    // tan(45°) = 1.0, so f = 1.0 / tan(fov/2) = 1.0
    const f = 1.0;

    // Column-major matrix
    matrix[0] = f; // x scale
    matrix[5] = f; // y scale
    matrix[10] = -(far + near) / (far - near); // z scale
    matrix[11] = -1.0; // w = -z (perspective divide)
    matrix[14] = -(2.0 * far * near) / (far - near); // z translation

    return matrix;
  }

  /**
   * Create look-at view matrix.
   *
   * @param eye Light position in world space
   * @param targetDir Direction to look (relative to eye)
   * @param up Up vector
   */
  private createLookAtMatrix(
    eye: readonly [number, number, number],
    targetDir: readonly [number, number, number],
    up: readonly [number, number, number]
  ): Float32Array {
    const matrix = new Float32Array(16);

    // Forward = normalize(targetDir)
    const flen = Math.sqrt(
      targetDir[0] * targetDir[0] + targetDir[1] * targetDir[1] + targetDir[2] * targetDir[2]
    );
    const fnx = targetDir[0] / flen;
    const fny = targetDir[1] / flen;
    const fnz = targetDir[2] / flen;

    // CRITICAL FIX: Check if forward and up are parallel or anti-parallel
    // For vertical faces (±Y), forward is parallel/anti-parallel to up
    const dot = fnx * up[0] + fny * up[1] + fnz * up[2];
    const absDot = Math.abs(dot);

    // If nearly parallel/anti-parallel, use appropriate alternate up
    let alternateUp: readonly [number, number, number] = up;
    if (absDot > 0.9999) {
      // Choose alternate based on which axis forward is aligned with
      if (Math.abs(fny) > 0.9999) {
        // Vertical (±Y): use +Z for looking down, -Z for looking up
        alternateUp = dot > 0 ? [0, 0, 1] : [0, 0, -1];
      } else {
        // Horizontal: use +X as fallback
        alternateUp = [1, 0, 0];
      }
    }

    // Right = normalize(cross(forward, up))
    const rx = fny * alternateUp[2] - fnz * alternateUp[1];
    const ry = fnz * alternateUp[0] - fnx * alternateUp[2];
    const rz = fnx * alternateUp[1] - fny * alternateUp[0];
    const rlen = Math.sqrt(rx * rx + ry * ry + rz * rz);
    const rnx = rx / rlen;
    const rny = ry / rlen;
    const rnz = rz / rlen;

    // Up = cross(right, forward)
    const ux = rny * fnz - rnz * fny;
    const uy = rnz * fnx - rnx * fnz;
    const uz = rnx * fny - rny * fnx;

    // Build matrix (column-major)
    matrix[0] = rnx;
    matrix[1] = ux;
    matrix[2] = -fnx;
    matrix[3] = 0;
    matrix[4] = rny;
    matrix[5] = uy;
    matrix[6] = -fny;
    matrix[7] = 0;
    matrix[8] = rnz;
    matrix[9] = uz;
    matrix[10] = -fnz;
    matrix[11] = 0;
    matrix[12] = -(rnx * eye[0] + rny * eye[1] + rnz * eye[2]);
    matrix[13] = -(ux * eye[0] + uy * eye[1] + uz * eye[2]);
    matrix[14] = -(-fnx * eye[0] + -fny * eye[1] + -fnz * eye[2]);
    matrix[15] = 1;

    return matrix;
  }

  /**
   * Multiply two 4x4 matrices (result = a × b).
   */
  private multiplyMatrices(a: Float32Array | number[], b: Float32Array | number[], result: Float32Array): void {
    // Column-major multiplication
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[k * 4 + row] * b[col * 4 + k];
        }
        result[col * 4 + row] = sum;
      }
    }
  }

  /**
   * Allocate all 6 cubemap faces in the shadow atlas.
   *
   * @param atlas Shadow atlas to allocate from
   * @returns True if all allocations succeeded, false otherwise
   */
  allocateFromAtlas(atlas: ShadowAtlas): boolean {
    if (this.atlas) {
      throw new Error('Already allocated from atlas');
    }

    const res = this.config.resolution;
    const allocated: ShadowRegion[] = [];

    // Try to allocate all 6 faces
    for (const faceData of this.faces) {
      const region = atlas.allocate(res, res);
      if (!region) {
        // Allocation failed - free what we allocated so far
        for (const r of allocated) {
          atlas.free(r.id);
        }
        return false;
      }
      allocated.push(region);
      faceData.region = region;
    }

    this.atlas = atlas;
    return true;
  }

  /**
   * Free all cubemap faces from the atlas.
   */
  freeFromAtlas(): void {
    if (!this.atlas) {
      return;
    }

    for (const faceData of this.faces) {
      if (faceData.region) {
        this.atlas.free(faceData.region.id);
        faceData.region = null;
      }
    }

    this.atlas = null;
  }

  /**
   * Update cubemap configuration (position, radius).
   *
   * Recalculates all view and view-projection matrices.
   */
  update(config: Partial<PointShadowConfig>): void {
    let needsRebuild = false;

    if (config.position !== undefined) {
      this.config.position = config.position;
      needsRebuild = true;
    }

    if (config.radius !== undefined) {
      this.config.radius = config.radius;
      needsRebuild = true;
    }

    if (config.nearPlane !== undefined) {
      this.config.nearPlane = config.nearPlane;
      needsRebuild = true;
    }

    if (needsRebuild) {
      // CRITICAL FIX: Free old atlas regions before rebuild to prevent leak
      if (this.atlas) {
        for (const faceData of this.faces) {
          if (faceData.region) {
            this.atlas.free(faceData.region.id);
          }
        }
      }

      // Store atlas reference
      const atlas = this.atlas;

      // Rebuild all matrices
      this.faces = [];
      this.initializeFaces();

      // Re-allocate from atlas if previously allocated
      if (atlas) {
        this.atlas = null; // Reset to avoid "already allocated" error
        if (!this.allocateFromAtlas(atlas)) {
          console.warn('Failed to re-allocate cubemap after update');
        }
      }
    }
  }

  /**
   * Get all cubemap face data.
   */
  getFaces(): readonly CubeFaceData[] {
    return this.faces;
  }

  /**
   * Get specific cubemap face data.
   */
  getFace(face: CubeFace): CubeFaceData {
    return this.faces[face];
  }

  /**
   * Get light position.
   */
  getPosition(): readonly [number, number, number] {
    return this.config.position;
  }

  /**
   * Get shadow range (radius).
   */
  getRadius(): number {
    return this.config.radius;
  }

  /**
   * Get resolution per face.
   */
  getResolution(): number {
    return this.config.resolution;
  }

  /**
   * Check if cubemap is allocated in atlas.
   */
  isAllocated(): boolean {
    return this.atlas !== null && this.faces.every((f) => f.region !== null);
  }

  /**
   * Get memory usage for this cubemap.
   *
   * @returns Memory in bytes (res × res × 4 bytes × 6 faces)
   */
  getMemoryUsage(): number {
    const res = this.config.resolution;
    return res * res * 4 * 6; // R32F = 4 bytes per pixel, 6 faces
  }
}
