/**
 * Geometry primitive generation
 * Provides vertex data for common 3D shapes
 */

export interface GeometryData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array | Uint32Array;
}

/**
 * Basic material properties from MTL files
 */
export interface MaterialData {
  diffuse: [number, number, number]; // Kd
  ambient: [number, number, number]; // Ka
  specular: [number, number, number]; // Ks
  texturePath?: string; // map_Kd
}

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
  height: number = 1.0,
  widthSegments: number = 1,
  heightSegments: number = 1
): GeometryData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const widthHalf = width / 2;
  const heightHalf = height / 2;

  const gridX = widthSegments;
  const gridY = heightSegments;

  const segmentWidth = width / gridX;
  const segmentHeight = height / gridY;

  // Generate vertices
  for (let iy = 0; iy <= gridY; iy++) {
    const y = iy * segmentHeight - heightHalf;

    for (let ix = 0; ix <= gridX; ix++) {
      const x = ix * segmentWidth - widthHalf;

      positions.push(x, y, 0);
      normals.push(0, 0, 1);
      uvs.push(ix / gridX, 1 - iy / gridY);
    }
  }

  // Generate indices
  for (let iy = 0; iy < gridY; iy++) {
    for (let ix = 0; ix < gridX; ix++) {
      const a = ix + (gridX + 1) * iy;
      const b = ix + (gridX + 1) * (iy + 1);
      const c = ix + 1 + (gridX + 1) * (iy + 1);
      const d = ix + 1 + (gridX + 1) * iy;

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

/**
 * Load OBJ model from URL
 * @param url URL to OBJ file
 * @returns GeometryData with positions, normals, UVs, and indices
 */
export async function loadOBJ(url: string): Promise<GeometryData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load OBJ file: ${response.statusText}`);
  }

  const text = await response.text();
  return parseOBJ(text);
}

/**
 * Parse OBJ file format
 * @param objText OBJ file content as string
 * @returns GeometryData with positions, normals, UVs, and indices
 */
export function parseOBJ(objText: string): GeometryData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Temporary arrays for raw OBJ data
  const tempPositions: number[] = [];
  const tempNormals: number[] = [];
  const tempUVs: number[] = [];

  // Map to reuse vertices with same position/normal/uv combination
  const vertexMap = new Map<string, number>();
  let vertexIndex = 0;

  const lines = objText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    const type = parts[0];

    if (type === 'v') {
      // Vertex position
      tempPositions.push(
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3])
      );
    } else if (type === 'vn') {
      // Vertex normal
      tempNormals.push(
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3])
      );
    } else if (type === 'vt') {
      // Texture coordinate
      tempUVs.push(
        parseFloat(parts[1]),
        parseFloat(parts[2])
      );
    } else if (type === 'f') {
      // Face - triangulate if needed
      const faceVertices = parts.slice(1);

      // Fan triangulation for polygons (assumes convex)
      triangleLoop: for (let i = 1; i < faceVertices.length - 1; i++) {
        const v1 = faceVertices[0];
        const v2 = faceVertices[i];
        const v3 = faceVertices[i + 1];

        // Validate all 3 vertices before processing triangle
        for (const v of [v1, v2, v3]) {
          const vertParts = v.split('/');
          const posIdx = parseInt(vertParts[0]) - 1;
          if (posIdx < 0 || posIdx >= tempPositions.length / 3) {
            console.warn(`Invalid position index: ${posIdx + 1}, skipping triangle`);
            continue triangleLoop;
          }
        }

        // Process all 3 vertices (validation passed)
        for (const v of [v1, v2, v3]) {
          let idx = vertexMap.get(v);

          if (idx === undefined) {
            const vertParts = v.split('/');
            const posIdx = parseInt(vertParts[0]) - 1;
            const uvIdx = vertParts[1] ? parseInt(vertParts[1]) - 1 : -1;
            const normIdx = vertParts[2] ? parseInt(vertParts[2]) - 1 : -1;

            // Add position
            positions.push(
              tempPositions[posIdx * 3],
              tempPositions[posIdx * 3 + 1],
              tempPositions[posIdx * 3 + 2]
            );

            // Add normal (or generate default)
            if (normIdx >= 0 && normIdx < tempNormals.length / 3) {
              normals.push(
                tempNormals[normIdx * 3],
                tempNormals[normIdx * 3 + 1],
                tempNormals[normIdx * 3 + 2]
              );
            } else {
              normals.push(0, 1, 0); // Default up normal
            }

            // Add UV (or generate default)
            if (uvIdx >= 0 && uvIdx < tempUVs.length / 2) {
              uvs.push(
                tempUVs[uvIdx * 2],
                1.0 - tempUVs[uvIdx * 2 + 1] // Flip V coordinate
              );
            } else {
              uvs.push(0, 0); // Default UV
            }

            idx = vertexIndex++;
            vertexMap.set(v, idx);
          }

          indices.push(idx);
        }
      }
    }
  }

  // If no normals were specified, generate them from faces
  if (tempNormals.length === 0 && positions.length > 0) {
    generateNormals(positions, indices, normals);
  }

  // Use Uint32Array if vertex count exceeds Uint16 max
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
 * Generate smooth vertex normals from face data
 */
function generateNormals(positions: number[], indices: number[], normals: number[]): void {
  // Initialize normals to zero
  for (let i = 0; i < positions.length; i++) {
    normals[i] = 0;
  }

  // Accumulate face normals
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;

    const v0x = positions[i0];
    const v0y = positions[i0 + 1];
    const v0z = positions[i0 + 2];

    const v1x = positions[i1];
    const v1y = positions[i1 + 1];
    const v1z = positions[i1 + 2];

    const v2x = positions[i2];
    const v2y = positions[i2 + 1];
    const v2z = positions[i2 + 2];

    // Edge vectors
    const e1x = v1x - v0x;
    const e1y = v1y - v0y;
    const e1z = v1z - v0z;

    const e2x = v2x - v0x;
    const e2y = v2y - v0y;
    const e2z = v2z - v0z;

    // Face normal (cross product)
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    // Add to all three vertices
    normals[i0] += nx;
    normals[i0 + 1] += ny;
    normals[i0 + 2] += nz;

    normals[i1] += nx;
    normals[i1 + 1] += ny;
    normals[i1 + 2] += nz;

    normals[i2] += nx;
    normals[i2 + 1] += ny;
    normals[i2 + 2] += nz;
  }

  // Normalize
  for (let i = 0; i < normals.length; i += 3) {
    const nx = normals[i];
    const ny = normals[i + 1];
    const nz = normals[i + 2];

    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) {
      normals[i] /= len;
      normals[i + 1] /= len;
      normals[i + 2] /= len;
    }
  }
}

/**
 * Parse MTL (Material Template Library) file
 * @param mtlText MTL file content as string
 * @returns MaterialData with basic material properties
 */
export function parseMTL(mtlText: string): MaterialData {
  const material: MaterialData = {
    diffuse: [0.8, 0.8, 0.8],
    ambient: [0.2, 0.2, 0.2],
    specular: [1.0, 1.0, 1.0],
  };

  const lines = mtlText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    const type = parts[0];

    if (type === 'Kd') {
      // Diffuse color
      material.diffuse = [
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3]),
      ];
    } else if (type === 'Ka') {
      // Ambient color
      material.ambient = [
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3]),
      ];
    } else if (type === 'Ks') {
      // Specular color
      material.specular = [
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3]),
      ];
    } else if (type === 'map_Kd') {
      // Diffuse texture map
      material.texturePath = parts[1];
    }
  }

  return material;
}

