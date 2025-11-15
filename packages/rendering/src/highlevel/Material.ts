/**
 * Material System for High-Level Rendering API
 * Epic 3.14: High-Level Rendering API Wrapper - Task 2.2 & 2.3
 */

import {
  generateId,
  loadShaderSource,
  serializeUniform,
} from './utils';
import type {
  IRendererBackend,
  BackendPipelineHandle,
  BackendBindGroupHandle,
  BackendBindGroupLayoutHandle,
  BackendTextureHandle,
  BackendBufferHandle,
} from '../backends/IRendererBackend';
import { OPAQUE_PIPELINE_STATE, ALPHA_BLEND_PIPELINE_STATE } from '../PipelineStateDescriptor';
import type { ShaderSource } from '../types';

// Forward declaration
export interface HighLevelRenderer {
  backend: IRendererBackend;
  bindGroupPool: any;
  getBuiltinShaders(): Map<string, string>;
  loadTexture(path: string): Promise<BackendTextureHandle>;
}

export interface MaterialConfig {
  shader: string; // Built-in name or .wgsl URL
  uniforms?: Record<string, UniformValue>;
  textures?: Record<string, TextureConfig>;
  pipelineState?: 'opaque' | 'transparent' | 'additive';
  label?: string;
}

export interface UniformValue {
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'mat4';
  value: number | number[] | Float32Array;
}

export interface TextureConfig {
  texture: BackendTextureHandle | string; // Handle or asset path
  sampler?: {
    minFilter?: 'nearest' | 'linear';
    magFilter?: 'nearest' | 'linear';
    addressModeU?: 'repeat' | 'clamp-to-edge' | 'mirror-repeat';
    addressModeV?: 'repeat' | 'clamp-to-edge' | 'mirror-repeat';
  };
}

/**
 * Material class - manages shaders, pipelines, and uniforms
 *
 * Usage:
 * ```typescript
 * const material = Material.Textured(renderer, { texture: 'crate.png' });
 * await material.initialize();
 * const { pipeline, bindGroups } = material.prepare(sceneBindGroup);
 * ```
 */
export class Material {
  private pipeline?: BackendPipelineHandle;
  private materialBindGroupLayoutHandle?: BackendBindGroupLayoutHandle;
  private sceneBindGroupLayoutHandle?: BackendBindGroupLayoutHandle;
  private uniformBuffers = new Map<string, { handle: BackendBufferHandle; size: number }>();
  private textures = new Map<string, BackendTextureHandle>();
  private uniformData = new Map<string, UniformValue>();
  private dirty = new Set<string>();
  private initialized = false;
  private materialBindGroup?: BackendBindGroupHandle;
  private materialBindGroupId?: number; // For pool release tracking

  public readonly id: string;
  public readonly config: MaterialConfig;

  constructor(private renderer: HighLevelRenderer, config: MaterialConfig) {
    this.id = generateId('material');
    this.config = { ...config }; // Copy to avoid mutation
  }

  /**
   * Initialize material resources (async for texture loading)
   * @throws Error if shader compilation fails or resources cannot be created
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load and compile shader
      const shaderSource = await loadShaderSource(
        this.config.shader,
        this.renderer.getBuiltinShaders()
      );

      const shaderSourceObj: ShaderSource = {
        vertex: shaderSource,
        fragment: shaderSource,
      };

      const { handle: shader, reflection } =
        this.renderer.backend.createShaderWithReflection(
          `${this.config.label || this.id}_shader`,
          shaderSourceObj
        );

      // Create bind group layouts from reflection
      // Group 0 = Scene (handled by renderer)
      // Group 1 = Material (handled here)
      if (reflection.bindGroupLayouts.length < 2) {
        throw new Error(
          `Shader must have at least 2 bind groups (scene + material). Found: ${reflection.bindGroupLayouts.length}`
        );
      }

      const sceneLayoutDesc = reflection.bindGroupLayouts[0];
      const materialLayoutDesc = reflection.bindGroupLayouts[1];

      this.sceneBindGroupLayoutHandle =
        this.renderer.backend.createBindGroupLayout(sceneLayoutDesc);
      this.materialBindGroupLayoutHandle =
        this.renderer.backend.createBindGroupLayout(materialLayoutDesc);

      // Create pipeline
      const pipelineStateKey = this.config.pipelineState || 'opaque';
      const pipelineState =
        pipelineStateKey === 'transparent' || pipelineStateKey === 'additive'
          ? ALPHA_BLEND_PIPELINE_STATE
          : OPAQUE_PIPELINE_STATE;

      const vertexLayout = this.getStandardVertexLayout();
      this.pipeline = this.renderer.backend.createRenderPipeline({
        label: this.config.label || this.id,
        shader,
        bindGroupLayouts: [
          this.sceneBindGroupLayoutHandle,
          this.materialBindGroupLayoutHandle,
        ],
        vertexLayouts: [vertexLayout],
        pipelineState,
        colorFormat: 'bgra8unorm',
        depthFormat: this.renderer.backend.getDepthFormat() as 'depth16unorm' | 'depth24plus' | 'depth24plus-stencil8',
      });

      // Load textures
      await this.loadTextures();

      // Create uniform buffers
      this.createUniformBuffers();

      this.initialized = true;
    } catch (error) {
      // Clean up partial initialization
      this.dispose();
      throw new Error(
        `Material initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set uniform value (marks dirty for next update)
   * @throws Error if uniform doesn't exist
   */
  setUniform(name: string, value: number | number[] | Float32Array): void {
    if (!this.uniformData.has(name)) {
      throw new Error(
        `Uniform '${name}' not found in material '${this.config.label || this.id}'`
      );
    }

    const uniform = this.uniformData.get(name)!;
    uniform.value = value;
    this.dirty.add('uniforms');
  }

  /**
   * Set texture (marks dirty for bind group recreation)
   */
  setTexture(slot: string, texture: BackendTextureHandle): void {
    this.textures.set(slot, texture);
    this.dirty.add('textures');
  }

  /**
   * Prepare material for rendering (update dirty resources)
   * Returns pipeline and bind group for draw command
   * @throws Error if not initialized
   */
  prepare(sceneBindGroup: BackendBindGroupHandle): {
    pipeline: BackendPipelineHandle;
    bindGroups: Map<number, BackendBindGroupHandle>;
  } {
    if (!this.initialized || !this.pipeline || !this.materialBindGroupLayoutHandle) {
      throw new Error('Material not initialized. Call initialize() first.');
    }

    // Update uniforms if dirty
    if (this.dirty.has('uniforms')) {
      this.updateUniformBuffers();
    }

    // Recreate bind group if textures changed or first time
    if (this.dirty.has('textures') || !this.materialBindGroup) {
      this.updateMaterialBindGroup();
    }

    this.dirty.clear();

    return {
      pipeline: this.pipeline,
      bindGroups: new Map([
        [0, sceneBindGroup],
        [1, this.materialBindGroup!],
      ]),
    };
  }

  /**
   * Clean up GPU resources
   */
  dispose(): void {
    // Release bind group back to pool
    if (this.materialBindGroupId !== undefined) {
      this.renderer.bindGroupPool.release(this.materialBindGroupId);
      this.materialBindGroupId = undefined;
    }

    // Destroy uniform buffers
    for (const { handle } of this.uniformBuffers.values()) {
      try {
        this.renderer.backend.deleteBuffer(handle);
      } catch (e) {
        console.warn('Error destroying material uniform buffer:', e);
      }
    }

    // Textures are NOT destroyed here (may be shared)
    // Pipeline and bind groups are destroyed by backend when backend.dispose() is called

    this.uniformBuffers.clear();
    this.textures.clear();
    this.uniformData.clear();
    this.initialized = false;
  }

  // Private helper methods

  private async loadTextures(): Promise<void> {
    for (const [slot, config] of Object.entries(this.config.textures || {})) {
      if (typeof config.texture === 'string') {
        // Load from asset path via renderer
        const texture = await this.renderer.loadTexture(config.texture);
        this.textures.set(slot, texture);
      } else {
        this.textures.set(slot, config.texture);
      }

      // Note: Sampler creation API not fully exposed in IRendererBackend yet
      // For now, samplers are created as part of texture creation
    }
  }

  private createUniformBuffers(): void {
    const uniforms = Object.entries(this.config.uniforms || {});
    if (uniforms.length === 0) return;

    // Pack all uniforms into a single buffer following WebGPU struct alignment rules
    // vec3 aligns to 16 bytes in structs, scalars to 4 bytes
    let bufferData: number[] = [];
    let currentOffset = 0;

    for (const [name, uniform] of uniforms) {
      const serialized = serializeUniform(uniform.value);

      // vec3 in structs must align to 16 bytes
      if (uniform.type === 'vec3') {
        // Pad to 16-byte alignment if needed
        while (currentOffset % 4 !== 0) {
          bufferData.push(0);
          currentOffset++;
        }
        bufferData.push(...Array.from(serialized));
        bufferData.push(0); // vec3 takes 16 bytes (12 + 4 padding)
        currentOffset += 4;
      } else if (uniform.type === 'vec4' || uniform.type === 'mat4') {
        // Already 16-byte aligned
        bufferData.push(...Array.from(serialized));
        currentOffset += serialized.length;
      } else {
        // float, vec2 - pack tightly
        bufferData.push(...Array.from(serialized));
        currentOffset += serialized.length;
      }

      this.uniformData.set(name, uniform);
    }

    // Align total size to 16 bytes
    while (bufferData.length % 4 !== 0) {
      bufferData.push(0);
    }

    const data = new Float32Array(bufferData);
    const handle = this.renderer.backend.createBuffer(
      `${this.id}_material_uniforms`,
      'uniform',
      data,
      'dynamic_draw'
    );

    this.uniformBuffers.set('material_uniforms', { handle, size: data.byteLength });
  }

  private updateUniformBuffers(): void {
    const buffer = this.uniformBuffers.get('material_uniforms');
    if (!buffer) return;

    // Rebuild packed uniform buffer with same layout as createUniformBuffers
    let bufferData: number[] = [];
    let currentOffset = 0;

    for (const [, uniform] of this.uniformData) {
      const serialized = serializeUniform(uniform.value);

      // vec3 in structs must align to 16 bytes
      if (uniform.type === 'vec3') {
        while (currentOffset % 4 !== 0) {
          bufferData.push(0);
          currentOffset++;
        }
        bufferData.push(...Array.from(serialized));
        bufferData.push(0); // vec3 padding
        currentOffset += 4;
      } else if (uniform.type === 'vec4' || uniform.type === 'mat4') {
        bufferData.push(...Array.from(serialized));
        currentOffset += serialized.length;
      } else {
        bufferData.push(...Array.from(serialized));
        currentOffset += serialized.length;
      }
    }

    // Align total size to 16 bytes
    while (bufferData.length % 4 !== 0) {
      bufferData.push(0);
    }

    const data = new Float32Array(bufferData);
    this.renderer.backend.updateBuffer(buffer.handle, data, 0);
  }

  private updateMaterialBindGroup(): void {
    if (!this.materialBindGroupLayoutHandle) return;

    // Release old bind group back to pool before acquiring new one
    if (this.materialBindGroupId !== undefined) {
      this.renderer.bindGroupPool.release(this.materialBindGroupId);
      this.materialBindGroupId = undefined;
    }

    // Build bindings array
    const bindings: Array<{
      binding: number;
      resource: BackendBufferHandle | { texture: BackendTextureHandle; sampler?: any };
    }> = [];

    let bindingIndex = 0;

    // Add uniform buffers
    for (const { handle } of this.uniformBuffers.values()) {
      bindings.push({ binding: bindingIndex++, resource: handle });
    }

    // Add textures
    for (const texture of this.textures.values()) {
      bindings.push({ binding: bindingIndex++, resource: { texture } });
    }

    // Use BindGroupPool for efficient reuse
    const layoutId = (this.materialBindGroupLayoutHandle as any).id;
    const resourceIds = bindings.map((b) => {
      if ('id' in (b.resource as any)) {
        return (b.resource as any).id;
      }
      if ('texture' in b.resource) {
        return (b.resource.texture as any).id || 'texture';
      }
      return 'unknown';
    });

    const poolResult = this.renderer.bindGroupPool.acquire(
      layoutId,
      resourceIds,
      () => {
        return (this.renderer.backend.createBindGroup as any)(
          this.materialBindGroupLayoutHandle!,
          { bindings }
        ) as any;
      }
    );

    this.materialBindGroup = poolResult.bindGroup as any;
    this.materialBindGroupId = poolResult.id;
  }

  private getStandardVertexLayout() {
    return {
      arrayStride: 32, // 3 floats (pos) + 3 floats (normal) + 2 floats (uv) = 8 floats = 32 bytes
      stepMode: 'vertex' as const,
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
        { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
        { shaderLocation: 2, offset: 24, format: 'float32x2' }, // uv
      ],
    };
  }

  // ============================================================================
  // Static factory methods for common materials (Task 2.3)
  // ============================================================================

  /**
   * PBR material with metallic/roughness workflow
   *
   * @example
   * ```typescript
   * const material = Material.PBR(renderer, {
   *   albedo: [0.8, 0.2, 0.2],  // RGB color
   *   metallic: 0.9,
   *   roughness: 0.1
   * });
   * ```
   */
  static PBR(
    renderer: HighLevelRenderer,
    config: {
      albedo?: string | [number, number, number];
      metallic?: number;
      roughness?: number;
      normal?: string;
      ao?: string;
    }
  ): Material {
    const hasAlbedoTexture = typeof config.albedo === 'string';

    return new Material(renderer, {
      shader: 'pbr',
      uniforms: {
        albedo: {
          type: 'vec3',
          value: Array.isArray(config.albedo) ? config.albedo : [1, 1, 1],
        },
        metallic: { type: 'float', value: config.metallic ?? 0.5 },
        roughness: { type: 'float', value: config.roughness ?? 0.5 },
      },
      textures: {
        ...(hasAlbedoTexture && {
          albedoMap: { texture: config.albedo as string },
        }),
        ...(config.normal && {
          normalMap: { texture: config.normal },
        }),
        ...(config.ao && {
          aoMap: { texture: config.ao },
        }),
      },
      pipelineState: 'opaque',
      label: 'PBR_Material',
    });
  }

  /**
   * Unlit material with flat color or texture
   *
   * @example
   * ```typescript
   * const material = Material.Unlit(renderer, {
   *   color: [1, 0, 0, 1]  // Red
   * });
   * ```
   */
  static Unlit(
    renderer: HighLevelRenderer,
    config: { color?: [number, number, number, number]; texture?: string }
  ): Material {
    return new Material(renderer, {
      shader: 'unlit',
      uniforms: {
        color: {
          type: 'vec4',
          value: config.color || [1, 1, 1, 1],
        },
      },
      textures: config.texture
        ? {
            colorMap: { texture: config.texture },
          }
        : {},
      pipelineState: 'opaque',
      label: 'Unlit_Material',
    });
  }

  /**
   * Textured material with simple lighting
   *
   * @example
   * ```typescript
   * const material = Material.Textured(renderer, {
   *   texture: 'assets/crate.png',
   *   tint: [1, 1, 1, 1]
   * });
   * ```
   */
  static Textured(
    renderer: HighLevelRenderer,
    config: { texture: string; tint?: [number, number, number, number] }
  ): Material {
    return new Material(renderer, {
      shader: 'textured',
      uniforms: {
        tint: {
          type: 'vec4',
          value: config.tint || [1, 1, 1, 1],
        },
      },
      textures: {
        colorMap: {
          texture: config.texture,
          sampler: {
            minFilter: 'linear',
            magFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'repeat',
          },
        },
      },
      pipelineState: 'opaque',
      label: 'Textured_Material',
    });
  }

  /**
   * Transparent material with alpha blending
   *
   * @example
   * ```typescript
   * const material = Material.Transparent(renderer, {
   *   texture: 'assets/glass.png',
   *   opacity: 0.5
   * });
   * ```
   */
  static Transparent(
    renderer: HighLevelRenderer,
    config: { texture: string; opacity?: number }
  ): Material {
    return new Material(renderer, {
      shader: 'transparent',
      uniforms: {
        opacity: { type: 'float', value: config.opacity ?? 1.0 },
      },
      textures: {
        colorMap: { texture: config.texture },
      },
      pipelineState: 'transparent',
      label: 'Transparent_Material',
    });
  }

  /**
   * Toon/cel-shaded material
   *
   * @example
   * ```typescript
   * const material = Material.Toon(renderer, {
   *   color: [0.2, 0.6, 1.0],
   *   bands: 4
   * });
   * ```
   */
  static Toon(
    renderer: HighLevelRenderer,
    config: { color: [number, number, number]; bands?: number }
  ): Material {
    return new Material(renderer, {
      shader: 'toon',
      uniforms: {
        color: { type: 'vec3', value: config.color },
        bands: { type: 'float', value: config.bands ?? 3 },
      },
      pipelineState: 'opaque',
      label: 'Toon_Material',
    });
  }
}
