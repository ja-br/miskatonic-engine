/**
 * OBJ/MTL Model Loader
 * Parses Wavefront OBJ and MTL file formats
 */

import type { GeometryData, MaterialData, MaterialGroup, ModelData } from './Geometry.js';

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
 * @returns Map of material name to MaterialData
 */
export function parseMTL(mtlText: string): Map<string, MaterialData> {
  const materials = new Map<string, MaterialData>();
  let currentMaterial: MaterialData | null = null;

  const lines = mtlText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    const type = parts[0];

    if (type === 'newmtl') {
      // Start new material
      currentMaterial = {
        name: parts[1],
        diffuse: [0.8, 0.8, 0.8],
        ambient: [0.2, 0.2, 0.2],
        specular: [1.0, 1.0, 1.0],
      };
      materials.set(parts[1], currentMaterial);
    } else if (currentMaterial) {
      if (type === 'Kd') {
        currentMaterial.diffuse = [
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3]),
        ];
      } else if (type === 'Ka') {
        currentMaterial.ambient = [
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3]),
        ];
      } else if (type === 'Ks') {
        currentMaterial.specular = [
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3]),
        ];
      } else if (type === 'map_Kd') {
        // Join all parts to handle paths with spaces
        currentMaterial.texturePath = parts.slice(1).join(' ');
      }
    }
  }

  return materials;
}

/**
 * Parse OBJ file and split geometry by material
 * @param objText OBJ file content as string
 * @returns Object with combined geometry and material groups
 */
export function parseOBJWithMaterials(objText: string): { geometry: GeometryData; materialGroups: MaterialGroup[]; mtlPath?: string } {
  // Temporary arrays for raw OBJ data
  const tempPositions: number[] = [];
  const tempNormals: number[] = [];
  const tempUVs: number[] = [];

  // Material groups: materialName -> face data
  const materialFaces = new Map<string, string[][]>();
  let currentMaterial = 'default';
  let mtlPath: string | undefined;

  const lines = objText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    const type = parts[0];

    if (type === 'v') {
      tempPositions.push(
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3])
      );
    } else if (type === 'vn') {
      tempNormals.push(
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3])
      );
    } else if (type === 'vt') {
      tempUVs.push(
        parseFloat(parts[1]),
        parseFloat(parts[2])
      );
    } else if (type === 'mtllib') {
      mtlPath = parts[1];
    } else if (type === 'usemtl') {
      currentMaterial = parts[1];
      if (!materialFaces.has(currentMaterial)) {
        materialFaces.set(currentMaterial, []);
      }
    } else if (type === 'f') {
      const faceVertices = parts.slice(1);
      if (!materialFaces.has(currentMaterial)) {
        materialFaces.set(currentMaterial, []);
      }
      materialFaces.get(currentMaterial)!.push(faceVertices);
    }
  }

  // Process each material group
  const materialGroups: MaterialGroup[] = [];
  const allPositions: number[] = [];
  const allNormals: number[] = [];
  const allUVs: number[] = [];
  const allIndices: number[] = [];
  let globalVertexIndex = 0;

  for (const [materialName, faces] of materialFaces) {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const vertexMap = new Map<string, number>();
    let vertexIndex = 0;

    for (const faceVertices of faces) {
      // Fan triangulation
      triangleLoop: for (let i = 1; i < faceVertices.length - 1; i++) {
        const v1 = faceVertices[0];
        const v2 = faceVertices[i];
        const v3 = faceVertices[i + 1];

        // Validate
        for (const v of [v1, v2, v3]) {
          const vertParts = v.split('/');
          const posIdx = parseInt(vertParts[0]) - 1;
          if (posIdx < 0 || posIdx >= tempPositions.length / 3) {
            continue triangleLoop;
          }
        }

        // Process vertices
        for (const v of [v1, v2, v3]) {
          let idx = vertexMap.get(v);

          if (idx === undefined) {
            const vertParts = v.split('/');
            const posIdx = parseInt(vertParts[0]) - 1;
            const uvIdx = vertParts[1] ? parseInt(vertParts[1]) - 1 : -1;
            const normIdx = vertParts[2] ? parseInt(vertParts[2]) - 1 : -1;

            positions.push(
              tempPositions[posIdx * 3],
              tempPositions[posIdx * 3 + 1],
              tempPositions[posIdx * 3 + 2]
            );

            if (normIdx >= 0 && normIdx < tempNormals.length / 3) {
              normals.push(
                tempNormals[normIdx * 3],
                tempNormals[normIdx * 3 + 1],
                tempNormals[normIdx * 3 + 2]
              );
            } else {
              normals.push(0, 1, 0);
            }

            if (uvIdx >= 0 && uvIdx < tempUVs.length / 2) {
              uvs.push(
                tempUVs[uvIdx * 2],
                1.0 - tempUVs[uvIdx * 2 + 1]
              );
            } else {
              uvs.push(0, 0);
            }

            idx = vertexIndex++;
            vertexMap.set(v, idx);
          }

          indices.push(idx);
        }
      }
    }

    if (indices.length > 0) {
      // Create indices array
      const vertexCount = positions.length / 3;
      let indicesArray: Uint16Array | Uint32Array;
      if (vertexCount > 65535) {
        indicesArray = new Uint32Array(indices);
      } else {
        const paddedLength = indices.length % 2 === 0 ? indices.length : indices.length + 1;
        indicesArray = new Uint16Array(paddedLength);
        indicesArray.set(indices);
      }

      // Generate normals if none were specified in the OBJ file
      if (tempNormals.length === 0 && positions.length > 0) {
        generateNormals(positions, indices, normals);
      }

      materialGroups.push({
        materialName,
        geometry: {
          positions: new Float32Array(positions),
          normals: new Float32Array(normals),
          uvs: new Float32Array(uvs),
          indices: indicesArray,
        },
      });

      // Add to combined geometry
      for (let i = 0; i < indices.length; i++) {
        allIndices.push(indices[i] + globalVertexIndex);
      }
      allPositions.push(...positions);
      allNormals.push(...normals);
      allUVs.push(...uvs);
      globalVertexIndex += vertexCount;
    }
  }

  // Create combined geometry
  const totalVertexCount = allPositions.length / 3;
  let combinedIndices: Uint16Array | Uint32Array;
  if (totalVertexCount > 65535) {
    combinedIndices = new Uint32Array(allIndices);
  } else {
    const paddedLength = allIndices.length % 2 === 0 ? allIndices.length : allIndices.length + 1;
    combinedIndices = new Uint16Array(paddedLength);
    combinedIndices.set(allIndices);
  }

  return {
    geometry: {
      positions: new Float32Array(allPositions),
      normals: new Float32Array(allNormals),
      uvs: new Float32Array(allUVs),
      indices: combinedIndices,
    },
    materialGroups,
    mtlPath,
  };
}

/**
 * Load OBJ model with materials from URL
 * @param url URL to OBJ file
 * @returns ModelData with geometry, material groups, and material definitions
 */
export async function loadOBJWithMaterials(url: string): Promise<ModelData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load OBJ file: ${response.statusText}`);
  }

  const objText = await response.text();
  const { geometry, materialGroups, mtlPath } = parseOBJWithMaterials(objText);

  // Load MTL file if referenced
  let materials = new Map<string, MaterialData>();
  if (mtlPath) {
    const basePath = url.substring(0, url.lastIndexOf('/') + 1);
    const mtlUrl = basePath + mtlPath;
    try {
      const mtlResponse = await fetch(mtlUrl);
      if (mtlResponse.ok) {
        const mtlText = await mtlResponse.text();
        materials = parseMTL(mtlText);
        console.log(`Loaded ${materials.size} materials from ${mtlPath}`);
      }
    } catch (error) {
      console.warn(`Failed to load MTL file: ${mtlPath}`, error);
    }
  }

  return {
    geometry,
    materialGroups,
    materials,
    mtlPath,
  };
}

/**
 * Load OBJ model with materials from content (for file system loading via IPC)
 * @param objText OBJ file content
 * @param basePath Base directory path for resolving MTL and texture paths
 * @param readFile Function to read files from the file system
 * @returns ModelData with geometry, material groups, and material definitions
 */
export async function loadOBJWithMaterialsFromContent(
  objText: string,
  basePath: string,
  readFile: (path: string) => Promise<string | null>
): Promise<ModelData> {
  const { geometry, materialGroups, mtlPath } = parseOBJWithMaterials(objText);

  // Load MTL file if referenced
  let materials = new Map<string, MaterialData>();
  if (mtlPath) {
    const mtlFullPath = basePath + mtlPath;
    try {
      const mtlText = await readFile(mtlFullPath);
      if (mtlText) {
        materials = parseMTL(mtlText);
        console.log(`Loaded ${materials.size} materials from ${mtlPath}`);
      }
    } catch (error) {
      console.warn(`Failed to load MTL file: ${mtlPath}`, error);
    }
  }

  return {
    geometry,
    materialGroups,
    materials,
    mtlPath,
  };
}
