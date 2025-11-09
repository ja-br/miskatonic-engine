import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../src/World';
import { Transform } from '../src/components/Transform';
import { Velocity } from '../src/components/Velocity';
import { ComponentRegistry } from '../src/ComponentRegistry';
import { createFieldDescriptor } from '../src/ComponentStorage';
import type { System } from '../src/types';
import { SystemPriority } from '../src/types';

// Register Transform and Velocity
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

ComponentRegistry.register(Velocity, [
  createFieldDescriptor('vx', 0),
  createFieldDescriptor('vy', 0),
  createFieldDescriptor('vz', 0),
]);

// Test component
class Health {
  readonly __componentType = 'Health';
  constructor(public value: number = 100) {}
}

// Register Health
ComponentRegistry.register(Health, [
  createFieldDescriptor('value', 100),
]);

// Test system
class TestSystem implements System {
  readonly name = 'TestSystem';
  readonly priority = SystemPriority.UPDATE;

  public initCalled = false;
  public updateCalled = false;
  public cleanupCalled = false;
  public lastDeltaTime = 0;

  init(_world: World): void {
    this.initCalled = true;
  }

  update(_world: World, deltaTime: number): void {
    this.updateCalled = true;
    this.lastDeltaTime = deltaTime;
  }

  cleanup(_world: World): void {
    this.cleanupCalled = true;
  }
}

describe('World', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('entity lifecycle', () => {
    it('should create entities', () => {
      const entity = world.createEntity();
      expect(entity).toBeGreaterThan(0);
      expect(world.hasEntity(entity)).toBe(true);
    });

    it('should create unique entities', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      const entity3 = world.createEntity();

      expect(entity1).not.toBe(entity2);
      expect(entity2).not.toBe(entity3);
      expect(entity1).not.toBe(entity3);
    });

    it('should destroy entities', () => {
      const entity = world.createEntity();
      expect(world.hasEntity(entity)).toBe(true);

      world.destroyEntity(entity);
      expect(world.hasEntity(entity)).toBe(false);
    });

    it('should handle destroying non-existent entities gracefully', () => {
      expect(() => world.destroyEntity(999)).not.toThrow();
    });
  });

  describe('component management', () => {
    it('should add components to entities', () => {
      const entity = world.createEntity();
      const transform = new Transform(10, 20, 30);

      world.addComponent(entity, Transform, transform);

      expect(world.hasComponent(entity, Transform)).toBe(true);

      // NOTE: SoA storage (Epic 2.11) returns plain objects from typed arrays,
      // not class instances. We validate field values instead of object identity.
      const retrieved = world.getComponent(entity, Transform);
      expect(retrieved).toBeDefined();
      expect(retrieved!.x).toBe(10);
      expect(retrieved!.y).toBe(20);
      expect(retrieved!.z).toBe(30);
    });

    it('should add multiple components to same entity', () => {
      const entity = world.createEntity();
      const transform = new Transform(1, 2, 3);
      const velocity = new Velocity(4, 5, 6);
      const health = new Health(75);

      world.addComponent(entity, Transform, transform);
      world.addComponent(entity, Velocity, velocity);
      world.addComponent(entity, Health, health);

      expect(world.hasComponent(entity, Transform)).toBe(true);
      expect(world.hasComponent(entity, Velocity)).toBe(true);
      expect(world.hasComponent(entity, Health)).toBe(true);
    });

    it('should remove components from entities', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Transform, new Transform());

      expect(world.hasComponent(entity, Transform)).toBe(true);

      world.removeComponent(entity, Transform);

      expect(world.hasComponent(entity, Transform)).toBe(false);
    });

    it('should preserve other components when removing one', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Transform, new Transform());
      world.addComponent(entity, Velocity, new Velocity());

      world.removeComponent(entity, Transform);

      expect(world.hasComponent(entity, Transform)).toBe(false);
      expect(world.hasComponent(entity, Velocity)).toBe(true);
    });

    it('should handle removing non-existent components gracefully', () => {
      const entity = world.createEntity();
      expect(() => world.removeComponent(entity, Transform)).not.toThrow();
    });

    it('should throw when adding component to non-existent entity', () => {
      expect(() => {
        world.addComponent(999, Transform, new Transform());
      }).toThrow();
    });

    it('should return undefined for non-existent components', () => {
      const entity = world.createEntity();
      expect(world.getComponent(entity, Transform)).toBeUndefined();
    });
  });

  describe('queries', () => {
    it('should find entities with specific components', () => {
      const entity1 = world.createEntity();
      world.addComponent(entity1, Transform, new Transform(1, 1, 1));
      world.addComponent(entity1, Velocity, new Velocity(1, 1, 1));

      const entity2 = world.createEntity();
      world.addComponent(entity2, Transform, new Transform(2, 2, 2));

      const query = world.query().with(Transform).with(Velocity).build();
      const results = world.executeQuery(query);

      expect(results.length).toBe(1);
      expect(results[0].entity).toBe(entity1);
    });

    it('should find all entities with single component', () => {
      const entity1 = world.createEntity();
      world.addComponent(entity1, Transform, new Transform(1, 1, 1));

      const entity2 = world.createEntity();
      world.addComponent(entity2, Transform, new Transform(2, 2, 2));

      const entity3 = world.createEntity();
      world.addComponent(entity3, Velocity, new Velocity(3, 3, 3));

      const query = world.query().with(Transform).build();
      const results = world.executeQuery(query);

      expect(results.length).toBe(2);
    });

    it('should exclude entities with specific components', () => {
      const entity1 = world.createEntity();
      world.addComponent(entity1, Transform, new Transform(1, 1, 1));

      const entity2 = world.createEntity();
      world.addComponent(entity2, Transform, new Transform(2, 2, 2));
      world.addComponent(entity2, Velocity, new Velocity(2, 2, 2));

      const query = world.query().with(Transform).without(Velocity).build();
      const results = world.executeQuery(query);

      expect(results.length).toBe(1);
      expect(results[0].entity).toBe(entity1);
    });
  });

  describe('system management', () => {
    it('should register systems', () => {
      const system = new TestSystem();
      world.registerSystem(system);

      // Should not throw
      expect(() => world.init()).not.toThrow();
    });

    it('should call init on systems', () => {
      const system = new TestSystem();
      world.registerSystem(system);

      world.init();

      expect(system.initCalled).toBe(true);
    });

    it('should call update on systems', () => {
      const system = new TestSystem();
      world.registerSystem(system);
      world.init();

      world.update(0.016);

      expect(system.updateCalled).toBe(true);
      expect(system.lastDeltaTime).toBe(0.016);
    });

    it('should call cleanup on systems', () => {
      const system = new TestSystem();
      world.registerSystem(system);
      world.init();

      world.cleanup();

      expect(system.cleanupCalled).toBe(true);
    });

    it('should unregister systems', () => {
      const system = new TestSystem();
      world.registerSystem(system);
      world.unregisterSystem('TestSystem');

      world.init();

      // System should not be called
      expect(system.initCalled).toBe(false);
    });

    it('should execute systems in priority order', () => {
      const callOrder: string[] = [];

      class System1 implements System {
        readonly name = 'System1';
        readonly priority = SystemPriority.LAST;
        update(_world: World, _deltaTime: number): void {
          callOrder.push('System1');
        }
      }

      class System2 implements System {
        readonly name = 'System2';
        readonly priority = SystemPriority.FIRST;
        update(_world: World, _deltaTime: number): void {
          callOrder.push('System2');
        }
      }

      class System3 implements System {
        readonly name = 'System3';
        readonly priority = SystemPriority.UPDATE;
        update(_world: World, _deltaTime: number): void {
          callOrder.push('System3');
        }
      }

      // Register in non-priority order to test sorting
      world.registerSystem(new System1());  // LAST
      world.registerSystem(new System2());  // FIRST
      world.registerSystem(new System3());  // UPDATE

      world.update(0.016);

      expect(callOrder).toEqual(['System2', 'System3', 'System1']);
    });
  });

  describe('clear', () => {
    it('should remove all entities', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();

      world.clear();

      expect(world.hasEntity(entity1)).toBe(false);
      expect(world.hasEntity(entity2)).toBe(false);
    });

    it('should cleanup systems when clearing', () => {
      const system = new TestSystem();
      world.registerSystem(system);
      world.init();

      world.clear();

      expect(system.cleanupCalled).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      world.createEntity();
      world.createEntity();

      const stats = world.getStats();

      expect(stats.entities).toBeDefined();
      expect(stats.archetypes).toBeDefined();
      expect(stats.systems).toBeDefined();
    });
  });

  describe('integration tests', () => {
    it('should handle complex entity/component operations', () => {
      // Create entities with various component combinations
      const entity1 = world.createEntity();
      world.addComponent(entity1, Transform, new Transform(0, 0, 0));
      world.addComponent(entity1, Velocity, new Velocity(1, 0, 0));

      const entity2 = world.createEntity();
      world.addComponent(entity2, Transform, new Transform(10, 10, 10));
      world.addComponent(entity2, Health, new Health(50));

      const entity3 = world.createEntity();
      world.addComponent(entity3, Velocity, new Velocity(0, 1, 0));
      world.addComponent(entity3, Health, new Health(100));

      // Query for Transform entities
      const transformQuery = world.query().with(Transform).build();
      expect(world.executeQuery(transformQuery).length).toBe(2);

      // Query for entities with Transform AND Velocity
      const movingQuery = world.query().with(Transform).with(Velocity).build();
      expect(world.executeQuery(movingQuery).length).toBe(1);

      // Destroy an entity
      world.destroyEntity(entity2);

      // Re-run queries
      expect(world.executeQuery(transformQuery).length).toBe(1);
      expect(world.executeQuery(movingQuery).length).toBe(1);
    });

    it('should maintain component data integrity through archetype transitions', () => {
      const entity = world.createEntity();

      // Add Transform
      const transform = new Transform(5, 10, 15);
      world.addComponent(entity, Transform, transform);

      // Verify data
      expect(world.getComponent(entity, Transform)?.x).toBe(5);

      // Add Velocity (causes archetype transition)
      const velocity = new Velocity(1, 2, 3);
      world.addComponent(entity, Velocity, velocity);

      // Verify both components are intact
      expect(world.getComponent(entity, Transform)?.x).toBe(5);
      expect(world.getComponent(entity, Velocity)?.vx).toBe(1);

      // Remove Transform (another archetype transition)
      world.removeComponent(entity, Transform);

      // Verify Velocity is still intact
      expect(world.getComponent(entity, Velocity)?.vx).toBe(1);
      expect(world.hasComponent(entity, Transform)).toBe(false);
    });
  });
});
