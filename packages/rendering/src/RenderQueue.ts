/**
 * RenderQueue - Epic 3.12 + Epic 3.13
 *
 * Organizes draw calls for optimal rendering performance.
 *
 * Features:
 * - Three separate queues: opaque, alpha-test, transparent
 * - Smart sorting: opaque front-to-back, transparent back-to-front
 * - State change minimization
 * - Sort key optimization (single integer comparison)
 * - Instance rendering (Epic 3.13): Automatic detection and grouping
 * - Batch-friendly organization
 *
 * Performance Targets:
 * - <1ms sorting time for 1000 objects
 * - <100 draw calls for 1000 objects (with instancing)
 * - <50 material changes per frame
 *
 * Architecture:
 * - Opaque queue: Sorted front-to-back by depth (minimize overdraw)
 * - Alpha-test queue: Sorted by material (minimize state changes)
 * - Transparent queue: Sorted back-to-front by depth (correct blending)
 * - Instance detection: Groups commands by (mesh, material) for instancing
 */

import type { DrawCommand, RenderState } from './types';
import { InstanceDetector, type InstanceGroup } from './InstanceDetector';

/**
 * Queued draw command with sorting information
 *
 * This is a higher-level structure than the low-level DrawCommand.
 * It includes material, transform, and sorting metadata.
 */
export interface QueuedDrawCommand {
  // Original draw command
  drawCommand: DrawCommand;

  // Material ID for batching
  materialId: string;

  // Transform matrix (world space)
  worldMatrix: Float32Array;

  // Sorting information
  depth: number; // Distance from camera (for sorting)
  sortKey: number; // Precomputed sort key (material | depth)

  // State information
  renderState?: Partial<RenderState>;

  // Epic 3.13: Cached material state hash (computed once in submit)
  _cachedMaterialHash?: number;
}

/**
 * Camera information for depth calculation
 */
export interface CameraInfo {
  position: Float32Array; // Camera position (vec3)
  viewMatrix: Float32Array; // View matrix (mat4)
  projectionMatrix: Float32Array; // Projection matrix (mat4)
}

/**
 * Render queue statistics
 */
export interface RenderQueueStats {
  totalCommands: number;
  opaqueCount: number;
  alphaTestCount: number;
  transparentCount: number;
  sortTime: number; // milliseconds
  materialChanges: number;
  stateChanges: number;
  // Epic 3.13: Instance rendering stats
  instanceGroups: number;
  instancedDrawCalls: number;
  totalInstances: number;
  drawCallReduction: number; // Percentage
}

/**
 * RenderQueue - Organizes and sorts draw commands for optimal rendering
 */
export class RenderQueue {
  // Three separate queues
  private opaque: QueuedDrawCommand[] = [];
  private alphaTest: QueuedDrawCommand[] = [];
  private transparent: QueuedDrawCommand[] = [];

  // Epic 3.13: Instance detection (per-queue detectors for clean lifecycle management)
  // Use threshold of 2 for better demo visibility (default is 10)
  private opaqueDetector = new InstanceDetector({ minInstanceThreshold: 2 });
  private alphaTestDetector = new InstanceDetector({ minInstanceThreshold: 2 });
  private transparentDetector = new InstanceDetector({ minInstanceThreshold: 2 });
  private instanceGroupsCache: Map<string, InstanceGroup[]> = new Map();

  // State tracking for minimization
  private lastMaterialId: string | null = null;
  private lastShaderId: string | null = null;

  // Statistics
  private stats: RenderQueueStats = {
    totalCommands: 0,
    opaqueCount: 0,
    alphaTestCount: 0,
    transparentCount: 0,
    sortTime: 0,
    materialChanges: 0,
    stateChanges: 0,
    // Epic 3.13 stats
    instanceGroups: 0,
    instancedDrawCalls: 0,
    totalInstances: 0,
    drawCallReduction: 0,
  };

  // Camera for depth calculation
  private camera: CameraInfo | null = null;

  /**
   * Set camera for depth calculations
   *
   * @param camera - Camera information
   */
  setCamera(camera: CameraInfo): void {
    this.camera = camera;
  }

  /**
   * Submit a draw command to the queue
   *
   * Automatically categorizes into opaque/alphaTest/transparent based on material.
   *
   * @param command - Queued draw command with sorting info
   * @throws Error if command is invalid (missing required fields)
   */
  submit(command: QueuedDrawCommand): void {
    // Input validation
    if (!command.worldMatrix || command.worldMatrix.length !== 16) {
      throw new Error('RenderQueue: Invalid worldMatrix (must be Float32Array of length 16)');
    }
    if (!command.materialId || typeof command.materialId !== 'string') {
      throw new Error('RenderQueue: Invalid materialId (must be non-empty string)');
    }
    if (!command.drawCommand) {
      throw new Error('RenderQueue: Missing drawCommand');
    }

    // Epic 3.13: Pre-compute material state hash once (avoid per-frame allocations)
    command._cachedMaterialHash = this.computeMaterialStateHash(command);

    const blendMode = command.renderState?.blendMode || 'none';

    if (blendMode === 'alpha' || blendMode === 'additive' || blendMode === 'multiply') {
      // Transparent: Calculate depth and add to transparent queue
      command.depth = this.calculateDepth(command.worldMatrix);
      command.sortKey = this.calculateTransparentSortKey(command);
      this.transparent.push(command);
    } else if (this.hasAlphaTest(command)) {
      // Alpha-test: Add to alpha-test queue
      command.sortKey = this.calculateAlphaTestSortKey(command);
      this.alphaTest.push(command);
    } else {
      // Opaque: Calculate depth and add to opaque queue
      command.depth = this.calculateDepth(command.worldMatrix);
      command.sortKey = this.calculateOpaqueSortKey(command);
      this.opaque.push(command);
    }

    this.stats.totalCommands++;
  }

  /**
   * Sort all queues and prepare for rendering
   *
   * - Opaque: Front-to-back by depth (minimize overdraw via early-z)
   * - Alpha-test: By material (minimize state changes)
   * - Transparent: Back-to-front by depth (correct blending)
   * - Epic 3.13: Detect instance groups for each queue
   */
  sort(): void {
    const startTime = performance.now();

    // Opaque: Front-to-back (ascending depth, ascending material)
    this.opaque.sort((a, b) => a.sortKey - b.sortKey);

    // Alpha-test: By material (minimize state changes)
    this.alphaTest.sort((a, b) => a.sortKey - b.sortKey);

    // Transparent: Back-to-front (descending depth)
    this.transparent.sort((a, b) => b.sortKey - a.sortKey);

    // Epic 3.13: Detect instance groups for each queue (using separate detectors)
    this.instanceGroupsCache.set('opaque', this.opaqueDetector.detectGroups(this.opaque));
    this.instanceGroupsCache.set('alphaTest', this.alphaTestDetector.detectGroups(this.alphaTest));
    this.instanceGroupsCache.set('transparent', this.transparentDetector.detectGroups(this.transparent));

    // Update stats (aggregate across all detectors)
    const opaqueStats = this.opaqueDetector.getStats();
    const alphaTestStats = this.alphaTestDetector.getStats();
    const transparentStats = this.transparentDetector.getStats();

    this.stats.sortTime = performance.now() - startTime;
    this.stats.opaqueCount = this.opaque.length;
    this.stats.alphaTestCount = this.alphaTest.length;
    this.stats.transparentCount = this.transparent.length;
    this.stats.instanceGroups = opaqueStats.totalGroups + alphaTestStats.totalGroups + transparentStats.totalGroups;
    this.stats.totalInstances = opaqueStats.totalInstances + alphaTestStats.totalInstances + transparentStats.totalInstances;
    this.stats.instancedDrawCalls = opaqueStats.instancedGroups + alphaTestStats.instancedGroups + transparentStats.instancedGroups;

    // Calculate combined draw call reduction
    const totalCommands = this.opaque.length + this.alphaTest.length + this.transparent.length;
    const totalInstancedGroups = this.stats.instancedDrawCalls;
    const totalNonInstancedCommands = totalCommands - this.stats.totalInstances;
    const beforeDrawCalls = totalCommands;
    const afterDrawCalls = totalInstancedGroups + totalNonInstancedCommands;
    this.stats.drawCallReduction = beforeDrawCalls > 0
      ? ((beforeDrawCalls - afterDrawCalls) / beforeDrawCalls) * 100
      : 0;
  }

  /**
   * Get all commands in render order
   *
   * Order: opaque -> alpha-test -> transparent
   *
   * @returns Array of commands in render order
   */
  getCommands(): QueuedDrawCommand[] {
    return [...this.opaque, ...this.alphaTest, ...this.transparent];
  }

  /**
   * Get opaque commands (front-to-back sorted)
   */
  getOpaqueCommands(): readonly QueuedDrawCommand[] {
    return this.opaque;
  }

  /**
   * Get alpha-test commands (material sorted)
   */
  getAlphaTestCommands(): readonly QueuedDrawCommand[] {
    return this.alphaTest;
  }

  /**
   * Get transparent commands (back-to-front sorted)
   */
  getTransparentCommands(): readonly QueuedDrawCommand[] {
    return this.transparent;
  }

  /**
   * Epic 3.13: Get instance groups for specific queue
   *
   * @param queueType - Queue type ('opaque', 'alphaTest', 'transparent')
   * @returns Instance groups for queue
   */
  getInstanceGroups(queueType: 'opaque' | 'alphaTest' | 'transparent'): readonly InstanceGroup[] {
    return this.instanceGroupsCache.get(queueType) || [];
  }

  /**
   * Epic 3.13: Check if instancing is enabled
   */
  isInstancedRenderingEnabled(): boolean {
    return this.opaqueDetector.getConfig().enabled;
  }

  /**
   * Epic 3.13: Enable/disable instanced rendering
   *
   * @param enabled - true to enable, false to disable
   */
  setInstancedRenderingEnabled(enabled: boolean): void {
    this.opaqueDetector.updateConfig({ enabled });
    this.alphaTestDetector.updateConfig({ enabled });
    this.transparentDetector.updateConfig({ enabled });
  }

  /**
   * Epic 3.13: Set minimum instance threshold
   *
   * Commands with fewer instances than this threshold will not be instanced.
   *
   * @param threshold - Minimum instances (default: 10)
   */
  setInstanceThreshold(threshold: number): void {
    this.opaqueDetector.updateConfig({ minInstanceThreshold: threshold });
    this.alphaTestDetector.updateConfig({ minInstanceThreshold: threshold });
    this.transparentDetector.updateConfig({ minInstanceThreshold: threshold });
  }

  /**
   * Clear all queues (call at start of frame)
   */
  clear(): void {
    this.opaque.length = 0;
    this.alphaTest.length = 0;
    this.transparent.length = 0;

    // Epic 3.13: Release instance buffers back to pool (all three detectors)
    this.opaqueDetector.releaseAll();
    this.alphaTestDetector.releaseAll();
    this.transparentDetector.releaseAll();
    this.instanceGroupsCache.clear();

    this.lastMaterialId = null;
    this.lastShaderId = null;

    this.stats = {
      totalCommands: 0,
      opaqueCount: 0,
      alphaTestCount: 0,
      transparentCount: 0,
      sortTime: 0,
      materialChanges: 0,
      stateChanges: 0,
      // Epic 3.13 stats
      instanceGroups: 0,
      instancedDrawCalls: 0,
      totalInstances: 0,
      drawCallReduction: 0,
    };
  }

  /**
   * Get rendering statistics
   */
  getStats(): Readonly<RenderQueueStats> {
    return { ...this.stats };
  }

  /**
   * Track material change (for statistics)
   */
  trackMaterialChange(materialId: string): void {
    if (materialId !== this.lastMaterialId) {
      this.stats.materialChanges++;
      this.lastMaterialId = materialId;
    }
  }

  /**
   * Track state change (for statistics)
   */
  trackStateChange(): void {
    this.stats.stateChanges++;
  }

  // =============================================================================
  // PRIVATE METHODS - Depth and Sort Key Calculation
  // =============================================================================

  /**
   * Calculate depth from camera to object
   *
   * Depth = distance from camera to object center
   *
   * @param worldMatrix - Object's world transform matrix
   * @returns Depth value (distance from camera)
   */
  private calculateDepth(worldMatrix: Float32Array): number {
    if (!this.camera) {
      console.warn('RenderQueue: No camera set, using default depth 0');
      return 0;
    }

    // Extract object position from world matrix (column 3)
    const objX = worldMatrix[12];
    const objY = worldMatrix[13];
    const objZ = worldMatrix[14];

    // Calculate distance from camera
    const camX = this.camera.position[0];
    const camY = this.camera.position[1];
    const camZ = this.camera.position[2];

    const dx = objX - camX;
    const dy = objY - camY;
    const dz = objZ - camZ;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Calculate sort key for opaque objects
   *
   * Opaque sorting priority:
   * 1. Material (minimize state changes)
   * 2. Depth (front-to-back for early-z)
   *
   * Sort key format (32-bit):
   * - Bits 0-15: Depth (logarithmic encoding for 0-65535 unit range)
   * - Bits 16-31: Material ID (hash to 16 bits)
   *
   * @param command - Draw command
   * @returns Sort key (ascending = front-to-back)
   */
  private calculateOpaqueSortKey(command: QueuedDrawCommand): number {
    const materialHash = this.hashStringTo16Bit(command.materialId);

    // Logarithmic depth encoding for better precision across large ranges
    // Handles depths from 0.1 to 65535 units with good precision
    const logDepth = command.depth > 0 ? Math.log2(command.depth + 1) : 0;
    const depthQuantized = Math.min(0xffff, Math.floor(logDepth * 4096)) & 0xffff;

    // Material in high bits (priority), depth in low bits
    return (materialHash << 16) | depthQuantized;
  }

  /**
   * Calculate sort key for alpha-test objects
   *
   * Alpha-test sorting priority:
   * 1. Material (only priority - minimize state changes)
   *
   * Sort key = material ID hash
   *
   * @param command - Draw command
   * @returns Sort key
   */
  private calculateAlphaTestSortKey(command: QueuedDrawCommand): number {
    return this.hashStringTo16Bit(command.materialId);
  }

  /**
   * Calculate sort key for transparent objects
   *
   * Transparent sorting priority:
   * 1. Depth (ONLY - back-to-front for correct blending)
   *
   * Sort key = depth (quantized to 32 bits for precision)
   *
   * @param command - Draw command
   * @returns Sort key (descending = back-to-front)
   */
  private calculateTransparentSortKey(command: QueuedDrawCommand): number {
    // Higher precision for transparent sorting
    return Math.floor(command.depth * 1000);
  }

  /**
   * Hash string to 16-bit number
   *
   * Simple hash function for material IDs
   *
   * @param str - String to hash
   * @returns 16-bit hash
   */
  private hashStringTo16Bit(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & 0xffff; // Keep 16 bits
    }
    return hash;
  }

  /**
   * Check if command uses alpha testing
   *
   * NOTE: Alpha-test detection not implemented yet.
   * This will be implemented in Epic 3.13 when material system integration is complete.
   * For now, alpha-test queue remains empty (all non-transparent objects go to opaque queue).
   *
   * @param _command - Draw command (unused until material integration)
   * @returns true if uses alpha testing
   */
  private hasAlphaTest(_command: QueuedDrawCommand): boolean {
    // TODO (Epic 3.13): Check material.hasAlphaTest property
    // For now, return false (no alpha-test detection)
    return false;
  }

  /**
   * Compute material state hash (Epic 3.13)
   *
   * Hashes shader ID, textures, and render state to detect material compatibility.
   *
   * ✅ CRITICAL FIX: DO NOT hash uniform VALUES (only shader + textures + state).
   * Per-instance data (transforms, colors) should vary without preventing instancing.
   *
   * Uses numeric hash to avoid string allocations.
   *
   * @param command - Queued draw command
   * @returns Material state hash (0 if no material state)
   */
  private computeMaterialStateHash(command: QueuedDrawCommand): number {
    let hash = 2166136261; // FNV offset basis

    // ✅ Hash shader ID (determines compatibility)
    // Same shader program = can be instanced together
    if (command.drawCommand.shader) {
      hash ^= this.hashStringFast(command.drawCommand.shader);
      hash = Math.imul(hash, 16777619);
    }

    // ✅ Hash textures (different textures = incompatible for instancing)
    // Texture IDs determine material appearance
    if (command.drawCommand.textures) {
      const textureEntries = Array.from(command.drawCommand.textures.entries());
      for (let i = 0; i < textureEntries.length; i++) {
        const [unit, textureId] = textureEntries[i];
        hash ^= unit;
        hash = Math.imul(hash, 16777619);
        hash ^= this.hashStringFast(textureId);
        hash = Math.imul(hash, 16777619);
      }
    }

    // ✅ Hash render state (blend mode, depth test, etc.)
    // Different blend states = incompatible for batching
    if (command.renderState) {
      const state = command.renderState;
      if (state.blendMode) {
        hash ^= this.hashStringFast(state.blendMode);
        hash = Math.imul(hash, 16777619);
      }
      if (state.depthTest) {
        hash ^= this.hashStringFast(state.depthTest);
        hash = Math.imul(hash, 16777619);
      }
      if (state.cullMode) {
        hash ^= this.hashStringFast(state.cullMode);
        hash = Math.imul(hash, 16777619);
      }
      if (state.depthWrite !== undefined) {
        hash ^= state.depthWrite ? 1 : 0;
        hash = Math.imul(hash, 16777619);
      }
    }

    // ❌ DO NOT HASH UNIFORM VALUES
    // Per-instance uniforms (transforms, colors) should not affect material compatibility.
    // Different values are OK - they'll be set per-instance via vertex attributes.
    //
    // This was the critical bug:
    // - 60 dice with different uBaseColor values → 60 different hashes → NO BATCHING
    // - Fix: hash only shader + textures + state, not per-instance uniform values

    return hash >>> 0;
  }

  /**
   * Fast string hash using FNV-1a (no allocations)
   */
  private hashStringFast(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /**
   * Fast uniform value hash (no allocations, 6-decimal precision)
   *
   * NOTE: This method is intentionally kept for future use but not currently used
   * after Epic 3.13 fix. Previously used to hash uniform values for material
   * compatibility, which was causing the instancing bug.
   *
   * @deprecated Not used after Epic 3.13 fix - kept for reference
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private hashUniformValueFast(value: number | number[] | Float32Array): number {
    if (typeof value === 'number') {
      return Math.floor(value * 1000000); // 6-decimal precision
    }

    let hash = 0;
    const length = Array.isArray(value) ? value.length : value.length;
    for (let i = 0; i < length; i++) {
      const v = Array.isArray(value) ? value[i] : value[i];
      hash ^= Math.floor(v * 1000000);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}
