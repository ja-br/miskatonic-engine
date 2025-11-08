import type { System, ComponentType } from '../types';
import { SystemPriority } from '../types';
import type { World } from '../World';
import { Transform } from '../components/Transform';
import { Velocity } from '../components/Velocity';

/**
 * Movement System - updates entity positions based on velocity
 *
 * This is an example system that demonstrates:
 * - Querying entities with multiple components
 * - Iterating over matching entities
 * - Updating component data
 * - Frame-rate independent movement with deltaTime
 */
export class MovementSystem implements System {
  readonly name = 'MovementSystem';
  readonly priority = SystemPriority.UPDATE;

  private query?: ReturnType<ReturnType<World['query']>['build']>;

  /**
   * Initialize the system - cache the query
   */
  init(world: World): void {
    // Cache query to avoid rebuilding every frame
    this.query = world
      .query()
      .with(Transform as ComponentType<Transform>)
      .with(Velocity as ComponentType<Velocity>)
      .build();
  }

  /**
   * Update all entities with Transform and Velocity components
   */
  update(world: World, deltaTime: number): void {
    if (!this.query) {
      // Fallback if init wasn't called
      this.init(world);
    }

    // Execute query and update each matching entity
    this.query!.forEach(world.getArchetypeManager(), (_entityId, components) => {
      const transform = components.get(Transform as ComponentType<Transform>) as Transform;
      const velocity = components.get(Velocity as ComponentType<Velocity>) as Velocity;

      // Update position based on velocity and delta time
      // deltaTime is in seconds, so this gives us units per second movement
      transform.x += velocity.vx * deltaTime;
      transform.y += velocity.vy * deltaTime;
      transform.z += velocity.vz * deltaTime;
    });
  }

  /**
   * Cleanup the system (optional)
   */
  cleanup(_world: World): void {
    this.query = undefined;
  }
}
