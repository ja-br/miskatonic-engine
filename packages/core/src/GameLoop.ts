/**
 * Game Loop Architecture
 *
 * Implements a phase-based game loop with:
 * - Fixed timestep for physics (deterministic)
 * - Variable timestep for rendering (smooth)
 * - Accumulator pattern for frame time handling
 * - Spiral of death protection
 * - Frame pacing with requestAnimationFrame
 */

import type { SystemRegistration } from './types';

/**
 * System execution phases
 *
 * Systems execute in this order every frame:
 * PRE_UPDATE → UPDATE → POST_UPDATE → PHYSICS → RENDER
 */
export enum SystemPhase {
  /** Early update - spawning, despawning, input handling */
  PRE_UPDATE = 0,
  /** Main game logic - AI, gameplay systems */
  UPDATE = 1,
  /** Late update - camera follow, final transforms */
  POST_UPDATE = 2,
  /** Physics simulation - handled internally by PhysicsWorld */
  PHYSICS = 3,
  /** Rendering preparation - culling, sorting, draw calls */
  RENDER = 4,
}

/**
 * Extended system registration with phase information
 */
export interface PhaseSystem extends SystemRegistration {
  /** Which phase this system executes in */
  phase: SystemPhase;
  /** Time budget in milliseconds */
  budget?: number;
}

/**
 * Frame timing statistics
 */
export interface FrameStats {
  /** Current FPS */
  fps: number;
  /** Frame time in ms */
  frameTime: number;
  /** Average frame time over last 60 frames */
  averageFrameTime: number;
  /** Physics update count this frame */
  physicsSteps: number;
  /** Total frames rendered */
  totalFrames: number;
  /** Total time elapsed in seconds */
  totalTime: number;
}

/**
 * Game loop configuration
 */
export interface GameLoopConfig {
  /** Target frames per second (default: 60) */
  targetFPS: number;
  /** Fixed timestep for physics in seconds (default: 1/60) */
  fixedTimestep: number;
  /** Maximum delta time in seconds to prevent spiral of death (default: 0.1) */
  maxDeltaTime: number;
  /** Maximum physics substeps per frame (default: 4) */
  maxSubsteps: number;
}

/**
 * Default game loop configuration
 */
export const DEFAULT_GAME_LOOP_CONFIG: GameLoopConfig = {
  targetFPS: 60,
  fixedTimestep: 1 / 60, // 16.67ms
  maxDeltaTime: 0.1, // 100ms max
  maxSubsteps: 4,
};

/**
 * Game Loop
 *
 * Manages the main game loop with phase-based system execution.
 *
 * Features:
 * - Fixed timestep physics via accumulator pattern
 * - Variable timestep rendering for smooth visuals
 * - Frame pacing with requestAnimationFrame
 * - Spiral of death protection
 * - Per-phase system execution
 *
 * Usage:
 * ```typescript
 * const loop = new GameLoop(config);
 * loop.registerSystem(movementSystem);
 * loop.registerPhysicsCallback((dt) => physicsWorld.step(dt));
 * loop.start();
 * ```
 */
export class GameLoop {
  private config: GameLoopConfig;
  private systems: Map<SystemPhase, PhaseSystem[]> = new Map();
  private running = false;
  private animationFrameId: number | null = null;

  // Timing
  private accumulator = 0;
  private lastFrameTime = 0;
  private deltaTimeHistory: number[] = new Array(60).fill(16.67);
  private historyIndex = 0;

  // Stats
  private stats: FrameStats = {
    fps: 60,
    frameTime: 16.67,
    averageFrameTime: 16.67,
    physicsSteps: 0,
    totalFrames: 0,
    totalTime: 0,
  };

  // Physics callback
  private physicsCallback: ((deltaTime: number) => void) | null = null;

  // Render callback
  private renderCallback: ((alpha: number) => void) | null = null;

  constructor(config: Partial<GameLoopConfig> = {}) {
    this.config = { ...DEFAULT_GAME_LOOP_CONFIG, ...config };

    // Initialize phase maps
    for (const phase of Object.values(SystemPhase)) {
      if (typeof phase === 'number') {
        this.systems.set(phase, []);
      }
    }
  }

  /**
   * Register a system to execute in a specific phase
   */
  registerSystem(system: PhaseSystem): void {
    const systemsInPhase = this.systems.get(system.phase);
    if (!systemsInPhase) {
      throw new Error(`Invalid phase: ${system.phase}`);
    }

    // Insert in priority order (lower priority runs first)
    const priority = system.priority ?? 100;
    const insertIndex = systemsInPhase.findIndex(s => (s.priority ?? 100) > priority);

    if (insertIndex === -1) {
      systemsInPhase.push(system);
    } else {
      systemsInPhase.splice(insertIndex, 0, system);
    }
  }

  /**
   * Unregister a system by name
   */
  unregisterSystem(name: string): void {
    for (const [_phase, systemsInPhase] of this.systems.entries()) {
      const index = systemsInPhase.findIndex(s => s.name === name);
      if (index !== -1) {
        systemsInPhase.splice(index, 1);
        return;
      }
    }
  }

  /**
   * Register physics update callback
   *
   * This callback is called with fixed timestep during the PHYSICS phase.
   */
  registerPhysicsCallback(callback: (deltaTime: number) => void): void {
    this.physicsCallback = callback;
  }

  /**
   * Register render callback
   *
   * This callback is called during the RENDER phase with interpolation alpha.
   */
  registerRenderCallback(callback: (alpha: number) => void): void {
    this.renderCallback = callback;
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.running) {
      console.warn('GameLoop already running');
      return;
    }

    this.running = true;
    this.lastFrameTime = performance.now();
    this.tick();
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animationFrameId);
      } else {
        clearTimeout(this.animationFrameId);
      }
      this.animationFrameId = null;
    }
  }

  /**
   * Get current frame statistics
   */
  getStats(): Readonly<FrameStats> {
    return { ...this.stats };
  }

  /**
   * Main game loop tick
   */
  private tick = (): void => {
    if (!this.running) return;

    // Schedule next frame
    // Use requestAnimationFrame if available (browser), otherwise setTimeout (Node.js/tests)
    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(this.tick);
    } else {
      // Fallback for Node.js environment (tests)
      this.animationFrameId = setTimeout(this.tick, 16.67) as any;
    }

    // Calculate delta time
    const currentTime = performance.now();
    let deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = currentTime;

    // Clamp delta time to prevent spiral of death
    if (deltaTime > this.config.maxDeltaTime) {
      deltaTime = this.config.maxDeltaTime;
    }

    // Update frame stats
    this.updateStats(deltaTime);

    // Add to accumulator for physics
    this.accumulator += deltaTime;

    // Phase 1: PRE_UPDATE (variable dt)
    this.executePhase(SystemPhase.PRE_UPDATE, deltaTime);

    // Phase 2: UPDATE (variable dt)
    this.executePhase(SystemPhase.UPDATE, deltaTime);

    // Phase 3: POST_UPDATE (variable dt)
    this.executePhase(SystemPhase.POST_UPDATE, deltaTime);

    // Phase 4: PHYSICS (fixed dt with accumulator)
    let physicsSteps = 0;
    while (this.accumulator >= this.config.fixedTimestep && physicsSteps < this.config.maxSubsteps) {
      if (this.physicsCallback) {
        this.physicsCallback(this.config.fixedTimestep);
      }
      this.accumulator -= this.config.fixedTimestep;
      physicsSteps++;
    }

    // If we hit max substeps, clamp accumulator to prevent spiral of death
    if (physicsSteps >= this.config.maxSubsteps) {
      this.accumulator = 0;
    }

    this.stats.physicsSteps = physicsSteps;

    // Phase 5: RENDER (variable dt with interpolation)
    const alpha = this.accumulator / this.config.fixedTimestep;
    this.executePhase(SystemPhase.RENDER, deltaTime);

    if (this.renderCallback) {
      this.renderCallback(alpha);
    }

    // Update frame count and total time
    this.stats.totalFrames++;
    this.stats.totalTime += deltaTime;
  };

  /**
   * Execute all systems in a specific phase
   */
  private executePhase(phase: SystemPhase, deltaTime: number): void {
    const systemsInPhase = this.systems.get(phase);
    if (!systemsInPhase) return;

    for (const system of systemsInPhase) {
      if (system.update) {
        const startTime = performance.now();
        system.update(deltaTime);
        const elapsedTime = performance.now() - startTime;

        // Warn if system exceeds budget
        if (system.budget && elapsedTime > system.budget) {
          console.warn(
            `System '${system.name}' exceeded budget: ${elapsedTime.toFixed(2)}ms / ${system.budget}ms`
          );
        }
      }
    }
  }

  /**
   * Update frame timing statistics
   */
  private updateStats(deltaTime: number): void {
    const frameTimeMs = deltaTime * 1000;

    // Update circular buffer
    this.deltaTimeHistory[this.historyIndex] = frameTimeMs;
    this.historyIndex = (this.historyIndex + 1) % this.deltaTimeHistory.length;

    // Calculate average
    const sum = this.deltaTimeHistory.reduce((a, b) => a + b, 0);
    this.stats.averageFrameTime = sum / this.deltaTimeHistory.length;

    // Calculate FPS
    this.stats.frameTime = frameTimeMs;
    this.stats.fps = frameTimeMs > 0 ? 1000 / frameTimeMs : 60;
  }

  /**
   * Get all systems grouped by phase
   */
  getSystemsByPhase(): ReadonlyMap<SystemPhase, readonly PhaseSystem[]> {
    return this.systems;
  }
}
