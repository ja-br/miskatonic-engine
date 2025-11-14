# Rendering Engine Best Practices

**Package:** `@miskatonic/rendering`
**Version:** 0.2.0
**Last Updated:** 2025-11-13

---

## Table of Contents
1. [Resource Management](#resource-management)
2. [Performance](#performance)
3. [Device Recovery](#device-recovery)
4. [Shader Development](#shader-development)
5. [Memory Management](#memory-management)
6. [Testing](#testing)

---

## Resource Management

### DO: Pass Data at Resource Creation

```typescript
// ✅ GOOD: Data captured for device recovery
const vertices = new Float32Array([...]);
const buffer = backend.createBuffer('vertices', 'vertex', vertices, 'static_draw');

const texture = backend.createTexture('crate', 512, 512, imageData, {
  format: 'rgba8unorm',
  minFilter: 'linear',
  magFilter: 'linear'
});
```

```typescript
// ❌ BAD: Data not captured, recovery will create empty resources
const buffer = backend.createBuffer('vertices', 'vertex', new Float32Array(1024), 'static_draw');
backend.updateBuffer(buffer, actualData); // Update not tracked!
```

**Why:** Resource data is captured at creation for automatic device recovery. Updates are not tracked.

---

### DO: Store Mutable Data in Application State

```typescript
// ✅ GOOD: Application owns the data
class MeshComponent {
  private vertexData: Float32Array;
  private buffer: BackendBufferHandle;

  updateVertices(newData: Float32Array) {
    this.vertexData = newData;
    backend.updateBuffer(this.buffer, newData);
  }

  onDeviceRecovery() {
    // Recreate from application state
    backend.updateBuffer(this.buffer, this.vertexData);
  }
}
```

```typescript
// ❌ BAD: GPU is the source of truth
class MeshComponent {
  private buffer: BackendBufferHandle;

  updateVertices(newData: Float32Array) {
    backend.updateBuffer(this.buffer, newData);
    // Data is lost! No application-side copy
  }
}
```

**Why:** GPU is volatile, application state is not. Always keep authoritative data in CPU memory.

---

### DO: Dispose Resources When Done

```typescript
// ✅ GOOD: Explicit cleanup
class Game {
  private resources: BackendBufferHandle[] = [];

  createMesh() {
    const buffer = backend.createBuffer(/* ... */);
    this.resources.push(buffer);
    return buffer;
  }

  dispose() {
    for (const buffer of this.resources) {
      backend.deleteBuffer(buffer);
    }
    this.resources = [];
  }
}
```

```typescript
// ❌ BAD: Resources leak
class Game {
  createMesh() {
    return backend.createBuffer(/* ... */);
    // Who deletes this?
  }
}
```

**Why:** Prevents VRAM leaks. Explicit is better than implicit.

---

### DON'T: Create Resources Every Frame

```typescript
// ❌ BAD: Creates 60 buffers/textures per second
function render() {
  const buffer = backend.createBuffer(/* ... */); // LEAK!
  const texture = backend.createTexture(/* ... */); // LEAK!

  backend.draw(/* ... */);

  requestAnimationFrame(render);
}
```

```typescript
// ✅ GOOD: Create once, reuse every frame
let buffer: BackendBufferHandle;
let texture: BackendTextureHandle;

function init() {
  buffer = backend.createBuffer(/* ... */);
  texture = backend.createTexture(/* ... */);
}

function render() {
  backend.draw(/* using buffer, texture */);
  requestAnimationFrame(render);
}
```

**Why:** Resource creation is expensive (~1-10ms). Reuse resources for maximum performance.

---

## Performance

### DO: Use GPU Buffer Pooling (Automatic)

```typescript
// ✅ GOOD: Transient buffers use pooling automatically
const uniforms = new Float32Array([/* transform matrix */]);
backend.updateUniformBuffer(buffer, uniforms);
// Backend uses GPUBufferPool internally - no manual pooling needed
```

**Why:** WebGPUBackend automatically pools small, temporary buffers. Just use the API normally.

---

### DO: Batch Draw Calls

```typescript
// ✅ GOOD: One draw call for 100 cubes
const transforms = [/* 100 transform matrices */];
renderer.drawInstanced(cubeMesh, material, transforms);
```

```typescript
// ❌ BAD: 100 separate draw calls
for (const transform of transforms) {
  renderer.draw(cubeMesh, material, transform); // Slow!
}
```

**Why:** Draw calls have overhead (~0.1-0.5ms each). Instancing is 10-100x faster.

---

### DO: Sort Transparent Objects Back-to-Front

```typescript
// ✅ GOOD: Proper alpha blending
const transparentObjects = entities
  .filter(e => e.material.isTransparent)
  .sort((a, b) => {
    // Sort by distance from camera (back to front)
    return b.distanceToCamera - a.distanceToCamera;
  });

for (const obj of transparentObjects) {
  renderer.draw(obj.mesh, obj.material, obj.transform);
}
```

```typescript
// ❌ BAD: Unsorted transparent objects
for (const obj of transparentObjects) {
  renderer.draw(obj.mesh, obj.material, obj.transform);
  // Incorrect blending!
}
```

**Why:** Transparent objects must render back-to-front for correct alpha blending.

---

### DON'T: Update Uniforms Unnecessarily

```typescript
// ✅ GOOD: Dirty tracking
class Material {
  private uniformsDirty = false;
  private color: vec3;

  setColor(color: vec3) {
    if (!vec3.equals(this.color, color)) {
      this.color = color;
      this.uniformsDirty = true;
    }
  }

  bind() {
    if (this.uniformsDirty) {
      backend.updateUniformBuffer(this.uniformBuffer, this.getUniformData());
      this.uniformsDirty = false;
    }
  }
}
```

```typescript
// ❌ BAD: Updates every frame even when unchanged
class Material {
  bind() {
    backend.updateUniformBuffer(this.uniformBuffer, this.getUniformData());
    // Wastes CPU/GPU bandwidth
  }
}
```

**Why:** Uploading data to GPU is expensive. Only update when values actually change.

---

### DO: Use Appropriate Buffer Usage

```typescript
// ✅ GOOD: Match usage to access pattern
const staticMesh = backend.createBuffer('cube', 'vertex', vertices, 'static_draw');
// Created once, read many times

const dynamicParticles = backend.createBuffer('particles', 'vertex', data, 'dynamic_draw');
// Updated frequently

const streamingText = backend.createBuffer('glyphs', 'vertex', data, 'stream_draw');
// Updated every frame, used once
```

```typescript
// ❌ BAD: Wrong usage hints
const dynamicParticles = backend.createBuffer('particles', 'vertex', data, 'static_draw');
// Frequently updated but marked static - poor performance!
```

**Why:** Correct usage hints allow GPU driver to optimize memory placement.

---

## Device Recovery

### DO: Monitor Recovery for User Feedback

```typescript
// ✅ GOOD: Inform user about recovery
if (backend.recoverySystem) {
  backend.recoverySystem.onRecovery((progress) => {
    switch (progress.phase) {
      case 'detecting':
        showNotification('GPU connection lost, recovering...');
        pauseGame();
        break;
      case 'complete':
        hideNotification();
        resumeGame();
        console.log(`Recovered ${progress.resourcesRecreated} resources`);
        break;
      case 'failed':
        showError('GPU recovery failed. Please reload the page.', progress.error);
        break;
    }
  });
}
```

```typescript
// ❌ BAD: Silent recovery (user sees black screen)
// No feedback, user doesn't know what's happening
```

**Why:** Device loss takes 50-200ms. User should know the app is still responsive.

---

### DO: Regenerate Dynamic Resources After Recovery

```typescript
// ✅ GOOD: Re-update dynamic data
class ParticleSystem {
  private positions: Float32Array;
  private positionBuffer: BackendBufferHandle;

  constructor() {
    this.positions = new Float32Array(1000 * 3);
    this.positionBuffer = backend.createBuffer('particles', 'vertex', this.positions, 'dynamic_draw');

    backend.recoverySystem?.onRecovery((progress) => {
      if (progress.phase === 'complete') {
        // Re-upload latest particle positions
        backend.updateBuffer(this.positionBuffer, this.positions);
      }
    });
  }

  update(dt: number) {
    // Update positions
    for (let i = 0; i < this.positions.length; i += 3) {
      this.positions[i] += dt; // x
      // ...
    }
    backend.updateBuffer(this.positionBuffer, this.positions);
  }
}
```

**Why:** Recovery recreates resources with original creation data. Dynamic updates need to be reapplied.

---

### DON'T: Assume Resources Survive Device Loss

```typescript
// ❌ BAD: Assumes texture data persists
class TextureCache {
  private cachedPixels = new Map<string, Uint8Array>();

  getTexture(id: string) {
    if (!this.cachedPixels.has(id)) {
      // Download from GPU (WRONG! Can't read back after recovery)
      const pixels = backend.readTexturePixels(id);
      this.cachedPixels.set(id, pixels);
    }
    return this.cachedPixels.get(id);
  }
}
```

```typescript
// ✅ GOOD: Store original data
class TextureCache {
  private cachedPixels = new Map<string, Uint8Array>();

  createTexture(id: string, pixels: Uint8Array) {
    this.cachedPixels.set(id, pixels); // Store BEFORE creating GPU resource
    return backend.createTexture(id, width, height, pixels, { /* ... */ });
  }
}
```

**Why:** GPU resources are ephemeral. Always keep authoritative data on CPU.

---

## Shader Development

### DO: Use WGSL (Not GLSL)

```wgsl
// ✅ GOOD: Native WGSL
@vertex
fn vs_main(@location(0) position: vec3f) -> @builtin(position) vec4f {
  return vec4f(position, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return vec4f(1.0, 0.0, 0.0, 1.0);
}
```

```glsl
// ❌ BAD: GLSL (not supported)
#version 450
layout(location = 0) in vec3 position;
// WebGPU uses WGSL, not GLSL
```

**Why:** WebGPU uses WGSL exclusively. GLSL is not supported.

---

### DO: Use Shader Reflection for Bindings

```typescript
// ✅ GOOD: Automatic binding discovery
const reflection = await backend.getShaderReflection(shader);

console.log('Uniforms:', reflection.uniforms);
// [{ name: 'modelMatrix', type: 'mat4x4<f32>', binding: 0 }]

console.log('Textures:', reflection.textures);
// [{ name: 'diffuseTexture', binding: 1 }]

// Use reflection data to create bind groups automatically
```

```typescript
// ❌ BAD: Hardcoded binding indices
const bindGroup = backend.createBindGroup({
  layout,
  entries: [
    { binding: 0, buffer: uniformBuffer },  // What if shader changes?
    { binding: 1, texture: diffuseTexture }
  ]
});
```

**Why:** Shader reflection keeps bindings in sync automatically. Less brittle code.

---

### DON'T: Parse Shaders with Regex

```typescript
// ❌ BAD: Fragile regex parsing
function findUniforms(shaderSource: string) {
  const regex = /@group\((\d+)\) @binding\((\d+)\) var<uniform> (\w+)/g;
  // Breaks on comments, whitespace variations, etc.
}
```

```typescript
// ✅ GOOD: Use WGSLReflectionParser
import { WGSLReflectionParser } from '@miskatonic/rendering';

const parser = new WGSLReflectionParser();
const reflection = parser.parse(shaderSource);
// Robust AST-based parsing
```

**Why:** Regex is fragile. AST-based parsing handles all edge cases.

---

## Memory Management

### DO: Monitor VRAM Usage

```typescript
// ✅ GOOD: Check VRAM stats
const stats = backend.getVRAMStats();
console.log(`VRAM used: ${stats.used / 1024 / 1024} MB`);
console.log(`Textures: ${stats.textures / 1024 / 1024} MB`);
console.log(`Buffers: ${stats.buffers / 1024 / 1024} MB`);

if (stats.used > stats.budget * 0.9) {
  console.warn('Approaching VRAM budget!');
  // Unload unused assets
}
```

**Why:** Prevents VRAM exhaustion. Budget is typically 256MB for integrated GPUs.

---

### DO: Use Mipmaps for Textures

```typescript
// ✅ GOOD: Generate mipmaps
const texture = backend.createTexture('brick', 1024, 1024, imageData, {
  format: 'rgba8unorm',
  minFilter: 'linear-mipmap-linear',
  generateMipmaps: true  // Automatic mipmap generation
});
```

```typescript
// ❌ BAD: No mipmaps (poor performance)
const texture = backend.createTexture('brick', 1024, 1024, imageData, {
  format: 'rgba8unorm',
  minFilter: 'linear',
  generateMipmaps: false
});
```

**Why:** Mipmaps improve cache performance and reduce aliasing. Essential for 3D rendering.

---

### DON'T: Load Full-Resolution Textures for Distant Objects

```typescript
// ❌ BAD: 4K texture for tiny object
const icon = backend.createTexture('icon', 4096, 4096, imageData, { /* ... */ });
// Wastes VRAM, kills performance
```

```typescript
// ✅ GOOD: Appropriate resolution
const icon = backend.createTexture('icon', 64, 64, imageData, { /* ... */ });
// Sufficient for UI icon
```

**Why:** VRAM is precious. Use smallest resolution that looks good.

---

## Testing

### DO: Test with Device Loss Simulation

```typescript
// ✅ GOOD: Automated device loss testing
import { describe, it, expect } from 'vitest';

describe('Game', () => {
  it('should survive device loss', async () => {
    const game = new Game(canvas);
    await game.init();

    // Render a frame
    game.render();
    const before = captureFramebuffer();

    // Simulate device loss
    game.backend.device.destroy();

    // Wait for recovery
    await waitFor(() => !game.backend.isContextLost());

    // Render again
    game.render();
    const after = captureFramebuffer();

    // Verify rendering still works
    expect(after).toMatchImage(before, { threshold: 0.01 });
  });
});
```

**Why:** Device loss is rare but catastrophic. Test to ensure recovery works.

---

### DO: Profile Frame Times

```typescript
// ✅ GOOD: Measure performance
function render() {
  const start = performance.now();

  backend.beginFrame();
  // ... rendering commands
  backend.endFrame();

  const frameTime = performance.now() - start;
  if (frameTime > 16.67) {
    console.warn(`Slow frame: ${frameTime.toFixed(2)}ms`);
  }

  requestAnimationFrame(render);
}
```

**Why:** Catches performance regressions early. Target: <16.67ms (60 FPS).

---

### DO: Use RenderStats for Profiling

```typescript
// ✅ GOOD: Use built-in stats
const stats = backend.endFrame();
console.log(`Draw calls: ${stats.drawCalls}`);
console.log(`Triangles: ${stats.triangles}`);
console.log(`Buffers: ${stats.bufferUpdates}`);
console.log(`GPU time: ${stats.gpuTimeMs.toFixed(2)}ms`);

if (stats.drawCalls > 1000) {
  console.warn('Too many draw calls! Use instancing.');
}
```

**Why:** Built-in stats are accurate and comprehensive. Use them for optimization.

---

## Common Pitfalls

### Pitfall: Forgetting to Begin/End Frame

```typescript
// ❌ WRONG: Missing frame boundaries
backend.executeDrawCommand(/* ... */);
// Will crash or produce garbage
```

```typescript
// ✅ CORRECT: Proper frame lifecycle
backend.beginFrame();
backend.executeDrawCommand(/* ... */);
const stats = backend.endFrame();
```

**Why:** Frame boundaries manage GPU command encoding. Skipping them breaks everything.

---

### Pitfall: Creating Circular Dependencies in Recovery

```typescript
// ❌ BAD: Infinite recovery loop
backend.recoverySystem?.onRecovery((progress) => {
  if (progress.phase === 'complete') {
    backend.device.destroy(); // WRONG! Triggers another recovery
  }
});
```

```typescript
// ✅ GOOD: No circular triggers
backend.recoverySystem?.onRecovery((progress) => {
  if (progress.phase === 'complete') {
    // Re-upload dynamic data, update UI, etc.
    // But don't destroy the device!
  }
});
```

**Why:** Recovery callbacks should heal, not harm.

---

### Pitfall: Using Device After Destruction

```typescript
// ❌ BAD: Using destroyed device
backend.device.destroy();
backend.createBuffer(/* ... */); // CRASH!
```

```typescript
// ✅ GOOD: Check context lost
if (backend.isContextLost()) {
  console.log('Waiting for recovery...');
  return;
}
backend.createBuffer(/* ... */);
```

**Why:** Destroyed devices throw errors. Check `isContextLost()` first.

---

## Performance Budgets

**Target:** 60 FPS (16.67ms frame time)

| Budget | Category | Guideline |
|--------|----------|-----------|
| 8ms | GPU rendering | Keep draw calls <500, triangles <1M |
| 4ms | JavaScript logic | Optimize hot paths, use workers |
| 2ms | Physics | Use spatial partitioning, limit entities |
| 2ms | Buffer uploads | Batch updates, use dirty tracking |

**Total:** 16ms

---

## Tools and Debugging

### Chrome DevTools GPU Inspector

1. Open DevTools → Performance → Enable "GPU"
2. Record a frame
3. Analyze GPU timeline

### WebGPU Errors

```typescript
// Enable WebGPU error logging
device.addEventListener('uncapturederror', (event) => {
  console.error('WebGPU error:', event.error);
});

// Push error scope for fine-grained debugging
device.pushErrorScope('validation');
backend.createBuffer(/* ... */);
device.popErrorScope().then((error) => {
  if (error) console.error('Validation error:', error.message);
});
```

---

## Summary

**Golden Rules:**
1. Store authoritative data on CPU, not GPU
2. Create resources once, reuse every frame
3. Monitor VRAM usage and performance
4. Test device recovery in automated tests
5. Use mipmaps for all textures
6. Batch draw calls with instancing
7. Sort transparent objects back-to-front
8. Profile early, profile often

**Further Reading:**
- Migration Guide: `/docs/migrations/RENDERING_API_MIGRATION.md`
- Examples: `/examples/rendering/`
- WebGPU Spec: https://www.w3.org/TR/webgpu/
