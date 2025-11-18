/**
 * Vitest setup file
 * This file is imported before any tests run to perform global setup
 */

// Import WebGPU mocks for GPU-related tests
import './mocks/mockWebGPU';

// Import and register all components
import { ComponentRegistry, createFieldDescriptor } from '@miskatonic/ecs';
import { Camera, Transform } from '@miskatonic/ecs';

// Mock localStorage for browser-dependent tests
if (typeof globalThis.localStorage === 'undefined') {
  const storage = new Map<string, string>();

  // @ts-expect-error - Mocking browser API
  globalThis.localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    get length() {
      return storage.size;
    },
    key: (index: number) => {
      const keys = Array.from(storage.keys());
      return keys[index] ?? null;
    },
  };
}

// Register Camera component (Epic 3.10)
ComponentRegistry.register(Camera, [
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

// Register Transform (should already be registered, but just in case)
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
  createFieldDescriptor('parentId', -1, Int32Array),
  createFieldDescriptor('firstChildId', -1, Int32Array),
  createFieldDescriptor('nextSiblingId', -1, Int32Array),
  createFieldDescriptor('dirty', 1, Uint8Array),
  createFieldDescriptor('localMatrixIndex', -1, Int32Array),
  createFieldDescriptor('worldMatrixIndex', -1, Int32Array),
]);
