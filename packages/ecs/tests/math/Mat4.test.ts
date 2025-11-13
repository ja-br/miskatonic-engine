/**
 * Unit tests for Mat4 matrix utilities
 */

import { describe, test, expect } from 'vitest';
import * as Mat4 from '../../src/math/Mat4';

describe('Mat4.invert', () => {
  test('identity matrix produces identity inverse', () => {
    const identity = Mat4.identity();
    const inverted = Mat4.invert(identity);

    expect(inverted).not.toBeNull();
    expect(Mat4.isIdentity(inverted!)).toBe(true);
  });

  test('translation matrix inverts correctly', () => {
    const translation = Mat4.translation(5, 10, -3);
    const inverted = Mat4.invert(translation);

    expect(inverted).not.toBeNull();

    // Multiply matrix × inverse should equal identity
    const result = Mat4.multiply(translation, inverted!);
    expect(Mat4.isIdentity(result, 0.0001)).toBe(true);
  });

  test('rotation matrix inverts correctly', () => {
    const rotation = Mat4.rotationFromEuler(Math.PI / 4, Math.PI / 3, Math.PI / 6);
    const inverted = Mat4.invert(rotation);

    expect(inverted).not.toBeNull();

    const result = Mat4.multiply(rotation, inverted!);
    expect(Mat4.isIdentity(result, 0.0001)).toBe(true);
  });

  test('scale matrix inverts correctly', () => {
    const scale = Mat4.scale(2, 3, 4);
    const inverted = Mat4.invert(scale);

    expect(inverted).not.toBeNull();

    const result = Mat4.multiply(scale, inverted!);
    expect(Mat4.isIdentity(result, 0.0001)).toBe(true);
  });

  test('singular matrix returns null', () => {
    // Matrix with zero determinant (degenerate scale)
    const singular = Mat4.scale(0, 1, 1);
    const inverted = Mat4.invert(singular);

    expect(inverted).toBeNull();
  });

  test('TRS matrix inverts correctly', () => {
    const trs = Mat4.composeTRS(1, 2, 3, Math.PI / 4, 0, 0, 2, 2, 2);
    const inverted = Mat4.invert(trs);

    expect(inverted).not.toBeNull();

    const result = Mat4.multiply(trs, inverted!);
    expect(Mat4.isIdentity(result, 0.0001)).toBe(true);
  });
});

describe('Mat4.transpose', () => {
  test('identity matrix transposes to identity', () => {
    const identity = Mat4.identity();
    const transposed = Mat4.transpose(identity);

    expect(Mat4.isIdentity(transposed)).toBe(true);
  });

  test('transpose of transpose equals original', () => {
    const matrix = Mat4.composeTRS(1, 2, 3, 0.5, 0.3, 0.7, 1.5, 2, 0.8);
    const transposed = Mat4.transpose(matrix);
    const doubleTransposed = Mat4.transpose(transposed);

    for (let i = 0; i < 16; i++) {
      expect(doubleTransposed[i]).toBeCloseTo(matrix[i], 6);
    }
  });

  test('transpose swaps rows and columns correctly', () => {
    const matrix = new Float32Array([
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 14, 15, 16
    ]);

    const transposed = Mat4.transpose(matrix);

    // Column-major: transposed[row + col*4] = matrix[col + row*4]
    expect(transposed[0]).toBe(1);  // [0,0]
    expect(transposed[1]).toBe(5);  // [1,0] was [0,1]
    expect(transposed[4]).toBe(2);  // [0,1] was [1,0]
    expect(transposed[5]).toBe(6);  // [1,1]
  });
});

describe('Mat4.computeNormalMatrix', () => {
  test('identity matrix produces identity normal matrix', () => {
    const identity = Mat4.identity();
    const normalMatrix = Mat4.computeNormalMatrix(identity);

    expect(normalMatrix).not.toBeNull();
    expect(normalMatrix!.length).toBe(12); // 3 vec4s in std140 layout

    // Check upper-left 3x3 is identity
    expect(normalMatrix![0]).toBeCloseTo(1, 6);
    expect(normalMatrix![1]).toBeCloseTo(0, 6);
    expect(normalMatrix![2]).toBeCloseTo(0, 6);
    expect(normalMatrix![4]).toBeCloseTo(0, 6);
    expect(normalMatrix![5]).toBeCloseTo(1, 6);
    expect(normalMatrix![6]).toBeCloseTo(0, 6);
    expect(normalMatrix![8]).toBeCloseTo(0, 6);
    expect(normalMatrix![9]).toBeCloseTo(0, 6);
    expect(normalMatrix![10]).toBeCloseTo(1, 6);

    // Check padding is zero
    expect(normalMatrix![3]).toBe(0);
    expect(normalMatrix![7]).toBe(0);
    expect(normalMatrix![11]).toBe(0);
  });

  test('uniform scale matrix produces scaled normal matrix', () => {
    const scale = Mat4.scale(2, 2, 2);
    const normalMatrix = Mat4.computeNormalMatrix(scale);

    expect(normalMatrix).not.toBeNull();

    // For uniform scale, normal matrix = (1/scale) * I
    // inverse-transpose of uniform scale is just 1/scale
    expect(normalMatrix![0]).toBeCloseTo(0.5, 6);
    expect(normalMatrix![5]).toBeCloseTo(0.5, 6);
    expect(normalMatrix![10]).toBeCloseTo(0.5, 6);
  });

  test('non-uniform scale requires inverse-transpose', () => {
    const scale = Mat4.scale(2, 3, 4);
    const normalMatrix = Mat4.computeNormalMatrix(scale);

    expect(normalMatrix).not.toBeNull();

    // For non-uniform scale, normal matrix = inverse-transpose
    // Scale matrix inverts to [1/sx, 1/sy, 1/sz]
    // Transpose of diagonal matrix is itself
    expect(normalMatrix![0]).toBeCloseTo(0.5, 6);  // 1/2
    expect(normalMatrix![5]).toBeCloseTo(1/3, 6);  // 1/3
    expect(normalMatrix![10]).toBeCloseTo(0.25, 6); // 1/4
  });

  test('rotation matrix produces transposed rotation', () => {
    const rotation = Mat4.rotationFromEuler(Math.PI / 4, 0, 0);
    const normalMatrix = Mat4.computeNormalMatrix(rotation);

    expect(normalMatrix).not.toBeNull();

    // For pure rotation (orthogonal matrix), inverse = transpose
    // So inverse-transpose = original matrix
    // Extract upper-left 3x3 from rotation matrix
    expect(normalMatrix![0]).toBeCloseTo(rotation[0], 6);
    expect(normalMatrix![1]).toBeCloseTo(rotation[4], 6); // Transposed
    expect(normalMatrix![2]).toBeCloseTo(rotation[8], 6);
  });

  test('translation does not affect normal matrix', () => {
    const withTranslation = Mat4.composeTRS(10, 20, 30, 0, 0, 0, 1, 1, 1);
    const withoutTranslation = Mat4.identity();

    const normalWithTrans = Mat4.computeNormalMatrix(withTranslation);
    const normalWithoutTrans = Mat4.computeNormalMatrix(withoutTranslation);

    expect(normalWithTrans).not.toBeNull();
    expect(normalWithoutTrans).not.toBeNull();

    // Normal matrices should be identical (translation doesn't affect normals)
    for (let i = 0; i < 12; i++) {
      expect(normalWithTrans![i]).toBeCloseTo(normalWithoutTrans![i], 6);
    }
  });

  test('singular matrix returns null', () => {
    const singular = Mat4.scale(0, 1, 1); // Degenerate scale
    const normalMatrix = Mat4.computeNormalMatrix(singular);

    expect(normalMatrix).toBeNull();
  });

  test('result has correct WebGPU std140 layout', () => {
    const matrix = Mat4.composeTRS(0, 0, 0, 0.1, 0.2, 0.3, 1.5, 1.5, 1.5);
    const normalMatrix = Mat4.computeNormalMatrix(matrix);

    expect(normalMatrix).not.toBeNull();
    expect(normalMatrix!.length).toBe(12);

    // Verify padding at indices 3, 7, 11
    expect(normalMatrix![3]).toBe(0);
    expect(normalMatrix![7]).toBe(0);
    expect(normalMatrix![11]).toBe(0);

    // Verify structure is 3 vec4s (column 0, column 1, column 2)
    // Each column: [x, y, z, 0]
    const col0 = [normalMatrix![0], normalMatrix![1], normalMatrix![2], normalMatrix![3]];
    const col1 = [normalMatrix![4], normalMatrix![5], normalMatrix![6], normalMatrix![7]];
    const col2 = [normalMatrix![8], normalMatrix![9], normalMatrix![10], normalMatrix![11]];

    expect(col0[3]).toBe(0);
    expect(col1[3]).toBe(0);
    expect(col2[3]).toBe(0);
  });

  test('complex TRS produces valid normal matrix', () => {
    const trs = Mat4.composeTRS(
      5, 10, -3,                      // Translation
      Math.PI / 6, Math.PI / 4, 0,   // Rotation
      2, 3, 1.5                       // Non-uniform scale
    );

    const normalMatrix = Mat4.computeNormalMatrix(trs);

    expect(normalMatrix).not.toBeNull();
    expect(normalMatrix!.length).toBe(12);

    // Verify all values are finite
    for (let i = 0; i < 12; i++) {
      expect(isFinite(normalMatrix![i])).toBe(true);
    }

    // Verify padding
    expect(normalMatrix![3]).toBe(0);
    expect(normalMatrix![7]).toBe(0);
    expect(normalMatrix![11]).toBe(0);
  });
});

describe('Mat4 edge cases', () => {
  test('very small scale values near zero', () => {
    const scale = Mat4.scale(0.000001, 1, 1);
    const normalMatrix = Mat4.computeNormalMatrix(scale);

    // Should either return null or valid matrix, never NaN
    if (normalMatrix !== null) {
      for (let i = 0; i < 12; i++) {
        expect(isFinite(normalMatrix[i])).toBe(true);
      }
    }
  });

  test('very large scale values', () => {
    const scale = Mat4.scale(1000000, 1, 1);
    const normalMatrix = Mat4.computeNormalMatrix(scale);

    expect(normalMatrix).not.toBeNull();

    for (let i = 0; i < 12; i++) {
      expect(isFinite(normalMatrix![i])).toBe(true);
    }
  });

  test('negative scale values', () => {
    const scale = Mat4.scale(-1, 1, 1);
    const normalMatrix = Mat4.computeNormalMatrix(scale);

    expect(normalMatrix).not.toBeNull();
    expect(normalMatrix![0]).toBeCloseTo(-1, 6); // 1/(-1) = -1
  });
});
