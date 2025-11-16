/**
 * Retro Post-Processing Integration
 * Epic 3.4 Phase 2: Integration with RenderPassManager
 *
 * Provides helpers for integrating RetroPostProcessor into the main rendering pipeline.
 */

import { RenderPass, RenderPassManager } from '../RenderPass';
import type { RetroPostProcessor } from './RetroPostProcessor';
import type { BackendTextureHandle, BackendFramebufferHandle } from '../backends/IRendererBackend';

/**
 * Configuration for retro post-processing render pass
 */
export interface RetroPostProcessPassConfig {
  /** Name of the pass (default: 'retro-post') */
  passName?: string;

  /** Input framebuffer name (where scene is rendered) */
  inputTarget: string;

  /** Output framebuffer name (default: 'screen') */
  outputTarget?: string;

  /** Dependencies (passes that must execute before this) */
  dependencies?: string[];
}

/**
 * Add retro post-processing pass to render pass manager
 *
 * This creates a post-processing pass that applies retro effects to the scene.
 * The pass reads from inputTarget and writes to outputTarget.
 *
 * @example
 * ```typescript
 * const processor = new RetroPostProcessor(backend, DEFAULT_RETRO_POST_CONFIG);
 * await processor.initialize(1920, 1080);
 *
 * const passManager = new RenderPassManager();
 *
 * // Add scene render pass
 * passManager.addPass(new RenderPass({
 *   name: 'scene',
 *   target: 'sceneBuffer',
 *   clear: { color: [0.1, 0.1, 0.1, 1.0], depth: 1.0 }
 * }));
 *
 * // Add retro post-processing
 * addRetroPostProcessPass(passManager, processor, {
 *   inputTarget: 'sceneBuffer',
 *   outputTarget: 'screen',
 *   dependencies: ['scene']
 * });
 * ```
 */
export function addRetroPostProcessPass(
  passManager: RenderPassManager,
  processor: RetroPostProcessor,
  config: RetroPostProcessPassConfig
): RenderPass {
  const passName = config.passName ?? 'retro-post';
  const outputTarget = config.outputTarget ?? 'screen';

  // Create post-processing render pass
  const pass = new RenderPass({
    name: passName,
    target: outputTarget,
    dependencies: config.dependencies ?? [],
  });

  passManager.addPass(pass);

  return pass;
}

/**
 * Execute retro post-processing on a framebuffer
 *
 * This is a low-level helper for directly applying post-processing
 * outside of the RenderPassManager system.
 *
 * @param processor - Initialized RetroPostProcessor instance
 * @param inputTexture - Source texture to process
 * @param outputTexture - Destination texture for results
 *
 * @example
 * ```typescript
 * const processor = new RetroPostProcessor(backend, config);
 * await processor.initialize(1920, 1080);
 *
 * // Later, during rendering:
 * applyRetroPostProcess(processor, sceneTexture, screenTexture);
 * ```
 */
export function applyRetroPostProcess(
  processor: RetroPostProcessor,
  inputTexture: BackendTextureHandle,
  outputTexture: BackendTextureHandle
): void {
  processor.apply(inputTexture, outputTexture);
}

/**
 * Resize retro post-processor to match render target dimensions
 *
 * Call this when the viewport or render targets change size.
 *
 * @param processor - RetroPostProcessor instance
 * @param width - New width in pixels
 * @param height - New height in pixels
 */
export function resizeRetroPostProcessor(
  processor: RetroPostProcessor,
  width: number,
  height: number
): void {
  processor.resize(width, height);
}
