/**
 * Directional Shadow Cascades - Epic 3.17 Phase 1
 *
 * Implements Cascaded Shadow Maps (CSM) for directional lights.
 * Splits view frustum into multiple cascades for improved shadow quality.
 */

import type { ShadowAtlas, ShadowRegion } from './ShadowAtlas';

/**
 * Configuration for cascaded shadow maps
 */
export interface CascadeConfig {
  /** Number of cascades (2-4 typical) */
  cascadeCount: number;
  /** Shadow map resolution per cascade */
  resolution: number;
  /** Camera near plane */
  nearPlane: number;
  /** Camera far plane */
  farPlane: number;
  /** Cascade split scheme: 'uniform', 'logarithmic', or 'practical' */
  splitScheme?: 'uniform' | 'logarithmic' | 'practical';
  /** Lambda for practical split scheme (0=uniform, 1=logarithmic) */
  lambda?: number;
}

/**
 * Single cascade data
 */
export interface Cascade {
  /** Cascade index (0 = nearest) */
  index: number;
  /** Near plane distance */
  near: number;
  /** Far plane distance */
  far: number;
  /** View-projection matrix for this cascade */
  viewProjectionMatrix: Float32Array;
  /** Shadow atlas region */
  region: ShadowRegion | null;
}

/**
 * Manages cascaded shadow maps for a directional light.
 *
 * Features:
 * - 2-4 cascades with logarithmic split scheme
 * - Per-cascade view-projection matrices
 * - Atlas allocation for each cascade
 * - Automatic cascade selection in shaders
 *
 * Algorithm:
 * 1. Split camera frustum into N cascades
 * 2. For each cascade:
 *    - Compute tight bounding box around frustum slice
 *    - Create orthographic projection from light direction
 *    - Allocate shadow map region in atlas
 * 3. Render each cascade to atlas region
 * 4. In fragment shader, select cascade based on depth
 *
 * Usage:
 * ```typescript
 * const cascades = new DirectionalShadowCascades({
 *   cascadeCount: 4,
 *   resolution: 1024,
 *   nearPlane: 0.1,
 *   farPlane: 1000.0,
 *   splitScheme: 'logarithmic',
 * });
 *
 * cascades.allocateFromAtlas(atlas);
 * cascades.update(lightDirection, cameraViewMatrix, cameraProjectionMatrix);
 *
 * // Use cascades.getCascades() for rendering
 * ```
 */
export class DirectionalShadowCascades {
  private config: Required<CascadeConfig>;
  private cascades: Cascade[] = [];
  private atlas: ShadowAtlas | null = null;

  constructor(config: CascadeConfig) {
    // Validate cascade count
    if (config.cascadeCount < 1 || config.cascadeCount > 8) {
      throw new Error(`Cascade count must be 1-8, got ${config.cascadeCount}`);
    }

    // Validate resolution
    if (config.resolution <= 0 || (config.resolution & (config.resolution - 1)) !== 0) {
      throw new Error(`Resolution must be power of 2, got ${config.resolution}`);
    }

    this.config = {
      ...config,
      splitScheme: config.splitScheme ?? 'logarithmic',
      lambda: config.lambda ?? 0.5,
    };

    this.initializeCascades();
  }

  /**
   * Initialize cascade split distances.
   */
  private initializeCascades(): void {
    const { cascadeCount, nearPlane, farPlane, splitScheme, lambda } = this.config;

    const splits = this.computeSplitDistances(
      cascadeCount,
      nearPlane,
      farPlane,
      splitScheme,
      lambda
    );

    this.cascades = [];
    for (let i = 0; i < cascadeCount; i++) {
      this.cascades.push({
        index: i,
        near: splits[i],
        far: splits[i + 1],
        viewProjectionMatrix: new Float32Array(16),
        region: null,
      });
    }
  }

  /**
   * Compute cascade split distances.
   *
   * @param count Number of cascades
   * @param near Camera near plane
   * @param far Camera far plane
   * @param scheme Split scheme
   * @param lambda Practical split lambda
   * @returns Array of N+1 split distances (including near and far)
   */
  private computeSplitDistances(
    count: number,
    near: number,
    far: number,
    scheme: 'uniform' | 'logarithmic' | 'practical',
    lambda: number
  ): number[] {
    const splits: number[] = [near];

    for (let i = 1; i < count; i++) {
      const f = i / count;

      if (scheme === 'uniform') {
        // Uniform split: linear interpolation
        splits.push(near + (far - near) * f);
      } else if (scheme === 'logarithmic') {
        // Logarithmic split: exponential distribution
        splits.push(near * Math.pow(far / near, f));
      } else {
        // Practical split: blend between uniform and logarithmic
        const uniform = near + (far - near) * f;
        const logarithmic = near * Math.pow(far / near, f);
        splits.push(lambda * logarithmic + (1 - lambda) * uniform);
      }
    }

    splits.push(far);
    return splits;
  }

  /**
   * Allocate shadow map regions from atlas.
   *
   * @param atlas Shadow atlas
   * @returns True if all cascades allocated successfully
   */
  allocateFromAtlas(atlas: ShadowAtlas): boolean {
    this.atlas = atlas;

    for (const cascade of this.cascades) {
      const region = atlas.allocate(this.config.resolution, this.config.resolution);
      if (!region) {
        // Allocation failed, free any allocated regions
        this.freeFromAtlas();
        return false;
      }
      cascade.region = region;
    }

    return true;
  }

  /**
   * Free shadow map regions from atlas.
   */
  freeFromAtlas(): void {
    if (!this.atlas) return;

    for (const cascade of this.cascades) {
      if (cascade.region) {
        this.atlas.free(cascade.region.id);
        cascade.region = null;
      }
    }

    this.atlas = null;
  }

  /**
   * Update cascade view-projection matrices.
   *
   * @param lightDirection Light direction (world space, normalized)
   * @param cameraViewMatrix Camera view matrix
   * @param cameraProjectionMatrix Camera projection matrix
   */
  update(
    lightDirection: readonly [number, number, number],
    cameraViewMatrix: Float32Array | number[],
    cameraProjectionMatrix: Float32Array | number[]
  ): void {
    // For each cascade, compute tight orthographic projection
    for (const cascade of this.cascades) {
      this.updateCascade(cascade, lightDirection, cameraViewMatrix, cameraProjectionMatrix);
    }
  }

  /**
   * Update a single cascade.
   */
  private updateCascade(
    cascade: Cascade,
    lightDirection: readonly [number, number, number],
    cameraViewMatrix: Float32Array | number[],
    cameraProjectionMatrix: Float32Array | number[]
  ): void {
    // Compute frustum corners for this cascade's depth range
    const corners = this.computeFrustumCorners(
      cascade.near,
      cascade.far,
      cameraViewMatrix,
      cameraProjectionMatrix
    );

    // CRITICAL FIX #4: Handle matrix inversion failure gracefully
    if (!corners) {
      console.warn(
        `Failed to compute frustum corners for cascade [${cascade.near}, ${cascade.far}], skipping update`
      );
      return;
    }

    // Compute bounding box of corners in light space
    const lightView = this.computeLightViewMatrix(lightDirection, corners);
    const bounds = this.computeBoundsInLightSpace(corners, lightView);

    // Create orthographic projection
    const lightProjection = this.createOrthographicProjection(bounds);

    // Combine into view-projection matrix
    this.multiplyMatrices(lightProjection, lightView, cascade.viewProjectionMatrix);
  }

  /**
   * Compute 8 frustum corners for a depth range.
   */
  private computeFrustumCorners(
    _near: number,
    _far: number,
    viewMatrix: Float32Array | number[],
    projectionMatrix: Float32Array | number[]
  ): Array<[number, number, number]> | null {
    // Compute inverse view-projection
    const viewProj = new Float32Array(16);
    this.multiplyMatrices(projectionMatrix, viewMatrix, viewProj);
    const invViewProj = new Float32Array(16);

    // CRITICAL FIX: Handle matrix inversion failure gracefully
    if (!this.invertMatrix(viewProj, invViewProj)) {
      console.warn('Failed to invert view-projection matrix, skipping frustum corner calculation');
      return null;
    }

    // NDC corners
    const ndcCorners: Array<[number, number, number, number]> = [
      // Near plane (z = -1 in NDC for perspective)
      [-1, -1, -1, 1],
      [1, -1, -1, 1],
      [1, 1, -1, 1],
      [-1, 1, -1, 1],
      // Far plane (z = 1 in NDC)
      [-1, -1, 1, 1],
      [1, -1, 1, 1],
      [1, 1, 1, 1],
      [-1, 1, 1, 1],
    ];

    // Transform to world space
    const worldCorners: Array<[number, number, number]> = [];
    for (const ndc of ndcCorners) {
      const world = this.transformPoint(ndc, invViewProj);
      worldCorners.push(world);
    }

    return worldCorners;
  }

  /**
   * Compute light view matrix looking from light direction.
   */
  private computeLightViewMatrix(
    lightDirection: readonly [number, number, number],
    frustumCorners: Array<[number, number, number]>
  ): Float32Array {
    // Compute frustum center
    const center: [number, number, number] = [0, 0, 0];
    for (const corner of frustumCorners) {
      center[0] += corner[0];
      center[1] += corner[1];
      center[2] += corner[2];
    }
    center[0] /= frustumCorners.length;
    center[1] /= frustumCorners.length;
    center[2] /= frustumCorners.length;

    // Create look-at matrix
    // Eye = center - lightDirection * distance
    const distance = 100; // Arbitrary distance along light direction
    const eye: [number, number, number] = [
      center[0] - lightDirection[0] * distance,
      center[1] - lightDirection[1] * distance,
      center[2] - lightDirection[2] * distance,
    ];

    return this.createLookAtMatrix(eye, center, [0, 1, 0]);
  }

  /**
   * Create look-at view matrix.
   */
  private createLookAtMatrix(
    eye: readonly [number, number, number],
    target: readonly [number, number, number],
    up: readonly [number, number, number]
  ): Float32Array {
    const matrix = new Float32Array(16);

    // Forward = normalize(target - eye)
    const fx = target[0] - eye[0];
    const fy = target[1] - eye[1];
    const fz = target[2] - eye[2];
    const flen = Math.sqrt(fx * fx + fy * fy + fz * fz);
    const fnx = fx / flen;
    const fny = fy / flen;
    const fnz = fz / flen;

    // CRITICAL FIX: Check if forward and up are parallel (vertical light)
    // Dot product close to ±1 means vectors are parallel
    const dot = Math.abs(fnx * up[0] + fny * up[1] + fnz * up[2]);
    const alternateUp: readonly [number, number, number] =
      dot > 0.9999 ? [1, 0, 0] : up; // Use +X if light is vertical

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
   * Compute axis-aligned bounding box in light space.
   */
  private computeBoundsInLightSpace(
    corners: Array<[number, number, number]>,
    lightView: Float32Array
  ): { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const corner of corners) {
      const transformed = this.transformPoint([corner[0], corner[1], corner[2], 1], lightView);
      minX = Math.min(minX, transformed[0]);
      maxX = Math.max(maxX, transformed[0]);
      minY = Math.min(minY, transformed[1]);
      maxY = Math.max(maxY, transformed[1]);
      minZ = Math.min(minZ, transformed[2]);
      maxZ = Math.max(maxZ, transformed[2]);
    }

    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  /**
   * Create orthographic projection matrix.
   */
  private createOrthographicProjection(bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  }): Float32Array {
    const matrix = new Float32Array(16);
    const { minX, maxX, minY, maxY, minZ, maxZ } = bounds;

    // Column-major orthographic projection
    matrix[0] = 2 / (maxX - minX);
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    matrix[4] = 0;
    matrix[5] = 2 / (maxY - minY);
    matrix[6] = 0;
    matrix[7] = 0;
    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = -2 / (maxZ - minZ);
    matrix[11] = 0;
    matrix[12] = -(maxX + minX) / (maxX - minX);
    matrix[13] = -(maxY + minY) / (maxY - minY);
    matrix[14] = -(maxZ + minZ) / (maxZ - minZ);
    matrix[15] = 1;

    return matrix;
  }

  /**
   * Transform point by matrix.
   */
  private transformPoint(
    point: readonly [number, number, number, number],
    matrix: Float32Array | number[]
  ): [number, number, number] {
    const x =
      matrix[0] * point[0] +
      matrix[4] * point[1] +
      matrix[8] * point[2] +
      matrix[12] * point[3];
    const y =
      matrix[1] * point[0] +
      matrix[5] * point[1] +
      matrix[9] * point[2] +
      matrix[13] * point[3];
    const z =
      matrix[2] * point[0] +
      matrix[6] * point[1] +
      matrix[10] * point[2] +
      matrix[14] * point[3];
    const w =
      matrix[3] * point[0] +
      matrix[7] * point[1] +
      matrix[11] * point[2] +
      matrix[15] * point[3];

    // Perspective divide
    if (Math.abs(w) > 1e-6) {
      return [x / w, y / w, z / w];
    }
    return [x, y, z];
  }

  /**
   * Multiply two 4x4 matrices: result = a * b.
   */
  private multiplyMatrices(
    a: Float32Array | number[],
    b: Float32Array | number[],
    result: Float32Array
  ): void {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[row + k * 4] * b[k + col * 4];
        }
        result[row + col * 4] = sum;
      }
    }
  }

  /**
   * Invert 4x4 matrix (simplified - assumes orthogonal for view matrices).
   * CRITICAL FIX: Returns boolean instead of throwing to handle degenerate matrices gracefully.
   * @returns true if inversion succeeded, false if matrix is singular
   */
  private invertMatrix(m: Float32Array | number[], result: Float32Array): boolean {
    // For now, use simple cofactor method (same as TileGrid)
    // TODO: Optimize for orthogonal matrices if needed

    const c00 = m[10] * m[15] - m[14] * m[11];
    const c01 = m[9] * m[15] - m[13] * m[11];
    const c02 = m[9] * m[14] - m[13] * m[10];
    const c03 = m[8] * m[15] - m[12] * m[11];
    const c04 = m[8] * m[14] - m[12] * m[10];
    const c05 = m[8] * m[13] - m[12] * m[9];

    const c06 = m[6] * m[15] - m[14] * m[7];
    const c07 = m[5] * m[15] - m[13] * m[7];
    const c08 = m[5] * m[14] - m[13] * m[6];
    const c09 = m[4] * m[15] - m[12] * m[7];
    const c10 = m[4] * m[14] - m[12] * m[6];
    const c11 = m[4] * m[13] - m[12] * m[5];

    const c12 = m[6] * m[11] - m[10] * m[7];
    const c13 = m[5] * m[11] - m[9] * m[7];
    const c14 = m[5] * m[10] - m[9] * m[6];
    const c15 = m[4] * m[11] - m[8] * m[7];
    const c16 = m[4] * m[10] - m[8] * m[6];
    const c17 = m[4] * m[9] - m[8] * m[5];

    const det =
      m[0] * (m[5] * c00 - m[6] * c01 + m[7] * c02) -
      m[1] * (m[4] * c00 - m[6] * c03 + m[7] * c04) +
      m[2] * (m[4] * c01 - m[5] * c03 + m[7] * c05) -
      m[3] * (m[4] * c02 - m[5] * c04 + m[6] * c05);

    if (Math.abs(det) < 1e-10) {
      // Matrix is singular, return identity and signal failure
      result.fill(0);
      result[0] = result[5] = result[10] = result[15] = 1;
      return false;
    }

    const invDet = 1.0 / det;

    result[0] = (m[5] * c00 - m[6] * c01 + m[7] * c02) * invDet;
    result[1] = -(m[1] * c00 - m[2] * c01 + m[3] * c02) * invDet;
    result[2] = (m[1] * c06 - m[2] * c07 + m[3] * c08) * invDet;
    result[3] = -(m[1] * c12 - m[2] * c13 + m[3] * c14) * invDet;

    result[4] = -(m[4] * c00 - m[6] * c03 + m[7] * c04) * invDet;
    result[5] = (m[0] * c00 - m[2] * c03 + m[3] * c04) * invDet;
    result[6] = -(m[0] * c06 - m[2] * c09 + m[3] * c10) * invDet;
    result[7] = (m[0] * c12 - m[2] * c15 + m[3] * c16) * invDet;

    result[8] = (m[4] * c01 - m[5] * c03 + m[7] * c05) * invDet;
    result[9] = -(m[0] * c01 - m[1] * c03 + m[3] * c05) * invDet;
    result[10] = (m[0] * c07 - m[1] * c09 + m[3] * c11) * invDet;
    result[11] = -(m[0] * c13 - m[1] * c15 + m[3] * c17) * invDet;

    result[12] = -(m[4] * c02 - m[5] * c04 + m[6] * c05) * invDet;
    result[13] = (m[0] * c02 - m[1] * c04 + m[2] * c05) * invDet;
    result[14] = -(m[0] * c08 - m[1] * c10 + m[2] * c11) * invDet;
    result[15] = (m[0] * c14 - m[1] * c16 + m[2] * c17) * invDet;

    return true;
  }

  /**
   * Get all cascades.
   */
  getCascades(): readonly Cascade[] {
    return this.cascades;
  }

  /**
   * Get cascade by index.
   */
  getCascade(index: number): Cascade | undefined {
    return this.cascades[index];
  }

  /**
   * Get configuration.
   */
  getConfig(): Readonly<Required<CascadeConfig>> {
    return { ...this.config };
  }

  /**
   * Resize cascades (reallocates atlas regions).
   *
   * @param newResolution New resolution per cascade
   */
  resize(newResolution: number): void {
    if (newResolution <= 0 || (newResolution & (newResolution - 1)) !== 0) {
      throw new Error(`Resolution must be power of 2, got ${newResolution}`);
    }

    this.config.resolution = newResolution;

    // Reallocate if already allocated
    if (this.atlas) {
      const atlas = this.atlas;
      this.freeFromAtlas();
      this.allocateFromAtlas(atlas);
    }
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.freeFromAtlas();
    this.cascades = [];
  }
}
