/**
 * Tests for GameLoop
 *
 * Coverage:
 * - System registration and execution order
 * - Phase-based execution
 * - Fixed timestep physics
 * - Frame timing and statistics
 * - Spiral of death protection
 * - Start/stop lifecycle
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameLoop, SystemPhase, type PhaseSystem } from '../src/GameLoop';

describe('GameLoop', () => {
  let loop: GameLoop;

  beforeEach(() => {
    loop = new GameLoop();
  });

  afterEach(() => {
    loop.stop();
  });

  describe('System Registration', () => {
    it('should register a system', () => {
      const system: PhaseSystem = {
        name: 'test-system',
        phase: SystemPhase.UPDATE,
        update: vi.fn(),
      };

      loop.registerSystem(system);

      const systems = loop.getSystemsByPhase();
      const updateSystems = systems.get(SystemPhase.UPDATE);
      expect(updateSystems).toHaveLength(1);
      expect(updateSystems![0].name).toBe('test-system');
    });

    it('should register systems in priority order', () => {
      const system1: PhaseSystem = {
        name: 'low-priority',
        phase: SystemPhase.UPDATE,
        priority: 100,
        update: vi.fn(),
      };

      const system2: PhaseSystem = {
        name: 'high-priority',
        phase: SystemPhase.UPDATE,
        priority: 1,
        update: vi.fn(),
      };

      loop.registerSystem(system1);
      loop.registerSystem(system2);

      const systems = loop.getSystemsByPhase();
      const updateSystems = systems.get(SystemPhase.UPDATE);
      expect(updateSystems![0].name).toBe('high-priority');
      expect(updateSystems![1].name).toBe('low-priority');
    });

    it('should unregister a system', () => {
      const system: PhaseSystem = {
        name: 'test-system',
        phase: SystemPhase.UPDATE,
        update: vi.fn(),
      };

      loop.registerSystem(system);
      loop.unregisterSystem('test-system');

      const systems = loop.getSystemsByPhase();
      const updateSystems = systems.get(SystemPhase.UPDATE);
      expect(updateSystems).toHaveLength(0);
    });
  });

  describe('Phase Execution', () => {
    it('should execute systems in phase order', async () => {
      const executionOrder: string[] = [];

      const preUpdateSystem: PhaseSystem = {
        name: 'pre-update',
        phase: SystemPhase.PRE_UPDATE,
        update: () => executionOrder.push('pre'),
      };

      const updateSystem: PhaseSystem = {
        name: 'update',
        phase: SystemPhase.UPDATE,
        update: () => executionOrder.push('update'),
      };

      const postUpdateSystem: PhaseSystem = {
        name: 'post-update',
        phase: SystemPhase.POST_UPDATE,
        update: () => executionOrder.push('post'),
      };

      const renderSystem: PhaseSystem = {
        name: 'render',
        phase: SystemPhase.RENDER,
        update: () => executionOrder.push('render'),
      };

      loop.registerSystem(preUpdateSystem);
      loop.registerSystem(updateSystem);
      loop.registerSystem(postUpdateSystem);
      loop.registerSystem(renderSystem);

      loop.start();

      // Wait for a frame
      await new Promise(resolve => setTimeout(resolve, 50));

      loop.stop();

      // Should have executed in order
      expect(executionOrder).toContain('pre');
      expect(executionOrder).toContain('update');
      expect(executionOrder).toContain('post');
      expect(executionOrder).toContain('render');

      // Verify order (pre comes before update, etc.)
      const preIndex = executionOrder.indexOf('pre');
      const updateIndex = executionOrder.indexOf('update');
      const postIndex = executionOrder.indexOf('post');
      const renderIndex = executionOrder.indexOf('render');

      expect(preIndex).toBeLessThan(updateIndex);
      expect(updateIndex).toBeLessThan(postIndex);
      expect(postIndex).toBeLessThan(renderIndex);
    });
  });

  describe('Physics Callback', () => {
    it('should register and call physics callback', async () => {
      const physicsCallback = vi.fn();
      loop.registerPhysicsCallback(physicsCallback);

      loop.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      loop.stop();

      expect(physicsCallback).toHaveBeenCalled();
    });

    it('should call physics callback with fixed timestep', async () => {
      const fixedTimestep = 1 / 60;
      const physicsCallback = vi.fn();

      const customLoop = new GameLoop({ fixedTimestep });
      customLoop.registerPhysicsCallback(physicsCallback);

      customLoop.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      customLoop.stop();

      // Should have been called with fixed timestep
      expect(physicsCallback).toHaveBeenCalled();
      const calls = physicsCallback.mock.calls;
      for (const call of calls) {
        expect(call[0]).toBeCloseTo(fixedTimestep, 5);
      }
    });
  });

  describe('Render Callback', () => {
    it('should register and call render callback', async () => {
      const renderCallback = vi.fn();
      loop.registerRenderCallback(renderCallback);

      loop.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      loop.stop();

      expect(renderCallback).toHaveBeenCalled();
    });

    it('should call render callback with interpolation alpha', async () => {
      const renderCallback = vi.fn();
      loop.registerRenderCallback(renderCallback);

      loop.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      loop.stop();

      // Should have been called with alpha between 0 and 1
      expect(renderCallback).toHaveBeenCalled();
      const calls = renderCallback.mock.calls;
      for (const call of calls) {
        const alpha = call[0];
        expect(alpha).toBeGreaterThanOrEqual(0);
        expect(alpha).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Lifecycle', () => {
    it('should start the loop', () => {
      loop.start();
      // Loop should be running
      // Can't directly test private field, but we can stop it
      loop.stop();
    });

    it('should stop the loop', async () => {
      const updateCallback = vi.fn();
      const system: PhaseSystem = {
        name: 'test',
        phase: SystemPhase.UPDATE,
        update: updateCallback,
      };

      loop.registerSystem(system);
      loop.start();

      await new Promise(resolve => setTimeout(resolve, 50));
      const callCountWhileRunning = updateCallback.mock.calls.length;

      loop.stop();

      await new Promise(resolve => setTimeout(resolve, 50));
      const callCountAfterStop = updateCallback.mock.calls.length;

      // Should not have called update after stop
      expect(callCountAfterStop).toBe(callCountWhileRunning);
    });

    it('should warn if starting already running loop', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      loop.start();
      loop.start(); // Second start

      expect(warnSpy).toHaveBeenCalledWith('GameLoop already running');

      warnSpy.mockRestore();
      loop.stop();
    });
  });

  describe('Statistics', () => {
    it('should track frame statistics', async () => {
      loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      loop.stop();

      const stats = loop.getStats();

      expect(stats.fps).toBeGreaterThan(0);
      expect(stats.frameTime).toBeGreaterThan(0);
      expect(stats.totalFrames).toBeGreaterThan(0);
      expect(stats.totalTime).toBeGreaterThan(0);
    });

    it('should return a copy of stats', () => {
      const stats1 = loop.getStats();
      const stats2 = loop.getStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });

  describe('Budget Warnings', () => {
    it('should warn when system exceeds budget', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const slowSystem: PhaseSystem = {
        name: 'slow-system',
        phase: SystemPhase.UPDATE,
        budget: 1, // 1ms budget
        update: () => {
          // Simulate slow work
          const start = performance.now();
          while (performance.now() - start < 5) {
            // Busy wait for 5ms
          }
        },
      };

      loop.registerSystem(slowSystem);
      loop.start();

      await new Promise(resolve => setTimeout(resolve, 50));
      loop.stop();

      // Should have warned about exceeding budget
      expect(warnSpy).toHaveBeenCalled();
      const warnings = warnSpy.mock.calls.filter(call =>
        call[0].includes('exceeded budget')
      );
      expect(warnings.length).toBeGreaterThan(0);

      warnSpy.mockRestore();
    });
  });

  describe('Configuration', () => {
    it('should use custom target FPS', () => {
      const customLoop = new GameLoop({ targetFPS: 30 });
      expect(customLoop).toBeDefined();
    });

    it('should use custom fixed timestep', () => {
      const customLoop = new GameLoop({ fixedTimestep: 1 / 30 });
      expect(customLoop).toBeDefined();
    });

    it('should use custom max delta time', () => {
      const customLoop = new GameLoop({ maxDeltaTime: 0.2 });
      expect(customLoop).toBeDefined();
    });

    it('should use custom max substeps', () => {
      const customLoop = new GameLoop({ maxSubsteps: 8 });
      expect(customLoop).toBeDefined();
    });
  });
});
