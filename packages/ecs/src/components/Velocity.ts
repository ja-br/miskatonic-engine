import type { Component } from '../types';

/**
 * Velocity component - linear velocity for movement
 */
export class Velocity implements Component {
  readonly __componentType = 'Velocity';

  constructor(
    public vx: number = 0,
    public vy: number = 0,
    public vz: number = 0
  ) {}

  /**
   * Set velocity
   */
  set(vx: number, vy: number, vz: number): void {
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
  }

  /**
   * Get speed (magnitude)
   */
  getSpeed(): number {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
  }

  /**
   * Normalize velocity
   */
  normalize(): void {
    const speed = this.getSpeed();
    if (speed > 0) {
      this.vx /= speed;
      this.vy /= speed;
      this.vz /= speed;
    }
  }

  /**
   * Clone this velocity
   */
  clone(): Velocity {
    return new Velocity(this.vx, this.vy, this.vz);
  }
}
