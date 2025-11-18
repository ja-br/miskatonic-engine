/**
 * Retro Lighting System - PS1/PS2 style vertex lighting
 * All lighting calculations done per-vertex, NOT per-pixel
 */

import type { IRendererBackend, BackendBufferHandle } from '../backends';

export interface RetroLightingConfig {
  /** Maximum number of lights to process */
  maxLights: number;
  /** Enable vertex-painted ambient colors */
  enableVertexColors: boolean;
  /** Enable lightmap support */
  enableLightmaps: boolean;
  /** Enable fog */
  enableFog: boolean;
}

export interface FogConfig {
  type: 'linear' | 'exponential';
  color: [number, number, number];
  start: number;
  end: number;
  density: number;
}

export interface RetroLight {
  type: 'directional' | 'point';
  position: [number, number, number];
  color: [number, number, number];
  intensity: number;
  direction?: [number, number, number];  // For directional
  range?: number;                         // For point lights
}

/**
 * Manages retro-style vertex lighting
 * Coordinates between ECS light components and shader uniforms
 */
export class RetroLightingSystem {
  private backend: IRendererBackend;
  private config: RetroLightingConfig;
  private lights: RetroLight[] = [];
  private lightBuffer: BackendBufferHandle | null = null;
  private fogConfig: FogConfig | null = null;

  constructor(backend: IRendererBackend, config: Partial<RetroLightingConfig> = {}) {
    this.backend = backend;
    this.config = {
      maxLights: config.maxLights ?? 8,
      enableVertexColors: config.enableVertexColors ?? true,
      enableLightmaps: config.enableLightmaps ?? true,
      enableFog: config.enableFog ?? true,
    };
  }

  /**
   * Set active lights for rendering
   * Lights are uploaded to GPU storage buffer for vertex shader access
   */
  setLights(lights: RetroLight[]): void {
    // Clamp to max lights
    this.lights = lights.slice(0, this.config.maxLights);

    // Create/update GPU buffer
    this.updateLightBuffer();
  }

  /**
   * Configure fog parameters
   */
  setFog(config: FogConfig): void {
    this.fogConfig = config;
  }

  /**
   * Disable fog
   */
  clearFog(): void {
    this.fogConfig = null;
  }

  /**
   * Get fog configuration for shader
   */
  getFogConfig(): FogConfig | null {
    return this.fogConfig;
  }

  /**
   * Get light buffer handle for binding to shaders
   */
  getLightBuffer(): BackendBufferHandle | null {
    return this.lightBuffer;
  }

  /**
   * Get number of active lights
   */
  getLightCount(): number {
    return this.lights.length;
  }

  /**
   * Update GPU light buffer
   */
  private updateLightBuffer(): void {
    if (this.lights.length === 0) {
      return;
    }

    // Pack lights into GPU format with WGSL alignment rules
    // Note: vec3<f32> has alignment 16 in WGSL, but the packing here works because:
    // - After position (12 bytes), type_ (4 bytes) fills to 16-byte boundary
    // - After color (12 bytes), intensity (4 bytes) fills to 16-byte boundary
    // - After direction (12 bytes), range (4 bytes) fills to 16-byte boundary
    //
    // struct Light {
    //   position: vec3<f32>,    // offset 0 (align 16, size 12) -> bytes 0-11
    //   type_: u32,             // offset 12 (align 4, size 4)  -> bytes 12-15
    //   color: vec3<f32>,       // offset 16 (align 16, size 12) -> bytes 16-27
    //   intensity: f32,         // offset 28 (align 4, size 4)  -> bytes 28-31
    //   direction: vec3<f32>,   // offset 32 (align 16, size 12) -> bytes 32-43
    //   range: f32,             // offset 44 (align 4, size 4)  -> bytes 44-47
    // }
    // Total: 48 bytes per light (12 floats)
    const LIGHT_STRUCT_SIZE_BYTES = 48;
    const stride = LIGHT_STRUCT_SIZE_BYTES / 4; // 12 floats
    const buffer = new Float32Array(this.lights.length * stride);

    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      const offset = i * stride;

      // Position (vec3<f32>) at offset 0
      buffer[offset + 0] = light.position[0];
      buffer[offset + 1] = light.position[1];
      buffer[offset + 2] = light.position[2];

      // Type (u32) at offset 12 (immediately after position)
      // Note: We store as float but the shader interprets as u32
      // This works because 0.0f bit pattern = 0u and we only check == 0u
      buffer[offset + 3] = light.type === 'directional' ? 0.0 : 1.0;

      // Color (vec3<f32>) at offset 16 (immediately after type)
      buffer[offset + 4] = light.color[0];
      buffer[offset + 5] = light.color[1];
      buffer[offset + 6] = light.color[2];

      // Intensity (f32) at offset 28 (immediately after color)
      buffer[offset + 7] = light.intensity;

      // Direction (vec3<f32>) at offset 32 (immediately after intensity)
      const dir = light.direction ?? [0, -1, 0];
      buffer[offset + 8] = dir[0];
      buffer[offset + 9] = dir[1];
      buffer[offset + 10] = dir[2];

      // Range (f32) at offset 44 (immediately after direction)
      buffer[offset + 11] = light.range ?? 10.0;
    }

    // DEBUG: Verify buffer contents for first light
    if (this.lights.length > 0) {
      console.log('🔦 Light Buffer Packing (first light):');
      console.log('  Position (0-11):', buffer.slice(0, 3));
      console.log('  Type (12-15):', buffer[3]);
      console.log('  Color (16-27):', buffer.slice(4, 7));
      console.log('  Intensity (28-31):', buffer[7]);
      console.log('  Direction (32-43):', buffer.slice(8, 11));
      console.log('  Range (44-47):', buffer[11]);
      console.log('  Expected color: [1.0, 0.95, 0.9]');
    }

    // Create or update buffer
    if (this.lightBuffer) {
      // Update existing buffer in-place to preserve bind group references
      this.backend.updateBuffer(this.lightBuffer, buffer);
    } else {
      this.lightBuffer = this.backend.createBuffer(
        'retro_lights',
        'storage',
        buffer,
        'dynamic_draw'
      );
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.lightBuffer) {
      this.backend.deleteBuffer(this.lightBuffer);
      this.lightBuffer = null;
    }
  }
}
