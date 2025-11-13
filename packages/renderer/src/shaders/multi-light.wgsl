/**
 * Multi-Light Shader - Epic 3.14 Modern Rendering API
 *
 * Demonstrates proper usage of:
 * - Storage buffers for light arrays (unbounded size)
 * - Bind group structure (@group(0) for scene data)
 * - Blinn-Phong lighting with multiple light types
 */

// Light types (matches LightType enum from LightCollection.ts)
const LIGHT_TYPE_DIRECTIONAL: u32 = 0u;
const LIGHT_TYPE_POINT: u32 = 1u;
const LIGHT_TYPE_SPOT: u32 = 2u;
const LIGHT_TYPE_AMBIENT: u32 = 3u;

// Scene uniforms (Group 0, Binding 0)
struct SceneUniforms {
  viewProjectionMatrix: mat4x4<f32>,
  cameraPosition: vec3<f32>,
  time: f32,
  ambientColor: vec3<f32>,
  ambientIntensity: f32,
}

// Light data structure (must match LightData from LightCollection.ts)
// Aligned to 16 bytes (vec4) boundaries for storage buffer compatibility
struct Light {
  position: vec3<f32>,
  lightType: u32,           // LightType enum value (renamed from 'type' - WGSL reserved keyword)
  direction: vec3<f32>,
  range: f32,               // radius for point/spot lights
  color: vec3<f32>,
  intensity: f32,
  spotAngle: f32,           // inner cone angle (radians)
  spotPenumbra: f32,        // outer cone angle (radians)
  castsShadows: u32,        // boolean (0 or 1)
  enabled: u32,             // boolean (0 or 1)
}

// Object uniforms (per-draw-call data)
struct ObjectUniforms {
  modelMatrix: mat4x4<f32>,
  normalMatrix: mat4x4<f32>,
  baseColor: vec4<f32>,
}

// Bind Group 0: Scene-level data
@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(0) @binding(1) var<storage, read> lights: array<Light>;
@group(0) @binding(2) var<uniform> lightCounts: vec4<u32>; // x=directional, y=point, z=spot, w=total

// Bind Group 1: Object-level data (per-draw-call)
@group(1) @binding(0) var<uniform> object: ObjectUniforms;

// Vertex input
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
}

// Vertex output / Fragment input
struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) worldPosition: vec3<f32>,
  @location(1) worldNormal: vec3<f32>,
}

// Vertex Shader
@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // Transform position to world space
  let worldPos = object.modelMatrix * vec4<f32>(input.position, 1.0);
  output.worldPosition = worldPos.xyz;

  // Transform position to clip space
  output.clipPosition = scene.viewProjectionMatrix * worldPos;

  // Transform normal to world space
  output.worldNormal = (object.normalMatrix * vec4<f32>(input.normal, 0.0)).xyz;

  return output;
}

// Lighting calculations

/**
 * Calculate Blinn-Phong lighting for a directional light
 */
fn calculateDirectionalLight(
  light: Light,
  normal: vec3<f32>,
  viewDir: vec3<f32>
) -> vec3<f32> {
  if (light.enabled == 0u) {
    return vec3<f32>(0.0);
  }

  let lightDir = normalize(-light.direction);

  // Diffuse
  let NdotL = max(dot(normal, lightDir), 0.0);
  let diffuse = light.color * light.intensity * NdotL;

  // Specular (Blinn-Phong)
  let halfDir = normalize(lightDir + viewDir);
  let NdotH = max(dot(normal, halfDir), 0.0);
  let specular = light.color * light.intensity * pow(NdotH, 32.0) * 0.5;

  return diffuse + specular;
}

/**
 * Calculate Blinn-Phong lighting for a point light
 */
fn calculatePointLight(
  light: Light,
  worldPos: vec3<f32>,
  normal: vec3<f32>,
  viewDir: vec3<f32>
) -> vec3<f32> {
  if (light.enabled == 0u) {
    return vec3<f32>(0.0);
  }

  let lightVec = light.position - worldPos;
  let distance = length(lightVec);

  // Check if within range
  if (distance > light.range) {
    return vec3<f32>(0.0);
  }

  let lightDir = normalize(lightVec);

  // Attenuation (inverse square falloff with smooth cutoff)
  let attenuation = 1.0 / (1.0 + distance * distance / (light.range * light.range));
  let smoothAttenuation = attenuation * attenuation;

  // Diffuse
  let NdotL = max(dot(normal, lightDir), 0.0);
  let diffuse = light.color * light.intensity * NdotL * smoothAttenuation;

  // Specular (Blinn-Phong)
  let halfDir = normalize(lightDir + viewDir);
  let NdotH = max(dot(normal, halfDir), 0.0);
  let specular = light.color * light.intensity * pow(NdotH, 32.0) * 0.5 * smoothAttenuation;

  return diffuse + specular;
}

/**
 * Calculate Blinn-Phong lighting for a spot light
 */
fn calculateSpotLight(
  light: Light,
  worldPos: vec3<f32>,
  normal: vec3<f32>,
  viewDir: vec3<f32>
) -> vec3<f32> {
  if (light.enabled == 0u) {
    return vec3<f32>(0.0);
  }

  let lightVec = light.position - worldPos;
  let distance = length(lightVec);

  // Check if within range
  if (distance > light.range) {
    return vec3<f32>(0.0);
  }

  let lightDir = normalize(lightVec);
  let spotDir = normalize(light.direction);

  // Spot cone attenuation
  let cosAngle = dot(-lightDir, spotDir);
  let innerCone = cos(light.spotAngle);
  let outerCone = cos(light.spotAngle + light.spotPenumbra);

  if (cosAngle < outerCone) {
    return vec3<f32>(0.0);
  }

  let spotAttenuation = smoothstep(outerCone, innerCone, cosAngle);

  // Distance attenuation
  let attenuation = 1.0 / (1.0 + distance * distance / (light.range * light.range));
  let smoothAttenuation = attenuation * attenuation * spotAttenuation;

  // Diffuse
  let NdotL = max(dot(normal, lightDir), 0.0);
  let diffuse = light.color * light.intensity * NdotL * smoothAttenuation;

  // Specular (Blinn-Phong)
  let halfDir = normalize(lightDir + viewDir);
  let NdotH = max(dot(normal, halfDir), 0.0);
  let specular = light.color * light.intensity * pow(NdotH, 32.0) * 0.5 * smoothAttenuation;

  return diffuse + specular;
}

// Fragment Shader
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let normal = normalize(input.worldNormal);
  let viewDir = normalize(scene.cameraPosition - input.worldPosition);

  // Start with ambient light
  var lighting = scene.ambientColor * scene.ambientIntensity;

  // Add contribution from all lights
  let totalLights = lightCounts.w;
  for (var i = 0u; i < totalLights; i = i + 1u) {
    let light = lights[i];

    if (light.lightType == LIGHT_TYPE_DIRECTIONAL) {
      lighting += calculateDirectionalLight(light, normal, viewDir);
    } else if (light.lightType == LIGHT_TYPE_POINT) {
      lighting += calculatePointLight(light, input.worldPosition, normal, viewDir);
    } else if (light.lightType == LIGHT_TYPE_SPOT) {
      lighting += calculateSpotLight(light, input.worldPosition, normal, viewDir);
    }
    // LIGHT_TYPE_AMBIENT is handled by scene.ambientColor above
  }

  // Apply base color and clamp
  let finalColor = object.baseColor.rgb * lighting;
  return vec4<f32>(clamp(finalColor, vec3<f32>(0.0), vec3<f32>(1.0)), object.baseColor.a);
}
