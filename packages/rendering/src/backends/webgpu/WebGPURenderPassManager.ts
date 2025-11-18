/**
 * WebGPU Render Pass Manager - Epic RENDERING-05 Task 5.3
 * Manages render pass lifecycle, frame management
 */

import type { WebGPUContext, WebGPUFramebuffer, ModuleConfig } from './WebGPUTypes.js';
import { WebGPUErrors } from './WebGPUTypes.js';
import type { BackendFramebufferHandle } from '../IRendererBackend.js';
import type { VRAMProfiler } from '../../VRAMProfiler.js';
import { VRAMCategory } from '../../VRAMProfiler.js';

export class WebGPURenderPassManager {
  private depthTexture: GPUTexture | null = null;
  private depthTextureView: GPUTextureView | null = null;
  private depthTextureSize = 0;
  private depthFormat: GPUTextureFormat;

  constructor(
    private ctx: WebGPUContext,
    private getFramebuffer: (id: string) => WebGPUFramebuffer | undefined,
    private vramProfiler: VRAMProfiler,
    config: ModuleConfig
  ) {
    this.depthFormat = config.depthFormat;
  }

  /**
   * Get bytes per pixel for depth format
   */
  private getDepthFormatBytes(): number {
    switch (this.depthFormat) {
      case 'depth16unorm':
        return 2;
      case 'depth24plus':
      case 'depth24plus-stencil8':
        return 4;
      default:
        return 4; // Fallback
    }
  }

  /**
   * Begin render pass - extracted from WebGPUBackend.ts lines 560-582
   */
  beginRenderPass(
    target: BackendFramebufferHandle | null,
    clearColor?: [number, number, number, number],
    clearDepth?: number,
    _clearStencil?: number,
    label?: string,
    requireDepth?: boolean
  ): void {
    if (!this.ctx.device) {
      throw new Error(WebGPUErrors.DEVICE_NOT_INITIALIZED);
    }
    if (!this.ctx.commandEncoder) {
      throw new Error(WebGPUErrors.ENCODER_NOT_INITIALIZED);
    }
    if (!this.ctx.context) {
      throw new Error(WebGPUErrors.CONTEXT_NOT_INITIALIZED);
    }

    let colorAttachments: GPURenderPassColorAttachment[];
    let depthAttachment: GPURenderPassDepthStencilAttachment | undefined;

    if (target) {
      // Render to framebuffer - use framebuffer's attachments
      const fb = this.getFramebuffer(target.id);
      if (!fb) {
        throw new Error(`Framebuffer not found: ${target.id}`);
      }

      // Use framebuffer's color attachments
      colorAttachments = fb.colorAttachments.map(view => ({
        view,
        clearValue: clearColor
          ? { r: clearColor[0], g: clearColor[1], b: clearColor[2], a: clearColor[3] }
          : { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
        loadOp: 'clear' as const,
        storeOp: 'store' as const,
      }));

      // Use framebuffer's depth attachment (may be undefined)
      depthAttachment = fb.depthStencilAttachment
        ? {
            view: fb.depthStencilAttachment,
            depthClearValue: clearDepth ?? 1.0,
            depthLoadOp: 'clear' as const,
            depthStoreOp: 'store' as const,
          }
        : undefined;
    } else {
      // Render to swapchain - use swapchain texture + optional depth buffer
      colorAttachments = [{
        view: this.ctx.context.getCurrentTexture().createView(),
        clearValue: clearColor
          ? { r: clearColor[0], g: clearColor[1], b: clearColor[2], a: clearColor[3] }
          : { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
        loadOp: 'clear' as const,
        storeOp: 'store' as const,
      }];

      // Conditionally attach depth buffer based on requireDepth flag
      if (requireDepth === true) {
        if (!this.depthTextureView) {
          throw new Error('Depth attachment requested but depth texture not initialized. Call initializeDepthTexture() first.');
        }
        depthAttachment = {
          view: this.depthTextureView,
          depthClearValue: clearDepth ?? 1.0,
          depthLoadOp: 'clear' as const,
          depthStoreOp: 'store' as const,
        };
      } else {
        depthAttachment = undefined;
      }
    }

    this.ctx.currentPass = this.ctx.commandEncoder.beginRenderPass({
      label: label || 'Render Pass',
      colorAttachments,
      depthStencilAttachment: depthAttachment,
    });
  }

  /**
   * End render pass
   */
  endRenderPass(): void {
    if (this.ctx.currentPass) {
      this.ctx.currentPass.end();
      this.ctx.currentPass = null;
    }
  }

  /**
   * Clear (WebGPU clears are handled in render pass descriptors)
   */
  clear(
    _color?: [number, number, number, number],
    _depth?: number,
    _stencil?: number
  ): void {
    // WebGPU clears are handled in render pass descriptors
    // This is a no-op - clearing happens when beginning render pass
  }

  /**
   * Resize - extracted from WebGPUBackend.ts lines 767-782
   */
  resize(width: number, height: number): void {
    if (!this.ctx.canvas || !this.ctx.device) return;

    this.ctx.canvas.width = width;
    this.ctx.canvas.height = height;

    // Recreate depth texture with new size
    if (this.depthTexture) {
      this.vramProfiler.deallocate('depth-texture');
      this.depthTexture.destroy();
    }

    const bytesPerPixel = this.getDepthFormatBytes();
    const newSize = width * height * bytesPerPixel;
    const depthCategory = VRAMCategory.TEXTURES;
    this.vramProfiler.allocate('depth-texture', depthCategory, newSize);
    this.depthTextureSize = newSize;

    this.depthTexture = this.ctx.device.createTexture({
      size: { width, height },
      format: this.depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTextureView = this.depthTexture.createView();
  }

  /**
   * Get current render pass encoder
   */
  getCurrentPass(): GPURenderPassEncoder | null {
    return this.ctx.currentPass;
  }

  /**
   * Initialize depth texture
   */
  initializeDepthTexture(width: number, height: number): void {
    if (!this.ctx.device) return;

    const bytesPerPixel = this.getDepthFormatBytes();
    const size = width * height * bytesPerPixel;
    const depthCategory = VRAMCategory.TEXTURES;

    // VRAM optimization logging
    console.log(`[WebGPURenderPassManager] Creating depth texture:`);
    console.log(`  Resolution: ${width}x${height}`);
    console.log(`  Format: ${this.depthFormat}`);
    console.log(`  Bytes/pixel: ${bytesPerPixel}`);
    console.log(`  Total VRAM: ${(size / 1024 / 1024).toFixed(2)} MB`);

    this.vramProfiler.allocate('depth-texture', depthCategory, size);
    this.depthTextureSize = size;

    this.depthTexture = this.ctx.device.createTexture({
      size: { width, height },
      format: this.depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTextureView = this.depthTexture.createView();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.depthTexture) {
      this.vramProfiler.deallocate('depth-texture');
      this.depthTexture.destroy();
      this.depthTexture = null;
      this.depthTextureSize = 0;
    }
  }
}
