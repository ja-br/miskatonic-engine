// Bloom upsample shader with 3x3 tent filter and additive blending
// Based on LearnOpenGL / wgpu-bloom algorithm
// Progressively upsamples and blends bloom mip levels

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct UpsampleParams {
  texelSize: vec2<f32>,
  blendFactor: f32,  // How much to blend with higher mip (0.0-1.0)
  _padding: f32,
}

@group(1) @binding(0) var<uniform> params: UpsampleParams;

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
  out.uv = vec2<f32>(uv.x, 1.0 - uv.y);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  // 3x3 tent filter (9 samples with bilinear interpolation)
  // Sample pattern:
  //   a b c
  //   d e f
  //   g h i
  // Weights form a tent/pyramid: center=4, sides=2, corners=1

  let d = params.texelSize;

  // Center sample (weight 4)
  var result = textureSample(inputTexture, inputSampler, in.uv).rgb * 4.0;

  // Cross samples (weight 2 each)
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(0.0, d.y)).rgb * 2.0;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(0.0, -d.y)).rgb * 2.0;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(d.x, 0.0)).rgb * 2.0;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(-d.x, 0.0)).rgb * 2.0;

  // Corner samples (weight 1 each)
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(d.x, d.y)).rgb;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(-d.x, d.y)).rgb;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(d.x, -d.y)).rgb;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(-d.x, -d.y)).rgb;

  // Normalize (total weight = 16)
  result = result / 16.0;

  // Apply blend factor for progressive upsampling
  result = result * params.blendFactor;

  return vec4<f32>(result, 1.0);
}
