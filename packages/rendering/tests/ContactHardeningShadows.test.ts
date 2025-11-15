/**
 * Contact Hardening Shadows Test - Epic 3.18 Task 3.3
 *
 * Validates PCSS-Lite implementation for retro-appropriate soft shadows.
 * Tests blocker search, penumbra calculation, and variable-sized PCF.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Contact Hardening Shadows - Epic 3.18 Task 3.3', () => {
  let shadowAdvancedShader: string;

  beforeAll(() => {
    // Read the shadow-advanced.wgsl shader
    const shaderPath = join(__dirname, '../src/shaders/shadow-advanced.wgsl');
    shadowAdvancedShader = readFileSync(shaderPath, 'utf-8');
  });

  describe('Shader Function Presence', () => {
    it('should include findBlockerDepth function', () => {
      expect(shadowAdvancedShader).toContain('fn findBlockerDepth(');
      expect(shadowAdvancedShader).toContain('Epic 3.18 Task 3.3');
    });

    it('should include calculatePenumbraSize function', () => {
      expect(shadowAdvancedShader).toContain('fn calculatePenumbraSize(');
      expect(shadowAdvancedShader).toContain('PCSS-style soft shadows');
    });

    it('should include sampleSpotShadowContactHardening function', () => {
      expect(shadowAdvancedShader).toContain('fn sampleSpotShadowContactHardening(');
      expect(shadowAdvancedShader).toContain('Contact Hardening');
    });

    it('should include samplePointShadowContactHardening function', () => {
      expect(shadowAdvancedShader).toContain('fn samplePointShadowContactHardening(');
      expect(shadowAdvancedShader).toContain('Contact Hardening for point lights');
    });
  });

  describe('Implementation Details', () => {
    it('should use 16-sample Poisson disk for blocker search (retro-lite)', () => {
      // Extract findBlockerDepth function
      const findBlockerMatch = shadowAdvancedShader.match(
        /fn findBlockerDepth\([^)]+\)[^{]*\{([\s\S]*?)^}/m
      );
      expect(findBlockerMatch).toBeTruthy();

      const findBlockerBody = findBlockerMatch![1];

      // Should use 16 samples (retro-lite approach)
      expect(findBlockerBody).toContain('i < 16u');
      expect(findBlockerBody).toContain('POISSON_DISK_16');

      // Should NOT use 32 samples (that's too expensive)
      expect(findBlockerBody).not.toContain('i < 32u');
      expect(findBlockerBody).not.toContain('POISSON_DISK_32');
    });

    it('should use fixed blocker depth heuristic (0.6)', () => {
      const findBlockerMatch = shadowAdvancedShader.match(
        /fn findBlockerDepth\([^)]+\)[^{]*\{([\s\S]*?)^}/m
      );
      const findBlockerBody = findBlockerMatch![1];

      // FIXED (Code-Critic Issue #1): Use fixed 60% heuristic instead of ratio-based
      // Should use fixed assumption (blockers at 60% of receiver depth)
      expect(findBlockerBody).toContain('receiverDepth * 0.6');
      expect(findBlockerBody).toContain('FIXED HEURISTIC APPROXIMATION');
    });

    it('should use comparison sampler (not separate depth sampler)', () => {
      // Function signature should NOT have depthSampler parameter
      expect(shadowAdvancedShader).toContain(
        'fn sampleSpotShadowContactHardening(\n  shadowAtlas: texture_depth_2d,\n  shadowSampler: sampler_comparison,'
      );

      // Should use textureSampleCompare for blocker search
      const findBlockerMatch = shadowAdvancedShader.match(
        /fn findBlockerDepth\([^)]+\)[^{]*\{([\s\S]*?)^}/m
      );
      const findBlockerBody = findBlockerMatch![1];
      expect(findBlockerBody).toContain('textureSampleCompare');
    });

    it('should calculate variable penumbra size', () => {
      const contactHardeningMatch = shadowAdvancedShader.match(
        /fn sampleSpotShadowContactHardening\([^)]+\)[^{]*\{([\s\S]*?)^}/m
      );
      expect(contactHardeningMatch).toBeTruthy();

      const contactHardeningBody = contactHardeningMatch![1];

      // Should call calculatePenumbraSize
      expect(contactHardeningBody).toContain('calculatePenumbraSize');
      expect(contactHardeningBody).toContain('penumbraSize');

      // FIXED (Code-Critic Issue #4): Uses clampedRadius instead of filterRadius
      expect(contactHardeningBody).toContain('clampedRadius');
      expect(contactHardeningBody).toContain('max(uvFilterRadius');
    });

    it('should use variable-sized PCF based on penumbra', () => {
      const contactHardeningMatch = shadowAdvancedShader.match(
        /fn sampleSpotShadowContactHardening\([^)]+\)[^{]*\{([\s\S]*?)^}/m
      );
      const contactHardeningBody = contactHardeningMatch![1];

      // Should have 3 distinct phases (blocker search, penumbra calc, variable PCF)
      expect(contactHardeningBody).toContain('PCSS Step 1');
      expect(contactHardeningBody).toContain('PCSS Step 2');
      expect(contactHardeningBody).toContain('PCSS Step 3');

      // Variable PCF should use penumbra-based filter radius
      expect(contactHardeningBody).toContain('uvFilterRadius');
      expect(contactHardeningBody).toContain('POISSON_DISK_16[i] * clampedRadius');
    });
  });

  describe('Retro-Appropriate Design', () => {
    it('should document retro simplifications', () => {
      // Contact hardening function should mention retro-appropriate simplifications
      const contactHardeningMatch = shadowAdvancedShader.match(
        /\/\*\*[\s\S]*?fn sampleSpotShadowContactHardening/
      );
      expect(contactHardeningMatch).toBeTruthy();

      const docComment = contactHardeningMatch![0];

      // Should mention retro-appropriate approach
      expect(docComment.toLowerCase()).toMatch(/retro|simple|lite/i);

      // Should mention 16 samples (not 32)
      expect(docComment).toContain('16 samples');
    });

    it('should have fixed search radius (not adaptive)', () => {
      const contactHardeningMatch = shadowAdvancedShader.match(
        /fn sampleSpotShadowContactHardening\([^)]+\)[^{]*\{([\s\S]*?)^}/m
      );
      const contactHardeningBody = contactHardeningMatch![1];

      // Should use searchRadius parameter directly (not adaptively scaled)
      expect(contactHardeningBody).toContain('searchRadius');

      // Should NOT have complex adaptive scaling
      expect(contactHardeningBody).not.toContain('adaptiveScale');
      expect(contactHardeningBody).not.toContain('lightSpaceRadius');
    });

    it('should work with point lights (cubemap shadows)', () => {
      const pointContactMatch = shadowAdvancedShader.match(
        /fn samplePointShadowContactHardening\([^)]+\)[^{]*\{([\s\S]*?)^}/m
      );
      expect(pointContactMatch).toBeTruthy();

      const pointContactBody = pointContactMatch![1];

      // Should select cubemap face
      expect(pointContactBody).toContain('selectCubeFace');

      // Should use same 3-step PCSS process
      expect(pointContactBody).toContain('PCSS Step 1');
      expect(pointContactBody).toContain('PCSS Step 2');
      expect(pointContactBody).toContain('PCSS Step 3');

      // Should use 16 samples
      expect(pointContactBody).toContain('i < 16u');
    });
  });

  describe('Edge Cases', () => {
    it('should handle no blockers found', () => {
      const findBlockerMatch = shadowAdvancedShader.match(
        /fn findBlockerDepth\([^)]+\)[^{]*\{([\s\S]*?)^}/m
      );
      const findBlockerBody = findBlockerMatch![1];

      // Should return -1.0 when no blockers found
      expect(findBlockerBody).toContain('return -1.0');
      expect(findBlockerBody).toContain('blockerCount < 0.5');
    });

    it('should return fully lit when no blockers', () => {
      const contactHardeningMatch = shadowAdvancedShader.match(
        /fn sampleSpotShadowContactHardening\([^)]+\)[^{]*\{([\s\S]*?)^}/m
      );
      const contactHardeningBody = contactHardeningMatch![1];

      // Should return 1.0 (fully lit) when avgBlockerDepth < 0.0
      expect(contactHardeningBody).toContain('avgBlockerDepth < 0.0');
      expect(contactHardeningBody).toContain('return 1.0');
    });

    it('should handle zero blocker distance', () => {
      const penumbraMatch = shadowAdvancedShader.match(
        /fn calculatePenumbraSize\([^)]+\)[^{]*\{([\s\S]*?)^}/m
      );
      const penumbraBody = penumbraMatch![1];

      // Should check for very small blocker distance
      expect(penumbraBody).toContain('blockerDistance < 0.001');
      expect(penumbraBody).toContain('return 0.0');
    });

    it('should enforce minimum filter radius', () => {
      const contactHardeningMatch = shadowAdvancedShader.match(
        /fn sampleSpotShadowContactHardening\([^)]+\)[^{]*\{([\s\S]*?)^}/m
      );
      const contactHardeningBody = contactHardeningMatch![1];

      // Should have minimum filter radius (1 texel)
      expect(contactHardeningBody).toContain('max(uvFilterRadius');
    });
  });

  describe('Performance Characteristics', () => {
    it('should limit blocker search to 16 samples', () => {
      // Count Poisson disk samples in blocker search
      const findBlockerMatch = shadowAdvancedShader.match(
        /fn findBlockerDepth\([^)]+\)[^{]*\{([\s\S]*?)^}/m
      );
      const findBlockerBody = findBlockerMatch![1];

      // Should have exactly one loop with 16 iterations
      const loopMatches = findBlockerBody.match(/for\s*\([^)]*i\s*<\s*(\d+)u/g);
      expect(loopMatches).toHaveLength(1);
      expect(loopMatches![0]).toContain('16u');
    });

    it('should limit final PCF to 16 samples', () => {
      const contactHardeningMatch = shadowAdvancedShader.match(
        /fn sampleSpotShadowContactHardening\([^)]+\)[^{]*\{([\s\S]*?)^}/m
      );
      const contactHardeningBody = contactHardeningMatch![1];

      // Should have one loop in contact hardening function (final PCF with 16 samples)
      // Blocker search is in separate findBlockerDepth function
      const loopMatches = contactHardeningBody.match(/for\s*\([^)]*i\s*<\s*16u/g);
      expect(loopMatches).toHaveLength(1); // final PCF loop

      // Total cost: 16 samples (blocker search) + 16 samples (final PCF) = 32 samples
      // Much cheaper than full PCSS which uses 64+ samples
    });

    it('should avoid expensive depth reconstruction', () => {
      // Should NOT use complex depth reconstruction or binary search
      expect(shadowAdvancedShader).not.toContain('binarySearch');
      expect(shadowAdvancedShader).not.toContain('depthReconstruction');

      // Should use simple approximation (fixed heuristic: 60% of receiver depth)
      const findBlockerMatch = shadowAdvancedShader.match(
        /fn findBlockerDepth\([^)]+\)[^{]*\{([\s\S]*?)^}/m
      );
      const findBlockerBody = findBlockerMatch![1];
      expect(findBlockerBody).toContain('receiverDepth * 0.6');
    });
  });
});
