/**
 * High-Level Renderer - Main class for simplified rendering API
 * Epic 3.14: High-Level Rendering API Wrapper - Task 2.5
 */

import { BackendFactory, type IRendererBackend } from '../backends';
import { BindGroupPool } from '../BindGroupPool';
import { GPUBufferPool } from '../GPUBufferPool';
import { VRAMProfiler, VRAMCategory } from '../VRAMProfiler';
import { Material } from './Material';
import { Mesh } from './Mesh';
import { getAllBuiltinShaders } from './shaders/builtins';
import { loadImage } from './utils';
import type {
  BackendTextureHandle,
  BackendBindGroupHandle,
  BackendBufferHandle,
  BackendBindGroupLayoutHandle,
} from '../backends/IRendererBackend';
import type { DrawCommand } from '../commands/DrawCommand';

export interface HighLevelConfig {
  canvas: HTMLCanvasElement;
  antialias?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
}

export interface RenderStats {
  drawCalls: number;
  triangles: number;
  frameTime: number;
  bindGroupReuseRate: number;
  vramUsedMB: number;
}

/**
 * HighLevelRenderer - Simplified rendering API
 *
 * Provides a high-level interface for WebGPU rendering, hiding complexity
 * while maintaining performance. Handles resource management, caching,
 * and provides a simple draw() API.
 *
 * @example
 * ```typescript
 * const renderer = new HighLevelRenderer({ canvas });
 * await renderer.initialize();
 *
 * const material = Material.Textured(renderer, { texture: 'crate.png' });
 * await renderer.createMaterial(material);
 *
 * const cube = Mesh.Cube(renderer);
 * renderer.createMesh(cube);
 *
 * renderer.beginFrame();
 * renderer.draw(cube, material, transform);
 * const stats = renderer.endFrame();
 * ```
 */
export class HighLevelRenderer {
  public backend!: IRendererBackend;
  public bindGroupPool!: BindGroupPool;
  public readonly bufferPool: GPUBufferPool;
  public readonly vramProfiler: VRAMProfiler;

  private builtinShaders = getAllBuiltinShaders();
  private textureCache = new Map<string, BackendTextureHandle>();
  private materials = new Map<string, Material>();
  private meshes = new Map<string, Mesh>();
  private initialized = false;

  // Scene bind group (group 0) - view/projection matrices
  private sceneBindGroup?: BackendBindGroupHandle;
  private sceneUniformBuffer?: BackendBufferHandle;
  private sceneBindGroupLayout?: BackendBindGroupLayoutHandle;

  // Render statistics
  private stats = {
    drawCalls: 0,
    triangles: 0,
    frameStartTime: 0,
  };

  constructor(public readonly config: HighLevelConfig) {
    this.bufferPool = new GPUBufferPool();
    this.vramProfiler = new VRAMProfiler();
  }

  /**
   * Initialize WebGPU backend and resources
   * Must be called before using the renderer
   *
   * @throws Error if WebGPU is not available
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create backend using factory (NOT new WebGPUBackend())
    this.backend = await BackendFactory.create(this.config.canvas, {
      antialias: this.config.antialias,
      powerPreference: this.config.powerPreference,
    });

    // Initialize pools (need device from backend)
    const device = (this.backend as any).device as GPUDevice;
    this.bindGroupPool = new BindGroupPool(device);

    // Setup device loss handler
    device.lost.then((info) => {
      console.error(`WebGPU device lost: ${info.message}`);
      this.handleDeviceLoss();
    });

    // Create dummy scene bind group for now
    // TODO: Implement proper scene uniform buffer with view/projection matrices
    this.createSceneBindGroup();

    this.initialized = true;
  }

  /**
   * Create and initialize a material
   * @param material - Material instance to initialize
   */
  async createMaterial(material: Material): Promise<void> {
    await material.initialize();
    this.materials.set(material.id, material);
  }

  /**
   * Register a mesh with the renderer
   * @param mesh - Mesh instance to register
   */
  createMesh(mesh: Mesh): void {
    this.meshes.set(mesh.id, mesh);
  }

  /**
   * Draw a mesh with a material
   *
   * @param mesh - Mesh to draw
   * @param material - Material to use for rendering
   * @param worldMatrix - World transformation matrix (16 floats, column-major) - currently unused, will be used when camera system is integrated
   */
  draw(mesh: Mesh, material: Material, _worldMatrix: Float32Array): void {
    if (!this.initialized) {
      throw new Error('HighLevelRenderer not initialized. Call initialize() first.');
    }

    if (!this.sceneBindGroup) {
      throw new Error('Scene bind group not created');
    }

    // Prepare material (updates uniforms, gets bind groups)
    const { pipeline, bindGroups } = material.prepare(this.sceneBindGroup);

    // Get mesh geometry
    const geometry = mesh.getGeometry();

    // Build draw command
    const command: DrawCommand = {
      pipeline,
      bindGroups,
      geometry,
    };

    // Execute immediately (no queue for now - future enhancement)
    this.backend.executeDrawCommand(command);

    // Update stats
    this.stats.drawCalls++;
    this.stats.triangles += geometry.indexCount / 3;
  }

  /**
   * Begin frame rendering
   * Call this at the start of each frame before any draw calls
   */
  beginFrame(): void {
    this.stats.frameStartTime = performance.now();
    this.stats.drawCalls = 0;
    this.stats.triangles = 0;

    this.backend.beginFrame();
    this.bindGroupPool.nextFrame();
    this.bufferPool.nextFrame();
  }

  /**
   * End frame and present
   * Call this after all draw calls are complete
   *
   * @returns Frame statistics
   */
  endFrame(): RenderStats {
    this.backend.endFrame();

    const frameTime = performance.now() - this.stats.frameStartTime;
    const poolStats = this.bindGroupPool.getStats();
    const vramStats = this.backend.getVRAMStats();

    return {
      drawCalls: this.stats.drawCalls,
      triangles: this.stats.triangles,
      frameTime,
      bindGroupReuseRate: poolStats.reuseRate,
      vramUsedMB: vramStats.totalUsed / (1024 * 1024),
    };
  }

  /**
   * Load texture from URL or path
   * Textures are cached - subsequent calls with the same path return the cached texture
   *
   * @param path - URL or path to the texture image
   * @returns Texture handle
   */
  async loadTexture(path: string): Promise<BackendTextureHandle> {
    // Check cache
    if (this.textureCache.has(path)) {
      return this.textureCache.get(path)!;
    }

    // Load image
    const imageBitmap = await loadImage(path);

    // Create texture using backend
    // Note: createTexture expects HTMLImageElement but we have ImageBitmap
    // This works in practice as WebGPU accepts ImageBitmap, but types need updating
    const texture = this.backend.createTexture(path, imageBitmap.width, imageBitmap.height, imageBitmap as any, {
      format: 'rgba',
      minFilter: 'linear',
      magFilter: 'linear',
      wrapS: 'repeat',
      wrapT: 'repeat',
      generateMipmaps: true,
    });

    // Track VRAM usage
    this.vramProfiler.allocate(
      path,
      VRAMCategory.TEXTURES,
      imageBitmap.width * imageBitmap.height * 4
    );

    // Cache
    this.textureCache.set(path, texture);

    return texture;
  }

  /**
   * Get builtin shaders map
   * Used internally by Material class
   */
  getBuiltinShaders(): Map<string, string> {
    return this.builtinShaders;
  }

  /**
   * Clean up all resources
   * Should be called when the renderer is no longer needed
   */
  dispose(): void {
    // Dispose all materials
    for (const material of this.materials.values()) {
      material.dispose();
    }

    // Dispose all meshes
    for (const mesh of this.meshes.values()) {
      mesh.dispose();
    }

    // Delete all textures
    for (const texture of this.textureCache.values()) {
      this.backend.deleteTexture(texture);
    }

    // Clean up scene resources
    if (this.sceneUniformBuffer) {
      this.backend.deleteBuffer(this.sceneUniformBuffer);
      this.sceneUniformBuffer = undefined;
    }

    // Clear pools
    this.bindGroupPool.clear();
    this.bufferPool.clear();

    // Dispose backend
    this.backend.dispose();

    this.materials.clear();
    this.meshes.clear();
    this.textureCache.clear();
    this.initialized = false;
  }

  // Private helper methods

  private createSceneBindGroup(): void {
    // Create scene uniform buffer with view and projection matrices
    // SceneUniforms struct: viewMatrix (64 bytes) + projectionMatrix (64 bytes) = 128 bytes
    const sceneData = new Float32Array(32); // 32 floats = 128 bytes

    // Initialize with identity matrices (will be updated by camera system later)
    // View matrix (identity)
    sceneData.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 0);
    // Projection matrix (identity)
    sceneData.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 16);

    this.sceneUniformBuffer = this.backend.createBuffer(
      'scene_uniforms',
      'uniform',
      sceneData,
      'dynamic_draw'
    );

    // Create bind group layout for scene uniforms (group 0)
    this.sceneBindGroupLayout = this.backend.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: ['vertex'],
          type: 'uniform',
        },
      ],
    });

    // Create bind group
    this.sceneBindGroup = this.backend.createBindGroup(this.sceneBindGroupLayout, {
      bindings: [{ binding: 0, resource: this.sceneUniformBuffer }],
    }) as any;
  }

  private handleDeviceLoss(): void {
    console.warn('HighLevelRenderer: Handling device loss');
    this.bindGroupPool.clear();
    this.bufferPool.handleDeviceLoss();
    // TODO: Reinitialize resources automatically
    // For now, user must manually recreate the renderer
  }
}
