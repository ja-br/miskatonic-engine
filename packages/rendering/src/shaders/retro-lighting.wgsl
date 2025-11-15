/**
 * Retro Lighting Shader
 * Epic 3.4: Retro Rendering Pipeline - Lighting
 *
 * PlayStation 2 era lighting techniques using WGSL
 */

// ============================================================================
// Bind Groups
// ============================================================================

// Group 0: Scene uniforms
struct SceneUniforms {
  viewMatrix: mat4x4<f32>,
  projectionMatrix: mat4x4<f32>,
  cameraPosition: vec3<f32>,
  padding1: f32,
}

@group(0) @binding(0) var<uniform> scene: SceneUniforms;

// Group 1: Retro lighting parameters
struct RetroLightingParams {
  // Fog config
  fogMode: f32,        // 0=none, 1=linear, 2=exp, 3=exp2
  fogStart: f32,
  fogEnd: f32,
  fogDensity: f32,

  // Fog color (vec3 + padding)
  fogColor: vec3<f32>,
  fogPadding: f32,

  // Contrast fog
  contrastFogEnabled: f32,
  contrastFogStart: f32,
  contrastFogEnd: f32,
  contrastFogIntensity: f32,

  // Lightmap + env map
  lightmapIntensity: f32,
  envMapIntensity: f32,
  lightingPadding1: f32,
  lightingPadding2: f32,

  // Ambient color
  ambientColor: vec3<f32>,
  ambientPadding: f32,
}

@group(1) @binding(0) var<uniform> lighting: RetroLightingParams;
@group(1) @binding(1) var lightmapTexture: texture_2d<f32>;
@group(1) @binding(2) var lightmapSampler: sampler;
@group(1) @binding(3) var envMapTexture: texture_cube<f32>;
@group(1) @binding(4) var envMapSampler: sampler;

// Group 2: Material uniforms
struct MaterialUniforms {
  albedo: vec3<f32>,
  padding1: f32,
  emissive: vec3<f32>,  // For unlit emissive materials (neon signs, UI)
  padding2: f32,
  roughness: f32,
  metallic: f32,
  materialPadding1: f32,
  materialPadding2: f32,
}

@group(2) @binding(0) var<uniform> material: MaterialUniforms;
@group(2) @binding(1) var albedoTexture: texture_2d<f32>;
@group(2) @binding(2) var albedoSampler: sampler;

// ============================================================================
// Vertex Shader Input/Output
// ============================================================================

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) color: vec4<f32>,      // Vertex-painted ambient (baked per-vertex)
  @location(4) lightmapUV: vec2<f32>, // Lightmap UV coordinates
}

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) worldPosition: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) vertexColor: vec4<f32>,
  @location(4) lightmapUV: vec2<f32>,
  @location(5) viewDistance: f32,  // Distance from camera (for fog)
}

// ============================================================================
// Vertex Shader
// ============================================================================

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // Transform to world space
  let worldPos = vec4<f32>(input.position, 1.0);
  output.worldPosition = worldPos.xyz;

  // Transform to clip space
  let viewPos = scene.viewMatrix * worldPos;
  output.clipPosition = scene.projectionMatrix * viewPos;

  // Pass through attributes
  output.normal = normalize(input.normal);
  output.uv = input.uv;
  output.vertexColor = input.color;
  output.lightmapUV = input.lightmapUV;

  // Calculate view distance for fog
  output.viewDistance = length(viewPos.xyz);

  return output;
}

// ============================================================================
// Fog Functions (PS2-era)
// ============================================================================

fn calculateLinearFog(distance: f32) -> f32 {
  return clamp((lighting.fogEnd - distance) / (lighting.fogEnd - lighting.fogStart), 0.0, 1.0);
}

fn calculateExponentialFog(distance: f32) -> f32 {
  return exp(-lighting.fogDensity * distance);
}

fn calculateExponentialSquaredFog(distance: f32) -> f32 {
  let exponent = lighting.fogDensity * distance;
  return exp(-exponent * exponent);
}

fn applyFog(color: vec3<f32>, distance: f32) -> vec3<f32> {
  var fogFactor = 1.0;

  if (lighting.fogMode < 0.5) {
    // No fog
    return color;
  } else if (lighting.fogMode < 1.5) {
    // Linear fog
    fogFactor = calculateLinearFog(distance);
  } else if (lighting.fogMode < 2.5) {
    // Exponential fog
    fogFactor = calculateExponentialFog(distance);
  } else {
    // Exponential squared fog
    fogFactor = calculateExponentialSquaredFog(distance);
  }

  // Mix color with fog color based on fog factor
  return mix(lighting.fogColor, color, fogFactor);
}

// ============================================================================
// Contrast Fog (Depth-based desaturation)
// ============================================================================

fn applyContrastFog(color: vec3<f32>, distance: f32) -> vec3<f32> {
  if (lighting.contrastFogEnabled < 0.5) {
    return color;
  }

  // Calculate desaturation factor based on distance
  let desatFactor = clamp(
    (distance - lighting.contrastFogStart) / (lighting.contrastFogEnd - lighting.contrastFogStart),
    0.0,
    1.0
  );

  // Convert to grayscale (luminance)
  let luminance = dot(color, vec3<f32>(0.299, 0.587, 0.114));

  // Mix between color and grayscale
  return mix(color, vec3<f32>(luminance), desatFactor * lighting.contrastFogIntensity);
}

// ============================================================================
// Simple Specular (Cube Map Reflection)
// ============================================================================

fn calculateCubemapReflection(
  worldPos: vec3<f32>,
  normal: vec3<f32>,
  roughness: f32
) -> vec3<f32> {
  // Calculate reflection vector
  let viewDir = normalize(scene.cameraPosition - worldPos);
  let reflectDir = reflect(-viewDir, normal);

  // Sample environment map
  // PS2 didn't have mip mapping for cubemaps, so we use level 0
  let reflection = textureSample(envMapTexture, envMapSampler, reflectDir).rgb;

  // Modulate by roughness (rougher = dimmer reflection)
  return reflection * (1.0 - roughness) * lighting.envMapIntensity;
}

// ============================================================================
// Fragment Shader (Retro Lit)
// ============================================================================

@fragment
fn fs_retro_lit(input: VertexOutput) -> @location(0) vec4<f32> {
  // Sample albedo texture
  let albedoSample = textureSample(albedoTexture, albedoSampler, input.uv);
  var color = albedoSample.rgb * material.albedo;

  // 1. Vertex-painted ambient (baked per-vertex colors)
  // This is how PS2 games did baked lighting on geometry
  color *= input.vertexColor.rgb;

  // 2. Lightmap (baked AO/GI, 128x128 max)
  let lightmap = textureSample(lightmapTexture, lightmapSampler, input.lightmapUV).rgb;
  color *= mix(vec3<f32>(1.0), lightmap, lighting.lightmapIntensity);

  // 3. Global ambient light
  color += lighting.ambientColor * albedoSample.rgb;

  // 4. Simple cube map specular highlights (not real-time SSR)
  if (material.metallic > 0.1) {
    let reflection = calculateCubemapReflection(
      input.worldPosition,
      input.normal,
      material.roughness
    );
    color += reflection * material.metallic;
  }

  // 5. Distance fog (linear/exponential falloff)
  color = applyFog(color, input.viewDistance);

  // 6. Contrast fog (depth-based desaturation)
  color = applyContrastFog(color, input.viewDistance);

  // Clamp to [0, 1] (no HDR in PS2 era)
  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));

  return vec4<f32>(color, albedoSample.a);
}

// ============================================================================
// Fragment Shader (Unlit Emissive)
// ============================================================================

@fragment
fn fs_retro_unlit(input: VertexOutput) -> @location(0) vec4<f32> {
  // Sample albedo texture
  let albedoSample = textureSample(albedoTexture, albedoSampler, input.uv);
  var color = albedoSample.rgb * material.albedo;

  // Add emissive (for neon signs, UI, etc.)
  color += material.emissive;

  // Unlit materials still get fog (for consistency)
  color = applyFog(color, input.viewDistance);

  // Clamp to [0, 1]
  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));

  return vec4<f32>(color, albedoSample.a);
}
