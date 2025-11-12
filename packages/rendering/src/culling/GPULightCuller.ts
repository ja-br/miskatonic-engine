/**
 * GPU Light Culler - Epic 3.16 Phase 2
 *
 * WebGPU compute shader-based light culling using Forward+ tiling.
 * Culls thousands of lights efficiently on GPU.
 */

import type { LightData } from '../LightCollection';
import { TileGrid } from './TileGrid';
import type { Plane } from './Frustum';

/**
 * Configuration for GPU light culling
 */
export interface GPUCullingConfig {
  /** WebGPU device */
  device: GPUDevice;
  /** Screen width in pixels */
  screenWidth: number;
  /** Screen height in pixels */
  screenHeight: number;
  /** Tile size (default: 16x16 pixels) */
  tileSize?: number;
  /** Maximum lights per tile (default: 256) */
  maxLightsPerTile?: number;
}

/**
 * Result of GPU light culling
 */
export interface GPUCullingResult {
  /** Per-tile light indices */
  tileLightIndices: Uint32Array;
  /** Number of tiles */
  numTiles: number;
  /** Tiles in X direction */
  tilesX: number;
  /** Tiles in Y direction */
  tilesY: number;
  /** GPU culling time (milliseconds) */
  gpuTimeMs: number;
}

/**
 * GPU-based light culler using WebGPU compute shaders.
 * Implements Forward+ tile-based light culling.
 *
 * Algorithm:
 * 1. Divide screen into NxM tiles (16x16 pixels each)
 * 2. Upload light data and tile frustum planes to GPU
 * 3. Dispatch compute shader (one workgroup per tile)
 * 4. Each workgroup tests all lights against tile frustum
 * 5. Output: per-tile light index lists
 *
 * Performance: <0.5ms for 1000 lights @ 1080p
 *
 * Usage:
 * ```typescript
 * const culler = new GPULightCuller({
 *   device: gpuDevice,
 *   screenWidth: 1920,
 *   screenHeight: 1080,
 * });
 *
 * const result = await culler.cull(lights, projectionMatrix, viewMatrix);
 * // Use result.tileLightIndices for rendering
 * ```
 */
export class GPULightCuller {
  private device: GPUDevice;
  private tileGrid: TileGrid;
  private maxLightsPerTile: number;

  // GPU resources
  private computePipeline?: GPUComputePipeline;
  private lightBuffer?: GPUBuffer;
  private planeBuffer?: GPUBuffer;
  private outputBuffer?: GPUBuffer;
  private readbackBuffer?: GPUBuffer;
  private configBuffer?: GPUBuffer;
  private bindGroup?: GPUBindGroup;

  // Cached state
  private lastLightCount: number = 0;
  private lastTileCount: number = 0;

  constructor(config: GPUCullingConfig) {
    this.device = config.device;
    this.maxLightsPerTile = config.maxLightsPerTile ?? 256;

    this.tileGrid = new TileGrid({
      screenWidth: config.screenWidth,
      screenHeight: config.screenHeight,
      tileSize: config.tileSize ?? 16,
    });

    this.initializeComputePipeline();
  }

  /**
   * Initialize WebGPU compute pipeline for light culling.
   */
  private initializeComputePipeline(): void {
    // Load and compile compute shader
    const shaderModule = this.device.createShaderModule({
      label: 'Light Culling Compute Shader',
      code: `
        // Inline shader code (in production, load from file)
        struct Light {
          position: vec3<f32>,
          type: u32,
          direction: vec3<f32>,
          radius: f32,
          color: vec3<f32>,
          intensity: f32,
          innerConeAngle: f32,
          outerConeAngle: f32,
          _padding: vec2<f32>,
        }

        struct Plane {
          normal: vec3<f32>,
          distance: f32,
        }

        struct CullingConfig {
          screenWidth: u32,
          screenHeight: u32,
          tileSize: u32,
          numLights: u32,
          tilesX: u32,
          tilesY: u32,
          maxLightsPerTile: u32,
          _padding: u32,
        }

        @group(0) @binding(0) var<storage, read> lights: array<Light>;
        @group(0) @binding(1) var<storage, read> tilePlanes: array<Plane>;
        @group(0) @binding(2) var<storage, read_write> tileLightIndices: array<u32>;
        @group(0) @binding(3) var<uniform> config: CullingConfig;

        var<workgroup> sharedLightIndices: array<u32, 256>;
        var<workgroup> sharedLightCount: atomic<u32>;

        fn testSphereVsFrustum(center: vec3<f32>, radius: f32, tileIndex: u32) -> bool {
          let planeOffset = tileIndex * 6u;
          for (var i = 0u; i < 6u; i = i + 1u) {
            let plane = tilePlanes[planeOffset + i];
            let distance = dot(plane.normal, center) + plane.distance;
            if (distance < -radius) {
              return false;
            }
          }
          return true;
        }

        @compute @workgroup_size(16, 16, 1)
        fn main(
          @builtin(local_invocation_index) localIndex: u32,
          @builtin(workgroup_id) workgroupId: vec3<u32>
        ) {
          let tileIndex = workgroupId.y * config.tilesX + workgroupId.x;

          if (localIndex == 0u) {
            atomicStore(&sharedLightCount, 0u);
          }
          workgroupBarrier();

          let numThreads = 256u;
          let lightsPerThread = (config.numLights + numThreads - 1u) / numThreads;
          let startLight = localIndex * lightsPerThread;
          let endLight = min(startLight + lightsPerThread, config.numLights);

          for (var lightIdx = startLight; lightIdx < endLight; lightIdx = lightIdx + 1u) {
            let light = lights[lightIdx];

            if (light.type == 0u || light.type == 3u) {
              let count = atomicAdd(&sharedLightCount, 1u);
              if (count < 256u) {  // Hardcoded to match array size
                sharedLightIndices[count] = lightIdx;
              }
              continue;
            }

            if (light.type == 1u || light.type == 2u) {
              if (testSphereVsFrustum(light.position, light.radius, tileIndex)) {
                let count = atomicAdd(&sharedLightCount, 1u);
                if (count < 256u) {  // Hardcoded to match array size
                  sharedLightIndices[count] = lightIdx;
                }
              }
            }
          }

          workgroupBarrier();

          if (localIndex == 0u) {
            let finalCount = atomicLoad(&sharedLightCount);
            let clampedCount = min(finalCount, config.maxLightsPerTile);
            let outputOffset = tileIndex * (config.maxLightsPerTile + 1u);
            tileLightIndices[outputOffset] = clampedCount;

            for (var i = 0u; i < clampedCount; i = i + 1u) {
              tileLightIndices[outputOffset + 1u + i] = sharedLightIndices[i];
            }
          }
        }
      `,
    });

    // Create compute pipeline
    this.computePipeline = this.device.createComputePipeline({
      label: 'Light Culling Pipeline',
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'main',
      },
    });
  }

  /**
   * Cull lights using GPU compute shader.
   *
   * @param lights Array of lights to cull
   * @param projectionMatrix Camera projection matrix
   * @param viewMatrix Camera view matrix
   * @returns Culling result with per-tile light indices
   */
  async cull(
    lights: readonly LightData[],
    projectionMatrix: Float32Array | number[],
    viewMatrix: Float32Array | number[]
  ): Promise<GPUCullingResult> {
    const startTime = performance.now();

    // Update tile grid with current camera
    this.tileGrid.update(projectionMatrix, viewMatrix);
    const tiles = this.tileGrid.getTiles();
    const dims = this.tileGrid.getDimensions();

    // Prepare GPU buffers
    this.ensureBuffers(lights.length, dims.totalTiles);

    // Upload light data
    this.uploadLights(lights);

    // Upload tile plane data
    this.uploadTilePlanes(tiles);

    // Upload config
    this.uploadConfig(dims, lights.length);

    // Create bind group if needed
    if (!this.bindGroup) {
      this.bindGroup = this.device.createBindGroup({
        label: 'Light Culling Bind Group',
        layout: this.computePipeline!.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.lightBuffer! } },
          { binding: 1, resource: { buffer: this.planeBuffer! } },
          { binding: 2, resource: { buffer: this.outputBuffer! } },
          { binding: 3, resource: { buffer: this.configBuffer! } },
        ],
      });
    }

    // Execute compute pass
    const commandEncoder = this.device.createCommandEncoder({
      label: 'Light Culling Command Encoder',
    });

    const computePass = commandEncoder.beginComputePass({
      label: 'Light Culling Pass',
    });

    computePass.setPipeline(this.computePipeline!);
    computePass.setBindGroup(0, this.bindGroup);
    computePass.dispatchWorkgroups(dims.tilesX, dims.tilesY, 1);
    computePass.end();

    // Copy output to readback buffer
    commandEncoder.copyBufferToBuffer(
      this.outputBuffer!,
      0,
      this.readbackBuffer!,
      0,
      this.outputBuffer!.size
    );

    this.device.queue.submit([commandEncoder.finish()]);

    // Read back results
    await this.readbackBuffer!.mapAsync(GPUMapMode.READ);
    const results = new Uint32Array(this.readbackBuffer!.getMappedRange());
    const copy = new Uint32Array(results);
    this.readbackBuffer!.unmap();

    const endTime = performance.now();

    return {
      tileLightIndices: copy,
      numTiles: dims.totalTiles,
      tilesX: dims.tilesX,
      tilesY: dims.tilesY,
      gpuTimeMs: endTime - startTime,
    };
  }

  /**
   * Ensure GPU buffers are allocated with correct size.
   */
  private ensureBuffers(lightCount: number, tileCount: number): void {
    const needsRealloc =
      lightCount !== this.lastLightCount || tileCount !== this.lastTileCount;

    if (!needsRealloc && this.lightBuffer) {
      return;
    }

    // Destroy old buffers
    this.lightBuffer?.destroy();
    this.planeBuffer?.destroy();
    this.outputBuffer?.destroy();
    this.readbackBuffer?.destroy();
    this.configBuffer?.destroy();
    this.bindGroup = undefined;

    // Light buffer: array of Light structs (64 bytes each)
    // Align to 256 bytes for storage buffer requirements
    const minAlignment = 256;
    const rawLightSize = Math.max(lightCount * 64, 64);
    const lightBufferSize = Math.ceil(rawLightSize / minAlignment) * minAlignment;
    this.lightBuffer = this.device.createBuffer({
      label: 'Light Buffer',
      size: lightBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Plane buffer: 6 planes per tile (16 bytes per plane)
    const planeBufferSize = tileCount * 6 * 16;
    this.planeBuffer = this.device.createBuffer({
      label: 'Tile Plane Buffer',
      size: planeBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Output buffer: per-tile light indices
    const outputBufferSize = tileCount * (this.maxLightsPerTile + 1) * 4;
    this.outputBuffer = this.device.createBuffer({
      label: 'Output Buffer',
      size: outputBufferSize,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
    });

    // Readback buffer
    this.readbackBuffer = this.device.createBuffer({
      label: 'Readback Buffer',
      size: outputBufferSize,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    // Config buffer
    this.configBuffer = this.device.createBuffer({
      label: 'Config Buffer',
      size: 32, // 8 u32 values
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.lastLightCount = lightCount;
    this.lastTileCount = tileCount;
  }

  /**
   * Upload light data to GPU.
   */
  private uploadLights(lights: readonly LightData[]): void {
    // Pack lights into buffer format (64 bytes per light)
    const data = new Float32Array(lights.length * 16); // 64 bytes = 16 floats
    const uintView = new Uint32Array(data.buffer); // View for u32 fields

    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      const offset = i * 16;

      // Position (vec3<f32>)
      data[offset + 0] = light.position?.[0] ?? 0;
      data[offset + 1] = light.position?.[1] ?? 0;
      data[offset + 2] = light.position?.[2] ?? 0;

      // Type (u32) - use uint view for correct bit pattern
      uintView[offset + 3] = light.type;

      // Direction (vec3<f32>)
      data[offset + 4] = light.direction?.[0] ?? 0;
      data[offset + 5] = light.direction?.[1] ?? 0;
      data[offset + 6] = light.direction?.[2] ?? 0;

      // Radius (f32)
      data[offset + 7] = light.radius ?? 0;

      // Color (vec3<f32>)
      data[offset + 8] = light.color?.[0] ?? 1;
      data[offset + 9] = light.color?.[1] ?? 1;
      data[offset + 10] = light.color?.[2] ?? 1;

      // Intensity (f32)
      data[offset + 11] = light.intensity ?? 1;

      // Cone angles (f32, f32)
      data[offset + 12] = light.innerConeAngle ?? 0;
      data[offset + 13] = light.outerConeAngle ?? 0;

      // Padding (vec2<f32>)
      data[offset + 14] = 0;
      data[offset + 15] = 0;
    }

    this.device.queue.writeBuffer(this.lightBuffer!, 0, data);
  }

  /**
   * Upload tile plane data to GPU.
   */
  private uploadTilePlanes(tiles: readonly any[]): void {
    // Pack planes: 6 planes per tile, 4 floats per plane
    const data = new Float32Array(tiles.length * 6 * 4);

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const planes = tile.frustum.planes as readonly Plane[];

      for (let j = 0; j < 6; j++) {
        const plane = planes[j];
        const offset = (i * 6 + j) * 4;

        data[offset + 0] = plane.nx;
        data[offset + 1] = plane.ny;
        data[offset + 2] = plane.nz;
        data[offset + 3] = plane.d;
      }
    }

    this.device.queue.writeBuffer(this.planeBuffer!, 0, data);
  }

  /**
   * Upload culling configuration to GPU.
   */
  private uploadConfig(dims: any, lightCount: number): void {
    const data = new Uint32Array([
      dims.screenWidth,
      dims.screenHeight,
      dims.tileSize,
      lightCount,
      dims.tilesX,
      dims.tilesY,
      this.maxLightsPerTile,
      0, // padding
    ]);

    this.device.queue.writeBuffer(this.configBuffer!, 0, data);
  }

  /**
   * Resize the culler (e.g., window resize).
   */
  resize(screenWidth: number, screenHeight: number): void {
    this.tileGrid.resize(screenWidth, screenHeight);
    // Buffers will be reallocated on next cull()
  }

  /**
   * Clean up GPU resources.
   */
  destroy(): void {
    this.lightBuffer?.destroy();
    this.planeBuffer?.destroy();
    this.outputBuffer?.destroy();
    this.readbackBuffer?.destroy();
    this.configBuffer?.destroy();
  }
}
