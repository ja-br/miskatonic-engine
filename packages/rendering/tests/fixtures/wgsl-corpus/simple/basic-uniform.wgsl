// Basic uniform buffer test
@group(0) @binding(0) var<uniform> data: vec4f;

@vertex
fn vs_main(@location(0) position: vec3f) -> @builtin(position) vec4f {
  return vec4f(position, 1.0) + data;
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return vec4f(1.0, 0.0, 0.0, 1.0);
}
