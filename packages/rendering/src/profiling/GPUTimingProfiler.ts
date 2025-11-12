/**
 * GPU Timing Profiler - Epic 3.18 Phase 1
 *
 * Provides accurate GPU timing using WebGPU timestamp queries.
 * Falls back to CPU timing when timestamps are unavailable.
 */

/**
 * Timing measurement for a single operation
 */
export interface TimingMeasurement {
  /** Name of the measured operation */
  name: string;
  /** GPU time in milliseconds (or CPU estimate if GPU unavailable) */
  gpuTime: number;
  /** CPU time in milliseconds */
  cpuTime: number;
  /** Frame number when measured */
  frameNumber: number;
  /** Timestamp when measurement was taken */
  timestamp: number;
}

/**
 * Aggregated timing statistics over multiple frames
 */
export interface TimingStatistics {
  /** Operation name */
  name: string;
  /** Average GPU time (ms) */
  avgGpuTime: number;
  /** Minimum GPU time (ms) */
  minGpuTime: number;
  /** Maximum GPU time (ms) */
  maxGpuTime: number;
  /** Average CPU time (ms) */
  avgCpuTime: number;
  /** Number of samples */
  sampleCount: number;
  /** Standard deviation of GPU time */
  stdDevGpuTime: number;
}

/**
 * Configuration for GPU timing profiler
 */
export interface GPUTimingConfig {
  /** Enable GPU timestamp queries (requires 'timestamp-query' feature) */
  enableTimestamps?: boolean;
  /** Number of frames to average (default: 60) */
  frameAverageCount?: number;
  /** Maximum number of concurrent timing queries (default: 32) */
  maxConcurrentQueries?: number;
}

/**
 * GPU Timing Profiler
 *
 * Measures GPU and CPU timing for rendering operations using WebGPU
 * timestamp queries. Automatically falls back to CPU timing when
 * timestamp queries are unavailable.
 *
 * @example
 * ```typescript
 * const profiler = new GPUTimingProfiler(device, { frameAverageCount: 60 });
 *
 * // Begin timing
 * profiler.begin('shadowPass', commandEncoder);
 *
 * // ... render shadows ...
 *
 * // End timing
 * profiler.end('shadowPass', commandEncoder);
 *
 * // Get statistics after frame
 * profiler.resolveFrame();
 * const stats = profiler.getStatistics('shadowPass');
 * console.log(`Shadow pass: ${stats.avgGpuTime.toFixed(2)}ms`);
 * ```
 */
export class GPUTimingProfiler {
  private device: GPUDevice;
  private config: Required<GPUTimingConfig>;

  private timestampsSupported: boolean;
  private querySet: GPUQuerySet | null = null;
  private resolveBuffer: GPUBuffer | null = null;
  private readbackBuffer: GPUBuffer | null = null;

  private activeQueries: Map<string, number> = new Map();
  private queryIndex = 0;
  private frameNumber = 0;
  private resolving = false; // Prevent concurrent resolveFrame() calls

  private measurements: TimingMeasurement[] = [];
  private cpuStartTimes: Map<string, number> = new Map();

  /**
   * Create GPU timing profiler
   *
   * @param device - WebGPU device
   * @param config - Profiler configuration
   */
  constructor(device: GPUDevice, config: GPUTimingConfig = {}) {
    this.device = device;
    this.config = {
      enableTimestamps: config.enableTimestamps ?? true,
      frameAverageCount: config.frameAverageCount ?? 60,
      maxConcurrentQueries: config.maxConcurrentQueries ?? 32,
    };

    // Check for timestamp query support
    this.timestampsSupported =
      this.config.enableTimestamps &&
      device.features.has('timestamp-query');

    if (this.timestampsSupported) {
      this.initializeTimestampQueries();
    }
  }

  /**
   * Initialize timestamp query resources
   */
  private initializeTimestampQueries(): void {
    if (!this.timestampsSupported) return;

    // Create query set (pairs of begin/end timestamps)
    this.querySet = this.device.createQuerySet({
      type: 'timestamp',
      count: this.config.maxConcurrentQueries * 2,
    });

    // Create resolve buffer (timestamp results)
    this.resolveBuffer = this.device.createBuffer({
      size: this.config.maxConcurrentQueries * 2 * 8, // 8 bytes per timestamp
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });

    // Create readback buffer (CPU-accessible)
    this.readbackBuffer = this.device.createBuffer({
      size: this.config.maxConcurrentQueries * 2 * 8,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
  }

  /**
   * Begin timing an operation
   *
   * @param name - Operation name
   * @param encoder - Command encoder to insert timestamp query
   */
  begin(name: string, encoder?: GPUCommandEncoder): void {
    // Record CPU start time
    this.cpuStartTimes.set(name, performance.now());

    // Insert GPU timestamp if supported
    if (this.timestampsSupported && encoder && this.querySet) {
      if (this.queryIndex >= this.config.maxConcurrentQueries) {
        // CRITICAL FIX #1: Clean up CPU start time to prevent memory leak
        this.cpuStartTimes.delete(name);
        console.warn(
          `GPUTimingProfiler: Max concurrent queries (${this.config.maxConcurrentQueries}) exceeded`
        );
        return;
      }

      const queryIdx = this.queryIndex * 2; // Begin timestamp

      // CRITICAL FIX #3: Validate query index is within bounds
      if (queryIdx + 1 >= this.config.maxConcurrentQueries * 2) {
        this.cpuStartTimes.delete(name);
        throw new Error(
          `Query index out of bounds: ${queryIdx} (max: ${this.config.maxConcurrentQueries * 2})`
        );
      }

      encoder.writeTimestamp(this.querySet, queryIdx);
      this.activeQueries.set(name, this.queryIndex);
      this.queryIndex++;
    }
  }

  /**
   * End timing an operation
   *
   * @param name - Operation name (must match begin() call)
   * @param encoder - Command encoder to insert timestamp query
   */
  end(name: string, encoder?: GPUCommandEncoder): void {
    // Calculate CPU time
    const cpuStartTime = this.cpuStartTimes.get(name);
    if (cpuStartTime === undefined) {
      console.warn(`GPUTimingProfiler: No matching begin() for "${name}"`);
      return;
    }

    const cpuTime = performance.now() - cpuStartTime;
    this.cpuStartTimes.delete(name);

    // Insert GPU timestamp if supported
    if (this.timestampsSupported && encoder && this.querySet) {
      const queryIndex = this.activeQueries.get(name);
      if (queryIndex === undefined) {
        // CRITICAL FIX #6: Store CPU-only measurement when GPU query missing
        console.warn(
          `GPUTimingProfiler: No GPU query for "${name}", using CPU fallback`
        );
        this.measurements.push({
          name,
          gpuTime: cpuTime, // CPU fallback
          cpuTime,
          frameNumber: this.frameNumber,
          timestamp: Date.now(),
        });
        return;
      }

      const queryIdx = queryIndex * 2 + 1; // End timestamp
      encoder.writeTimestamp(this.querySet, queryIdx);

      // Store measurement (GPU time will be filled in during resolve)
      this.measurements.push({
        name,
        gpuTime: 0, // Filled in by resolveFrame()
        cpuTime,
        frameNumber: this.frameNumber,
        timestamp: Date.now(),
      });
    } else {
      // Fallback: Use CPU time as GPU estimate
      this.measurements.push({
        name,
        gpuTime: cpuTime, // CPU fallback
        cpuTime,
        frameNumber: this.frameNumber,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Resolve timestamp queries and update measurements
   *
   * Must be called after submitting command buffer and before
   * accessing statistics. Performs async GPU readback.
   *
   * @returns Promise that resolves when timing data is available
   */
  async resolveFrame(): Promise<void> {
    // CRITICAL FIX #2: Prevent concurrent resolveFrame() calls
    if (this.resolving) {
      throw new Error(
        'GPUTimingProfiler.resolveFrame() called while previous resolve in progress'
      );
    }
    this.resolving = true;

    try {
      if (!this.timestampsSupported || this.queryIndex === 0) {
        // No GPU queries, just increment frame
        this.frameNumber++;
        this.queryIndex = 0;
        this.activeQueries.clear();
        this.pruneOldMeasurements(); // Still prune old measurements
        return;
      }

      // Create command encoder for resolving queries
      const encoder = this.device.createCommandEncoder();

    // Resolve query set to buffer
    encoder.resolveQuerySet(
      this.querySet!,
      0, // First query
      this.queryIndex * 2, // Query count (begin + end for each)
      this.resolveBuffer!,
      0 // Destination offset
    );

    // Copy to readback buffer
    encoder.copyBufferToBuffer(
      this.resolveBuffer!,
      0,
      this.readbackBuffer!,
      0,
      this.queryIndex * 2 * 8
    );

      this.device.queue.submit([encoder.finish()]);

      // Read back timestamp data
      await this.readbackBuffer!.mapAsync(GPUMapMode.READ);

      // CRITICAL FIX #4: Ensure buffer is unmapped even if error occurs
      try {
        const timestamps = new BigUint64Array(
          this.readbackBuffer!.getMappedRange(0, this.queryIndex * 2 * 8)
        );

        // Update measurements with GPU times
        const recentMeasurements = this.measurements.filter(
          (m) => m.frameNumber === this.frameNumber && m.gpuTime === 0
        );

        // CRITICAL FIX #5: Use O(1) Map lookup instead of O(n×m²) Array.find()
        for (const measurement of recentMeasurements) {
          const queryIndex = this.activeQueries.get(measurement.name);

          if (queryIndex !== undefined) {
            const beginTimestamp = timestamps[queryIndex * 2];
            const endTimestamp = timestamps[queryIndex * 2 + 1];

            // Convert nanoseconds to milliseconds
            measurement.gpuTime =
              Number(endTimestamp - beginTimestamp) / 1_000_000;
          }
        }
      } finally {
        this.readbackBuffer!.unmap();
      }

      // Advance to next frame
      this.frameNumber++;
      this.queryIndex = 0;
      this.activeQueries.clear();

      // Prune old measurements
      this.pruneOldMeasurements();
    } finally {
      // CRITICAL FIX #2: Always clear resolving flag
      this.resolving = false;
    }
  }

  /**
   * Remove measurements older than frameAverageCount
   */
  private pruneOldMeasurements(): void {
    const cutoffFrame = this.frameNumber - this.config.frameAverageCount;
    this.measurements = this.measurements.filter(
      (m) => m.frameNumber > cutoffFrame
    );
  }

  /**
   * Get timing statistics for an operation
   *
   * @param name - Operation name
   * @returns Statistics over recent frames, or null if no data
   */
  getStatistics(name: string): TimingStatistics | null {
    const samples = this.measurements.filter((m) => m.name === name);
    if (samples.length === 0) return null;

    const gpuTimes = samples.map((s) => s.gpuTime);
    const cpuTimes = samples.map((s) => s.cpuTime);

    const avgGpuTime = gpuTimes.reduce((a, b) => a + b, 0) / gpuTimes.length;
    const avgCpuTime = cpuTimes.reduce((a, b) => a + b, 0) / cpuTimes.length;

    const minGpuTime = Math.min(...gpuTimes);
    const maxGpuTime = Math.max(...gpuTimes);

    // Calculate standard deviation
    const variance =
      gpuTimes.reduce((sum, t) => sum + Math.pow(t - avgGpuTime, 2), 0) /
      gpuTimes.length;
    const stdDevGpuTime = Math.sqrt(variance);

    return {
      name,
      avgGpuTime,
      minGpuTime,
      maxGpuTime,
      avgCpuTime,
      sampleCount: samples.length,
      stdDevGpuTime,
    };
  }

  /**
   * Get statistics for all operations
   *
   * @returns Array of statistics for all tracked operations
   */
  getAllStatistics(): TimingStatistics[] {
    const names = new Set(this.measurements.map((m) => m.name));
    const stats: TimingStatistics[] = [];

    for (const name of names) {
      const stat = this.getStatistics(name);
      if (stat) stats.push(stat);
    }

    return stats.sort((a, b) => b.avgGpuTime - a.avgGpuTime);
  }

  /**
   * Get total GPU time across all operations for current frame
   *
   * @returns Total GPU time in milliseconds
   */
  getTotalGpuTime(): number {
    const frameMeasurements = this.measurements.filter(
      (m) => m.frameNumber === this.frameNumber - 1
    );

    return frameMeasurements.reduce((sum, m) => sum + m.gpuTime, 0);
  }

  /**
   * Check if timestamp queries are supported and enabled
   */
  isTimestampSupported(): boolean {
    return this.timestampsSupported;
  }

  /**
   * Get current frame number
   */
  getFrameNumber(): number {
    return this.frameNumber;
  }

  /**
   * Create a command encoder for recording GPU commands
   *
   * @returns Command encoder
   */
  createCommandEncoder(): GPUCommandEncoder {
    return this.device.createCommandEncoder();
  }

  /**
   * Submit command encoder and resolve timing queries
   *
   * @param encoder - Command encoder to submit
   * @returns Promise that resolves when timing data is available
   */
  async submitAndResolve(encoder: GPUCommandEncoder): Promise<void> {
    this.device.queue.submit([encoder.finish()]);
    await this.resolveFrame();
  }

  /**
   * Reset all measurements and statistics
   */
  reset(): void {
    this.measurements = [];
    this.cpuStartTimes.clear();
    this.activeQueries.clear();
    this.queryIndex = 0;
    this.frameNumber = 0;
  }

  /**
   * Clean up GPU resources
   */
  destroy(): void {
    this.querySet?.destroy();
    this.resolveBuffer?.destroy();
    this.readbackBuffer?.destroy();

    this.querySet = null;
    this.resolveBuffer = null;
    this.readbackBuffer = null;

    this.measurements = [];
    this.cpuStartTimes.clear();
    this.activeQueries.clear();
  }
}
