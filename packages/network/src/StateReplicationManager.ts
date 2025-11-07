/**
 * State Replication Manager
 *
 * Manages automatic synchronization of entity state across the network
 */

import { DeltaCompression } from './DeltaCompression';
import { DEFAULT_REPLICATION_CONFIG } from './types';
import type {
  EntityState,
  DeltaUpdate,
  StateBatch,
  ReplicationConfig,
  NetworkId,
  NetworkTimestamp,
  InterestPolicy,
  UpdatePriority
} from './types';

/**
 * Replicable entity interface
 * Entities must implement this to be synchronized over the network
 */
export interface IReplicable {
  /** Unique network identifier */
  getNetworkId(): NetworkId;
  /** Entity type for deserialization */
  getEntityType(): string;
  /** Serialize entity state */
  serializeState(): Record<string, any>;
  /** Deserialize and apply state */
  deserializeState(state: Record<string, any>): void;
  /** Get update priority (optional) */
  getUpdatePriority?(): UpdatePriority;
}

/**
 * State replication manager
 *
 * Handles automatic synchronization of entities using delta compression,
 * interest management, and bandwidth optimization.
 *
 * @example
 * ```typescript
 * const manager = new StateReplicationManager({
 *   tickRate: 60,
 *   useDeltaCompression: true
 * });
 *
 * // Register entities for replication
 * manager.registerEntity(player);
 * manager.registerEntity(enemy);
 *
 * // In game loop
 * const batch = manager.createStateBatch();
 * network.send(batch);
 *
 * // On receiver
 * manager.applyStateBatch(receivedBatch);
 * ```
 */
export class StateReplicationManager {
  private config: ReplicationConfig;
  private deltaCompression: DeltaCompression;
  private entities = new Map<NetworkId, IReplicable>();
  private interestPolicy?: InterestPolicy;

  /** Current server tick */
  private tick: number = 0;

  /** Last update time for each entity */
  private lastUpdateTime = new Map<NetworkId, NetworkTimestamp>();

  /** Update priority for each entity */
  private updatePriorities = new Map<NetworkId, UpdatePriority>();

  /** Entities that need full state sync (new or important) */
  private fullStateQueue = new Set<NetworkId>();

  constructor(config: Partial<ReplicationConfig> = {}) {
    this.config = { ...DEFAULT_REPLICATION_CONFIG, ...config };
    this.deltaCompression = new DeltaCompression(this.config.historySize);
  }

  /**
   * Register an entity for state replication
   * @param entity Entity to replicate
   */
  registerEntity(entity: IReplicable): void {
    const id = entity.getNetworkId();

    if (this.entities.has(id)) {
      console.warn(`Entity ${id} is already registered for replication`);
      return;
    }

    this.entities.set(id, entity);

    // Queue for full state sync on first update
    this.fullStateQueue.add(id);

    // Record initial priority
    if (entity.getUpdatePriority) {
      this.updatePriorities.set(id, entity.getUpdatePriority());
    }
  }

  /**
   * Unregister an entity from replication
   * @param entityId Entity network ID
   */
  unregisterEntity(entityId: NetworkId): void {
    this.entities.delete(entityId);
    this.lastUpdateTime.delete(entityId);
    this.updatePriorities.delete(entityId);
    this.fullStateQueue.delete(entityId);
    this.deltaCompression.clearHistory(entityId);
  }

  /**
   * Set interest management policy
   * @param policy Interest policy implementation
   */
  setInterestPolicy(policy: InterestPolicy): void {
    this.interestPolicy = policy;
  }

  /**
   * Create a state batch for network transmission
   * @param observerId Optional observer ID for interest management
   * @returns State batch ready to send
   */
  createStateBatch(observerId?: NetworkId): StateBatch {
    this.tick++;
    const now = Date.now();

    const fullStates: EntityState[] = [];
    const deltaUpdates: DeltaUpdate[] = [];

    // Determine which entities to include
    const entitiesToSync = this.selectEntitiesForSync(observerId);

    for (const entityId of entitiesToSync) {
      const entity = this.entities.get(entityId);
      if (!entity) continue;

      try {
        // Create current state snapshot
        const state: EntityState = {
          id: entityId,
          type: entity.getEntityType(),
          state: entity.serializeState(),
          timestamp: now,
          priority: entity.getUpdatePriority?.()
        };

        // Decide whether to send full state or delta
        if (this.shouldSendFullState(entityId)) {
          fullStates.push(state);
          this.fullStateQueue.delete(entityId);

          // Record state for future deltas
          this.deltaCompression.recordState(state);
        } else if (this.config.useDeltaCompression) {
          // Try to compute delta
          const delta = this.deltaCompression.computeDelta(state);

          if (delta) {
            // Delta computed successfully
            deltaUpdates.push(delta);
          } else {
            // No changes, don't send anything
            // (could also send full state if needed)
          }

          // Record state for future deltas
          this.deltaCompression.recordState(state);
        } else {
          // Delta compression disabled, always send full state
          fullStates.push(state);
        }

        // Update last sync time
        this.lastUpdateTime.set(entityId, now);
      } catch (error) {
        console.error(`Failed to serialize entity ${entityId}:`, error);
        // Skip this entity and continue
        continue;
      }
    }

    return {
      tick: this.tick,
      timestamp: now,
      fullStates,
      deltas: deltaUpdates,
      destroyed: []
    };
  }

  /**
   * Apply received state batch
   * @param batch State batch from network
   */
  applyStateBatch(batch: StateBatch): void {
    // Input validation
    if (!batch || typeof batch !== 'object') {
      console.error('Invalid state batch: batch is not an object');
      return;
    }

    if (!Array.isArray(batch.fullStates) || !Array.isArray(batch.deltas) || !Array.isArray(batch.destroyed)) {
      console.error('Invalid state batch: missing or malformed arrays');
      return;
    }

    // Apply full states
    for (const state of batch.fullStates) {
      try {
        // Validate state structure
        if (!state || typeof state.id !== 'number' || !state.state || typeof state.state !== 'object') {
          console.warn('Invalid full state structure, skipping');
          continue;
        }

        const entity = this.entities.get(state.id);
        if (!entity) {
          console.warn(`Received state for unknown entity ${state.id}`);
          continue;
        }

        entity.deserializeState(state.state);

        // Record state for interpolation/prediction
        this.deltaCompression.recordState(state);
      } catch (error) {
        console.error(`Failed to apply full state for entity ${state.id}:`, error);
        continue;
      }
    }

    // Apply deltas
    for (const delta of batch.deltas) {
      try {
        // Validate delta structure
        if (!delta || typeof delta.id !== 'number' || !delta.changes || typeof delta.changes !== 'object') {
          console.warn('Invalid delta structure, skipping');
          continue;
        }

        const entity = this.entities.get(delta.id);
        if (!entity) {
          console.warn(`Received delta for unknown entity ${delta.id}`);
          continue;
        }

        // Get last known state
        const lastState = this.deltaCompression.getLastState(delta.id);
        if (!lastState) {
          console.warn(`No baseline state for delta on entity ${delta.id}`);
          continue;
        }

        // Apply delta to state
        this.deltaCompression.applyDelta(delta, lastState);

        // Apply to entity
        entity.deserializeState(lastState.state);

        // Record updated state
        this.deltaCompression.recordState(lastState);
      } catch (error) {
        console.error(`Failed to apply delta for entity ${delta.id}:`, error);
        continue;
      }
    }

    // Handle destroyed entities
    for (const entityId of batch.destroyed) {
      try {
        if (typeof entityId !== 'number') {
          console.warn('Invalid entity ID in destroyed list, skipping');
          continue;
        }
        this.unregisterEntity(entityId);
      } catch (error) {
        console.error(`Failed to unregister entity ${entityId}:`, error);
        continue;
      }
    }
  }

  /**
   * Select entities that should be synchronized this tick
   * @param observerId Optional observer for interest management
   * @returns Set of entity IDs to synchronize
   */
  private selectEntitiesForSync(observerId?: NetworkId): Set<NetworkId> {
    if (!this.config.useInterestManagement || !this.interestPolicy || !observerId) {
      // No interest management, sync all entities
      return new Set(this.entities.keys());
    }

    // Use interest policy to filter entities
    return this.interestPolicy.getInterests(observerId);
  }

  /**
   * Determine if an entity should send full state instead of delta
   * @param entityId Entity network ID
   * @returns True if full state should be sent
   */
  private shouldSendFullState(entityId: NetworkId): boolean {
    // New entities need full state
    if (this.fullStateQueue.has(entityId)) {
      return true;
    }

    // High priority entities get full state periodically
    const priority = this.updatePriorities.get(entityId);
    if (priority !== undefined && priority >= 4) {
      // Critical priority always sends full state
      return true;
    }

    // Periodically send full state to prevent drift
    const lastUpdate = this.lastUpdateTime.get(entityId);
    if (!lastUpdate) {
      return true;
    }

    const timeSinceUpdate = Date.now() - lastUpdate;
    const fullStateInterval = 5000; // 5 seconds

    return timeSinceUpdate >= fullStateInterval;
  }

  /**
   * Mark an entity for full state sync on next update
   * @param entityId Entity network ID
   */
  requestFullState(entityId: NetworkId): void {
    this.fullStateQueue.add(entityId);
  }

  /**
   * Get current tick number
   */
  getCurrentTick(): number {
    return this.tick;
  }

  /**
   * Get replication configuration
   */
  getConfig(): Readonly<ReplicationConfig> {
    return { ...this.config };
  }

  /**
   * Update replication configuration
   * @param config Partial configuration to update
   */
  updateConfig(config: Partial<ReplicationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get number of registered entities
   */
  getEntityCount(): number {
    return this.entities.size;
  }

  /**
   * Check if an entity is registered
   * @param entityId Entity network ID
   */
  hasEntity(entityId: NetworkId): boolean {
    return this.entities.has(entityId);
  }

  /**
   * Get entity by ID
   * @param entityId Entity network ID
   */
  getEntity(entityId: NetworkId): IReplicable | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Clear all entities and history
   */
  clear(): void {
    this.entities.clear();
    this.lastUpdateTime.clear();
    this.updatePriorities.clear();
    this.fullStateQueue.clear();
    this.deltaCompression.clearAllHistory();
  }
}
