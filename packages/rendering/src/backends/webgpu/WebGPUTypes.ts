/**
 * Shared types for WebGPU backend modules
 * Epic RENDERING-05 Task 5.3
 *
 * These interfaces define the shared state and configuration used across
 * all WebGPU backend modules (ResourceManager, PipelineManager, etc.)
 *
 * @internal - Not for public API use
 * @packageDocumentation
 */

import type { VRAMProfiler } from '../../VRAMProfiler.js';
import type { GPUBufferPool } from '../../GPUBufferPool.js';
import type { BindGroupPool } from '../../BindGroupPool.js';
import type { DeviceRecoverySystem } from '../../recovery/DeviceRecoverySystem.js';
import type { WGSLReflectionParser } from '../../ShaderReflection.js';
import type { ShaderReflectionCache } from '../../ShaderReflection.js';

/**
 * WebGPU device context shared across all modules.
 * This is the core GPU state that all modules need access to.
 */
export interface WebGPUContext {
  /** WebGPU device instance */
  device: GPUDevice | null;

  /** Canvas element */
  canvas: HTMLCanvasElement | null;

  /** Canvas context for presenting rendered frames */
  context: GPUCanvasContext | null;

  /** Preferred texture format for the canvas (e.g., 'bgra8unorm') */
  preferredFormat: GPUTextureFormat | null;

  /** Current command encoder (created per frame) */
  commandEncoder: GPUCommandEncoder | null;

  /** Current render pass encoder (active during rendering) */
  currentPass: GPURenderPassEncoder | null;

  /** Current compute pass encoder (active during compute) */
  currentComputePass: GPUComputePassEncoder | null;
}

/**
 * Configuration for WebGPU backend modules.
 * Contains shared resources like pools, caches, and profilers.
 */
export interface ModuleConfig {
  /** VRAM usage profiler */
  vramProfiler: VRAMProfiler;

  /** GPU buffer pool for reusing buffers */
  bufferPool: GPUBufferPool;

  /** Bind group pool for caching bind groups */
  bindGroupPool: BindGroupPool;

  /** Device recovery system (Epic RENDERING-04) */
  recoverySystem: DeviceRecoverySystem | null;

  /** Shader reflection parser */
  reflectionParser: WGSLReflectionParser;

  /** Shader reflection cache */
  reflectionCache: ShaderReflectionCache;

  /** Enable validation mode (performance impact) */
  enableValidation: boolean;
}

/**
 * WebGPU shader resource handle
 */
export interface WebGPUShader {
  id: string;
  module: GPUShaderModule;
  bindGroupLayout: GPUBindGroupLayout;
  source: string;
  type: 'vertex' | 'fragment' | 'compute';
}

/**
 * WebGPU buffer resource handle
 */
export interface WebGPUBuffer {
  id: string;
  buffer: GPUBuffer;
  size: number;
  usage: GPUBufferUsageFlags;
}

/**
 * WebGPU texture resource handle
 */
export interface WebGPUTexture {
  id: string;
  texture: GPUTexture;
  view: GPUTextureView;
  width: number;
  height: number;
  format: GPUTextureFormat;
}

/**
 * WebGPU framebuffer resource handle
 */
export interface WebGPUFramebuffer {
  id: string;
  colorAttachments: GPUTextureView[];
  depthStencilAttachment?: GPUTextureView;
  width: number;
  height: number;
}

/**
 * Pipeline cache entry
 */
export interface PipelineCacheEntry {
  pipeline: GPURenderPipeline | GPUComputePipeline;
  type: 'render' | 'compute';
  lastUsedFrame: number;
}

/**
 * Standardized error messages for WebGPU backend
 */
export const WebGPUErrors = {
  DEVICE_NOT_INITIALIZED: 'WebGPU device not initialized',
  ENCODER_NOT_INITIALIZED: 'WebGPU command encoder not initialized',
  CONTEXT_NOT_INITIALIZED: 'WebGPU context not initialized',
  CANVAS_NOT_INITIALIZED: 'WebGPU canvas not initialized',
  NO_ACTIVE_RENDER_PASS: 'No active render pass',
} as const;
