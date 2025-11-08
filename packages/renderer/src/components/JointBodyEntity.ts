/**
 * JointBodyEntity Component
 *
 * Links an ECS entity to its corresponding physics rigid body in the joints demo.
 * Stores metadata about the body for rendering (type, scale, color).
 */

import type { Component } from '../../../ecs/src/types';

export class JointBodyEntity implements Component {
  readonly __componentType = 'JointBodyEntity';

  /** Physics rigid body handle */
  bodyHandle: number = 0;

  /** Render type: 'cube' or 'sphere' */
  renderType: number = 0; // 0 = cube, 1 = sphere

  /** Scale for rendering */
  scaleX: number = 1;
  scaleY: number = 1;
  scaleZ: number = 1;

  /** Base color RGB */
  colorR: number = 1;
  colorG: number = 1;
  colorB: number = 1;

  constructor(
    bodyHandle: number = 0,
    type: 'cube' | 'sphere' = 'cube',
    scale: { x: number; y: number; z: number } = { x: 1, y: 1, z: 1 },
    color: [number, number, number] = [1, 1, 1]
  ) {
    this.bodyHandle = bodyHandle;
    this.renderType = type === 'cube' ? 0 : 1;
    this.scaleX = scale.x;
    this.scaleY = scale.y;
    this.scaleZ = scale.z;
    this.colorR = color[0];
    this.colorG = color[1];
    this.colorB = color[2];
  }
}
