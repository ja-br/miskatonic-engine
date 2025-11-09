/**
 * InstanceDetector - Epic 3.13
 *
 * Detects commands that can be instanced (same mesh + material).
 * Groups commands and creates instance buffers.
 *
 * Instanceable Commands:
 * - Must share same mesh (vertex/index buffers)
 * - Must share same material (shader + textures + uniforms except transforms)
 * - Must have compatible render state
 *
 * Performance:
 * - 1000 instanceable objects → 1 draw call (100x reduction!)
 * - Detection: O(n) using hash map grouping
 * - Memory: ~64KB instance buffer for 1000 objects
 *
 * Example:
 * ```
 * 1000 trees with same mesh + material:
 *   Before: 1000 draw calls
 *   After:  1 instanced draw call with 1000 instances
 * ```
 */

import type { QueuedDrawCommand } from './RenderQueue';
import { InstanceBuffer, globalInstanceBufferPool } from './InstanceBuffer';

/**
 * Instance group - commands that can be rendered as one instanced draw call
 */
export interface InstanceGroup {
  /**
   * Unique key identifying this group (mesh + material)
   */
  key: string;

  /**
   * Mesh ID (shared by all commands in group)
   */
  meshId: string;

  /**
   * Material ID (shared by all commands in group)
   */
  materialId: string;

  /**
   * All commands in this group
   */
  commands: QueuedDrawCommand[];

  /**
   * Instance buffer containing per-instance transforms
   */
  instanceBuffer?: InstanceBuffer;
}

/**
 * Instance detection configuration
 */
export interface InstanceDetectorConfig {
  /**
   * Minimum instances required to use instanced rendering
   *
   * Below this threshold, individual draw calls are used instead.
   * Rationale: Overhead of instancing not worth it for <10 objects.
   *
   * Default: 10
   */
  minInstanceThreshold: number;

  /**
   * Enable instance detection
   *
   * If false, all commands are rendered individually.
   *
   * Default: true
   */
  enabled: boolean;

  /**
   * Enable material compatibility checking
   *
   * If true, checks uniforms/textures/state for compatibility.
   * If false, only checks mesh + material ID (faster but may cause visual bugs).
   *
   * Default: true (RECOMMENDED)
   */
  checkMaterialCompatibility: boolean;
}

/**
 * Instance detector
 *
 * Analyzes submitted draw commands and groups instanceable commands.
 */
export class InstanceDetector {
  private config: InstanceDetectorConfig;

  /**
   * Instance groups by key
   *
   * Key format: `${meshId}-${materialId}`
   */
  private groups = new Map<string, InstanceGroup>();

  constructor(config?: Partial<InstanceDetectorConfig>) {
    this.config = {
      minInstanceThreshold: config?.minInstanceThreshold ?? 10,
      enabled: config?.enabled ?? true,
      checkMaterialCompatibility: config?.checkMaterialCompatibility ?? true,
    };
  }

  /**
   * Analyze commands and detect instance groups
   *
   * @param commands - All submitted draw commands
   * @returns Array of instance groups (instanceable and non-instanceable)
   */
  detectGroups(commands: QueuedDrawCommand[]): InstanceGroup[] {
    if (!this.config.enabled) {
      // Instancing disabled, return individual groups
      return commands.map(cmd => this.createSingleCommandGroup(cmd));
    }

    // Release old buffers BEFORE clearing groups (fix memory leak)
    // Note: RenderQueue uses per-queue detectors, so this is safe
    this.releaseAll();

    // Clear previous groups
    this.groups.clear();

    // Group commands by (mesh, material) key
    for (const command of commands) {
      const key = this.getInstanceKey(command);

      if (!this.groups.has(key)) {
        this.groups.set(key, {
          key,
          meshId: this.extractMeshId(command),
          materialId: command.materialId,
          commands: [],
        });
      }

      this.groups.get(key)!.commands.push(command);
    }

    // Convert map to array
    const groups = Array.from(this.groups.values());

    // Create instance buffers for groups above threshold
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (this.shouldInstance(group)) {
        this.createInstanceBuffer(group);
      }
    }

    return groups;
  }

  /**
   * Check if group should use instanced rendering
   *
   * @param group - Instance group
   * @returns true if group has enough instances
   */
  shouldInstance(group: InstanceGroup): boolean {
    return group.commands.length >= this.config.minInstanceThreshold;
  }

  /**
   * Get instance count for group
   *
   * @param group - Instance group
   * @returns Number of instances
   */
  getInstanceCount(group: InstanceGroup): number {
    return group.commands.length;
  }

  /**
   * Create instance buffer for group
   *
   * Allocates buffer from pool and populates with per-instance transforms.
   *
   * @param group - Instance group
   */
  private createInstanceBuffer(group: InstanceGroup): void {
    const instanceCount = group.commands.length;

    // Acquire buffer from pool
    const buffer = globalInstanceBufferPool.acquire(instanceCount);

    // Populate with instance transforms
    for (let i = 0; i < instanceCount; i++) {
      const command = group.commands[i];
      buffer.setInstanceTransform(i, command.worldMatrix);
    }

    group.instanceBuffer = buffer;
  }

  /**
   * Release instance buffer back to pool
   *
   * Call this after rendering is complete to reuse buffers next frame.
   *
   * @param group - Instance group
   */
  releaseInstanceBuffer(group: InstanceGroup): void {
    if (group.instanceBuffer) {
      globalInstanceBufferPool.release(group.instanceBuffer);
      group.instanceBuffer = undefined;
    }
  }

  /**
   * Release all instance buffers
   *
   * Call at end of frame to return buffers to pool.
   */
  releaseAll(): void {
    const groups = Array.from(this.groups.values());
    for (let i = 0; i < groups.length; i++) {
      // Mark buffer as ready before releasing (fixes race condition)
      if (groups[i].instanceBuffer) {
        groups[i].instanceBuffer!.markReady();
      }
      this.releaseInstanceBuffer(groups[i]);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalGroups: number;
    instancedGroups: number;
    totalInstances: number;
    drawCallReduction: number;
  } {
    let instancedGroups = 0;
    let totalInstances = 0;
    let totalCommands = 0;

    const groups = Array.from(this.groups.values());
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      totalCommands += group.commands.length;

      if (this.shouldInstance(group)) {
        instancedGroups++;
        totalInstances += group.commands.length;
      }
    }

    // Calculate draw call reduction
    // Before: N commands = N draw calls
    // After: instancedGroups draw calls + (totalCommands - totalInstances) individual calls
    const beforeDrawCalls = totalCommands;
    const afterDrawCalls = instancedGroups + (totalCommands - totalInstances);
    const drawCallReduction = beforeDrawCalls > 0
      ? ((beforeDrawCalls - afterDrawCalls) / beforeDrawCalls) * 100
      : 0;

    return {
      totalGroups: this.groups.size,
      instancedGroups,
      totalInstances,
      drawCallReduction,
    };
  }

  /**
   * Update configuration
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<InstanceDetectorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<InstanceDetectorConfig> {
    return { ...this.config };
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Generate instance key for command
   *
   * Key format: `${meshId}-${materialId}-${cachedHash}` (if compatibility checking enabled)
   * Key format: `${meshId}-${materialId}` (if compatibility checking disabled)
   *
   * Commands with same key can be instanced together.
   * Material state hash is pre-computed in RenderQueue.submit() to avoid allocations.
   *
   * @param command - Draw command
   * @returns Instance key
   */
  private getInstanceKey(command: QueuedDrawCommand): string {
    const meshId = this.extractMeshId(command);

    if (this.config.checkMaterialCompatibility && command._cachedMaterialHash !== undefined) {
      return `${meshId}-${command.materialId}-${command._cachedMaterialHash}`;
    } else {
      // Fast path: only check mesh + material ID
      return `${meshId}-${command.materialId}`;
    }
  }

  /**
   * NOTE: Material state hashing moved to RenderQueue.computeMaterialStateHash()
   * to avoid per-frame allocations. The hash is pre-computed in submit() and
   * cached on command._cachedMaterialHash.
   *
   * This eliminates ~20,000 allocations per frame for 1000 objects.
   * See RenderQueue.ts:computeMaterialStateHash() for implementation.
   */

  /**
   * Extract mesh ID from command
   *
   * Uses explicit meshId if available, falls back to buffer IDs.
   *
   * @param command - Draw command
   * @returns Mesh ID
   */
  private extractMeshId(command: QueuedDrawCommand): string {
    // Use explicit meshId if available
    if (command.drawCommand.meshId) {
      return command.drawCommand.meshId;
    }

    // Fallback: Use vertex buffer ID + index buffer ID as proxy
    // NOTE: This is a hack and can cause hash collisions if multiple meshes share buffers
    const vertexId = command.drawCommand.vertexBufferId || '';
    const indexId = command.drawCommand.indexBufferId || '';
    return `${vertexId}-${indexId}`;
  }

  /**
   * Create single-command group (for non-instanceable commands)
   *
   * @param command - Draw command
   * @returns Instance group with single command
   */
  private createSingleCommandGroup(command: QueuedDrawCommand): InstanceGroup {
    const key = this.getInstanceKey(command);
    return {
      key,
      meshId: this.extractMeshId(command),
      materialId: command.materialId,
      commands: [command],
    };
  }
}
