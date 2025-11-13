// Multiple entry points in same file
@group(0) @binding(0) var<uniform> transform: mat4x4f;

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(@location(0) position: vec3f, @location(1) color: vec4f) -> VSOutput {
  var output: VSOutput;
  output.position = transform * vec4f(position, 1.0);
  output.color = color;
  return output;
}

@fragment
fn fs_main(input: VSOutput) -> @location(0) vec4f {
  return input.color;
}

@fragment
fn fs_grayscale(input: VSOutput) -> @location(0) vec4f {
  let gray = dot(input.color.rgb, vec3f(0.299, 0.587, 0.114));
  return vec4f(gray, gray, gray, input.color.a);
}
