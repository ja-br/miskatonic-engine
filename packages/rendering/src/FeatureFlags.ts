/**
 * Feature Flags for Epic 3.14: Modern Rendering API Refactoring
 *
 * Allows incremental rollout of new rendering API without breaking existing code.
 * Alpha development: Breaking changes are expected and encouraged.
 */

export interface RenderingFeatureFlags {
  /** Use new DrawCommand interface with proper WebGPU fields */
  useNewDrawCommand: boolean;

  /** Use new bind group management system with shader reflection */
  useNewBindGroups: boolean;

  /** Enable storage buffer support for large data arrays */
  enableStorageBuffers: boolean;

  /** Use new compute pipeline API */
  enableComputePipelines: boolean;

  /** Enable performance monitoring and validation */
  enablePerformanceValidation: boolean;
}

class FeatureFlagManager {
  private flags: RenderingFeatureFlags = {
    useNewDrawCommand: false,
    useNewBindGroups: false,
    enableStorageBuffers: false,
    enableComputePipelines: false,
    enablePerformanceValidation: true, // Always on for development
  };

  /**
   * Get current feature flag state
   */
  getFlags(): Readonly<RenderingFeatureFlags> {
    return { ...this.flags };
  }

  /**
   * Enable a specific feature
   */
  enable(flag: keyof RenderingFeatureFlags): void {
    this.flags[flag] = true;
  }

  /**
   * Disable a specific feature
   */
  disable(flag: keyof RenderingFeatureFlags): void {
    this.flags[flag] = false;
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(flag: keyof RenderingFeatureFlags): boolean {
    return this.flags[flag];
  }

  /**
   * Enable all Epic 3.14 features (for testing new API)
   */
  enableAllEpic314Features(): void {
    this.flags.useNewDrawCommand = true;
    this.flags.useNewBindGroups = true;
    this.flags.enableStorageBuffers = true;
    this.flags.enableComputePipelines = true;
  }

  /**
   * Disable all Epic 3.14 features (rollback to old API)
   */
  disableAllEpic314Features(): void {
    this.flags.useNewDrawCommand = false;
    this.flags.useNewBindGroups = false;
    this.flags.enableStorageBuffers = false;
    this.flags.enableComputePipelines = false;
  }
}

// Global singleton instance
export const featureFlags = new FeatureFlagManager();
