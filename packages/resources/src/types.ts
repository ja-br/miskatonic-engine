/**
 * Resource Management Types
 *
 * Core types for the resource management system including:
 * - Resource identification and metadata
 * - Loader interfaces for different resource types
 * - Cache configuration and eviction policies
 * - Dependency tracking
 */

/**
 * Unique identifier for a resource
 */
export type ResourceId = string;

/**
 * Resource type identifier (e.g., 'texture', 'audio', 'model', 'shader')
 */
export type ResourceType = string;

/**
 * Resource loading state
 */
export enum ResourceState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error',
  EVICTED = 'evicted',
}

/**
 * Base resource interface
 * All resources must implement this interface
 */
export interface Resource<T = unknown> {
  readonly id: ResourceId;
  readonly type: ResourceType;
  readonly data: T;
  readonly size: number; // Size in bytes
  readonly metadata?: ResourceMetadata;
}

/**
 * Resource metadata for tracking and debugging
 */
export interface ResourceMetadata {
  readonly path?: string;
  readonly loadTime?: number; // Time to load in ms
  readonly lastAccessed?: number; // Timestamp
  readonly dependencies?: ResourceId[];
  readonly tags?: string[];
  readonly version?: string;
}

/**
 * Resource handle for tracking references
 * Users interact with handles, not raw resources
 */
export interface ResourceHandle<T = unknown> {
  readonly id: ResourceId;
  readonly type: ResourceType;

  /**
   * Get the underlying resource data
   * Throws if resource is not loaded
   */
  get(): T;

  /**
   * Check if resource is loaded
   */
  isLoaded(): boolean;

  /**
   * Check if resource has error
   */
  hasError(): boolean;

  /**
   * Get resource state
   */
  getState(): ResourceState;

  /**
   * Release reference to resource
   * Resource may be evicted when refCount reaches 0
   */
  release(): void;

  /**
   * Add a reference (clone handle)
   */
  addRef(): ResourceHandle<T>;
}

/**
 * Resource loader interface
 * Implement this to add support for new resource types
 */
export interface ResourceLoader<T = unknown> {
  readonly type: ResourceType;

  /**
   * Load a resource from a path or identifier
   */
  load(id: ResourceId, options?: LoadOptions): Promise<Resource<T>>;

  /**
   * Optional: Unload a resource and free memory
   */
  unload?(resource: Resource<T>): void | Promise<void>;

  /**
   * Optional: Check if this loader can handle the given resource ID
   */
  canLoad?(id: ResourceId): boolean;
}

/**
 * Options for loading resources
 */
export interface LoadOptions {
  /**
   * Force reload even if already cached
   */
  forceReload?: boolean;

  /**
   * Load dependencies automatically
   */
  loadDependencies?: boolean;

  /**
   * Priority for loading queue (higher = sooner)
   */
  priority?: number;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * Custom metadata to attach
   */
  metadata?: Partial<ResourceMetadata>;
}

/**
 * Cache eviction policy
 */
export enum EvictionPolicy {
  /**
   * Least Recently Used - evict resources not accessed recently
   */
  LRU = 'lru',

  /**
   * Least Frequently Used - evict resources with lowest access count
   */
  LFU = 'lfu',

  /**
   * First In First Out - evict oldest resources
   */
  FIFO = 'fifo',

  /**
   * Size-based - evict largest resources first
   */
  SIZE = 'size',
}

/**
 * Resource cache configuration
 */
export interface CacheConfig {
  /**
   * Maximum cache size in bytes
   */
  maxSize: number;

  /**
   * Maximum number of resources
   */
  maxCount?: number;

  /**
   * Eviction policy when limits are exceeded
   */
  evictionPolicy: EvictionPolicy;

  /**
   * Time in ms before unused resources are evicted (0 = never)
   */
  ttl?: number;

  /**
   * Enable hot-reload support
   */
  hotReload?: boolean;
}

/**
 * Resource manager statistics
 */
export interface ResourceStats {
  totalResources: number;
  loadedResources: number;
  cacheSize: number; // bytes
  cacheHits: number;
  cacheMisses: number;
  evictions: number;
  byType: Map<ResourceType, number>;
  avgLoadTime: number;
}

/**
 * Event types for resource lifecycle
 */
export interface ResourceEvents {
  'resource:loading': { id: ResourceId; type: ResourceType };
  'resource:loaded': { id: ResourceId; type: ResourceType; loadTime: number };
  'resource:error': { id: ResourceId; type: ResourceType; error: Error };
  'resource:evicted': { id: ResourceId; type: ResourceType };
  'resource:reloaded': { id: ResourceId; type: ResourceType };
  'cache:full': { size: number; maxSize: number };
}

/**
 * Dependency graph node
 */
export interface DependencyNode {
  id: ResourceId;
  dependencies: Set<ResourceId>;
  dependents: Set<ResourceId>; // Resources that depend on this one
}
