/**
 * Shader Reflection using AST Parser
 * Epic 3.14 Phase 3 - Task 5
 *
 * Extracts bind group layouts and shader metadata from parsed WGSL AST.
 * Replaces regex-based reflection with AST-based approach.
 */

import { WGSLParser } from './parser/WGSLParser';
import * as AST from './parser/AST';
import type { BindGroupLayoutInfo, BindingInfo } from '../ShaderReflection';

// WebGPU shader stage flags (matching GPUShaderStage values)
export const WGSLShaderStage = {
  VERTEX: 0x1,
  FRAGMENT: 0x2,
  COMPUTE: 0x4,
} as const;

export interface ShaderReflectionResult {
  bindGroups: Map<number, BindGroupLayoutInfo>;
  entryPoints: {
    vertex?: string;
    fragment?: string;
    compute?: string;
  };
  structs: Map<string, AST.StructDeclaration>;
}

export class ShaderReflector {
  private parser: WGSLParser;

  constructor() {
    this.parser = new WGSLParser();
  }

  /**
   * Reflect shader source code to extract bind group layouts and metadata
   */
  reflect(source: string): ShaderReflectionResult {
    const ast = this.parser.parse(source);

    const bindGroups = new Map<number, BindGroupLayoutInfo>();
    const entryPoints = {
      vertex: undefined as string | undefined,
      fragment: undefined as string | undefined,
      compute: undefined as string | undefined,
    };
    const structs = new Map<string, AST.StructDeclaration>();

    // First pass: collect structs for type resolution
    for (const decl of ast.declarations) {
      if (decl.kind === 'StructDeclaration') {
        structs.set(decl.name, decl);
      }
    }

    // Second pass: extract bind groups and entry points
    for (const decl of ast.declarations) {
      if (decl.kind === 'VariableDeclaration') {
        this.extractBindGroup(decl, bindGroups);
      } else if (decl.kind === 'FunctionDeclaration') {
        this.extractEntryPoint(decl, entryPoints);
      }
    }

    return { bindGroups, entryPoints, structs };
  }

  /**
   * Extract bind group information from variable declaration
   */
  private extractBindGroup(
    decl: AST.VariableDeclaration,
    bindGroups: Map<number, BindGroupLayoutInfo>
  ): void {
    // Find @group and @binding attributes
    const groupAttr = decl.attributes.find(a => a.name === 'group');
    const bindingAttr = decl.attributes.find(a => a.name === 'binding');

    if (!groupAttr || !bindingAttr) {
      return; // Not a bind group resource
    }

    const groupIndex = groupAttr.arguments[0] as number;
    const bindingIndex = bindingAttr.arguments[0] as number;

    // Get or create bind group
    if (!bindGroups.has(groupIndex)) {
      bindGroups.set(groupIndex, {
        group: groupIndex,
        bindings: [],
      });
    }

    const bindGroup = bindGroups.get(groupIndex)!;

    // Determine binding type from variable type and storage class
    const binding = this.createBindingInfo(decl, bindingIndex);
    bindGroup.bindings.push(binding);
  }

  /**
   * Create binding info from variable declaration
   */
  private createBindingInfo(decl: AST.VariableDeclaration, bindingIndex: number): BindingInfo {
    const type = decl.type;
    const storageClass = decl.storageClass;
    const accessMode = decl.accessMode;

    // Determine WebGPU binding type
    let bindingType: 'buffer' | 'texture' | 'sampler' | 'storage-texture' = 'buffer';
    let bufferType: 'uniform' | 'storage' | 'read-only-storage' | undefined;
    let textureSampleType: 'float' | 'unfilterable-float' | 'depth' | 'sint' | 'uint' | undefined;
    let samplerType: 'filtering' | 'non-filtering' | 'comparison' | undefined;
    let storageTextureFormat: string | undefined;
    let storageTextureAccess: 'read-only' | 'write-only' | 'read-write' | undefined;

    // Extract type information with validation
    const typeInfo = this.extractTypeInfo(type);

    if (typeInfo.category === 'texture') {
      if (typeInfo.isStorageTexture) {
        bindingType = 'storage-texture';

        // Storage textures have format and access in template parameters
        // e.g., texture_storage_2d<rgba8unorm, write>
        if (typeInfo.templateParams.length < 1) {
          throw new Error(`Storage texture ${decl.name} missing format specification`);
        }

        const format = typeInfo.templateParams[0];

        // Validate against WebGPU storage texture formats
        const validFormats = [
          'rgba8unorm', 'rgba8snorm', 'rgba8uint', 'rgba8sint',
          'rgba16uint', 'rgba16sint', 'rgba16float',
          'r32uint', 'r32sint', 'r32float',
          'rg32uint', 'rg32sint', 'rg32float',
          'rgba32uint', 'rgba32sint', 'rgba32float',
        ];

        if (!validFormats.includes(format)) {
          throw new Error(`Invalid storage texture format for ${decl.name}: ${format}. ` +
            `Valid formats: ${validFormats.join(', ')}`);
        }

        storageTextureFormat = format;

        // Extract access mode from second parameter (default: write-only)
        if (typeInfo.templateParams.length >= 2) {
          const accessParam = typeInfo.templateParams[1];
          if (accessParam === 'read') {
            storageTextureAccess = 'read-only';
          } else if (accessParam === 'write') {
            storageTextureAccess = 'write-only';
          } else if (accessParam === 'read_write') {
            storageTextureAccess = 'read-write';
          } else {
            throw new Error(`Invalid storage texture access mode for ${decl.name}: ${accessParam}. ` +
              `Valid modes: read, write, read_write`);
          }
        } else {
          // Default access mode for storage textures is write-only
          storageTextureAccess = 'write-only';
        }
      } else if (typeInfo.isDepthTexture) {
        bindingType = 'texture';
        textureSampleType = 'depth';
      } else {
        bindingType = 'texture';
        // Infer sample type from template parameter
        if (typeInfo.templateParams.length > 0) {
          const formatParam = typeInfo.templateParams[0];
          if (formatParam.includes('i32')) {
            textureSampleType = 'sint';
          } else if (formatParam.includes('u32')) {
            textureSampleType = 'uint';
          } else {
            textureSampleType = 'float';
          }
        } else {
          textureSampleType = 'float';
        }
      }
    } else if (typeInfo.category === 'sampler') {
      bindingType = 'sampler';
      samplerType = typeInfo.isSamplerComparison ? 'comparison' : 'filtering';
    } else {
      // Buffer binding
      bindingType = 'buffer';

      if (storageClass === 'uniform') {
        bufferType = 'uniform';
      } else if (storageClass === 'storage') {
        if (accessMode === 'read' || !accessMode) {
          bufferType = 'read-only-storage';
        } else {
          bufferType = 'storage';
        }
      } else if (!storageClass) {
        throw new Error(`Variable ${decl.name} has no storage class but appears to be a buffer`);
      }
    }

    return {
      binding: bindingIndex,
      name: decl.name,
      type: bindingType,
      bufferType,
      textureSampleType,
      samplerType,
      storageTextureFormat,
      storageTextureAccess,
      // Default visibility: all stages
      visibility: WGSLShaderStage.VERTEX | WGSLShaderStage.FRAGMENT | WGSLShaderStage.COMPUTE,
      isRuntimeSizedArray: typeInfo.isRuntimeSizedArray,
    };
  }

  /**
   * Extract and validate type information
   */
  private extractTypeInfo(type: AST.TypeExpression): {
    category: 'texture' | 'sampler' | 'buffer';
    isStorageTexture: boolean;
    isDepthTexture: boolean;
    isSamplerComparison: boolean;
    templateParams: string[];
    isRuntimeSizedArray: boolean;
  } {
    let typeName = '';
    let templateParams: string[] = [];

    // Extract base type and template parameters
    if (type.kind === 'SimpleType') {
      typeName = type.name;
    } else if (type.kind === 'TemplateType') {
      typeName = type.name;
      // Extract template parameter names
      for (const param of type.parameters) {
        if (param.kind === 'SimpleType') {
          templateParams.push(param.name);
        }
      }
    } else if (type.kind === 'ArrayType') {
      // For arrays, check the element type
      return {
        ...this.extractTypeInfo(type.elementType),
        isRuntimeSizedArray: type.size === null,
      };
    } else {
      throw new Error(`Unknown type expression kind: ${(type as any).kind}`);
    }

    // Validate and categorize type
    const validTextureTypes = [
      'texture_1d', 'texture_2d', 'texture_2d_array', 'texture_3d', 'texture_cube', 'texture_cube_array',
      'texture_multisampled_2d',
      'texture_depth_2d', 'texture_depth_2d_array', 'texture_depth_cube', 'texture_depth_cube_array',
      'texture_depth_multisampled_2d',
      'texture_storage_1d', 'texture_storage_2d', 'texture_storage_2d_array', 'texture_storage_3d',
      'texture_external',
    ];

    const validSamplerTypes = ['sampler', 'sampler_comparison'];

    if (validTextureTypes.includes(typeName)) {
      return {
        category: 'texture',
        isStorageTexture: typeName.includes('storage'),
        isDepthTexture: typeName.includes('depth'),
        isSamplerComparison: false,
        templateParams,
        isRuntimeSizedArray: false,
      };
    } else if (validSamplerTypes.includes(typeName)) {
      return {
        category: 'sampler',
        isStorageTexture: false,
        isDepthTexture: false,
        isSamplerComparison: typeName === 'sampler_comparison',
        templateParams,
        isRuntimeSizedArray: false,
      };
    } else {
      // Assume buffer type (struct, vec4f, mat4x4f, array, etc.)
      return {
        category: 'buffer',
        isStorageTexture: false,
        isDepthTexture: false,
        isSamplerComparison: false,
        templateParams,
        isRuntimeSizedArray: false,
      };
    }
  }


  /**
   * Extract entry point information from function declaration
   */
  private extractEntryPoint(
    decl: AST.FunctionDeclaration,
    entryPoints: { vertex?: string; fragment?: string; compute?: string }
  ): void {
    // Check for stage attributes
    const hasVertex = decl.attributes.some(a => a.name === 'vertex');
    const hasFragment = decl.attributes.some(a => a.name === 'fragment');
    const hasCompute = decl.attributes.some(a => a.name === 'compute');

    if (hasVertex) {
      entryPoints.vertex = decl.name;
    }
    if (hasFragment) {
      entryPoints.fragment = decl.name;
    }
    if (hasCompute) {
      entryPoints.compute = decl.name;
    }
  }

  /**
   * Validate bind group layout against WebGPU limits
   */
  validateBindGroupLayout(reflection: ShaderReflectionResult): string[] {
    const errors: string[] = [];

    // WebGPU guaranteed limits (from spec - GPULimits)
    // These are the minimum limits that all WebGPU implementations must support
    const MAX_BIND_GROUPS = 4; // maxBindGroups
    const MAX_BINDINGS_PER_GROUP = 1000; // maxBindingsPerBindGroup (spec minimum)

    // Check bind group limits
    if (reflection.bindGroups.size > MAX_BIND_GROUPS) {
      errors.push(
        `Shader uses ${reflection.bindGroups.size} bind groups, but WebGPU limit is ${MAX_BIND_GROUPS}`
      );
    }

    for (const [groupIndex, bindGroup] of reflection.bindGroups) {
      // Check bindings per group
      if (bindGroup.bindings.length > MAX_BINDINGS_PER_GROUP) {
        errors.push(
          `Bind group ${groupIndex} has ${bindGroup.bindings.length} bindings, but limit is ${MAX_BINDINGS_PER_GROUP}`
        );
      }

      // Check for duplicate bindings
      const bindingIndices = new Set<number>();
      for (const binding of bindGroup.bindings) {
        if (bindingIndices.has(binding.binding)) {
          errors.push(
            `Bind group ${groupIndex} has duplicate binding index ${binding.binding}`
          );
        }
        bindingIndices.add(binding.binding);
      }
    }

    // Check for entry points
    if (!reflection.entryPoints.vertex && !reflection.entryPoints.fragment && !reflection.entryPoints.compute) {
      errors.push('Shader has no entry points (@vertex, @fragment, or @compute)');
    }

    return errors;
  }

  /**
   * Convert reflection result to WebGPU bind group layout descriptor
   */
  toBindGroupLayoutDescriptor(
    bindGroupInfo: BindGroupLayoutInfo
  ): GPUBindGroupLayoutDescriptor {
    const entries: GPUBindGroupLayoutEntry[] = bindGroupInfo.bindings.map((binding: BindingInfo) => {
      const entry: GPUBindGroupLayoutEntry = {
        binding: binding.binding,
        visibility: binding.visibility,
      };

      switch (binding.type) {
        case 'buffer':
          entry.buffer = {
            type: binding.bufferType || 'uniform',
          };
          break;
        case 'texture':
          entry.texture = {
            sampleType: binding.textureSampleType || 'float',
          };
          break;
        case 'sampler':
          entry.sampler = {
            type: binding.samplerType || 'filtering',
          };
          break;
        case 'storage-texture':
          if (!binding.storageTextureFormat) {
            throw new Error(`Storage texture ${binding.name} missing format information`);
          }
          entry.storageTexture = {
            access: binding.storageTextureAccess || 'write-only',
            format: binding.storageTextureFormat as GPUTextureFormat,
          };
          break;
      }

      return entry;
    });

    return {
      entries,
    };
  }
}
