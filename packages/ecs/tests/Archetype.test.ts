import { describe, it, expect, beforeEach } from 'vitest';
import { ArchetypeManager } from '../src/Archetype';
import { ComponentRegistry } from '../src/ComponentRegistry';
import { createFieldDescriptor } from '../src/ComponentStorage';
import type { ComponentType } from '../src/types';

// Test components
class Transform {
  readonly __componentType = 'Transform';
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  readonly __componentType = 'Velocity';
  constructor(public vx: number = 0, public vy: number = 0) {}
}

class Health {
  readonly __componentType = 'Health';
  constructor(public value: number = 100) {}
}

// Register test components
ComponentRegistry.register(Transform, [
  createFieldDescriptor('x', 0),
  createFieldDescriptor('y', 0),
]);

ComponentRegistry.register(Velocity, [
  createFieldDescriptor('vx', 0),
  createFieldDescriptor('vy', 0),
]);

ComponentRegistry.register(Health, [
  createFieldDescriptor('value', 100),
]);

describe('ArchetypeManager', () => {
  let archetypeManager: ArchetypeManager;

  beforeEach(() => {
    archetypeManager = new ArchetypeManager();
    // Clear component registry to avoid conflicts between tests
    ComponentRegistry.clear();
    // Re-register components for this test
    ComponentRegistry.register(Transform, [
      createFieldDescriptor('x', 0),
      createFieldDescriptor('y', 0),
    ]);
    ComponentRegistry.register(Velocity, [
      createFieldDescriptor('vx', 0),
      createFieldDescriptor('vy', 0),
    ]);
    ComponentRegistry.register(Health, [
      createFieldDescriptor('value', 100),
    ]);
  });

  describe('getOrCreateArchetype', () => {
    it('should create archetype with single component', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);

      expect(archetype).toBeDefined();
      expect(archetype.types).toContain(Transform);
      expect(archetype.types.length).toBe(1);
      expect(archetype.count).toBe(0);
    });

    it('should create archetype with multiple components', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform, Velocity, Health]);

      expect(archetype.types.length).toBe(3);
      expect(archetype.types).toContain(Transform);
      expect(archetype.types).toContain(Velocity);
      expect(archetype.types).toContain(Health);
    });

    it('should return same archetype for same component set', () => {
      const archetype1 = archetypeManager.getOrCreateArchetype([Transform, Velocity]);
      const archetype2 = archetypeManager.getOrCreateArchetype([Transform, Velocity]);

      expect(archetype1).toBe(archetype2);
    });

    it('should return same archetype regardless of component order', () => {
      const archetype1 = archetypeManager.getOrCreateArchetype([Transform, Velocity]);
      const archetype2 = archetypeManager.getOrCreateArchetype([Velocity, Transform]);

      expect(archetype1).toBe(archetype2);
    });

    it('should create different archetypes for different component sets', () => {
      const archetype1 = archetypeManager.getOrCreateArchetype([Transform]);
      const archetype2 = archetypeManager.getOrCreateArchetype([Transform, Velocity]);

      expect(archetype1).not.toBe(archetype2);
    });

    it('should generate unique IDs for different archetypes', () => {
      const archetype1 = archetypeManager.getOrCreateArchetype([Transform]);
      const archetype2 = archetypeManager.getOrCreateArchetype([Velocity]);
      const archetype3 = archetypeManager.getOrCreateArchetype([Health]);

      expect(archetype1.id).not.toBe(archetype2.id);
      expect(archetype2.id).not.toBe(archetype3.id);
      expect(archetype1.id).not.toBe(archetype3.id);
    });
  });

  describe('addEntity', () => {
    it('should add entity to archetype', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);
      const components = new Map<ComponentType, any>([
        [Transform, new Transform(10, 20)],
      ]);

      const index = archetypeManager.addEntity(archetype, 123, components);

      expect(index).toBe(0);
      expect(archetypeManager.getEntities(archetype)).toContain(123);
      expect(archetype.count).toBe(1);
    });

    it('should store component data correctly', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);
      const transform = new Transform(10, 20);
      const components = new Map<ComponentType, any>([[Transform, transform]]);

      archetypeManager.addEntity(archetype, 123, components);

      // NOTE: SoA storage extracts field values into typed arrays, not storing class instances
      const storedComponent = archetypeManager.getComponent(archetype, Transform, 0);
      expect(storedComponent).toBeDefined();
      expect(storedComponent!.x).toBe(10);
      expect(storedComponent!.y).toBe(20);
    });

    it('should add multiple entities to same archetype', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);

      const index1 = archetypeManager.addEntity(
        archetype,
        1,
        new Map([[Transform, new Transform(1, 1)]])
      );
      const index2 = archetypeManager.addEntity(
        archetype,
        2,
        new Map([[Transform, new Transform(2, 2)]])
      );
      const index3 = archetypeManager.addEntity(
        archetype,
        3,
        new Map([[Transform, new Transform(3, 3)]])
      );

      expect(index1).toBe(0);
      expect(index2).toBe(1);
      expect(index3).toBe(2);
      expect(archetypeManager.getEntities(archetype)).toEqual([1, 2, 3]);
    });

    it('should handle multiple components per entity', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform, Velocity, Health]);
      const components = new Map<ComponentType, any>([
        [Transform, new Transform(5, 10)],
        [Velocity, new Velocity(1, 2)],
        [Health, new Health(75)],
      ]);

      archetypeManager.addEntity(archetype, 456, components);

      expect(archetypeManager.getComponent(archetype, Transform, 0).x).toBe(5);
      expect(archetypeManager.getComponent(archetype, Velocity, 0).vx).toBe(1);
      expect(archetypeManager.getComponent(archetype, Health, 0).value).toBe(75);
    });
  });

  describe('removeEntity', () => {
    it('should remove entity from archetype', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);
      archetypeManager.addEntity(archetype, 123, new Map([[Transform, new Transform()]]));

      const movedEntityId = archetypeManager.removeEntity(archetype, 0);

      expect(archetype.count).toBe(0);
      expect(movedEntityId).toBeUndefined();
    });

    it('should use swap-and-pop for removal', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);

      // Add 3 entities
      archetypeManager.addEntity(archetype, 1, new Map([[Transform, new Transform(1, 1)]]));
      archetypeManager.addEntity(archetype, 2, new Map([[Transform, new Transform(2, 2)]]));
      archetypeManager.addEntity(archetype, 3, new Map([[Transform, new Transform(3, 3)]]));

      // Remove middle entity (index 1)
      const movedEntityId = archetypeManager.removeEntity(archetype, 1);

      // Entity 3 should have been swapped to index 1
      expect(movedEntityId).toBe(3);
      expect(archetypeManager.getEntities(archetype)).toEqual([1, 3]);
      expect(archetypeManager.getComponent(archetype, Transform, 0)!.x).toBe(1);
      expect(archetypeManager.getComponent(archetype, Transform, 1)!.x).toBe(3);
    });

    it('should not return moved entity when removing last element', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);
      archetypeManager.addEntity(archetype, 1, new Map([[Transform, new Transform()]]));
      archetypeManager.addEntity(archetype, 2, new Map([[Transform, new Transform()]]));

      const movedEntityId = archetypeManager.removeEntity(archetype, 1); // Remove last

      expect(movedEntityId).toBeUndefined();
      expect(archetypeManager.getEntities(archetype)).toEqual([1]);
    });

    it('should handle multiple component arrays correctly', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform, Velocity]);

      archetypeManager.addEntity(
        archetype,
        1,
        new Map([
          [Transform, new Transform(1, 1)],
          [Velocity, new Velocity(10, 10)],
        ])
      );
      archetypeManager.addEntity(
        archetype,
        2,
        new Map([
          [Transform, new Transform(2, 2)],
          [Velocity, new Velocity(20, 20)],
        ])
      );
      archetypeManager.addEntity(
        archetype,
        3,
        new Map([
          [Transform, new Transform(3, 3)],
          [Velocity, new Velocity(30, 30)],
        ])
      );

      archetypeManager.removeEntity(archetype, 1); // Remove middle

      expect(archetypeManager.getEntities(archetype)).toEqual([1, 3]);
      expect(archetypeManager.getComponent(archetype, Transform, 1)!.x).toBe(3);
      expect(archetypeManager.getComponent(archetype, Velocity, 1)!.vx).toBe(30);
    });
  });

  describe('getComponent', () => {
    it('should retrieve component by type and index', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform, Velocity]);
      const transform = new Transform(42, 84);
      const velocity = new Velocity(1, 2);

      archetypeManager.addEntity(
        archetype,
        1,
        new Map([
          [Transform, transform],
          [Velocity, velocity],
        ])
      );

      // NOTE: SoA storage (Epic 2.11) returns plain objects from typed arrays,
      // not class instances. We validate field values instead of object identity.
      const storedTransform = archetypeManager.getComponent(archetype, Transform, 0);
      const storedVelocity = archetypeManager.getComponent(archetype, Velocity, 0);
      expect(storedTransform).toBeDefined();
      expect(storedVelocity).toBeDefined();
      expect(storedTransform!.x).toBe(42);
      expect(storedTransform!.y).toBe(84);
      expect(storedVelocity!.vx).toBe(1);
      expect(storedVelocity!.vy).toBe(2);
    });

    it('should return new object instances on each call (typed array behavior)', () => {
      // CRITICAL: Validates that ComponentStorage.getComponent() creates fresh objects
      // from typed arrays, not returning class instances. This is Epic 2.11's core behavior.
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);
      archetypeManager.addEntity(archetype, 1, new Map([[Transform, new Transform(10, 20)]]));

      const comp1 = archetypeManager.getComponent(archetype, Transform, 0);
      const comp2 = archetypeManager.getComponent(archetype, Transform, 0);

      expect(comp1).toBeDefined();
      expect(comp2).toBeDefined();

      // Different object instances (typed array storage creates new objects)
      expect(comp1).not.toBe(comp2);

      // But same underlying data
      expect(comp1!.x).toBe(comp2!.x);
      expect(comp1!.y).toBe(comp2!.y);
    });

    it('should isolate mutations to retrieved components (typed array immutability)', () => {
      // Validates that mutating a retrieved component doesn't affect storage
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);
      archetypeManager.addEntity(archetype, 1, new Map([[Transform, new Transform(10, 20)]]));

      const comp = archetypeManager.getComponent(archetype, Transform, 0);
      expect(comp).toBeDefined();

      // Mutate the retrieved object
      comp!.x = 999;
      comp!.y = 888;

      // Storage should be unchanged (mutation didn't affect typed arrays)
      const comp2 = archetypeManager.getComponent(archetype, Transform, 0);
      expect(comp2!.x).toBe(10);
      expect(comp2!.y).toBe(20);
    });

    it('should return undefined for non-existent component type', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);
      archetypeManager.addEntity(archetype, 1, new Map([[Transform, new Transform()]]));

      expect(archetypeManager.getComponent(archetype, Velocity, 0)).toBeUndefined();
    });
  });

  describe('getEntities', () => {
    it('should return array copy, not underlying typed array', () => {
      // Validates that getEntities() hides Uint32Array implementation detail
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);
      archetypeManager.addEntity(archetype, 1, new Map([[Transform, new Transform()]]));
      archetypeManager.addEntity(archetype, 2, new Map([[Transform, new Transform()]]));

      const entities = archetypeManager.getEntities(archetype);

      // Should be a regular Array, not Uint32Array
      expect(Array.isArray(entities)).toBe(true);
      expect(entities).toBeInstanceOf(Array);
      expect(entities).not.toBeInstanceOf(Uint32Array);
    });

    it('should not allow external mutation of archetype entities', () => {
      // Validates that returned array is a copy, mutations don't affect archetype
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);
      archetypeManager.addEntity(archetype, 1, new Map([[Transform, new Transform()]]));
      archetypeManager.addEntity(archetype, 2, new Map([[Transform, new Transform()]]));

      const entities = archetypeManager.getEntities(archetype);
      entities.push(999); // Mutate returned array
      entities[0] = 888;  // Mutate element

      // Archetype should be unchanged
      const entities2 = archetypeManager.getEntities(archetype);
      expect(entities2).toEqual([1, 2]);
      expect(entities2).not.toContain(999);
      expect(entities2).not.toContain(888);
    });

    it('should return only active entities, not full capacity', () => {
      // Validates that slice(0, count) is used, not returning unused capacity
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);
      archetypeManager.addEntity(archetype, 1, new Map([[Transform, new Transform()]]));
      archetypeManager.addEntity(archetype, 2, new Map([[Transform, new Transform()]]));
      archetypeManager.addEntity(archetype, 3, new Map([[Transform, new Transform()]]));

      const entities = archetypeManager.getEntities(archetype);

      expect(entities.length).toBe(3);              // Only active entities
      expect(archetype.capacity).toBe(256);          // Capacity is much larger
      expect(archetype.count).toBe(3);               // Count matches returned length
    });
  });

  describe('hasAllTypes', () => {
    it('should return true for components in archetype', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform, Velocity]);

      expect(archetypeManager.hasAllTypes(archetype, [Transform])).toBe(true);
      expect(archetypeManager.hasAllTypes(archetype, [Velocity])).toBe(true);
      expect(archetypeManager.hasAllTypes(archetype, [Transform, Velocity])).toBe(true);
    });

    it('should return false for components not in archetype', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);

      expect(archetypeManager.hasAllTypes(archetype, [Velocity])).toBe(false);
      expect(archetypeManager.hasAllTypes(archetype, [Health])).toBe(false);
      expect(archetypeManager.hasAllTypes(archetype, [Transform, Velocity])).toBe(false);
    });
  });

  describe('archetype growth and overflow protection', () => {
    it('should maintain typed array alignment during archetype growth', () => {
      // Validates that growing beyond initial capacity works correctly
      const archetype = archetypeManager.getOrCreateArchetype([Transform, Velocity]);

      // Fill beyond initial capacity (256)
      for (let i = 0; i < 300; i++) {
        archetypeManager.addEntity(
          archetype,
          i,
          new Map([
            [Transform, new Transform(i, i)],
            [Velocity, new Velocity(i, i)],
          ])
        );
      }

      // Validate all components intact after growth
      expect(archetype.count).toBe(300);
      expect(archetype.capacity).toBeGreaterThan(256); // Grew (should be 512)
      expect(archetypeManager.getComponent(archetype, Transform, 0)!.x).toBe(0);
      expect(archetypeManager.getComponent(archetype, Transform, 299)!.x).toBe(299);
      expect(archetypeManager.getComponent(archetype, Velocity, 299)!.vx).toBe(299);
    });

    it('should throw on capacity overflow beyond 2^30 entities', () => {
      // Validates integer overflow protection (Epic 2.11 code-critic fix #5)
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);

      // Artificially set capacity and count near limit to trigger growth
      archetype.capacity = 536870913; // Just over 2^29
      archetype.count = 536870913;    // Fill it so next add triggers growth

      // Attempting to grow should throw (would exceed 2^30 limit)
      expect(() => {
        archetypeManager.addEntity(archetype, 1, new Map([[Transform, new Transform()]]));
      }).toThrow(/overflow/i);
    });
  });

  describe('clear', () => {
    it('should remove all archetypes', () => {
      archetypeManager.getOrCreateArchetype([Transform]);
      archetypeManager.getOrCreateArchetype([Velocity]);
      archetypeManager.getOrCreateArchetype([Health]);

      expect(archetypeManager.getStats().totalArchetypes).toBe(3);

      archetypeManager.clear();

      expect(archetypeManager.getStats().totalArchetypes).toBe(0);
    });

    it('should reset archetype ID counter', () => {
      const archetype1 = archetypeManager.getOrCreateArchetype([Transform]);
      const id1 = archetype1.id;

      archetypeManager.clear();

      const archetype2 = archetypeManager.getOrCreateArchetype([Transform]);
      expect(archetype2.id).toBe(id1);
    });
  });

  describe('getStats', () => {
    it('should return correct archetype count', () => {
      archetypeManager.getOrCreateArchetype([Transform]);
      archetypeManager.getOrCreateArchetype([Velocity]);
      archetypeManager.getOrCreateArchetype([Transform, Velocity]);

      const stats = archetypeManager.getStats();
      expect(stats.totalArchetypes).toBe(3);
      expect(stats.archetypes.length).toBe(3);
    });

    it('should include archetype details', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform, Velocity]);
      archetypeManager.addEntity(
        archetype,
        1,
        new Map([
          [Transform, new Transform()],
          [Velocity, new Velocity()],
        ])
      );
      archetypeManager.addEntity(
        archetype,
        2,
        new Map([
          [Transform, new Transform()],
          [Velocity, new Velocity()],
        ])
      );

      const stats = archetypeManager.getStats();
      const archetypeInfo = stats.archetypes[0];

      expect(archetypeInfo.components).toEqual(['Transform', 'Velocity']);
      expect(archetypeInfo.entityCount).toBe(2);
    });
  });
});
