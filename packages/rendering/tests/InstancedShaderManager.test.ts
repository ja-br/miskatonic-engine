/**
 * InstancedShaderManager Tests - Epic 3.13
 *
 * Tests for instanced shader variant generation.
 */

import { describe, it, expect } from 'vitest';
import { InstancedShaderManager, createShaderVariants } from '../src/InstancedShaderManager';

describe('InstancedShaderManager', () => {
  describe('createInstancedVariant', () => {
    it('should replace u_ModelMatrix with instance attribute', () => {
      const manager = new InstancedShaderManager();

      const source = {
        vertex: `
#version 300 es
in vec3 a_Position;
uniform mat4 u_ModelMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ProjectionMatrix;

void main() {
  gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * vec4(a_Position, 1.0);
}
`,
        fragment: `
#version 300 es
out vec4 fragColor;
void main() {
  fragColor = vec4(1.0);
}
`,
      };

      const instanced = manager.createInstancedVariant(source);

      expect(instanced.vertex).toContain('in mat4 a_InstanceTransform');
      expect(instanced.vertex).not.toContain('uniform mat4 u_ModelMatrix');
      expect(instanced.vertex).toContain('a_InstanceTransform * vec4(a_Position, 1.0)');
      expect(instanced.fragment).toBe(source.fragment); // Fragment unchanged
    });

    it('should handle shaders without model matrix', () => {
      const manager = new InstancedShaderManager();

      const source = {
        vertex: `
#version 300 es
in vec3 a_Position;
uniform mat4 u_ViewProjection;

void main() {
  gl_Position = u_ViewProjection * vec4(a_Position, 1.0);
}
`,
        fragment: `
#version 300 es
out vec4 fragColor;
void main() {
  fragColor = vec4(1.0);
}
`,
      };

      const instanced = manager.createInstancedVariant(source);

      // Should add instance attribute even if no model matrix
      expect(instanced.vertex).toContain('in mat4 a_InstanceTransform');
    });

    it('should replace all occurrences of u_ModelMatrix', () => {
      const manager = new InstancedShaderManager();

      const source = {
        vertex: `
#version 300 es
in vec3 a_Position;
in vec3 a_Normal;
uniform mat4 u_ModelMatrix;
uniform mat4 u_ViewMatrix;
out vec3 v_Normal;

void main() {
  v_Normal = mat3(u_ModelMatrix) * a_Normal;
  vec4 worldPos = u_ModelMatrix * vec4(a_Position, 1.0);
  gl_Position = u_ViewMatrix * worldPos;
}
`,
        fragment: '',
      };

      const instanced = manager.createInstancedVariant(source);

      // All 3 occurrences should be replaced
      const matches = instanced.vertex.match(/a_InstanceTransform/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(3);
    });

    it('should support custom attribute name', () => {
      const manager = new InstancedShaderManager({
        instanceAttributeName: 'a_CustomTransform',
      });

      const source = {
        vertex: `
uniform mat4 u_ModelMatrix;
void main() {
  gl_Position = u_ModelMatrix * vec4(1.0);
}
`,
        fragment: '',
      };

      const instanced = manager.createInstancedVariant(source);

      expect(instanced.vertex).toContain('in mat4 a_CustomTransform');
      expect(instanced.vertex).toContain('a_CustomTransform * vec4(1.0)');
    });
  });

  describe('hasModelMatrix', () => {
    it('should detect model matrix in shader', () => {
      const manager = new InstancedShaderManager();

      const withModel = 'uniform mat4 u_ModelMatrix;';
      const withoutModel = 'uniform mat4 u_ViewMatrix;';

      expect(manager.hasModelMatrix(withModel)).toBe(true);
      expect(manager.hasModelMatrix(withoutModel)).toBe(false);
    });
  });

  describe('getInstanceAttributeName', () => {
    it('should return default attribute name', () => {
      const manager = new InstancedShaderManager();
      expect(manager.getInstanceAttributeName()).toBe('a_InstanceTransform');
    });

    it('should return custom attribute name', () => {
      const manager = new InstancedShaderManager({
        instanceAttributeName: 'a_Custom',
      });
      expect(manager.getInstanceAttributeName()).toBe('a_Custom');
    });
  });

  describe('static methods', () => {
    it('should generate variant ID', () => {
      expect(InstancedShaderManager.getVariantId('basic', 'standard')).toBe('basic');
      expect(InstancedShaderManager.getVariantId('basic', 'instanced')).toBe('basic_instanced');
    });

    it('should parse variant from ID', () => {
      expect(InstancedShaderManager.parseVariant('basic')).toBe('standard');
      expect(InstancedShaderManager.parseVariant('basic_instanced')).toBe('instanced');
    });

    it('should extract base ID', () => {
      expect(InstancedShaderManager.getBaseId('basic')).toBe('basic');
      expect(InstancedShaderManager.getBaseId('basic_instanced')).toBe('basic');
    });
  });

  describe('createShaderVariants', () => {
    it('should create both standard and instanced variants', () => {
      const source = {
        vertex: `
in vec3 a_Position;
uniform mat4 u_ModelMatrix;
void main() {
  gl_Position = u_ModelMatrix * vec4(a_Position, 1.0);
}
`,
        fragment: 'void main() {}',
      };

      const variants = createShaderVariants('basic', source);

      expect(variants.standard.id).toBe('basic');
      expect(variants.standard.source).toBe(source);

      expect(variants.instanced.id).toBe('basic_instanced');
      expect(variants.instanced.source.vertex).toContain('a_InstanceTransform');
      expect(variants.instanced.source.vertex).not.toContain('u_ModelMatrix');
    });
  });
});
