/**
 * High-Level Rendering API - Epic 3.14
 *
 * Simplified rendering API that reduces boilerplate from 30+ lines to 5 lines.
 * Provides Material, Mesh, and HighLevelRenderer abstractions with automatic
 * resource management.
 *
 * @example
 * ```typescript
 * import { HighLevelRenderer, Material, Mesh } from '@miskatonic/rendering/highlevel';
 *
 * const renderer = new HighLevelRenderer({ canvas });
 * await renderer.initialize();
 *
 * const material = Material.Textured(renderer, { texture: 'crate.png' });
 * await renderer.createMaterial(material);
 *
 * const cube = Mesh.Cube(renderer);
 * renderer.createMesh(cube);
 *
 * renderer.beginFrame();
 * renderer.draw(cube, material, transform);
 * renderer.endFrame();
 * ```
 *
 * @module highlevel
 */

// Main classes
export { HighLevelRenderer, type HighLevelConfig, type RenderStats } from './HighLevelRenderer';
export {
  Material,
  type MaterialConfig,
  type UniformValue,
  type TextureConfig,
} from './Material';
export { Mesh, type BoundingBox } from './Mesh';

// Utility functions (advanced users)
export {
  generateId,
  loadImage,
  loadShaderSource,
  calculateAlignedUniformSize,
  getUniformTypeSize,
  serializeUniform,
} from './utils';

// Built-in shaders (for reference/custom materials)
export {
  UNLIT_SHADER,
  TEXTURED_SHADER,
  PBR_SHADER,
  TOON_SHADER,
  TRANSPARENT_SHADER,
  getAllBuiltinShaders,
} from './shaders/builtins';
