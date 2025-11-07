/**
 * Physics Snapshot Manager
 *
 * Manages physics state snapshots for replay, rollback, and network synchronization
 */

import type { PhysicsSnapshot, SerializedPhysicsState } from './types';
import type { PhysicsWorld } from './PhysicsWorld';

/**
 * Configuration for snapshot manager
 */
export interface SnapshotManagerConfig {
  /** Maximum number of snapshots to keep in history */
  maxSnapshots?: number;
  /** Snapshot interval in frames (1 = every frame, 60 = once per second at 60fps) */
  snapshotInterval?: number;
  /** Enable automatic snapshot capture during simulation */
  autoCapture?: boolean;
}

const DEFAULT_CONFIG: Required<SnapshotManagerConfig> = {
  maxSnapshots: 300, // 5 seconds at 60 FPS
  snapshotInterval: 1, // Every frame by default
  autoCapture: true
};

/**
 * Manages physics state snapshots for deterministic replay and rollback
 *
 * Features:
 * - Automatic snapshot capture at configurable intervals
 * - Fixed-size circular buffer for memory efficiency
 * - Rollback to any previous snapshot
 * - Export/import snapshot history for replay
 *
 * @example
 * ```typescript
 * const snapshotManager = new PhysicsSnapshotManager(physicsWorld, {
 *   maxSnapshots: 600, // 10 seconds at 60 FPS
 *   snapshotInterval: 1 // Every frame
 * });
 *
 * // Capture snapshots automatically during simulation
 * function gameLoop(deltaTime: number) {
 *   physicsWorld.step(deltaTime);
 *   snapshotManager.tick(); // Capture snapshot if interval reached
 * }
 *
 * // Rollback 60 frames (1 second)
 * snapshotManager.rollback(60);
 *
 * // Save replay to file
 * const replay = snapshotManager.exportReplay();
 * localStorage.setItem('replay', JSON.stringify(replay));
 * ```
 */
export class PhysicsSnapshotManager {
  private world: PhysicsWorld;
  private config: Required<SnapshotManagerConfig>;
  private snapshots: PhysicsSnapshot[] = [];
  private currentFrame: number = 0;
  private framesSinceLastSnapshot: number = 0;

  constructor(world: PhysicsWorld, config: SnapshotManagerConfig = {}) {
    this.world = world;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Tick the snapshot manager (call once per frame)
   * Automatically captures snapshots based on configuration
   */
  tick(): void {
    this.currentFrame++;
    this.framesSinceLastSnapshot++;

    if (this.config.autoCapture && this.framesSinceLastSnapshot >= this.config.snapshotInterval) {
      this.captureSnapshot();
      this.framesSinceLastSnapshot = 0;
    }
  }

  /**
   * Manually capture a snapshot of the current physics state
   * @returns The captured snapshot
   */
  captureSnapshot(): PhysicsSnapshot {
    const state = this.world.serializeState();
    const snapshot: PhysicsSnapshot = {
      frame: this.currentFrame,
      time: state.time,
      state
    };

    // Add to circular buffer
    this.snapshots.push(snapshot);

    // Remove oldest snapshot if we exceed max
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * Get a snapshot by frame number
   * @param frame Frame number (absolute, not relative)
   * @returns Snapshot if found, null otherwise
   */
  getSnapshot(frame: number): PhysicsSnapshot | null {
    return this.snapshots.find(s => s.frame === frame) || null;
  }

  /**
   * Get the most recent snapshot
   * @returns Latest snapshot, or null if no snapshots exist
   */
  getLatestSnapshot(): PhysicsSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  /**
   * Get the oldest snapshot in history
   * @returns Oldest snapshot, or null if no snapshots exist
   */
  getOldestSnapshot(): PhysicsSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[0] : null;
  }

  /**
   * Rollback simulation to a previous frame
   * @param framesToRollback Number of frames to roll back (relative to current frame)
   * @returns true if rollback succeeded, false if snapshot not found
   */
  rollback(framesToRollback: number): boolean {
    const targetFrame = this.currentFrame - framesToRollback;
    return this.rollbackToFrame(targetFrame);
  }

  /**
   * Rollback simulation to a specific frame
   * @param targetFrame Frame number to roll back to (absolute)
   * @returns true if rollback succeeded, false if snapshot not found
   */
  rollbackToFrame(targetFrame: number): boolean {
    const snapshot = this.getSnapshot(targetFrame);
    if (!snapshot) {
      return false;
    }

    this.world.deserializeState(snapshot.state);
    this.currentFrame = targetFrame;

    // Remove all snapshots after the target frame
    this.snapshots = this.snapshots.filter(s => s.frame <= targetFrame);

    return true;
  }

  /**
   * Rollback to the most recent snapshot
   * @returns true if rollback succeeded, false if no snapshots exist
   */
  rollbackToLatest(): boolean {
    const latest = this.getLatestSnapshot();
    if (!latest) {
      return false;
    }

    this.world.deserializeState(latest.state);
    this.currentFrame = latest.frame;
    return true;
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots = [];
    this.currentFrame = 0;
    this.framesSinceLastSnapshot = 0;
  }

  /**
   * Export all snapshots for replay
   * @returns Array of all snapshots in chronological order
   */
  exportReplay(): PhysicsSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Import snapshots from a replay
   * @param replay Array of snapshots to import
   */
  importReplay(replay: PhysicsSnapshot[]): void {
    this.snapshots = [...replay];
    if (replay.length > 0) {
      const latest = replay[replay.length - 1];
      this.currentFrame = latest.frame;
    }
  }

  /**
   * Get current frame number
   */
  getCurrentFrame(): number {
    return this.currentFrame;
  }

  /**
   * Get number of snapshots currently stored
   */
  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  /**
   * Get frame range of available snapshots
   * @returns [oldestFrame, newestFrame] or null if no snapshots
   */
  getFrameRange(): [number, number] | null {
    if (this.snapshots.length === 0) {
      return null;
    }
    return [this.snapshots[0].frame, this.snapshots[this.snapshots.length - 1].frame];
  }

  /**
   * Check if a specific frame is available for rollback
   * @param frame Frame number to check
   * @returns true if snapshot exists for that frame
   */
  hasSnapshot(frame: number): boolean {
    return this.snapshots.some(s => s.frame === frame);
  }

  /**
   * Update configuration
   * @param config New configuration (partial)
   */
  setConfig(config: Partial<SnapshotManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<SnapshotManagerConfig>> {
    return { ...this.config };
  }
}
