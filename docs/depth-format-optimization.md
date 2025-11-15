# Depth Format Optimization Guide

## Overview

The Miskatonic rendering engine uses an optimized depth buffer format by default to reduce VRAM usage while maintaining rendering quality.

## Default Configuration

**Default Depth Format:** `depth16unorm` (16-bit unsigned normalized depth)

### VRAM Savings

The `depth16unorm` format uses **50% less VRAM** compared to `depth24plus`:

| Resolution | depth16unorm | depth24plus | Savings |
|-----------|--------------|-------------|---------|
| 800×600   | 0.92 MB      | 1.83 MB     | 50%     |
| 1920×1080 | 3.96 MB      | 7.91 MB     | 50%     |
| 2560×1440 | 7.03 MB      | 14.06 MB    | 50%     |
| 3840×2160 | 15.82 MB     | 31.64 MB    | 50%     |

**Example:** At 797×692 resolution:
- `depth24plus`: 2.12 MB
- `depth16unorm`: 1.05 MB
- **Savings: 1.07 MB (50%)**

## When to Use Each Format

### depth16unorm (Default)
- **Best for:** Most games, especially low-memory targets
- **Precision:** 65,536 depth levels (16-bit)
- **Z-fighting range:** Acceptable for typical game scenes (near=0.1, far=1000)
- **VRAM cost:** 2 bytes/pixel

### depth24plus
- **Best for:** High-precision depth requirements, large view distances
- **Precision:** 16,777,216 depth levels (24-bit)
- **Z-fighting range:** Better for extreme depth ranges (near=0.01, far=100000)
- **VRAM cost:** 4 bytes/pixel

### depth24plus-stencil8
- **Best for:** Stencil operations (shadows, outlines, portals)
- **Precision:** 24-bit depth + 8-bit stencil
- **VRAM cost:** 4 bytes/pixel

## Usage

### Using Default (Recommended)

```typescript
const renderer = new HighLevelRenderer(canvas);
await renderer.initialize();
// Uses depth16unorm automatically
```

### Overriding Depth Format

```typescript
const renderer = new HighLevelRenderer(canvas);
await renderer.initialize({
  depthFormat: 'depth24plus', // Or 'depth24plus-stencil8'
});
```

### Accessing Current Depth Format

```typescript
const format = renderer.backend.getDepthFormat();
console.log(`Using depth format: ${format}`);
```

## Technical Details

### Precision Comparison

**depth16unorm:**
- Range: [0.0, 1.0]
- Steps: 1/65536 ≈ 0.0000153
- Good for: near/far ratios up to ~10,000:1

**depth24plus:**
- Range: [0.0, 1.0]
- Steps: 1/16777216 ≈ 0.00000006
- Good for: near/far ratios up to ~1,000,000:1

### Z-Fighting Mitigation

Even with `depth16unorm`, z-fighting can be minimized with proper depth range configuration:

```typescript
// Good: Reasonable near/far ratio
const projection = mat4.perspective(
  Math.PI / 4,  // 45° FOV
  aspect,
  0.1,          // Near plane
  1000          // Far plane (10,000:1 ratio)
);

// Bad: Extreme near/far ratio causes z-fighting even with depth24plus
const projection = mat4.perspective(
  Math.PI / 4,
  aspect,
  0.001,        // Near plane too close
  100000        // Far plane too far (100,000,000:1 ratio)
);
```

### Logarithmic Depth Buffer (Advanced)

For extreme view distances, consider using a logarithmic depth buffer in shaders instead of upgrading to `depth24plus`:

```wgsl
// Vertex shader
@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = projection * view * model * vec4<f32>(in.position, 1.0);

  // Logarithmic depth
  out.position.z = log2(max(1e-6, 1.0 + out.position.w)) * (2.0 / log2(far + 1.0)) - 1.0;
  out.position.z *= out.position.w;

  return out;
}
```

This provides better precision than `depth24plus` at a fraction of the cost.

## Performance Impact

Depth format affects:

1. **VRAM Usage** (50% reduction with depth16unorm)
2. **Bandwidth** (50% less depth buffer read/write)
3. **Cache Efficiency** (smaller depth buffer fits better in GPU cache)

**No impact on:**
- Shader execution time
- Draw call overhead
- Texture sampling performance

## Migration from depth24plus

If you were previously using `depth24plus` and want to migrate to `depth16unorm`:

1. **Test for z-fighting:** Run your game and look for flickering surfaces
2. **Adjust near/far planes:** Keep near as large as possible, far as small as possible
3. **Consider logarithmic depth:** For large view distances
4. **Measure VRAM savings:** Check before/after with `renderer.backend.getVRAMStats()`

## Troubleshooting

### Problem: Z-fighting visible with depth16unorm

**Solutions:**
1. Increase near plane distance (e.g., 0.01 → 0.1)
2. Decrease far plane distance (e.g., 10000 → 1000)
3. Use logarithmic depth buffer
4. Override to `depth24plus` if necessary

### Problem: Running out of VRAM

**Solutions:**
1. Ensure using `depth16unorm` (default)
2. Reduce framebuffer resolution
3. Use render target pooling
4. Disable unnecessary render targets

## Platform Compatibility

All depth formats are supported on:
- WebGPU (all implementations)
- Desktop GPUs (NVIDIA, AMD, Intel)
- Mobile GPUs (Qualcomm, ARM Mali, Apple)

**Note:** `depth24plus` may be emulated as `depth32float` on some hardware, using even more VRAM than expected. Prefer `depth16unorm` when possible.

## References

- Epic RENDERING-05 Task 5.5: Depth Format Optimization
- WebGPU Spec: https://www.w3.org/TR/webgpu/#depth-formats
- Code: `packages/rendering/src/backends/IRendererBackend.ts:114-115`
- Code: `packages/rendering/src/backends/WebGPUBackend.ts:88`
