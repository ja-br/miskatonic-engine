// Optional CRT shader - scanlines, phosphor glow, screen curvature
// Applied as final pass after composite

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct CRTParams {
  scanlineIntensity: f32,
  curvatureAmount: f32,
  phosphorGlow: f32,
  vignetteIntensity: f32,
  time: f32,
  _padding: vec3<f32>,
}

@group(1) @binding(0) var<uniform> params: CRTParams;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

// Apply barrel distortion for CRT curvature
fn applyCurvature(uv: vec2<f32>, amount: f32) -> vec2<f32> {
  let centered = uv * 2.0 - 1.0;
  let r = length(centered);
  let distortion = 1.0 + amount * r * r;
  return (centered * distortion) * 0.5 + 0.5;
}

// Vignette effect
fn vignette(uv: vec2<f32>, intensity: f32) -> f32 {
  let centered = uv * 2.0 - 1.0;
  let dist = length(centered);
  return 1.0 - smoothstep(0.7, 1.4, dist) * intensity;
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
  // Apply screen curvature
  let curvedUV = applyCurvature(in.uv, params.curvatureAmount);

  // Reject pixels outside screen bounds
  if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }

  // Sample color
  var color = textureSample(inputTexture, inputSampler, curvedUV).rgb;

  // Scanlines
  let scanline = sin(curvedUV.y * 600.0 + params.time * 0.1) * 0.5 + 0.5;
  color = color * (1.0 - params.scanlineIntensity + scanline * params.scanlineIntensity);

  // Phosphor glow (slight horizontal blur)
  let texSize = textureDimensions(inputTexture);
  let texelSize = 1.0 / vec2<f32>(texSize);
  let glow = textureSample(inputTexture, inputSampler, curvedUV + vec2<f32>(texelSize.x, 0.0)).rgb +
             textureSample(inputTexture, inputSampler, curvedUV - vec2<f32>(texelSize.x, 0.0)).rgb;
  color = color + glow * params.phosphorGlow * 0.5;

  // Vignette
  let vig = vignette(curvedUV, params.vignetteIntensity);
  color = color * vig;

  return vec4<f32>(color, 1.0);
}
