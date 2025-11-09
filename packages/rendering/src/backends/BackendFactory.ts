/**
 * BackendFactory - Epic 3.2
 *
 * Factory for creating WebGPU rendering backend.
 *
 * NOTE: This engine is WebGPU-only. WebGL2 support has been removed.
 * All modern browsers and Electron support WebGPU.
 *
 * Usage:
 * ```typescript
 * const backend = await BackendFactory.create(canvas);
 * console.log(`Using backend: ${backend.name}`); // Always "WebGPU"
 * ```
 */

import type { IRendererBackend, BackendConfig } from './IRendererBackend';
import { WebGPUBackend } from './WebGPUBackend';
import { RenderBackend } from '../types';

export interface BackendFactoryOptions {
  /**
   * Antialias
   */
  antialias?: boolean;

  /**
   * Alpha channel
   */
  alpha?: boolean;

  /**
   * Depth buffer
   */
  depth?: boolean;

  /**
   * Stencil buffer
   */
  stencil?: boolean;

  /**
   * Power preference
   */
  powerPreference?: 'default' | 'high-performance' | 'low-power';
}

/**
 * Backend capability detection result
 */
export interface BackendSupport {
  /**
   * WebGPU support status
   */
  webgpu: {
    supported: boolean;
    reason?: string;
  };

  /**
   * Recommended backend (always WebGPU)
   */
  recommended: RenderBackend;
}

/**
 * Backend factory for WebGPU
 *
 * IMPORTANT: Shader Requirements
 * - WebGPU requires WGSL shaders for compute/vertex/fragment
 * - No automatic transpilation is provided
 * - Applications must provide WGSL shader sources
 *
 * Example:
 * ```typescript
 * const backend = await BackendFactory.create(canvas);
 * shader = backend.createShader('basic', { vertex: wgslVertex, fragment: wgslFragment });
 * ```
 */
export class BackendFactory {
  /**
   * Detect WebGPU support
   */
  static async detectSupport(): Promise<BackendSupport> {
    const result: BackendSupport = {
      webgpu: { supported: false },
      recommended: RenderBackend.WEBGPU,
    };

    // Check WebGPU support
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      try {
        const gpu = (navigator as any).gpu as GPU | undefined;
        if (gpu) {
          const adapter = await gpu.requestAdapter();
          if (adapter) {
            result.webgpu.supported = true;
          } else {
            result.webgpu.reason = 'No suitable GPU adapter found';
          }
        } else {
          result.webgpu.reason = 'WebGPU API not available';
        }
      } catch (error) {
        result.webgpu.reason = error instanceof Error ? error.message : 'Unknown error';
      }
    } else {
      result.webgpu.reason = 'WebGPU API not available';
    }

    return result;
  }

  /**
   * Create WebGPU rendering backend
   *
   * @param canvas - Canvas element to render to
   * @param options - Backend options
   * @returns Initialized WebGPU backend
   * @throws Error if WebGPU is not available
   */
  static async create(
    canvas: HTMLCanvasElement,
    options: BackendFactoryOptions = {}
  ): Promise<IRendererBackend> {
    const {
      antialias = true,
      alpha = false,
      depth = true,
      stencil = false,
      powerPreference = 'high-performance',
    } = options;

    const config: BackendConfig = {
      canvas,
      antialias,
      alpha,
      depth,
      stencil,
      powerPreference,
    };

    try {
      const backend = new WebGPUBackend();
      const success = await backend.initialize(config);
      if (success) {
        console.log('Using WebGPU backend');
        return backend;
      }
      throw new Error('WebGPU backend initialization failed');
    } catch (error) {
      const support = await this.detectSupport();
      const reason = support.webgpu.reason || 'Unknown error';
      throw new Error(
        `WebGPU backend not available: ${reason}\n` +
        `This engine requires WebGPU support. Please use a modern browser:\n` +
        `- Chrome/Edge 113+\n` +
        `- Firefox 133+\n` +
        `- Safari 18+\n` +
        `- Electron (Chromium-based)`
      );
    }
  }

  /**
   * Get human-readable backend support information
   */
  static async getSupportInfo(): Promise<string> {
    const support = await this.detectSupport();

    const lines: string[] = [
      'Rendering Backend Support:',
      '',
      `WebGPU: ${support.webgpu.supported ? '✓ Supported' : '✗ Not Available'}`,
    ];

    if (!support.webgpu.supported && support.webgpu.reason) {
      lines.push(`  Reason: ${support.webgpu.reason}`);
    }

    return lines.join('\n');
  }
}
