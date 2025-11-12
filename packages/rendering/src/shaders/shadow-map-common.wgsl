/**
 * Shadow Map Common - Epic 3.17 Phase 1
 *
 * Shared WGSL utilities for shadow mapping.
 * Includes PCF filtering, cascade selection, and shadow bias.
 */

/**
 * Cascade data structure (matches DirectionalShadowCascades)
 *
 * CRITICAL: Field order matters for GPU memory alignment!
 * - mat4x4<f32> requires 16-byte alignment (offset 0)
 * - vec4<f32> requires 16-byte alignment (offset 64)
 * - f32 requires 4-byte alignment (offset 80, 84)
 * - vec2<f32> requires 8-byte alignment (offset 88)
 * Total size: 96 bytes (6 x 16-byte blocks)
 */
struct Cascade {
  viewProjectionMatrix: mat4x4<f32>,  // 64 bytes (offset 0)
  uvBounds: vec4<f32>,                // 16 bytes (offset 64) - minU, minV, maxU, maxV
  near: f32,                          // 4 bytes (offset 80)
  far: f32,                           // 4 bytes (offset 84)
  _padding: vec2<f32>,                // 8 bytes (offset 88)
}

/**
 * Shadow configuration
 */
struct ShadowConfig {
  cascadeCount: u32,
  pcfKernelSize: u32,  // 0=no PCF, 1=3x3, 2=5x5
  shadowBias: f32,
  normalBias: f32,
}

/**
 * Sample shadow map with hardware PCF.
 * Returns 0.0 (fully shadowed) to 1.0 (fully lit).
 *
 * @param shadowMap Shadow atlas texture
 * @param shadowSampler Comparison sampler
 * @param shadowCoord Shadow space position (xyz = position, w = cascade index)
 * @param uvBounds Atlas region bounds [minU, minV, maxU, maxV]
 * @returns Shadow factor (0 = shadowed, 1 = lit)
 */
fn sampleShadowMap(
  shadowMap: texture_depth_2d,
  shadowSampler: sampler_comparison,
  shadowCoord: vec3<f32>,
  uvBounds: vec4<f32>
) -> f32 {
  // Transform to atlas UV space
  let uv = vec2<f32>(
    uvBounds.x + shadowCoord.x * (uvBounds.z - uvBounds.x),
    uvBounds.y + shadowCoord.y * (uvBounds.w - uvBounds.y)
  );

  // Hardware PCF sample
  return textureSampleCompare(shadowMap, shadowSampler, uv, shadowCoord.z);
}

/**
 * Sample shadow map with software PCF (Percentage Closer Filtering).
 * Performs NxN tap filter for softer shadows.
 *
 * @param shadowMap Shadow atlas texture
 * @param shadowSampler Comparison sampler
 * @param shadowCoord Shadow space position
 * @param uvBounds Atlas region bounds
 * @param kernelSize PCF kernel size (1=3x3, 2=5x5)
 * @param texelSize Texel size in shadow map (1.0 / resolution)
 * @returns Shadow factor (0 = shadowed, 1 = lit)
 */
fn sampleShadowMapPCF(
  shadowMap: texture_depth_2d,
  shadowSampler: sampler_comparison,
  shadowCoord: vec3<f32>,
  uvBounds: vec4<f32>,
  kernelSize: u32,
  texelSize: f32
) -> f32 {
  if (kernelSize == 0u) {
    // No PCF, single sample
    return sampleShadowMap(shadowMap, shadowSampler, shadowCoord, uvBounds);
  }

  // Transform to atlas UV space
  let baseUV = vec2<f32>(
    uvBounds.x + shadowCoord.x * (uvBounds.z - uvBounds.x),
    uvBounds.y + shadowCoord.y * (uvBounds.w - uvBounds.y)
  );

  // PCF kernel
  var shadow = 0.0;
  var sampleCount = 0.0;

  let radius = f32(kernelSize);
  let step = texelSize;

  for (var x = -radius; x <= radius; x = x + 1.0) {
    for (var y = -radius; y <= radius; y = y + 1.0) {
      let offset = vec2<f32>(x, y) * step;
      let uv = baseUV + offset;

      // Clamp to atlas region
      let clampedUV = clamp(uv, vec2<f32>(uvBounds.x, uvBounds.y), vec2<f32>(uvBounds.z, uvBounds.w));

      shadow += textureSampleCompare(shadowMap, shadowSampler, clampedUV, shadowCoord.z);
      sampleCount += 1.0;
    }
  }

  return shadow / sampleCount;
}

/**
 * Apply shadow bias to prevent shadow acne.
 *
 * @param worldPos World-space position
 * @param worldNormal World-space normal (normalized)
 * @param lightDir Light direction (normalized, pointing towards light)
 * @param shadowBias Constant depth bias
 * @param normalBias Normal-based bias
 * @returns Biased world position
 */
fn applyShadowBias(
  worldPos: vec3<f32>,
  worldNormal: vec3<f32>,
  lightDir: vec3<f32>,
  shadowBias: f32,
  normalBias: f32
) -> vec3<f32> {
  // Slope-scaled bias: larger bias for surfaces parallel to light
  let ndotl = max(dot(worldNormal, lightDir), 0.0);
  let slopeBias = shadowBias * (1.0 - ndotl);

  // Normal offset bias
  return worldPos + worldNormal * (slopeBias + normalBias);
}

/**
 * Select cascade for given view-space depth.
 *
 * @param viewDepth View-space depth (positive)
 * @param cascades Array of cascade data
 * @param cascadeCount Number of cascades
 * @returns Cascade index, or -1 if out of range
 */
fn selectCascade(
  viewDepth: f32,
  cascades: array<Cascade, 4>,  // Max 4 cascades
  cascadeCount: u32
) -> i32 {
  for (var i = 0u; i < cascadeCount; i = i + 1u) {
    if (viewDepth >= cascades[i].near && viewDepth < cascades[i].far) {
      return i32(i);
    }
  }
  return -1;  // Out of shadow range
}

/**
 * Transform world position to shadow space for a cascade.
 *
 * @param worldPos World-space position
 * @param cascade Cascade data
 * @returns Shadow space position (xyz = NDC coords, w unused)
 */
fn worldToShadowSpace(
  worldPos: vec3<f32>,
  cascade: Cascade
) -> vec4<f32> {
  let shadowPos = cascade.viewProjectionMatrix * vec4<f32>(worldPos, 1.0);

  // Convert from NDC [-1, 1] to UV [0, 1]
  let shadowCoord = vec3<f32>(
    shadowPos.x / shadowPos.w * 0.5 + 0.5,
    shadowPos.y / shadowPos.w * 0.5 + 0.5,
    shadowPos.z / shadowPos.w
  );

  return vec4<f32>(shadowCoord, 0.0);
}

/**
 * Compute directional light shadow factor with CSM.
 *
 * @param worldPos World-space position
 * @param worldNormal World-space normal
 * @param viewDepth View-space depth
 * @param lightDir Light direction (towards light)
 * @param shadowMap Shadow atlas
 * @param shadowSampler Comparison sampler
 * @param cascades Cascade data
 * @param config Shadow configuration
 * @returns Shadow factor (0 = shadowed, 1 = lit)
 */
fn computeDirectionalShadow(
  worldPos: vec3<f32>,
  worldNormal: vec3<f32>,
  viewDepth: f32,
  lightDir: vec3<f32>,
  shadowMap: texture_depth_2d,
  shadowSampler: sampler_comparison,
  cascades: array<Cascade, 4>,
  config: ShadowConfig
) -> f32 {
  // Select cascade
  let cascadeIndex = selectCascade(viewDepth, cascades, config.cascadeCount);
  if (cascadeIndex < 0) {
    return 1.0;  // Out of shadow range, fully lit
  }

  let cascade = cascades[cascadeIndex];

  // Apply bias
  let biasedPos = applyShadowBias(
    worldPos,
    worldNormal,
    lightDir,
    config.shadowBias,
    config.normalBias
  );

  // Transform to shadow space
  let shadowCoord = worldToShadowSpace(biasedPos, cascade);

  // Sample shadow map with PCF
  let texelSize = 1.0 / 1024.0;  // TODO: Pass actual cascade resolution
  return sampleShadowMapPCF(
    shadowMap,
    shadowSampler,
    shadowCoord.xyz,
    cascade.uvBounds,
    config.pcfKernelSize,
    texelSize
  );
}

/**
 * Visualize cascade index as color (for debugging).
 *
 * @param cascadeIndex Cascade index (0-3)
 * @returns Debug color
 */
fn cascadeDebugColor(cascadeIndex: i32) -> vec3<f32> {
  switch (cascadeIndex) {
    case 0: { return vec3<f32>(1.0, 0.0, 0.0); }  // Red
    case 1: { return vec3<f32>(0.0, 1.0, 0.0); }  // Green
    case 2: { return vec3<f32>(0.0, 0.0, 1.0); }  // Blue
    case 3: { return vec3<f32>(1.0, 1.0, 0.0); }  // Yellow
    default: { return vec3<f32>(1.0, 1.0, 1.0); } // White
  }
}

/**
 * Blend between cascades to reduce popping artifacts.
 *
 * @param viewDepth View-space depth
 * @param cascade Current cascade
 * @param nextCascade Next cascade (or null)
 * @param blendRange Depth range for blending (in view space)
 * @returns Blend factor (0 = use cascade, 1 = use nextCascade)
 */
fn computeCascadeBlendFactor(
  viewDepth: f32,
  cascade: Cascade,
  nextCascade: Cascade,
  blendRange: f32
) -> f32 {
  let cascadeEnd = cascade.far;
  let blendStart = cascadeEnd - blendRange;

  if (viewDepth < blendStart) {
    return 0.0;  // No blend
  }

  if (viewDepth > cascadeEnd) {
    return 1.0;  // Fully next cascade
  }

  // Linear blend
  return (viewDepth - blendStart) / blendRange;
}
