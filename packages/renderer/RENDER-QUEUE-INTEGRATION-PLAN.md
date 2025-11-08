# RenderQueue Integration Plan

**Status**: Architecture designed, awaiting full implementation

## Current State (Phase 5 Complete)

✅ **What Works:**
- BackendFactory creates WebGPU or WebGL2 backend automatically
- WGSL and GLSL shaders load based on backend type
- RenderQueue exists and is instantiated
- Camera info configured for render queue

⏸️ **What Remains:**
- Convert rendering loop to use DrawCommand objects
- Use backend-created buffers/shaders (not legacy Renderer)
- Submit commands to RenderQueue
- Execute sorted queue via backend.executeCommands()

## Architecture Overview

### Current Architecture (Hybrid - Legacy + Backend)

```typescript
// Initialization
backend = BackendFactory.create(canvas);  // ✅ Done
renderer = new Renderer(config);          // ✅ Done (legacy, for BufferManager)

// Rendering Loop (Current)
gl = renderer.getContext().gl;
bufferManager = renderer.getBufferManager();
shaderManager = renderer.getShaderManager();

// Direct WebGL calls
gl.bindBuffer(...);
gl.drawElements(...);
```

### Target Architecture (Full Backend Abstraction)

```typescript
// Initialization
backend = BackendFactory.create(canvas);

// Create resources through backend
shaderHandle = backend.createShader(id, source);
vertexBufferHandle = backend.createBuffer(data, 'vertex');
indexBufferHandle = backend.createBuffer(data, 'index');

// Rendering Loop (Target)
renderQueue.clear();

// Build DrawCommands for each entity
for (entity of entities) {
  const drawCmd: DrawCommand = {
    type: RenderCommandType.DRAW,
    shader: shaderHandle.id,
    mode: PrimitiveMode.TRIANGLES,
    vertexBufferId: vertexBufferHandle.id,
    indexBufferId: indexBufferHandle.id,
    indexType: 'uint16',
    vertexCount: indexCount,
    vertexLayout: { attributes: [...] },
    uniforms: new Map([
      ['uModelViewProjection', mvpMatrix],
      ['uModel', modelMatrix],
      ['uBaseColor', color],
      // ...
    ]),
  };

  renderQueue.submit({
    drawCommand: drawCmd,
    materialId: 'dice-material',
    worldMatrix: modelMatrix,
    depth: 0,  // Calculated by RenderQueue
    sortKey: 0, // Calculated by RenderQueue
    renderState: {
      blendMode: 'none',
      depthTest: 'less',
      depthWrite: true,
      cullMode: 'back',
    },
  });
}

// Sort and execute
renderQueue.sort();
const commands = renderQueue.getCommands().map(qc => qc.drawCommand);
backend.executeCommands(commands);
```

## Implementation Steps

### Step 1: Create Buffers Through Backend ⏸️

**Current**: Uses legacy `BufferManager`
```typescript
const bufferManager = renderer.getBufferManager();
bufferManager.createBuffer('cube-positions', positions, 'static');
```

**Target**: Use backend API
```typescript
const vertexHandle = await backend.createBuffer('cube-positions', {
  data: positions,
  usage: 'vertex',
  hint: 'static',
});
```

**Files to Modify:**
- `demo.ts:createGeometry()` - Create buffers via backend
- Store `BackendBufferHandle` instead of buffer IDs

### Step 2: Create Shaders Through Backend ✅

**Status**: Partially done - shaders created via backend for WebGPU

**Remaining**:
- Store shader handles for DrawCommand usage
- Use backend shader handles instead of legacy ShaderManager

### Step 3: Build DrawCommand Objects ⏸️

**Create helper method:**
```typescript
private createDrawCommand(
  entity: EntityId,
  diceEntity: DiceEntity,
  modelMatrix: Float32Array,
  mvpMatrix: Float32Array,
  color: [number, number, number]
): DrawCommand {
  const useCube = diceEntity.sides === 6;

  return {
    type: RenderCommandType.DRAW,
    shader: this.shaderHandle.id,
    mode: PrimitiveMode.TRIANGLES,
    vertexBufferId: useCube ? this.cubeVertexHandle.id : this.sphereVertexHandle.id,
    indexBufferId: useCube ? this.cubeIndexHandle.id : this.sphereIndexHandle.id,
    indexType: 'uint16',
    vertexCount: useCube ? this.cubeIndexCount : this.sphereIndexCount,
    vertexLayout: {
      attributes: [
        {
          name: 'aPosition',
          location: 0,
          format: 'float32x3',
          offset: 0,
          stride: 12,
        },
        {
          name: 'aNormal',
          location: 1,
          format: 'float32x3',
          offset: 0,
          stride: 12,
        },
      ],
    },
    uniforms: new Map([
      ['uModelViewProjection', { type: 'mat4', value: mvpMatrix }],
      ['uModel', { type: 'mat4', value: modelMatrix }],
      ['uNormalMatrix', { type: 'mat3', value: new Float32Array(9) }], // TODO: compute
      ['uLightDir', { type: 'vec3', value: new Float32Array([0.5, 1.0, 0.5]) }],
      ['uCameraPos', { type: 'vec3', value: new Float32Array([...cameraPos]) }],
      ['uBaseColor', { type: 'vec3', value: new Float32Array(color) }],
    ]),
    state: {
      blendMode: 'none',
      depthTest: 'less',
      depthWrite: true,
      cullMode: 'back',
    },
  };
}
```

### Step 4: Submit to RenderQueue ⏸️

**Replace direct rendering:**
```typescript
// OLD:
gl.bindBuffer(...);
gl.drawElements(...);

// NEW:
const drawCmd = this.createDrawCommand(...);
renderQueue.submit({
  drawCommand: drawCmd,
  materialId: `dice-${diceEntity.sides}`,
  worldMatrix: modelMatrix,
  depth: 0,  // Auto-calculated
  sortKey: 0, // Auto-calculated
});
```

### Step 5: Sort and Execute ⏸️

**Replace end of render loop:**
```typescript
// Sort for optimal rendering
renderQueue.sort();

// Get sorted commands
const queuedCommands = renderQueue.getCommands();
const renderCommands = queuedCommands.map(qc => qc.drawCommand);

// Execute via backend
backend.executeCommands(renderCommands);

// Log stats
const stats = renderQueue.getStats();
console.log(`Queue stats: ${stats.totalCommands} commands, ${stats.sortTime.toFixed(2)}ms sort time`);
```

## Benefits When Complete

1. **Backend Agnostic**: Same rendering code works with WebGPU or WebGL2
2. **Automatic Sorting**: Front-to-back for opaque, back-to-front for transparent
3. **State Change Minimization**: RenderQueue groups by material
4. **Performance**: Optimal draw call ordering reduces overdraw
5. **Clean Architecture**: Separation between command building and execution

## Migration Strategy

**Recommended Approach**: Incremental migration

1. ✅ **Phase 5a**: Backend creation (DONE)
2. ✅ **Phase 5b**: WGSL shaders (DONE)
3. ⏸️ **Phase 5c**: Parallel implementation
   - Keep current rendering working
   - Add new backend-based rendering path alongside
   - Test and verify both paths work
   - Switch to new path when ready
   - Remove legacy path

**Alternative**: Big-bang rewrite (risky, not recommended)

## Estimated Effort

- **Backend buffer creation**: 2-4 hours
- **DrawCommand building**: 4-6 hours
- **RenderQueue integration**: 2-3 hours
- **Testing and debugging**: 4-6 hours
- **Total**: 12-19 hours

## Files to Modify

- `packages/renderer/src/demo.ts` - Main rendering loop
- `packages/renderer/src/joints-demo.ts` - Joints demo (similar changes)

## Reference Implementation

See `packages/rendering/tests/RenderQueue.test.ts` for examples of:
- Creating QueuedDrawCommand objects
- Submitting to RenderQueue
- Sorting and retrieving commands

## Next Steps

When ready to continue:
1. Create backend buffer handles in createGeometry()
2. Implement createDrawCommand() helper method
3. Replace rendering loop with RenderQueue submission
4. Test with both WebGPU and WebGL2 backends
5. Apply same changes to joints demo
