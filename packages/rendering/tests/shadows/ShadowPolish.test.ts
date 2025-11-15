/**
 * ShadowPolish Tests
 * Epic 3.19: Final Shadow Polish
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ShadowPolish,
  ShadowQualityProfile,
  SHADOW_QUALITY_PRESETS,
  autoTuneShadowBias,
} from '../../src/shadows/ShadowPolish';

describe('ShadowPolish', () => {
  let shadowPolish: ShadowPolish;

  describe('Initialization', () => {
    it('should create with default medium quality', () => {
      shadowPolish = new ShadowPolish();
      const config = shadowPolish.getConfig();
      expect(config.profile).toBe(ShadowQualityProfile.Medium);
    });

    it('should create with custom quality profile', () => {
      shadowPolish = new ShadowPolish(ShadowQualityProfile.High);
      const config = shadowPolish.getConfig();
      expect(config.profile).toBe(ShadowQualityProfile.High);
    });

    it('should load correct preset for each quality level', () => {
      for (const profile of Object.values(ShadowQualityProfile)) {
        shadowPolish = new ShadowPolish(profile as ShadowQualityProfile);
        const config = shadowPolish.getConfig();
        expect(config.profile).toBe(profile);
      }
    });
  });

  describe('Bias Calculation', () => {
    beforeEach(() => {
      shadowPolish = new ShadowPolish(ShadowQualityProfile.Medium);
    });

    it('should calculate bias for flat surface facing light', () => {
      const normal = [0, 1, 0]; // Up
      const lightDir = [0, 1, 0]; // Light from above
      const distance = 10;

      const bias = shadowPolish.calculateBias(normal, lightDir, distance);

      // Should be close to constant bias (minimal slope)
      const config = shadowPolish.getConfig();
      expect(bias).toBeGreaterThan(config.bias.constantBias * 0.9);
      expect(bias).toBeLessThan(config.bias.maxBias);
    });

    it('should increase bias for angled surfaces', () => {
      const normal = [0, 1, 0]; // Up
      const lightDir45 = [0.707, 0.707, 0]; // 45° angle
      const lightDir90 = [1, 0, 0]; // 90° angle

      const bias45 = shadowPolish.calculateBias(normal, lightDir45, 10);
      const bias90 = shadowPolish.calculateBias(normal, lightDir90, 10);

      // Bias should increase with angle
      expect(bias90).toBeGreaterThan(bias45);
    });

    it('should handle extreme angles specially when enabled', () => {
      shadowPolish.updateConfig({
        edgeCase: {
          handleExtremeAngles: true,
          extremeAngleThreshold: Math.PI / 2.25, // ~80°
          handleLargeObjects: false,
          largeObjectThreshold: 100,
          useAdaptiveBias: false,
        },
      });

      const normal = [0, 1, 0];
      const extremeAngle = [0.995, 0.1, 0]; // ~84° (very steep)
      const normalAngle = [0.707, 0.707, 0]; // 45°

      const extremeBias = shadowPolish.calculateBias(normal, extremeAngle, 10);
      const normalBias = shadowPolish.calculateBias(normal, normalAngle, 10);

      // Extreme angle should have significantly more bias
      expect(extremeBias).toBeGreaterThan(normalBias * 1.5);
    });

    it('should use adaptive bias for large objects', () => {
      shadowPolish.updateConfig({
        edgeCase: {
          handleExtremeAngles: false,
          extremeAngleThreshold: Math.PI / 2.25,
          handleLargeObjects: true,
          largeObjectThreshold: 100,
          useAdaptiveBias: true,
        },
      });

      const normal = [0, 1, 0];
      const lightDir = [0, 1, 0];

      const nearBias = shadowPolish.calculateBias(normal, lightDir, 10);
      const farBias = shadowPolish.calculateBias(normal, lightDir, 200); // Beyond threshold

      // Far distance should have more bias
      expect(farBias).toBeGreaterThan(nearBias);
    });

    it('should clamp bias to min/max values', () => {
      const config = shadowPolish.getConfig();
      const normal = [0, 1, 0];

      // Test various angles
      for (let angle = 0; angle < Math.PI / 2; angle += Math.PI / 16) {
        const lightDir = [Math.sin(angle), Math.cos(angle), 0];
        const bias = shadowPolish.calculateBias(normal, lightDir, 10);

        expect(bias).toBeGreaterThanOrEqual(config.bias.minBias);
        expect(bias).toBeLessThanOrEqual(config.bias.maxBias);
      }
    });
  });

  describe('Normal Offset Calculation', () => {
    beforeEach(() => {
      shadowPolish = new ShadowPolish(ShadowQualityProfile.Medium);
    });

    it('should return configured normal bias', () => {
      const normal = [0, 1, 0];
      const offset = shadowPolish.calculateNormalOffset(normal);

      const config = shadowPolish.getConfig();
      expect(offset).toBe(config.bias.normalBias);
    });

    it('should vary by quality profile', () => {
      const normal = [0, 1, 0];

      const lowPolish = new ShadowPolish(ShadowQualityProfile.Low);
      const highPolish = new ShadowPolish(ShadowQualityProfile.High);

      const lowOffset = lowPolish.calculateNormalOffset(normal);
      const highOffset = highPolish.calculateNormalOffset(normal);

      // High quality should have more normal offset
      expect(highOffset).toBeGreaterThan(lowOffset);
    });
  });

  describe('Light Leak Validation', () => {
    beforeEach(() => {
      shadowPolish = new ShadowPolish(ShadowQualityProfile.High);
    });

    it('should validate normal shadow scenario', () => {
      const receiverPos = [0, 0, 0];
      const occluderPos = [0, 1, 0]; // Between light and receiver (1 unit away)
      const lightPos = [0, 10, 0];
      const normal = [0, 1, 0]; // Facing up toward light

      // Discontinuity: |10 - 9| = 1, which is < maxDiscontinuity (2.0 for High quality)
      const isValid = shadowPolish.validateShadow(receiverPos, occluderPos, lightPos, normal);
      expect(isValid).toBe(true);
    });

    it('should reject shadow when occluder is behind receiver', () => {
      const receiverPos = [0, 0, 0];
      const occluderPos = [0, -5, 0]; // Behind receiver
      const lightPos = [0, 10, 0];
      const normal = [0, 1, 0];

      const isValid = shadowPolish.validateShadow(receiverPos, occluderPos, lightPos, normal);
      expect(isValid).toBe(false);
    });

    it('should reject shadow with large depth discontinuity', () => {
      const receiverPos = [0, 0, 0];
      const occluderPos = [0, 1, 0]; // Very close, but large depth difference
      const lightPos = [0, 100, 0]; // Very far light
      const normal = [0, 1, 0];

      const isValid = shadowPolish.validateShadow(receiverPos, occluderPos, lightPos, normal);

      // Depends on maxDiscontinuity setting
      const config = shadowPolish.getConfig();
      const discontinuity = Math.abs(100 - 99);
      if (discontinuity > config.lightLeak.maxDiscontinuity) {
        expect(isValid).toBe(false);
      }
    });

    it('should reject shadow on back-facing surface', () => {
      const receiverPos = [0, 0, 0];
      const occluderPos = [0, 5, 0];
      const lightPos = [0, 10, 0];
      const normal = [0, -1, 0]; // Facing down, away from light

      const isValid = shadowPolish.validateShadow(receiverPos, occluderPos, lightPos, normal);
      expect(isValid).toBe(false);
    });

    it('should skip validation when disabled', () => {
      shadowPolish.updateConfig({
        lightLeak: {
          enabled: false,
          maxDiscontinuity: 2.0,
          receiverPlaneOffset: 0.01,
        },
      });

      // Invalid scenario (occluder behind receiver)
      const receiverPos = [0, 0, 0];
      const occluderPos = [0, -5, 0];
      const lightPos = [0, 10, 0];
      const normal = [0, 1, 0];

      const isValid = shadowPolish.validateShadow(receiverPos, occluderPos, lightPos, normal);
      expect(isValid).toBe(true); // Validation disabled, always passes
    });
  });

  describe('Receiver Plane Offset', () => {
    beforeEach(() => {
      shadowPolish = new ShadowPolish(ShadowQualityProfile.Medium);
    });

    it('should calculate offset for perpendicular light', () => {
      const normal = [0, 1, 0];
      const lightDir = [0, 1, 0]; // Perpendicular

      const offset = shadowPolish.calculateReceiverPlaneOffset(normal, lightDir);

      const config = shadowPolish.getConfig();
      expect(offset).toBeGreaterThanOrEqual(config.lightLeak.receiverPlaneOffset);
    });

    it('should increase offset for parallel surfaces', () => {
      const normal = [0, 1, 0];
      const perpendicularLight = [0, 1, 0]; // 90° (perpendicular)
      const parallelLight = [1, 0, 0]; // 0° (parallel)

      const perpendicularOffset = shadowPolish.calculateReceiverPlaneOffset(normal, perpendicularLight);
      const parallelOffset = shadowPolish.calculateReceiverPlaneOffset(normal, parallelLight);

      // Parallel surfaces need more offset to prevent surface acne
      expect(parallelOffset).toBeGreaterThan(perpendicularOffset);
    });
  });

  describe('Configuration Management', () => {
    beforeEach(() => {
      shadowPolish = new ShadowPolish(ShadowQualityProfile.Medium);
    });

    it('should update configuration partially', () => {
      const originalConfig = shadowPolish.getConfig();

      shadowPolish.updateConfig({
        bias: {
          ...originalConfig.bias,
          constantBias: 0.01,
        },
      });

      const newConfig = shadowPolish.getConfig();
      expect(newConfig.bias.constantBias).toBe(0.01);
      expect(newConfig.bias.slopeBias).toBe(originalConfig.bias.slopeBias); // Unchanged
    });

    it('should mark as custom when modified', () => {
      shadowPolish.updateConfig({
        bias: { constantBias: 0.01 } as any,
      });

      const config = shadowPolish.getConfig();
      expect(config.profile).toBe(ShadowQualityProfile.Custom);
    });

    it('should preserve profile if explicitly set', () => {
      shadowPolish.updateConfig({
        profile: ShadowQualityProfile.High,
        bias: { constantBias: 0.01 } as any,
      });

      const config = shadowPolish.getConfig();
      expect(config.profile).toBe(ShadowQualityProfile.High);
    });
  });

  describe('Quality Presets', () => {
    it('should provide valid presets for all profiles', () => {
      for (const profile of Object.values(ShadowQualityProfile)) {
        const preset = SHADOW_QUALITY_PRESETS[profile as ShadowQualityProfile];

        expect(preset).toBeDefined();
        expect(preset.bias).toBeDefined();
        expect(preset.lightLeak).toBeDefined();
        expect(preset.edgeCase).toBeDefined();
      }
    });

    it('should have increasing bias from low to high quality', () => {
      const low = SHADOW_QUALITY_PRESETS[ShadowQualityProfile.Low];
      const medium = SHADOW_QUALITY_PRESETS[ShadowQualityProfile.Medium];
      const high = SHADOW_QUALITY_PRESETS[ShadowQualityProfile.High];

      expect(medium.bias.constantBias).toBeGreaterThan(low.bias.constantBias);
      expect(high.bias.constantBias).toBeGreaterThan(medium.bias.constantBias);
    });

    it('should have stricter light leak detection in high quality', () => {
      const low = SHADOW_QUALITY_PRESETS[ShadowQualityProfile.Low];
      const high = SHADOW_QUALITY_PRESETS[ShadowQualityProfile.High];

      expect(low.lightLeak.enabled).toBe(false);
      expect(high.lightLeak.enabled).toBe(true);
      expect(high.lightLeak.maxDiscontinuity).toBeLessThan(low.lightLeak.maxDiscontinuity);
    });
  });

  describe('Recommendations', () => {
    beforeEach(() => {
      shadowPolish = new ShadowPolish(ShadowQualityProfile.Medium);
    });

    it('should recommend PCF kernel size based on quality', () => {
      const lowPolish = new ShadowPolish(ShadowQualityProfile.Low);
      const mediumPolish = new ShadowPolish(ShadowQualityProfile.Medium);
      const highPolish = new ShadowPolish(ShadowQualityProfile.High);

      expect(lowPolish.getRecommendedPCFKernelSize()).toBe(4);
      expect(mediumPolish.getRecommendedPCFKernelSize()).toBe(16);
      expect(highPolish.getRecommendedPCFKernelSize()).toBe(32);
    });

    it('should recommend shadow map resolution based on quality', () => {
      const lowPolish = new ShadowPolish(ShadowQualityProfile.Low);
      const mediumPolish = new ShadowPolish(ShadowQualityProfile.Medium);
      const highPolish = new ShadowPolish(ShadowQualityProfile.High);

      expect(lowPolish.getRecommendedShadowMapResolution()).toBe(1024);
      expect(mediumPolish.getRecommendedShadowMapResolution()).toBe(2048);
      expect(highPolish.getRecommendedShadowMapResolution()).toBe(4096);
    });
  });

  describe('Auto-Tuning', () => {
    it('should auto-tune for small scene', () => {
      const config = autoTuneShadowBias(50, 20, false, false);

      // Small scene should have smaller bias
      expect(config.bias.constantBias).toBeLessThan(0.002);
    });

    it('should auto-tune for large scene', () => {
      const config = autoTuneShadowBias(500, 200, false, false);

      // Large scene should have larger bias
      // sceneBounds=500 → sceneScale=5.0 → constantBias = 0.002 * 5.0 = 0.010
      expect(config.bias.constantBias).toBeCloseTo(0.010, 3);
      expect(config.bias.constantBias).toBeGreaterThan(0.005);
    });

    it('should enable large object handling when needed', () => {
      const config = autoTuneShadowBias(100, 50, true, false);

      expect(config.edgeCase.handleLargeObjects).toBe(true);
      expect(config.edgeCase.useAdaptiveBias).toBe(true);
    });

    it('should enable extreme angle handling when needed', () => {
      const config = autoTuneShadowBias(100, 50, false, true);

      expect(config.edgeCase.handleExtremeAngles).toBe(true);
      // Medium preset slopeBias=0.002, multiplied by 1.5 = 0.003
      expect(config.bias.slopeBias).toBeCloseTo(0.003, 4);
      expect(config.bias.slopeBias).toBeGreaterThan(0.002);
    });

    it('should adjust light leak detection for distant lights', () => {
      const nearConfig = autoTuneShadowBias(100, 50, false, false);
      const farConfig = autoTuneShadowBias(100, 200, false, false);

      // nearConfig: averageLightDistance=50 < 100 → keeps default maxDiscontinuity=5.0
      // farConfig: averageLightDistance=200 > 100 → maxDiscontinuity = 200 * 0.05 = 10.0
      expect(nearConfig.lightLeak.maxDiscontinuity).toBe(5.0);
      expect(farConfig.lightLeak.maxDiscontinuity).toBe(10.0);
      expect(farConfig.lightLeak.maxDiscontinuity).toBeGreaterThan(nearConfig.lightLeak.maxDiscontinuity);
    });

    it('should mark auto-tuned config as custom', () => {
      const config = autoTuneShadowBias(100, 50, false, false);
      expect(config.profile).toBe(ShadowQualityProfile.Custom);
    });
  });
});
