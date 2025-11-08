/**
 * Core engine types and configuration interfaces
 */

import type { PhysicsWorld } from '@miskatonic/physics';
import type { StateReplicationManager } from '@miskatonic/network';

/**
 * Engine lifecycle states
 */
export enum EngineState {
  /** Engine is being initialized */
  INITIALIZING = 'initializing',
  /** Engine is ready but not running */
  READY = 'ready',
  /** Engine is running the game loop */
  RUNNING = 'running',
  /** Engine is paused (can be resumed) */
  PAUSED = 'paused',
  /** Engine is shutting down */
  STOPPING = 'stopping',
  /** Engine has been shut down */
  STOPPED = 'stopped',
  /** Engine encountered a fatal error */
  ERROR = 'error',
}

/**
 * Physics engine configuration
 */
export interface PhysicsConfig {
  /** Physics engine backend to use (default: 'rapier') */
  backend?: 'rapier' | 'cannon' | 'box2d';
  /** Gravity vector (default: [0, -9.81, 0]) */
  gravity?: [number, number, number];
  /** Fixed timestep for physics simulation in seconds (default: 1/60) */
  fixedTimestep?: number;
  /** Maximum number of substeps per frame (default: 4) */
  maxSubsteps?: number;
  /** Enable continuous collision detection (default: true) */
  enableCCD?: boolean;
}

/**
 * Rendering configuration
 */
export interface RenderingConfig {
  /** Rendering backend (default: 'webgpu' with webgl2 fallback) */
  backend?: 'webgpu' | 'webgl2';
  /** Target frames per second (default: 60) */
  targetFPS?: number;
  /** Enable vertical sync (default: true) */
  vsync?: boolean;
  /** Render resolution scale (1.0 = native, 0.5 = half res) (default: 1.0) */
  resolutionScale?: number;
  /** Enable anti-aliasing (default: true) */
  antialiasing?: boolean;
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  /** Enable networking (default: false for single-player) */
  enabled?: boolean;
  /** Network tick rate in Hz (default: 60) */
  tickRate?: number;
  /** Enable delta compression (default: true) */
  useDeltaCompression?: boolean;
  /** Enable interest management (default: true) */
  useInterestManagement?: boolean;
  /** Interest management radius in world units (default: 100) */
  interestRadius?: number;
}

/**
 * Debug configuration
 */
export interface DebugConfig {
  /** Enable debug mode (default: false) */
  enabled?: boolean;
  /** Show performance stats (default: true in debug mode) */
  showStats?: boolean;
  /** Show physics debug shapes (default: false) */
  showPhysics?: boolean;
  /** Show bounding boxes (default: false) */
  showBoundingBoxes?: boolean;
  /** Log frame times (default: false) */
  logFrameTimes?: boolean;
  /** Enable profiling (default: false) */
  profiling?: boolean;
}

/**
 * Performance budgets and thresholds
 */
export interface PerformanceConfig {
  /** Target frame rate (default: 60 FPS) */
  targetFPS?: number;
  /** Maximum delta time in seconds to prevent spiral of death (default: 0.1) */
  maxDeltaTime?: number;
  /** Memory budget in MB (default: 500MB) */
  memoryBudgetMB?: number;
  /** GC pause budget in milliseconds (default: 5ms) */
  gcPauseBudgetMS?: number;
  /** Warn when frame time exceeds budget (default: true) */
  warnOnBudgetExceed?: boolean;
}

/**
 * Complete engine configuration
 */
export interface EngineConfig {
  /** Physics engine configuration */
  physics?: PhysicsConfig;
  /** Rendering configuration */
  rendering?: RenderingConfig;
  /** Network configuration */
  network?: NetworkConfig;
  /** Debug configuration */
  debug?: DebugConfig;
  /** Performance configuration */
  performance?: PerformanceConfig;
}

/**
 * System registration interface
 */
export interface SystemRegistration {
  /** Unique system name */
  name: string;
  /** System priority (lower runs first) */
  priority?: number;
  /** System initialization function */
  initialize?: () => void | Promise<void>;
  /** System update function (called every frame with variable dt) */
  update?: (deltaTime: number) => void;
  /** System shutdown function */
  shutdown?: () => void | Promise<void>;
}

/**
 * Engine statistics
 */
export interface EngineStats {
  /** Current frame rate */
  fps: number;
  /** Current frame time in milliseconds */
  frameTime: number;
  /** Average frame time in milliseconds */
  averageFrameTime: number;
  /** Total frames rendered */
  totalFrames: number;
  /** Total time elapsed in seconds */
  totalTime: number;
  /** Number of entities */
  entityCount: number;
  /** Memory usage in MB */
  memoryUsage: number;
}

/**
 * Default engine configuration
 */
export const DEFAULT_ENGINE_CONFIG: Required<EngineConfig> = {
  physics: {
    backend: 'rapier',
    gravity: [0, -9.81, 0],
    fixedTimestep: 1 / 60,
    maxSubsteps: 4,
    enableCCD: true,
  },
  rendering: {
    backend: 'webgpu',
    targetFPS: 60,
    vsync: true,
    resolutionScale: 1.0,
    antialiasing: true,
  },
  network: {
    enabled: false,
    tickRate: 60,
    useDeltaCompression: true,
    useInterestManagement: true,
    interestRadius: 100,
  },
  debug: {
    enabled: false,
    showStats: true,
    showPhysics: false,
    showBoundingBoxes: false,
    logFrameTimes: false,
    profiling: false,
  },
  performance: {
    targetFPS: 60,
    maxDeltaTime: 0.1,
    memoryBudgetMB: 500,
    gcPauseBudgetMS: 5,
    warnOnBudgetExceed: true,
  },
};
