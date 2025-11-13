// Multiple bind groups test
@group(0) @binding(0) var<uniform> scene: vec4f;
@group(1) @binding(0) var<uniform> object: mat4x4f;
@group(2) @binding(0) var<uniform> material: vec4f;

@vertex
fn vs_main(@location(0) position: vec3f) -> @builtin(position) vec4f {
  return object * vec4f(position, 1.0) + scene;
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return material;
}
