# Light-Entity Anamorphic Lens Flare Implementation Research

**Comprehensive Technical Analysis for Miskatonic Engine**

**Author:** Research compiled for Miskatonic Engine development
**Date:** 2025-11-17
**Target Platform:** WebGPU/WGSL
**Performance Budget:** 60 FPS (16.67ms frame budget)
**Approach:** Light-entity based rendering (sprite/billboard technique)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Approach: Light-Entity vs Screen-Space](#approach-light-entity-vs-screen-space)
3. [Classic Sprite-Based Lens Flare Technique](#classic-sprite-based-lens-flare-technique)
4. [Billboard Rendering](#billboard-rendering)
5. [Occlusion Testing Methods](#occlusion-testing-methods)
6. [Anamorphic Adaptation](#anamorphic-adaptation)
7. [Instanced Rendering for Multiple Lights](#instanced-rendering-for-multiple-lights)
8. [Texture Design and Atlasing](#texture-design-and-atlasing)
9. [Additive Blending and HDR](#additive-blending-and-hdr)
10. [WebGPU/WGSL Implementation](#webgpuwgsl-implementation)
11. [Performance Optimization](#performance-optimization)
12. [Integration with Miskatonic Engine](#integration-with-miskatonic-engine)
13. [References and Resources](#references-and-resources)

---

## Executive Summary

This research focuses on **light-entity based lens flare rendering**, where flares are generated only for specific light sources in the scene (not for all bright pixels). This is fundamentally different from screen-space post-processing approaches.

**Key Technique:**
- Render billboarded quads at each visible light's screen position
- Use instanced rendering to batch multiple lights
- Apply horizontal UV stretching for anamorphic effect
- Test occlusion using depth buffer sampling
- Blend additively with premultiplied alpha

**Performance Profile:**
- **~0.05ms per 10 lights** (instanced rendering)
- Single draw call for all flares
- Minimal texture bandwidth (small atlas)
- Scales linearly with visible light count

**Recommended Approach for Miskatonic:**
- **Instanced billboard rendering** with horizontal streak textures
- **Depth buffer occlusion testing** for visibility
- **Texture atlas** with multiple flare elements
- **Additive blending** for HDR-correct compositing
- **Per-light control** via Light component flags

---

## Approach: Light-Entity vs Screen-Space

### Light-Entity Based (This Document)

**Concept:** Render lens flares only at specific light source positions.

**Process:**
1. Query light entities from ECS (via LightSystem)
2. Project each light position to screen space
3. Test visibility against depth buffer
4. Render billboard quad at each visible light position
5. Scale/tint by light properties (intensity, color)

**Characteristics:**
- Selective (only designated lights produce flares)
- Art-directable (per-light control)
- Efficient (only renders where lights are)
- Classic technique (used since mid-90s)

**Use Cases:**
- Point lights (street lamps, torches, muzzle flashes)
- Spot lights (flashlights, car headlights)
- Bright emissive objects (crystals, screens, eyes)

### Screen-Space Post-Processing (Alternative)

**Concept:** Extract all bright pixels from rendered scene, generate flares.

**Process:**
1. Threshold scene for bright pixels
2. Generate ghosts, halos, chromatic aberration
3. Blur horizontally (for anamorphic)
4. Composite over scene

**Characteristics:**
- Automatic (all bright content produces flares)
- Uniform aesthetic (same flare everywhere)
- Expensive (processes full screen)
- Modern technique (2000s onward)

**Use Cases:**
- Sunlight, sky
- Explosions, fire
- Highly specular surfaces
- Photorealistic rendering

### Why Light-Entity for Miskatonic

1. **ECS Integration:** You already have a LightSystem tracking lights
2. **Performance:** Only render flares where lights actually are
3. **Retro Aesthetic:** PS1/N64 used sprite-based flares, not screen-space
4. **Selective Control:** Add `lensFlare: boolean` flag to Light component
5. **Simple Implementation:** Single instanced draw call, minimal shader complexity

---

## Classic Sprite-Based Lens Flare Technique

### Mark Kilgard's Approach (1999)

The definitive technique published in OpenGL archives.

**Core Method:**
- "Screen-aligned textured quads projected in the direction of the flare"
- Each flare element is a billboard quad
- Additive blending: `glBlendFunc(GL_ONE, GL_ONE)`
- No depth testing needed for flare quads
- Multiple elements along screen-center line

**Texture Strategy:**
- **Luminance textures** (grayscale) save 3x memory
- **Color via modulation:** Render same texture 3 times (R, G, B tints)
- **Multiple elements:** Ghosts, halos, rays, starbursts

**Rendering Pipeline:**
1. Render main scene (with depth buffer)
2. Disable depth writes (read-only depth for occlusion)
3. Enable additive blending
4. For each light:
   - Project to screen space
   - Test occlusion
   - Render billboard quad(s)
5. Restore render state

**Performance Note:**
"The lens flare does not need depth testing to be enabled" — Kilgard optimized by skipping depth writes, but modern implementations often use depth reads for occlusion.

### Flare Element Positioning

**Classic Pattern:** Position elements along screen-center line.

```
Light position: L
Screen center: C
Vector: V = C - L

Element positions:
E[0] = L + V * 0.0    // At light
E[1] = L + V * 0.3    // Slightly toward center
E[2] = L + V * 0.7    // Near center
E[3] = L + V * 1.0    // At center
E[4] = L + V * 1.5    // Beyond center (mirror)
```

**For anamorphic:** Skip multiple elements, use single horizontal streak at light position.

### Color Generation

**Kilgard's RGB Triple Method:**
```
// Instead of one RGB quad:
Render luminance_texture with GL_MODULATE and red=(1,0,0)
Render luminance_texture with GL_MODULATE and green=(0,1,0)
Render luminance_texture with GL_MODULATE and blue=(0,0,1)

// Additive blending creates full-color result
```

**Modern approach:** Use RGB texture, tint in shader by light color.

---

## Billboard Rendering

### What is Billboarding?

**Definition:** A billboard is a quad that always faces the camera.

**Purpose:**
- Ensure flare is visible from any angle
- Prevent rotation artifacts
- Maintain consistent visual appearance

### Billboard Orientation Techniques

#### Technique 1: Vertex Shader Billboard (CPU-Provided Camera Vectors)

Expand point to quad using camera right/up vectors.

```wgsl
// Uniforms
struct CameraVectors {
    right: vec3<f32>,
    up: vec3<f32>,
}

// Vertex shader
@vertex
fn vs_billboard(
    @location(0) quad_vertex: vec2<f32>,  // (-1,-1) to (1,1)
    @location(1) center_world: vec3<f32>,  // Per-instance
    @location(2) size: vec2<f32>,          // Per-instance
) -> VertexOutput {
    // Expand quad in world space
    let world_offset =
        camera.right * quad_vertex.x * size.x +
        camera.up * quad_vertex.y * size.y;

    let world_pos = center_world + world_offset;

    let clip_pos = projection_view * vec4<f32>(world_pos, 1.0);

    // ...
}
```

**Pros:** Full camera-facing behavior, works in 3D space
**Cons:** Requires CPU to extract/provide camera vectors

#### Technique 2: Screen-Space Billboard (Simpler for Lens Flares)

Render directly in screen space (no 3D billboarding needed).

```wgsl
// Vertex shader
@vertex
fn vs_screen_billboard(
    @location(0) quad_vertex: vec2<f32>,  // (-1,-1) to (1,1)
    @location(1) light_screen_pos: vec2<f32>,  // Per-instance (NDC)
    @location(2) size_pixels: vec2<f32>,       // Per-instance
) -> VertexOutput {
    // Convert pixel size to NDC
    let ndc_size = size_pixels / viewport_size;

    // Position in clip space
    let ndc_pos = light_screen_pos + quad_vertex * ndc_size;

    var out: VertexOutput;
    out.position = vec4<f32>(ndc_pos, 0.0, 1.0);
    out.uv = quad_vertex * 0.5 + 0.5;  // 0-1 range
    return out;
}
```

**Pros:**
- No view-projection transform needed
- Perfect for screen-space effects
- Simpler shader

**Cons:**
- No 3D depth (but lens flares don't need it)
- Screen-locked

**Recommended for Miskatonic:** Use screen-space approach, project lights to NDC on CPU.

#### Technique 3: Geometry Shader Expansion (Not Available in WebGPU)

WebGPU doesn't support geometry shaders, so this technique isn't available. Mentioned for completeness.

---

## Occlusion Testing Methods

Critical for realistic lens flares: lights behind objects shouldn't produce flares (or should fade).

### Method 1: Simple Depth Test (Fastest)

**Concept:** Sample depth buffer at light position, compare to light depth.

**Process:**
```
1. Project light world position → clip space
2. Depth = clip.z / clip.w (NDC depth)
3. Screen position = (clip.xy / clip.w) * 0.5 + 0.5 (UV)
4. Sample scene depth buffer at screen position
5. If scene_depth < light_depth - epsilon: occluded
```

**Implementation:**
```typescript
function testOcclusion(lightWorldPos, viewProj, depthTexture) {
    const clip = viewProj.transform(lightWorldPos);
    const ndc = {
        x: clip.x / clip.w,
        y: clip.y / clip.w,
        z: clip.z / clip.w
    };

    const uv = {
        x: ndc.x * 0.5 + 0.5,
        y: -ndc.y * 0.5 + 0.5  // Flip Y for texture
    };

    // Sample depth (CPU-side or compute shader)
    const sceneDepth = sampleDepth(depthTexture, uv);

    const epsilon = 0.01;
    return sceneDepth >= ndc.z - epsilon;
}
```

**Pros:**
- Very fast (single texture sample)
- Immediate result (no latency)

**Cons:**
- Binary visible/occluded (no partial visibility)
- Single-pixel test (can miss if light is large)

### Method 2: Area-Based Occlusion Query (Better)

**Concept:** Test visibility of small region (e.g., 16x16 pixels) around light.

**XNA Tutorial Method:**
```
1. Render test quad (16x16 pixels) at light position
2. Depth test enabled, color/depth writes disabled
3. Use OcclusionQuery to count visible pixels
4. Visibility = visible_pixels / total_pixels
```

**Visibility Calculation:**
```
test_size = 80 pixels  // Half-size of test quad
test_area = test_size * test_size = 6400 pixels

occlusion_alpha = min(visible_pixel_count / test_area, 1.0) * 2.0
// Multiply by 2 for amplification

flare_intensity *= occlusion_alpha
```

**Pros:**
- Partial visibility (smooth fade as object approaches)
- More robust than single-pixel test

**Cons:**
- Requires occlusion query support
- 1-frame latency (query result available next frame)

**WebGPU Support:**
WebGPU has occlusion queries via `beginOcclusionQuery()` / `endOcclusionQuery()`.

### Method 3: Depth Mipmap (Hi-Z) Sampling (Advanced)

**Concept:** Build hierarchical depth buffer, sample low-res mip for fast conservative test.

**Process:**
```
1. After scene render, generate depth mipmap
   - Mip 0: Full resolution (e.g., 1920x1080)
   - Mip 1: Half resolution (960x540)
   - Mip 2: Quarter resolution (480x270)
   - ...
   - Mip N: 1x1 (max depth in scene)

2. For occlusion test:
   - Sample appropriate mip level based on light size
   - Compare sampled max_depth to light depth
```

**Mip Generation:**
```wgsl
// Compute shader to downsample depth (take max)
@compute @workgroup_size(8, 8)
fn downsample_depth(
    @builtin(global_invocation_id) id: vec3<u32>
) {
    let src_uv = vec2<f32>(id.xy * 2u);

    let d0 = textureLoad(depth_input, src_uv + vec2(0, 0), 0).r;
    let d1 = textureLoad(depth_input, src_uv + vec2(1, 0), 0).r;
    let d2 = textureLoad(depth_input, src_uv + vec2(0, 1), 0).r;
    let d3 = textureLoad(depth_input, src_uv + vec2(1, 1), 0).r;

    let max_depth = max(max(d0, d1), max(d2, d3));

    textureStore(depth_output, id.xy, vec4(max_depth));
}
```

**Pros:**
- Very fast lookups (small mip)
- Conservative test (guaranteed correct)
- Can skip rendering entirely if occluded

**Cons:**
- Requires compute shader pass
- Adds ~0.2ms for mip generation

### Method 4: Compute Shader Grid Test (GPU-Side)

**Concept:** Use compute shader to sample 16x16 grid of depth values, count visible.

**Process:**
```wgsl
@group(0) @binding(0) var depth_texture: texture_depth_2d;
@group(0) @binding(1) var<storage, read_write> visibility: array<f32>;

struct LightTest {
    screen_pos: vec2<f32>,
    depth: f32,
}

@group(1) @binding(0) var<storage, read> light_tests: array<LightTest>;

@compute @workgroup_size(16, 16)
fn test_occlusion(
    @builtin(global_invocation_id) id: vec3<u32>,
    @builtin(workgroup_id) workgroup: vec3<u32>
) {
    let light_idx = workgroup.x;
    let light = light_tests[light_idx];

    // Sample depth at grid position around light
    let offset = vec2<i32>(id.xy) - vec2<i32>(8, 8);  // Center grid
    let sample_uv = light.screen_pos + vec2<f32>(offset) / viewport_size;

    let scene_depth = textureSample(depth_texture, sampler, sample_uv);

    // Atomically increment visible count if not occluded
    if (scene_depth >= light.depth - 0.01) {
        atomicAdd(&visibility[light_idx], 1.0 / 256.0);  // 16x16 = 256
    }
}
```

**Pros:**
- Fully GPU-side (no CPU involvement)
- Batches all lights in one dispatch

**Cons:**
- Requires storage buffers
- More complex

### Recommended for Miskatonic

**Phase 1:** Simple depth test (single pixel)
- Fastest to implement
- Good enough for retro aesthetic
- ~0 performance cost

**Phase 2 (optional):** Area-based test with occlusion query
- Add when/if you need smooth fade
- Use 1-frame-old results (acceptable lag)

**Skip:** Hi-Z unless you have 100+ lights and need aggressive culling.

---

## Anamorphic Adaptation

### Physical Basis

Anamorphic lenses compress images 2:1 horizontally. When "unsqueezed," optical artifacts (like lens flares) stretch horizontally.

**For sprite-based flares:** Stretch the texture UVs horizontally.

### UV Stretching Technique

#### Option 1: Horizontal Texture Design

Design flare texture with built-in horizontal stretch.

```
Normal circular glow:    Anamorphic streak:
      ████                ████████████████
    ████████              ████████████████
  ████████████                ████
    ████████                  ████
      ████                ████████████████
                          ████████████████
```

**Pros:** No shader modification needed
**Cons:** Less flexible, need separate textures

#### Option 2: UV Scaling in Shader

Use circular texture, stretch UVs horizontally.

```wgsl
@fragment
fn fs_anamorphic(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // Stretch UV coordinates horizontally (compress lookup)
    let anamorphic_ratio = 2.0;  // 2:1 squeeze
    let stretched_uv = vec2<f32>(
        (uv.x - 0.5) * anamorphic_ratio + 0.5,  // Compress X
        uv.y                                     // Keep Y
    );

    // Sample texture (will appear stretched horizontally)
    let flare = textureSample(flare_texture, flare_sampler, stretched_uv);

    return flare;
}
```

**Explanation:**
- UV.x = 0.5 is center
- `(uv.x - 0.5)` shifts range to [-0.5, 0.5]
- Multiply by 2.0 to compress lookup (reads wider portion of texture)
- Add 0.5 back to restore range

**Result:** Circular texture appears as horizontal streak.

**Pros:**
- Reuse circular textures
- Adjustable ratio (2:1, 3:1, etc.)
- Can toggle anamorphic on/off

**Cons:**
- UV out-of-bounds check needed (or clamp sampler)

#### Option 3: Quad Aspect Ratio

Stretch billboard quad itself horizontally.

```wgsl
@vertex
fn vs_anamorphic(
    @location(0) quad_vertex: vec2<f32>,
    @location(1) light_screen_pos: vec2<f32>,
    @location(2) base_size: f32,
) -> VertexOutput {
    let anamorphic_ratio = 2.0;
    let size = vec2<f32>(base_size * anamorphic_ratio, base_size);

    let ndc_size = size / viewport_size;
    let ndc_pos = light_screen_pos + quad_vertex * ndc_size;

    // ... rest of shader
}
```

**Pros:**
- Clean separation (geometry handles stretch)
- No UV modification needed

**Cons:**
- Wastes fillrate (renders larger quad)

### Recommended Approach

**Combination:**
1. Design textures with some horizontal bias (1.5:1)
2. Apply additional UV stretching in shader (1.3x multiplier)
3. Total stretch: ~2:1

This balances texture quality with flexibility.

### Streak Characteristics

For authentic anamorphic aesthetic:

**Horizontal Extent:**
- Streaks should extend 2-10x the light's "size"
- Brighter lights = longer streaks
- Dim lights = short glow

**Vertical Tightness:**
- Vertical dimension should be tight (1/4 to 1/8 of horizontal)
- Not perfectly linear (slight bulge in center)

**Color:**
- Blue/cyan tint common (lens coating artifact)
- Can vary by light color
- RGB separation (chromatic aberration) optional

**Intensity Falloff:**
- Brightest at light position
- Exponential or power-law falloff toward edges
- Texture alpha channel encodes falloff

---

## Instanced Rendering for Multiple Lights

### Why Instancing?

Rendering N lights with N draw calls is expensive. Instancing allows **one draw call for all lights**.

**Performance:**
```
Without instancing (10 lights):
  10 draw calls × ~0.01ms = 0.1ms

With instancing (10 lights):
  1 draw call = 0.01ms
```

### WebGPU Instanced Rendering Setup

#### Per-Instance Data Structure

```typescript
// Per-instance data (one entry per visible light)
interface LensFlareInstance {
    screenPos: [f32, f32],     // NDC position (-1 to 1)
    color: [f32, f32, f32],    // Light color (RGB)
    intensity: f32,            // Brightness multiplier
    size: f32,                 // Base size in pixels
    textureIndex: f32,         // Index into atlas (if using)
    _padding: [f32, f32],      // Align to 16 bytes
}
```

#### Vertex Buffer Configuration

```typescript
const vertexBufferLayout: GPUVertexBufferLayout[] = [
    // Buffer 0: Quad vertices (shared by all instances)
    {
        arrayStride: 16,  // 4 floats (vec4)
        stepMode: 'vertex',
        attributes: [
            {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x2',  // Position (XY)
            },
            {
                shaderLocation: 1,
                offset: 8,
                format: 'float32x2',  // UV
            },
        ],
    },

    // Buffer 1: Per-instance data
    {
        arrayStride: 32,  // Size of LensFlareInstance
        stepMode: 'instance',  // Advance per instance, not per vertex
        attributes: [
            {
                shaderLocation: 2,
                offset: 0,
                format: 'float32x2',  // screenPos
            },
            {
                shaderLocation: 3,
                offset: 8,
                format: 'float32x3',  // color
            },
            {
                shaderLocation: 4,
                offset: 20,
                format: 'float32',    // intensity
            },
            {
                shaderLocation: 5,
                offset: 24,
                format: 'float32',    // size
            },
            {
                shaderLocation: 6,
                offset: 28,
                format: 'float32',    // textureIndex
            },
        ],
    },
];
```

#### Vertex Shader

```wgsl
struct VertexInput {
    @location(0) quad_pos: vec2<f32>,      // Per-vertex
    @location(1) uv: vec2<f32>,            // Per-vertex
    @location(2) screen_pos: vec2<f32>,    // Per-instance
    @location(3) color: vec3<f32>,         // Per-instance
    @location(4) intensity: f32,           // Per-instance
    @location(5) size: f32,                // Per-instance
    @location(6) texture_index: f32,       // Per-instance
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) color: vec3<f32>,
    @location(2) intensity: f32,
    @location(3) texture_index: f32,
}

@group(0) @binding(0) var<uniform> viewport_size: vec2<f32>;

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    // Convert pixel size to NDC
    let ndc_size = in.size / viewport_size;

    // Anamorphic stretch
    let anamorphic_ratio = 2.0;
    let stretched_size = vec2<f32>(ndc_size * anamorphic_ratio, ndc_size);

    // Position quad vertex in screen space
    let ndc_pos = in.screen_pos + in.quad_pos * stretched_size;

    var out: VertexOutput;
    out.position = vec4<f32>(ndc_pos, 0.0, 1.0);
    out.uv = in.uv;
    out.color = in.color;
    out.intensity = in.intensity;
    out.texture_index = in.texture_index;
    return out;
}
```

#### Fragment Shader

```wgsl
@group(0) @binding(1) var flare_texture: texture_2d<f32>;
@group(0) @binding(2) var flare_sampler: sampler;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Sample flare texture
    let flare = textureSample(flare_texture, flare_sampler, in.uv);

    // Apply light color and intensity
    let final_color = flare.rgb * in.color * in.intensity;

    // Premultiply alpha for correct blending
    return vec4<f32>(final_color * flare.a, flare.a);
}
```

#### Draw Call

```typescript
// Update instance buffer with visible lights
const visibleLights = cullAndProjectLights(lights, viewProj, depthTexture);
device.queue.writeBuffer(instanceBuffer, 0, visibleLights);

// Single instanced draw call
passEncoder.setVertexBuffer(0, quadVertexBuffer);
passEncoder.setVertexBuffer(1, instanceBuffer);
passEncoder.draw(
    6,                        // 6 vertices (2 triangles)
    visibleLights.length,     // N instances
    0,                        // First vertex
    0                         // First instance
);
```

### Performance Characteristics

**Instanced rendering:**
- 1 draw call regardless of light count
- GPU fetches per-instance data automatically
- Vertex shader runs 6 × N times (6 vertices per quad, N lights)
- Fragment shader runs once per covered pixel

**Scaling:**
```
10 lights:   ~0.01ms (1 draw call)
100 lights:  ~0.05ms (1 draw call)
1000 lights: ~0.3ms  (1 draw call, fillrate-bound)
```

---

## Texture Design and Atlasing

### Flare Element Types

**Core Elements:**
1. **Central Glow** - Bright core at light position
2. **Horizontal Streak** - Anamorphic elongation
3. **Halo** - Subtle ring around light
4. **Starburst** (optional) - Radial spikes

**Classic Elements (for multi-element flares):**
5. **Ghosts** - Circular artifacts along center-line
6. **Chromatic Rings** - Rainbow-colored rings
7. **Hexagonal Aperture** - Lens aperture shape

### Texture Design Guidelines

#### Central Glow
```
Size: 256x256
Format: RGBA8 or RGBA16F (HDR)
Content:
  - Radial gradient (bright center → transparent edge)
  - Exponential or power-law falloff
  - Alpha channel controls visibility
  - RGB can be tinted or white
```

**Falloff function:**
```glsl
float dist = length(uv - 0.5);
float falloff = exp(-dist * dist * intensity);
// or
float falloff = pow(1.0 - saturate(dist * 2.0), exponent);
```

#### Horizontal Streak (Anamorphic)
```
Size: 512x128 (wide aspect)
Content:
  - Horizontal gradient (bright center → fade at edges)
  - Tight vertical profile (bright in middle rows)
  - Possible "texture" (subtle noise, rays)
  - Alpha channel for smooth blend
```

**Profile:**
```
Horizontal: Gaussian or Lorentzian (wide)
Vertical: Tight Gaussian (narrow)

intensity(x, y) =
    gaussian(x, sigma_x=0.4) *
    gaussian(y, sigma_y=0.05)
```

#### Halo
```
Size: 256x256
Content:
  - Ring shape (empty center)
  - Soft inner/outer edges
  - Subtle radial rays (optional)
```

**Ring function:**
```glsl
float dist = length(uv - 0.5);
float ring = smoothstep(inner_radius - softness, inner_radius, dist) *
             (1.0 - smoothstep(outer_radius, outer_radius + softness, dist));
```

#### Starburst
```
Size: 512x512
Content:
  - Radial spikes (4, 6, or 8)
  - Thin, bright lines
  - Subtle glow around each spike
```

**Spike function:**
```glsl
float angle = atan(uv.y - 0.5, uv.x - 0.5);
float spike_pattern = abs(sin(angle * spike_count));
float spike = pow(spike_pattern, sharpness);
```

### Texture Atlas Strategy

**Why atlas?**
- Single texture bind (no switching)
- Better cache coherence
- Simpler pipeline

**Layout Example (1024x1024 atlas):**
```
+-------------+-------------+
| Central     | Streak      |
| Glow        | (512x256)   |
| (256x256)   +-------------+
|             | Halo        |
|             | (256x256)   |
+-------------+-------------+
| Starburst   | Ghost 1     |
| (512x512)   | (128x128)   |
|             +-------------+
|             | Ghost 2     |
|             | (128x128)   |
+-------------+-------------+
```

**UV Remapping:**
```typescript
// Atlas layout definition
const atlasLayout = {
    centralGlow: { x: 0, y: 0, width: 256, height: 256 },
    streak: { x: 256, y: 0, width: 512, height: 256 },
    halo: { x: 256, y: 256, width: 256, height: 256 },
    starburst: { x: 0, y: 512, width: 512, height: 512 },
    // ...
};

// Convert 0-1 UV to atlas UV
function remapUV(uv: vec2, region: AtlasRegion): vec2 {
    return {
        x: (uv.x * region.width + region.x) / atlasWidth,
        y: (uv.y * region.height + region.y) / atlasHeight
    };
}
```

**Shader implementation:**
```wgsl
// Pass atlas region as vec4 (xywh) per instance
@location(7) atlas_region: vec4<f32>,  // (x, y, w, h) in pixels

// In fragment shader:
let atlas_uv = (in.uv * atlas_region.zw + atlas_region.xy) / vec2<f32>(1024.0);
let flare = textureSample(flare_atlas, sampler, atlas_uv);
```

### Texture Formats

**Standard (LDR):**
- `rgba8unorm` - Most common, smallest
- Good for subtle flares

**HDR (Bright Lights):**
- `rgba16float` - Half precision, wider range
- Allows values >1.0 for super-bright flares
- Essential for HDR rendering pipeline

**Compressed:**
- `bc7-rgba-unorm` (desktop) - Good quality, 4:1 compression
- Not all platforms support (mobile may need fallback)

**Recommended:** `rgba8unorm` for Miskatonic (retro aesthetic doesn't need HDR textures).

### Texture Filtering

**Sampler configuration:**
```typescript
const flareSampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
});
```

**Why clamp-to-edge:**
- Prevents edge bleeding in atlas
- Avoids wrap artifacts
- Smooth falloff to transparent

### Generating Textures

**Option 1: Procedural (Shader-Based)**

Use compute shader to generate at runtime:
```wgsl
@compute @workgroup_size(8, 8)
fn generate_flare(@builtin(global_invocation_id) id: vec3<u32>) {
    let uv = vec2<f32>(id.xy) / vec2<f32>(256.0);
    let center = vec2(0.5);
    let dist = length(uv - center);

    let intensity = exp(-dist * dist * 8.0);
    let color = vec4<f32>(vec3(intensity), intensity);

    textureStore(output_texture, id.xy, color);
}
```

**Pros:** No asset files, adjustable at runtime
**Cons:** Initial generation cost (~1ms)

**Option 2: Pre-Made Assets**

Create in image editor (Photoshop, GIMP, Krita):
- Radial gradients
- Motion blur for streaks
- Layer blending for complexity

**Pros:** Full artistic control
**Cons:** Need to load/manage files

**Recommended:** Pre-made assets for quality, procedural for prototyping.

---

## Additive Blending and HDR

### Additive Blending Fundamentals

**Formula:**
```
result = source + destination
```

**In terms of blend factors:**
```
result = (source * src_factor) + (destination * dst_factor)

For pure additive:
src_factor = ONE
dst_factor = ONE
```

**Effect:** Colors accumulate, creating brighter results.

### WebGPU Blend Configuration

```typescript
const lensFlareBlend: GPUBlendState = {
    color: {
        srcFactor: 'one',
        dstFactor: 'one',
        operation: 'add',
    },
    alpha: {
        srcFactor: 'one',
        dstFactor: 'one',
        operation: 'add',
    },
};

const pipelineDescriptor: GPURenderPipelineDescriptor = {
    // ... other config
    fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
            format: 'rgba16float',  // Or canvas format
            blend: lensFlareBlend,
            writeMask: GPUColorWrite.ALL,
        }],
    },
};
```

### Premultiplied Alpha

**Why premultiply?**
- Allows additive and alpha blending in same pass
- GPU-preferred format
- Avoids dark halos

**Premultiplication:**
```
// Standard alpha:
color = (R, G, B, A)

// Premultiplied:
color = (R*A, G*A, B*A, A)
```

**In shader:**
```wgsl
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let flare = textureSample(flare_texture, sampler, in.uv);
    let tinted = flare.rgb * in.color * in.intensity;

    // Premultiply alpha
    return vec4<f32>(tinted * flare.a, flare.a);
}
```

**Blend mode for premultiplied:**
```typescript
const premultipliedBlend: GPUBlendState = {
    color: {
        srcFactor: 'one',                  // Already multiplied by alpha
        dstFactor: 'one-minus-src-alpha',  // Standard alpha blend
        operation: 'add',
    },
    alpha: {
        srcFactor: 'one',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
    },
};
```

**For pure additive with premultiplied:**
Set alpha to zero in texture:
```
(R*0, G*0, B*0, 0) with blend (ONE, ONE) = pure additive
```

### HDR Considerations

**Problem:** Additive blending can exceed 1.0, which is clipped in LDR.

**Solution:** Render to HDR buffer (rgba16float), tonemap later.

**Pipeline:**
```
1. Render scene to HDR buffer (rgba16float)
2. Render lens flares additively to same buffer (can exceed 1.0)
3. Apply tonemapping (HDR → LDR)
4. Apply gamma correction
5. Output to display (rgba8unorm)
```

**Without HDR:**
```
Light intensity: 2.0
Flare contribution: +1.5
Total: 3.5 → clamped to 1.0 (white, washed out)
```

**With HDR:**
```
Light intensity: 2.0
Flare contribution: +1.5
Total: 3.5 (preserved)
Tonemapping: 3.5 → 0.95 (bright but not clipped)
```

**Miskatonic Integration:**
Your `RetroPostProcessor` already uses HDR (`rgba16float` textures). Lens flares fit naturally **before** the composite/tonemapping stage.

### Avoiding Dark Halos

**Problem:** Transparent edges with non-premultiplied alpha blend to dark.

**Example:**
```
Texture edge: (1.0, 1.0, 1.0, 0.1)  // Nearly transparent white
Background: (0.5, 0.5, 0.5, 1.0)    // Gray

Blend (src-alpha, one-minus-src-alpha):
result.rgb = (1.0 * 0.1) + (0.5 * 0.9) = 0.1 + 0.45 = 0.55

But at full alpha:
result.rgb = (1.0 * 1.0) + (0.5 * 0.0) = 1.0

Gradient appears darker at edges (halo artifact)
```

**Solution:** Premultiply alpha, use (ONE, ONE-MINUS-SRC-ALPHA) blend.

**Or for additive:** Just use (ONE, ONE) and let it accumulate.

---

## WebGPU/WGSL Implementation

### Complete Shader Example

#### Vertex Shader

```wgsl
// Uniforms
struct Uniforms {
    viewport_size: vec2<f32>,
    anamorphic_ratio: f32,
    _padding: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// Vertex input
struct VertexInput {
    // Per-vertex (quad)
    @location(0) quad_pos: vec2<f32>,   // (-1,-1) to (1,1)
    @location(1) uv: vec2<f32>,         // (0,0) to (1,1)

    // Per-instance (light)
    @location(2) screen_pos: vec2<f32>, // NDC position
    @location(3) color: vec3<f32>,
    @location(4) intensity: f32,
    @location(5) size: f32,
    @location(6) atlas_region: vec4<f32>,  // (x, y, w, h) in texels
}

// Vertex output
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) color: vec3<f32>,
    @location(2) intensity: f32,
    @location(3) atlas_region: vec4<f32>,
}

@vertex
fn vs_lens_flare(in: VertexInput) -> VertexOutput {
    // Convert pixel size to NDC
    let ndc_size = in.size / uniforms.viewport_size;

    // Apply anamorphic stretch
    let stretched_size = vec2<f32>(
        ndc_size * uniforms.anamorphic_ratio,
        ndc_size
    );

    // Position quad in screen space
    let ndc_pos = in.screen_pos + in.quad_pos * stretched_size;

    var out: VertexOutput;
    out.position = vec4<f32>(ndc_pos, 0.0, 1.0);
    out.uv = in.uv;
    out.color = in.color;
    out.intensity = in.intensity;
    out.atlas_region = in.atlas_region;
    return out;
}
```

#### Fragment Shader

```wgsl
@group(0) @binding(1) var flare_atlas: texture_2d<f32>;
@group(0) @binding(2) var flare_sampler: sampler;

struct AtlasInfo {
    size: vec2<f32>,  // Atlas dimensions (e.g., 1024x1024)
    _padding: vec2<f32>,
}

@group(0) @binding(3) var<uniform> atlas_info: AtlasInfo;

@fragment
fn fs_lens_flare(in: VertexOutput) -> @location(0) vec4<f32> {
    // Remap UV to atlas region
    let atlas_uv = (in.uv * in.atlas_region.zw + in.atlas_region.xy) / atlas_info.size;

    // Sample flare texture
    let flare = textureSample(flare_atlas, flare_sampler, atlas_uv);

    // Apply light color and intensity
    let tinted = flare.rgb * in.color * in.intensity;

    // Premultiply alpha for correct blending
    return vec4<f32>(tinted * flare.a, flare.a);
}
```

### Pipeline Setup

```typescript
// Create shader module
const shaderModule = device.createShaderModule({
    code: lensFlareShaderSource,
});

// Vertex buffer layouts
const vertexBufferLayouts: GPUVertexBufferLayout[] = [
    // Quad vertices (shared)
    {
        arrayStride: 16,  // vec2 pos + vec2 uv
        stepMode: 'vertex',
        attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },  // pos
            { shaderLocation: 1, offset: 8, format: 'float32x2' },  // uv
        ],
    },

    // Instance data
    {
        arrayStride: 48,  // 12 floats
        stepMode: 'instance',
        attributes: [
            { shaderLocation: 2, offset: 0, format: 'float32x2' },   // screen_pos
            { shaderLocation: 3, offset: 8, format: 'float32x3' },   // color
            { shaderLocation: 4, offset: 20, format: 'float32' },    // intensity
            { shaderLocation: 5, offset: 24, format: 'float32' },    // size
            { shaderLocation: 6, offset: 28, format: 'float32x4' },  // atlas_region
        ],
    },
];

// Blend state (additive)
const blendState: GPUBlendState = {
    color: {
        srcFactor: 'one',
        dstFactor: 'one',
        operation: 'add',
    },
    alpha: {
        srcFactor: 'one',
        dstFactor: 'one',
        operation: 'add',
    },
};

// Create pipeline
const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
        module: shaderModule,
        entryPoint: 'vs_lens_flare',
        buffers: vertexBufferLayouts,
    },
    fragment: {
        module: shaderModule,
        entryPoint: 'fs_lens_flare',
        targets: [{
            format: 'rgba16float',  // HDR buffer
            blend: blendState,
        }],
    },
    primitive: {
        topology: 'triangle-list',
        cullMode: 'none',  // Billboard, always front-facing
    },
    // No depth stencil (render over scene)
});
```

### Quad Geometry

```typescript
// Two triangles forming a quad
const quadVertices = new Float32Array([
    // Position      UV
    -1, -1,         0, 0,  // Bottom-left
     1, -1,         1, 0,  // Bottom-right
    -1,  1,         0, 1,  // Top-left

    -1,  1,         0, 1,  // Top-left
     1, -1,         1, 0,  // Bottom-right
     1,  1,         1, 1,  // Top-right
]);

const quadBuffer = device.createBuffer({
    size: quadVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
});

new Float32Array(quadBuffer.getMappedRange()).set(quadVertices);
quadBuffer.unmap();
```

### Instance Data Preparation

```typescript
interface LightProjection {
    screenPos: [number, number];  // NDC
    color: [number, number, number];
    intensity: number;
    size: number;
    atlasRegion: [number, number, number, number];  // x, y, w, h
}

function projectLights(
    lights: LightData[],
    viewProj: Mat4,
    depthTexture: GPUTexture
): LightProjection[] {
    const visible: LightProjection[] = [];

    for (const light of lights) {
        // Project to clip space
        const worldPos = vec4.fromValues(light.x, light.y, light.z, 1.0);
        const clip = vec4.create();
        vec4.transformMat4(clip, worldPos, viewProj);

        // Perspective divide
        const ndc = {
            x: clip[0] / clip[3],
            y: clip[1] / clip[3],
            z: clip[2] / clip[3],
        };

        // Cull if behind camera or outside frustum
        if (ndc.z < 0 || ndc.z > 1) continue;
        if (Math.abs(ndc.x) > 1.2 || Math.abs(ndc.y) > 1.2) continue;

        // Test occlusion (simple depth test)
        const uv = { x: ndc.x * 0.5 + 0.5, y: -ndc.y * 0.5 + 0.5 };
        const sceneDepth = sampleDepth(depthTexture, uv);
        if (sceneDepth < ndc.z - 0.01) continue;  // Occluded

        // Determine atlas region based on light type/properties
        const region = getAtlasRegion(light);

        visible.push({
            screenPos: [ndc.x, ndc.y],
            color: [light.colorR, light.colorG, light.colorB],
            intensity: light.intensity,
            size: 100,  // Base size in pixels
            atlasRegion: region,
        });
    }

    return visible;
}
```

### Render Pass

```typescript
function renderLensFlares(
    passEncoder: GPURenderPassEncoder,
    visibleLights: LightProjection[],
    pipeline: GPURenderPipeline,
    quadBuffer: GPUBuffer,
    instanceBuffer: GPUBuffer,
    bindGroup: GPUBindGroup
) {
    if (visibleLights.length === 0) return;

    // Update instance buffer
    const instanceData = new Float32Array(visibleLights.length * 12);
    for (let i = 0; i < visibleLights.length; i++) {
        const light = visibleLights[i];
        const offset = i * 12;
        instanceData[offset + 0] = light.screenPos[0];
        instanceData[offset + 1] = light.screenPos[1];
        instanceData[offset + 2] = light.color[0];
        instanceData[offset + 3] = light.color[1];
        instanceData[offset + 4] = light.color[2];
        instanceData[offset + 5] = light.intensity;
        instanceData[offset + 6] = light.size;
        instanceData[offset + 7] = light.atlasRegion[0];
        instanceData[offset + 8] = light.atlasRegion[1];
        instanceData[offset + 9] = light.atlasRegion[2];
        instanceData[offset + 10] = light.atlasRegion[3];
        instanceData[offset + 11] = 0;  // Padding
    }

    device.queue.writeBuffer(instanceBuffer, 0, instanceData);

    // Render
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, quadBuffer);
    passEncoder.setVertexBuffer(1, instanceBuffer);
    passEncoder.draw(6, visibleLights.length, 0, 0);
}
```

### Depth Buffer Sampling (CPU-Side)

```typescript
// Simple CPU-side depth sampling for occlusion test
async function sampleDepth(
    depthTexture: GPUTexture,
    uv: { x: number; y: number }
): Promise<number> {
    const x = Math.floor(uv.x * depthTexture.width);
    const y = Math.floor(uv.y * depthTexture.height);

    // Create staging buffer
    const stagingBuffer = device.createBuffer({
        size: 4,  // Single depth value (f32)
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    // Copy single texel to buffer
    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyTextureToBuffer(
        { texture: depthTexture, origin: { x, y, z: 0 } },
        { buffer: stagingBuffer, bytesPerRow: 256 },
        { width: 1, height: 1, depthOrArrayLayers: 1 }
    );
    device.queue.submit([commandEncoder.finish()]);

    // Read back
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const data = new Float32Array(stagingBuffer.getMappedRange());
    const depth = data[0];
    stagingBuffer.unmap();
    stagingBuffer.destroy();

    return depth;
}
```

**Note:** CPU-side sampling is slow (GPU stall). For production, use compute shader or accept 1-frame latency with occlusion queries.

---

## Performance Optimization

### Baseline Performance

**Instanced rendering (10 lights):**
- Vertex shader: 60 invocations (6 vertices × 10 instances) = ~0.001ms
- Fragment shader: ~50,000 pixels (assuming 100×100 quad × 10 lights, half covered) = ~0.01ms
- Total: ~0.011ms

**Scaling:**
```
10 lights:   ~0.01ms
50 lights:   ~0.05ms
100 lights:  ~0.1ms
500 lights:  ~0.5ms (fillrate-bound)
```

### Optimization 1: Frustum Culling

**Concept:** Don't render lights outside camera view.

```typescript
function frustumCull(lights: LightData[], viewProj: Mat4): LightData[] {
    return lights.filter(light => {
        const clip = projectToClip(light.position, viewProj);
        const ndc = {
            x: clip.x / clip.w,
            y: clip.y / clip.w,
            z: clip.z / clip.w,
        };

        // Add margin for flare size
        const margin = 0.2;
        return (
            ndc.z > 0 &&  // In front of camera
            Math.abs(ndc.x) < 1 + margin &&
            Math.abs(ndc.y) < 1 + margin
        );
    });
}
```

**Benefit:** Skip off-screen lights entirely (no GPU work).

### Optimization 2: Distance-Based LOD

**Concept:** Smaller/simpler flares for distant lights.

```typescript
function assignLOD(light: LightData, cameraPos: Vec3): number {
    const dist = distance(light.position, cameraPos);

    if (dist < 10) return 0;   // Full quality (large quad)
    if (dist < 50) return 1;   // Medium (smaller quad)
    return 2;                  // Distant (tiny quad or skip)
}

// Use LOD to determine size and atlas region
const size = [100, 50, 20][lod];
const region = atlasRegions[lod];
```

**Benefit:** Reduce fillrate for distant lights.

### Optimization 3: Intensity Threshold

**Concept:** Skip very dim lights (won't be visible).

```typescript
const MIN_INTENSITY = 0.1;

function filterByIntensity(lights: LightData[]): LightData[] {
    return lights.filter(light => light.intensity >= MIN_INTENSITY);
}
```

**Benefit:** Reduce instance count.

### Optimization 4: Occlusion Culling

**Already covered.** Depth testing skips occluded lights.

### Optimization 5: Texture Atlas

**Already covered.** Single texture bind for all flares.

### Optimization 6: Reduced Quad Resolution

**Concept:** Render smaller quads, rely on texture filtering for quality.

```typescript
// Instead of 200×200 pixel quad:
const size = 100;  // 100×100 pixel quad

// Texture filtering smooths appearance
```

**Benefit:** 4x less fillrate.

**Trade-off:** Slightly softer flares (acceptable for retro).

### Optimization 7: Skip Depth Sampling (Accept Occlusion Lag)

**Concept:** Use previous frame's visibility, avoid CPU stall.

```typescript
// Frame N:
const visible = visibleLightsFromPreviousFrame;  // 1-frame-old data
renderFlares(visible);

// Frame N+1:
updateVisibilityAsync();  // Compute for next frame
```

**Benefit:** No GPU synchronization stall.

**Trade-off:** Flares may linger 1 frame when light goes behind object (not noticeable).

### Optimization 8: Batch State Changes

**Concept:** Group all flare rendering in single pass.

```
Bad:
  Set pipeline
  Draw 10 flares
  Set other pipeline
  Draw 5 more flares  // Wasted pipeline switch

Good:
  Set pipeline once
  Draw all 15 flares
```

**Already achieved with instancing.**

### Performance Budget Allocation

**For Miskatonic (60 FPS = 16.67ms):**

```
Scene rendering:       ~8ms
Physics:               ~2ms
ECS updates:           ~1ms
Post-processing:       ~2ms (includes bloom)
Lens flares:           ~0.1ms (target)
UI/other:              ~1ms
Slack:                 ~2.57ms
```

**0.1ms lens flare budget allows:**
- 100 visible lights with simple flares
- 50 visible lights with complex flares
- 10 visible lights with occlusion queries

---

## Integration with Miskatonic Engine

### ECS Integration

#### Light Component Extension

Add lens flare flags to existing Light component:

```typescript
// In @miskatonic/ecs
export interface LightComponentData {
    // ... existing fields

    /** Enable lens flare for this light */
    lensFlare: number;  // 0 = disabled, 1 = enabled

    /** Lens flare intensity multiplier (0-1) */
    lensFlareIntensity: number;

    /** Lens flare size multiplier (0-2) */
    lensFlareSize: number;

    /** Atlas region index (0-7) */
    lensFlareType: number;
}
```

#### LensFlareSystem

New system in rendering package:

```typescript
// packages/rendering/src/LensFlareSystem.ts

import { LightSystem } from './LightSystem';
import type { IRendererBackend } from './backends';

export interface LensFlareConfig {
    enabled: boolean;
    anamorphicRatio: number;  // 1.0-3.0
    globalIntensity: number;  // Master brightness
    atlasTexture: BackendTextureHandle;
}

export class LensFlareSystem {
    private backend: IRendererBackend;
    private lightSystem: LightSystem;
    private config: LensFlareConfig;

    // GPU resources
    private pipeline: GPURenderPipeline;
    private quadBuffer: GPUBuffer;
    private instanceBuffer: GPUBuffer;
    private bindGroup: GPUBindGroup;

    constructor(
        backend: IRendererBackend,
        lightSystem: LightSystem,
        config: Partial<LensFlareConfig> = {}
    ) {
        this.backend = backend;
        this.lightSystem = lightSystem;
        this.config = {
            enabled: config.enabled ?? true,
            anamorphicRatio: config.anamorphicRatio ?? 2.0,
            globalIntensity: config.globalIntensity ?? 1.0,
            atlasTexture: config.atlasTexture!,
        };

        this.initializeResources();
    }

    render(
        commandEncoder: GPUCommandEncoder,
        targetTexture: GPUTexture,
        depthTexture: GPUTexture,
        viewProj: Mat4,
        cameraPos: Vec3
    ): void {
        if (!this.config.enabled) return;

        // Get lights from LightSystem
        const allLights = [
            ...this.lightSystem.getPointLights(),
            ...this.lightSystem.getSpotLights(),
        ];

        // Filter for lens flare enabled
        const flareLights = allLights.filter(light => light.lensFlare > 0);

        // Project and cull
        const visible = this.projectAndCullLights(
            flareLights,
            viewProj,
            depthTexture,
            cameraPos
        );

        if (visible.length === 0) return;

        // Render
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: targetTexture.createView(),
                loadOp: 'load',  // Preserve existing scene
                storeOp: 'store',
            }],
        });

        this.renderFlares(passEncoder, visible);

        passEncoder.end();
    }

    private projectAndCullLights(
        lights: LightData[],
        viewProj: Mat4,
        depthTexture: GPUTexture,
        cameraPos: Vec3
    ): LightProjection[] {
        // Implementation from earlier sections
        // ...
    }

    private renderFlares(
        passEncoder: GPURenderPassEncoder,
        visible: LightProjection[]
    ): void {
        // Implementation from earlier sections
        // ...
    }

    // ... other methods
}
```

### Rendering Pipeline Integration

Insert lens flare rendering after scene, before post-processing:

```typescript
// In WebGPUBackend.render()

// 1. Render scene to sceneColorTexture (with depth)
this.renderScene(commandEncoder, sceneColorTexture, sceneDepthTexture);

// 2. Render lens flares (additive to sceneColorTexture)
if (this.lensFlareSystem) {
    this.lensFlareSystem.render(
        commandEncoder,
        sceneColorTexture,      // Target (HDR)
        sceneDepthTexture,      // For occlusion testing
        this.camera.viewProjectionMatrix,
        this.camera.position
    );
}

// 3. Post-processing (bloom, CRT, dithering, etc.)
this.retroPostProcessor.process(
    commandEncoder,
    sceneColorTexture,  // Input (now includes flares)
    swapChainTexture    // Output
);
```

**Order is critical:**
- Scene → Lens flares → Bloom → Tonemap
- Lens flares benefit from bloom (further glow)
- Tonemapping handles HDR accumulation

### Asset Management

```typescript
// packages/resources or packages/rendering

export class LensFlareAtlasLoader {
    static async loadAtlas(device: GPUDevice): Promise<GPUTexture> {
        // Load from file or generate procedurally
        const imageData = await fetch('/assets/textures/lens_flare_atlas.png')
            .then(res => res.blob())
            .then(blob => createImageBitmap(blob));

        const texture = device.createTexture({
            size: [imageData.width, imageData.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING |
                   GPUTextureUsage.COPY_DST |
                   GPUTextureUsage.RENDER_ATTACHMENT,
        });

        device.queue.copyExternalImageToTexture(
            { source: imageData },
            { texture },
            [imageData.width, imageData.height, 1]
        );

        return texture;
    }
}
```

### Configuration Presets

```typescript
export const LENS_FLARE_PRESETS = {
    RETRO_SUBTLE: {
        enabled: true,
        anamorphicRatio: 1.8,
        globalIntensity: 0.6,
    },

    RETRO_INTENSE: {
        enabled: true,
        anamorphicRatio: 2.5,
        globalIntensity: 1.2,
    },

    CINEMATIC: {
        enabled: true,
        anamorphicRatio: 2.0,
        globalIntensity: 0.8,
    },

    DISABLED: {
        enabled: false,
        anamorphicRatio: 1.0,
        globalIntensity: 0.0,
    },
};
```

### Debug Console Commands

```typescript
// In @miskatonic/debug-console

commands.register('lensflare.enabled', (enabled: boolean) => {
    lensFlareSystem.config.enabled = enabled;
});

commands.register('lensflare.ratio', (ratio: number) => {
    lensFlareSystem.config.anamorphicRatio = Math.max(1.0, Math.min(3.0, ratio));
});

commands.register('lensflare.intensity', (intensity: number) => {
    lensFlareSystem.config.globalIntensity = Math.max(0.0, Math.min(2.0, intensity));
});

commands.register('lensflare.stats', () => {
    const stats = lensFlareSystem.getStats();
    console.log(`Lens Flare Stats:
        Visible lights: ${stats.visibleCount}
        Render time: ${stats.renderTimeMs.toFixed(3)}ms
        Total instances: ${stats.instanceCount}
    `);
});
```

### Performance Metrics

Add to existing stats system:

```typescript
interface RenderingStats {
    // ... existing stats

    lensFlare: {
        lightsTotal: number;
        lightsVisible: number;
        lightsCulled: number;
        renderTimeMs: number;
    };
}
```

### Testing

```typescript
// packages/rendering/tests/LensFlareSystem.test.ts

describe('LensFlareSystem', () => {
    it('should cull lights outside frustum');
    it('should skip occluded lights');
    it('should project lights to screen space correctly');
    it('should apply anamorphic ratio to quad size');
    it('should handle zero visible lights without error');
    it('should scale intensity by light properties');
});
```

---

## References and Resources

### Classic Techniques

1. **Mark J. Kilgard (1999)**
   *"Fast OpenGL-rendering of Lens Flares"*
   https://www.opengl.org/archives/resources/features/KilgardTechniques/LensFlare/
   The definitive sprite-based lens flare technique

2. **Alien Scribble Interactive**
   *"XNA Lens Flare Occlusion"*
   https://www.alienscribbleinteractive.com/Tutorials/light_obstruction_tutorial.html
   Practical occlusion query implementation

### Billboard Rendering

3. **OGLDev Tutorial 27**
   *"Billboarding and the Geometry Shader"*
   https://www.ogldev.org/www/tutorial27/tutorial27.html
   Comprehensive billboarding techniques

4. **OpenGL Tutorial**
   *"Billboards & Particles"*
   http://www.opengl-tutorial.org/intermediate-tutorials/billboards-particles/
   Billboard math and camera-facing quads

### Instanced Rendering

5. **WebGPU Fundamentals**
   *"Vertex Buffers"*
   https://webgpufundamentals.org/webgpu/lessons/webgpu-vertex-buffers.html
   Per-vertex vs per-instance attributes

6. **Learn Wgpu**
   *"Instancing"*
   https://sotrh.github.io/learn-wgpu/beginner/tutorial7-instancing/
   WebGPU instancing tutorial with code

7. **Geeks3D**
   *"Particle Rendering: Point Sprites vs Geometry Instancing"*
   https://www.geeks3d.com/20140929/test-particle-rendering-point-sprites-vs-geometry-instancing-based-billboards/
   Performance comparison

### Blending and Transparency

8. **WebGPU Fundamentals**
   *"Transparency and Blending"*
   https://webgpufundamentals.org/webgpu/lessons/webgpu-transparency.html
   Complete WebGPU blend configuration guide

9. **A Mind Forever Programming**
   *"Why Alpha Premultiplied Colour Blending Rocks"*
   http://amindforeverprogramming.blogspot.com/2013/07/why-alpha-premultiplied-colour-blending.html
   Premultiplied alpha explained

10. **Bartosz Ciechanowski**
    *"Alpha Compositing"*
    https://ciechanow.ski/alpha-compositing/
    Interactive visual explanation

### Occlusion Testing

11. **NVIDIA GPU Gems**
    *"Chapter 29: Efficient Occlusion Culling"*
    https://developer.nvidia.com/gpugems/gpugems/part-v-performance-and-practicalities/chapter-29-efficient-occlusion-culling
    Occlusion query techniques

12. **NVIDIA GPU Gems 2**
    *"Chapter 6: Hardware Occlusion Queries Made Useful"*
    https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-6-hardware-occlusion-queries-made-useful
    Advanced occlusion strategies

### Anamorphic Optics

13. **Bart Wronski**
    *"Anamorphic lens flares and visual effects"*
    https://bartwronski.com/2015/03/09/anamorphic-lens-flares-and-visual-effects/
    Aspect ratio squeeze technique

14. **Photography Stack Exchange**
    *"How do anamorphic lenses produce lens flare 'streaks'?"*
    https://photo.stackexchange.com/questions/42472/
    Optical physics explanation

### Texture Design

15. **Autodesk VRED**
    *"About Lens Flares and Elements"*
    https://knowledge.autodesk.com/support/vred-products/learn-explore/caas/CloudHelp/cloudhelp/2022/ENU/VRED-Lights/files/VRED-Lights-About-Lens-Flares-and-Elements-html-html.html
    Flare element types and design

16. **Real Time VFX**
    *"Circle halo / lens flare textures"*
    https://realtimevfx.com/t/circle-halo-lens-flare-textures/10527
    Texture design discussion and examples

### WebGPU Specifics

17. **WebGPU Fundamentals**
    *"Post Processing"*
    https://webgpufundamentals.org/webgpu/lessons/webgpu-post-processing.html
    Render pass setup, textures

18. **Learn Wgpu**
    *"The Depth Buffer"*
    https://sotrh.github.io/learn-wgpu/beginner/tutorial8-depth/
    Depth texture usage

19. **GitHub: gpuweb/gpuweb**
    *"Discussion #2277: Depth buffer sampling"*
    https://github.com/gpuweb/gpuweb/discussions/2277
    WebGPU depth sampling specifics

### Performance

20. **Unity Discussions**
    *"Lens Flare Performance"*
    https://discussions.unity.com/t/lens-flare-consumes-too-much-performance-on-the-cpu-and-gpu/859326
    Real-world performance data

21. **Intel Developer Zone**
    *"Unity Performance Optimizations: Best Practices"*
    Draw call batching and instancing

---

## Appendix: Quick Reference

### Implementation Checklist

#### Phase 1: Basic Sprite Rendering
- [ ] Create quad vertex buffer (6 vertices, 2 triangles)
- [ ] Design or load flare texture (256×256 grayscale gradient)
- [ ] Write vertex shader (screen-space billboard)
- [ ] Write fragment shader (texture sample + tint)
- [ ] Set up additive blending pipeline
- [ ] Render single test light

#### Phase 2: Multiple Lights
- [ ] Set up per-instance vertex buffer layout
- [ ] Add instance attributes (position, color, size)
- [ ] Update vertex shader for instancing
- [ ] Project lights from world to screen space (CPU)
- [ ] Render N lights with single draw call

#### Phase 3: Occlusion Testing
- [ ] Implement simple depth test (sample depth buffer at light position)
- [ ] Filter occluded lights before rendering
- [ ] Test with objects blocking lights

#### Phase 4: Anamorphic Effect
- [ ] Add anamorphic ratio uniform
- [ ] Modify vertex shader to stretch quad horizontally
- [ ] Or: Design horizontal streak texture
- [ ] Adjust ratio parameter (1.5-3.0)

#### Phase 5: Texture Atlas
- [ ] Create atlas with multiple flare elements
- [ ] Define atlas regions (x, y, w, h)
- [ ] Add atlas region as per-instance attribute
- [ ] Update fragment shader UV remapping

#### Phase 6: Integration
- [ ] Add lensFlare flag to Light component
- [ ] Create LensFlareSystem class
- [ ] Integrate with rendering pipeline (after scene, before post)
- [ ] Add debug console commands
- [ ] Add performance metrics

#### Phase 7: Polish
- [ ] Tune sizes, intensities, colors
- [ ] Add distance-based LOD
- [ ] Test with many lights (50+)
- [ ] Profile and optimize

### Parameter Reference

| Parameter | Min | Max | Default | Purpose |
|-----------|-----|-----|---------|---------|
| Anamorphic Ratio | 1.0 | 3.0 | 2.0 | Horizontal stretch amount |
| Global Intensity | 0.0 | 2.0 | 1.0 | Master brightness multiplier |
| Light Size | 10 | 500 | 100 | Base quad size in pixels |
| Occlusion Epsilon | 0.001 | 0.1 | 0.01 | Depth test tolerance |
| Intensity Threshold | 0.0 | 1.0 | 0.1 | Minimum intensity to render |

### Atlas Layout Template

```
1024×1024 Atlas Layout:

+------------------+------------------+
|   Central Glow   | Horizontal Streak|
|   (256×256)      |   (512×256)      |
|   Region: 0,0    |   Region: 256,0  |
+------------------+--------+---------+
|      Halo        | Ghost1 | Ghost2  |
|   (256×256)      | 128×128| 128×128 |
|   Region: 0,256  | 256,256| 384,256 |
+------------------+--------+---------+
|    Starburst     |    Custom        |
|   (512×512)      |   (256×256)      |
|   Region: 0,512  |   Region: 512,512|
+------------------+------------------+
```

### Performance Targets

| Scenario | Lights | Expected Time | Notes |
|----------|--------|---------------|-------|
| Minimal | 1-5 | <0.01ms | Single small flares |
| Typical | 10-20 | ~0.02ms | Mixed sizes |
| Heavy | 50-100 | ~0.1ms | With culling |
| Extreme | 500+ | ~0.5ms | Fillrate-bound |

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Flares render black | Additive blend not set | Check blend state (ONE, ONE) |
| Dark halos around edges | Non-premultiplied alpha | Premultiply in shader or texture |
| Flares behind objects | No occlusion test | Implement depth sampling |
| Flickers/pops | Incorrect NDC projection | Verify projection math |
| Stretched wrong direction | UV or quad size incorrect | Check anamorphic axis (X not Y) |
| No flares visible | Behind camera or culled | Check frustum culling, z-test |
| Performance poor | Too many instances or large quads | Add LOD, reduce sizes |

---

**End of Document**

*This research provides comprehensive technical foundation for implementing light-entity based anamorphic lens flares in the Miskatonic Engine using modern WebGPU techniques adapted from classic sprite-based rendering methods.*