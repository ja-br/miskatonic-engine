/**
 * WebGPUBackend - Epic RENDERING-05 Task 5.3 Refactored Coordinator
 *
 * WebGPU implementation of IRendererBackend.
 * This is a lightweight coordinator that delegates to specialized modules.
 */

import { DEFAULT_VRAM_BUDGET_MB } from '../constants/RenderingConstants.js';
import type {
  IRendererBackend,
  BackendConfig,
  BackendCapabilities,
  BackendShaderHandle,
  BackendBufferHandle,
  BackendTextureHandle,
  BackendFramebufferHandle,
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
import type { WebGPUContext, ModuleConfig } from './webgpu/WebGPUTypes';

/**
 * WebGPU backend coordinator
 * Delegates to specialized modules for resource management, pipeline caching, etc.
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
  private gpuBufferPool = new GPUBufferPool();
  private reflectionParser = new WGSLReflectionParser();
  private reflectionCache = new ShaderReflectionCache();
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

  // GPU timestamp queries for measuring actual GPU execution time
  private timestampQuerySet: GPUQuerySet | null = null;
  private timestampBuffer: GPUBuffer | null = null;
  private timestampReadBuffers: GPUBuffer[] = [];
  private currentReadBufferIndex: number = 0;
  private gpuTimeMs: number = 0;
  private hasTimestampQuery: boolean = false;
  private pendingTimestampReads: Set<GPUBuffer> = new Set();

  constructor() {
    this.vramProfiler = new VRAMProfiler(DEFAULT_VRAM_BUDGET_MB * 1024 * 1024);
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

      try {
        this.initializeTimestampQueries();
      } catch (error) {
        console.warn('[WebGPUBackend] Failed to initialize timestamp queries:', error);
        this.hasTimestampQuery = false; // Prevent usage of uninitialized resources
      }

      if (!this.ctx.canvas) {
        throw new Error('Canvas not available during initialization');
      }

      const moduleConfig = this.createModuleConfig();
      this.initializeModules(moduleConfig);
      this.renderPassMgr.initializeDepthTexture(this.ctx.canvas.width, this.ctx.canvas.height);

      this.initializeDeviceRecovery(moduleConfig);

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

    // Cancel all pending timestamp reads before destroying buffers
    for (const buffer of this.pendingTimestampReads) {
      try {
        buffer.unmap();
      } catch (e) {
        // Buffer may not be mapped, that's ok
      }
    }
    this.pendingTimestampReads.clear();

    if (this.timestampQuerySet) this.timestampQuerySet.destroy();
    if (this.timestampBuffer) this.timestampBuffer.destroy();
    for (const buffer of this.timestampReadBuffers) buffer.destroy();

    this.timestampQuerySet = null;
    this.timestampBuffer = null;
    this.timestampReadBuffers = [];

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
    this.ctx.commandEncoder = this.ctx.device.createCommandEncoder();
  }

  endFrame(): void {
    if (!this.ctx.device || !this.ctx.commandEncoder || !this.ctx.context) {
      return;
    }

    this.ensureDefaultRenderPass();
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

      this.renderPassMgr.beginRenderPass(null, undefined, undefined, undefined, 'Default Pass');
    }
  }

  /**
   * Submit command buffer with optional timestamp query resolution
   */
  private submitCommandBuffer(): void {
    if (!this.ctx.device || !this.ctx.commandEncoder) return;

    if (this.hasTimestampQuery && this.timestampQuerySet && this.timestampBuffer && this.timestampReadBuffers.length > 0) {
      this.resolveAndSubmitWithTimestamps();
    } else {
      const commandBuffer = this.ctx.commandEncoder.finish();
      this.ctx.device.queue.submit([commandBuffer]);
      this.ctx.commandEncoder = null;
    }
  }

  /**
   * Resolve timestamp queries and submit command buffer
   */
  private resolveAndSubmitWithTimestamps(): void {
    if (!this.ctx.device || !this.ctx.commandEncoder || !this.timestampQuerySet || !this.timestampBuffer) {
      // Fallback to simple submit if resources not available
      if (this.ctx.device && this.ctx.commandEncoder) {
        const commandBuffer = this.ctx.commandEncoder.finish();
        this.ctx.device.queue.submit([commandBuffer]);
        this.ctx.commandEncoder = null;
      }
      return;
    }

    this.ctx.commandEncoder.resolveQuerySet(
      this.timestampQuerySet,
      0,
      2,
      this.timestampBuffer,
      0
    );

    const targetBuffer = this.findAvailableTimestampBuffer();

    if (targetBuffer) {
      this.ctx.commandEncoder.copyBufferToBuffer(
        this.timestampBuffer,
        0,
        targetBuffer,
        0,
        16
      );

      const commandBuffer = this.ctx.commandEncoder.finish();
      this.ctx.device.queue.submit([commandBuffer]);
      this.ctx.commandEncoder = null;

      this.pendingTimestampReads.add(targetBuffer);
      this.readTimestamps(targetBuffer);
    } else {
      const commandBuffer = this.ctx.commandEncoder.finish();
      this.ctx.device.queue.submit([commandBuffer]);
      this.ctx.commandEncoder = null;
    }
  }

  /**
   * Find next available timestamp read buffer
   */
  private findAvailableTimestampBuffer(): GPUBuffer | null {
    for (let i = 0; i < this.timestampReadBuffers.length; i++) {
      const bufferIndex = (this.currentReadBufferIndex + i) % this.timestampReadBuffers.length;
      const buffer = this.timestampReadBuffers[bufferIndex];
      if (!this.pendingTimestampReads.has(buffer)) {
        this.currentReadBufferIndex = (bufferIndex + 1) % this.timestampReadBuffers.length;
        return buffer;
      }
    }
    return null;
  }

  private async readTimestamps(buffer: GPUBuffer): Promise<void> {
    try {
      await buffer.mapAsync(GPUMapMode.READ);
      const arrayBuffer = buffer.getMappedRange();
      const timestamps = new BigUint64Array(arrayBuffer);
      const gpuTimeNs = Number(timestamps[1] - timestamps[0]);
      this.gpuTimeMs = gpuTimeNs / 1_000_000;
    } catch (error) {
      if (Math.random() < 0.01) {
        console.warn('Timestamp read failed (expected occasionally):', error);
      }
    } finally {
      try {
        buffer.unmap();
      } catch (e) {
        // Buffer might not be mapped
      }
      this.pendingTimestampReads.delete(buffer);
    }
  }

  getGPUTime(): number {
    return this.gpuTimeMs;
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
    label?: string
  ): void {
    this.renderPassMgr.beginRenderPass(target, clearColor, clearDepth, clearStencil, label);
  }

  endRenderPass(): void {
    this.renderPassMgr.endRenderPass();
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

  updateTexture(
    handle: BackendTextureHandle,
    data: ArrayBufferView | HTMLImageElement | HTMLCanvasElement | ImageData,
    x: number = 0,
    y: number = 0,
    width?: number,
    height?: number
  ): void {
    // TODO: Implement texture updates in ResourceManager
    console.warn('updateTexture not yet implemented in refactored backend');
  }

  deleteTexture(handle: BackendTextureHandle): void {
    this.resourceMgr.destroyTexture(handle);
  }

  createFramebuffer(
    id: string,
    colorAttachments: BackendTextureHandle[],
    depthAttachment?: BackendTextureHandle
  ): BackendFramebufferHandle {
    // TODO: Get dimensions from first color attachment
    const width = 800; // Placeholder
    const height = 600; // Placeholder
    return this.resourceMgr.createFramebuffer(id, width, height, colorAttachments, depthAttachment);
  }

  deleteFramebuffer(handle: BackendFramebufferHandle): void {
    this.resourceMgr.destroyFramebuffer(handle);
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

    if (this.timestampQuerySet) this.timestampQuerySet.destroy();
    if (this.timestampBuffer) this.timestampBuffer.destroy();
    for (const buffer of this.timestampReadBuffers) buffer.destroy();

    this.timestampReadBuffers = [];
    this.pendingTimestampReads.clear();

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
    // Request adapter
    this.adapter = await navigator.gpu.requestAdapter({
      powerPreference: (config.powerPreference ?? 'high-performance') as GPUPowerPreference,
    });

    if (!this.adapter) {
      console.error('Failed to get WebGPU adapter');
      return false;
    }

    // Check for timestamp-query support
    const requiredFeatures: GPUFeatureName[] = [];
    if (this.adapter.features.has('timestamp-query')) {
      requiredFeatures.push('timestamp-query');
      this.hasTimestampQuery = true;
      console.log('WebGPU: timestamp-query feature available');
    } else {
      console.warn('WebGPU: timestamp-query not available, GPU timing will not be measured');
    }

    // Request device
    this.ctx.device = await this.adapter.requestDevice({
      requiredFeatures,
    });

    // Add WebGPU error handler
    this.ctx.device.addEventListener('uncapturederror', (event: GPUUncapturedErrorEvent) => {
      console.error('🚨 WebGPU Uncaptured Error:', event.error);
      console.error('   Type:', event.error.constructor.name);
      console.error('   Message:', event.error.message);
      if ('lineNum' in event.error) {
        console.error('   Line:', (event.error as any).lineNum);
      }
    });

    // Configure canvas context
    this.ctx.context = this.ctx.canvas!.getContext('webgpu');
    if (!this.ctx.context) {
      console.error('Failed to get WebGPU context');
      return false;
    }

    this.ctx.preferredFormat = navigator.gpu.getPreferredCanvasFormat();

    this.ctx.context.configure({
      device: this.ctx.device,
      format: this.ctx.preferredFormat,
      alphaMode: config.alpha ? 'premultiplied' : 'opaque',
    });

    return true;
  }

  /**
   * Initialize GPU timestamp query resources for performance profiling
   */
  private initializeTimestampQueries(): void {
    if (!this.hasTimestampQuery || !this.ctx.device) return;

    this.timestampQuerySet = this.ctx.device.createQuerySet({
      type: 'timestamp',
      count: 2,
    });

    this.timestampBuffer = this.ctx.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });

    for (let i = 0; i < 3; i++) {
      this.timestampReadBuffers.push(this.ctx.device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      }));
    }
  }

  /**
   * Create module configuration shared by all WebGPU modules
   */
  private createModuleConfig(): ModuleConfig {
    return {
      vramProfiler: this.vramProfiler,
      bufferPool: this.gpuBufferPool,
      bindGroupPool: new BindGroupPool(this.ctx.device!),
      recoverySystem: null, // Set after creating recovery system
      reflectionParser: this.reflectionParser,
      reflectionCache: this.reflectionCache,
      enableValidation: false, // TODO: Add debug flag to BackendConfig
    };
  }

  /**
   * Initialize all WebGPU rendering modules
   *
   * IMPORTANT: Order matters - modernAPI must be created before commandEncoder
   * because commandEncoder depends on modernAPI callbacks.
   */
  private initializeModules(moduleConfig: ModuleConfig): void {
    // Step 1: Resource management (no dependencies)
    this.resourceMgr = new WebGPUResourceManager(this.ctx, moduleConfig);

    // Step 2: Pipeline management (depends on resourceMgr)
    this.pipelineMgr = new WebGPUPipelineManager(this.ctx, (id) => this.resourceMgr.getShader(id));

    // Step 3: Modern API (depends on resourceMgr) - MUST come before commandEncoder
    this.modernAPI = new WebGPUModernAPI(
      this.ctx,
      (id) => this.resourceMgr.getShader(id),
      (id) => this.resourceMgr.getBuffer(id),
      (id) => this.resourceMgr.getTexture(id),
      moduleConfig
    );

    // Step 4: Command encoder (depends on resourceMgr AND modernAPI)
    this.commandEncoder = new WebGPUCommandEncoder(
      this.ctx,
      (id) => this.resourceMgr.getBuffer(id),
      (id) => this.modernAPI.getBindGroup(id), // No longer using optional chaining - modernAPI is guaranteed initialized
      (id) => this.modernAPI.getPipeline(id),  // No longer using optional chaining - modernAPI is guaranteed initialized
      this.stats
    );

    // Step 5: Render pass management (depends on resourceMgr, vramProfiler)
    this.renderPassMgr = new WebGPURenderPassManager(
      this.ctx,
      (id) => this.resourceMgr.getFramebuffer(id),
      this.vramProfiler
    );
  }

  /**
   * Initialize device recovery system for handling GPU device loss
   */
  private initializeDeviceRecovery(moduleConfig: ModuleConfig): void {
    this.recoverySystem = new DeviceRecoverySystem(this, {
      maxRetries: 3,
      retryDelay: 1000,
      logProgress: true
    });

    this.recoverySystem.initializeDetector(this.ctx.device!);

    this.recoverySystem.onRecovery((progress) => {
      if (progress.phase === 'detecting') {
        console.warn(`[WebGPUBackend] Device loss detected, beginning recovery...`);
      } else if (progress.phase === 'complete') {
        console.log(`[WebGPUBackend] Device recovery complete - ${progress.resourcesRecreated} resources recreated`);
        if (this.ctx.device && this.recoverySystem) {
          this.recoverySystem.initializeDetector(this.ctx.device);
        }
      } else if (progress.phase === 'failed') {
        console.error(`[WebGPUBackend] Device recovery failed:`, progress.error);
      }
    });

    // Update module config with recovery system
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

  getDevice(): GPUDevice {
    if (!this.ctx.device) {
      throw new Error('WebGPU device not initialized');
    }
    return this.ctx.device;
  }
}
