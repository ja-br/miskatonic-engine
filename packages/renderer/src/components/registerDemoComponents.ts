/**
 * Demo Component Registration
 *
 * Registers custom components used in the demo applications.
 */

import { ComponentRegistry, createFieldDescriptor } from '@miskatonic/ecs';
import type { ComponentType } from '@miskatonic/ecs';
import { DiceEntity } from './DiceEntity';
import { JointBodyEntity } from './JointBodyEntity';

// Register DiceEntity component
ComponentRegistry.register(DiceEntity as ComponentType<DiceEntity>, [
  // Physics rigid body handle (1 × Uint32 = 4 bytes)
  createFieldDescriptor('bodyHandle', 0, Uint32Array),

  // Dice metadata (1 × Uint8 = 1 byte)
  createFieldDescriptor('sides', 6, Uint8Array),

  // Spawn position (3 × Float32 = 12 bytes)
  createFieldDescriptor('spawnX', 0),
  createFieldDescriptor('spawnY', 0),
  createFieldDescriptor('spawnZ', 0),

  // Original angular velocity (3 × Float32 = 12 bytes)
  createFieldDescriptor('angularVelX', 0),
  createFieldDescriptor('angularVelY', 0),
  createFieldDescriptor('angularVelZ', 0),
]);

// Register JointBodyEntity component
ComponentRegistry.register(JointBodyEntity as ComponentType<JointBodyEntity>, [
  // Physics rigid body handle (1 × Uint32 = 4 bytes)
  createFieldDescriptor('bodyHandle', 0, Uint32Array),

  // Render type: 0 = cube, 1 = sphere (1 × Uint8 = 1 byte)
  createFieldDescriptor('renderType', 0, Uint8Array),

  // Scale (3 × Float32 = 12 bytes)
  createFieldDescriptor('scaleX', 1),
  createFieldDescriptor('scaleY', 1),
  createFieldDescriptor('scaleZ', 1),

  // Color RGB (3 × Float32 = 12 bytes)
  createFieldDescriptor('colorR', 1),
  createFieldDescriptor('colorG', 1),
  createFieldDescriptor('colorB', 1),
]);
