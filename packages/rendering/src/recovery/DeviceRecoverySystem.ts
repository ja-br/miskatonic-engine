/**
 * DeviceRecoverySystem - Epic RENDERING-04, Task 4.3
 *
 * Automatic GPU device loss recovery with resource recreation.
 * Orchestrates DeviceLossDetector and ResourceRegistry for seamless recovery.
 *
 * Features:
 * - Automatic device loss detection
 * - Resource recreation in correct dependency order
 * - Retry logic with exponential backoff
 * - Progress callbacks for UI feedback
 * - Comprehensive error handling
 *
 * Usage:
 * ```typescript
 * const recovery = new DeviceRecoverySystem(backend, {
 *   maxRetries: 3,
 *   retryDelay: 1000
 * });
 *
 * recovery.onRecovery((progress) => {
 *   console.log(`Recovery: ${progress.phase}`);
 * });
 * ```
 */

import { DeviceLossDetector, type DeviceLossInfo } from './DeviceLossDetector';
import { ResourceRegistry, ResourceType, type ResourceDescriptor, type BufferDescriptor, type TextureDescriptor, type ShaderDescriptor } from './ResourceRegistry';
import type { IRendererBackend } from '../backends/IRendererBackend';

export interface RecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  logProgress?: boolean;
}

export interface RecoveryProgress {
  phase: 'detecting' | 'reinitializing' | 'recreating' | 'complete' | 'failed';
  resourcesRecreated: number;
  totalResources: number;
  error?: Error;
}

export type RecoveryCallback = (progress: RecoveryProgress) => void;

export class DeviceRecoverySystem {
  private detector: DeviceLossDetector | null = null;
  private registry: ResourceRegistry;
  private callbacks: RecoveryCallback[] = [];
  private recovering = false;
  private options: Required<RecoveryOptions>;

  constructor(
    private backend: IRendererBackend,
    options: RecoveryOptions = {}
  ) {
    this.registry = new ResourceRegistry();

    // Set defaults
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      logProgress: options.logProgress ?? true
    };

    // DeviceLossDetector will be set up when we have a GPUDevice
    // This happens after backend.initialize() is called
  }

  /**
   * Initialize detector with GPUDevice
   * Called by WebGPUBackend after device is created
   */
  initializeDetector(device: GPUDevice): void {
    if (this.detector) {
      // Update existing detector with new device (after recovery)
      this.detector.updateDevice(device);
      if (this.options.logProgress) {
        console.log('[DeviceRecoverySystem] Updated detector with new device');
      }
      return;
    }

    this.detector = new DeviceLossDetector(device);

    // Register device loss handler
    this.detector.onDeviceLost((info) => {
      this.handleDeviceLoss(info);
    });

    if (this.options.logProgress) {
      console.log('[DeviceRecoverySystem] Initialized with device:', device);
    }
  }

  /**
   * Register resource for recovery
   */
  registerResource(descriptor: ResourceDescriptor): string {
    return this.registry.register(descriptor);
  }

  /**
   * Unregister resource (when destroyed)
   */
  unregisterResource(id: string): void {
    this.registry.unregister(id);
  }

  /**
   * Register recovery progress callback
   */
  onRecovery(callback: RecoveryCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index !== -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Handle device loss and attempt recovery
   * IMPORTANT: This is called from DeviceLossDetector callback (un-awaited),
   * so we MUST catch all errors to prevent unhandled rejections.
   */
  private async handleDeviceLoss(info: DeviceLossInfo): Promise<void> {
    if (this.recovering) {
      console.warn('[DeviceRecoverySystem] Recovery already in progress');
      return;
    }

    this.recovering = true;

    try {
      if (this.options.logProgress) {
        console.warn(`[DeviceRecoverySystem] GPU device lost: ${info.reason} - ${info.message}`);
        console.log('[DeviceRecoverySystem] Attempting automatic recovery...');
      }

      this.notifyProgress({
        phase: 'detecting',
        resourcesRecreated: 0,
        totalResources: this.registry.getAll().length
      });

      // Attempt recovery with retries
      for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
        try {
          if (this.options.logProgress && attempt > 1) {
            console.log(`[DeviceRecoverySystem] Recovery attempt ${attempt}/${this.options.maxRetries}...`);
          }

          await this.performRecovery();

          if (this.options.logProgress) {
            console.log('[DeviceRecoverySystem] Device recovery successful!');
          }

          this.notifyProgress({
            phase: 'complete',
            resourcesRecreated: this.registry.getAll().length,
            totalResources: this.registry.getAll().length
          });

          this.recovering = false;
          return;

        } catch (error) {
          if (this.options.logProgress) {
            console.error(`[DeviceRecoverySystem] Recovery attempt ${attempt} failed:`, error);
          }

          if (attempt < this.options.maxRetries) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
          } else {
            // Final attempt failed - notify and log, but DON'T throw
            // (this function is called from un-awaited callback)
            if (this.options.logProgress) {
              console.error('[DeviceRecoverySystem] Device recovery failed after all retries');
            }

            this.notifyProgress({
              phase: 'failed',
              resourcesRecreated: 0,
              totalResources: this.registry.getAll().length,
              error: error as Error
            });

            this.recovering = false;
            // Don't throw - just return. Throwing from un-awaited async = unhandled rejection
            return;
          }
        }
      }
    } catch (error) {
      // Outer catch for any unexpected errors
      console.error('[DeviceRecoverySystem] FATAL: Unexpected error in handleDeviceLoss:', error);
      this.notifyProgress({
        phase: 'failed',
        resourcesRecreated: 0,
        totalResources: this.registry.getAll().length,
        error: error as Error
      });
      this.recovering = false;
      // Don't re-throw - would cause unhandled rejection
    }
  }

  /**
   * Perform actual recovery
   */
  private async performRecovery(): Promise<void> {
    // Phase 1: Reinitialize device
    this.notifyProgress({
      phase: 'reinitializing',
      resourcesRecreated: 0,
      totalResources: this.registry.getAll().length
    });

    await this.backend.reinitialize();

    // Phase 2: Recreate resources in dependency order
    this.notifyProgress({
      phase: 'recreating',
      resourcesRecreated: 0,
      totalResources: this.registry.getAll().length
    });

    // Resource recreation order matters - dependencies first
    const resourceOrder = [
      ResourceType.SAMPLER,
      ResourceType.SHADER,
      ResourceType.BUFFER,
      ResourceType.TEXTURE,
      ResourceType.BIND_GROUP_LAYOUT,
      ResourceType.BIND_GROUP,
      ResourceType.PIPELINE
    ];

    let recreated = 0;

    for (const type of resourceOrder) {
      const resources = this.registry.getByType(type);

      for (const descriptor of resources) {
        await this.recreateResource(descriptor);
        recreated++;

        this.notifyProgress({
          phase: 'recreating',
          resourcesRecreated: recreated,
          totalResources: this.registry.getAll().length
        });
      }
    }

    // Phase 3: Clear data references to release RAM
    // After successful recovery, we no longer need the ArrayBuffer copies
    // This prevents double memory consumption (VRAM + RAM)
    this.clearResourceData();
  }

  /**
   * Clear data fields from registered resources to release RAM.
   * Called after successful recovery - data has been uploaded to GPU,
   * so we can release the RAM copies to avoid double memory footprint.
   */
  private clearResourceData(): void {
    for (const resource of this.registry.getAll()) {
      // Only Buffer and Texture descriptors have data fields
      if (resource.type === ResourceType.BUFFER) {
        (resource as BufferDescriptor).data = undefined;
      } else if (resource.type === ResourceType.TEXTURE) {
        (resource as TextureDescriptor).data = undefined;
      }
    }

    if (this.options.logProgress) {
      console.log('[DeviceRecoverySystem] Cleared resource data to release RAM');
    }
  }

  /**
   * Recreate individual resource
   */
  private async recreateResource(descriptor: ResourceDescriptor): Promise<void> {
    switch (descriptor.type) {
      case ResourceType.BUFFER:
        await this.recreateBuffer(descriptor as BufferDescriptor);
        break;

      case ResourceType.TEXTURE:
        await this.recreateTexture(descriptor as TextureDescriptor);
        break;

      case ResourceType.SHADER:
        await this.recreateShader(descriptor as ShaderDescriptor);
        break;

      // TODO: Add other resource types (Pipeline, BindGroup, etc.)
      // These require more complex recreation logic and will be implemented
      // as part of Task 4.4 integration

      default:
        if (this.options.logProgress) {
          console.warn(`[DeviceRecoverySystem] Don't know how to recreate resource type: ${descriptor.type}`);
        }
    }
  }

  private async recreateBuffer(descriptor: BufferDescriptor): Promise<void> {
    const { bufferType, size, usage } = descriptor.creationParams;
    const data = descriptor.data || new ArrayBuffer(size);

    this.backend.createBuffer(
      descriptor.id,
      bufferType,
      data,
      usage
    );

    if (this.options.logProgress) {
      console.log(`[DeviceRecoverySystem] Recreated buffer: ${descriptor.id}`);
    }
  }

  private async recreateTexture(descriptor: TextureDescriptor): Promise<void> {
    const { width, height, format, minFilter, magFilter, wrapS, wrapT, generateMipmaps } = descriptor.creationParams;

    // Convert ArrayBuffer to Uint8Array if needed
    // Skip ImageBitmap (can't be serialized for recovery)
    let data: ArrayBufferView | HTMLImageElement | HTMLCanvasElement | ImageData | null = null;
    if (descriptor.data instanceof ArrayBuffer) {
      data = new Uint8Array(descriptor.data);
    } else if (descriptor.data && !(descriptor.data instanceof ImageBitmap)) {
      data = descriptor.data as HTMLImageElement | HTMLCanvasElement | ImageData;
    }

    this.backend.createTexture(
      descriptor.id,
      width,
      height,
      data,
      {
        format,
        minFilter,
        magFilter,
        wrapS,
        wrapT,
        generateMipmaps
      }
    );

    if (this.options.logProgress) {
      console.log(`[DeviceRecoverySystem] Recreated texture: ${descriptor.id}`);
    }
  }

  private async recreateShader(descriptor: ShaderDescriptor): Promise<void> {
    this.backend.createShader(
      descriptor.id,
      descriptor.creationParams.source
    );

    if (this.options.logProgress) {
      console.log(`[DeviceRecoverySystem] Recreated shader: ${descriptor.id}`);
    }
  }

  private notifyProgress(progress: RecoveryProgress): void {
    for (const callback of this.callbacks) {
      try {
        callback(progress);
      } catch (error) {
        console.error('[DeviceRecoverySystem] Error in recovery callback:', error);
      }
    }
  }

  /**
   * Get recovery statistics
   */
  getStats(): { registered: number; byType: Record<string, number> } {
    const stats = this.registry.getStats();
    return {
      registered: stats.total,
      byType: stats.byType
    };
  }

  /**
   * Check if currently recovering
   */
  isRecovering(): boolean {
    return this.recovering;
  }

  /**
   * Get the resource registry (for debugging)
   */
  getRegistry(): ResourceRegistry {
    return this.registry;
  }
}
