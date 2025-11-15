/**
 * WebGPUBackend Dependency Injection Tests - Epic RENDERING-06 Task 6.4
 *
 * Tests that the WebGPUBackend properly accepts dependency injection
 * and maintains backward compatibility.
 */

import { describe, it, expect, vi } from 'vitest';
import { WebGPUBackend, type WebGPUBackendDependencies } from '../src/backends/WebGPUBackend';
import { VRAMProfiler } from '../src/VRAMProfiler';
import { GPUBufferPool } from '../src/GPUBufferPool';
import { WGSLReflectionParser, ShaderReflectionCache } from '../src/ShaderReflection';

describe('WebGPUBackend Dependency Injection - Epic RENDERING-06 Task 6.4', () => {
  describe('Constructor', () => {
    it('should create backend with default dependencies', () => {
      const backend = new WebGPUBackend();

      expect(backend).toBeInstanceOf(WebGPUBackend);
      expect(backend.name).toBe('WebGPU');
    });

    it('should accept injected VRAMProfiler', () => {
      const mockProfiler = new VRAMProfiler(512 * 1024 * 1024);
      const backend = new WebGPUBackend({
        vramProfiler: mockProfiler
      });

      expect(backend).toBeInstanceOf(WebGPUBackend);
      expect(backend.getVRAMProfiler()).toBe(mockProfiler);
    });

    it('should accept injected GPUBufferPool', () => {
      const mockPool = new GPUBufferPool();
      const backend = new WebGPUBackend({
        bufferPool: mockPool
      });

      expect(backend).toBeInstanceOf(WebGPUBackend);
    });

    it('should accept injected reflection parser', () => {
      const mockParser = new WGSLReflectionParser();
      const backend = new WebGPUBackend({
        reflectionParser: mockParser
      });

      expect(backend).toBeInstanceOf(WebGPUBackend);
    });

    it('should accept injected reflection cache', () => {
      const mockCache = new ShaderReflectionCache();
      const backend = new WebGPUBackend({
        reflectionCache: mockCache
      });

      expect(backend).toBeInstanceOf(WebGPUBackend);
    });

    it('should accept all dependencies at once', () => {
      const deps: WebGPUBackendDependencies = {
        vramProfiler: new VRAMProfiler(256 * 1024 * 1024),
        bufferPool: new GPUBufferPool(),
        reflectionParser: new WGSLReflectionParser(),
        reflectionCache: new ShaderReflectionCache()
      };

      const backend = new WebGPUBackend(deps);

      expect(backend).toBeInstanceOf(WebGPUBackend);
      expect(backend.getVRAMProfiler()).toBe(deps.vramProfiler);
    });

    it('should maintain backward compatibility with no arguments', () => {
      // This is how existing code creates the backend
      const backend = new WebGPUBackend();

      expect(backend).toBeInstanceOf(WebGPUBackend);
      expect(backend.name).toBe('WebGPU');
    });
  });

  describe('Dependency Usage', () => {
    it('should use injected VRAM profiler for stats', () => {
      const mockProfiler = new VRAMProfiler(128 * 1024 * 1024);
      const backend = new WebGPUBackend({
        vramProfiler: mockProfiler
      });

      const stats = backend.getVRAMStats();
      expect(stats).toBeDefined();
      expect(stats.totalBudget).toBe(128 * 1024 * 1024); // Confirms our mock profiler is being used
    });
  });

  describe('Type Safety', () => {
    it('should enforce type safety on dependencies', () => {
      // This test verifies TypeScript compilation, not runtime behavior
      const deps: WebGPUBackendDependencies = {
        vramProfiler: new VRAMProfiler(256 * 1024 * 1024)
        // Other fields optional
      };

      const backend = new WebGPUBackend(deps);
      expect(backend).toBeInstanceOf(WebGPUBackend);
    });

    it('should allow empty dependencies object', () => {
      const backend = new WebGPUBackend({});
      expect(backend).toBeInstanceOf(WebGPUBackend);
    });
  });
});
