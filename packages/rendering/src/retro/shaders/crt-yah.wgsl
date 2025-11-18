// CRT-Yah Shader - Proper WGSL Port
// Based on CRT-Yah by Hyllian (sergiogdb@gmail.com) and Jezze (jezze@gmx.net)
// Ported from RetroArch Slang shader to WebGPU WGSL
//
// PROPER ALGORITHM (following original):
// 1. Sample raw color (sharp, unprocessed)
// 2. Sample scanlines (TWO-scanline interpolation with beam attenuation)
// 3. Blend raw + scanlines based on strength
// 4. Apply phosphor mask (additive blending with brightness compensation)
// 5. Apply vignette, corners, color adjustments

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct CRTParams {
  resolution: vec2<f32>,           // Output resolution
  sourceSize: vec2<f32>,           // Input texture size

  // Global
  masterIntensity: f32,            // Master effect intensity (0-2)

  // Color
  brightness: f32,                 // Color brightness adjustment
  contrast: f32,                   // Color contrast adjustment
  saturation: f32,                 // Color saturation adjustment

  // Scanlines
  scanlinesStrength: f32,          // Scanline intensity (0-1)
  beamWidthMin: f32,               // Minimum beam width
  beamWidthMax: f32,               // Maximum beam width
  beamShape: f32,                  // 0=sharp, 1=smooth

  // Mask
  maskIntensity: f32,              // Phosphor mask intensity (0-1)
  maskType: f32,                   // 1=aperture-grille, 2=slot, 3=shadow

  // CRT geometry
  curvatureAmount: f32,            // Screen curvature (0-1)
  vignetteAmount: f32,             // Edge darkening (0-1)
  cornerRadius: f32,               // Rounded corner radius

  // Color overflow (phosphor bloom)
  colorOverflow: f32,              // Phosphor bloom intensity (0-1)

  _padding: vec3<f32>,             // 16-byte alignment
}

@group(1) @binding(0) var<uniform> params: CRTParams;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

// === Constants ===
const EPSILON: f32 = 0.0001;
const PI: f32 = 3.14159265359;

// sRGB gamma constants
const GAMMA: f32 = 2.4;
const INV_GAMMA: f32 = 1.0 / 2.4;

// Rec.709 luma coefficients
const LUMA_R: f32 = 0.2126;
const LUMA_G: f32 = 0.7152;
const LUMA_B: f32 = 0.0722;

// === Helper Functions ===

fn get_luminance(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(LUMA_R, LUMA_G, LUMA_B));
}

// sRGB gamma decode (linearize)
fn decode_gamma(color: vec3<f32>) -> vec3<f32> {
  return pow(color, vec3<f32>(GAMMA));
}

// sRGB gamma encode
fn encode_gamma(color: vec3<f32>) -> vec3<f32> {
  return pow(color, vec3<f32>(INV_GAMMA));
}

fn apply_contrast(color: vec3<f32>, contrast: f32) -> vec3<f32> {
  let midpoint = vec3<f32>(0.5);
  return mix(midpoint, color, 1.0 + contrast);
}

fn apply_brightness(color: vec3<f32>, brightness: f32) -> vec3<f32> {
  return color + vec3<f32>(brightness);
}

fn apply_saturation(color: vec3<f32>, saturation: f32) -> vec3<f32> {
  let luma = get_luminance(color);
  return mix(vec3<f32>(luma), color, saturation);
}

// === CRT Geometry ===

// Cubic lens distortion (authentic CRT screen curvature)
fn apply_cubic_lens_distortion(uv: vec2<f32>) -> vec2<f32> {
  let amount = params.curvatureAmount;

  if (amount <= 0.0) {
    return uv;
  }

  // Center coordinates
  var coord = uv - 0.5;

  // Compute cubic distortion factor
  let c = coord.x * coord.x + coord.y * coord.y;
  let f = 1.0 + c * (amount * sqrt(c));

  // Fit screen bounds (prevent over-distortion at edges)
  let fit = 1.0 + amount * 0.125;

  // Apply distortion
  coord *= f / fit;

  // Un-center
  return coord + 0.5;
}

// Vignette (edge darkening)
fn get_vignette_factor(uv: vec2<f32>) -> f32 {
  let amount = params.vignetteAmount;

  if (amount <= 0.0) {
    return 1.0;
  }

  // Center coordinates
  let centered = uv - 0.5;

  // Compute vignetting
  let radius = 1.0 - (amount * 0.25);
  let length_val = length(centered);
  let blur = (amount * 0.125) + 0.375;
  let vignette = smoothstep(radius, radius - blur, length_val);

  return clamp(vignette, 0.0, 1.0);
}

// Rounded corners using smooth rectangle SDF
fn get_round_corner_factor(uv: vec2<f32>) -> f32 {
  if (params.cornerRadius <= 0.0) {
    return 1.0;
  }

  // Convert to centered coordinates
  let centered = abs(uv - 0.5) * 2.0;

  // Aspect ratio correction
  let aspect = params.resolution.x / params.resolution.y;
  let size = vec2<f32>(aspect, 1.0);

  // Signed distance to rounded box
  let radius = params.cornerRadius * 2.0;
  let d = length(max(centered - size + radius, vec2<f32>(0.0))) - radius;

  // Smooth edge
  let smoothness = params.cornerRadius * 0.5 + 0.01;
  return 1.0 - smoothstep(-smoothness, 0.0, d);
}

// === Scanlines (CORRECT ALGORITHM) ===

// Get beam width based on color brightness (color burn effect)
fn get_beam_width(color: vec3<f32>) -> vec3<f32> {
  let minWidth = params.beamWidthMin;
  let maxWidth = params.beamWidthMax;

  // Per-channel width for authentic CRT color burn
  return mix(vec3<f32>(minWidth), vec3<f32>(maxWidth), color);
}

// Get scanline attenuation factor for ONE scanline
fn get_scanline_factor(color: vec3<f32>, position: f32) -> vec3<f32> {
  let strength = params.scanlinesStrength;

  if (strength <= 0.0) {
    return vec3<f32>(1.0);
  }

  // Get dynamic beam width based on color
  let width = get_beam_width(color);

  // Beam shape: 0=sharp (high slope), 1=smooth (low slope)
  let slope = mix(6.0, 2.0, params.beamShape);

  // Gaussian-like falloff based on distance from scanline center
  let factor = position / (width + EPSILON);
  let attenuation = exp(-10.0 * strength * pow(factor, vec3<f32>(slope)));

  return attenuation;
}

// Sample scanlines with TWO-scanline interpolation (CRITICAL!)
fn get_scanlines_color(uv: vec2<f32>) -> vec3<f32> {
  // Convert to pixel coordinates using SOURCE resolution (internal game resolution)
  let texSize = params.sourceSize;  // e.g., 640×480 internal resolution
  let pixCoord = uv * texSize + vec2<f32>(0.5); // Align to pixel corner

  // Get fractional position within pixel
  let pixFract = fract(pixCoord);

  // Sample current scanline (at floor position)
  let texCoord0 = floor(pixCoord) / texSize;
  let color0 = decode_gamma(textureSampleLevel(inputTexture, inputSampler, texCoord0, 0.0).rgb);

  // Sample next scanline (one pixel down)
  let texCoord1 = (floor(pixCoord) + vec2<f32>(0.0, 1.0)) / texSize;
  let color1 = decode_gamma(textureSampleLevel(inputTexture, inputSampler, texCoord1, 0.0).rgb);

  // Apply scanline attenuation to BOTH scanlines based on fractional Y position
  let factor0 = get_scanline_factor(color0, pixFract.y);
  let factor1 = get_scanline_factor(color1, 1.0 - pixFract.y);

  // BLEND the two scanlines (this creates the scanline effect!)
  return color0 * factor0 + color1 * factor1;
}

// Sample raw color (unprocessed, for blending with scanlines)
fn get_raw_color(uv: vec2<f32>) -> vec3<f32> {
  return decode_gamma(textureSampleLevel(inputTexture, inputSampler, uv, 0.0).rgb);
}

// Blend raw color with scanlines (CRITICAL STEP!)
fn blend_colors(raw: vec3<f32>, scanlines: vec3<f32>) -> vec3<f32> {
  let strength = params.scanlinesStrength;

  if (strength == 0.0) {
    return raw;
  }

  // Merge raw with scanlines for strength < 0.125 (gradual fade-in)
  let merge_limit = min(1.0, strength * 8.0);

  return mix(raw, scanlines, merge_limit);
}

// === Phosphor Mask (CORRECT ALGORITHM) ===

// Aperture grille mask (vertical RGB stripes - Sony Trinitron style)
fn get_aperture_grille_mask(screenPos: vec2<f32>) -> vec3<f32> {
  // 3 subpixels per pixel horizontally (R, G, B)
  let subpixel = fract(screenPos.x * 3.0);

  // Smooth RGB stripes
  let r = smoothstep(0.0, 0.15, subpixel) * smoothstep(0.33, 0.18, subpixel);
  let g = smoothstep(0.33, 0.48, subpixel) * smoothstep(0.66, 0.51, subpixel);
  let b = smoothstep(0.66, 0.81, subpixel) * smoothstep(1.0, 0.85, subpixel);

  return vec3<f32>(r, g, b);
}

// Slot mask (horizontal RGB slots)
fn get_slot_mask(screenPos: vec2<f32>) -> vec3<f32> {
  let subpixelX = fract(screenPos.x * 3.0);
  let subpixelY = fract(screenPos.y * 2.0);

  // Horizontal modulation for slot effect
  let slot = smoothstep(0.3, 0.5, subpixelY) * smoothstep(0.7, 0.5, subpixelY);

  // RGB stripes with slot modulation
  let r = smoothstep(0.0, 0.15, subpixelX) * smoothstep(0.33, 0.18, subpixelX) * slot;
  let g = smoothstep(0.33, 0.48, subpixelX) * smoothstep(0.66, 0.51, subpixelX) * slot;
  let b = smoothstep(0.66, 0.81, subpixelX) * smoothstep(1.0, 0.85, subpixelX) * slot;

  return vec3<f32>(r, g, b);
}

// Shadow mask (diagonal RGB triads)
fn get_shadow_mask(screenPos: vec2<f32>) -> vec3<f32> {
  let pixel = screenPos * 3.0;
  let subpixel = fract(pixel);

  // Delta arrangement: staggered RGB dots
  let row = floor(pixel.y);
  let offset = row * 0.333; // Stagger by 1/3 pixel per row
  let phase = fract((pixel.x + offset) / 3.0);

  let r = smoothstep(0.0, 0.15, phase) * smoothstep(0.33, 0.18, phase);
  let g = smoothstep(0.33, 0.48, phase) * smoothstep(0.66, 0.51, phase);
  let b = smoothstep(0.66, 0.81, phase) * smoothstep(1.0, 0.85, phase);

  // Vertical modulation for dot pattern
  let verticalMask = sin(subpixel.y * PI) * 0.5 + 0.5;

  return vec3<f32>(r, g, b) * (0.7 + verticalMask * 0.3);
}

// Apply mask with ADDITIVE BLENDING and brightness compensation (CRITICAL!)
fn apply_mask(color: vec3<f32>, colorLuma: f32, uv: vec2<f32>) -> vec3<f32> {
  if (params.maskIntensity <= 0.0) {
    return color;
  }

  // Use UN-CURVED coordinates to avoid Moire artifacts
  let screenPos = uv * params.resolution;

  // Select mask type
  var mask: vec3<f32>;
  if (params.maskType < 1.5) {
    // Aperture grille (type 1)
    mask = get_aperture_grille_mask(screenPos);
  } else if (params.maskType < 2.5) {
    // Slot mask (type 2)
    mask = get_slot_mask(screenPos);
  } else {
    // Shadow mask (type 3)
    mask = get_shadow_mask(screenPos);
  }

  let maskLuma = get_luminance(mask);

  // ADDITIVE BLEND: Add half of color brightness to mask (KEY FEATURE!)
  // This prevents the mask from darkening bright areas too much
  let maskBlend = 1.0; // Using full blend for now (match original PARAM_MASK_BLEND = 1.0)
  mask = mix(
    mask,
    mask + colorLuma * 0.5,
    maskBlend
  );

  // Brightness compensation (increase mask brightness based on intensity)
  var maskAdd = mask;
  maskAdd += (1.0 - params.maskIntensity) * 0.5;
  maskAdd = clamp(maskAdd, vec3<f32>(0.0), vec3<f32>(1.0));
  maskAdd += params.maskIntensity * 0.5;

  // Blend multiplicative and additive mask
  mask = mix(
    mask,
    maskAdd,
    maskBlend
  );

  // Apply mask based on intensity
  return mix(
    color,
    color * mask,
    params.maskIntensity
  );
}

// === Color Processing ===

// Color overflow simulates CRT phosphor bloom where bright colors
// bleed into neighboring RGB channels
fn apply_color_overflow(color: vec3<f32>) -> vec3<f32> {
  if (params.colorOverflow <= 0.0) {
    return color;
  }

  // Compute squared color scaled by overflow intensity
  let overflow = color * color * params.colorOverflow;

  var result = color;

  // Add cross-channel contributions using PRODUCTS of luma coefficients
  // This simulates the physical interaction between phosphor excitation
  result.r += LUMA_R * LUMA_G * overflow.g;  // 0.2126 * 0.7152 * overflow.g
  result.r += LUMA_R * LUMA_B * overflow.b;  // 0.2126 * 0.0722 * overflow.b
  result.g += LUMA_G * LUMA_R * overflow.r;  // 0.7152 * 0.2126 * overflow.r
  result.g += LUMA_G * LUMA_B * overflow.b;  // 0.7152 * 0.0722 * overflow.b
  result.b += LUMA_B * LUMA_R * overflow.r;  // 0.0722 * 0.2126 * overflow.r
  result.b += LUMA_B * LUMA_G * overflow.g;  // 0.0722 * 0.7152 * overflow.g

  return result;
}

fn apply_color_adjustments(color: vec3<f32>) -> vec3<f32> {
  var result = color;

  // Apply adjustments in linear space
  result = apply_contrast(result, params.contrast);
  result = apply_brightness(result, params.brightness);
  result = apply_saturation(result, params.saturation);

  // Clamp to valid range
  result = clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));

  return result;
}

// === Vertex Shader ===

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  // Fullscreen triangle
  var uv = vec2<f32>(
    f32((vertexIndex << 1u) & 2u),
    f32(vertexIndex & 2u)
  );

  var out: VertexOutput;
  out.position = vec4<f32>(uv * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2<f32>(uv.x, 1.0 - uv.y);  // Flip V for WebGPU texture sampling
  return out;
}

// === Fragment Shader (CORRECT ALGORITHM ORDER) ===

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  // Step 1: Apply screen curvature
  let curvedUV = apply_cubic_lens_distortion(in.uv);

  // Step 2: Reject pixels outside screen bounds (bezel effect)
  if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }

  // Step 3: Sample RAW color (unprocessed, for blending with scanlines)
  let rawColor = get_raw_color(curvedUV);

  // Step 4: Sample SCANLINES color (TWO-scanline interpolation)
  let scanlinesColor = get_scanlines_color(curvedUV);

  // Step 5: BLEND raw + scanlines (CRITICAL STEP!)
  var color = blend_colors(rawColor, scanlinesColor);

  // Get luminance for mask processing
  let colorLuma = get_luminance(color);

  // Step 6: Apply phosphor mask (use UN-CURVED UV to avoid Moire artifacts)
  color = apply_mask(color, colorLuma, in.uv);

  // Step 7: Apply color overflow (phosphor bloom)
  color = apply_color_overflow(color);
  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));  // Prevent overflow

  // Step 8: Apply color adjustments (still in linear space)
  color = apply_color_adjustments(color);

  // Step 9: Apply vignette
  color *= get_vignette_factor(curvedUV);

  // Step 9: Apply rounded corners
  color *= get_round_corner_factor(curvedUV);

  // Step 10: Encode to sRGB for output
  color = encode_gamma(color);

  // Apply master intensity (fade in/out effect)
  let master = params.masterIntensity;
  if (master < 1.0) {
    // Fade out - blend with unprocessed image
    let rawColorUnprocessed = textureSampleLevel(inputTexture, inputSampler, curvedUV, 0.0).rgb;
    color = mix(rawColorUnprocessed, color, master);
  } else if (master > 1.0) {
    // Intensify effect - simple multiplicative boost
    color = color * master;
  }

  return vec4<f32>(color, 1.0);
}
