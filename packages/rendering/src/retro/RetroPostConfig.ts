/**
 * Retro Post-Processing Configuration Types
 * Extracted from RetroPostProcessor for modularity
 */

import type { BackendTextureHandle } from '../backends';

/** CRT phosphor mask type */
export type MaskType = 'aperture-grille' | 'slot-mask' | 'shadow-mask';

/** CRT-Yah effect configuration */
export interface CRTYahConfig {
  /** Enable CRT effect */
  enabled: boolean;

  /** Master intensity (0=off, 1=normal, 2=intense) */
  masterIntensity: number;

  /** Brightness adjustment */
  brightness: number;
  /** Contrast adjustment */
  contrast: number;
  /** Saturation adjustment */
  saturation: number;

  /** Scanline strength (0-1) */
  scanlinesStrength: number;
  /** Minimum beam width */
  beamWidthMin: number;
  /** Maximum beam width */
  beamWidthMax: number;
  /** Beam shape: 0=sharp, 1=smooth */
  beamShape: number;

  /** Phosphor mask intensity (0-1) */
  maskIntensity: number;
  /** Phosphor mask type */
  maskType: MaskType;

  /** Screen curvature amount (0-1) */
  curvatureAmount: number;
  /** Vignette amount (0-1) */
  vignetteAmount: number;
  /** Corner radius (0-0.25) */
  cornerRadius: number;

  /** Color overflow / phosphor bloom intensity (0-1) */
  colorOverflow: number;
}

export interface RetroPostConfig {
  /** Bloom threshold (brightness cutoff) */
  bloomThreshold: number;
  /** Bloom intensity (additive blend amount) */
  bloomIntensity: number;
  /** Number of mip levels for bloom pyramid (default: 5) */
  bloomMipLevels: number;
  /** Film grain amount */
  grainAmount: number;
  /** Gamma for tonemapping (gamma correction only) */
  gamma: number;
  /** Dither pattern: 0 = 4x4 Bayer, 1 = 8x8 Bayer */
  ditherPattern: 0 | 1;
  /** Optional color LUT texture (256x16) */
  colorLUT?: BackendTextureHandle;
  /** Internal render resolution (if undefined, uses display resolution) */
  internalResolution?: { width: number; height: number };
  /** Optional CRT-Yah effect configuration */
  crt?: CRTYahConfig;
}

/** Default retro post-processing configuration */
export const DEFAULT_RETRO_POST_CONFIG: RetroPostConfig = {
  bloomThreshold: 0.8,
  bloomIntensity: 0.3,
  bloomMipLevels: 5,
  grainAmount: 0.02,
  gamma: 2.2,
  ditherPattern: 0,
};

/** Default CRT effect configuration */
export const DEFAULT_CRT_CONFIG: CRTYahConfig = {
  enabled: false,
  masterIntensity: 1.0,
  brightness: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  scanlinesStrength: 0.3,
  beamWidthMin: 0.3,
  beamWidthMax: 1.0,
  beamShape: 0.5,
  maskIntensity: 0.3,
  maskType: 'aperture-grille',
  curvatureAmount: 0.03,
  vignetteAmount: 0.3,
  cornerRadius: 0.03,
  colorOverflow: 0.05,
};

/**
 * Pack CRT parameters into Float32Array for GPU upload
 * This helper centralizes the buffer layout to avoid duplication
 *
 * struct CRTParams {
 *   resolution: vec2<f32>,     // 8 bytes
 *   sourceSize: vec2<f32>,     // 8 bytes
 *   masterIntensity: f32,      // 4 bytes
 *   ... (13 more f32 params)   // 52 bytes
 *   _padding: vec3<f32>,       // 12 bytes (WebGPU alignment)
 * }
 */
export function packCRTParams(
  config: CRTYahConfig,
  displayWidth: number,
  displayHeight: number,
  sourceWidth: number,
  sourceHeight: number
): Float32Array {
  const data = new Float32Array(24); // 96 bytes (WebGPU alignment)

  data[0] = displayWidth;   // params.resolution - output swapchain size (for phosphor mask)
  data[1] = displayHeight;
  data[2] = sourceWidth;    // params.sourceSize - composite texture size (for scanlines)
  data[3] = sourceHeight;
  data[4] = config.masterIntensity;
  data[5] = config.brightness;
  data[6] = config.contrast;
  data[7] = config.saturation;
  data[8] = config.scanlinesStrength;
  data[9] = config.beamWidthMin;
  data[10] = config.beamWidthMax;
  data[11] = config.beamShape;
  data[12] = config.maskIntensity;
  // Map mask type string to float (1=aperture-grille, 2=slot-mask, 3=shadow-mask)
  data[13] = config.maskType === 'aperture-grille' ? 1.0 :
             config.maskType === 'slot-mask' ? 2.0 : 3.0;
  data[14] = config.curvatureAmount;
  data[15] = config.vignetteAmount;
  data[16] = config.cornerRadius;
  data[17] = config.colorOverflow;
  // data[18-23] remain 0 (padding vec3)

  return data;
}
