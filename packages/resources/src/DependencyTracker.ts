import type { ResourceId, DependencyNode } from './types';

/**
 * Tracks dependencies between resources
 * Enables:
 * - Automatic loading of dependencies
 * - Preventing eviction of resources with dependents
 * - Batch unloading of dependency chains
 */
export class DependencyTracker {
  private nodes = new Map<ResourceId, DependencyNode>();

  /**
   * Register a resource in the dependency graph
   */
  register(id: ResourceId): void {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, {
        id,
        dependencies: new Set(),
        dependents: new Set(),
      });
    }
  }

  /**
   * Add dependency relationship (resource depends on dependency)
   */
  addDependency(resourceId: ResourceId, dependencyId: ResourceId): void {
    this.register(resourceId);
    this.register(dependencyId);

    const resource = this.nodes.get(resourceId)!;
    const dependency = this.nodes.get(dependencyId)!;

    resource.dependencies.add(dependencyId);
    dependency.dependents.add(resourceId);
  }

  /**
   * Remove dependency relationship
   */
  removeDependency(resourceId: ResourceId, dependencyId: ResourceId): void {
    const resource = this.nodes.get(resourceId);
    const dependency = this.nodes.get(dependencyId);

    if (resource) {
      resource.dependencies.delete(dependencyId);
    }

    if (dependency) {
      dependency.dependents.delete(resourceId);
    }
  }

  /**
   * Get all dependencies of a resource (direct only)
   */
  getDependencies(id: ResourceId): ResourceId[] {
    const node = this.nodes.get(id);
    return node ? Array.from(node.dependencies) : [];
  }

  /**
   * Get all dependents of a resource (direct only)
   */
  getDependents(id: ResourceId): ResourceId[] {
    const node = this.nodes.get(id);
    return node ? Array.from(node.dependents) : [];
  }

  /**
   * Get all dependencies recursively (transitive closure)
   */
  getAllDependencies(id: ResourceId): ResourceId[] {
    const result = new Set<ResourceId>();
    const visited = new Set<ResourceId>();

    const traverse = (currentId: ResourceId): void => {
      if (visited.has(currentId)) {
        return; // Cycle detection
      }

      visited.add(currentId);
      const node = this.nodes.get(currentId);

      if (node) {
        for (const depId of node.dependencies) {
          result.add(depId);
          traverse(depId);
        }
      }
    };

    traverse(id);
    return Array.from(result);
  }

  /**
   * Get all dependents recursively
   */
  getAllDependents(id: ResourceId): ResourceId[] {
    const result = new Set<ResourceId>();
    const visited = new Set<ResourceId>();

    const traverse = (currentId: ResourceId): void => {
      if (visited.has(currentId)) {
        return; // Cycle detection
      }

      visited.add(currentId);
      const node = this.nodes.get(currentId);

      if (node) {
        for (const depId of node.dependents) {
          result.add(depId);
          traverse(depId);
        }
      }
    };

    traverse(id);
    return Array.from(result);
  }

  /**
   * Check if resource has any dependents
   */
  hasDependents(id: ResourceId): boolean {
    const node = this.nodes.get(id);
    return node ? node.dependents.size > 0 : false;
  }

  /**
   * Check for circular dependencies
   */
  hasCircularDependency(id: ResourceId): boolean {
    const visited = new Set<ResourceId>();
    const recursionStack = new Set<ResourceId>();

    const detectCycle = (currentId: ResourceId): boolean => {
      if (recursionStack.has(currentId)) {
        return true; // Cycle detected
      }

      if (visited.has(currentId)) {
        return false; // Already processed
      }

      visited.add(currentId);
      recursionStack.add(currentId);

      const node = this.nodes.get(currentId);
      if (node) {
        for (const depId of node.dependencies) {
          if (detectCycle(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(currentId);
      return false;
    };

    return detectCycle(id);
  }

  /**
   * Get topological sort of dependencies (for correct load order)
   */
  getLoadOrder(ids: ResourceId[]): ResourceId[] {
    const result: ResourceId[] = [];
    const visited = new Set<ResourceId>();
    const visiting = new Set<ResourceId>();

    const visit = (id: ResourceId): void => {
      if (visited.has(id)) {
        return;
      }

      if (visiting.has(id)) {
        throw new Error(`Circular dependency detected at: ${id}`);
      }

      visiting.add(id);

      const node = this.nodes.get(id);
      if (node) {
        // Visit dependencies first
        for (const depId of node.dependencies) {
          visit(depId);
        }
      }

      visiting.delete(id);
      visited.add(id);
      result.push(id);
    };

    for (const id of ids) {
      visit(id);
    }

    return result;
  }

  /**
   * Remove resource from dependency graph
   */
  unregister(id: ResourceId): void {
    const node = this.nodes.get(id);
    if (!node) {
      return;
    }

    // Remove this resource from all dependencies' dependent lists
    for (const depId of node.dependencies) {
      const dep = this.nodes.get(depId);
      if (dep) {
        dep.dependents.delete(id);
      }
    }

    // Remove this resource from all dependents' dependency lists
    for (const depId of node.dependents) {
      const dep = this.nodes.get(depId);
      if (dep) {
        dep.dependencies.delete(id);
      }
    }

    this.nodes.delete(id);
  }

  /**
   * Clear all dependencies
   */
  clear(): void {
    this.nodes.clear();
  }

  /**
   * Get number of resources in graph
   */
  size(): number {
    return this.nodes.size;
  }
}
