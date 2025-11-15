/**
 * VertexLayoutBuilder Tests - Epic RENDERING-06 Task 6.1
 */

import { describe, it, expect } from 'vitest';
import { VertexLayoutBuilder } from '../../src/builders/VertexLayoutBuilder';

describe('VertexLayoutBuilder', () => {
  describe('Basic Attributes', () => {
    it('should build position-only layout', () => {
      const layout = new VertexLayoutBuilder()
        .position(0)
        .build();

      expect(layout.arrayStride).toBe(12); // float32x3
      expect(layout.stepMode).toBe('vertex');
      expect(layout.attributes).toHaveLength(1);
      expect(layout.attributes[0]).toEqual({
        shaderLocation: 0,
        offset: 0,
        format: 'float32x3'
      });
    });

    it('should build position + normal layout', () => {
      const layout = new VertexLayoutBuilder()
        .position(0)
        .normal(1)
        .build();

      expect(layout.arrayStride).toBe(24); // 12 + 12
      expect(layout.attributes).toHaveLength(2);
      expect(layout.attributes[0].offset).toBe(0);
      expect(layout.attributes[1].offset).toBe(12);
    });

    it('should build position + normal + UV layout', () => {
      const layout = new VertexLayoutBuilder()
        .position(0)
        .normal(1)
        .uv(2)
        .build();

      expect(layout.arrayStride).toBe(32); // 12 + 12 + 8
      expect(layout.attributes).toHaveLength(3);
      expect(layout.attributes[2]).toEqual({
        shaderLocation: 2,
        offset: 24,
        format: 'float32x2'
      });
    });

    it('should build colored vertex layout', () => {
      const layout = new VertexLayoutBuilder()
        .position(0)
        .color(1)
        .build();

      expect(layout.arrayStride).toBe(28); // 12 + 16
      expect(layout.attributes).toHaveLength(2);
      expect(layout.attributes[1].format).toBe('float32x4');
    });

    it('should build tangent attribute', () => {
      const layout = new VertexLayoutBuilder()
        .position(0)
        .tangent(1)
        .build();

      expect(layout.arrayStride).toBe(28); // 12 + 16
      expect(layout.attributes[1].format).toBe('float32x4');
    });
  });

  describe('Custom Attributes', () => {
    it('should add custom attribute', () => {
      const layout = new VertexLayoutBuilder()
        .position(0)
        .custom(1, 'float32x4')
        .build();

      expect(layout.arrayStride).toBe(28);
      expect(layout.attributes[1]).toEqual({
        shaderLocation: 1,
        offset: 12,
        format: 'float32x4'
      });
    });

    it('should handle sint32 format', () => {
      const layout = new VertexLayoutBuilder()
        .custom(0, 'sint32')
        .build();

      expect(layout.arrayStride).toBe(4);
    });

    it('should handle uint16x4 format', () => {
      const layout = new VertexLayoutBuilder()
        .custom(0, 'uint16x4')
        .build();

      expect(layout.arrayStride).toBe(8);
    });
  });

  describe('Instance Attributes', () => {
    it('should build instance matrix layout', () => {
      const layout = new VertexLayoutBuilder()
        .instanceMatrix(0)
        .build();

      expect(layout.stepMode).toBe('instance');
      expect(layout.arrayStride).toBe(64); // 4 * vec4 = 4 * 16
      expect(layout.attributes).toHaveLength(4);

      // Check all 4 rows of the matrix
      for (let i = 0; i < 4; i++) {
        expect(layout.attributes[i]).toEqual({
          shaderLocation: i,
          offset: i * 16,
          format: 'float32x4'
        });
      }
    });

    it('should build instance color layout', () => {
      const layout = new VertexLayoutBuilder()
        .instanceColor(0)
        .build();

      expect(layout.stepMode).toBe('instance');
      expect(layout.arrayStride).toBe(16);
      expect(layout.attributes[0].format).toBe('float32x4');
    });

    it('should combine instance matrix and color', () => {
      const layout = new VertexLayoutBuilder()
        .instanceMatrix(0)
        .instanceColor(4)
        .build();

      expect(layout.stepMode).toBe('instance');
      expect(layout.arrayStride).toBe(80); // 64 + 16
      expect(layout.attributes).toHaveLength(5);
    });
  });

  describe('Manual Offsets', () => {
    it('should allow manual offset specification', () => {
      const layout = new VertexLayoutBuilder()
        .position(0, 0)
        .normal(1, 16) // Skip 4 bytes of padding
        .build();

      expect(layout.attributes[0].offset).toBe(0);
      expect(layout.attributes[1].offset).toBe(16);
      expect(layout.arrayStride).toBe(28); // 16 + 12
    });

    it('should disable auto offsets', () => {
      const layout = new VertexLayoutBuilder()
        .manualOffsets()
        .position(0, 0)
        .color(1, 12)
        .build();

      expect(layout.attributes[0].offset).toBe(0);
      expect(layout.attributes[1].offset).toBe(12);
    });
  });

  describe('Step Mode', () => {
    it('should default to vertex step mode', () => {
      const layout = new VertexLayoutBuilder()
        .position(0)
        .build();

      expect(layout.stepMode).toBe('vertex');
    });

    it('should allow explicit step mode setting', () => {
      const layout = new VertexLayoutBuilder()
        .setStepMode('instance')
        .position(0)
        .build();

      expect(layout.stepMode).toBe('instance');
    });
  });

  describe('Static Factory Methods', () => {
    it('should create PBR layout', () => {
      const layout = VertexLayoutBuilder.PBR().build();

      expect(layout.arrayStride).toBe(48); // 12 + 12 + 8 + 16
      expect(layout.attributes).toHaveLength(4);
      expect(layout.attributes[0].format).toBe('float32x3'); // position
      expect(layout.attributes[1].format).toBe('float32x3'); // normal
      expect(layout.attributes[2].format).toBe('float32x2'); // uv
      expect(layout.attributes[3].format).toBe('float32x4'); // tangent
    });

    it('should create Simple layout', () => {
      const layout = VertexLayoutBuilder.Simple().build();

      expect(layout.arrayStride).toBe(20); // 12 + 8
      expect(layout.attributes).toHaveLength(2);
      expect(layout.attributes[0].format).toBe('float32x3'); // position
      expect(layout.attributes[1].format).toBe('float32x2'); // uv
    });

    it('should create Colored layout', () => {
      const layout = VertexLayoutBuilder.Colored().build();

      expect(layout.arrayStride).toBe(28); // 12 + 16
      expect(layout.attributes).toHaveLength(2);
      expect(layout.attributes[0].format).toBe('float32x3'); // position
      expect(layout.attributes[1].format).toBe('float32x4'); // color
    });

    it('should create PositionOnly layout', () => {
      const layout = VertexLayoutBuilder.PositionOnly().build();

      expect(layout.arrayStride).toBe(12);
      expect(layout.attributes).toHaveLength(1);
      expect(layout.attributes[0].format).toBe('float32x3');
    });

    it('should create Lit layout', () => {
      const layout = VertexLayoutBuilder.Lit().build();

      expect(layout.arrayStride).toBe(24); // 12 + 12
      expect(layout.attributes).toHaveLength(2);
      expect(layout.attributes[0].format).toBe('float32x3'); // position
      expect(layout.attributes[1].format).toBe('float32x3'); // normal
    });

    it('should allow custom start location', () => {
      const layout = VertexLayoutBuilder.PBR(4).build();

      expect(layout.attributes[0].shaderLocation).toBe(4);
      expect(layout.attributes[1].shaderLocation).toBe(5);
      expect(layout.attributes[2].shaderLocation).toBe(6);
      expect(layout.attributes[3].shaderLocation).toBe(7);
    });
  });

  describe('Validation', () => {
    it('should throw error when building with no attributes', () => {
      const builder = new VertexLayoutBuilder();

      expect(() => builder.build()).toThrow('No attributes added to vertex layout');
    });

    it('should throw error for unknown vertex format', () => {
      expect(() => {
        new VertexLayoutBuilder()
          .custom(0, 'invalid-format')
          .build();
      }).toThrow('Unknown vertex format: "invalid-format"');
    });

    it('should provide list of valid formats in error message', () => {
      try {
        new VertexLayoutBuilder()
          .custom(0, 'bad-format')
          .build();
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('Valid formats:');
        expect(e.message).toContain('float32x3');
        expect(e.message).toContain('uint16x4');
      }
    });
  });

  describe('Fluent API', () => {
    it('should allow method chaining', () => {
      const layout = new VertexLayoutBuilder()
        .position(0)
        .normal(1)
        .uv(2)
        .color(3)
        .tangent(4)
        .setStepMode('vertex')
        .build();

      expect(layout.attributes).toHaveLength(5);
      expect(layout.stepMode).toBe('vertex');
    });
  });

  describe('Format Size Calculation', () => {
    it('should calculate correct sizes for all formats', () => {
      const formats: [string, number][] = [
        ['float32', 4],
        ['float32x2', 8],
        ['float32x3', 12],
        ['float32x4', 16],
        ['sint32', 4],
        ['uint32', 4],
        ['float16x2', 4],
        ['float16x4', 8],
        ['unorm8x4', 4],
        ['snorm16x4', 8]
      ];

      for (const [format, expectedSize] of formats) {
        const layout = new VertexLayoutBuilder()
          .custom(0, format)
          .build();

        expect(layout.arrayStride).toBe(expectedSize);
      }
    });
  });
});
