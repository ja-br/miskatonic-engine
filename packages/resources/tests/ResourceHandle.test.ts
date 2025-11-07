import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResourceEntry, ResourceHandle } from '../src/ResourceHandle';
import { ResourceState } from '../src/types';

describe('ResourceEntry', () => {
  let entry: ResourceEntry<string>;

  beforeEach(() => {
    entry = new ResourceEntry('test-resource', 'text');
  });

  it('should initialize with correct values', () => {
    expect(entry.id).toBe('test-resource');
    expect(entry.type).toBe('text');
    expect(entry.refCount).toBe(0);
    expect(entry.state).toBe(ResourceState.UNLOADED);
    expect(entry.data).toBeNull();
    expect(entry.error).toBeNull();
    expect(entry.size).toBe(0);
  });

  it('should track access correctly', () => {
    const before = entry.lastAccessed;
    const accessCountBefore = entry.accessCount;

    entry.touch();

    expect(entry.lastAccessed).toBeGreaterThanOrEqual(before);
    expect(entry.accessCount).toBe(accessCountBefore + 1);
  });

  it('should determine if can evict based on refCount', () => {
    expect(entry.canEvict()).toBe(true);

    entry.refCount = 1;
    expect(entry.canEvict()).toBe(false);

    entry.refCount = 0;
    expect(entry.canEvict()).toBe(true);
  });
});

describe('ResourceHandle', () => {
  let entry: ResourceEntry<string>;
  let onRelease: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    entry = new ResourceEntry('test-resource', 'text');
    onRelease = vi.fn();
  });

  it('should increment refCount on creation', () => {
    expect(entry.refCount).toBe(0);

    new ResourceHandle(entry, onRelease);

    expect(entry.refCount).toBe(1);
  });

  it('should provide resource ID and type', () => {
    const handle = new ResourceHandle(entry, onRelease);

    expect(handle.id).toBe('test-resource');
    expect(handle.type).toBe('text');
  });

  it('should throw error when getting unloaded resource', () => {
    const handle = new ResourceHandle(entry, onRelease);

    expect(() => handle.get()).toThrow(/not loaded/);
  });

  it('should return data when resource is loaded', () => {
    entry.state = ResourceState.LOADED;
    entry.data = 'test data';

    const handle = new ResourceHandle(entry, onRelease);
    const data = handle.get();

    expect(data).toBe('test data');
  });

  it('should touch entry when accessing data', () => {
    entry.state = ResourceState.LOADED;
    entry.data = 'test data';
    const accessCountBefore = entry.accessCount;

    const handle = new ResourceHandle(entry, onRelease);
    handle.get();

    expect(entry.accessCount).toBe(accessCountBefore + 1);
  });

  it('should report load state correctly', () => {
    const handle = new ResourceHandle(entry, onRelease);

    expect(handle.isLoaded()).toBe(false);

    entry.state = ResourceState.LOADED;
    entry.data = 'test';

    expect(handle.isLoaded()).toBe(true);
  });

  it('should report error state correctly', () => {
    const handle = new ResourceHandle(entry, onRelease);

    expect(handle.hasError()).toBe(false);

    entry.state = ResourceState.ERROR;
    entry.error = new Error('test error');

    expect(handle.hasError()).toBe(true);
  });

  it('should get current state', () => {
    const handle = new ResourceHandle(entry, onRelease);

    expect(handle.getState()).toBe(ResourceState.UNLOADED);

    entry.state = ResourceState.LOADING;
    expect(handle.getState()).toBe(ResourceState.LOADING);

    entry.state = ResourceState.LOADED;
    expect(handle.getState()).toBe(ResourceState.LOADED);
  });

  it('should release correctly', () => {
    const handle = new ResourceHandle(entry, onRelease);

    expect(entry.refCount).toBe(1);
    expect(handle.isReleased()).toBe(false);

    handle.release();

    expect(entry.refCount).toBe(0);
    expect(handle.isReleased()).toBe(true);
    expect(onRelease).toHaveBeenCalledWith(handle);
  });

  it('should not release twice', () => {
    const handle = new ResourceHandle(entry, onRelease);
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    handle.release();
    handle.release();

    expect(entry.refCount).toBe(0);
    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already released'));

    consoleSpy.mockRestore();
  });

  it('should prevent accessing released handle', () => {
    entry.state = ResourceState.LOADED;
    entry.data = 'test';

    const handle = new ResourceHandle(entry, onRelease);
    handle.release();

    expect(() => handle.get()).toThrow(/released resource/);
  });

  it('should create new handle with addRef', () => {
    const handle1 = new ResourceHandle(entry, onRelease);
    expect(entry.refCount).toBe(1);

    const handle2 = handle1.addRef();
    expect(entry.refCount).toBe(2);

    expect(handle2.id).toBe(handle1.id);
    expect(handle2).not.toBe(handle1); // Different objects
  });

  it('should not addRef on released handle', () => {
    const handle = new ResourceHandle(entry, onRelease);
    handle.release();

    expect(() => handle.addRef()).toThrow(/released resource/);
  });

  it('should track multiple references correctly', () => {
    const handle1 = new ResourceHandle(entry, onRelease);
    const handle2 = handle1.addRef();
    const handle3 = handle1.addRef();

    expect(entry.refCount).toBe(3);

    handle1.release();
    expect(entry.refCount).toBe(2);

    handle2.release();
    expect(entry.refCount).toBe(1);

    handle3.release();
    expect(entry.refCount).toBe(0);
  });

  it('should get current refCount', () => {
    const handle1 = new ResourceHandle(entry, onRelease);
    expect(handle1.getRefCount()).toBe(1);

    const handle2 = handle1.addRef();
    expect(handle1.getRefCount()).toBe(2);
    expect(handle2.getRefCount()).toBe(2);

    handle1.release();
    expect(handle2.getRefCount()).toBe(1);
  });
});
