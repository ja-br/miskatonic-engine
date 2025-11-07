/**
 * Physics Replay Player
 *
 * Plays back recorded physics simulations for replay, testing, and debugging
 */

import type { PhysicsSnapshot } from './types';
import type { PhysicsWorld } from './PhysicsWorld';

/**
 * Replay player state
 */
export enum ReplayPlayerState {
  STOPPED = 'stopped',
  PLAYING = 'playing',
  PAUSED = 'paused',
  FINISHED = 'finished'
}

/**
 * Configuration for replay player
 */
export interface ReplayPlayerConfig {
  /** Whether to loop the replay when it finishes */
  loop?: boolean;
  /** Playback speed multiplier (1.0 = normal speed, 2.0 = 2x speed, 0.5 = half speed) */
  playbackSpeed?: number;
  /** Whether to auto-play when replay is loaded */
  autoPlay?: boolean;
}

const DEFAULT_CONFIG: Required<ReplayPlayerConfig> = {
  loop: false,
  playbackSpeed: 1.0,
  autoPlay: false
};

/**
 * Plays back recorded physics simulations
 *
 * Features:
 * - Variable playback speed (slow motion, fast forward)
 * - Pause/resume/stop controls
 * - Frame-by-frame stepping
 * - Seek to specific frame
 * - Loop playback
 * - Playback progress tracking
 *
 * @example
 * ```typescript
 * const replayPlayer = new PhysicsReplayPlayer(physicsWorld);
 *
 * // Load replay from file
 * const replay = JSON.parse(localStorage.getItem('savedReplay'));
 * replayPlayer.loadReplay(replay);
 *
 * // Play with 2x speed
 * replayPlayer.setPlaybackSpeed(2.0);
 * replayPlayer.play();
 *
 * // Update in game loop
 * function gameLoop() {
 *   replayPlayer.tick();
 *
 *   if (replayPlayer.getState() === ReplayPlayerState.FINISHED) {
 *     console.log('Replay finished!');
 *   }
 * }
 *
 * // Seek to frame 300
 * replayPlayer.seek(300);
 *
 * // Step forward one frame
 * replayPlayer.stepForward();
 * ```
 */
export class PhysicsReplayPlayer {
  private world: PhysicsWorld;
  private config: Required<ReplayPlayerConfig>;
  private snapshots: PhysicsSnapshot[] = [];
  private currentSnapshotIndex: number = 0;
  private state: ReplayPlayerState = ReplayPlayerState.STOPPED;
  private frameAccumulator: number = 0;

  constructor(world: PhysicsWorld, config: ReplayPlayerConfig = {}) {
    this.world = world;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Load a replay from an array of snapshots
   * @param snapshots Array of physics snapshots in chronological order
   */
  loadReplay(snapshots: PhysicsSnapshot[]): void {
    if (snapshots.length === 0) {
      throw new Error('Cannot load empty replay');
    }

    // Sort snapshots by frame to ensure chronological order
    this.snapshots = [...snapshots].sort((a, b) => a.frame - b.frame);
    this.currentSnapshotIndex = 0;
    this.state = ReplayPlayerState.STOPPED;
    this.frameAccumulator = 0;

    // Load first snapshot
    this.world.deserializeState(this.snapshots[0].state);

    if (this.config.autoPlay) {
      this.play();
    }
  }

  /**
   * Start playing the replay
   */
  play(): void {
    if (this.snapshots.length === 0) {
      throw new Error('No replay loaded');
    }

    if (this.state === ReplayPlayerState.FINISHED && !this.config.loop) {
      // Reset to beginning if replay finished
      this.seek(0);
    }

    this.state = ReplayPlayerState.PLAYING;
  }

  /**
   * Pause the replay
   */
  pause(): void {
    if (this.state === ReplayPlayerState.PLAYING) {
      this.state = ReplayPlayerState.PAUSED;
    }
  }

  /**
   * Stop the replay and reset to beginning
   */
  stop(): void {
    this.state = ReplayPlayerState.STOPPED;
    this.currentSnapshotIndex = 0;
    this.frameAccumulator = 0;

    if (this.snapshots.length > 0) {
      this.world.deserializeState(this.snapshots[0].state);
    }
  }

  /**
   * Toggle between play and pause
   */
  togglePlayPause(): void {
    if (this.state === ReplayPlayerState.PLAYING) {
      this.pause();
    } else if (this.state === ReplayPlayerState.PAUSED || this.state === ReplayPlayerState.STOPPED) {
      this.play();
    }
  }

  /**
   * Tick the replay player (call once per frame)
   * Advances replay based on playback speed
   */
  tick(): void {
    if (this.state !== ReplayPlayerState.PLAYING || this.snapshots.length === 0) {
      return;
    }

    // Accumulate frames based on playback speed
    this.frameAccumulator += this.config.playbackSpeed;

    // Advance snapshots based on accumulated frames
    while (this.frameAccumulator >= 1.0) {
      this.frameAccumulator -= 1.0;

      // Check if we reached the end
      if (this.currentSnapshotIndex >= this.snapshots.length - 1) {
        if (this.config.loop) {
          // Loop back to beginning
          this.currentSnapshotIndex = 0;
        } else {
          // Finished
          this.state = ReplayPlayerState.FINISHED;
          return;
        }
      } else {
        // Advance to next snapshot
        this.currentSnapshotIndex++;
      }

      // Apply current snapshot
      this.world.deserializeState(this.snapshots[this.currentSnapshotIndex].state);
    }
  }

  /**
   * Step forward one snapshot
   * @returns true if stepped, false if at end
   */
  stepForward(): boolean {
    if (this.snapshots.length === 0) {
      return false;
    }

    if (this.currentSnapshotIndex >= this.snapshots.length - 1) {
      return false; // At end
    }

    this.currentSnapshotIndex++;
    this.world.deserializeState(this.snapshots[this.currentSnapshotIndex].state);
    this.state = ReplayPlayerState.PAUSED;
    return true;
  }

  /**
   * Step backward one snapshot
   * @returns true if stepped, false if at beginning
   */
  stepBackward(): boolean {
    if (this.snapshots.length === 0) {
      return false;
    }

    if (this.currentSnapshotIndex <= 0) {
      return false; // At beginning
    }

    this.currentSnapshotIndex--;
    this.world.deserializeState(this.snapshots[this.currentSnapshotIndex].state);
    this.state = ReplayPlayerState.PAUSED;
    return true;
  }

  /**
   * Seek to a specific snapshot index
   * @param index Snapshot index (0-based)
   * @returns true if seek succeeded, false if index out of range
   */
  seek(index: number): boolean {
    if (this.snapshots.length === 0) {
      return false;
    }

    if (index < 0 || index >= this.snapshots.length) {
      return false;
    }

    this.currentSnapshotIndex = index;
    this.world.deserializeState(this.snapshots[index].state);
    this.frameAccumulator = 0;

    // If we were finished, change to paused
    if (this.state === ReplayPlayerState.FINISHED) {
      this.state = ReplayPlayerState.PAUSED;
    }

    return true;
  }

  /**
   * Seek to a specific frame number
   * @param frame Frame number to seek to
   * @returns true if seek succeeded, false if frame not found
   */
  seekToFrame(frame: number): boolean {
    const index = this.snapshots.findIndex(s => s.frame === frame);
    if (index === -1) {
      return false;
    }
    return this.seek(index);
  }

  /**
   * Seek by time (seconds)
   * @param time Time in seconds
   * @returns true if seek succeeded, false if time out of range
   */
  seekByTime(time: number): boolean {
    if (this.snapshots.length === 0) {
      return false;
    }

    // Find closest snapshot by time
    let closestIndex = 0;
    let closestDiff = Math.abs(this.snapshots[0].time - time);

    for (let i = 1; i < this.snapshots.length; i++) {
      const diff = Math.abs(this.snapshots[i].time - time);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      }
    }

    return this.seek(closestIndex);
  }

  /**
   * Seek by progress (0.0 to 1.0)
   * @param progress Progress value (0.0 = start, 1.0 = end)
   */
  seekByProgress(progress: number): boolean {
    if (this.snapshots.length === 0) {
      return false;
    }

    const clampedProgress = Math.max(0, Math.min(1, progress));
    // Calculate index - handles single snapshot case correctly
    const index = Math.floor(clampedProgress * Math.max(0, this.snapshots.length - 1));
    return this.seek(index);
  }

  /**
   * Get current replay state
   */
  getState(): ReplayPlayerState {
    return this.state;
  }

  /**
   * Get current snapshot index
   */
  getCurrentIndex(): number {
    return this.currentSnapshotIndex;
  }

  /**
   * Get total number of snapshots
   */
  getTotalSnapshots(): number {
    return this.snapshots.length;
  }

  /**
   * Get current playback progress (0.0 to 1.0)
   */
  getProgress(): number {
    if (this.snapshots.length <= 1) {
      return 0;
    }
    return this.currentSnapshotIndex / (this.snapshots.length - 1);
  }

  /**
   * Get current frame number
   */
  getCurrentFrame(): number {
    if (this.snapshots.length === 0 || this.currentSnapshotIndex >= this.snapshots.length) {
      return 0;
    }
    return this.snapshots[this.currentSnapshotIndex].frame;
  }

  /**
   * Get current time (seconds)
   */
  getCurrentTime(): number {
    if (this.snapshots.length === 0 || this.currentSnapshotIndex >= this.snapshots.length) {
      return 0;
    }
    return this.snapshots[this.currentSnapshotIndex].time;
  }

  /**
   * Get total replay duration (seconds)
   */
  getTotalDuration(): number {
    if (this.snapshots.length === 0) {
      return 0;
    }
    return this.snapshots[this.snapshots.length - 1].time - this.snapshots[0].time;
  }

  /**
   * Set playback speed
   * @param speed Speed multiplier (1.0 = normal, 2.0 = 2x, 0.5 = half speed)
   */
  setPlaybackSpeed(speed: number): void {
    if (speed <= 0) {
      throw new Error('Playback speed must be positive');
    }
    this.config.playbackSpeed = speed;
  }

  /**
   * Get current playback speed
   */
  getPlaybackSpeed(): number {
    return this.config.playbackSpeed;
  }

  /**
   * Set loop mode
   * @param loop Whether to loop the replay
   */
  setLoop(loop: boolean): void {
    this.config.loop = loop;
  }

  /**
   * Check if loop mode is enabled
   */
  isLooping(): boolean {
    return this.config.loop;
  }

  /**
   * Check if replay is loaded
   */
  hasReplay(): boolean {
    return this.snapshots.length > 0;
  }

  /**
   * Check if replay is playing
   */
  isPlaying(): boolean {
    return this.state === ReplayPlayerState.PLAYING;
  }

  /**
   * Check if replay is paused
   */
  isPaused(): boolean {
    return this.state === ReplayPlayerState.PAUSED;
  }

  /**
   * Check if replay is finished
   */
  isFinished(): boolean {
    return this.state === ReplayPlayerState.FINISHED;
  }

  /**
   * Unload the current replay
   */
  unload(): void {
    this.snapshots = [];
    this.currentSnapshotIndex = 0;
    this.state = ReplayPlayerState.STOPPED;
    this.frameAccumulator = 0;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ReplayPlayerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<ReplayPlayerConfig>> {
    return { ...this.config };
  }
}
