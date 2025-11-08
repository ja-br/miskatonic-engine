/**
 * Tests for MiskatonicEngine
 *
 * Coverage:
 * - Engine creation with default and custom configs
 * - Lifecycle transitions (initialize, start, pause, resume, shutdown)
 * - System registration and execution order
 * - Configuration updates
 * - Error handling and invalid state transitions
 * - Event emission during lifecycle
 * - System access (world, events, resources, physics, network)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MiskatonicEngine, EngineState, type SystemRegistration } from '../src';

describe('MiskatonicEngine', () => {
  describe('Creation and Initialization', () => {
    it('should create engine with default config', async () => {
      const engine = await MiskatonicEngine.create();

      expect(engine).toBeInstanceOf(MiskatonicEngine);
      expect(engine.state).toBe(EngineState.INITIALIZING);
    });

    it('should create engine with custom config', async () => {
      const engine = await MiskatonicEngine.create({
        physics: {
          gravity: [0, -19.62, 0],
        },
        debug: {
          enabled: true,
        },
      });

      const config = engine.getConfig();
      expect(config.physics.gravity).toEqual([0, -19.62, 0]);
      expect(config.debug.enabled).toBe(true);
    });

    it('should merge custom config with defaults', async () => {
      const engine = await MiskatonicEngine.create({
        physics: {
          gravity: [0, 0, -9.81], // Custom
          // fixedTimestep not provided, should use default
        },
      });

      const config = engine.getConfig();
      expect(config.physics.gravity).toEqual([0, 0, -9.81]);
      expect(config.physics.fixedTimestep).toBe(1 / 60); // Default
    });

    it('should initialize engine successfully', async () => {
      const engine = await MiskatonicEngine.create();
      await engine.initialize();

      expect(engine.state).toBe(EngineState.READY);
    });

    it('should initialize physics when configured', async () => {
      const engine = await MiskatonicEngine.create({
        physics: {
          gravity: [0, -9.81, 0],
        },
      });

      await engine.initialize();

      expect(engine.physics).not.toBeNull();
      expect(engine.state).toBe(EngineState.READY);
    });

    it('should not initialize network when disabled', async () => {
      const engine = await MiskatonicEngine.create({
        network: {
          enabled: false,
        },
      });

      await engine.initialize();

      expect(engine.network).toBeNull();
    });

    it('should initialize network when enabled', async () => {
      const engine = await MiskatonicEngine.create({
        network: {
          enabled: true,
          tickRate: 30,
        },
      });

      await engine.initialize();

      expect(engine.network).not.toBeNull();
    });

    it('should throw when initializing from non-initializing state', async () => {
      const engine = await MiskatonicEngine.create();
      await engine.initialize();

      // Try to initialize again
      await expect(engine.initialize()).rejects.toThrow('Cannot initialize from state: ready');
    });
  });

  describe('Lifecycle Management', () => {
    let engine: MiskatonicEngine;

    beforeEach(async () => {
      engine = await MiskatonicEngine.create();
      await engine.initialize();
    });

    it('should start engine from ready state', () => {
      engine.start();
      expect(engine.state).toBe(EngineState.RUNNING);
    });

    it('should stop engine from running state', () => {
      engine.start();
      engine.stop();
      expect(engine.state).toBe(EngineState.PAUSED);
    });

    it('should pause engine from running state', () => {
      engine.start();
      engine.pause();
      expect(engine.state).toBe(EngineState.PAUSED);
    });

    it('should resume engine from paused state', () => {
      engine.start();
      engine.pause();
      engine.resume();
      expect(engine.state).toBe(EngineState.RUNNING);
    });

    it('should throw when starting from wrong state', () => {
      // Attempt to start before initializing
      const uninitializedEngine = new (MiskatonicEngine as any)({});
      expect(() => uninitializedEngine.start()).toThrow('Cannot start from state');
    });

    it('should throw when stopping from wrong state', () => {
      expect(() => engine.stop()).toThrow('Cannot stop from state: ready');
    });

    it('should throw when resuming from wrong state', () => {
      expect(() => engine.resume()).toThrow('Cannot resume from state: ready');
    });

    it('should shutdown engine cleanly', async () => {
      await engine.shutdown();
      expect(engine.state).toBe(EngineState.STOPPED);
    });

    it('should shutdown custom systems in reverse order', async () => {
      const shutdownOrder: string[] = [];

      engine.registerSystem({
        name: 'system1',
        priority: 1,
        shutdown: async () => {
          shutdownOrder.push('system1');
        },
      });

      engine.registerSystem({
        name: 'system2',
        priority: 2,
        shutdown: async () => {
          shutdownOrder.push('system2');
        },
      });

      await engine.shutdown();

      expect(shutdownOrder).toEqual(['system2', 'system1']);
    });
  });

  describe('System Registration', () => {
    let engine: MiskatonicEngine;

    beforeEach(async () => {
      engine = await MiskatonicEngine.create();
    });

    it('should register a system', () => {
      const system: SystemRegistration = {
        name: 'test-system',
        update: vi.fn(),
      };

      engine.registerSystem(system);
      // No error means success
    });

    it('should register systems in priority order', async () => {
      const initOrder: string[] = [];

      engine.registerSystem({
        name: 'low-priority',
        priority: 100,
        initialize: async () => {
          initOrder.push('low');
        },
      });

      engine.registerSystem({
        name: 'high-priority',
        priority: 1,
        initialize: async () => {
          initOrder.push('high');
        },
      });

      engine.registerSystem({
        name: 'medium-priority',
        priority: 50,
        initialize: async () => {
          initOrder.push('medium');
        },
      });

      await engine.initialize();

      expect(initOrder).toEqual(['high', 'medium', 'low']);
    });

    it('should unregister a system', () => {
      engine.registerSystem({
        name: 'test-system',
        update: vi.fn(),
      });

      engine.unregisterSystem('test-system');
      // No error means success
    });

    it('should handle unregistering non-existent system', () => {
      engine.unregisterSystem('non-existent');
      // Should not throw
    });
  });

  describe('Event Emission', () => {
    let engine: MiskatonicEngine;
    let events: any[] = [];

    beforeEach(async () => {
      engine = await MiskatonicEngine.create();
      events = [];

      // Subscribe to all engine events
      engine.events.on('engine:initializing', (event) => events.push(event));
      engine.events.on('engine:ready', (event) => events.push(event));
      engine.events.on('engine:started', (event) => events.push(event));
      engine.events.on('engine:stopped', (event) => events.push(event));
      engine.events.on('engine:shutting-down', (event) => events.push(event));
      engine.events.on('engine:physics-initialized', (event) => events.push(event));
      engine.events.on('engine:network-initialized', (event) => events.push(event));
    });

    it('should emit initializing event', async () => {
      await engine.initialize();
      // Give event bus time to process
      await new Promise(resolve => setTimeout(resolve, 10));

      const initEvent = events.find(e => e.type === 'engine:initializing');
      expect(initEvent).toBeDefined();
      expect(initEvent.timestamp).toBeGreaterThan(0);
    });

    it('should emit ready event', async () => {
      await engine.initialize();
      // Give event bus time to process
      await new Promise(resolve => setTimeout(resolve, 10));

      const readyEvent = events.find(e => e.type === 'engine:ready');
      expect(readyEvent).toBeDefined();
    });

    it('should emit started event', async () => {
      await engine.initialize();
      engine.start();
      // Give event bus time to process
      await new Promise(resolve => setTimeout(resolve, 10));

      const startEvent = events.find(e => e.type === 'engine:started');
      expect(startEvent).toBeDefined();
    });

    it('should emit stopped event', async () => {
      await engine.initialize();
      engine.start();
      engine.stop();
      // Give event bus time to process
      await new Promise(resolve => setTimeout(resolve, 10));

      const stopEvent = events.find(e => e.type === 'engine:stopped');
      expect(stopEvent).toBeDefined();
    });

    it('should emit shutting-down event', async () => {
      await engine.initialize();
      await engine.shutdown();
      // Give event bus time to process
      await new Promise(resolve => setTimeout(resolve, 10));

      const shutdownEvent = events.find(e => e.type === 'engine:shutting-down');
      expect(shutdownEvent).toBeDefined();
    });

    it('should emit physics-initialized event when physics enabled', async () => {
      const physicsEngine = await MiskatonicEngine.create({
        physics: {
          gravity: [0, -9.81, 0],
        },
      });

      const physicsEvents: any[] = [];
      physicsEngine.events.on('engine:physics-initialized', (event) => physicsEvents.push(event));

      await physicsEngine.initialize();

      // Give event bus time to process
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(physicsEvents.length).toBe(1);
    });

    it('should emit network-initialized event when network enabled', async () => {
      const networkEngine = await MiskatonicEngine.create({
        network: {
          enabled: true,
        },
      });

      const networkEvents: any[] = [];
      networkEngine.events.on('engine:network-initialized', (event) => networkEvents.push(event));

      await networkEngine.initialize();

      // Give event bus time to process
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(networkEvents.length).toBe(1);
    });
  });

  describe('System Access', () => {
    let engine: MiskatonicEngine;

    beforeEach(async () => {
      engine = await MiskatonicEngine.create();
      await engine.initialize();
    });

    it('should provide access to ECS World', () => {
      expect(engine.world).toBeDefined();
      expect(engine.world.createEntity).toBeDefined();
    });

    it('should provide access to Event Bus', () => {
      expect(engine.events).toBeDefined();
      expect(engine.events.emit).toBeDefined();
    });

    it('should provide access to Resource Manager', () => {
      expect(engine.resources).toBeDefined();
    });

    it('should provide access to Physics World when initialized', async () => {
      const physicsEngine = await MiskatonicEngine.create({
        physics: { gravity: [0, -9.81, 0] },
      });
      await physicsEngine.initialize();

      expect(physicsEngine.physics).not.toBeNull();
    });

    it('should provide null for Physics when not initialized', async () => {
      // Create engine without physics config (null gravity means no physics)
      const nophysicsEngine = await MiskatonicEngine.create();
      // Don't call initialize - physics would be created during init if configured

      expect(nophysicsEngine.physics).toBeNull();
    });

    it('should provide access to Network when enabled', async () => {
      const networkEngine = await MiskatonicEngine.create({
        network: { enabled: true },
      });
      await networkEngine.initialize();

      expect(networkEngine.network).not.toBeNull();
    });

    it('should provide null for Network when disabled', () => {
      expect(engine.network).toBeNull();
    });
  });

  describe('Configuration Management', () => {
    let engine: MiskatonicEngine;

    beforeEach(async () => {
      engine = await MiskatonicEngine.create();
    });

    it('should return current configuration', () => {
      const config = engine.getConfig();
      expect(config.physics).toBeDefined();
      expect(config.rendering).toBeDefined();
      expect(config.network).toBeDefined();
      expect(config.debug).toBeDefined();
      expect(config.performance).toBeDefined();
    });

    it('should update configuration', () => {
      engine.updateConfig({
        debug: {
          enabled: true,
          showStats: true,
        },
      });

      const config = engine.getConfig();
      expect(config.debug.enabled).toBe(true);
      expect(config.debug.showStats).toBe(true);
    });

    it('should emit config-updated event', async () => {
      // Need to subscribe before the event is emitted
      const events: any[] = [];
      engine.events.on('engine:config-updated', (event) => events.push(event));

      engine.updateConfig({ debug: { enabled: true } });

      // Give event bus time to process (it has 10ms batch delay)
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(events.length).toBe(1);
    });
  });

  describe('Statistics', () => {
    let engine: MiskatonicEngine;

    beforeEach(async () => {
      engine = await MiskatonicEngine.create();
      await engine.initialize();
    });

    it('should provide engine statistics', () => {
      const stats = engine.getStats();

      expect(stats).toBeDefined();
      expect(stats.fps).toBeDefined();
      expect(stats.frameTime).toBeDefined();
      expect(stats.totalFrames).toBeDefined();
      expect(stats.totalTime).toBeDefined();
      expect(stats.entityCount).toBeDefined();
      expect(stats.memoryUsage).toBeDefined();
    });

    it('should return a copy of stats (not reference)', () => {
      const stats1 = engine.getStats();
      const stats2 = engine.getStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });

  describe('Error Handling', () => {
    it('should transition to error state on initialization failure', async () => {
      // Force an error by providing invalid physics config that will fail
      const engine = await MiskatonicEngine.create({
        physics: {
          // Valid config, but we'll mock the physics init to fail
          gravity: [0, -9.81, 0],
        },
      });

      // Mock physics initialization to throw
      const originalInit = (engine as any).initializePhysics;
      (engine as any).initializePhysics = async () => {
        throw new Error('Physics initialization failed');
      };

      await expect(engine.initialize()).rejects.toThrow('Physics initialization failed');
      expect(engine.state).toBe(EngineState.ERROR);

      // Restore original
      (engine as any).initializePhysics = originalInit;
    });

    it('should emit error event on initialization failure', async () => {
      const engine = await MiskatonicEngine.create({
        physics: { gravity: [0, -9.81, 0] }, // Enable physics so it tries to initialize
      });

      const errorEvents: any[] = [];
      engine.events.on('engine:error', (event) => errorEvents.push(event));

      // Mock initialization to fail
      (engine as any).initializePhysics = async () => {
        throw new Error('Test error');
      };

      await expect(engine.initialize()).rejects.toThrow();

      // Give event bus time to process
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].error).toBe('Test error');
    });
  });

  describe('Integration', () => {
    it('should create entity and emit events', async () => {
      const engine = await MiskatonicEngine.create();
      await engine.initialize();

      // Should work without errors
      const entity = engine.world.createEntity();
      expect(entity).toBeGreaterThan(0);

      engine.events.emit({
        type: 'test:event',
        timestamp: Date.now(),
      });
    });

    it('should demonstrate full lifecycle', async () => {
      const engine = await MiskatonicEngine.create({
        physics: { gravity: [0, -9.81, 0] },
        debug: { enabled: true },
      });

      // Initialize
      await engine.initialize();
      expect(engine.state).toBe(EngineState.READY);

      // Start
      engine.start();
      expect(engine.state).toBe(EngineState.RUNNING);

      // Pause
      engine.pause();
      expect(engine.state).toBe(EngineState.PAUSED);

      // Resume
      engine.resume();
      expect(engine.state).toBe(EngineState.RUNNING);

      // Shutdown
      await engine.shutdown();
      expect(engine.state).toBe(EngineState.STOPPED);
    });
  });
});
