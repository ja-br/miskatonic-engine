import type { ResourceId, CacheConfig } from './types';
import { EvictionPolicy as Policy, ResourceState as State } from './types';
import type { ResourceEntry } from './ResourceHandle';

/**
 * Resource cache with configurable eviction policies
 * Manages memory limits and automatic eviction
 */
export class ResourceCache<T = unknown> {
  private entries = new Map<ResourceId, ResourceEntry<T>>();
  private currentSize = 0;
  private evictionCount = 0;

  constructor(private readonly config: CacheConfig) {}

  /**
   * Add resource to cache
   */
  add(entry: ResourceEntry<T>): void {
    // Check if already in cache
    if (this.entries.has(entry.id)) {
      console.warn(`Resource already in cache: ${entry.id}`);
      return;
    }

    // Evict if necessary to make room
    this.evictIfNeeded(entry.size);

    this.entries.set(entry.id, entry);
    this.currentSize += entry.size;
  }

  /**
   * Get resource from cache
   */
  get(id: ResourceId): ResourceEntry<T> | undefined {
    const entry = this.entries.get(id);
    if (entry) {
      entry.touch(); // Update access time/count for LRU/LFU
    }
    return entry;
  }

  /**
   * Check if resource is in cache
   */
  has(id: ResourceId): boolean {
    return this.entries.has(id);
  }

  /**
   * Remove resource from cache
   */
  remove(id: ResourceId): ResourceEntry<T> | undefined {
    const entry = this.entries.get(id);
    if (entry) {
      this.entries.delete(id);
      this.currentSize -= entry.size;
      return entry;
    }
    return undefined;
  }

  /**
   * Get all cached resource IDs
   */
  keys(): ResourceId[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get all cached entries
   */
  values(): ResourceEntry<T>[] {
    return Array.from(this.entries.values());
  }

  /**
   * Get cache size in bytes
   */
  getSize(): number {
    return this.currentSize;
  }

  /**
   * Get number of cached resources
   */
  getCount(): number {
    return this.entries.size;
  }

  /**
   * Get eviction count
   */
  getEvictions(): number {
    return this.evictionCount;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.entries.clear();
    this.currentSize = 0;
  }

  /**
   * Evict resources if cache limits are exceeded
   */
  private evictIfNeeded(incomingSize: number): void {
    // Check size limit (with infinite loop protection)
    let evictionAttempts = 0;
    const maxAttempts = this.entries.size; // Can't evict more than total entries

    while (
      this.currentSize + incomingSize > this.config.maxSize &&
      this.entries.size > 0 &&
      evictionAttempts < maxAttempts
    ) {
      const evicted = this.evictOne();
      if (!evicted) {
        // No more resources can be evicted (all have refCount > 0)
        console.warn(
          `Cannot evict more resources - all have active references. ` +
          `Cache size: ${this.currentSize}, max: ${this.config.maxSize}, ` +
          `incoming: ${incomingSize}`
        );
        break;
      }
      evictionAttempts++;
    }

    // Check count limit (with infinite loop protection)
    evictionAttempts = 0;
    if (this.config.maxCount) {
      while (
        this.entries.size >= this.config.maxCount &&
        evictionAttempts < maxAttempts
      ) {
        const evicted = this.evictOne();
        if (!evicted) {
          console.warn(
            `Cannot evict more resources - all have active references. ` +
            `Cache count: ${this.entries.size}, max: ${this.config.maxCount}`
          );
          break;
        }
        evictionAttempts++;
      }
    }

    // TTL-based eviction
    if (this.config.ttl && this.config.ttl > 0) {
      this.evictExpired();
    }
  }

  /**
   * Evict one resource based on eviction policy
   */
  private evictOne(): boolean {
    const candidate = this.selectEvictionCandidate();
    if (!candidate) {
      console.warn('No eviction candidate found (all resources have refCount > 0)');
      return false;
    }

    // Mark as evicted for use-after-free detection
    candidate.state = State.EVICTED;

    this.entries.delete(candidate.id);
    this.currentSize -= candidate.size;
    this.evictionCount++;
    return true;
  }

  /**
   * Select resource to evict based on policy
   */
  private selectEvictionCandidate(): ResourceEntry<T> | null {
    const candidates = this.values().filter((entry) => entry.canEvict());

    if (candidates.length === 0) {
      return null;
    }

    switch (this.config.evictionPolicy) {
      case Policy.LRU:
        // Least Recently Used
        return candidates.reduce((oldest, entry) =>
          entry.lastAccessed < oldest.lastAccessed ? entry : oldest
        );

      case Policy.LFU:
        // Least Frequently Used
        return candidates.reduce((least, entry) =>
          entry.accessCount < least.accessCount ? entry : least
        );

      case Policy.FIFO:
        // First In First Out
        return candidates.reduce((oldest, entry) =>
          entry.loadedAt < oldest.loadedAt ? entry : oldest
        );

      case Policy.SIZE:
        // Largest first (to free most memory)
        return candidates.reduce((largest, entry) =>
          entry.size > largest.size ? entry : largest
        );

      default:
        // Default to LRU
        return candidates.reduce((oldest, entry) =>
          entry.lastAccessed < oldest.lastAccessed ? entry : oldest
        );
    }
  }

  /**
   * Evict expired resources based on TTL
   */
  private evictExpired(): void {
    if (!this.config.ttl || this.config.ttl === 0) {
      return;
    }

    const now = Date.now();
    const expired: ResourceId[] = [];

    for (const [id, entry] of this.entries) {
      if (
        entry.canEvict() &&
        now - entry.lastAccessed > this.config.ttl
      ) {
        expired.push(id);
      }
    }

    for (const id of expired) {
      const entry = this.entries.get(id);
      if (entry) {
        entry.state = State.EVICTED;
        this.entries.delete(id);
        this.currentSize -= entry.size;
        this.evictionCount++;
      }
    }
  }

  /**
   * Force eviction of specific resource (even if refCount > 0)
   * WARNING: Use with caution - may cause errors if handles exist
   */
  forceEvict(id: ResourceId): boolean {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }

    // Mark as evicted for use-after-free detection
    entry.state = State.EVICTED;

    this.entries.delete(id);
    this.currentSize -= entry.size;
    this.evictionCount++;

    if (entry.refCount > 0) {
      console.warn(
        `Force evicted resource with active references: ${id} (refCount: ${entry.refCount})`
      );
    }

    return true;
  }
}
