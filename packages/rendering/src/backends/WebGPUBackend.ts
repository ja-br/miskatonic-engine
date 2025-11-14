/**
 * WebGPUBackend - Epic 3.2
 *
 * WebGPU implementation of IRendererBackend.
 * Modern, next-generation graphics API with compute shader support.
 *
 * Note: This is an initial implementation. Full feature parity with WebGL2Backend
 * will require additional work for shader transpilation, complex render passes, etc.
 */

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
  VertexLayout,
} from '../types';
import { VRAMProfiler, VRAMCategory, type VRAMStats } from '../VRAMProfiler';
import { GPUBufferPool, BufferUsageType } from '../GPUBufferPool';
import type { BindGroupLayoutDescriptor } from '../BindGroupDescriptors';
import { WGSLReflectionParser, ShaderReflectionCache, type ShaderReflectionData } from '../ShaderReflection';
import type { DrawCommand } from '../commands/DrawCommand';
import { isIndexedGeometry, isNonIndexedGeometry, isIndirectGeometry, isComputeGeometry } from '../commands/DrawCommand';
import { DeviceRecoverySystem } from '../recovery/DeviceRecoverySystem';
import { ResourceType } from '../recovery/ResourceRegistry';
import type { BufferDescriptor, TextureDescriptor, ShaderDescriptor } from '../recovery/ResourceRegistry';


/**
 * WebGPU resource wrappers
 */
interface WebGPUShader {
  id: string;
  shaderModule: GPUShaderModule; // Epic 3.13: Store shader module for pipeline variants
  bindGroupLayout: GPUBindGroupLayout;
}

/**
 * Pipeline cache entry - Epic 3.13
 */
interface PipelineCacheEntry {
  pipeline: GPURenderPipeline;
  vertexLayoutHash: string;
}

interface WebGPUBuffer {
  id: string;
  buffer: GPUBuffer;
  type: 'vertex' | 'index' | 'uniform' | 'storage'; // Epic 3.14: Added storage
  size: number;
  pooled: boolean; // Epic 3.8: Track if buffer came from pool
  bufferUsageType?: BufferUsageType; // Epic 3.8: For releasing back to pool
  requestedSize?: number; // Epic 3.8: Original requested size for pooling
}

interface WebGPUTexture {
  id: string;
  texture: GPUTexture;
  view: GPUTextureView;
  width: number;
  height: number;
}

interface WebGPUFramebuffer {
  id: string;
  colorTextures: GPUTextureView[];
  depthTexture?: GPUTextureView;
}

/**
 * WebGPU backend implementation
 */
export class WebGPUBackend implements IRendererBackend {
  readonly name = 'WebGPU';

  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private adapter: GPUAdapter | null = null;
  private preferredFormat: GPUTextureFormat = 'bgra8unorm';

  // Resource storage
  private shaders = new Map<string, WebGPUShader>();
  private buffers = new Map<string, WebGPUBuffer>();
  private textures = new Map<string, WebGPUTexture>();
  private framebuffers = new Map<string, WebGPUFramebuffer>();

  // Epic 3.14: Modern API resource storage
  private bindGroupLayouts = new Map<string, GPUBindGroupLayout>();
  private bindGroups = new Map<string, GPUBindGroup>();
  private pipelines = new Map<string, { pipeline: GPURenderPipeline | GPUComputePipeline; type: 'render' | 'compute' }>();
  private nextResourceId = 0;

  // Epic 3.13: Pipeline cache for (shader, vertexLayout) variants
  private pipelineCache = new Map<string, PipelineCacheEntry>();

  // Epic 3.8 & 3.14: Performance optimizations
  private gpuBufferPool = new GPUBufferPool(); // Epic 3.8: GPU buffer pooling
  private vramProfiler: VRAMProfiler;

  // GPU timestamp queries for measuring actual GPU execution time
  private timestampQuerySet: GPUQuerySet | null = null;
  private timestampBuffer: GPUBuffer | null = null;
  private timestampReadBuffers: GPUBuffer[] = []; // Triple buffering for safe async reads
  private currentReadBufferIndex: number = 0;
  private gpuTimeMs: number = 0; // Last measured GPU time in milliseconds
  private hasTimestampQuery: boolean = false;
  private pendingTimestampReads: Set<GPUBuffer> = new Set(); // Track which buffers are busy

  // Render state
  private currentRenderPass: GPURenderPassEncoder | null = null;
  private currentCommandEncoder: GPUCommandEncoder | null = null;
  private depthTexture: GPUTexture | null = null;
  private stats: RenderStats = this.createEmptyStats();

  // Epic 3.14: Shader reflection system
  private reflectionParser = new WGSLReflectionParser();
  private reflectionCache = new ShaderReflectionCache();

  // Epic RENDERING-04: Device recovery system
  private recoverySystem: DeviceRecoverySystem | null = null;
  private config: BackendConfig | null = null; // Store for reinitialize

  constructor() {
    // Initialize VRAM profiler with 256MB budget (typical for integrated GPUs)
    this.vramProfiler = new VRAMProfiler(256 * 1024 * 1024);
  }

  async initialize(config: BackendConfig): Promise<boolean> {
    // Store config for reinitialize() (Epic RENDERING-04)
    this.config = config;

    // Check if WebGPU is available
    if (!navigator.gpu) {
      console.error('WebGPU not supported in this browser');
      return false;
    }

    this.canvas = config.canvas;

    try {
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
      this.device = await this.adapter.requestDevice({
        requiredFeatures,
      });

      // Add WebGPU error handler (CRITICAL for debugging)
      this.device.addEventListener('uncapturederror', (event: GPUUncapturedErrorEvent) => {
        console.error('🚨 WebGPU Uncaptured Error:', event.error);
        console.error('   Type:', event.error.constructor.name);
        console.error('   Message:', event.error.message);
        if ('lineNum' in event.error) {
          console.error('   Line:', (event.error as any).lineNum);
        }
      });

      // Configure canvas context
      this.context = this.canvas.getContext('webgpu');
      if (!this.context) {
        console.error('Failed to get WebGPU context');
        return false;
      }

      this.preferredFormat = navigator.gpu.getPreferredCanvasFormat();

      this.context.configure({
        device: this.device,
        format: this.preferredFormat,
        alphaMode: config.alpha ? 'premultiplied' : 'opaque',
        // Note: presentMode removed as it's not in the stable WebGPU spec
      });

      // Create depth texture
      this.depthTexture = this.device.createTexture({
        size: {
          width: this.canvas.width,
          height: this.canvas.height,
        },
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });

      // Create timestamp query resources if supported
      if (this.hasTimestampQuery) {
        this.timestampQuerySet = this.device.createQuerySet({
          type: 'timestamp',
          count: 2, // Start and end of render pass
        });

        this.timestampBuffer = this.device.createBuffer({
          size: 16, // 2 timestamps × 8 bytes each
          usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
        });

        // Triple buffering: create 3 read buffers for safe async reads
        // This prevents "buffer used in submit while mapped" errors
        for (let i = 0; i < 3; i++) {
          this.timestampReadBuffers.push(this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
          }));
        }
      }

      // Epic RENDERING-04: Initialize device recovery system
      this.recoverySystem = new DeviceRecoverySystem(this, {
        maxRetries: 3,
        retryDelay: 1000,
        logProgress: true
      });

      this.recoverySystem.initializeDetector(this.device);

      this.recoverySystem.onRecovery((progress) => {
        if (progress.phase === 'detecting') {
          console.warn(`[WebGPUBackend] Device loss detected, beginning recovery...`);
        } else if (progress.phase === 'complete') {
          console.log(`[WebGPUBackend] Device recovery complete - ${progress.resourcesRecreated} resources recreated`);
          // Reinitialize detector with new device
          if (this.device && this.recoverySystem) {
            this.recoverySystem.initializeDetector(this.device);
          }
        } else if (progress.phase === 'failed') {
          console.error(`[WebGPUBackend] Device recovery failed:`, progress.error);
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      return false;
    }
  }

  getCapabilities(): BackendCapabilities {
    if (!this.device || !this.adapter) {
      throw new Error('WebGPU backend not initialized');
    }

    const limits = this.device.limits;

    return {
      compute: true, // WebGPU supports compute shaders
      maxTextureSize: limits.maxTextureDimension2D,
      maxUniformBufferSize: limits.maxUniformBufferBindingSize,
      maxVertexAttributes: limits.maxVertexAttributes,
      maxColorAttachments: limits.maxColorAttachments,
      anisotropicFiltering: true,
      maxAnisotropy: 16, // WebGPU supports up to 16x anisotropy
      textureCompressionASTC: this.adapter.features.has('texture-compression-astc'),
      textureCompressionETC2: this.adapter.features.has('texture-compression-etc2'),
      textureCompressionBC: this.adapter.features.has('texture-compression-bc'),
    };
  }

  isContextLost(): boolean {
    return this.device === null;
  }

  /**
   * Reinitialize backend after device loss (Epic RENDERING-04)
   */
  async reinitialize(): Promise<void> {
    if (!this.config) {
      throw new Error('Cannot reinitialize: no previous config');
    }

    // CRITICAL: Destroy GPU resources before clearing maps to prevent VRAM leak
    // Note: Device is already lost, but we still need to call destroy() for cleanup

    if (this.depthTexture) {
      this.depthTexture.destroy();
      this.depthTexture = null;
    }

    if (this.timestampQuerySet) {
      this.timestampQuerySet.destroy();
      this.timestampQuerySet = null;
    }

    if (this.timestampBuffer) {
      this.timestampBuffer.destroy();
      this.timestampBuffer = null;
    }

    for (const buffer of this.timestampReadBuffers) {
      buffer.destroy();
    }
    this.timestampReadBuffers = [];

    // Destroy all buffers in maps (skip pooled ones - pool will handle them)
    for (const bufferData of this.buffers.values()) {
      if (!bufferData.pooled) {
        bufferData.buffer.destroy();
      }
    }

    // Destroy all textures
    for (const textureData of this.textures.values()) {
      textureData.texture.destroy();
    }

    // Clear old device references (already lost)
    this.device = null;
    this.context = null;

    // Clear all resource maps
    this.buffers.clear();
    this.textures.clear();
    this.shaders.clear();
    this.framebuffers.clear();
    this.bindGroupLayouts.clear();
    this.bindGroups.clear();
    this.pipelines.clear();

    // Reset pools (will destroy pooled buffers internally)
    this.gpuBufferPool.clear();

    // Re-initialize with original config
    const success = await this.initialize(this.config);

    if (!success) {
      throw new Error('Failed to reinitialize WebGPU device');
    }
  }

  beginFrame(): void {
    if (!this.device) {
      throw new Error('Cannot begin frame: WebGPU device not available');
    }

    // Epic 3.14: Advance frame counters at START of frame to avoid off-by-one errors
    this.gpuBufferPool.nextFrame();

    this.resetStats();
    this.currentCommandEncoder = this.device.createCommandEncoder();
  }

  endFrame(): void {
    if (!this.device || !this.currentCommandEncoder || !this.context) {
      return;
    }

    // If no render pass was created (no draw commands), create one just to clear the screen
    if (!this.currentRenderPass) {
      const tSwapStart = performance.now();
      const textureView = this.context.getCurrentTexture().createView();
      const tSwapEnd = performance.now();
      const swapTime = tSwapEnd - tSwapStart;
      if (swapTime > 1.0) {
        console.warn(`⚠️ Slow swap chain acquisition: ${swapTime.toFixed(2)}ms`);
      }

      const depthView = this.depthTexture?.createView();

      this.currentRenderPass = this.currentCommandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
        depthStencilAttachment: depthView ? {
          view: depthView,
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
        } : undefined,
        timestampWrites: this.hasTimestampQuery && this.timestampQuerySet ? {
          querySet: this.timestampQuerySet,
          beginningOfPassWriteIndex: 0,
          endOfPassWriteIndex: 1,
        } : undefined,
      });
    }

    // End any active render pass
    if (this.currentRenderPass) {
      this.currentRenderPass.end();
      this.currentRenderPass = null;
    }

    // Resolve timestamp queries if available
    if (this.hasTimestampQuery && this.timestampQuerySet && this.timestampBuffer && this.timestampReadBuffers.length > 0) {
      this.currentCommandEncoder.resolveQuerySet(
        this.timestampQuerySet,
        0, // first query
        2, // query count
        this.timestampBuffer,
        0  // destination offset
      );

      // Use round-robin buffer selection with triple buffering
      // Find a buffer that's not currently being read
      let targetBuffer: GPUBuffer | null = null;
      for (let i = 0; i < this.timestampReadBuffers.length; i++) {
        const bufferIndex = (this.currentReadBufferIndex + i) % this.timestampReadBuffers.length;
        const buffer = this.timestampReadBuffers[bufferIndex];
        if (!this.pendingTimestampReads.has(buffer)) {
          targetBuffer = buffer;
          this.currentReadBufferIndex = (bufferIndex + 1) % this.timestampReadBuffers.length;
          break;
        }
      }

      // Copy to the selected buffer (if one is available)
      if (targetBuffer) {
        this.currentCommandEncoder.copyBufferToBuffer(
          this.timestampBuffer,
          0,
          targetBuffer,
          0,
          16
        );

        // Submit commands
        const tSubmitStart = performance.now();
        const commandBuffer = this.currentCommandEncoder.finish();
        this.device.queue.submit([commandBuffer]);
        const tSubmitEnd = performance.now();
        const submitTime = tSubmitEnd - tSubmitStart;

        this.currentCommandEncoder = null;

        // Start async read on the target buffer
        this.pendingTimestampReads.add(targetBuffer);
        this.readTimestamps(targetBuffer);

        // Log slow submits
        if (submitTime > 2.0) {
          console.warn(`⚠️ Slow queue.submit(): ${submitTime.toFixed(2)}ms`);
        }
      } else {
        // All buffers busy - skip this frame's timestamp read
        const tSubmitStart = performance.now();
        const commandBuffer = this.currentCommandEncoder.finish();
        this.device.queue.submit([commandBuffer]);
        const tSubmitEnd = performance.now();
        const submitTime = tSubmitEnd - tSubmitStart;
        this.currentCommandEncoder = null;

        if (submitTime > 2.0) {
          console.warn(`⚠️ Slow queue.submit(): ${submitTime.toFixed(2)}ms`);
        }
      }
    } else {
      // No timestamp queries - just submit
      const tSubmitStart = performance.now();
      const commandBuffer = this.currentCommandEncoder.finish();
      this.device.queue.submit([commandBuffer]);
      const tSubmitEnd = performance.now();
      const submitTime = tSubmitEnd - tSubmitStart;
      this.currentCommandEncoder = null;

      if (submitTime > 2.0) {
        console.warn(`⚠️ Slow queue.submit(): ${submitTime.toFixed(2)}ms`);
      }
    }

    // Note: nextFrame() moved to beginFrame() to avoid off-by-one frame tracking errors
  }

  /**
   * Read timestamp query results asynchronously
   * Uses triple buffering to avoid race conditions
   */
  private async readTimestamps(buffer: GPUBuffer): Promise<void> {
    try {
      await buffer.mapAsync(GPUMapMode.READ);
      const arrayBuffer = buffer.getMappedRange();
      const timestamps = new BigUint64Array(arrayBuffer);

      // Calculate GPU time in nanoseconds, then convert to milliseconds
      const gpuTimeNs = Number(timestamps[1] - timestamps[0]);
      this.gpuTimeMs = gpuTimeNs / 1_000_000;
    } catch (error) {
      // Log occasional failures for debugging (1% sampling)
      if (Math.random() < 0.01) {
        console.warn('Timestamp read failed (expected occasionally):', error);
      }
    } finally {
      // CRITICAL: Always unmap and remove from busy set
      // Buffer must be unmapped before it can be used in another submit
      try {
        buffer.unmap();
      } catch (e) {
        // Buffer might not be mapped if mapAsync failed
      }
      // Mark this buffer as available again
      this.pendingTimestampReads.delete(buffer);
    }
  }

  /**
   * Get last measured GPU execution time in milliseconds
   */
  getGPUTime(): number {
    return this.gpuTimeMs;
  }

  /**
   * Execute unified draw command (Epic 3.14 Consolidation)
   * Supports indexed, non-indexed, indirect, and compute dispatches
   */
  executeDrawCommand(command: DrawCommand): void {
    if (!this.device || !this.currentCommandEncoder) {
      throw new Error('Cannot execute draw command: no active command encoder');
    }

    const geom = command.geometry;

    // Handle compute dispatch separately
    if (isComputeGeometry(geom)) {
      this.executeComputeDispatch(command);
      return;
    }

    // Get or create render pass for rendering commands
    if (!this.currentRenderPass) {
      const colorAttachment: GPURenderPassColorAttachment = {
        view: this.context!.getCurrentTexture().createView(),
        clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
        loadOp: 'clear' as const,
        storeOp: 'store' as const,
      };

      const depthAttachment: GPURenderPassDepthStencilAttachment | undefined = this.depthTexture
        ? {
            view: this.depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear' as const,
            depthStoreOp: 'store' as const,
          }
        : undefined;

      this.currentRenderPass = this.currentCommandEncoder.beginRenderPass({
        label: command.label || 'Render Pass',
        colorAttachments: [colorAttachment],
        depthStencilAttachment: depthAttachment,
      });
    }

    // Get pipeline
    const pipelineData = this.pipelines.get(command.pipeline.id);
    if (!pipelineData) {
      throw new Error(`Pipeline ${command.pipeline.id} not found`);
    }
    if (pipelineData.type !== 'render') {
      throw new Error(`Pipeline ${command.pipeline.id} is not a render pipeline`);
    }

    // Set pipeline
    this.currentRenderPass.setPipeline(pipelineData.pipeline as GPURenderPipeline);

    // Set bind groups
    for (const [groupIndex, bindGroupHandle] of command.bindGroups) {
      const bindGroup = this.bindGroups.get(bindGroupHandle.id);
      if (!bindGroup) {
        throw new Error(`Bind group ${bindGroupHandle.id} not found`);
      }
      this.currentRenderPass.setBindGroup(groupIndex, bindGroup);
    }

    // Set vertex buffers from geometry
    // Epic 3.14: Validate vertex buffer slots
    const maxSlot = Math.max(...geom.vertexBuffers.keys());
    if (maxSlot >= this.device.limits.maxVertexBuffers) {
      throw new Error(
        `Vertex buffer slot ${maxSlot} exceeds device limit (${this.device.limits.maxVertexBuffers})`
      );
    }

    // Warn if slots aren't sequential (non-fatal but suspicious)
    const slots = Array.from(geom.vertexBuffers.keys()).sort((a, b) => a - b);
    for (let i = 0; i < slots.length - 1; i++) {
      if (slots[i + 1] !== slots[i] + 1) {
        console.warn(`Non-sequential vertex buffer slots detected: ${slots.join(', ')}`);
        break;
      }
    }

    for (const [slot, handle] of geom.vertexBuffers) {
      const bufferData = this.buffers.get(handle.id);
      if (!bufferData) {
        throw new Error(`Vertex buffer ${handle.id} not found`);
      }
      this.currentRenderPass.setVertexBuffer(slot, bufferData.buffer);
    }

    // Execute appropriate draw call based on geometry type
    if (isIndexedGeometry(geom)) {
      this.executeIndexedDraw(geom);
    } else if (isNonIndexedGeometry(geom)) {
      this.executeNonIndexedDraw(geom);
    } else if (isIndirectGeometry(geom)) {
      this.executeIndirectDraw(geom);
    }
  }

  /**
   * Execute indexed draw
   */
  private executeIndexedDraw(geom: import('../commands/DrawCommand').IndexedGeometry): void {
    if (!this.currentRenderPass) return;

    const indexBufferData = this.buffers.get(geom.indexBuffer.id);
    if (!indexBufferData) {
      throw new Error(`Index buffer ${geom.indexBuffer.id} not found`);
    }

    this.currentRenderPass.setIndexBuffer(indexBufferData.buffer, geom.indexFormat);

    this.currentRenderPass.drawIndexed(
      geom.indexCount,
      geom.instanceCount ?? 1,
      geom.firstIndex ?? 0,
      geom.baseVertex ?? 0,
      geom.firstInstance ?? 0
    );

    // Update stats
    this.stats.drawCalls++;
    this.stats.vertices += geom.indexCount * (geom.instanceCount ?? 1);
    this.stats.triangles += Math.floor(geom.indexCount / 3) * (geom.instanceCount ?? 1);
  }

  /**
   * Execute non-indexed draw
   */
  private executeNonIndexedDraw(geom: import('../commands/DrawCommand').NonIndexedGeometry): void {
    if (!this.currentRenderPass) return;

    this.currentRenderPass.draw(
      geom.vertexCount,
      geom.instanceCount ?? 1,
      geom.firstVertex ?? 0,
      geom.firstInstance ?? 0
    );

    // Update stats
    this.stats.drawCalls++;
    this.stats.vertices += geom.vertexCount * (geom.instanceCount ?? 1);
    this.stats.triangles += Math.floor(geom.vertexCount / 3) * (geom.instanceCount ?? 1);
  }

  /**
   * Execute indirect draw
   */
  private executeIndirectDraw(geom: import('../commands/DrawCommand').IndirectGeometry): void {
    if (!this.currentRenderPass) return;

    const indirectBufferData = this.buffers.get(geom.indirectBuffer.id);
    if (!indirectBufferData) {
      throw new Error(`Indirect buffer ${geom.indirectBuffer.id} not found`);
    }

    if (geom.indexBuffer) {
      // Indexed indirect - Epic 3.14: Validate indexFormat is present
      if (!geom.indexFormat) {
        throw new Error('indexFormat required for indexed indirect draws');
      }

      const indexBufferData = this.buffers.get(geom.indexBuffer.id);
      if (!indexBufferData) {
        throw new Error(`Index buffer ${geom.indexBuffer.id} not found`);
      }
      this.currentRenderPass.setIndexBuffer(indexBufferData.buffer, geom.indexFormat);
      this.currentRenderPass.drawIndexedIndirect(indirectBufferData.buffer, geom.indirectOffset);
    } else {
      // Non-indexed indirect
      this.currentRenderPass.drawIndirect(indirectBufferData.buffer, geom.indirectOffset);
    }

    // Update stats (cannot determine exact counts for indirect draws)
    this.stats.drawCalls++;
  }

  /**
   * Execute compute dispatch
   */
  private executeComputeDispatch(command: DrawCommand): void {
    if (!this.device || !this.currentCommandEncoder) return;

    const geom = command.geometry;
    if (!isComputeGeometry(geom)) return;

    const pipelineData = this.pipelines.get(command.pipeline.id);
    if (!pipelineData) {
      throw new Error(`Pipeline ${command.pipeline.id} not found`);
    }
    if (pipelineData.type !== 'compute') {
      throw new Error(`Pipeline ${command.pipeline.id} is not a compute pipeline`);
    }

    const computePass = this.currentCommandEncoder.beginComputePass({
      label: command.label || 'Compute Pass',
    });

    computePass.setPipeline(pipelineData.pipeline as GPUComputePipeline);

    // Set bind groups
    for (const [groupIndex, bindGroupHandle] of command.bindGroups) {
      const bindGroup = this.bindGroups.get(bindGroupHandle.id);
      if (!bindGroup) {
        throw new Error(`Bind group ${bindGroupHandle.id} not found`);
      }
      computePass.setBindGroup(groupIndex, bindGroup);
    }

    computePass.dispatchWorkgroups(geom.workgroups[0], geom.workgroups[1], geom.workgroups[2]);
    computePass.end();

    // Update stats
    this.stats.drawCalls++;
  }

  clear(
    _color?: [number, number, number, number],
    _depth?: number,
    _stencil?: number
  ): void {
    // WebGPU clears are handled in render pass descriptors
    // This is a no-op for now - clearing happens when beginning render pass
  }

  resize(width: number, height: number): void {
    if (!this.canvas || !this.device) return;

    this.canvas.width = width;
    this.canvas.height = height;

    // Recreate depth texture with new size
    if (this.depthTexture) {
      this.depthTexture.destroy();
    }
    this.depthTexture = this.device.createTexture({
      size: { width, height },
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
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

  // Pipeline Management - Epic 3.13 Dynamic Vertex Layouts

  /**
   * Get or create pipeline variant for (shader, vertexLayout) combination
   * Epic 3.13: Dynamic pipeline generation
   * @deprecated This will be removed once all demos are migrated to new pipeline API
   */
  // @ts-ignore - Legacy method for old demos
  private getPipeline(
    shaderId: string,
    vertexLayout: VertexLayout,
    isInstancedShader: boolean
  ): GPURenderPipeline {
    if (!this.device) {
      throw new Error('WebGPU backend not initialized');
    }

    // Generate cache key
    const layoutHash = this.hashVertexLayout(vertexLayout);
    const cacheKey = `${shaderId}_${layoutHash}_${isInstancedShader}`;

    // Check cache
    const cached = this.pipelineCache.get(cacheKey);
    if (cached) {
      return cached.pipeline;
    }

    // Get shader
    const shader = this.shaders.get(shaderId);
    if (!shader) {
      throw new Error(`Shader ${shaderId} not found`);
    }

    // Build vertex buffers from layout
    const vertexBuffers = this.buildVertexBuffers(vertexLayout, isInstancedShader);

    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      label: `PipelineLayout: ${cacheKey}`,
      bindGroupLayouts: [shader.bindGroupLayout],
    });

    // Create pipeline
    const pipeline = this.device.createRenderPipeline({
      label: `Pipeline: ${cacheKey}`,
      layout: pipelineLayout,
      vertex: {
        module: shader.shaderModule,
        entryPoint: 'vs_main',
        buffers: vertexBuffers,
      },
      fragment: {
        module: shader.shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this.preferredFormat,
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });

    // Cache it
    this.pipelineCache.set(cacheKey, { pipeline, vertexLayoutHash: layoutHash });

    return pipeline;
  }

  /**
   * Hash vertex layout for cache key
   * Includes offset and stride to prevent cache collisions
   */
  private hashVertexLayout(layout: VertexLayout): string {
    const attrStrings = layout.attributes.map(
      attr => `${attr.name}:${attr.type}:${attr.size}:${attr.offset ?? 0}:${attr.stride ?? 0}`
    );
    return attrStrings.join('|');
  }

  /**
   * Build GPUVertexBufferLayout array from VertexLayout
   * Epic 3.13: Creates ONE buffer slot for interleaved vertex data
   */
  private buildVertexBuffers(
    vertexLayout: VertexLayout,
    isInstancedShader: boolean
  ): GPUVertexBufferLayout[] {
    const buffers: GPUVertexBufferLayout[] = [];

    // Calculate total stride for interleaved data (sum of all attribute sizes)
    let totalStride = 0;
    for (const attr of vertexLayout.attributes) {
      totalStride += this.getAttributeByteSize(attr.type, attr.size);
    }

    // Create ONE buffer slot with ALL vertex attributes
    // This is for interleaved data: position+normal+uv all in same buffer
    const attributes: GPUVertexAttribute[] = [];
    for (let i = 0; i < vertexLayout.attributes.length; i++) {
      const attr = vertexLayout.attributes[i];
      attributes.push({
        shaderLocation: i, // Sequential locations: 0, 1, 2, ...
        offset: attr.offset ?? 0,
        format: this.getGPUVertexFormat(attr.type, attr.size),
      });
    }

    buffers.push({
      arrayStride: totalStride,
      stepMode: 'vertex',
      attributes,
    });

    // Add instance buffer for instanced shaders (separate slot)
    // Layout: mat4 transform (64 bytes) + vec4 color (16 bytes) = 80 bytes per instance
    if (isInstancedShader) {
      buffers.push({
        arrayStride: 80, // mat4 (64 bytes) + vec4 (16 bytes)
        stepMode: 'instance',
        attributes: [
          // mat4 transform requires 4 vec4 attributes (one per row)
          { shaderLocation: vertexLayout.attributes.length + 0, offset: 0, format: 'float32x4' },
          { shaderLocation: vertexLayout.attributes.length + 1, offset: 16, format: 'float32x4' },
          { shaderLocation: vertexLayout.attributes.length + 2, offset: 32, format: 'float32x4' },
          { shaderLocation: vertexLayout.attributes.length + 3, offset: 48, format: 'float32x4' },
          // vec4 color attribute
          { shaderLocation: vertexLayout.attributes.length + 4, offset: 64, format: 'float32x4' },
        ],
      });
    }

    return buffers;
  }

  /**
   * Get GPUVertexFormat from attribute type and size
   */
  private getGPUVertexFormat(type: string, size: number): GPUVertexFormat {
    if (type === 'float') {
      switch (size) {
        case 1: return 'float32';
        case 2: return 'float32x2';
        case 3: return 'float32x3';
        case 4: return 'float32x4';
        default: throw new Error(`Unsupported float size: ${size}`);
      }
    }
    throw new Error(`Unsupported attribute type: ${type}`);
  }

  /**
   * Get byte size of attribute
   */
  private getAttributeByteSize(type: string, size: number): number {
    if (type === 'float') {
      return size * 4; // 4 bytes per float
    }
    throw new Error(`Unsupported attribute type: ${type}`);
  }

  // Shader Management

  createShader(id: string, source: ShaderSource): BackendShaderHandle {
    if (!this.device) {
      throw new Error('WebGPU backend not initialized');
    }

    // Epic 3.13: Shader creation now just stores the shader module
    // Pipelines are created on-demand by getPipeline() with specific vertex layouts

    // For now, we expect WGSL source
    // In a complete implementation, we would transpile GLSL -> WGSL here
    const shaderModule = this.device.createShaderModule({
      label: `Shader: ${id}`,
      code: source.vertex, // Assuming combined WGSL shader for now
    });

    // CRITICAL: Validate shader compilation (async)
    shaderModule.getCompilationInfo().then((info) => {
      const errors = info.messages.filter((m) => m.type === 'error');
      if (errors.length > 0) {
        console.error(`🚨 Shader "${id}" compilation failed:`);
        for (const error of errors) {
          console.error(`   Line ${error.lineNum}:${error.linePos} - ${error.message}`);
        }
      } else {
        console.log(`✓ Shader "${id}" compiled successfully`);
      }
    });

    // Create bind group layout for uniforms
    const bindGroupLayout = this.device.createBindGroupLayout({
      label: `BindGroupLayout: ${id}`,
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'uniform',
          },
        },
      ],
    });

    // Store shader module and bind group layout
    // Pipelines will be created on-demand in getPipeline()
    const shader: WebGPUShader = { id, shaderModule, bindGroupLayout };
    this.shaders.set(id, shader);

    // Epic RENDERING-04: Auto-register resource for recovery
    if (this.recoverySystem) {
      this.recoverySystem.registerResource({
        type: ResourceType.SHADER,
        id,
        creationParams: {
          source
        }
      } as ShaderDescriptor);
    }

    return { __brand: 'BackendShader', id } as BackendShaderHandle;
  }

  deleteShader(handle: BackendShaderHandle): void {
    this.shaders.delete(handle.id);
  }

  // Buffer Management

  createBuffer(
    id: string,
    type: 'vertex' | 'index' | 'uniform' | 'storage',
    data: ArrayBuffer | ArrayBufferView,
    _usage: BufferUsage
  ): BackendBufferHandle {
    if (!this.device) {
      throw new Error('WebGPU backend not initialized');
    }

    const dataArray = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer);

    // Epic 2.13: Track VRAM allocation before creating buffer
    const category = type === 'vertex' ? VRAMCategory.VERTEX_BUFFERS
                   : type === 'index' ? VRAMCategory.INDEX_BUFFERS
                   : type === 'storage' ? VRAMCategory.STORAGE_BUFFERS
                   : VRAMCategory.UNIFORM_BUFFERS;

    // Epic 3.8: Use GPUBufferPool for vertex/index buffers
    const shouldPool = type === 'vertex' || type === 'index';
    let buffer: GPUBuffer;
    let bufferUsageType: BufferUsageType | undefined;

    if (shouldPool) {
      // Use buffer pool
      bufferUsageType = type === 'vertex' ? BufferUsageType.VERTEX : BufferUsageType.INDEX;
      buffer = this.gpuBufferPool.acquire(this.device, bufferUsageType, dataArray.byteLength);

      // Report actual allocated size (bucket size) to VRAM profiler
      const bucketSize = buffer.size;
      if (!this.vramProfiler.allocate(id, category, bucketSize)) {
        // Failed to allocate - release buffer back to pool and throw
        this.gpuBufferPool.release(buffer, bufferUsageType, dataArray.byteLength);
        throw new Error(`VRAM budget exceeded: cannot allocate ${bucketSize} bytes for ${id}`);
      }
    } else {
      // Direct allocation for uniform and storage buffers
      if (!this.vramProfiler.allocate(id, category, dataArray.byteLength)) {
        throw new Error(`VRAM budget exceeded: cannot allocate ${dataArray.byteLength} bytes for ${id}`);
      }

      const gpuUsage = type === 'uniform'
        ? GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        : GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
      buffer = this.device.createBuffer({
        label: `Buffer: ${id}`,
        size: dataArray.byteLength,
        usage: gpuUsage,
      });
    }

    this.device.queue.writeBuffer(buffer, 0, dataArray);

    const bufferData: WebGPUBuffer = {
      id,
      buffer,
      type,
      size: dataArray.byteLength,
      pooled: shouldPool,
      bufferUsageType,
      requestedSize: dataArray.byteLength,
    };
    this.buffers.set(id, bufferData);

    // Epic RENDERING-04: Auto-register resource for recovery
    if (this.recoverySystem) {
      this.recoverySystem.registerResource({
        type: ResourceType.BUFFER,
        id,
        creationParams: {
          bufferType: type,
          size: dataArray.byteLength,
          usage: _usage
        },
        data: dataArray.buffer
      } as BufferDescriptor);
    }

    return { __brand: 'BackendBuffer', id } as BackendBufferHandle;
  }

  updateBuffer(
    handle: BackendBufferHandle,
    data: ArrayBuffer | ArrayBufferView,
    offset: number = 0
  ): void {
    if (!this.device) return;

    const bufferData = this.buffers.get(handle.id);
    if (!bufferData) {
      throw new Error(`Buffer ${handle.id} not found`);
    }

    const dataArray = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer);
    this.device.queue.writeBuffer(bufferData.buffer, offset, dataArray);
  }

  deleteBuffer(handle: BackendBufferHandle): void {
    const bufferData = this.buffers.get(handle.id);
    if (bufferData) {
      // Epic 2.13: Deallocate from VRAM profiler
      this.vramProfiler.deallocate(handle.id);

      // Epic 3.8: Release pooled buffers back to pool, destroy non-pooled
      if (bufferData.pooled && bufferData.bufferUsageType && bufferData.requestedSize) {
        this.gpuBufferPool.release(bufferData.buffer, bufferData.bufferUsageType, bufferData.requestedSize);
      } else {
        bufferData.buffer.destroy();
      }

      this.buffers.delete(handle.id);
    }
  }

  // Texture Management

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
    if (!this.device) {
      throw new Error('WebGPU backend not initialized');
    }

    const texture = this.device.createTexture({
      label: `Texture: ${id}`,
      size: { width, height },
      format: this.getWebGPUTextureFormat(config.format),
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Upload texture data
    if (data) {
      if (data instanceof ImageData) {
        this.device.queue.writeTexture(
          { texture },
          data.data,
          { bytesPerRow: width * 4 },
          { width, height }
        );
      } else if (data instanceof HTMLImageElement || data instanceof HTMLCanvasElement) {
        this.device.queue.copyExternalImageToTexture(
          { source: data },
          { texture },
          { width, height }
        );
      } else {
        this.device.queue.writeTexture(
          { texture },
          data,
          { bytesPerRow: width * 4 },
          { width, height }
        );
      }
    }

    const view = texture.createView();

    const textureData: WebGPUTexture = { id, texture, view, width, height };
    this.textures.set(id, textureData);

    // Epic RENDERING-04: Auto-register resource for recovery
    if (this.recoverySystem) {
      this.recoverySystem.registerResource({
        type: ResourceType.TEXTURE,
        id,
        creationParams: {
          width,
          height,
          format: config.format,
          minFilter: config.minFilter,
          magFilter: config.magFilter,
          wrapS: config.wrapS,
          wrapT: config.wrapT,
          generateMipmaps: config.generateMipmaps
        },
        data: data instanceof ImageData ? data.data.buffer : null // Store ImageData, others can't be serialized
      } as TextureDescriptor);
    }

    return { __brand: 'BackendTexture', id } as BackendTextureHandle;
  }

  updateTexture(
    handle: BackendTextureHandle,
    data: ArrayBufferView | HTMLImageElement | HTMLCanvasElement | ImageData,
    x: number = 0,
    y: number = 0,
    width?: number,
    height?: number
  ): void {
    if (!this.device) return;

    const textureData = this.textures.get(handle.id);
    if (!textureData) {
      throw new Error(`Texture ${handle.id} not found`);
    }

    const w = width ?? textureData.width;
    const h = height ?? textureData.height;

    if (data instanceof ImageData) {
      this.device.queue.writeTexture(
        { texture: textureData.texture, origin: { x, y } },
        data.data,
        { bytesPerRow: w * 4 },
        { width: w, height: h }
      );
    } else if (data instanceof HTMLImageElement || data instanceof HTMLCanvasElement) {
      this.device.queue.copyExternalImageToTexture(
        { source: data, origin: { x, y } },
        { texture: textureData.texture },
        { width: w, height: h }
      );
    } else {
      this.device.queue.writeTexture(
        { texture: textureData.texture, origin: { x, y } },
        data,
        { bytesPerRow: w * 4 },
        { width: w, height: h }
      );
    }
  }

  deleteTexture(handle: BackendTextureHandle): void {
    const textureData = this.textures.get(handle.id);
    if (textureData) {
      textureData.texture.destroy();
      this.textures.delete(handle.id);
    }
  }

  // Framebuffer Management

  createFramebuffer(
    id: string,
    colorAttachments: BackendTextureHandle[],
    depthAttachment?: BackendTextureHandle
  ): BackendFramebufferHandle {
    const colorTextures: GPUTextureView[] = [];
    for (const handle of colorAttachments) {
      const textureData = this.textures.get(handle.id);
      if (textureData) {
        colorTextures.push(textureData.view);
      }
    }

    let depthTexture: GPUTextureView | undefined;
    if (depthAttachment) {
      const depthData = this.textures.get(depthAttachment.id);
      if (depthData) {
        depthTexture = depthData.view;
      }
    }

    const framebuffer: WebGPUFramebuffer = { id, colorTextures, depthTexture };
    this.framebuffers.set(id, framebuffer);

    return { __brand: 'BackendFramebuffer', id } as BackendFramebufferHandle;
  }

  deleteFramebuffer(handle: BackendFramebufferHandle): void {
    this.framebuffers.delete(handle.id);
  }

  // Epic 3.14: Modern Rendering API Implementation

  /**
   * Create bind group layout from descriptor
   */
  createBindGroupLayout(descriptor: BindGroupLayoutDescriptor): BackendBindGroupLayoutHandle {
    if (!this.device) {
      throw new Error('WebGPU backend not initialized');
    }

    const id = `bindGroupLayout_${this.nextResourceId++}`;

    // Convert our descriptor to WebGPU bind group layout entries
    const entries: GPUBindGroupLayoutEntry[] = descriptor.entries.map(entry => {
      const gpuEntry: GPUBindGroupLayoutEntry = {
        binding: entry.binding,
        visibility: this.convertVisibilityFlags(entry.visibility),
        ...this.convertBindingType(entry.type),
      };
      return gpuEntry;
    });

    const layout = this.device.createBindGroupLayout({
      label: `BindGroupLayout: ${id}`,
      entries,
    });

    this.bindGroupLayouts.set(id, layout);
    return { __brand: 'BackendBindGroupLayout', id } as BackendBindGroupLayoutHandle;
  }

  /**
   * Delete bind group layout
   */
  deleteBindGroupLayout(handle: BackendBindGroupLayoutHandle): void {
    this.bindGroupLayouts.delete(handle.id);
  }

  /**
   * Create bind group with resource bindings
   */
  createBindGroup(
    layout: BackendBindGroupLayoutHandle,
    resources: BindGroupResources
  ): BackendBindGroupHandle {
    if (!this.device) {
      throw new Error('WebGPU backend not initialized');
    }

    const gpuLayout = this.bindGroupLayouts.get(layout.id);
    if (!gpuLayout) {
      throw new Error(`Bind group layout ${layout.id} not found`);
    }

    const id = `bindGroup_${this.nextResourceId++}`;

    // Convert resources to WebGPU bind group entries
    const entries: GPUBindGroupEntry[] = resources.bindings.map(binding => {
      if ('__brand' in binding.resource && binding.resource.__brand === 'BackendBuffer') {
        const bufferHandle = binding.resource as BackendBufferHandle;
        const bufferData = this.buffers.get(bufferHandle.id);
        if (!bufferData) {
          throw new Error(`Buffer ${bufferHandle.id} not found`);
        }
        return {
          binding: binding.binding,
          resource: { buffer: bufferData.buffer },
        };
      } else {
        // Texture binding
        const textureBinding = binding.resource as { texture: BackendTextureHandle; sampler?: any };
        const textureData = this.textures.get(textureBinding.texture.id);
        if (!textureData) {
          throw new Error(`Texture ${textureBinding.texture.id} not found`);
        }
        return {
          binding: binding.binding,
          resource: textureData.view,
        };
      }
    });

    const bindGroup = this.device.createBindGroup({
      label: `BindGroup: ${id}`,
      layout: gpuLayout,
      entries,
    });

    this.bindGroups.set(id, bindGroup);
    return { __brand: 'BackendBindGroup', id } as BackendBindGroupHandle;
  }

  /**
   * Delete bind group
   */
  deleteBindGroup(handle: BackendBindGroupHandle): void {
    this.bindGroups.delete(handle.id);
  }

  /**
   * Create render pipeline
   */
  createRenderPipeline(descriptor: RenderPipelineDescriptor): BackendPipelineHandle {
    if (!this.device) {
      throw new Error('WebGPU backend not initialized');
    }

    const id = `pipeline_${this.nextResourceId++}`;

    try {
      // Get shader
      const shader = this.shaders.get(descriptor.shader.id);
      if (!shader) {
        throw new Error(`Shader ${descriptor.shader.id} not found`);
      }

      // Get bind group layouts
      const bindGroupLayouts = descriptor.bindGroupLayouts.map(handle => {
        const layout = this.bindGroupLayouts.get(handle.id);
        if (!layout) {
          throw new Error(`Bind group layout ${handle.id} not found`);
        }
        return layout;
      });

    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      label: `PipelineLayout: ${id}`,
      bindGroupLayouts,
    });

    // Convert pipeline state to WebGPU
    const primitiveState: GPUPrimitiveState = {
      topology: descriptor.pipelineState.topology,
      cullMode: descriptor.pipelineState.rasterization?.cullMode || 'back',
      frontFace: descriptor.pipelineState.rasterization?.frontFace || 'ccw',
    };

    const depthStencilState: GPUDepthStencilState | undefined = descriptor.depthFormat ? {
      format: descriptor.depthFormat,
      depthWriteEnabled: descriptor.pipelineState.depthStencil?.depthWriteEnabled ?? true,
      depthCompare: descriptor.pipelineState.depthStencil?.depthCompare || 'less',
    } : undefined;

    // Convert vertex layouts to WebGPU format
    const gpuVertexLayouts: GPUVertexBufferLayout[] = descriptor.vertexLayouts.map(layout => ({
      arrayStride: layout.arrayStride,
      stepMode: layout.stepMode,
      attributes: layout.attributes.map(attr => ({
        shaderLocation: attr.shaderLocation,
        offset: attr.offset,
        format: attr.format as GPUVertexFormat,
      })),
    }));

    // Create render pipeline
    const pipeline = this.device.createRenderPipeline({
      label: descriptor.label || `RenderPipeline: ${id}`,
      layout: pipelineLayout,
      vertex: {
        module: shader.shaderModule,
        entryPoint: 'vs_main',
        buffers: gpuVertexLayouts,
      },
      fragment: {
        module: shader.shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: descriptor.colorFormat,
          blend: descriptor.pipelineState.blend?.enabled ? {
            color: {
              srcFactor: descriptor.pipelineState.blend.srcFactor,
              dstFactor: descriptor.pipelineState.blend.dstFactor,
              operation: descriptor.pipelineState.blend.operation,
            },
            alpha: {
              srcFactor: descriptor.pipelineState.blend.srcAlphaFactor || descriptor.pipelineState.blend.srcFactor,
              dstFactor: descriptor.pipelineState.blend.dstAlphaFactor || descriptor.pipelineState.blend.dstFactor,
              operation: descriptor.pipelineState.blend.alphaOperation || descriptor.pipelineState.blend.operation,
            },
          } : undefined,
        }],
      },
      primitive: primitiveState,
      depthStencil: depthStencilState,
    });

      this.pipelines.set(id, { pipeline, type: 'render' });
      return { __brand: 'BackendPipeline', id, type: 'render' } as BackendPipelineHandle;
    } catch (error) {
      // CRITICAL: Provide helpful error context for pipeline failures
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to create render pipeline "${descriptor.label || id}":`, error);

      throw new Error(
        `Render pipeline creation failed: ${errorMsg}\n` +
        `Pipeline: ${descriptor.label || id}\n` +
        `Shader: ${descriptor.shader.id}\n` +
        `Vertex layouts: ${descriptor.vertexLayouts.length}\n` +
        `Bind group layouts: ${descriptor.bindGroupLayouts.length}\n` +
        `Color format: ${descriptor.colorFormat}\n` +
        `Depth format: ${descriptor.depthFormat || 'none'}`
      );
    }
  }

  /**
   * Create compute pipeline
   */
  createComputePipeline(descriptor: ComputePipelineDescriptor): BackendPipelineHandle {
    if (!this.device) {
      throw new Error('WebGPU backend not initialized');
    }

    const id = `pipeline_${this.nextResourceId++}`;

    try {
      // Get shader
      const shader = this.shaders.get(descriptor.shader.id);
      if (!shader) {
        throw new Error(`Shader ${descriptor.shader.id} not found`);
      }

      // Get bind group layouts
      const bindGroupLayouts = descriptor.bindGroupLayouts.map(handle => {
        const layout = this.bindGroupLayouts.get(handle.id);
        if (!layout) {
          throw new Error(`Bind group layout ${handle.id} not found`);
        }
        return layout;
      });

    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      label: `ComputePipelineLayout: ${id}`,
      bindGroupLayouts,
    });

    // Create compute pipeline
    const pipeline = this.device.createComputePipeline({
      label: descriptor.label || `ComputePipeline: ${id}`,
      layout: pipelineLayout,
      compute: {
        module: shader.shaderModule,
        entryPoint: descriptor.entryPoint || 'compute_main',
      },
    });

      this.pipelines.set(id, { pipeline, type: 'compute' });
      return { __brand: 'BackendPipeline', id, type: 'compute' } as BackendPipelineHandle;
    } catch (error) {
      // CRITICAL: Provide helpful error context for compute pipeline failures
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to create compute pipeline "${descriptor.label || id}":`, error);

      throw new Error(
        `Compute pipeline creation failed: ${errorMsg}\n` +
        `Pipeline: ${descriptor.label || id}\n` +
        `Shader: ${descriptor.shader.id}\n` +
        `Entry point: ${descriptor.entryPoint || 'compute_main'}\n` +
        `Bind group layouts: ${descriptor.bindGroupLayouts.length}`
      );
    }
  }

  /**
   * Delete pipeline
   */
  deletePipeline(handle: BackendPipelineHandle): void {
    this.pipelines.delete(handle.id);
  }

  /**
   * Create shader with automatic reflection
   */
  createShaderWithReflection(
    id: string,
    source: ShaderSource
  ): { handle: BackendShaderHandle; reflection: ShaderReflectionData } {
    if (!this.device) {
      throw new Error('WebGPU backend not initialized');
    }

    // Parse shader to extract reflection data
    const reflection = this.reflectionCache.getOrCompute(source.vertex, this.reflectionParser);

    // Create shader module
    const shaderModule = this.device.createShaderModule({
      label: `Shader: ${id}`,
      code: source.vertex, // Assuming combined WGSL shader
    });

    // For compatibility with old API, create a default bind group layout
    // In new API, this is created separately via createBindGroupLayout
    const bindGroupLayout = this.device.createBindGroupLayout({
      label: `BindGroupLayout: ${id}`,
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    const shader: WebGPUShader = { id, shaderModule, bindGroupLayout };
    this.shaders.set(id, shader);

    return {
      handle: { __brand: 'BackendShader', id } as BackendShaderHandle,
      reflection,
    };
  }

  /**
   * Dispatch compute shader
   */
  dispatchCompute(
    pipeline: BackendPipelineHandle,
    workgroupsX: number,
    workgroupsY: number,
    workgroupsZ: number
  ): void {
    if (!this.device || !this.currentCommandEncoder) {
      throw new Error('Cannot dispatch compute: no active command encoder');
    }

    if (pipeline.type !== 'compute') {
      throw new Error('Pipeline is not a compute pipeline');
    }

    const pipelineData = this.pipelines.get(pipeline.id);
    if (!pipelineData) {
      throw new Error(`Pipeline ${pipeline.id} not found`);
    }

    // Create compute pass
    const computePass = this.currentCommandEncoder.beginComputePass({
      label: 'Compute Pass',
    });

    computePass.setPipeline(pipelineData.pipeline as GPUComputePipeline);
    computePass.dispatchWorkgroups(workgroupsX, workgroupsY, workgroupsZ);
    computePass.end();

    // Update stats
    this.stats.drawCalls++; // Count compute dispatches as "draw calls"
  }

  /**
   * Helper: Convert visibility flags to WebGPU shader stage flags
   */
  private convertVisibilityFlags(stages: ('vertex' | 'fragment' | 'compute')[]): GPUShaderStageFlags {
    let flags: GPUShaderStageFlags = 0;
    for (const stage of stages) {
      switch (stage) {
        case 'vertex':
          flags |= GPUShaderStage.VERTEX;
          break;
        case 'fragment':
          flags |= GPUShaderStage.FRAGMENT;
          break;
        case 'compute':
          flags |= GPUShaderStage.COMPUTE;
          break;
      }
    }
    return flags;
  }

  /**
   * Helper: Convert binding type to WebGPU layout entry
   */
  private convertBindingType(type: 'uniform' | 'storage' | 'read-only-storage' | 'sampler' | 'texture'): Partial<GPUBindGroupLayoutEntry> {
    switch (type) {
      case 'uniform':
        return { buffer: { type: 'uniform' } };
      case 'storage':
        return { buffer: { type: 'storage' } };
      case 'read-only-storage':
        return { buffer: { type: 'read-only-storage' } };
      case 'sampler':
        return { sampler: { type: 'filtering' } };
      case 'texture':
        return { texture: { sampleType: 'float' } };
    }
  }

  dispose(): void {
    // Destroy all GPU resources
    for (const buffer of this.buffers.values()) {
      buffer.buffer.destroy();
    }
    this.buffers.clear();

    for (const texture of this.textures.values()) {
      texture.texture.destroy();
    }
    this.textures.clear();

    this.shaders.clear();
    this.framebuffers.clear();

    // Epic 3.14: Clean up modern API resources
    this.bindGroupLayouts.clear();
    this.bindGroups.clear();
    this.pipelines.clear();
    this.reflectionCache.clear();

    // Clean up timestamp query resources
    if (this.timestampQuerySet) {
      this.timestampQuerySet.destroy();
      this.timestampQuerySet = null;
    }
    if (this.timestampBuffer) {
      this.timestampBuffer.destroy();
      this.timestampBuffer = null;
    }
    for (const buffer of this.timestampReadBuffers) {
      buffer.destroy();
    }
    this.timestampReadBuffers = [];
    this.pendingTimestampReads.clear();

    // Epic 3.8: Clean up buffer pool
    this.gpuBufferPool.clear();

    if (this.device) {
      this.device.destroy();
      this.device = null;
    }

    this.context = null;
    this.canvas = null;
    this.adapter = null;
  }

  // Private Helper Methods

  private getWebGPUTextureFormat(format: TextureFormat): GPUTextureFormat {
    switch (format) {
      case 'rgb': return 'rgba8unorm'; // WebGPU doesn't have RGB8, use RGBA8
      case 'rgba': return 'rgba8unorm';
      case 'depth': return 'depth24plus';
      case 'depth_stencil': return 'depth24plus-stencil8';
    }
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

  /**
   * Get the WebGPU device for direct access (demo/debug only)
   * This method is not part of IRendererBackend interface
   */
  getDevice(): GPUDevice {
    if (!this.device) {
      throw new Error('WebGPU device not initialized');
    }
    return this.device;
  }
}
