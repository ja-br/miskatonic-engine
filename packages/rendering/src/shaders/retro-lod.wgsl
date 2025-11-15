/**
 * Retro LOD Shader with Dithered Crossfade
 * Epic 3.4: Retro Rendering Pipeline - LOD System
 *
 * Implements PS2-era LOD crossfading using stipple patterns
 * No smooth mesh morphing, no temporal blending
 */

// ============================================================================
// Bind Groups
// ============================================================================

// Group 0: Scene uniforms
struct SceneUniforms {
  viewMatrix: mat4x4<f32>,
  projectionMatrix: mat4x4<f32>,
  cameraPosition: vec3<f32>,
  padding1: f32,
}

@group(0) @binding(0) var<uniform> scene: SceneUniforms;

// Group 1: LOD parameters
struct LODParams {
  crossfadeFactor: f32,  // 0.0 = primary LOD, 1.0 = secondary LOD
  padding1: f32,
  padding2: f32,
  padding3: f32,
}

@group(1) @binding(0) var<uniform> lodParams: LODParams;

// Group 2: Dither pattern texture
@group(2) @binding(0) var ditherPattern: texture_2d<f32>;
@group(2) @binding(1) var ditherSampler: sampler;

// ============================================================================
// Vertex Shader Input/Output
// ============================================================================

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) worldPosition: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
}

// ============================================================================
// Vertex Shader
// ============================================================================

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // Transform to world space
  let worldPos = vec4<f32>(input.position, 1.0);
  output.worldPosition = worldPos.xyz;

  // Transform to clip space
  let viewPos = scene.viewMatrix * worldPos;
  output.clipPosition = scene.projectionMatrix * viewPos;

  // Pass through attributes
  output.normal = normalize(input.normal);
  output.uv = input.uv;

  return output;
}

// ============================================================================
// Dithered Alpha Discard
// ============================================================================

/**
 * Apply stipple pattern for crossfade
 * Uses screen-space dither pattern to create smooth LOD transitions
 *
 * PS2-era technique: Use ordered dither to create pseudo-transparency
 * by discarding pixels in a checkerboard/Bayer pattern
 */
fn applyDitheredDiscard(screenPos: vec2<f32>, threshold: f32) {
  // Sample dither pattern (4x4 Bayer matrix, tiled across screen)
  let ditherSize = 4.0;
  let ditherCoord = fract(screenPos / ditherSize);
  let ditherValue = textureSample(ditherPattern, ditherSampler, ditherCoord).r;

  // Discard pixel if dither value is below threshold
  // As crossfadeFactor increases, more pixels are discarded (fading out primary LOD)
  if (ditherValue > threshold) {
    discard;
  }
}

// ============================================================================
// Fragment Shader (Primary LOD)
// ============================================================================

@fragment
fn fs_lod_primary(input: VertexOutput) -> @location(0) vec4<f32> {
  // Apply dithered discard for crossfade
  // Primary LOD fades out as crossfadeFactor approaches 1.0
  if (lodParams.crossfadeFactor > 0.0) {
    applyDitheredDiscard(input.clipPosition.xy, lodParams.crossfadeFactor);
  }

  // Simple shading (placeholder - will be replaced by retro lighting)
  let color = vec3<f32>(0.8, 0.8, 0.8);

  return vec4<f32>(color, 1.0);
}

// ============================================================================
// Fragment Shader (Secondary LOD)
// ============================================================================

@fragment
fn fs_lod_secondary(input: VertexOutput) -> @location(0) vec4<f32> {
  // Apply dithered discard for crossfade
  // Secondary LOD fades in as crossfadeFactor approaches 1.0
  // Inverted threshold: discard if dither < (1.0 - crossfadeFactor)
  if (lodParams.crossfadeFactor < 1.0) {
    applyDitheredDiscard(input.clipPosition.xy, 1.0 - lodParams.crossfadeFactor);
  }

  // Simple shading (placeholder)
  let color = vec3<f32>(0.6, 0.6, 0.6);

  return vec4<f32>(color, 1.0);
}

// ============================================================================
// Alternative: Alpha-to-Coverage (if supported)
// ============================================================================

/**
 * Use alpha-to-coverage instead of manual discard
 * More efficient on modern hardware, but requires MSAA
 */
@fragment
fn fs_lod_alpha_to_coverage(input: VertexOutput) -> @location(0) vec4<f32> {
  // Calculate alpha based on crossfade factor
  let alpha = 1.0 - lodParams.crossfadeFactor;

  // Simple shading
  let color = vec3<f32>(0.8, 0.8, 0.8);

  // Alpha will be used by alpha-to-coverage for stippling
  return vec4<f32>(color, alpha);
}

// ============================================================================
// Utility: Bayer 4x4 Pattern (Inline)
// ============================================================================

// Bayer 4x4 pattern as a flat array (WGSL doesn't support nested array constructors)
const BAYER_4x4 = array<f32, 16>(
   0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
  12.0/16.0,  4.0/16.0, 14.0/16.0,  6.0/16.0,
   3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
  15.0/16.0,  7.0/16.0, 13.0/16.0,  5.0/16.0
);

/**
 * Alternative implementation without texture lookup
 * Generates Bayer 4x4 pattern procedurally
 */
fn bayer4x4(screenPos: vec2<i32>) -> f32 {
  let x = screenPos.x % 4;
  let y = screenPos.y % 4;
  return BAYER_4x4[y * 4 + x];
}

/**
 * Procedural dithered discard (no texture required)
 */
fn applyProceduralDither(screenPos: vec2<f32>, threshold: f32) {
  let ditherValue = bayer4x4(vec2<i32>(screenPos));

  if (ditherValue > threshold) {
    discard;
  }
}

// ============================================================================
// Fragment Shader (Procedural Dither)
// ============================================================================

@fragment
fn fs_lod_procedural(input: VertexOutput) -> @location(0) vec4<f32> {
  // Use procedural dithering instead of texture lookup
  if (lodParams.crossfadeFactor > 0.0) {
    applyProceduralDither(input.clipPosition.xy, lodParams.crossfadeFactor);
  }

  // Simple shading
  let color = vec3<f32>(0.8, 0.8, 0.8);

  return vec4<f32>(color, 1.0);
}
