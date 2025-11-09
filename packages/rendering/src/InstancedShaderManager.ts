/**
 * InstancedShaderManager - Epic 3.13
 *
 * Manages shader variants for instanced rendering.
 * Automatically injects instance transform attributes into vertex shaders.
 */

import type { ShaderSource } from './types';

/**
 * Shader variant type
 */
export type ShaderVariant = 'standard' | 'instanced';

/**
 * Instanced shader configuration
 */
export interface InstancedShaderConfig {
  /**
   * Enable automatic variant generation
   *
   * If true, creates both standard and instanced variants.
   * If false, only creates requested variant.
   *
   * Default: true
   */
  autoGenerateVariants: boolean;

  /**
   * Instance attribute name
   *
   * Name of the instance transform attribute in vertex shader.
   *
   * Default: 'a_InstanceTransform'
   */
  instanceAttributeName: string;
}

/**
 * Instanced shader manager
 *
 * Provides utilities for creating instanced shader variants.
 */
export class InstancedShaderManager {
  private config: InstancedShaderConfig;

  constructor(config?: Partial<InstancedShaderConfig>) {
    this.config = {
      autoGenerateVariants: config?.autoGenerateVariants ?? true,
      instanceAttributeName: config?.instanceAttributeName ?? 'a_InstanceTransform',
    };
  }

  /**
   * Create instanced variant of shader source
   *
   * Modifies vertex shader to use instance transform attribute instead of uniform.
   *
   * @param source - Original shader source (standard variant)
   * @returns Instanced shader source
   */
  createInstancedVariant(source: ShaderSource): ShaderSource {
    const vertex = this.injectInstanceTransform(source.vertex);

    return {
      vertex,
      fragment: source.fragment, // Fragment shader unchanged
    };
  }

  /**
   * Inject instance transform attribute into vertex shader
   *
   * Replaces:
   *   uniform mat4 u_ModelMatrix;
   *   gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * vec4(a_Position, 1.0);
   *
   * With:
   *   in mat4 a_InstanceTransform;
   *   gl_Position = u_ProjectionMatrix * u_ViewMatrix * a_InstanceTransform * vec4(a_Position, 1.0);
   *
   * @param vertexSource - Original vertex shader source
   * @returns Modified vertex shader source with instance transform
   */
  private injectInstanceTransform(vertexSource: string): string {
    const lines = vertexSource.split('\n');
    const result: string[] = [];

    let hasModelMatrix = false;
    let insertedInstanceAttribute = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Detect u_ModelMatrix uniform
      if (line.includes('uniform') && line.includes('mat4') && line.includes('u_ModelMatrix')) {
        hasModelMatrix = true;

        // Replace uniform with instance attribute
        line = line.replace('uniform mat4 u_ModelMatrix', `in mat4 ${this.config.instanceAttributeName}`);
        insertedInstanceAttribute = true;
      }

      // Replace u_ModelMatrix usage with instance attribute
      if (line.includes('u_ModelMatrix')) {
        line = line.replace(/u_ModelMatrix/g, this.config.instanceAttributeName);
      }

      result.push(line);
    }

    // If no model matrix found, add instance attribute at the top
    if (!hasModelMatrix && !insertedInstanceAttribute) {
      // Find version directive
      const versionIndex = result.findIndex(l => l.trim().startsWith('#version'));
      const insertIndex = versionIndex >= 0 ? versionIndex + 1 : 0;

      result.splice(insertIndex, 0, `in mat4 ${this.config.instanceAttributeName};`);
    }

    return result.join('\n');
  }

  /**
   * Check if shader source uses model matrix
   *
   * @param vertexSource - Vertex shader source
   * @returns true if shader uses u_ModelMatrix uniform
   */
  hasModelMatrix(vertexSource: string): boolean {
    return vertexSource.includes('u_ModelMatrix');
  }

  /**
   * Get instance attribute name
   */
  getInstanceAttributeName(): string {
    return this.config.instanceAttributeName;
  }

  /**
   * Generate shader variant ID
   *
   * @param baseId - Base shader ID
   * @param variant - Variant type
   * @returns Variant shader ID
   */
  static getVariantId(baseId: string, variant: ShaderVariant): string {
    return variant === 'instanced' ? `${baseId}_instanced` : baseId;
  }

  /**
   * Parse variant from shader ID
   *
   * @param shaderId - Shader ID (possibly with variant suffix)
   * @returns Variant type
   */
  static parseVariant(shaderId: string): ShaderVariant {
    return shaderId.endsWith('_instanced') ? 'instanced' : 'standard';
  }

  /**
   * Get base shader ID without variant suffix
   *
   * @param shaderId - Shader ID (possibly with variant suffix)
   * @returns Base shader ID
   */
  static getBaseId(shaderId: string): string {
    return shaderId.replace(/_instanced$/, '');
  }
}

/**
 * Helper function to create both standard and instanced variants
 *
 * @param baseId - Base shader ID
 * @param source - Standard shader source
 * @param manager - Instanced shader manager (optional, creates default if not provided)
 * @returns Object with standard and instanced sources
 */
export function createShaderVariants(
  baseId: string,
  source: ShaderSource,
  manager?: InstancedShaderManager
): { standard: { id: string; source: ShaderSource }; instanced: { id: string; source: ShaderSource } } {
  const instanceManager = manager || new InstancedShaderManager();

  return {
    standard: {
      id: InstancedShaderManager.getVariantId(baseId, 'standard'),
      source,
    },
    instanced: {
      id: InstancedShaderManager.getVariantId(baseId, 'instanced'),
      source: instanceManager.createInstancedVariant(source),
    },
  };
}

/**
 * Example shader transformation
 *
 * Input (standard variant):
 * ```glsl
 * #version 300 es
 * in vec3 a_Position;
 * in vec3 a_Normal;
 *
 * uniform mat4 u_ModelMatrix;
 * uniform mat4 u_ViewMatrix;
 * uniform mat4 u_ProjectionMatrix;
 *
 * out vec3 v_Normal;
 *
 * void main() {
 *   v_Normal = mat3(u_ModelMatrix) * a_Normal;
 *   gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * vec4(a_Position, 1.0);
 * }
 * ```
 *
 * Output (instanced variant):
 * ```glsl
 * #version 300 es
 * in vec3 a_Position;
 * in vec3 a_Normal;
 * in mat4 a_InstanceTransform;  // ← Added
 *
 * uniform mat4 u_ViewMatrix;
 * uniform mat4 u_ProjectionMatrix;
 *
 * out vec3 v_Normal;
 *
 * void main() {
 *   v_Normal = mat3(a_InstanceTransform) * a_Normal;  // ← Replaced
 *   gl_Position = u_ProjectionMatrix * u_ViewMatrix * a_InstanceTransform * vec4(a_Position, 1.0);  // ← Replaced
 * }
 * ```
 */
