/**
 * Spot Light Shadow Mapper - Epic 3.17 Phase 2
 *
 * Manages projective shadow mapping for spot lights.
 * Each spot light renders to a single atlas tile with perspective projection.
 */

import type { ShadowAtlas, ShadowRegion } from './ShadowAtlas';

/**
 * Configuration for spot light shadow mapping
 */
export interface SpotShadowConfig {
  /** Light position in world space */
  position: readonly [number, number, number];
  /** Light direction (normalized) */
  direction: readonly [number, number, number];
  /** Cone angle in radians (full cone, not half-angle) */
  coneAngle: number;
  /** Shadow range (maximum distance) */
  range: number;
  /** Resolution of shadow map (must be power of 2) */
  resolution?: number;
  /** Near plane for projection */
  nearPlane?: number;
  /** Penumbra angle for soft edges (radians) */
  penumbra?: number;
}

/**
 * Spot light shadow mapper with projective shadow mapping.
 *
 * Features:
 * - Single perspective projection (cone FOV)
 * - View matrix aligned with spot direction
 * - Efficient single-pass rendering
 * - Penumbra support for soft shadow edges
 *
 * Memory per light:
 * - 256x256: 256KB
 * - 512x512: 1MB
 * - 1024x1024: 4MB
 *
 * Usage:
 * ```typescript
 * const spotMapper = new SpotLightShadowMapper({
 *   position: [0, 5, 0],
 *   direction: [0, -1, 0],
 *   coneAngle: Math.PI / 4, // 45° full cone
 *   range: 20.0,
 *   resolution: 512,
 * });
 *
 * spotMapper.allocateFromAtlas(atlas);
 * spotMapper.update({ direction: [0, -0.9, 0.1] });
 *
 * // Use viewProjectionMatrix for rendering
 * const vp = spotMapper.getViewProjectionMatrix();
 *
 * spotMapper.freeFromAtlas();
 * ```
 */
export class SpotLightShadowMapper {
  private config: Required<SpotShadowConfig>;
  private region: ShadowRegion | null = null;
  private atlas: ShadowAtlas | null = null;

  private viewMatrix: Float32Array;
  private projectionMatrix: Float32Array;
  private viewProjectionMatrix: Float32Array;

  constructor(config: SpotShadowConfig) {
    this.config = {
      position: config.position,
      direction: config.direction,
      coneAngle: config.coneAngle,
      range: config.range,
      resolution: config.resolution ?? 512,
      nearPlane: config.nearPlane ?? 0.1,
      penumbra: config.penumbra ?? 0.0,
    };

    // Validate resolution
    const res = this.config.resolution;
    if (!Number.isInteger(res) || res <= 0 || (res & (res - 1)) !== 0) {
      throw new Error(`Resolution must be power of 2, got ${res}`);
    }

    // Validate cone angle
    if (this.config.coneAngle <= 0 || this.config.coneAngle >= Math.PI) {
      throw new Error(`Cone angle must be between 0 and π, got ${this.config.coneAngle}`);
    }

    // Initialize matrices
    this.viewMatrix = new Float32Array(16);
    this.projectionMatrix = new Float32Array(16);
    this.viewProjectionMatrix = new Float32Array(16);

    this.updateMatrices();
  }

  /**
   * Update view and projection matrices based on current configuration.
   */
  private updateMatrices(): void {
    // Create view matrix (look from position along direction)
    this.createLookAtMatrix(
      this.config.position,
      this.config.direction,
      [0, 1, 0], // Default up vector
      this.viewMatrix
    );

    // Create projection matrix (perspective with cone FOV)
    this.createPerspectiveProjection(
      this.config.coneAngle,
      this.config.nearPlane,
      this.config.range,
      this.projectionMatrix
    );

    // Combine into view-projection
    this.multiplyMatrices(this.projectionMatrix, this.viewMatrix, this.viewProjectionMatrix);
  }

  /**
   * Create look-at view matrix.
   *
   * @param position Light position (eye)
   * @param direction Light direction (normalized)
   * @param up Up vector
   * @param result Output matrix
   */
  private createLookAtMatrix(
    position: readonly [number, number, number],
    direction: readonly [number, number, number],
    up: readonly [number, number, number],
    result: Float32Array
  ): void {
    // Normalize direction
    const dlen = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2);

    // CRITICAL FIX: Validate direction is not zero-length before normalization
    if (dlen < 1e-6) {
      throw new Error('SpotLightShadowMapper: direction vector has zero length');
    }

    const fnx = direction[0] / dlen;
    const fny = direction[1] / dlen;
    const fnz = direction[2] / dlen;

    // Check if forward and up are parallel (vertical light)
    const dot = Math.abs(fnx * up[0] + fny * up[1] + fnz * up[2]);
    const alternateUp: readonly [number, number, number] = dot > 0.9999 ? [1, 0, 0] : up;

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
    result[0] = rnx;
    result[1] = ux;
    result[2] = -fnx;
    result[3] = 0;
    result[4] = rny;
    result[5] = uy;
    result[6] = -fny;
    result[7] = 0;
    result[8] = rnz;
    result[9] = uz;
    result[10] = -fnz;
    result[11] = 0;
    result[12] = -(rnx * position[0] + rny * position[1] + rnz * position[2]);
    result[13] = -(ux * position[0] + uy * position[1] + uz * position[2]);
    result[14] = -(-fnx * position[0] + -fny * position[1] + -fnz * position[2]);
    result[15] = 1;
  }

  /**
   * Create perspective projection matrix for spot light cone.
   *
   * @param coneAngle Full cone angle in radians
   * @param near Near plane distance
   * @param far Far plane distance
   * @param result Output matrix
   */
  private createPerspectiveProjection(
    coneAngle: number,
    near: number,
    far: number,
    result: Float32Array
  ): void {
    // Convert cone angle to vertical FOV (half of cone angle)
    const fov = coneAngle;
    const f = 1.0 / Math.tan(fov / 2.0);

    // Symmetric projection (aspect ratio 1:1)
    result[0] = f; // x scale
    result[5] = f; // y scale
    result[10] = -(far + near) / (far - near); // z scale
    result[11] = -1.0; // w = -z (perspective divide)
    result[14] = -(2.0 * far * near) / (far - near); // z translation

    // Zero out other elements
    result[1] = 0;
    result[2] = 0;
    result[3] = 0;
    result[4] = 0;
    result[6] = 0;
    result[7] = 0;
    result[8] = 0;
    result[9] = 0;
    result[12] = 0;
    result[13] = 0;
    result[15] = 0;
  }

  /**
   * Multiply two 4x4 matrices (result = a × b).
   */
  private multiplyMatrices(
    a: Float32Array | number[],
    b: Float32Array | number[],
    result: Float32Array
  ): void {
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
   * Allocate shadow map region in atlas.
   *
   * @param atlas Shadow atlas to allocate from
   * @returns True if allocation succeeded, false otherwise
   */
  allocateFromAtlas(atlas: ShadowAtlas): boolean {
    if (this.atlas) {
      throw new Error('Already allocated from atlas');
    }

    const res = this.config.resolution;
    const region = atlas.allocate(res, res);
    if (!region) {
      return false;
    }

    this.region = region;
    this.atlas = atlas;
    return true;
  }

  /**
   * Free shadow map region from atlas.
   */
  freeFromAtlas(): void {
    if (!this.atlas || !this.region) {
      return;
    }

    this.atlas.free(this.region.id);
    this.region = null;
    this.atlas = null;
  }

  /**
   * Update spot light configuration.
   *
   * Recalculates matrices if position, direction, cone angle, or range changes.
   */
  update(config: Partial<SpotShadowConfig>): void {
    let needsUpdate = false;

    if (config.position !== undefined) {
      this.config.position = config.position;
      needsUpdate = true;
    }

    if (config.direction !== undefined) {
      this.config.direction = config.direction;
      needsUpdate = true;
    }

    if (config.coneAngle !== undefined) {
      if (config.coneAngle <= 0 || config.coneAngle >= Math.PI) {
        throw new Error(`Cone angle must be between 0 and π, got ${config.coneAngle}`);
      }
      this.config.coneAngle = config.coneAngle;
      needsUpdate = true;
    }

    if (config.range !== undefined) {
      this.config.range = config.range;
      needsUpdate = true;
    }

    if (config.nearPlane !== undefined) {
      this.config.nearPlane = config.nearPlane;
      needsUpdate = true;
    }

    if (config.penumbra !== undefined) {
      this.config.penumbra = config.penumbra;
      // Note: penumbra doesn't affect matrices, only shader sampling
    }

    if (needsUpdate) {
      this.updateMatrices();
    }
  }

  /**
   * Get view-projection matrix.
   */
  getViewProjectionMatrix(): Float32Array {
    return this.viewProjectionMatrix;
  }

  /**
   * Get view matrix.
   */
  getViewMatrix(): Float32Array {
    return this.viewMatrix;
  }

  /**
   * Get projection matrix.
   */
  getProjectionMatrix(): Float32Array {
    return this.projectionMatrix;
  }

  /**
   * Get shadow map region in atlas.
   */
  getRegion(): ShadowRegion | null {
    return this.region;
  }

  /**
   * Get light position.
   */
  getPosition(): readonly [number, number, number] {
    return this.config.position;
  }

  /**
   * Get light direction.
   */
  getDirection(): readonly [number, number, number] {
    return this.config.direction;
  }

  /**
   * Get cone angle.
   */
  getConeAngle(): number {
    return this.config.coneAngle;
  }

  /**
   * Get shadow range.
   */
  getRange(): number {
    return this.config.range;
  }

  /**
   * Get resolution.
   */
  getResolution(): number {
    return this.config.resolution;
  }

  /**
   * Get penumbra angle.
   */
  getPenumbra(): number {
    return this.config.penumbra;
  }

  /**
   * Check if shadow map is allocated in atlas.
   */
  isAllocated(): boolean {
    return this.atlas !== null && this.region !== null;
  }

  /**
   * Get memory usage for this shadow map.
   *
   * @returns Memory in bytes (res × res × 4 bytes)
   */
  getMemoryUsage(): number {
    const res = this.config.resolution;
    return res * res * 4; // R32F = 4 bytes per pixel
  }

  /**
   * Calculate shadow coordinates for a world position.
   *
   * Transforms world position to shadow map UV coordinates [0, 1].
   *
   * @param worldPos Position in world space
   * @returns Shadow map coordinates [u, v, depth] or null if outside frustum
   */
  worldToShadowCoords(worldPos: readonly [number, number, number]): [number, number, number] | null {
    // Transform to clip space
    const vp = this.viewProjectionMatrix;
    const x =
      vp[0] * worldPos[0] + vp[4] * worldPos[1] + vp[8] * worldPos[2] + vp[12];
    const y =
      vp[1] * worldPos[0] + vp[5] * worldPos[1] + vp[9] * worldPos[2] + vp[13];
    const z =
      vp[2] * worldPos[0] + vp[6] * worldPos[1] + vp[10] * worldPos[2] + vp[14];
    const w =
      vp[3] * worldPos[0] + vp[7] * worldPos[1] + vp[11] * worldPos[2] + vp[15];

    // Perspective divide
    if (Math.abs(w) < 1e-6) {
      return null;
    }

    const ndcX = x / w;
    const ndcY = y / w;
    const ndcZ = z / w;

    // Check if inside frustum
    if (ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY > 1 || ndcZ < 0 || ndcZ > 1) {
      return null;
    }

    // Convert to UV coordinates
    const u = ndcX * 0.5 + 0.5;
    const v = ndcY * 0.5 + 0.5;

    return [u, v, ndcZ];
  }
}
