/**
 * Retro Post-Processing Integration Tests
 * Epic 3.4 Phase 2: Integration with RenderPassManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  RetroPostProcessor,
  DEFAULT_RETRO_POST_CONFIG,
  addRetroPostProcessPass,
  applyRetroPostProcess,
  resizeRetroPostProcessor,
  type RetroPostProcessPassConfig,
} from '../../src/retro';
import { RenderPass, RenderPassManager } from '../../src/RenderPass';
import type { IRendererBackend, BackendTextureHandle } from '../../src/backends/IRendererBackend';
import { createMockBackend } from '../test-utils/mockBackend';

describe('RetroPostProcessIntegration', () => {
  let backend: IRendererBackend;
  let processor: RetroPostProcessor;
  let passManager: RenderPassManager;

  beforeEach(async () => {
    backend = createMockBackend();
    processor = new RetroPostProcessor(backend, DEFAULT_RETRO_POST_CONFIG);
    await processor.initialize(1920, 1080);
    passManager = new RenderPassManager();
  });

  afterEach(() => {
    processor.dispose();
  });

  describe('addRetroPostProcessPass', () => {
    it('should add post-processing pass to render pass manager', () => {
      // Add scene pass first
      const scenePass = new RenderPass({
        name: 'scene',
        target: 'sceneBuffer',
        clear: { color: [0.1, 0.1, 0.1, 1.0], depth: 1.0 },
      });
      passManager.addPass(scenePass);

      // Add retro post-processing
      const config: RetroPostProcessPassConfig = {
        inputTarget: 'sceneBuffer',
        outputTarget: 'screen',
        dependencies: ['scene'],
      };

      const pass = addRetroPostProcessPass(passManager, processor, config);

      expect(pass).toBeDefined();
      expect(pass.name).toBe('retro-post');
      expect(pass.target).toBe('screen');
      expect(pass.dependencies).toEqual(['scene']);
    });

    it('should allow custom pass name', () => {
      const config: RetroPostProcessPassConfig = {
        passName: 'custom-retro',
        inputTarget: 'sceneBuffer',
        outputTarget: 'screen',
      };

      const pass = addRetroPostProcessPass(passManager, processor, config);

      expect(pass.name).toBe('custom-retro');
    });

    it('should default to screen as output target', () => {
      const config: RetroPostProcessPassConfig = {
        inputTarget: 'sceneBuffer',
      };

      const pass = addRetroPostProcessPass(passManager, processor, config);

      expect(pass.target).toBe('screen');
    });

    it('should handle empty dependencies array', () => {
      const config: RetroPostProcessPassConfig = {
        inputTarget: 'sceneBuffer',
        dependencies: [],
      };

      const pass = addRetroPostProcessPass(passManager, processor, config);

      expect(pass.dependencies).toEqual([]);
    });

    it('should support multiple dependencies', () => {
      // Add multiple passes
      passManager.addPass(new RenderPass({
        name: 'shadowMap',
        target: 'shadowBuffer',
      }));
      passManager.addPass(new RenderPass({
        name: 'scene',
        target: 'sceneBuffer',
        dependencies: ['shadowMap'],
      }));

      const config: RetroPostProcessPassConfig = {
        inputTarget: 'sceneBuffer',
        dependencies: ['shadowMap', 'scene'],
      };

      const pass = addRetroPostProcessPass(passManager, processor, config);

      expect(pass.dependencies).toEqual(['shadowMap', 'scene']);
    });
  });

  describe('applyRetroPostProcess', () => {
    it('should call processor.apply with correct textures', () => {
      const inputTexture = backend.createTexture(
        'input',
        1920,
        1080,
        null,
        { format: 'rgba8unorm' }
      );
      const outputTexture = backend.createTexture(
        'output',
        1920,
        1080,
        null,
        { format: 'rgba8unorm' }
      );

      // This should not throw
      expect(() => {
        applyRetroPostProcess(processor, inputTexture, outputTexture);
      }).not.toThrow();

      // Verify textures are valid handles
      expect(inputTexture).toBeDefined();
      expect(outputTexture).toBeDefined();
    });

    it('should work with mock backend', () => {
      // Create mock textures
      const inputTexture = { __brand: 'BackendTexture', id: 'input' } as BackendTextureHandle;
      const outputTexture = { __brand: 'BackendTexture', id: 'output' } as BackendTextureHandle;

      // Should complete without error
      applyRetroPostProcess(processor, inputTexture, outputTexture);
    });
  });

  describe('resizeRetroPostProcessor', () => {
    it('should resize processor to new dimensions', () => {
      const newWidth = 1280;
      const newHeight = 720;

      resizeRetroPostProcessor(processor, newWidth, newHeight);

      // Processor should still be functional after resize
      const inputTexture = { __brand: 'BackendTexture', id: 'input' } as BackendTextureHandle;
      const outputTexture = { __brand: 'BackendTexture', id: 'output' } as BackendTextureHandle;

      expect(() => {
        applyRetroPostProcess(processor, inputTexture, outputTexture);
      }).not.toThrow();
    });

    it('should handle multiple resizes', () => {
      resizeRetroPostProcessor(processor, 1280, 720);
      resizeRetroPostProcessor(processor, 1920, 1080);
      resizeRetroPostProcessor(processor, 800, 600);

      // Should still work
      const inputTexture = { __brand: 'BackendTexture', id: 'input' } as BackendTextureHandle;
      const outputTexture = { __brand: 'BackendTexture', id: 'output' } as BackendTextureHandle;

      applyRetroPostProcess(processor, inputTexture, outputTexture);
    });

    it('should handle small dimensions', () => {
      resizeRetroPostProcessor(processor, 320, 240);

      const inputTexture = { __brand: 'BackendTexture', id: 'input' } as BackendTextureHandle;
      const outputTexture = { __brand: 'BackendTexture', id: 'output' } as BackendTextureHandle;

      applyRetroPostProcess(processor, inputTexture, outputTexture);
    });
  });

  describe('Integration Workflow', () => {
    it('should support complete rendering pipeline setup', () => {
      // 1. Create scene render pass
      const scenePass = new RenderPass({
        name: 'scene',
        target: 'sceneBuffer',
        clear: { color: [0.1, 0.1, 0.1, 1.0], depth: 1.0 },
      });
      passManager.addPass(scenePass);

      // 2. Add retro post-processing
      const retroPass = addRetroPostProcessPass(passManager, processor, {
        inputTarget: 'sceneBuffer',
        outputTarget: 'screen',
        dependencies: ['scene'],
      });

      // 3. Verify pass order
      const passes = passManager.getPasses();
      expect(passes).toHaveLength(2);
      expect(passes[0].name).toBe('scene');
      expect(passes[1].name).toBe('retro-post');

      // 4. Verify execution order respects dependencies
      const executionOrder = passes.map(p => p.name);
      const sceneIndex = executionOrder.indexOf('scene');
      const retroIndex = executionOrder.indexOf('retro-post');
      expect(sceneIndex).toBeLessThan(retroIndex);
    });

    it('should support multi-pass pipeline', () => {
      // Shadow pass → Scene pass → Retro post
      passManager.addPass(new RenderPass({
        name: 'shadow',
        target: 'shadowBuffer',
      }));

      passManager.addPass(new RenderPass({
        name: 'scene',
        target: 'sceneBuffer',
        dependencies: ['shadow'],
      }));

      addRetroPostProcessPass(passManager, processor, {
        inputTarget: 'sceneBuffer',
        outputTarget: 'screen',
        dependencies: ['scene'],
      });

      const executionOrder = passManager.getPasses().map(p => p.name);
      expect(executionOrder).toEqual(['shadow', 'scene', 'retro-post']);
    });

    it('should allow multiple post-processing passes', () => {
      const processor2 = new RetroPostProcessor(backend, {
        ...DEFAULT_RETRO_POST_CONFIG,
        bloom: { enabled: true, intensity: 0.8, threshold: 0.6, downscaleFactor: 4 },
      });

      passManager.addPass(new RenderPass({
        name: 'scene',
        target: 'sceneBuffer',
      }));

      addRetroPostProcessPass(passManager, processor, {
        passName: 'retro-tone-mapping',
        inputTarget: 'sceneBuffer',
        outputTarget: 'tempBuffer',
        dependencies: ['scene'],
      });

      addRetroPostProcessPass(passManager, processor2, {
        passName: 'retro-bloom',
        inputTarget: 'tempBuffer',
        outputTarget: 'screen',
        dependencies: ['retro-tone-mapping'],
      });

      const executionOrder = passManager.getPasses().map(p => p.name);
      expect(executionOrder).toEqual(['scene', 'retro-tone-mapping', 'retro-bloom']);

      processor2.dispose();
    });
  });
});
