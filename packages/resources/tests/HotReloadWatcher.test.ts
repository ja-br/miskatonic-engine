import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HotReloadWatcher } from '../src/HotReloadWatcher';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('HotReloadWatcher', () => {
  let watcher: HotReloadWatcher;
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    // Create temporary directory for testing
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hot-reload-test-'));
    testFile = path.join(testDir, 'test-resource.txt');

    watcher = new HotReloadWatcher({
      enabled: true,
      watchPaths: [testDir],
      debounceMs: 50,
    });
  });

  afterEach(async () => {
    await watcher.stop();
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('configuration', () => {
    it('should store configuration', () => {
      const config = watcher.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.watchPaths).toContain(testDir);
      expect(config.debounceMs).toBe(50);
    });

    it('should not start if disabled', () => {
      const disabledWatcher = new HotReloadWatcher({
        enabled: false,
        watchPaths: [testDir],
      });

      const callback = vi.fn();
      disabledWatcher.start(callback);

      expect(disabledWatcher.isRunning()).toBe(false);
    });
  });

  describe('path registration', () => {
    it('should register resource paths', () => {
      watcher.registerPath(testFile, 'test-resource', 'text');

      expect(watcher.isPathRegistered(testFile)).toBe(true);
      expect(watcher.getRegisteredPaths()).toContain(testFile);
    });

    it('should unregister resource paths', () => {
      watcher.registerPath(testFile, 'test-resource', 'text');
      watcher.unregisterPath(testFile);

      expect(watcher.isPathRegistered(testFile)).toBe(false);
      expect(watcher.getRegisteredPaths()).not.toContain(testFile);
    });

    it('should track multiple paths', () => {
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');

      watcher.registerPath(file1, 'resource1', 'text');
      watcher.registerPath(file2, 'resource2', 'text');

      expect(watcher.getRegisteredPaths()).toHaveLength(2);
      expect(watcher.getRegisteredPaths()).toContain(file1);
      expect(watcher.getRegisteredPaths()).toContain(file2);
    });
  });

  describe('file watching', () => {
    it('should trigger callback on file change', async () => {
      const callback = vi.fn();

      watcher.registerPath(testFile, 'test-resource', 'text');
      watcher.start(callback);

      // Create file
      await fs.writeFile(testFile, 'initial content');

      // Wait for file to stabilize
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Modify file
      await fs.writeFile(testFile, 'modified content');

      // Wait for debounce + processing
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(callback).toHaveBeenCalledWith('test-resource', 'text');
    });

    it('should debounce rapid changes', async () => {
      const callback = vi.fn();

      watcher.registerPath(testFile, 'test-resource', 'text');
      watcher.start(callback);

      // Create file
      await fs.writeFile(testFile, 'initial content');
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Clear callback from initial write
      callback.mockClear();

      // Make rapid changes
      await fs.writeFile(testFile, 'change 1');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await fs.writeFile(testFile, 'change 2');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await fs.writeFile(testFile, 'change 3');

      // Wait for debounce + processing
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Should only trigger once due to debouncing
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not trigger for unregistered paths', async () => {
      const callback = vi.fn();
      const otherFile = path.join(testDir, 'other-file.txt');

      watcher.registerPath(testFile, 'test-resource', 'text');
      watcher.start(callback);

      // Create and modify unregistered file
      await fs.writeFile(otherFile, 'initial');
      await new Promise((resolve) => setTimeout(resolve, 200));

      await fs.writeFile(otherFile, 'modified');
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('should start watching', () => {
      const callback = vi.fn();
      watcher.start(callback);

      expect(watcher.isRunning()).toBe(true);
    });

    it('should stop watching', async () => {
      const callback = vi.fn();
      watcher.start(callback);
      await watcher.stop();

      expect(watcher.isRunning()).toBe(false);
    });

    it('should warn on duplicate start', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const callback = vi.fn();

      watcher.start(callback);
      watcher.start(callback);

      expect(consoleSpy).toHaveBeenCalledWith('HotReloadWatcher already started');
      consoleSpy.mockRestore();
    });

    it('should clear debounce timers on stop', async () => {
      const callback = vi.fn();

      watcher.registerPath(testFile, 'test-resource', 'text');
      watcher.start(callback);

      // Create file
      await fs.writeFile(testFile, 'initial content');
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Clear callback from initial write
      callback.mockClear();

      // Start modification but stop immediately before debounce completes
      await fs.writeFile(testFile, 'modified');
      await new Promise((resolve) => setTimeout(resolve, 10)); // Just enough for file event
      await watcher.stop();

      // Wait for what would have been the debounce period
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should not trigger callback after stop
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
