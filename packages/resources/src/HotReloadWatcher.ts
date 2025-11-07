import chokidar, { FSWatcher } from 'chokidar';
import type { ResourceId, ResourceType } from './types';

/**
 * Hot-reload configuration
 */
export interface HotReloadConfig {
  /**
   * Enable hot-reload watching
   */
  enabled: boolean;

  /**
   * Paths to watch for changes
   */
  watchPaths: string[];

  /**
   * Debounce delay in milliseconds (prevent rapid reloads)
   */
  debounceMs?: number;

  /**
   * File patterns to ignore
   */
  ignored?: string | RegExp | Array<string | RegExp>;

  /**
   * Keep process alive while watching (default: false for clean shutdown)
   * Set to true only if you want the watcher to prevent process exit
   */
  persistent?: boolean;

  /**
   * Maximum number of concurrent debounce timers (prevents memory leak)
   */
  maxDebounceTimers?: number;
}

/**
 * Hot-reload event callback
 */
export type HotReloadCallback = (id: ResourceId, type: ResourceType) => Promise<void>;

/**
 * Resource path mapping (path -> {id, type})
 */
interface ResourceMapping {
  id: ResourceId;
  type: ResourceType;
}

/**
 * Hot-reload watcher for automatic resource reloading
 *
 * Watches file system for changes and triggers resource reloads
 * when files are modified.
 */
export class HotReloadWatcher {
  private watcher: FSWatcher | null = null;
  private resourcePaths = new Map<string, ResourceMapping>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private reloadCallback: HotReloadCallback | null = null;
  private config: HotReloadConfig & {
    debounceMs: number;
    persistent: boolean;
    maxDebounceTimers: number;
  };

  constructor(config: HotReloadConfig) {
    this.config = {
      debounceMs: 100,
      persistent: false, // Default: don't keep process alive
      maxDebounceTimers: 1000, // Prevent unbounded growth
      ...config,
    };
  }

  /**
   * Start watching for file changes
   */
  start(callback: HotReloadCallback): void {
    if (!this.config.enabled) {
      return;
    }

    if (this.watcher) {
      console.warn('HotReloadWatcher already started');
      return;
    }

    this.reloadCallback = callback;

    this.watcher = chokidar.watch(this.config.watchPaths, {
      ignored: this.config.ignored,
      persistent: this.config.persistent,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.watcher.on('change', (path: string) => {
      this.handleFileChange(path);
    });

    this.watcher.on('error', (error: unknown) => {
      console.error('HotReloadWatcher error:', error);
    });
  }

  /**
   * Stop watching for file changes
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.reloadCallback = null;
  }

  /**
   * Register a resource path for watching
   */
  registerPath(path: string, id: ResourceId, type: ResourceType): void {
    this.resourcePaths.set(path, { id, type });
  }

  /**
   * Unregister a resource path
   */
  unregisterPath(path: string): void {
    this.resourcePaths.delete(path);

    // Clear debounce timer if exists
    const timer = this.debounceTimers.get(path);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(path);
    }
  }

  /**
   * Get all registered paths
   */
  getRegisteredPaths(): string[] {
    return Array.from(this.resourcePaths.keys());
  }

  /**
   * Check if path is registered
   */
  isPathRegistered(path: string): boolean {
    return this.resourcePaths.has(path);
  }

  /**
   * Handle file change event
   */
  private handleFileChange(path: string): void {
    const mapping = this.resourcePaths.get(path);
    if (!mapping) {
      return;
    }

    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Check if we've hit the debounce timer limit
    if (this.debounceTimers.size >= this.config.maxDebounceTimers) {
      // Evict oldest timer (first in map)
      const oldestPath = this.debounceTimers.keys().next().value;
      const oldestTimer = this.debounceTimers.get(oldestPath);
      if (oldestTimer) {
        clearTimeout(oldestTimer);
        this.debounceTimers.delete(oldestPath);
      }
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.triggerReload(path, mapping);
      this.debounceTimers.delete(path);
    }, this.config.debounceMs);

    this.debounceTimers.set(path, timer);
  }

  /**
   * Trigger resource reload
   */
  private async triggerReload(path: string, mapping: ResourceMapping): Promise<void> {
    if (!this.reloadCallback) {
      console.warn(`No reload callback set for path: ${path}`);
      return;
    }

    try {
      await this.reloadCallback(mapping.id, mapping.type);
    } catch (error) {
      console.error(`Failed to reload resource ${mapping.id}:`, error);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<HotReloadConfig> {
    return this.config;
  }

  /**
   * Check if watcher is running
   */
  isRunning(): boolean {
    return this.watcher !== null;
  }
}
