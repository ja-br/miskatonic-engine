/**
 * BackendFactory - Epic 3.2
 *
 * Factory for creating rendering backends with automatic capability detection
 * and fallback logic.
 *
 * Priority Order:
 * 1. WebGPU (if available and not explicitly disabled)
 * 2. WebGL2 (fallback)
 *
 * Usage:
 * ```typescript
 * const backend = await BackendFactory.create(canvas, { preferWebGPU: true });
 * console.log(`Using backend: ${backend.name}`);
 * ```
 */

import type { IRendererBackend, BackendConfig } from './IRendererBackend';
import { WebGL2Backend } from './WebGL2Backend';
import { WebGPUBackend } from './WebGPUBackend';
import { RenderBackend } from '../types';

export interface BackendFactoryOptions {
  /**
   * Preferred backend (will try this first)
   */
  preferredBackend?: RenderBackend;

  /**
   * Force a specific backend (no fallback)
   */
  forceBackend?: RenderBackend;

  /**
   * Enable WebGPU if available
   * Default: true
   */
  enableWebGPU?: boolean;

  /**
   * Enable WebGL2 fallback
   * Default: true
   */
  enableWebGL2?: boolean;

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
   * WebGL2 support status
   */
  webgl2: {
    supported: boolean;
    reason?: string;
  };

  /**
   * Recommended backend
   */
  recommended: RenderBackend;
}

/**
 * Backend factory for automatic capability detection
 *
 * IMPORTANT: Shader Requirements
 * - WebGPU requires WGSL shaders
 * - WebGL2 requires GLSL ES 3.00 shaders
 * - No automatic transpilation is provided (yet)
 * - Applications must provide backend-specific shader sources
 *
 * Example:
 * ```typescript
 * const backend = await BackendFactory.create(canvas);
 * if (backend.name === 'WebGPU') {
 *   // Use WGSL shader
 *   shader = backend.createShader('basic', { vertex: wgslVertex, fragment: wgslFragment });
 * } else {
 *   // Use GLSL shader
 *   shader = backend.createShader('basic', { vertex: glslVertex, fragment: glslFragment });
 * }
 * ```
 */
export class BackendFactory {
  /**
   * Detect backend support
   */
  static async detectSupport(): Promise<BackendSupport> {
    const result: BackendSupport = {
      webgpu: { supported: false },
      webgl2: { supported: false },
      recommended: RenderBackend.WEBGL2, // Default fallback
    };

    // Check WebGPU support
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      try {
        const gpu = (navigator as any).gpu as GPU | undefined;
        if (gpu) {
          const adapter = await gpu.requestAdapter();
          if (adapter) {
            result.webgpu.supported = true;
            result.recommended = RenderBackend.WEBGPU;
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

    // Check WebGL2 support
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      if (gl) {
        result.webgl2.supported = true;
      } else {
        result.webgl2.reason = 'WebGL2 not supported';
      }
    } else {
      result.webgl2.reason = 'DOM not available';
    }

    return result;
  }

  /**
   * Create rendering backend with automatic capability detection
   *
   * @param canvas - Canvas element to render to
   * @param options - Backend options
   * @returns Initialized backend
   * @throws Error if no backend is available
   */
  static async create(
    canvas: HTMLCanvasElement,
    options: BackendFactoryOptions = {}
  ): Promise<IRendererBackend> {
    const {
      preferredBackend,
      forceBackend,
      enableWebGPU = true,
      enableWebGL2 = true,
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

    // If forced backend, try only that one
    if (forceBackend) {
      const backend = await this.createBackend(forceBackend, config, enableWebGPU, enableWebGL2);
      if (backend) {
        return backend;
      }
      throw new Error(`Forced backend ${forceBackend} not available`);
    }

    // Try preferred backend first if specified
    if (preferredBackend) {
      const backend = await this.createBackend(preferredBackend, config, enableWebGPU, enableWebGL2);
      if (backend) {
        return backend;
      }
      console.warn(`Preferred backend ${preferredBackend} not available, falling back`);
    }

    // Try WebGPU first (if enabled)
    if (enableWebGPU) {
      const webgpu = await this.createBackend(RenderBackend.WEBGPU, config, true, false);
      if (webgpu) {
        return webgpu;
      }
    }

    // Fall back to WebGL2
    if (enableWebGL2) {
      const webgl2 = await this.createBackend(RenderBackend.WEBGL2, config, false, true);
      if (webgl2) {
        return webgl2;
      }
    }

    throw new Error('No rendering backend available. Browser does not support WebGPU or WebGL2.');
  }

  /**
   * Create specific backend
   */
  private static async createBackend(
    type: RenderBackend,
    config: BackendConfig,
    enableWebGPU: boolean,
    enableWebGL2: boolean
  ): Promise<IRendererBackend | null> {
    switch (type) {
      case RenderBackend.WEBGPU:
        if (!enableWebGPU) return null;
        return this.tryCreateWebGPU(config);

      case RenderBackend.WEBGL2:
        if (!enableWebGL2) return null;
        return this.tryCreateWebGL2(config);

      default:
        console.warn(`Unknown backend type: ${type}`);
        return null;
    }
  }

  /**
   * Try to create WebGPU backend
   */
  private static async tryCreateWebGPU(config: BackendConfig): Promise<IRendererBackend | null> {
    try {
      const backend = new WebGPUBackend();
      const success = await backend.initialize(config);
      if (success) {
        console.log('Using WebGPU backend');
        return backend;
      }
      return null;
    } catch (error) {
      console.warn('Failed to create WebGPU backend:', error);
      return null;
    }
  }

  /**
   * Try to create WebGL2 backend
   */
  private static async tryCreateWebGL2(config: BackendConfig): Promise<IRendererBackend | null> {
    try {
      const backend = new WebGL2Backend();
      const success = await backend.initialize(config);
      if (success) {
        console.log('Using WebGL2 backend');
        return backend;
      }
      return null;
    } catch (error) {
      console.warn('Failed to create WebGL2 backend:', error);
      return null;
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

    lines.push(
      `WebGL2: ${support.webgl2.supported ? '✓ Supported' : '✗ Not Available'}`
    );

    if (!support.webgl2.supported && support.webgl2.reason) {
      lines.push(`  Reason: ${support.webgl2.reason}`);
    }

    lines.push('', `Recommended: ${support.recommended}`);

    return lines.join('\n');
  }
}
