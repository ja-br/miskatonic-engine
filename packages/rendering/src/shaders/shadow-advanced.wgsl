/**
 * Advanced Shadow Sampling - Epic 3.17 Phase 2
 *
 * Point light cubemap shadows, spot light shadows, and Poisson disk PCF.
 */

/**
 * Point light shadow data
 */
struct PointShadowData {
  position: vec3<f32>,           // Light position in world space
  range: f32,                    // Shadow range
  faceRegions: array<vec4<f32>, 6>,  // UV bounds for each cubemap face
  _padding: vec2<f32>,
}

/**
 * Spot light shadow data
 */
struct SpotShadowData {
  viewProjectionMatrix: mat4x4<f32>,  // 64 bytes
  uvBounds: vec4<f32>,                // 16 bytes - minU, minV, maxU, maxV
  position: vec3<f32>,                // 12 bytes
  coneAngle: f32,                     // 4 bytes
  direction: vec3<f32>,               // 12 bytes
  penumbra: f32,                      // 4 bytes
}

/**
 * Poisson disk samples for PCF (16 samples, stratified)
 * Pre-computed for good distribution across unit disk
 */
const POISSON_DISK_16: array<vec2<f32>, 16> = array<vec2<f32>, 16>(
  vec2<f32>(-0.94201624, -0.39906216),
  vec2<f32>(0.94558609, -0.76890725),
  vec2<f32>(-0.094184101, -0.92938870),
  vec2<f32>(0.34495938, 0.29387760),
  vec2<f32>(-0.91588581, 0.45771432),
  vec2<f32>(-0.81544232, -0.87912464),
  vec2<f32>(-0.38277543, 0.27676845),
  vec2<f32>(0.97484398, 0.75648379),
  vec2<f32>(0.44323325, -0.97511554),
  vec2<f32>(0.53742981, -0.47373420),
  vec2<f32>(-0.26496911, -0.41893023),
  vec2<f32>(0.79197514, 0.19090188),
  vec2<f32>(-0.24188840, 0.99706507),
  vec2<f32>(-0.81409955, 0.91437590),
  vec2<f32>(0.19984126, 0.78641367),
  vec2<f32>(0.14383161, -0.14100790)
);

/**
 * Poisson disk samples for PCF (32 samples, high quality)
 */
const POISSON_DISK_32: array<vec2<f32>, 32> = array<vec2<f32>, 32>(
  vec2<f32>(-0.975402, -0.0711386),
  vec2<f32>(-0.920347, -0.379712),
  vec2<f32>(-0.883908, 0.217872),
  vec2<f32>(-0.884518, 0.568865),
  vec2<f32>(-0.811945, -0.661406),
  vec2<f32>(-0.792474, 0.799842),
  vec2<f32>(-0.791096, -0.887643),
  vec2<f32>(-0.778286, -0.167896),
  vec2<f32>(-0.585748, -0.446106),
  vec2<f32>(-0.462722, -0.861095),
  vec2<f32>(-0.460467, -0.672569),
  vec2<f32>(-0.437989, 0.526906),
  vec2<f32>(-0.331566, 0.850248),
  vec2<f32>(-0.188938, -0.955929),
  vec2<f32>(-0.127410, 0.302816),
  vec2<f32>(0.007235, -0.387150),
  vec2<f32>(0.019824, 0.821915),
  vec2<f32>(0.019876, -0.652071),
  vec2<f32>(0.169567, -0.137093),
  vec2<f32>(0.195235, 0.528082),
  vec2<f32>(0.261841, -0.881198),
  vec2<f32>(0.272651, 0.959246),
  vec2<f32>(0.373582, -0.452886),
  vec2<f32>(0.404403, 0.213858),
  vec2<f32>(0.520169, -0.767749),
  vec2<f32>(0.651553, -0.284988),
  vec2<f32>(0.657662, 0.670385),
  vec2<f32>(0.692750, -0.602148),
  vec2<f32>(0.750596, 0.428593),
  vec2<f32>(0.808801, -0.927012),
  vec2<f32>(0.850697, 0.100430),
  vec2<f32>(0.981181, -0.242548)
);

/**
 * Determine which cubemap face to sample based on direction.
 *
 * @param direction Direction from light to fragment (unnormalized)
 * @returns Face index (0-5) and UV coordinates on that face
 */
fn selectCubeFace(direction: vec3<f32>) -> vec3<f32> {
  let absDir = abs(direction);
  var faceIndex: f32 = 0.0;
  var u: f32 = 0.0;
  var v: f32 = 0.0;
  var maxAxis: f32 = absDir.x;

  // Determine dominant axis and face
  // CRITICAL FIX: Prevent division by zero with max() clamping
  if (absDir.x >= absDir.y && absDir.x >= absDir.z) {
    // X-axis dominant
    let invAxis = 1.0 / max(absDir.x, 0.001);
    if (direction.x > 0.0) {
      // +X face (index 0)
      faceIndex = 0.0;
      u = -direction.z * invAxis;
      v = -direction.y * invAxis;
    } else {
      // -X face (index 1)
      faceIndex = 1.0;
      u = direction.z * invAxis;
      v = -direction.y * invAxis;
    }
  } else if (absDir.y >= absDir.z) {
    // Y-axis dominant
    let invAxis = 1.0 / max(absDir.y, 0.001);
    if (direction.y > 0.0) {
      // +Y face (index 2)
      faceIndex = 2.0;
      u = direction.x * invAxis;
      v = direction.z * invAxis;
    } else {
      // -Y face (index 3)
      faceIndex = 3.0;
      u = direction.x * invAxis;
      v = -direction.z * invAxis;
    }
  } else {
    // Z-axis dominant
    let invAxis = 1.0 / max(absDir.z, 0.001);
    if (direction.z > 0.0) {
      // +Z face (index 4)
      faceIndex = 4.0;
      u = direction.x * invAxis;
      v = -direction.y * invAxis;
    } else {
      // -Z face (index 5)
      faceIndex = 5.0;
      u = -direction.x * invAxis;
      v = -direction.y * invAxis;
    }
  }

  // Convert from [-1, 1] to [0, 1]
  u = u * 0.5 + 0.5;
  v = v * 0.5 + 0.5;

  return vec3<f32>(faceIndex, u, v);
}

/**
 * Sample point light cubemap shadow with hardware PCF.
 *
 * @param shadowAtlas Shadow atlas texture
 * @param shadowSampler Comparison sampler
 * @param pointShadow Point light shadow data
 * @param fragWorldPos Fragment position in world space
 * @param bias Shadow bias
 * @returns Shadow factor (0.0 = fully shadowed, 1.0 = fully lit)
 */
fn samplePointShadowHardware(
  shadowAtlas: texture_depth_2d,
  shadowSampler: sampler_comparison,
  pointShadow: PointShadowData,
  fragWorldPos: vec3<f32>,
  bias: f32
) -> f32 {
  // Direction from light to fragment
  let direction = fragWorldPos - pointShadow.position;
  let distance = length(direction);

  // Check if outside shadow range
  if (distance > pointShadow.range) {
    return 1.0;
  }

  // Select cubemap face and get UV
  let faceData = selectCubeFace(direction);
  let faceIndex = u32(faceData.x);
  let faceUV = faceData.yz;

  // Get UV bounds for selected face
  let uvBounds = pointShadow.faceRegions[faceIndex];

  // CRITICAL FIX: Validate atlas allocation succeeded (bounds have non-zero area)
  let boundsWidth = uvBounds.z - uvBounds.x;
  let boundsHeight = uvBounds.w - uvBounds.y;
  if (boundsWidth <= 0.0 || boundsHeight <= 0.0) {
    // Allocation failed or light disabled - return unshadowed
    return 1.0;
  }

  let atlasUV = vec2<f32>(
    mix(uvBounds.x, uvBounds.z, faceUV.x),
    mix(uvBounds.y, uvBounds.w, faceUV.y)
  );

  // Normalize depth to [0, 1]
  let depth = (distance - bias) / pointShadow.range;

  // Sample with hardware PCF
  return textureSampleCompare(shadowAtlas, shadowSampler, atlasUV, depth);
}

/**
 * Sample point light shadow with Poisson disk PCF (16 samples).
 *
 * @param shadowAtlas Shadow atlas texture
 * @param shadowSampler Comparison sampler
 * @param pointShadow Point light shadow data
 * @param fragWorldPos Fragment position in world space
 * @param bias Shadow bias
 * @param filterRadius PCF filter radius in texels
 * @returns Shadow factor (0.0 = fully shadowed, 1.0 = fully lit)
 */
fn samplePointShadowPCF16(
  shadowAtlas: texture_depth_2d,
  shadowSampler: sampler_comparison,
  pointShadow: PointShadowData,
  fragWorldPos: vec3<f32>,
  bias: f32,
  filterRadius: f32
) -> f32 {
  // Direction from light to fragment
  let direction = fragWorldPos - pointShadow.position;
  let distance = length(direction);

  if (distance > pointShadow.range) {
    return 1.0;
  }

  // Select face and base UV
  let faceData = selectCubeFace(direction);
  let faceIndex = u32(faceData.x);
  let faceUV = faceData.yz;
  let uvBounds = pointShadow.faceRegions[faceIndex];

  // CRITICAL FIX: Validate atlas allocation succeeded
  let boundsWidth = uvBounds.z - uvBounds.x;
  let boundsHeight = uvBounds.w - uvBounds.y;
  if (boundsWidth <= 0.0 || boundsHeight <= 0.0) {
    return 1.0; // Allocation failed - return unshadowed
  }

  // Compute filter size in UV space
  let faceResolution = boundsWidth * 2048.0; // Estimate atlas resolution
  let uvFilterRadius = filterRadius / faceResolution;

  // Accumulate samples
  var shadowSum: f32 = 0.0;
  let depth = (distance - bias) / pointShadow.range;

  for (var i: u32 = 0u; i < 16u; i = i + 1u) {
    let offset = POISSON_DISK_16[i] * uvFilterRadius;
    // CRITICAL FIX: Clamp UV to [0,1] to prevent sampling outside atlas region
    let sampleUV = clamp(faceUV + offset, vec2<f32>(0.0), vec2<f32>(1.0));
    let atlasUV = vec2<f32>(
      mix(uvBounds.x, uvBounds.z, sampleUV.x),
      mix(uvBounds.y, uvBounds.w, sampleUV.y)
    );
    shadowSum += textureSampleCompare(shadowAtlas, shadowSampler, atlasUV, depth);
  }

  return shadowSum / 16.0;
}

/**
 * Sample spot light shadow with hardware PCF.
 *
 * @param shadowAtlas Shadow atlas texture
 * @param shadowSampler Comparison sampler
 * @param spotShadow Spot light shadow data
 * @param fragWorldPos Fragment position in world space
 * @param bias Shadow bias
 * @returns Shadow factor (0.0 = fully shadowed, 1.0 = fully lit)
 */
fn sampleSpotShadowHardware(
  shadowAtlas: texture_depth_2d,
  shadowSampler: sampler_comparison,
  spotShadow: SpotShadowData,
  fragWorldPos: vec3<f32>,
  bias: f32
) -> f32 {
  // Transform to light clip space
  let clipPos = spotShadow.viewProjectionMatrix * vec4<f32>(fragWorldPos, 1.0);

  // Perspective divide
  let ndcPos = clipPos.xyz / clipPos.w;

  // Check if outside frustum
  if (ndcPos.x < -1.0 || ndcPos.x > 1.0 ||
      ndcPos.y < -1.0 || ndcPos.y > 1.0 ||
      ndcPos.z < 0.0 || ndcPos.z > 1.0) {
    return 1.0; // Outside shadow frustum
  }

  // Convert to UV coordinates
  let uv = ndcPos.xy * 0.5 + 0.5;

  // Map to atlas region
  let uvBounds = spotShadow.uvBounds;

  // CRITICAL FIX: Validate atlas allocation succeeded (bounds have non-zero area)
  let boundsWidth = uvBounds.z - uvBounds.x;
  let boundsHeight = uvBounds.w - uvBounds.y;
  if (boundsWidth <= 0.0 || boundsHeight <= 0.0) {
    // Allocation failed or light disabled - return unshadowed
    return 1.0;
  }

  let atlasUV = vec2<f32>(
    mix(uvBounds.x, uvBounds.z, uv.x),
    mix(uvBounds.y, uvBounds.w, uv.y)
  );

  // Apply bias
  let depth = ndcPos.z - bias;

  // Sample with hardware PCF
  return textureSampleCompare(shadowAtlas, shadowSampler, atlasUV, depth);
}

/**
 * Sample spot light shadow with Poisson disk PCF (16 samples).
 *
 * @param shadowAtlas Shadow atlas texture
 * @param shadowSampler Comparison sampler
 * @param spotShadow Spot light shadow data
 * @param fragWorldPos Fragment position in world space
 * @param bias Shadow bias
 * @param filterRadius PCF filter radius in texels
 * @returns Shadow factor (0.0 = fully shadowed, 1.0 = fully lit)
 */
fn sampleSpotShadowPCF16(
  shadowAtlas: texture_depth_2d,
  shadowSampler: sampler_comparison,
  spotShadow: SpotShadowData,
  fragWorldPos: vec3<f32>,
  bias: f32,
  filterRadius: f32
) -> f32 {
  // Transform to light clip space
  let clipPos = spotShadow.viewProjectionMatrix * vec4<f32>(fragWorldPos, 1.0);
  let ndcPos = clipPos.xyz / clipPos.w;

  if (ndcPos.x < -1.0 || ndcPos.x > 1.0 ||
      ndcPos.y < -1.0 || ndcPos.y > 1.0 ||
      ndcPos.z < 0.0 || ndcPos.z > 1.0) {
    return 1.0;
  }

  let uv = ndcPos.xy * 0.5 + 0.5;
  let uvBounds = spotShadow.uvBounds;

  // CRITICAL FIX: Validate atlas allocation succeeded
  let boundsWidth = uvBounds.z - uvBounds.x;
  let boundsHeight = uvBounds.w - uvBounds.y;
  if (boundsWidth <= 0.0 || boundsHeight <= 0.0) {
    return 1.0; // Allocation failed - return unshadowed
  }

  // Compute filter size in UV space
  let shadowMapResolution = boundsWidth * 2048.0; // Estimate
  let uvFilterRadius = filterRadius / shadowMapResolution;

  // Accumulate Poisson samples
  var shadowSum: f32 = 0.0;
  let depth = ndcPos.z - bias;

  for (var i: u32 = 0u; i < 16u; i = i + 1u) {
    let offset = POISSON_DISK_16[i] * uvFilterRadius;
    // CRITICAL FIX: Clamp UV to [0,1] to prevent sampling outside atlas region
    let sampleUV = clamp(uv + offset, vec2<f32>(0.0), vec2<f32>(1.0));
    let atlasUV = vec2<f32>(
      mix(uvBounds.x, uvBounds.z, sampleUV.x),
      mix(uvBounds.y, uvBounds.w, sampleUV.y)
    );
    shadowSum += textureSampleCompare(shadowAtlas, shadowSampler, atlasUV, depth);
  }

  return shadowSum / 16.0;
}

/**
 * Sample spot light shadow with Poisson disk PCF (32 samples, high quality).
 */
fn sampleSpotShadowPCF32(
  shadowAtlas: texture_depth_2d,
  shadowSampler: sampler_comparison,
  spotShadow: SpotShadowData,
  fragWorldPos: vec3<f32>,
  bias: f32,
  filterRadius: f32
) -> f32 {
  let clipPos = spotShadow.viewProjectionMatrix * vec4<f32>(fragWorldPos, 1.0);
  let ndcPos = clipPos.xyz / clipPos.w;

  if (ndcPos.x < -1.0 || ndcPos.x > 1.0 ||
      ndcPos.y < -1.0 || ndcPos.y > 1.0 ||
      ndcPos.z < 0.0 || ndcPos.z > 1.0) {
    return 1.0;
  }

  let uv = ndcPos.xy * 0.5 + 0.5;
  let uvBounds = spotShadow.uvBounds;

  // CRITICAL FIX: Validate atlas allocation succeeded
  let boundsWidth = uvBounds.z - uvBounds.x;
  let boundsHeight = uvBounds.w - uvBounds.y;
  if (boundsWidth <= 0.0 || boundsHeight <= 0.0) {
    return 1.0; // Allocation failed - return unshadowed
  }

  let shadowMapResolution = boundsWidth * 2048.0;
  let uvFilterRadius = filterRadius / shadowMapResolution;

  var shadowSum: f32 = 0.0;
  let depth = ndcPos.z - bias;

  for (var i: u32 = 0u; i < 32u; i = i + 1u) {
    let offset = POISSON_DISK_32[i] * uvFilterRadius;
    // CRITICAL FIX: Clamp UV to [0,1] to prevent sampling outside atlas region
    let sampleUV = clamp(uv + offset, vec2<f32>(0.0), vec2<f32>(1.0));
    let atlasUV = vec2<f32>(
      mix(uvBounds.x, uvBounds.z, sampleUV.x),
      mix(uvBounds.y, uvBounds.w, sampleUV.y)
    );
    shadowSum += textureSampleCompare(shadowAtlas, shadowSampler, atlasUV, depth);
  }

  return shadowSum / 32.0;
}

/**
 * Calculate penumbra size for PCSS-style soft shadows.
 *
 * @param lightSize Light source size (radius for point, cone angle for spot)
 * @param receiverDistance Distance from receiver to light
 * @param blockerDistance Average distance of blockers to light
 * @returns Penumbra size in world space
 */
fn calculatePenumbraSize(
  lightSize: f32,
  receiverDistance: f32,
  blockerDistance: f32
) -> f32 {
  // Penumbra size = (receiverDistance - blockerDistance) * lightSize / blockerDistance
  if (blockerDistance < 0.001) {
    return 0.0;
  }
  return (receiverDistance - blockerDistance) * lightSize / blockerDistance;
}
