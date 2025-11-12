/**
 * Mock WebGPU Device for Testing
 *
 * Provides a minimal WebGPU API mock for unit tests.
 * For integration tests, use @webgpu/types with actual GPU backend.
 */

import { vi } from 'vitest';

/**
 * Mock WebGPU constants
 */
if (typeof globalThis.GPUBufferUsage === 'undefined') {
  // @ts-expect-error - Mocking global WebGPU constants
  globalThis.GPUBufferUsage = {
    MAP_READ: 0x0001,
    MAP_WRITE: 0x0002,
    COPY_SRC: 0x0004,
    COPY_DST: 0x0008,
    INDEX: 0x0010,
    VERTEX: 0x0020,
    UNIFORM: 0x0040,
    STORAGE: 0x0080,
    INDIRECT: 0x0100,
    QUERY_RESOLVE: 0x0200,
  };
}

if (typeof globalThis.GPUTextureUsage === 'undefined') {
  // @ts-expect-error - Mocking global WebGPU constants
  globalThis.GPUTextureUsage = {
    COPY_SRC: 0x01,
    COPY_DST: 0x02,
    TEXTURE_BINDING: 0x04,
    STORAGE_BINDING: 0x08,
    RENDER_ATTACHMENT: 0x10,
  };
}

if (typeof globalThis.GPUMapMode === 'undefined') {
  // @ts-expect-error - Mocking global WebGPU constants
  globalThis.GPUMapMode = {
    READ: 0x0001,
    WRITE: 0x0002,
  };
}

/**
 * Create a mock GPUDevice for testing
 */
export function createMockGPUDevice(): GPUDevice {
  const mockBuffers: Map<string, { size: number; destroyed: boolean }> = new Map();
  const mockTextures: Map<string, { destroyed: boolean }> = new Map();
  let bufferIdCounter = 0;
  let textureIdCounter = 0;

  const mockDevice = {
    createShaderModule: vi.fn(() => ({
      label: 'Mock Shader Module',
    })),

    createComputePipeline: vi.fn(() => ({
      label: 'Mock Compute Pipeline',
      getBindGroupLayout: vi.fn(() => ({
        label: 'Mock Bind Group Layout',
      })),
    })),

    createBuffer: vi.fn((descriptor: GPUBufferDescriptor) => {
      const bufferId = `buffer_${bufferIdCounter++}`;
      mockBuffers.set(bufferId, { size: descriptor.size, destroyed: false });

      return {
        label: descriptor.label,
        size: descriptor.size,
        usage: descriptor.usage,
        destroy: vi.fn(() => {
          const buffer = mockBuffers.get(bufferId);
          if (buffer) {
            buffer.destroyed = true;
          }
        }),
        mapAsync: vi.fn(() => Promise.resolve()),
        getMappedRange: vi.fn(() => new ArrayBuffer(descriptor.size)),
        unmap: vi.fn(),
      };
    }),

    createTexture: vi.fn((descriptor: GPUTextureDescriptor) => {
      const textureId = `texture_${textureIdCounter++}`;
      mockTextures.set(textureId, { destroyed: false });

      const mockTexture = {
        label: descriptor.label,
        width: descriptor.size.width,
        height: descriptor.size.height,
        format: descriptor.format,
        usage: descriptor.usage,
        destroy: vi.fn(() => {
          const texture = mockTextures.get(textureId);
          if (texture) {
            texture.destroyed = true;
          }
        }),
        createView: vi.fn((viewDescriptor?: GPUTextureViewDescriptor) => ({
          label: viewDescriptor?.label || 'Mock Texture View',
          format: viewDescriptor?.format || descriptor.format,
          dimension: viewDescriptor?.dimension || '2d',
        })),
      };

      return mockTexture;
    }),

    createBindGroup: vi.fn(() => ({
      label: 'Mock Bind Group',
    })),

    createCommandEncoder: vi.fn(() => ({
      label: 'Mock Command Encoder',
      beginComputePass: vi.fn(() => ({
        setPipeline: vi.fn(),
        setBindGroup: vi.fn(),
        dispatchWorkgroups: vi.fn(),
        end: vi.fn(),
      })),
      beginRenderPass: vi.fn(() => ({
        setPipeline: vi.fn(),
        setBindGroup: vi.fn(),
        draw: vi.fn(),
        end: vi.fn(),
      })),
      copyBufferToBuffer: vi.fn(),
      finish: vi.fn(() => ({
        label: 'Mock Command Buffer',
      })),
    })),

    queue: {
      submit: vi.fn(),
      writeBuffer: vi.fn(),
    },
  } as any;

  return mockDevice;
}
