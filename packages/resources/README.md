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

- **LRU** (Least Recently Used): Good for general purpose
- **LFU** (Least Frequently Used): Good for hot/cold data patterns
- **FIFO** (First In First Out): Simple and predictable
- **SIZE** (Largest First): Maximize freed memory per eviction

```typescript
const manager = new ResourceManager({
  maxSize: 100_000_000,
  evictionPolicy: EvictionPolicy.LRU, // or LFU, FIFO, SIZE
});
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

// Load with dependencies - loads in topological order automatically
const handle = await manager.load('character.model', 'model', {
  loadDependencies: true,
});
```

## Development Tools

### Hot-Reload

Enable automatic resource reloading when files change:

```typescript
const manager = new ResourceManager(
  {
    maxSize: 100_000_000,
    evictionPolicy: EvictionPolicy.LRU,
  },
  {
    enabled: process.env.NODE_ENV === 'development',
    watchPaths: ['./assets'],
    debounceMs: 100,
    persistent: false, // Allows clean shutdown
  }
);

// Register paths for watching
manager.registerResourcePath('player.png', './assets/player.png', 'texture');

// Resources automatically reload when files change
console.log(`Resources reloaded: ${manager.getReloadCount()}`);
```

### Memory Profiling

Track memory usage and detect potential leaks:

```typescript
import { MemoryProfiler } from '@miskatonic/resources';

const profiler = new MemoryProfiler({
  enabled: true,
  maxSnapshots: 100,
  snapshotInterval: 5000, // Snapshot every 5 seconds
  leakAgeThreshold: 300000, // Flag resources older than 5 minutes
});

profiler.start(manager);

// Take manual snapshots
const snapshot = profiler.takeSnapshot(manager);
console.log(`Memory: ${snapshot.totalMemory / 1024 / 1024} MB`);

// Detect potential leaks
const leaks = profiler.detectLeaks(manager);
for (const leak of leaks) {
  console.warn(`Potential leak: ${leak.id} - ${leak.reason}`);
}

// Generate report
const report = profiler.generateReport(manager);
console.log(report);
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
      data: { bitmap, width: bitmap.width, height: bitmap.height },
      size: blob.size,
      metadata: { format: blob.type },
    };
  },

  async unload(resource) {
    resource.data.bitmap.close();
  },
};

manager.registerLoader(textureLoader);
```

### Error Handling & Options

```typescript
// Basic error handling
try {
  const handle = await manager.load('missing-resource.png', 'texture');
} catch (error) {
  console.error('Failed to load resource:', error);
}

// Check error state
const handle = await manager.load('resource', 'type').catch(() => null);
if (handle?.hasError()) {
  console.error('Resource error:', handle.getError());
}

// Force reload even if cached
const handle = await manager.load('resource', 'type', {
  forceReload: true,
});

// Timeout if loading takes too long
const handle = await manager.load('resource', 'type', {
  timeout: 5000,
});
```

## Performance

### Statistics

Track cache performance:

```typescript
const stats = manager.getStats();

console.log({
  totalResources: stats.totalResources,
  loadedResources: stats.loadedResources,
  cacheSize: stats.cacheSize,
  hitRate: stats.cacheHits / (stats.cacheHits + stats.cacheMisses),
  evictions: stats.evictions,
  avgLoadTime: stats.avgLoadTime,
  byType: stats.byType,
});
```

### Best Practices

- **Cache Size**: Set `maxSize` appropriately for your memory budget
- **Eviction Policy**: Choose based on access patterns (LRU for general, LFU for hot/cold data)
- **Reference Counting**: Always call `release()` on handles when done
- **Dependency Loading**: Use sparingly for deeply nested dependencies
- **Hot-Reload**: Only enable in development (has overhead)
- **Memory Profiling**: Use sampling mode in production (reduce snapshot frequency)

### Production Configuration

```typescript
const manager = new ResourceManager(
  {
    maxSize: 500 * 1024 * 1024, // 500 MB cache
    maxCount: 10000,
    evictionPolicy: EvictionPolicy.LRU,
    ttl: 3600000, // 1 hour
  },
  // Hot-reload only in development
  process.env.NODE_ENV === 'development' ? {
    enabled: true,
    watchPaths: ['./assets'],
    persistent: false,
  } : undefined
);

// Production profiling with sampling
const profiler = new MemoryProfiler({
  enabled: process.env.ENABLE_PROFILING === 'true',
  maxSnapshots: 50,
  snapshotInterval: 60000, // 1 minute
});
```

## API Reference

### ResourceManager

**Resource Loading:**
- `load<T>(id, type, options?)` - Load a resource (returns handle)
- `unload(id)` - Unload specific resource
- `unloadAll()` - Unload all resources
- `isLoaded(id)` - Check if resource is loaded

**Loader Management:**
- `registerLoader(loader)` - Register a resource loader
- `unregisterLoader(type)` - Unregister a loader

**Statistics & Control:**
- `getStats()` - Get cache statistics
- `clear()` - Clear all resources and reset

**Hot-Reload:**
- `registerResourcePath(id, path, type)` - Register path for hot-reload
- `unregisterResourcePath(id)` - Unregister path
- `getReloadCount()` - Get number of hot-reloads

### ResourceHandle<T>

- `get()` - Get resource data (throws if not loaded)
- `isLoaded()` - Check if resource is loaded
- `hasError()` - Check if resource has error
- `getError()` - Get error if any
- `release()` - Release reference
- `addRef()` - Add reference (clone handle)
- `getRefCount()` - Get current reference count

### MemoryProfiler

- `start(manager)` - Start automatic snapshotting
- `stop()` - Stop automatic snapshotting
- `takeSnapshot(manager)` - Take manual snapshot
- `detectLeaks(manager)` - Detect potential memory leaks
- `generateReport(manager)` - Generate detailed report
- `getGrowthRate()` - Get memory growth rate

For detailed API documentation, see TypeScript definitions or generated TypeDoc.

## Testing

```bash
npm test                 # Run all tests
npm run test:coverage    # Run with coverage report
```

**Test coverage: 91/91 tests passing** (100% success rate)

## License

MIT
