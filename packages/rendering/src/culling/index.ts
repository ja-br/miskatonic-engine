/**
 * Culling Infrastructure
 *
 * Epic 3.16: Light Culling (CPU frustum + GPU compute-based)
 * Epic 3.5: Lightweight Culling (Spatial partitioning + Object culling + Occlusion)
 */

// ============================================================================
// Epic 3.16: Light Culling
// ============================================================================

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

// ============================================================================
// Epic 3.5: Lightweight Culling
// ============================================================================

// Spatial Partitioning
export {
  SpatialGrid,
  type SpatialGridConfig,
  type SpatialObject,
} from './SpatialGrid';

// Object Culling
export {
  ObjectCuller,
  type ObjectCullerConfig,
  type CullResult,
  type CullStats,
  SortOrder,
} from './ObjectCuller';

// Manual Occluder Volumes
export {
  OccluderVolumeManager,
  type OccluderVolume,
  OcclusionResult,
} from './OccluderVolume';

// Software Occlusion Testing
export {
  SoftwareOcclusionTest,
  type SoftwareOcclusionConfig,
  type DepthOccluder,
  DepthOcclusionResult,
} from './SoftwareOcclusionTest';
