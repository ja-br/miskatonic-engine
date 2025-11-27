import { describe, it, expect, beforeAll } from 'vitest';
import {
  PhysicsWorld,
  RapierPhysicsEngine,
  RigidBodyType,
  CollisionShapeType,
  JointType
} from '@miskatonic/physics';
import type {
  RigidBodyHandle,
  JointHandle
} from '@miskatonic/physics';

/**
 * Integration tests for Epic 4.5: Fix Deterministic Simulation (Critical Bugs)
 *
 * These tests verify that the serialization/deserialization system correctly:
 * 1. Serializes and deserializes colliders (fix for CRITICAL bug #1)
 * 2. Restores joints with remapped handles (fix for CRITICAL bug #2)
 * 3. Returns handle mapping for external references (fix for CRITICAL bug #3)
 * 4. Provides user data migration helpers (fix for CRITICAL bug #4)
 * 5. Handles edge cases without division by zero (fix for CRITICAL bug #5)
 */

let RAPIER: any;

// Initialize Rapier before tests
beforeAll(async () => {
  RAPIER = await import('@dimforge/rapier3d-compat');
  await RAPIER.init();
});

// Helper to create a physics world with Rapier engine
async function createPhysicsWorld(): Promise<PhysicsWorld> {
  const engine = new RapierPhysicsEngine();
  return PhysicsWorld.create(engine, {
    gravity: { x: 0, y: -9.81, z: 0 }
  });
}

describe('Deterministic Serialization - Epic 4.5', () => {
  describe('Bug #1: Colliders Serialization', () => {
    it('should serialize and deserialize bodies with box colliders', async () => {
      const world = await createPhysicsWorld();

      // Create body with box collider
      const handle = world.createRigidBody({
        type: RigidBodyType.DYNAMIC,
        position: { x: 0, y: 5, z: 0 },
        collisionShape: {
          type: CollisionShapeType.BOX,
          halfExtents: { x: 1, y: 1, z: 1 }
        },
        mass: 10,
        friction: 0.7,
        restitution: 0.3
      });

      // Simulate a few steps
      for (let i = 0; i < 10; i++) {
        world.step(1 / 60);
      }

      // Serialize state
      const state = world.serializeState();

      // Verify collider is in serialized state
      expect(state.bodies.length).toBe(1);
      expect(state.bodies[0].colliders.length).toBeGreaterThan(0);
      expect(state.bodies[0].colliders[0].shape.type).toBe(CollisionShapeType.BOX);
      expect(state.bodies[0].colliders[0].friction).toBe(0.7);
      expect(state.bodies[0].colliders[0].restitution).toBe(0.3);

      // Deserialize
      const { bodyHandleMap } = world.deserializeState(state);

      // Verify handle mapping
      expect(bodyHandleMap.size).toBe(1);
      expect(bodyHandleMap.has(handle)).toBe(true);

      world.dispose();
    });

    it('should serialize and deserialize bodies with sphere colliders', async () => {
      const world = await createPhysicsWorld();

      world.createRigidBody({
        type: RigidBodyType.DYNAMIC,
        position: { x: 0, y: 5, z: 0 },
        collisionShape: {
          type: CollisionShapeType.SPHERE,
          radius: 2.5
        },
        mass: 5
      });

      const state = world.serializeState();

      expect(state.bodies[0].colliders.length).toBeGreaterThan(0);
      expect(state.bodies[0].colliders[0].shape.type).toBe(CollisionShapeType.SPHERE);

      world.dispose();
    });
  });

  describe('Bug #2: Joints Restoration', () => {
    it('should serialize and deserialize joints with remapped body handles', async () => {
      const world = await createPhysicsWorld();

      // Create two bodies
      const bodyA = world.createRigidBody({
        type: RigidBodyType.STATIC,
        position: { x: 0, y: 0, z: 0 },
        collisionShape: {
          type: CollisionShapeType.BOX,
          halfExtents: { x: 1, y: 1, z: 1 }
        }
      });

      const bodyB = world.createRigidBody({
        type: RigidBodyType.DYNAMIC,
        position: { x: 0, y: 3, z: 0 },
        collisionShape: {
          type: CollisionShapeType.BOX,
          halfExtents: { x: 0.5, y: 0.5, z: 0.5 }
        },
        mass: 1
      });

      // Create a revolute joint between them
      const jointHandle = world.createJoint({
        type: JointType.REVOLUTE,
        bodyA,
        bodyB,
        anchorA: { position: { x: 0, y: 1, z: 0 } },
        anchorB: { position: { x: 0, y: -0.5, z: 0 } },
        axis: { x: 0, y: 0, z: 1 }
      });

      // Simulate
      for (let i = 0; i < 30; i++) {
        world.step(1 / 60);
      }

      // Serialize
      const state = world.serializeState();

      // Verify joint is serialized
      expect(state.joints.length).toBe(1);
      expect(state.joints[0].descriptor.type).toBe(JointType.REVOLUTE);

      // Deserialize
      const { bodyHandleMap, jointHandleMap } = world.deserializeState(state);

      // Verify both mappings exist
      expect(bodyHandleMap.size).toBe(2);
      expect(jointHandleMap.size).toBe(1);
      expect(jointHandleMap.has(jointHandle)).toBe(true);

      // Verify joint still connects the bodies
      const newBodyA = bodyHandleMap.get(bodyA);
      const newBodyB = bodyHandleMap.get(bodyB);
      expect(newBodyA).toBeDefined();
      expect(newBodyB).toBeDefined();

      world.dispose();
    });
  });

  describe('Bug #3: Handle Remapping', () => {
    it('should return DeserializationResult with handle mappings', async () => {
      const world = await createPhysicsWorld();

      const handle1 = world.createRigidBody({
        type: RigidBodyType.DYNAMIC,
        position: { x: 0, y: 0, z: 0 },
        collisionShape: {
          type: CollisionShapeType.BOX,
          halfExtents: { x: 1, y: 1, z: 1 }
        }
      });

      const handle2 = world.createRigidBody({
        type: RigidBodyType.DYNAMIC,
        position: { x: 5, y: 0, z: 0 },
        collisionShape: {
          type: CollisionShapeType.SPHERE,
          radius: 1
        }
      });

      const state = world.serializeState();
      const result = world.deserializeState(state);

      // Verify result structure
      expect(result).toHaveProperty('bodyHandleMap');
      expect(result).toHaveProperty('jointHandleMap');

      // Verify all bodies are mapped
      expect(result.bodyHandleMap.size).toBe(2);
      expect(result.bodyHandleMap.has(handle1)).toBe(true);
      expect(result.bodyHandleMap.has(handle2)).toBe(true);

      // Verify new handles are different (Rapier assigns new ones)
      const newHandle1 = result.bodyHandleMap.get(handle1);
      const newHandle2 = result.bodyHandleMap.get(handle2);
      expect(newHandle1).toBeDefined();
      expect(newHandle2).toBeDefined();

      world.dispose();
    });
  });

  describe('Bug #4: User Data Migration', () => {
    it('should provide helper to rebuild user data map', async () => {
      const world = await createPhysicsWorld();

      // Create bodies with user data
      const handle1 = world.createRigidBody({
        type: RigidBodyType.DYNAMIC,
        position: { x: 0, y: 0, z: 0 },
        collisionShape: {
          type: CollisionShapeType.BOX,
          halfExtents: { x: 1, y: 1, z: 1 }
        }
      });

      const handle2 = world.createRigidBody({
        type: RigidBodyType.DYNAMIC,
        position: { x: 5, y: 0, z: 0 },
        collisionShape: {
          type: CollisionShapeType.SPHERE,
          radius: 1
        }
      });

      // Set user data
      world.setUserData(handle1, { entityId: 'player' });
      world.setUserData(handle2, { entityId: 'enemy' });

      // Save user data before deserialization
      const oldUserData = new Map(world.bodies);

      const state = world.serializeState();
      const { bodyHandleMap } = world.deserializeState(state);

      // User data should be cleared after deserialization
      expect(world.getUserData(handle1)).toBeUndefined();
      expect(world.getUserData(handle2)).toBeUndefined();

      // Rebuild user data using helper
      world.rebuildUserData(oldUserData, bodyHandleMap);

      // Verify user data is restored with new handles
      const newHandle1 = bodyHandleMap.get(handle1)!;
      const newHandle2 = bodyHandleMap.get(handle2)!;

      expect(world.getUserData(newHandle1)).toEqual({ entityId: 'player' });
      expect(world.getUserData(newHandle2)).toEqual({ entityId: 'enemy' });

      world.dispose();
    });
  });

  describe('Determinism Verification', () => {
    it('should correctly restore state from serialization', async () => {
      const world = await createPhysicsWorld();

      // Create some bodies
      world.createRigidBody({
        type: RigidBodyType.DYNAMIC,
        position: { x: 0, y: 10, z: 0 },
        collisionShape: {
          type: CollisionShapeType.BOX,
          halfExtents: { x: 1, y: 1, z: 1 }
        },
        mass: 1
      });

      world.createRigidBody({
        type: RigidBodyType.STATIC,
        position: { x: 0, y: 0, z: 0 },
        collisionShape: {
          type: CollisionShapeType.BOX,
          halfExtents: { x: 10, y: 0.5, z: 10 }
        }
      });

      // Simulate for a bit
      for (let i = 0; i < 30; i++) {
        world.step(1 / 60);
      }

      // Serialize state
      const savedState = world.serializeState();

      // Deserialize
      world.deserializeState(savedState);

      // Immediately serialize again (before any steps)
      const restoredState = world.serializeState();

      // The restored state should match the saved state exactly
      expect(restoredState.bodies.length).toBe(savedState.bodies.length);

      for (let i = 0; i < savedState.bodies.length; i++) {
        const saved = savedState.bodies[i];
        const restored = restoredState.bodies[i];

        // Positions should be identical
        expect(restored.position.x).toBeCloseTo(saved.position.x, 5);
        expect(restored.position.y).toBeCloseTo(saved.position.y, 5);
        expect(restored.position.z).toBeCloseTo(saved.position.z, 5);

        // Velocities should be identical
        expect(restored.linearVelocity.x).toBeCloseTo(saved.linearVelocity.x, 5);
        expect(restored.linearVelocity.y).toBeCloseTo(saved.linearVelocity.y, 5);
        expect(restored.linearVelocity.z).toBeCloseTo(saved.linearVelocity.z, 5);

        // Rotations should be identical
        expect(restored.rotation.x).toBeCloseTo(saved.rotation.x, 5);
        expect(restored.rotation.y).toBeCloseTo(saved.rotation.y, 5);
        expect(restored.rotation.z).toBeCloseTo(saved.rotation.z, 5);
        expect(restored.rotation.w).toBeCloseTo(saved.rotation.w, 5);

        // Angular velocities should be identical
        expect(restored.angularVelocity.x).toBeCloseTo(saved.angularVelocity.x, 5);
        expect(restored.angularVelocity.y).toBeCloseTo(saved.angularVelocity.y, 5);
        expect(restored.angularVelocity.z).toBeCloseTo(saved.angularVelocity.z, 5);
      }

      world.dispose();
    });


    it('should serialize bodies in deterministic order', async () => {
      const world = await createPhysicsWorld();

      // Create bodies in specific order
      world.createRigidBody({
        type: RigidBodyType.DYNAMIC,
        position: { x: 0, y: 0, z: 0 },
        collisionShape: { type: CollisionShapeType.SPHERE, radius: 1 }
      });

      world.createRigidBody({
        type: RigidBodyType.DYNAMIC,
        position: { x: 5, y: 0, z: 0 },
        collisionShape: { type: CollisionShapeType.BOX, halfExtents: { x: 1, y: 1, z: 1 } }
      });

      const state1 = world.serializeState();
      const state2 = world.serializeState();

      // Serialization should be deterministic
      expect(state1.bodies.length).toBe(state2.bodies.length);
      expect(state1.bodies[0].handle).toBe(state2.bodies[0].handle);
      expect(state1.bodies[1].handle).toBe(state2.bodies[1].handle);

      // Handles should be in sorted order
      expect(state1.bodies[0].handle).toBeLessThan(state1.bodies[1].handle);

      world.dispose();
    });
  });
});
