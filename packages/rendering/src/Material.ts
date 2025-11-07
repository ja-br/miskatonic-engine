/**
 * PBR Material System
 *
 * Implements physically-based rendering materials using the Cook-Torrance BRDF model.
 * Materials define surface properties for realistic lighting with full GPU integration.
 */

import type { RenderState, ShaderProgram } from './types';
import { UniformType as UT } from './types';
import type { ShaderManager } from './ShaderManager';
import type { TextureManager } from './TextureManager';

/**
 * PBR material properties
 */
export interface PBRMaterialProperties {
  // Base color (albedo)
  baseColor: [number, number, number, number]; // RGBA

  // Metallic workflow
  metallic: number; // 0 = dielectric, 1 = metal
  roughness: number; // 0 = smooth, 1 = rough

  // Additional properties
  emissive?: [number, number, number]; // RGB
  emissiveIntensity?: number;

  // Ambient occlusion
  ao?: number; // 0 = fully occluded, 1 = no occlusion

  // Normal mapping
  normalScale?: number; // Normal map intensity

  // Alpha
  opacity?: number; // 0 = transparent, 1 = opaque
  alphaMode?: 'opaque' | 'blend' | 'mask';
  alphaCutoff?: number; // For mask mode
}

/**
 * Material texture slots
 */
export interface MaterialTextures {
  baseColorMap?: string; // Texture ID
  metallicRoughnessMap?: string; // Metallic (B) + Roughness (G)
  normalMap?: string;
  emissiveMap?: string;
  aoMap?: string; // Ambient occlusion
}

/**
 * Material configuration
 */
export interface MaterialConfig {
  id: string;
  name?: string;
  shaderId: string; // Required: shader program ID
  properties: PBRMaterialProperties;
  textures?: MaterialTextures;
  renderState?: Partial<RenderState>;

  // Render flags
  doubleSided?: boolean;
  castShadows?: boolean;
  receiveShadows?: boolean;
}

/**
 * Material instance
 */
export interface Material {
  id: string;
  name: string;
  shaderId: string;
  properties: PBRMaterialProperties;
  textures: MaterialTextures;
  renderState: Partial<RenderState>;
  doubleSided: boolean;
  castShadows: boolean;
  receiveShadows: boolean;
}

/**
 * Material manager for creating and managing materials with GPU integration
 */
export class MaterialManager {
  private gl: WebGL2RenderingContext;
  private shaderManager: ShaderManager;
  private textureManager: TextureManager;
  private materials = new Map<string, Material>();
  private defaultMaterial: Material | null = null;
  private emergencyFallback: Material | null = null;
  private static readonly MAX_MATERIALS = 1000;
  private static readonly MAX_TEXTURE_UNITS = 16; // WebGL2 minimum guaranteed

  constructor(
    gl: WebGL2RenderingContext,
    shaderManager: ShaderManager,
    textureManager: TextureManager
  ) {
    this.gl = gl;
    this.shaderManager = shaderManager;
    this.textureManager = textureManager;

    // Handle WebGL context loss
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.addEventListener('webglcontextlost', this.handleContextLost.bind(this), false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored.bind(this), false);
  }

  /**
   * Handle WebGL context loss
   */
  private handleContextLost(event: Event): void {
    event.preventDefault();
    console.warn('WebGL context lost - material system disabled until restore');
  }

  /**
   * Handle WebGL context restored
   */
  private handleContextRestored(): void {
    console.log('WebGL context restored - materials need to be rebound');
    // Note: Materials themselves don't hold GL resources, but shaders do
    // ShaderManager will need to recompile shaders, TextureManager will reload textures
    // Materials just hold references, so they're still valid
  }

  /**
   * Create a new material
   */
  createMaterial(config: MaterialConfig): Material {
    // Check if material already exists
    if (this.materials.has(config.id)) {
      throw new Error(`Material already exists: ${config.id}`);
    }

    // Check material limit
    if (this.materials.size >= MaterialManager.MAX_MATERIALS) {
      throw new Error(`Maximum material count exceeded (${MaterialManager.MAX_MATERIALS})`);
    }

    // Validate shader exists
    if (!this.shaderManager.hasProgram(config.shaderId)) {
      throw new Error(`Shader program not found: ${config.shaderId}`);
    }

    // Validate properties
    this.validateMaterialProperties(config.properties);

    // Validate textures exist
    if (config.textures) {
      this.validateTextures(config.textures);
    }

    // Clamp properties to valid ranges
    const properties = this.clampProperties(config.properties);

    // Create material
    const material: Material = {
      id: config.id,
      name: config.name ?? config.id,
      shaderId: config.shaderId,
      properties: {
        ...properties,
        emissiveIntensity: properties.emissiveIntensity ?? 1.0,
        ao: properties.ao ?? 1.0,
        normalScale: properties.normalScale ?? 1.0,
        opacity: properties.opacity ?? 1.0,
        alphaMode: properties.alphaMode ?? 'opaque',
        alphaCutoff: properties.alphaCutoff ?? 0.5,
      },
      textures: config.textures ?? {},
      renderState: config.renderState ?? {},
      doubleSided: config.doubleSided ?? false,
      castShadows: config.castShadows ?? true,
      receiveShadows: config.receiveShadows ?? true,
    };

    this.materials.set(config.id, material);
    // Invalidate cache
    this.materialIdsCache = null;
    return material;
  }

  /**
   * Get material by ID with fallback to default
   */
  getMaterial(id: string): Material {
    const material = this.materials.get(id);
    if (material) {
      return material;
    }

    // Return default material if not found
    if (!this.defaultMaterial) {
      console.warn(`Material not found: ${id}, and no default material is set`);
      // Return singleton emergency fallback
      if (!this.emergencyFallback) {
        this.emergencyFallback = this.createEmergencyFallback();
      }
      return this.emergencyFallback;
    }

    console.warn(`Material not found: ${id}, using default material`);
    return this.defaultMaterial;
  }

  /**
   * Get material by ID (nullable)
   */
  getMaterialOrNull(id: string): Material | null {
    return this.materials.get(id) ?? null;
  }

  /**
   * Check if material exists
   */
  hasMaterial(id: string): boolean {
    return this.materials.has(id);
  }

  /**
   * Delete material
   */
  deleteMaterial(id: string): void {
    this.materials.delete(id);
    // Invalidate cache
    this.materialIdsCache = null;
  }

  /**
   * Get all material IDs (cached array)
   */
  private materialIdsCache: string[] | null = null;
  getMaterialIds(): string[] {
    if (!this.materialIdsCache) {
      this.materialIdsCache = Array.from(this.materials.keys());
    }
    return this.materialIdsCache;
  }

  /**
   * Set default material
   */
  setDefaultMaterial(id: string): void {
    const material = this.materials.get(id);
    if (!material) {
      throw new Error(`Cannot set default material: ${id} not found`);
    }
    this.defaultMaterial = material;
  }

  /**
   * Bind material to GPU
   */
  bindMaterial(material: Material): void {
    // Get shader program
    const program = this.shaderManager.getProgram(material.shaderId);
    if (!program) {
      throw new Error(`Shader program not found: ${material.shaderId}`);
    }

    // Use shader program
    this.gl.useProgram(program.program);

    // Bind material properties
    const props = material.properties;

    this.shaderManager.setUniform(program, 'u_baseColor', UT.VEC4, props.baseColor);
    this.shaderManager.setUniform(program, 'u_metallic', UT.FLOAT, props.metallic);
    this.shaderManager.setUniform(program, 'u_roughness', UT.FLOAT, props.roughness);
    this.shaderManager.setUniform(program, 'u_emissive', UT.VEC3, props.emissive ?? [0, 0, 0]);
    this.shaderManager.setUniform(program, 'u_emissiveIntensity', UT.FLOAT, props.emissiveIntensity ?? 1.0);
    this.shaderManager.setUniform(program, 'u_ao', UT.FLOAT, props.ao ?? 1.0);
    this.shaderManager.setUniform(program, 'u_normalScale', UT.FLOAT, props.normalScale ?? 1.0);
    this.shaderManager.setUniform(program, 'u_opacity', UT.FLOAT, props.opacity ?? 1.0);

    // Bind textures
    this.bindTextures(material, program);
  }

  /**
   * Bind material textures to GPU
   */
  private bindTextures(material: Material, program: ShaderProgram): void {
    const textures = material.textures;
    let textureUnit = 0;

    // Helper to bind texture with unit limit check
    const bindTexture = (textureId: string | undefined, uniformName: string, flagName: string): boolean => {
      if (!textureId || !this.textureManager.hasTexture(textureId)) {
        this.shaderManager.setUniform(program, flagName, UT.INT, 0);
        return false;
      }

      if (textureUnit >= MaterialManager.MAX_TEXTURE_UNITS) {
        console.error(`Texture unit overflow (max ${MaterialManager.MAX_TEXTURE_UNITS}): skipping ${uniformName}`);
        this.shaderManager.setUniform(program, flagName, UT.INT, 0);
        return false;
      }

      const texture = this.textureManager.getTexture(textureId);
      if (texture) {
        this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.shaderManager.setUniform(program, uniformName, UT.INT, textureUnit);
        this.shaderManager.setUniform(program, flagName, UT.INT, 1);
        textureUnit++;
        return true;
      }

      this.shaderManager.setUniform(program, flagName, UT.INT, 0);
      return false;
    };

    // Bind all textures with overflow protection
    bindTexture(textures.baseColorMap, 'u_baseColorMap', 'u_hasBaseColorMap');
    bindTexture(textures.metallicRoughnessMap, 'u_metallicRoughnessMap', 'u_hasMetallicRoughnessMap');
    bindTexture(textures.normalMap, 'u_normalMap', 'u_hasNormalMap');
    bindTexture(textures.emissiveMap, 'u_emissiveMap', 'u_hasEmissiveMap');
    bindTexture(textures.aoMap, 'u_aoMap', 'u_hasAOMap');
  }

  /**
   * Update material properties
   */
  updateMaterialProperties(id: string, properties: Partial<PBRMaterialProperties>): void {
    const material = this.materials.get(id);
    if (!material) {
      throw new Error(`Material not found: ${id}`);
    }

    // Validate and clamp updated properties
    const updatedProperties = { ...material.properties, ...properties };
    this.validateMaterialProperties(updatedProperties);
    const clampedProperties = this.clampProperties(updatedProperties);

    // Update properties
    material.properties = clampedProperties;

    // Invalidate cache
    this.materialIdsCache = null;
  }

  /**
   * Update material textures
   */
  updateMaterialTextures(id: string, textures: Partial<MaterialTextures>): void {
    const material = this.materials.get(id);
    if (!material) {
      throw new Error(`Material not found: ${id}`);
    }

    // Validate textures exist
    this.validateTextures(textures);

    material.textures = { ...material.textures, ...textures };
  }

  /**
   * Validate textures exist in TextureManager
   */
  private validateTextures(textures: Partial<MaterialTextures>): void {
    const textureIds = Object.values(textures).filter((id): id is string => id !== undefined);

    for (const textureId of textureIds) {
      if (!this.textureManager.hasTexture(textureId)) {
        console.warn(`Texture not found: ${textureId}`);
      }
    }
  }

  /**
   * Validate material properties
   */
  private validateMaterialProperties(properties: PBRMaterialProperties): void {
    // Validate base color
    if (!properties.baseColor || properties.baseColor.length !== 4) {
      throw new Error('Base color must be an RGBA array [r, g, b, a]');
    }

    // Validate ranges
    if (properties.metallic < 0 || properties.metallic > 1) {
      throw new Error('Metallic must be between 0 and 1');
    }

    if (properties.roughness < 0 || properties.roughness > 1) {
      throw new Error('Roughness must be between 0 and 1');
    }

    if (properties.ao !== undefined && (properties.ao < 0 || properties.ao > 1)) {
      throw new Error('AO must be between 0 and 1');
    }

    if (properties.opacity !== undefined && (properties.opacity < 0 || properties.opacity > 1)) {
      throw new Error('Opacity must be between 0 and 1');
    }

    if (properties.alphaCutoff !== undefined && (properties.alphaCutoff < 0 || properties.alphaCutoff > 1)) {
      throw new Error('Alpha cutoff must be between 0 and 1');
    }
  }

  /**
   * Clamp properties to valid ranges (security fix)
   */
  private clampProperties(properties: PBRMaterialProperties): PBRMaterialProperties {
    return {
      baseColor: [
        Math.max(0, Math.min(1, properties.baseColor[0])),
        Math.max(0, Math.min(1, properties.baseColor[1])),
        Math.max(0, Math.min(1, properties.baseColor[2])),
        Math.max(0, Math.min(1, properties.baseColor[3])),
      ] as [number, number, number, number],
      metallic: Math.max(0, Math.min(1, properties.metallic)),
      roughness: Math.max(0, Math.min(1, properties.roughness)),
      emissive: properties.emissive
        ? [
            Math.max(0, properties.emissive[0]),
            Math.max(0, properties.emissive[1]),
            Math.max(0, properties.emissive[2]),
          ]
        : undefined,
      emissiveIntensity: properties.emissiveIntensity !== undefined ? Math.max(0, properties.emissiveIntensity) : undefined,
      ao: properties.ao !== undefined ? Math.max(0, Math.min(1, properties.ao)) : undefined,
      normalScale: properties.normalScale,
      opacity: properties.opacity !== undefined ? Math.max(0, Math.min(1, properties.opacity)) : undefined,
      alphaMode: properties.alphaMode,
      alphaCutoff: properties.alphaCutoff !== undefined ? Math.max(0, Math.min(1, properties.alphaCutoff)) : undefined,
    };
  }

  /**
   * Create default material configuration
   */
  static createDefaultConfig(id: string, shaderId: string): MaterialConfig {
    return {
      id,
      shaderId,
      properties: {
        baseColor: [0.8, 0.8, 0.8, 1.0],
        metallic: 0.0,
        roughness: 0.5,
      },
    };
  }

  /**
   * Create emergency fallback material (in-memory only)
   */
  private createEmergencyFallback(): Material {
    return {
      id: '__emergency_fallback__',
      name: 'Emergency Fallback',
      shaderId: '__missing__',
      properties: {
        baseColor: [1, 0, 1, 1], // Magenta to indicate missing material
        metallic: 0.0,
        roughness: 1.0,
      },
      textures: {},
      renderState: {},
      doubleSided: false,
      castShadows: false,
      receiveShadows: false,
    };
  }

  /**
   * Clean up all materials
   */
  dispose(): void {
    // Remove event listeners
    const canvas = this.gl.canvas as HTMLCanvasElement;
    canvas.removeEventListener('webglcontextlost', this.handleContextLost.bind(this));
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored.bind(this));

    this.materials.clear();
    this.defaultMaterial = null;
    this.emergencyFallback = null;
    this.materialIdsCache = null;
  }
}
