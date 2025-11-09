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
} from './IRendererBackend';

import type {
  ShaderSource,
  RenderCommand,
  RenderStats,
  BufferUsage,
  TextureFormat,
  TextureFilter,
  TextureWrap,
  DrawCommand,
  VertexLayout,
} from '../types';

import { RenderCommandType } from '../types';

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
  type: 'vertex' | 'index' | 'uniform';
  size: number;
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

  // Epic 3.13: Pipeline cache for (shader, vertexLayout) variants
  private pipelineCache = new Map<string, PipelineCacheEntry>();

  // Render state
  private currentRenderPass: GPURenderPassEncoder | null = null;
  private currentCommandEncoder: GPUCommandEncoder | null = null;
  private depthTexture: GPUTexture | null = null;
  private stats: RenderStats = this.createEmptyStats();

  async initialize(config: BackendConfig): Promise<boolean> {
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

      // Request device
      this.device = await this.adapter.requestDevice();

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

      // Set up device lost handler
      this.device.lost.then((info) => {
        console.error(`WebGPU device lost: ${info.message}`);
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

  beginFrame(): void {
    if (!this.device) {
      throw new Error('Cannot begin frame: WebGPU device not available');
    }

    this.resetStats();
    this.currentCommandEncoder = this.device.createCommandEncoder();
  }

  endFrame(): void {
    if (!this.device || !this.currentCommandEncoder || !this.context) {
      return;
    }

    // If no render pass was created (no draw commands), create one just to clear the screen
    if (!this.currentRenderPass) {
      const textureView = this.context.getCurrentTexture().createView();
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
      });
    }

    // End any active render pass
    if (this.currentRenderPass) {
      this.currentRenderPass.end();
      this.currentRenderPass = null;
    }

    // Submit commands
    const commandBuffer = this.currentCommandEncoder.finish();
    this.device.queue.submit([commandBuffer]);

    this.currentCommandEncoder = null;
  }

  executeCommands(commands: RenderCommand[]): void {
    if (!this.device || !this.currentCommandEncoder) {
      throw new Error('Cannot execute commands: no active command encoder');
    }

    for (const command of commands) {
      this.executeCommand(command);
    }
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

  // Pipeline Management - Epic 3.13 Dynamic Vertex Layouts

  /**
   * Get or create pipeline variant for (shader, vertexLayout) combination
   * Epic 3.13: Dynamic pipeline generation
   */
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

    return { __brand: 'BackendShader', id } as BackendShaderHandle;
  }

  deleteShader(handle: BackendShaderHandle): void {
    this.shaders.delete(handle.id);
  }

  // Buffer Management

  createBuffer(
    id: string,
    type: 'vertex' | 'index' | 'uniform',
    data: ArrayBuffer | ArrayBufferView,
    _usage: BufferUsage
  ): BackendBufferHandle {
    if (!this.device) {
      throw new Error('WebGPU backend not initialized');
    }

    const dataArray = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer);

    let gpuUsage = GPUBufferUsage.COPY_DST;
    if (type === 'vertex') {
      gpuUsage |= GPUBufferUsage.VERTEX;
    } else if (type === 'index') {
      gpuUsage |= GPUBufferUsage.INDEX;
    } else if (type === 'uniform') {
      gpuUsage |= GPUBufferUsage.UNIFORM;
    }

    const buffer = this.device.createBuffer({
      label: `Buffer: ${id}`,
      size: dataArray.byteLength,
      usage: gpuUsage,
    });

    this.device.queue.writeBuffer(buffer, 0, dataArray);

    const bufferData: WebGPUBuffer = { id, buffer, type, size: dataArray.byteLength };
    this.buffers.set(id, bufferData);

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
      bufferData.buffer.destroy();
      this.buffers.delete(handle.id);
    }
  }

  /**
   * Set vertex attribute divisor for instanced rendering (Epic 3.13)
   *
   * WebGPU Note: Divisor is configured via stepMode in vertex buffer layout
   * at render pipeline creation time, not as a separate API call.
   *
   * This implementation stores the divisor configuration for use during
   * pipeline creation. The actual stepMode will be set to:
   * - 'vertex' if divisor === 0
   * - 'instance' if divisor === 1
   *
   * @param shader - Shader handle (for API compatibility)
   * @param attributeName - Name of the attribute
   * @param divisor - Divisor value (0 = per-vertex, 1 = per-instance)
   */
  setVertexAttributeDivisor(
    _shader: BackendShaderHandle,
    _attributeName: string,
    _divisor: number
  ): void {
    // WebGPU handles this in vertex buffer layout configuration
    // Store for future use during render pipeline creation
    // TODO: Implement pipeline configuration when needed
    console.warn('WebGPUBackend.setVertexAttributeDivisor: Not yet implemented - configure stepMode in vertex buffer layout');
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

    if (this.device) {
      this.device.destroy();
      this.device = null;
    }

    this.context = null;
    this.canvas = null;
    this.adapter = null;
  }

  // Private Helper Methods

  private executeCommand(command: RenderCommand): void {
    switch (command.type) {
      case RenderCommandType.CLEAR:
        // Handled in render pass descriptor
        break;
      case RenderCommandType.DRAW:
        this.executeDrawCommand(command as DrawCommand);
        break;
      case RenderCommandType.BIND_FRAMEBUFFER:
        // Would need to begin new render pass with different attachments
        break;
    }
  }

  private executeDrawCommand(command: DrawCommand): void {
    if (!this.device || !this.currentCommandEncoder || !this.context) {
      return;
    }

    try {
      this.executeDrawCommandInternal(command);
    } catch (error) {
      console.error('Error executing draw command:', error);
      // Ensure render pass is cleaned up on error
      if (this.currentRenderPass) {
        this.currentRenderPass.end();
        this.currentRenderPass = null;
      }
    }
  }

  private executeDrawCommandInternal(command: DrawCommand): void {
    if (!this.device || !this.currentCommandEncoder || !this.context) {
      return;
    }

    // Get shader
    const shader = this.shaders.get(command.shader);
    if (!shader) {
      throw new Error(`Shader ${command.shader} not found`);
    }

    // Begin render pass if not already active
    if (!this.currentRenderPass) {
      const textureView = this.context.getCurrentTexture().createView();

      // Check if depth texture needs to be recreated (canvas size changed)
      if (this.depthTexture && this.canvas &&
          (this.depthTexture.width !== this.canvas.width || this.depthTexture.height !== this.canvas.height)) {
        this.depthTexture.destroy();
        this.depthTexture = this.device.createTexture({
          size: { width: this.canvas.width, height: this.canvas.height },
          format: 'depth24plus',
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
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
      });
    }

    // Epic 3.13: Get pipeline variant for this vertex layout
    if (!command.vertexLayout) {
      throw new Error('DrawCommand missing vertexLayout - required for WebGPU pipeline creation');
    }
    const isInstanced = command.shader.endsWith('_instanced');
    const pipeline = this.getPipeline(command.shader, command.vertexLayout, isInstanced);
    this.currentRenderPass.setPipeline(pipeline);

    // Create and bind uniform buffer with all uniforms
    if (command.uniforms && command.uniforms.size > 0) {
      // Pack all uniforms into a single buffer
      // For our shader we need: mat4 (64 bytes) + mat4 (64 bytes) + mat3 (48 bytes aligned to 64) + vec3 (16) + vec3 (16) + vec3 (16) = 240 bytes
      const uniformData = new ArrayBuffer(256); // Padded to 256 for alignment
      const dataView = new DataView(uniformData);
      let offset = 0;

      // Write uniforms in the specific order they appear in the shader struct
      const uniformOrder = [
        'uModelViewProjection',
        'uModel',
        'uNormalMatrix',
        'uLightDir',
        'uCameraPos',
        'uBaseColor'
      ];

      for (const name of uniformOrder) {
        const uniform = command.uniforms.get(name);
        if (!uniform) continue;

        if (uniform.type === 'mat4') {
          const values = uniform.value as number[] | Float32Array;
          for (let i = 0; i < 16; i++) {
            dataView.setFloat32(offset + i * 4, values[i], true);
          }
          offset += 64;
        } else if (uniform.type === 'mat3') {
          // Mat3 needs special handling - pad each column to vec4
          const values = uniform.value as number[] | Float32Array;
          for (let col = 0; col < 3; col++) {
            for (let row = 0; row < 3; row++) {
              dataView.setFloat32(offset + row * 4, values[col * 3 + row], true);
            }
            offset += 16; // vec4 alignment per column
          }
          // NO extra padding needed after mat3
        } else if (uniform.type === 'vec3') {
          const values = uniform.value as number[] | Float32Array;
          for (let i = 0; i < 3; i++) {
            dataView.setFloat32(offset + i * 4, values[i], true);
          }
          offset += 16; // vec3 is aligned to vec4
        }
      }

      // Create uniform buffer
      const uniformBuffer = this.device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      // Create bind group
      const bindGroup = this.device.createBindGroup({
        layout: shader.bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: {
              buffer: uniformBuffer,
            },
          },
        ],
      });

      // Bind the group
      this.currentRenderPass.setBindGroup(0, bindGroup);
    }

    // Bind vertex buffers
    // NOTE: WebGPU uses buffer SLOT indices, not shader attribute locations
    // The hardcoded pipeline has: slot 0 = position, slot 1 = normal
    // TODO: Make this dynamic based on actual vertex layout

    // Epic 3.13: Bind vertex buffers
    // buildVertexBuffers() creates ONE slot (slot 0) for all interleaved vertex attributes
    const vertexBuffer = this.buffers.get(command.vertexBufferId);
    if (!vertexBuffer) {
      throw new Error(`Vertex buffer ${command.vertexBufferId} not found`);
    }

    // Bind vertex buffer to slot 0 (all attributes in one buffer)
    this.currentRenderPass.setVertexBuffer(0, vertexBuffer.buffer);

    // Epic 3.13: Bind instance buffer if present (slot 1)
    if (command.instanceBufferId) {
      const instanceBuffer = this.buffers.get(command.instanceBufferId);
      if (!instanceBuffer) {
        throw new Error(`Instance buffer ${command.instanceBufferId} not found`);
      }
      // Instance buffer is always in slot 1 (slot 0 is vertex data)
      this.currentRenderPass.setVertexBuffer(1, instanceBuffer.buffer);
    }

    // Bind index buffer if present
    if (command.indexBufferId) {
      const indexBuffer = this.buffers.get(command.indexBufferId);
      if (!indexBuffer) {
        throw new Error(`Index buffer ${command.indexBufferId} not found`);
      }
      const indexFormat = command.indexType === 'uint32' ? 'uint32' : 'uint16';
      this.currentRenderPass.setIndexBuffer(indexBuffer.buffer, indexFormat);

      // Epic 3.13: Use instanced draw call if instanceCount is set
      if (command.instanceCount && command.instanceCount > 1) {
        this.currentRenderPass.drawIndexed(
          command.vertexCount,
          command.instanceCount,
          0, // firstIndex
          0, // baseVertex
          0  // firstInstance
        );
      } else {
        this.currentRenderPass.drawIndexed(command.vertexCount);
      }
    } else {
      // Epic 3.13: Use instanced draw call if instanceCount is set
      if (command.instanceCount && command.instanceCount > 1) {
        this.currentRenderPass.draw(
          command.vertexCount,
          command.instanceCount,
          0, // firstVertex
          0  // firstInstance
        );
      } else {
        this.currentRenderPass.draw(command.vertexCount);
      }
    }

    // Update stats
    this.stats.drawCalls++;
    this.stats.vertices += command.vertexCount;
    if (command.mode === 4) { // TRIANGLES
      this.stats.triangles += Math.floor(command.vertexCount / 3);
    }
  }

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
}
