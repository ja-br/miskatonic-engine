/**
 * WebGPU Modern API - Epic RENDERING-05 Task 5.3
 * Epic 3.14 modern API (bind groups, pipelines)
 */

import type {
  BackendBindGroupLayoutHandle,
  BackendBindGroupHandle,
  BackendPipelineHandle,
  RenderPipelineDescriptor,
  ComputePipelineDescriptor,
  BindGroupResources,
  BackendBufferHandle,
  BackendTextureHandle,
} from '../IRendererBackend.js';
import type { BindGroupLayoutDescriptor } from '../../BindGroupDescriptors.js';
import type { WebGPUContext, ModuleConfig, WebGPUShader, WebGPUBuffer, WebGPUTexture } from './WebGPUTypes.js';
import { WebGPUErrors } from './WebGPUTypes.js';

export class WebGPUModernAPI {
  private bindGroupLayouts = new Map<string, GPUBindGroupLayout>();
  private bindGroups = new Map<string, GPUBindGroup>();
  private pipelines = new Map<string, { pipeline: GPURenderPipeline | GPUComputePipeline; type: 'render' | 'compute' }>();
  private nextResourceId = 1;

  constructor(
    private ctx: WebGPUContext,
    private getShader: (id: string) => WebGPUShader | undefined,
    private getBuffer: (id: string) => WebGPUBuffer | undefined,
    private getTexture: (id: string) => WebGPUTexture | undefined,
    private getSampler: (id: string) => GPUSampler | undefined,
    private _config: ModuleConfig
  ) {}

  /**
   * Create bind group layout - extracted from WebGPUBackend.ts lines 1318-1342
   */
  createBindGroupLayout(descriptor: BindGroupLayoutDescriptor): BackendBindGroupLayoutHandle {
    if (!this.ctx.device) {
      throw new Error(WebGPUErrors.DEVICE_NOT_INITIALIZED);
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

    const layout = this.ctx.device.createBindGroupLayout({
      label: `BindGroupLayout: ${id}`,
      entries,
    });

    this.bindGroupLayouts.set(id, layout);
    return { __brand: 'BackendBindGroupLayout', id } as BackendBindGroupLayoutHandle;
  }

  /**
   * Create bind group - extracted from WebGPUBackend.ts lines 1354-1403
   */
  createBindGroup(
    layout: BackendBindGroupLayoutHandle,
    resources: BindGroupResources
  ): BackendBindGroupHandle {
    if (!this.ctx.device) {
      throw new Error(WebGPUErrors.DEVICE_NOT_INITIALIZED);
    }

    const gpuLayout = this.bindGroupLayouts.get(layout.id);
    if (!gpuLayout) {
      throw new Error(`Bind group layout ${layout.id} not found`);
    }

    const id = `bindGroup_${this.nextResourceId++}`;

    // Convert resources to WebGPU bind group entries
    const entries: GPUBindGroupEntry[] = resources.bindings.map(binding => {
      const resource = binding.resource;

      // Check for buffer
      if ('__brand' in resource && resource.__brand === 'BackendBuffer') {
        const bufferHandle = resource as BackendBufferHandle;
        const bufferData = this.getBuffer(bufferHandle.id);
        if (!bufferData) {
          throw new Error(`Buffer ${bufferHandle.id} not found`);
        }
        return {
          binding: binding.binding,
          resource: { buffer: bufferData.buffer },
        };
      }

      // Check for sampler
      if ('__brand' in resource && resource.__brand === 'BackendSampler') {
        const samplerHandle = resource as import('../IRendererBackend').BackendSamplerHandle;
        const sampler = this.getSampler(samplerHandle.id);
        if (!sampler) {
          throw new Error(`Sampler ${samplerHandle.id} not found`);
        }
        return {
          binding: binding.binding,
          resource: sampler,
        };
      }

      // Check for texture (or combined texture+sampler for backward compat)
      if ('texture' in resource) {
        const textureBinding = resource as { texture: BackendTextureHandle; sampler?: any };
        const textureData = this.getTexture(textureBinding.texture.id);
        if (!textureData) {
          throw new Error(`Texture ${textureBinding.texture.id} not found`);
        }
        return {
          binding: binding.binding,
          resource: textureData.view,
        };
      }

      throw new Error(`Unknown resource type for binding ${binding.binding}`);
    });

    const bindGroup = this.ctx.device.createBindGroup({
      label: `BindGroup: ${id}`,
      layout: gpuLayout,
      entries,
    });

    this.bindGroups.set(id, bindGroup);
    return { __brand: 'BackendBindGroup', id } as BackendBindGroupHandle;
  }

  /**
   * Create render pipeline - extracted from WebGPUBackend.ts lines 1415-1517
   */
  createRenderPipeline(descriptor: RenderPipelineDescriptor): BackendPipelineHandle {
    if (!this.ctx.device) {
      throw new Error(WebGPUErrors.DEVICE_NOT_INITIALIZED);
    }

    const id = `pipeline_${this.nextResourceId++}`;

    try {
      // Get shader
      const shader = this.getShader(descriptor.shader.id);
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
      const pipelineLayout = this.ctx.device.createPipelineLayout({
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
      const pipeline = this.ctx.device.createRenderPipeline({
        label: descriptor.label || `RenderPipeline: ${id}`,
        layout: pipelineLayout,
        vertex: {
          module: shader.module,
          entryPoint: 'vs_main',
          buffers: gpuVertexLayouts,
        },
        fragment: {
          module: shader.module,
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
   * Create compute pipeline - extracted from WebGPUBackend.ts lines 1522-1576
   */
  createComputePipeline(descriptor: ComputePipelineDescriptor): BackendPipelineHandle {
    if (!this.ctx.device) {
      throw new Error(WebGPUErrors.DEVICE_NOT_INITIALIZED);
    }

    const id = `pipeline_${this.nextResourceId++}`;

    try {
      // Get shader
      const shader = this.getShader(descriptor.shader.id);
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
      const pipelineLayout = this.ctx.device.createPipelineLayout({
        label: `ComputePipelineLayout: ${id}`,
        bindGroupLayouts,
      });

      // Create compute pipeline
      const pipeline = this.ctx.device.createComputePipeline({
        label: descriptor.label || `ComputePipeline: ${id}`,
        layout: pipelineLayout,
        compute: {
          module: shader.module,
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
   * Delete resources
   */
  deleteBindGroupLayout(handle: BackendBindGroupLayoutHandle): void {
    this.bindGroupLayouts.delete(handle.id);
  }

  deleteBindGroup(handle: BackendBindGroupHandle): void {
    this.bindGroups.delete(handle.id);
  }

  deletePipeline(handle: BackendPipelineHandle): void {
    this.pipelines.delete(handle.id);
  }

  getBindGroupLayout(id: string): GPUBindGroupLayout | undefined {
    return this.bindGroupLayouts.get(id);
  }

  getBindGroup(id: string): GPUBindGroup | undefined {
    return this.bindGroups.get(id);
  }

  getPipeline(id: string): { pipeline: GPURenderPipeline | GPUComputePipeline; type: 'render' | 'compute' } | undefined {
    return this.pipelines.get(id);
  }

  /**
   * Helper: Convert visibility flags - extracted from WebGPUBackend.ts lines 1665-1681
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
   * Helper: Convert binding type - extracted from WebGPUBackend.ts lines 1686-1699
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
}
