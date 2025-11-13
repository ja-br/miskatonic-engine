/**
 * Built-in WGSL shaders for high-level rendering API
 * Epic 3.14: High-Level Rendering API Wrapper
 *
 * All shaders follow standard bind group layout:
 * - Group 0, Binding 0: Scene uniforms (view, projection matrices)
 * - Group 1, Binding 0+: Material uniforms and textures
 */

/**
 * Unlit shader - Flat color (no lighting)
 * Simple solid color material
 */
export const UNLIT_SHADER = /* wgsl */ `
struct SceneUniforms {
  viewMatrix: mat4x4f,
  projectionMatrix: mat4x4f,
};

struct MaterialUniforms {
  color: vec4f,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(1) @binding(0) var<uniform> material: MaterialUniforms;

struct VertexInput {
  @location(0) position: vec3f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let worldPos = vec4f(in.position, 1.0);
  out.position = scene.projectionMatrix * scene.viewMatrix * worldPos;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return material.color;
}
`;

/**
 * Textured shader - Textured with simple directional lighting
 * Samples texture and applies basic diffuse lighting
 */
export const TEXTURED_SHADER = /* wgsl */ `
struct SceneUniforms {
  viewMatrix: mat4x4f,
  projectionMatrix: mat4x4f,
  lightDirection: vec3f,
  _pad: f32,
};

struct MaterialUniforms {
  tint: vec4f,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(1) @binding(0) var<uniform> material: MaterialUniforms;
@group(1) @binding(1) var colorTexture: texture_2d<f32>;
@group(1) @binding(2) var colorSampler: sampler;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) uv: vec2f,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let worldPos = vec4f(in.position, 1.0);
  out.position = scene.projectionMatrix * scene.viewMatrix * worldPos;
  out.normal = in.normal;
  out.uv = in.uv;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  let texColor = textureSample(colorTexture, colorSampler, in.uv);
  let lighting = max(dot(normalize(in.normal), -scene.lightDirection), 0.2);
  return vec4f(texColor.rgb * material.tint.rgb * lighting, texColor.a * material.tint.a);
}
`;

/**
 * PBR shader - Physically-Based Rendering with metallic/roughness workflow
 * Implements Cook-Torrance BRDF with image-based lighting
 */
export const PBR_SHADER = /* wgsl */ `
struct SceneUniforms {
  viewMatrix: mat4x4f,
  projectionMatrix: mat4x4f,
  cameraPosition: vec3f,
  _pad0: f32,
  lightDirection: vec3f,
  _pad1: f32,
  lightColor: vec3f,
  _pad2: f32,
};

struct MaterialUniforms {
  albedo: vec3f,
  metallic: f32,
  roughness: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(1) @binding(0) var<uniform> material: MaterialUniforms;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
};

const PI: f32 = 3.14159265359;

// Fresnel-Schlick approximation
fn fresnelSchlick(cosTheta: f32, F0: vec3f) -> vec3f {
  return F0 + (vec3f(1.0) - F0) * pow(1.0 - cosTheta, 5.0);
}

// GGX Normal Distribution Function
fn distributionGGX(N: vec3f, H: vec3f, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let NdotH = max(dot(N, H), 0.0);
  let NdotH2 = NdotH * NdotH;

  let num = a2;
  var denom = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = PI * denom * denom;

  return num / denom;
}

// Smith's Geometry function
fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
  let r = (roughness + 1.0);
  let k = (r * r) / 8.0;

  let num = NdotV;
  let denom = NdotV * (1.0 - k) + k;

  return num / denom;
}

fn geometrySmith(N: vec3f, V: vec3f, L: vec3f, roughness: f32) -> f32 {
  let NdotV = max(dot(N, V), 0.0);
  let NdotL = max(dot(N, L), 0.0);
  let ggx2 = geometrySchlickGGX(NdotV, roughness);
  let ggx1 = geometrySchlickGGX(NdotL, roughness);

  return ggx1 * ggx2;
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let worldPos = vec4f(in.position, 1.0);
  out.position = scene.projectionMatrix * scene.viewMatrix * worldPos;
  out.worldPos = in.position;
  out.normal = in.normal;
  out.uv = in.uv;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  let N = normalize(in.normal);
  let V = normalize(scene.cameraPosition - in.worldPos);
  let L = normalize(-scene.lightDirection);
  let H = normalize(V + L);

  // Calculate reflectance at normal incidence
  var F0 = vec3f(0.04);
  F0 = mix(F0, material.albedo, material.metallic);

  // Cook-Torrance BRDF
  let NDF = distributionGGX(N, H, material.roughness);
  let G = geometrySmith(N, V, L, material.roughness);
  let F = fresnelSchlick(max(dot(H, V), 0.0), F0);

  let numerator = NDF * G * F;
  let denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
  let specular = numerator / denominator;

  // Diffuse component
  let kS = F;
  var kD = vec3f(1.0) - kS;
  kD = kD * (1.0 - material.metallic);

  let NdotL = max(dot(N, L), 0.0);
  let radiance = scene.lightColor;

  let diffuse = kD * material.albedo / PI;
  let Lo = (diffuse + specular) * radiance * NdotL;

  // Ambient lighting
  let ambient = vec3f(0.03) * material.albedo;
  let color = ambient + Lo;

  // HDR tonemapping
  let mapped = color / (color + vec3f(1.0));
  // Gamma correction
  let gammaCorrected = pow(mapped, vec3f(1.0 / 2.2));

  return vec4f(gammaCorrected, 1.0);
}
`;

/**
 * Toon/cel-shaded shader
 * Creates cartoon-style stepped shading
 */
export const TOON_SHADER = /* wgsl */ `
struct SceneUniforms {
  viewMatrix: mat4x4f,
  projectionMatrix: mat4x4f,
  lightDirection: vec3f,
  _pad: f32,
};

struct MaterialUniforms {
  color: vec3f,
  bands: f32,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(1) @binding(0) var<uniform> material: MaterialUniforms;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let worldPos = vec4f(in.position, 1.0);
  out.position = scene.projectionMatrix * scene.viewMatrix * worldPos;
  out.normal = in.normal;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  let N = normalize(in.normal);
  let L = normalize(-scene.lightDirection);
  let NdotL = max(dot(N, L), 0.0);

  // Quantize lighting to discrete bands
  let bands = max(material.bands, 1.0);
  let lighting = floor(NdotL * bands) / bands;

  // Add slight ambient
  let finalLighting = lighting * 0.8 + 0.2;

  return vec4f(material.color * finalLighting, 1.0);
}
`;

/**
 * Transparent shader - Alpha blending support
 * Samples texture and applies opacity
 */
export const TRANSPARENT_SHADER = /* wgsl */ `
struct SceneUniforms {
  viewMatrix: mat4x4f,
  projectionMatrix: mat4x4f,
};

struct MaterialUniforms {
  opacity: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(1) @binding(0) var<uniform> material: MaterialUniforms;
@group(1) @binding(1) var colorTexture: texture_2d<f32>;
@group(1) @binding(2) var colorSampler: sampler;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let worldPos = vec4f(in.position, 1.0);
  out.position = scene.projectionMatrix * scene.viewMatrix * worldPos;
  out.uv = in.uv;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  let texColor = textureSample(colorTexture, colorSampler, in.uv);
  return vec4f(texColor.rgb, texColor.a * material.opacity);
}
`;

/**
 * Get map of all built-in shaders
 * Keys are shader names, values are WGSL source code
 */
export function getAllBuiltinShaders(): Map<string, string> {
  return new Map([
    ['unlit', UNLIT_SHADER],
    ['textured', TEXTURED_SHADER],
    ['pbr', PBR_SHADER],
    ['toon', TOON_SHADER],
    ['transparent', TRANSPARENT_SHADER],
  ]);
}
