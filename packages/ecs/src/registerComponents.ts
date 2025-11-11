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
import { Camera } from './components/Camera';
import { Light } from './components/Light';
import type { ComponentType } from './types';

// Register Transform component
// Epic 3.11.5: Cache-efficient storage with ALL data in typed arrays
ComponentRegistry.register(Transform as ComponentType<Transform>, [
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
ComponentRegistry.register(Velocity as ComponentType<Velocity>, [
  createFieldDescriptor('vx', 0),
  createFieldDescriptor('vy', 0),
  createFieldDescriptor('vz', 0),
]);

// Register Camera component (Epic 3.10)
ComponentRegistry.register(Camera as ComponentType<Camera>, [
  // Projection type and settings
  createFieldDescriptor('projectionType', 0, Uint8Array), // 0=perspective, 1=orthographic
  createFieldDescriptor('fov', Math.PI / 4),
  createFieldDescriptor('perspectiveNear', 0.1),
  createFieldDescriptor('perspectiveFar', 100.0),

  // Orthographic bounds
  createFieldDescriptor('left', -10),
  createFieldDescriptor('right', 10),
  createFieldDescriptor('top', 10),
  createFieldDescriptor('bottom', -10),
  createFieldDescriptor('orthoNear', 0.1),
  createFieldDescriptor('orthoFar', 100.0),

  // Viewport
  createFieldDescriptor('viewportX', 0),
  createFieldDescriptor('viewportY', 0),
  createFieldDescriptor('viewportWidth', 1),
  createFieldDescriptor('viewportHeight', 1),

  // Clear color
  createFieldDescriptor('clearColorR', 0.1),
  createFieldDescriptor('clearColorG', 0.1),
  createFieldDescriptor('clearColorB', 0.1),
  createFieldDescriptor('clearColorA', 1.0),

  // Active flag
  createFieldDescriptor('active', 1, Uint8Array),
]);

// Register Light component (Epic 3.15)
ComponentRegistry.register(Light as ComponentType<Light>, [
  // Light type and enabled flag
  createFieldDescriptor('type', 0, Uint8Array), // 0=directional, 1=point, 2=spot, 3=ambient
  createFieldDescriptor('enabled', 1, Uint8Array),

  // Color and intensity
  createFieldDescriptor('colorR', 1.0),
  createFieldDescriptor('colorG', 1.0),
  createFieldDescriptor('colorB', 1.0),
  createFieldDescriptor('intensity', 1.0),

  // Direction (for directional/spot lights)
  createFieldDescriptor('directionX', 0.0),
  createFieldDescriptor('directionY', -1.0),
  createFieldDescriptor('directionZ', 0.0),

  // Position (for point/spot lights)
  createFieldDescriptor('positionX', 0.0),
  createFieldDescriptor('positionY', 0.0),
  createFieldDescriptor('positionZ', 0.0),

  // Radius (for point/spot lights)
  createFieldDescriptor('radius', 10.0),

  // Spot light parameters
  createFieldDescriptor('spotAngle', Math.PI / 4),
  createFieldDescriptor('spotPenumbra', 0.1),

  // Shadow configuration
  createFieldDescriptor('castsShadows', 0, Uint8Array),
  createFieldDescriptor('shadowBias', 0.005),
]);
