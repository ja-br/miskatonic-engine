import type { Component } from '../types';

/**
 * Transform component - position, rotation, scale
 *
 * This is a core component used by most game entities.
 */
export class Transform implements Component {
  readonly __componentType = 'Transform';

  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0,
    public rotationX: number = 0,
    public rotationY: number = 0,
    public rotationZ: number = 0,
    public scaleX: number = 1,
    public scaleY: number = 1,
    public scaleZ: number = 1
  ) {}

  /**
   * Set position
   */
  setPosition(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  /**
   * Set rotation (in radians)
   */
  setRotation(x: number, y: number, z: number): void {
    this.rotationX = x;
    this.rotationY = y;
    this.rotationZ = z;
  }

  /**
   * Set scale
   */
  setScale(x: number, y: number, z: number): void {
    this.scaleX = x;
    this.scaleY = y;
    this.scaleZ = z;
  }

  /**
   * Clone this transform
   */
  clone(): Transform {
    return new Transform(
      this.x,
      this.y,
      this.z,
      this.rotationX,
      this.rotationY,
      this.rotationZ,
      this.scaleX,
      this.scaleY,
      this.scaleZ
    );
  }
}
