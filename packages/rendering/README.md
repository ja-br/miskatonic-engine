# @miskatonic/rendering

Modern WebGPU rendering engine with automatic device recovery.

## Features

- **WebGPU Backend** - High-performance GPU rendering
- **Automatic Device Recovery** - Seamless handling of GPU loss
- **GPU Buffer Pooling** - Efficient memory reuse for temporary buffers
- **WGSL Shader Reflection** - Automatic uniform/binding discovery
- **VRAM Profiling** - Built-in memory tracking and budgets
- **Command-Based API** - Explicit, predictable rendering
- **Type-Safe Handles** - No raw GPU objects exposed

## Installation

```bash
npm install @miskatonic/rendering
```

## Quick Start

```typescript
import { WebGPUBackend } from '@miskatonic/rendering';

// Initialize backend
const canvas = document.querySelector('canvas')!;
const backend = new WebGPUBackend();
await backend.initialize({ canvas, powerPreference: 'high-performance' });

// Create resources
const vertices = new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]);
const buffer = backend.createBuffer('triangle', 'vertex', vertices, 'static_draw');

const shader = backend.createShader('basic', {
  vertex: wgslShaderCode  // WGSL, not GLSL
});

// Render loop
function render() {
  backend.beginFrame();

  // Execute draw commands
  backend.executeDrawCommand({
    type: 'non-indexed',
    vertexCount: 3,
    // ... command details
  });

  const stats = backend.endFrame();
  console.log(`Frame time: ${stats.cpuTimeMs.toFixed(2)}ms`);

  requestAnimationFrame(render);
}

render();
```

## Core Concepts

### WebGPUBackend

Main rendering interface. Manages device, resources, and command execution.

```typescript
const backend = new WebGPUBackend();
await backend.initialize({
  canvas: HTMLCanvasElement,
  powerPreference?: 'default' | 'high-performance' | 'low-power'
});
```

### Device Recovery

**Automatic:** Resources are automatically registered and recreated after GPU device loss.

```typescript
// Optional: Listen to recovery events
if (backend.recoverySystem) {
  backend.recoverySystem.onRecovery((progress) => {
    if (progress.phase === 'complete') {
      console.log(`Recovered ${progress.resourcesRecreated} resources`);
    }
  });
}
```

**Important:** Resource data is captured at creation. Updates via `updateBuffer()` / `updateTexture()` are not tracked.

### Command-Based Rendering

```typescript
backend.beginFrame();

// Non-indexed draw
backend.executeDrawCommand({
  type: 'non-indexed',
  vertexCount: 3,
  instanceCount: 1,
  shader: shaderHandle,
  buffers: [{ buffer: vertexBuffer, offset: 0 }],
  // ...
});

// Indexed draw
backend.executeDrawCommand({
  type: 'indexed',
  indexCount: 6,
  indexBuffer: indexHandle,
  // ...
});

const stats = backend.endFrame();
```

## API Reference

### Resource Creation

```typescript
// Buffers
createBuffer(
  id: string,
  type: 'vertex' | 'index' | 'uniform',
  data: ArrayBufferView,
  usage: 'static_draw' | 'dynamic_draw' | 'stream_draw'
): BackendBufferHandle

// Textures
createTexture(
  id: string,
  width: number,
  height: number,
  data: ArrayBufferView | HTMLImageElement | ImageData | null,
  config: {
    format: TextureFormat,
    minFilter?: TextureFilter,
    magFilter?: TextureFilter,
    wrapS?: TextureWrap,
    wrapT?: TextureWrap,
    generateMipmaps?: boolean
  }
): BackendTextureHandle

// Shaders (WGSL)
createShader(
  id: string,
  source: { vertex: string; fragment?: string }
): BackendShaderHandle
```

### Resource Updates

```typescript
updateBuffer(handle: BackendBufferHandle, data: ArrayBufferView): void
updateTexture(handle: BackendTextureHandle, data: ArrayBufferView | ImageData, x?: number, y?: number, width?: number, height?: number): void
```

### Resource Cleanup

```typescript
deleteBuffer(handle: BackendBufferHandle): void
deleteTexture(handle: BackendTextureHandle): void
deleteShader(handle: BackendShaderHandle): void
```

### Performance Monitoring

```typescript
// Render stats (returned by endFrame())
interface RenderStats {
  drawCalls: number;
  triangles: number;
  cpuTimeMs: number;
  gpuTimeMs: number;  // Requires timestamp-query feature
  bufferUpdates: number;
}

// VRAM stats
const vramStats = backend.getVRAMStats();
console.log(`VRAM used: ${vramStats.used / 1024 / 1024} MB`);
console.log(`Textures: ${vramStats.textures / 1024 / 1024} MB`);
console.log(`Buffers: ${vramStats.buffers / 1024 / 1024} MB`);
```

### Device Recovery System

```typescript
// Recovery stats
const stats = backend.recoverySystem?.getStats();
console.log(`${stats.registered} resources registered for recovery`);

// Check if recovering
if (backend.recoverySystem?.isRecovering()) {
  console.log('Recovery in progress...');
}

// Check context status
if (backend.isContextLost()) {
  console.log('Device lost, recovery will happen automatically');
}
```

## Best Practices

### ✅ DO: Store Data on CPU

```typescript
class Mesh {
  private vertexData: Float32Array;
  private buffer: BackendBufferHandle;

  constructor(vertices: Float32Array) {
    this.vertexData = vertices;  // Keep CPU copy
    this.buffer = backend.createBuffer('mesh', 'vertex', vertices, 'static_draw');
  }
}
```

### ✅ DO: Reuse Resources

```typescript
// Create once
const buffer = backend.createBuffer(/* ... */);

// Reuse every frame
function render() {
  backend.executeDrawCommand({ buffers: [{ buffer, offset: 0 }], /* ... */ });
}
```

### ❌ DON'T: Create Resources Every Frame

```typescript
// BAD: Creates new buffer every frame
function render() {
  const buffer = backend.createBuffer(/* ... */);  // LEAK!
  backend.executeDrawCommand(/* ... */);
}
```

### ✅ DO: Use Appropriate Buffer Usage

```typescript
// Static geometry (created once)
const staticBuffer = backend.createBuffer('terrain', 'vertex', data, 'static_draw');

// Dynamic geometry (updated frequently)
const dynamicBuffer = backend.createBuffer('particles', 'vertex', data, 'dynamic_draw');

// Streaming geometry (updated every frame)
const streamBuffer = backend.createBuffer('ui', 'vertex', data, 'stream_draw');
```

## Documentation

- [Migration Guide](/docs/migrations/RENDERING_API_MIGRATION.md) - Breaking changes and new features
- [Best Practices](/docs/guides/RENDERING_BEST_PRACTICES.md) - Performance tips and patterns
- [Examples](/examples/rendering/) - Complete working examples

## Performance Targets

- **Frame Rate:** 60 FPS (16.67ms)
- **Draw Calls:** <500 per frame
- **VRAM Budget:** 256 MB (integrated GPU)
- **Recovery Time:** <200ms (typical scene)

## Known Limitations

- Resource data captured at creation only (updates not tracked for recovery)
- Pipeline/BindGroup recreation not yet implemented (Buffer, Texture, Shader supported)
- WGSL only (no GLSL support)

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Type check
npm run typecheck
```

## License

MIT
