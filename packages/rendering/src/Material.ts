/**
 * PBR Material System
 *
 * Implements physically-based rendering materials using the Cook-Torrance BRDF model.
 * Materials define surface properties for realistic lighting.
 */

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

  // Optional PBR extensions
  specularMap?: string; // For specular workflow
  glossinessMap?: string; // For specular/glossiness workflow
}

/**
 * Material configuration
 */
export interface MaterialConfig {
  id: string;
  name?: string;
  properties: PBRMaterialProperties;
  textures?: MaterialTextures;

  // Render state overrides
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
  properties: PBRMaterialProperties;
  textures: MaterialTextures;
  doubleSided: boolean;
  castShadows: boolean;
  receiveShadows: boolean;
}

/**
 * Material manager for creating and managing materials
 */
export class MaterialManager {
  private materials = new Map<string, Material>();
  private static readonly MAX_MATERIALS = 1000;

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

    // Validate properties
    this.validateMaterialProperties(config.properties);

    // Create material
    const material: Material = {
      id: config.id,
      name: config.name ?? config.id,
      properties: {
        ...config.properties,
        emissiveIntensity: config.properties.emissiveIntensity ?? 1.0,
        ao: config.properties.ao ?? 1.0,
        normalScale: config.properties.normalScale ?? 1.0,
        opacity: config.properties.opacity ?? 1.0,
        alphaMode: config.properties.alphaMode ?? 'opaque',
        alphaCutoff: config.properties.alphaCutoff ?? 0.5,
      },
      textures: config.textures ?? {},
      doubleSided: config.doubleSided ?? false,
      castShadows: config.castShadows ?? true,
      receiveShadows: config.receiveShadows ?? true,
    };

    this.materials.set(config.id, material);
    return material;
  }

  /**
   * Get material by ID
   */
  getMaterial(id: string): Material | null {
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
  }

  /**
   * Get all material IDs
   */
  getMaterialIds(): string[] {
    return Array.from(this.materials.keys());
  }

  /**
   * Update material properties
   */
  updateMaterialProperties(id: string, properties: Partial<PBRMaterialProperties>): void {
    const material = this.materials.get(id);
    if (!material) {
      throw new Error(`Material not found: ${id}`);
    }

    // Validate updated properties
    const updatedProperties = { ...material.properties, ...properties };
    this.validateMaterialProperties(updatedProperties);

    // Update properties
    material.properties = updatedProperties;
  }

  /**
   * Update material textures
   */
  updateMaterialTextures(id: string, textures: Partial<MaterialTextures>): void {
    const material = this.materials.get(id);
    if (!material) {
      throw new Error(`Material not found: ${id}`);
    }

    material.textures = { ...material.textures, ...textures };
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
   * Create default material
   */
  static createDefault(id: string): MaterialConfig {
    return {
      id,
      properties: {
        baseColor: [1, 1, 1, 1],
        metallic: 0.0,
        roughness: 0.5,
      },
    };
  }

  /**
   * Clean up all materials
   */
  dispose(): void {
    this.materials.clear();
  }
}
