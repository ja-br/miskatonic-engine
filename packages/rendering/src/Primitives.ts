/**
 * Geometry primitive generation
 * Provides vertex data for common 3D shapes
 */

import type { GeometryData } from './Geometry.js';

/**
 * Generate a cube with given size
 */
export function createCube(size: number = 1.0): GeometryData {
  const s = size / 2;

  // 24 vertices (4 per face, 6 faces)
  const positions = new Float32Array([
    // Front face
    -s, -s, s, s, -s, s, s, s, s, -s, s, s,
    // Back face
    -s, -s, -s, -s, s, -s, s, s, -s, s, -s, -s,
    // Top face
    -s, s, -s, -s, s, s, s, s, s, s, s, -s,
    // Bottom face
    -s, -s, -s, s, -s, -s, s, -s, s, -s, -s, s,
    // Right face
    s, -s, -s, s, s, -s, s, s, s, s, -s, s,
    // Left face
    -s, -s, -s, -s, -s, s, -s, s, s, -s, s, -s,
  ]);

  const normals = new Float32Array([
    // Front
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    // Back
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    // Top
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    // Bottom
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    // Right
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    // Left
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]);

  const uvs = new Float32Array([
    // Front
    0, 0, 1, 0, 1, 1, 0, 1,
    // Back
    1, 0, 1, 1, 0, 1, 0, 0,
    // Top
    0, 1, 0, 0, 1, 0, 1, 1,
    // Bottom
    1, 1, 0, 1, 0, 0, 1, 0,
    // Right
    1, 0, 1, 1, 0, 1, 0, 0,
    // Left
    0, 0, 1, 0, 1, 1, 0, 1,
  ]);

  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, // front
    4, 5, 6, 4, 6, 7, // back
    8, 9, 10, 8, 10, 11, // top
    12, 13, 14, 12, 14, 15, // bottom
    16, 17, 18, 16, 18, 19, // right
    20, 21, 22, 20, 22, 23, // left
  ]);

  return { positions, normals, uvs, indices };
}

/**
 * Generate a sphere with given radius and subdivisions
 */
export function createSphere(
  radius: number = 1.0,
  widthSegments: number = 32,
  heightSegments: number = 16
): GeometryData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let lat = 0; lat <= heightSegments; lat++) {
    const theta = (lat * Math.PI) / heightSegments;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= widthSegments; lon++) {
      const phi = (lon * 2 * Math.PI) / widthSegments;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;

      positions.push(radius * x, radius * y, radius * z);
      normals.push(x, y, z);
      uvs.push(lon / widthSegments, 1 - lat / heightSegments);
    }
  }

  for (let lat = 0; lat < heightSegments; lat++) {
    for (let lon = 0; lon < widthSegments; lon++) {
      const first = lat * (widthSegments + 1) + lon;
      const second = first + widthSegments + 1;

      // Counter-clockwise winding for front faces (to match cullMode: 'back', frontFace: 'ccw')
      indices.push(first, first + 1, second);
      indices.push(second, first + 1, second + 1);
    }
  }

  // Use Uint32Array if vertex count exceeds Uint16 max (65535)
  const vertexCount = positions.length / 3;

  let indicesArray: Uint16Array | Uint32Array;
  if (vertexCount > 65535) {
    indicesArray = new Uint32Array(indices);
  } else {
    // WebGPU requires buffer sizes to be multiples of 4 bytes.
    // Uint16Array with odd length needs padding.
    const paddedLength = indices.length % 2 === 0 ? indices.length : indices.length + 1;
    indicesArray = new Uint16Array(paddedLength);
    indicesArray.set(indices);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: indicesArray,
  };
}

/**
 * Generate a plane with given size and subdivisions
 */
export function createPlane(
  width: number = 1.0,
  depth: number = 1.0,
  widthSegments: number = 1,
  depthSegments: number = 1
): GeometryData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const widthHalf = width / 2;
  const depthHalf = depth / 2;

  const gridX = widthSegments;
  const gridZ = depthSegments;

  const segmentWidth = width / gridX;
  const segmentDepth = depth / gridZ;

  // Generate vertices for HORIZONTAL floor plane (XZ plane with Y=0)
  for (let iz = 0; iz <= gridZ; iz++) {
    const z = iz * segmentDepth - depthHalf;

    for (let ix = 0; ix <= gridX; ix++) {
      const x = ix * segmentWidth - widthHalf;

      // Horizontal plane: positions in XZ plane, Y=0
      positions.push(x, 0, z);
      // Normals pointing UP (+Y)
      normals.push(0, 1, 0);
      uvs.push(ix / gridX, 1 - iz / gridZ);
    }
  }

  // Generate indices
  for (let iz = 0; iz < gridZ; iz++) {
    for (let ix = 0; ix < gridX; ix++) {
      const a = ix + (gridX + 1) * iz;
      const b = ix + (gridX + 1) * (iz + 1);
      const c = ix + 1 + (gridX + 1) * (iz + 1);
      const d = ix + 1 + (gridX + 1) * iz;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // Use Uint32Array if vertex count exceeds Uint16 max (65535)
  const vertexCount = positions.length / 3;

  let indicesArray: Uint16Array | Uint32Array;
  if (vertexCount > 65535) {
    indicesArray = new Uint32Array(indices);
  } else {
    // WebGPU requires buffer sizes to be multiples of 4 bytes.
    // Uint16Array with odd length needs padding.
    const paddedLength = indices.length % 2 === 0 ? indices.length : indices.length + 1;
    indicesArray = new Uint16Array(paddedLength);
    indicesArray.set(indices);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: indicesArray,
  };
}
