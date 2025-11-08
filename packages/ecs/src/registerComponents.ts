/**
 * Component registration file
 *
 * Registers built-in components with the ComponentRegistry.
 * Import this file to auto-register Transform and Velocity components.
 */

import { ComponentRegistry } from './ComponentRegistry';
import { createFieldDescriptor } from './ComponentStorage';
import { Transform } from './components/Transform';
import { Velocity } from './components/Velocity';

// Register Transform component
// Epic 3.11.5: Cache-efficient storage with ALL data in typed arrays
ComponentRegistry.register(Transform, [
  // Position (3 × Float32 = 12 bytes)
  createFieldDescriptor('x', 0),
  createFieldDescriptor('y', 0),
  createFieldDescriptor('z', 0),

  // Rotation (3 × Float32 = 12 bytes)
  createFieldDescriptor('rotationX', 0),
  createFieldDescriptor('rotationY', 0),
  createFieldDescriptor('rotationZ', 0),

  // Scale (3 × Float32 = 12 bytes)
  createFieldDescriptor('scaleX', 1),
  createFieldDescriptor('scaleY', 1),
  createFieldDescriptor('scaleZ', 1),

  // Hierarchy - Linked List (3 × Int32 = 12 bytes)
  // Epic 3.11.5: Parent/child relationships in typed arrays
  createFieldDescriptor('parentId', -1, Int32Array),
  createFieldDescriptor('firstChildId', -1, Int32Array),
  createFieldDescriptor('nextSiblingId', -1, Int32Array),

  // Dirty flag (1 × Uint8 = 1 byte)
  // Epic 3.11.5: Dirty tracking in typed array
  createFieldDescriptor('dirty', 1, Uint8Array),

  // Matrix indices (2 × Int32 = 8 bytes)
  // Epic 3.11.5: Indices into MatrixStorage instead of storing matrices here
  createFieldDescriptor('localMatrixIndex', -1, Int32Array),
  createFieldDescriptor('worldMatrixIndex', -1, Int32Array),
]);

// Register Velocity component
ComponentRegistry.register(Velocity, [
  createFieldDescriptor('vx', 0),
  createFieldDescriptor('vy', 0),
  createFieldDescriptor('vz', 0),
]);
