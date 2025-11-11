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
  vertex: vertexShaderSource,   // GLSL ES 3.0
  fragment: fragmentShaderSource,
});

// Create vertex buffer
const vertices = new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]);
renderer.createVertexBuffer('triangle', vertices);

// Render loop
function render() {
  renderer.beginFrame();
  renderer.clear([0, 0, 0, 1], 1, 0);

  const commandBuffer = renderer.getCommandBuffer();
  commandBuffer.draw({
    shader: 'basic',
    mode: 4, // TRIANGLES
    vertexBufferId: 'triangle',
    vertexCount: 3,
    vertexLayout: {
      attributes: [
        { name: 'position', size: 3, type: 'float', stride: 12, offset: 0 },
      ],
    },
  });

  const stats = renderer.endFrame();
  requestAnimationFrame(render);
}

render();
```

For a complete example with shaders, see [examples/basic-triangle.ts](./examples/basic-triangle.ts).

## Core Concepts

### Renderer
Main orchestrator that manages all rendering subsystems. Handles initialization, frame management, and resource coordination.

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
WebGPU context wrapper with state caching and lazy updates to minimize GPU state changes.

### ShaderManager
Handles shader compilation, linking, and LRU caching (max 1000 programs by default). Least recently used programs are automatically evicted when the limit is reached.

### BufferManager
Manages vertex and index buffers with memory tracking. Supports static and dynamic usage patterns.

### TextureManager
Handles texture creation, updates, and management with support for mipmaps and anisotropic filtering.

### CommandBuffer
Records and executes render commands with automatic batching and state sorting for optimal performance.

## Usage

### Creating Shaders

```typescript
renderer.createShader('myShader', {
  vertex: vertexSource,
  fragment: fragmentSource,
});
```

### Creating Buffers

```typescript
// Vertex buffer
const vertices = new Float32Array([...]);
renderer.createVertexBuffer('myBuffer', vertices);

// Index buffer
const indices = new Uint16Array([...]);
renderer.createIndexBuffer('myIndices', indices);
```

### Creating Textures

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

### Drawing

```typescript
renderer.beginFrame();

const commandBuffer = renderer.getCommandBuffer();
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

### Setting Render State

```typescript
const context = renderer.getContext();
context.setState({
  blendMode: 'alpha',
  depthTest: 'less',
  depthWrite: true,
  cullMode: 'back',
});
```

## Performance

### Automatic Optimizations

- **State Caching**: All GPU state changes cached (program, texture, buffer binding, render state)
- **Command Sorting**: Automatically sorted by shader and state to minimize switches
- **Lazy Updates**: State changes only applied when necessary
- **LRU Eviction**: Shader programs automatically evicted to prevent unbounded memory growth

### Memory Tracking

```typescript
const bufferManager = renderer.getBufferManager();
const textureManager = renderer.getTextureManager();

console.log(`Buffer memory: ${bufferManager.getTotalMemory()} bytes`);
console.log(`Texture memory: ${textureManager.getEstimatedMemory()} bytes`);
```

### Render Statistics

```typescript
const stats = renderer.getStats();
console.log(`Draw calls: ${stats.drawCalls}, Frame time: ${stats.frameTime}ms`);
console.log(`Shader switches: ${stats.shaderSwitches}, State changes: ${stats.stateChanges}`);
```

Available stats: `drawCalls`, `triangles`, `vertices`, `shaderSwitches`, `textureBinds`, `stateChanges`, `frameTime`

## Context Loss Handling

The renderer automatically handles GPU context loss:

```typescript
if (renderer.isContextLost()) {
  console.error('Context lost, waiting for restore...');
}
// Context is automatically restored; recreate resources when ready
```

## API Reference

### Renderer

**Initialization:**
- `constructor(config)` - Create renderer with configuration
- `beginFrame()` - Start frame rendering
- `endFrame()` - Execute commands and return stats
- `clear(color, depth, stencil)` - Clear buffers

**Resource Management:**
- `createShader(id, sources)` - Create shader program
- `createVertexBuffer(id, data)` - Create vertex buffer
- `createIndexBuffer(id, data)` - Create index buffer
- `getCommandBuffer()` - Get command buffer for drawing
- `getContext()` - Get render context
- `getShaderManager()` - Get shader manager
- `getBufferManager()` - Get buffer manager
- `getTextureManager()` - Get texture manager

**State:**
- `getStats()` - Get render statistics
- `isContextLost()` - Check for context loss

### CommandBuffer

- `draw(command)` - Record draw command
- `clear(color)` - Record clear command
- `setViewport(x, y, width, height)` - Set viewport
- `setScissor(x, y, width, height)` - Set scissor rectangle

For detailed API documentation, see TypeScript definitions or [API docs](./docs/api.md).

## License

MIT
