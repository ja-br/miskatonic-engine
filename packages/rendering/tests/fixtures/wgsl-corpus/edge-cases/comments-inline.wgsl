// Inline comments test
@group(0) // comment after decorator
@binding(0) /* block comment */ var<uniform> data: vec4f;

@vertex
fn vs_main(@location(0) position: vec3f) -> @builtin(position) vec4f {
  // Line comment
  return vec4f(position, 1.0);
}
