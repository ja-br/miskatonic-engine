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
ComponentRegistry.register(Transform, [
  createFieldDescriptor('x', 0),
  createFieldDescriptor('y', 0),
  createFieldDescriptor('z', 0),
  createFieldDescriptor('rotationX', 0),
  createFieldDescriptor('rotationY', 0),
  createFieldDescriptor('rotationZ', 0),
  createFieldDescriptor('scaleX', 1),
  createFieldDescriptor('scaleY', 1),
  createFieldDescriptor('scaleZ', 1),
]);

// Register Velocity component
ComponentRegistry.register(Velocity, [
  createFieldDescriptor('vx', 0),
  createFieldDescriptor('vy', 0),
  createFieldDescriptor('vz', 0),
]);
