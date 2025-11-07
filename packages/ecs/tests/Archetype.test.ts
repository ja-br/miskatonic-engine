import { describe, it, expect, beforeEach } from 'vitest';
import { ArchetypeManager } from '../src/Archetype';
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

describe('ArchetypeManager', () => {
  let archetypeManager: ArchetypeManager;

  beforeEach(() => {
    archetypeManager = new ArchetypeManager();
  });

  describe('getOrCreateArchetype', () => {
    it('should create archetype with single component', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);

      expect(archetype).toBeDefined();
      expect(archetype.types).toContain(Transform);
      expect(archetype.types.length).toBe(1);
      expect(archetype.entities.length).toBe(0);
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
      expect(archetype.entities).toContain(123);
      expect(archetype.entities.length).toBe(1);
    });

    it('should store component data correctly', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);
      const transform = new Transform(10, 20);
      const components = new Map<ComponentType, any>([[Transform, transform]]);

      archetypeManager.addEntity(archetype, 123, components);

      const storedComponent = archetypeManager.getComponent(archetype, Transform, 0);
      expect(storedComponent).toBe(transform);
      expect(storedComponent.x).toBe(10);
      expect(storedComponent.y).toBe(20);
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
      expect(archetype.entities).toEqual([1, 2, 3]);
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

      expect(archetype.entities.length).toBe(0);
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
      expect(archetype.entities).toEqual([1, 3]);
      expect(archetypeManager.getComponent(archetype, Transform, 0).x).toBe(1);
      expect(archetypeManager.getComponent(archetype, Transform, 1).x).toBe(3);
    });

    it('should not return moved entity when removing last element', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);
      archetypeManager.addEntity(archetype, 1, new Map([[Transform, new Transform()]]));
      archetypeManager.addEntity(archetype, 2, new Map([[Transform, new Transform()]]));

      const movedEntityId = archetypeManager.removeEntity(archetype, 1); // Remove last

      expect(movedEntityId).toBeUndefined();
      expect(archetype.entities).toEqual([1]);
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

      expect(archetype.entities).toEqual([1, 3]);
      expect(archetypeManager.getComponent(archetype, Transform, 1).x).toBe(3);
      expect(archetypeManager.getComponent(archetype, Velocity, 1).vx).toBe(30);
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

      expect(archetypeManager.getComponent(archetype, Transform, 0)).toBe(transform);
      expect(archetypeManager.getComponent(archetype, Velocity, 0)).toBe(velocity);
    });

    it('should return undefined for non-existent component type', () => {
      const archetype = archetypeManager.getOrCreateArchetype([Transform]);
      archetypeManager.addEntity(archetype, 1, new Map([[Transform, new Transform()]]));

      expect(archetypeManager.getComponent(archetype, Velocity, 0)).toBeUndefined();
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
