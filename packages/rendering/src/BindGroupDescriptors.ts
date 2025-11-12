/**
 * Bind Group Descriptors for Epic 3.14
 */

import type { BackendBufferHandle } from './backends/IRendererBackend';

export type BindingType = 'uniform' | 'storage' | 'sampler' | 'texture';
export type ShaderStage = 'vertex' | 'fragment' | 'compute';

export interface BindGroupLayoutEntry {
  binding: number;
  visibility: ShaderStage[];
  type: BindingType;
  minBindingSize?: number; // For uniform/storage buffers (256-byte alignment)
}

export interface BindGroupLayoutDescriptor {
  entries: BindGroupLayoutEntry[];
}

export interface BindGroupResourceBinding {
  binding: number;
  resource: BackendBufferHandle | { texture: any; sampler?: any };
}

export interface BindGroupDescriptor {
  layout: BindGroupLayoutDescriptor;
  entries: BindGroupResourceBinding[];
}

/**
 * Validate bind group layout for 256-byte alignment (WebGPU requirement)
 */
export function validateBindGroupLayout(layout: BindGroupLayoutDescriptor): void {
  for (const entry of layout.entries) {
    if ((entry.type === 'uniform' || entry.type === 'storage') && entry.minBindingSize) {
      if (entry.minBindingSize % 256 !== 0) {
        throw new Error(`Binding ${entry.binding}: size ${entry.minBindingSize} must be 256-byte aligned`);
      }
    }
  }
}

/**
 * Helper: Create common scene bind group layout (group 0)
 */
export function createSceneBindGroupLayout(): BindGroupLayoutDescriptor {
  return {
    entries: [
      { binding: 0, visibility: ['vertex', 'fragment'], type: 'uniform', minBindingSize: 256 },
    ],
  };
}

/**
 * Helper: Create common object bind group layout (group 1)
 */
export function createObjectBindGroupLayout(): BindGroupLayoutDescriptor {
  return {
    entries: [
      { binding: 0, visibility: ['vertex'], type: 'uniform', minBindingSize: 256 },
    ],
  };
}
