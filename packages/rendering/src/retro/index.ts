/**
 * @miskatonic/rendering/retro
 * Epic 3.4: Retro Rendering Pipeline
 *
 * PlayStation 2 era rendering techniques for lo-fi/demake aesthetics
 */

// Post-processing
export {
  RetroPostProcessor,
  type RetroPostProcessConfig,
  DEFAULT_RETRO_POST_CONFIG,
} from './RetroPostProcessor';

// Post-processing Integration (Epic 3.4 Phase 2)
export {
  addRetroPostProcessPass,
  applyRetroPostProcess,
  resizeRetroPostProcessor,
  type RetroPostProcessPassConfig,
} from './RetroPostProcessIntegration';

// Lighting
export {
  RetroLighting,
  FogMode,
  type FogConfig,
  type ContrastFogConfig,
  type LightmapConfig,
  type EnvironmentMapConfig,
  type RetroLightingParams,
  DEFAULT_RETRO_LIGHTING,
  createGradientLightmap,
} from './RetroLighting';

// LOD System
export {
  RetroLODSystem,
  type LODLevel,
  type LODGroupConfig,
  type LODSelection,
  DEFAULT_LOD_DISTANCES,
  calculateLODBias,
} from './RetroLOD';

// Materials
export {
  RetroMaterial,
  RetroMaterialType,
  TextureFilter,
  RETRO_TEXTURE_CONSTRAINTS,
  type RetroMaterialConfig,
  DEFAULT_RETRO_MATERIAL,
  applyTextureDithering,
  downscaleToRetroResolution,
} from './RetroMaterial';
