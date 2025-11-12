/**
 * Tests for ShadowDebugVisualizer - Epic 3.17 Phase 2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ShadowDebugVisualizer,
  DebugVisualizationMode,
} from '../src/shadows/ShadowDebugVisualizer';
import { ShadowAtlas } from '../src/shadows/ShadowAtlas';
import { DirectionalShadowCascades } from '../src/shadows/DirectionalShadowCascades';
import { PointLightShadowCubemap } from '../src/shadows/PointLightShadowCubemap';
import { SpotLightShadowMapper } from '../src/shadows/SpotLightShadowMapper';

describe('ShadowDebugVisualizer', () => {
  let visualizer: ShadowDebugVisualizer;
  let atlas: ShadowAtlas;

  beforeEach(() => {
    visualizer = new ShadowDebugVisualizer();
    atlas = new ShadowAtlas({
      size: 2048,
      format: 'depth32float',
    });
  });

  describe('Visualization Mode', () => {
    it('should start with NONE mode', () => {
      expect(visualizer.getMode()).toBe(DebugVisualizationMode.NONE);
    });

    it('should set visualization mode', () => {
      visualizer.setMode(DebugVisualizationMode.ATLAS);
      expect(visualizer.getMode()).toBe(DebugVisualizationMode.ATLAS);
    });

    it('should cycle through modes', () => {
      expect(visualizer.getMode()).toBe(DebugVisualizationMode.NONE);

      visualizer.cycleMode();
      expect(visualizer.getMode()).toBe(DebugVisualizationMode.ATLAS);

      visualizer.cycleMode();
      expect(visualizer.getMode()).toBe(DebugVisualizationMode.CASCADE_FRUSTUMS);

      visualizer.cycleMode();
      expect(visualizer.getMode()).toBe(DebugVisualizationMode.DEPTH_MAP);

      visualizer.cycleMode();
      expect(visualizer.getMode()).toBe(DebugVisualizationMode.BIAS);

      visualizer.cycleMode();
      expect(visualizer.getMode()).toBe(DebugVisualizationMode.LOD);

      visualizer.cycleMode();
      expect(visualizer.getMode()).toBe(DebugVisualizationMode.CACHE_STATS);

      visualizer.cycleMode();
      expect(visualizer.getMode()).toBe(DebugVisualizationMode.NONE); // Wrap around
    });
  });

  describe('Atlas Visualization', () => {
    it('should generate empty atlas visualization', () => {
      const viz = visualizer.generateAtlasVisualization(atlas);

      expect(viz.size).toBe(2048);
      expect(viz.regions).toHaveLength(0);
      expect(viz.utilization).toBe(0);
    });

    it('should visualize allocated regions', () => {
      atlas.allocate(512, 512);
      atlas.allocate(256, 256);

      const viz = visualizer.generateAtlasVisualization(atlas);

      expect(viz.regions).toHaveLength(2);
      expect(viz.utilization).toBeGreaterThan(0);
    });

    it('should include region coordinates', () => {
      atlas.allocate(512, 512);

      const viz = visualizer.generateAtlasVisualization(atlas);
      const region = viz.regions[0];

      expect(region.x).toBeGreaterThanOrEqual(0);
      expect(region.y).toBeGreaterThanOrEqual(0);
      expect(region.width).toBe(512);
      expect(region.height).toBe(512);
    });

    it('should label directional light cascades', () => {
      const cascades = new DirectionalShadowCascades({
        lightDirection: [0, -1, 0],
        cascadeCount: 3,
      });

      cascades.allocateFromAtlas(atlas);

      const viz = visualizer.generateAtlasVisualization(atlas, {
        directional: [cascades],
      });

      // Should have labels like "Directional Cascade 0"
      expect(viz.regions.some(r => r.label.includes('Cascade'))).toBe(true);
    });

    it('should label point light faces', () => {
      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10,
        resolution: 256,
      });

      cubemap.allocateFromAtlas(atlas);

      const viz = visualizer.generateAtlasVisualization(atlas, {
        point: [cubemap],
      });

      // Should have 6 regions labeled "Point Face X"
      const pointFaces = viz.regions.filter(r => r.label.includes('Point Face'));
      expect(pointFaces).toHaveLength(6);
    });

    it('should label spot lights', () => {
      const spot = new SpotLightShadowMapper({
        position: [0, 0, 0],
        direction: [0, 0, 1],
        coneAngle: Math.PI / 4,
        range: 10,
        resolution: 512,
      });

      spot.allocateFromAtlas(atlas);

      const viz = visualizer.generateAtlasVisualization(atlas, {
        spot: [spot],
      });

      // Should have label "Spot 0"
      expect(viz.regions.some(r => r.label.includes('Spot'))).toBe(true);
    });

    it('should assign different colors to light types', () => {
      const cascades = new DirectionalShadowCascades({
        lightDirection: [0, -1, 0],
        cascadeCount: 1,
      });

      const cubemap = new PointLightShadowCubemap({
        position: [0, 0, 0],
        radius: 10,
        resolution: 256,
      });

      cascades.allocateFromAtlas(atlas);
      cubemap.allocateFromAtlas(atlas);

      const viz = visualizer.generateAtlasVisualization(atlas, {
        directional: [cascades],
        point: [cubemap],
      });

      // Get colors
      const directionalRegion = viz.regions.find(r => r.label.includes('Directional'));
      const pointRegion = viz.regions.find(r => r.label.includes('Point'));

      // Colors should be different
      expect(directionalRegion!.color).not.toEqual(pointRegion!.color);
    });

    it('should hide labels when toggled', () => {
      atlas.allocate(512, 512);

      visualizer.toggleLabels();

      const viz = visualizer.generateAtlasVisualization(atlas);

      expect(viz.regions[0].label).toBe('');
    });
  });

  describe('Cascade Frustum Visualization', () => {
    it('should generate frustum data for all cascades', () => {
      const cascades = new DirectionalShadowCascades({
        lightDirection: [0, -1, 0],
        cascadeCount: 3,
      });

      const frustums = visualizer.generateCascadeFrustums(cascades);

      expect(frustums).toHaveLength(3);
    });

    it('should include cascade index', () => {
      const cascades = new DirectionalShadowCascades({
        lightDirection: [0, -1, 0],
        cascadeCount: 3,
      });

      const frustums = visualizer.generateCascadeFrustums(cascades);

      expect(frustums[0].index).toBe(0);
      expect(frustums[1].index).toBe(1);
      expect(frustums[2].index).toBe(2);
    });

    it('should include near/far distances', () => {
      const cascades = new DirectionalShadowCascades({
        lightDirection: [0, -1, 0],
        cascadeCount: 3,
      });

      const frustums = visualizer.generateCascadeFrustums(cascades);

      for (const frustum of frustums) {
        expect(frustum.near).toBeGreaterThanOrEqual(0);
        expect(frustum.far).toBeGreaterThan(frustum.near);
      }
    });

    it('should assign different colors to cascades', () => {
      const cascades = new DirectionalShadowCascades({
        lightDirection: [0, -1, 0],
        cascadeCount: 3,
      });

      const frustums = visualizer.generateCascadeFrustums(cascades);

      // Colors should be different
      expect(frustums[0].color).not.toEqual(frustums[1].color);
      expect(frustums[1].color).not.toEqual(frustums[2].color);
    });
  });

  describe('Debug Info', () => {
    it('should generate debug info string', () => {
      const info = visualizer.generateDebugInfo(atlas);

      expect(info).toContain('Shadow Atlas Debug');
      expect(info).toContain('Size: 2048x2048');
      expect(info).toContain('Format: depth32float');
    });

    it('should include current mode', () => {
      visualizer.setMode(DebugVisualizationMode.ATLAS);

      const info = visualizer.generateDebugInfo(atlas);

      expect(info).toContain('Mode: atlas');
    });

    it('should include allocation stats', () => {
      atlas.allocate(512, 512);

      const info = visualizer.generateDebugInfo(atlas);

      expect(info).toContain('Allocated Regions: 1');
      expect(info).toContain('Utilization:');
      expect(info).toContain('Memory:');
    });

    it('should hide stats when toggled', () => {
      visualizer.toggleStats();

      const info = visualizer.generateDebugInfo(atlas);

      expect(info).toBe('');
    });
  });

  describe('LOD Color Coding', () => {
    it('should return green for LOD 0 (ultra)', () => {
      const color = ShadowDebugVisualizer.getLODColor(0);

      expect(color).toEqual([0.0, 1.0, 0.0, 1.0]); // Green
    });

    it('should return yellow for LOD 2 (medium)', () => {
      const color = ShadowDebugVisualizer.getLODColor(2);

      expect(color).toEqual([1.0, 1.0, 0.0, 1.0]); // Yellow
    });

    it('should return red for LOD 4 (minimal)', () => {
      const color = ShadowDebugVisualizer.getLODColor(4);

      expect(color).toEqual([1.0, 0.0, 0.0, 1.0]); // Red
    });

    it('should return gray for unknown LOD', () => {
      const color = ShadowDebugVisualizer.getLODColor(99);

      expect(color).toEqual([0.5, 0.5, 0.5, 1.0]); // Gray
    });
  });

  describe('Cache State Colors', () => {
    it('should return green for valid state', () => {
      const color = ShadowDebugVisualizer.getCacheStateColor('valid');

      expect(color).toEqual([0.0, 1.0, 0.0, 1.0]); // Green
    });

    it('should return orange for invalid state', () => {
      const color = ShadowDebugVisualizer.getCacheStateColor('invalid');

      expect(color).toEqual([1.0, 0.5, 0.0, 1.0]); // Orange
    });

    it('should return red for uninitialized state', () => {
      const color = ShadowDebugVisualizer.getCacheStateColor('uninitialized');

      expect(color).toEqual([1.0, 0.0, 0.0, 1.0]); // Red
    });
  });

  describe('Memory Formatting', () => {
    it('should format bytes', () => {
      expect(ShadowDebugVisualizer.formatMemory(512)).toBe('512 B');
    });

    it('should format kilobytes', () => {
      expect(ShadowDebugVisualizer.formatMemory(2048)).toBe('2.0 KB');
    });

    it('should format megabytes', () => {
      expect(ShadowDebugVisualizer.formatMemory(5 * 1024 * 1024)).toBe('5.0 MB');
    });

    it('should round to 1 decimal place', () => {
      expect(ShadowDebugVisualizer.formatMemory(1536)).toBe('1.5 KB');
    });
  });

  describe('Performance Summary', () => {
    it('should generate performance summary', () => {
      const summary = visualizer.generatePerformanceSummary({
        frameTime: 16.67,
        shadowRenderTime: 3.5,
        lightsRendered: 5,
        shadowsCached: 3,
        totalMemory: 12 * 1024 * 1024,
      });

      expect(summary).toContain('Shadow Performance');
      expect(summary).toContain('Frame Time: 16.67 ms');
      expect(summary).toContain('Shadow Render: 3.50 ms');
      expect(summary).toContain('Lights Rendered: 5');
      expect(summary).toContain('Shadows Cached: 3');
      expect(summary).toContain('12.0 MB');
    });

    it('should calculate shadow render percentage', () => {
      const summary = visualizer.generatePerformanceSummary({
        frameTime: 10.0,
        shadowRenderTime: 2.0,
        lightsRendered: 3,
        shadowsCached: 2,
        totalMemory: 1024 * 1024,
      });

      // 2.0 / 10.0 = 20%
      expect(summary).toContain('20.0%');
    });

    it('should calculate cache hit percentage', () => {
      const summary = visualizer.generatePerformanceSummary({
        frameTime: 16.67,
        shadowRenderTime: 3.0,
        lightsRendered: 4,
        shadowsCached: 6,
        totalMemory: 1024 * 1024,
      });

      // 6 / (4 + 6) = 60%
      expect(summary).toContain('60.0%');
    });
  });

  describe('Toggle Features', () => {
    it('should toggle labels', () => {
      visualizer.toggleLabels();
      visualizer.toggleLabels();

      // Should be back to original state (labels shown)
      atlas.allocate(512, 512);
      const viz = visualizer.generateAtlasVisualization(atlas);

      expect(viz.regions[0].label).not.toBe('');
    });

    it('should toggle stats', () => {
      visualizer.toggleStats();
      visualizer.toggleStats();

      // Should be back to original state (stats shown)
      const info = visualizer.generateDebugInfo(atlas);

      expect(info).not.toBe('');
    });
  });
});
