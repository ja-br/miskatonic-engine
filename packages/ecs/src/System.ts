import type { System } from './types';

/**
 * System Manager - manages system registration and execution
 *
 * Systems are executed in priority order every frame.
 */
export class SystemManager {
  private systems: System[] = [];
  private systemMap: Map<string, System> = new Map();
  private initialized = false;

  /**
   * Register a system
   */
  register(system: System): void {
    if (this.systemMap.has(system.name)) {
      throw new Error(`System ${system.name} is already registered`);
    }

    this.systems.push(system);
    this.systemMap.set(system.name, system);

    // Sort by priority
    this.systems.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Unregister a system
   */
  unregister(systemName: string): void {
    const system = this.systemMap.get(systemName);
    if (!system) {
      return;
    }

    this.systems = this.systems.filter((s) => s.name !== systemName);
    this.systemMap.delete(systemName);
  }

  /**
   * Get a system by name
   */
  get(systemName: string): System | undefined {
    return this.systemMap.get(systemName);
  }

  /**
   * Initialize all systems
   */
  init(world: any): void {
    if (this.initialized) {
      return;
    }

    for (const system of this.systems) {
      system.init?.(world);
    }

    this.initialized = true;
  }

  /**
   * Update all systems
   */
  update(world: any, deltaTime: number): void {
    for (const system of this.systems) {
      system.update(world, deltaTime);
    }
  }

  /**
   * Cleanup all systems
   */
  cleanup(world: any): void {
    for (const system of this.systems) {
      system.cleanup?.(world);
    }

    this.initialized = false;
  }

  /**
   * Get all registered systems
   */
  getAllSystems(): System[] {
    return [...this.systems];
  }

  /**
   * Clear all systems
   */
  clear(): void {
    this.systems = [];
    this.systemMap.clear();
    this.initialized = false;
  }

  /**
   * Get statistics for debugging
   */
  getStats() {
    return {
      count: this.systems.length,
      systems: this.systems.map((s) => ({
        name: s.name,
        priority: s.priority,
      })),
    };
  }
}
