/**
 * Utility functions for high-level rendering API
 * Epic 3.14: High-Level Rendering API Wrapper
 */

/**
 * Generate unique ID for resources
 * Format: prefix_timestamp_counter
 */
let idCounter = 0;
export function generateId(prefix: string = 'resource'): string {
  return `${prefix}_${Date.now()}_${idCounter++}`;
}

/**
 * Load image from URL and create ImageBitmap
 * @throws Error if image fails to load with actionable error message
 */
export async function loadImage(url: string): Promise<ImageBitmap> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const blob = await response.blob();
    return await createImageBitmap(blob);
  } catch (error) {
    throw new Error(
      `Failed to load image from '${url}': ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Load shader source from URL or return built-in shader
 * @param nameOrUrl - Built-in shader name or .wgsl file URL
 * @param builtinShaders - Map of built-in shader names to source code
 * @returns WGSL shader source code
 * @throws Error if shader not found or fails to load
 */
export async function loadShaderSource(
  nameOrUrl: string,
  builtinShaders: Map<string, string>
): Promise<string> {
  // Check if it's a built-in shader
  if (builtinShaders.has(nameOrUrl)) {
    return builtinShaders.get(nameOrUrl)!;
  }

  // Try to load from URL
  if (nameOrUrl.endsWith('.wgsl')) {
    try {
      const response = await fetch(nameOrUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      throw new Error(
        `Failed to load shader from '${nameOrUrl}': ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  throw new Error(
    `Shader '${nameOrUrl}' not found. Provide a built-in shader name (${Array.from(builtinShaders.keys()).join(', ')}) or a .wgsl file URL.`
  );
}

/**
 * Calculate uniform buffer size with WebGPU alignment rules
 * All uniform buffers must be aligned to 16 bytes (minUniformBufferOffsetAlignment)
 *
 * @param baseSize - Unaligned size in bytes
 * @returns Aligned size in bytes (multiple of 16)
 */
export function calculateAlignedUniformSize(baseSize: number): number {
  const alignment = 16; // WebGPU minUniformBufferOffsetAlignment
  return Math.ceil(baseSize / alignment) * alignment;
}

/**
 * Get byte size for uniform types
 * Follows WebGPU alignment rules for WGSL types
 */
export function getUniformTypeSize(type: string): number {
  const sizes: Record<string, number> = {
    'float': 4,
    'vec2': 8,
    'vec3': 12,
    'vec4': 16,
    'mat3': 48,  // 3x vec4 (aligned to 16 bytes per column)
    'mat4': 64,  // 4x vec4
  };
  return sizes[type] || 4;
}

/**
 * Serialize uniform value to Float32Array
 * Handles single values, arrays, and existing Float32Arrays
 */
export function serializeUniform(value: number | number[] | Float32Array): Float32Array {
  if (value instanceof Float32Array) {
    return value;
  }
  if (typeof value === 'number') {
    return new Float32Array([value]);
  }
  return new Float32Array(value);
}
