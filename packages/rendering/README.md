# @miskatonic/rendering

WebGPU rendering engine for Miskatonic.

## Features

- **WebGPU Backend**: Modern high-performance rendering with state caching
- **Command Buffer**: Batched rendering with automatic state optimization
- **Shader Management**: Compilation, linking, and LRU caching with error reporting
- **Buffer Management**: Vertex and index buffers with memory tracking
- **Texture Management**: Texture loading with mipmap generation and anisotropic filtering
- **State Management**: Lazy state updates to minimize WebGL calls
- **Context Loss Recovery**: Automatic handling of WebGL context loss
- **Bounded Resources**: LRU eviction prevents unbounded memory growth
- **Flexible Index Types**: Support for uint8, uint16, uint32 indices

## Installation

```bash
npm install @miskatonic/rendering
```

## Quick Start

```typescript
import { Renderer } from '@miskatonic/rendering';

// Create renderer
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const renderer = new Renderer({
  canvas,
  antialias: true,
  alpha: false,
});

// Create shader
renderer.createShader('basic', {
  vertex: `#version 300 es
    in vec3 position;
    uniform mat4 modelViewProjection;

    void main() {
      gl_Position = modelViewProjection * vec4(position, 1.0);
    }
  `,
  fragment: `#version 300 es
    precision highp float;
    out vec4 fragColor;

    void main() {
      fragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
  `
});

// Create vertex buffer
const vertices = new Float32Array([
  -1, -1, 0,
   1, -1, 0,
   0,  1, 0,
]);
renderer.createVertexBuffer('triangle', vertices);

// Render loop
function render() {
  renderer.beginFrame();

  // Clear screen
  renderer.clear([0, 0, 0, 1], 1, 0);

  // Draw triangle
  const commandBuffer = renderer.getCommandBuffer();
  commandBuffer.draw({
    shader: 'basic',
    mode: 4, // TRIANGLES
    vertexBufferId: 'triangle',
    vertexCount: 3,
    vertexLayout: {
      attributes: [
        {
          name: 'position',
          size: 3, // vec3
          type: 'float',
          stride: 12, // 3 * 4 bytes
          offset: 0,
        },
      ],
    },
  });

  // Execute and get stats
  const stats = renderer.endFrame();
  console.log(`Draw calls: ${stats.drawCalls}, Frame time: ${stats.frameTime}ms`);

  requestAnimationFrame(render);
}

render();
```

## Architecture

### Renderer
Main orchestrator that manages all rendering subsystems.

```typescript
const renderer = new Renderer({
  canvas: HTMLCanvasElement,
  antialias?: boolean,
  alpha?: boolean,
  depth?: boolean,
  stencil?: boolean,
  powerPreference?: 'default' | 'high-performance' | 'low-power',
});
```

### RenderContext
WebGPU context wrapper with state caching and lazy updates.

```typescript
const context = renderer.getContext();
context.setState({
  blendMode: 'alpha',
  depthTest: 'less',
  depthWrite: true,
  cullMode: 'back',
});
```

### ShaderManager
Handles shader compilation, linking, and LRU caching (max 1000 programs by default).

```typescript
const shaderManager = renderer.getShaderManager();
const program = shaderManager.createProgram('myShader', {
  vertex: vertexSource,
  fragment: fragmentSource,
});

// Note: Least recently used programs are automatically evicted when limit is reached
```

### BufferManager
Manages vertex and index buffers with memory tracking.

```typescript
const bufferManager = renderer.getBufferManager();
const buffer = bufferManager.createBuffer('myBuffer', 'vertex', data, 'static_draw');
console.log(`Total memory: ${bufferManager.getTotalMemory()} bytes`);
```

### TextureManager
Handles texture creation, updates, and management.

```typescript
const textureManager = renderer.getTextureManager();
const texture = textureManager.createTexture('myTexture', width, height, imageData, {
  format: 'rgba',
  minFilter: 'linear_mipmap_linear',
  magFilter: 'linear',
  wrapS: 'repeat',
  wrapT: 'repeat',
  generateMipmaps: true,
  anisotropy: 16,
});
```

### CommandBuffer
Records and executes render commands with automatic batching.

```typescript
const commandBuffer = renderer.getCommandBuffer();

renderer.beginFrame();
commandBuffer.clear([0, 0, 0, 1]);
commandBuffer.draw({
  shader: 'myShader',
  mode: 4, // TRIANGLES
  vertexBufferId: 'myBuffer',
  indexBufferId: 'myIndices', // Optional
  indexType: 'uint16', // uint8, uint16, or uint32
  vertexCount: 3,
  vertexLayout: {
    attributes: [
      { name: 'position', size: 3, type: 'float', stride: 20, offset: 0 },
      { name: 'normal', size: 3, type: 'float', stride: 20, offset: 12 },
    ],
  },
  uniforms: new Map([
    ['color', { name: 'color', type: 'vec4', value: [1, 0, 0, 1] }],
  ]),
});
const stats = renderer.endFrame();
```

## Performance Features

### State Caching
All GPU state changes are cached to minimize redundant calls:
- Program binding
- Texture binding
- Buffer binding
- Render state (blend, depth, cull)

### Command Sorting
Commands are automatically sorted for optimal rendering:
- Clear commands first
- Grouped by shader to minimize switches
- Sorted by state changes

### Memory Tracking
Built-in memory tracking for buffers and textures:
```typescript
console.log(`Buffer memory: ${bufferManager.getTotalMemory()} bytes`);
console.log(`Texture memory: ${textureManager.getEstimatedMemory()} bytes`);
```

### Render Statistics
Comprehensive statistics for each frame:
```typescript
const stats = renderer.getStats();
console.log({
  drawCalls: stats.drawCalls,
  triangles: stats.triangles,
  vertices: stats.vertices,
  shaderSwitches: stats.shaderSwitches,
  textureBinds: stats.textureBinds,
  stateChanges: stats.stateChanges,
  frameTime: stats.frameTime,
});
```

## Context Loss Handling

The renderer automatically handles GPU context loss:

```typescript
if (renderer.isContextLost()) {
  console.error('Context lost, waiting for restore...');
}

// Context is automatically restored when available
// All resources need to be recreated after context restore
```

## API Reference

See the [API documentation](./docs/api.md) for complete API reference.

## License

MIT
