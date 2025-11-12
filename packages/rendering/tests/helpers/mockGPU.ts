/**
 * Mock WebGPU device for testing
 */

export function createMockGPUDevice(): GPUDevice {
  const mockTexture: Partial<GPUTexture> = {
    destroy: () => {},
    createView: () => ({} as GPUTextureView),
  };

  return {
    createTexture: () => mockTexture as GPUTexture,
    queue: {
      writeBuffer: () => {},
      submit: () => {},
    } as any,
  } as any as GPUDevice;
}

export function setupMockGPU(mock: any) {
  const device = createMockGPUDevice();

  // Mock the static getDefaultDevice method
  mock.module('../src/backends/WebGPUBackend', () => ({
    WebGPUBackend: {
      getDefaultDevice: () => device,
    },
  }));

  return device;
}
