/**
 * Unit tests for TransformSystem normal matrix caching
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../../src/World';
import { TransformSystem } from '../../src/systems/TransformSystem';
import { Transform } from '../../src/components/Transform';
import { ComponentRegistry } from '../../src/ComponentRegistry';

describe('TransformSystem.getNormalMatrix', () => {
  let world: World;
  let transformSystem: TransformSystem;

  beforeEach(() => {
    // Register Transform component before each test
    if (!ComponentRegistry.isRegistered(Transform)) {
      ComponentRegistry.autoRegister(Transform);
    }

    world = new World();
    transformSystem = new TransformSystem(world);
  });

  test('computes normal matrix on first call', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Transform, new Transform(0, 0, 0));

    const normalMatrix = transformSystem.getNormalMatrix(entity);

    expect(normalMatrix).not.toBeNull();
    expect(normalMatrix!.length).toBe(12);

    // Identity transform should produce identity normal matrix
    expect(normalMatrix![0]).toBeCloseTo(1, 6);
    expect(normalMatrix![5]).toBeCloseTo(1, 6);
    expect(normalMatrix![10]).toBeCloseTo(1, 6);

    // Padding should be zero
    expect(normalMatrix![3]).toBe(0);
    expect(normalMatrix![7]).toBe(0);
    expect(normalMatrix![11]).toBe(0);
  });

  test('returns cached normal matrix on subsequent calls', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Transform, new Transform(0, 0, 0));

    const normalMatrix1 = transformSystem.getNormalMatrix(entity);
    const normalMatrix2 = transformSystem.getNormalMatrix(entity);

    // Should return same cached Float32Array instance
    expect(normalMatrix2).toBe(normalMatrix1);
  });

  test('invalidates cache when transform updates', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Transform, new Transform(0, 0, 0));

    const normalMatrix1 = transformSystem.getNormalMatrix(entity);

    // Update transform
    transformSystem.setPosition(entity, 10, 20, 30);

    const normalMatrix2 = transformSystem.getNormalMatrix(entity);

    // Should be different instance (cache was invalidated and recomputed)
    expect(normalMatrix2).not.toBe(normalMatrix1);
  });

  test('handles non-uniform scale correctly', () => {
    const entity = world.createEntity();
    const transform = new Transform(0, 0, 0);
    transform.scaleX = 2;
    transform.scaleY = 3;
    transform.scaleZ = 4;
    world.addComponent(entity, Transform, transform);

    // Force update to recompute world matrix
    transformSystem.update(0);

    const normalMatrix = transformSystem.getNormalMatrix(entity);

    expect(normalMatrix).not.toBeNull();

    // Non-uniform scale produces inverse-transpose
    // For scale [2, 3, 4], normal matrix diagonal should be [1/2, 1/3, 1/4]
    expect(normalMatrix![0]).toBeCloseTo(0.5, 5);   // 1/2
    expect(normalMatrix![5]).toBeCloseTo(1/3, 5);   // 1/3
    expect(normalMatrix![10]).toBeCloseTo(0.25, 5); // 1/4
  });

  test('handles rotation correctly', () => {
    const entity = world.createEntity();
    const transform = new Transform(0, 0, 0);
    transform.rotationY = Math.PI / 2; // 90 degree rotation around Y
    world.addComponent(entity, Transform, transform);

    transformSystem.update(0);

    const normalMatrix = transformSystem.getNormalMatrix(entity);

    expect(normalMatrix).not.toBeNull();

    // All values should be finite
    for (let i = 0; i < 12; i++) {
      expect(isFinite(normalMatrix![i])).toBe(true);
    }
  });

  test('returns null for degenerate scale', () => {
    const entity = world.createEntity();
    const transform = new Transform(0, 0, 0);
    transform.scaleX = 0; // Degenerate scale
    world.addComponent(entity, Transform, transform);

    transformSystem.update(0);

    const normalMatrix = transformSystem.getNormalMatrix(entity);

    // Should return null for singular matrix
    expect(normalMatrix).toBeNull();
  });

  test('cleans up cache on entity destruction', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Transform, new Transform(0, 0, 0));

    // Compute normal matrix (creates cache entry)
    transformSystem.getNormalMatrix(entity);

    // Destroy entity
    world.destroyEntity(entity);

    // Cache should be cleaned up
    // (We can't directly inspect the cache, but we can verify no errors occur)
    expect(() => transformSystem.getNormalMatrix(entity)).not.toThrow();
  });

  test('handles parent-child hierarchy', () => {
    const parent = world.createEntity();
    const child = world.createEntity();

    const parentTransform = new Transform(10, 0, 0);
    parentTransform.scaleX = 2;
    parentTransform.scaleY = 2;
    parentTransform.scaleZ = 2;

    const childTransform = new Transform(5, 0, 0);

    world.addComponent(parent, Transform, parentTransform);
    world.addComponent(child, Transform, childTransform);

    transformSystem.setParent(child, parent);
    transformSystem.update(0);

    const childNormalMatrix = transformSystem.getNormalMatrix(child);

    expect(childNormalMatrix).not.toBeNull();

    // Child inherits parent's scale, so normal matrix should reflect that
    // Parent scale [2,2,2] means child normal matrix should have [1/2, 1/2, 1/2]
    expect(childNormalMatrix![0]).toBeCloseTo(0.5, 5);
    expect(childNormalMatrix![5]).toBeCloseTo(0.5, 5);
    expect(childNormalMatrix![10]).toBeCloseTo(0.5, 5);
  });

  test('cache invalidates on setPosition', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Transform, new Transform(0, 0, 0));

    const before = transformSystem.getNormalMatrix(entity);
    transformSystem.setPosition(entity, 10, 20, 30);
    const after = transformSystem.getNormalMatrix(entity);

    // Position doesn't affect normal matrix values, but cache should still invalidate
    expect(after).not.toBe(before); // Different instance = cache was invalidated
  });

  test('cache invalidates on setRotation', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Transform, new Transform(0, 0, 0));

    const before = transformSystem.getNormalMatrix(entity);
    transformSystem.setRotation(entity, Math.PI / 4, 0, 0);
    const after = transformSystem.getNormalMatrix(entity);

    expect(after).not.toBe(before);
  });

  test('cache invalidates on setScale', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Transform, new Transform(0, 0, 0));

    const before = transformSystem.getNormalMatrix(entity);
    transformSystem.setScale(entity, 2, 2, 2);
    const after = transformSystem.getNormalMatrix(entity);

    expect(after).not.toBe(before);
  });

  test('multiple entities maintain separate caches', () => {
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();

    const transform1 = new Transform(0, 0, 0);
    transform1.scaleX = 2;
    const transform2 = new Transform(0, 0, 0);
    transform2.scaleX = 3;

    world.addComponent(entity1, Transform, transform1);
    world.addComponent(entity2, Transform, transform2);

    transformSystem.update(0);

    const normalMatrix1 = transformSystem.getNormalMatrix(entity1);
    const normalMatrix2 = transformSystem.getNormalMatrix(entity2);

    // Should be different instances
    expect(normalMatrix2).not.toBe(normalMatrix1);

    // Should have different values based on scale
    expect(normalMatrix1![0]).toBeCloseTo(0.5, 5);  // 1/2
    expect(normalMatrix2![0]).toBeCloseTo(1/3, 5);  // 1/3
  });

  test('system cleanup clears all cached normal matrices', () => {
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();

    world.addComponent(entity1, Transform, new Transform(0, 0, 0));
    world.addComponent(entity2, Transform, new Transform(0, 0, 0));

    transformSystem.getNormalMatrix(entity1);
    transformSystem.getNormalMatrix(entity2);

    transformSystem.destroy();

    // After destroy, system should be cleaned up (no errors)
    expect(() => transformSystem.getNormalMatrix(entity1)).not.toThrow();
  });
});

describe('TransformSystem integration with normal matrices', () => {
  let world: World;
  let transformSystem: TransformSystem;

  beforeEach(() => {
    // Register Transform component before each test
    if (!ComponentRegistry.isRegistered(Transform)) {
      ComponentRegistry.autoRegister(Transform);
    }

    world = new World();
    transformSystem = new TransformSystem(world);
  });

  test('normal matrix for complex TRS composition', () => {
    const entity = world.createEntity();
    const transform = new Transform(10, 20, 30); // Translation
    transform.rotationX = Math.PI / 6;  // Rotation
    transform.rotationY = Math.PI / 4;
    transform.rotationZ = 0;
    transform.scaleX = 2;  // Non-uniform scale
    transform.scaleY = 3;
    transform.scaleZ = 1.5;

    world.addComponent(entity, Transform, transform);
    transformSystem.update(0);

    const normalMatrix = transformSystem.getNormalMatrix(entity);

    expect(normalMatrix).not.toBeNull();
    expect(normalMatrix!.length).toBe(12);

    // Verify all components are finite
    for (let i = 0; i < 12; i++) {
      expect(isFinite(normalMatrix![i])).toBe(true);
    }

    // Verify padding
    expect(normalMatrix![3]).toBe(0);
    expect(normalMatrix![7]).toBe(0);
    expect(normalMatrix![11]).toBe(0);
  });

  test('normal matrix updates when world matrix changes', () => {
    const parent = world.createEntity();
    const child = world.createEntity();

    world.addComponent(parent, Transform, new Transform(0, 0, 0));
    world.addComponent(child, Transform, new Transform(0, 0, 0));

    transformSystem.setParent(child, parent);
    transformSystem.update(0);

    const beforeNormal = transformSystem.getNormalMatrix(child);

    // Change parent scale - should affect child's world matrix
    transformSystem.setScale(parent, 2, 2, 2);
    transformSystem.update(0);

    const afterNormal = transformSystem.getNormalMatrix(child);

    // Cache should have been invalidated when parent changed
    expect(afterNormal).not.toBe(beforeNormal);
  });
});
