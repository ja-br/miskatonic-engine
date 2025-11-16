/**
 * WebGPU Module Initialization - Epic RENDERING-05
 *
 * Coordinates initialization of all WebGPU modules in correct dependency order.
 * Extracted from WebGPUBackend to reduce file size and enforce initialization order.
 */

import { WebGPUResourceManager } from './WebGPUResourceManager';
import { WebGPUPipelineManager } from './WebGPUPipelineManager';
import { WebGPUCommandEncoder } from './WebGPUCommandEncoder';
import { WebGPUModernAPI } from './WebGPUModernAPI';
import { WebGPURenderPassManager } from './WebGPURenderPassManager';
import { DeviceRecoverySystem } from '../../recovery/DeviceRecoverySystem';
import { BindGroupPool } from '../../BindGroupPool';
import type { IRendererBackend } from '../IRendererBackend';
import type { WebGPUContext, ModuleConfig } from './WebGPUTypes';

export interface InitializedModules {
  resourceMgr: WebGPUResourceManager;
  pipelineMgr: WebGPUPipelineManager;
  commandEncoder: WebGPUCommandEncoder;
  modernAPI: WebGPUModernAPI;
  renderPassMgr: WebGPURenderPassManager;
  recoverySystem: DeviceRecoverySystem;
}

/**
 * Initialize GPU timestamp query resources for performance profiling
 */
export function initializeTimestampQueries(
  ctx: WebGPUContext,
  hasTimestampQuery: boolean
): {
  querySet: GPUQuerySet | null;
  buffer: GPUBuffer | null;
  readBuffers: GPUBuffer[];
} {
  if (!hasTimestampQuery || !ctx.device) {
    return { querySet: null, buffer: null, readBuffers: [] };
  }

  const querySet = ctx.device.createQuerySet({
    type: 'timestamp',
    count: 2,
  });

  const buffer = ctx.device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  });

  const readBuffers: GPUBuffer[] = [];
  for (let i = 0; i < 3; i++) {
    readBuffers.push(ctx.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    }));
  }

  return { querySet, buffer, readBuffers };
}

/**
 * Initialize all WebGPU rendering modules in correct dependency order
 *
 * CRITICAL: Order matters!
 * 1. Resource management (no dependencies)
 * 2. Pipeline management (depends on resourceMgr)
 * 3. Modern API (depends on resourceMgr) - MUST come before commandEncoder
 * 4. Command encoder (depends on resourceMgr AND modernAPI)
 * 5. Render pass management (depends on resourceMgr, vramProfiler)
 * 6. Device recovery (depends on all modules)
 */
export function initializeModules(
  ctx: WebGPUContext,
  backend: IRendererBackend,
  moduleConfig: ModuleConfig
): InitializedModules {
  // Validate device is initialized
  if (!ctx.device) {
    throw new Error('WebGPU device must be initialized before creating modules');
  }

  // Create bind group pool (needed by moduleConfig)
  const bindGroupPool = new BindGroupPool(ctx.device);
  const configWithBindGroupPool = { ...moduleConfig, bindGroupPool };

  // Step 1: Resource management (no dependencies)
  const resourceMgr = new WebGPUResourceManager(ctx, configWithBindGroupPool);

  // Step 2: Pipeline management (depends on resourceMgr)
  const pipelineMgr = new WebGPUPipelineManager(
    ctx,
    (id) => resourceMgr.getShader(id),
    configWithBindGroupPool
  );

  // Step 3: Modern API (depends on resourceMgr) - MUST come before commandEncoder
  const modernAPI = new WebGPUModernAPI(
    ctx,
    (id) => resourceMgr.getShader(id),
    (id) => resourceMgr.getBuffer(id),
    (id) => resourceMgr.getTexture(id),
    (id) => resourceMgr.getSampler(id),
    configWithBindGroupPool
  );

  // Step 4: Command encoder (depends on resourceMgr AND modernAPI)
  const commandEncoder = new WebGPUCommandEncoder(
    ctx,
    (id) => resourceMgr.getBuffer(id),
    (id) => modernAPI.getBindGroup(id),
    (id) => modernAPI.getPipeline(id),
    { drawCalls: 0, triangles: 0, vertices: 0, batches: 0, shaderSwitches: 0, textureBinds: 0, stateChanges: 0, frameTime: 0 }
  );

  // Step 5: Render pass management (depends on resourceMgr, vramProfiler)
  const renderPassMgr = new WebGPURenderPassManager(
    ctx,
    (id) => resourceMgr.getFramebuffer(id),
    moduleConfig.vramProfiler,
    configWithBindGroupPool
  );

  // Step 6: Device recovery (depends on backend, device)
  const recoverySystem = new DeviceRecoverySystem(backend, {
    maxRetries: 3,
    retryDelay: 1000,
    logProgress: true
  });

  recoverySystem.initializeDetector(ctx.device);

  recoverySystem.onRecovery((progress) => {
    if (progress.phase === 'detecting') {
      console.warn(`[WebGPUBackend] Device loss detected, beginning recovery...`);
    } else if (progress.phase === 'complete') {
      console.log(`[WebGPUBackend] Device recovery complete - ${progress.resourcesRecreated} resources recreated`);
      if (ctx.device) {
        recoverySystem.initializeDetector(ctx.device);
      }
    } else if (progress.phase === 'failed') {
      console.error(`[WebGPUBackend] Device recovery failed:`, progress.error);
    }
  });

  return {
    resourceMgr,
    pipelineMgr,
    commandEncoder,
    modernAPI,
    renderPassMgr,
    recoverySystem,
  };
}
