import type { RendererConfig, RenderStats, ShaderSource, BufferUsage, TextureFormat, TextureFilter, TextureWrap } from './types';
import { RenderBackend } from './types';
import { RenderContext } from './RenderContext';
import { ShaderManager } from './ShaderManager';
import { BufferManager } from './BufferManager';
import { TextureManager } from './TextureManager';
import { CommandBuffer } from './CommandBuffer';
import { FramebufferManager } from './FramebufferManager';
import { RenderPassManager } from './RenderPass';

/**
 * Main renderer class that orchestrates all rendering subsystems
 *
 * Features:
 * - WebGL2 backend (WebGPU future)
 * - Command buffer recording and execution
 * - Shader, buffer, and texture management
 * - Render statistics tracking
 * - Context loss recovery
 */
export class Renderer {
  private config: RendererConfig;
  private context: RenderContext;
  private shaderManager: ShaderManager;
  private bufferManager: BufferManager;
  private textureManager: TextureManager;
  private framebufferManager: FramebufferManager;
  private commandBuffer: CommandBuffer;
  private renderPassManager: RenderPassManager;

  constructor(config: RendererConfig) {
    this.config = config;

    // Validate backend
    if (config.backend && config.backend !== RenderBackend.WEBGL2) {
      console.warn(`Backend ${config.backend} not yet supported, falling back to WebGL2`);
    }

    // Create rendering context
    this.context = new RenderContext(config);

    // Create managers with bounded resources
    const gl = this.context.getGL();
    this.shaderManager = new ShaderManager(gl, { maxPrograms: 1000 });
    this.bufferManager = new BufferManager(gl);
    this.textureManager = new TextureManager(gl);
    this.framebufferManager = new FramebufferManager(gl);

    // Create command buffer
    this.commandBuffer = new CommandBuffer(
      this.context,
      this.shaderManager,
      this.bufferManager,
      this.textureManager
    );

    // Create render pass manager
    this.renderPassManager = new RenderPassManager();
  }

  /**
   * Get the rendering context
   */
  getContext(): RenderContext {
    return this.context;
  }

  /**
   * Get shader manager
   */
  getShaderManager(): ShaderManager {
    return this.shaderManager;
  }

  /**
   * Get buffer manager
   */
  getBufferManager(): BufferManager {
    return this.bufferManager;
  }

  /**
   * Get texture manager
   */
  getTextureManager(): TextureManager {
    return this.textureManager;
  }

  /**
   * Get framebuffer manager
   */
  getFramebufferManager(): FramebufferManager {
    return this.framebufferManager;
  }

  /**
   * Get command buffer
   */
  getCommandBuffer(): CommandBuffer {
    return this.commandBuffer;
  }

  /**
   * Get render pass manager
   */
  getRenderPassManager(): RenderPassManager {
    return this.renderPassManager;
  }

  /**
   * Get canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.context.getCanvas();
  }

  /**
   * Check if context is lost
   */
  isContextLost(): boolean {
    return this.context.isContextLost();
  }

  /**
   * Begin frame
   */
  beginFrame(): void {
    if (this.context.isContextLost()) {
      throw new Error('Cannot begin frame: WebGL context is lost');
    }

    this.commandBuffer.beginFrame();
  }

  /**
   * End frame and execute commands
   */
  endFrame(): RenderStats {
    // Execute render passes if any are registered
    if (this.renderPassManager.getPasses().length > 0) {
      this.executeRenderPasses();
    } else {
      // Fallback to executing global command buffer
      this.commandBuffer.execute();
    }
    return this.commandBuffer.endFrame();
  }

  /**
   * Execute all registered render passes in dependency order
   */
  private executeRenderPasses(): void {
    const passes = this.renderPassManager.getPasses();

    for (const pass of passes) {
      // Switch to render target
      const target = pass.target === 'screen' ? null : pass.target;
      this.framebufferManager.bindFramebuffer(target);

      // Clear if requested
      if (pass.clear) {
        this.context.clear(pass.clear.color, pass.clear.depth, pass.clear.stencil);
      }

      // Execute pass commands
      for (const command of pass.getCommands()) {
        this.commandBuffer.draw(command);
      }

      // Execute command buffer for this pass
      this.commandBuffer.execute();
      this.commandBuffer.clearCommands();
    }

    // Restore default framebuffer
    this.framebufferManager.bindFramebuffer(null);
  }

  /**
   * Clear the framebuffer
   */
  clear(color?: [number, number, number, number], depth?: number, stencil?: number): void {
    this.commandBuffer.clear(color, depth, stencil);
  }

  /**
   * Resize the renderer
   */
  resize(width: number, height: number): void {
    this.context.resize(width, height);
  }

  /**
   * Get current render statistics
   */
  getStats(): Readonly<RenderStats> {
    return this.commandBuffer.getStats();
  }

  /**
   * Get renderer configuration
   */
  getConfig(): Readonly<RendererConfig> {
    return this.config;
  }

  /**
   * Create shader program (convenience method)
   */
  createShader(id: string, source: ShaderSource) {
    return this.shaderManager.createProgram(id, source);
  }

  /**
   * Create vertex buffer (convenience method)
   */
  createVertexBuffer(id: string, data: ArrayBuffer | ArrayBufferView, usage: BufferUsage = 'static_draw') {
    return this.bufferManager.createBuffer(id, 'vertex', data, usage);
  }

  /**
   * Create index buffer (convenience method)
   */
  createIndexBuffer(id: string, data: ArrayBuffer | ArrayBufferView, usage: BufferUsage = 'static_draw') {
    return this.bufferManager.createBuffer(id, 'index', data, usage);
  }

  /**
   * Create texture (convenience method)
   */
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
    } = {
      format: 'rgba',
      minFilter: 'linear',
      magFilter: 'linear',
      wrapS: 'repeat',
      wrapT: 'repeat',
      generateMipmaps: true,
    }
  ) {
    return this.textureManager.createTexture(id, width, height, data, config);
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    this.commandBuffer.clearCommands();
    this.renderPassManager.clearPasses();
    this.framebufferManager.dispose();
    this.shaderManager.dispose();
    this.bufferManager.dispose();
    this.textureManager.dispose();
    this.context.dispose();
  }
}
