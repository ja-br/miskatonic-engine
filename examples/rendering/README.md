# Rendering Examples

Complete working examples demonstrating the Miskatonic rendering engine features.

## Examples

### 1. Basic Triangle (`basic-triangle.ts`)

**Difficulty:** Beginner
**Concepts:** Backend initialization, vertex buffers, shaders, render loop

Renders a simple orange triangle. Perfect starting point for learning the rendering API.

**Key Learnings:**
- WebGPUBackend initialization
- Creating vertex buffers
- WGSL shader basics
- Basic render loop structure
- Automatic device recovery monitoring

---

### 2. Textured Cube (`textured-cube.ts`)

**Difficulty:** Intermediate
**Concepts:** 3D geometry, textures, transforms, index buffers

Renders a rotating textured cube with checkerboard pattern.

**Key Learnings:**
- Index buffers for efficient rendering
- Texture creation and configuration
- Uniform buffers for transforms
- Perspective projection matrices
- Vertex layouts with multiple attributes

**Note:** Texture binding requires bind group support (coming soon).

---

### 3. GPU Instancing (`instancing.ts`)

**Difficulty:** Intermediate
**Concepts:** Instanced rendering, performance optimization

Renders 10,000 colored cubes in a grid using a single draw call.

**Key Learnings:**
- Instance buffers (per-instance data)
- Performance benefits of instancing
- Drawing large numbers of objects efficiently
- FPS monitoring

**Performance:**
- 10,000 cubes = 1 draw call (vs 10,000 individual calls)
- Expected FPS: 60+ on modern GPUs

---

### 4. Transparent Objects (`transparent-objects.ts`)

**Difficulty:** Advanced
**Concepts:** Alpha blending, depth testing, sorting

Renders multiple overlapping transparent quads with proper alpha blending.

**Key Learnings:**
- Back-to-front sorting for correct transparency
- Dynamic sorting based on camera distance
- Depth testing without depth writes
- Alpha blending configuration
- Multiple draw calls with different uniforms

**Important:** Transparent objects must be sorted back-to-front or blending will be incorrect.

---

### 5. Device Recovery (`device-recovery.ts`) ⭐

**Difficulty:** Beginner
**Concepts:** Automatic GPU recovery, resource recreation

Interactive demo of automatic device loss recovery with UI feedback.

**Key Learnings:**
- Recovery progress monitoring
- Recovery callbacks for UI updates
- Manual device loss simulation
- Best practices for recovery-aware apps
- Resource recreation verification

**Features:**
- Real-time recovery status
- Manual trigger button
- Live resource count
- Recovery timeline visualization

**Try This:**
1. Click "Simulate Device Loss" button
2. Watch automatic recovery in action
3. Verify rendering continues seamlessly

---

## Running Examples

### Prerequisites

```bash
# Install dependencies
npm install

# Build rendering package
npm run build --workspace=@miskatonic/rendering
```

### Option 1: Development Server

```bash
# Start dev server (recommended)
npm run dev

# Open browser to:
# http://localhost:5173/examples/rendering/basic-triangle.html
```

### Option 2: Direct TypeScript

```bash
# Compile and run
npx tsx examples/rendering/basic-triangle.ts
```

### Option 3: HTML Template

Create an HTML file:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Rendering Example</title>
  <style>
    body { margin: 0; overflow: hidden; }
    canvas { width: 100vw; height: 100vh; display: block; }
  </style>
</head>
<body>
  <canvas></canvas>
  <script type="module" src="./basic-triangle.ts"></script>
</body>
</html>
```

---

## Browser Support

**Requires WebGPU:**
- Chrome 113+ (stable)
- Edge 113+
- Firefox Nightly (experimental)
- Safari Technology Preview (experimental)

**Check Support:**
```javascript
if (!navigator.gpu) {
  alert('WebGPU not supported in this browser');
}
```

---

## Common Issues

### "WebGPU not supported"

**Solution:** Use Chrome 113+ or Edge 113+. Enable WebGPU in experimental browsers.

### "Failed to initialize WebGPU"

**Solution:** Check if another app is using the GPU. Restart browser.

### Black screen but no errors

**Solution:** Check browser console for shader compilation errors. Verify canvas is visible.

### "Cannot read property 'lost' of null"

**Solution:** Backend not initialized. Ensure `await backend.initialize()` completes.

---

## Performance Tips

1. **Reuse Resources:** Create buffers/shaders once, reuse every frame
2. **Use Instancing:** For repeated geometry (see instancing.ts)
3. **Batch Draw Calls:** Minimize state changes
4. **Monitor FPS:** Target 60 FPS (16.67ms frame time)
5. **Check VRAM:** Use `backend.getVRAMStats()` to monitor usage

---

## Next Steps

1. Start with `basic-triangle.ts`
2. Modify shader colors and geometry
3. Try `device-recovery.ts` to understand recovery
4. Read migration guide: `/docs/migrations/RENDERING_API_MIGRATION.md`
5. Review best practices: `/docs/guides/RENDERING_BEST_PRACTICES.md`

---

## Feedback

Found an issue or have a suggestion?
https://github.com/miskatonic-engine/issues
