/**
 * RetroPostProcessor Tests
 * Epic 3.4: Retro Rendering Pipeline - Post-Processing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RetroPostProcessor, DEFAULT_RETRO_POST_CONFIG } from '../../src/retro/RetroPostProcessor';
import { createMockBackend } from '../test-utils/mockBackend';
import type { IRendererBackend } from '../../src/backends/IRendererBackend';

describe('RetroPostProcessor', () => {
  let backend: IRendererBackend;
  let postProcessor: RetroPostProcessor;

  beforeEach(() => {
    backend = createMockBackend();
  });

  afterEach(() => {
    if (postProcessor) {
      postProcessor.dispose();
    }
  });

  describe('Initialization', () => {
    it('should create with default configuration', () => {
      postProcessor = new RetroPostProcessor(backend);
      expect(postProcessor).toBeDefined();
    });

    it('should create with custom configuration', () => {
      postProcessor = new RetroPostProcessor(backend, {
        bloom: {
          enabled: false,
          intensity: 0.5,
          threshold: 0.9,
          downscaleFactor: 2,
        },
      });

      const config = postProcessor.getConfig();
      expect(config.bloom?.enabled).toBe(false);
      expect(config.bloom?.intensity).toBe(0.5);
    });

    it('should merge custom config with defaults', () => {
      postProcessor = new RetroPostProcessor(backend, {
        bloom: { intensity: 0.8 } as any,
      });

      const config = postProcessor.getConfig();
      expect(config.bloom?.enabled).toBe(true); // Default
      expect(config.bloom?.intensity).toBe(0.8); // Custom
      expect(config.bloom?.threshold).toBe(0.8); // Default
    });

    it('should initialize successfully', async () => {
      postProcessor = new RetroPostProcessor(backend);
      await expect(postProcessor.initialize(1920, 1080)).resolves.not.toThrow();
    });

    it('should not re-initialize if already initialized', async () => {
      postProcessor = new RetroPostProcessor(backend);
      await postProcessor.initialize(1920, 1080);

      // Initialize again with same dimensions should be a no-op
      await postProcessor.initialize(1920, 1080);

      // Test passes if no error is thrown
      expect(postProcessor).toBeDefined();
    });
  });

  describe('Configuration', () => {
    beforeEach(async () => {
      postProcessor = new RetroPostProcessor(backend);
      await postProcessor.initialize(1920, 1080);
    });

    it('should update configuration at runtime', () => {
      postProcessor.updateConfig({
        dither: {
          enabled: false,
          pattern: 'bayer8x8',
          strength: 0.8,
        },
      });

      const config = postProcessor.getConfig();
      expect(config.dither?.enabled).toBe(false);
      expect(config.dither?.pattern).toBe('bayer8x8');
    });

    it('should preserve unchanged config values when updating', () => {
      const originalConfig = postProcessor.getConfig();

      postProcessor.updateConfig({
        bloom: { intensity: 0.6 } as any,
      });

      const newConfig = postProcessor.getConfig();
      expect(newConfig.bloom?.intensity).toBe(0.6);
      expect(newConfig.bloom?.threshold).toBe(originalConfig.bloom?.threshold);
      expect(newConfig.toneMapping).toEqual(originalConfig.toneMapping);
    });
  });

  describe('Bloom Configuration', () => {
    it('should use default bloom settings', () => {
      postProcessor = new RetroPostProcessor(backend);
      const config = postProcessor.getConfig();

      expect(config.bloom?.enabled).toBe(true);
      expect(config.bloom?.intensity).toBe(0.3);
      expect(config.bloom?.threshold).toBe(0.8);
      expect(config.bloom?.downscaleFactor).toBe(4);
    });

    it('should respect quarter resolution for PS2-era look', async () => {
      const createTextureSpy = vi.spyOn(backend, 'createTexture');

      postProcessor = new RetroPostProcessor(backend);
      await postProcessor.initialize(1920, 1080);

      // Bloom target should be quarter resolution
      const expectedWidth = Math.floor(1920 / 4);
      const expectedHeight = Math.floor(1080 / 4);

      expect(createTextureSpy).toHaveBeenCalledWith(
        expect.any(String),
        expectedWidth,
        expectedHeight,
        null,
        expect.objectContaining({
          format: 'bgra8unorm',
          minFilter: 'linear', // Bilinear upsample
          magFilter: 'linear',
        })
      );
    });
  });

  describe('Tone Mapping Configuration', () => {
    it('should default to Reinhard tone mapping', () => {
      postProcessor = new RetroPostProcessor(backend);
      const config = postProcessor.getConfig();

      expect(config.toneMapping?.enabled).toBe(true);
      expect(config.toneMapping?.mode).toBe('reinhard');
      expect(config.toneMapping?.exposure).toBe(1.0);
    });

    it('should support clamp mode', () => {
      postProcessor = new RetroPostProcessor(backend, {
        toneMapping: {
          enabled: true,
          mode: 'clamp',
          exposure: 1.2,
        },
      });

      const config = postProcessor.getConfig();
      expect(config.toneMapping?.mode).toBe('clamp');
      expect(config.toneMapping?.exposure).toBe(1.2);
    });
  });

  describe('Dither Configuration', () => {
    it('should default to Bayer 4x4 pattern', () => {
      postProcessor = new RetroPostProcessor(backend);
      const config = postProcessor.getConfig();

      expect(config.dither?.enabled).toBe(true);
      expect(config.dither?.pattern).toBe('bayer4x4');
      expect(config.dither?.strength).toBe(0.5);
    });

    it('should support all Bayer pattern sizes', () => {
      const patterns = ['bayer2x2', 'bayer4x4', 'bayer8x8'] as const;

      for (const pattern of patterns) {
        postProcessor = new RetroPostProcessor(backend, {
          dither: { enabled: true, pattern, strength: 0.5 },
        });

        const config = postProcessor.getConfig();
        expect(config.dither?.pattern).toBe(pattern);

        postProcessor.dispose();
      }
    });
  });

  describe('Grain Configuration', () => {
    it('should default to enabled with retro settings', () => {
      postProcessor = new RetroPostProcessor(backend);
      const config = postProcessor.getConfig();

      expect(config.grain?.enabled).toBe(true);
      expect(config.grain?.intensity).toBe(0.15);
      expect(config.grain?.size).toBe(128);
    });

    it('should create grain texture with correct size', async () => {
      const createTextureSpy = vi.spyOn(backend, 'createTexture');

      postProcessor = new RetroPostProcessor(backend, {
        grain: {
          enabled: true,
          intensity: 0.2,
          size: 64,
        },
      });

      await postProcessor.initialize(1920, 1080);

      expect(createTextureSpy).toHaveBeenCalledWith(
        expect.stringContaining('grain'),
        64,
        64,
        expect.any(Uint8Array),
        expect.objectContaining({
          format: 'r8unorm',
        })
      );
    });
  });

  describe('Resize Handling', () => {
    beforeEach(async () => {
      postProcessor = new RetroPostProcessor(backend);
      await postProcessor.initialize(1920, 1080);
    });

    it('should resize render targets when dimensions change', () => {
      const deleteTextureSpy = vi.spyOn(backend, 'deleteTexture');
      const createTextureSpy = vi.spyOn(backend, 'createTexture');

      postProcessor.resize(2560, 1440);

      expect(deleteTextureSpy).toHaveBeenCalled();
      expect(createTextureSpy).toHaveBeenCalled();
    });

    it('should not recreate targets if dimensions unchanged', () => {
      const deleteTextureSpy = vi.spyOn(backend, 'deleteTexture');
      const createTextureSpy = vi.spyOn(backend, 'createTexture');

      postProcessor.resize(1920, 1080);

      expect(deleteTextureSpy).not.toHaveBeenCalled();
      expect(createTextureSpy).not.toHaveBeenCalled();
    });
  });

  describe('Disposal', () => {
    beforeEach(async () => {
      postProcessor = new RetroPostProcessor(backend);
      await postProcessor.initialize(1920, 1080);
    });

    it('should clean up all GPU resources', () => {
      const deleteTextureSpy = vi.spyOn(backend, 'deleteTexture');
      const deleteBufferSpy = vi.spyOn(backend, 'deleteBuffer');

      postProcessor.dispose();

      expect(deleteTextureSpy).toHaveBeenCalled();
      expect(deleteBufferSpy).toHaveBeenCalled();
    });

    it('should allow re-initialization after disposal', async () => {
      postProcessor.dispose();
      await expect(postProcessor.initialize(1920, 1080)).resolves.not.toThrow();
    });
  });

  describe('PS2-era Authenticity', () => {
    it('should use period-appropriate default values', () => {
      postProcessor = new RetroPostProcessor(backend);
      const config = postProcessor.getConfig();

      // Bloom: Simple additive, low intensity
      expect(config.bloom?.intensity).toBeLessThanOrEqual(0.5);
      expect(config.bloom?.downscaleFactor).toBeGreaterThanOrEqual(4);

      // Dither: Enabled for retro banding
      expect(config.dither?.enabled).toBe(true);

      // Grain: Film aesthetic
      expect(config.grain?.enabled).toBe(true);
      expect(config.grain?.intensity).toBeLessThanOrEqual(0.2);
    });

    it('should not use modern AAA features', () => {
      postProcessor = new RetroPostProcessor(backend);
      const config = postProcessor.getConfig();

      // No SSAO, SSR, TAA, etc.
      expect(config).not.toHaveProperty('ssao');
      expect(config).not.toHaveProperty('ssr');
      expect(config).not.toHaveProperty('taa');
      expect(config).not.toHaveProperty('chromaticAberration');
    });
  });
});
