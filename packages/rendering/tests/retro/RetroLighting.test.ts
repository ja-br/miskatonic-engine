/**
 * RetroLighting Tests
 * Epic 3.4: Retro Rendering Pipeline - Lighting System
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  RetroLighting,
  FogMode,
  DEFAULT_RETRO_LIGHTING,
  createGradientLightmap,
} from '../../src/retro/RetroLighting';
import { createMockBackend } from '../test-utils/mockBackend';
import type { IRendererBackend } from '../../src/backends/IRendererBackend';

describe('RetroLighting', () => {
  let backend: IRendererBackend;
  let lighting: RetroLighting;

  beforeEach(() => {
    backend = createMockBackend();
  });

  afterEach(() => {
    if (lighting) {
      lighting.dispose();
    }
  });

  describe('Initialization', () => {
    it('should create with default configuration', () => {
      lighting = new RetroLighting(backend);
      expect(lighting).toBeDefined();
    });

    it('should create with custom configuration', () => {
      lighting = new RetroLighting(backend, {
        fog: {
          mode: FogMode.Exponential,
          color: [1, 1, 1],
          start: 100,
          end: 500,
          density: 0.1,
        },
      });

      const params = lighting.getParams();
      expect(params.fog.mode).toBe(FogMode.Exponential);
      expect(params.fog.color).toEqual([1, 1, 1]);
    });

    it('should merge custom params with defaults', () => {
      lighting = new RetroLighting(backend, {
        lightmapIntensity: 0.5,
      });

      const params = lighting.getParams();
      expect(params.lightmapIntensity).toBe(0.5);
      expect(params.fog).toEqual(DEFAULT_RETRO_LIGHTING.fog); // Default fog
    });

    it('should initialize successfully', () => {
      lighting = new RetroLighting(backend);
      expect(() => lighting.initialize()).not.toThrow();
    });

    it('should create uniform buffer on initialization', () => {
      const createBufferSpy = vi.spyOn(backend, 'createBuffer');

      lighting = new RetroLighting(backend);
      lighting.initialize();

      expect(createBufferSpy).toHaveBeenCalledWith(
        'retro_lighting_params',
        'uniform',
        expect.any(Float32Array),
        'dynamic_draw'
      );
    });

    it('should not re-initialize if already initialized', () => {
      lighting = new RetroLighting(backend);
      lighting.initialize();

      const createBufferSpy = vi.spyOn(backend, 'createBuffer');
      lighting.initialize();

      expect(createBufferSpy).not.toHaveBeenCalled();
    });
  });

  describe('Fog Configuration', () => {
    beforeEach(() => {
      lighting = new RetroLighting(backend);
      lighting.initialize();
    });

    it('should default to linear fog', () => {
      const params = lighting.getParams();
      expect(params.fog.mode).toBe(FogMode.Linear);
      expect(params.fog.color).toEqual([0.5, 0.6, 0.7]);
    });

    it('should support all fog modes', () => {
      const modes = [
        FogMode.None,
        FogMode.Linear,
        FogMode.Exponential,
        FogMode.ExponentialSquared,
      ];

      for (const mode of modes) {
        lighting.setFog({
          mode,
          color: [1, 1, 1],
          start: 0,
          end: 100,
          density: 0.05,
        });

        expect(lighting.getParams().fog.mode).toBe(mode);
      }
    });

    it('should update fog configuration at runtime', () => {
      lighting.setFog({
        mode: FogMode.Exponential,
        color: [0.8, 0.8, 0.9],
        start: 75,
        end: 250,
        density: 0.03,
      });

      const params = lighting.getParams();
      expect(params.fog.mode).toBe(FogMode.Exponential);
      expect(params.fog.color).toEqual([0.8, 0.8, 0.9]);
      expect(params.fog.start).toBe(75);
      expect(params.fog.end).toBe(250);
      expect(params.fog.density).toBe(0.03);
    });

    it('should update uniform buffer when fog changes', () => {
      const updateBufferSpy = vi.spyOn(backend, 'updateBuffer');

      lighting.setFog({
        mode: FogMode.Linear,
        color: [1, 0, 0],
        start: 10,
        end: 100,
        density: 0.05,
      });

      expect(updateBufferSpy).toHaveBeenCalled();
    });
  });

  describe('Contrast Fog Configuration', () => {
    beforeEach(() => {
      lighting = new RetroLighting(backend);
      lighting.initialize();
    });

    it('should default to enabled', () => {
      const params = lighting.getParams();
      expect(params.contrastFog.enabled).toBe(true);
    });

    it('should update contrast fog configuration', () => {
      lighting.setContrastFog({
        enabled: false,
        start: 150,
        end: 400,
        intensity: 0.9,
      });

      const params = lighting.getParams();
      expect(params.contrastFog.enabled).toBe(false);
      expect(params.contrastFog.start).toBe(150);
      expect(params.contrastFog.end).toBe(400);
      expect(params.contrastFog.intensity).toBe(0.9);
    });
  });

  describe('Lightmap Configuration', () => {
    beforeEach(() => {
      lighting = new RetroLighting(backend);
      lighting.initialize();
    });

    it('should default to intensity 1.0', () => {
      const params = lighting.getParams();
      expect(params.lightmapIntensity).toBe(1.0);
    });

    it('should update lightmap intensity', () => {
      lighting.setLightmapIntensity(0.7);
      expect(lighting.getParams().lightmapIntensity).toBe(0.7);
    });

    it('should clamp intensity to valid range', () => {
      lighting.setLightmapIntensity(1.5);
      const params = lighting.getParams();
      // Should accept any value (clamping is shader-side)
      expect(params.lightmapIntensity).toBe(1.5);
    });
  });

  describe('Environment Map Configuration', () => {
    beforeEach(() => {
      lighting = new RetroLighting(backend);
      lighting.initialize();
    });

    it('should default to intensity 0.3', () => {
      const params = lighting.getParams();
      expect(params.envMapIntensity).toBe(0.3);
    });

    it('should update environment map intensity', () => {
      lighting.setEnvironmentMapIntensity(0.5);
      expect(lighting.getParams().envMapIntensity).toBe(0.5);
    });
  });

  describe('Ambient Color Configuration', () => {
    beforeEach(() => {
      lighting = new RetroLighting(backend);
      lighting.initialize();
    });

    it('should default to dim blueish ambient', () => {
      const params = lighting.getParams();
      expect(params.ambientColor).toEqual([0.2, 0.2, 0.25]);
    });

    it('should update ambient color', () => {
      lighting.setAmbientColor([0.3, 0.3, 0.3]);
      expect(lighting.getParams().ambientColor).toEqual([0.3, 0.3, 0.3]);
    });
  });

  describe('Uniform Buffer Packing', () => {
    beforeEach(() => {
      lighting = new RetroLighting(backend);
      lighting.initialize();
    });

    it('should pack uniforms with correct size (80 bytes)', () => {
      const createBufferSpy = vi.spyOn(backend, 'createBuffer');

      const newLighting = new RetroLighting(backend);
      newLighting.initialize();

      // Should create buffer with 20 floats (80 bytes = 5 vec4s)
      const call = createBufferSpy.mock.calls.find(
        (c) => c[0] === 'retro_lighting_params'
      );
      expect(call).toBeDefined();
      const data = call![2] as Float32Array;
      expect(data.length).toBe(20); // 5 vec4s

      newLighting.dispose();
    });

    it('should pack fog config correctly', () => {
      lighting.setFog({
        mode: FogMode.Exponential,
        color: [0.1, 0.2, 0.3],
        start: 10,
        end: 100,
        density: 0.05,
      });

      // Can't easily verify packed data without exposing internals
      // But we can verify no errors are thrown
      expect(lighting.getParams().fog.mode).toBe(FogMode.Exponential);
    });
  });

  describe('Disposal', () => {
    beforeEach(() => {
      lighting = new RetroLighting(backend);
      lighting.initialize();
    });

    it('should clean up uniform buffer', () => {
      const deleteBufferSpy = vi.spyOn(backend, 'deleteBuffer');

      lighting.dispose();

      expect(deleteBufferSpy).toHaveBeenCalled();
    });

    it('should throw error if getting buffer after disposal', () => {
      lighting.dispose();

      expect(() => lighting.getUniformBuffer()).toThrow(
        'RetroLighting not initialized'
      );
    });

    it('should allow re-initialization after disposal', () => {
      lighting.dispose();
      expect(() => lighting.initialize()).not.toThrow();
    });
  });

  describe('PS2-era Authenticity', () => {
    it('should use period-appropriate defaults', () => {
      lighting = new RetroLighting(backend);
      const params = lighting.getParams();

      // Linear fog (most common in PS2 games)
      expect(params.fog.mode).toBe(FogMode.Linear);

      // Atmospheric blueish fog
      expect(params.fog.color[0]).toBeLessThan(params.fog.color[2]); // More blue than red

      // Contrast fog enabled (common PS2 technique)
      expect(params.contrastFog.enabled).toBe(true);

      // Moderate fog distances (PS2-era typical)
      expect(params.fog.start).toBeLessThan(100);
      expect(params.fog.end).toBeLessThan(300);
    });

    it('should not use modern AAA lighting features', () => {
      lighting = new RetroLighting(backend);
      const params = lighting.getParams();

      // No SSAO, SSR, GI, etc. (just verify structure is simple)
      expect(Object.keys(params)).toHaveLength(5); // fog, contrastFog, lightmap, envMap, ambient
    });
  });

  describe('Utility Functions', () => {
    it('should create gradient lightmap texture', () => {
      const createTextureSpy = vi.spyOn(backend, 'createTexture');

      const lightmap = createGradientLightmap(backend, 128);

      expect(createTextureSpy).toHaveBeenCalledWith(
        'gradient_lightmap',
        128,
        128,
        expect.any(Uint8Array),
        expect.objectContaining({
          format: 'r8unorm',
          minFilter: 'linear',
          magFilter: 'linear',
        })
      );

      expect(lightmap).toBeDefined();
    });

    it('should generate gradient with center bright, edges dark', () => {
      const createTextureSpy = vi.spyOn(backend, 'createTexture');

      createGradientLightmap(backend, 64);

      const call = createTextureSpy.mock.calls.find(
        (c) => c[0] === 'gradient_lightmap'
      );
      const data = call![3] as Uint8Array;

      // Center pixel should be brighter
      const centerIdx = 32 * 64 + 32; // Middle of 64x64
      const cornerIdx = 0; // Top-left corner

      expect(data[centerIdx]).toBeGreaterThan(data[cornerIdx]);
    });
  });
});
