// Unknown type
@group(0) @binding(0) var<uniform> data: InvalidType;

@vertex
fn vs_main() -> @builtin(position) vec4f {
  return vec4f(0.0);
}
