import type {
  ResourceId,
  ResourceType,
  Resource,
  ResourceLoader,
  ResourceHandle as IResourceHandle,
  LoadOptions,
  CacheConfig,
  ResourceStats,
} from './types';
import { ResourceState } from './types';
import { ResourceEntry, ResourceHandle } from './ResourceHandle';
import { ResourceCache } from './ResourceCache';
import { DependencyTracker } from './DependencyTracker';
import { HotReloadWatcher, type HotReloadConfig } from './HotReloadWatcher';
import { Mutex } from 'async-mutex';

/**
 * Main resource management system
 *
 * Features:
 * - Async resource loading with loaders
 * - Reference counting and automatic cleanup
 * - LRU/LFU/FIFO/SIZE eviction policies
 * - Dependency tracking and automatic loading
 * - Hot-reload support
 * - Performance statistics
 */
export class ResourceManager {
  private loaders = new Map<ResourceType, ResourceLoader>();
  private cache: ResourceCache;
  private dependencies = new DependencyTracker();

  // Loading queue with mutex for atomic operations
  private loadingPromises = new Map<ResourceId, Promise<Resource>>();
  private loadingMutex = new Mutex();

  // Error cleanup timers (track for proper cleanup)
  private errorCleanupTimers = new Map<ResourceId, NodeJS.Timeout>();
  private static readonly MAX_ERROR_TIMERS = 100;
  private static readonly ERROR_CLEANUP_TIMEOUT = 5000; // 5 seconds

  // Hot-reload support (lazy initialization)
  private hotReloadWatcher: HotReloadWatcher | null = null;
  private hotReloadConfig: HotReloadConfig | null = null;
  private resourcePaths = new Map<ResourceId, string>();

  // Statistics
  private stats = {
    cacheHits: 0,
    cacheMisses: 0,
    totalLoadTime: 0,
    loadCount: 0,
    reloadCount: 0,
  };

  constructor(cacheConfig: CacheConfig, hotReloadConfig?: HotReloadConfig) {
    this.cache = new ResourceCache(cacheConfig);

    // Store config but don't initialize watcher yet (lazy)
    if (hotReloadConfig) {
      this.hotReloadConfig = hotReloadConfig;
    }
  }

  /**
   * Register a resource loader
   */
  registerLoader(loader: ResourceLoader): void {
    if (this.loaders.has(loader.type)) {
      console.warn(`Overwriting loader for type: ${loader.type}`);
    }
    this.loaders.set(loader.type, loader);
  }

  /**
   * Unregister a resource loader
   */
  unregisterLoader(type: ResourceType): boolean {
    return this.loaders.delete(type);
  }

  /**
   * Load a resource and get a handle
   */
  async load<T = unknown>(
    id: ResourceId,
    type: ResourceType,
    options?: LoadOptions
  ): Promise<IResourceHandle<T>> {
    // Check cache first
    let entry = this.cache.get(id);

    // Type validation: ensure cached resource matches requested type
    if (entry && entry.type !== type) {
      throw new Error(
        `Type mismatch for resource ${id}: cached as '${entry.type}', requested as '${type}'`
      );
    }

    if (entry && !options?.forceReload) {
      // Cache hit
      this.stats.cacheHits++;
      if (entry.state === ResourceState.LOADED) {
        // Type is validated above, safe to cast
        return new ResourceHandle(entry as ResourceEntry<T>, this.handleRelease);
      }

      if (entry.state === ResourceState.LOADING) {
        // Already loading, wait for it
        await this.loadingPromises.get(id);
        // Type is validated above, safe to cast
        return new ResourceHandle(entry as ResourceEntry<T>, this.handleRelease);
      }

      if (entry.state === ResourceState.ERROR && !options?.forceReload) {
        throw entry.error || new Error(`Failed to load resource: ${id}`);
      }

      // If we get here, need to reload - entry type already validated
    }

    // Cache miss
    this.stats.cacheMisses++;

    // ATOMIC: Use mutex to prevent race conditions in promise creation
    const release = await this.loadingMutex.acquire();
    let loadPromise: Promise<Resource<T>>;

    try {
      // Double-check for existing promise under mutex
      const existingPromise = this.loadingPromises.get(id);

      if (existingPromise) {
        // Already loading - release mutex and wait for existing promise
        release();
        await existingPromise;
        const loadedEntry = this.cache.get(id);

        // Validate type after loading
        if (loadedEntry && loadedEntry.type !== type) {
          throw new Error(
            `Type mismatch for resource ${id}: loaded as '${loadedEntry.type}', requested as '${type}'`
          );
        }

        if (loadedEntry && loadedEntry.state === ResourceState.LOADED) {
          // Type validated above, safe to cast
          return new ResourceHandle(loadedEntry as ResourceEntry<T>, this.handleRelease);
        }
        entry = loadedEntry;
      }

      if (!entry) {
        // Create entry and start loading atomically
        entry = new ResourceEntry<T>(id, type);
        entry.state = ResourceState.LOADING;
        this.dependencies.register(id);

        // Add to cache before creating promise
        this.cache.add(entry);
      } else {
        // Entry exists (from cache check above), just reload
        entry.state = ResourceState.LOADING;
      }

      // Create promise and register ATOMICALLY under mutex
      loadPromise = this.loadResource<T>(id, type, options);
      this.loadingPromises.set(id, loadPromise as Promise<Resource>);

    } finally {
      // Always release mutex, even if error occurs
      if (this.loadingMutex.isLocked()) {
        release();
      }
    }

    try {
      const resource = await loadPromise;

      entry.state = ResourceState.LOADED;
      entry.data = resource.data;
      entry.size = resource.size;
      entry.loadedAt = Date.now();
      entry.touch();

      // Cancel error cleanup timer on successful load
      const errorTimer = this.errorCleanupTimers.get(id);
      if (errorTimer) {
        clearTimeout(errorTimer);
        this.errorCleanupTimers.delete(id);
      }

      // Track dependencies
      if (resource.metadata?.dependencies) {
        for (const depId of resource.metadata.dependencies) {
          this.dependencies.addDependency(id, depId);
        }
      }

      // Type was validated when entry was created or loaded, safe to cast
      return new ResourceHandle(entry as ResourceEntry<T>, this.handleRelease);
    } catch (error) {
      entry.state = ResourceState.ERROR;
      entry.error = error instanceof Error ? error : new Error(String(error));

      // Cancel any existing cleanup timer for this resource
      const existingTimer = this.errorCleanupTimers.get(id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.errorCleanupTimers.delete(id);
      }

      // Evict oldest error timer if we hit the limit
      if (this.errorCleanupTimers.size >= ResourceManager.MAX_ERROR_TIMERS) {
        const oldestId = this.errorCleanupTimers.keys().next().value;
        const oldestTimer = this.errorCleanupTimers.get(oldestId);
        if (oldestTimer) {
          clearTimeout(oldestTimer);
          this.errorCleanupTimers.delete(oldestId);
          // Immediately clean up the oldest error entry
          const oldEntry = this.cache.get(oldestId);
          if (oldEntry?.state === ResourceState.ERROR && oldEntry.refCount === 0) {
            this.cache.remove(oldestId);
            this.dependencies.unregister(oldestId);
          }
        }
      }

      // Clean up error entries from cache to prevent memory leak
      // Keep in cache briefly for retry, but mark for cleanup
      const cleanupTimer = setTimeout(() => {
        const currentEntry = this.cache.get(id);
        if (currentEntry?.state === ResourceState.ERROR && currentEntry.refCount === 0) {
          this.cache.remove(id);
          this.dependencies.unregister(id);
        }
        // Remove from timer tracking
        this.errorCleanupTimers.delete(id);
      }, ResourceManager.ERROR_CLEANUP_TIMEOUT);

      this.errorCleanupTimers.set(id, cleanupTimer);

      throw error;
    } finally {
      this.loadingPromises.delete(id);
    }
  }

  /**
   * Load resource using registered loader
   */
  private async loadResource<T>(
    id: ResourceId,
    type: ResourceType,
    options?: LoadOptions
  ): Promise<Resource<T>> {
    const loader = this.loaders.get(type);
    if (!loader) {
      throw new Error(`No loader registered for type: ${type}`);
    }

    // Check if loader can handle this resource
    if (loader.canLoad && !loader.canLoad(id)) {
      throw new Error(`Loader cannot load resource: ${id}`);
    }

    const startTime = performance.now();

    try {
      // Load dependencies first if requested
      if (options?.loadDependencies && options.metadata?.dependencies) {
        await this.loadDependencies(options.metadata.dependencies, type, options);
      }

      // Load the resource
      const resource = await this.withTimeout(
        loader.load(id, options),
        options?.timeout
      );

      // Update statistics
      const loadTime = performance.now() - startTime;
      this.stats.totalLoadTime += loadTime;
      this.stats.loadCount++;

      return resource as Resource<T>;
    } catch (error) {
      throw new Error(
        `Failed to load resource ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load dependencies
   */
  private async loadDependencies(
    deps: ResourceId[],
    type: ResourceType,
    options?: LoadOptions
  ): Promise<void> {
    const loadOrder = this.dependencies.getLoadOrder(deps);

    for (const depId of loadOrder) {
      await this.load(depId, type, { ...options, loadDependencies: false });
    }
  }

  /**
   * Wrap promise with timeout
   */
  private withTimeout<T>(
    promise: Promise<T>,
    timeout?: number
  ): Promise<T> {
    if (!timeout) {
      return promise;
    }

    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Load timeout')), timeout)
      ),
    ]);
  }

  /**
   * Handle release from resource handle
   * Generic to maintain type safety through the callback chain
   */
  private handleRelease<T>(_handle: ResourceHandle<T>): void {
    // Resource reference counting is tracked in the entry
    // Cache eviction happens automatically based on policy
  }

  /**
   * Check if resource is loaded
   */
  isLoaded(id: ResourceId): boolean {
    const entry = this.cache.get(id);
    return entry ? entry.state === ResourceState.LOADED : false;
  }

  /**
   * Unload a resource (force eviction)
   */
  async unload(id: ResourceId): Promise<void> {
    const entry = this.cache.get(id);
    if (!entry) {
      return;
    }

    // Check for dependents
    if (this.dependencies.hasDependents(id)) {
      const dependents = this.dependencies.getDependents(id);
      console.warn(
        `Unloading resource with dependents: ${id} (dependents: ${dependents.join(', ')})`
      );
    }

    // Call loader's unload if available
    const loader = this.loaders.get(entry.type);
    if (loader?.unload && entry.data) {
      try {
        await loader.unload({ id, type: entry.type, data: entry.data, size: entry.size });
      } catch (error) {
        console.error(`Error unloading resource ${id}:`, error);
      }
    }

    // Remove from cache and dependencies
    this.cache.forceEvict(id);
    this.dependencies.unregister(id);
  }

  /**
   * Unload all resources
   */
  async unloadAll(): Promise<void> {
    const ids = this.cache.keys();
    for (const id of ids) {
      await this.unload(id);
    }
  }

  /**
   * Get resource statistics
   */
  getStats(): ResourceStats {
    const entries = this.cache.values();
    const byType = new Map<ResourceType, number>();

    for (const entry of entries) {
      const count = byType.get(entry.type) || 0;
      byType.set(entry.type, count + 1);
    }

    return {
      totalResources: entries.length,
      loadedResources: entries.filter((e) => e.state === ResourceState.LOADED).length,
      cacheSize: this.cache.getSize(),
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      evictions: this.cache.getEvictions(),
      byType,
      avgLoadTime: this.stats.loadCount > 0
        ? this.stats.totalLoadTime / this.stats.loadCount
        : 0,
    };
  }

  /**
   * Clear all resources and reset
   */
  async clear(): Promise<void> {
    await this.unloadAll();

    // Clear all error cleanup timers
    for (const timer of this.errorCleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.errorCleanupTimers.clear();

    // Stop hot reload watcher
    if (this.hotReloadWatcher) {
      await this.hotReloadWatcher.stop();
    }

    this.cache.clear();
    this.dependencies.clear();
    this.loadingPromises.clear();
    this.resourcePaths.clear();
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalLoadTime: 0,
      loadCount: 0,
      reloadCount: 0,
    };
  }

  /**
   * Initialize hot-reload watcher (lazy)
   */
  private ensureHotReloadWatcher(): void {
    if (!this.hotReloadConfig || this.hotReloadWatcher) {
      return;
    }

    this.hotReloadWatcher = new HotReloadWatcher(this.hotReloadConfig);
    this.hotReloadWatcher.start(this.handleHotReload.bind(this));
  }

  /**
   * Register a resource path for hot-reload watching
   */
  registerResourcePath(id: ResourceId, path: string, type: ResourceType): void {
    if (!this.hotReloadConfig) {
      return;
    }

    // Lazy initialize watcher on first path registration
    this.ensureHotReloadWatcher();

    this.resourcePaths.set(id, path);
    this.hotReloadWatcher!.registerPath(path, id, type);
  }

  /**
   * Unregister a resource path from hot-reload watching
   */
  unregisterResourcePath(id: ResourceId): void {
    const path = this.resourcePaths.get(id);
    if (path && this.hotReloadWatcher) {
      this.hotReloadWatcher.unregisterPath(path);
      this.resourcePaths.delete(id);
    }
  }

  /**
   * Handle hot-reload event from watcher
   */
  private async handleHotReload(id: ResourceId, type: ResourceType): Promise<void> {
    try {
      // Force reload the resource
      await this.load(id, type, { forceReload: true });
      this.stats.reloadCount++;

      console.log(`Hot-reloaded resource: ${id} (${type})`);
    } catch (error) {
      console.error(`Failed to hot-reload resource ${id}:`, error);
    }
  }

  /**
   * Get hot-reload statistics
   */
  getReloadCount(): number {
    return this.stats.reloadCount;
  }

  /**
   * Check if hot-reload is enabled
   */
  isHotReloadEnabled(): boolean {
    return this.hotReloadWatcher !== null && this.hotReloadWatcher.isRunning();
  }

  /**
   * Get all cached resource entries (for profiling/debugging)
   * @internal Used by MemoryProfiler
   */
  getResourceEntries(): ResourceEntry[] {
    return this.cache.values();
  }
}
