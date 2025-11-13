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

/**
 * Preset: Alpha cutout (foliage, fences)
 * Uses alpha-to-coverage for smooth edges without sorting
 * NOTE: cullMode is 'back' for performance. Use 'none' only for double-sided
 * materials (leaves, paper) that need to be visible from both sides.
 */
export const ALPHA_CUTOUT_PIPELINE_STATE: PipelineStateDescriptor = {
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
    cullMode: 'back', // Cull back faces for performance
    frontFace: 'ccw',
  },
  multisample: {
    count: 4,
    alphaToCoverageEnabled: true, // Smooth cutout edges
  },
};

/**
 * Preset: Wireframe rendering (debug visualization)
 */
export const WIREFRAME_PIPELINE_STATE: PipelineStateDescriptor = {
  topology: 'line-list',
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
    cullMode: 'none', // Show all edges
    frontFace: 'ccw',
  },
};

/**
 * Validation error for pipeline state configuration
 */
export interface PipelineStateValidationError {
  severity: 'error' | 'warning';
  message: string;
}

/**
 * Pipeline State Validator
 * Catches common configuration mistakes
 */
export class PipelineStateValidator {
  /**
   * Validate a pipeline state descriptor
   * @param state Pipeline state to validate
   * @returns Array of validation errors/warnings (empty if valid)
   */
  static validate(state: PipelineStateDescriptor): PipelineStateValidationError[] {
    const errors: PipelineStateValidationError[] = [];

    // Check transparent objects with depth writes
    if (state.blend?.enabled && state.depthStencil?.depthWriteEnabled) {
      errors.push({
        severity: 'warning',
        message: 'Transparent objects (blend enabled) should typically disable depth writes to avoid sorting artifacts',
      });
    }

    // Check wireframe with blending
    if ((state.topology === 'line-list' || state.topology === 'line-strip') && state.blend?.enabled) {
      errors.push({
        severity: 'warning',
        message: 'Wireframe rendering (line topology) should not use blending',
      });
    }

    // Check additive blending with depth writes
    if (state.blend?.enabled &&
        state.blend.srcFactor === 'one' &&
        state.blend.dstFactor === 'one' &&
        state.depthStencil?.depthWriteEnabled) {
      errors.push({
        severity: 'error',
        message: 'Additive blending (one+one) MUST disable depth writes to prevent order-dependent artifacts',
      });
    }

    // Check alpha-to-coverage without multisampling
    if (state.multisample?.alphaToCoverageEnabled && (!state.multisample?.count || state.multisample.count < 2)) {
      errors.push({
        severity: 'error',
        message: 'Alpha-to-coverage requires multisample count >= 2',
      });
    }

    // Check line topology with culling
    if ((state.topology === 'line-list' || state.topology === 'line-strip') &&
        state.rasterization?.cullMode &&
        state.rasterization.cullMode !== 'none') {
      errors.push({
        severity: 'warning',
        message: 'Line topology with face culling may produce unexpected results',
      });
    }

    return errors;
  }

  /**
   * Validate and throw if errors exist
   * @param state Pipeline state to validate
   * @throws Error if validation fails
   */
  static validateOrThrow(state: PipelineStateDescriptor): void {
    const errors = this.validate(state).filter(e => e.severity === 'error');
    if (errors.length > 0) {
      throw new Error(`Pipeline state validation failed:\n${errors.map(e => `- ${e.message}`).join('\n')}`);
    }
  }
}
