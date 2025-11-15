/**
 * WebGPU Device Initialization - Epic RENDERING-05
 *
 * Handles GPU device and context setup with proper error handling.
 * Extracted from WebGPUBackend to reduce file size and method complexity.
 */

import type { BackendConfig } from '../IRendererBackend.js';
import type { WebGPUContext } from './WebGPUTypes.js';

export interface DeviceInitResult {
  success: boolean;
  adapter: GPUAdapter | null;
  hasTimestampQuery: boolean;
}

/**
 * Request GPU adapter with specified power preference
 */
async function requestAdapter(config: BackendConfig): Promise<GPUAdapter | null> {
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: (config.powerPreference ?? 'high-performance') as GPUPowerPreference,
  });

  if (!adapter) {
    console.error('Failed to get WebGPU adapter');
    return null;
  }

  return adapter;
}

/**
 * Check for optional features and build required features list
 */
function checkFeatures(adapter: GPUAdapter): { features: GPUFeatureName[]; hasTimestampQuery: boolean } {
  const requiredFeatures: GPUFeatureName[] = [];
  let hasTimestampQuery = false;

  if (adapter.features.has('timestamp-query')) {
    requiredFeatures.push('timestamp-query');
    hasTimestampQuery = true;
    console.log('WebGPU: timestamp-query feature available');
  } else {
    console.warn('WebGPU: timestamp-query not available, GPU timing will not be measured');
  }

  return { features: requiredFeatures, hasTimestampQuery };
}

/**
 * Request GPU device with required features
 */
async function requestDevice(adapter: GPUAdapter, requiredFeatures: GPUFeatureName[]): Promise<GPUDevice> {
  return await adapter.requestDevice({ requiredFeatures });
}

/**
 * Setup uncaptured error handler for GPU device
 */
function setupErrorHandler(device: GPUDevice): void {
  device.addEventListener('uncapturederror', (event: GPUUncapturedErrorEvent) => {
    console.error('🚨 WebGPU Uncaptured Error:', event.error);
    console.error('   Type:', event.error.constructor.name);
    console.error('   Message:', event.error.message);
    if ('lineNum' in event.error) {
      console.error('   Line:', (event.error as any).lineNum);
    }
  });
}

/**
 * Configure canvas WebGPU context
 */
function configureContext(
  canvas: HTMLCanvasElement,
  device: GPUDevice,
  config: BackendConfig
): GPUCanvasContext | null {
  const context = canvas.getContext('webgpu');
  if (!context) {
    console.error('Failed to get WebGPU context');
    return null;
  }

  const preferredFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format: preferredFormat,
    alphaMode: config.alpha ? 'premultiplied' : 'opaque',
  });

  return context;
}

/**
 * Initialize WebGPU device and context
 * Returns adapter and timestamp query support status
 */
export async function initializeDeviceAndContext(
  ctx: WebGPUContext,
  config: BackendConfig
): Promise<DeviceInitResult> {
  // Request adapter
  const adapter = await requestAdapter(config);
  if (!adapter) {
    return { success: false, adapter: null, hasTimestampQuery: false };
  }

  // Check features
  const { features, hasTimestampQuery } = checkFeatures(adapter);

  // Request device
  const device = await requestDevice(adapter, features);
  setupErrorHandler(device);
  ctx.device = device;

  // Configure canvas context
  if (!ctx.canvas) {
    console.error('Canvas not set in WebGPUContext');
    return { success: false, adapter, hasTimestampQuery };
  }

  const context = configureContext(ctx.canvas, device, config);
  if (!context) {
    return { success: false, adapter, hasTimestampQuery };
  }

  ctx.context = context;
  ctx.preferredFormat = navigator.gpu.getPreferredCanvasFormat();

  return { success: true, adapter, hasTimestampQuery };
}
