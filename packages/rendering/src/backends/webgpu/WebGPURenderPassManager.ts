/**
 * WebGPU Render Pass Manager - Epic RENDERING-05 Task 5.3
 * Manages render pass lifecycle, frame management
 */

import type { WebGPUContext, WebGPUFramebuffer } from './WebGPUTypes.js';
import { WebGPUErrors } from './WebGPUTypes.js';
import type { BackendFramebufferHandle } from '../IRendererBackend.js';
import type { VRAMProfiler } from '../../VRAMProfiler.js';
import { VRAMCategory } from '../../VRAMProfiler.js';

export class WebGPURenderPassManager {
  private depthTexture: GPUTexture | null = null;
  private depthTextureSize = 0;

  constructor(
    private ctx: WebGPUContext,
    private getFramebuffer: (id: string) => WebGPUFramebuffer | undefined,
    private vramProfiler: VRAMProfiler
  ) {}

  /**
   * Begin render pass - extracted from WebGPUBackend.ts lines 560-582
   */
  beginRenderPass(
    target: BackendFramebufferHandle | null,
    clearColor?: [number, number, number, number],
    clearDepth?: number,
    _clearStencil?: number,
    label?: string
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

    const colorAttachment: GPURenderPassColorAttachment = {
      view: this.ctx.context.getCurrentTexture().createView(),
      clearValue: clearColor
        ? { r: clearColor[0], g: clearColor[1], b: clearColor[2], a: clearColor[3] }
        : { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
      loadOp: 'clear' as const,
      storeOp: 'store' as const,
    };

    const depthAttachment: GPURenderPassDepthStencilAttachment | undefined = this.depthTexture
      ? {
          view: this.depthTexture.createView(),
          depthClearValue: clearDepth ?? 1.0,
          depthLoadOp: 'clear' as const,
          depthStoreOp: 'store' as const,
        }
      : undefined;

    this.ctx.currentPass = this.ctx.commandEncoder.beginRenderPass({
      label: label || 'Render Pass',
      colorAttachments: [colorAttachment],
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

    const newSize = width * height * 2; // depth16unorm is 2 bytes per pixel
    const depthCategory = VRAMCategory.TEXTURES;
    this.vramProfiler.allocate('depth-texture', depthCategory, newSize);
    this.depthTextureSize = newSize;

    this.depthTexture = this.ctx.device.createTexture({
      size: { width, height },
      format: 'depth16unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
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

    const size = width * height * 2; // depth16unorm is 2 bytes per pixel
    const depthCategory = VRAMCategory.TEXTURES;
    this.vramProfiler.allocate('depth-texture', depthCategory, size);
    this.depthTextureSize = size;

    this.depthTexture = this.ctx.device.createTexture({
      size: { width, height },
      format: 'depth16unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
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
