import type { ResourceId, ResourceType, ResourceState } from './types';
import type { ResourceManager } from './ResourceManager';
import type { ResourceEntry } from './ResourceHandle';

/**
 * Memory snapshot at a point in time
 */
export interface MemorySnapshot {
  timestamp: number;
  totalMemory: number;
  resourceCount: number;
  byType: Map<ResourceType, TypeMemoryInfo>;
  byState: Map<ResourceState, number>;
  topConsumers: ResourceMemoryInfo[];
}

/**
 * Memory info for a resource type
 */
export interface TypeMemoryInfo {
  count: number;
  totalSize: number;
  avgSize: number;
}

/**
 * Memory info for an individual resource
 */
export interface ResourceMemoryInfo {
  id: ResourceId;
  type: ResourceType;
  size: number;
  state: ResourceState;
  refCount: number;
  age: number; // milliseconds since loaded
}

/**
 * Memory allocation event
 */
export interface AllocationEvent {
  timestamp: number;
  id: ResourceId;
  type: ResourceType;
  size: number;
  action: 'allocated' | 'freed';
}

/**
 * Memory leak candidate
 */
export interface LeakCandidate {
  id: ResourceId;
  type: ResourceType;
  size: number;
  age: number;
  refCount: number;
  reason: string;
}

/**
 * Memory profiler configuration
 */
export interface ProfilerConfig {
  /**
   * Enable profiling
   */
  enabled: boolean;

  /**
   * Maximum number of snapshots to keep
   */
  maxSnapshots?: number;

  /**
   * Maximum number of allocation events to track
   */
  maxEvents?: number;

  /**
   * Snapshot interval in milliseconds (0 = manual only)
   */
  snapshotInterval?: number;

  /**
   * Age threshold for leak detection (milliseconds)
   */
  leakAgeThreshold?: number;

  /**
   * Reference count threshold for leak detection
   * Resources with more than this many references may be flagged as leaks
   */
  leakRefCountThreshold?: number;
}

/**
 * Memory profiler for resource tracking
 *
 * Tracks memory usage, allocation patterns, and detects potential leaks
 */
export class MemoryProfiler {
  private snapshots: MemorySnapshot[] = [];
  private allocationEvents: AllocationEvent[] = [];
  private config: Required<ProfilerConfig>;
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(config: ProfilerConfig) {
    this.config = {
      maxSnapshots: 100,
      maxEvents: 1000,
      snapshotInterval: 0,
      leakAgeThreshold: 300000, // 5 minutes
      leakRefCountThreshold: 100, // High ref count warning
      ...config,
    };
  }

  /**
   * Start automatic snapshotting
   */
  start(resourceManager: ResourceManager): void {
    if (!this.config.enabled || this.config.snapshotInterval === 0) {
      return;
    }

    if (this.snapshotTimer) {
      console.warn('MemoryProfiler already started');
      return;
    }

    this.snapshotTimer = setInterval(() => {
      this.takeSnapshot(resourceManager);
    }, this.config.snapshotInterval);
  }

  /**
   * Stop automatic snapshotting
   */
  stop(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }

  /**
   * Take a memory snapshot
   */
  takeSnapshot(resourceManager: ResourceManager): MemorySnapshot {
    const entries = this.getResourceEntries(resourceManager);

    const byType = new Map<ResourceType, TypeMemoryInfo>();
    const byState = new Map<ResourceState, number>();
    const resourceInfos: ResourceMemoryInfo[] = [];

    let totalMemory = 0;

    for (const entry of entries) {
      totalMemory += entry.size;

      // By type
      const typeInfo = byType.get(entry.type) || { count: 0, totalSize: 0, avgSize: 0 };
      typeInfo.count++;
      typeInfo.totalSize += entry.size;
      typeInfo.avgSize = typeInfo.totalSize / typeInfo.count;
      byType.set(entry.type, typeInfo);

      // By state
      byState.set(entry.state, (byState.get(entry.state) || 0) + 1);

      // Individual resource info
      const age = entry.loadedAt > 0 ? Date.now() - entry.loadedAt : 0;
      resourceInfos.push({
        id: entry.id,
        type: entry.type,
        size: entry.size,
        state: entry.state,
        refCount: entry.refCount,
        age,
      });
    }

    // Sort by size descending for top consumers
    const topConsumers = resourceInfos
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      totalMemory,
      resourceCount: entries.length,
      byType,
      byState,
      topConsumers,
    };

    this.snapshots.push(snapshot);

    // Trim old snapshots
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * Record an allocation event
   */
  recordAllocation(id: ResourceId, type: ResourceType, size: number): void {
    if (!this.config.enabled) {
      return;
    }

    const event: AllocationEvent = {
      timestamp: Date.now(),
      id,
      type,
      size,
      action: 'allocated',
    };

    this.allocationEvents.push(event);

    // Trim old events
    if (this.allocationEvents.length > this.config.maxEvents) {
      this.allocationEvents.shift();
    }
  }

  /**
   * Record a deallocation event
   */
  recordDeallocation(id: ResourceId, type: ResourceType, size: number): void {
    if (!this.config.enabled) {
      return;
    }

    const event: AllocationEvent = {
      timestamp: Date.now(),
      id,
      type,
      size,
      action: 'freed',
    };

    this.allocationEvents.push(event);

    // Trim old events
    if (this.allocationEvents.length > this.config.maxEvents) {
      this.allocationEvents.shift();
    }
  }

  /**
   * Detect potential memory leaks
   */
  detectLeaks(resourceManager: ResourceManager): LeakCandidate[] {
    const entries = this.getResourceEntries(resourceManager);
    const candidates: LeakCandidate[] = [];
    const now = Date.now();

    for (const entry of entries) {
      const age = entry.loadedAt > 0 ? now - entry.loadedAt : 0;

      // Old resource with no references
      if (age > this.config.leakAgeThreshold && entry.refCount === 0) {
        candidates.push({
          id: entry.id,
          type: entry.type,
          size: entry.size,
          age,
          refCount: entry.refCount,
          reason: 'Old unreferenced resource not evicted',
        });
      }

      // Resource stuck in loading state
      if (age > this.config.leakAgeThreshold && entry.state === 'loading') {
        candidates.push({
          id: entry.id,
          type: entry.type,
          size: entry.size,
          age,
          refCount: entry.refCount,
          reason: 'Stuck in loading state',
        });
      }

      // High reference count (potential leak if never released)
      if (entry.refCount > this.config.leakRefCountThreshold) {
        candidates.push({
          id: entry.id,
          type: entry.type,
          size: entry.size,
          age,
          refCount: entry.refCount,
          reason: `Unusually high reference count: ${entry.refCount} (threshold: ${this.config.leakRefCountThreshold})`,
        });
      }
    }

    return candidates;
  }

  /**
   * Get memory growth rate (bytes per second)
   */
  getGrowthRate(): number | null {
    if (this.snapshots.length < 2) {
      return null;
    }

    const oldest = this.snapshots[0];
    const newest = this.snapshots[this.snapshots.length - 1];

    const timeDiff = (newest.timestamp - oldest.timestamp) / 1000; // seconds
    const memoryDiff = newest.totalMemory - oldest.totalMemory;

    return memoryDiff / timeDiff;
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): readonly MemorySnapshot[] {
    return this.snapshots;
  }

  /**
   * Get latest snapshot
   */
  getLatestSnapshot(): MemorySnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  /**
   * Get allocation events
   */
  getAllocationEvents(): readonly AllocationEvent[] {
    return this.allocationEvents;
  }

  /**
   * Clear all profiling data
   */
  clear(): void {
    this.snapshots = [];
    this.allocationEvents = [];
  }

  /**
   * Get profiler configuration
   */
  getConfig(): Readonly<Required<ProfilerConfig>> {
    return this.config;
  }

  /**
   * Helper to access resource entries via public API
   */
  private getResourceEntries(resourceManager: ResourceManager): ResourceEntry[] {
    return resourceManager.getResourceEntries();
  }

  /**
   * Generate profiling report
   */
  generateReport(resourceManager: ResourceManager): string {
    const snapshot = this.takeSnapshot(resourceManager);
    const leaks = this.detectLeaks(resourceManager);
    const growthRate = this.getGrowthRate();

    let report = '=== Resource Memory Profiling Report ===\n\n';

    report += `Timestamp: ${new Date(snapshot.timestamp).toISOString()}\n`;
    report += `Total Memory: ${(snapshot.totalMemory / 1024 / 1024).toFixed(2)} MB\n`;
    report += `Resource Count: ${snapshot.resourceCount}\n\n`;

    if (growthRate !== null) {
      report += `Memory Growth Rate: ${(growthRate / 1024).toFixed(2)} KB/s\n\n`;
    }

    report += '--- Memory by Type ---\n';
    for (const [type, info] of snapshot.byType) {
      report += `${type}: ${info.count} resources, ${(info.totalSize / 1024).toFixed(2)} KB (avg: ${(info.avgSize / 1024).toFixed(2)} KB)\n`;
    }

    report += '\n--- Memory by State ---\n';
    for (const [state, count] of snapshot.byState) {
      report += `${state}: ${count} resources\n`;
    }

    report += '\n--- Top Memory Consumers ---\n';
    for (const resource of snapshot.topConsumers) {
      report += `${resource.id} (${resource.type}): ${(resource.size / 1024).toFixed(2)} KB, refs: ${resource.refCount}, age: ${(resource.age / 1000).toFixed(1)}s\n`;
    }

    if (leaks.length > 0) {
      report += '\n--- Potential Memory Leaks ---\n';
      for (const leak of leaks) {
        report += `${leak.id} (${leak.type}): ${(leak.size / 1024).toFixed(2)} KB, age: ${(leak.age / 1000).toFixed(1)}s, refs: ${leak.refCount}\n`;
        report += `  Reason: ${leak.reason}\n`;
      }
    } else {
      report += '\n--- No Memory Leaks Detected ---\n';
    }

    return report;
  }
}
