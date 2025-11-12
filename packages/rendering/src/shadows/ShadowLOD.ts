/**
 * Shadow LOD System - Epic 3.17 Phase 2
 *
 * Dynamic resolution adjustment based on distance and importance.
 * Reduces memory/performance overhead for distant/unimportant lights.
 */

/**
 * Shadow resolution tiers
 */
export enum ShadowResolution {
  /** Ultra-high: 2048x2048 (16MB for directional CSM, 96MB for point cubemap) */
  ULTRA = 2048,
  /** High: 1024x1024 (4MB for directional CSM, 24MB for point cubemap) */
  HIGH = 1024,
  /** Medium: 512x512 (1MB for directional CSM, 6MB for point cubemap) */
  MEDIUM = 512,
  /** Low: 256x256 (256KB for directional CSM, 1.5MB for point cubemap) */
  LOW = 256,
  /** Minimal: 128x128 (64KB for directional CSM, 384KB for point cubemap) */
  MINIMAL = 128,
}

/**
 * Shadow LOD configuration
 */
export interface ShadowLODConfig {
  /** Distance thresholds for LOD levels (in world units) */
  distanceThresholds?: {
    ultra?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
  /** Importance multipliers for distance (higher = larger effective distance) */
  importanceMultipliers?: {
    player?: number;
    important?: number;
    normal?: number;
    unimportant?: number;
  };
  /** Enable adaptive LOD based on performance */
  adaptive?: boolean;
  /** Target frame time in milliseconds (for adaptive LOD) */
  targetFrameTime?: number;
}

/**
 * Light importance levels (affects shadow resolution)
 */
export enum LightImportance {
  /** Player light (flashlight, etc.) - highest priority */
  PLAYER = 'player',
  /** Important lights (key lights, hero lights) */
  IMPORTANT = 'important',
  /** Normal lights (most scene lights) */
  NORMAL = 'normal',
  /** Unimportant lights (background, fill) */
  UNIMPORTANT = 'unimportant',
}

/**
 * Shadow LOD recommendation
 */
export interface ShadowLODRecommendation {
  /** Recommended resolution */
  resolution: ShadowResolution;
  /** LOD level (0 = highest, 4 = lowest) */
  lodLevel: number;
  /** Effective distance used for calculation */
  effectiveDistance: number;
  /** Whether this light should cast shadows at all */
  shouldCastShadows: boolean;
}

/**
 * Shadow LOD system manages dynamic resolution based on distance and importance.
 *
 * Features:
 * - Distance-based LOD selection
 * - Importance-weighted distances
 * - Adaptive resolution based on performance
 * - Configurable thresholds per quality tier
 * - Hysteresis to prevent flickering
 *
 * Usage:
 * ```typescript
 * const lodSystem = new ShadowLOD({
 *   distanceThresholds: {
 *     ultra: 10,
 *     high: 25,
 *     medium: 50,
 *     low: 100,
 *   },
 *   adaptive: true,
 *   targetFrameTime: 16.67, // 60 FPS
 * });
 *
 * // Get LOD for a light
 * const lod = lodSystem.recommendLOD({
 *   distance: 30,
 *   importance: LightImportance.IMPORTANT,
 * });
 *
 * console.log(lod.resolution); // 512 (MEDIUM with importance boost)
 *
 * // Update based on frame time
 * lodSystem.updateAdaptive(actualFrameTime);
 * ```
 */
export class ShadowLOD {
  private config: Required<ShadowLODConfig>;
  private adaptiveScale = 1.0;
  private frameTimeHistory: number[] = [];
  private readonly MAX_HISTORY = 60; // 1 second @ 60 FPS

  // Default configuration
  private static readonly DEFAULT_CONFIG: Required<ShadowLODConfig> = {
    distanceThresholds: {
      ultra: 10,
      high: 25,
      medium: 50,
      low: 100,
    },
    importanceMultipliers: {
      player: 2.0, // Player lights have 2x effective range
      important: 1.5,
      normal: 1.0,
      unimportant: 0.5,
    },
    adaptive: false,
    targetFrameTime: 16.67, // 60 FPS
  };

  constructor(config?: ShadowLODConfig) {
    this.config = {
      ...ShadowLOD.DEFAULT_CONFIG,
      ...config,
      distanceThresholds: {
        ...ShadowLOD.DEFAULT_CONFIG.distanceThresholds,
        ...config?.distanceThresholds,
      },
      importanceMultipliers: {
        ...ShadowLOD.DEFAULT_CONFIG.importanceMultipliers,
        ...config?.importanceMultipliers,
      },
    };
  }

  /**
   * Recommend shadow LOD for a light.
   *
   * @param params Parameters for LOD calculation
   * @returns LOD recommendation
   */
  recommendLOD(params: {
    distance: number;
    importance?: LightImportance;
    currentResolution?: ShadowResolution;
  }): ShadowLODRecommendation {
    const importance = params.importance ?? LightImportance.NORMAL;
    const importanceMultiplier = this.config.importanceMultipliers[importance];

    // Calculate effective distance (reduced by importance)
    const effectiveDistance = params.distance / importanceMultiplier;

    // Apply adaptive scaling
    const scaledDistance = effectiveDistance / this.adaptiveScale;

    // Determine LOD level based on distance
    let resolution: ShadowResolution;
    let lodLevel: number;

    const thresholds = this.config.distanceThresholds;

    if (scaledDistance <= thresholds.ultra!) {
      resolution = ShadowResolution.ULTRA;
      lodLevel = 0;
    } else if (scaledDistance <= thresholds.high!) {
      resolution = ShadowResolution.HIGH;
      lodLevel = 1;
    } else if (scaledDistance <= thresholds.medium!) {
      resolution = ShadowResolution.MEDIUM;
      lodLevel = 2;
    } else if (scaledDistance <= thresholds.low!) {
      resolution = ShadowResolution.LOW;
      lodLevel = 3;
    } else {
      resolution = ShadowResolution.MINIMAL;
      lodLevel = 4;
    }

    // Apply hysteresis if transitioning (prevents flickering)
    if (params.currentResolution !== undefined) {
      resolution = this.applyHysteresis(
        params.currentResolution,
        resolution,
        scaledDistance
      );
    }

    // Determine if should cast shadows at all (very distant = disable)
    const maxDistance = thresholds.low! * 1.5; // 50% beyond lowest threshold
    const shouldCastShadows = scaledDistance <= maxDistance;

    return {
      resolution,
      lodLevel,
      effectiveDistance,
      shouldCastShadows,
    };
  }

  /**
   * Apply hysteresis to prevent LOD flickering at boundaries.
   *
   * Requires distance to move 20% past threshold before changing.
   */
  private applyHysteresis(
    current: ShadowResolution,
    recommended: ShadowResolution,
    distance: number
  ): ShadowResolution {
    // No change needed
    if (current === recommended) {
      return current;
    }

    const thresholds = this.config.distanceThresholds;
    const HYSTERESIS_FACTOR = 0.2; // 20% overlap

    // CRITICAL FIX: Resolution enum values are backward (ULTRA=2048 > LOW=256)
    // Higher resolution value = better quality = moving closer
    // Use resolution values directly for comparison

    // Upgrading to higher resolution (moving closer, better quality)
    if (recommended > current) {
      // Need to be well within the new threshold
      const threshold = this.getThresholdForResolution(recommended);
      if (threshold && distance < threshold * (1 - HYSTERESIS_FACTOR)) {
        return recommended; // Safe to upgrade
      }
      return current; // Stay at current until well past threshold
    }

    // Downgrading to lower resolution (moving farther, worse quality)
    if (recommended < current) {
      // Need to be well past the old threshold
      const threshold = this.getThresholdForResolution(current);
      if (threshold && distance > threshold * (1 + HYSTERESIS_FACTOR)) {
        return recommended; // Safe to downgrade
      }
      return current; // Stay at current until well past threshold
    }

    return recommended;
  }

  /**
   * Get distance threshold for a resolution level.
   */
  private getThresholdForResolution(resolution: ShadowResolution): number | undefined {
    const thresholds = this.config.distanceThresholds;
    switch (resolution) {
      case ShadowResolution.ULTRA:
        return thresholds.ultra;
      case ShadowResolution.HIGH:
        return thresholds.high;
      case ShadowResolution.MEDIUM:
        return thresholds.medium;
      case ShadowResolution.LOW:
        return thresholds.low;
      case ShadowResolution.MINIMAL:
        return thresholds.low! * 1.5;
    }
  }

  /**
   * Update adaptive scaling based on frame time.
   *
   * If frame time exceeds target, reduce shadow quality (increase scale).
   * If frame time is under target, increase shadow quality (decrease scale).
   *
   * @param frameTimeMs Frame time in milliseconds
   */
  updateAdaptive(frameTimeMs: number): void {
    if (!this.config.adaptive) {
      return;
    }

    // Add to history
    this.frameTimeHistory.push(frameTimeMs);
    if (this.frameTimeHistory.length > this.MAX_HISTORY) {
      this.frameTimeHistory.shift();
    }

    // Need enough samples
    if (this.frameTimeHistory.length < 30) {
      return;
    }

    // Calculate average frame time
    const avgFrameTime =
      this.frameTimeHistory.reduce((sum, t) => sum + t, 0) / this.frameTimeHistory.length;

    const targetFrameTime = this.config.targetFrameTime;
    const ratio = avgFrameTime / targetFrameTime;

    // CRITICAL FIX: Add deadband and slower adjustment to prevent oscillation
    const ADJUSTMENT_RATE = 0.005; // 0.5% per frame (reduced from 2%)
    const UPPER_THRESHOLD = 1.15; // +15% over target (increased from 1.1)
    const LOWER_THRESHOLD = 0.85; // -15% under target (decreased from 0.9)

    if (ratio > UPPER_THRESHOLD) {
      // Significantly over budget - reduce quality (increase distance scale)
      this.adaptiveScale = Math.min(2.0, this.adaptiveScale + ADJUSTMENT_RATE);
    } else if (ratio < LOWER_THRESHOLD) {
      // Significantly under budget - increase quality (decrease distance scale)
      this.adaptiveScale = Math.max(0.5, this.adaptiveScale - ADJUSTMENT_RATE);
    }
    // Between thresholds: hold steady (deadband prevents oscillation)
  }

  /**
   * Get current adaptive scale factor.
   */
  getAdaptiveScale(): number {
    return this.adaptiveScale;
  }

  /**
   * Reset adaptive scaling to default.
   */
  resetAdaptive(): void {
    this.adaptiveScale = 1.0;
    this.frameTimeHistory = [];
  }

  /**
   * Get current configuration.
   */
  getConfig(): Readonly<Required<ShadowLODConfig>> {
    return this.config;
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<ShadowLODConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      distanceThresholds: {
        ...this.config.distanceThresholds,
        ...config.distanceThresholds,
      },
      importanceMultipliers: {
        ...this.config.importanceMultipliers,
        ...config.importanceMultipliers,
      },
    };
  }

  /**
   * Calculate memory savings from LOD system.
   *
   * @param lights Array of light distances and importance
   * @returns Memory saved in bytes compared to all ultra-high
   */
  calculateMemorySavings(
    lights: Array<{ distance: number; importance?: LightImportance; type: 'directional' | 'point' | 'spot' }>
  ): {
    totalMemoryUltra: number;
    totalMemoryLOD: number;
    savings: number;
    savingsPercent: number;
  } {
    let totalMemoryUltra = 0;
    let totalMemoryLOD = 0;

    for (const light of lights) {
      const lod = this.recommendLOD({
        distance: light.distance,
        importance: light.importance,
      });

      const ultraRes = ShadowResolution.ULTRA;
      const lodRes = lod.resolution;

      // Calculate memory per light type
      let ultraMemory: number;
      let lodMemory: number;

      switch (light.type) {
        case 'directional':
          // CRITICAL FIX: CSM cascades use split resolutions (not uniform)
          // Typical split: cascade[0]=1024, cascade[1]=512, cascade[2]=256
          // For ULTRA (2048): 2048, 1024, 512 = 20MB
          // For HIGH (1024): 1024, 512, 256 = 5MB
          const ultraCascadeSizes = [ultraRes, ultraRes / 2, ultraRes / 4];
          const lodCascadeSizes = [lodRes, lodRes / 2, lodRes / 4];

          ultraMemory = ultraCascadeSizes.reduce((sum, res) => sum + res * res * 4, 0);
          lodMemory = lodCascadeSizes.reduce((sum, res) => sum + res * res * 4, 0);
          break;
        case 'point':
          // 6 faces (all same resolution)
          ultraMemory = ultraRes * ultraRes * 4 * 6;
          lodMemory = lodRes * lodRes * 4 * 6;
          break;
        case 'spot':
          // 1 face
          ultraMemory = ultraRes * ultraRes * 4;
          lodMemory = lodRes * lodRes * 4;
          break;
      }

      totalMemoryUltra += ultraMemory;
      totalMemoryLOD += lodMemory;
    }

    const savings = totalMemoryUltra - totalMemoryLOD;
    const savingsPercent = totalMemoryUltra > 0 ? (savings / totalMemoryUltra) * 100 : 0;

    return {
      totalMemoryUltra,
      totalMemoryLOD,
      savings,
      savingsPercent,
    };
  }
}
