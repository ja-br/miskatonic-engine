/**
 * Retro LOD System
 * Epic 3.4: Retro Rendering Pipeline - LOD System
 *
 * PlayStation 2 era LOD with dithered crossfade transitions:
 * - Distance-based switching (2-3 LOD levels max)
 * - Dithered crossfade (alpha-to-coverage or stipple patterns)
 * - No smooth mesh morphing, no temporal blending
 */

import type { IRendererBackend, BackendBufferHandle } from '../backends/IRendererBackend';

/**
 * LOD level configuration
 */
export interface LODLevel {
  /** Minimum distance where this LOD is visible */
  minDistance: number;
  /** Maximum distance where this LOD is visible */
  maxDistance: number;
  /** Mesh data for this LOD (vertex count, buffer handles, etc.) */
  vertexCount: number;
  indexCount?: number;
}

/**
 * LOD group configuration
 * A group represents all LOD levels for a single object
 */
export interface LODGroupConfig {
  /** Unique identifier for this LOD group */
  id: string;
  /** LOD levels (sorted by distance, closest first) */
  levels: LODLevel[];
  /** Dither crossfade distance (how far to blend between LODs) */
  crossfadeDistance: number;
  /** Use alpha-to-coverage instead of stipple pattern */
  useAlphaToCoverage?: boolean;
}

/**
 * LOD selection result
 */
export interface LODSelection {
  /** Primary LOD level index */
  primaryLOD: number;
  /** Secondary LOD level index (for crossfade) */
  secondaryLOD?: number;
  /** Crossfade factor (0.0 = primary, 1.0 = secondary) */
  crossfadeFactor: number;
}

/**
 * Default LOD configuration (PS2-era typical)
 * 3 LOD levels: Close, Medium, Far
 */
export const DEFAULT_LOD_DISTANCES = {
  /** Close LOD: 0-30 units */
  close: { min: 0, max: 30 },
  /** Medium LOD: 30-100 units */
  medium: { min: 30, max: 100 },
  /** Far LOD: 100-200 units */
  far: { min: 100, max: 200 },
  /** Crossfade distance (units) */
  crossfade: 10,
};

/**
 * Retro LOD System
 *
 * Manages LOD selection and dithered crossfading for retro rendering.
 * PS2 games typically used 2-3 LOD levels with simple distance-based switching.
 *
 * @example
 * ```typescript
 * const lodSystem = new RetroLODSystem(backend);
 * lodSystem.initialize();
 *
 * // Register LOD group
 * const group: LODGroupConfig = {
 *   id: 'tree',
 *   levels: [
 *     { minDistance: 0, maxDistance: 30, vertexCount: 1000 },
 *     { minDistance: 30, maxDistance: 100, vertexCount: 300 },
 *     { minDistance: 100, maxDistance: 200, vertexCount: 50 },
 *   ],
 *   crossfadeDistance: 10,
 * };
 * lodSystem.registerGroup(group);
 *
 * // Select LOD based on camera distance
 * const selection = lodSystem.selectLOD('tree', cameraDistance);
 * ```
 */
export class RetroLODSystem {
  private groups = new Map<string, LODGroupConfig>();
  private uniformBuffer?: BackendBufferHandle;
  private initialized = false;

  // Current LOD state (for debugging/stats)
  private stats = {
    totalGroups: 0,
    visibleGroups: 0,
    crossfadingGroups: 0,
    trianglesSaved: 0,
  };

  constructor(private backend: IRendererBackend) {}

  /**
   * Initialize LOD system (creates uniform buffer)
   */
  initialize(): void {
    if (this.initialized) return;

    this.createUniformBuffer();
    this.initialized = true;
  }

  /**
   * Register LOD group
   */
  registerGroup(group: LODGroupConfig): void {
    // Validate LOD levels
    for (let i = 0; i < group.levels.length; i++) {
      const level = group.levels[i];

      // Check for negative distances
      if (level.minDistance < 0) {
        throw new Error(
          `LOD level ${i} has negative minDistance: ${level.minDistance}`
        );
      }

      // Check for inverted ranges (min >= max)
      if (level.minDistance >= level.maxDistance) {
        throw new Error(
          `LOD level ${i} has inverted range: [${level.minDistance}, ${level.maxDistance}]`
        );
      }

      // Check for overlaps with previous level
      if (i > 0 && level.minDistance < group.levels[i - 1].maxDistance) {
        throw new Error(
          `LOD level ${i} overlaps with level ${i - 1}`
        );
      }
    }

    this.groups.set(group.id, group);
    this.stats.totalGroups = this.groups.size;
  }

  /**
   * Unregister LOD group
   */
  unregisterGroup(id: string): void {
    this.groups.delete(id);
    this.stats.totalGroups = this.groups.size;
  }

  /**
   * Select LOD level based on distance from camera
   *
   * @param groupId - LOD group identifier
   * @param distance - Distance from camera
   * @returns LOD selection with primary/secondary levels and crossfade factor
   */
  selectLOD(groupId: string, distance: number): LODSelection {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`LOD group not found: ${groupId}`);
    }

    // Find primary LOD level
    let primaryLOD = -1;
    for (let i = 0; i < group.levels.length; i++) {
      const level = group.levels[i];
      if (distance >= level.minDistance && distance <= level.maxDistance) {
        primaryLOD = i;
        break;
      }
    }

    // If outside all LOD ranges, use furthest LOD or cull
    if (primaryLOD === -1) {
      if (distance > group.levels[group.levels.length - 1].maxDistance) {
        // Beyond furthest LOD - object should be culled
        return {
          primaryLOD: -1,
          crossfadeFactor: 0,
        };
      } else {
        // Before closest LOD (shouldn't happen with valid config)
        primaryLOD = 0;
      }
    }

    // Check if we're in crossfade region
    const level = group.levels[primaryLOD];
    const crossfadeStart = level.maxDistance - group.crossfadeDistance;

    if (distance >= crossfadeStart && distance <= level.maxDistance && primaryLOD < group.levels.length - 1) {
      // We're in crossfade region, blend to next LOD
      const crossfadeFactor = (distance - crossfadeStart) / group.crossfadeDistance;

      this.stats.crossfadingGroups++;

      return {
        primaryLOD,
        secondaryLOD: primaryLOD + 1,
        crossfadeFactor,
      };
    }

    // No crossfade, just use primary LOD
    return {
      primaryLOD,
      crossfadeFactor: 0,
    };
  }

  /**
   * Get LOD group configuration
   */
  getGroup(id: string): LODGroupConfig | undefined {
    return this.groups.get(id);
  }

  /**
   * Get LOD statistics (for debugging)
   */
  getStats(): Readonly<typeof this.stats> {
    return { ...this.stats };
  }

  /**
   * Reset per-frame statistics
   * Call this at the start of each frame
   */
  resetFrameStats(): void {
    this.stats.visibleGroups = 0;
    this.stats.crossfadingGroups = 0;
    this.stats.trianglesSaved = 0;
  }

  /**
   * Get uniform buffer for binding in shaders
   */
  getUniformBuffer(): BackendBufferHandle {
    if (!this.uniformBuffer) {
      throw new Error('RetroLODSystem not initialized. Call initialize() first.');
    }
    return this.uniformBuffer;
  }

  /**
   * Update crossfade parameters in uniform buffer
   *
   * @param crossfadeFactor - Crossfade factor (0.0 = primary, 1.0 = secondary)
   */
  updateCrossfadeUniform(crossfadeFactor: number): void {
    if (!this.uniformBuffer) return;

    const data = new Float32Array([
      crossfadeFactor,
      0, 0, 0, // Padding for vec4 alignment
    ]);

    this.backend.updateBuffer(this.uniformBuffer, data);
  }

  /**
   * Clean up GPU resources
   */
  dispose(): void {
    if (this.uniformBuffer) {
      this.backend.deleteBuffer(this.uniformBuffer);
      this.uniformBuffer = undefined;
    }

    this.groups.clear();
    this.initialized = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createUniformBuffer(): void {
    // Initial crossfade factor = 0 (no crossfade)
    const data = new Float32Array([0, 0, 0, 0]);

    this.uniformBuffer = this.backend.createBuffer(
      'retro_lod_params',
      'uniform',
      data,
      'dynamic_draw'
    );
  }
}

/**
 * Calculate LOD bias based on screen coverage
 * Useful for adjusting LOD selection based on object size in screen space
 *
 * @param boundingRadius - Object bounding sphere radius (world units)
 * @param distance - Distance from camera
 * @param fov - Camera field of view (radians)
 * @param screenHeight - Screen height in pixels
 * @returns LOD bias factor (multiply with distance for adjusted LOD selection)
 */
export function calculateLODBias(
  boundingRadius: number,
  distance: number,
  fov: number,
  screenHeight: number
): number {
  // Project bounding sphere to screen space
  const tanHalfFOV = Math.tan(fov / 2);
  const screenCoverage = (boundingRadius / distance) / tanHalfFOV;
  const pixelHeight = screenCoverage * screenHeight;

  // If object is small on screen, bias towards lower LOD (higher distance)
  // If object is large on screen, bias towards higher LOD (lower distance)
  const minPixels = 50; // Threshold for LOD selection
  const bias = Math.max(0.5, Math.min(2.0, minPixels / pixelHeight));

  return bias;
}
