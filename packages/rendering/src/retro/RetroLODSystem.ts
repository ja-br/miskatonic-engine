/**
 * Retro LOD System - PS1/PS2 style level-of-detail with dithered transitions
 * No smooth mesh morphing or temporal blending - pure dithered crossfade
 */

export interface LODLevel {
  /** Mesh identifier for this LOD level */
  meshId: number | string;
  /** Distance threshold (switch when camera distance > this value) */
  distance: number;
}

export interface LODGroup {
  /** Unique ID for this LOD group */
  id: number | string;
  /** LOD levels (sorted by distance, closest first) */
  levels: LODLevel[];
  /** Current active LOD index */
  currentLOD: number;
  /** Previous LOD index (for crossfade) */
  previousLOD: number;
  /** Crossfade progress (0 = fully previous, 1 = fully current) */
  crossfadeProgress: number;
  /** World position of object (for distance calculation) */
  position: [number, number, number];
}

export interface LODStats {
  /** Total LOD groups */
  totalGroups: number;
  /** Number of transitions this frame */
  transitions: number;
  /** LOD level distribution (count per level) */
  levelDistribution: Map<number, number>;
}

/**
 * Manages level-of-detail with dithered transitions
 * Updates LOD selections based on camera distance
 * Provides crossfade parameters for dithered alpha blending in shaders
 */
export class RetroLODSystem {
  private groups: Map<number | string, LODGroup> = new Map();
  private nextGroupId: number = 0;
  private stats: LODStats = {
    totalGroups: 0,
    transitions: 0,
    levelDistribution: new Map(),
  };

  // Crossfade parameters
  private ditherEnabled: boolean = true;
  private crossfadeDuration: number = 0.5;  // seconds

  constructor() {}

  /**
   * Register a new LOD group
   * @param levels Array of LOD levels (sorted closest to farthest)
   * @param position Initial world position
   * @returns LOD group ID
   */
  registerLODGroup(levels: LODLevel[], position: [number, number, number]): number | string {
    // Validate levels
    if (levels.length === 0) {
      throw new Error('[RetroLODSystem] LOD group must have at least one level');
    }

    // Ensure levels are sorted by distance
    const sortedLevels = [...levels].sort((a, b) => a.distance - b.distance);

    // Validate distances
    for (let i = 0; i < sortedLevels.length; i++) {
      if (sortedLevels[i].distance < 0) {
        throw new Error(`[RetroLODSystem] Invalid negative distance at level ${i}`);
      }
      if (i > 0 && sortedLevels[i].distance <= sortedLevels[i - 1].distance) {
        throw new Error(`[RetroLODSystem] LOD distances must be strictly increasing`);
      }
    }

    const id = this.nextGroupId++;
    const group: LODGroup = {
      id,
      levels: sortedLevels,
      currentLOD: 0,
      previousLOD: 0,
      crossfadeProgress: 1.0,  // Fully transitioned
      position,
    };

    this.groups.set(id, group);
    this.stats.totalGroups++;

    return id;
  }

  /**
   * Unregister an LOD group
   */
  unregisterLODGroup(id: number | string): void {
    if (this.groups.delete(id)) {
      this.stats.totalGroups--;
    }
  }

  /**
   * Update LOD group position
   */
  updatePosition(id: number | string, position: [number, number, number]): void {
    const group = this.groups.get(id);
    if (group) {
      group.position = position;
    }
  }

  /**
   * Update all LOD groups based on camera position
   * Call this once per frame before rendering
   */
  update(cameraPosition: [number, number, number], deltaTime: number): void {
    this.stats.transitions = 0;
    this.stats.levelDistribution.clear();

    for (const group of this.groups.values()) {
      // Calculate squared distance (avoid sqrt for performance)
      const dx = group.position[0] - cameraPosition[0];
      const dy = group.position[1] - cameraPosition[1];
      const dz = group.position[2] - cameraPosition[2];
      const distanceSq = dx * dx + dy * dy + dz * dz;

      // Find appropriate LOD level
      let newLOD = 0;
      for (let i = 0; i < group.levels.length; i++) {
        const thresholdSq = group.levels[i].distance * group.levels[i].distance;
        if (distanceSq >= thresholdSq) {
          newLOD = Math.min(i + 1, group.levels.length - 1);
        } else {
          break;
        }
      }

      // Check for LOD transition
      if (newLOD !== group.currentLOD) {
        group.previousLOD = group.currentLOD;
        group.currentLOD = newLOD;
        group.crossfadeProgress = 0.0;  // Start crossfade
        this.stats.transitions++;
      }

      // Update crossfade progress
      if (group.crossfadeProgress < 1.0) {
        group.crossfadeProgress = Math.min(1.0, group.crossfadeProgress + deltaTime / this.crossfadeDuration);
      }

      // Update stats
      const count = this.stats.levelDistribution.get(group.currentLOD) ?? 0;
      this.stats.levelDistribution.set(group.currentLOD, count + 1);
    }
  }

  /**
   * Get LOD group by ID
   */
  getLODGroup(id: number | string): LODGroup | undefined {
    return this.groups.get(id);
  }

  /**
   * Get current active mesh ID for a LOD group
   */
  getCurrentMesh(id: number | string): number | string | undefined {
    const group = this.groups.get(id);
    if (!group || group.currentLOD >= group.levels.length) {
      return undefined;
    }
    return group.levels[group.currentLOD].meshId;
  }

  /**
   * Get crossfade state for a LOD group
   * Used by renderer to set dithering parameters
   */
  getCrossfadeState(id: number | string): { enabled: boolean; progress: number; previousMesh?: number | string } | null {
    const group = this.groups.get(id);
    if (!group) {
      return null;
    }

    // If crossfade is complete, no dithering needed
    if (group.crossfadeProgress >= 1.0) {
      return { enabled: false, progress: 1.0 };
    }

    // Return crossfade state
    const previousMesh = group.previousLOD < group.levels.length
      ? group.levels[group.previousLOD].meshId
      : undefined;

    return {
      enabled: this.ditherEnabled,
      progress: group.crossfadeProgress,
      previousMesh,
    };
  }

  /**
   * Enable/disable dithered crossfades
   */
  setDitherCrossfade(enabled: boolean): void {
    this.ditherEnabled = enabled;
  }

  /**
   * Set crossfade duration
   */
  setCrossfadeDuration(seconds: number): void {
    this.crossfadeDuration = Math.max(0.1, seconds);
  }

  /**
   * Get LOD statistics
   */
  getStats(): LODStats {
    return { ...this.stats, levelDistribution: new Map(this.stats.levelDistribution) };
  }

  /**
   * Clear all LOD groups
   */
  clear(): void {
    this.groups.clear();
    this.stats.totalGroups = 0;
    this.stats.transitions = 0;
    this.stats.levelDistribution.clear();
  }
}
