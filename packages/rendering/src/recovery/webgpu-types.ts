/**
 * WebGPU-specific types for resource descriptors
 * These types ensure type safety when recreating GPU resources
 */

/**
 * WebGPU vertex buffer layout
 */
export interface GPUVertexBufferLayout {
  arrayStride: number;
  stepMode: 'vertex' | 'instance';
  attributes: Array<{
    format: string;
    offset: number;
    shaderLocation: number;
  }>;
}

/**
 * WebGPU bind group layout entry
 */
export interface GPUBindGroupLayoutEntry {
  binding: number;
  visibility: number;
  buffer?: {
    type: 'uniform' | 'storage' | 'read-only-storage';
  };
  sampler?: {
    type: 'filtering' | 'non-filtering' | 'comparison';
  };
  texture?: {
    sampleType?: 'float' | 'unfilterable-float' | 'depth' | 'sint' | 'uint';
    viewDimension?: '1d' | '2d' | '2d-array' | 'cube' | 'cube-array' | '3d';
    multisampled?: boolean;
  };
  storageTexture?: {
    access: 'write-only';
    format: string;
    viewDimension?: '1d' | '2d' | '2d-array' | 'cube' | 'cube-array' | '3d';
  };
}

/**
 * WebGPU bind group entry
 */
export interface GPUBindGroupEntry {
  binding: number;
  resource:
    | { buffer: string; offset?: number; size?: number } // buffer ID
    | { sampler: string } // sampler ID
    | { texture: string }; // texture ID
}
