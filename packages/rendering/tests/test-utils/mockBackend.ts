/**
 * Mock Backend for Testing
 * Provides a lightweight IRendererBackend implementation for unit tests
 */

import { vi } from 'vitest';
import type {
  IRendererBackend,
  BackendConfig,
  BackendCapabilities,
  BackendShaderHandle,
  BackendBufferHandle,
  BackendTextureHandle,
  BackendFramebufferHandle,
  BackendBindGroupLayoutHandle,
  BackendBindGroupHandle,
  BackendPipelineHandle,
  RenderPipelineDescriptor,
  ComputePipelineDescriptor,
  BindGroupResources,
} from '../../src/backends/IRendererBackend';
import type { ShaderSource, RenderStats } from '../../src/types';
import type { ShaderReflectionData } from '../../src/ShaderReflection';
import type { DrawCommand } from '../../src/commands/DrawCommand';

let nextHandleId = 1;

function createMockHandle(type: string): any {
  return {
    id: nextHandleId++,
    type,
    _brand: type,
  };
}

export function createMockBackend(): IRendererBackend {
  const mockBackend: IRendererBackend = {
    name: 'MockBackend',

    async initialize(config: BackendConfig): Promise<void> {
      // No-op
    },

    isInitialized(): boolean {
      return true;
    },

    getCapabilities(): BackendCapabilities {
      return {
        maxTextureSize: 4096,
        maxTextures: 16,
        maxVertexAttributes: 16,
        supportsFloatTextures: true,
        supportsDepthTextures: true,
        supportsInstancing: true,
        supportsCompute: true,
        maxComputeWorkgroupsPerDimension: 65535,
        maxBindGroups: 4,
        timestampQuerySupport: false,
      };
    },

    createShader(id: string, source: ShaderSource): BackendShaderHandle {
      return createMockHandle('shader');
    },

    createShaderWithReflection(id: string, source: ShaderSource): { handle: BackendShaderHandle; reflection: ShaderReflectionData } {
      return {
        handle: createMockHandle('shader'),
        reflection: {
          attributes: [],
          uniforms: [],
          bindings: [],
          bindGroupLayouts: [],
        },
      };
    },

    createBuffer(id: string, type: any, data: ArrayBufferView, usage: any): BackendBufferHandle {
      return createMockHandle('buffer');
    },

    updateBuffer(handle: BackendBufferHandle, data: ArrayBufferView, offset?: number): void {
      // No-op
    },

    createTexture(id: string, width: number, height: number, data: any, config: any): BackendTextureHandle {
      return createMockHandle('texture');
    },

    updateTexture(handle: BackendTextureHandle, data: any, x?: number, y?: number, width?: number, height?: number): void {
      // No-op
    },

    createFramebuffer(id: string, width: number, height: number, hasDepth: boolean): BackendFramebufferHandle {
      return createMockHandle('framebuffer');
    },

    createBindGroupLayout(descriptor: any): BackendBindGroupLayoutHandle {
      return createMockHandle('bindGroupLayout');
    },

    createBindGroup(layout: BackendBindGroupLayoutHandle, resources: BindGroupResources): BackendBindGroupHandle {
      return createMockHandle('bindGroup');
    },

    createRenderPipeline(descriptor: RenderPipelineDescriptor): BackendPipelineHandle {
      return createMockHandle('renderPipeline');
    },

    createComputePipeline(descriptor: ComputePipelineDescriptor): BackendPipelineHandle {
      return createMockHandle('computePipeline');
    },

    beginFrame(): void {
      // No-op
    },

    endFrame(): RenderStats {
      return {
        drawCalls: 0,
        triangles: 0,
        cpuTimeMs: 0,
        gpuTimeMs: 0,
        bufferUpdates: 0,
      };
    },

    executeDrawCommand(command: DrawCommand): void {
      // No-op
    },

    executeDrawCommands(commands: DrawCommand[]): void {
      // No-op
    },

    deleteShader(handle: BackendShaderHandle): void {
      // No-op
    },

    deleteBuffer(handle: BackendBufferHandle): void {
      // No-op
    },

    deleteTexture(handle: BackendTextureHandle): void {
      // No-op
    },

    deleteFramebuffer(handle: BackendFramebufferHandle): void {
      // No-op
    },

    resize(width: number, height: number): void {
      // No-op
    },

    getVRAMStats(): any {
      return {
        used: 0,
        budget: 512 * 1024 * 1024,
        textures: 0,
        buffers: 0,
      };
    },

    isContextLost(): boolean {
      return false;
    },

    getDepthFormat(): string {
      return 'depth24plus';
    },

    dispose(): void {
      // No-op
    },
  };

  // Add spies to all methods for testing
  Object.keys(mockBackend).forEach((key) => {
    const value = (mockBackend as any)[key];
    if (typeof value === 'function') {
      (mockBackend as any)[key] = vi.fn(value);
    }
  });

  return mockBackend;
}
