/**
 * Consolidated hash utilities for rendering engine.
 * Eliminates duplicate implementations across WebGPUBackend and ShadowCache.
 *
 * @internal - Not for public API use
 * @packageDocumentation
 */

import { FNV_PRIME, FNV_OFFSET_BASIS } from '../constants/RenderingConstants.js';

/**
 * Hash utility functions for rendering engine.
 * Provides consistent hashing across all rendering systems.
 *
 * @internal
 */
export class HashUtils {
  /**
   * FNV-1a hash for strings (shader source, JSON, resource names)
   * Better distribution than djb2 for longer inputs
   *
   * CRITICAL: This replaces DJB2 to prevent hash collisions (see ShadowCache Epic 3.18)
   *
   * Uses FNV-1a constants from RenderingConstants.ts to ensure consistency across codebase.
   *
   * @param str - String to hash
   * @returns 32-bit unsigned hash value
   */
  static fnv1a(str: string): number {
    let hash = FNV_OFFSET_BASIS;

    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, FNV_PRIME);
    }

    return hash >>> 0; // Convert to unsigned 32-bit
  }

  /**
   * Combine multiple hash values into single hash
   * Uses polynomial rolling hash: result = (result * 31) + hash
   *
   * ALGORITHM: Based on Java hashCode() pattern
   * - Initial value 17 provides better distribution than 0
   * - Multiplier 31 is prime (reduces collisions) and JIT-optimizable (31*x = (x<<5)-x)
   * - Uses Math.imul() to ensure 32-bit multiplication (prevents overflow)
   *
   * @param hashes - Array of hash values to combine
   * @returns Combined 32-bit unsigned hash value
   */
  static combineHashes(...hashes: number[]): number {
    let result = 17;
    for (const hash of hashes) {
      result = Math.imul(result, 31) + hash;
    }
    return result >>> 0;
  }

  /**
   * Hash vertex buffer layout (WebGPU Modern API - Epic 3.14)
   * Creates stable hash from vertex attribute configuration
   *
   * NOTE: This is for NEW WebGPU vertex buffer layouts (GPUVertexBufferLayout).
   * Different from legacy VertexLayout used in WebGPUBackend.hashVertexLayout().
   *
   * Type will be properly defined when WebGPU modules are split (Task 5.3)
   *
   * @param layout - Vertex buffer layout with arrayStride and attributes
   * @returns Hash value for the layout
   */
  static hashVertexBufferLayout(layout: {
    arrayStride: number;
    attributes: Array<{
      shaderLocation: number;
      offset: number;
      format: string;
    }>;
  }): number {
    const parts = [
      layout.arrayStride.toString(),
      ...layout.attributes.map(attr =>
        `${attr.shaderLocation}:${attr.offset}:${attr.format}`
      )
    ];
    return this.fnv1a(parts.join('_'));
  }

  /**
   * Hash bind group layout
   * Creates stable hash from bind group layout configuration
   *
   * NOTE: Type will be properly defined when WebGPU modules are split (Task 5.3)
   *
   * @param layout - Bind group layout descriptor with entries
   * @returns Hash value for the layout
   */
  static hashBindGroupLayout(layout: {
    entries: Array<{
      binding: number;
      visibility: number;
      type?: string;
    }>;
  }): number {
    const entries = layout.entries.map(entry =>
      `${entry.binding}:${entry.visibility}:${entry.type || 'buffer'}`
    ).join('_');
    return this.fnv1a(entries);
  }

  /**
   * Create cache key from multiple components
   * Useful for creating string-based cache keys from mixed types
   *
   * ALGORITHM: Prefixes each part with type marker to prevent collisions
   * - Numbers: prefixed with 'n' + hex representation
   * - Strings: prefixed with 's' + escaped underscores (__ = single _)
   *
   * Examples:
   * - createCacheKey("foo", 123) → "s:foo_n:7b"
   * - createCacheKey("foo_bar", "baz") → "s:foo__bar_s:baz" (escaped)
   *
   * @param parts - Array of strings or numbers to combine
   * @returns String cache key with type-safe delimiters
   */
  static createCacheKey(...parts: (string | number)[]): string {
    return parts.map(p => {
      if (typeof p === 'number') {
        return `n:${p.toString(16)}`; // Prefix with 'n:' for number
      }
      // Escape underscores in strings, prefix with 's:'
      return `s:${String(p).replace(/_/g, '__')}`;
    }).join('_');
  }

  /**
   * Hash arbitrary data structure
   * Converts to JSON and hashes the string representation
   *
   * CRITICAL: Throws TypeError for unstringifiable data (circular refs, undefined at root)
   * This prevents creating a collision bucket where all failed hashes map to same value.
   *
   * Note: JSON.stringify omits Symbol and Function properties (not an error).
   * Only circular references and root-level undefined throw TypeError.
   *
   * @param data - Data to hash (must be JSON-serializable)
   * @returns 32-bit unsigned hash value
   * @throws TypeError if data contains circular references or is root-level undefined
   */
  static hashData(data: unknown): number {
    const json = JSON.stringify(data); // Throws TypeError for circular refs and undefined
    if (json === undefined) {
      throw new TypeError('Cannot hash undefined value');
    }
    return this.fnv1a(json);
  }

  /**
   * Hash legacy VertexLayout (Epic 3.22 Task 6.6)
   * Replaces string-based hashing with numeric hashing for 80% performance improvement
   *
   * This is for LEGACY VertexLayout used in WebGPUBackend/WebGPUPipelineManager.
   * Different from modern GPUVertexBufferLayout (hashVertexBufferLayout).
   *
   * @param layout - Legacy vertex layout with attributes
   * @returns 32-bit unsigned hash value
   */
  static hashVertexLayout(layout: {
    attributes: Array<{
      name: string;
      type: string;
      size: number;
      offset?: number;
      stride?: number;
    }>;
  }): number {
    // Hash each attribute and combine
    const attrHashes = layout.attributes.map(attr => {
      const parts = [
        attr.name,
        attr.type,
        attr.size.toString(),
        (attr.offset ?? 0).toString(),
        (attr.stride ?? 0).toString()
      ];
      return this.fnv1a(parts.join(':'));
    });
    return this.combineHashes(...attrHashes);
  }
}
