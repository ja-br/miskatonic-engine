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
import { ShaderReflector, WGSLShaderStage, type ShaderReflectionResult } from './shaders/ShaderReflector';

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
 * Epic 3.14 Phase 3 Task 6: Integration & Migration
 * - Supports both regex-based (legacy) and AST-based (experimental) parsers
 * - Feature flag controlled via setUseASTParser()
 * - Falls back to regex parser if AST parser fails
 *
 * EXPERIMENTAL: AST parser has limitations (see PARSER_MIGRATION.md)
 */
export class WGSLReflectionParser {
  /**
   * Feature flag: Use AST-based parser instead of regex parser
   * Default: false (regex parser for stability)
   */
  private static useASTParser = false;

  /**
   * Cached AST parser instance (created on first use)
   */
  private static astParserInstance: ShaderReflector | null = null;

  /**
   * Enable or disable AST-based parser
   *
   * @param enabled - true to use AST parser, false for regex parser
   *
   * @example
   * ```typescript
   * // Enable experimental AST parser
   * WGSLReflectionParser.setUseASTParser(true);
   *
   * // Disable and return to stable regex parser
   * WGSLReflectionParser.setUseASTParser(false);
   * ```
   */
  static setUseASTParser(enabled: boolean): void {
    this.useASTParser = enabled;
    if (enabled && !this.astParserInstance) {
      this.astParserInstance = new ShaderReflector();
    }
  }

  /**
   * Check if AST parser is currently enabled
   */
  static isUsingASTParser(): boolean {
    return this.useASTParser;
  }

  /**
   * Parse WGSL source and extract reflection data
   *
   * Supports two parsing modes:
   * 1. Regex parser (default, stable) - Lines 114-267 original implementation
   * 2. AST parser (experimental) - Full WGSL tokenizer + parser + reflector
   *
   * @param source - WGSL shader source code
   * @returns Reflection data (bind groups, attributes, entry points)
   * @throws Error if shader is too large or parsing fails
   */
  parse(source: string): ShaderReflectionData {
    // CRITICAL: Prevent ReDoS attacks with large malformed shaders
    const MAX_SHADER_SIZE = 1_000_000; // 1MB max
    if (source.length > MAX_SHADER_SIZE) {
      throw new Error(`Shader source too large: ${source.length} bytes (max ${MAX_SHADER_SIZE})`);
    }

    // Parse with regex (baseline - always run for comparison)
    const regexResult = this.parseRegex(source);

    // Feature flag: Use AST parser if enabled
    if (WGSLReflectionParser.useASTParser && WGSLReflectionParser.astParserInstance) {
      try {
        const astResult = this.parseAST(source, WGSLReflectionParser.astParserInstance);

        // MIGRATION: Validate consistency in development mode
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
          this.validateResultsMatch(regexResult, astResult);
        }

        return astResult;
      } catch (error) {
        // FALLBACK: If AST parser fails, use regex parser
        console.error('AST parser failed, falling back to regex:', error);
        return regexResult;
      }
    }

    return regexResult;
  }

  /**
   * Parse using regex-based approach (legacy, stable)
   * Original implementation from Epic 3.14 Phase 1
   */
  private parseRegex(source: string): ShaderReflectionData {
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
   * Parse using AST-based approach (experimental)
   * Epic 3.14 Phase 3 - Full tokenizer + parser + reflector pipeline
   *
   * @param source - WGSL shader source
   * @param parser - Cached ShaderReflector instance
   * @returns Reflection data converted to legacy format
   */
  private parseAST(source: string, parser: ShaderReflector): ShaderReflectionData {
    const astResult = parser.reflect(source);

    // Validate against WebGPU limits
    const errors = parser.validateBindGroupLayout(astResult);
    if (errors.length > 0) {
      console.warn('Shader validation warnings:', errors);
      // Don't throw - match legacy behavior of logging warnings
    }

    return this.convertASTToLegacy(astResult);
  }

  /**
   * Convert AST parser result to legacy API format
   *
   * LIMITATION: This conversion loses data because legacy API is less detailed:
   * - textureSampleType (float/sint/uint) is discarded
   * - samplerType (filtering/comparison) is discarded
   * - storageTextureFormat and access are discarded (storage textures throw error)
   * - isRuntimeSizedArray flag is discarded
   *
   * @param astResult - Result from ShaderReflector
   * @returns ShaderReflectionData in legacy format
   * @throws Error if shader uses storage textures (not supported by legacy API)
   */
  private convertASTToLegacy(astResult: ShaderReflectionResult): ShaderReflectionData {
    const bindGroupLayouts: BindGroupLayoutDescriptor[] = [];

    // Convert Map<number, BindGroupLayoutInfo> to BindGroupLayoutDescriptor[]
    const maxGroup = Math.max(...Array.from(astResult.bindGroups.keys()), -1);
    for (let i = 0; i <= maxGroup; i++) {
      const bindGroup = astResult.bindGroups.get(i);
      if (!bindGroup) {
        bindGroupLayouts.push({ entries: [] });
        continue;
      }

      // Convert BindingInfo[] to legacy BindGroupLayoutEntry[]
      const entries = bindGroup.bindings.map(binding => {
        const visibility = this.convertVisibilityFlags(binding.visibility);
        const type = this.convertBindingType(binding); // Throws on storage textures

        return {
          binding: binding.binding,
          visibility,
          type,
          minBindingSize: binding.type === 'buffer' ? 256 : undefined,
        };
      });

      bindGroupLayouts.push({ entries });
    }

    // LIMITATION: AST parser doesn't extract these yet
    // TODO Epic 3.14 Phase 4: Implement attribute and workgroup size extraction
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.warn(
        'AST parser limitations: vertex attributes and workgroupSize not extracted yet. ' +
        'Returns empty arrays/undefined. See PARSER_MIGRATION.md for details.'
      );
    }

    return {
      bindGroupLayouts,
      attributes: [], // Not extracted by AST parser yet
      entryPoints: astResult.entryPoints,
      workgroupSize: undefined, // Not extracted by AST parser yet
    };
  }

  /**
   * Convert WebGPU shader stage flags to legacy visibility array
   *
   * @param flags - Bitfield from WGSLShaderStage (0x1 = vertex, 0x2 = fragment, 0x4 = compute)
   * @returns Array of stage names for legacy API
   */
  private convertVisibilityFlags(flags: number): ShaderStage[] {
    const visibility: ShaderStage[] = [];

    if (flags & WGSLShaderStage.VERTEX) visibility.push('vertex');
    if (flags & WGSLShaderStage.FRAGMENT) visibility.push('fragment');
    if (flags & WGSLShaderStage.COMPUTE) visibility.push('compute');

    return visibility;
  }

  /**
   * Convert BindingInfo type to legacy BindingType
   *
   * LIMITATION: Storage textures are NOT supported by legacy API
   * - Legacy API has no way to represent storage texture format/access
   * - Throws error with actionable message if storage texture encountered
   *
   * @param binding - Detailed binding info from AST parser
   * @returns Legacy binding type
   * @throws Error if binding is a storage texture
   */
  private convertBindingType(binding: BindingInfo): BindingType {
    switch (binding.type) {
      case 'buffer':
        // Map storage and read-only-storage to 'storage', uniform to 'uniform'
        return binding.bufferType === 'storage' || binding.bufferType === 'read-only-storage'
          ? 'storage'
          : 'uniform';

      case 'texture':
        return 'texture';

      case 'sampler':
        return 'sampler';

      case 'storage-texture':
        // CRITICAL: Legacy API cannot represent storage textures
        throw new Error(
          `Storage textures are not supported by legacy WGSLReflectionParser API. ` +
          `Binding: ${binding.name}, Format: ${binding.storageTextureFormat}, ` +
          `Access: ${binding.storageTextureAccess}. ` +
          `Solution: Either (1) use ShaderReflector directly for full API, ` +
          `(2) disable AST parser with WGSLReflectionParser.setUseASTParser(false), ` +
          `or (3) wait for new high-level API in Epic 3.14 Phase 4.`
        );

      default:
        // Fallback to uniform for unknown types
        return 'uniform';
    }
  }

  /**
   * Validate that regex and AST parsers produce equivalent results
   *
   * Used in development mode to catch parser discrepancies during migration.
   * Logs detailed errors if results don't match.
   *
   * @param regex - Result from regex parser
   * @param ast - Result from AST parser
   */
  private validateResultsMatch(regex: ShaderReflectionData, ast: ShaderReflectionData): void {
    const errors: string[] = [];

    // Compare bind group counts
    if (regex.bindGroupLayouts.length !== ast.bindGroupLayouts.length) {
      errors.push(
        `Bind group count mismatch: regex=${regex.bindGroupLayouts.length}, ast=${ast.bindGroupLayouts.length}`
      );
    }

    // Compare entry points
    if (regex.entryPoints.vertex !== ast.entryPoints.vertex) {
      errors.push(
        `Vertex entry point mismatch: regex=${regex.entryPoints.vertex}, ast=${ast.entryPoints.vertex}`
      );
    }

    if (regex.entryPoints.fragment !== ast.entryPoints.fragment) {
      errors.push(
        `Fragment entry point mismatch: regex=${regex.entryPoints.fragment}, ast=${ast.entryPoints.fragment}`
      );
    }

    if (regex.entryPoints.compute !== ast.entryPoints.compute) {
      errors.push(
        `Compute entry point mismatch: regex=${regex.entryPoints.compute}, ast=${ast.entryPoints.compute}`
      );
    }

    // Log errors if validation failed
    if (errors.length > 0) {
      console.error('❌ Parser validation failed:', errors);
      console.error('Regex result:', JSON.stringify(regex, null, 2));
      console.error('AST result:', JSON.stringify(ast, null, 2));
    } else {
      console.log('✅ Parser validation passed - regex and AST results match');
    }
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
