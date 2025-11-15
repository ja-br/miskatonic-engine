# WebGPUBackend Module Extraction Plan

**Epic:** RENDERING-05 Task 5.3
**Goal:** Split 1784-line WebGPUBackend.ts into 6 focused modules
**Status:** Ready to Execute

## Module Extraction Order

### 1. WebGPUResourceManager (~400 lines) - FIRST
**Responsibility:** Resource lifecycle (shaders, buffers, textures, framebuffers)

**Extract From WebGPUBackend.ts:**
- Resource maps: `shaders`, `buffers`, `textures`, `framebuffers` (lines ~102-105)
- Methods to extract:
  - `createShader()` (lines ~1071-1117)
  - `createBuffer()` (lines ~1119-1163)
  - `updateBuffer()` (lines ~1165-1177)
  - `destroyBuffer()` (lines ~1179-1193)
  - `createTexture()` (lines ~1435-1523)
  - `destroyTexture()` (lines ~1525-1538)
  - `createFramebuffer()` (lines ~1540-1597)
  - `destroyFramebuffer()` (lines ~1599-1627)
  - `createSampler()` (lines ~1629-1655)
  - `dispose()` cleanup logic (lines ~1701-1759)
- Helper methods:
  - `getWebGPUTextureFormat()` (lines ~1752-1760)

**Dependencies:**
- WebGPUContext (device, adapter)
- ModuleConfig (bufferPool, vramProfiler, reflectionParser, recoverySystem)

**Interface:**
```typescript
export class WebGPUResourceManager {
  constructor(
    private ctx: WebGPUContext,
    private config: ModuleConfig
  ) {}

  createShader(id: string, source: ShaderSource): BackendShaderHandle
  createBuffer(...): BackendBufferHandle
  createTexture(...): BackendTextureHandle
  createFramebuffer(...): BackendFramebufferHandle
  createSampler(...): GPUSampler

  destroyShader/Buffer/Texture/Framebuffer(handle): void
  dispose(): void
}
```

---

### 2. WebGPUPipelineManager (~350 lines) - SECOND
**Responsibility:** Pipeline caching, bind group layouts, vertex layouts

**Extract From WebGPUBackend.ts:**
- Cache maps: `pipelineCache`, `bindGroupLayouts` (lines ~108, ~114)
- Methods to extract:
  - `getPipeline()` (lines ~808-879)
  - `hashVertexLayout()` (lines ~881-890)
  - `buildVertexBuffers()` (lines ~892-944)
  - `getGPUVertexFormat()` (lines ~946-960)
  - `getAttributeByteSize()` (lines ~962-976)

**Dependencies:**
- WebGPUContext (device)
- WebGPUResourceManager (to get shaders)

**Interface:**
```typescript
export class WebGPUPipelineManager {
  constructor(
    private ctx: WebGPUContext,
    private resourceMgr: WebGPUResourceManager
  ) {}

  getPipeline(...): GPURenderPipeline
  hashVertexLayout(layout): string
  clearCache(): void
}
```

---

### 3. WebGPUCommandEncoder (~300 lines) - THIRD
**Responsibility:** Draw command execution

**Extract From WebGPUBackend.ts:**
- Methods to extract:
  - `executeDrawCommand()` (lines ~596-642)
  - `executeIndexedDraw()` (lines ~644-669)
  - `executeNonIndexedDraw()` (lines ~671-688)
  - `executeIndirectDraw()` (lines ~690-720)
  - `executeComputeDispatch()` (lines ~722-756)

**Dependencies:**
- WebGPUContext (device, commandEncoder, currentPass)
- WebGPUPipelineManager (getPipeline)
- WebGPUResourceManager (getBuffer, getTexture)

**Interface:**
```typescript
export class WebGPUCommandEncoder {
  constructor(
    private ctx: WebGPUContext,
    private pipelineMgr: WebGPUPipelineManager,
    private resourceMgr: WebGPUResourceManager
  ) {}

  executeDrawCommand(command: DrawCommand): void
}
```

---

### 4. WebGPUModernAPI (~200 lines) - FOURTH
**Responsibility:** Epic 3.14 modern API (bind groups, pipelines)

**Extract From WebGPUBackend.ts:**
- Bind group cache: `bindGroups` (line ~109)
- Methods to extract:
  - `createBindGroupLayout()` (lines ~978-1029)
  - `createBindGroup()` (lines ~1031-1069)
  - `createRenderPipeline()` (lines ~1195-1320)
  - `createComputePipeline()` (lines ~1322-1373)
  - `convertVisibilityFlags()` (lines ~1665-1684)
  - `convertBindingType()` (lines ~1686-1750)

**Dependencies:**
- WebGPUContext (device)
- WebGPUResourceManager (getShader)
- ModuleConfig (bindGroupPool)

**Interface:**
```typescript
export class WebGPUModernAPI {
  constructor(
    private ctx: WebGPUContext,
    private resourceMgr: WebGPUResourceManager,
    private config: ModuleConfig
  ) {}

  createBindGroupLayout(...): BackendBindGroupLayoutHandle
  createBindGroup(...): BackendBindGroupHandle
  createRenderPipeline(...): BackendPipelineHandle
  createComputePipeline(...): BackendPipelineHandle
}
```

---

### 5. WebGPURenderPassManager (~250 lines) - FIFTH
**Responsibility:** Render pass lifecycle, frame management

**Extract From WebGPUBackend.ts:**
- State: `currentRenderPass`, `depthTexture` (lines ~99, ~121)
- Methods to extract:
  - `beginRenderPass()` (lines ~448-594)
  - `endRenderPass()` (lines ~727-756)
  - `clear()` (lines ~758-765)
  - `resize()` (lines ~767-806)
  - Depth texture creation from `initialize()` (lines ~213-220)

**Dependencies:**
- WebGPUContext (device, context, commandEncoder)
- WebGPUResourceManager (createTexture for depth)

**Interface:**
```typescript
export class WebGPURenderPassManager {
  constructor(
    private ctx: WebGPUContext,
    private resourceMgr: WebGPUResourceManager
  ) {}

  beginRenderPass(...): void
  endRenderPass(): void
  clear(...): void
  resize(width, height): void
}
```

---

### 6. WebGPUBackend (Refactored ~300 lines) - FINAL
**Responsibility:** Coordinator, facade, public API

**Keeps:**
- `initialize()` - delegates to ResourceManager
- `getCapabilities()` - queries device
- `isContextLost()` - checks device
- `reinitialize()` - coordinates recovery
- `beginFrame()` / `endFrame()` - frame lifecycle
- `executeDrawCommand()` - delegates to CommandEncoder
- `getStats()` / `resetStats()` - statistics
- All public IRendererBackend methods (delegate to modules)

**Dependencies:** ALL modules

**Structure:**
```typescript
export class WebGPUBackend implements IRendererBackend {
  private resourceMgr: WebGPUResourceManager;
  private pipelineMgr: WebGPUPipelineManager;
  private commandEncoder: WebGPUCommandEncoder;
  private modernAPI: WebGPUModernAPI;
  private renderPassMgr: WebGPURenderPassManager;

  // Delegates all methods to appropriate modules
}
```

---

## Execution Checklist

- [ ] Extract WebGPUResourceManager
- [ ] Test: `npm run typecheck --workspace=@miskatonic/rendering`
- [ ] Extract WebGPUPipelineManager
- [ ] Test: `npm run typecheck`
- [ ] Extract WebGPUCommandEncoder
- [ ] Test: `npm run typecheck`
- [ ] Extract WebGPUModernAPI
- [ ] Test: `npm run typecheck`
- [ ] Extract WebGPURenderPassManager
- [ ] Test: `npm run typecheck`
- [ ] Refactor WebGPUBackend as coordinator
- [ ] Test: Full test suite
- [ ] Verify: Public API unchanged
- [ ] Commit: Module extraction complete

## Success Metrics
- WebGPUBackend.ts: 1784 lines → ~300 lines (coordinator)
- 6 new modules: ~1500 lines total
- ✅ No breaking changes to public API
- ✅ All tests pass
- ✅ TypeScript strict mode compliance
- ✅ Clear separation of concerns
