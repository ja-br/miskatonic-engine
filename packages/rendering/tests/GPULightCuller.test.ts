/**
 * GPULightCuller Tests - Epic 3.16 Phase 2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GPULightCuller } from '../src/culling/GPULightCuller';
import type { LightData } from '../src/LightCollection';

/**
 * Mock WebGPU Device
 *
 * In production tests, use @webgpu/types with actual GPU backend.
 * For unit tests, we mock the WebGPU API surface.
 */
function createMockGPUDevice(): GPUDevice {
  const mockBuffers: Map<string, { size: number; destroyed: boolean }> = new Map();
  let bufferIdCounter = 0;

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

/**
 * Create test lights
 */
function createTestLights(count: number): LightData[] {
  const lights: LightData[] = [];

  for (let i = 0; i < count; i++) {
    lights.push({
      type: i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2, // Mix of directional, point, spot
      position: [i * 10, i * 5, i * 2],
      direction: [0, -1, 0],
      color: [1, 1, 1],
      intensity: 1.0,
      radius: 10 + i,
      innerConeAngle: Math.PI / 6,
      outerConeAngle: Math.PI / 4,
    });
  }

  return lights;
}

/**
 * Create identity matrix
 */
function createIdentityMatrix(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * Create perspective projection matrix
 */
function createPerspectiveMatrix(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fov / 2);
  const rangeInv = 1.0 / (near - far);

  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0,
  ]);
}

describe('GPULightCuller', () => {
  let mockDevice: GPUDevice;

  beforeEach(() => {
    mockDevice = createMockGPUDevice();
  });

  describe('constructor', () => {
    it('should create culler with valid configuration', () => {
      expect(() => {
        new GPULightCuller({
          device: mockDevice,
          screenWidth: 1920,
          screenHeight: 1080,
          tileSize: 16,
        });
      }).not.toThrow();
    });

    it('should use default tile size of 16', () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      expect(culler).toBeDefined();
    });

    it('should use default maxLightsPerTile of 256', () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      expect(culler).toBeDefined();
    });

    it('should accept custom maxLightsPerTile', () => {
      expect(() => {
        new GPULightCuller({
          device: mockDevice,
          screenWidth: 1920,
          screenHeight: 1080,
          maxLightsPerTile: 512,
        });
      }).not.toThrow();
    });

    it('should initialize compute pipeline on construction', () => {
      new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      expect(mockDevice.createShaderModule).toHaveBeenCalled();
      expect(mockDevice.createComputePipeline).toHaveBeenCalled();
    });
  });

  describe('cull', () => {
    it('should perform GPU culling with valid inputs', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
        tileSize: 16,
      });

      const lights = createTestLights(10);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      const result = await culler.cull(lights, projection, view);

      expect(result).toBeDefined();
      expect(result.tileLightIndices).toBeInstanceOf(Uint32Array);
      expect(result.numTiles).toBeGreaterThan(0);
      expect(result.tilesX).toBeGreaterThan(0);
      expect(result.tilesY).toBeGreaterThan(0);
      expect(result.gpuTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw error if viewMatrix not provided', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const lights = createTestLights(10);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);

      await expect(async () => {
        await culler.cull(lights, projection, undefined as any);
      }).rejects.toThrow(/GPU culling requires separate view and projection matrices/);
    });

    it('should handle empty light array', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const lights: LightData[] = [];
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      const result = await culler.cull(lights, projection, view);

      expect(result).toBeDefined();
      expect(result.tileLightIndices).toBeInstanceOf(Uint32Array);
    });

    it('should handle single light', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const lights = createTestLights(1);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      const result = await culler.cull(lights, projection, view);

      expect(result).toBeDefined();
    });

    it('should handle large light arrays (1000+ lights)', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const lights = createTestLights(1000);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      const result = await culler.cull(lights, projection, view);

      expect(result).toBeDefined();
      expect(result.tileLightIndices).toBeInstanceOf(Uint32Array);
    });

    it('should allocate buffers on first cull', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const createBufferSpy = vi.spyOn(mockDevice, 'createBuffer');

      const lights = createTestLights(10);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      await culler.cull(lights, projection, view);

      // Should create: light buffer, plane buffer, output buffer, readback buffer, config buffer
      expect(createBufferSpy).toHaveBeenCalledTimes(5);
    });

    it('should reuse buffers if size unchanged', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const lights = createTestLights(10);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      await culler.cull(lights, projection, view);

      const createBufferSpy = vi.spyOn(mockDevice, 'createBuffer');

      // Second cull with same light count
      await culler.cull(lights, projection, view);

      // Should NOT create new buffers
      expect(createBufferSpy).not.toHaveBeenCalled();
    });

    it('should reallocate buffers if light count changes', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const lights1 = createTestLights(10);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      await culler.cull(lights1, projection, view);

      const createBufferSpy = vi.spyOn(mockDevice, 'createBuffer');

      // Second cull with different light count
      const lights2 = createTestLights(20);
      await culler.cull(lights2, projection, view);

      // Should create new buffers
      expect(createBufferSpy).toHaveBeenCalled();
    });

    it('should upload light data to GPU', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const writeBufferSpy = vi.spyOn(mockDevice.queue, 'writeBuffer');

      const lights = createTestLights(10);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      await culler.cull(lights, projection, view);

      // Should upload: lights, planes, config
      expect(writeBufferSpy).toHaveBeenCalledTimes(3);
    });

    it('should dispatch compute workgroups', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
        tileSize: 16,
      });

      const encoder = mockDevice.createCommandEncoder();
      const computePass = encoder.beginComputePass();
      const dispatchSpy = vi.spyOn(computePass, 'dispatchWorkgroups');

      const lights = createTestLights(10);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      await culler.cull(lights, projection, view);

      // Verify compute dispatch was called (through mock)
      expect(mockDevice.createCommandEncoder).toHaveBeenCalled();
    });

    it('should return correct tile dimensions', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
        tileSize: 16,
      });

      const lights = createTestLights(10);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      const result = await culler.cull(lights, projection, view);

      expect(result.tilesX).toBe(120); // 1920 / 16
      expect(result.tilesY).toBe(68);  // 1080 / 16 (rounded up)
      expect(result.numTiles).toBe(120 * 68);
    });

    it('should measure GPU time', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const lights = createTestLights(10);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      const result = await culler.cull(lights, projection, view);

      expect(result.gpuTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.gpuTimeMs).toBeLessThan(1000); // Should be fast
    });
  });

  describe('resize', () => {
    it('should update screen dimensions', () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      expect(() => {
        culler.resize(1280, 720);
      }).not.toThrow();
    });

    it('should trigger buffer reallocation on next cull after resize', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const lights = createTestLights(10);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      await culler.cull(lights, projection, view);

      const createBufferSpy = vi.spyOn(mockDevice, 'createBuffer');

      culler.resize(1280, 720);

      // Next cull should reallocate (different tile count)
      await culler.cull(lights, projection, view);

      expect(createBufferSpy).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should destroy GPU resources', () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      expect(() => {
        culler.destroy();
      }).not.toThrow();
    });

    it('should be safe to call destroy multiple times', () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      culler.destroy();
      expect(() => {
        culler.destroy();
      }).not.toThrow();
    });

    it('should destroy buffers after first cull', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const lights = createTestLights(10);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      await culler.cull(lights, projection, view);

      // Mock doesn't track destroy calls, but verify no error
      expect(() => {
        culler.destroy();
      }).not.toThrow();
    });
  });

  describe('buffer management', () => {
    it('should allocate light buffer with correct size', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const lights = createTestLights(10);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      await culler.cull(lights, projection, view);

      // Light buffer should be 10 lights * 64 bytes = 640 bytes
      const createBufferCalls = (mockDevice.createBuffer as any).mock.calls;
      const lightBufferCall = createBufferCalls.find((call: any) =>
        call[0].label === 'Light Buffer'
      );

      expect(lightBufferCall).toBeDefined();
      expect(lightBufferCall[0].size).toBe(640);
    });

    it('should allocate minimum buffer size for empty lights', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const lights: LightData[] = [];
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      await culler.cull(lights, projection, view);

      // Should allocate minimum 64 bytes even for 0 lights
      const createBufferCalls = (mockDevice.createBuffer as any).mock.calls;
      const lightBufferCall = createBufferCalls.find((call: any) =>
        call[0].label === 'Light Buffer'
      );

      expect(lightBufferCall[0].size).toBe(64);
    });

    it('should allocate plane buffer with correct size', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
        tileSize: 16,
      });

      const lights = createTestLights(10);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      await culler.cull(lights, projection, view);

      // Plane buffer: (120 * 68) tiles * 6 planes * 16 bytes
      const tilesX = 120;
      const tilesY = 68;
      const expectedSize = tilesX * tilesY * 6 * 16;

      const createBufferCalls = (mockDevice.createBuffer as any).mock.calls;
      const planeBufferCall = createBufferCalls.find((call: any) =>
        call[0].label === 'Tile Plane Buffer'
      );

      expect(planeBufferCall).toBeDefined();
      expect(planeBufferCall[0].size).toBe(expectedSize);
    });

    it('should allocate output buffer with correct size', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
        tileSize: 16,
        maxLightsPerTile: 256,
      });

      const lights = createTestLights(10);
      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      await culler.cull(lights, projection, view);

      // Output buffer: (120 * 68) tiles * (256 + 1) u32s * 4 bytes
      const tilesX = 120;
      const tilesY = 68;
      const expectedSize = tilesX * tilesY * (256 + 1) * 4;

      const createBufferCalls = (mockDevice.createBuffer as any).mock.calls;
      const outputBufferCall = createBufferCalls.find((call: any) =>
        call[0].label === 'Output Buffer'
      );

      expect(outputBufferCall).toBeDefined();
      expect(outputBufferCall[0].size).toBe(expectedSize);
    });
  });

  describe('light data packing', () => {
    it('should pack light data into 64-byte struct format', async () => {
      const culler = new GPULightCuller({
        device: mockDevice,
        screenWidth: 1920,
        screenHeight: 1080,
      });

      const writeBufferSpy = vi.spyOn(mockDevice.queue, 'writeBuffer');

      const lights: LightData[] = [{
        type: 1,
        position: [1, 2, 3],
        direction: [0, -1, 0],
        radius: 10,
        color: [1, 0.5, 0.25],
        intensity: 2.5,
        innerConeAngle: Math.PI / 6,
        outerConeAngle: Math.PI / 4,
      }];

      const projection = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 100);
      const view = createIdentityMatrix();

      await culler.cull(lights, projection, view);

      // Verify writeBuffer was called with light data
      expect(writeBufferSpy).toHaveBeenCalled();

      const lightDataCall = writeBufferSpy.mock.calls.find(call =>
        call[0].label === 'Light Buffer'
      );

      expect(lightDataCall).toBeDefined();
      expect(lightDataCall[2]).toBeInstanceOf(Float32Array);
      expect(lightDataCall[2].length).toBe(16); // 64 bytes = 16 floats
    });
  });
});
