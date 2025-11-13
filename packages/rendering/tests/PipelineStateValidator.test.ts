/**
 * Pipeline State Validator Tests
 * Epic 3.14 Phase 3 - Task 1
 *
 * Tests validation logic for pipeline state presets
 */

import { describe, it, expect } from 'vitest';
import {
  PipelineStateValidator,
  OPAQUE_PIPELINE_STATE,
  ALPHA_BLEND_PIPELINE_STATE,
  ADDITIVE_BLEND_PIPELINE_STATE,
  ALPHA_CUTOUT_PIPELINE_STATE,
  WIREFRAME_PIPELINE_STATE,
  type PipelineStateDescriptor,
} from '../src/PipelineStateDescriptor';

describe('PipelineStateValidator', () => {
  describe('Valid Presets', () => {
    it('should validate OPAQUE_PIPELINE_STATE', () => {
      const errors = PipelineStateValidator.validate(OPAQUE_PIPELINE_STATE);
      expect(errors).toHaveLength(0);
    });

    it('should validate ALPHA_BLEND_PIPELINE_STATE', () => {
      const errors = PipelineStateValidator.validate(ALPHA_BLEND_PIPELINE_STATE);
      expect(errors).toHaveLength(0);
    });

    it('should validate ADDITIVE_BLEND_PIPELINE_STATE', () => {
      const errors = PipelineStateValidator.validate(ADDITIVE_BLEND_PIPELINE_STATE);
      expect(errors).toHaveLength(0);
    });

    it('should validate ALPHA_CUTOUT_PIPELINE_STATE', () => {
      const errors = PipelineStateValidator.validate(ALPHA_CUTOUT_PIPELINE_STATE);
      expect(errors).toHaveLength(0);
    });

    it('should validate WIREFRAME_PIPELINE_STATE', () => {
      const errors = PipelineStateValidator.validate(WIREFRAME_PIPELINE_STATE);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Transparent Objects with Depth Writes', () => {
    it('should warn about transparent objects with depth writes', () => {
      const state: PipelineStateDescriptor = {
        topology: 'triangle-list',
        blend: {
          enabled: true,
          srcFactor: 'src-alpha',
          dstFactor: 'one-minus-src-alpha',
          operation: 'add',
        },
        depthStencil: {
          depthWriteEnabled: true, // BAD: transparent with depth writes
          depthCompare: 'less',
        },
      };

      const errors = PipelineStateValidator.validate(state);
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('warning');
      expect(errors[0].message).toContain('Transparent');
      expect(errors[0].message).toContain('depth writes');
    });

    it('should not warn when transparent objects disable depth writes', () => {
      const state: PipelineStateDescriptor = {
        topology: 'triangle-list',
        blend: {
          enabled: true,
          srcFactor: 'src-alpha',
          dstFactor: 'one-minus-src-alpha',
          operation: 'add',
        },
        depthStencil: {
          depthWriteEnabled: false, // GOOD
          depthCompare: 'less',
        },
      };

      const errors = PipelineStateValidator.validate(state);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Wireframe with Blending', () => {
    it('should warn about line-list with blending', () => {
      const state: PipelineStateDescriptor = {
        topology: 'line-list',
        blend: {
          enabled: true, // BAD: wireframe with blending
          srcFactor: 'one',
          dstFactor: 'one',
          operation: 'add',
        },
      };

      const errors = PipelineStateValidator.validate(state);
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('warning');
      expect(errors[0].message).toContain('Wireframe');
      expect(errors[0].message).toContain('blending');
    });

    it('should warn about line-strip with blending', () => {
      const state: PipelineStateDescriptor = {
        topology: 'line-strip',
        blend: {
          enabled: true, // BAD
          srcFactor: 'one',
          dstFactor: 'zero',
          operation: 'add',
        },
      };

      const errors = PipelineStateValidator.validate(state);
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('warning');
    });

    it('should not warn when line topology disables blending', () => {
      const state: PipelineStateDescriptor = {
        topology: 'line-list',
        blend: {
          enabled: false, // GOOD
          srcFactor: 'one',
          dstFactor: 'zero',
          operation: 'add',
        },
      };

      const errors = PipelineStateValidator.validate(state);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Additive Blending with Depth Writes', () => {
    it('should error on additive blending with depth writes', () => {
      const state: PipelineStateDescriptor = {
        topology: 'triangle-list',
        blend: {
          enabled: true,
          srcFactor: 'one',
          dstFactor: 'one',
          operation: 'add',
        },
        depthStencil: {
          depthWriteEnabled: true, // BAD: additive MUST disable depth writes
          depthCompare: 'less',
        },
      };

      const errors = PipelineStateValidator.validate(state);
      expect(errors.length).toBeGreaterThan(0);
      const additiveError = errors.find(e => e.message.includes('Additive'));
      expect(additiveError).toBeDefined();
      expect(additiveError?.severity).toBe('error');
    });

    it('should not error when additive blending disables depth writes', () => {
      const state: PipelineStateDescriptor = {
        topology: 'triangle-list',
        blend: {
          enabled: true,
          srcFactor: 'one',
          dstFactor: 'one',
          operation: 'add',
        },
        depthStencil: {
          depthWriteEnabled: false, // GOOD
          depthCompare: 'less',
        },
      };

      const errors = PipelineStateValidator.validate(state);
      const additiveErrors = errors.filter(e => e.message.includes('Additive'));
      expect(additiveErrors).toHaveLength(0);
    });
  });

  describe('Alpha-to-Coverage without Multisampling', () => {
    it('should error when alpha-to-coverage is enabled without multisampling', () => {
      const state: PipelineStateDescriptor = {
        topology: 'triangle-list',
        multisample: {
          count: 1, // BAD: alpha-to-coverage requires count >= 2
          alphaToCoverageEnabled: true,
        },
      };

      const errors = PipelineStateValidator.validate(state);
      expect(errors.length).toBeGreaterThan(0);
      const alphaToCoverageError = errors.find(e => e.message.includes('Alpha-to-coverage'));
      expect(alphaToCoverageError).toBeDefined();
      expect(alphaToCoverageError?.severity).toBe('error');
    });

    it('should error when alpha-to-coverage is enabled with missing count', () => {
      const state: PipelineStateDescriptor = {
        topology: 'triangle-list',
        multisample: {
          alphaToCoverageEnabled: true,
          // count missing
        },
      };

      const errors = PipelineStateValidator.validate(state);
      expect(errors.length).toBeGreaterThan(0);
      const alphaToCoverageError = errors.find(e => e.message.includes('Alpha-to-coverage'));
      expect(alphaToCoverageError).toBeDefined();
      expect(alphaToCoverageError?.severity).toBe('error');
    });

    it('should not error when alpha-to-coverage has valid multisample count', () => {
      const state: PipelineStateDescriptor = {
        topology: 'triangle-list',
        multisample: {
          count: 4, // GOOD
          alphaToCoverageEnabled: true,
        },
      };

      const errors = PipelineStateValidator.validate(state);
      const alphaToCoverageErrors = errors.filter(e => e.message.includes('Alpha-to-coverage'));
      expect(alphaToCoverageErrors).toHaveLength(0);
    });
  });

  describe('Line Topology with Face Culling', () => {
    it('should warn about line-list with face culling', () => {
      const state: PipelineStateDescriptor = {
        topology: 'line-list',
        rasterization: {
          cullMode: 'back', // BAD: lines with culling
          frontFace: 'ccw',
        },
      };

      const errors = PipelineStateValidator.validate(state);
      expect(errors.length).toBeGreaterThan(0);
      const cullingWarning = errors.find(e => e.message.includes('Line topology') && e.message.includes('culling'));
      expect(cullingWarning).toBeDefined();
      expect(cullingWarning?.severity).toBe('warning');
    });

    it('should warn about line-strip with face culling', () => {
      const state: PipelineStateDescriptor = {
        topology: 'line-strip',
        rasterization: {
          cullMode: 'front', // BAD
          frontFace: 'ccw',
        },
      };

      const errors = PipelineStateValidator.validate(state);
      expect(errors.length).toBeGreaterThan(0);
      const cullingWarning = errors.find(e => e.message.includes('Line topology') && e.message.includes('culling'));
      expect(cullingWarning).toBeDefined();
      expect(cullingWarning?.severity).toBe('warning');
    });

    it('should not warn when line topology disables culling', () => {
      const state: PipelineStateDescriptor = {
        topology: 'line-list',
        rasterization: {
          cullMode: 'none', // GOOD
          frontFace: 'ccw',
        },
      };

      const errors = PipelineStateValidator.validate(state);
      const cullingWarnings = errors.filter(e => e.message.includes('culling'));
      expect(cullingWarnings).toHaveLength(0);
    });
  });

  describe('Multiple Errors', () => {
    it('should report multiple validation errors', () => {
      const state: PipelineStateDescriptor = {
        topology: 'line-list',
        blend: {
          enabled: true, // BAD: wireframe with blending
          srcFactor: 'one',
          dstFactor: 'one',
          operation: 'add',
        },
        rasterization: {
          cullMode: 'back', // BAD: lines with culling
          frontFace: 'ccw',
        },
      };

      const errors = PipelineStateValidator.validate(state);
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('validateOrThrow', () => {
    it('should not throw for valid state', () => {
      expect(() => {
        PipelineStateValidator.validateOrThrow(OPAQUE_PIPELINE_STATE);
      }).not.toThrow();
    });

    it('should not throw for warnings only', () => {
      const state: PipelineStateDescriptor = {
        topology: 'line-list',
        rasterization: {
          cullMode: 'back', // WARNING only
          frontFace: 'ccw',
        },
      };

      expect(() => {
        PipelineStateValidator.validateOrThrow(state);
      }).not.toThrow();
    });

    it('should throw for error-level validation failures', () => {
      const state: PipelineStateDescriptor = {
        topology: 'triangle-list',
        blend: {
          enabled: true,
          srcFactor: 'one',
          dstFactor: 'one',
          operation: 'add',
        },
        depthStencil: {
          depthWriteEnabled: true, // ERROR: additive with depth writes
          depthCompare: 'less',
        },
      };

      expect(() => {
        PipelineStateValidator.validateOrThrow(state);
      }).toThrow(/Pipeline state validation failed/);
    });

    it('should throw with detailed error messages', () => {
      const state: PipelineStateDescriptor = {
        topology: 'triangle-list',
        multisample: {
          alphaToCoverageEnabled: true,
          count: 1, // ERROR
        },
      };

      expect(() => {
        PipelineStateValidator.validateOrThrow(state);
      }).toThrow(/Alpha-to-coverage/);
    });
  });

  describe('Preset Characteristics', () => {
    it('OPAQUE should have depth writes enabled', () => {
      expect(OPAQUE_PIPELINE_STATE.depthStencil?.depthWriteEnabled).toBe(true);
      expect(OPAQUE_PIPELINE_STATE.blend?.enabled).toBe(false);
    });

    it('ALPHA_BLEND should disable depth writes', () => {
      expect(ALPHA_BLEND_PIPELINE_STATE.blend?.enabled).toBe(true);
      expect(ALPHA_BLEND_PIPELINE_STATE.depthStencil?.depthWriteEnabled).toBe(false);
    });

    it('ADDITIVE_BLEND should disable depth writes', () => {
      expect(ADDITIVE_BLEND_PIPELINE_STATE.blend?.enabled).toBe(true);
      expect(ADDITIVE_BLEND_PIPELINE_STATE.blend?.srcFactor).toBe('one');
      expect(ADDITIVE_BLEND_PIPELINE_STATE.blend?.dstFactor).toBe('one');
      expect(ADDITIVE_BLEND_PIPELINE_STATE.depthStencil?.depthWriteEnabled).toBe(false);
    });

    it('ALPHA_CUTOUT should use alpha-to-coverage', () => {
      expect(ALPHA_CUTOUT_PIPELINE_STATE.multisample?.alphaToCoverageEnabled).toBe(true);
      expect(ALPHA_CUTOUT_PIPELINE_STATE.multisample?.count).toBeGreaterThanOrEqual(2);
      expect(ALPHA_CUTOUT_PIPELINE_STATE.rasterization?.cullMode).toBe('none');
    });

    it('WIREFRAME should use line topology', () => {
      expect(WIREFRAME_PIPELINE_STATE.topology).toBe('line-list');
      expect(WIREFRAME_PIPELINE_STATE.rasterization?.cullMode).toBe('none');
      expect(WIREFRAME_PIPELINE_STATE.blend?.enabled).toBe(false);
    });
  });
});
