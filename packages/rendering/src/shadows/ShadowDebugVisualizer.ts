/**
 * Shadow Debug Visualizer - Epic 3.17 Phase 2
 *
 * Visualizes shadow atlas, cascade frustums, and shadow bias for debugging.
 */

import type { ShadowAtlas } from './ShadowAtlas';
import type { DirectionalShadowCascades } from './DirectionalShadowCascades';
import type { PointLightShadowCubemap } from './PointLightShadowCubemap';
import type { SpotLightShadowMapper } from './SpotLightShadowMapper';

/**
 * Debug visualization modes
 */
export enum DebugVisualizationMode {
  /** No visualization */
  NONE = 'none',
  /** Show shadow atlas with allocated regions */
  ATLAS = 'atlas',
  /** Show cascade frustums in 3D */
  CASCADE_FRUSTUMS = 'cascade_frustums',
  /** Show shadow map depth values */
  DEPTH_MAP = 'depth_map',
  /** Show shadow bias visualization */
  BIAS = 'bias',
  /** Show LOD levels with color coding */
  LOD = 'lod',
  /** Show cache hit/miss statistics */
  CACHE_STATS = 'cache_stats',
}

/**
 * Atlas visualization data (2D overlay)
 */
export interface AtlasVisualizationData {
  /** Atlas size in pixels */
  size: number;
  /** Allocated regions */
  regions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    color: [number, number, number, number];
  }>;
  /** Atlas utilization percentage */
  utilization: number;
}

/**
 * Cascade frustum visualization data (3D wireframe)
 */
export interface CascadeFrustumData {
  /** Cascade index */
  index: number;
  /** 8 corner points in world space */
  corners: Array<[number, number, number]>;
  /** Color for this cascade */
  color: [number, number, number, number];
  /** Near/far distances */
  near: number;
  far: number;
}

/**
 * Shadow debug visualizer.
 *
 * Features:
 * - Atlas utilization overlay
 * - Cascade frustum wireframes
 * - Depth map visualization
 * - Bias debug overlays
 * - LOD color coding
 * - Cache performance stats
 *
 * Usage:
 * ```typescript
 * const debugViz = new ShadowDebugVisualizer();
 *
 * // Enable atlas visualization
 * debugViz.setMode(DebugVisualizationMode.ATLAS);
 *
 * // Get atlas visualization data
 * const atlasData = debugViz.generateAtlasVisualization(shadowAtlas, cascades);
 *
 * // Render overlay
 * renderAtlasOverlay(atlasData);
 *
 * // Toggle mode
 * debugViz.cycleMode();
 * ```
 */
export class ShadowDebugVisualizer {
  private mode = DebugVisualizationMode.NONE;
  private showLabels = true;
  private showStats = true;

  // Color palette for different shadow types
  private static readonly COLORS = {
    directional: [1.0, 0.5, 0.2, 0.7] as [number, number, number, number],
    point: [0.2, 0.7, 1.0, 0.7] as [number, number, number, number],
    spot: [0.8, 0.2, 0.8, 0.7] as [number, number, number, number],
    cascade0: [1.0, 0.0, 0.0, 0.5] as [number, number, number, number],
    cascade1: [0.0, 1.0, 0.0, 0.5] as [number, number, number, number],
    cascade2: [0.0, 0.0, 1.0, 0.5] as [number, number, number, number],
    cascade3: [1.0, 1.0, 0.0, 0.5] as [number, number, number, number],
  };

  /**
   * Set visualization mode.
   */
  setMode(mode: DebugVisualizationMode): void {
    this.mode = mode;
  }

  /**
   * Get current mode.
   */
  getMode(): DebugVisualizationMode {
    return this.mode;
  }

  /**
   * Cycle through visualization modes.
   */
  cycleMode(): DebugVisualizationMode {
    const modes = Object.values(DebugVisualizationMode);
    const currentIndex = modes.indexOf(this.mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.mode = modes[nextIndex];
    return this.mode;
  }

  /**
   * Toggle label visibility.
   */
  toggleLabels(): void {
    this.showLabels = !this.showLabels;
  }

  /**
   * Toggle stats visibility.
   */
  toggleStats(): void {
    this.showStats = !this.showStats;
  }

  /**
   * Generate atlas visualization data.
   */
  generateAtlasVisualization(
    atlas: ShadowAtlas,
    lights?: {
      directional?: DirectionalShadowCascades[];
      point?: PointLightShadowCubemap[];
      spot?: SpotLightShadowMapper[];
    }
  ): AtlasVisualizationData {
    const regions = atlas.getRegions();
    const stats = atlas.getStats();

    const vizRegions: AtlasVisualizationData['regions'] = [];

    // Track which regions belong to which lights
    let directionalIndex = 0;
    let pointIndex = 0;
    let spotIndex = 0;

    for (const region of regions) {
      let label = `Region ${region.id}`;
      let color: [number, number, number, number] = [0.5, 0.5, 0.5, 0.7];

      // Try to identify light type based on resolution patterns
      // Directional CSM: typically 1024x1024 in groups of 3
      // Point cubemap: 256x256 in groups of 6
      // Spot: 512x512 single

      if (lights?.directional) {
        for (const cascade of lights.directional) {
          const cascades = cascade.getCascades();
          for (let i = 0; i < cascades.length; i++) {
            if (cascades[i].region?.id === region.id) {
              label = `Directional Cascade ${i}`;
              color = ShadowDebugVisualizer.COLORS[`cascade${i}` as keyof typeof ShadowDebugVisualizer.COLORS] ||
                     ShadowDebugVisualizer.COLORS.directional;
              break;
            }
          }
        }
      }

      if (lights?.point) {
        for (const cubemap of lights.point) {
          const faces = cubemap.getFaces();
          for (let i = 0; i < faces.length; i++) {
            if (faces[i].region?.id === region.id) {
              label = `Point Face ${i} (${pointIndex})`;
              color = ShadowDebugVisualizer.COLORS.point;
              break;
            }
          }
        }
      }

      if (lights?.spot) {
        for (let i = 0; i < lights.spot.length; i++) {
          if (lights.spot[i].getRegion()?.id === region.id) {
            label = `Spot ${i}`;
            color = ShadowDebugVisualizer.COLORS.spot;
            break;
          }
        }
      }

      vizRegions.push({
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        label: this.showLabels ? label : '',
        color,
      });
    }

    return {
      size: stats.size,
      regions: vizRegions,
      utilization: stats.utilization * 100,
    };
  }

  /**
   * Generate cascade frustum visualization data.
   */
  generateCascadeFrustums(cascades: DirectionalShadowCascades): CascadeFrustumData[] {
    const cascadeData = cascades.getCascades();
    const frustums: CascadeFrustumData[] = [];

    for (let i = 0; i < cascadeData.length; i++) {
      const cascade = cascadeData[i];

      // For Phase 2, corners would need to be extracted from cascade matrices
      // This is a placeholder - actual implementation would compute world-space
      // frustum corners from the view-projection matrix
      const corners: Array<[number, number, number]> = [
        [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
        [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
      ];

      frustums.push({
        index: i,
        corners,
        color: ShadowDebugVisualizer.COLORS[`cascade${i}` as keyof typeof ShadowDebugVisualizer.COLORS] ||
               ShadowDebugVisualizer.COLORS.cascade0,
        near: cascade.near,
        far: cascade.far,
      });
    }

    return frustums;
  }

  /**
   * Generate debug info string.
   */
  generateDebugInfo(atlas: ShadowAtlas): string {
    if (!this.showStats) {
      return '';
    }

    const stats = atlas.getStats();
    const lines: string[] = [];

    lines.push(`=== Shadow Atlas Debug ===`);
    lines.push(`Mode: ${this.mode}`);
    lines.push(`Size: ${stats.size}x${stats.size}`);
    lines.push(`Format: ${stats.format}`);
    lines.push(`Allocated Regions: ${stats.allocatedRegions}`);
    lines.push(`Utilization: ${(stats.utilization * 100).toFixed(1)}%`);
    lines.push(`Memory: ${(stats.memoryUsageBytes / 1024 / 1024).toFixed(1)} MB`);
    lines.push(`Allocated Pixels: ${stats.allocatedPixels.toLocaleString()}`);
    lines.push(`Free Pixels: ${stats.freePixels.toLocaleString()}`);

    return lines.join('\n');
  }

  /**
   * Get color for LOD level.
   */
  static getLODColor(lodLevel: number): [number, number, number, number] {
    switch (lodLevel) {
      case 0: return [0.0, 1.0, 0.0, 1.0]; // Green (ultra)
      case 1: return [0.5, 1.0, 0.0, 1.0]; // Yellow-green (high)
      case 2: return [1.0, 1.0, 0.0, 1.0]; // Yellow (medium)
      case 3: return [1.0, 0.5, 0.0, 1.0]; // Orange (low)
      case 4: return [1.0, 0.0, 0.0, 1.0]; // Red (minimal)
      default: return [0.5, 0.5, 0.5, 1.0]; // Gray (unknown)
    }
  }

  /**
   * Get color for cache state.
   */
  static getCacheStateColor(state: 'valid' | 'invalid' | 'uninitialized'): [number, number, number, number] {
    switch (state) {
      case 'valid': return [0.0, 1.0, 0.0, 1.0]; // Green
      case 'invalid': return [1.0, 0.5, 0.0, 1.0]; // Orange
      case 'uninitialized': return [1.0, 0.0, 0.0, 1.0]; // Red
    }
  }

  /**
   * Format memory size for display.
   */
  static formatMemory(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }
  }

  /**
   * Generate performance summary.
   */
  generatePerformanceSummary(data: {
    frameTime: number;
    shadowRenderTime: number;
    lightsRendered: number;
    shadowsCached: number;
    totalMemory: number;
  }): string {
    const lines: string[] = [];

    lines.push(`=== Shadow Performance ===`);
    lines.push(`Frame Time: ${data.frameTime.toFixed(2)} ms`);
    lines.push(`Shadow Render: ${data.shadowRenderTime.toFixed(2)} ms (${((data.shadowRenderTime / data.frameTime) * 100).toFixed(1)}%)`);
    lines.push(`Lights Rendered: ${data.lightsRendered}`);
    lines.push(`Shadows Cached: ${data.shadowsCached} (${((data.shadowsCached / (data.lightsRendered + data.shadowsCached)) * 100).toFixed(1)}%)`);
    lines.push(`Total Memory: ${ShadowDebugVisualizer.formatMemory(data.totalMemory)}`);

    return lines.join('\n');
  }
}
