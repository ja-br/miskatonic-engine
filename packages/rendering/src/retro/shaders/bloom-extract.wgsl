// Retro bloom extract - extract bright pixels above threshold
// Downsample to quarter resolution for performance

@group(0) @binding(0) var sceneTexture: texture_2d<f32>;
@group(0) @binding(1) var sceneSampler: sampler;

struct BloomParams {
  threshold: f32,
  _padding: vec3<f32>,
}

@group(1) @binding(0) var<uniform> params: BloomParams;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  // Full-screen triangle
  var uv = vec2<f32>(
    f32((vertexIndex << 1u) & 2u),
    f32(vertexIndex & 2u)
  );
  var out: VertexOutput;
  out.position = vec4<f32>(uv * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2<f32>(uv.x, 1.0 - uv.y);  // Flip Y for WebGPU framebuffer texture sampling
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let color = textureSample(sceneTexture, sceneSampler, in.uv).rgb;

  // Luminance
  let luma = dot(color, vec3<f32>(0.299, 0.587, 0.114));

  // Extract only pixels above threshold
  if (luma > params.threshold) {
    return vec4<f32>(color, 1.0);
  } else {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }
}
