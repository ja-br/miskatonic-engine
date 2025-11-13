import type { Component } from '../types';

/**
 * Transform component - PURE DATA SCHEMA (Epic 3.11.5)
 *
 * This is a data-only component with NO methods.
 * All transform operations are performed by TransformSystem.
 *
 * Why no methods?
 * - ComponentStorage returns plain objects from typed arrays
 * - Methods don't work on plain objects retrieved from storage
 * - Proper ECS pattern: Data in components, logic in systems
 *
 * Cache-Efficient Design:
 * - ALL data stored in typed arrays (SoA pattern)
 * - Parent/child hierarchy via linked list in typed arrays
 * - Matrix storage indices (actual matrices in MatrixStorage)
 * - Dirty flag for lazy matrix updates
 * - Zero allocations in hot paths
 *
 * Memory Layout (57 bytes per entity):
 * - Position: 12 bytes (3 × Float32)
 * - Rotation: 12 bytes (3 × Float32)
 * - Scale: 12 bytes (3 × Float32)
 * - Hierarchy: 12 bytes (3 × Int32)
 * - Dirty: 1 byte (Uint8)
 * - Matrix Indices: 8 bytes (2 × Int32)
 *
 * Matrices stored separately in MatrixStorage (128 bytes):
 * - Local matrix: 64 bytes (16 × Float32)
 * - World matrix: 64 bytes (16 × Float32)
 *
 * Total: 185 bytes per transform (down from 400+ in Epic 3.11)
 *
 * Usage:
 * ```typescript
 * // Create entity with transform
 * const entity = world.createEntity();
 * world.addComponent(entity, Transform, new Transform(0, 0, 0));
 *
 * // Modify transform via TransformSystem
 * transformSystem.setPosition(entity, 1, 2, 3);
 * transformSystem.setRotation(entity, 0, Math.PI / 4, 0);
 *
 * // Or modify raw data (advanced)
 * const transform = world.getComponent(entity, Transform);
 * transform.x = 10;
 * transform.dirty = 1; // Mark dirty
 * ```
 */
export class Transform implements Component {
  readonly __componentType = 'Transform';

  // Position (Float32Array)
  public x: number = 0;
  public y: number = 0;
  public z: number = 0;

  // Rotation in radians (Float32Array)
  public rotationX: number = 0;
  public rotationY: number = 0;
  public rotationZ: number = 0;

  // Scale (Float32Array)
  public scaleX: number = 1;
  public scaleY: number = 1;
  public scaleZ: number = 1;

  // Hierarchy - Linked List (Int32Array)
  // -1 = null/none
  public parentId: number = -1;           // Parent entity ID
  public firstChildId: number = -1;       // First child in linked list
  public nextSiblingId: number = -1;      // Next sibling in parent's child list

  // Dirty flag (Uint8Array)
  // 0 = clean (matrices up to date)
  // 1 = dirty (needs recalculation)
  public dirty: number = 1;

  // Matrix indices (Int32Array)
  // Indices into MatrixStorage (-1 = not allocated)
  public localMatrixIndex: number = -1;
  public worldMatrixIndex: number = -1;

  /**
   * Constructor for creating new Transform instances
   *
   * NOTE: This is only used when adding a component to an entity.
   * Retrieved components are plain objects, not instances.
   */
  constructor(
    x: number = 0,
    y: number = 0,
    z: number = 0,
    rotationX: number = 0,
    rotationY: number = 0,
    rotationZ: number = 0,
    scaleX: number = 1,
    scaleY: number = 1,
    scaleZ: number = 1
  ) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.rotationX = rotationX;
    this.rotationY = rotationY;
    this.rotationZ = rotationZ;
    this.scaleX = scaleX;
    this.scaleY = scaleY;
    this.scaleZ = scaleZ;
  }

  /**
   * Set scale uniformly on all axes
   */
  setScale(scale: number): void;
  /**
   * Set scale on individual axes
   */
  setScale(x: number, y: number, z: number): void;
  setScale(xOrUniform: number, y?: number, z?: number): void {
    if (y === undefined || z === undefined) {
      // Uniform scale
      this.scaleX = xOrUniform;
      this.scaleY = xOrUniform;
      this.scaleZ = xOrUniform;
    } else {
      // Non-uniform scale
      this.scaleX = xOrUniform;
      this.scaleY = y;
      this.scaleZ = z;
    }
    this.dirty = 1;
  }

  /**
   * Get scale as [x, y, z] array
   */
  getScale(): [number, number, number] {
    return [this.scaleX, this.scaleY, this.scaleZ];
  }

  /**
   * Check if scale is uniform (all axes equal within epsilon)
   */
  isUniformScale(epsilon: number = 0.000001): boolean {
    return Math.abs(this.scaleX - this.scaleY) < epsilon &&
           Math.abs(this.scaleY - this.scaleZ) < epsilon;
  }

  /**
   * Check for degenerate scale (any axis near zero)
   */
  hasDegenerateScale(epsilon: number = 0.000001): boolean {
    return Math.abs(this.scaleX) < epsilon ||
           Math.abs(this.scaleY) < epsilon ||
           Math.abs(this.scaleZ) < epsilon;
  }
}

/**
 * Helper type for Transform data retrieved from ComponentStorage
 *
 * This is what you actually get when calling world.getComponent(id, Transform).
 * It's a plain object with data fields, NOT a Transform instance.
 */
export type TransformData = {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  parentId: number;
  firstChildId: number;
  nextSiblingId: number;
  dirty: number;
  localMatrixIndex: number;
  worldMatrixIndex: number;
};
