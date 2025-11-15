/**
 * WebGPU Pipeline Manager - Epic RENDERING-05 Task 5.3
 * Manages pipeline caching, bind group layouts, vertex layouts
 */

import type { VertexLayout } from '../../types.js';
import type { WebGPUContext, WebGPUShader } from './WebGPUTypes.js';

interface PipelineCacheEntry {
  pipeline: GPURenderPipeline;
  vertexLayoutHash: string;
}

export class WebGPUPipelineManager {
  private pipelineCache = new Map<string, PipelineCacheEntry>();

  constructor(
    private ctx: WebGPUContext,
    private getShader: (id: string) => WebGPUShader | undefined
  ) {}

  /**
   * Get or create cached pipeline for shader + vertex layout combination
   */
  getPipeline(
    shaderId: string,
    vertexLayout: VertexLayout,
    isInstancedShader: boolean
  ): GPURenderPipeline {
    if (!this.ctx.device) {
      throw new Error('Device not initialized');
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
    const shader = this.getShader(shaderId);
    if (!shader) {
      throw new Error(`Shader ${shaderId} not found`);
    }

    // Build vertex buffers from layout
    const vertexBuffers = this.buildVertexBuffers(vertexLayout, isInstancedShader);

    // Create pipeline layout
    const pipelineLayout = this.ctx.device.createPipelineLayout({
      label: `PipelineLayout: ${cacheKey}`,
      bindGroupLayouts: [(shader as any).bindGroupLayout], // FIXME: WebGPUShader needs bindGroupLayout
    });

    if (!this.ctx.preferredFormat) {
      throw new Error('Preferred format not set');
    }

    // Create pipeline
    const pipeline = this.ctx.device.createRenderPipeline({
      label: `Pipeline: ${cacheKey}`,
      layout: pipelineLayout,
      vertex: {
        module: shader.module,
        entryPoint: 'vs_main',
        buffers: vertexBuffers,
      },
      fragment: {
        module: shader.module,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this.ctx.preferredFormat,
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
  hashVertexLayout(layout: VertexLayout): string {
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

  /**
   * Clear pipeline cache
   */
  clearCache(): void {
    this.pipelineCache.clear();
  }
}
