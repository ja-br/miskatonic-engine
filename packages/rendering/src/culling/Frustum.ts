/**
 * Frustum Culling - Epic 3.16
 *
 * View frustum representation using 6 planes for culling tests.
 * Extracts frustum planes from view-projection matrix for efficient
 * visibility testing of lights and other objects.
 */

/**
 * Epsilon tolerance for frustum boundary tests.
 *
 * Prevents temporal flickering when objects are near frustum boundaries:
 * - Camera shake/movement causes small floating-point errors in view-projection matrix
 * - Matrix multiplication accumulates rounding errors (~1e-7 per operation)
 * - Object at exact boundary (distance = 0) may compute as distance = ±1e-5
 * - Without epsilon, object flickers between visible/culled each frame
 * - Epsilon creates a "tolerance zone" where boundary objects are always visible
 *
 * Value 0.0001 chosen for world scale of 0-1000 units where Float32 precision
 * at 1000 units is ~0.001 (1e-3). This is 10x smaller than precision limit,
 * preventing flickering without causing significant false positives.
 *
 * Must match EPSILON in shaders/common/math.glsl for CPU/GPU consistency.
 * @see src/shaders/common/math.glsl
 */
const EPSILON = 0.0001;

/**
 * Plane in 3D space represented in normal-distance form: ax + by + cz + d = 0
 * where (a, b, c) is the normalized normal vector and d is the distance from origin.
 */
export interface Plane {
  /** Normal vector X component */
  nx: number;
  /** Normal vector Y component */
  ny: number;
  /** Normal vector Z component */
  nz: number;
  /** Distance from origin */
  d: number;
}

/**
 * Frustum planes enumeration for clear indexing
 */
export enum FrustumPlane {
  LEFT = 0,
  RIGHT = 1,
  BOTTOM = 2,
  TOP = 3,
  NEAR = 4,
  FAR = 5,
}

/**
 * View frustum represented as 6 planes.
 * Used for culling lights and objects outside the camera's view.
 *
 * Algorithm: Gribb-Hartmann method for extracting frustum planes from
 * view-projection matrix by adding/subtracting rows.
 *
 * Usage:
 * ```typescript
 * const frustum = Frustum.fromViewProjection(camera.viewProjectionMatrix);
 *
 * // Test if light is visible
 * const sphere = { x: 5, y: 2, z: 0, radius: 10 };
 * if (frustum.intersectsSphere(sphere)) {
 *   // Light is visible, include in rendering
 * }
 * ```
 */
export class Frustum {
  /** The 6 frustum planes in world space (internal storage) */
  private _planes: Plane[] = [];

  /** Read-only access to frustum planes */
  get planes(): ReadonlyArray<Readonly<Plane>> {
    return this._planes;
  }

  constructor() {
    // Initialize 6 planes
    for (let i = 0; i < 6; i++) {
      this._planes.push({ nx: 0, ny: 0, nz: 0, d: 0 });
    }
  }

  /**
   * Extract frustum planes from a view-projection matrix.
   * Uses Gribb-Hartmann method: planes are derived by adding/subtracting matrix rows.
   *
   * @param viewProjection 4x4 view-projection matrix in column-major order (WebGPU convention)
   * @returns New Frustum instance
   */
  static fromViewProjection(viewProjection: Float32Array | number[]): Frustum {
    const frustum = new Frustum();
    frustum.updateFromViewProjection(viewProjection);
    return frustum;
  }

  /**
   * Create frustum from pre-computed plane equations.
   * Useful for tile-based culling where planes are computed from corners.
   *
   * @param planes Array of 6 planes in order: LEFT, RIGHT, BOTTOM, TOP, NEAR, FAR
   * @returns New Frustum instance
   */
  static fromPlanes(planes: Plane[]): Frustum {
    if (planes.length !== 6) {
      throw new Error(`Expected 6 planes, got ${planes.length}`);
    }

    const frustum = new Frustum();
    for (let i = 0; i < 6; i++) {
      frustum._planes[i] = { ...planes[i] };
    }
    return frustum;
  }

  /**
   * Update frustum planes from a view-projection matrix (in-place, no allocation).
   * Prefer this over fromViewProjection() when culling every frame to avoid GC pressure.
   *
   * @param viewProjection 4x4 view-projection matrix in column-major order (WebGPU convention)
   */
  updateFromViewProjection(viewProjection: Float32Array | number[]): void {
    if (viewProjection.length !== 16) {
      throw new Error(
        `Expected 16-element matrix, got ${viewProjection.length}`
      );
    }

    const m = viewProjection;

    // Extract planes using Gribb-Hartmann method
    // View-projection matrix rows: [m0-m3], [m4-m7], [m8-m11], [m12-m15]

    // Left plane: m3 + m0, m7 + m4, m11 + m8, m15 + m12
    this.setPlane(
      FrustumPlane.LEFT,
      m[3] + m[0],
      m[7] + m[4],
      m[11] + m[8],
      m[15] + m[12]
    );

    // Right plane: m3 - m0, m7 - m4, m11 - m8, m15 - m12
    this.setPlane(
      FrustumPlane.RIGHT,
      m[3] - m[0],
      m[7] - m[4],
      m[11] - m[8],
      m[15] - m[12]
    );

    // Bottom plane: m3 + m1, m7 + m5, m11 + m9, m15 + m13
    this.setPlane(
      FrustumPlane.BOTTOM,
      m[3] + m[1],
      m[7] + m[5],
      m[11] + m[9],
      m[15] + m[13]
    );

    // Top plane: m3 - m1, m7 - m5, m11 - m9, m15 - m13
    this.setPlane(
      FrustumPlane.TOP,
      m[3] - m[1],
      m[7] - m[5],
      m[11] - m[9],
      m[15] - m[13]
    );

    // Near plane: m3 + m2, m7 + m6, m11 + m10, m15 + m14
    this.setPlane(
      FrustumPlane.NEAR,
      m[3] + m[2],
      m[7] + m[6],
      m[11] + m[10],
      m[15] + m[14]
    );

    // Far plane: m3 - m2, m7 - m6, m11 - m10, m15 - m14
    this.setPlane(
      FrustumPlane.FAR,
      m[3] - m[2],
      m[7] - m[6],
      m[11] - m[10],
      m[15] - m[14]
    );
  }

  /**
   * Set a frustum plane and normalize it.
   *
   * @param index Plane index (0-5)
   * @param nx Normal X component
   * @param ny Normal Y component
   * @param nz Normal Z component
   * @param d Distance from origin
   */
  private setPlane(
    index: FrustumPlane,
    nx: number,
    ny: number,
    nz: number,
    d: number
  ): void {
    // Normalize the plane equation
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz);

    // Use epsilon to catch near-zero normals, not just exact zero
    // Prevents numerical instability from denormalized floats
    if (length < EPSILON) {
      throw new Error(
        `Cannot normalize plane ${index}: near-zero normal length ${length.toExponential(2)}`
      );
    }

    const invLength = 1.0 / length;
    this._planes[index].nx = nx * invLength;
    this._planes[index].ny = ny * invLength;
    this._planes[index].nz = nz * invLength;
    this._planes[index].d = d * invLength;
  }

  /**
   * Test if a sphere intersects or is inside the frustum.
   * Uses signed distance from each plane.
   *
   * Algorithm: For each plane, compute signed distance from sphere center.
   * If distance < -radius, sphere is completely outside that plane.
   *
   * @param sphere Object with center (x, y, z) and radius
   * @returns true if sphere intersects frustum, false if completely outside
   */
  intersectsSphere(sphere: {
    x: number;
    y: number;
    z: number;
    radius: number;
  }): boolean {
    for (let i = 0; i < 6; i++) {
      const plane = this._planes[i];

      // Compute signed distance from plane to sphere center
      const distance =
        plane.nx * sphere.x +
        plane.ny * sphere.y +
        plane.nz * sphere.z +
        plane.d;

      // If sphere is completely outside this plane, it's not visible
      // Use epsilon tolerance to prevent flickering on boundaries
      // Add epsilon to create tolerance zone: objects within epsilon are included
      if (distance < -sphere.radius + EPSILON) {
        return false;
      }
    }

    // Sphere intersects or is inside frustum
    return true;
  }

  /**
   * Test if an axis-aligned bounding box (AABB) intersects or is inside the frustum.
   * Uses the "p-vertex" method: for each plane, find the vertex of the box
   * that is furthest along the plane's normal direction.
   *
   * @param box AABB with min and max corners
   * @returns true if box intersects frustum, false if completely outside
   */
  intersectsAABB(box: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  }): boolean {
    for (let i = 0; i < 6; i++) {
      const plane = this._planes[i];

      // Find the "positive vertex" (furthest along normal direction)
      const px = plane.nx > 0 ? box.maxX : box.minX;
      const py = plane.ny > 0 ? box.maxY : box.minY;
      const pz = plane.nz > 0 ? box.maxZ : box.minZ;

      // Test positive vertex against plane
      const distance = plane.nx * px + plane.ny * py + plane.nz * pz + plane.d;

      // If positive vertex is outside, entire box is outside
      // Use epsilon tolerance to prevent flickering on boundaries
      if (distance < -EPSILON) {
        return false;
      }
    }

    return true;
  }

  /**
   * Test if a point is inside the frustum.
   *
   * @param x Point X coordinate
   * @param y Point Y coordinate
   * @param z Point Z coordinate
   * @returns true if point is inside frustum
   */
  containsPoint(x: number, y: number, z: number): boolean {
    for (let i = 0; i < 6; i++) {
      const plane = this._planes[i];
      const distance = plane.nx * x + plane.ny * y + plane.nz * z + plane.d;

      // Use epsilon tolerance to prevent flickering on boundaries
      if (distance < -EPSILON) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get a specific frustum plane.
   *
   * @param index Plane index (use FrustumPlane enum)
   * @returns Plane object (readonly reference)
   */
  getPlane(index: FrustumPlane): Readonly<Plane> {
    return this._planes[index];
  }

  /**
   * Create a copy of this frustum.
   *
   * @returns New Frustum instance with copied planes
   */
  clone(): Frustum {
    const copy = new Frustum();
    for (let i = 0; i < 6; i++) {
      copy._planes[i] = { ...this._planes[i] };
    }
    return copy;
  }
}
