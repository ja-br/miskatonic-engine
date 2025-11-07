/**
 * Delta Compression Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DeltaCompression } from '../src/DeltaCompression';
import type { EntityState } from '../src/types';

describe('DeltaCompression', () => {
  let compression: DeltaCompression;

  beforeEach(() => {
    compression = new DeltaCompression(64);
  });

  describe('recordState', () => {
    it('should record a state snapshot', () => {
      const state: EntityState = {
        id: 1,
        type: 'Player',
        state: { x: 10, y: 20 },
        timestamp: Date.now()
      };

      compression.recordState(state);
      const recorded = compression.getLastState(1);

      expect(recorded).toBeDefined();
      expect(recorded?.id).toBe(1);
      expect(recorded?.state).toEqual({ x: 10, y: 20 });
    });

    it('should deep clone state to prevent mutation', () => {
      const originalState = { x: 10, y: 20, nested: { z: 30 } };
      const state: EntityState = {
        id: 1,
        type: 'Player',
        state: originalState,
        timestamp: Date.now()
      };

      compression.recordState(state);

      // Mutate original
      originalState.x = 999;
      (originalState.nested as any).z = 999;

      // Recorded should be unchanged
      const recorded = compression.getLastState(1);
      expect(recorded?.state).toEqual({ x: 10, y: 20, nested: { z: 30 } });
    });

    it('should maintain history up to historySize', () => {
      const historySize = 10;
      const compression2 = new DeltaCompression(historySize);

      // Record more states than history size
      for (let i = 0; i < 20; i++) {
        compression2.recordState({
          id: 1,
          type: 'Player',
          state: { tick: i },
          timestamp: i
        });
      }

      const stats = compression2.getMemoryStats();
      expect(stats.totalStates).toBe(historySize);
    });

    it('should handle null and undefined values', () => {
      const state: EntityState = {
        id: 1,
        type: 'Player',
        state: {
          nullValue: null,
          undefinedValue: undefined,
          number: 0,
          string: '',
          boolean: false
        },
        timestamp: Date.now()
      };

      compression.recordState(state);
      const recorded = compression.getLastState(1);

      expect(recorded?.state).toEqual({
        nullValue: null,
        undefinedValue: undefined,
        number: 0,
        string: '',
        boolean: false
      });
    });

    it('should handle arrays correctly', () => {
      const state: EntityState = {
        id: 1,
        type: 'Player',
        state: {
          array: [1, 2, 3],
          nestedArray: [[1, 2], [3, 4]]
        },
        timestamp: Date.now()
      };

      compression.recordState(state);
      const recorded = compression.getLastState(1);

      expect(recorded?.state).toEqual({
        array: [1, 2, 3],
        nestedArray: [[1, 2], [3, 4]]
      });
    });
  });

  describe('computeDelta', () => {
    it('should return null when no history exists', () => {
      const state: EntityState = {
        id: 1,
        type: 'Player',
        state: { x: 10 },
        timestamp: Date.now()
      };

      const delta = compression.computeDelta(state);
      expect(delta).toBeNull();
    });

    it('should return null when no changes detected', () => {
      const state: EntityState = {
        id: 1,
        type: 'Player',
        state: { x: 10, y: 20 },
        timestamp: Date.now()
      };

      compression.recordState(state);
      const delta = compression.computeDelta(state);

      expect(delta).toBeNull();
    });

    it('should detect changed primitive values', () => {
      const baseState: EntityState = {
        id: 1,
        type: 'Player',
        state: { x: 10, y: 20, name: 'Alice' },
        timestamp: 1000
      };

      compression.recordState(baseState);

      const newState: EntityState = {
        id: 1,
        type: 'Player',
        state: { x: 15, y: 20, name: 'Bob' },
        timestamp: 2000
      };

      const delta = compression.computeDelta(newState);

      expect(delta).not.toBeNull();
      expect(delta?.changes).toEqual({ x: 15, name: 'Bob' });
      expect(delta?.baseTimestamp).toBe(1000);
      expect(delta?.timestamp).toBe(2000);
    });

    it('should detect nested object changes', () => {
      const baseState: EntityState = {
        id: 1,
        type: 'Player',
        state: {
          position: { x: 10, y: 20, z: 30 },
          health: 100
        },
        timestamp: 1000
      };

      compression.recordState(baseState);

      const newState: EntityState = {
        id: 1,
        type: 'Player',
        state: {
          position: { x: 15, y: 20, z: 30 },
          health: 100
        },
        timestamp: 2000
      };

      const delta = compression.computeDelta(newState);

      expect(delta).not.toBeNull();
      expect(delta?.changes).toEqual({ 'position.x': 15 });
    });

    it('should detect new fields', () => {
      const baseState: EntityState = {
        id: 1,
        type: 'Player',
        state: { x: 10 },
        timestamp: 1000
      };

      compression.recordState(baseState);

      const newState: EntityState = {
        id: 1,
        type: 'Player',
        state: { x: 10, y: 20 },
        timestamp: 2000
      };

      const delta = compression.computeDelta(newState);

      expect(delta).not.toBeNull();
      expect(delta?.changes).toEqual({ y: 20 });
    });

    it('should detect deleted fields', () => {
      const baseState: EntityState = {
        id: 1,
        type: 'Player',
        state: { x: 10, y: 20 },
        timestamp: 1000
      };

      compression.recordState(baseState);

      const newState: EntityState = {
        id: 1,
        type: 'Player',
        state: { x: 10 },
        timestamp: 2000
      };

      const delta = compression.computeDelta(newState);

      expect(delta).not.toBeNull();
      expect(delta?.changes).toEqual({ y: null });
    });

    it('should handle array changes', () => {
      const baseState: EntityState = {
        id: 1,
        type: 'Player',
        state: { items: [1, 2, 3] },
        timestamp: 1000
      };

      compression.recordState(baseState);

      const newState: EntityState = {
        id: 1,
        type: 'Player',
        state: { items: [1, 2, 3, 4] },
        timestamp: 2000
      };

      const delta = compression.computeDelta(newState);

      expect(delta).not.toBeNull();
      expect(delta?.changes).toEqual({ items: [1, 2, 3, 4] });
    });
  });

  describe('applyDelta', () => {
    it('should apply simple field changes', () => {
      const state: EntityState = {
        id: 1,
        type: 'Player',
        state: { x: 10, y: 20 },
        timestamp: 1000
      };

      compression.applyDelta(
        {
          id: 1,
          changes: { x: 15 },
          timestamp: 2000,
          baseTimestamp: 1000
        },
        state
      );

      expect(state.state).toEqual({ x: 15, y: 20 });
      expect(state.timestamp).toBe(2000);
    });

    it('should apply nested field changes', () => {
      const state: EntityState = {
        id: 1,
        type: 'Player',
        state: {
          position: { x: 10, y: 20, z: 30 }
        },
        timestamp: 1000
      };

      compression.applyDelta(
        {
          id: 1,
          changes: { 'position.x': 15, 'position.z': 35 },
          timestamp: 2000,
          baseTimestamp: 1000
        },
        state
      );

      expect(state.state).toEqual({
        position: { x: 15, y: 20, z: 35 }
      });
    });

    it('should add new fields', () => {
      const state: EntityState = {
        id: 1,
        type: 'Player',
        state: { x: 10 },
        timestamp: 1000
      };

      compression.applyDelta(
        {
          id: 1,
          changes: { y: 20 },
          timestamp: 2000,
          baseTimestamp: 1000
        },
        state
      );

      expect(state.state).toEqual({ x: 10, y: 20 });
    });

    it('should delete fields with null value', () => {
      const state: EntityState = {
        id: 1,
        type: 'Player',
        state: { x: 10, y: 20 },
        timestamp: 1000
      };

      compression.applyDelta(
        {
          id: 1,
          changes: { y: null },
          timestamp: 2000,
          baseTimestamp: 1000
        },
        state
      );

      expect(state.state).toEqual({ x: 10 });
    });

    it('should create missing nested objects', () => {
      const state: EntityState = {
        id: 1,
        type: 'Player',
        state: {},
        timestamp: 1000
      };

      compression.applyDelta(
        {
          id: 1,
          changes: { 'position.x': 10, 'position.y': 20 },
          timestamp: 2000,
          baseTimestamp: 1000
        },
        state
      );

      expect(state.state).toEqual({
        position: { x: 10, y: 20 }
      });
    });
  });

  describe('getStateAtTime', () => {
    it('should return undefined for unknown entity', () => {
      const state = compression.getStateAtTime(999, Date.now());
      expect(state).toBeUndefined();
    });

    it('should return closest state before timestamp', () => {
      compression.recordState({
        id: 1,
        type: 'Player',
        state: { tick: 1 },
        timestamp: 1000
      });

      compression.recordState({
        id: 1,
        type: 'Player',
        state: { tick: 2 },
        timestamp: 2000
      });

      compression.recordState({
        id: 1,
        type: 'Player',
        state: { tick: 3 },
        timestamp: 3000
      });

      const state = compression.getStateAtTime(1, 2500);
      expect(state?.state).toEqual({ tick: 2 });
    });

    it('should return first state if timestamp is before all states', () => {
      compression.recordState({
        id: 1,
        type: 'Player',
        state: { tick: 1 },
        timestamp: 1000
      });

      const state = compression.getStateAtTime(1, 500);
      expect(state).toBeUndefined();
    });
  });

  describe('clearHistory', () => {
    it('should clear history for specific entity', () => {
      compression.recordState({
        id: 1,
        type: 'Player',
        state: { x: 10 },
        timestamp: 1000
      });

      compression.recordState({
        id: 2,
        type: 'Enemy',
        state: { x: 20 },
        timestamp: 1000
      });

      compression.clearHistory(1);

      expect(compression.getLastState(1)).toBeUndefined();
      expect(compression.getLastState(2)).toBeDefined();
    });
  });

  describe('clearAllHistory', () => {
    it('should clear all history', () => {
      compression.recordState({
        id: 1,
        type: 'Player',
        state: { x: 10 },
        timestamp: 1000
      });

      compression.recordState({
        id: 2,
        type: 'Enemy',
        state: { x: 20 },
        timestamp: 1000
      });

      compression.clearAllHistory();

      const stats = compression.getMemoryStats();
      expect(stats.entities).toBe(0);
      expect(stats.totalStates).toBe(0);
    });
  });

  describe('getMemoryStats', () => {
    it('should return correct statistics', () => {
      compression.recordState({
        id: 1,
        type: 'Player',
        state: { x: 10 },
        timestamp: 1000
      });

      compression.recordState({
        id: 1,
        type: 'Player',
        state: { x: 20 },
        timestamp: 2000
      });

      compression.recordState({
        id: 2,
        type: 'Enemy',
        state: { x: 30 },
        timestamp: 1000
      });

      const stats = compression.getMemoryStats();
      expect(stats.entities).toBe(2);
      expect(stats.totalStates).toBe(3);
      expect(stats.avgStatesPerEntity).toBe(1.5);
    });
  });

  describe('round-trip consistency', () => {
    it('should produce identical state after delta round-trip', () => {
      const baseState: EntityState = {
        id: 1,
        type: 'Player',
        state: {
          position: { x: 10, y: 20, z: 30 },
          velocity: { x: 1, y: 0, z: 0 },
          health: 100,
          name: 'Alice',
          items: [1, 2, 3]
        },
        timestamp: 1000
      };

      compression.recordState(baseState);

      const newState: EntityState = {
        id: 1,
        type: 'Player',
        state: {
          position: { x: 15, y: 22, z: 30 },
          velocity: { x: 1, y: 0.5, z: 0 },
          health: 95,
          name: 'Alice',
          items: [1, 2, 3, 4]
        },
        timestamp: 2000
      };

      const delta = compression.computeDelta(newState);
      expect(delta).not.toBeNull();

      const reconstructed = JSON.parse(JSON.stringify(baseState));
      compression.applyDelta(delta!, reconstructed);

      expect(reconstructed.state).toEqual(newState.state);
    });
  });
});
