/**
 * Mat4 Camera Functions Tests - Epic 3.10
 */

import { describe, it, expect } from 'vitest';
import * as Mat4 from '../src/math/Mat4';

describe('Mat4 Camera Functions', () => {
  describe('lookAt', () => {
    it('should create view matrix looking at target from eye', () => {
      const eye = new Float32Array([0, 5, 10]);
      const target = new Float32Array([0, 0, 0]);
      const up = new Float32Array([0, 1, 0]);

      const viewMatrix = Mat4.lookAt(eye, target, up);

      expect(viewMatrix).toBeInstanceOf(Float32Array);
      expect(viewMatrix.length).toBe(16);
    });

    it('should handle eye at origin looking down negative Z', () => {
      const eye = new Float32Array([0, 0, 0]);
      const target = new Float32Array([0, 0, -1]);
      const up = new Float32Array([0, 1, 0]);

      const viewMatrix = Mat4.lookAt(eye, target, up);

      // Should be close to identity (camera at origin looking down -Z)
      expect(viewMatrix[0]).toBeCloseTo(1, 1);
      expect(viewMatrix[5]).toBeCloseTo(1, 1);
      expect(viewMatrix[10]).toBeCloseTo(1, 1);
      expect(viewMatrix[15]).toBeCloseTo(1, 1);
    });

    it('should handle camera above target', () => {
      const eye = new Float32Array([0, 10, 0]);
      const target = new Float32Array([0, 0, 0]);
      const up = new Float32Array([0, 1, 0]);

      const viewMatrix = Mat4.lookAt(eye, target, up);

      // Matrix should be valid (not checking exact values since lookAt is complex)
      expect(viewMatrix.length).toBe(16);
      expect(isNaN(viewMatrix[0])).toBe(false);
    });

    it('should handle camera to the side of target', () => {
      const eye = new Float32Array([10, 0, 0]);
      const target = new Float32Array([0, 0, 0]);
      const up = new Float32Array([0, 1, 0]);

      const viewMatrix = Mat4.lookAt(eye, target, up);

      // Matrix should be valid (not checking exact values since lookAt is complex)
      expect(viewMatrix.length).toBe(16);
      expect(isNaN(viewMatrix[0])).toBe(false);
    });

    it('should handle eye and target at same position', () => {
      const eye = new Float32Array([5, 5, 5]);
      const target = new Float32Array([5, 5, 5]);
      const up = new Float32Array([0, 1, 0]);

      const viewMatrix = Mat4.lookAt(eye, target, up);

      // Should still produce valid matrix (uses default forward)
      expect(viewMatrix.length).toBe(16);
      expect(isNaN(viewMatrix[0])).toBe(false);
    });

    it('should handle up parallel to forward', () => {
      const eye = new Float32Array([0, 0, 0]);
      const target = new Float32Array([0, 1, 0]);
      const up = new Float32Array([0, 1, 0]); // Parallel to view direction

      const viewMatrix = Mat4.lookAt(eye, target, up);

      // Should still produce valid matrix (uses default right)
      expect(viewMatrix.length).toBe(16);
      expect(isNaN(viewMatrix[0])).toBe(false);
    });

    it('should produce different matrices for different eye positions', () => {
      const target = new Float32Array([0, 0, 0]);
      const up = new Float32Array([0, 1, 0]);

      const view1 = Mat4.lookAt(new Float32Array([0, 0, 10]), target, up);
      const view2 = Mat4.lookAt(new Float32Array([10, 0, 0]), target, up);

      // Matrices should be different
      let allSame = true;
      for (let i = 0; i < 16; i++) {
        if (Math.abs(view1[i] - view2[i]) > 0.001) {
          allSame = false;
          break;
        }
      }
      expect(allSame).toBe(false);
    });

    it('should normalize forward vector', () => {
      const eye = new Float32Array([0, 0, 100]); // Far away
      const target = new Float32Array([0, 0, 0]);
      const up = new Float32Array([0, 1, 0]);

      const viewMatrix = Mat4.lookAt(eye, target, up);

      // Matrix should not scale (rotation part should be normalized)
      const m0 = viewMatrix[0];
      const m1 = viewMatrix[1];
      const m2 = viewMatrix[2];
      const len = Math.sqrt(m0 * m0 + m1 * m1 + m2 * m2);

      expect(len).toBeCloseTo(1, 3);
    });
  });

  describe('perspective', () => {
    it('should create perspective projection matrix', () => {
      const fov = Math.PI / 4;
      const aspect = 16 / 9;
      const near = 0.1;
      const far = 100.0;

      const projMatrix = Mat4.perspective(fov, aspect, near, far);

      expect(projMatrix).toBeInstanceOf(Float32Array);
      expect(projMatrix.length).toBe(16);
    });

    it('should set perspective marker (element [11] = -1)', () => {
      const projMatrix = Mat4.perspective(Math.PI / 4, 16 / 9, 0.1, 100.0);

      // Perspective projection has -1 at [11]
      expect(projMatrix[11]).toBeCloseTo(-1);
    });

    it('should respect aspect ratio', () => {
      const fov = Math.PI / 4;
      const near = 0.1;
      const far = 100.0;

      const proj1 = Mat4.perspective(fov, 16 / 9, near, far);
      const proj2 = Mat4.perspective(fov, 4 / 3, near, far);

      // Different aspect ratios should produce different matrices
      expect(proj1[0]).not.toBeCloseTo(proj2[0]);
    });

    it('should respect field of view', () => {
      const aspect = 16 / 9;
      const near = 0.1;
      const far = 100.0;

      const proj1 = Mat4.perspective(Math.PI / 4, aspect, near, far);
      const proj2 = Mat4.perspective(Math.PI / 3, aspect, near, far);

      // Different FOV should produce different matrices
      let allSame = true;
      for (let i = 0; i < 16; i++) {
        if (Math.abs(proj1[i] - proj2[i]) > 0.001) {
          allSame = false;
          break;
        }
      }
      expect(allSame).toBe(false);
    });

    it('should handle wide FOV', () => {
      const projMatrix = Mat4.perspective(Math.PI / 2, 16 / 9, 0.1, 100.0);

      expect(projMatrix.length).toBe(16);
      expect(isNaN(projMatrix[0])).toBe(false);
    });

    it('should handle narrow FOV', () => {
      const projMatrix = Mat4.perspective(Math.PI / 8, 16 / 9, 0.1, 100.0);

      expect(projMatrix.length).toBe(16);
      expect(isNaN(projMatrix[0])).toBe(false);
    });

    it('should respect near/far planes', () => {
      const fov = Math.PI / 4;
      const aspect = 16 / 9;

      const proj1 = Mat4.perspective(fov, aspect, 0.1, 100.0);
      const proj2 = Mat4.perspective(fov, aspect, 0.1, 200.0); // Different far plane

      // Different near/far should produce different matrices
      // Compare multiple elements to ensure matrices differ
      let differenceFound = false;
      for (let i = 0; i < 16; i++) {
        if (Math.abs(proj1[i] - proj2[i]) > 0.001) {
          differenceFound = true;
          break;
        }
      }
      expect(differenceFound).toBe(true);
    });
  });

  describe('orthographic', () => {
    it('should create orthographic projection matrix', () => {
      const left = -10;
      const right = 10;
      const top = 10;
      const bottom = -10;
      const near = 0.1;
      const far = 100.0;

      const projMatrix = Mat4.orthographic(left, right, top, bottom, near, far);

      expect(projMatrix).toBeInstanceOf(Float32Array);
      expect(projMatrix.length).toBe(16);
    });

    it('should set orthographic marker (element [15] = 1)', () => {
      const projMatrix = Mat4.orthographic(-10, 10, 10, -10, 0.1, 100.0);

      // Orthographic projection has 1 at [15]
      expect(projMatrix[15]).toBeCloseTo(1);
    });

    it('should handle symmetric bounds', () => {
      const projMatrix = Mat4.orthographic(-10, 10, 10, -10, 0.1, 100.0);

      expect(projMatrix.length).toBe(16);
      expect(isNaN(projMatrix[0])).toBe(false);
    });

    it('should handle asymmetric bounds', () => {
      const projMatrix = Mat4.orthographic(-5, 15, 20, -8, 0.1, 100.0);

      expect(projMatrix.length).toBe(16);
      expect(isNaN(projMatrix[0])).toBe(false);
    });

    it('should respect left/right bounds', () => {
      const top = 10;
      const bottom = -10;
      const near = 0.1;
      const far = 100.0;

      const proj1 = Mat4.orthographic(-10, 10, top, bottom, near, far);
      const proj2 = Mat4.orthographic(-20, 20, top, bottom, near, far);

      // Different bounds should produce different matrices
      expect(proj1[0]).not.toBeCloseTo(proj2[0]);
    });

    it('should respect top/bottom bounds', () => {
      const left = -10;
      const right = 10;
      const near = 0.1;
      const far = 100.0;

      const proj1 = Mat4.orthographic(left, right, 10, -10, near, far);
      const proj2 = Mat4.orthographic(left, right, 20, -20, near, far);

      // Different bounds should produce different matrices
      expect(proj1[5]).not.toBeCloseTo(proj2[5]);
    });

    it('should respect near/far planes', () => {
      const left = -10;
      const right = 10;
      const top = 10;
      const bottom = -10;

      const proj1 = Mat4.orthographic(left, right, top, bottom, 0.1, 100.0);
      const proj2 = Mat4.orthographic(left, right, top, bottom, 0.1, 200.0); // Different far plane

      // Different near/far should produce different matrices
      // Compare multiple elements to ensure matrices differ
      let differenceFound = false;
      for (let i = 0; i < 16; i++) {
        if (Math.abs(proj1[i] - proj2[i]) > 0.001) {
          differenceFound = true;
          break;
        }
      }
      expect(differenceFound).toBe(true);
    });

    it('should handle very large bounds', () => {
      const projMatrix = Mat4.orthographic(-1000, 1000, 1000, -1000, 0.1, 10000.0);

      expect(projMatrix.length).toBe(16);
      expect(isNaN(projMatrix[0])).toBe(false);
    });

    it('should handle very small bounds', () => {
      const projMatrix = Mat4.orthographic(-0.1, 0.1, 0.1, -0.1, 0.01, 1.0);

      expect(projMatrix.length).toBe(16);
      expect(isNaN(projMatrix[0])).toBe(false);
    });
  });

  describe('perspective vs orthographic', () => {
    it('should produce different matrices', () => {
      const perspMatrix = Mat4.perspective(Math.PI / 4, 1, 0.1, 100.0);
      const orthoMatrix = Mat4.orthographic(-10, 10, 10, -10, 0.1, 100.0);

      // Element [11] differs (perspective: -1, orthographic: 0)
      expect(perspMatrix[11]).toBeCloseTo(-1);
      expect(orthoMatrix[11]).toBeCloseTo(0);

      // Element [15] differs (perspective: 0, orthographic: 1)
      expect(perspMatrix[15]).toBeCloseTo(0);
      expect(orthoMatrix[15]).toBeCloseTo(1);
    });
  });

  describe('matrix validity', () => {
    it('lookAt should produce valid matrix (no NaN)', () => {
      const eye = new Float32Array([0, 5, 10]);
      const target = new Float32Array([0, 0, 0]);
      const up = new Float32Array([0, 1, 0]);

      const viewMatrix = Mat4.lookAt(eye, target, up);

      for (let i = 0; i < 16; i++) {
        expect(isNaN(viewMatrix[i])).toBe(false);
        expect(isFinite(viewMatrix[i])).toBe(true);
      }
    });

    it('perspective should produce valid matrix (no NaN)', () => {
      const projMatrix = Mat4.perspective(Math.PI / 4, 16 / 9, 0.1, 100.0);

      for (let i = 0; i < 16; i++) {
        expect(isNaN(projMatrix[i])).toBe(false);
        expect(isFinite(projMatrix[i])).toBe(true);
      }
    });

    it('orthographic should produce valid matrix (no NaN)', () => {
      const projMatrix = Mat4.orthographic(-10, 10, 10, -10, 0.1, 100.0);

      for (let i = 0; i < 16; i++) {
        expect(isNaN(projMatrix[i])).toBe(false);
        expect(isFinite(projMatrix[i])).toBe(true);
      }
    });
  });
});
