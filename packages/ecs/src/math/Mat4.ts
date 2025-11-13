/**
 * 4x4 Matrix utilities for Transform system (Epic 3.11)
 *
 * Column-major order (OpenGL/WebGL convention):
 * [m0  m4  m8  m12]
 * [m1  m5  m9  m13]
 * [m2  m6  m10 m14]
 * [m3  m7  m11 m15]
 *
 * Performance targets:
 * - Matrix multiply: <0.05ms
 * - TRS composition: <0.1ms
 * - Uses Float32Array for cache efficiency
 * - Uses wgpu-matrix for complex operations (invert, transpose, etc.)
 */

import { mat4 } from 'wgpu-matrix';

/**
 * Create identity matrix
 */
export function identity(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
}

/**
 * Create translation matrix
 */
export function translation(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1
  ]);
}

/**
 * Create scale matrix
 */
export function scale(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    x, 0, 0, 0,
    0, y, 0, 0,
    0, 0, z, 0,
    0, 0, 0, 1
  ]);
}

/**
 * Create rotation matrix from Euler angles (XYZ order)
 * @param x - Rotation around X axis (pitch) in radians
 * @param y - Rotation around Y axis (yaw) in radians
 * @param z - Rotation around Z axis (roll) in radians
 */
export function rotationFromEuler(x: number, y: number, z: number): Float32Array {
  const cx = Math.cos(x);
  const sx = Math.sin(x);
  const cy = Math.cos(y);
  const sy = Math.sin(y);
  const cz = Math.cos(z);
  const sz = Math.sin(z);

  // XYZ rotation order
  return new Float32Array([
    cy * cz,
    cy * sz,
    -sy,
    0,

    sx * sy * cz - cx * sz,
    sx * sy * sz + cx * cz,
    sx * cy,
    0,

    cx * sy * cz + sx * sz,
    cx * sy * sz - sx * cz,
    cx * cy,
    0,

    0, 0, 0, 1
  ]);
}

/**
 * Multiply two 4x4 matrices
 * Result = a × b (column-major)
 *
 * Performance: ~16 multiplies + 12 adds = ~0.05ms on modern hardware
 *
 * NOTE: This allocates a new matrix. Use multiplyTo() for zero-allocation variant.
 */
export function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const result = new Float32Array(16);
  multiplyTo(a, b, result);
  return result;
}

/**
 * Multiply two 4x4 matrices into result (ZERO ALLOCATION)
 * Result = a × b (column-major)
 *
 * Epic 3.11.5: Zero-allocation variant for hot paths
 *
 * @param a - First matrix
 * @param b - Second matrix
 * @param result - Output matrix (will be overwritten)
 */
export function multiplyTo(a: Float32Array, b: Float32Array, result: Float32Array): void {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[i + k * 4] * b[k + j * 4];
      }
      result[i + j * 4] = sum;
    }
  }
}

/**
 * Multiply matrix by matrix in-place (mutates target)
 * Faster than allocating new matrix
 *
 * @param target - Matrix to mutate (receives result)
 * @param b - Matrix to multiply by
 */
export function multiplyInPlace(target: Float32Array, b: Float32Array): void {
  const temp = new Float32Array(16);

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += target[i + k * 4] * b[k + j * 4];
      }
      temp[i + j * 4] = sum;
    }
  }

  target.set(temp);
}

/**
 * Compose TRS matrix (Translation × Rotation × Scale)
 * This is the core operation for local matrix generation
 *
 * Performance target: <0.1ms
 *
 * NOTE: This allocates a new matrix. Use composeTRSTo() for zero-allocation variant.
 */
export function composeTRS(
  tx: number, ty: number, tz: number,        // Translation
  rx: number, ry: number, rz: number,        // Rotation (Euler angles)
  scaleX: number, scaleY: number, scaleZ: number  // Scale
): Float32Array {
  const result = new Float32Array(16);
  composeTRSTo(tx, ty, tz, rx, ry, rz, scaleX, scaleY, scaleZ, result);
  return result;
}

/**
 * Compose TRS matrix into result (ZERO ALLOCATION)
 * This is the core operation for local matrix generation
 *
 * Epic 3.11.5: Zero-allocation variant for hot paths
 *
 * Performance target: <0.1ms
 *
 * @param tx, ty, tz - Translation
 * @param rx, ry, rz - Rotation (Euler angles in radians)
 * @param scaleX, scaleY, scaleZ - Scale
 * @param result - Output matrix (will be overwritten)
 */
export function composeTRSTo(
  tx: number, ty: number, tz: number,
  rx: number, ry: number, rz: number,
  scaleX: number, scaleY: number, scaleZ: number,
  result: Float32Array
): void {
  // Precompute trig functions
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);

  // Combined T × R × S in one pass (column-major)
  result[0] = scaleX * cy * cz;
  result[1] = scaleX * cy * sz;
  result[2] = scaleX * -sy;
  result[3] = 0;

  result[4] = scaleY * (sx * sy * cz - cx * sz);
  result[5] = scaleY * (sx * sy * sz + cx * cz);
  result[6] = scaleY * sx * cy;
  result[7] = 0;

  result[8] = scaleZ * (cx * sy * cz + sx * sz);
  result[9] = scaleZ * (cx * sy * sz - sx * cz);
  result[10] = scaleZ * cx * cy;
  result[11] = 0;

  result[12] = tx;
  result[13] = ty;
  result[14] = tz;
  result[15] = 1;
}

/**
 * Copy matrix
 */
export function copy(src: Float32Array): Float32Array {
  return new Float32Array(src);
}

/**
 * Set matrix to identity
 */
export function setIdentity(mat: Float32Array): void {
  mat[0] = 1; mat[4] = 0; mat[8] = 0;  mat[12] = 0;
  mat[1] = 0; mat[5] = 1; mat[9] = 0;  mat[13] = 0;
  mat[2] = 0; mat[6] = 0; mat[10] = 1; mat[14] = 0;
  mat[3] = 0; mat[7] = 0; mat[11] = 0; mat[15] = 1;
}

/**
 * Get translation from matrix
 */
export function getTranslation(mat: Float32Array): [number, number, number] {
  return [mat[12], mat[13], mat[14]];
}

/**
 * Extract scale from matrix (magnitude of basis vectors)
 */
export function getScale(mat: Float32Array): [number, number, number] {
  const sx = Math.sqrt(mat[0] * mat[0] + mat[1] * mat[1] + mat[2] * mat[2]);
  const sy = Math.sqrt(mat[4] * mat[4] + mat[5] * mat[5] + mat[6] * mat[6]);
  const sz = Math.sqrt(mat[8] * mat[8] + mat[9] * mat[9] + mat[10] * mat[10]);
  return [sx, sy, sz];
}

/**
 * Check if matrix is identity (within epsilon)
 */
export function isIdentity(mat: Float32Array, epsilon: number = 0.000001): boolean {
  return (
    Math.abs(mat[0] - 1) < epsilon &&
    Math.abs(mat[1]) < epsilon &&
    Math.abs(mat[2]) < epsilon &&
    Math.abs(mat[3]) < epsilon &&
    Math.abs(mat[4]) < epsilon &&
    Math.abs(mat[5] - 1) < epsilon &&
    Math.abs(mat[6]) < epsilon &&
    Math.abs(mat[7]) < epsilon &&
    Math.abs(mat[8]) < epsilon &&
    Math.abs(mat[9]) < epsilon &&
    Math.abs(mat[10] - 1) < epsilon &&
    Math.abs(mat[11]) < epsilon &&
    Math.abs(mat[12]) < epsilon &&
    Math.abs(mat[13]) < epsilon &&
    Math.abs(mat[14]) < epsilon &&
    Math.abs(mat[15] - 1) < epsilon
  );
}

//=============================================================================
// CAMERA MATRICES (Epic 3.10)
//=============================================================================

/**
 * Create lookAt view matrix
 *
 * @param eye - Camera position
 * @param target - Point to look at
 * @param up - Up vector (usually [0, 1, 0])
 * @returns View matrix
 */
export function lookAt(
  eye: Float32Array,
  target: Float32Array,
  up: Float32Array
): Float32Array {
  const result = new Float32Array(16);

  // Forward = normalize(eye - target)
  let fx = eye[0] - target[0];
  let fy = eye[1] - target[1];
  let fz = eye[2] - target[2];
  let flen = Math.sqrt(fx * fx + fy * fy + fz * fz);

  if (flen < 1e-6) {
    // Eye and target are the same, use default forward
    fx = 0;
    fy = 0;
    fz = 1;
  } else {
    fx /= flen;
    fy /= flen;
    fz /= flen;
  }

  // Right = normalize(cross(up, forward))
  let rx = up[1] * fz - up[2] * fy;
  let ry = up[2] * fx - up[0] * fz;
  let rz = up[0] * fy - up[1] * fx;
  let rlen = Math.sqrt(rx * rx + ry * ry + rz * rz);

  if (rlen < 1e-6) {
    // Up and forward are parallel, use default right
    rx = 1;
    ry = 0;
    rz = 0;
  } else {
    rx /= rlen;
    ry /= rlen;
    rz /= rlen;
  }

  // Recalculate up = cross(forward, right)
  const ux = fy * rz - fz * ry;
  const uy = fz * rx - fx * rz;
  const uz = fx * ry - fy * rx;

  // Build view matrix
  result[0] = rx;
  result[1] = ux;
  result[2] = fx;
  result[3] = 0;

  result[4] = ry;
  result[5] = uy;
  result[6] = fy;
  result[7] = 0;

  result[8] = rz;
  result[9] = uz;
  result[10] = fz;
  result[11] = 0;

  result[12] = -(rx * eye[0] + ry * eye[1] + rz * eye[2]);
  result[13] = -(ux * eye[0] + uy * eye[1] + uz * eye[2]);
  result[14] = -(fx * eye[0] + fy * eye[1] + fz * eye[2]);
  result[15] = 1;

  return result;
}

/**
 * Create perspective projection matrix
 *
 * @param fov - Field of view in radians
 * @param aspect - Aspect ratio (width / height)
 * @param near - Near clipping plane
 * @param far - Far clipping plane
 * @returns Projection matrix
 */
export function perspective(
  fov: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  const result = new Float32Array(16);

  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1 / (near - far);

  result[0] = f / aspect;
  result[1] = 0;
  result[2] = 0;
  result[3] = 0;

  result[4] = 0;
  result[5] = f;
  result[6] = 0;
  result[7] = 0;

  result[8] = 0;
  result[9] = 0;
  result[10] = (far + near) * nf;
  result[11] = -1;

  result[12] = 0;
  result[13] = 0;
  result[14] = 2 * far * near * nf;
  result[15] = 0;

  return result;
}

/**
 * Create orthographic projection matrix
 *
 * @param left - Left clipping plane
 * @param right - Right clipping plane
 * @param top - Top clipping plane
 * @param bottom - Bottom clipping plane
 * @param near - Near clipping plane
 * @param far - Far clipping plane
 * @returns Projection matrix
 */
export function orthographic(
  left: number,
  right: number,
  top: number,
  bottom: number,
  near: number,
  far: number
): Float32Array {
  const result = new Float32Array(16);

  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);

  result[0] = -2 * lr;
  result[1] = 0;
  result[2] = 0;
  result[3] = 0;

  result[4] = 0;
  result[5] = -2 * bt;
  result[6] = 0;
  result[7] = 0;

  result[8] = 0;
  result[9] = 0;
  result[10] = 2 * nf;
  result[11] = 0;

  result[12] = (left + right) * lr;
  result[13] = (top + bottom) * bt;
  result[14] = (far + near) * nf;
  result[15] = 1;

  return result;
}

/**
 * Invert a 4x4 matrix using wgpu-matrix
 *
 * @param matrix - Source matrix (column-major)
 * @param out - Optional output matrix (if not provided, creates new array)
 * @returns Inverted matrix, or null if matrix is singular
 */
export function invert(matrix: Float32Array, out?: Float32Array): Float32Array | null {
  const result = out || new Float32Array(16);

  // Use wgpu-matrix for SIMD-optimized inversion
  const inverted = mat4.inverse(matrix, result);

  // wgpu-matrix doesn't return null for singular matrices, it returns a matrix
  // We need to check if the matrix is effectively singular
  // Quick heuristic: check diagonal elements - if inversion failed, they're often NaN or Infinity
  if (!isFinite(result[0]) || !isFinite(result[5]) || !isFinite(result[10])) {
    return null;
  }

  return inverted;
}

/**
 * Transpose a 4x4 matrix using wgpu-matrix
 *
 * @param matrix - Source matrix (column-major)
 * @param out - Optional output matrix (if not provided, creates new array)
 * @returns Transposed matrix
 */
export function transpose(matrix: Float32Array, out?: Float32Array): Float32Array {
  const result = out || new Float32Array(16);
  return mat4.transpose(matrix, result);
}

/**
 * Compute 3x3 normal matrix from 4x4 model matrix using wgpu-matrix
 *
 * The normal matrix is the inverse-transpose of the upper-left 3x3 portion of the model matrix.
 * This correctly transforms normals even in the presence of non-uniform scaling.
 *
 * Result is stored in WebGPU std140 layout: 3 vec4s (12 floats) with padding
 *
 * @param modelMatrix - 4x4 model matrix (column-major, 16 floats)
 * @param out - Output 3x3 normal matrix in vec4 layout (12 floats)
 * @returns Normal matrix in WebGPU layout, or null if matrix is singular
 */
export function computeNormalMatrix(modelMatrix: Float32Array, out?: Float32Array): Float32Array | null {
  const result = out || new Float32Array(12);

  // Use wgpu-matrix to invert the full 4x4 matrix
  const temp4x4 = new Float32Array(16);
  const inverted = mat4.inverse(modelMatrix, temp4x4);

  // Check for singularity
  if (!isFinite(inverted[0]) || !isFinite(inverted[5]) || !isFinite(inverted[10])) {
    return null;
  }

  // Transpose and extract upper-left 3x3 into WebGPU std140 layout
  // Normal matrix = transpose(inverse(M))
  // For column-major: transpose swaps [row][col] to [col][row]

  // Column 0 (row 0 of inverted upper-left 3x3)
  result[0] = inverted[0];
  result[1] = inverted[4];
  result[2] = inverted[8];
  result[3] = 0; // padding

  // Column 1 (row 1 of inverted upper-left 3x3)
  result[4] = inverted[1];
  result[5] = inverted[5];
  result[6] = inverted[9];
  result[7] = 0; // padding

  // Column 2 (row 2 of inverted upper-left 3x3)
  result[8] = inverted[2];
  result[9] = inverted[6];
  result[10] = inverted[10];
  result[11] = 0; // padding

  return result;
}
