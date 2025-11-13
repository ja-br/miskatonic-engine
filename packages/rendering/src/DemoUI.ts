/**
 * Demo UI Overlay - Epic 3.18 Phase 5
 *
 * Lightweight HTML overlay for demo controls and performance metrics.
 * Creates DOM elements dynamically for quality tier selector, debug mode selector,
 * and performance overlay (FPS, GPU timings).
 */

import { DebugVisualizationMode } from './shadows/ShadowDebugVisualizer';

/**
 * Quality tier configuration
 */
export type QualityTier = 'low' | 'medium' | 'high';

/**
 * Performance metrics for display
 */
export interface DemoPerformanceMetrics {
  fps: number;
  frameTime: number;
  gpuTime: number;
  shadowRenderTime: number;
  lightCullingTime: number;
  lightingPassTime: number;
  memoryUsage: number;
  drawCalls: number;
  triangles: number;
  bufferCount: number;
  textureCount: number;
  instanceGroups: number;
  instancedObjects: number;
  lightCount: number;
  shadowCastingLights: number;
  visibleLights: number;
  bodies: number;
  joints: number;
}

/**
 * UI event handlers
 */
export interface DemoUICallbacks {
  onQualityChange: (tier: QualityTier) => void;
  onDebugModeChange: (mode: DebugVisualizationMode) => void;
  onDebugCycle: () => void;
}

/**
 * Demo UI Manager
 *
 * Creates and manages HTML overlay for demo controls and performance display.
 * Uses minimal DOM manipulation for lightweight integration.
 */
export class DemoUI {
  private container: HTMLDivElement;
  private controlPanel: HTMLDivElement;
  private performanceOverlay: HTMLDivElement;
  private callbacks: DemoUICallbacks;
  private mounted: boolean = false;

  constructor(callbacks: DemoUICallbacks) {
    this.callbacks = callbacks;
    this.container = this.createContainer();
    this.controlPanel = this.createControlPanel();
    this.performanceOverlay = this.createPerformanceOverlay();
  }

  /**
   * Create root container
   */
  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'demo-ui-container';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #fff;
    `;
    return container;
  }

  /**
   * Create control panel (top-left corner)
   */
  private createControlPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.id = 'demo-control-panel';
    panel.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.7);
      padding: 15px;
      border-radius: 5px;
      pointer-events: auto;
      min-width: 220px;
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = 'Lighting Demo Controls';
    title.style.cssText = `
      font-weight: bold;
      margin-bottom: 10px;
      border-bottom: 1px solid #666;
      padding-bottom: 5px;
    `;
    panel.appendChild(title);

    // Quality tier selector
    const qualityLabel = document.createElement('div');
    qualityLabel.textContent = 'Quality Tier:';
    qualityLabel.style.marginTop = '10px';
    qualityLabel.style.marginBottom = '5px';
    panel.appendChild(qualityLabel);

    const qualitySelect = document.createElement('select');
    qualitySelect.id = 'quality-tier-select';
    qualitySelect.style.cssText = `
      width: 100%;
      padding: 5px;
      background: #333;
      color: #fff;
      border: 1px solid #666;
      border-radius: 3px;
      cursor: pointer;
    `;
    qualitySelect.innerHTML = `
      <option value="low">LOW (4MB, 512px)</option>
      <option value="medium" selected>MEDIUM (16MB, 1024px)</option>
      <option value="high">HIGH (64MB, 2048px)</option>
    `;
    qualitySelect.addEventListener('change', (e) => {
      this.callbacks.onQualityChange((e.target as HTMLSelectElement).value as QualityTier);
    });
    panel.appendChild(qualitySelect);

    // Debug mode selector
    const debugLabel = document.createElement('div');
    debugLabel.textContent = 'Debug Mode:';
    debugLabel.style.marginTop = '15px';
    debugLabel.style.marginBottom = '5px';
    panel.appendChild(debugLabel);

    const debugSelect = document.createElement('select');
    debugSelect.id = 'debug-mode-select';
    debugSelect.style.cssText = `
      width: 100%;
      padding: 5px;
      background: #333;
      color: #fff;
      border: 1px solid #666;
      border-radius: 3px;
      cursor: pointer;
    `;
    debugSelect.innerHTML = `
      <option value="${DebugVisualizationMode.NONE}" selected>None</option>
      <option value="${DebugVisualizationMode.ATLAS}">Shadow Atlas</option>
      <option value="${DebugVisualizationMode.CASCADE_FRUSTUMS}">Cascade Frustums</option>
      <option value="${DebugVisualizationMode.LIGHT_VOLUMES}">Light Volumes</option>
      <option value="${DebugVisualizationMode.TILE_HEATMAP}">Tile Heatmap</option>
      <option value="${DebugVisualizationMode.DEPTH_MAP}">Depth Buffer</option>
      <option value="${DebugVisualizationMode.PERFORMANCE_OVERLAY}">Performance Overlay</option>
    `;
    debugSelect.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      this.callbacks.onDebugModeChange(value as DebugVisualizationMode);
    });
    panel.appendChild(debugSelect);

    // Keyboard hints
    const hints = document.createElement('div');
    hints.style.cssText = `
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px solid #666;
      font-size: 12px;
      color: #aaa;
    `;
    hints.innerHTML = `
      <div>F3: Cycle debug mode</div>
      <div>Mouse: Rotate camera</div>
      <div>Wheel: Zoom camera</div>
    `;
    panel.appendChild(hints);

    return panel;
  }

  /**
   * Create performance overlay (top-right corner)
   */
  private createPerformanceOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'demo-performance-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      padding: 15px;
      border-radius: 5px;
      pointer-events: none;
      min-width: 200px;
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = 'Performance Metrics';
    title.style.cssText = `
      font-weight: bold;
      margin-bottom: 10px;
      border-bottom: 1px solid #666;
      padding-bottom: 5px;
    `;
    overlay.appendChild(title);

    // Metrics container
    const metrics = document.createElement('div');
    metrics.id = 'performance-metrics';
    metrics.style.cssText = `
      font-size: 12px;
      line-height: 1.6;
    `;
    overlay.appendChild(metrics);

    return overlay;
  }

  /**
   * Mount UI to DOM
   */
  mount(): void {
    if (this.mounted) return;

    this.container.appendChild(this.controlPanel);
    this.container.appendChild(this.performanceOverlay);
    document.body.appendChild(this.container);
    this.mounted = true;

    // Add keyboard listener for F3 (cycle debug mode)
    document.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * Unmount UI from DOM
   */
  unmount(): void {
    if (!this.mounted) return;

    document.body.removeChild(this.container);
    this.mounted = false;

    document.removeEventListener('keydown', this.handleKeyDown);
  }

  /**
   * Handle keyboard input
   */
  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'F3') {
      e.preventDefault();
      this.callbacks.onDebugCycle();
      // Update select to match new mode (will be called via updateDebugMode)
    }
  };

  /**
   * Update quality tier display
   */
  updateQualityTier(tier: QualityTier): void {
    const select = document.getElementById('quality-tier-select') as HTMLSelectElement;
    if (select) {
      select.value = tier;
    }
  }

  /**
   * Update debug mode display
   */
  updateDebugMode(mode: DebugVisualizationMode): void {
    const select = document.getElementById('debug-mode-select') as HTMLSelectElement;
    if (select) {
      select.value = mode;
    }
  }

  /**
   * Update performance metrics display
   */
  updatePerformanceMetrics(metrics: DemoPerformanceMetrics): void {
    const container = document.getElementById('performance-metrics');
    if (!container) return;

    // Color-code FPS based on target
    let fpsColor = '#0f0'; // Green for good
    if (metrics.fps < 30) fpsColor = '#f00'; // Red for critical
    else if (metrics.fps < 60) fpsColor = '#fa0'; // Orange for warning

    container.innerHTML = `
      <div style="color: ${fpsColor}; font-weight: bold;">
        FPS: ${metrics.fps.toFixed(1)}
      </div>
      <div>Frame: ${metrics.frameTime.toFixed(2)}ms</div>
      <div>GPU Total: ${metrics.gpuTime.toFixed(2)}ms</div>
      <div style="margin-left: 10px;">
        Shadow: ${metrics.shadowRenderTime.toFixed(2)}ms
      </div>
      <div style="margin-left: 10px;">
        Culling: ${metrics.lightCullingTime.toFixed(2)}ms
      </div>
      <div style="margin-left: 10px;">
        Lighting: ${metrics.lightingPassTime.toFixed(2)}ms
      </div>
      <div style="margin-top: 5px; border-top: 1px solid #666; padding-top: 5px;">
        VRAM: ${metrics.memoryUsage.toFixed(0)}MB
      </div>
      <div style="margin-top: 5px; border-top: 1px solid #666; padding-top: 5px;">
        Draw Calls: ${metrics.drawCalls}
      </div>
      <div>Triangles: ${metrics.triangles.toLocaleString()}</div>
      <div>Buffers: ${metrics.bufferCount}</div>
      <div>Textures: ${metrics.textureCount}</div>
      ${metrics.instanceGroups > 0 ? `<div>Instanced Groups: ${metrics.instanceGroups}</div>` : ''}
      ${metrics.instancedObjects > 0 ? `<div>Instanced Objects: ${metrics.instancedObjects}</div>` : ''}
      <div style="margin-top: 5px; border-top: 1px solid #666; padding-top: 5px;">
        Lights: ${metrics.lightCount} (${metrics.shadowCastingLights} shadow, ${metrics.visibleLights} visible)
      </div>
      ${metrics.bodies > 0 ? `<div style="margin-top: 5px; border-top: 1px solid #666; padding-top: 5px;">Physics Bodies: ${metrics.bodies}</div>` : ''}
      ${metrics.joints > 0 ? `<div>Joints: ${metrics.joints}</div>` : ''}
    `;
  }

  /**
   * Show/hide control panel
   */
  setControlPanelVisible(visible: boolean): void {
    this.controlPanel.style.display = visible ? 'block' : 'none';
  }

  /**
   * Show/hide performance overlay
   */
  setPerformanceOverlayVisible(visible: boolean): void {
    this.performanceOverlay.style.display = visible ? 'block' : 'none';
  }
}
