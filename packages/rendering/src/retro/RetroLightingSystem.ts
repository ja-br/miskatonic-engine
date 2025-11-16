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

    // Pack lights into GPU format
    // struct Light { position: vec3<f32>, type: u32, color: vec3<f32>, intensity: f32, direction: vec3<f32>, range: f32 }
    // 16 floats per light = 64 bytes
    const stride = 16;
    const buffer = new Float32Array(this.lights.length * stride);

    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      const offset = i * stride;

      // Position (vec3)
      buffer[offset + 0] = light.position[0];
      buffer[offset + 1] = light.position[1];
      buffer[offset + 2] = light.position[2];

      // Type (u32 as float)
      buffer[offset + 3] = light.type === 'directional' ? 0.0 : 1.0;

      // Color (vec3)
      buffer[offset + 4] = light.color[0];
      buffer[offset + 5] = light.color[1];
      buffer[offset + 6] = light.color[2];

      // Intensity
      buffer[offset + 7] = light.intensity;

      // Direction (vec3)
      const dir = light.direction ?? [0, -1, 0];
      buffer[offset + 8] = dir[0];
      buffer[offset + 9] = dir[1];
      buffer[offset + 10] = dir[2];

      // Range
      buffer[offset + 11] = light.range ?? 10.0;

      // Padding
      buffer[offset + 12] = 0.0;
      buffer[offset + 13] = 0.0;
      buffer[offset + 14] = 0.0;
      buffer[offset + 15] = 0.0;
    }

    // Create or update buffer
    if (this.lightBuffer) {
      // Update existing buffer
      // TODO: Add update method to backend
      this.backend.deleteBuffer(this.lightBuffer);
    }

    this.lightBuffer = this.backend.createBuffer(
      'retro_lights',
      'storage',
      buffer,
      'dynamic_draw'
    );
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
