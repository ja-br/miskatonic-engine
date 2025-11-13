// Complex PBR material with multiple textures
struct Material {
  albedo: vec4f,
  metallic: f32,
  roughness: f32,
  ao: f32,
  _padding: f32,
}

@group(0) @binding(0) var<uniform> material: Material;
@group(0) @binding(1) var albedoTexture: texture_2d<f32>;
@group(0) @binding(2) var normalTexture: texture_2d<f32>;
@group(0) @binding(3) var metallicRoughnessTexture: texture_2d<f32>;
@group(0) @binding(4) var aoTexture: texture_2d<f32>;
@group(0) @binding(5) var textureSampler: sampler;

@group(1) @binding(0) var<uniform> viewProjection: mat4x4f;
@group(2) @binding(0) var<storage, read> lightData: array<vec4f>;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) tangent: vec4f,
  @location(3) uv: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) tangent: vec3f,
  @location(3) bitangent: vec3f,
  @location(4) uv: vec2f,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = viewProjection * vec4f(input.position, 1.0);
  output.worldPos = input.position;
  output.normal = input.normal;
  output.tangent = input.tangent.xyz;
  output.bitangent = cross(input.normal, input.tangent.xyz) * input.tangent.w;
  output.uv = input.uv;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let albedo = textureSample(albedoTexture, textureSampler, input.uv);
  let normal = textureSample(normalTexture, textureSampler, input.uv);
  let metallicRoughness = textureSample(metallicRoughnessTexture, textureSampler, input.uv);
  let ao = textureSample(aoTexture, textureSampler, input.uv).r;

  return albedo * vec4f(ao, ao, ao, 1.0);
}
