/**
 * WebGPUBackend - Epic RENDERING-05 Task 5.3 Refactored Coordinator
 *
 * WebGPU implementation of IRendererBackend.
 * This is a lightweight coordinator that delegates to specialized modules.
 */

import { DEFAULT_VRAM_BUDGET_MB, ENABLE_VALIDATION } from '../constants/RenderingConstants.js';
import type {
  IRendererBackend,
  BackendConfig,
  BackendCapabilities,
  BackendShaderHandle,
  BackendBufferHandle,
  BackendTextureHandle,
  BackendFramebufferHandle,
  BackendSamplerHandle,
  BackendBindGroupLayoutHandle,
  BackendBindGroupHandle,
  BackendPipelineHandle,
  RenderPipelineDescriptor,
  ComputePipelineDescriptor,
  BindGroupResources,
} from './IRendererBackend';

import type {
  ShaderSource,
  RenderStats,
  BufferUsage,
  TextureFormat,
  TextureFilter,
  TextureWrap,
} from '../types';
import { VRAMProfiler, type VRAMStats } from '../VRAMProfiler';
import { GPUBufferPool } from '../GPUBufferPool';
import { BindGroupPool } from '../BindGroupPool';
import type { BindGroupLayoutDescriptor } from '../BindGroupDescriptors';
import { WGSLReflectionParser, ShaderReflectionCache, type ShaderReflectionData } from '../ShaderReflection';
import type { DrawCommand } from '../commands/DrawCommand';
import { DeviceRecoverySystem } from '../recovery/DeviceRecoverySystem';

// Import modules
import { WebGPUResourceManager } from './webgpu/WebGPUResourceManager';
import { WebGPUPipelineManager } from './webgpu/WebGPUPipelineManager';
import { WebGPUCommandEncoder } from './webgpu/WebGPUCommandEncoder';
import { WebGPUModernAPI } from './webgpu/WebGPUModernAPI';
import { WebGPURenderPassManager } from './webgpu/WebGPURenderPassManager';
import { WebGPUTimestampProfiler } from './webgpu/WebGPUTimestampProfiler';
import { initializeDeviceAndContext } from './webgpu/WebGPUDeviceInitializer';
import { initializeModules } from './webgpu/WebGPUModuleInitializer';
import type { WebGPUContext, ModuleConfig } from './webgpu/WebGPUTypes';

/**
 * Epic RENDERING-06 Task 6.4: Dependency injection interface
 * Allows injecting dependencies for testing
 */
export interface WebGPUBackendDependencies {
  vramProfiler?: VRAMProfiler;
  bufferPool?: GPUBufferPool;
  reflectionParser?: WGSLReflectionParser;
  reflectionCache?: ShaderReflectionCache;
}

/**
 * WebGPU backend coordinator
 * Delegates to specialized modules for resource management, pipeline caching, etc.
 *
 * Epic RENDERING-06 Task 6.4: Now supports dependency injection for testing
 */
export class WebGPUBackend implements IRendererBackend {
  readonly name = 'WebGPU';

  // Shared context
  private ctx: WebGPUContext = {
    device: null,
    canvas: null,
    context: null,
    preferredFormat: null,
    commandEncoder: null,
    currentPass: null,
    currentComputePass: null,
  };

  // Module configuration
  private vramProfiler: VRAMProfiler;
  private gpuBufferPool: GPUBufferPool;
  private reflectionParser: WGSLReflectionParser;
  private reflectionCache: ShaderReflectionCache;
  private recoverySystem: DeviceRecoverySystem | null = null;

  // Modules
  private resourceMgr!: WebGPUResourceManager;
  private pipelineMgr!: WebGPUPipelineManager;
  private commandEncoder!: WebGPUCommandEncoder;
  private modernAPI!: WebGPUModernAPI;
  private renderPassMgr!: WebGPURenderPassManager;

  // State
  private adapter: GPUAdapter | null = null;
  private config: BackendConfig | null = null;
  private stats: RenderStats = this.createEmptyStats();
  private selectedDepthFormat: GPUTextureFormat = 'depth24plus'; // Default to standard format for compatibility

  // GPU timestamp profiling for measuring actual GPU execution time
  private timestampProfiler: WebGPUTimestampProfiler | null = null;
  private hasTimestampQuery: boolean = false;

  /**
   * Epic RENDERING-06 Task 6.4: Constructor with dependency injection
   * @param dependencies - Optional dependencies for testing
   * @example
   * ```typescript
   * // Default usage (production)
   * const backend = new WebGPUBackend();
   *
   * // Testing usage with mocks
   * const backend = new WebGPUBackend({
   *   vramProfiler: mockProfiler,
   *   bufferPool: mockPool
   * });
   * ```
   */
  constructor(dependencies: WebGPUBackendDependencies = {}) {
    // Use injected dependencies or create defaults
    this.vramProfiler = dependencies.vramProfiler ||
      new VRAMProfiler(DEFAULT_VRAM_BUDGET_MB * 1024 * 1024);
    this.gpuBufferPool = dependencies.bufferPool ||
      new GPUBufferPool();
    this.reflectionParser = dependencies.reflectionParser ||
      new WGSLReflectionParser();
    this.reflectionCache = dependencies.reflectionCache ||
      new ShaderReflectionCache();
  }

  async initialize(config: BackendConfig): Promise<boolean> {
    this.config = config;

    if (!navigator.gpu) {
      console.error('WebGPU not supported in this browser');
      return false;
    }

    this.ctx.canvas = config.canvas;

    try {
      if (!await this.initializeDeviceAndContext(config)) {
        return false;
      }

      // Select depth format (optimize for VRAM by default)
      if (config.depthFormat) {
        this.selectedDepthFormat = config.depthFormat;
        console.log(`[WebGPUBackend] Using user-requested depth format: ${this.selectedDepthFormat}`);
      } else {
        this.selectedDepthFormat = 'depth16unorm'; // 50% VRAM savings vs depth24plus
        console.log(`[WebGPUBackend] Using optimized depth format: ${this.selectedDepthFormat} (50% VRAM savings)`);
      }

      // Initialize timestamp profiler
      this.timestampProfiler = new WebGPUTimestampProfiler(this.ctx, this.hasTimestampQuery);
      try {
        this.timestampProfiler.initialize();
      } catch (error) {
        console.warn('[WebGPUBackend] Failed to initialize timestamp queries:', error);
        this.hasTimestampQuery = false;
        this.timestampProfiler = null;
      }

      if (!this.ctx.canvas) {
        throw new Error('Canvas not available during initialization');
      }

      const moduleConfig = this.createModuleConfig();
      this.initializeModulesInternal(moduleConfig);
      // Depth texture now uses lazy allocation - created on-demand when needed
      // this.renderPassMgr.initializeDepthTexture(this.ctx.canvas.width, this.ctx.canvas.height);

      return true;
    } catch (error) {
      console.error('[WebGPUBackend] Failed to initialize WebGPU:', error);
      return false;
    }
  }

  getCapabilities(): BackendCapabilities {
    if (!this.ctx.device || !this.adapter) {
      throw new Error('WebGPU backend not initialized');
    }

    const limits = this.ctx.device.limits;

    return {
      compute: true,
      maxTextureSize: limits.maxTextureDimension2D,
      maxUniformBufferSize: limits.maxUniformBufferBindingSize,
      maxVertexAttributes: limits.maxVertexAttributes,
      maxColorAttachments: limits.maxColorAttachments,
      anisotropicFiltering: true,
      maxAnisotropy: 16,
      textureCompressionASTC: this.adapter.features.has('texture-compression-astc'),
      textureCompressionETC2: this.adapter.features.has('texture-compression-etc2'),
      textureCompressionBC: this.adapter.features.has('texture-compression-bc'),
    };
  }

  isContextLost(): boolean {
    return this.ctx.device === null;
  }

  async reinitialize(): Promise<void> {
    if (!this.config) {
      throw new Error('Cannot reinitialize: no previous config');
    }

    // Destroy resources
    this.renderPassMgr.dispose();
    this.resourceMgr.dispose();

    // Cleanup timestamp profiler
    this.timestampProfiler = null;

    // Reset pools
    this.gpuBufferPool.clear();

    // Clear context
    this.ctx.device = null;
    this.ctx.context = null;

    // Re-initialize
    const success = await this.initialize(this.config);
    if (!success) {
      throw new Error('Failed to reinitialize WebGPU device');
    }
  }

  beginFrame(): void {
    if (!this.ctx.device) {
      throw new Error('Cannot begin frame: WebGPU device not available');
    }

    this.gpuBufferPool.nextFrame();
    this.resetStats();

    // CRITICAL FIX (code-critic): Auto-clear cache to prevent stale GPU resource references
    // This prevents GPU crashes when resources are destroyed between frames
    this.commandEncoder.clearCache();

    this.ctx.commandEncoder = this.ctx.device.createCommandEncoder();
  }

  endFrame(): void {
    if (!this.ctx.device || !this.ctx.commandEncoder || !this.ctx.context) {
      return;
    }

    // BUG FIX: Do NOT call ensureDefaultRenderPass() here!
    // The composite pass already renders to swapchain. Calling ensureDefaultRenderPass()
    // creates a NEW render pass that clears the swapchain to black, overwriting the composite output.
    // this.ensureDefaultRenderPass();  // REMOVED

    this.renderPassMgr.endRenderPass();
    this.submitCommandBuffer();
  }

  /**
   * Ensure a default render pass exists (creates one if needed to clear screen)
   */
  private ensureDefaultRenderPass(): void {
    if (!this.ctx.currentPass && this.ctx.context) {
      const tSwapStart = performance.now();
      const textureView = this.ctx.context.getCurrentTexture().createView();
      const tSwapEnd = performance.now();
      const swapTime = tSwapEnd - tSwapStart;
      if (swapTime > 1.0) {
        console.warn(`⚠️ Slow swap chain acquisition: ${swapTime.toFixed(2)}ms`);
      }

      this.renderPassMgr.beginRenderPass(null, undefined, undefined, undefined, 'Default Pass', true);
    }
  }

  /**
   * Submit command buffer with optional timestamp query resolution
   */
  private submitCommandBuffer(): void {
    if (this.timestampProfiler?.isEnabled()) {
      this.timestampProfiler.resolveAndSubmit();
    } else {
      if (!this.ctx.device || !this.ctx.commandEncoder) return;
      const commandBuffer = this.ctx.commandEncoder.finish();
      this.ctx.device.queue.submit([commandBuffer]);
      this.ctx.commandEncoder = null;
    }
  }

  getGPUTime(): number {
    return this.timestampProfiler?.getGPUTime() ?? 0;
  }

  // Delegate to modules
  executeDrawCommand(command: DrawCommand): void {
    this.commandEncoder.executeDrawCommand(command);
  }

  beginRenderPass(
    target: BackendFramebufferHandle | null,
    clearColor?: [number, number, number, number],
    clearDepth?: number,
    clearStencil?: number,
    label?: string,
    requireDepth?: boolean
  ): void {
    this.renderPassMgr.beginRenderPass(target, clearColor, clearDepth, clearStencil, label, requireDepth);
  }

  endRenderPass(): void {
    this.renderPassMgr.endRenderPass();
  }

  // Epic RENDERING-06 Task 6.5: Expose cache API
  /**
   * Clear command encoder resource cache. Call each frame to prevent stale references.
   * Epic RENDERING-06 Task 6.5: Required for hot path optimization
   */
  clearCommandCache(): void {
    this.commandEncoder.clearCache();
  }

  /**
   * Get cache statistics for performance monitoring.
   * Cache hit rate should be >95% in typical scenes.
   * Epic RENDERING-06 Task 6.5: For performance measurement
   */
  getCommandCacheStats(): { hits: number; misses: number; hitRate: number } {
    return this.commandEncoder.getCacheStats();
  }

  clear(color?: [number, number, number, number], depth?: number, stencil?: number): void {
    this.renderPassMgr.clear(color, depth, stencil);
  }

  resize(width: number, height: number): void {
    this.renderPassMgr.resize(width, height);
  }

  getStats(): Readonly<RenderStats> {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = this.createEmptyStats();
  }

  getVRAMStats(): VRAMStats {
    return this.vramProfiler.getStats();
  }

  getVRAMProfiler(): VRAMProfiler {
    return this.vramProfiler;
  }

  // Resource Management - Delegate to ResourceManager
  createShader(id: string, source: ShaderSource): BackendShaderHandle {
    return this.resourceMgr.createShader(id, source);
  }

  deleteShader(handle: BackendShaderHandle): void {
    // No shader-specific cleanup needed, just remove from map
  }

  createBuffer(
    id: string,
    type: 'vertex' | 'index' | 'uniform' | 'storage',
    data: ArrayBuffer | ArrayBufferView,
    usage: BufferUsage
  ): BackendBufferHandle {
    const dataArray = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer);
    return this.resourceMgr.createBuffer(id, dataArray, usage, 'dynamic', type);
  }

  updateBuffer(
    handle: BackendBufferHandle,
    data: ArrayBuffer | ArrayBufferView,
    offset: number = 0
  ): void {
    const dataArray = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer);
    this.resourceMgr.updateBuffer(handle, dataArray, offset);
  }

  deleteBuffer(handle: BackendBufferHandle): void {
    this.resourceMgr.destroyBuffer(handle);
  }

  createTexture(
    id: string,
    width: number,
    height: number,
    data: ArrayBufferView | HTMLImageElement | HTMLCanvasElement | ImageData | null,
    config: {
      format: TextureFormat;
      minFilter?: TextureFilter;
      magFilter?: TextureFilter;
      wrapS?: TextureWrap;
      wrapT?: TextureWrap;
      generateMipmaps?: boolean;
    }
  ): BackendTextureHandle {
    // Check if data is ArrayBufferView (Uint8Array, Float32Array, etc.)
    const dataView = (data && ArrayBuffer.isView(data)) ? data : undefined;
    return this.resourceMgr.createTexture(id, width, height, config.format, dataView);
  }

  deleteTexture(handle: BackendTextureHandle): void {
    this.resourceMgr.destroyTexture(handle);
  }

  createDepthTexture(
    id: string,
    width: number,
    height: number
  ): BackendTextureHandle {
    return this.resourceMgr.createDepthTexture(id, width, height);
  }

  createFramebuffer(
    id: string,
    colorAttachments: BackendTextureHandle[],
    depthAttachment?: BackendTextureHandle
  ): BackendFramebufferHandle {
    if (colorAttachments.length === 0) {
      throw new Error('createFramebuffer requires at least one color attachment');
    }

    return this.resourceMgr.createFramebuffer(
      id,
      colorAttachments,
      depthAttachment
    );
  }

  deleteFramebuffer(handle: BackendFramebufferHandle): void {
    this.resourceMgr.destroyFramebuffer(handle);
  }

  createSampler(
    id: string,
    config: {
      minFilter?: 'nearest' | 'linear';
      magFilter?: 'nearest' | 'linear';
      wrapS?: 'repeat' | 'clamp' | 'mirror';
      wrapT?: 'repeat' | 'clamp' | 'mirror';
    }
  ): BackendSamplerHandle {
    return this.resourceMgr.createSampler(id, config);
  }

  deleteSampler(handle: BackendSamplerHandle): void {
    this.resourceMgr.destroySampler(handle);
  }

  // Modern API - Delegate to ModernAPI
  createBindGroupLayout(descriptor: BindGroupLayoutDescriptor): BackendBindGroupLayoutHandle {
    return this.modernAPI.createBindGroupLayout(descriptor);
  }

  deleteBindGroupLayout(handle: BackendBindGroupLayoutHandle): void {
    this.modernAPI.deleteBindGroupLayout(handle);
  }

  createBindGroup(
    layout: BackendBindGroupLayoutHandle,
    resources: BindGroupResources
  ): BackendBindGroupHandle {
    return this.modernAPI.createBindGroup(layout, resources);
  }

  deleteBindGroup(handle: BackendBindGroupHandle): void {
    this.modernAPI.deleteBindGroup(handle);
  }

  createRenderPipeline(descriptor: RenderPipelineDescriptor): BackendPipelineHandle {
    return this.modernAPI.createRenderPipeline(descriptor);
  }

  createComputePipeline(descriptor: ComputePipelineDescriptor): BackendPipelineHandle {
    return this.modernAPI.createComputePipeline(descriptor);
  }

  deletePipeline(handle: BackendPipelineHandle): void {
    this.modernAPI.deletePipeline(handle);
  }

  createShaderWithReflection(
    id: string,
    source: ShaderSource
  ): { handle: BackendShaderHandle; reflection: ShaderReflectionData } {
    const handle = this.resourceMgr.createShader(id, source);
    const reflection = this.reflectionCache.getOrCompute(source.vertex || source.fragment || '', this.reflectionParser);
    return { handle, reflection };
  }

  dispatchCompute(
    pipeline: BackendPipelineHandle,
    workgroupsX: number,
    workgroupsY: number,
    workgroupsZ: number
  ): void {
    console.warn('dispatchCompute not yet implemented in refactored backend');
  }

  dispose(): void {
    this.renderPassMgr.dispose();
    this.resourceMgr.dispose();

    // Cleanup profiler
    this.timestampProfiler = null;

    this.gpuBufferPool.clear();
    this.reflectionCache.clear();

    if (this.ctx.device) {
      this.ctx.device.destroy();
      this.ctx.device = null;
    }

    this.ctx.context = null;
    this.ctx.canvas = null;
    this.adapter = null;
  }

  /**
   * Initialize WebGPU device and canvas context
   */
  private async initializeDeviceAndContext(config: BackendConfig): Promise<boolean> {
    const result = await initializeDeviceAndContext(this.ctx, config);

    if (!result.success) {
      return false;
    }

    this.adapter = result.adapter;
    this.hasTimestampQuery = result.hasTimestampQuery;
    return true;
  }


  /**
   * Create module configuration shared by all WebGPU modules
   */
  private createModuleConfig(): ModuleConfig {
    return {
      vramProfiler: this.vramProfiler,
      bufferPool: this.gpuBufferPool,
      bindGroupPool: null as any, // Will be created during module initialization
      recoverySystem: null, // Will be set during module initialization
      reflectionParser: this.reflectionParser,
      reflectionCache: this.reflectionCache,
      enableValidation: this.config?.enableValidation ?? ENABLE_VALIDATION,
      depthFormat: this.selectedDepthFormat,
    };
  }

  /**
   * Initialize all WebGPU rendering modules in correct dependency order
   */
  private initializeModulesInternal(moduleConfig: ModuleConfig): void {
    const modules = initializeModules(this.ctx, this, moduleConfig);

    this.resourceMgr = modules.resourceMgr;
    this.pipelineMgr = modules.pipelineMgr;
    this.commandEncoder = modules.commandEncoder;
    this.modernAPI = modules.modernAPI;
    this.renderPassMgr = modules.renderPassMgr;
    this.recoverySystem = modules.recoverySystem;

    // Update module config with recovery system for other modules to use
    moduleConfig.recoverySystem = this.recoverySystem;
  }

  private createEmptyStats(): RenderStats {
    return {
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      batches: 0,
      shaderSwitches: 0,
      textureBinds: 0,
      stateChanges: 0,
      frameTime: 0,
    };
  }

  getDepthFormat(): GPUTextureFormat {
    return this.selectedDepthFormat;
  }

  getDevice(): GPUDevice {
    if (!this.ctx.device) {
      throw new Error('WebGPU device not initialized');
    }
    return this.ctx.device;
  }
}
