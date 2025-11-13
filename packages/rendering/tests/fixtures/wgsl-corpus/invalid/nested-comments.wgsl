/* Nested /* comments */ are valid in WGSL */
@group(0) @binding(0) var<uniform> data: vec4f;

@vertex
fn vs_main() -> @builtin(position) vec4f {
  return vec4f(0.0);
}
