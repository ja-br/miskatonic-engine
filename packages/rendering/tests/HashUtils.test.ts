/**
 * Unit tests for HashUtils
 * Epic RENDERING-05 Task 5.2
 */

import { describe, it, expect } from 'vitest';
import { HashUtils } from '../src/utils/HashUtils';

describe('HashUtils', () => {
  describe('fnv1a', () => {
    it('should hash empty string', () => {
      const hash = HashUtils.fnv1a('');
      expect(hash).toBe(2166136261); // FNV offset basis
      expect(hash).toBeGreaterThan(0);
    });

    it('should hash single character', () => {
      const hash = HashUtils.fnv1a('a');
      expect(hash).toBeGreaterThan(0);
      expect(hash).not.toBe(2166136261); // Should differ from empty string
    });

    it('should hash long string', () => {
      const longString = 'a'.repeat(1000);
      const hash = HashUtils.fnv1a(longString);
      expect(hash).toBeGreaterThan(0);
      expect(Number.isInteger(hash)).toBe(true);
    });

    it('should handle Unicode characters', () => {
      const hash1 = HashUtils.fnv1a('hello');
      const hash2 = HashUtils.fnv1a('你好'); // Chinese "hello"
      const hash3 = HashUtils.fnv1a('🚀'); // Emoji

      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });

    it('should be deterministic', () => {
      const input = 'test string';
      const hash1 = HashUtils.fnv1a(input);
      const hash2 = HashUtils.fnv1a(input);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = HashUtils.fnv1a('abc');
      const hash2 = HashUtils.fnv1a('def');
      const hash3 = HashUtils.fnv1a('abcd');

      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });

    it('should return unsigned 32-bit integer', () => {
      const hash = HashUtils.fnv1a('test');
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xFFFFFFFF);
    });

    it('should have good distribution for similar strings', () => {
      const hashes = [
        HashUtils.fnv1a('shader1'),
        HashUtils.fnv1a('shader2'),
        HashUtils.fnv1a('shader3'),
        HashUtils.fnv1a('shader4'),
        HashUtils.fnv1a('shader5'),
      ];

      // All hashes should be unique
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(hashes.length);
    });
  });

  describe('combineHashes', () => {
    it('should combine single hash', () => {
      const hash = HashUtils.fnv1a('test');
      const combined = HashUtils.combineHashes(hash);
      expect(combined).toBeGreaterThan(0);
      expect(combined).not.toBe(hash); // Should transform even single hash
    });

    it('should combine multiple hashes', () => {
      const hash1 = HashUtils.fnv1a('shader');
      const hash2 = HashUtils.fnv1a('layout');
      const hash3 = HashUtils.fnv1a('pipeline');

      const combined = HashUtils.combineHashes(hash1, hash2, hash3);
      expect(combined).toBeGreaterThan(0);
      expect(combined).not.toBe(hash1);
      expect(combined).not.toBe(hash2);
      expect(combined).not.toBe(hash3);
    });

    it('should handle zero hashes edge case', () => {
      const combined = HashUtils.combineHashes();
      expect(combined).toBe(17); // Initial value
    });

    it('should be order-dependent (non-commutative)', () => {
      const hash1 = 100;
      const hash2 = 200;

      const combined1 = HashUtils.combineHashes(hash1, hash2);
      const combined2 = HashUtils.combineHashes(hash2, hash1);

      expect(combined1).not.toBe(combined2);
    });

    it('should be deterministic', () => {
      const hash1 = HashUtils.fnv1a('a');
      const hash2 = HashUtils.fnv1a('b');

      const combined1 = HashUtils.combineHashes(hash1, hash2);
      const combined2 = HashUtils.combineHashes(hash1, hash2);

      expect(combined1).toBe(combined2);
    });

    it('should return unsigned 32-bit integer', () => {
      const combined = HashUtils.combineHashes(0xFFFFFFFF, 0xFFFFFFFF);
      expect(combined).toBeGreaterThanOrEqual(0);
      expect(combined).toBeLessThanOrEqual(0xFFFFFFFF);
    });

    it('should handle large hash values without overflow', () => {
      const largeHash1 = 0xFFFFFFFF;
      const largeHash2 = 0xFFFFFFFE;

      const combined = HashUtils.combineHashes(largeHash1, largeHash2);
      expect(Number.isInteger(combined)).toBe(true);
      expect(combined).toBeGreaterThanOrEqual(0);
    });
  });

  describe('hashVertexBufferLayout', () => {
    it('should hash empty attributes', () => {
      const layout = {
        arrayStride: 32,
        attributes: []
      };

      const hash = HashUtils.hashVertexBufferLayout(layout);
      expect(hash).toBeGreaterThan(0);
    });

    it('should hash single attribute', () => {
      const layout = {
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' }
        ]
      };

      const hash = HashUtils.hashVertexBufferLayout(layout);
      expect(hash).toBeGreaterThan(0);
    });

    it('should hash multiple attributes', () => {
      const layout = {
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x3' },
          { shaderLocation: 2, offset: 24, format: 'float32x2' }
        ]
      };

      const hash = HashUtils.hashVertexBufferLayout(layout);
      expect(hash).toBeGreaterThan(0);
    });

    it('should be deterministic', () => {
      const layout = {
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' }
        ]
      };

      const hash1 = HashUtils.hashVertexBufferLayout(layout);
      const hash2 = HashUtils.hashVertexBufferLayout(layout);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different layouts', () => {
      const layout1 = {
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' }
        ]
      };

      const layout2 = {
        arrayStride: 24,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x2' }
        ]
      };

      const hash1 = HashUtils.hashVertexBufferLayout(layout1);
      const hash2 = HashUtils.hashVertexBufferLayout(layout2);
      expect(hash1).not.toBe(hash2);
    });

    it('should consider attribute order', () => {
      const layout1 = {
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x2' }
        ]
      };

      const layout2 = {
        arrayStride: 32,
        attributes: [
          { shaderLocation: 1, offset: 12, format: 'float32x2' },
          { shaderLocation: 0, offset: 0, format: 'float32x3' }
        ]
      };

      const hash1 = HashUtils.hashVertexBufferLayout(layout1);
      const hash2 = HashUtils.hashVertexBufferLayout(layout2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashBindGroupLayout', () => {
    it('should hash empty entries', () => {
      const layout = { entries: [] };
      const hash = HashUtils.hashBindGroupLayout(layout);
      expect(hash).toBeGreaterThan(0);
    });

    it('should hash single entry', () => {
      const layout = {
        entries: [
          { binding: 0, visibility: 1, type: 'uniform' }
        ]
      };

      const hash = HashUtils.hashBindGroupLayout(layout);
      expect(hash).toBeGreaterThan(0);
    });

    it('should hash multiple entries', () => {
      const layout = {
        entries: [
          { binding: 0, visibility: 1, type: 'uniform' },
          { binding: 1, visibility: 2, type: 'sampler' },
          { binding: 2, visibility: 4, type: 'texture' }
        ]
      };

      const hash = HashUtils.hashBindGroupLayout(layout);
      expect(hash).toBeGreaterThan(0);
    });

    it('should default to "buffer" type when not specified', () => {
      const layout1 = {
        entries: [
          { binding: 0, visibility: 1 }
        ]
      };

      const layout2 = {
        entries: [
          { binding: 0, visibility: 1, type: 'buffer' }
        ]
      };

      const hash1 = HashUtils.hashBindGroupLayout(layout1);
      const hash2 = HashUtils.hashBindGroupLayout(layout2);
      expect(hash1).toBe(hash2);
    });

    it('should be deterministic', () => {
      const layout = {
        entries: [
          { binding: 0, visibility: 1, type: 'uniform' }
        ]
      };

      const hash1 = HashUtils.hashBindGroupLayout(layout);
      const hash2 = HashUtils.hashBindGroupLayout(layout);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different layouts', () => {
      const layout1 = {
        entries: [
          { binding: 0, visibility: 1, type: 'uniform' }
        ]
      };

      const layout2 = {
        entries: [
          { binding: 1, visibility: 2, type: 'sampler' }
        ]
      };

      const hash1 = HashUtils.hashBindGroupLayout(layout1);
      const hash2 = HashUtils.hashBindGroupLayout(layout2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('createCacheKey', () => {
    it('should create key from single string', () => {
      const key = HashUtils.createCacheKey('test');
      expect(key).toBe('s:test');
    });

    it('should create key from single number', () => {
      const key = HashUtils.createCacheKey(123);
      expect(key).toBe('n:7b'); // 123 in hex
    });

    it('should create key from mixed types', () => {
      const key = HashUtils.createCacheKey('shader', 456, 'pipeline');
      expect(key).toBe('s:shader_n:1c8_s:pipeline');
    });

    it('should escape underscores in strings', () => {
      const key = HashUtils.createCacheKey('foo_bar', 'baz');
      expect(key).toBe('s:foo__bar_s:baz');
    });

    it('should prevent collision between escaped and non-escaped', () => {
      const key1 = HashUtils.createCacheKey('foo_bar', 'baz');
      const key2 = HashUtils.createCacheKey('foo', 'bar_baz');
      expect(key1).not.toBe(key2);
    });

    it('should handle empty parts array', () => {
      const key = HashUtils.createCacheKey();
      expect(key).toBe('');
    });

    it('should prefix numbers to distinguish from strings', () => {
      const key1 = HashUtils.createCacheKey('7b');
      const key2 = HashUtils.createCacheKey(123);
      expect(key1).toBe('s:7b');
      expect(key2).toBe('n:7b');
      expect(key1).not.toBe(key2);
    });

    it('should be deterministic', () => {
      const key1 = HashUtils.createCacheKey('test', 123);
      const key2 = HashUtils.createCacheKey('test', 123);
      expect(key1).toBe(key2);
    });
  });

  describe('hashData', () => {
    it('should hash simple object', () => {
      const data = { x: 10, y: 20 };
      const hash = HashUtils.hashData(data);
      expect(hash).toBeGreaterThan(0);
      expect(typeof hash).toBe('number');
    });

    it('should hash array', () => {
      const data = [1, 2, 3, 4, 5];
      const hash = HashUtils.hashData(data);
      expect(hash).toBeTruthy();
    });

    it('should hash nested object', () => {
      const data = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      };
      const hash = HashUtils.hashData(data);
      expect(hash).toBeTruthy();
    });

    it('should be deterministic', () => {
      const data = { a: 1, b: 2 };
      const hash1 = HashUtils.hashData(data);
      const hash2 = HashUtils.hashData(data);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different data', () => {
      const data1 = { x: 1 };
      const data2 = { x: 2 };
      const hash1 = HashUtils.hashData(data1);
      const hash2 = HashUtils.hashData(data2);
      expect(hash1).not.toBe(hash2);
    });

    it('should throw TypeError for circular references', () => {
      const data: any = { a: 1 };
      data.self = data; // Circular reference

      expect(() => HashUtils.hashData(data)).toThrow(TypeError);
    });

    it('should handle data with Symbol (Symbol is omitted in JSON)', () => {
      const data = { sym: Symbol('test'), value: 123 };
      // JSON.stringify omits Symbol properties, so this becomes {value: 123}
      const hash = HashUtils.hashData(data);
      const hashWithoutSymbol = HashUtils.hashData({ value: 123 });
      expect(hash).toBe(hashWithoutSymbol);
    });

    it('should handle data with Function (Function is omitted in JSON)', () => {
      const data = { fn: () => {}, value: 123 };
      // JSON.stringify omits Function properties, so this becomes {value: 123}
      const hash = HashUtils.hashData(data);
      const hashWithoutFn = HashUtils.hashData({ value: 123 });
      expect(hash).toBe(hashWithoutFn);
    });

    it('should handle null', () => {
      const hash = HashUtils.hashData(null);
      expect(hash).toBeTruthy();
    });

    it('should throw TypeError for undefined (JSON.stringify returns undefined)', () => {
      // JSON.stringify(undefined) returns undefined (not a string)
      // This should throw TypeError
      expect(() => HashUtils.hashData(undefined)).toThrow(TypeError);
    });

    it('should return unsigned 32-bit integer', () => {
      const hash = HashUtils.hashData({ test: 'data' });
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xFFFFFFFF);
    });
  });

  describe('Hash Quality', () => {
    it('should have low collision rate for similar inputs', () => {
      const hashes = new Set<number>();

      // Generate 1000 hashes for sequential strings
      for (let i = 0; i < 1000; i++) {
        const hash = HashUtils.fnv1a(`item_${i}`);
        hashes.add(hash);
      }

      // Expect >99% unique (allow <1% collisions)
      expect(hashes.size).toBeGreaterThan(990);
    });

    it('should distribute hashes evenly across range', () => {
      const buckets = new Array(10).fill(0);

      for (let i = 0; i < 1000; i++) {
        const hash = HashUtils.fnv1a(`test_${i}`);
        const bucket = hash % 10;
        buckets[bucket]++;
      }

      // Each bucket should have roughly 100 items (±30% tolerance)
      for (const count of buckets) {
        expect(count).toBeGreaterThan(70);
        expect(count).toBeLessThan(130);
      }
    });
  });
});
