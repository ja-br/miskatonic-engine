/**
 * MiskatonicEngine - Main engine class that coordinates all subsystems
 *
 * This is the entry point for game developers. It manages:
 * - ECS World (entities, components, systems)
 * - Event Bus (pub/sub communication)
 * - Resource Manager (asset loading)
 * - Physics World (simulation)
 * - Network State Sync (multiplayer)
 * - Engine lifecycle (init, start, stop, shutdown)
 *
 * Design Philosophy:
 * - Batteries included (sensible defaults)
 * - Swappable systems (use your own if needed)
 * - Progressive enhancement (works with {}, deep customization available)
 * - Fail-safe (validates config, graceful degradation)
 */

import { World } from '@miskatonic/ecs';
import { EventBus } from '@miskatonic/events';
import { ResourceManager } from '@miskatonic/resources';
import { PhysicsWorld } from '@miskatonic/physics';
import { StateReplicationManager } from '@miskatonic/network';
import type {
  EngineConfig,
  EngineStats,
  SystemRegistration,
} from './types';
import { DEFAULT_ENGINE_CONFIG, EngineState } from './types';
import { GameLoop, SystemPhase, type PhaseSystem } from './GameLoop';
import { CommandSystem } from './commands/CommandSystem';
import { createBuiltinCommands } from './commands/builtins';

/**
 * Main engine class
 *
 * Usage:
 * ```typescript
 * const engine = await MiskatonicEngine.create({
 *   physics: { gravity: [0, -9.81, 0] },
 *   debug: { enabled: true }
 * });
 *
 * await engine.initialize();
 * engine.start();
 *
 * // Access systems
 * const entity = engine.world.createEntity();
 * engine.events.emit({ type: 'game:start' });
 *
 * // Later
 * await engine.shutdown();
 * ```
 */
export class MiskatonicEngine {
  // Core systems
  private _world: World;
  private _events: EventBus;
  private _resources: ResourceManager;
  private _physics: PhysicsWorld | null = null;
  private _network: StateReplicationManager | null = null;
  private _gameLoop: GameLoop;
  private _commands: CommandSystem;

  // Configuration
  private config: Required<EngineConfig>;

  // Lifecycle state
  private _state: EngineState = EngineState.INITIALIZING;

  // Custom systems
  private customSystems: SystemRegistration[] = [];

  // Statistics tracking
  private stats: EngineStats = {
    fps: 0,
    frameTime: 0,
    averageFrameTime: 0,
    totalFrames: 0,
    totalTime: 0,
    entityCount: 0,
    memoryUsage: 0,
  };

  /**
   * Private constructor - use MiskatonicEngine.create() instead
   */
  private constructor(config: Partial<EngineConfig>) {
    // Merge user config with defaults
    this.config = this.mergeConfig(config);

    // Create core systems
    this._world = new World();
    this._events = new EventBus({ batchDelay: 0 }); // 0ms batch delay for immediate event dispatch
    this._resources = new ResourceManager({
      maxSize: 1024 * 1024 * 1024, // 1GB cache
      evictionPolicy: 'lru' as any, // LRU eviction
      ttl: 60000, // 1 minute TTL
    });

    // Create game loop
    this._gameLoop = new GameLoop({
      targetFPS: this.config.performance.targetFPS,
      fixedTimestep: this.config.physics?.fixedTimestep || 1 / 60,
      maxDeltaTime: this.config.performance.maxDeltaTime,
      maxSubsteps: this.config.physics?.maxSubsteps || 4,
    });

    // Create command system
    this._commands = new CommandSystem(this._events);

    // Register built-in commands
    this._commands.registerMany(createBuiltinCommands(this));
  }

  /**
   * Create a new engine instance
   *
   * This is the primary entry point. Validates configuration before creating engine.
   *
   * @param config - Engine configuration (optional, uses defaults)
   * @returns Promise<MiskatonicEngine> - Resolves when validation complete
   */
  static async create(config: Partial<EngineConfig> = {}): Promise<MiskatonicEngine> {
    // Validate configuration
    if (config.performance?.targetFPS && config.performance.targetFPS <= 0) {
      throw new Error('targetFPS must be positive');
    }

    if (config.performance?.maxDeltaTime && config.performance.maxDeltaTime <= 0) {
      throw new Error('maxDeltaTime must be positive');
    }

    if (config.network?.tickRate && config.network.tickRate <= 0) {
      throw new Error('tickRate must be positive');
    }

    // Create engine with validated config
    const engine = new MiskatonicEngine(config);
    return engine;
  }

  /**
   * Initialize the engine and all systems
   *
   * Call this after create() and before start().
   * Initializes physics, network, and custom systems.
   */
  async initialize(): Promise<void> {
    if (this._state !== EngineState.INITIALIZING) {
      throw new Error(`Cannot initialize from state: ${this._state}`);
    }

    try {
      this._events.emit({
        type: 'engine:initializing',
        timestamp: Date.now(),
      });

      // Initialize physics unless explicitly disabled
      // Pass physics: null in config to disable physics
      if (this.config.physics !== null) {
        await this.initializePhysics();
      }

      // Initialize network if enabled
      if (this.config.network.enabled) {
        await this.initializeNetwork();
      }

      // Initialize custom systems
      for (const system of this.customSystems) {
        if (system.initialize) {
          await system.initialize();
        }
      }

      // Register physics callback with game loop
      if (this._physics) {
        this._gameLoop.registerPhysicsCallback((dt) => {
          this._physics!.step(dt);
        });
      }

      // Register pre-update system for command queue processing
      this._gameLoop.registerSystem({
        name: 'command-queue-processor',
        phase: SystemPhase.PRE_UPDATE,
        priority: 0, // Run first in PRE_UPDATE
        update: async () => {
          await this._commands.processQueue();
        },
      });

      this._state = EngineState.READY;

      this._events.emit({
        type: 'engine:ready',
        timestamp: Date.now(),
      });
    } catch (error) {
      this._state = EngineState.ERROR;
      this._events.emit({
        type: 'engine:error',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Start the engine and begin game loop
   */
  start(): void {
    if (this._state !== EngineState.READY && this._state !== EngineState.PAUSED) {
      throw new Error(`Cannot start from state: ${this._state}`);
    }

    this._state = EngineState.RUNNING;

    this._events.emit({
      type: 'engine:started',
      timestamp: Date.now(),
    });

    // Start the game loop
    this._gameLoop.start();
  }

  /**
   * Stop the engine (pauses game loop)
   *
   * Engine can be resumed with start().
   */
  stop(): void {
    if (this._state !== EngineState.RUNNING) {
      throw new Error(`Cannot stop from state: ${this._state}`);
    }

    // Stop the game loop
    this._gameLoop.stop();

    this._state = EngineState.PAUSED;

    this._events.emit({
      type: 'engine:stopped',
      timestamp: Date.now(),
    });
  }

  /**
   * Pause the engine (alias for stop, more semantically clear)
   */
  pause(): void {
    this.stop();
  }

  /**
   * Resume the engine (alias for start when paused)
   */
  resume(): void {
    if (this._state !== EngineState.PAUSED) {
      throw new Error(`Cannot resume from state: ${this._state}`);
    }
    this.start();
  }

  /**
   * Shutdown the engine and clean up all resources
   *
   * After shutdown, the engine cannot be restarted.
   */
  async shutdown(): Promise<void> {
    this._state = EngineState.STOPPING;

    this._events.emit({
      type: 'engine:shutting-down',
      timestamp: Date.now(),
    });

    try {
      // Shutdown custom systems (in reverse order)
      for (let i = this.customSystems.length - 1; i >= 0; i--) {
        const system = this.customSystems[i];
        if (system.shutdown) {
          await system.shutdown();
        }
      }

      // Cleanup network
      if (this._network) {
        // StateReplicationManager doesn't have destroy() yet
        // For now, just clear the reference
        this._network = null;
      }

      // Cleanup physics
      if (this._physics) {
        // PhysicsWorld doesn't have destroy() yet
        // For now, just clear the reference
        this._physics = null;
      }

      // Cleanup command system
      if (this._commands) {
        await this._commands.shutdown();
      }

      // Cleanup resources
      if (this._resources) {
        // ResourceManager doesn't have destroy() yet
        // For now, just clear the reference
        this._resources = null as any; // Will be re-initialized if engine restarts
      }

      // Emit shutdown complete BEFORE destroying event bus
      this._events.emit({
        type: 'engine:shutdown-complete',
        timestamp: Date.now(),
      });

      this._state = EngineState.STOPPED;

      // NOW destroy event bus (after all events emitted)
      this._events.destroy();
    } catch (error) {
      this._state = EngineState.ERROR;
      this._events.emit({
        type: 'engine:error',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Register a custom system
   *
   * Systems are executed in priority order (lower priority runs first).
   * Optionally specify a phase for more control over execution order.
   *
   * @param system - System registration (can include phase)
   */
  registerSystem(system: SystemRegistration | PhaseSystem): void {
    // Insert system in priority order
    const priority = system.priority ?? 100;
    const index = this.customSystems.findIndex(s => (s.priority ?? 100) > priority);

    if (index === -1) {
      this.customSystems.push(system);
    } else {
      this.customSystems.splice(index, 0, system);
    }

    // If this is a phase system, register it with the game loop
    if ('phase' in system) {
      this._gameLoop.registerSystem(system as PhaseSystem);
    }

    this._events.emit({
      type: 'engine:system-registered',
      timestamp: Date.now(),
      systemName: system.name,
    });
  }

  /**
   * Unregister a custom system
   *
   * @param name - System name to remove
   */
  unregisterSystem(name: string): void {
    const index = this.customSystems.findIndex(s => s.name === name);
    if (index !== -1) {
      this.customSystems.splice(index, 1);

      // Also unregister from game loop
      this._gameLoop.unregisterSystem(name);

      this._events.emit({
        type: 'engine:system-unregistered',
        timestamp: Date.now(),
        systemName: name,
      });
    }
  }

  /**
   * Update engine configuration
   *
   * Note: Some config changes require engine restart to take effect.
   *
   * @param partial - Partial configuration to merge
   */
  updateConfig(partial: Partial<EngineConfig>): void {
    this.config = this.mergeConfig(partial);

    this._events.emit({
      type: 'engine:config-updated',
      timestamp: Date.now(),
    });
  }

  /**
   * Get current engine configuration (readonly)
   */
  getConfig(): Readonly<Required<EngineConfig>> {
    return this.config;
  }

  /**
   * Get current engine state
   */
  get state(): EngineState {
    return this._state;
  }

  /**
   * Get ECS World
   */
  get world(): World {
    return this._world;
  }

  /**
   * Get Event Bus
   */
  get events(): EventBus {
    return this._events;
  }

  /**
   * Get Resource Manager
   */
  get resources(): ResourceManager {
    return this._resources;
  }

  /**
   * Get Physics World (may be null if not initialized)
   */
  get physics(): PhysicsWorld | null {
    return this._physics;
  }

  /**
   * Get Network State Replication Manager (may be null if not enabled)
   */
  get network(): StateReplicationManager | null {
    return this._network;
  }

  /**
   * Get Command System
   */
  get commands(): CommandSystem {
    return this._commands;
  }

  /**
   * Get current engine statistics
   */
  getStats(): Readonly<EngineStats> {
    // Get game loop stats
    const loopStats = this._gameLoop.getStats();

    // Update stats from game loop
    this.stats.fps = loopStats.fps;
    this.stats.frameTime = loopStats.frameTime;
    this.stats.averageFrameTime = loopStats.averageFrameTime;
    this.stats.totalFrames = loopStats.totalFrames;
    this.stats.totalTime = loopStats.totalTime;

    // Update memory usage (if available)
    if (typeof process !== 'undefined' && process.memoryUsage) {
      this.stats.memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }

    // Entity count still needs to be exposed by World
    // this.stats.entityCount will be added when World exposes it

    return { ...this.stats };
  }

  /**
   * Initialize physics system
   */
  private async initializePhysics(): Promise<void> {
    const { RapierPhysicsEngine } = await import('../../physics/src');

    const engine = new RapierPhysicsEngine();

    // Create PhysicsWorld with config
    const [gx, gy, gz] = this.config.physics.gravity!;
    this._physics = await PhysicsWorld.create(engine, {
      gravity: { x: gx, y: gy, z: gz },
    });

    this._events.emit({
      type: 'engine:physics-initialized',
      timestamp: Date.now(),
    });
  }

  /**
   * Initialize network system
   */
  private async initializeNetwork(): Promise<void> {
    this._network = new StateReplicationManager({
      tickRate: this.config.network.tickRate!,
      useDeltaCompression: this.config.network.useDeltaCompression!,
      useInterestManagement: this.config.network.useInterestManagement!,
    });

    this._events.emit({
      type: 'engine:network-initialized',
      timestamp: Date.now(),
    });
  }

  /**
   * Deep merge partial config with defaults
   */
  private mergeConfig(partial: Partial<EngineConfig>): Required<EngineConfig> {
    // Deep merge each config section
    const deepMerge = <T extends object>(defaults: T, overrides?: Partial<T>): T => {
      if (!overrides) return { ...defaults };

      const result = { ...defaults };
      for (const key in overrides) {
        const override = overrides[key];
        if (override !== undefined) {
          result[key] = override as T[Extract<keyof T, string>];
        }
      }
      return result;
    };

    return {
      physics: deepMerge(DEFAULT_ENGINE_CONFIG.physics, partial.physics),
      rendering: deepMerge(DEFAULT_ENGINE_CONFIG.rendering, partial.rendering),
      network: deepMerge(DEFAULT_ENGINE_CONFIG.network, partial.network),
      debug: deepMerge(DEFAULT_ENGINE_CONFIG.debug, partial.debug),
      performance: deepMerge(DEFAULT_ENGINE_CONFIG.performance, partial.performance),
    };
  }
}
