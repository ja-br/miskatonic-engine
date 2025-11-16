// Retro bloom blur - simple Gaussian blur
// Separable filter (run twice: horizontal then vertical)

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct BlurParams {
  direction: vec2<f32>,  // (1,0) for horizontal, (0,1) for vertical
  _padding: vec2<f32>,
}

@group(1) @binding(0) var<uniform> params: BlurParams;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var uv = vec2<f32>(
    f32((vertexIndex << 1u) & 2u),
    f32(vertexIndex & 2u)
  );
  var out: VertexOutput;
  out.position = vec4<f32>(uv * 2.0 - 1.0, 0.0, 1.0);
  out.uv = uv;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let texSize = textureDimensions(inputTexture);
  let texelSize = 1.0 / vec2<f32>(texSize);

  // Simple 5-tap Gaussian weights
  let weights = array<f32, 5>(0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

  var result = textureSample(inputTexture, inputSampler, in.uv).rgb * weights[0];

  // Sample in both directions
  for (var i = 1; i < 5; i = i + 1) {
    let offset = vec2<f32>(f32(i), f32(i)) * texelSize * params.direction;
    result = result + textureSample(inputTexture, inputSampler, in.uv + offset).rgb * weights[i];
    result = result + textureSample(inputTexture, inputSampler, in.uv - offset).rgb * weights[i];
  }

  return vec4<f32>(result, 1.0);
}
