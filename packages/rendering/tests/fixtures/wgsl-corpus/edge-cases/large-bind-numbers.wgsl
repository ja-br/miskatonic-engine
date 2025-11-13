// Large group/binding numbers
@group(3) @binding(15) var<uniform> data1: vec4f;
@group(2) @binding(10) var<uniform> data2: vec4f;

@vertex
fn vs_main(@location(0) position: vec3f) -> @builtin(position) vec4f {
  return vec4f(position, 1.0);
}
