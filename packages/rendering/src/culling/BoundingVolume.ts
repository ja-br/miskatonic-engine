/**
 * Bounding Volume Classes - Epic 3.16
 *
 * Simple geometric volumes for intersection testing.
 * Used for light culling (sphere for point/spot lights, box for tile frustums).
 */

/**
 * Sphere bounding volume defined by center point and radius.
 * Used for point lights and spot lights (cone approximation).
 *
 * Usage:
 * ```typescript
 * const sphere = new BoundingSphere(5, 2, 0, 10);
 * const intersects = sphere.intersectsAABB(box);
 * ```
 */
export class BoundingSphere {
  /**
   * @param x Center X coordinate
   * @param y Center Y coordinate
   * @param z Center Z coordinate
   * @param radius Sphere radius (must be non-negative, zero represents a point)
   */
  constructor(
    public x: number,
    public y: number,
    public z: number,
    public radius: number
  ) {
    if (radius < 0) {
      throw new Error(`Sphere radius must be non-negative, got ${radius}`);
    }
  }

  /**
   * Test if this sphere intersects another sphere.
   * Uses distance check: intersects if distance between centers <= sum of radii.
   *
   * @param other Another sphere
   * @returns true if spheres intersect or touch
   */
  intersectsSphere(other: BoundingSphere): boolean {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const dz = this.z - other.z;
    const distanceSquared = dx * dx + dy * dy + dz * dz;

    const radiusSum = this.radius + other.radius;
    return distanceSquared <= radiusSum * radiusSum;
  }

  /**
   * Test if this sphere intersects an axis-aligned bounding box.
   * Uses Arvo's algorithm: find closest point on box to sphere center,
   * then check if distance <= radius.
   *
   * @param box AABB with min and max corners
   * @returns true if sphere intersects box
   */
  intersectsAABB(box: BoundingBox): boolean {
    // Find closest point on box to sphere center
    const closestX = Math.max(box.minX, Math.min(this.x, box.maxX));
    const closestY = Math.max(box.minY, Math.min(this.y, box.maxY));
    const closestZ = Math.max(box.minZ, Math.min(this.z, box.maxZ));

    // Compute distance squared from sphere center to closest point
    const dx = this.x - closestX;
    const dy = this.y - closestY;
    const dz = this.z - closestZ;
    const distanceSquared = dx * dx + dy * dy + dz * dz;

    return distanceSquared <= this.radius * this.radius;
  }

  /**
   * Test if a point is inside this sphere.
   *
   * @param x Point X coordinate
   * @param y Point Y coordinate
   * @param z Point Z coordinate
   * @returns true if point is inside sphere
   */
  containsPoint(x: number, y: number, z: number): boolean {
    const dx = this.x - x;
    const dy = this.y - y;
    const dz = this.z - z;
    const distanceSquared = dx * dx + dy * dy + dz * dz;

    return distanceSquared <= this.radius * this.radius;
  }

  /**
   * Create a new sphere from a point and radius.
   *
   * @param position Array [x, y, z]
   * @param radius Sphere radius
   * @returns New BoundingSphere
   */
  static fromPoint(position: [number, number, number], radius: number): BoundingSphere {
    return new BoundingSphere(position[0], position[1], position[2], radius);
  }

  /**
   * Compute a bounding sphere that encloses a set of points.
   * Uses naive centroid + max distance algorithm (not optimal, but simple).
   *
   * @param points Array of [x, y, z] points
   * @returns Bounding sphere (or null if no points)
   */
  static fromPoints(points: Array<[number, number, number]>): BoundingSphere | null {
    if (points.length === 0) {
      return null;
    }

    // Compute centroid
    let cx = 0, cy = 0, cz = 0;
    for (const [x, y, z] of points) {
      cx += x;
      cy += y;
      cz += z;
    }
    cx /= points.length;
    cy /= points.length;
    cz /= points.length;

    // Find max distance from centroid
    let maxDistanceSquared = 0;
    for (const [x, y, z] of points) {
      const dx = x - cx;
      const dy = y - cy;
      const dz = z - cz;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      maxDistanceSquared = Math.max(maxDistanceSquared, distanceSquared);
    }

    const radius = Math.sqrt(maxDistanceSquared);
    // Zero radius is valid (represents a point)
    return new BoundingSphere(cx, cy, cz, radius);
  }

  /**
   * Create a copy of this sphere.
   *
   * @returns New BoundingSphere with same parameters
   */
  clone(): BoundingSphere {
    return new BoundingSphere(this.x, this.y, this.z, this.radius);
  }
}

/**
 * Axis-aligned bounding box (AABB) defined by min and max corners.
 * Used for tile frustums and object bounds.
 *
 * Usage:
 * ```typescript
 * const box = new BoundingBox(-10, -10, -10, 10, 10, 10);
 * const contains = box.containsPoint(0, 0, 0);
 * ```
 */
export class BoundingBox {
  /**
   * @param minX Minimum X coordinate
   * @param minY Minimum Y coordinate
   * @param minZ Minimum Z coordinate
   * @param maxX Maximum X coordinate
   * @param maxY Maximum Y coordinate
   * @param maxZ Maximum Z coordinate
   */
  constructor(
    public minX: number,
    public minY: number,
    public minZ: number,
    public maxX: number,
    public maxY: number,
    public maxZ: number
  ) {
    if (minX > maxX || minY > maxY || minZ > maxZ) {
      throw new Error(
        `Invalid bounding box: min must be <= max. ` +
        `Got min=[${minX}, ${minY}, ${minZ}], max=[${maxX}, ${maxY}, ${maxZ}]`
      );
    }
  }

  /**
   * Test if this box intersects another box.
   * Uses separating axis theorem: boxes don't intersect if separated on any axis.
   *
   * @param other Another AABB
   * @returns true if boxes intersect or touch
   */
  intersectsAABB(other: BoundingBox): boolean {
    return (
      this.minX <= other.maxX &&
      this.maxX >= other.minX &&
      this.minY <= other.maxY &&
      this.maxY >= other.minY &&
      this.minZ <= other.maxZ &&
      this.maxZ >= other.minZ
    );
  }

  /**
   * Test if this box intersects a sphere.
   * Delegates to BoundingSphere.intersectsAABB().
   *
   * @param sphere Bounding sphere
   * @returns true if box intersects sphere
   */
  intersectsSphere(sphere: BoundingSphere): boolean {
    return sphere.intersectsAABB(this);
  }

  /**
   * Test if a point is inside this box.
   *
   * @param x Point X coordinate
   * @param y Point Y coordinate
   * @param z Point Z coordinate
   * @returns true if point is inside box (inclusive bounds)
   */
  containsPoint(x: number, y: number, z: number): boolean {
    return (
      x >= this.minX &&
      x <= this.maxX &&
      y >= this.minY &&
      y <= this.maxY &&
      z >= this.minZ &&
      z <= this.maxZ
    );
  }

  /**
   * Test if this box fully contains another box.
   *
   * @param other Another AABB
   * @returns true if other box is completely inside this box
   */
  containsAABB(other: BoundingBox): boolean {
    return (
      other.minX >= this.minX &&
      other.maxX <= this.maxX &&
      other.minY >= this.minY &&
      other.maxY <= this.maxY &&
      other.minZ >= this.minZ &&
      other.maxZ <= this.maxZ
    );
  }

  /**
   * Compute the center point of this box.
   *
   * @returns Center coordinates [x, y, z]
   */
  getCenter(): [number, number, number] {
    return [
      (this.minX + this.maxX) * 0.5,
      (this.minY + this.maxY) * 0.5,
      (this.minZ + this.maxZ) * 0.5,
    ];
  }

  /**
   * Compute the size (extents) of this box.
   *
   * @returns Size [width, height, depth]
   */
  getSize(): [number, number, number] {
    return [
      this.maxX - this.minX,
      this.maxY - this.minY,
      this.maxZ - this.minZ,
    ];
  }

  /**
   * Create a new box from center and half-extents.
   *
   * @param center Center point [x, y, z]
   * @param halfExtents Half-sizes [halfWidth, halfHeight, halfDepth]
   * @returns New BoundingBox
   */
  static fromCenterAndExtents(
    center: [number, number, number],
    halfExtents: [number, number, number]
  ): BoundingBox {
    return new BoundingBox(
      center[0] - halfExtents[0],
      center[1] - halfExtents[1],
      center[2] - halfExtents[2],
      center[0] + halfExtents[0],
      center[1] + halfExtents[1],
      center[2] + halfExtents[2]
    );
  }

  /**
   * Create a bounding box that encloses a set of points.
   *
   * @param points Array of [x, y, z] points
   * @returns Bounding box (or null if no points)
   */
  static fromPoints(points: Array<[number, number, number]>): BoundingBox | null {
    if (points.length === 0) {
      return null;
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const [x, y, z] of points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }

    return new BoundingBox(minX, minY, minZ, maxX, maxY, maxZ);
  }

  /**
   * Expand this box to include another box.
   *
   * @param other Another AABB
   * @returns New expanded BoundingBox
   */
  union(other: BoundingBox): BoundingBox {
    return new BoundingBox(
      Math.min(this.minX, other.minX),
      Math.min(this.minY, other.minY),
      Math.min(this.minZ, other.minZ),
      Math.max(this.maxX, other.maxX),
      Math.max(this.maxY, other.maxY),
      Math.max(this.maxZ, other.maxZ)
    );
  }

  /**
   * Create a copy of this box.
   *
   * @returns New BoundingBox with same parameters
   */
  clone(): BoundingBox {
    return new BoundingBox(
      this.minX,
      this.minY,
      this.minZ,
      this.maxX,
      this.maxY,
      this.maxZ
    );
  }
}
