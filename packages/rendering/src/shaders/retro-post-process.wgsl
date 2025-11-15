/**
 * Retro Post-Processing Shader
 * Epic 3.4: Retro Rendering Pipeline - Post-Processing Effects
 *
 * PlayStation 2 era post-processing using WGSL
 * All effects use period-appropriate techniques (no modern AAA features)
 */

// ============================================================================
// Bind Groups
// ============================================================================

// Group 0: Input textures and samplers
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var bloomTexture: texture_2d<f32>;
@group(0) @binding(3) var bloomSampler: sampler;
@group(0) @binding(4) var ditherTexture: texture_2d<f32>;
@group(0) @binding(5) var grainTexture: texture_2d<f32>;

// Group 1: Parameters
struct PostProcessParams {
  // Bloom (vec4 for alignment)
  bloomIntensity: f32,
  bloomThreshold: f32,
  bloomPadding1: f32,
  bloomPadding2: f32,

  // Tone mapping
  toneMappingMode: f32,  // 0 = clamp, 1 = reinhard
  exposure: f32,
  toneMappingPadding1: f32,
  toneMappingPadding2: f32,

  // Dither
  ditherPatternSize: f32,
  ditherStrength: f32,
  ditherPadding1: f32,
  ditherPadding2: f32,

  // Grain
  grainIntensity: f32,
  grainSize: f32,
  time: f32,
  grainPadding: f32,

  // Screen resolution
  resolution: vec2<f32>,
  resolutionPadding: vec2<f32>,
}

@group(1) @binding(0) var<uniform> params: PostProcessParams;

// ============================================================================
// Vertex Shader (Fullscreen Quad)
// ============================================================================

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;

  // Generate fullscreen quad from vertex index
  // 0: (-1, -1), 1: (3, -1), 2: (-1, 3)
  // This covers the entire NDC space with a single triangle
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);

  output.position = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  output.uv = vec2<f32>(x, y);

  return output;
}

// ============================================================================
// Bloom Extraction Fragment Shader
// ============================================================================

@fragment
fn fs_bloom_extract(input: VertexOutput) -> @location(0) vec4<f32> {
  let color = textureSample(inputTexture, inputSampler, input.uv);

  // Calculate luminance (simple dot product)
  let luminance = dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));

  // Threshold: only bright pixels contribute to bloom
  if (luminance > params.bloomThreshold) {
    return vec4<f32>(color.rgb, 1.0);
  } else {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }
}

// ============================================================================
// Simple Box Blur (PS2-era technique)
// ============================================================================

@fragment
fn fs_bloom_blur(input: VertexOutput) -> @location(0) vec4<f32> {
  let texelSize = 1.0 / params.resolution;

  // 3x3 box blur (9 samples)
  var color = vec3<f32>(0.0);

  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let offset = vec2<f32>(f32(x), f32(y)) * texelSize;
      color += textureSample(inputTexture, inputSampler, input.uv + offset).rgb;
    }
  }

  // Average (divide by 9)
  color /= 9.0;

  return vec4<f32>(color, 1.0);
}

// ============================================================================
// Tone Mapping Functions
// ============================================================================

fn reinhardToneMapping(color: vec3<f32>, exposure: f32) -> vec3<f32> {
  let exposedColor = color * exposure;
  return exposedColor / (vec3<f32>(1.0) + exposedColor);
}

fn clampToneMapping(color: vec3<f32>, exposure: f32) -> vec3<f32> {
  return clamp(color * exposure, vec3<f32>(0.0), vec3<f32>(1.0));
}

// ============================================================================
// Ordered Dithering (Bayer Matrix)
// ============================================================================

fn applyDither(color: vec3<f32>, screenPos: vec2<f32>, strength: f32) -> vec3<f32> {
  // Sample Bayer pattern (tiled across screen)
  let ditherCoord = fract(screenPos / params.ditherPatternSize);
  let ditherValue = textureSample(ditherTexture, inputSampler, ditherCoord).r;

  // Map dither value from [0, 1] to [-0.5, 0.5]
  let ditherOffset = (ditherValue - 0.5) * strength;

  // Apply dither to each color channel
  // This creates the characteristic PS2-era banding look
  return color + vec3<f32>(ditherOffset);
}

// ============================================================================
// Film Grain
// ============================================================================

fn applyGrain(color: vec3<f32>, uv: vec2<f32>, time: f32, intensity: f32) -> vec3<f32> {
  // Animate grain by offsetting UV with time
  let grainUV = uv * (params.resolution / params.grainSize) + vec2<f32>(time * 0.1, time * 0.15);
  let grainValue = textureSample(grainTexture, inputSampler, grainUV).r;

  // Map grain to [-intensity, intensity]
  let grain = (grainValue - 0.5) * 2.0 * intensity;

  return color + vec3<f32>(grain);
}

// ============================================================================
// Composite Fragment Shader (All Effects)
// ============================================================================

@fragment
fn fs_composite(input: VertexOutput) -> @location(0) vec4<f32> {
  var color = textureSample(inputTexture, inputSampler, input.uv).rgb;

  // 1. Add bloom (simple additive blend)
  if (params.bloomIntensity > 0.0) {
    let bloom = textureSample(bloomTexture, bloomSampler, input.uv).rgb;
    color += bloom * params.bloomIntensity;
  }

  // 2. Tone mapping (Reinhard or clamp)
  if (params.toneMappingMode > 0.5) {
    color = reinhardToneMapping(color, params.exposure);
  } else {
    color = clampToneMapping(color, params.exposure);
  }

  // 3. Ordered dithering (Bayer matrix)
  if (params.ditherStrength > 0.0) {
    color = applyDither(color, input.position.xy, params.ditherStrength);
  }

  // 4. Film grain
  if (params.grainIntensity > 0.0) {
    color = applyGrain(color, input.uv, params.time, params.grainIntensity);
  }

  // Final clamp to [0, 1]
  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));

  return vec4<f32>(color, 1.0);
}

// ============================================================================
// Color Grading (LUT-based) - Separate Shader
// ============================================================================

@group(0) @binding(6) var colorLUT: texture_2d<f32>;

@fragment
fn fs_color_grading(input: VertexOutput) -> @location(0) vec4<f32> {
  var color = textureSample(inputTexture, inputSampler, input.uv).rgb;

  // Sample 1D LUT (256x16 texture)
  // Map RGB color to LUT coordinate
  let lutCoord = vec2<f32>(color.r, 0.5 / 16.0); // Use red channel as index
  let gradedR = textureSample(colorLUT, inputSampler, lutCoord).r;

  let lutCoordG = vec2<f32>(color.g, 1.5 / 16.0);
  let gradedG = textureSample(colorLUT, inputSampler, lutCoordG).g;

  let lutCoordB = vec2<f32>(color.b, 2.5 / 16.0);
  let gradedB = textureSample(colorLUT, inputSampler, lutCoordB).b;

  return vec4<f32>(gradedR, gradedG, gradedB, 1.0);
}
