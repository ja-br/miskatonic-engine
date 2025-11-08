/**
 * TransformSystem - Epic 3.11.5
 *
 * Converts ECS Transform components into 4×4 matrices for GPU rendering.
 *
 * Features:
 * - Model matrix generation from Transform (T × R × S)
 * - Hierarchical transform support (linked list parent/child)
 * - World matrix calculation (parent.world × local)
 * - Dirty flag optimization (only recalculate when changed)
 * - Matrix caching in MatrixStorage (zero allocations)
 * - Helper methods for modifying transforms (setPosition, setRotation, etc.)
 *
 * Performance Targets:
 * - <0.5ms for 1000 transforms
 * - Only update dirty transforms (lazy evaluation)
 * - Zero allocations in hot paths
 * - Cache-friendly iteration
 *
 * Architecture:
 * - Transform component is PURE DATA (no methods)
 * - ALL transform logic lives in TransformSystem
 * - Matrices stored in MatrixStorage (contiguous typed arrays)
 * - Hierarchy via linked list (parentId, firstChildId, nextSiblingId)
 */

import type { System } from '../types';
import type { World } from '../World';
import type { EntityId } from '../types';
import { Transform, type TransformData } from '../components/Transform';
import * as Mat4 from '../math/Mat4';
import { MatrixStorage } from '../math/MatrixStorage';

export class TransformSystem implements System {
  public readonly name: string = 'TransformSystem';
  public readonly priority: number = 0;

  private world: World;
  private matrixStorage: MatrixStorage;

  constructor(world: World, initialCapacity: number = 1024) {
    this.world = world;
    this.matrixStorage = new MatrixStorage(initialCapacity);
  }

  /**
   * Initialize the system (called once)
   * Allocates matrix indices for all existing transforms
   */
  init(): void {
    const query = this.world.query().with(Transform).build();
    const entities = this.world.executeQuery(query);

    for (const { entity: entityId, components } of entities) {
      const transform = components.get(Transform) as TransformData | undefined;
      if (!transform) continue;

      // Allocate matrix indices if not already allocated
      if (transform.localMatrixIndex === -1) {
        transform.localMatrixIndex = this.matrixStorage.allocate();
        transform.worldMatrixIndex = this.matrixStorage.allocate();
        transform.dirty = 1; // Mark dirty
      }
    }
  }

  /**
   * Cleanup the system (called on shutdown)
   * Frees all matrix indices
   */
  destroy(): void {
    const query = this.world.query().with(Transform).build();
    const entities = this.world.executeQuery(query);

    for (const { components } of entities) {
      const transform = components.get(Transform) as TransformData | undefined;
      if (!transform) continue;

      // Free matrix indices
      if (transform.localMatrixIndex !== -1) {
        this.matrixStorage.free(transform.localMatrixIndex);
        transform.localMatrixIndex = -1;
      }
      if (transform.worldMatrixIndex !== -1) {
        this.matrixStorage.free(transform.worldMatrixIndex);
        transform.worldMatrixIndex = -1;
      }
    }

    this.matrixStorage.clear();
  }

  /**
   * Update all dirty transforms
   *
   * Algorithm:
   * 1. Iterate all entities with Transform component
   * 2. For each dirty transform:
   *    a. Recalculate local matrix (T × R × S)
   *    b. Recalculate world matrix (parent.world × local)
   *    c. Mark clean
   *    d. Dirty children (their world matrix depends on parent)
   *
   * Performance: O(n) where n = number of dirty transforms
   * Zero allocations: uses composeTRSTo() and multiplyTo()
   */
  update(_deltaTime: number): void {
    const query = this.world.query().with(Transform).build();
    const entities = this.world.executeQuery(query);

    // Process all transforms
    for (const { entity: entityId, components } of entities) {
      const transform = components.get(Transform) as TransformData | undefined;
      if (!transform) continue;

      // Allocate matrix indices if needed (entity created after init)
      if (transform.localMatrixIndex === -1) {
        transform.localMatrixIndex = this.matrixStorage.allocate();
        transform.worldMatrixIndex = this.matrixStorage.allocate();
        transform.dirty = 1;
      }

      // Only process dirty transforms
      if (transform.dirty === 1) {
        this.updateTransform(entityId, transform);
      }
    }
  }

  /**
   * Update a single transform (recalculate matrices)
   * ZERO ALLOCATION: uses *To() variants
   *
   * Uses iterative parent chain update to prevent stack overflow with deep hierarchies.
   */
  private updateTransform(entityId: EntityId, transform: TransformData): void {
    // Build ancestor chain if parent is dirty (iterative to prevent stack overflow)
    const ancestorChain: EntityId[] = [];
    let currentId = entityId;
    let currentTransform = transform;
    const MAX_HIERARCHY_DEPTH = 100; // Prevent infinite loops
    let depth = 0;

    // Walk up parent chain, collecting dirty ancestors
    while (currentTransform.parentId !== -1 && depth < MAX_HIERARCHY_DEPTH) {
      const parentId = currentTransform.parentId;
      const parentTransform = this.world.getComponent(parentId, Transform) as TransformData | undefined;

      if (!parentTransform) {
        console.warn(`Transform parent ${parentId} not found for entity ${currentId}`);
        break;
      }

      if (parentTransform.dirty === 0) {
        // Parent is clean, stop walking up
        break;
      }

      // Parent is dirty, add to chain and keep walking
      ancestorChain.push(parentId);
      currentId = parentId;
      currentTransform = parentTransform;
      depth++;
    }

    if (depth >= MAX_HIERARCHY_DEPTH) {
      console.error(`Transform hierarchy depth exceeded ${MAX_HIERARCHY_DEPTH} for entity ${entityId}. Possible circular dependency.`);
    }

    // Update ancestors from root to leaf (reverse order)
    for (let i = ancestorChain.length - 1; i >= 0; i--) {
      const ancestorId = ancestorChain[i];
      const ancestorTransform = this.world.getComponent(ancestorId, Transform) as TransformData | undefined;
      if (ancestorTransform) {
        this.updateTransformSingle(ancestorId, ancestorTransform);
      }
    }

    // Finally update this transform
    this.updateTransformSingle(entityId, transform);
  }

  /**
   * Update a single transform without recursion
   * Assumes parent is already up to date
   */
  private updateTransformSingle(entityId: EntityId, transform: TransformData): void {
    // 1. Calculate local matrix (T × R × S) - ZERO ALLOCATION
    const localMatrix = this.matrixStorage.getLocalMatrix(transform.localMatrixIndex);
    Mat4.composeTRSTo(
      transform.x, transform.y, transform.z,
      transform.rotationX, transform.rotationY, transform.rotationZ,
      transform.scaleX, transform.scaleY, transform.scaleZ,
      localMatrix
    );

    // 2. Calculate world matrix (parent.world × local or just local if no parent)
    const worldMatrix = this.matrixStorage.getWorldMatrix(transform.worldMatrixIndex);

    if (transform.parentId === -1) {
      // No parent: world = local
      worldMatrix.set(localMatrix);
    } else {
      // Has parent: world = parent.world × local
      const parentTransform = this.world.getComponent(transform.parentId, Transform) as TransformData | undefined;
      if (!parentTransform) {
        console.warn(`Transform parent ${transform.parentId} not found for entity ${entityId}`);
        worldMatrix.set(localMatrix);
      } else {
        // Parent should already be clean from ancestor chain update
        const parentWorldMatrix = this.matrixStorage.getWorldMatrix(parentTransform.worldMatrixIndex);
        Mat4.multiplyTo(parentWorldMatrix, localMatrix, worldMatrix);
      }
    }

    // 3. Mark clean
    transform.dirty = 0;

    // 4. Dirty all children (their world matrices need recalculation)
    // Walk linked list of children
    let childId = transform.firstChildId;
    while (childId !== -1) {
      const childTransform = this.world.getComponent(childId, Transform) as TransformData | undefined;
      if (!childTransform) {
        console.warn(`Child ${childId} not found in linked list for entity ${entityId}`);
        break;
      }

      childTransform.dirty = 1;
      childId = childTransform.nextSiblingId; // Next sibling
    }
  }

  // =============================================================================
  // HELPER METHODS - Transform modification API
  // These methods replace the removed Transform class methods
  // =============================================================================

  /**
   * Set position and mark dirty
   *
   * @param entityId - Entity to modify
   * @param x - X position
   * @param y - Y position
   * @param z - Z position
   */
  setPosition(entityId: EntityId, x: number, y: number, z: number): void {
    const transform = this.world.getComponent(entityId, Transform) as TransformData | undefined;
    if (!transform) return;

    transform.x = x;
    transform.y = y;
    transform.z = z;
    transform.dirty = 1;
  }

  /**
   * Set rotation (Euler angles in radians) and mark dirty
   *
   * @param entityId - Entity to modify
   * @param x - Rotation around X axis (pitch)
   * @param y - Rotation around Y axis (yaw)
   * @param z - Rotation around Z axis (roll)
   */
  setRotation(entityId: EntityId, x: number, y: number, z: number): void {
    const transform = this.world.getComponent(entityId, Transform) as TransformData | undefined;
    if (!transform) return;

    transform.rotationX = x;
    transform.rotationY = y;
    transform.rotationZ = z;
    transform.dirty = 1;
  }

  /**
   * Set scale and mark dirty
   *
   * @param entityId - Entity to modify
   * @param x - X scale
   * @param y - Y scale
   * @param z - Z scale
   */
  setScale(entityId: EntityId, x: number, y: number, z: number): void {
    const transform = this.world.getComponent(entityId, Transform) as TransformData | undefined;
    if (!transform) return;

    transform.scaleX = x;
    transform.scaleY = y;
    transform.scaleZ = z;
    transform.dirty = 1;
  }

  /**
   * Mark transform as dirty (needs recalculation)
   *
   * @param entityId - Entity to mark dirty
   */
  markDirty(entityId: EntityId): void {
    const transform = this.world.getComponent(entityId, Transform) as TransformData | undefined;
    if (!transform) return;

    transform.dirty = 1;
  }

  /**
   * Check if transform is dirty
   *
   * @param entityId - Entity to check
   * @returns true if dirty, false if clean
   */
  isDirty(entityId: EntityId): boolean {
    const transform = this.world.getComponent(entityId, Transform) as TransformData | undefined;
    if (!transform) return false;

    return transform.dirty === 1;
  }

  /**
   * Set parent-child relationship with circular dependency detection
   *
   * @param childId - Child entity
   * @param parentId - Parent entity (undefined to clear parent)
   */
  setParent(childId: EntityId, parentId?: EntityId): void {
    const childTransform = this.world.getComponent(childId, Transform) as TransformData | undefined;
    if (!childTransform) return;

    // Circular dependency detection
    if (parentId !== undefined && this.wouldCreateCycle(childId, parentId)) {
      console.error(`Cannot set parent ${parentId} for entity ${childId}: would create circular dependency`);
      return;
    }

    // Remove from old parent's linked list
    if (childTransform.parentId !== -1) {
      this.removeFromParentList(childId, childTransform.parentId);
    }

    // Set new parent
    const newParentId = parentId !== undefined ? parentId : -1;
    childTransform.parentId = newParentId;
    childTransform.dirty = 1; // Mark dirty

    // Add to new parent's linked list
    if (newParentId !== -1) {
      this.addToParentList(childId, newParentId);
    }
  }

  /**
   * Get iterator for children of an entity
   *
   * @param entityId - Parent entity
   * @returns Array of child entity IDs
   */
  getChildren(entityId: EntityId): EntityId[] {
    const transform = this.world.getComponent(entityId, Transform) as TransformData | undefined;
    if (!transform) return [];

    const children: EntityId[] = [];
    let childId = transform.firstChildId;

    while (childId !== -1) {
      children.push(childId);

      const childTransform = this.world.getComponent(childId, Transform) as TransformData | undefined;
      if (!childTransform) break;

      childId = childTransform.nextSiblingId;
    }

    return children;
  }

  /**
   * Check if setting parent would create a circular dependency
   * Walks up parent chain to see if childId appears
   */
  private wouldCreateCycle(childId: EntityId, parentId: EntityId): boolean {
    let currentId = parentId;
    const visited = new Set<EntityId>();

    while (currentId !== -1) {
      if (currentId === childId) return true; // Found cycle
      if (visited.has(currentId)) return true; // Circular reference

      visited.add(currentId);

      const currentTransform = this.world.getComponent(currentId, Transform) as TransformData | undefined;
      if (!currentTransform) break;

      currentId = currentTransform.parentId;
    }

    return false;
  }

  /**
   * Remove entity from parent's linked list of children
   */
  private removeFromParentList(childId: EntityId, parentId: EntityId): void {
    const parentTransform = this.world.getComponent(parentId, Transform) as TransformData | undefined;
    if (!parentTransform) return;

    // Find child in linked list
    if (parentTransform.firstChildId === childId) {
      // Child is first in list
      const childTransform = this.world.getComponent(childId, Transform) as TransformData | undefined;
      if (!childTransform) return;

      parentTransform.firstChildId = childTransform.nextSiblingId;
      childTransform.nextSiblingId = -1;
    } else {
      // Find previous sibling
      let prevSiblingId = parentTransform.firstChildId;

      while (prevSiblingId !== -1) {
        const prevSibling = this.world.getComponent(prevSiblingId, Transform) as TransformData | undefined;
        if (!prevSibling) break;

        if (prevSibling.nextSiblingId === childId) {
          // Found it
          const childTransform = this.world.getComponent(childId, Transform) as TransformData | undefined;
          if (!childTransform) break;

          prevSibling.nextSiblingId = childTransform.nextSiblingId;
          childTransform.nextSiblingId = -1;
          break;
        }

        prevSiblingId = prevSibling.nextSiblingId;
      }
    }
  }

  /**
   * Add entity to parent's linked list of children
   */
  private addToParentList(childId: EntityId, parentId: EntityId): void {
    const parentTransform = this.world.getComponent(parentId, Transform) as TransformData | undefined;
    if (!parentTransform) return;

    const childTransform = this.world.getComponent(childId, Transform) as TransformData | undefined;
    if (!childTransform) return;

    // Add to front of linked list
    childTransform.nextSiblingId = parentTransform.firstChildId;
    parentTransform.firstChildId = childId;
  }

  // =============================================================================
  // MATRIX ACCESS - Convenience methods
  // =============================================================================

  /**
   * Get world matrix for entity (ensures up to date)
   *
   * @param entityId - Entity to get matrix for
   * @returns World matrix or undefined if entity has no Transform
   */
  getWorldMatrix(entityId: EntityId): Float32Array | undefined {
    const transform = this.world.getComponent(entityId, Transform) as TransformData | undefined;
    if (!transform) return undefined;

    // Update if dirty
    if (transform.dirty === 1) {
      this.updateTransform(entityId, transform);
    }

    return this.matrixStorage.getWorldMatrix(transform.worldMatrixIndex);
  }

  /**
   * Get local matrix for entity (ensures up to date)
   *
   * @param entityId - Entity to get matrix for
   * @returns Local matrix or undefined if entity has no Transform
   */
  getLocalMatrix(entityId: EntityId): Float32Array | undefined {
    const transform = this.world.getComponent(entityId, Transform) as TransformData | undefined;
    if (!transform) return undefined;

    // Update if dirty
    if (transform.dirty === 1) {
      this.updateTransform(entityId, transform);
    }

    return this.matrixStorage.getLocalMatrix(transform.localMatrixIndex);
  }

  /**
   * Force update a specific transform (bypass dirty flag)
   * Useful for debugging or when you need immediate update
   */
  forceUpdate(entityId: EntityId): void {
    const transform = this.world.getComponent(entityId, Transform) as TransformData | undefined;
    if (!transform) return;

    transform.dirty = 1;
    this.updateTransform(entityId, transform);
  }

  /**
   * Force update all transforms (bypass dirty flags)
   * Use sparingly - defeats the purpose of dirty flag optimization
   */
  forceUpdateAll(): void {
    const query = this.world.query().with(Transform).build();
    const entities = this.world.executeQuery(query);

    for (const { entity: entityId, components } of entities) {
      const transform = components.get(Transform) as TransformData | undefined;
      if (!transform) continue;

      transform.dirty = 1;
      this.updateTransform(entityId, transform);
    }
  }

  /**
   * Get statistics for debugging
   */
  getStats(): {
    totalTransforms: number;
    dirtyTransforms: number;
    hierarchicalTransforms: number;
    matrixMemoryBytes: number;
    matrixUtilization: number;
  } {
    const query = this.world.query().with(Transform).build();
    const entities = this.world.executeQuery(query);

    let totalTransforms = 0;
    let dirtyTransforms = 0;
    let hierarchicalTransforms = 0;

    for (const { components } of entities) {
      const transform = components.get(Transform) as TransformData | undefined;
      if (!transform) continue;

      totalTransforms++;
      if (transform.dirty === 1) dirtyTransforms++;
      if (transform.parentId !== -1 || transform.firstChildId !== -1) hierarchicalTransforms++;
    }

    const matrixStats = this.matrixStorage.getStats();

    return {
      totalTransforms,
      dirtyTransforms,
      hierarchicalTransforms,
      matrixMemoryBytes: matrixStats.memoryBytes,
      matrixUtilization: matrixStats.utilization
    };
  }

  /**
   * Get matrix storage instance (for advanced use)
   */
  getMatrixStorage(): MatrixStorage {
    return this.matrixStorage;
  }

  /**
   * Cleanup matrices when entity is destroyed
   * Called by World.destroyEntity() to prevent matrix index leaks
   *
   * @param entityId - Entity being destroyed
   */
  onEntityDestroyed(entityId: EntityId): void {
    const transform = this.world.getComponent(entityId, Transform) as TransformData | undefined;
    if (!transform) return;

    // Free matrix indices
    if (transform.localMatrixIndex !== -1) {
      this.matrixStorage.free(transform.localMatrixIndex);
      transform.localMatrixIndex = -1;
    }
    if (transform.worldMatrixIndex !== -1) {
      this.matrixStorage.free(transform.worldMatrixIndex);
      transform.worldMatrixIndex = -1;
    }

    // Remove from parent's linked list
    if (transform.parentId !== -1) {
      this.removeFromParentList(entityId, transform.parentId);
    }

    // Clear children's parent references
    let childId = transform.firstChildId;
    while (childId !== -1) {
      const childTransform = this.world.getComponent(childId, Transform) as TransformData | undefined;
      if (!childTransform) break;

      const nextSiblingId = childTransform.nextSiblingId;
      childTransform.parentId = -1;
      childTransform.nextSiblingId = -1;
      childTransform.dirty = 1; // Mark dirty (parent changed)

      childId = nextSiblingId;
    }
  }
}
