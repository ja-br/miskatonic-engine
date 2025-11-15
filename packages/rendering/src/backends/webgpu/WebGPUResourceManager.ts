/**
 * WebGPU Resource Manager - Epic RENDERING-05 Task 5.3
 * Manages lifecycle of shaders, buffers, textures, framebuffers
 */

import type {
  BackendShaderHandle,
  BackendBufferHandle,
  BackendTextureHandle,
  BackendFramebufferHandle,
} from '../IRendererBackend.js';
import type { ShaderSource, BufferUsage, TextureFormat } from '../../types.js';
import type { WebGPUContext, ModuleConfig, WebGPUShader, WebGPUBuffer, WebGPUTexture, WebGPUFramebuffer } from './WebGPUTypes.js';
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
    if (!this.ctx.device) throw new Error('Device not initialized');

    const shaderCode = source.vertex || source.fragment || '';
    const shaderModule = this.ctx.device.createShaderModule({
      code: shaderCode,
      label: `Shader: ${id}`,
    });

    // Parse and cache shader reflection data
    this.config.reflectionCache.getOrCompute(shaderCode, this.config.reflectionParser);

    this.shaders.set(id, {
      id,
      module: shaderModule,
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
    if (!this.ctx.device) throw new Error('Device not initialized');

    const shouldPool = mode === 'dynamic' && (type === 'vertex' || type === 'index');
    const bufferUsageType = type === 'vertex' ? BufferUsageType.VERTEX : type === 'index' ? BufferUsageType.INDEX : undefined;
    const category = type === 'uniform' ? VRAMCategory.UNIFORM_BUFFERS : type === 'storage' ? VRAMCategory.STORAGE_BUFFERS : VRAMCategory.VERTEX_BUFFERS;

    let buffer: GPUBuffer;

    if (shouldPool && bufferUsageType) {
      const bucketSize = (this.config.bufferPool as any).findBucket(dataArray.byteLength);
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
    if (!this.ctx.device) throw new Error('Device not initialized');
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
    if (!this.ctx.device) throw new Error('Device not initialized');

    const gpuFormat = this.getWebGPUTextureFormat(format);
    const textureSize = width * height * 4;

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
      this.ctx.device.queue.writeTexture(
        { texture },
        data,
        { bytesPerRow: width * 4 },
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

  createSampler(config: { minFilter?: string; magFilter?: string; wrapS?: string; wrapT?: string }): GPUSampler {
    if (!this.ctx.device) throw new Error('Device not initialized');
    return this.ctx.device.createSampler({
      minFilter: config.minFilter === 'linear' ? 'linear' : 'nearest',
      magFilter: config.magFilter === 'linear' ? 'linear' : 'nearest',
      addressModeU: config.wrapS === 'repeat' ? 'repeat' : 'clamp-to-edge',
      addressModeV: config.wrapT === 'repeat' ? 'repeat' : 'clamp-to-edge',
    });
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

  private getWebGPUTextureFormat(format: TextureFormat): GPUTextureFormat {
    const formatMap: Record<string, GPUTextureFormat> = {
      rgba8unorm: 'rgba8unorm',
      bgra8unorm: 'bgra8unorm',
      rgba16float: 'rgba16float',
      rgba32float: 'rgba32float',
      depth24plus: 'depth24plus',
    };
    return formatMap[format] || 'rgba8unorm';
  }

  dispose(): void {
    for (const bufferData of this.buffers.values()) {
      if (bufferData.pooled && bufferData.bufferUsageType) {
        this.config.bufferPool.release(bufferData.buffer, bufferData.bufferUsageType, bufferData.requestedSize);
      } else {
        bufferData.buffer.destroy();
      }
    }
    this.buffers.clear();

    for (const textureData of this.textures.values()) {
      textureData.texture.destroy();
    }
    this.textures.clear();

    this.shaders.clear();
    this.framebuffers.clear();
    this.samplers.clear();
  }
}
