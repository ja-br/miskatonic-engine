/**
 * Performance Baseline Measurement for Epic 3.14
 *
 * Captures current rendering performance before API refactoring.
 * Used to detect regressions during implementation.
 */

export interface PerformanceMetrics {
  frameTime: number;        // Average frame time in ms
  drawCalls: number;        // Draw calls per frame
  bufferUpdates: number;    // Buffer updates per frame
  shaderSwitches: number;   // Shader program changes per frame
  timestamp: number;        // When measurement was taken
}

export class PerformanceBaseline {
  private metrics: PerformanceMetrics[] = [];
  private frameCount = 0;
  private startTime = 0;

  /**
   * Start measuring performance
   */
  start(): void {
    this.metrics = [];
    this.frameCount = 0;
    this.startTime = performance.now();
  }

  /**
   * Record a frame's metrics
   */
  recordFrame(metrics: Omit<PerformanceMetrics, 'timestamp'>): void {
    this.metrics.push({
      ...metrics,
      timestamp: performance.now(),
    });
    this.frameCount++;
  }

  /**
   * Get average metrics over all recorded frames
   */
  getAverage(): PerformanceMetrics | null {
    if (this.metrics.length === 0) return null;

    const sum = this.metrics.reduce(
      (acc, m) => ({
        frameTime: acc.frameTime + m.frameTime,
        drawCalls: acc.drawCalls + m.drawCalls,
        bufferUpdates: acc.bufferUpdates + m.bufferUpdates,
        shaderSwitches: acc.shaderSwitches + m.shaderSwitches,
        timestamp: 0,
      }),
      { frameTime: 0, drawCalls: 0, bufferUpdates: 0, shaderSwitches: 0, timestamp: 0 }
    );

    return {
      frameTime: sum.frameTime / this.metrics.length,
      drawCalls: sum.drawCalls / this.metrics.length,
      bufferUpdates: sum.bufferUpdates / this.metrics.length,
      shaderSwitches: sum.shaderSwitches / this.metrics.length,
      timestamp: this.startTime,
    };
  }

  /**
   * Compare current performance against baseline
   * Returns percentage change (negative = improvement, positive = regression)
   */
  compare(baseline: PerformanceMetrics, current: PerformanceMetrics): {
    frameTimeChange: number;
    drawCallsChange: number;
    bufferUpdatesChange: number;
    shaderSwitchesChange: number;
  } {
    return {
      frameTimeChange: ((current.frameTime - baseline.frameTime) / baseline.frameTime) * 100,
      drawCallsChange: ((current.drawCalls - baseline.drawCalls) / baseline.drawCalls) * 100,
      bufferUpdatesChange: ((current.bufferUpdates - baseline.bufferUpdates) / baseline.bufferUpdates) * 100,
      shaderSwitchesChange: ((current.shaderSwitches - baseline.shaderSwitches) / baseline.shaderSwitches) * 100,
    };
  }

  /**
   * Export baseline to JSON
   */
  export(): string {
    return JSON.stringify({
      average: this.getAverage(),
      frameCount: this.frameCount,
      samples: this.metrics,
    }, null, 2);
  }
}

// Global baseline instance
export const performanceBaseline = new PerformanceBaseline();
