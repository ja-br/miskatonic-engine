// Retro emissive shader - self-illuminated materials
// For glowing objects, neon signs, light sources

struct Camera {
  viewProj: mat4x4<f32>,
  position: vec3<f32>,
  _padding: f32,
}

struct Material {
  emissiveColor: vec4<f32>,
  emissiveIntensity: f32,
  _padding: vec3<f32>,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var emissiveTexture: texture_2d<f32>;
@group(1) @binding(1) var emissiveSampler: sampler;
@group(1) @binding(2) var<uniform> material: Material;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = camera.viewProj * vec4<f32>(in.position, 1.0);
  out.uv = in.uv;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let texColor = textureSample(emissiveTexture, emissiveSampler, in.uv);
  let emissive = texColor.rgb * material.emissiveColor.rgb * material.emissiveIntensity;
  return vec4<f32>(emissive, texColor.a * material.emissiveColor.a);
}
