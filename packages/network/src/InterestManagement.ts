/**
 * Interest Management
 *
 * Determines which entities should be replicated to which clients based on relevance
 */

import { InterestLevel } from './types';
import type { NetworkId, InterestPolicy } from './types';

/**
 * Position-based interest policy
 *
 * Calculates interest based on distance between observer and entity.
 * Closer entities have higher interest levels.
 *
 * @example
 * ```typescript
 * const policy = new SpatialInterestPolicy({
 *   interestRadius: 100,
 *   criticalRadius: 10
 * });
 *
 * // Register entity positions
 * policy.updatePosition(playerId, { x: 0, y: 0, z: 0 });
 * policy.updatePosition(enemyId, { x: 50, y: 0, z: 0 });
 *
 * // Calculate interest level
 * const interest = policy.calculateInterest(playerId, enemyId);
 * // Returns InterestLevel.MEDIUM (within 100 units)
 * ```
 */
export class SpatialInterestPolicy implements InterestPolicy {
  /** Entity positions */
  private positions = new Map<NetworkId, { x: number; y: number; z: number }>();

  /** Distance threshold for interest */
  private interestRadius: number;

  /** Distance threshold for critical interest */
  private criticalRadius: number;

  /** Distance threshold for high interest */
  private highRadius: number;

  /** Distance threshold for medium interest */
  private mediumRadius: number;

  constructor(config: {
    interestRadius?: number;
    criticalRadius?: number;
    highRadius?: number;
    mediumRadius?: number;
  } = {}) {
    this.interestRadius = config.interestRadius ?? 100;
    this.criticalRadius = config.criticalRadius ?? 10;
    this.highRadius = config.highRadius ?? 30;
    this.mediumRadius = config.mediumRadius ?? 60;
  }

  /**
   * Update entity position for interest calculation
   * @param entityId Entity network ID
   * @param position World position
   */
  updatePosition(entityId: NetworkId, position: { x: number; y: number; z: number }): void {
    this.positions.set(entityId, { ...position });
  }

  /**
   * Remove entity from interest management
   * @param entityId Entity network ID
   */
  removeEntity(entityId: NetworkId): void {
    this.positions.delete(entityId);
  }

  /**
   * Calculate interest level between observer and entity
   * @param observerId Observer entity ID
   * @param entityId Target entity ID
   * @returns Interest level
   */
  calculateInterest(observerId: NetworkId, entityId: NetworkId): InterestLevel {
    // Always interested in self
    if (observerId === entityId) {
      return InterestLevel.CRITICAL;
    }

    const observerPos = this.positions.get(observerId);
    const entityPos = this.positions.get(entityId);

    if (!observerPos || !entityPos) {
      return InterestLevel.NONE;
    }

    const distance = this.calculateDistance(observerPos, entityPos);

    if (distance <= this.criticalRadius) {
      return InterestLevel.CRITICAL;
    } else if (distance <= this.highRadius) {
      return InterestLevel.HIGH;
    } else if (distance <= this.mediumRadius) {
      return InterestLevel.MEDIUM;
    } else if (distance <= this.interestRadius) {
      return InterestLevel.LOW;
    } else {
      return InterestLevel.NONE;
    }
  }

  /**
   * Get all entities of interest to an observer
   * @param observerId Observer entity ID
   * @returns Set of entity IDs
   */
  getInterests(observerId: NetworkId): Set<NetworkId> {
    const interests = new Set<NetworkId>();

    for (const entityId of this.positions.keys()) {
      const interest = this.calculateInterest(observerId, entityId);
      if (interest > InterestLevel.NONE) {
        interests.add(entityId);
      }
    }

    return interests;
  }

  /**
   * Calculate 3D distance between two positions
   */
  private calculateDistance(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number }
  ): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Get number of tracked entities
   */
  getEntityCount(): number {
    return this.positions.size;
  }

  /**
   * Clear all tracked positions
   */
  clear(): void {
    this.positions.clear();
  }
}

/**
 * Always-interested policy
 *
 * Simple policy that marks all entities as always interested.
 * Useful for debugging or small-scale games.
 */
export class AlwaysInterestedPolicy implements InterestPolicy {
  private entities = new Set<NetworkId>();

  /**
   * Register an entity
   */
  addEntity(entityId: NetworkId): void {
    this.entities.add(entityId);
  }

  /**
   * Unregister an entity
   */
  removeEntity(entityId: NetworkId): void {
    this.entities.delete(entityId);
  }

  calculateInterest(_observerId: NetworkId, _entityId: NetworkId): InterestLevel {
    return _observerId === _entityId ? InterestLevel.CRITICAL : InterestLevel.HIGH;
  }

  getInterests(_observerId: NetworkId): Set<NetworkId> {
    return new Set(this.entities);
  }

  clear(): void {
    this.entities.clear();
  }
}

/**
 * Grid-based interest policy
 *
 * Divides world into grid cells and only replicates entities in same or adjacent cells.
 * More efficient than distance-based for large worlds.
 *
 * @example
 * ```typescript
 * const policy = new GridInterestPolicy({
 *   cellSize: 50,
 *   cellRadius: 2 // Include cells within 2-cell radius
 * });
 * ```
 */
export class GridInterestPolicy implements InterestPolicy {
  private entityCells = new Map<NetworkId, { x: number; y: number; z: number }>();
  private cellSize: number;
  private cellRadius: number;

  constructor(config: { cellSize?: number; cellRadius?: number } = {}) {
    this.cellSize = config.cellSize ?? 50;
    this.cellRadius = config.cellRadius ?? 2;
  }

  /**
   * Update entity position
   */
  updatePosition(entityId: NetworkId, position: { x: number; y: number; z: number }): void {
    const cell = this.worldToCell(position);
    this.entityCells.set(entityId, cell);
  }

  /**
   * Remove entity
   */
  removeEntity(entityId: NetworkId): void {
    this.entityCells.delete(entityId);
  }

  calculateInterest(observerId: NetworkId, entityId: NetworkId): InterestLevel {
    if (observerId === entityId) {
      return InterestLevel.CRITICAL;
    }

    const observerCell = this.entityCells.get(observerId);
    const entityCell = this.entityCells.get(entityId);

    if (!observerCell || !entityCell) {
      return InterestLevel.NONE;
    }

    const cellDistance = this.calculateCellDistance(observerCell, entityCell);

    if (cellDistance === 0) {
      return InterestLevel.HIGH;
    } else if (cellDistance <= 1) {
      return InterestLevel.MEDIUM;
    } else if (cellDistance <= this.cellRadius) {
      return InterestLevel.LOW;
    } else {
      return InterestLevel.NONE;
    }
  }

  getInterests(observerId: NetworkId): Set<NetworkId> {
    const interests = new Set<NetworkId>();

    for (const entityId of this.entityCells.keys()) {
      const interest = this.calculateInterest(observerId, entityId);
      if (interest > InterestLevel.NONE) {
        interests.add(entityId);
      }
    }

    return interests;
  }

  /**
   * Convert world position to grid cell coordinates
   */
  private worldToCell(pos: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    return {
      x: Math.floor(pos.x / this.cellSize),
      y: Math.floor(pos.y / this.cellSize),
      z: Math.floor(pos.z / this.cellSize)
    };
  }

  /**
   * Calculate Manhattan distance between cells
   */
  private calculateCellDistance(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number }
  ): number {
    return Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + Math.abs(b.z - a.z);
  }

  clear(): void {
    this.entityCells.clear();
  }
}
