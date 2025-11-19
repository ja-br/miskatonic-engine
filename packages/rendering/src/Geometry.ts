/**
 * Geometry module - types and re-exports
 * Provides vertex data types and utilities for 3D shapes and model loading
 */

// Type definitions

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
  name: string;
  diffuse: [number, number, number]; // Kd
  ambient: [number, number, number]; // Ka
  specular: [number, number, number]; // Ks
  texturePath?: string; // map_Kd
  dissolve?: number; // d (1.0 = opaque, 0.0 = transparent)
  alphaMap?: string; // map_d
  illumModel?: number; // illum
}

/**
 * Geometry data split by material
 */
export interface MaterialGroup {
  materialName: string;
  geometry: GeometryData;
}

/**
 * Complete model data with materials
 */
export interface ModelData {
  /** All geometry combined (for simple rendering) */
  geometry: GeometryData;
  /** Geometry split by material (for textured rendering) */
  materialGroups: MaterialGroup[];
  /** Material definitions */
  materials: Map<string, MaterialData>;
  /** MTL file path referenced in OBJ */
  mtlPath?: string;
}

// Re-export primitives
export { createCube, createSphere, createPlane } from './Primitives.js';

// Re-export OBJ loaders
export {
  loadOBJ,
  parseOBJ,
  parseMTL,
  parseOBJWithMaterials,
  loadOBJWithMaterials,
  loadOBJWithMaterialsFromContent,
} from './OBJLoader.js';
