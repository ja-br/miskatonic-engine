/**
 * Light Culling Compute Shader - Epic 3.16 Phase 2
 *
 * Forward+ tile-based light culling.
 * Each workgroup processes one tile (16x16 pixels).
 * Tests all lights against tile frustum and builds per-tile light list.
 */

// Light data structure (matches LightData from LightCollection.ts)
struct Light {
  position: vec3<f32>,      // World-space position
  type: u32,                // 0=directional, 1=point, 2=spot, 3=ambient
  direction: vec3<f32>,     // Direction (for directional/spot)
  radius: f32,              // Radius (for point/spot)
  color: vec3<f32>,         // RGB color
  intensity: f32,           // Intensity multiplier
  innerConeAngle: f32,      // Inner cone angle (spot only)
  outerConeAngle: f32,      // Outer cone angle (spot only)
  _padding: vec2<f32>,      // Alignment padding
}

// Tile frustum plane (6 planes per tile)
struct Plane {
  normal: vec3<f32>,        // Plane normal (inward)
  distance: f32,            // Distance from origin
}

// Culling configuration
struct CullingConfig {
  screenWidth: u32,
  screenHeight: u32,
  tileSize: u32,
  numLights: u32,
  tilesX: u32,
  tilesY: u32,
  maxLightsPerTile: u32,
  _padding: u32,
}

// Bindings
@group(0) @binding(0) var<storage, read> lights: array<Light>;
@group(0) @binding(1) var<storage, read> tilePlanes: array<Plane>;  // 6 planes per tile
@group(0) @binding(2) var<storage, read_write> tileLightIndices: array<u32>;  // Output: [tile][count, indices...]
@group(0) @binding(3) var<uniform> config: CullingConfig;

// Shared memory for cooperative culling
var<workgroup> sharedLightIndices: array<u32, 256>;
var<workgroup> sharedLightCount: atomic<u32>;

/**
 * Test if a sphere intersects a frustum (tile).
 * Returns true if sphere is visible in tile.
 */
fn testSphereVsFrustum(
  center: vec3<f32>,
  radius: f32,
  tileIndex: u32
) -> bool {
  let planeOffset = tileIndex * 6u;

  // Test against all 6 planes
  for (var i = 0u; i < 6u; i = i + 1u) {
    let plane = tilePlanes[planeOffset + i];
    let distance = dot(plane.normal, center) + plane.distance;

    // Sphere completely outside this plane
    if (distance < -radius) {
      return false;
    }
  }

  return true;
}

/**
 * Main compute shader entry point.
 * Each workgroup handles one tile.
 * Threads cooperatively test lights and build light list.
 */
@compute @workgroup_size(16, 16, 1)
fn main(
  @builtin(global_invocation_id) globalId: vec3<u32>,
  @builtin(local_invocation_id) localId: vec3<u32>,
  @builtin(workgroup_id) workgroupId: vec3<u32>,
  @builtin(local_invocation_index) localIndex: u32
) {
  // Tile index (one tile per workgroup)
  let tileX = workgroupId.x;
  let tileY = workgroupId.y;
  let tileIndex = tileY * config.tilesX + tileX;

  // Initialize shared memory on first thread
  if (localIndex == 0u) {
    atomicStore(&sharedLightCount, 0u);
  }
  workgroupBarrier();

  // Each thread tests a subset of lights
  let numThreads = 256u;  // 16x16 workgroup
  let lightsPerThread = (config.numLights + numThreads - 1u) / numThreads;
  let startLight = localIndex * lightsPerThread;
  let endLight = min(startLight + lightsPerThread, config.numLights);

  // Test lights assigned to this thread
  for (var lightIdx = startLight; lightIdx < endLight; lightIdx = lightIdx + 1u) {
    let light = lights[lightIdx];

    // Always include directional and ambient lights
    if (light.type == 0u || light.type == 3u) {
      let count = atomicAdd(&sharedLightCount, 1u);
      if (count < 256u) {  // Hardcoded to match array size
        sharedLightIndices[count] = lightIdx;
      }
      continue;
    }

    // Test point and spot lights against tile frustum
    if (light.type == 1u || light.type == 2u) {
      if (testSphereVsFrustum(light.position, light.radius, tileIndex)) {
        let count = atomicAdd(&sharedLightCount, 1u);
        if (count < 256u) {  // Hardcoded to match array size
          sharedLightIndices[count] = lightIdx;
        }
      }
    }
  }

  // Wait for all threads to finish testing
  workgroupBarrier();

  // Write results to global memory (first thread only)
  if (localIndex == 0u) {
    let finalCount = atomicLoad(&sharedLightCount);
    let clampedCount = min(finalCount, config.maxLightsPerTile);

    // Output format: [count, lightIndex0, lightIndex1, ...]
    let outputOffset = tileIndex * (config.maxLightsPerTile + 1u);
    tileLightIndices[outputOffset] = clampedCount;

    for (var i = 0u; i < clampedCount; i = i + 1u) {
      tileLightIndices[outputOffset + 1u + i] = sharedLightIndices[i];
    }
  }
}
