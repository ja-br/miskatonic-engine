/**
 * State Replication Manager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateReplicationManager, type IReplicable } from '../src/StateReplicationManager';
import type { NetworkId, StateBatch } from '../src/types';

// Mock entity class
class MockEntity implements IReplicable {
  constructor(
    private id: NetworkId,
    private type: string,
    private state: Record<string, any> = {}
  ) {}

  getNetworkId(): NetworkId {
    return this.id;
  }

  getEntityType(): string {
    return this.type;
  }

  serializeState(): Record<string, any> {
    return { ...this.state };
  }

  deserializeState(state: Record<string, any>): void {
    this.state = { ...state };
  }

  getState(): Record<string, any> {
    return this.state;
  }

  setState(state: Record<string, any>): void {
    this.state = state;
  }

  getUpdatePriority(): number {
    return 2; // Normal priority
  }
}

describe('StateReplicationManager', () => {
  let manager: StateReplicationManager;

  beforeEach(() => {
    manager = new StateReplicationManager({
      tickRate: 60,
      useDeltaCompression: true
    });
  });

  describe('registerEntity', () => {
    it('should register an entity', () => {
      const entity = new MockEntity(1, 'Player');
      manager.registerEntity(entity);

      expect(manager.hasEntity(1)).toBe(true);
      expect(manager.getEntityCount()).toBe(1);
    });

    it('should not register duplicate entities', () => {
      const entity = new MockEntity(1, 'Player');
      manager.registerEntity(entity);
      manager.registerEntity(entity);

      expect(manager.getEntityCount()).toBe(1);
    });

    it('should queue entity for full state sync on registration', () => {
      const entity = new MockEntity(1, 'Player', { x: 10 });
      manager.registerEntity(entity);

      const batch = manager.createStateBatch();

      // First batch should have full state
      expect(batch.fullStates.length).toBe(1);
      expect(batch.fullStates[0].id).toBe(1);
    });
  });

  describe('unregisterEntity', () => {
    it('should unregister an entity', () => {
      const entity = new MockEntity(1, 'Player');
      manager.registerEntity(entity);
      manager.unregisterEntity(1);

      expect(manager.hasEntity(1)).toBe(false);
      expect(manager.getEntityCount()).toBe(0);
    });

    it('should clear entity history on unregister', () => {
      const entity = new MockEntity(1, 'Player', { x: 10 });
      manager.registerEntity(entity);

      // Create a batch to record state
      manager.createStateBatch();

      // Unregister
      manager.unregisterEntity(1);

      // Re-register same entity
      manager.registerEntity(entity);
      const batch = manager.createStateBatch();

      // Should have full state again (no history)
      expect(batch.fullStates.length).toBe(1);
    });
  });

  describe('createStateBatch', () => {
    it('should create empty batch with no entities', () => {
      const batch = manager.createStateBatch();

      expect(batch.fullStates).toEqual([]);
      expect(batch.deltas).toEqual([]);
      expect(batch.destroyed).toEqual([]);
      expect(batch.tick).toBe(1);
    });

    it('should send full state for new entities', () => {
      const entity = new MockEntity(1, 'Player', { x: 10, y: 20 });
      manager.registerEntity(entity);

      const batch = manager.createStateBatch();

      expect(batch.fullStates.length).toBe(1);
      expect(batch.fullStates[0]).toEqual({
        id: 1,
        type: 'Player',
        state: { x: 10, y: 20 },
        timestamp: expect.any(Number),
        priority: 2
      });
    });

    it('should send delta updates for changed entities', () => {
      const entity = new MockEntity(1, 'Player', { x: 10, y: 20 });
      manager.registerEntity(entity);

      // First batch (full state)
      manager.createStateBatch();

      // Update entity
      entity.setState({ x: 15, y: 20 });

      // Second batch (should have delta)
      const batch2 = manager.createStateBatch();

      expect(batch2.deltas.length).toBe(1);
      expect(batch2.deltas[0].changes).toEqual({ x: 15 });
    });

    it('should not send anything for unchanged entities', () => {
      const entity = new MockEntity(1, 'Player', { x: 10, y: 20 });
      manager.registerEntity(entity);

      // First batch (full state)
      manager.createStateBatch();

      // Second batch (no changes)
      const batch2 = manager.createStateBatch();

      expect(batch2.fullStates.length).toBe(0);
      expect(batch2.deltas.length).toBe(0);
    });

    it('should handle multiple entities', () => {
      const entity1 = new MockEntity(1, 'Player', { x: 10 });
      const entity2 = new MockEntity(2, 'Enemy', { x: 20 });
      const entity3 = new MockEntity(3, 'Item', { x: 30 });

      manager.registerEntity(entity1);
      manager.registerEntity(entity2);
      manager.registerEntity(entity3);

      const batch = manager.createStateBatch();

      expect(batch.fullStates.length).toBe(3);
    });

    it('should increment tick on each batch', () => {
      const batch1 = manager.createStateBatch();
      const batch2 = manager.createStateBatch();
      const batch3 = manager.createStateBatch();

      expect(batch1.tick).toBe(1);
      expect(batch2.tick).toBe(2);
      expect(batch3.tick).toBe(3);
    });

    it('should handle serialization errors gracefully', () => {
      const faultyEntity = {
        getNetworkId: () => 1,
        getEntityType: () => 'Faulty',
        serializeState: () => {
          throw new Error('Serialization failed');
        },
        deserializeState: () => {},
        getUpdatePriority: () => 2
      };

      manager.registerEntity(faultyEntity as IReplicable);

      // Should not throw
      const batch = manager.createStateBatch();

      // Should have empty batch (entity skipped)
      expect(batch.fullStates.length).toBe(0);
    });

    it('should respect delta compression config', () => {
      const managerNoDelta = new StateReplicationManager({
        useDeltaCompression: false
      });

      const entity = new MockEntity(1, 'Player', { x: 10 });
      managerNoDelta.registerEntity(entity);

      // First batch
      managerNoDelta.createStateBatch();

      // Update
      entity.setState({ x: 15 });

      // Second batch should have full state (no delta)
      const batch2 = managerNoDelta.createStateBatch();

      expect(batch2.fullStates.length).toBe(1);
      expect(batch2.deltas.length).toBe(0);
    });
  });

  describe('applyStateBatch', () => {
    it('should apply full states', () => {
      const entity = new MockEntity(1, 'Player', { x: 10, y: 20 });
      manager.registerEntity(entity);

      const batch: StateBatch = {
        tick: 1,
        timestamp: Date.now(),
        fullStates: [
          {
            id: 1,
            type: 'Player',
            state: { x: 15, y: 25 },
            timestamp: Date.now()
          }
        ],
        deltas: [],
        destroyed: []
      };

      manager.applyStateBatch(batch);

      expect(entity.getState()).toEqual({ x: 15, y: 25 });
    });

    it('should apply delta updates', () => {
      const entity = new MockEntity(1, 'Player', { x: 10, y: 20 });
      manager.registerEntity(entity);

      // Record initial state
      const batch1 = manager.createStateBatch();
      manager.applyStateBatch(batch1);

      // Apply delta
      const batch2: StateBatch = {
        tick: 2,
        timestamp: Date.now(),
        fullStates: [],
        deltas: [
          {
            id: 1,
            changes: { x: 15 },
            timestamp: Date.now(),
            baseTimestamp: batch1.timestamp
          }
        ],
        destroyed: []
      };

      manager.applyStateBatch(batch2);

      expect(entity.getState()).toEqual({ x: 15, y: 20 });
    });

    it('should handle destroyed entities', () => {
      const entity = new MockEntity(1, 'Player');
      manager.registerEntity(entity);

      const batch: StateBatch = {
        tick: 1,
        timestamp: Date.now(),
        fullStates: [],
        deltas: [],
        destroyed: [1]
      };

      manager.applyStateBatch(batch);

      expect(manager.hasEntity(1)).toBe(false);
    });

    it('should warn for unknown entities', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const batch: StateBatch = {
        tick: 1,
        timestamp: Date.now(),
        fullStates: [
          {
            id: 999,
            type: 'Unknown',
            state: { x: 10 },
            timestamp: Date.now()
          }
        ],
        deltas: [],
        destroyed: []
      };

      manager.applyStateBatch(batch);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown entity 999')
      );

      consoleSpy.mockRestore();
    });

    it('should handle invalid batch gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Invalid batch (not an object)
      manager.applyStateBatch(null as any);

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle malformed arrays in batch', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const batch = {
        tick: 1,
        timestamp: Date.now(),
        fullStates: 'not an array' as any,
        deltas: [],
        destroyed: []
      };

      manager.applyStateBatch(batch);

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle deserialization errors gracefully', () => {
      const faultyEntity = {
        getNetworkId: () => 1,
        getEntityType: () => 'Faulty',
        serializeState: () => ({}),
        deserializeState: () => {
          throw new Error('Deserialization failed');
        }
      };

      manager.registerEntity(faultyEntity as IReplicable);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const batch: StateBatch = {
        tick: 1,
        timestamp: Date.now(),
        fullStates: [
          {
            id: 1,
            type: 'Faulty',
            state: { x: 10 },
            timestamp: Date.now()
          }
        ],
        deltas: [],
        destroyed: []
      };

      // Should not throw
      manager.applyStateBatch(batch);

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('requestFullState', () => {
    it('should force full state on next update', () => {
      const entity = new MockEntity(1, 'Player', { x: 10 });
      manager.registerEntity(entity);

      // First batch (full state)
      manager.createStateBatch();

      // Update entity
      entity.setState({ x: 15 });

      // Second batch (delta)
      const batch2 = manager.createStateBatch();
      expect(batch2.deltas.length).toBe(1);

      // Request full state
      manager.requestFullState(1);

      // Update again
      entity.setState({ x: 20 });

      // Third batch (should have full state)
      const batch3 = manager.createStateBatch();
      expect(batch3.fullStates.length).toBe(1);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      manager.updateConfig({ tickRate: 30 });

      const config = manager.getConfig();
      expect(config.tickRate).toBe(30);
    });

    it('should preserve other config values', () => {
      const originalConfig = manager.getConfig();

      manager.updateConfig({ tickRate: 30 });

      const newConfig = manager.getConfig();
      expect(newConfig.useDeltaCompression).toBe(originalConfig.useDeltaCompression);
    });
  });

  describe('clear', () => {
    it('should clear all entities and history', () => {
      const entity1 = new MockEntity(1, 'Player');
      const entity2 = new MockEntity(2, 'Enemy');

      manager.registerEntity(entity1);
      manager.registerEntity(entity2);

      manager.createStateBatch();

      manager.clear();

      expect(manager.getEntityCount()).toBe(0);
      expect(manager.hasEntity(1)).toBe(false);
      expect(manager.hasEntity(2)).toBe(false);
    });
  });

  describe('getCurrentTick', () => {
    it('should return current tick', () => {
      expect(manager.getCurrentTick()).toBe(0);

      manager.createStateBatch();
      expect(manager.getCurrentTick()).toBe(1);

      manager.createStateBatch();
      expect(manager.getCurrentTick()).toBe(2);
    });
  });

  describe('getEntity', () => {
    it('should return registered entity', () => {
      const entity = new MockEntity(1, 'Player');
      manager.registerEntity(entity);

      const retrieved = manager.getEntity(1);
      expect(retrieved).toBe(entity);
    });

    it('should return undefined for unknown entity', () => {
      const retrieved = manager.getEntity(999);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('integration: client-server sync', () => {
    it('should replicate state from server to client', () => {
      // Server setup
      const serverManager = new StateReplicationManager();
      const serverEntity = new MockEntity(1, 'Player', { x: 10, y: 20, health: 100 });
      serverManager.registerEntity(serverEntity);

      // Client setup
      const clientManager = new StateReplicationManager();
      const clientEntity = new MockEntity(1, 'Player', { x: 0, y: 0, health: 0 });
      clientManager.registerEntity(clientEntity);

      // Server creates batch
      const batch = serverManager.createStateBatch();

      // Client applies batch
      clientManager.applyStateBatch(batch);

      // Client state should match server
      expect(clientEntity.getState()).toEqual({ x: 10, y: 20, health: 100 });
    });

    it('should handle continuous updates with delta compression', () => {
      // Server setup
      const serverManager = new StateReplicationManager();
      const serverEntity = new MockEntity(1, 'Player', { x: 0, y: 0 });
      serverManager.registerEntity(serverEntity);

      // Client setup
      const clientManager = new StateReplicationManager();
      const clientEntity = new MockEntity(1, 'Player', { x: 0, y: 0 });
      clientManager.registerEntity(clientEntity);

      // Initial sync
      const batch1 = serverManager.createStateBatch();
      clientManager.applyStateBatch(batch1);

      // Server updates (simulate movement)
      for (let i = 1; i <= 10; i++) {
        serverEntity.setState({ x: i * 10, y: i * 5 });
        const batch = serverManager.createStateBatch();
        clientManager.applyStateBatch(batch);
      }

      // Final states should match
      expect(clientEntity.getState()).toEqual({ x: 100, y: 50 });
    });
  });
});
