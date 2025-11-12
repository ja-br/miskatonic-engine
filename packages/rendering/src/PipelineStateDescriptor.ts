/**
 * Pipeline State Descriptor for Epic 3.14
 */

export type BlendFactor = 'zero' | 'one' | 'src' | 'one-minus-src' | 'src-alpha' | 'one-minus-src-alpha' | 'dst' | 'one-minus-dst' | 'dst-alpha' | 'one-minus-dst-alpha';
export type BlendOperation = 'add' | 'subtract' | 'reverse-subtract' | 'min' | 'max';
export type CompareFunction = 'never' | 'less' | 'equal' | 'less-equal' | 'greater' | 'not-equal' | 'greater-equal' | 'always';
export type CullMode = 'none' | 'front' | 'back';
export type FrontFace = 'ccw' | 'cw';
export type PrimitiveTopology = 'point-list' | 'line-list' | 'line-strip' | 'triangle-list' | 'triangle-strip';

export interface BlendState {
  enabled: boolean;
  srcFactor: BlendFactor;
  dstFactor: BlendFactor;
  operation: BlendOperation;
  srcAlphaFactor?: BlendFactor;
  dstAlphaFactor?: BlendFactor;
  alphaOperation?: BlendOperation;
}

export interface DepthStencilState {
  depthWriteEnabled: boolean;
  depthCompare: CompareFunction;
  stencilFront?: {
    compare: CompareFunction;
    failOp: 'keep' | 'zero' | 'replace' | 'invert' | 'increment-clamp' | 'decrement-clamp';
    depthFailOp: 'keep' | 'zero' | 'replace' | 'invert' | 'increment-clamp' | 'decrement-clamp';
    passOp: 'keep' | 'zero' | 'replace' | 'invert' | 'increment-clamp' | 'decrement-clamp';
  };
  stencilBack?: {
    compare: CompareFunction;
    failOp: 'keep' | 'zero' | 'replace' | 'invert' | 'increment-clamp' | 'decrement-clamp';
    depthFailOp: 'keep' | 'zero' | 'replace' | 'invert' | 'increment-clamp' | 'decrement-clamp';
    passOp: 'keep' | 'zero' | 'replace' | 'invert' | 'increment-clamp' | 'decrement-clamp';
  };
}

export interface RasterizationState {
  cullMode: CullMode;
  frontFace: FrontFace;
  depthBias?: number;
  depthBiasSlopeScale?: number;
  depthBiasClamp?: number;
}

export interface PipelineStateDescriptor {
  topology: PrimitiveTopology;
  blend?: BlendState;
  depthStencil?: DepthStencilState;
  rasterization?: RasterizationState;
  multisample?: {
    count: number;
    alphaToCoverageEnabled?: boolean;
  };
}

/**
 * Preset: Opaque rendering (default)
 */
export const OPAQUE_PIPELINE_STATE: PipelineStateDescriptor = {
  topology: 'triangle-list',
  blend: {
    enabled: false,
    srcFactor: 'one',
    dstFactor: 'zero',
    operation: 'add',
  },
  depthStencil: {
    depthWriteEnabled: true,
    depthCompare: 'less',
  },
  rasterization: {
    cullMode: 'back',
    frontFace: 'ccw',
  },
};

/**
 * Preset: Alpha blending (transparent objects)
 */
export const ALPHA_BLEND_PIPELINE_STATE: PipelineStateDescriptor = {
  topology: 'triangle-list',
  blend: {
    enabled: true,
    srcFactor: 'src-alpha',
    dstFactor: 'one-minus-src-alpha',
    operation: 'add',
  },
  depthStencil: {
    depthWriteEnabled: false, // Don't write depth for transparent objects
    depthCompare: 'less',
  },
  rasterization: {
    cullMode: 'none', // Render both sides for transparency
    frontFace: 'ccw',
  },
};

/**
 * Preset: Additive blending (effects, lights)
 */
export const ADDITIVE_BLEND_PIPELINE_STATE: PipelineStateDescriptor = {
  topology: 'triangle-list',
  blend: {
    enabled: true,
    srcFactor: 'one',
    dstFactor: 'one',
    operation: 'add',
  },
  depthStencil: {
    depthWriteEnabled: false,
    depthCompare: 'less',
  },
  rasterization: {
    cullMode: 'back',
    frontFace: 'ccw',
  },
};
