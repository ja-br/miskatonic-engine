/**
 * Consolidated hash utilities for rendering engine.
 * Eliminates duplicate implementations across WebGPUBackend and ShadowCache.
 *
 * @internal - Not for public API use
 * @packageDocumentation
 */

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
   * @param str - String to hash
   * @returns 32-bit unsigned hash value
   */
  static fnv1a(str: string): number {
    const FNV_PRIME = 0x01000193;
    let hash = 0x811c9dc5; // FNV offset basis (32-bit)

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
   * CRITICAL: Throws error for unstringifiable data (circular refs, Symbols, Functions)
   * This prevents creating a collision bucket where all failed hashes map to same value.
   *
   * @param data - Data to hash (must be JSON-serializable)
   * @returns Hash value as base-36 string
   * @throws Error if data cannot be stringified
   */
  static hashData(data: unknown): string {
    const json = JSON.stringify(data); // Let it throw for unstringifiable data
    return this.fnv1a(json).toString(36);
  }
}
