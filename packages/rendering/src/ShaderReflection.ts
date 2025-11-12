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

      // Get or create bind group layout
      if (!groupMap.has(groupIndex)) {
        groupMap.set(groupIndex, { entries: [] });
      }

      const layout = groupMap.get(groupIndex)!;
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
      const name = attrMatch[2];
      const components = parseInt(attrMatch[3]);
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
        workgroupSize = {
          x: parseInt(workgroupMatch[1]),
          y: workgroupMatch[2] ? parseInt(workgroupMatch[2]) : 1,
          z: workgroupMatch[3] ? parseInt(workgroupMatch[3]) : 1,
        };
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
    // Use source hash as cache key
    const key = this.hashSource(source);

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
   * Simple hash function for shader source
   */
  private hashSource(source: string): string {
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
      const char = source.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}
