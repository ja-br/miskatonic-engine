/**
 * Delta Compression
 *
 * Calculates and applies delta updates for efficient state synchronization
 */

import type { EntityState, DeltaUpdate, StateValue, NetworkTimestamp } from './types';

/**
 * Delta compression engine
 *
 * Computes minimal delta updates by comparing current state with previous snapshots.
 * Uses path-based diffing to detect changed fields efficiently.
 *
 * @example
 * ```typescript
 * const compression = new DeltaCompression();
 *
 * // Store baseline state
 * compression.recordState(entity1);
 *
 * // Later, compute delta
 * entity1.state.position.x += 10;
 * const delta = compression.computeDelta(entity1);
 * // delta.changes = { 'position.x': 15 }
 *
 * // Apply delta on receiver
 * compression.applyDelta(delta, entity1);
 * ```
 */
export class DeltaCompression {
  /** History of entity states keyed by entity ID */
  private stateHistory = new Map<number, EntityState[]>();

  /** Maximum number of historical states to keep */
  private readonly historySize: number;

  constructor(historySize: number = 64) {
    this.historySize = historySize;
  }

  /**
   * Record a state snapshot for future delta calculation
   * @param state Entity state to record
   */
  recordState(state: EntityState): void {
    const history = this.stateHistory.get(state.id);
    if (!history) {
      this.stateHistory.set(state.id, []);
    }

    const historyArray = this.stateHistory.get(state.id)!;

    // Deep clone the state using structured cloning
    const snapshot: EntityState = {
      id: state.id,
      type: state.type,
      state: this.deepClone(state.state) as Record<string, StateValue>,
      timestamp: state.timestamp,
      priority: state.priority
    };

    historyArray.push(snapshot);

    // Trim history to max size
    if (historyArray.length > this.historySize) {
      historyArray.shift();
    }
  }

  /**
   * Deep clone a state object safely without circular reference issues
   * Uses manual recursive cloning for StateValue types
   */
  private deepClone(value: StateValue): StateValue {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value !== 'object') {
      // Primitives: boolean, number, string
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(item => this.deepClone(item));
    }

    // Plain object
    const cloned: Record<string, StateValue> = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        cloned[key] = this.deepClone(value[key]);
      }
    }
    return cloned;
  }

  /**
   * Compute delta update relative to most recent historical state
   * @param currentState Current entity state
   * @returns Delta update containing only changed fields, or null if no changes
   */
  computeDelta(currentState: EntityState): DeltaUpdate | null {
    const history = this.stateHistory.get(currentState.id);

    if (!history || history.length === 0) {
      // No history, can't compute delta
      return null;
    }

    const baseState = history[history.length - 1];
    const changes = this.computeChanges(baseState.state, currentState.state);

    if (Object.keys(changes).length === 0) {
      // No changes detected
      return null;
    }

    return {
      id: currentState.id,
      changes,
      timestamp: currentState.timestamp,
      baseTimestamp: baseState.timestamp
    };
  }

  /**
   * Recursively compute changed fields between two state objects
   * @param oldState Previous state
   * @param newState Current state
   * @param path Current field path (for nested objects)
   * @returns Map of changed field paths to new values
   */
  private computeChanges(
    oldState: Record<string, StateValue>,
    newState: Record<string, StateValue>,
    path: string = ''
  ): Record<string, StateValue> {
    const changes: Record<string, StateValue> = {};

    // Check for new or changed fields
    for (const key of Object.keys(newState)) {
      const fieldPath = path ? `${path}.${key}` : key;
      const oldValue = oldState[key];
      const newValue = newState[key];

      if (!this.valuesEqual(oldValue, newValue)) {
        // Value changed or is new
        if (this.isPlainObject(newValue) && this.isPlainObject(oldValue)) {
          // Recursively diff nested objects
          const nestedChanges = this.computeChanges(
            oldValue as Record<string, StateValue>,
            newValue as Record<string, StateValue>,
            fieldPath
          );
          Object.assign(changes, nestedChanges);
        } else {
          // Leaf value changed
          changes[fieldPath] = newValue;
        }
      }
    }

    // Check for deleted fields
    for (const key of Object.keys(oldState)) {
      if (!(key in newState)) {
        const fieldPath = path ? `${path}.${key}` : key;
        changes[fieldPath] = null;
      }
    }

    return changes;
  }

  /**
   * Apply delta update to an entity state
   * @param delta Delta update to apply
   * @param state Entity state to modify
   */
  applyDelta(delta: DeltaUpdate, state: EntityState): void {
    for (const [path, value] of Object.entries(delta.changes)) {
      this.setValueAtPath(state.state, path, value);
    }

    // Update timestamp
    state.timestamp = delta.timestamp;
  }

  /**
   * Set a value at a nested path in an object
   * @param obj Object to modify
   * @param path Dot-separated path (e.g., 'position.x')
   * @param value Value to set
   */
  private setValueAtPath(obj: Record<string, StateValue>, path: string, value: StateValue): void {
    const parts = path.split('.');
    let current: Record<string, StateValue> = obj;

    // Navigate to parent of target field
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || !this.isPlainObject(current[part])) {
        current[part] = {};
      }
      current = current[part] as Record<string, StateValue>;
    }

    const finalKey = parts[parts.length - 1];

    if (value === null) {
      // Delete field
      delete current[finalKey];
    } else {
      // Set field
      current[finalKey] = value;
    }
  }

  /**
   * Check if two values are equal (deep comparison for objects/arrays)
   */
  private valuesEqual(a: StateValue, b: StateValue): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a === undefined || b === undefined) return false;

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.valuesEqual(a[i], b[i])) return false;
      }
      return true;
    }

    // Handle objects
    if (this.isPlainObject(a) && this.isPlainObject(b)) {
      const aObj = a as Record<string, StateValue>;
      const bObj = b as Record<string, StateValue>;

      const aKeys = Object.keys(aObj);
      const bKeys = Object.keys(bObj);

      if (aKeys.length !== bKeys.length) return false;

      for (const key of aKeys) {
        if (!this.valuesEqual(aObj[key], bObj[key])) return false;
      }

      return true;
    }

    return false;
  }

  /**
   * Check if a value is a plain object (not null, array, or primitive)
   */
  private isPlainObject(value: StateValue): boolean {
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }

  /**
   * Get most recent state for an entity
   * @param entityId Entity ID
   * @returns Most recent state, or undefined if not found
   */
  getLastState(entityId: number): EntityState | undefined {
    const history = this.stateHistory.get(entityId);
    if (!history || history.length === 0) return undefined;
    return history[history.length - 1];
  }

  /**
   * Get state at a specific timestamp
   * @param entityId Entity ID
   * @param timestamp Target timestamp
   * @returns Closest state before or at timestamp, or undefined
   */
  getStateAtTime(entityId: number, timestamp: NetworkTimestamp): EntityState | undefined {
    const history = this.stateHistory.get(entityId);
    if (!history || history.length === 0) return undefined;

    // Binary search for closest timestamp
    let left = 0;
    let right = history.length - 1;
    let best: EntityState | undefined;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const state = history[mid];

      if (state.timestamp <= timestamp) {
        best = state;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return best;
  }

  /**
   * Clear all history for an entity
   * @param entityId Entity ID
   */
  clearHistory(entityId: number): void {
    this.stateHistory.delete(entityId);
  }

  /**
   * Clear all history
   */
  clearAllHistory(): void {
    this.stateHistory.clear();
  }

  /**
   * Get memory usage statistics
   * @returns Object with memory stats
   */
  getMemoryStats(): { entities: number; totalStates: number; avgStatesPerEntity: number } {
    const entities = this.stateHistory.size;
    let totalStates = 0;

    for (const history of this.stateHistory.values()) {
      totalStates += history.length;
    }

    return {
      entities,
      totalStates,
      avgStatesPerEntity: entities > 0 ? totalStates / entities : 0
    };
  }
}
