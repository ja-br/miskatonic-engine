// Retro composite shader - final post-processing
// Combines bloom, tonemapping, color LUT, dithering, grain

@group(0) @binding(0) var sceneTexture: texture_2d<f32>;
@group(0) @binding(1) var sceneSampler: sampler;
@group(1) @binding(0) var bloomTexture: texture_2d<f32>;
@group(1) @binding(1) var bloomSampler: sampler;
@group(2) @binding(0) var colorLUT: texture_2d<f32>;
@group(2) @binding(1) var lutSampler: sampler;

struct PostParams {
  bloomIntensity: f32,
  grainAmount: f32,
  gamma: f32,
  ditherPattern: u32,  // 0 = 4x4 Bayer, 1 = 8x8 Bayer
  time: f32,
  _padding: vec3<f32>,
}

@group(3) @binding(0) var<uniform> params: PostParams;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

// 4x4 Bayer matrix
const bayer4 = array<f32, 16>(
  0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
  12.0/16.0, 4.0/16.0, 14.0/16.0,  6.0/16.0,
  3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
  15.0/16.0, 7.0/16.0, 13.0/16.0,  5.0/16.0
);

// Simple noise function
fn hash(p: vec2<f32>) -> f32 {
  let p3 = fract(vec3<f32>(p.xyx) * 0.1031);
  let dot_product = dot(p3, vec3<f32>(p3.yzx) + 33.33);
  return fract((p3.x + p3.y) * dot_product);
}

// Apply color LUT (256x16 texture)
fn applyColorLUT(color: vec3<f32>) -> vec3<f32> {
  let lutSize = vec2<f32>(256.0, 16.0);

  // Map RGB to LUT coordinates
  let blue = floor(color.b * 15.0);
  let blueFloor = blue / 15.0;
  let blueFrac = fract(color.b * 15.0);

  let x1 = (blue * 16.0 + color.r * 15.0) / lutSize.x;
  let x2 = ((blue + 1.0) * 16.0 + color.r * 15.0) / lutSize.x;
  let y = color.g;

  let lut1 = textureSample(colorLUT, lutSampler, vec2<f32>(x1, y)).rgb;
  let lut2 = textureSample(colorLUT, lutSampler, vec2<f32>(x2, y)).rgb;

  return mix(lut1, lut2, blueFrac);
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
  // Sample scene
  var color = textureSample(sceneTexture, sceneSampler, in.uv).rgb;

  // Add bloom (additive)
  let bloom = textureSample(bloomTexture, bloomSampler, in.uv).rgb;
  color = color + bloom * params.bloomIntensity;

  // Gamma correction (simple tonemapping)
  color = pow(color, vec3<f32>(1.0 / params.gamma));

  // Color LUT
  color = applyColorLUT(color);

  // Ordered dithering (Bayer 4x4)
  let screenPos = vec2<u32>(in.position.xy);
  let bayerIndex = (screenPos.y % 4u) * 4u + (screenPos.x % 4u);
  let ditherValue = bayer4[bayerIndex];

  // Apply dithering to reduce color banding
  color = color + (ditherValue - 0.5) / 255.0;

  // Film grain
  let noise = hash(in.position.xy + params.time);
  color = color + (noise - 0.5) * params.grainAmount;

  // Clamp to [0, 1]
  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));

  return vec4<f32>(color, 1.0);
}
