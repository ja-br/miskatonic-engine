/**
 * DeviceLossDetector - Epic RENDERING-04, Task 4.1
 *
 * Monitors WebGPU device loss and notifies registered callbacks.
 * Replaces the basic device.lost handler from WebGPUBackend.ts
 *
 * Usage:
 * ```typescript
 * const detector = new DeviceLossDetector(device);
 * const unsubscribe = detector.onDeviceLost((info) => {
 *   console.error(`Device lost: ${info.reason} - ${info.message}`);
 * });
 * ```
 */

export interface DeviceLossInfo {
  reason: 'unknown' | 'destroyed' | 'validation-error' | 'out-of-memory';
  message: string;
  timestamp: number;
}

export type DeviceLossCallback = (info: DeviceLossInfo) => void;

export class DeviceLossDetector {
  private callbacks: DeviceLossCallback[] = [];
  private device: GPUDevice;
  private lostPromise: Promise<GPUDeviceLostInfo>;
  private isLost = false;

  constructor(device: GPUDevice) {
    this.device = device;
    this.lostPromise = device.lost;
    this.startMonitoring();
  }

  /**
   * Register callback for device loss events
   * @returns Unsubscribe function
   */
  onDeviceLost(callback: DeviceLossCallback): () => void {
    this.callbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index !== -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Start monitoring for device loss
   */
  private async startMonitoring(): Promise<void> {
    try {
      const info = await this.lostPromise;
      this.isLost = true;

      const lossInfo: DeviceLossInfo = {
        reason: this.normalizeReason(info.reason),
        message: info.message,
        timestamp: Date.now()
      };

      // Notify all callbacks
      for (const callback of this.callbacks) {
        try {
          callback(lossInfo);
        } catch (error) {
          console.error('Error in device loss callback:', error);
        }
      }
    } catch (error) {
      console.error('Error monitoring device loss:', error);
    }
  }

  /**
   * Normalize GPUDeviceLostReason to our standard reasons
   */
  private normalizeReason(reason: GPUDeviceLostReason): DeviceLossInfo['reason'] {
    switch (reason) {
      case 'destroyed':
        return 'destroyed';
      default:
        // 'unknown' is the only other standard value in WebGPU spec
        // Future specs may add 'validation-error' or 'out-of-memory'
        return 'unknown';
    }
  }

  /**
   * Check if device is still valid
   */
  isDeviceValid(): boolean {
    return !this.isLost && this.device && !this.device.destroyed;
  }

  /**
   * Get the monitored device
   */
  getDevice(): GPUDevice {
    return this.device;
  }
}
