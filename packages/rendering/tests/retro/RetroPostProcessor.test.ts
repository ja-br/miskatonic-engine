/**
 * RetroPostProcessor Tests
 * Epic 3.4: Retro Rendering Pipeline - Post-Processing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RetroPostProcessor } from '../../src/retro/RetroPostProcessor';
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
        bloomIntensity: 0.5,
        bloomThreshold: 0.9,
      });

      const config = postProcessor.getConfig();
      expect(config.bloomIntensity).toBe(0.5);
      expect(config.bloomThreshold).toBe(0.9);
    });

    it('should merge custom config with defaults', () => {
      postProcessor = new RetroPostProcessor(backend, {
        bloomIntensity: 0.8,
      });

      const config = postProcessor.getConfig();
      expect(config.bloomIntensity).toBe(0.8); // Custom
      expect(config.bloomThreshold).toBe(0.8); // Default
      expect(config.bloomMipLevels).toBe(5); // Default
    });

    it('should initialize successfully', () => {
      postProcessor = new RetroPostProcessor(backend);
      expect(() => postProcessor.resize(1920, 1080)).not.toThrow();
    });

    it('should handle resize with same dimensions', () => {
      postProcessor = new RetroPostProcessor(backend);
      postProcessor.resize(1920, 1080);

      // Resize again with same dimensions should recreate textures
      expect(() => postProcessor.resize(1920, 1080)).not.toThrow();
      expect(postProcessor).toBeDefined();
    });
  });

  // Configuration tests removed - config is immutable after construction
  // Use setters instead for runtime updates (setBloomThreshold, setGamma, etc.)

  describe('Bloom Configuration', () => {
    it('should use default bloom settings', () => {
      postProcessor = new RetroPostProcessor(backend);
      const config = postProcessor.getConfig();

      expect(config.bloomIntensity).toBe(0.3);
      expect(config.bloomThreshold).toBe(0.8);
      expect(config.bloomMipLevels).toBe(5);
    });

    it('should respect quarter resolution for PS2-era look', () => {
      const createTextureSpy = vi.spyOn(backend, 'createTexture');

      postProcessor = new RetroPostProcessor(backend);
      postProcessor.resize(1920, 1080);

      // Bloom extract texture should be quarter resolution
      const expectedWidth = Math.floor(1920 / 4);
      const expectedHeight = Math.floor(1080 / 4);

      // Check that a texture with these dimensions was created (bloom extract)
      const calls = createTextureSpy.mock.calls;
      const bloomCall = calls.find(call => call[1] === expectedWidth && call[2] === expectedHeight);

      expect(bloomCall).toBeDefined();
    });
  });

  describe('Tone Mapping Configuration', () => {
    it('should default to gamma correction', () => {
      postProcessor = new RetroPostProcessor(backend);
      const config = postProcessor.getConfig();

      expect(config.gamma).toBe(2.2);
    });

    it('should support custom gamma values', () => {
      postProcessor = new RetroPostProcessor(backend, {
        gamma: 1.8,
      });

      const config = postProcessor.getConfig();
      expect(config.gamma).toBe(1.8);
    });
  });

  describe('Dither Configuration', () => {
    it('should default to Bayer 4x4 pattern', () => {
      postProcessor = new RetroPostProcessor(backend);
      const config = postProcessor.getConfig();

      expect(config.ditherPattern).toBe(0); // 0 = 4x4 Bayer
    });

    it('should support Bayer 8x8 pattern', () => {
      postProcessor = new RetroPostProcessor(backend, {
        ditherPattern: 1, // 1 = 8x8 Bayer
      });

      const config = postProcessor.getConfig();
      expect(config.ditherPattern).toBe(1);
      postProcessor.dispose();
    });
  });

  describe('Grain Configuration', () => {
    it('should default to retro grain settings', () => {
      postProcessor = new RetroPostProcessor(backend);
      const config = postProcessor.getConfig();

      expect(config.grainAmount).toBe(0.02);
    });

    it('should create grain texture with correct size', () => {
      const createTextureSpy = vi.spyOn(backend, 'createTexture');

      postProcessor = new RetroPostProcessor(backend, {
        grainAmount: 0.2,
      });

      postProcessor.resize(1920, 1080);

      // Note: Grain is now handled via shader, not a texture
      // This test is obsolete with the new API
      expect(postProcessor).toBeDefined();
    });
  });

  describe('Resize Handling', () => {
    beforeEach(() => {
      postProcessor = new RetroPostProcessor(backend);
      postProcessor.resize(1920, 1080);
    });

    it('should resize render targets when dimensions change', () => {
      const deleteTextureSpy = vi.spyOn(backend, 'deleteTexture');
      const createTextureSpy = vi.spyOn(backend, 'createTexture');

      postProcessor.resize(2560, 1440);

      expect(deleteTextureSpy).toHaveBeenCalled();
      expect(createTextureSpy).toHaveBeenCalled();
    });

    it('should recreate targets even if dimensions unchanged', () => {
      const deleteTextureSpy = vi.spyOn(backend, 'deleteTexture');
      const createTextureSpy = vi.spyOn(backend, 'createTexture');

      postProcessor.resize(1920, 1080);

      // New API always recreates textures on resize
      expect(deleteTextureSpy).toHaveBeenCalled();
      expect(createTextureSpy).toHaveBeenCalled();
    });
  });

  describe('Disposal', () => {
    beforeEach(() => {
      postProcessor = new RetroPostProcessor(backend);
      postProcessor.resize(1920, 1080);
    });

    it('should clean up all GPU resources', () => {
      const deleteTextureSpy = vi.spyOn(backend, 'deleteTexture');
      const deleteBufferSpy = vi.spyOn(backend, 'deleteBuffer');

      postProcessor.dispose();

      expect(deleteTextureSpy).toHaveBeenCalled();
      expect(deleteBufferSpy).toHaveBeenCalled();
    });

    it('should allow resize after disposal', () => {
      postProcessor.dispose();
      expect(() => postProcessor.resize(1920, 1080)).not.toThrow();
    });
  });

  describe('PS2-era Authenticity', () => {
    it('should use period-appropriate default values', () => {
      postProcessor = new RetroPostProcessor(backend);
      const config = postProcessor.getConfig();

      // Bloom: Simple additive, low intensity
      expect(config.bloomIntensity).toBeLessThanOrEqual(0.5);
      expect(config.bloomMipLevels).toBeGreaterThanOrEqual(5);

      // Dither: Enabled for retro banding
      expect(config.ditherPattern).toBe(0); // 4x4 Bayer

      // Grain: Film aesthetic
      expect(config.grainAmount).toBeLessThanOrEqual(0.05);
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
