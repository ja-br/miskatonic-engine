// Retro unlit shader - bypass all lighting calculations
// For UI, emissive objects, special effects

struct Camera {
  viewProj: mat4x4<f32>,
  position: vec3<f32>,
  _padding: f32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var baseTexture: texture_2d<f32>;
@group(1) @binding(1) var baseSampler: sampler;

struct Material {
  color: vec4<f32>,
  _padding: vec4<f32>,
}

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
  // Sample texture with point or bilinear filtering (set via sampler)
  let texColor = textureSample(baseTexture, baseSampler, in.uv);
  return texColor * material.color;
}
