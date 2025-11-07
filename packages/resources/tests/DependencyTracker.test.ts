import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyTracker } from '../src/DependencyTracker';

describe('DependencyTracker', () => {
  let tracker: DependencyTracker;

  beforeEach(() => {
    tracker = new DependencyTracker();
  });

  it('should register resources', () => {
    tracker.register('resource1');
    expect(tracker.getDependencies('resource1')).toEqual([]);
    expect(tracker.getDependents('resource1')).toEqual([]);
  });

  it('should add dependency relationships', () => {
    tracker.addDependency('resource1', 'dependency1');

    expect(tracker.getDependencies('resource1')).toContain('dependency1');
    expect(tracker.getDependents('dependency1')).toContain('resource1');
  });

  it('should remove dependency relationships', () => {
    tracker.addDependency('resource1', 'dependency1');
    tracker.removeDependency('resource1', 'dependency1');

    expect(tracker.getDependencies('resource1')).not.toContain('dependency1');
    expect(tracker.getDependents('dependency1')).not.toContain('resource1');
  });

  it('should get all dependencies recursively', () => {
    // resource1 -> dependency1 -> dependency2
    tracker.addDependency('resource1', 'dependency1');
    tracker.addDependency('dependency1', 'dependency2');

    const allDeps = tracker.getAllDependencies('resource1');

    expect(allDeps).toContain('dependency1');
    expect(allDeps).toContain('dependency2');
  });

  it('should detect circular dependencies', () => {
    // Create circular dependency: A -> B -> C -> A
    tracker.addDependency('A', 'B');
    tracker.addDependency('B', 'C');
    tracker.addDependency('C', 'A');

    expect(tracker.hasCircularDependency('A')).toBe(true);
  });

  it('should provide topological sort for load order', () => {
    // dependency2 should load before dependency1, which loads before resource1
    tracker.addDependency('resource1', 'dependency1');
    tracker.addDependency('dependency1', 'dependency2');

    const loadOrder = tracker.getLoadOrder(['resource1']);

    expect(loadOrder.indexOf('dependency2')).toBeLessThan(loadOrder.indexOf('dependency1'));
    expect(loadOrder.indexOf('dependency1')).toBeLessThan(loadOrder.indexOf('resource1'));
  });

  it('should unregister resources', () => {
    tracker.addDependency('resource1', 'dependency1');
    tracker.unregister('resource1');

    expect(tracker.getDependents('dependency1')).not.toContain('resource1');
  });

  it('should check if resource has dependents', () => {
    tracker.addDependency('resource1', 'dependency1');

    expect(tracker.hasDependents('dependency1')).toBe(true);
    expect(tracker.hasDependents('resource1')).toBe(false);
  });

  it('should clear all dependencies', () => {
    tracker.addDependency('resource1', 'dependency1');
    tracker.clear();

    expect(tracker.size()).toBe(0);
  });
});
