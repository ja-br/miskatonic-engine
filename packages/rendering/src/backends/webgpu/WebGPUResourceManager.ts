/**
 * WebGPU Resource Manager - Epic RENDERING-05 Task 5.3
 * Manages lifecycle of shaders, buffers, textures, framebuffers
 */

import type {
  BackendShaderHandle,
  BackendBufferHandle,
  BackendTextureHandle,
  BackendFramebufferHandle,
  BackendSamplerHandle,
} from '../IRendererBackend.js';
import type { ShaderSource, BufferUsage, TextureFormat } from '../../types.js';
import type { WebGPUContext, ModuleConfig, WebGPUShader, WebGPUBuffer, WebGPUTexture, WebGPUFramebuffer } from './WebGPUTypes.js';
import { WebGPUErrors } from './WebGPUTypes.js';
import { BufferUsageType } from '../../GPUBufferPool.js';
import { VRAMCategory } from '../../VRAMProfiler.js';
import { ResourceType, type BufferDescriptor, type TextureDescriptor } from '../../recovery/ResourceRegistry.js';

export class WebGPUResourceManager {
  private shaders = new Map<string, WebGPUShader>();
  private buffers = new Map<string, WebGPUBuffer & { type: string; pooled: boolean; bufferUsageType?: BufferUsageType; requestedSize: number }>();
  private textures = new Map<string, WebGPUTexture>();
  private framebuffers = new Map<string, WebGPUFramebuffer>();
  private samplers = new Map<string, GPUSampler>();

  constructor(
    private ctx: WebGPUContext,
    private config: ModuleConfig
  ) {}

  createShader(id: string, source: ShaderSource): BackendShaderHandle {
    if (!this.ctx.device) throw new Error(WebGPUErrors.DEVICE_NOT_INITIALIZED);

    const shaderCode = source.vertex || source.fragment || '';
    const shaderModule = this.ctx.device.createShaderModule({
      code: shaderCode,
      label: `Shader: ${id}`,
    });

    // Parse and cache shader reflection data
    this.config.reflectionCache.getOrCompute(shaderCode, this.config.reflectionParser);

    // Create default bind group layout (from WebGPUBackend.ts lines 1000-1011)
    const bindGroupLayout = this.ctx.device.createBindGroupLayout({
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

    this.shaders.set(id, {
      id,
      module: shaderModule,
      bindGroupLayout,
      source: shaderCode,
      type: source.vertex ? 'vertex' : 'fragment',
    });

    return { __brand: 'BackendShader', id } as BackendShaderHandle;
  }

  createBuffer(
    id: string,
    dataArray: ArrayBufferView,
    _usage: BufferUsage,
    mode: 'static' | 'dynamic',
    type: 'vertex' | 'index' | 'uniform' | 'storage' = 'vertex'
  ): BackendBufferHandle {
    if (!this.ctx.device) throw new Error(WebGPUErrors.DEVICE_NOT_INITIALIZED);

    const shouldPool = mode === 'dynamic' && (type === 'vertex' || type === 'index');
    const bufferUsageType = type === 'vertex' ? BufferUsageType.VERTEX : type === 'index' ? BufferUsageType.INDEX : undefined;
    const category = type === 'uniform' ? VRAMCategory.UNIFORM_BUFFERS : type === 'storage' ? VRAMCategory.STORAGE_BUFFERS : VRAMCategory.VERTEX_BUFFERS;

    let buffer: GPUBuffer;

    if (shouldPool && bufferUsageType) {
      // Calculate bucket size using the same algorithm as GPUBufferPool
      const bucketSize = this.calculateBucketSize(dataArray.byteLength);
      if (!this.config.vramProfiler.allocate(id, category, bucketSize)) {
        throw new Error(`VRAM budget exceeded: cannot allocate ${bucketSize} bytes for ${id}`);
      }
      buffer = this.config.bufferPool.acquire(this.ctx.device, bufferUsageType, dataArray.byteLength);
    } else {
      if (!this.config.vramProfiler.allocate(id, category, dataArray.byteLength)) {
        throw new Error(`VRAM budget exceeded: cannot allocate ${dataArray.byteLength} bytes for ${id}`);
      }
      const gpuUsage = type === 'uniform'
        ? GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        : GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
      buffer = this.ctx.device.createBuffer({
        label: `Buffer: ${id}`,
        size: dataArray.byteLength,
        usage: gpuUsage,
      });
    }

    this.ctx.device.queue.writeBuffer(buffer, 0, dataArray);

    this.buffers.set(id, {
      id,
      buffer,
      size: dataArray.byteLength,
      usage: 0,
      type,
      pooled: shouldPool,
      bufferUsageType,
      requestedSize: dataArray.byteLength,
    });

    if (this.config.recoverySystem) {
      this.config.recoverySystem.registerResource({
        type: ResourceType.BUFFER,
        id,
        creationParams: { bufferType: type, size: dataArray.byteLength, usage: _usage },
        data: dataArray.buffer
      } as BufferDescriptor);
    }

    return { __brand: 'BackendBuffer', id } as BackendBufferHandle;
  }

  updateBuffer(handle: BackendBufferHandle, data: ArrayBufferView, offset: number = 0): void {
    if (!this.ctx.device) throw new Error(WebGPUErrors.DEVICE_NOT_INITIALIZED);
    const bufferData = this.buffers.get(handle.id);
    if (!bufferData) throw new Error(`Buffer not found: ${handle.id}`);
    this.ctx.device.queue.writeBuffer(bufferData.buffer, offset, data);
  }

  destroyBuffer(handle: BackendBufferHandle): void {
    const bufferData = this.buffers.get(handle.id);
    if (!bufferData) return;

    if (bufferData.pooled && bufferData.bufferUsageType) {
      this.config.bufferPool.release(bufferData.buffer, bufferData.bufferUsageType, bufferData.requestedSize);
    } else {
      bufferData.buffer.destroy();
    }

    this.config.vramProfiler.deallocate(handle.id);
    this.buffers.delete(handle.id);
  }

  createTexture(
    id: string,
    width: number,
    height: number,
    format: TextureFormat,
    data?: ArrayBufferView
  ): BackendTextureHandle {
    if (!this.ctx.device) throw new Error(WebGPUErrors.DEVICE_NOT_INITIALIZED);

    const gpuFormat = this.getWebGPUTextureFormat(format);
    const bytesPerPixel = this.getBytesPerPixel(gpuFormat);
    const textureSize = width * height * bytesPerPixel;

    if (!this.config.vramProfiler.allocate(id, VRAMCategory.TEXTURES, textureSize)) {
      throw new Error(`VRAM budget exceeded: cannot allocate ${textureSize} bytes for texture ${id}`);
    }

    const texture = this.ctx.device.createTexture({
      label: `Texture: ${id}`,
      size: { width, height },
      format: gpuFormat,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    if (data) {
      // WebGPU requires bytesPerRow to be a multiple of 256
      const unalignedBytesPerRow = width * bytesPerPixel;
      const bytesPerRow = Math.ceil(unalignedBytesPerRow / 256) * 256;

      this.ctx.device.queue.writeTexture(
        { texture },
        data,
        { bytesPerRow },
        { width, height }
      );
    }

    const view = texture.createView();

    this.textures.set(id, { id, texture, view, width, height, format: gpuFormat });

    if (this.config.recoverySystem) {
      this.config.recoverySystem.registerResource({
        type: ResourceType.TEXTURE,
        id,
        creationParams: { width, height, format },
        data: data?.buffer
      } as TextureDescriptor);
    }

    return { __brand: 'BackendTexture', id } as BackendTextureHandle;
  }

  destroyTexture(handle: BackendTextureHandle): void {
    const textureData = this.textures.get(handle.id);
    if (!textureData) return;
    textureData.texture.destroy();
    this.config.vramProfiler.deallocate(handle.id);
    this.textures.delete(handle.id);
  }

  createFramebuffer(
    id: string,
    width: number,
    height: number,
    colorAttachments: BackendTextureHandle[],
    depthAttachment?: BackendTextureHandle
  ): BackendFramebufferHandle {
    const colorViews: GPUTextureView[] = [];
    for (const handle of colorAttachments) {
      const tex = this.textures.get(handle.id);
      if (!tex) throw new Error(`Texture not found: ${handle.id}`);
      colorViews.push(tex.view);
    }

    let depthView: GPUTextureView | undefined;
    if (depthAttachment) {
      const depthTex = this.textures.get(depthAttachment.id);
      if (!depthTex) throw new Error(`Depth texture not found: ${depthAttachment.id}`);
      depthView = depthTex.view;
    }

    this.framebuffers.set(id, {
      id,
      colorAttachments: colorViews,
      depthStencilAttachment: depthView,
      width,
      height,
    });

    return { __brand: 'BackendFramebuffer', id } as BackendFramebufferHandle;
  }

  destroyFramebuffer(handle: BackendFramebufferHandle): void {
    this.framebuffers.delete(handle.id);
  }

  createSampler(
    id: string,
    config: { minFilter?: string; magFilter?: string; wrapS?: string; wrapT?: string }
  ): BackendSamplerHandle {
    if (!this.ctx.device) throw new Error(WebGPUErrors.DEVICE_NOT_INITIALIZED);

    const sampler = this.ctx.device.createSampler({
      minFilter: config.minFilter === 'linear' ? 'linear' : 'nearest',
      magFilter: config.magFilter === 'linear' ? 'linear' : 'nearest',
      addressModeU: config.wrapS === 'repeat' ? 'repeat' : 'clamp-to-edge',
      addressModeV: config.wrapT === 'repeat' ? 'repeat' : 'clamp-to-edge',
      label: `Sampler: ${id}`,
    });

    this.samplers.set(id, sampler);
    return { __brand: 'BackendSampler', id } as BackendSamplerHandle;
  }

  destroySampler(handle: BackendSamplerHandle): void {
    this.samplers.delete(handle.id);
  }

  getShader(id: string): WebGPUShader | undefined {
    return this.shaders.get(id);
  }

  getBuffer(id: string) {
    return this.buffers.get(id);
  }

  getTexture(id: string): WebGPUTexture | undefined {
    return this.textures.get(id);
  }

  getFramebuffer(id: string): WebGPUFramebuffer | undefined {
    return this.framebuffers.get(id);
  }

  getSampler(id: string): GPUSampler | undefined {
    return this.samplers.get(id);
  }

  private getWebGPUTextureFormat(format: TextureFormat): GPUTextureFormat {
    const formatMap: Record<string, GPUTextureFormat> = {
      rgba8unorm: 'rgba8unorm',
      bgra8unorm: 'bgra8unorm',
      rgba16float: 'rgba16float',
      rgba32float: 'rgba32float',
      depth24plus: 'depth24plus',
      r8unorm: 'r8unorm',
    };
    return formatMap[format] || 'rgba8unorm';
  }

  /**
   * Get bytes per pixel for a texture format
   * Comprehensive coverage of all WebGPU texture formats
   *
   * @throws Error if format is not supported or requires special handling
   */
  private getBytesPerPixel(format: GPUTextureFormat): number {
    switch (format) {
      // 8-bit formats (1 byte per pixel)
      case 'r8unorm':
      case 'r8snorm':
      case 'r8uint':
      case 'r8sint':
        return 1;

      // 16-bit formats (2 bytes per pixel)
      case 'r16uint':
      case 'r16sint':
      case 'r16float':
      case 'rg8unorm':
      case 'rg8snorm':
      case 'rg8uint':
      case 'rg8sint':
        return 2;

      // 32-bit formats (4 bytes per pixel)
      case 'r32uint':
      case 'r32sint':
      case 'r32float':
      case 'rg16uint':
      case 'rg16sint':
      case 'rg16float':
      case 'rgba8unorm':
      case 'rgba8unorm-srgb':
      case 'rgba8snorm':
      case 'rgba8uint':
      case 'rgba8sint':
      case 'bgra8unorm':
      case 'bgra8unorm-srgb':
      case 'rgb9e5ufloat':
      case 'rgb10a2unorm':
      case 'rg11b10ufloat':
      case 'depth32float':
      case 'depth24plus':
      case 'depth24plus-stencil8':
        return 4;

      // 64-bit formats (8 bytes per pixel)
      case 'rg32uint':
      case 'rg32sint':
      case 'rg32float':
      case 'rgba16uint':
      case 'rgba16sint':
      case 'rgba16float':
        return 8;

      // 128-bit formats (16 bytes per pixel)
      case 'rgba32uint':
      case 'rgba32sint':
      case 'rgba32float':
        return 16;

      // Special depth/stencil formats
      case 'stencil8':
        return 1;
      case 'depth16unorm':
        return 2;
      case 'depth32float-stencil8':
        return 5; // 4 bytes depth + 1 byte stencil

      // Compressed formats - throw error, require special handling
      case 'bc1-rgba-unorm':
      case 'bc1-rgba-unorm-srgb':
      case 'bc2-rgba-unorm':
      case 'bc2-rgba-unorm-srgb':
      case 'bc3-rgba-unorm':
      case 'bc3-rgba-unorm-srgb':
      case 'bc4-r-unorm':
      case 'bc4-r-snorm':
      case 'bc5-rg-unorm':
      case 'bc5-rg-snorm':
      case 'bc6h-rgb-ufloat':
      case 'bc6h-rgb-float':
      case 'bc7-rgba-unorm':
      case 'bc7-rgba-unorm-srgb':
      case 'etc2-rgb8unorm':
      case 'etc2-rgb8unorm-srgb':
      case 'etc2-rgb8a1unorm':
      case 'etc2-rgb8a1unorm-srgb':
      case 'etc2-rgba8unorm':
      case 'etc2-rgba8unorm-srgb':
      case 'eac-r11unorm':
      case 'eac-r11snorm':
      case 'eac-rg11unorm':
      case 'eac-rg11snorm':
      case 'astc-4x4-unorm':
      case 'astc-4x4-unorm-srgb':
      case 'astc-5x4-unorm':
      case 'astc-5x4-unorm-srgb':
      case 'astc-5x5-unorm':
      case 'astc-5x5-unorm-srgb':
      case 'astc-6x5-unorm':
      case 'astc-6x5-unorm-srgb':
      case 'astc-6x6-unorm':
      case 'astc-6x6-unorm-srgb':
      case 'astc-8x5-unorm':
      case 'astc-8x5-unorm-srgb':
      case 'astc-8x6-unorm':
      case 'astc-8x6-unorm-srgb':
      case 'astc-8x8-unorm':
      case 'astc-8x8-unorm-srgb':
      case 'astc-10x5-unorm':
      case 'astc-10x5-unorm-srgb':
      case 'astc-10x6-unorm':
      case 'astc-10x6-unorm-srgb':
      case 'astc-10x8-unorm':
      case 'astc-10x8-unorm-srgb':
      case 'astc-10x10-unorm':
      case 'astc-10x10-unorm-srgb':
      case 'astc-12x10-unorm':
      case 'astc-12x10-unorm-srgb':
      case 'astc-12x12-unorm':
      case 'astc-12x12-unorm-srgb':
        throw new Error(`Compressed texture format '${format}' requires block-based size calculation. Use getBlockSize() instead.`);

      default:
        throw new Error(`Unsupported texture format: ${format}. Add format to getBytesPerPixel() if needed.`);
    }
  }

  /**
   * Calculate bucket size for buffer pooling
   * Duplicates GPUBufferPool's private findBucket() logic
   */
  private calculateBucketSize(sizeBytes: number): number {
    const MIN_BUCKET_SIZE = 256; // RenderingConstants.MIN_POOLED_BUFFER_SIZE
    const MAX_BUCKET_SIZE = 16 * 1024 * 1024; // RenderingConstants.MAX_POOLED_BUFFER_SIZE

    if (sizeBytes <= MIN_BUCKET_SIZE) {
      return MIN_BUCKET_SIZE;
    }

    if (sizeBytes >= MAX_BUCKET_SIZE) {
      return MAX_BUCKET_SIZE;
    }

    // Round up to next power of 2
    return Math.pow(2, Math.ceil(Math.log2(sizeBytes)));
  }

  dispose(): void {
    // Clear buffers and prevent double-release by using entries iterator
    for (const [id, bufferData] of this.buffers.entries()) {
      if (bufferData.pooled && bufferData.bufferUsageType) {
        this.config.bufferPool.release(bufferData.buffer, bufferData.bufferUsageType, bufferData.requestedSize);
      } else {
        bufferData.buffer.destroy();
      }
      this.buffers.delete(id); // Remove immediately to prevent double-release
    }

    for (const textureData of this.textures.values()) {
      textureData.texture.destroy();
    }
    this.textures.clear();

    this.shaders.clear();
    this.framebuffers.clear();
    this.samplers.clear();
  }
}
