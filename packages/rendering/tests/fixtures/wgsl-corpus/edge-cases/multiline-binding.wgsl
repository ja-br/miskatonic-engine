// Multiline binding declaration
@group(0)
@binding(0)
var<uniform> data: vec4f;

@vertex
fn vs_main(@location(0) position: vec3f) -> @builtin(position) vec4f {
  return vec4f(position, 1.0);
}
