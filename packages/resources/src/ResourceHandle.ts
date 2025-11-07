import type { ResourceId, ResourceType, ResourceState, ResourceHandle as IResourceHandle } from './types';
import { ResourceState as State } from './types';

/**
 * Internal resource entry with reference counting
 */
export class ResourceEntry<T = unknown> {
  public refCount = 0;
  public state: ResourceState = State.UNLOADED;
  public data: T | null = null;
  public error: Error | null = null;
  public size = 0;
  public lastAccessed: number = Date.now();
  public accessCount = 0;
  public loadedAt: number = 0;

  constructor(
    public readonly id: ResourceId,
    public readonly type: ResourceType
  ) {}

  /**
   * Mark resource as accessed (for LRU/LFU)
   */
  touch(): void {
    this.lastAccessed = Date.now();
    this.accessCount++;
  }

  /**
   * Check if resource can be evicted (refCount === 0)
   */
  canEvict(): boolean {
    return this.refCount === 0;
  }
}

/**
 * Resource handle with reference counting
 * Users hold handles to resources, not direct references
 */
export class ResourceHandle<T = unknown> implements IResourceHandle<T> {
  private released = false;

  constructor(
    private readonly entry: ResourceEntry<T>,
    private readonly onRelease: (handle: ResourceHandle<T>) => void
  ) {
    this.entry.refCount++;
  }

  get id(): ResourceId {
    return this.entry.id;
  }

  get type(): ResourceType {
    return this.entry.type;
  }

  /**
   * Get the underlying resource data
   * Throws if resource is not loaded
   */
  get(): T {
    if (this.released) {
      throw new Error(`Cannot access released resource: ${this.id}`);
    }

    // Check if entry was evicted (use-after-free protection)
    if (this.entry.state === State.EVICTED) {
      throw new Error(`Resource was evicted: ${this.id}`);
    }

    if (this.entry.state !== State.LOADED) {
      throw new Error(
        `Resource not loaded: ${this.id} (state: ${this.entry.state})`
      );
    }

    if (this.entry.data === null) {
      throw new Error(`Resource data is null: ${this.id}`);
    }

    this.entry.touch();
    return this.entry.data;
  }

  /**
   * Check if resource is loaded
   */
  isLoaded(): boolean {
    return this.entry.state === State.LOADED && this.entry.data !== null;
  }

  /**
   * Check if resource has error
   */
  hasError(): boolean {
    return this.entry.state === State.ERROR;
  }

  /**
   * Get resource state
   */
  getState(): ResourceState {
    return this.entry.state;
  }

  /**
   * Get error if any
   */
  getError(): Error | null {
    return this.entry.error;
  }

  /**
   * Release reference to resource
   * Resource may be evicted when refCount reaches 0
   */
  release(): void {
    if (this.released) {
      console.warn(`Resource handle already released: ${this.id}`);
      return;
    }

    this.released = true;
    this.entry.refCount--;

    if (this.entry.refCount < 0) {
      console.error(`Negative refCount for resource: ${this.id}`);
      this.entry.refCount = 0;
    }

    this.onRelease(this);
  }

  /**
   * Add a reference (clone handle)
   * Creates a new handle that shares the same resource entry
   */
  addRef(): ResourceHandle<T> {
    if (this.released) {
      throw new Error(`Cannot add ref to released resource: ${this.id}`);
    }

    return new ResourceHandle(this.entry, this.onRelease);
  }

  /**
   * Get current reference count (for debugging)
   */
  getRefCount(): number {
    return this.entry.refCount;
  }

  /**
   * Check if this handle has been released
   */
  isReleased(): boolean {
    return this.released;
  }
}
