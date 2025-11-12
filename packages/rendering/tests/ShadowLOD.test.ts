/**
 * Tests for ShadowLOD - Epic 3.17 Phase 2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ShadowLOD, ShadowResolution, LightImportance } from '../src/shadows/ShadowLOD';

describe('ShadowLOD', () => {
  let lod: ShadowLOD;

  beforeEach(() => {
    lod = new ShadowLOD({
      distanceThresholds: {
        ultra: 10,
        high: 25,
        medium: 50,
        low: 100,
      },
    });
  });

  describe('Construction', () => {
    it('should create with default config', () => {
      const defaultLOD = new ShadowLOD();
      const config = defaultLOD.getConfig();

      expect(config.distanceThresholds.ultra).toBe(10);
      expect(config.distanceThresholds.high).toBe(25);
      expect(config.distanceThresholds.medium).toBe(50);
      expect(config.distanceThresholds.low).toBe(100);
      expect(config.adaptive).toBe(false);
      expect(config.targetFrameTime).toBe(16.67);
    });

    it('should create with custom thresholds', () => {
      const customLOD = new ShadowLOD({
        distanceThresholds: {
          ultra: 5,
          high: 15,
          medium: 30,
          low: 60,
        },
      });

      const config = customLOD.getConfig();
      expect(config.distanceThresholds.ultra).toBe(5);
      expect(config.distanceThresholds.high).toBe(15);
    });

    it('should enable adaptive mode', () => {
      const adaptiveLOD = new ShadowLOD({
        adaptive: true,
        targetFrameTime: 20,
      });

      const config = adaptiveLOD.getConfig();
      expect(config.adaptive).toBe(true);
      expect(config.targetFrameTime).toBe(20);
    });
  });

  describe('LOD Recommendation', () => {
    it('should recommend ULTRA for very close distance', () => {
      const rec = lod.recommendLOD({ distance: 5 });

      expect(rec.resolution).toBe(ShadowResolution.ULTRA);
      expect(rec.lodLevel).toBe(0);
      expect(rec.shouldCastShadows).toBe(true);
    });

    it('should recommend HIGH for moderate distance', () => {
      const rec = lod.recommendLOD({ distance: 15 });

      expect(rec.resolution).toBe(ShadowResolution.HIGH);
      expect(rec.lodLevel).toBe(1);
    });

    it('should recommend MEDIUM for far distance', () => {
      const rec = lod.recommendLOD({ distance: 35 });

      expect(rec.resolution).toBe(ShadowResolution.MEDIUM);
      expect(rec.lodLevel).toBe(2);
    });

    it('should recommend LOW for very far distance', () => {
      const rec = lod.recommendLOD({ distance: 75 });

      expect(rec.resolution).toBe(ShadowResolution.LOW);
      expect(rec.lodLevel).toBe(3);
    });

    it('should recommend MINIMAL for extreme distance', () => {
      const rec = lod.recommendLOD({ distance: 120 });

      expect(rec.resolution).toBe(ShadowResolution.MINIMAL);
      expect(rec.lodLevel).toBe(4);
    });

    it('should disable shadows beyond max distance', () => {
      const rec = lod.recommendLOD({ distance: 200 });

      expect(rec.shouldCastShadows).toBe(false);
    });
  });

  describe('Importance Weighting', () => {
    it('should boost player light range', () => {
      const normalRec = lod.recommendLOD({
        distance: 40,
        importance: LightImportance.NORMAL,
      });

      const playerRec = lod.recommendLOD({
        distance: 40,
        importance: LightImportance.PLAYER,
      });

      // Player light should get better quality at same distance
      expect(playerRec.resolution).toBeGreaterThan(normalRec.resolution);
    });

    it('should reduce unimportant light range', () => {
      const normalRec = lod.recommendLOD({
        distance: 40,
        importance: LightImportance.NORMAL,
      });

      const unimportantRec = lod.recommendLOD({
        distance: 40,
        importance: LightImportance.UNIMPORTANT,
      });

      // Unimportant light should get worse quality at same distance
      expect(unimportantRec.resolution).toBeLessThan(normalRec.resolution);
    });

    it('should use 2x multiplier for player lights', () => {
      // Distance 40 with 2x multiplier = effective distance 20
      const rec = lod.recommendLOD({
        distance: 40,
        importance: LightImportance.PLAYER,
      });

      expect(rec.effectiveDistance).toBeCloseTo(20, 1);
      expect(rec.resolution).toBe(ShadowResolution.HIGH); // 20 < 25
    });

    it('should use 0.5x multiplier for unimportant lights', () => {
      // Distance 40 with 0.5x multiplier = effective distance 80
      const rec = lod.recommendLOD({
        distance: 40,
        importance: LightImportance.UNIMPORTANT,
      });

      expect(rec.effectiveDistance).toBeCloseTo(80, 1);
      expect(rec.resolution).toBe(ShadowResolution.LOW); // 50 < 80 < 100
    });
  });

  describe('Hysteresis', () => {
    it('should apply hysteresis to prevent flickering', () => {
      // Start at HIGH (distance 20)
      let rec = lod.recommendLOD({
        distance: 20,
        importance: LightImportance.NORMAL,
      });
      expect(rec.resolution).toBe(ShadowResolution.HIGH);

      // Move slightly past threshold (25) - should stay HIGH due to hysteresis
      rec = lod.recommendLOD({
        distance: 26,
        importance: LightImportance.NORMAL,
        currentResolution: ShadowResolution.HIGH,
      });
      expect(rec.resolution).toBe(ShadowResolution.HIGH);

      // Move well past threshold (30) - should downgrade to MEDIUM
      rec = lod.recommendLOD({
        distance: 35,
        importance: LightImportance.NORMAL,
        currentResolution: ShadowResolution.HIGH,
      });
      expect(rec.resolution).toBe(ShadowResolution.MEDIUM);
    });

    it('should require 20% overlap to upgrade', () => {
      // Start at MEDIUM (distance 40)
      let rec = lod.recommendLOD({
        distance: 40,
        importance: LightImportance.NORMAL,
      });
      expect(rec.resolution).toBe(ShadowResolution.MEDIUM);

      // Move slightly before threshold (25) - should stay MEDIUM
      rec = lod.recommendLOD({
        distance: 24,
        importance: LightImportance.NORMAL,
        currentResolution: ShadowResolution.MEDIUM,
      });
      expect(rec.resolution).toBe(ShadowResolution.MEDIUM);

      // Move well before threshold (20) - should upgrade to HIGH
      rec = lod.recommendLOD({
        distance: 20,
        importance: LightImportance.NORMAL,
        currentResolution: ShadowResolution.MEDIUM,
      });
      expect(rec.resolution).toBe(ShadowResolution.HIGH);
    });

    it('should not apply hysteresis without current resolution', () => {
      const rec = lod.recommendLOD({
        distance: 26,
        importance: LightImportance.NORMAL,
      });

      // Without hysteresis, should immediately switch to MEDIUM
      expect(rec.resolution).toBe(ShadowResolution.MEDIUM);
    });
  });

  describe('Adaptive Scaling', () => {
    beforeEach(() => {
      lod = new ShadowLOD({
        adaptive: true,
        targetFrameTime: 16.67,
      });
    });

    it('should start with scale 1.0', () => {
      expect(lod.getAdaptiveScale()).toBe(1.0);
    });

    it('should reduce quality when over budget', () => {
      // Simulate frames running slow
      for (let i = 0; i < 40; i++) {
        lod.updateAdaptive(20); // 20ms > 16.67ms target
      }

      expect(lod.getAdaptiveScale()).toBeGreaterThan(1.0);
    });

    it('should increase quality when under budget', () => {
      // First go over budget
      for (let i = 0; i < 40; i++) {
        lod.updateAdaptive(20);
      }

      // Then go under budget
      for (let i = 0; i < 80; i++) {
        lod.updateAdaptive(10); // 10ms < 16.67ms target
      }

      expect(lod.getAdaptiveScale()).toBeLessThan(1.5);
    });

    it('should clamp scale to [0.5, 2.0]', () => {
      // Try to go very high
      for (let i = 0; i < 200; i++) {
        lod.updateAdaptive(30);
      }
      expect(lod.getAdaptiveScale()).toBeLessThanOrEqual(2.0);

      lod.resetAdaptive();

      // Try to go very low
      for (let i = 0; i < 200; i++) {
        lod.updateAdaptive(5);
      }
      expect(lod.getAdaptiveScale()).toBeGreaterThanOrEqual(0.5);
    });

    it('should use deadband to prevent oscillation', () => {
      // Frames within ±15% should not adjust
      for (let i = 0; i < 40; i++) {
        lod.updateAdaptive(17); // 17ms is within deadband
      }

      expect(lod.getAdaptiveScale()).toBe(1.0);
    });

    it('should not adjust without sufficient samples', () => {
      lod.updateAdaptive(30);
      lod.updateAdaptive(30);
      lod.updateAdaptive(30);

      // Only 3 samples, need 30
      expect(lod.getAdaptiveScale()).toBe(1.0);
    });

    it('should reset adaptive state', () => {
      for (let i = 0; i < 40; i++) {
        lod.updateAdaptive(20);
      }

      lod.resetAdaptive();

      expect(lod.getAdaptiveScale()).toBe(1.0);
    });

    it('should not update if adaptive is disabled', () => {
      const staticLOD = new ShadowLOD({ adaptive: false });

      for (let i = 0; i < 100; i++) {
        staticLOD.updateAdaptive(30);
      }

      expect(staticLOD.getAdaptiveScale()).toBe(1.0);
    });
  });

  describe('Memory Savings Calculation', () => {
    it('should calculate memory for directional lights', () => {
      const lights = [
        { distance: 5, type: 'directional' as const },
        { distance: 50, type: 'directional' as const },
      ];

      const savings = lod.calculateMemorySavings(lights);

      expect(savings.totalMemoryUltra).toBeGreaterThan(0);
      expect(savings.totalMemoryLOD).toBeLessThan(savings.totalMemoryUltra);
      expect(savings.savings).toBeGreaterThan(0);
      expect(savings.savingsPercent).toBeGreaterThan(0);
    });

    it('should calculate memory for point lights', () => {
      const lights = [
        { distance: 5, type: 'point' as const },
        { distance: 50, type: 'point' as const },
      ];

      const savings = lod.calculateMemorySavings(lights);

      expect(savings.savings).toBeGreaterThan(0);
    });

    it('should calculate memory for spot lights', () => {
      const lights = [
        { distance: 5, type: 'spot' as const },
        { distance: 50, type: 'spot' as const },
      ];

      const savings = lod.calculateMemorySavings(lights);

      expect(savings.savings).toBeGreaterThan(0);
    });

    it('should use cascade split for directional lights', () => {
      // ULTRA directional with CSM split: 2048 + 1024 + 512 = 20MB
      const lightsUltra = [{ distance: 1, type: 'directional' as const }];

      const savingsUltra = lod.calculateMemorySavings(lightsUltra);

      // ULTRA (2048): 2048*2048*4 + 1024*1024*4 + 512*512*4 = 21.33MB
      const expectedUltra = (2048 * 2048 + 1024 * 1024 + 512 * 512) * 4;
      expect(savingsUltra.totalMemoryUltra).toBe(expectedUltra);
    });

    it('should account for importance multipliers', () => {
      const normalLights = [
        { distance: 40, importance: LightImportance.NORMAL, type: 'directional' as const },
      ];

      const playerLights = [
        { distance: 40, importance: LightImportance.PLAYER, type: 'directional' as const },
      ];

      const normalSavings = lod.calculateMemorySavings(normalLights);
      const playerSavings = lod.calculateMemorySavings(playerLights);

      // Player light should use more memory (better quality)
      expect(playerSavings.totalMemoryLOD).toBeGreaterThan(normalSavings.totalMemoryLOD);
    });

    it('should handle zero savings', () => {
      const lights = [{ distance: 1, type: 'directional' as const }];

      const savings = lod.calculateMemorySavings(lights);

      // All at ultra, no savings
      expect(savings.savings).toBe(0);
      expect(savings.savingsPercent).toBe(0);
    });
  });

  describe('Config Update', () => {
    it('should update distance thresholds', () => {
      lod.updateConfig({
        distanceThresholds: {
          ultra: 5,
          high: 15,
        },
      });

      const config = lod.getConfig();
      expect(config.distanceThresholds.ultra).toBe(5);
      expect(config.distanceThresholds.high).toBe(15);
      expect(config.distanceThresholds.medium).toBe(50); // Unchanged
    });

    it('should update importance multipliers', () => {
      lod.updateConfig({
        importanceMultipliers: {
          player: 3.0,
        },
      });

      const config = lod.getConfig();
      expect(config.importanceMultipliers.player).toBe(3.0);
      expect(config.importanceMultipliers.normal).toBe(1.0); // Unchanged
    });

    it('should update adaptive settings', () => {
      lod.updateConfig({
        adaptive: true,
        targetFrameTime: 20,
      });

      const config = lod.getConfig();
      expect(config.adaptive).toBe(true);
      expect(config.targetFrameTime).toBe(20);
    });
  });

  describe('Resolution Enum Values', () => {
    it('should have correct resolution values', () => {
      expect(ShadowResolution.ULTRA).toBe(2048);
      expect(ShadowResolution.HIGH).toBe(1024);
      expect(ShadowResolution.MEDIUM).toBe(512);
      expect(ShadowResolution.LOW).toBe(256);
      expect(ShadowResolution.MINIMAL).toBe(128);
    });

    it('should use resolution values correctly in hysteresis', () => {
      // Resolution enum: ULTRA=2048 > LOW=256
      // Higher value = better quality
      expect(ShadowResolution.ULTRA).toBeGreaterThan(ShadowResolution.HIGH);
      expect(ShadowResolution.HIGH).toBeGreaterThan(ShadowResolution.MEDIUM);
      expect(ShadowResolution.MEDIUM).toBeGreaterThan(ShadowResolution.LOW);
      expect(ShadowResolution.LOW).toBeGreaterThan(ShadowResolution.MINIMAL);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero distance', () => {
      const rec = lod.recommendLOD({ distance: 0 });

      expect(rec.resolution).toBe(ShadowResolution.ULTRA);
      expect(rec.shouldCastShadows).toBe(true);
    });

    it('should handle negative distance', () => {
      const rec = lod.recommendLOD({ distance: -10 });

      // Negative distance treated as zero
      expect(rec.resolution).toBe(ShadowResolution.ULTRA);
    });

    it('should handle very large distance', () => {
      const rec = lod.recommendLOD({ distance: 10000 });

      expect(rec.shouldCastShadows).toBe(false);
    });

    it('should handle distance exactly at threshold', () => {
      const rec = lod.recommendLOD({ distance: 25 });

      // At threshold, should be HIGH (not MEDIUM)
      expect(rec.resolution).toBe(ShadowResolution.HIGH);
    });
  });
});
