/**
 * PipelineBuilder - Epic RENDERING-06 Task 6.2
 *
 * Fluent builder for render pipelines.
 * Simplifies pipeline creation with sensible defaults and validation.
 * Reduces 30+ lines to 5-7 lines with type safety.
 *
 * @example
 * ```typescript
 * // Transparent rendering
 * const pipeline = PipelineBuilder.Transparent(shaderModule, vertexLayout)
 *   .bindGroupLayout(sceneLayout)
 *   .bindGroupLayout(materialLayout)
 *   .build(device);
 * ```
 */

import type {
  BackendShaderHandle,
  VertexBufferLayout,
  BackendBindGroupLayoutHandle,
  BackendPipelineHandle
} from '../backends/IRendererBackend';
import type { PipelineStateDescriptor } from '../PipelineStateDescriptor';

/**
 * Blend mode presets
 */
export type BlendMode = 'opaque' | 'transparent' | 'additive' | 'premultiplied';

/**
 * Common topology types
 */
export type TopologyMode = 'triangle-list' | 'triangle-strip' | 'line-list' | 'line-strip' | 'point-list';

/**
 * Cull modes
 */
export type CullMode = 'none' | 'front' | 'back';

/**
 * Depth compare functions
 */
export type DepthCompare = 'never' | 'less' | 'equal' | 'less-equal' | 'greater' | 'not-equal' | 'greater-equal' | 'always';

/**
 * Descriptor for pipeline builder (simplified from WebGPU native)
 */
interface SimplifiedPipelineDescriptor {
  label?: string;
  shader?: BackendShaderHandle;
  vertexLayouts: VertexBufferLayout[];
  bindGroupLayouts: BackendBindGroupLayoutHandle[];
  colorFormat: 'bgra8unorm' | 'rgba8unorm';
  depthFormat?: 'depth16unorm' | 'depth24plus' | 'depth24plus-stencil8';
  depthWriteEnabled?: boolean;
  depthCompare?: DepthCompare;
  cullMode?: CullMode;
  topology?: TopologyMode;
  blendMode?: BlendMode;
  alphaToCoverage?: boolean;
  multisampleCount?: number;
}

/**
 * Fluent builder for render pipelines
 */
export class PipelineBuilder {
  private descriptor: SimplifiedPipelineDescriptor = {
    vertexLayouts: [],
    bindGroupLayouts: [],
    colorFormat: 'bgra8unorm',
    cullMode: 'back',
    topology: 'triangle-list',
    depthCompare: 'less'
  };

  /**
   * Set shader module
   */
  shader(handle: BackendShaderHandle): this {
    this.descriptor.shader = handle;
    return this;
  }

  /**
   * Set debug label
   */
  label(label: string): this {
    this.descriptor.label = label;
    return this;
  }

  /**
   * Add vertex buffer layout
   */
  vertexLayout(layout: VertexBufferLayout): this {
    this.descriptor.vertexLayouts.push(layout);
    return this;
  }

  /**
   * Add bind group layout
   */
  bindGroupLayout(layout: BackendBindGroupLayoutHandle): this {
    this.descriptor.bindGroupLayouts.push(layout);
    return this;
  }

  /**
   * Set color attachment format
   */
  colorFormat(format: 'bgra8unorm' | 'rgba8unorm'): this {
    this.descriptor.colorFormat = format;
    return this;
  }

  /**
   * Enable depth testing
   */
  depthStencil(
    format: 'depth16unorm' | 'depth24plus' | 'depth24plus-stencil8' = 'depth16unorm',
    depthWrite = true,
    depthCompare: DepthCompare = 'less'
  ): this {
    this.descriptor.depthFormat = format;
    this.descriptor.depthWriteEnabled = depthWrite;
    this.descriptor.depthCompare = depthCompare;
    return this;
  }

  /**
   * Configure blending
   */
  blend(mode: BlendMode): this {
    this.descriptor.blendMode = mode;
    return this;
  }

  /**
   * Set primitive topology
   */
  topology(topology: TopologyMode): this {
    this.descriptor.topology = topology;
    return this;
  }

  /**
   * Set culling mode
   */
  cullMode(mode: CullMode): this {
    this.descriptor.cullMode = mode;
    return this;
  }

  /**
   * Enable alpha to coverage (MSAA required)
   */
  alphaToCoverage(enabled = true): this {
    this.descriptor.alphaToCoverage = enabled;
    if (enabled && !this.descriptor.multisampleCount) {
      this.descriptor.multisampleCount = 4;
    }
    return this;
  }

  /**
   * Set multisampling
   */
  multisample(count: number, alphaToCoverage = false): this {
    this.descriptor.multisampleCount = count;
    this.descriptor.alphaToCoverage = alphaToCoverage;
    return this;
  }

  /**
   * Build pipeline state descriptor
   * Returns descriptor that can be used with backend.createRenderPipeline()
   */
  buildDescriptor(): {
    shader: BackendShaderHandle;
    vertexLayouts: VertexBufferLayout[];
    bindGroupLayouts: BackendBindGroupLayoutHandle[];
    pipelineState: PipelineStateDescriptor;
    colorFormat: 'bgra8unorm' | 'rgba8unorm';
    depthFormat?: 'depth16unorm' | 'depth24plus' | 'depth24plus-stencil8';
    label?: string;
  } {
    this.validate();

    // Build correct PipelineStateDescriptor structure
    const pipelineState: PipelineStateDescriptor = {
      topology: this.descriptor.topology || 'triangle-list',
      blend: this.getBlendState(this.descriptor.blendMode || 'opaque'),
      depthStencil: this.descriptor.depthFormat ? {
        depthWriteEnabled: this.descriptor.depthWriteEnabled ?? true,
        depthCompare: this.descriptor.depthCompare || 'less'
      } : undefined,
      rasterization: {
        cullMode: this.descriptor.cullMode || 'back',
        frontFace: 'ccw'
      },
      multisample: this.descriptor.multisampleCount ? {
        count: this.descriptor.multisampleCount,
        alphaToCoverageEnabled: this.descriptor.alphaToCoverage
      } : undefined
    };

    return {
      shader: this.descriptor.shader!,
      vertexLayouts: this.descriptor.vertexLayouts,
      bindGroupLayouts: this.descriptor.bindGroupLayouts,
      pipelineState,
      colorFormat: this.descriptor.colorFormat,
      depthFormat: this.descriptor.depthFormat,
      label: this.descriptor.label
    };
  }

  /**
   * Preset: Opaque rendering (default)
   */
  static Opaque(shader: BackendShaderHandle, layout: VertexBufferLayout): PipelineBuilder {
    return new PipelineBuilder()
      .shader(shader)
      .vertexLayout(layout)
      .colorFormat('bgra8unorm')
      .depthStencil('depth16unorm', true, 'less')
      .cullMode('back')
      .blend('opaque');
  }

  /**
   * Preset: Transparent rendering
   */
  static Transparent(shader: BackendShaderHandle, layout: VertexBufferLayout): PipelineBuilder {
    return new PipelineBuilder()
      .shader(shader)
      .vertexLayout(layout)
      .colorFormat('bgra8unorm')
      .depthStencil('depth16unorm', false, 'less') // No depth write!
      .cullMode('none')
      .blend('transparent');
  }

  /**
   * Preset: Additive blending (particles, lights)
   */
  static Additive(shader: BackendShaderHandle, layout: VertexBufferLayout): PipelineBuilder {
    return new PipelineBuilder()
      .shader(shader)
      .vertexLayout(layout)
      .colorFormat('bgra8unorm')
      .depthStencil('depth16unorm', false, 'less')
      .cullMode('none')
      .blend('additive');
  }

  /**
   * Preset: Wireframe rendering
   */
  static Wireframe(shader: BackendShaderHandle, layout: VertexBufferLayout): PipelineBuilder {
    return new PipelineBuilder()
      .shader(shader)
      .vertexLayout(layout)
      .colorFormat('bgra8unorm')
      .depthStencil('depth16unorm', true, 'less')
      .topology('line-list')
      .cullMode('none')
      .blend('opaque');
  }

  /**
   * Preset: Premultiplied alpha
   */
  static Premultiplied(shader: BackendShaderHandle, layout: VertexBufferLayout): PipelineBuilder {
    return new PipelineBuilder()
      .shader(shader)
      .vertexLayout(layout)
      .colorFormat('bgra8unorm')
      .depthStencil('depth16unorm', false, 'less')
      .cullMode('none')
      .blend('premultiplied');
  }

  /**
   * Preset: Point cloud rendering
   */
  static PointCloud(shader: BackendShaderHandle, layout: VertexBufferLayout): PipelineBuilder {
    return new PipelineBuilder()
      .shader(shader)
      .vertexLayout(layout)
      .colorFormat('bgra8unorm')
      .depthStencil('depth16unorm', true, 'less')
      .topology('point-list')
      .cullMode('none')
      .blend('opaque');
  }

  // Private helpers

  private validate(): void {
    if (!this.descriptor.shader) {
      throw new Error('Shader not set. Call shader() first.');
    }
    if (this.descriptor.vertexLayouts.length === 0) {
      console.warn('No vertex layouts added. Did you forget vertexLayout()?');
    }

    // Validate multisample count (must be power of 2 between 1-16)
    if (this.descriptor.multisampleCount !== undefined) {
      const count = this.descriptor.multisampleCount;
      // Check: count >= 1, count <= 16, and count is power of 2
      if (count < 1 || count > 16 || (count & (count - 1)) !== 0) {
        throw new Error(
          `Invalid multisample count: ${count}. Must be power of 2 between 1-16 (1, 2, 4, 8, 16). ` +
          `Note: Actual support depends on texture format and device capabilities.`
        );
      }
    }

    // Error on blend + depth write contradictions (common rendering mistake)
    if (this.descriptor.blendMode && this.descriptor.blendMode !== 'opaque') {
      if (this.descriptor.depthWriteEnabled === true) {
        throw new Error(
          `Transparent blend mode '${this.descriptor.blendMode}' with depth write enabled will cause sorting artifacts. ` +
          `Disable depth write with depthStencil(format, false) or use the Transparent/Additive presets which handle this correctly.`
        );
      }
    }

    // Check for duplicate shader locations in vertex layouts
    const usedLocations = new Set<number>();
    for (const layout of this.descriptor.vertexLayouts) {
      for (const attr of layout.attributes) {
        if (usedLocations.has(attr.shaderLocation)) {
          throw new Error(`Duplicate shader location ${attr.shaderLocation} in vertex layouts. Each attribute must have a unique location.`);
        }
        usedLocations.add(attr.shaderLocation);
      }
    }

    // Validate alphaToCoverage requires multisampling
    if (this.descriptor.alphaToCoverage && (!this.descriptor.multisampleCount || this.descriptor.multisampleCount === 1)) {
      throw new Error('alphaToCoverage requires multisample count > 1. Call multisample() or alphaToCoverage() which auto-enables 4x MSAA.');
    }
  }

  private getBlendState(mode: BlendMode): PipelineStateDescriptor['blend'] {
    switch (mode) {
      case 'transparent':
        return {
          enabled: true,
          srcFactor: 'src-alpha',
          dstFactor: 'one-minus-src-alpha',
          operation: 'add'
        };

      case 'additive':
        return {
          enabled: true,
          srcFactor: 'one',
          dstFactor: 'one',
          operation: 'add'
        };

      case 'premultiplied':
        return {
          enabled: true,
          srcFactor: 'one',
          dstFactor: 'one-minus-src-alpha',
          operation: 'add'
        };

      case 'opaque':
      default:
        return {
          enabled: false,
          srcFactor: 'one',
          dstFactor: 'zero',
          operation: 'add'
        };
    }
  }
}
