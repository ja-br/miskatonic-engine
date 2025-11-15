/**
 * Shadow Polish System
 * Epic 3.19: Final Shadow Polish
 *
 * Production-ready shadow quality improvements:
 * - Shadow acne mitigation (depth bias tuning)
 * - Light leaking prevention (surface acne fixes)
 * - Edge case handling (large objects, extreme angles)
 * - Final performance tuning
 */

/**
 * Shadow bias configuration
 * Prevents shadow acne (self-shadowing artifacts)
 */
export interface ShadowBiasConfig {
  /** Constant depth bias (prevents acne on flat surfaces) */
  constantBias: number;

  /** Slope-scale bias (prevents acne on angled surfaces) */
  slopeBias: number;

  /** Normal offset bias (pushes sample point along normal) */
  normalBias: number;

  /** Minimum bias value (clamps to prevent over-biasing) */
  minBias: number;

  /** Maximum bias value (prevents light leaking) */
  maxBias: number;
}

/**
 * Light leaking prevention configuration
 */
export interface LightLeakConfig {
  /** Enable light leak detection */
  enabled: boolean;

  /** Maximum allowed depth discontinuity (world units) */
  maxDiscontinuity: number;

  /** Shadow receiver plane offset (prevents surface acne) */
  receiverPlaneOffset: number;
}

/**
 * Edge case handling configuration
 */
export interface EdgeCaseConfig {
  /** Handle large objects (>100 units) specially */
  handleLargeObjects: boolean;

  /** Large object threshold (world units) */
  largeObjectThreshold: number;

  /** Handle extreme angles (>80°) specially */
  handleExtremeAngles: boolean;

  /** Extreme angle threshold (radians) */
  extremeAngleThreshold: number;

  /** Use adaptive bias for extreme cases */
  useAdaptiveBias: boolean;
}

/**
 * Shadow quality profile presets
 */
export enum ShadowQualityProfile {
  /** Low quality - minimal bias, fast */
  Low = 'low',

  /** Medium quality - balanced bias, good performance */
  Medium = 'medium',

  /** High quality - aggressive bias, production-ready */
  High = 'high',

  /** Custom - user-defined settings */
  Custom = 'custom',
}

/**
 * Complete shadow polish configuration
 */
export interface ShadowPolishConfig {
  /** Quality profile preset */
  profile: ShadowQualityProfile;

  /** Bias configuration */
  bias: ShadowBiasConfig;

  /** Light leak prevention */
  lightLeak: LightLeakConfig;

  /** Edge case handling */
  edgeCase: EdgeCaseConfig;
}

/**
 * Default configurations for each quality profile
 */
export const SHADOW_QUALITY_PRESETS: Record<ShadowQualityProfile, ShadowPolishConfig> = {
  [ShadowQualityProfile.Low]: {
    profile: ShadowQualityProfile.Low,
    bias: {
      constantBias: 0.001,
      slopeBias: 0.001,
      normalBias: 0.0,
      minBias: 0.0005,
      maxBias: 0.01,
    },
    lightLeak: {
      enabled: false,
      maxDiscontinuity: 10.0,
      receiverPlaneOffset: 0.0,
    },
    edgeCase: {
      handleLargeObjects: false,
      largeObjectThreshold: 100.0,
      handleExtremeAngles: false,
      extremeAngleThreshold: Math.PI / 2.25, // ~80°
      useAdaptiveBias: false,
    },
  },

  [ShadowQualityProfile.Medium]: {
    profile: ShadowQualityProfile.Medium,
    bias: {
      constantBias: 0.002,
      slopeBias: 0.002,
      normalBias: 0.001,
      minBias: 0.001,
      maxBias: 0.02,
    },
    lightLeak: {
      enabled: true,
      maxDiscontinuity: 5.0,
      receiverPlaneOffset: 0.01,
    },
    edgeCase: {
      handleLargeObjects: true,
      largeObjectThreshold: 100.0,
      handleExtremeAngles: true,
      extremeAngleThreshold: Math.PI / 2.25,
      useAdaptiveBias: false,
    },
  },

  [ShadowQualityProfile.High]: {
    profile: ShadowQualityProfile.High,
    bias: {
      constantBias: 0.003,
      slopeBias: 0.004,
      normalBias: 0.002,
      minBias: 0.001,
      maxBias: 0.03,
    },
    lightLeak: {
      enabled: true,
      maxDiscontinuity: 2.0,
      receiverPlaneOffset: 0.02,
    },
    edgeCase: {
      handleLargeObjects: true,
      largeObjectThreshold: 100.0,
      handleExtremeAngles: true,
      extremeAngleThreshold: Math.PI / 2.25,
      useAdaptiveBias: true,
    },
  },

  [ShadowQualityProfile.Custom]: {
    profile: ShadowQualityProfile.Custom,
    bias: {
      constantBias: 0.002,
      slopeBias: 0.002,
      normalBias: 0.001,
      minBias: 0.001,
      maxBias: 0.02,
    },
    lightLeak: {
      enabled: true,
      maxDiscontinuity: 5.0,
      receiverPlaneOffset: 0.01,
    },
    edgeCase: {
      handleLargeObjects: true,
      largeObjectThreshold: 100.0,
      handleExtremeAngles: true,
      extremeAngleThreshold: Math.PI / 2.25,
      useAdaptiveBias: false,
    },
  },
};

/**
 * Shadow Polish System
 *
 * Production-ready shadow quality system addressing:
 * - Shadow acne (self-shadowing artifacts)
 * - Light leaking (shadows appearing where they shouldn't)
 * - Edge cases (large objects, extreme angles)
 *
 * @example
 * ```typescript
 * const shadowPolish = new ShadowPolish(ShadowQualityProfile.High);
 *
 * // Calculate bias for a surface
 * const bias = shadowPolish.calculateBias(normal, lightDir, distance);
 *
 * // Check for light leaks
 * const isValidShadow = shadowPolish.validateShadow(receiverPos, occluderPos);
 * ```
 */
export class ShadowPolish {
  private config: ShadowPolishConfig;

  constructor(profile: ShadowQualityProfile = ShadowQualityProfile.Medium) {
    this.config = { ...SHADOW_QUALITY_PRESETS[profile] };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<ShadowPolishConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(partial: Partial<ShadowPolishConfig>): void {
    // Deep merge nested objects
    const newBias = partial.bias ? { ...this.config.bias, ...partial.bias } : this.config.bias;
    const newLightLeak = partial.lightLeak ? { ...this.config.lightLeak, ...partial.lightLeak } : this.config.lightLeak;
    const newEdgeCase = partial.edgeCase ? { ...this.config.edgeCase, ...partial.edgeCase } : this.config.edgeCase;

    // CRITICAL: Validate constraints
    if (newBias.minBias > newBias.maxBias) {
      throw new Error(`minBias (${newBias.minBias}) cannot exceed maxBias (${newBias.maxBias})`);
    }
    if (newBias.constantBias < 0 || newBias.slopeBias < 0 || newBias.normalBias < 0 || newBias.minBias < 0 || newBias.maxBias < 0) {
      throw new Error('Bias values cannot be negative');
    }
    if (newLightLeak.maxDiscontinuity < 0) {
      throw new Error('maxDiscontinuity cannot be negative');
    }
    if (newLightLeak.receiverPlaneOffset < 0) {
      throw new Error('receiverPlaneOffset cannot be negative');
    }
    if (newEdgeCase.largeObjectThreshold <= 0) {
      throw new Error('largeObjectThreshold must be positive');
    }
    if (newEdgeCase.extremeAngleThreshold <= 0 || newEdgeCase.extremeAngleThreshold > Math.PI) {
      throw new Error('extremeAngleThreshold must be in (0, π]');
    }

    this.config = {
      ...this.config,
      ...partial,
      bias: newBias,
      lightLeak: newLightLeak,
      edgeCase: newEdgeCase,
    };

    // Mark as custom if modified
    if (partial.profile === undefined) {
      this.config.profile = ShadowQualityProfile.Custom;
    }
  }

  /**
   * Calculate shadow bias for a surface
   *
   * Combines constant bias, slope bias, and normal offset bias
   * to prevent shadow acne while minimizing light leaking.
   *
   * @param normal Surface normal (normalized)
   * @param lightDir Light direction (normalized, pointing toward light)
   * @param distance Distance from light to surface (for adaptive bias)
   * @returns Shadow bias value
   */
  calculateBias(normal: Float32Array | number[], lightDir: Float32Array | number[], distance: number): number {
    // CRITICAL: Validate inputs
    if (normal.length < 3 || lightDir.length < 3) {
      throw new Error('normal and lightDir must be 3D vectors');
    }
    if (distance < 0) {
      throw new Error('distance must be non-negative');
    }
    if (!Number.isFinite(distance)) {
      throw new Error('distance must be finite');
    }

    const { bias, edgeCase } = this.config;

    // Calculate surface angle relative to light
    // CRITICAL: Clamp cosTheta to [0, 1] to prevent Math.acos(>1.0) = NaN
    const cosTheta = Math.max(0, Math.min(1, this.dot(normal, lightDir)));
    const angle = Math.acos(cosTheta);

    // Base bias: constant + slope-based
    let totalBias = bias.constantBias;

    // Add slope bias (more bias for steeper angles)
    const slopeFactor = Math.sqrt(1 - cosTheta * cosTheta); // sin(theta)
    totalBias += bias.slopeBias * slopeFactor;

    // Handle extreme angles
    if (edgeCase.handleExtremeAngles && angle > edgeCase.extremeAngleThreshold) {
      const extremeFactor = (angle - edgeCase.extremeAngleThreshold) / (Math.PI / 2 - edgeCase.extremeAngleThreshold);
      totalBias += bias.slopeBias * extremeFactor * 2.0; // Double bias for extreme angles
    }

    // Adaptive bias based on distance (for large objects)
    if (edgeCase.useAdaptiveBias) {
      const distanceFactor = Math.min(distance / edgeCase.largeObjectThreshold, 2.0);
      totalBias *= (1.0 + distanceFactor * 0.5);
    }

    // Clamp to min/max
    return Math.max(bias.minBias, Math.min(bias.maxBias, totalBias));
  }

  /**
   * Calculate normal offset bias
   *
   * Pushes the shadow sample point along the surface normal
   * to prevent self-shadowing.
   *
   * @param normal Surface normal (normalized)
   * @returns Normal offset distance
   */
  calculateNormalOffset(normal: Float32Array | number[]): number {
    return this.config.bias.normalBias;
  }

  /**
   * Validate shadow sample to detect light leaks
   *
   * Checks for unrealistic shadow scenarios:
   * - Large depth discontinuities (object not blocking light path)
   * - Shadows appearing on wrong side of surfaces
   *
   * @param receiverWorldPos Shadow receiver position
   * @param occluderWorldPos Shadow occluder position (from shadow map)
   * @param lightPos Light position
   * @param normal Receiver surface normal
   * @returns true if shadow is valid, false if likely a light leak
   */
  validateShadow(
    receiverWorldPos: Float32Array | number[],
    occluderWorldPos: Float32Array | number[],
    lightPos: Float32Array | number[],
    normal: Float32Array | number[]
  ): boolean {
    if (!this.config.lightLeak.enabled) {
      return true;
    }

    // Check depth discontinuity
    const receiverToLight = this.subtract(lightPos, receiverWorldPos);
    const receiverDist = this.length(receiverToLight);

    // CRITICAL: Check for zero-length vector (light at receiver position)
    if (receiverDist < 1e-6) {
      return false; // Light at receiver position - invalid shadow
    }

    const occluderToLight = this.subtract(lightPos, occluderWorldPos);
    const occluderDist = this.length(occluderToLight);

    // CRITICAL: Check for zero-length vector (light at occluder position)
    if (occluderDist < 1e-6) {
      return false; // Light at occluder position - no shadow cast
    }

    const discontinuity = Math.abs(receiverDist - occluderDist);

    if (discontinuity > this.config.lightLeak.maxDiscontinuity) {
      // Large gap between receiver and occluder - likely not a valid shadow
      return false;
    }

    // Check if occluder is actually between light and receiver
    if (occluderDist > receiverDist) {
      // Occluder is behind receiver - invalid shadow
      return false;
    }

    // Check surface orientation (prevent shadows on back-facing surfaces)
    const lightDir = this.normalize(receiverToLight);
    const facing = this.dot(normal, lightDir);

    if (facing <= 0.0) {
      // Surface facing away from light - should not receive shadows
      return false;
    }

    return true;
  }

  /**
   * Calculate receiver plane offset
   *
   * Offsets the shadow receiver plane to prevent surface acne
   * on near-parallel surfaces.
   *
   * @param normal Surface normal (normalized)
   * @param lightDir Light direction (normalized)
   * @returns Receiver plane offset distance
   */
  calculateReceiverPlaneOffset(normal: Float32Array | number[], lightDir: Float32Array | number[]): number {
    const cosTheta = Math.abs(this.dot(normal, lightDir));

    // More offset for surfaces nearly parallel to light
    const parallelFactor = 1.0 - cosTheta;

    return this.config.lightLeak.receiverPlaneOffset * (1.0 + parallelFactor * 2.0);
  }

  /**
   * Get recommended PCF kernel size based on quality profile
   */
  getRecommendedPCFKernelSize(): number {
    switch (this.config.profile) {
      case ShadowQualityProfile.Low: return 4;
      case ShadowQualityProfile.Medium: return 16;
      case ShadowQualityProfile.High: return 32;
      default: return 16;
    }
  }

  /**
   * Get recommended shadow map resolution based on quality profile
   */
  getRecommendedShadowMapResolution(): number {
    switch (this.config.profile) {
      case ShadowQualityProfile.Low: return 1024;
      case ShadowQualityProfile.Medium: return 2048;
      case ShadowQualityProfile.High: return 4096;
      default: return 2048;
    }
  }

  // ============================================================================
  // Private Math Utilities
  // ============================================================================

  private dot(a: Float32Array | number[], b: Float32Array | number[]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  private length(v: Float32Array | number[]): number {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  }

  private normalize(v: Float32Array | number[]): number[] {
    const len = this.length(v);
    // CRITICAL: Use epsilon comparison for zero-length check
    if (len < 1e-6) {
      throw new Error('Cannot normalize zero-length vector');
    }
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  private subtract(a: Float32Array | number[], b: Float32Array | number[]): number[] {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }
}

/**
 * Utility: Tune shadow bias automatically for a scene
 *
 * Analyzes scene geometry and lighting to recommend bias settings.
 *
 * @param sceneBounds Scene bounding box size
 * @param averageLightDistance Average distance from lights to geometry
 * @param hasLargeObjects Whether scene contains objects >100 units
 * @param hasExtremeAngles Whether scene has surfaces at extreme angles
 * @returns Recommended shadow polish configuration
 */
export function autoTuneShadowBias(
  sceneBounds: number,
  averageLightDistance: number,
  hasLargeObjects: boolean,
  hasExtremeAngles: boolean
): ShadowPolishConfig {
  // Start with medium profile (deep copy to avoid mutating preset)
  const preset = SHADOW_QUALITY_PRESETS[ShadowQualityProfile.Medium];
  const config: ShadowPolishConfig = {
    profile: preset.profile,
    bias: { ...preset.bias },
    lightLeak: { ...preset.lightLeak },
    edgeCase: { ...preset.edgeCase },
  };

  // Scale bias based on scene size
  const sceneScale = sceneBounds / 100.0; // Normalize to typical 100-unit scenes
  config.bias.constantBias *= sceneScale;
  config.bias.slopeBias *= sceneScale;
  config.bias.normalBias *= sceneScale;
  // CRITICAL: Scale min/max bias too to maintain valid constraints
  config.bias.minBias *= sceneScale;
  config.bias.maxBias *= sceneScale;

  // Adjust for large objects
  if (hasLargeObjects) {
    config.edgeCase.handleLargeObjects = true;
    config.edgeCase.useAdaptiveBias = true;
    config.bias.maxBias *= 2.0;
  }

  // Adjust for extreme angles
  if (hasExtremeAngles) {
    config.edgeCase.handleExtremeAngles = true;
    config.bias.slopeBias *= 1.5;
  }

  // Adjust light leak detection based on light distance
  if (averageLightDistance > 100.0) {
    config.lightLeak.maxDiscontinuity = averageLightDistance * 0.05;
  }

  config.profile = ShadowQualityProfile.Custom;
  return config;
}
