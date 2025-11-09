/**
 * WebGL2Backend - Epic 3.2
 *
 * WebGL2 implementation of IRendererBackend.
 * Wraps WebGL2 API with command-based rendering.
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
  PrimitiveMode,
  VertexLayout,
  RenderState,
  BlendMode,
  DepthTest,
  CullMode,
} from '../types';

import { RenderCommandType, DEFAULT_RENDER_STATE } from '../types';

/**
 * WebGL2 resource wrappers
 */
interface WebGL2Shader {
  id: string;
  program: WebGLProgram;
  attributes: Map<string, number>;
  uniforms: Map<string, WebGLUniformLocation>;
}

interface WebGL2Buffer {
  id: string;
  buffer: WebGLBuffer;
  type: 'vertex' | 'index' | 'uniform';
}

interface WebGL2Texture {
  id: string;
  texture: WebGLTexture;
  width: number;
  height: number;
}

interface WebGL2Framebuffer {
  id: string;
  framebuffer: WebGLFramebuffer;
}

/**
 * WebGL2 backend implementation
 */
export class WebGL2Backend implements IRendererBackend {
  readonly name = 'WebGL2';

  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private contextLost = false;

  // Resource storage
  private shaders = new Map<string, WebGL2Shader>();
  private buffers = new Map<string, WebGL2Buffer>();
  private textures = new Map<string, WebGL2Texture>();
  private framebuffers = new Map<string, WebGL2Framebuffer>();

  // State tracking
  private currentState: RenderState = { ...DEFAULT_RENDER_STATE };
  private currentProgram: WebGLProgram | null = null;
  private boundTextures = new Map<number, WebGLTexture | null>();
  private stats: RenderStats = this.createEmptyStats();

  // Context loss handlers
  private contextLostHandler: ((e: Event) => void) | null = null;
  private contextRestoredHandler: (() => void) | null = null;

  async initialize(config: BackendConfig): Promise<boolean> {
    this.canvas = config.canvas;

    // Try to get WebGL2 context
    const contextAttributes: WebGLContextAttributes = {
      alpha: config.alpha ?? false,
      antialias: config.antialias ?? true,
      depth: config.depth ?? true,
      stencil: config.stencil ?? false,
      powerPreference: config.powerPreference ?? 'high-performance',
      preserveDrawingBuffer: false,
    };

    const gl = this.canvas.getContext('webgl2', contextAttributes);
    if (!gl) {
      console.error('WebGL2 not supported');
      return false;
    }

    this.gl = gl;

    // Set up context loss handling
    this.setupContextLossHandling();

    // Initialize default state
    this.initializeDefaultState();

    return true;
  }

  getCapabilities(): BackendCapabilities {
    if (!this.gl) {
      throw new Error('WebGL2 backend not initialized');
    }

    const gl = this.gl;

    // Check for extensions
    const anisotropyExt = gl.getExtension('EXT_texture_filter_anisotropic');
    const astcExt = gl.getExtension('WEBGL_compressed_texture_astc');
    const etc2Ext = true; // ETC2 is core in WebGL2
    const bcExt = gl.getExtension('WEBGL_compressed_texture_s3tc');

    return {
      compute: false, // WebGL2 doesn't support compute shaders
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxUniformBufferSize: gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE),
      maxVertexAttributes: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      maxColorAttachments: gl.getParameter(gl.MAX_COLOR_ATTACHMENTS),
      anisotropicFiltering: anisotropyExt !== null,
      maxAnisotropy: anisotropyExt
        ? gl.getParameter(anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT)
        : 1,
      textureCompressionASTC: astcExt !== null,
      textureCompressionETC2: etc2Ext,
      textureCompressionBC: bcExt !== null,
    };
  }

  isContextLost(): boolean {
    return this.contextLost;
  }

  beginFrame(): void {
    if (this.contextLost) {
      throw new Error('Cannot begin frame: WebGL context is lost');
    }
    this.resetStats();
  }

  endFrame(): void {
    // Present is automatic in WebGL
  }

  executeCommands(commands: RenderCommand[]): void {
    if (!this.gl || this.contextLost) {
      throw new Error('Cannot execute commands: WebGL context not available');
    }

    for (const command of commands) {
      this.executeCommand(command);
    }
  }

  clear(
    color?: [number, number, number, number],
    depth?: number,
    stencil?: number
  ): void {
    if (!this.gl) return;

    let mask = 0;

    if (color !== undefined) {
      this.gl.clearColor(color[0], color[1], color[2], color[3]);
      mask |= this.gl.COLOR_BUFFER_BIT;
    }

    if (depth !== undefined) {
      this.gl.clearDepth(depth);
      mask |= this.gl.DEPTH_BUFFER_BIT;
    }

    if (stencil !== undefined) {
      this.gl.clearStencil(stencil);
      mask |= this.gl.STENCIL_BUFFER_BIT;
    }

    if (mask !== 0) {
      this.gl.clear(mask);
    }
  }

  resize(width: number, height: number): void {
    if (!this.canvas || !this.gl) return;

    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    this.currentState.viewport = { x: 0, y: 0, width, height };
  }

  getStats(): Readonly<RenderStats> {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = this.createEmptyStats();
  }

  // Shader Management

  createShader(id: string, source: ShaderSource): BackendShaderHandle {
    if (!this.gl) {
      throw new Error('WebGL2 backend not initialized');
    }

    const gl = this.gl;

    // Compile vertex shader
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, source.vertex);
    if (!vertexShader) {
      throw new Error(`Failed to compile vertex shader for ${id}`);
    }

    // Compile fragment shader
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, source.fragment);
    if (!fragmentShader) {
      gl.deleteShader(vertexShader);
      throw new Error(`Failed to compile fragment shader for ${id}`);
    }

    // Link program
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      throw new Error(`Failed to create shader program for ${id}`);
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // Clean up shaders (they're linked into program now)
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Failed to link shader program ${id}: ${info}`);
    }

    // Extract attributes and uniforms
    const attributes = new Map<string, number>();
    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttributes; i++) {
      const info = gl.getActiveAttrib(program, i);
      if (info) {
        const location = gl.getAttribLocation(program, info.name);
        attributes.set(info.name, location);
      }
    }

    const uniforms = new Map<string, WebGLUniformLocation>();
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) {
        const location = gl.getUniformLocation(program, info.name);
        if (location) {
          uniforms.set(info.name, location);
        }
      }
    }

    // Store shader
    const shader: WebGL2Shader = { id, program, attributes, uniforms };
    this.shaders.set(id, shader);

    return { __brand: 'BackendShader', id } as BackendShaderHandle;
  }

  deleteShader(handle: BackendShaderHandle): void {
    if (!this.gl) return;

    const shader = this.shaders.get(handle.id);
    if (shader) {
      this.gl.deleteProgram(shader.program);
      this.shaders.delete(handle.id);
    }
  }

  // Buffer Management

  createBuffer(
    id: string,
    type: 'vertex' | 'index' | 'uniform',
    data: ArrayBuffer | ArrayBufferView,
    usage: BufferUsage
  ): BackendBufferHandle {
    if (!this.gl) {
      throw new Error('WebGL2 backend not initialized');
    }

    const gl = this.gl;
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error(`Failed to create buffer ${id}`);
    }

    const target = type === 'index' ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
    const usageHint = this.getBufferUsageHint(usage);

    gl.bindBuffer(target, buffer);
    gl.bufferData(target, data, usageHint);
    gl.bindBuffer(target, null);

    const bufferData: WebGL2Buffer = { id, buffer, type };
    this.buffers.set(id, bufferData);

    return { __brand: 'BackendBuffer', id } as BackendBufferHandle;
  }

  updateBuffer(
    handle: BackendBufferHandle,
    data: ArrayBuffer | ArrayBufferView,
    offset: number = 0
  ): void {
    if (!this.gl) return;

    const bufferData = this.buffers.get(handle.id);
    if (!bufferData) {
      throw new Error(`Buffer ${handle.id} not found`);
    }

    const gl = this.gl;
    const target = bufferData.type === 'index' ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

    gl.bindBuffer(target, bufferData.buffer);
    if (offset === 0) {
      gl.bufferData(target, data, gl.DYNAMIC_DRAW);
    } else {
      gl.bufferSubData(target, offset, data);
    }
    gl.bindBuffer(target, null);
  }

  deleteBuffer(handle: BackendBufferHandle): void {
    if (!this.gl) return;

    const bufferData = this.buffers.get(handle.id);
    if (bufferData) {
      this.gl.deleteBuffer(bufferData.buffer);
      this.buffers.delete(handle.id);
    }
  }

  /**
   * Set vertex attribute divisor for instanced rendering (Epic 3.13)
   *
   * For mat4 instance attributes, this must be called 4 times (once per vec4 row).
   *
   * Example:
   * ```typescript
   * // Standard per-vertex attributes (divisor = 0)
   * backend.setVertexAttributeDivisor(shader, 'a_position', 0);
   * backend.setVertexAttributeDivisor(shader, 'a_normal', 0);
   *
   * // Per-instance transform (mat4 = 4 vec4s, divisor = 1)
   * backend.setVertexAttributeDivisor(shader, 'a_InstanceTransform', 1);
   * backend.setVertexAttributeDivisor(shader, 'a_InstanceTransform_1', 1);
   * backend.setVertexAttributeDivisor(shader, 'a_InstanceTransform_2', 1);
   * backend.setVertexAttributeDivisor(shader, 'a_InstanceTransform_3', 1);
   * ```
   */
  setVertexAttributeDivisor(
    shader: BackendShaderHandle,
    attributeName: string,
    divisor: number
  ): void {
    if (!this.gl) {
      console.warn('setVertexAttributeDivisor: WebGL2 context not initialized');
      return;
    }

    const shaderData = this.shaders.get(shader.id);
    if (!shaderData) {
      console.warn(`setVertexAttributeDivisor: Shader ${shader.id} not found`);
      return;
    }

    const location = shaderData.attributes.get(attributeName);
    if (location === undefined) {
      console.warn(`setVertexAttributeDivisor: Attribute ${attributeName} not found in shader ${shader.id}`);
      return;
    }

    this.gl.vertexAttribDivisor(location, divisor);
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
    if (!this.gl) {
      throw new Error('WebGL2 backend not initialized');
    }

    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error(`Failed to create texture ${id}`);
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set texture data
    const format = this.getTextureFormat(config.format);
    const internalFormat = this.getTextureInternalFormat(config.format);

    if (data) {
      if (data instanceof HTMLImageElement || data instanceof HTMLCanvasElement || data instanceof ImageData) {
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, format, gl.UNSIGNED_BYTE, data);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, gl.UNSIGNED_BYTE, data);
      }
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, gl.UNSIGNED_BYTE, null);
    }

    // Set texture parameters
    const minFilter = this.getTextureFilterMode(config.minFilter ?? 'linear');
    const magFilter = this.getTextureFilterMode(config.magFilter ?? 'linear');
    const wrapS = this.getTextureWrapMode(config.wrapS ?? 'repeat');
    const wrapT = this.getTextureWrapMode(config.wrapT ?? 'repeat');

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);

    // Generate mipmaps if requested
    if (config.generateMipmaps ?? true) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);

    const textureData: WebGL2Texture = { id, texture, width, height };
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
    if (!this.gl) return;

    const textureData = this.textures.get(handle.id);
    if (!textureData) {
      throw new Error(`Texture ${handle.id} not found`);
    }

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, textureData.texture);

    if (data instanceof HTMLImageElement || data instanceof HTMLCanvasElement || data instanceof ImageData) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, data);
    } else {
      const w = width ?? textureData.width;
      const h = height ?? textureData.height;
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  deleteTexture(handle: BackendTextureHandle): void {
    if (!this.gl) return;

    const textureData = this.textures.get(handle.id);
    if (textureData) {
      this.gl.deleteTexture(textureData.texture);
      this.textures.delete(handle.id);
    }
  }

  // Framebuffer Management

  createFramebuffer(
    id: string,
    colorAttachments: BackendTextureHandle[],
    depthAttachment?: BackendTextureHandle
  ): BackendFramebufferHandle {
    if (!this.gl) {
      throw new Error('WebGL2 backend not initialized');
    }

    const gl = this.gl;
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error(`Failed to create framebuffer ${id}`);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    // Attach color textures
    for (let i = 0; i < colorAttachments.length; i++) {
      const textureData = this.textures.get(colorAttachments[i].id);
      if (textureData) {
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0 + i,
          gl.TEXTURE_2D,
          textureData.texture,
          0
        );
      }
    }

    // Attach depth texture if provided
    if (depthAttachment) {
      const depthTexture = this.textures.get(depthAttachment.id);
      if (depthTexture) {
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.TEXTURE_2D,
          depthTexture.texture,
          0
        );
      }
    }

    // Check framebuffer status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(framebuffer);
      throw new Error(`Framebuffer ${id} is incomplete: ${status}`);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const fbData: WebGL2Framebuffer = { id, framebuffer };
    this.framebuffers.set(id, fbData);

    return { __brand: 'BackendFramebuffer', id } as BackendFramebufferHandle;
  }

  deleteFramebuffer(handle: BackendFramebufferHandle): void {
    if (!this.gl) return;

    const fbData = this.framebuffers.get(handle.id);
    if (fbData) {
      this.gl.deleteFramebuffer(fbData.framebuffer);
      this.framebuffers.delete(handle.id);
    }
  }

  dispose(): void {
    if (!this.gl || !this.canvas) return;

    // Delete all resources
    for (const shader of this.shaders.values()) {
      this.gl.deleteProgram(shader.program);
    }
    this.shaders.clear();

    for (const buffer of this.buffers.values()) {
      this.gl.deleteBuffer(buffer.buffer);
    }
    this.buffers.clear();

    for (const texture of this.textures.values()) {
      this.gl.deleteTexture(texture.texture);
    }
    this.textures.clear();

    for (const fb of this.framebuffers.values()) {
      this.gl.deleteFramebuffer(fb.framebuffer);
    }
    this.framebuffers.clear();

    // Remove event listeners
    if (this.contextLostHandler) {
      this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
      this.contextLostHandler = null;
    }
    if (this.contextRestoredHandler) {
      this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
      this.contextRestoredHandler = null;
    }

    this.gl = null;
    this.canvas = null;
  }

  // Private Helper Methods

  private executeCommand(command: RenderCommand): void {
    if (!this.gl) return;

    switch (command.type) {
      case RenderCommandType.CLEAR:
        this.executeClearCommand(command);
        break;
      case RenderCommandType.DRAW:
        this.executeDrawCommand(command as DrawCommand);
        break;
      case RenderCommandType.BIND_FRAMEBUFFER:
        this.executeBindFramebufferCommand(command);
        break;
      case RenderCommandType.SET_STATE:
        this.executeSetStateCommand(command);
        break;
    }
  }

  private executeClearCommand(command: any): void {
    this.clear(command.color, command.depth, command.stencil);
  }

  private executeDrawCommand(command: DrawCommand): void {
    if (!this.gl) return;

    const gl = this.gl;

    // Apply state changes
    if (command.state) {
      this.applyState(command.state);
    }

    // Bind shader
    const shader = this.shaders.get(command.shader);
    if (!shader) {
      console.error(`Shader ${command.shader} not found`);
      return;
    }

    this.useProgram(shader.program);

    // Bind vertex buffer and set up vertex layout
    const vertexBuffer = this.buffers.get(command.vertexBufferId);
    if (!vertexBuffer) {
      console.error(`Vertex buffer ${command.vertexBufferId} not found`);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.buffer);
    this.setupVertexLayout(shader, command.vertexLayout);

    // Epic 3.13: Bind instance buffer if present
    if (command.instanceBufferId) {
      const instanceBuffer = this.buffers.get(command.instanceBufferId);
      if (instanceBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer.buffer);

        // Set up instance transform attribute (mat4 = 4 vec4s)
        // Assuming instance attribute name is 'a_InstanceTransform'
        const baseLocation = shader.attributes.get('a_InstanceTransform');
        if (baseLocation !== undefined) {
          const bytesPerMatrix = 16 * 4; // mat4 = 16 floats * 4 bytes

          // Configure each row of the mat4 as a separate vec4 attribute
          for (let i = 0; i < 4; i++) {
            const location = baseLocation + i;
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(
              location,
              4,              // vec4 (4 floats per row)
              gl.FLOAT,
              false,
              bytesPerMatrix, // stride = size of one mat4
              i * 16          // offset = row index * 4 floats * 4 bytes
            );
            gl.vertexAttribDivisor(location, 1); // Per-instance
          }
        }
      }
    }

    // Set uniforms
    if (command.uniforms) {
      for (const [, uniform] of command.uniforms) {
        this.setUniform(shader, uniform.name, uniform.type, uniform.value);
      }
    }

    // Bind textures
    if (command.textures) {
      for (const [unit, textureId] of command.textures) {
        const texture = this.textures.get(textureId);
        if (texture) {
          this.bindTexture(texture.texture, unit);
        }
      }
    }

    // Draw
    const mode = this.getPrimitiveMode(command.mode);

    if (command.indexBufferId) {
      const indexBuffer = this.buffers.get(command.indexBufferId);
      if (indexBuffer) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer.buffer);
        const indexType = command.indexType === 'uint32' ? gl.UNSIGNED_INT :
                          command.indexType === 'uint16' ? gl.UNSIGNED_SHORT :
                          gl.UNSIGNED_BYTE;

        if (command.instanceCount && command.instanceCount > 1) {
          gl.drawElementsInstanced(mode, command.vertexCount, indexType, 0, command.instanceCount);
        } else {
          gl.drawElements(mode, command.vertexCount, indexType, 0);
        }
      }
    } else {
      if (command.instanceCount && command.instanceCount > 1) {
        gl.drawArraysInstanced(mode, 0, command.vertexCount, command.instanceCount);
      } else {
        gl.drawArrays(mode, 0, command.vertexCount);
      }
    }

    // Update stats
    this.stats.drawCalls++;
    this.stats.vertices += command.vertexCount;
    if (command.mode === 4) { // TRIANGLES
      this.stats.triangles += Math.floor(command.vertexCount / 3);
    }
  }

  private executeBindFramebufferCommand(command: any): void {
    if (!this.gl) return;

    if (command.framebufferId === null) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    } else {
      const fb = this.framebuffers.get(command.framebufferId);
      if (fb) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb.framebuffer);
      }
    }
  }

  private executeSetStateCommand(command: any): void {
    if (command.state) {
      this.applyState(command.state);
    }
  }

  private applyState(state: Partial<RenderState>): void {
    if (!this.gl) return;

    if (state.blendMode !== undefined && state.blendMode !== this.currentState.blendMode) {
      this.applyBlendMode(state.blendMode);
      this.currentState.blendMode = state.blendMode;
      this.stats.stateChanges++;
    }

    if (state.depthTest !== undefined && state.depthTest !== this.currentState.depthTest) {
      this.applyDepthTest(state.depthTest);
      this.currentState.depthTest = state.depthTest;
      this.stats.stateChanges++;
    }

    if (state.depthWrite !== undefined && state.depthWrite !== this.currentState.depthWrite) {
      this.gl.depthMask(state.depthWrite);
      this.currentState.depthWrite = state.depthWrite;
      this.stats.stateChanges++;
    }

    if (state.cullMode !== undefined && state.cullMode !== this.currentState.cullMode) {
      this.applyCullMode(state.cullMode);
      this.currentState.cullMode = state.cullMode;
      this.stats.stateChanges++;
    }

    if (state.viewport !== undefined) {
      const vp = state.viewport;
      this.gl.viewport(vp.x, vp.y, vp.width, vp.height);
      this.currentState.viewport = vp;
    }

    if (state.scissor !== undefined) {
      const sc = state.scissor;
      if (sc) {
        this.gl.enable(this.gl.SCISSOR_TEST);
        this.gl.scissor(sc.x, sc.y, sc.width, sc.height);
      } else {
        this.gl.disable(this.gl.SCISSOR_TEST);
      }
      this.currentState.scissor = sc;
    }
  }

  private applyBlendMode(mode: BlendMode): void {
    if (!this.gl) return;

    switch (mode) {
      case 'none':
        this.gl.disable(this.gl.BLEND);
        break;
      case 'alpha':
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        break;
      case 'additive':
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
        break;
      case 'multiply':
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.DST_COLOR, this.gl.ZERO);
        break;
    }
  }

  private applyDepthTest(mode: DepthTest): void {
    if (!this.gl) return;

    if (mode === 'always') {
      this.gl.disable(this.gl.DEPTH_TEST);
      return;
    }

    this.gl.enable(this.gl.DEPTH_TEST);

    const funcMap: Record<DepthTest, number> = {
      never: this.gl.NEVER,
      less: this.gl.LESS,
      equal: this.gl.EQUAL,
      lequal: this.gl.LEQUAL,
      greater: this.gl.GREATER,
      notequal: this.gl.NOTEQUAL,
      gequal: this.gl.GEQUAL,
      always: this.gl.ALWAYS,
    };

    this.gl.depthFunc(funcMap[mode]);
  }

  private applyCullMode(mode: CullMode): void {
    if (!this.gl) return;

    if (mode === 'none') {
      this.gl.disable(this.gl.CULL_FACE);
      return;
    }

    this.gl.enable(this.gl.CULL_FACE);

    const modeMap: Record<Exclude<CullMode, 'none'>, number> = {
      front: this.gl.FRONT,
      back: this.gl.BACK,
      front_and_back: this.gl.FRONT_AND_BACK,
    };

    this.gl.cullFace(modeMap[mode]);
  }

  private useProgram(program: WebGLProgram | null): void {
    if (program !== this.currentProgram) {
      this.gl?.useProgram(program);
      this.currentProgram = program;
      this.stats.shaderSwitches++;
    }
  }

  private bindTexture(texture: WebGLTexture | null, unit: number): void {
    if (!this.gl) return;

    const current = this.boundTextures.get(unit);
    if (texture !== current) {
      this.gl.activeTexture(this.gl.TEXTURE0 + unit);
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.boundTextures.set(unit, texture);
      this.stats.textureBinds++;
    }
  }

  private setupVertexLayout(shader: WebGL2Shader, layout: VertexLayout): void {
    if (!this.gl) return;

    for (const attr of layout.attributes) {
      const location = shader.attributes.get(attr.name);
      if (location === undefined) continue;

      // Bind the appropriate buffer for this attribute (if specified)
      if (attr.bufferId) {
        const buffer = this.buffers.get(attr.bufferId);
        if (buffer) {
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer.buffer);
        } else {
          console.warn(`Buffer ${attr.bufferId} not found for attribute ${attr.name}`);
          continue;
        }
      }

      this.gl.enableVertexAttribArray(location);

      const type = attr.type === 'float' ? this.gl.FLOAT :
                   attr.type === 'int' ? this.gl.INT :
                   attr.type === 'byte' ? this.gl.BYTE :
                   this.gl.SHORT;

      this.gl.vertexAttribPointer(
        location,
        attr.size,
        type,
        attr.normalized ?? false,
        attr.stride ?? 0,
        attr.offset ?? 0
      );
    }
  }

  private setUniform(shader: WebGL2Shader, name: string, type: string, value: any): void {
    if (!this.gl) return;

    const location = shader.uniforms.get(name);
    if (!location) return;

    const gl = this.gl;

    switch (type) {
      case 'int':
        gl.uniform1i(location, value);
        break;
      case 'float':
        gl.uniform1f(location, value);
        break;
      case 'vec2':
        gl.uniform2fv(location, value);
        break;
      case 'vec3':
        gl.uniform3fv(location, value);
        break;
      case 'vec4':
        gl.uniform4fv(location, value);
        break;
      case 'mat3':
        gl.uniformMatrix3fv(location, false, value);
        break;
      case 'mat4':
        gl.uniformMatrix4fv(location, false, value);
        break;
      case 'sampler2d':
        gl.uniform1i(location, value);
        break;
    }
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;

    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      console.error(`Shader compilation error: ${info}`);
      console.error(`Source:\n${source}`);
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private getBufferUsageHint(usage: BufferUsage): number {
    if (!this.gl) return 0;

    switch (usage) {
      case 'static_draw': return this.gl.STATIC_DRAW;
      case 'dynamic_draw': return this.gl.DYNAMIC_DRAW;
      case 'stream_draw': return this.gl.STREAM_DRAW;
    }
  }

  private getTextureFormat(format: TextureFormat): number {
    if (!this.gl) return 0;

    switch (format) {
      case 'rgb': return this.gl.RGB;
      case 'rgba': return this.gl.RGBA;
      case 'depth': return this.gl.DEPTH_COMPONENT;
      case 'depth_stencil': return this.gl.DEPTH_STENCIL;
    }
  }

  private getTextureInternalFormat(format: TextureFormat): number {
    if (!this.gl) return 0;

    switch (format) {
      case 'rgb': return this.gl.RGB8;
      case 'rgba': return this.gl.RGBA8;
      case 'depth': return this.gl.DEPTH_COMPONENT24;
      case 'depth_stencil': return this.gl.DEPTH24_STENCIL8;
    }
  }

  private getTextureFilterMode(filter: TextureFilter): number {
    if (!this.gl) return 0;

    switch (filter) {
      case 'nearest': return this.gl.NEAREST;
      case 'linear': return this.gl.LINEAR;
      case 'nearest_mipmap_nearest': return this.gl.NEAREST_MIPMAP_NEAREST;
      case 'linear_mipmap_nearest': return this.gl.LINEAR_MIPMAP_NEAREST;
      case 'nearest_mipmap_linear': return this.gl.NEAREST_MIPMAP_LINEAR;
      case 'linear_mipmap_linear': return this.gl.LINEAR_MIPMAP_LINEAR;
    }
  }

  private getTextureWrapMode(wrap: TextureWrap): number {
    if (!this.gl) return 0;

    switch (wrap) {
      case 'repeat': return this.gl.REPEAT;
      case 'clamp_to_edge': return this.gl.CLAMP_TO_EDGE;
      case 'mirrored_repeat': return this.gl.MIRRORED_REPEAT;
    }
  }

  private getPrimitiveMode(mode: PrimitiveMode): number {
    if (!this.gl) return 0;

    switch (mode) {
      case 0: return this.gl.POINTS;
      case 1: return this.gl.LINES;
      case 3: return this.gl.LINE_STRIP;
      case 4: return this.gl.TRIANGLES;
      case 5: return this.gl.TRIANGLE_STRIP;
      default:
        console.warn(`Unknown primitive mode: ${mode}, defaulting to TRIANGLES`);
        return this.gl.TRIANGLES;
    }
  }

  private setupContextLossHandling(): void {
    if (!this.canvas) return;

    this.contextLostHandler = (event) => {
      event.preventDefault();
      this.contextLost = true;
      console.error('WebGL context lost');
    };

    this.contextRestoredHandler = () => {
      this.contextLost = false;
      console.log('WebGL context restored');
      if (this.gl) {
        this.initializeDefaultState();
      }
    };

    this.canvas.addEventListener('webglcontextlost', this.contextLostHandler);
    this.canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler);
  }

  private initializeDefaultState(): void {
    if (!this.gl) return;

    // Enable depth test by default
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LESS);

    // Enable back-face culling by default
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.cullFace(this.gl.BACK);

    // Set default clear color
    this.gl.clearColor(0, 0, 0, 1);
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
