# Bloom Mip Pyramid Implementation Guide

**Status:** Ready for Implementation
**Estimated Time:** 3-4 hours
**Complexity:** HIGH - ~735 LOC changes
**Risk Level:** MEDIUM (requires careful testing at each step)

---

## Executive Summary

The current bloom implementation is fundamentally broken - it uses a single-resolution blur that produces vertical streaks instead of proper radial glow. This guide documents the complete migration to an industry-standard mip pyramid bloom system.

**Problem:**
- Current: Single 160x120 blur → 4x upscale → blocky/invisible bloom
- Vertical streak artifacts from inadequate blur coverage

**Solution:**
- Mip pyramid: 5 levels of progressive downsampling + blurring
- Additive upsampling with proper blend accumulation
- Industry-standard approach (wgpu-bloom, Unreal, Unity HDRP, Call of Duty)

---

## Critical Issues to Fix

### P0 - SHOWSTOPPERS

#### 1. Bind Group Thrashing (RetroPostProcessor.ts:585-628)
**Current code creates/destroys 15+ bind groups per frame.**

```typescript
// WRONG - Creates bind group every frame
const textureBindGroup = this.backend.createBindGroup(this.extractTextureLayout, {...});
// ... use bind group ...
this.backend.deleteBindGroup(textureBindGroup);  // Destroys it immediately
```

**Impact:** 10-20ms bloom cost instead of 2ms
**Fix:** Cache bind groups, recreate only on resize

### P1 - BLOCKERS

#### 2. Missing Additive Blend State
Upsample pipeline needs additive blending to accumulate mip levels.

```typescript
// ADD to upsample pipeline creation
blend: {
  enabled: true,
  srcFactor: 'one',
  dstFactor: 'one',
  operation: 'add'
}
```

**Impact:** Bloom won't accumulate correctly (visual corruption)

#### 3. Unused Threshold Parameter
Downsample shader declares `threshold` but never uses it.

**Fix:** Remove from `DownsampleParams` struct (lines 7-11 of bloom-downsample.wgsl)

---

## Architecture Overview

### Current (BROKEN)
```
Scene (640x480 internal)
  ↓ Extract bright pixels
Bloom Extract (160x120)
  ↓ Horizontal Blur (5-tap)
  ↓ Vertical Blur (5-tap)
Bloom Result (160x120)
  ↓ Composite (4x upscale)
Final Output
```

### Target (CORRECT)
```
Scene (640x480)
  ↓ Extract bright pixels
Bloom Extract (160x120) - Level 0
  ↓ Downsample + Blur
Level 1 (80x60)
  ↓ Downsample + Blur
Level 2 (40x30)
  ↓ Downsample + Blur
Level 3 (20x15)
  ↓ Downsample + Blur
Level 4 (10x8)
  ↓ Upsample (additive blend)
Level 3 (accumulated)
  ↓ Upsample (additive blend)
Level 2 (accumulated)
  ↓ Upsample (additive blend)
Level 1 (accumulated)
  ↓ Upsample (additive blend)
Level 0 (accumulated)
  ↓ Composite
Final Output
```

---

## Implementation Plan

### Phase 1: Fix Critical Issues (30 minutes)

#### Fix Downsample Shader
**File:** `packages/rendering/src/retro/shaders/bloom-downsample.wgsl`

```diff
 struct DownsampleParams {
   texelSize: vec2<f32>,
-  threshold: f32,  // Only used in first downsample from extract
-  _padding: f32,
+  _padding: vec2<f32>,
 }
```

Bloom extract already applies threshold - don't duplicate in downsample.

#### Add Blend State Validation
**File:** `packages/rendering/src/retro/RetroPostProcessor.ts`

When creating upsample pipeline, add TODO comment for now:
```typescript
// TODO: Add blend state when implementing mip pyramid
// blend: { enabled: true, srcFactor: 'one', dstFactor: 'one', operation: 'add' }
```

### Phase 2: 2-Level POC (1-2 hours)

#### Step 2.1: Update Properties (Lines 50-107)

```diff
 // Render targets
 private bloomExtractTexture: BackendTextureHandle | null = null;
-private bloomBlurTexture: BackendTextureHandle | null = null;
-private bloomTempTexture: BackendTextureHandle | null = null;
+private bloomMip0Texture: BackendTextureHandle | null = null;  // 160x120
+private bloomMip1Texture: BackendTextureHandle | null = null;  // 80x60

 // Framebuffers
 private bloomExtractFramebuffer: BackendFramebufferHandle | null = null;
-private bloomTempFramebuffer: BackendFramebufferHandle | null = null;
-private bloomBlurFramebuffer: BackendFramebufferHandle | null = null;
+private bloomMip0Framebuffer: BackendFramebufferHandle | null = null;
+private bloomMip1Framebuffer: BackendFramebufferHandle | null = null;

 // Pipelines
-private bloomBlurPipeline: BackendPipelineHandle | null = null;
+private bloomDownsamplePipeline: BackendPipelineHandle | null = null;
+private bloomUpsamplePipeline: BackendPipelineHandle | null = null;

 // Uniform buffers
-private blurParamsBuffer: BackendBufferHandle | null = null;
+private downsampleParamsBuffer: BackendBufferHandle | null = null;
+private upsampleParamsBuffer: BackendBufferHandle | null = null;

 // Shaders
-private bloomBlurShader: BackendShaderHandle | null = null;
+private bloomDownsampleShader: BackendShaderHandle | null = null;
+private bloomUpsampleShader: BackendShaderHandle | null = null;

 // Bind group layouts
-private blurTextureLayout: BackendBindGroupLayoutHandle | null = null;
-private blurUniformLayout: BackendBindGroupLayoutHandle | null = null;
+private downsampleTextureLayout: BackendBindGroupLayoutHandle | null = null;
+private downsampleUniformLayout: BackendBindGroupLayoutHandle | null = null;
+private upsampleTextureLayout: BackendBindGroupLayoutHandle | null = null;
+private upsampleUniformLayout: BackendBindGroupLayoutHandle | null = null;
```

**Remove these (no longer needed for 2-level POC):**
```diff
-private bloomBlurHorizontalBindGroup: BackendBindGroupHandle | null = null;
-private bloomBlurVerticalBindGroup: BackendBindGroupHandle | null = null;
```

#### Step 2.2: Update Shader Initialization (Lines 279-297)

```diff
-this.bloomBlurShader = this.backend.createShader('retro-bloom-blur', {
-  vertex: bloomBlurWGSL,
-  fragment: bloomBlurWGSL,
-});
+this.bloomDownsampleShader = this.backend.createShader('retro-bloom-downsample', {
+  vertex: bloomDownsampleWGSL,
+  fragment: bloomDownsampleWGSL,
+});
+
+this.bloomUpsampleShader = this.backend.createShader('retro-bloom-upsample', {
+  vertex: bloomUpsampleWGSL,
+  fragment: bloomUpsampleWGSL,
+});
```

#### Step 2.3: Update Bind Group Layouts (Lines 303-367)

```diff
-// Blur texture layout (1 texture + sampler)
-this.blurTextureLayout = this.backend.createBindGroupLayout('retro-blur-tex', [
+// Downsample texture layout (1 texture + sampler)
+this.downsampleTextureLayout = this.backend.createBindGroupLayout('retro-downsample-tex', [
   { binding: 0, visibility: 'fragment', type: 'texture' },
   { binding: 1, visibility: 'fragment', type: 'sampler' },
 ]);

-// Blur uniform layout (direction + blur radius)
-this.blurUniformLayout = this.backend.createBindGroupLayout('retro-blur-uniform', [
+// Downsample uniform layout (texelSize)
+this.downsampleUniformLayout = this.backend.createBindGroupLayout('retro-downsample-uniform', [
   { binding: 0, visibility: 'fragment', type: 'uniform' },
 ]);
+
+// Upsample texture layout (1 texture + sampler)
+this.upsampleTextureLayout = this.backend.createBindGroupLayout('retro-upsample-tex', [
+  { binding: 0, visibility: 'fragment', type: 'texture' },
+  { binding: 1, visibility: 'fragment', type: 'sampler' },
+]);
+
+// Upsample uniform layout (texelSize + blendFactor)
+this.upsampleUniformLayout = this.backend.createBindGroupLayout('retro-upsample-uniform', [
+  { binding: 0, visibility: 'fragment', type: 'uniform' },
+]);
```

#### Step 2.4: Update Texture Creation (Lines 178-230)

```diff
 // 2. Create bloom textures at quarter of INTERNAL resolution
 const bloomWidth = Math.max(64, Math.floor(this.width / 4));
 const bloomHeight = Math.max(64, Math.floor(this.height / 4));

-// Bloom extract texture
+// Bloom extract texture - bright pixels
 this.bloomExtractTexture = this.backend.createTexture(
   'retro-post-bloom-extract',
   bloomWidth,
   bloomHeight,
   null,
   { format: 'rgba' }
 );

-// Bloom temp texture - temporary for separable blur
-this.bloomTempTexture = this.backend.createTexture(
-  'retro-post-bloom-temp',
+// Mip level 0 (same size as extract)
+this.bloomMip0Texture = this.backend.createTexture(
+  'retro-post-bloom-mip0',
   bloomWidth,
   bloomHeight,
   null,
   { format: 'rgba' }
 );

-// Bloom blur texture - final blurred result
-this.bloomBlurTexture = this.backend.createTexture(
-  'retro-post-bloom-blur',
-  bloomWidth,
+// Mip level 1 (half size)
+const mip1Width = Math.max(4, Math.floor(bloomWidth / 2));
+const mip1Height = Math.max(4, Math.floor(bloomHeight / 2));
+this.bloomMip1Texture = this.backend.createTexture(
+  'retro-post-bloom-mip1',
+  mip1Width,
+  mip1Height,
+  null,
+  { format: 'rgba' }
+);
+
+// Create framebuffers
+this.bloomExtractFramebuffer = this.backend.createFramebuffer(
+  'retro-post-bloom-extract-fb',
+  [this.bloomExtractTexture],
+  undefined
+);
+
+this.bloomMip0Framebuffer = this.backend.createFramebuffer(
+  'retro-post-bloom-mip0-fb',
+  [this.bloomMip0Texture],
+  undefined
+);
+
+this.bloomMip1Framebuffer = this.backend.createFramebuffer(
+  'retro-post-bloom-mip1-fb',
+  [this.bloomMip1Texture],
+  undefined
+);
```

#### Step 2.5: Update Uniform Buffers (Lines 373-443)

```diff
-// Blur parameters buffer
-// struct BlurParams { direction: vec2, blurRadius: f32, _padding: f32 }
-const blurParamsData = new Float32Array(8); // 256-byte aligned (4 vec4s)
-this.blurParamsBuffer = this.backend.createBuffer('retro-blur-params', blurParamsData, 'uniform');
+// Downsample parameters buffer
+// struct DownsampleParams { texelSize: vec2, _padding: vec2 }
+const downsampleParamsData = new Float32Array(8);  // 256-byte aligned
+this.downsampleParamsBuffer = this.backend.createBuffer(
+  'retro-downsample-params',
+  downsampleParamsData,
+  'uniform'
+);
+
+// Upsample parameters buffer
+// struct UpsampleParams { texelSize: vec2, blendFactor: f32, _padding: f32 }
+const upsampleParamsData = new Float32Array(8);  // 256-byte aligned
+this.upsampleParamsBuffer = this.backend.createBuffer(
+  'retro-upsample-params',
+  upsampleParamsData,
+  'uniform'
+);
```

#### Step 2.6: Update Pipeline Creation (Lines 449-537)

```diff
-// Bloom blur pipeline (separable Gaussian)
-this.bloomBlurPipeline = this.backend.createRenderPipeline({
-  name: 'retro-bloom-blur',
-  shader: this.bloomBlurShader!,
+// Bloom downsample pipeline (13-tap filter)
+this.bloomDownsamplePipeline = this.backend.createRenderPipeline({
+  name: 'retro-bloom-downsample',
+  shader: this.bloomDownsampleShader!,
   vertexBuffers: [],
   bindGroupLayouts: [
-    this.blurTextureLayout!,
-    this.blurUniformLayout!,
+    this.downsampleTextureLayout!,
+    this.downsampleUniformLayout!,
   ],
   colorFormat: 'rgba8unorm',
   topology: 'triangle-list',
   cullMode: 'none',
   frontFace: 'ccw',
 });
+
+// Bloom upsample pipeline (3x3 tent filter with additive blend)
+this.bloomUpsamplePipeline = this.backend.createRenderPipeline({
+  name: 'retro-bloom-upsample',
+  shader: this.bloomUpsampleShader!,
+  vertexBuffers: [],
+  bindGroupLayouts: [
+    this.upsampleTextureLayout!,
+    this.upsampleUniformLayout!,
+  ],
+  colorFormat: 'rgba8unorm',
+  topology: 'triangle-list',
+  cullMode: 'none',
+  frontFace: 'ccw',
+  blend: {
+    enabled: true,
+    srcFactor: 'one',
+    dstFactor: 'one',
+    operation: 'add'
+  }
+});
```

#### Step 2.7: Implement Downsample Pass

**Replace bloomBlurPass() with:**

```typescript
/**
 * Bloom downsample pass (2-level POC)
 * Extract → Mip0 (downsample) → Mip1 (downsample)
 */
private bloomDownsamplePass(): void {
  if (!this.bloomExtractTexture || !this.bloomMip0Texture || !this.bloomMip1Texture) {
    return;
  }

  // Pass 1: Extract → Mip0 (160x120 → 80x60)
  {
    const downsampleParamsData = new Float32Array(8);
    downsampleParamsData[0] = 1.0 / 160;  // texelSize.x
    downsampleParamsData[1] = 1.0 / 120;  // texelSize.y
    this.backend.updateBuffer(this.downsampleParamsBuffer!, downsampleParamsData);

    const textureBindGroup = this.backend.createBindGroup(this.downsampleTextureLayout!, {
      0: this.bloomExtractTexture,
      1: this.linearSampler,
    });

    const uniformBindGroup = this.backend.createBindGroup(this.downsampleUniformLayout!, {
      0: this.downsampleParamsBuffer!,
    });

    this.backend.beginRenderPass(this.bloomMip0Framebuffer!, { r: 0, g: 0, b: 0, a: 0 });
    this.backend.executeDrawCommand({
      pipeline: this.bloomDownsamplePipeline!,
      bindGroups: [textureBindGroup, uniformBindGroup],
      geometry: { type: 'nonIndexed', vertexCount: 3 },
    });
    this.backend.endRenderPass();

    this.backend.deleteBindGroup(textureBindGroup);
    this.backend.deleteBindGroup(uniformBindGroup);
  }

  // Pass 2: Mip0 → Mip1 (80x60 → 40x30)
  {
    const downsampleParamsData = new Float32Array(8);
    downsampleParamsData[0] = 1.0 / 80;  // texelSize.x
    downsampleParamsData[1] = 1.0 / 60;  // texelSize.y
    this.backend.updateBuffer(this.downsampleParamsBuffer!, downsampleParamsData);

    const textureBindGroup = this.backend.createBindGroup(this.downsampleTextureLayout!, {
      0: this.bloomMip0Texture,
      1: this.linearSampler,
    });

    const uniformBindGroup = this.backend.createBindGroup(this.downsampleUniformLayout!, {
      0: this.downsampleParamsBuffer!,
    });

    this.backend.beginRenderPass(this.bloomMip1Framebuffer!, { r: 0, g: 0, b: 0, a: 0 });
    this.backend.executeDrawCommand({
      pipeline: this.bloomDownsamplePipeline!,
      bindGroups: [textureBindGroup, uniformBindGroup],
      geometry: { type: 'nonIndexed', vertexCount: 3 },
    });
    this.backend.endRenderPass();

    this.backend.deleteBindGroup(textureBindGroup);
    this.backend.deleteBindGroup(uniformBindGroup);
  }
}
```

#### Step 2.8: Implement Upsample Pass

```typescript
/**
 * Bloom upsample pass (2-level POC)
 * Mip1 → Mip0 (accumulate)
 */
private bloomUpsamplePass(): void {
  if (!this.bloomMip0Texture || !this.bloomMip1Texture) {
    return;
  }

  // Pass 1: Upsample Mip1 into Mip0 (additive blend)
  {
    const upsampleParamsData = new Float32Array(8);
    upsampleParamsData[0] = 1.0 / 40;  // texelSize.x (source mip size)
    upsampleParamsData[1] = 1.0 / 30;  // texelSize.y
    upsampleParamsData[2] = 1.0;       // blendFactor (full contribution)
    this.backend.updateBuffer(this.upsampleParamsBuffer!, upsampleParamsData);

    const textureBindGroup = this.backend.createBindGroup(this.upsampleTextureLayout!, {
      0: this.bloomMip1Texture,
      1: this.linearSampler,
    });

    const uniformBindGroup = this.backend.createBindGroup(this.upsampleUniformLayout!, {
      0: this.upsampleParamsBuffer!,
    });

    // Render into Mip0 with additive blending
    this.backend.beginRenderPass(this.bloomMip0Framebuffer!, { r: 0, g: 0, b: 0, a: 0 }, 'load');
    this.backend.executeDrawCommand({
      pipeline: this.bloomUpsamplePipeline!,
      bindGroups: [textureBindGroup, uniformBindGroup],
      geometry: { type: 'nonIndexed', vertexCount: 3 },
    });
    this.backend.endRenderPass();

    this.backend.deleteBindGroup(textureBindGroup);
    this.backend.deleteBindGroup(uniformBindGroup);
  }
}
```

#### Step 2.9: Update render() Method

```diff
 render(sceneTexture: BackendTextureHandle): BackendTextureHandle {
   this.bloomExtractPass(sceneTexture);
-  this.bloomBlurPass();
+  this.bloomDownsamplePass();
+  this.bloomUpsamplePass();

   // Composite uses Mip0 as the final bloom texture
-  return this.compositePass(sceneTexture, this.bloomBlurTexture!);
+  return this.compositePass(sceneTexture, this.bloomMip0Texture!);
 }
```

#### Step 2.10: Update Dispose (Lines 998-1102)

```diff
 private disposeTextures(): void {
   if (this.bloomExtractTexture) {
     this.backend.deleteTexture(this.bloomExtractTexture);
     this.bloomExtractTexture = null;
   }
-  if (this.bloomBlurTexture) {
-    this.backend.deleteTexture(this.bloomBlurTexture);
-    this.bloomBlurTexture = null;
+  if (this.bloomMip0Texture) {
+    this.backend.deleteTexture(this.bloomMip0Texture);
+    this.bloomMip0Texture = null;
   }
-  if (this.bloomTempTexture) {
-    this.backend.deleteTexture(this.bloomTempTexture);
-    this.bloomTempTexture = null;
+  if (this.bloomMip1Texture) {
+    this.backend.deleteTexture(this.bloomMip1Texture);
+    this.bloomMip1Texture = null;
   }

   // Similar for framebuffers
   if (this.bloomExtractFramebuffer) { ... }
-  if (this.bloomTempFramebuffer) { ... }
-  if (this.bloomBlurFramebuffer) { ... }
+  if (this.bloomMip0Framebuffer) { ... }
+  if (this.bloomMip1Framebuffer) { ... }
 }
```

#### Step 2.11: Testing

**Test checklist:**
- [ ] Code compiles without errors
- [ ] Application starts and renders
- [ ] Bloom is visible (even if not perfect)
- [ ] Bloom spreads in all directions (not just vertical)
- [ ] Performance is acceptable (<5ms at 640x480)
- [ ] No visual corruption or crashes

**Expected result:**
- Bloom should look BETTER than current (less vertical streaking)
- May not be perfect yet (that's what 5 levels are for)
- Validates the mip pyramid architecture works

---

### Phase 3: Scale to 5 Levels (30 minutes)

Once 2-level POC works, scaling is mechanical:

#### Step 3.1: Replace Properties with Arrays

```diff
-private bloomMip0Texture: BackendTextureHandle | null = null;
-private bloomMip1Texture: BackendTextureHandle | null = null;
+private bloomMipTextures: BackendTextureHandle[] = [];
+private bloomMipFramebuffers: BackendFramebufferHandle[] = [];
```

#### Step 3.2: Create Mip Chain in Loop

```typescript
const mipLevels = Math.min(
  this.config.bloomMipLevels,
  Math.floor(Math.log2(Math.min(bloomWidth, bloomHeight)))
);

for (let i = 0; i < mipLevels; i++) {
  const mipWidth = Math.max(4, Math.floor(bloomWidth / Math.pow(2, i)));
  const mipHeight = Math.max(4, Math.floor(bloomHeight / Math.pow(2, i)));

  this.bloomMipTextures[i] = this.backend.createTexture(
    `retro-post-bloom-mip${i}`,
    mipWidth,
    mipHeight,
    null,
    { format: 'rgba' }
  );

  this.bloomMipFramebuffers[i] = this.backend.createFramebuffer(
    `retro-post-bloom-mip${i}-fb`,
    [this.bloomMipTextures[i]],
    undefined
  );
}
```

#### Step 3.3: Loop Downsample Passes

```typescript
for (let i = 0; i < this.bloomMipTextures.length - 1; i++) {
  const inputTex = (i === 0) ? this.bloomExtractTexture : this.bloomMipTextures[i - 1];
  const outputFB = this.bloomMipFramebuffers[i];
  const mipWidth = Math.max(4, Math.floor(bloomWidth / Math.pow(2, i)));
  const mipHeight = Math.max(4, Math.floor(bloomHeight / Math.pow(2, i)));

  // Update uniforms, create bind groups, render
  // (same logic as 2-level POC, just parameterized)
}
```

#### Step 3.4: Loop Upsample Passes (Reverse Order)

```typescript
for (let i = this.bloomMipTextures.length - 1; i > 0; i--) {
  const inputTex = this.bloomMipTextures[i];
  const outputFB = this.bloomMipFramebuffers[i - 1];

  // Update uniforms, create bind groups, render with additive blend
  // (same logic as 2-level POC, just in loop)
}
```

---

### Phase 4: Cleanup (30 minutes)

#### Step 4.1: Remove Old Bloom Code

**Delete these methods:**
- `bloomBlurPass()` (lines 632-764)
- `setBloomBlurRadius()` (lines 897-901)

**Remove from config interface:**
```diff
-bloomBlurRadius: number;  // DEPRECATED
```

**Remove from demo.ts:**
```diff
-bloomBlurRadius: 2.0,  // Temporary
```

#### Step 4.2: Remove Bloom Radius UI

**File:** `packages/renderer/index.html`

```diff
-<div class="control-group">
-  <div class="slider-label">Bloom Radius: <span id="bloom-blur-radius-value">2.0</span></div>
-  <div class="slider-container">
-    <input type="range" id="bloom-blur-radius-slider" min="5" max="80" value="20" step="5">
-  </div>
-</div>
```

**File:** `packages/renderer/src/index.ts`

```diff
-const bloomBlurRadiusSlider = document.getElementById('bloom-blur-radius-slider') as HTMLInputElement;
-const bloomBlurRadiusValue = document.getElementById('bloom-blur-radius-value');
-if (bloomBlurRadiusSlider) {
-  bloomBlurRadiusSlider.addEventListener('input', () => {
-    const value = parseInt(bloomBlurRadiusSlider.value, 10) / 10;
-    demo.retroPostProcessor.setBloomBlurRadius(value);
-    if (bloomBlurRadiusValue) {
-      bloomBlurRadiusValue.textContent = value.toFixed(1);
-    }
-  });
-}
```

#### Step 4.3: Add Validation

```typescript
resize(displayWidth: number, displayHeight: number): void {
  // ... existing code ...

  // Validate mip levels against resolution
  const maxMipLevels = Math.floor(Math.log2(Math.min(bloomWidth, bloomHeight)));
  if (this.config.bloomMipLevels > maxMipLevels) {
    console.warn(
      `[RetroPostProcessor] Clamping bloom mip levels from ${this.config.bloomMipLevels} to ${maxMipLevels} (resolution: ${bloomWidth}x${bloomHeight})`
    );
  }
}
```

---

## Performance Optimization (Future)

The code-critic identified **critical performance issue: bind group thrashing**.

### Problem
Creating/destroying bind groups every frame (15+ times).

### Solution (Phase 5 - After Bloom Works)

**Option A: Cache Bind Groups**
```typescript
// Store as class properties
private downsampleBindGroups: Map<number, BackendBindGroupHandle> = new Map();
private upsampleBindGroups: Map<number, BackendBindGroupHandle> = new Map();

// Create once in resize()
resize(...) {
  // Clear old bind groups
  this.downsampleBindGroups.clear();
  this.upsampleBindGroups.clear();

  // Create cached bind groups
  for (let i = 0; i < mipLevels; i++) {
    this.downsampleBindGroups.set(i, this.backend.createBindGroup(...));
    this.upsampleBindGroups.set(i, this.backend.createBindGroup(...));
  }
}

// Use in render()
bloomDownsamplePass() {
  const bindGroup = this.downsampleBindGroups.get(i)!;
  // No creation/deletion - just use cached bind group
}
```

**Option B: Bind Group Pools**
More complex, but optimal for dynamic mip levels.

---

## Testing Strategy

### Unit Tests (Optional)
- Texture size calculations (mip chain)
- Uniform buffer packing
- Validation logic (max mip levels)

### Visual Tests (Required)
1. **Baseline:** Current (broken) bloom with vertical streaks
2. **2-Level POC:** Should show improvement (less streaking)
3. **5-Level Full:** Proper radial glow, natural bloom spread

### Performance Tests (Required)
- Measure bloom pass time (target: <3ms at 640x480)
- Monitor VRAM usage (should increase ~2-3MB for mip chain)
- Profile bind group creation (optimize in Phase 5)

### Regression Tests
- Ensure bloom works at various resolutions (320x240, 640x480, 1280x720)
- Test with bloomIntensity = 0 (should skip bloom)
- Test with very low resolution (64x64) - should gracefully clamp mip levels

---

## Troubleshooting

### Bloom Not Visible
- Check `bloomIntensity` > 0
- Verify `bloomThreshold` < scene brightness
- Check composite pass is using correct mip0 texture
- Verify additive blend enabled in upsample pipeline

### Bloom Too Blocky
- May need more mip levels (increase to 6-7)
- Check bilinear sampler is used (not nearest)
- Verify upsampling is using tent filter correctly

### Performance Issues
- Fix bind group thrashing first (Phase 5)
- Reduce mip levels (5 → 3)
- Check texture sizes aren't excessive

### Vertical Streaks Still Present
- Verify both downsample AND upsample are running
- Check mip0 texture is being used for composite (not extract)
- Ensure additive blend is enabled in upsample pipeline

---

## References

- **LearnOpenGL Bloom Tutorial:** https://learnopengl.com/Advanced-Lighting/Bloom
- **wgpu-bloom (Rust):** https://github.com/JMS55/wgpu-bloom
- **Unreal Engine Bloom:** https://docs.unrealengine.com/en-US/RenderingAndGraphics/PostProcessEffects/Bloom/

---

## Success Criteria

**POC Complete When:**
- ✅ Code compiles
- ✅ Bloom spreads radially (not just vertically)
- ✅ Visual improvement over current bloom
- ✅ Performance <5ms at 640x480

**Production Complete When:**
- ✅ 5-level mip pyramid implemented
- ✅ Performance <3ms at 640x480
- ✅ Bind group thrashing fixed
- ✅ Old bloom code removed
- ✅ UI updated (radius slider removed)
- ✅ Tests pass

---

**END OF GUIDE**
