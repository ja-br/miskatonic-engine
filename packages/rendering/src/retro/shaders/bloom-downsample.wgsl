// Bloom downsample shader with 13-tap filter
// Based on LearnOpenGL / wgpu-bloom algorithm
// Uses bilinear filtering to achieve 36 effective samples

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct DownsampleParams {
  texelSize: vec2<f32>,
  _padding: vec2<f32>,  // Maintain 16-byte alignment
}

@group(1) @binding(0) var<uniform> params: DownsampleParams;

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
  // 13-tap downsample with bilinear interpolation
  // Sample pattern (x = center, o = samples):
  //   o   o   o
  //     o o o
  //   o o x o o
  //     o o o
  //   o   o   o

  let d = params.texelSize;

  // Center sample
  var result = textureSample(inputTexture, inputSampler, in.uv).rgb * 0.125;

  // Inner cross (4 samples, weight 0.125 each)
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(-d.x, 0.0)).rgb * 0.125;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(d.x, 0.0)).rgb * 0.125;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(0.0, -d.y)).rgb * 0.125;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(0.0, d.y)).rgb * 0.125;

  // Inner diagonal (4 samples, weight 0.0625 each)
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(-d.x, -d.y)).rgb * 0.0625;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(d.x, -d.y)).rgb * 0.0625;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(-d.x, d.y)).rgb * 0.0625;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(d.x, d.y)).rgb * 0.0625;

  // Outer cross (4 samples, weight 0.03125 each)
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(-2.0 * d.x, 0.0)).rgb * 0.03125;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(2.0 * d.x, 0.0)).rgb * 0.03125;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(0.0, -2.0 * d.y)).rgb * 0.03125;
  result += textureSample(inputTexture, inputSampler, in.uv + vec2<f32>(0.0, 2.0 * d.y)).rgb * 0.03125;

  return vec4<f32>(result, 1.0);
}
