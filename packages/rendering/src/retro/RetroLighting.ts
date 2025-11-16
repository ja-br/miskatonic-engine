/**
 * Retro Lighting System
 * Epic 3.4: Retro Rendering Pipeline - Lighting
 *
 * PlayStation 2 era lighting techniques:
 * - Vertex-painted ambient lighting (baked per-vertex colors)
 * - Simple lightmaps (baked ambient occlusion/GI, 128x128 max)
 * - Distance fog (linear/exponential falloff)
 * - Contrast fog (depth-based desaturation)
 * - Unlit emissive materials for neon signs/UI
 * - Specular highlights via simple cube map (not real-time SSR)
 */

import type {
  IRendererBackend,
  BackendBufferHandle,
  BackendTextureHandle,
} from '../backends/IRendererBackend';

/**
 * Fog mode (PS2-era options)
 */
export enum FogMode {
  /** No fog */
  None = 0,
  /** Linear falloff based on distance */
  Linear = 1,
  /** Exponential falloff (more atmospheric) */
  Exponential = 2,
  /** Exponential squared (denser fog) */
  ExponentialSquared = 3,
}

/**
 * Fog configuration
 */
export interface FogConfig {
  mode: FogMode;
  color: [number, number, number]; // RGB fog color
  start: number;  // Distance where fog begins (linear mode)
  end: number;    // Distance where fog fully obscures (linear mode)
  density: number; // Fog density (exponential modes)
}

/**
 * Contrast fog configuration
 * Depth-based desaturation for PS2-era atmospheric effect
 */
export interface ContrastFogConfig {
  enabled: boolean;
  start: number;    // Distance where desaturation begins
  end: number;      // Distance where fully desaturated
  intensity: number; // How much to desaturate (0.0 - 1.0)
}

/**
 * Lightmap configuration
 * Baked ambient occlusion/GI, 128x128 max (PS2 constraint)
 */
export interface LightmapConfig {
  texture: BackendTextureHandle;
  intensity: number; // Lightmap intensity multiplier (0.0 - 1.0)
}

/**
 * Environment map configuration
 * Simple cube map for specular highlights (not real-time SSR)
 */
export interface EnvironmentMapConfig {
  texture: BackendTextureHandle; // Cube map texture
  intensity: number; // Reflection intensity (0.0 - 1.0)
}

/**
 * Retro lighting parameters (GPU uniform buffer)
 */
export interface RetroLightingParams {
  // Fog
  fog: FogConfig;
  contrastFog: ContrastFogConfig;

  // Lightmap
  lightmapIntensity: number;

  // Environment map
  envMapIntensity: number;

  // Ambient color (global ambient light)
  ambientColor: [number, number, number];
}

/**
 * Default retro lighting configuration
 */
export const DEFAULT_RETRO_LIGHTING: RetroLightingParams = {
  fog: {
    mode: FogMode.Linear,
    color: [0.5, 0.6, 0.7], // Blueish atmospheric fog
    start: 50.0,
    end: 200.0,
    density: 0.05,
  },
  contrastFog: {
    enabled: true,
    start: 100.0,
    end: 300.0,
    intensity: 0.7,
  },
  lightmapIntensity: 1.0,
  envMapIntensity: 0.3,
  ambientColor: [0.2, 0.2, 0.25], // Dim blueish ambient
};

/**
 * Retro Lighting System
 *
 * Manages PS2-era lighting effects:
 * - Fog (linear, exponential, exponential squared)
 * - Contrast fog (depth-based desaturation)
 * - Lightmaps (baked AO/GI)
 * - Environment maps (simple cube maps for reflections)
 * - Vertex-painted ambient (per-vertex colors)
 *
 * @example
 * ```typescript
 * const lighting = new RetroLighting(backend);
 * lighting.initialize();
 *
 * // Set fog
 * lighting.setFog({
 *   mode: FogMode.Linear,
 *   color: [0.7, 0.7, 0.8],
 *   start: 50,
 *   end: 200,
 *   density: 0.05,
 * });
 *
 * // Bind uniform buffer for rendering
 * const lightingBuffer = lighting.getUniformBuffer();
 * ```
 */
export class RetroLighting {
  private params: RetroLightingParams;
  private uniformBuffer?: BackendBufferHandle;
  private initialized = false;

  constructor(
    private backend: IRendererBackend,
    params?: Partial<RetroLightingParams>
  ) {
    this.params = this.mergeParams(params);
  }

  /**
   * Initialize lighting system (creates uniform buffer)
   */
  initialize(): void {
    if (this.initialized) return;

    this.createUniformBuffer();
    this.initialized = true;
  }

  /**
   * Get uniform buffer handle for binding in shaders
   */
  getUniformBuffer(): BackendBufferHandle {
    if (!this.uniformBuffer) {
      throw new Error('RetroLighting not initialized. Call initialize() first.');
    }
    return this.uniformBuffer;
  }

  /**
   * Set fog configuration
   */
  setFog(fog: FogConfig): void {
    this.params.fog = { ...fog };
    this.updateUniformBuffer();
  }

  /**
   * Set contrast fog configuration
   */
  setContrastFog(contrastFog: ContrastFogConfig): void {
    this.params.contrastFog = { ...contrastFog };
    this.updateUniformBuffer();
  }

  /**
   * Set lightmap intensity
   */
  setLightmapIntensity(intensity: number): void {
    this.params.lightmapIntensity = intensity;
    this.updateUniformBuffer();
  }

  /**
   * Set environment map intensity
   */
  setEnvironmentMapIntensity(intensity: number): void {
    this.params.envMapIntensity = intensity;
    this.updateUniformBuffer();
  }

  /**
   * Set ambient color
   */
  setAmbientColor(color: [number, number, number]): void {
    this.params.ambientColor = color;
    this.updateUniformBuffer();
  }

  /**
   * Get current lighting parameters
   */
  getParams(): Readonly<RetroLightingParams> {
    return { ...this.params };
  }

  /**
   * Clean up GPU resources
   */
  dispose(): void {
    if (this.uniformBuffer) {
      this.backend.deleteBuffer(this.uniformBuffer);
      this.uniformBuffer = undefined;
    }
    this.initialized = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private mergeParams(partial?: Partial<RetroLightingParams>): RetroLightingParams {
    return {
      fog: { ...DEFAULT_RETRO_LIGHTING.fog, ...partial?.fog },
      contrastFog: { ...DEFAULT_RETRO_LIGHTING.contrastFog, ...partial?.contrastFog },
      lightmapIntensity: partial?.lightmapIntensity ?? DEFAULT_RETRO_LIGHTING.lightmapIntensity,
      envMapIntensity: partial?.envMapIntensity ?? DEFAULT_RETRO_LIGHTING.envMapIntensity,
      ambientColor: partial?.ambientColor ?? DEFAULT_RETRO_LIGHTING.ambientColor,
    };
  }

  private createUniformBuffer(): void {
    const data = this.packUniformData();
    this.uniformBuffer = this.backend.createBuffer(
      'retro_lighting_params',
      'uniform',
      data,
      'dynamic_draw'
    );
  }

  private updateUniformBuffer(): void {
    if (!this.uniformBuffer) return;

    const data = this.packUniformData();
    this.backend.updateBuffer(this.uniformBuffer, data);
  }

  /**
   * Pack lighting parameters into Float32Array for GPU upload
   * Follows WebGPU struct alignment rules (16-byte alignment for vec3/vec4)
   */
  private packUniformData(): Float32Array {
    // Total: 20 floats (80 bytes = 5 vec4s)
    const data = new Float32Array(20);
    let offset = 0;

    // Fog config (vec4)
    data[offset++] = this.params.fog.mode;
    data[offset++] = this.params.fog.start;
    data[offset++] = this.params.fog.end;
    data[offset++] = this.params.fog.density;

    // Fog color (vec3 + padding = vec4)
    data[offset++] = this.params.fog.color[0];
    data[offset++] = this.params.fog.color[1];
    data[offset++] = this.params.fog.color[2];
    data[offset++] = 0; // Padding

    // Contrast fog (vec4)
    data[offset++] = this.params.contrastFog.enabled ? 1.0 : 0.0;
    data[offset++] = this.params.contrastFog.start;
    data[offset++] = this.params.contrastFog.end;
    data[offset++] = this.params.contrastFog.intensity;

    // Lightmap intensity + env map intensity + padding (vec4)
    data[offset++] = this.params.lightmapIntensity;
    data[offset++] = this.params.envMapIntensity;
    data[offset++] = 0; // Padding
    data[offset++] = 0; // Padding

    // Ambient color (vec3 + padding = vec4)
    data[offset++] = this.params.ambientColor[0];
    data[offset++] = this.params.ambientColor[1];
    data[offset++] = this.params.ambientColor[2];
    data[offset++] = 0; // Padding

    return data;
  }
}

/**
 * Utility: Create a simple gradient lightmap texture
 * Useful for quick testing without loading external assets
 */
export function createGradientLightmap(
  backend: IRendererBackend,
  size: number = 128
): BackendTextureHandle {
  const data = new Uint8Array(size * size);

  // Create radial gradient from center
  const center = size / 2;
  const maxDist = Math.sqrt(center * center + center * center);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const intensity = 1.0 - Math.min(dist / maxDist, 1.0);

      data[y * size + x] = Math.floor(intensity * 255);
    }
  }

  return backend.createTexture(
    'gradient_lightmap',
    size,
    size,
    data,
    {
      format: 'r8unorm',
      minFilter: 'linear',
      magFilter: 'linear',
      wrapS: 'clamp_to_edge',
      wrapT: 'clamp_to_edge',
    }
  );
}
