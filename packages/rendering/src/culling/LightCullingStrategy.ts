/**
 * Light Culling Strategy - Epic 3.16
 *
 * Strategy pattern for CPU vs GPU light culling.
 * Automatic fallback from GPU to CPU based on capabilities.
 */

import type { LightData } from '../LightCollection';
import { LightCuller } from './LightCuller';
import { GPULightCuller } from './GPULightCuller';

/**
 * Unified culling result interface
 */
export interface CullingResult {
  /** Visible lights (CPU culling) or null (GPU culling) */
  visibleLights: readonly LightData[] | null;
  /** Per-tile light indices (GPU culling) or null (CPU culling) */
  tileLightIndices: Uint32Array | null;
  /** Culling statistics */
  stats: {
    totalLights: number;
    visibleLights: number;
    culledLights: number;
    cullTimeMs: number;
    strategy: 'cpu' | 'gpu';
  };
  /** GPU-specific data (if using GPU strategy) */
  gpuData?: {
    numTiles: number;
    tilesX: number;
    tilesY: number;
  };
}

/**
 * Abstract interface for light culling strategies
 */
export interface ILightCullingStrategy {
  /**
   * Cull lights against view frustum or tiles.
   *
   * @param lights Array of lights to cull
   * @param viewProjectionMatrix Camera view-projection matrix
   * @returns Culling result
   */
  cull(
    lights: readonly LightData[],
    viewProjectionMatrix: Float32Array | number[],
    viewMatrix?: Float32Array | number[]
  ): Promise<CullingResult> | CullingResult;

  /**
   * Resize (for GPU strategies that need screen dimensions)
   */
  resize?(screenWidth: number, screenHeight: number): void;

  /**
   * Clean up resources
   */
  destroy?(): void;
}

/**
 * CPU-based frustum culling strategy.
 * Uses Phase 1 implementation (LightCuller).
 *
 * Performance: <1ms for 100 lights
 * Fallback: None (always available)
 */
export class CPUCullingStrategy implements ILightCullingStrategy {
  private culler: LightCuller;

  constructor() {
    this.culler = new LightCuller();
  }

  cull(
    lights: readonly LightData[],
    viewProjectionMatrix: Float32Array | number[]
  ): CullingResult {
    const result = this.culler.cull(lights, viewProjectionMatrix);

    return {
      visibleLights: result.visibleLights,
      tileLightIndices: null,
      stats: {
        totalLights: result.stats.totalLights,
        visibleLights: result.stats.visibleLights,
        culledLights: result.stats.culledLights,
        cullTimeMs: result.stats.cullTimeMs,
        strategy: 'cpu',
      },
    };
  }
}

/**
 * GPU-based tile culling strategy.
 * Uses Phase 2 implementation (GPULightCuller).
 *
 * Performance: <0.5ms for 1000 lights @ 1080p
 * Fallback: Falls back to CPU if WebGPU unavailable
 */
export class GPUCullingStrategy implements ILightCullingStrategy {
  private culler: GPULightCuller;

  constructor(
    device: GPUDevice,
    screenWidth: number,
    screenHeight: number,
    tileSize?: number
  ) {
    this.culler = new GPULightCuller({
      device,
      screenWidth,
      screenHeight,
      tileSize,
    });
  }

  async cull(
    lights: readonly LightData[],
    _viewProjectionMatrix: Float32Array | number[],
    viewMatrix?: Float32Array | number[]
  ): Promise<CullingResult> {
    if (!viewMatrix) {
      throw new Error('GPU culling requires separate view and projection matrices');
    }

    // GPU culler uses separate projection and view matrices
    const result = await this.culler.cull(
      lights,
      _viewProjectionMatrix,
      viewMatrix
    );

    return {
      visibleLights: null,
      tileLightIndices: result.tileLightIndices,
      stats: {
        totalLights: lights.length,
        visibleLights: 0, // Not computed (per-tile instead)
        culledLights: 0,
        cullTimeMs: result.gpuTimeMs,
        strategy: 'gpu',
      },
      gpuData: {
        numTiles: result.numTiles,
        tilesX: result.tilesX,
        tilesY: result.tilesY,
      },
    };
  }

  resize(screenWidth: number, screenHeight: number): void {
    this.culler.resize(screenWidth, screenHeight);
  }

  destroy(): void {
    this.culler.destroy();
  }
}

/**
 * Automatic strategy selector with fallback.
 * Tries GPU culling first, falls back to CPU if unavailable.
 *
 * Usage:
 * ```typescript
 * const strategy = await createLightCullingStrategy({
 *   device: gpuDevice,  // Optional
 *   screenWidth: 1920,
 *   screenHeight: 1080,
 * });
 *
 * const result = await strategy.cull(lights, vpMatrix, viewMatrix);
 * ```
 */
export async function createLightCullingStrategy(config: {
  device?: GPUDevice;
  screenWidth?: number;
  screenHeight?: number;
  tileSize?: number;
  preferGPU?: boolean;
}): Promise<ILightCullingStrategy> {
  const preferGPU = config.preferGPU ?? true;

  // Try GPU strategy if device and dimensions provided
  if (
    preferGPU &&
    config.device &&
    config.screenWidth &&
    config.screenHeight
  ) {
    try {
      return new GPUCullingStrategy(
        config.device,
        config.screenWidth,
        config.screenHeight,
        config.tileSize
      );
    } catch (error) {
      console.warn('GPU culling unavailable, falling back to CPU:', error);
    }
  }

  // Fallback to CPU strategy
  return new CPUCullingStrategy();
}
