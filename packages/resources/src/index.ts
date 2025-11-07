// Core exports
export { ResourceManager } from './ResourceManager';
export { ResourceHandle, ResourceEntry } from './ResourceHandle';
export { ResourceCache } from './ResourceCache';
export { DependencyTracker } from './DependencyTracker';
export { HotReloadWatcher } from './HotReloadWatcher';
export { MemoryProfiler } from './MemoryProfiler';

// Type exports
export type {
  Resource,
  ResourceId,
  ResourceType,
  ResourceState,
  ResourceMetadata,
  ResourceHandle as IResourceHandle,
  ResourceLoader,
  LoadOptions,
  CacheConfig,
  ResourceStats,
  ResourceEvents,
  DependencyNode,
} from './types';

export type { HotReloadConfig } from './HotReloadWatcher';
export type {
  MemorySnapshot,
  TypeMemoryInfo,
  ResourceMemoryInfo,
  AllocationEvent,
  LeakCandidate,
  ProfilerConfig,
} from './MemoryProfiler';

export { ResourceState as ResourceStateEnum, EvictionPolicy } from './types';
