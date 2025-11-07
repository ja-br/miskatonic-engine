# @miskatonic/resources

Production-ready resource management system for the Miskatonic Engine.

## Features

- **Async Resource Loading**: Non-blocking resource loading with registered loaders
- **Reference Counting**: Automatic lifecycle management with handle-based references
- **Smart Caching**: Multiple eviction policies (LRU, LFU, FIFO, SIZE)
- **Dependency Tracking**: DAG-based dependency resolution with topological sorting
- **Hot-Reload**: File watching and automatic resource reloading during development
- **Memory Profiling**: Advanced tools for tracking memory usage and detecting leaks
- **Type Safe**: Full TypeScript support with strict typing
- **Production Ready**: Mutex-protected concurrent loading, bounded memory usage, comprehensive error handling

## Installation

```bash
npm install @miskatonic/resources
```

## Quick Start

```typescript
import { ResourceManager, EvictionPolicy } from '@miskatonic/resources';

// Create resource manager
const manager = new ResourceManager({
  maxSize: 100 * 1024 * 1024, // 100 MB
  evictionPolicy: EvictionPolicy.LRU,
});

// Register a resource loader
manager.registerLoader({
  type: 'texture',
  async load(id, options) {
    const response = await fetch(id);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    return {
      id,
      type: 'texture',
      data: bitmap,
      size: blob.size,
    };
  },
});

// Load a resource
const handle = await manager.load('assets/player.png', 'texture');
const texture = handle.get();

// Use the resource...

// Release when done
handle.release();
```

## Core Concepts

### Resource Handles

Resources are accessed through handles that track references:

```typescript
const handle = await manager.load('resource-id', 'type');

// Add reference (clone handle)
const handle2 = handle.addRef();

// Check state
if (handle.isLoaded()) {
  const data = handle.get();
}

// Release references
handle.release();
handle2.release();
// Resource can now be evicted when cache is full
```

### Cache Eviction Policies

Choose the policy that fits your use case:

```typescript
import { EvictionPolicy } from '@miskatonic/resources';

// Least Recently Used (good for general purpose)
const manager = new ResourceManager({
  maxSize: 100_000_000,
  evictionPolicy: EvictionPolicy.LRU,
});

// Least Frequently Used (good for hot/cold data)
evictionPolicy: EvictionPolicy.LFU,

// First In First Out (simple, predictable)
evictionPolicy: EvictionPolicy.FIFO,

// Largest First (maximize freed memory)
evictionPolicy: EvictionPolicy.SIZE,
```

### Dependency Tracking

Automatically load dependencies in correct order:

```typescript
manager.registerLoader({
  type: 'model',
  async load(id, options) {
    const modelData = await loadModelData(id);

    return {
      id,
      type: 'model',
      data: modelData,
      size: modelData.byteLength,
      metadata: {
        dependencies: ['texture1.png', 'texture2.png'],
      },
    };
  },
});

// Load with dependencies
const handle = await manager.load('character.model', 'model', {
  loadDependencies: true,
});
// Dependencies loaded in topological order automatically
```

## Hot-Reload (Development)

Enable automatic resource reloading when files change:

```typescript
import { ResourceManager } from '@miskatonic/resources';

const manager = new ResourceManager(
  {
    maxSize: 100_000_000,
    evictionPolicy: EvictionPolicy.LRU,
  },
  {
    // Hot-reload configuration
    enabled: process.env.NODE_ENV === 'development',
    watchPaths: ['./assets'],
    debounceMs: 100, // Debounce file changes (prevent rapid reloads)
    ignored: ['**/*.tmp', '**/node_modules/**'],
    persistent: false, // Don't keep process alive (allows clean shutdown)
    maxDebounceTimers: 1000, // Limit concurrent timers (prevents memory leak)
  }
);

// Watcher is lazy-initialized on first path registration (no startup overhead)
// Register resource paths for watching
manager.registerResourcePath('player.png', './assets/player.png', 'texture');

// Resources automatically reload when files change
// Check reload statistics
console.log(`Resources reloaded: ${manager.getReloadCount()}`);
```

## Memory Profiling

Track memory usage and detect potential leaks:

```typescript
import { MemoryProfiler } from '@miskatonic/resources';

const profiler = new MemoryProfiler({
  enabled: true,
  maxSnapshots: 100, // Bounded history (prevents memory leak)
  maxEvents: 1000, // Bounded allocation history
  snapshotInterval: 5000, // Take snapshot every 5 seconds (0 = manual only)
  leakAgeThreshold: 300000, // 5 minutes - flag old unreferenced resources
  leakRefCountThreshold: 100, // Flag resources with unusually high ref counts
});

// Start automatic profiling
profiler.start(manager);

// Or take manual snapshots
const snapshot = profiler.takeSnapshot(manager);
console.log(`Total memory: ${snapshot.totalMemory / 1024 / 1024} MB`);
console.log(`Resource count: ${snapshot.resourceCount}`);

// Detect potential leaks
const leaks = profiler.detectLeaks(manager);
for (const leak of leaks) {
  console.warn(`Potential leak: ${leak.id} - ${leak.reason}`);
}

// Generate detailed report
const report = profiler.generateReport(manager);
console.log(report);

// Check memory growth
const growthRate = profiler.getGrowthRate();
if (growthRate && growthRate > 1024 * 1024) {
  console.warn(`High memory growth: ${growthRate / 1024} KB/s`);
}
```

## Advanced Usage

### Custom Resource Loaders

```typescript
interface TextureData {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

const textureLoader: ResourceLoader<TextureData> = {
  type: 'texture',

  // Optional: check if this loader can handle a resource
  canLoad(id) {
    return id.endsWith('.png') || id.endsWith('.jpg');
  },

  async load(id, options) {
    const response = await fetch(id);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    return {
      id,
      type: 'texture',
      data: {
        bitmap,
        width: bitmap.width,
        height: bitmap.height,
      },
      size: blob.size,
      metadata: {
        format: blob.type,
      },
    };
  },

  // Optional: cleanup when resource is unloaded
  async unload(resource) {
    resource.data.bitmap.close();
  },
};

manager.registerLoader(textureLoader);
```

### Error Handling

```typescript
try {
  const handle = await manager.load('missing-resource.png', 'texture');
} catch (error) {
  console.error('Failed to load resource:', error);
}

// Check handle state
const handle = await manager.load('resource', 'type').catch(() => null);
if (handle?.hasError()) {
  const error = handle.getError();
  console.error('Resource error:', error);
}
```

### Force Reload

```typescript
// Reload even if already cached
const handle = await manager.load('resource', 'type', {
  forceReload: true,
});
```

### Timeout

```typescript
// Fail if loading takes too long
const handle = await manager.load('resource', 'type', {
  timeout: 5000, // 5 seconds
});
```

## Statistics

Track cache performance:

```typescript
const stats = manager.getStats();

console.log({
  totalResources: stats.totalResources,
  loadedResources: stats.loadedResources,
  cacheSize: stats.cacheSize,
  cacheHits: stats.cacheHits,
  cacheMisses: stats.cacheMisses,
  hitRate: stats.cacheHits / (stats.cacheHits + stats.cacheMisses),
  evictions: stats.evictions,
  avgLoadTime: stats.avgLoadTime,
  byType: stats.byType, // Map<ResourceType, number>
});
```

## API Reference

### ResourceManager

- `constructor(cacheConfig, hotReloadConfig?)`: Create resource manager
- `registerLoader(loader)`: Register a resource loader
- `unregisterLoader(type)`: Unregister a loader
- `load<T>(id, type, options?)`: Load a resource
- `unload(id)`: Unload a specific resource
- `unloadAll()`: Unload all resources
- `isLoaded(id)`: Check if resource is loaded
- `getStats()`: Get cache statistics
- `clear()`: Clear all resources and reset
- `registerResourcePath(id, path, type)`: Register path for hot-reload
- `unregisterResourcePath(id)`: Unregister path from hot-reload
- `getReloadCount()`: Get number of hot-reloads
- `isHotReloadEnabled()`: Check if hot-reload is active

### ResourceHandle<T>

- `get()`: Get the resource data (throws if not loaded)
- `isLoaded()`: Check if resource is loaded
- `hasError()`: Check if resource has error
- `getState()`: Get resource state
- `getError()`: Get error if any
- `release()`: Release reference
- `addRef()`: Add reference (clone handle)
- `getRefCount()`: Get current reference count
- `isReleased()`: Check if handle is released

### MemoryProfiler

- `constructor(config)`: Create memory profiler
- `start(manager)`: Start automatic snapshotting
- `stop()`: Stop automatic snapshotting
- `takeSnapshot(manager)`: Take manual snapshot
- `detectLeaks(manager)`: Detect potential memory leaks
- `getGrowthRate()`: Get memory growth rate
- `generateReport(manager)`: Generate detailed report
- `getSnapshots()`: Get all snapshots
- `getLatestSnapshot()`: Get most recent snapshot
- `getAllocationEvents()`: Get allocation history
- `clear()`: Clear all profiling data

### HotReloadWatcher

- `constructor(config)`: Create hot-reload watcher
- `start(callback)`: Start watching files
- `stop()`: Stop watching
- `registerPath(path, id, type)`: Register path to watch
- `unregisterPath(path)`: Unregister path
- `getRegisteredPaths()`: Get all registered paths
- `isPathRegistered(path)`: Check if path is registered
- `isRunning()`: Check if watcher is active

## Performance Considerations

- **Cache Size**: Set `maxSize` appropriately for your memory budget
- **Eviction Policy**: Choose based on access patterns (LRU for general, LFU for hot/cold data)
- **Reference Counting**: Always call `release()` on handles when done
- **Dependency Loading**: Use sparingly for deeply nested dependencies
- **Hot-Reload**: Only enable in development (has overhead)
- **Memory Profiling**: Use sampling mode in production (reduce snapshot frequency)

## Production Readiness

The resource management system has been hardened for production with:

### Critical Fixes Applied

1. **Concurrent Access Protection**
   - Mutex-protected resource loading (no race conditions)
   - Atomic promise management for concurrent requests
   - Type-safe throughout with generic callbacks

2. **Memory Leak Prevention**
   - Bounded error cleanup timers (5s timeout, max 100 concurrent)
   - Bounded debounce timers in hot-reload (max 1000)
   - Bounded profiler history (configurable snapshot/event limits)
   - Proper cleanup in all lifecycle methods

3. **Resource Leak Prevention**
   - Hot-reload watcher with `persistent: false` (clean process shutdown)
   - Lazy initialization (no overhead if unused)
   - Use-after-free protection with EVICTED state
   - Proper chokidar cleanup

4. **Configuration & Safety**
   - Infinite loop protection in cache eviction
   - Configurable leak detection thresholds (no false positives)
   - Type validation prevents cross-type ID pollution
   - Public APIs instead of type casts

### Production Configuration Recommendations

```typescript
// Production-ready configuration
const manager = new ResourceManager(
  {
    maxSize: 500 * 1024 * 1024, // 500 MB cache
    maxCount: 10000, // Limit total resources
    evictionPolicy: EvictionPolicy.LRU,
    ttl: 3600000, // 1 hour TTL
  },
  // Hot-reload: disabled in production
  process.env.NODE_ENV === 'development' ? {
    enabled: true,
    watchPaths: ['./assets'],
    persistent: false, // Important: allows clean shutdown
    maxDebounceTimers: 1000,
  } : undefined
);

// Optional: Production profiling with sampling
const profiler = new MemoryProfiler({
  enabled: process.env.ENABLE_PROFILING === 'true',
  maxSnapshots: 50, // Reduce for production
  snapshotInterval: 60000, // 1 minute sampling
  leakAgeThreshold: 600000, // 10 minutes
  leakRefCountThreshold: 200, // Adjust based on your app
});
```

### Test Coverage

- **91/91 tests passing** (100% success rate)
- Full TypeScript type checking
- Concurrent loading tests
- Memory leak detection tests
- Hot-reload file watching tests
- All critical edge cases covered

## Testing

```bash
npm test                 # Run all tests
npm run test:coverage    # Run with coverage report
```

## License

MIT
