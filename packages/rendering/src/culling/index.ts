/**
 * Culling Infrastructure - Epic 3.16
 *
 * Exports frustum culling, bounding volumes, and light culling.
 *
 * Phase 1: CPU Frustum Culling
 * Phase 2: GPU Compute-Based Light Culling
 */

// Phase 1: CPU Frustum Culling
export { Frustum, FrustumPlane, type Plane } from './Frustum';
export { BoundingSphere, BoundingBox } from './BoundingVolume';
export {
  LightCuller,
  BatchLightCuller,
  type LightCullingStats,
} from './LightCuller';

// Phase 2: GPU Compute-Based Light Culling
export { TileGrid, type TileGridConfig, type TileInfo } from './TileGrid';
export {
  GPULightCuller,
  type GPUCullingConfig,
  type GPUCullingResult,
} from './GPULightCuller';
export {
  CPUCullingStrategy,
  GPUCullingStrategy,
  createLightCullingStrategy,
  type ILightCullingStrategy,
  type CullingResult,
} from './LightCullingStrategy';

// Re-export LightType from LightCollection (single source of truth)
export { LightType } from '../LightCollection';
