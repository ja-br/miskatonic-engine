/**
 * WGSL Shaders for standalone Discord Model Viewer
 * Ported from packages/rendering/src/retro/shaders/
 */

export const simpleLambertShader = `
// Retro Lambert shader - VERTEX lighting only (PS1/PS2 style)
// All lighting calculations done per-vertex, interpolated to fragments

struct Camera {
  viewProj: mat4x4<f32>,
  position: vec3<f32>,
  _padding: f32,
}

struct Light {
  position: vec3<f32>,
  type_: u32,           // 0 = directional, 1 = point
  color: vec3<f32>,
  intensity: f32,
  direction: vec3<f32>,
  range: f32,
}

struct Material {
  albedo: vec4<f32>,
  _padding: vec4<f32>,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var baseTexture: texture_2d<f32>;
@group(1) @binding(1) var baseSampler: sampler;
@group(1) @binding(2) var<uniform> material: Material;
@group(2) @binding(0) var<storage, read> lights: array<Light>;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) color: vec4<f32>,   // Vertex-painted ambient
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) lightColor: vec3<f32>,  // Pre-computed in vertex shader
}

// Simple Lambert diffuse lighting (computed per-vertex)
fn computeLambert(worldPos: vec3<f32>, normal: vec3<f32>) -> vec3<f32> {
  var lightAccum = vec3<f32>(0.0, 0.0, 0.0);

  let numLights = arrayLength(&lights);
  for (var i = 0u; i < numLights; i = i + 1u) {
    let light = lights[i];
    var lightDir: vec3<f32>;
    var attenuation = 1.0;

    if (light.type_ == 0u) {
      // Directional light
      lightDir = normalize(-light.direction);
    } else {
      // Point light
      let toLight = light.position - worldPos;
      let distance = length(toLight);
      lightDir = normalize(toLight);

      // Simple distance attenuation
      attenuation = max(0.0, 1.0 - (distance / light.range));
      attenuation = attenuation * attenuation;
    }

    // Simple Lambert: N dot L
    let NdotL = max(0.0, dot(normal, lightDir));
    lightAccum = lightAccum + light.color * light.intensity * NdotL * attenuation;
  }

  return lightAccum;
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  // Transform position
  out.position = camera.viewProj * vec4<f32>(in.position, 1.0);
  out.uv = in.uv;

  // Compute vertex lighting (PS1/PS2 style)
  let diffuseLight = computeLambert(in.position, in.normal);

  // Combine with vertex-painted ambient color
  out.lightColor = diffuseLight + in.color.rgb;

  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  // Sample texture
  let texColor = textureSample(baseTexture, baseSampler, in.uv);

  // Alpha cutout - discard transparent pixels (typical for hair, foliage, effects)
  // Use low threshold (0.1) to preserve soft edges in effect textures
  if (texColor.a < 0.1) {
    discard;
  }

  // Apply pre-computed vertex lighting
  let finalColor = texColor.rgb * material.albedo.rgb * in.lightColor;

  return vec4<f32>(finalColor, texColor.a * material.albedo.a);
}
`;

// Bloom extract shader - extract bright pixels
export const bloomExtractShader = `
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
  let color = textureSample(sceneTexture, sceneSampler, in.uv).rgb;
  let luma = dot(color, vec3<f32>(0.299, 0.587, 0.114));

  if (luma > params.threshold) {
    return vec4<f32>(color, 1.0);
  } else {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }
}
`;

// Bloom downsample shader - 13-tap filter for mip pyramid
export const bloomDownsampleShader = `
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct DownsampleParams {
  texelSize: vec2<f32>,
  _padding: vec2<f32>,
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
`;

// Bloom upsample shader - 3x3 tent filter for progressive upsampling
export const bloomUpsampleShader = `
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct UpsampleParams {
  texelSize: vec2<f32>,
  blendFactor: f32,
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
`;

// Composite shader - combine scene + bloom + LUT + gamma + grain
// CRITICAL: 4 bind groups (scene, bloom, LUT, params)
export const compositeShader = `
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
  ditherPattern: u32,
  time: f32,
  _padding: vec3<f32>,
}

@group(3) @binding(0) var<uniform> params: PostParams;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

fn hash(p: vec2<f32>) -> f32 {
  let p3 = fract(vec3<f32>(p.xyx) * 0.1031);
  let dot_product = dot(p3, vec3<f32>(p3.yzx) + 33.33);
  return fract((p3.x + p3.y) * dot_product);
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
  // Sample scene
  var color = textureSample(sceneTexture, sceneSampler, in.uv).rgb;

  // Add bloom (additive)
  let bloom = textureSample(bloomTexture, bloomSampler, in.uv).rgb;
  color = color + bloom * params.bloomIntensity;

  // Gamma correction
  color = pow(color, vec3<f32>(1.0 / params.gamma));

  // Film grain
  let noise = hash(in.position.xy + params.time);
  color = color + (noise - 0.5) * params.grainAmount;

  // Clamp to [0, 1]
  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));

  return vec4<f32>(color, 1.0);
}
`;

// CRT shader - full CRT-Yah effect
export const crtShader = `
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct CRTParams {
  resolution: vec2<f32>,
  sourceSize: vec2<f32>,
  masterIntensity: f32,
  brightness: f32,
  contrast: f32,
  saturation: f32,
  scanlinesStrength: f32,
  beamWidthMin: f32,
  beamWidthMax: f32,
  beamShape: f32,
  maskIntensity: f32,
  maskType: f32,
  curvatureAmount: f32,
  vignetteAmount: f32,
  cornerRadius: f32,
  colorOverflow: f32,
  _padding: vec2<f32>,
}

@group(1) @binding(0) var<uniform> params: CRTParams;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

const EPSILON: f32 = 0.0001;
const PI: f32 = 3.14159265359;
const GAMMA: f32 = 2.4;
const INV_GAMMA: f32 = 1.0 / 2.4;

fn get_luminance(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn decode_gamma(color: vec3<f32>) -> vec3<f32> {
  return pow(color, vec3<f32>(GAMMA));
}

fn encode_gamma(color: vec3<f32>) -> vec3<f32> {
  return pow(color, vec3<f32>(INV_GAMMA));
}

fn apply_cubic_lens_distortion(uv: vec2<f32>) -> vec2<f32> {
  let amount = params.curvatureAmount;
  if (amount <= 0.0) { return uv; }

  var coord = uv - 0.5;
  let c = coord.x * coord.x + coord.y * coord.y;
  let f = 1.0 + c * (amount * sqrt(c));
  let fit = 1.0 + amount * 0.125;
  coord *= f / fit;
  return coord + 0.5;
}

fn get_vignette_factor(uv: vec2<f32>) -> f32 {
  let amount = params.vignetteAmount;
  if (amount <= 0.0) { return 1.0; }

  let centered = uv - 0.5;
  let radius = 1.0 - (amount * 0.25);
  let length_val = length(centered);
  let blur = (amount * 0.125) + 0.375;
  return clamp(smoothstep(radius, radius - blur, length_val), 0.0, 1.0);
}

fn get_round_corner_factor(uv: vec2<f32>) -> f32 {
  if (params.cornerRadius <= 0.0) { return 1.0; }

  let centered = abs(uv - 0.5) * 2.0;
  let aspect = params.resolution.x / params.resolution.y;
  let size = vec2<f32>(aspect, 1.0);
  let radius = params.cornerRadius * 2.0;
  let d = length(max(centered - size + radius, vec2<f32>(0.0))) - radius;
  let smoothness = params.cornerRadius * 0.5 + 0.01;
  return 1.0 - smoothstep(-smoothness, 0.0, d);
}

fn get_beam_width(color: vec3<f32>) -> vec3<f32> {
  return mix(vec3<f32>(params.beamWidthMin), vec3<f32>(params.beamWidthMax), color);
}

fn get_scanline_factor(color: vec3<f32>, position: f32) -> vec3<f32> {
  let strength = params.scanlinesStrength;
  if (strength <= 0.0) { return vec3<f32>(1.0); }

  let width = get_beam_width(color);
  let slope = mix(6.0, 2.0, params.beamShape);
  let factor = position / (width + EPSILON);
  return exp(-10.0 * strength * pow(factor, vec3<f32>(slope)));
}

fn get_scanlines_color(uv: vec2<f32>) -> vec3<f32> {
  let texSize = params.sourceSize;
  let pixCoord = uv * texSize + vec2<f32>(0.5);
  let pixFract = fract(pixCoord);

  let texCoord0 = floor(pixCoord) / texSize;
  let color0 = decode_gamma(textureSampleLevel(inputTexture, inputSampler, texCoord0, 0.0).rgb);

  let texCoord1 = (floor(pixCoord) + vec2<f32>(0.0, 1.0)) / texSize;
  let color1 = decode_gamma(textureSampleLevel(inputTexture, inputSampler, texCoord1, 0.0).rgb);

  let factor0 = get_scanline_factor(color0, pixFract.y);
  let factor1 = get_scanline_factor(color1, 1.0 - pixFract.y);

  return color0 * factor0 + color1 * factor1;
}

fn get_raw_color(uv: vec2<f32>) -> vec3<f32> {
  return decode_gamma(textureSampleLevel(inputTexture, inputSampler, uv, 0.0).rgb);
}

fn get_aperture_grille_mask(screenPos: vec2<f32>) -> vec3<f32> {
  let subpixel = fract(screenPos.x * 3.0);
  let r = smoothstep(0.0, 0.15, subpixel) * smoothstep(0.33, 0.18, subpixel);
  let g = smoothstep(0.33, 0.48, subpixel) * smoothstep(0.66, 0.51, subpixel);
  let b = smoothstep(0.66, 0.81, subpixel) * smoothstep(1.0, 0.85, subpixel);
  return vec3<f32>(r, g, b);
}

fn apply_mask(color: vec3<f32>, colorLuma: f32, uv: vec2<f32>) -> vec3<f32> {
  if (params.maskIntensity <= 0.0) { return color; }

  let screenPos = uv * params.resolution;
  var mask = get_aperture_grille_mask(screenPos);

  mask = mix(mask, mask + colorLuma * 0.5, 1.0);
  var maskAdd = mask + (1.0 - params.maskIntensity) * 0.5;
  maskAdd = clamp(maskAdd, vec3<f32>(0.0), vec3<f32>(1.0));
  maskAdd += params.maskIntensity * 0.5;
  mask = mix(mask, maskAdd, 1.0);

  return mix(color, color * mask, params.maskIntensity);
}

fn apply_color_overflow(color: vec3<f32>) -> vec3<f32> {
  if (params.colorOverflow <= 0.0) { return color; }

  let overflow = color * params.colorOverflow;
  var result = color;
  let strong = 0.35 * overflow;
  let medium = 0.20 * overflow;
  let weak = 0.10 * overflow;

  result.r += strong.g + weak.b;
  result.g += medium.r + medium.b;
  result.b += weak.r + medium.g;

  return result;
}

fn apply_color_adjustments(color: vec3<f32>) -> vec3<f32> {
  var result = color;
  result = mix(vec3<f32>(0.5), result, 1.0 + params.contrast);
  result = result + vec3<f32>(params.brightness);
  let luma = get_luminance(result);
  result = mix(vec3<f32>(luma), result, params.saturation);
  return clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));
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
  let curvedUV = apply_cubic_lens_distortion(in.uv);

  if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }

  let rawColor = get_raw_color(curvedUV);
  let scanlinesColor = get_scanlines_color(curvedUV);

  let strength = params.scanlinesStrength;
  let merge_limit = min(1.0, strength * 8.0);
  var color = mix(rawColor, scanlinesColor, merge_limit);

  let colorLuma = get_luminance(color);
  color = apply_mask(color, colorLuma, in.uv);
  color = apply_color_overflow(color);
  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
  color = apply_color_adjustments(color);
  color *= get_vignette_factor(curvedUV);
  color *= get_round_corner_factor(curvedUV);
  color = encode_gamma(color);

  let master = params.masterIntensity;
  if (master < 1.0) {
    let raw = textureSampleLevel(inputTexture, inputSampler, curvedUV, 0.0).rgb;
    color = mix(raw, color, master);
  } else if (master > 1.0) {
    color = color * master;
  }

  return vec4<f32>(color, 1.0);
}
`;
