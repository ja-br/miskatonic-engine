/**
 * PhysicsBody Component
 *
 * Links an ECS entity to a physics body in the physics simulation.
 * This is a standard component that works with PhysicsSyncSystem to
 * synchronize physics state to ECS Transform components.
 *
 * Usage:
 * ```typescript
 * const entity = world.createEntity();
 * world.addComponent(entity, Transform, new Transform(0, 10, 0));
 * world.addComponent(entity, PhysicsBody, new PhysicsBody(bodyHandle, 'dynamic'));
 * ```
 */

import type { Component } from '@miskatonic/ecs';

export type PhysicsBodyType = 'dynamic' | 'static' | 'kinematic';

export class PhysicsBody implements Component {
  readonly __componentType = 'PhysicsBody';

  constructor(
    /**
     * Handle to the physics body in the physics world.
     * This is an opaque identifier returned by PhysicsWorld.createRigidBody()
     */
    public bodyHandle: number,

    /**
     * Type of physics body:
     * - dynamic: Affected by forces and collisions
     * - static: Never moves (terrain, walls)
     * - kinematic: Moves via velocity, not affected by forces
     */
    public type: PhysicsBodyType = 'dynamic'
  ) {}
}
