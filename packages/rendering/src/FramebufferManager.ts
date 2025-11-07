import type { TextureFormat } from './types';

/**
 * Framebuffer attachment configuration
 */
export interface FramebufferAttachment {
  texture?: string; // Texture ID
  format?: TextureFormat;
  width?: number;
  height?: number;
}

/**
 * Framebuffer configuration
 */
export interface FramebufferConfig {
  width: number;
  height: number;
  colorAttachments?: FramebufferAttachment[];
  depthAttachment?: FramebufferAttachment;
  stencilAttachment?: FramebufferAttachment;
  samples?: number; // For MSAA
}

/**
 * Framebuffer descriptor
 */
export interface FramebufferDescriptor {
  id: string;
  framebuffer: WebGLFramebuffer;
  config: FramebufferConfig;
  colorTextures: string[];
  depthTexture?: string;
  stencilTexture?: string;
  // MSAA renderbuffers (used instead of textures when samples > 1)
  msaaColorRenderbuffers?: WebGLRenderbuffer[];
  msaaDepthRenderbuffer?: WebGLRenderbuffer;
  msaaStencilRenderbuffer?: WebGLRenderbuffer;
}

/**
 * Texture metadata for validation
 */
export interface TextureMetadata {
  format: TextureFormat;
  width: number;
  height: number;
}

/**
 * Framebuffer manager for render-to-texture
 *
 * Features:
 * - Framebuffer creation and management
 * - Multiple color attachments
 * - Depth and stencil attachments
 * - Texture format validation
 * - Bounded resource limits
 */
export class FramebufferManager {
  private gl: WebGL2RenderingContext;
  private framebuffers = new Map<string, FramebufferDescriptor>();
  private currentFramebuffer: string | null = null;
  private static readonly MAX_FRAMEBUFFERS = 100;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Create framebuffer with attachments
   */
  createFramebuffer(
    id: string,
    config: FramebufferConfig,
    getTexture: (id: string) => WebGLTexture | null,
    getTextureMetadata: (id: string) => TextureMetadata | null
  ): FramebufferDescriptor {
    // Check if framebuffer already exists
    const existing = this.framebuffers.get(id);
    if (existing) {
      throw new Error(`Framebuffer already exists: ${id}`);
    }

    // Check framebuffer limit
    if (this.framebuffers.size >= FramebufferManager.MAX_FRAMEBUFFERS) {
      throw new Error(`Maximum framebuffer count exceeded (${FramebufferManager.MAX_FRAMEBUFFERS})`);
    }

    // Create framebuffer
    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error(`Failed to create framebuffer: ${id}`);
    }

    // Bind framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);

    const colorTextures: string[] = [];
    const drawBuffers: number[] = [];
    const msaaColorRenderbuffers: WebGLRenderbuffer[] = [];
    const samples = config.samples ?? 0;
    const isMultisampled = samples > 1;

    // Validate sample count
    if (isMultisampled) {
      const maxSamples = this.gl.getParameter(this.gl.MAX_SAMPLES);
      if (samples > maxSamples) {
        this.gl.deleteFramebuffer(framebuffer);
        throw new Error(`Sample count ${samples} exceeds maximum supported samples ${maxSamples}`);
      }
    }

    // Attach color attachments (textures or MSAA renderbuffers)
    if (config.colorAttachments) {
      for (let i = 0; i < config.colorAttachments.length; i++) {
        const attachment = config.colorAttachments[i];

        if (isMultisampled) {
          // Use renderbuffer for MSAA
          const format = attachment.format === 'rgb' ? this.gl.RGB8 : this.gl.RGBA8;
          const renderbuffer = this.gl.createRenderbuffer();
          if (!renderbuffer) {
            this.cleanupFramebufferResources(framebuffer, msaaColorRenderbuffers, undefined, undefined);
            throw new Error(`Failed to create MSAA color renderbuffer ${i}`);
          }

          this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, renderbuffer);
          this.gl.renderbufferStorageMultisample(
            this.gl.RENDERBUFFER,
            samples,
            format,
            config.width,
            config.height
          );
          this.gl.framebufferRenderbuffer(
            this.gl.FRAMEBUFFER,
            this.gl.COLOR_ATTACHMENT0 + i,
            this.gl.RENDERBUFFER,
            renderbuffer
          );

          msaaColorRenderbuffers.push(renderbuffer);
          drawBuffers.push(this.gl.COLOR_ATTACHMENT0 + i);
        } else if (attachment.texture) {
          // Use texture for non-MSAA
          const metadata = getTextureMetadata(attachment.texture);
          if (!metadata) {
            this.gl.deleteFramebuffer(framebuffer);
            throw new Error(`Texture metadata not found: ${attachment.texture}`);
          }
          if (metadata.format !== 'rgb' && metadata.format !== 'rgba') {
            this.gl.deleteFramebuffer(framebuffer);
            throw new Error(`Invalid color attachment format: ${metadata.format} (must be rgb or rgba)`);
          }
          if (metadata.width !== config.width || metadata.height !== config.height) {
            this.gl.deleteFramebuffer(framebuffer);
            throw new Error(`Texture dimensions (${metadata.width}x${metadata.height}) don't match framebuffer (${config.width}x${config.height})`);
          }

          const texture = getTexture(attachment.texture);
          if (texture) {
            this.gl.framebufferTexture2D(
              this.gl.FRAMEBUFFER,
              this.gl.COLOR_ATTACHMENT0 + i,
              this.gl.TEXTURE_2D,
              texture,
              0
            );
            colorTextures.push(attachment.texture);
            drawBuffers.push(this.gl.COLOR_ATTACHMENT0 + i);
          }
        }
      }
    }

    // Set draw buffers
    if (drawBuffers.length > 0) {
      this.gl.drawBuffers(drawBuffers);
    }

    // Attach depth attachment (texture or MSAA renderbuffer)
    let depthTexture: string | undefined;
    let msaaDepthRenderbuffer: WebGLRenderbuffer | undefined;
    if (config.depthAttachment) {
      if (isMultisampled) {
        // Use renderbuffer for MSAA
        const format = config.depthAttachment.format === 'depth_stencil'
          ? this.gl.DEPTH24_STENCIL8
          : this.gl.DEPTH_COMPONENT24;
        const renderbuffer = this.gl.createRenderbuffer();
        if (!renderbuffer) {
          this.cleanupFramebufferResources(framebuffer, msaaColorRenderbuffers, undefined, undefined);
          throw new Error(`Failed to create MSAA depth renderbuffer`);
        }

        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, renderbuffer);
        this.gl.renderbufferStorageMultisample(
          this.gl.RENDERBUFFER,
          samples,
          format,
          config.width,
          config.height
        );
        this.gl.framebufferRenderbuffer(
          this.gl.FRAMEBUFFER,
          this.gl.DEPTH_ATTACHMENT,
          this.gl.RENDERBUFFER,
          renderbuffer
        );

        msaaDepthRenderbuffer = renderbuffer;
      } else if (config.depthAttachment.texture) {
        // Use texture for non-MSAA
        const metadata = getTextureMetadata(config.depthAttachment.texture);
        if (!metadata) {
          this.gl.deleteFramebuffer(framebuffer);
          throw new Error(`Depth texture metadata not found: ${config.depthAttachment.texture}`);
        }
        if (metadata.format !== 'depth' && metadata.format !== 'depth_stencil') {
          this.gl.deleteFramebuffer(framebuffer);
          throw new Error(`Invalid depth attachment format: ${metadata.format} (must be depth or depth_stencil)`);
        }
        if (metadata.width !== config.width || metadata.height !== config.height) {
          this.gl.deleteFramebuffer(framebuffer);
          throw new Error(`Depth texture dimensions don't match framebuffer`);
        }

        const texture = getTexture(config.depthAttachment.texture);
        if (texture) {
          this.gl.framebufferTexture2D(
            this.gl.FRAMEBUFFER,
            this.gl.DEPTH_ATTACHMENT,
            this.gl.TEXTURE_2D,
            texture,
            0
          );
          depthTexture = config.depthAttachment.texture;
        }
      }
    }

    // Attach stencil attachment (texture or MSAA renderbuffer)
    let stencilTexture: string | undefined;
    let msaaStencilRenderbuffer: WebGLRenderbuffer | undefined;
    if (config.stencilAttachment) {
      if (isMultisampled) {
        // Use renderbuffer for MSAA
        const renderbuffer = this.gl.createRenderbuffer();
        if (!renderbuffer) {
          this.cleanupFramebufferResources(framebuffer, msaaColorRenderbuffers, msaaDepthRenderbuffer, undefined);
          throw new Error(`Failed to create MSAA stencil renderbuffer`);
        }

        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, renderbuffer);
        this.gl.renderbufferStorageMultisample(
          this.gl.RENDERBUFFER,
          samples,
          this.gl.DEPTH24_STENCIL8,
          config.width,
          config.height
        );
        this.gl.framebufferRenderbuffer(
          this.gl.FRAMEBUFFER,
          this.gl.STENCIL_ATTACHMENT,
          this.gl.RENDERBUFFER,
          renderbuffer
        );

        msaaStencilRenderbuffer = renderbuffer;
      } else if (config.stencilAttachment.texture) {
        // Use texture for non-MSAA
        const metadata = getTextureMetadata(config.stencilAttachment.texture);
        if (!metadata) {
          this.gl.deleteFramebuffer(framebuffer);
          throw new Error(`Stencil texture metadata not found: ${config.stencilAttachment.texture}`);
        }
        if (metadata.format !== 'depth_stencil') {
          this.gl.deleteFramebuffer(framebuffer);
          throw new Error(`Invalid stencil attachment format: ${metadata.format} (must be depth_stencil)`);
        }
        if (metadata.width !== config.width || metadata.height !== config.height) {
          this.gl.deleteFramebuffer(framebuffer);
          throw new Error(`Stencil texture dimensions don't match framebuffer`);
        }

        const texture = getTexture(config.stencilAttachment.texture);
        if (texture) {
          this.gl.framebufferTexture2D(
            this.gl.FRAMEBUFFER,
            this.gl.STENCIL_ATTACHMENT,
            this.gl.TEXTURE_2D,
            texture,
            0
          );
          stencilTexture = config.stencilAttachment.texture;
        }
      }
    }

    // Check framebuffer completeness
    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      this.cleanupFramebufferResources(framebuffer, msaaColorRenderbuffers, msaaDepthRenderbuffer, msaaStencilRenderbuffer);
      throw new Error(`Framebuffer incomplete: ${this.getFramebufferStatusString(status)}`);
    }

    // Unbind framebuffer and renderbuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);

    // Create descriptor
    const descriptor: FramebufferDescriptor = {
      id,
      framebuffer,
      config,
      colorTextures,
      depthTexture,
      stencilTexture,
      msaaColorRenderbuffers: msaaColorRenderbuffers.length > 0 ? msaaColorRenderbuffers : undefined,
      msaaDepthRenderbuffer,
      msaaStencilRenderbuffer,
    };

    this.framebuffers.set(id, descriptor);
    return descriptor;
  }

  /**
   * Bind framebuffer for rendering
   */
  bindFramebuffer(id: string | null): void {
    if (id === null) {
      // Bind default framebuffer (screen)
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.currentFramebuffer = null;
      return;
    }

    const descriptor = this.framebuffers.get(id);
    if (!descriptor) {
      throw new Error(`Framebuffer not found: ${id}`);
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, descriptor.framebuffer);
    this.currentFramebuffer = id;

    // Set viewport to match framebuffer size
    this.gl.viewport(0, 0, descriptor.config.width, descriptor.config.height);
  }

  /**
   * Get current framebuffer ID
   */
  getCurrentFramebuffer(): string | null {
    return this.currentFramebuffer;
  }

  /**
   * Get framebuffer descriptor
   */
  getFramebuffer(id: string): FramebufferDescriptor | null {
    return this.framebuffers.get(id) ?? null;
  }

  /**
   * Check if framebuffer exists
   */
  hasFramebuffer(id: string): boolean {
    return this.framebuffers.has(id);
  }

  /**
   * Delete framebuffer
   */
  deleteFramebuffer(id: string): void {
    const descriptor = this.framebuffers.get(id);
    if (descriptor) {
      this.gl.deleteFramebuffer(descriptor.framebuffer);

      // Clean up MSAA renderbuffers if they exist
      if (descriptor.msaaColorRenderbuffers) {
        for (const rb of descriptor.msaaColorRenderbuffers) {
          this.gl.deleteRenderbuffer(rb);
        }
      }
      if (descriptor.msaaDepthRenderbuffer) {
        this.gl.deleteRenderbuffer(descriptor.msaaDepthRenderbuffer);
      }
      if (descriptor.msaaStencilRenderbuffer) {
        this.gl.deleteRenderbuffer(descriptor.msaaStencilRenderbuffer);
      }

      this.framebuffers.delete(id);

      if (this.currentFramebuffer === id) {
        this.currentFramebuffer = null;
      }
    }
  }

  /**
   * Get all framebuffer IDs
   */
  getFramebufferIds(): string[] {
    return Array.from(this.framebuffers.keys());
  }

  /**
   * Blit framebuffer (copy between framebuffers)
   */
  blitFramebuffer(
    srcId: string | null,
    dstId: string | null,
    srcX0: number,
    srcY0: number,
    srcX1: number,
    srcY1: number,
    dstX0: number,
    dstY0: number,
    dstX1: number,
    dstY1: number,
    mask: number,
    filter: 'nearest' | 'linear'
  ): void {
    // Save current framebuffer bindings
    const savedReadFb = this.gl.getParameter(this.gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const savedDrawFb = this.gl.getParameter(this.gl.DRAW_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;

    const srcFb = srcId ? this.framebuffers.get(srcId)?.framebuffer ?? null : null;
    const dstFb = dstId ? this.framebuffers.get(dstId)?.framebuffer ?? null : null;

    this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, srcFb);
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, dstFb);

    const glFilter = filter === 'nearest' ? this.gl.NEAREST : this.gl.LINEAR;

    this.gl.blitFramebuffer(srcX0, srcY0, srcX1, srcY1, dstX0, dstY0, dstX1, dstY1, mask, glFilter);

    // Restore previous framebuffer bindings
    this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, savedReadFb);
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, savedDrawFb);
  }

  /**
   * Clean up framebuffer resources (helper for error handling)
   */
  private cleanupFramebufferResources(
    framebuffer: WebGLFramebuffer,
    colorRenderbuffers: WebGLRenderbuffer[],
    depthRenderbuffer: WebGLRenderbuffer | undefined,
    stencilRenderbuffer: WebGLRenderbuffer | undefined
  ): void {
    this.gl.deleteFramebuffer(framebuffer);
    for (const rb of colorRenderbuffers) {
      this.gl.deleteRenderbuffer(rb);
    }
    if (depthRenderbuffer) {
      this.gl.deleteRenderbuffer(depthRenderbuffer);
    }
    if (stencilRenderbuffer) {
      this.gl.deleteRenderbuffer(stencilRenderbuffer);
    }
  }

  /**
   * Get framebuffer status string
   */
  private getFramebufferStatusString(status: number): string {
    switch (status) {
      case this.gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
        return 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT';
      case this.gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
        return 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT';
      case this.gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
        return 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS';
      case this.gl.FRAMEBUFFER_UNSUPPORTED:
        return 'FRAMEBUFFER_UNSUPPORTED';
      case this.gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE:
        return 'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE';
      default:
        return `UNKNOWN (${status})`;
    }
  }

  /**
   * Clean up all framebuffers
   */
  dispose(): void {
    for (const descriptor of this.framebuffers.values()) {
      this.gl.deleteFramebuffer(descriptor.framebuffer);

      // Clean up MSAA renderbuffers
      if (descriptor.msaaColorRenderbuffers) {
        for (const rb of descriptor.msaaColorRenderbuffers) {
          this.gl.deleteRenderbuffer(rb);
        }
      }
      if (descriptor.msaaDepthRenderbuffer) {
        this.gl.deleteRenderbuffer(descriptor.msaaDepthRenderbuffer);
      }
      if (descriptor.msaaStencilRenderbuffer) {
        this.gl.deleteRenderbuffer(descriptor.msaaStencilRenderbuffer);
      }
    }
    this.framebuffers.clear();
    this.currentFramebuffer = null;
  }
}
