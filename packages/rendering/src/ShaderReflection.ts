/**
 * Shader Reflection Types for Epic 3.14
 *
 * Extracts bind group layouts, uniform locations, and attribute info from compiled shaders.
 * Enables automatic pipeline creation without manual layout specification.
 */

import type {
  BindGroupLayoutDescriptor,
  BindingType,
  ShaderStage,
} from './BindGroupDescriptors';

/**
 * Shader resource binding information extracted via reflection
 */
export interface ShaderBinding {
  binding: number;
  name: string;
  type: BindingType;
  visibility: ShaderStage[];
  size?: number; // Size in bytes for uniform/storage buffers
}

/**
 * Epic 3.14 Phase 3: Binding information for AST-based parser
 * More detailed than ShaderBinding, includes all WebGPU binding details
 */
export interface BindingInfo {
  binding: number;
  name: string;
  type: 'buffer' | 'texture' | 'sampler' | 'storage-texture';
  bufferType?: 'uniform' | 'storage' | 'read-only-storage';
  textureSampleType?: 'float' | 'unfilterable-float' | 'depth' | 'sint' | 'uint';
  samplerType?: 'filtering' | 'non-filtering' | 'comparison';
  storageTextureFormat?: string; // e.g., 'rgba8unorm', 'rgba16float', 'r32float'
  storageTextureAccess?: 'read-only' | 'write-only' | 'read-write';
  visibility: number; // Shader stage flags
  isRuntimeSizedArray?: boolean; // True for array<T> (no size), false for array<T, N>
}

/**
 * Epic 3.14 Phase 3: Bind group layout information for AST-based parser
 */
export interface BindGroupLayoutInfo {
  group: number;
  bindings: BindingInfo[];
}

/**
 * Vertex input attribute information
 */
export interface ShaderAttribute {
  location: number;
  name: string;
  format: string; // e.g., 'float32x3', 'float32x4'
  offset: number;
}

/**
 * Complete shader reflection data
 */
export interface ShaderReflectionData {
  /** Bind group layouts extracted from shader */
  bindGroupLayouts: BindGroupLayoutDescriptor[];

  /** Vertex input attributes */
  attributes: ShaderAttribute[];

  /** Entry point names */
  entryPoints: {
    vertex?: string;
    fragment?: string;
    compute?: string;
  };

  /** Workgroup size for compute shaders */
  workgroupSize?: {
    x: number;
    y: number;
    z: number;
  };
}

/**
 * Shader compilation result with reflection data
 */
export interface CompiledShader {
  id: string;
  source: string;
  stage: ShaderStage;
  reflection: ShaderReflectionData;
  /** Backend-specific compiled module (e.g., GPUShaderModule) */
  module: any;
}

/**
 * Parse WGSL shader source to extract reflection data
 *
 * This is a simplified parser for basic WGSL. For production use,
 * integrate with naga-oil or tint for full WGSL support.
 */
export class WGSLReflectionParser {
  /**
   * Parse WGSL source and extract reflection data
   */
  parse(source: string): ShaderReflectionData {
    // CRITICAL: Prevent ReDoS attacks with large malformed shaders
    const MAX_SHADER_SIZE = 1_000_000; // 1MB max
    if (source.length > MAX_SHADER_SIZE) {
      throw new Error(`Shader source too large: ${source.length} bytes (max ${MAX_SHADER_SIZE})`);
    }

    const bindGroupLayouts: BindGroupLayoutDescriptor[] = [];
    const attributes: ShaderAttribute[] = [];
    const entryPoints: ShaderReflectionData['entryPoints'] = {};
    let workgroupSize: { x: number; y: number; z: number } | undefined;

    // Extract bind groups
    const bindGroupRegex = /@group\((\d+)\)\s+@binding\((\d+)\)\s+var(?:<([^>]+)>)?\s+(\w+)\s*:\s*([^;]+);/g;
    let match: RegExpExecArray | null;

    const groupMap = new Map<number, BindGroupLayoutDescriptor>();

    while ((match = bindGroupRegex.exec(source)) !== null) {
      const groupIndex = parseInt(match[1]);
      const bindingIndex = parseInt(match[2]);

      // CRITICAL: Validate extracted values to prevent NaN corruption
      if (isNaN(groupIndex) || isNaN(bindingIndex)) {
        throw new Error(
          `Invalid bind group syntax: @group(${match[1]}) @binding(${match[2]}) ` +
          `- indices must be valid numbers`
        );
      }

      // Validate ranges per WebGPU spec
      if (groupIndex < 0 || groupIndex > 3) {
        throw new Error(
          `Bind group index ${groupIndex} out of range [0, 3] in shader`
        );
      }

      if (bindingIndex < 0 || bindingIndex > 15) {
        throw new Error(
          `Binding index ${bindingIndex} out of range [0, 15] in shader`
        );
      }

      const storageType = match[3]; // e.g., 'uniform', 'storage, read'
      // const varName = match[4]; // Reserved for future use
      const varType = match[5].trim();

      // Determine binding type
      let bindingType: BindingType = 'uniform';
      if (storageType?.includes('storage')) {
        bindingType = 'storage';
      } else if (varType.includes('sampler')) {
        bindingType = 'sampler';
      } else if (varType.includes('texture')) {
        bindingType = 'texture';
      }

      // Determine visibility from usage in entry points
      const visibility: ShaderStage[] = [];
      if (source.includes(`fn vs_main`) || source.includes(`fn vertex_main`)) {
        visibility.push('vertex');
      }
      if (source.includes(`fn fs_main`) || source.includes(`fn fragment_main`)) {
        visibility.push('fragment');
      }
      if (source.includes(`fn compute_main`) || source.includes(`@compute`)) {
        visibility.push('compute');
      }

      // Get or create bind group layout (safe after validation above)
      if (!groupMap.has(groupIndex)) {
        groupMap.set(groupIndex, { entries: [] });
      }

      const layout = groupMap.get(groupIndex)!; // Safe: we just created it if missing
      layout.entries.push({
        binding: bindingIndex,
        visibility,
        type: bindingType,
        minBindingSize: bindingType === 'uniform' || bindingType === 'storage' ? 256 : undefined,
      });
    }

    // Convert map to array
    const maxGroup = Math.max(...Array.from(groupMap.keys()), -1);
    for (let i = 0; i <= maxGroup; i++) {
      bindGroupLayouts.push(groupMap.get(i) || { entries: [] });
    }

    // Extract vertex attributes
    const attrRegex = /@location\((\d+)\)\s+(\w+)\s*:\s*vec(\d+)<f32>/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(source)) !== null) {
      const location = parseInt(attrMatch[1]);
      const components = parseInt(attrMatch[3]);

      // Validate attribute values
      if (isNaN(location) || isNaN(components)) {
        throw new Error(
          `Invalid attribute syntax: @location(${attrMatch[1]}) with vec${attrMatch[3]}`
        );
      }

      if (location < 0 || location > 15) {
        throw new Error(`Attribute location ${location} out of range [0, 15]`);
      }

      if (components < 1 || components > 4) {
        throw new Error(`Invalid vector size vec${components} (must be vec1-vec4)`);
      }

      const name = attrMatch[2];
      attributes.push({
        location,
        name,
        format: `float32x${components}`,
        offset: 0, // Will be computed during pipeline creation
      });
    }

    // Extract entry points
    if (source.includes('@vertex') || source.includes('fn vs_main') || source.includes('fn vertex_main')) {
      entryPoints.vertex = 'vs_main';
    }
    if (source.includes('@fragment') || source.includes('fn fs_main') || source.includes('fn fragment_main')) {
      entryPoints.fragment = 'fs_main';
    }
    if (source.includes('@compute')) {
      entryPoints.compute = 'compute_main';

      // Extract workgroup size
      const workgroupRegex = /@workgroup_size\((\d+)(?:,\s*(\d+))?(?:,\s*(\d+))?\)/;
      const workgroupMatch = source.match(workgroupRegex);
      if (workgroupMatch) {
        const x = parseInt(workgroupMatch[1]);
        const y = workgroupMatch[2] ? parseInt(workgroupMatch[2]) : 1;
        const z = workgroupMatch[3] ? parseInt(workgroupMatch[3]) : 1;

        // Validate workgroup dimensions
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
          throw new Error(
            `Invalid workgroup_size: @workgroup_size(${workgroupMatch[1]}, ${workgroupMatch[2]}, ${workgroupMatch[3]})`
          );
        }

        if (x < 1 || y < 1 || z < 1 || x > 256 || y > 256 || z > 64) {
          throw new Error(
            `Workgroup size (${x}, ${y}, ${z}) out of WebGPU limits (max: 256, 256, 64)`
          );
        }

        workgroupSize = { x, y, z };
      }
    }

    return {
      bindGroupLayouts,
      attributes,
      entryPoints,
      workgroupSize,
    };
  }

  /**
   * Validate reflection data consistency
   */
  validate(reflection: ShaderReflectionData): void {
    // Check that bind group layouts are contiguous
    for (let i = 0; i < reflection.bindGroupLayouts.length; i++) {
      const layout = reflection.bindGroupLayouts[i];
      if (layout.entries.length === 0) {
        console.warn(`Bind group ${i} is empty - this may indicate a parsing error`);
      }
    }

    // Check that attributes are contiguous
    const locations = reflection.attributes.map(a => a.location).sort((a, b) => a - b);
    for (let i = 0; i < locations.length - 1; i++) {
      if (locations[i + 1] !== locations[i] + 1) {
        console.warn(`Attribute locations are not contiguous: ${locations.join(', ')}`);
      }
    }

    // Check that at least one entry point exists
    if (!reflection.entryPoints.vertex && !reflection.entryPoints.fragment && !reflection.entryPoints.compute) {
      throw new Error('No entry points found in shader');
    }
  }
}

/**
 * Cache for shader reflection data to avoid re-parsing
 */
export class ShaderReflectionCache {
  private cache = new Map<string, ShaderReflectionData>();

  /**
   * Get or compute reflection data for shader source
   */
  getOrCompute(source: string, parser: WGSLReflectionParser): ShaderReflectionData {
    // CRITICAL FIX: Use full source as key for small shaders, length + samples for large
    // This prevents hash collisions that would return wrong shader reflection data
    const key = this.createCacheKey(source);

    let reflection = this.cache.get(key);
    if (!reflection) {
      reflection = parser.parse(source);
      parser.validate(reflection);
      this.cache.set(key, reflection);
    }

    return reflection;
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Create a collision-resistant cache key for shader source
   *
   * For small shaders (<10KB), use the full source as the key (zero collision risk).
   * For large shaders, use length + samples from start/middle/end to balance
   * performance vs collision resistance.
   */
  private createCacheKey(source: string): string {
    // Small shaders: use full source (guaranteed no collisions)
    if (source.length < 10240) {
      return source;
    }

    // Large shaders: use length + strategic samples to minimize collision risk
    // This is much safer than a 32-bit hash and still performs well
    const start = source.slice(0, 1000);
    const middle = source.slice(Math.floor(source.length / 2), Math.floor(source.length / 2) + 1000);
    const end = source.slice(-1000);

    return `${source.length}_${start}_${middle}_${end}`;
  }
}
