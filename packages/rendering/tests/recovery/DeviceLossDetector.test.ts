/**
 * DeviceLossDetector Tests - Epic RENDERING-04, Task 4.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceLossDetector } from '../../src/recovery/DeviceLossDetector';

// Mock GPUDevice
function createMockDevice(lostPromise?: Promise<GPUDeviceLostInfo>): GPUDevice {
  return {
    lost: lostPromise || new Promise(() => {}), // Never resolves by default
    destroyed: false,
  } as GPUDevice;
}

describe('DeviceLossDetector', () => {
  describe('Construction', () => {
    it('should create detector with valid device', () => {
      const device = createMockDevice();
      const detector = new DeviceLossDetector(device);

      expect(detector).toBeDefined();
      expect(detector.getDevice()).toBe(device);
    });

    it('should start monitoring immediately', () => {
      const device = createMockDevice();
      const detector = new DeviceLossDetector(device);

      expect(detector.isDeviceValid()).toBe(true);
    });
  });

  describe('Device Loss Detection', () => {
    it('should detect device loss with "destroyed" reason', async () => {
      const lostInfo: GPUDeviceLostInfo = {
        reason: 'destroyed',
        message: 'Device was destroyed'
      };

      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      const detector = new DeviceLossDetector(device);

      const callback = vi.fn();
      detector.onDeviceLost(callback);

      // Trigger device loss
      resolvePromise!(lostInfo);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        reason: 'destroyed',
        message: 'Device was destroyed',
        timestamp: expect.any(Number)
      });
    });

    it('should detect device loss with "unknown" reason', async () => {
      const lostInfo: GPUDeviceLostInfo = {
        reason: 'unknown' as GPUDeviceLostReason,
        message: 'Unknown device loss'
      };

      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      const detector = new DeviceLossDetector(device);

      const callback = vi.fn();
      detector.onDeviceLost(callback);

      resolvePromise!(lostInfo);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].reason).toBe('unknown');
    });

    it('should set isDeviceValid to false after loss', async () => {
      const lostInfo: GPUDeviceLostInfo = {
        reason: 'destroyed',
        message: 'Device was destroyed'
      };

      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      const detector = new DeviceLossDetector(device);

      expect(detector.isDeviceValid()).toBe(true);

      resolvePromise!(lostInfo);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(detector.isDeviceValid()).toBe(false);
    });
  });

  describe('Callback Registration', () => {
    it('should allow multiple callbacks', async () => {
      const lostInfo: GPUDeviceLostInfo = {
        reason: 'destroyed',
        message: 'Test'
      };

      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      const detector = new DeviceLossDetector(device);

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      detector.onDeviceLost(callback1);
      detector.onDeviceLost(callback2);
      detector.onDeviceLost(callback3);

      resolvePromise!(lostInfo);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should provide unsubscribe function', async () => {
      const lostInfo: GPUDeviceLostInfo = {
        reason: 'destroyed',
        message: 'Test'
      };

      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      const detector = new DeviceLossDetector(device);

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsubscribe1 = detector.onDeviceLost(callback1);
      detector.onDeviceLost(callback2);

      // Unsubscribe first callback
      unsubscribe1();

      resolvePromise!(lostInfo);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should handle unsubscribe called multiple times', () => {
      const device = createMockDevice();
      const detector = new DeviceLossDetector(device);

      const callback = vi.fn();
      const unsubscribe = detector.onDeviceLost(callback);

      // Should not throw
      expect(() => {
        unsubscribe();
        unsubscribe();
        unsubscribe();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should catch errors in callbacks and continue', async () => {
      const lostInfo: GPUDeviceLostInfo = {
        reason: 'destroyed',
        message: 'Test'
      };

      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      const detector = new DeviceLossDetector(device);

      const throwingCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();

      detector.onDeviceLost(throwingCallback);
      detector.onDeviceLost(normalCallback);

      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      resolvePromise!(lostInfo);
      await new Promise(resolve => setTimeout(resolve, 10));

      console.error = originalError;

      expect(throwingCallback).toHaveBeenCalledTimes(1);
      expect(normalCallback).toHaveBeenCalledTimes(1);
    });

    it('should provide accurate timestamp', async () => {
      const lostInfo: GPUDeviceLostInfo = {
        reason: 'destroyed',
        message: 'Test'
      };

      let resolvePromise: (value: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolvePromise = resolve;
      });

      const device = createMockDevice(lostPromise);
      const detector = new DeviceLossDetector(device);

      const callback = vi.fn();
      detector.onDeviceLost(callback);

      const before = Date.now();
      resolvePromise!(lostInfo);
      await new Promise(resolve => setTimeout(resolve, 10));
      const after = Date.now();

      const timestamp = callback.mock.calls[0][0].timestamp;
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('isDeviceValid', () => {
    it('should return false when device.destroyed is true', () => {
      const device = createMockDevice();
      (device as any).destroyed = true;

      const detector = new DeviceLossDetector(device);

      expect(detector.isDeviceValid()).toBe(false);
    });

    it('should return true for healthy device', () => {
      const device = createMockDevice();
      const detector = new DeviceLossDetector(device);

      expect(detector.isDeviceValid()).toBe(true);
    });
  });
});
