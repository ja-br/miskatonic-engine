/**
 * DiceEntity Component
 *
 * Links an ECS entity to its corresponding physics rigid body.
 * Stores metadata about the dice for rendering and gameplay.
 */

import type { Component } from '@miskatonic/ecs';

export class DiceEntity implements Component {
  readonly __componentType = 'DiceEntity';

  /** Physics rigid body handle */
  bodyHandle: number = 0;

  /** Number of sides on the dice (d4, d6, d8, d10, d12, d20) */
  sides: number = 6;

  /** Original spawn position for respawn functionality */
  spawnX: number = 0;
  spawnY: number = 0;
  spawnZ: number = 0;

  /** Original angular velocity for respawn */
  angularVelX: number = 0;
  angularVelY: number = 0;
  angularVelZ: number = 0;

  constructor(
    bodyHandle: number = 0,
    sides: number = 6,
    spawnPos: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
    angularVel: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }
  ) {
    this.bodyHandle = bodyHandle;
    this.sides = sides;
    this.spawnX = spawnPos.x;
    this.spawnY = spawnPos.y;
    this.spawnZ = spawnPos.z;
    this.angularVelX = angularVel.x;
    this.angularVelY = angularVel.y;
    this.angularVelZ = angularVel.z;
  }
}
