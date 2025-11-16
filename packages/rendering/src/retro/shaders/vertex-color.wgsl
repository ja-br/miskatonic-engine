// Retro vertex color shader - PS1/PS2 style per-vertex colors only
// No textures, no per-pixel lighting

struct Camera {
  viewProj: mat4x4<f32>,
  position: vec3<f32>,
  _padding: f32,
}

@group(0) @binding(0) var<uniform> camera: Camera;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) color: vec4<f32>,      // Per-vertex color
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = camera.viewProj * vec4<f32>(in.position, 1.0);
  out.color = in.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  return in.color;
}
