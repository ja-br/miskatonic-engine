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
  /** Show light volumes with icosphere/cone wireframes (Epic 3.18 Phase 4) */
  LIGHT_VOLUMES = 'light_volumes',
  /** Show tile culling heatmap (lights per tile) (Epic 3.18 Phase 4) */
  TILE_HEATMAP = 'tile_heatmap',
  /** Show performance overlay with GPU timings (Epic 3.18 Phase 4) */
  PERFORMANCE_OVERLAY = 'performance_overlay',
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
 * Light volume visualization data (3D wireframes) - Epic 3.18 Phase 4
 */
export interface LightVolumeData {
  /** Light type */
  type: 'directional' | 'point' | 'spot';
  /** Vertex positions for wireframe (line list) */
  vertices: Float32Array;
  /** Color for this light type */
  color: [number, number, number, number];
  /** Center position (world space) */
  position: [number, number, number];
  /** Light radius (for point/spot) or 0 for directional */
  radius: number;
}

/**
 * Tile culling heatmap data (2D overlay) - Epic 3.18 Phase 4
 */
export interface TileHeatmapData {
  /** Tile grid dimensions (width x height) */
  tileCountX: number;
  tileCountY: number;
  /** Tile size in pixels */
  tileSize: number;
  /** Light count per tile (flat array, row-major) */
  lightCounts: Uint16Array;
  /** Max light count (for color scaling) */
  maxLights: number;
  /** Color gradient function (0-1 normalized) */
  getColor: (normalizedCount: number) => [number, number, number, number];
}

/**
 * Performance overlay data (2D text overlay) - Epic 3.18 Phase 4
 */
export interface PerformanceOverlayData {
  /** Frame time in milliseconds */
  frameTime: number;
  /** GPU timing entries */
  timings: Array<{
    label: string;
    durationMs: number;
    percentage: number;
  }>;
  /** Light statistics */
  lightStats: {
    total: number;
    culled: number;
    rendered: number;
  };
  /** Tile statistics (if tile culling enabled) */
  tileStats?: {
    totalTiles: number;
    avgLightsPerTile: number;
    maxLightsPerTile: number;
  };
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
              label = `Point Face ${i}`;
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

  /**
   * Generate light volume visualization data - Epic 3.18 Phase 4
   *
   * Creates wireframe geometry for visualizing light bounds:
   * - Point lights: Icosphere wireframe (20 faces, 1-2 subdivisions)
   * - Spot lights: Cone wireframe (16-segment base + apex lines)
   * - Directional lights: Not visualized (infinite bounds)
   *
   * @param lights - Light data to visualize
   * @returns Array of light volume data for rendering
   */
  generateLightVolumeData(lights: Array<{
    type: 'directional' | 'point' | 'spot';
    position: [number, number, number];
    radius?: number;
    direction?: [number, number, number];
    coneAngle?: number;
  }>): LightVolumeData[] {
    const volumes: LightVolumeData[] = [];

    for (const light of lights) {
      if (light.type === 'point' && light.radius !== undefined) {
        // Generate icosphere wireframe for point lights
        const vertices = this.generateIcosphereWireframe(
          light.position,
          light.radius
        );

        volumes.push({
          type: 'point',
          vertices,
          color: ShadowDebugVisualizer.COLORS.point,
          position: light.position,
          radius: light.radius,
        });
      } else if (light.type === 'spot' && light.radius !== undefined && light.direction && light.coneAngle) {
        // Generate cone wireframe for spot lights
        const vertices = this.generateConeWireframe(
          light.position,
          light.direction,
          light.radius,
          light.coneAngle,
          16 // segments
        );

        volumes.push({
          type: 'spot',
          vertices,
          color: ShadowDebugVisualizer.COLORS.spot,
          position: light.position,
          radius: light.radius,
        });
      }
      // Directional lights have infinite bounds, skip visualization
    }

    return volumes;
  }

  /**
   * Generate icosphere wireframe for point light visualization
   *
   * Creates an icosahedron wireframe in line-list format (30 edges).
   * Each edge is represented as 2 vertices.
   *
   * @param center - Center position
   * @param radius - Sphere radius
   * @returns Vertex buffer (line list: x,y,z pairs)
   */
  private generateIcosphereWireframe(
    center: [number, number, number],
    radius: number
  ): Float32Array {
    // Golden ratio
    const t = (1.0 + Math.sqrt(5.0)) / 2.0;

    // All icosahedron vertices have the same length: sqrt(1 + t²)
    // Pre-compute normalization factor once instead of 12 times
    const invLen = 1.0 / Math.sqrt(1 + t * t);

    // 12 vertices of icosahedron (pre-normalized)
    const vertices: [number, number, number][] = [
      [-invLen, t * invLen, 0], [invLen, t * invLen, 0],
      [-invLen, -t * invLen, 0], [invLen, -t * invLen, 0],
      [0, -invLen, t * invLen], [0, invLen, t * invLen],
      [0, -invLen, -t * invLen], [0, invLen, -t * invLen],
      [t * invLen, 0, -invLen], [t * invLen, 0, invLen],
      [-t * invLen, 0, -invLen], [-t * invLen, 0, invLen],
    ];

    // 20 faces (icosahedron triangles)
    const faces: [number, number, number][] = [
      // 5 faces around point 0
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      // 5 adjacent faces
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      // 5 faces around point 3
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      // 5 adjacent faces
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];

    // Extract edges (no subdivision for now - keep it simple)
    const edges = new Set<string>();
    for (const face of faces) {
      // Add three edges per triangle (deduplicated)
      edges.add(`${Math.min(face[0], face[1])},${Math.max(face[0], face[1])}`);
      edges.add(`${Math.min(face[1], face[2])},${Math.max(face[1], face[2])}`);
      edges.add(`${Math.min(face[2], face[0])},${Math.max(face[2], face[0])}`);
    }

    // Build line list
    const lineList: number[] = [];
    for (const edge of edges) {
      const [i1, i2] = edge.split(',').map(Number);
      const v1 = vertices[i1];
      const v2 = vertices[i2];

      // First vertex
      lineList.push(
        center[0] + v1[0] * radius,
        center[1] + v1[1] * radius,
        center[2] + v1[2] * radius
      );

      // Second vertex
      lineList.push(
        center[0] + v2[0] * radius,
        center[1] + v2[1] * radius,
        center[2] + v2[2] * radius
      );
    }

    return new Float32Array(lineList);
  }

  /**
   * Generate cone wireframe for spot light visualization
   *
   * Creates a cone wireframe in line-list format.
   * Includes base circle and lines from apex to base vertices.
   *
   * @param apex - Cone apex (light position)
   * @param direction - Cone direction (normalized)
   * @param height - Cone height (light radius)
   * @param coneAngle - Half-angle of cone in radians
   * @param segments - Number of segments in base circle
   * @returns Vertex buffer (line list: x,y,z pairs)
   */
  private generateConeWireframe(
    apex: [number, number, number],
    direction: [number, number, number],
    height: number,
    coneAngle: number,
    segments: number
  ): Float32Array {
    // Normalize direction
    const len = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2);
    const dir: [number, number, number] = [
      direction[0] / len,
      direction[1] / len,
      direction[2] / len,
    ];

    // Find perpendicular vectors for base circle
    let perpX: number, perpY: number, perpZ: number;
    if (Math.abs(dir[0]) < 0.9) {
      perpX = 0;
      perpY = dir[2];
      perpZ = -dir[1];
    } else {
      perpX = -dir[2];
      perpY = 0;
      perpZ = dir[0];
    }

    // Normalize perpendicular
    const perpLen = Math.sqrt(perpX ** 2 + perpY ** 2 + perpZ ** 2);
    perpX /= perpLen;
    perpY /= perpLen;
    perpZ /= perpLen;

    // Second perpendicular (cross product)
    const perp2X = dir[1] * perpZ - dir[2] * perpY;
    const perp2Y = dir[2] * perpX - dir[0] * perpZ;
    const perp2Z = dir[0] * perpY - dir[1] * perpX;

    // Base center and radius
    const baseCenterX = apex[0] + dir[0] * height;
    const baseCenterY = apex[1] + dir[1] * height;
    const baseCenterZ = apex[2] + dir[2] * height;
    const baseRadius = height * Math.tan(coneAngle);

    // Generate base circle vertices
    const baseVertices: [number, number, number][] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      baseVertices.push([
        baseCenterX + (perpX * cos + perp2X * sin) * baseRadius,
        baseCenterY + (perpY * cos + perp2Y * sin) * baseRadius,
        baseCenterZ + (perpZ * cos + perp2Z * sin) * baseRadius,
      ]);
    }

    // Build line list
    const lineList: number[] = [];

    // Base circle edges
    for (let i = 0; i < segments; i++) {
      const v1 = baseVertices[i];
      const v2 = baseVertices[(i + 1) % segments];

      lineList.push(v1[0], v1[1], v1[2]);
      lineList.push(v2[0], v2[1], v2[2]);
    }

    // Lines from apex to base (every 4th vertex to avoid clutter)
    for (let i = 0; i < segments; i += 4) {
      const v = baseVertices[i];

      lineList.push(apex[0], apex[1], apex[2]);
      lineList.push(v[0], v[1], v[2]);
    }

    return new Float32Array(lineList);
  }

  /**
   * Generate tile culling heatmap data - Epic 3.18 Phase 4
   *
   * Creates a 2D overlay showing light density per tile.
   * Color gradient: 0 lights (blue) → 8 lights (green) → 16+ lights (red)
   *
   * @param tileData - Tile light indices buffer
   * @param tileCountX - Number of tiles horizontally
   * @param tileCountY - Number of tiles vertically
   * @param tileSize - Tile size in pixels
   * @returns Heatmap data for rendering
   */
  generateTileHeatmapData(
    tileData: {
      lightCounts: Uint16Array;
    },
    tileCountX: number,
    tileCountY: number,
    tileSize: number
  ): TileHeatmapData {
    // Find max light count
    let maxLights = 0;
    for (let i = 0; i < tileData.lightCounts.length; i++) {
      if (tileData.lightCounts[i] > maxLights) {
        maxLights = tileData.lightCounts[i];
      }
    }

    // Color gradient function
    const getColor = (normalizedCount: number): [number, number, number, number] => {
      // 0.0 → blue [0, 0, 1]
      // 0.5 → green [0, 1, 0]
      // 1.0 → red [1, 0, 0]

      if (normalizedCount <= 0.5) {
        // Blue → Green
        const t = normalizedCount * 2.0;
        return [0, t, 1.0 - t, 0.7];
      } else {
        // Green → Red
        const t = (normalizedCount - 0.5) * 2.0;
        return [t, 1.0 - t, 0, 0.7];
      }
    };

    return {
      tileCountX,
      tileCountY,
      tileSize,
      lightCounts: tileData.lightCounts,
      maxLights,
      getColor,
    };
  }

  /**
   * Generate performance overlay data - Epic 3.18 Phase 4
   *
   * Creates structured data for rendering a performance HUD.
   * Includes GPU timings, light statistics, and tile statistics.
   *
   * @param timingData - GPU timing query results
   * @param lightData - Light culling statistics
   * @param tileData - Optional tile culling statistics
   * @returns Performance overlay data
   */
  generatePerformanceOverlayData(
    timingData: {
      frameTime: number;
      timings: Array<{ label: string; durationMs: number }>;
    },
    lightData: {
      total: number;
      culled: number;
      rendered: number;
    },
    tileData?: {
      totalTiles: number;
      avgLightsPerTile: number;
      maxLightsPerTile: number;
    }
  ): PerformanceOverlayData {
    // Calculate percentages (guard against division by zero)
    const timingsWithPercentage = timingData.timings.map(t => ({
      label: t.label,
      durationMs: t.durationMs,
      percentage: timingData.frameTime > 0
        ? (t.durationMs / timingData.frameTime) * 100
        : 0,
    }));

    return {
      frameTime: timingData.frameTime,
      timings: timingsWithPercentage,
      lightStats: lightData,
      tileStats: tileData,
    };
  }
}
