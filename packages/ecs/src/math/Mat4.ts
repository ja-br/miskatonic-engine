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
 */

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
