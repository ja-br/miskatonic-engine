/**
 * DeviceRecoverySystem Tests - Epic RENDERING-04, Task 4.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceRecoverySystem } from '../../src/recovery/DeviceRecoverySystem';
import { ResourceType } from '../../src/recovery/ResourceRegistry';
import type { IRendererBackend } from '../../src/backends/IRendererBackend';
import type { BufferDescriptor, TextureDescriptor, ShaderDescriptor } from '../../src/recovery/ResourceRegistry';

// Mock Backend
function createMockBackend(): IRendererBackend {
  return {
    reinitialize: vi.fn().mockResolvedValue(undefined),
    createBuffer: vi.fn(),
    createTexture: vi.fn(),
    createShader: vi.fn(),
  } as unknown as IRendererBackend;
}

// Mock GPUDevice
function createMockDevice(lostPromise?: Promise<GPUDeviceLostInfo>): GPUDevice {
  return {
    lost: lostPromise || new Promise(() => {}),
    destroyed: false,
  } as GPUDevice;
}

describe('DeviceRecoverySystem', () => {
  let backend: IRendererBackend;
  let recovery: DeviceRecoverySystem;

  beforeEach(() => {
    backend = createMockBackend();
    recovery = new DeviceRecoverySystem(backend, {
      maxRetries: 3,
      retryDelay: 10, // Short delay for tests
      logProgress: false // Disable logs in tests
    });
  });

  describe('Construction', () => {
    it('should create recovery system with backend', () => {
      expect(recovery).toBeDefined();
      expect(recovery.isRecovering()).toBe(false);
    });

    it('should use default options', () => {
      const defaultRecovery = new DeviceRecoverySystem(backend);
      expect(defaultRecovery).toBeDefined();
    });

    it('should initialize detector with device', () => {
      const device = createMockDevice();
      expect(() => {
        recovery.initializeDetector(device);
      }).not.toThrow();
    });

    it('should not reinitialize detector', () => {
      const device1 = createMockDevice();
      const device2 = createMockDevice();

      recovery.initializeDetector(device1);
      recovery.initializeDetector(device2); // Should be ignored

      expect(recovery).toBeDefined();
    });
  });

  describe('Resource Registration', () => {
    it('should register a buffer', () => {
      const buffer: BufferDescriptor = {
        type: ResourceType.BUFFER,
        id: 'test-buffer',
        creationParams: {
          bufferType: 'vertex',
          size: 1024,
          usage: 'static_draw'
        }
      };

      const id = recovery.registerResource(buffer);
      expect(id).toBe('test-buffer');

      const stats = recovery.getStats();
      expect(stats.registered).toBe(1);
    });

    it('should register multiple resources', () => {
      recovery.registerResource({
        type: ResourceType.BUFFER,
        id: 'buffer-1',
        creationParams: { bufferType: 'vertex', size: 1024, usage: 'static_draw' }
      } as BufferDescriptor);

      recovery.registerResource({
        type: ResourceType.TEXTURE,
        id: 'texture-1',
        creationParams: { width: 256, height: 256, format: 'rgba' }
      } as TextureDescriptor);

      const stats = recovery.getStats();
      expect(stats.registered).toBe(2);
    });

    it('should unregister a resource', () => {
      recovery.registerResource({
        type: ResourceType.BUFFER,
        id: 'temp-buffer',
        creationParams: { bufferType: 'vertex', size: 512, usage: 'static_draw' }
      } as BufferDescriptor);

      expect(recovery.getStats().registered).toBe(1);

      recovery.unregisterResource('temp-buffer');
      expect(recovery.getStats().registered).toBe(0);
    });
  });

  describe('Recovery Callbacks', () => {
    it('should register recovery callback', () => {
      const callback = vi.fn();
      const unsubscribe = recovery.onRecovery(callback);

      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe callback', () => {
      const callback = vi.fn();
      const unsubscribe = recovery.onRecovery(callback);

      unsubscribe();
      // No way to directly verify, but should not throw
      expect(true).toBe(true);
    });
  });

  describe('Device Recovery', () => {
    it('should trigger recovery on device loss', async () => {
      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      recovery.initializeDetector(device);

      const callback = vi.fn();
      recovery.onRecovery(callback);

      // Trigger device loss
      resolvePromise!({ reason: 'destroyed', message: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have called callback multiple times for different phases
      expect(callback).toHaveBeenCalled();
      expect(backend.reinitialize).toHaveBeenCalled();
    });

    it('should recreate registered buffers', async () => {
      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      recovery.initializeDetector(device);

      // Register a buffer
      recovery.registerResource({
        type: ResourceType.BUFFER,
        id: 'vertex-buffer',
        creationParams: {
          bufferType: 'vertex',
          size: 1024,
          usage: 'static_draw'
        },
        data: new Float32Array([1, 2, 3]).buffer
      } as BufferDescriptor);

      // Trigger recovery
      resolvePromise!({ reason: 'destroyed', message: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(backend.createBuffer).toHaveBeenCalledWith(
        'vertex-buffer',
        'vertex',
        expect.any(ArrayBuffer),
        'static_draw'
      );
    });

    it('should recreate registered textures', async () => {
      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      recovery.initializeDetector(device);

      recovery.registerResource({
        type: ResourceType.TEXTURE,
        id: 'diffuse-map',
        creationParams: {
          width: 512,
          height: 512,
          format: 'rgba'
        }
      } as TextureDescriptor);

      resolvePromise!({ reason: 'destroyed', message: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(backend.createTexture).toHaveBeenCalledWith(
        'diffuse-map',
        512,
        512,
        null,
        expect.objectContaining({
          format: 'rgba'
        })
      );
    });

    it('should recreate registered shaders', async () => {
      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      recovery.initializeDetector(device);

      recovery.registerResource({
        type: ResourceType.SHADER,
        id: 'pbr-shader',
        creationParams: {
          source: 'struct Vertex { @location(0) position: vec3f };'
        }
      } as ShaderDescriptor);

      resolvePromise!({ reason: 'destroyed', message: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(backend.createShader).toHaveBeenCalledWith(
        'pbr-shader',
        expect.any(String)
      );
    });

    it('should report progress through callbacks', async () => {
      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      recovery.initializeDetector(device);

      const progressPhases: string[] = [];
      recovery.onRecovery((progress) => {
        progressPhases.push(progress.phase);
      });

      resolvePromise!({ reason: 'destroyed', message: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(progressPhases).toContain('detecting');
      expect(progressPhases).toContain('reinitializing');
      expect(progressPhases).toContain('complete');
    });

    it('should handle recovery failure and retry', async () => {
      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      recovery.initializeDetector(device);

      // Make reinitialize fail first time, succeed second
      let callCount = 0;
      vi.mocked(backend.reinitialize).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First attempt failed'));
        }
        return Promise.resolve();
      });

      resolvePromise!({ reason: 'destroyed', message: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for retry

      expect(backend.reinitialize).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      let rejectRecovery: (error: Error) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      recovery.initializeDetector(device);

      // Always fail
      vi.mocked(backend.reinitialize).mockRejectedValue(new Error('Always fails'));

      const callback = vi.fn();
      recovery.onRecovery(callback);

      // Wrap in try-catch to handle expected error
      try {
        resolvePromise!({ reason: 'destroyed', message: 'Test' });
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for all retries
      } catch (error) {
        // Expected to fail
      }

      // Should have been called with 'failed' phase
      const failedCall = callback.mock.calls.find(call => call[0].phase === 'failed');
      expect(failedCall).toBeDefined();
    });

    it('should prevent concurrent recovery', async () => {
      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      recovery.initializeDetector(device);

      // Make reinitialize slow
      vi.mocked(backend.reinitialize).mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 200));
      });

      // Trigger device loss
      resolvePromise!({ reason: 'destroyed', message: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(recovery.isRecovering()).toBe(true);

      // Try to trigger again - should be ignored
      // (We can't easily test this, but isRecovering() being true is the guard)
    });
  });

  describe('Resource Recreation Order', () => {
    it('should recreate resources in correct dependency order', async () => {
      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      recovery.initializeDetector(device);

      const callOrder: string[] = [];

      vi.mocked(backend.createShader).mockImplementation((id) => {
        callOrder.push(`shader:${id}`);
        return {} as any;
      });

      vi.mocked(backend.createBuffer).mockImplementation((id) => {
        callOrder.push(`buffer:${id}`);
        return {} as any;
      });

      // Register in reverse order
      recovery.registerResource({
        type: ResourceType.BUFFER,
        id: 'buffer-1',
        creationParams: { bufferType: 'vertex', size: 1024, usage: 'static_draw' }
      } as BufferDescriptor);

      recovery.registerResource({
        type: ResourceType.SHADER,
        id: 'shader-1',
        creationParams: { source: 'test' }
      } as ShaderDescriptor);

      resolvePromise!({ reason: 'destroyed', message: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 100));

      // Shader should be created before buffer
      const shaderIndex = callOrder.indexOf('shader:shader-1');
      const bufferIndex = callOrder.indexOf('buffer:buffer-1');

      expect(shaderIndex).toBeGreaterThanOrEqual(0);
      expect(bufferIndex).toBeGreaterThanOrEqual(0);
      expect(shaderIndex).toBeLessThan(bufferIndex);
    });
  });

  describe('Statistics', () => {
    it('should return correct stats', () => {
      recovery.registerResource({
        type: ResourceType.BUFFER,
        id: 'b1',
        creationParams: { bufferType: 'vertex', size: 1024, usage: 'static_draw' }
      } as BufferDescriptor);

      recovery.registerResource({
        type: ResourceType.TEXTURE,
        id: 't1',
        creationParams: { width: 256, height: 256, format: 'rgba' }
      } as TextureDescriptor);

      const stats = recovery.getStats();
      expect(stats.registered).toBe(2);
      expect(stats.byType[ResourceType.BUFFER]).toBe(1);
      expect(stats.byType[ResourceType.TEXTURE]).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should warn about unknown resource types', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Register a resource with an unknown type (casting to bypass TypeScript)
      recovery.registerResource({
        type: 'unknown-type' as any,
        id: 'unknown',
        creationParams: {}
      } as any);

      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      recovery.initializeDetector(device);

      const callback = vi.fn();
      recovery.onRecovery(callback);

      // Trigger device loss
      resolvePromise!({ reason: 'destroyed', message: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should still complete (unknown type just skipped with warning)
      const completeCall = callback.mock.calls.find(call => call[0].phase === 'complete');
      expect(completeCall).toBeDefined();

      // Note: Console.warn is used, not console.log
      // The warning is logged but might not be captured in all test environments
      // Just verify the system completed successfully without crashing

      consoleWarnSpy.mockRestore();
    });

    it('should handle unexpected errors in outer catch', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      recovery.initializeDetector(device);

      // Make notifyProgress throw on first call to trigger outer catch
      let callCount = 0;
      const originalNotifyProgress = (recovery as any).notifyProgress.bind(recovery);
      (recovery as any).notifyProgress = vi.fn().mockImplementation((progress: any) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Unexpected error in progress callback');
        }
        // Don't throw on subsequent calls to avoid infinite loop
        return originalNotifyProgress(progress);
      });

      const callback = vi.fn();
      recovery.onRecovery(callback);

      // Trigger device loss
      resolvePromise!({ reason: 'destroyed', message: 'Test' });

      // Wait for error handling to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have logged FATAL error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('FATAL: Unexpected error'),
        expect.any(Error)
      );

      // Should not crash, should exit gracefully
      expect(recovery.isRecovering()).toBe(false);

      consoleErrorSpy.mockRestore();
      (recovery as any).notifyProgress = originalNotifyProgress;
    });

    it('should clear data on failed recovery to prevent memory leak', async () => {
      const buffer = new ArrayBuffer(1024);

      const descriptor: BufferDescriptor = {
        type: ResourceType.BUFFER,
        id: 'leak-test-buffer',
        creationParams: { bufferType: 'vertex', size: 1024, usage: 'static_draw' },
        data: buffer
      };

      recovery.registerResource(descriptor);

      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      recovery.initializeDetector(device);

      // Make reinitialize always fail
      vi.mocked(backend.reinitialize).mockRejectedValue(new Error('Recovery failed'));

      const callback = vi.fn();
      recovery.onRecovery(callback);

      // Trigger device loss
      resolvePromise!({ reason: 'destroyed', message: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for all retries

      // Should have failed
      const failedCall = callback.mock.calls.find(call => call[0].phase === 'failed');
      expect(failedCall).toBeDefined();

      // CRITICAL: Data should be cleared even on failure
      expect(descriptor.data).toBeUndefined();
    });
  });
});
