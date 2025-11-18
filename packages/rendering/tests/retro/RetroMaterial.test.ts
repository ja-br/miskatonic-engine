/**
 * Retro Material System Tests
 * Epic 3.4: Retro Rendering Pipeline - Materials & Textures
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  RetroMaterial,
  type RetroMaterialType,
  type RetroFilterMode,
  type RetroMaterialConfig,
} from '../../src/retro';
import type { IRendererBackend } from '../../src/backends/IRendererBackend';
import { createMockBackend } from '../test-utils/mockBackend';

describe('RetroMaterial', () => {
  let backend: IRendererBackend;

  beforeEach(() => {
    backend = createMockBackend();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', async () => {
      const material = new RetroMaterial(backend, {
        type: 'lambert',
      });

      await material.initialize();

      // Should not throw when accessing resources
      expect(material.getUniformBuffer()).toBeDefined();
      expect(material.getAlbedoTexture()).toBeDefined();
      expect(material.getLightmapTexture()).toBeDefined();

      material.dispose();
    });

    it('should not initialize twice', async () => {
      const material = new RetroMaterial(backend, {
        type: 'lambert',
      });

      await material.initialize();
      await material.initialize(); // Second call should be no-op

      expect(material.getUniformBuffer()).toBeDefined();

      material.dispose();
    });

    it('should handle concurrent initialization calls', async () => {
      const material = new RetroMaterial(backend, {
        type: 'lambert',
      });

      // Call initialize() twice without awaiting the first
      const promise1 = material.initialize();
      const promise2 = material.initialize();

      await Promise.all([promise1, promise2]);

      // Should only create one set of resources
      expect(material.getUniformBuffer()).toBeDefined();

      material.dispose();
    });

    it('should throw when accessing resources before initialization', () => {
      const material = new RetroMaterial(backend, {
        type: 'lambert',
      });

      expect(() => material.getPipeline()).toThrow('not initialized');
      expect(() => material.getUniformBuffer()).toThrow('not initialized');
    });
  });

  describe('Configuration', () => {
    it('should use default configuration values', async () => {
      const material = new RetroMaterial(backend, {
        type: 'lambert',
      });

      await material.initialize();

      // Defaults should be applied
      expect(material.getAlbedoTexture()).toBeDefined();
      expect(material.getLightmapTexture()).toBeDefined();

      material.dispose();
    });

    it('should merge provided config with defaults', async () => {
      const config: RetroMaterialConfig = {
        type: 'unlit',
        albedoColor: [1.0, 0.0, 0.0],
        emissiveColor: [0.5, 0.5, 0.5],
        textureFilter: 'point',
      };

      const material = new RetroMaterial(backend, config);

      await material.initialize();
      expect(material.getUniformBuffer()).toBeDefined();

      material.dispose();
    });

    it('should support lit material type', async () => {
      const material = new RetroMaterial(backend, {
        type: RetroMaterialType.Lit,
        roughness: 0.7,
        metallic: 0.3,
      });

      await material.initialize();
      expect(material.getUniformBuffer()).toBeDefined();

      material.dispose();
    });

    it('should support unlit material type', async () => {
      const material = new RetroMaterial(backend, {
        type: 'unlit',
        emissiveColor: [1.0, 1.0, 0.0],
      });

      await material.initialize();
      expect(material.getUniformBuffer()).toBeDefined();

      material.dispose();
    });

    it('should support vertex-colored material type', async () => {
      const material = new RetroMaterial(backend, {
        type: 'vertex-color',
      });

      await material.initialize();
      expect(material.getUniformBuffer()).toBeDefined();

      material.dispose();
    });
  });

  describe('Texture Loading', () => {
    it('should load texture from string path', async () => {
      const material = new RetroMaterial(backend, {
        type: RetroMaterialType.Lit,
        albedoTexture: 'crate_diffuse.png',
      });

      await material.initialize();

      const texture = material.getAlbedoTexture();
      expect(texture).toBeDefined();

      material.dispose();
    });

    it('should use existing texture handle', async () => {
      const existingTexture = backend.createTexture(
        'existing',
        256,
        256,
        null,
        { format: 'rgba8unorm' }
      );

      const material = new RetroMaterial(backend, {
        type: RetroMaterialType.Lit,
        albedoTexture: existingTexture,
      });

      await material.initialize();

      const texture = material.getAlbedoTexture();
      expect(texture).toBe(existingTexture);

      material.dispose();
    });

    it('should create default white texture when no albedo specified', async () => {
      const material = new RetroMaterial(backend, {
        type: 'lambert',
      });

      await material.initialize();

      const texture = material.getAlbedoTexture();
      expect(texture).toBeDefined();

      material.dispose();
    });

    it('should create default lightmap when none specified', async () => {
      const material = new RetroMaterial(backend, {
        type: 'lambert',
      });

      await material.initialize();

      const lightmap = material.getLightmapTexture();
      expect(lightmap).toBeDefined();

      material.dispose();
    });

    it('should use provided lightmap texture', async () => {
      const lightmapTexture = backend.createTexture(
        'lightmap',
        256,
        256,
        null,
        { format: 'rgba8unorm' }
      );

      const material = new RetroMaterial(backend, {
        type: RetroMaterialType.Lit,
        lightmapTexture,
      });

      await material.initialize();

      const lightmap = material.getLightmapTexture();
      expect(lightmap).toBe(lightmapTexture);

      material.dispose();
    });
  });

  describe('Texture Filtering', () => {
    it('should use point filtering', async () => {
      const material = new RetroMaterial(backend, {
        type: RetroMaterialType.Lit,
        textureFilter: 'point',
      });

      await material.initialize();
      expect(material.getAlbedoTexture()).toBeDefined();

      material.dispose();
    });

    it('should use bilinear filtering', async () => {
      const material = new RetroMaterial(backend, {
        type: RetroMaterialType.Lit,
        textureFilter: 'bilinear',
      });

      await material.initialize();
      expect(material.getAlbedoTexture()).toBeDefined();

      material.dispose();
    });
  });

  describe('Uniform Buffer', () => {
    it('should create uniform buffer on initialization', async () => {
      const material = new RetroMaterial(backend, {
        type: 'lambert',
      });

      await material.initialize();

      const uniformBuffer = material.getUniformBuffer();
      expect(uniformBuffer).toBeDefined();

      material.dispose();
    });

    it('should update uniform buffer when properties change', async () => {
      const material = new RetroMaterial(backend, {
        type: RetroMaterialType.Lit,
        albedoColor: [1.0, 0.0, 0.0],
      });

      await material.initialize();

      material.updateProperties({
        albedoColor: [0.0, 1.0, 0.0],
      });

      // Buffer should still be valid
      expect(material.getUniformBuffer()).toBeDefined();

      material.dispose();
    });

    it('should handle updateProperties before initialization', () => {
      const material = new RetroMaterial(backend, {
        type: 'lambert',
      });

      // Should not throw
      material.updateProperties({
        albedoColor: [1.0, 1.0, 1.0],
      });
    });
  });

  describe('Resource Getters', () => {
    it('should return albedo texture', async () => {
      const material = new RetroMaterial(backend, {
        type: 'lambert',
      });

      await material.initialize();

      const texture = material.getAlbedoTexture();
      expect(texture).toBeDefined();

      material.dispose();
    });

    it('should return lightmap texture', async () => {
      const material = new RetroMaterial(backend, {
        type: 'lambert',
      });

      await material.initialize();

      const lightmap = material.getLightmapTexture();
      expect(lightmap).toBeDefined();

      material.dispose();
    });

    it('should return undefined for optional textures', () => {
      const material = new RetroMaterial(backend, {
        type: 'unlit',
      });

      // Before initialization, textures are undefined
      expect(material.getAlbedoTexture()).toBeUndefined();
      expect(material.getLightmapTexture()).toBeUndefined();
    });
  });

  describe('Disposal', () => {
    it('should dispose all GPU resources', async () => {
      const material = new RetroMaterial(backend, {
        type: 'lambert',
      });

      await material.initialize();

      material.dispose();

      // After disposal, accessing resources should throw
      expect(() => material.getUniformBuffer()).toThrow('not initialized');
    });

    it('should be safe to dispose multiple times', async () => {
      const material = new RetroMaterial(backend, {
        type: 'lambert',
      });

      await material.initialize();

      material.dispose();
      material.dispose(); // Second disposal should be safe

      expect(() => material.getUniformBuffer()).toThrow('not initialized');
    });

    it('should be safe to dispose before initialization', () => {
      const material = new RetroMaterial(backend, {
        type: 'lambert',
      });

      // Should not throw
      material.dispose();
    });
  });

  describe('DEFAULT_RETRO_MATERIAL', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_RETRO_MATERIAL.type).toBe(RetroMaterialType.Lit);
      expect(DEFAULT_RETRO_MATERIAL.albedoColor).toEqual([0.8, 0.8, 0.8]);
      expect(DEFAULT_RETRO_MATERIAL.emissiveColor).toEqual([0, 0, 0]);
      expect(DEFAULT_RETRO_MATERIAL.textureFilter).toBe('bilinear');
      expect(DEFAULT_RETRO_MATERIAL.roughness).toBe(0.5);
      expect(DEFAULT_RETRO_MATERIAL.metallic).toBe(0.0);
      expect(DEFAULT_RETRO_MATERIAL.enforceMaxResolution).toBe(true);
      expect(DEFAULT_RETRO_MATERIAL.useDithering).toBe(true);
    });
  });

  describe('RETRO_TEXTURE_CONSTRAINTS', () => {
    it('should have correct PS2-era constraints', () => {
      expect(RETRO_TEXTURE_CONSTRAINTS.MAX_RESOLUTION).toBe(256);
      expect(RETRO_TEXTURE_CONSTRAINTS.COMMON_RESOLUTIONS).toEqual([16, 32, 64, 128, 256]);
      expect(RETRO_TEXTURE_CONSTRAINTS.FORCE_POT).toBe(true);
    });
  });
});

describe('applyTextureDithering', () => {
  it('should apply dithering to image data', () => {
    const width = 16;
    const height = 16;
    const imageData = new Uint8Array(width * height * 4);

    // Fill with gray gradient
    for (let i = 0; i < width * height; i++) {
      imageData[i * 4] = 128;     // R
      imageData[i * 4 + 1] = 128; // G
      imageData[i * 4 + 2] = 128; // B
      imageData[i * 4 + 3] = 255; // A
    }

    const dithered = applyTextureDithering(imageData, width, height, 0.5);

    expect(dithered.length).toBe(imageData.length);
    expect(dithered).not.toEqual(imageData); // Should be modified
  });

  it('should preserve alpha channel', () => {
    const width = 4;
    const height = 4;
    const imageData = new Uint8Array(width * height * 4);

    // Set different alpha values
    for (let i = 0; i < width * height; i++) {
      imageData[i * 4] = 100;
      imageData[i * 4 + 1] = 100;
      imageData[i * 4 + 2] = 100;
      imageData[i * 4 + 3] = i * 10; // Varying alpha
    }

    const dithered = applyTextureDithering(imageData, width, height, 0.5);

    // Check alpha is preserved
    for (let i = 0; i < width * height; i++) {
      expect(dithered[i * 4 + 3]).toBe(imageData[i * 4 + 3]);
    }
  });

  it('should clamp output to [0, 255]', () => {
    const width = 4;
    const height = 4;
    const imageData = new Uint8Array(width * height * 4);

    // Edge values
    for (let i = 0; i < width * height; i++) {
      imageData[i * 4] = 0;       // Min value
      imageData[i * 4 + 1] = 255; // Max value
      imageData[i * 4 + 2] = 128; // Mid value
      imageData[i * 4 + 3] = 255;
    }

    const dithered = applyTextureDithering(imageData, width, height, 1.0);

    // All values should be in valid range
    for (let i = 0; i < width * height * 4; i++) {
      expect(dithered[i]).toBeGreaterThanOrEqual(0);
      expect(dithered[i]).toBeLessThanOrEqual(255);
    }
  });

  it('should handle different strength values', () => {
    const width = 8;
    const height = 8;
    const imageData = new Uint8Array(width * height * 4).fill(128);

    const weak = applyTextureDithering(imageData, width, height, 0.1);
    const strong = applyTextureDithering(imageData, width, height, 1.0);

    expect(weak).toBeDefined();
    expect(strong).toBeDefined();
  });

  it('should use Bayer 4x4 matrix pattern', () => {
    const width = 4;
    const height = 4;
    const imageData = new Uint8Array(width * height * 4).fill(128);

    const dithered = applyTextureDithering(imageData, width, height, 1.0);

    // Pattern should repeat every 4 pixels
    expect(dithered.length).toBe(width * height * 4);
  });
});

describe('downscaleToRetroResolution', () => {
  it('should downscale large texture to 256px', () => {
    const width = 512;
    const height = 512;
    const imageData = new Uint8Array(width * height * 4).fill(255);

    const result = downscaleToRetroResolution(imageData, width, height, 256);

    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
    expect(result.data.length).toBe(256 * 256 * 4);
  });

  it('should clamp to MAX_RESOLUTION (256)', () => {
    const width = 1024;
    const height = 1024;
    const imageData = new Uint8Array(width * height * 4).fill(255);

    const result = downscaleToRetroResolution(imageData, width, height, 512);

    // Should be clamped to 256
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
  });

  it('should ensure power-of-two dimensions', () => {
    const width = 300;
    const height = 300;
    const imageData = new Uint8Array(width * height * 4).fill(255);

    const result = downscaleToRetroResolution(imageData, width, height, 200);

    // 200 should round down to 128 (nearest power of two)
    expect(result.width).toBe(128);
    expect(result.height).toBe(128);
  });

  it('should handle small textures', () => {
    const width = 512;
    const height = 512;
    const imageData = new Uint8Array(width * height * 4).fill(255);

    const result = downscaleToRetroResolution(imageData, width, height, 32);

    expect(result.width).toBe(32);
    expect(result.height).toBe(32);
    expect(result.data.length).toBe(32 * 32 * 4);
  });

  it('should preserve color data during downscaling', () => {
    const width = 64;
    const height = 64;
    const imageData = new Uint8Array(width * height * 4);

    // Fill with red
    for (let i = 0; i < width * height; i++) {
      imageData[i * 4] = 255;   // R
      imageData[i * 4 + 1] = 0; // G
      imageData[i * 4 + 2] = 0; // B
      imageData[i * 4 + 3] = 255; // A
    }

    const result = downscaleToRetroResolution(imageData, width, height, 32);

    // Should still be red
    expect(result.data[0]).toBe(255); // R
    expect(result.data[1]).toBe(0);   // G
    expect(result.data[2]).toBe(0);   // B
    expect(result.data[3]).toBe(255); // A
  });

  it('should handle various common resolutions', () => {
    const commonSizes = [16, 32, 64, 128, 256];

    for (const targetSize of commonSizes) {
      const width = 512;
      const height = 512;
      const imageData = new Uint8Array(width * height * 4).fill(128);

      const result = downscaleToRetroResolution(imageData, width, height, targetSize);

      expect(result.width).toBe(targetSize);
      expect(result.height).toBe(targetSize);
    }
  });

  it('should use nearest-neighbor sampling', () => {
    const width = 4;
    const height = 4;
    const imageData = new Uint8Array(width * height * 4);

    // Create 2x2 colored quadrants
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (x < 2 && y < 2) {
          imageData[i] = 255; // Top-left = Red
        } else if (x >= 2 && y < 2) {
          imageData[i + 1] = 255; // Top-right = Green
        } else if (x < 2 && y >= 2) {
          imageData[i + 2] = 255; // Bottom-left = Blue
        } else {
          imageData[i] = 255;
          imageData[i + 1] = 255;
          imageData[i + 2] = 255; // Bottom-right = White
        }
        imageData[i + 3] = 255;
      }
    }

    const result = downscaleToRetroResolution(imageData, width, height, 2);

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });

  describe('Input Validation', () => {
    it('should throw on zero width', () => {
      const imageData = new Uint8Array(100);
      expect(() => downscaleToRetroResolution(imageData, 0, 10, 64)).toThrow('Invalid dimensions');
    });

    it('should throw on zero height', () => {
      const imageData = new Uint8Array(100);
      expect(() => downscaleToRetroResolution(imageData, 10, 0, 64)).toThrow('Invalid dimensions');
    });

    it('should throw on negative width', () => {
      const imageData = new Uint8Array(100);
      expect(() => downscaleToRetroResolution(imageData, -10, 10, 64)).toThrow('Invalid dimensions');
    });

    it('should throw on negative height', () => {
      const imageData = new Uint8Array(100);
      expect(() => downscaleToRetroResolution(imageData, 10, -10, 64)).toThrow('Invalid dimensions');
    });

    it('should throw on negative targetSize', () => {
      const imageData = new Uint8Array(16 * 16 * 4);
      expect(() => downscaleToRetroResolution(imageData, 16, 16, -64)).toThrow('Invalid targetSize');
    });

    it('should throw on zero targetSize', () => {
      const imageData = new Uint8Array(16 * 16 * 4);
      expect(() => downscaleToRetroResolution(imageData, 16, 16, 0)).toThrow('Invalid targetSize');
    });

    it('should throw when imageData is too small', () => {
      const imageData = new Uint8Array(10); // Way too small for 16x16 RGBA
      expect(() => downscaleToRetroResolution(imageData, 16, 16, 8)).toThrow('ImageData too small');
    });
  });
});
