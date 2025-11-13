# Epic 3.14: Modern Rendering API Migration Guide

This guide shows how to migrate from the old rendering API to the new Modern Rendering API introduced in Epic 3.14.

## Overview of Changes

Epic 3.14 introduces a complete architectural refactoring of the rendering API to properly support:

- **Multiple bind groups** - Separate scene/object/material data
- **Storage buffers** - Large data arrays (multi-light systems, instancing)
- **Compute shaders** - GPU-accelerated light culling, particles, etc.
- **Shader reflection** - Automatic bind group layout extraction
- **Type-safe pipelines** - No more `as any` casts

## Feature Flags

The new API is controlled by feature flags for incremental rollout:

```typescript
import { featureFlags } from '@miskatonic/rendering';

// Enable all Epic 3.14 features
featureFlags.enableAllEpic314Features();

// Or enable individual features
featureFlags.enable('useNewBindGroups');
featureFlags.enable('enableStorageBuffers');
featureFlags.enable('enableComputePipelines');

// Rollback if needed
featureFlags.disableAllEpic314Features();
```

## Core Concepts

### Old API: Hardcoded Bind Groups

The old API used a single hardcoded bind group layout:

```typescript
// Old: Hardcoded bind group with one uniform buffer
const shader = backend.createShader(id, shaderSource);
// Shader automatically gets a bind group layout with:
// - @binding(0) = uniform buffer (scene/object data mixed)
```

**Problems:**
- Cannot use multiple bind groups
- Limited to 64KB uniform buffers
- No storage buffer support
- Manual uniform packing required

### New API: Dynamic Bind Groups

The new API allows you to define custom bind group layouts:

```typescript
// New: Define bind group layouts explicitly
const sceneLayout = backend.createBindGroupLayout({
  entries: [
    { binding: 0, visibility: ['vertex', 'fragment'], type: 'uniform' },
    { binding: 1, visibility: ['fragment'], type: 'storage' }, // Light array!
  ],
});

const objectLayout = backend.createBindGroupLayout({
  entries: [
    { binding: 0, visibility: ['vertex'], type: 'uniform' },
  ],
});
```

**Benefits:**
- Multiple bind groups (group 0 = scene, group 1 = object, etc.)
- Storage buffers for large arrays (lights, instances)
- Automatic validation
- Clear separation of concerns

## Migration Examples

### Example 1: Simple Draw Call

#### Old API

```typescript
// Old: DrawCommand with mixed uniforms
const command: DrawCommand = {
  type: RenderCommandType.DRAW,
  shader: 'basic_shader',
  mode: PrimitiveMode.TRIANGLES,
  vertexBufferId: 'cube_vertices',
  indexBufferId: 'cube_indices',
  vertexCount: 36,
  vertexLayout: {
    attributes: [
      { name: 'position', size: 3, type: 'float' },
      { name: 'normal', size: 3, type: 'float' },
    ],
  },
  uniforms: new Map([
    ['uModelViewProjection', { type: 'mat4', value: mvpMatrix }],
    ['uModel', { type: 'mat4', value: modelMatrix }],
  ]),
};

backend.executeCommands([command]);
```

#### New API

```typescript
// New: Separate bind group creation and pipeline
import { OPAQUE_PIPELINE_STATE } from '@miskatonic/rendering';

// 1. Create shader with reflection
const { handle: shader, reflection } = backend.createShaderWithReflection(
  'basic_shader',
  shaderSource
);

// 2. Create bind group layouts (automatically from reflection)
const sceneLayout = backend.createBindGroupLayout(reflection.bindGroupLayouts[0]);

// 3. Create pipeline
const vertexLayout = {
  arrayStride: 24, // 6 floats * 4 bytes
  stepMode: 'vertex' as const,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
    { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
  ],
};

const pipeline = backend.createRenderPipeline({
  shader,
  vertexLayouts: [vertexLayout],
  bindGroupLayouts: [sceneLayout],
  pipelineState: OPAQUE_PIPELINE_STATE,
  colorFormat: 'bgra8unorm',
  depthFormat: 'depth24plus',
});

// 4. Create bind group with resources
const sceneBuffer = backend.createBuffer('scene_uniforms', 'uniform', uniformData, 'static_draw');
const sceneBindGroup = backend.createBindGroup(sceneLayout, {
  bindings: [
    { binding: 0, resource: sceneBuffer },
  ],
});

// 5. Submit draw command (NewDrawCommand)
const command: NewDrawCommand = {
  type: 'drawIndexed',
  pipeline,
  bindGroups: new Map([[0, sceneBindGroup]]),
  vertexBuffers: [vertexBuffer],
  indexBuffer,
  indexCount: 36,
};

// executeCommands accepts NewDrawCommand when feature flag is enabled
```

### Example 2: Multi-Light Rendering with Storage Buffers

#### Old API (Not Possible)

```typescript
// Old API: Cannot do this! Uniform buffers limited to 64KB
// Would need to split lights across multiple buffers or reduce count
```

#### New API

```typescript
// New: Storage buffers support 128MB+ of light data!

// 1. Create shader with storage buffer bindings
const shaderSource = `
  struct DirectionalLight {
    direction: vec3<f32>,
    color: vec3<f32>,
    intensity: f32,
  }

  @group(0) @binding(0) var<uniform> sceneData: mat4x4<f32>;
  @group(0) @binding(1) var<storage, read> directionalLights: array<DirectionalLight>;
  @group(0) @binding(2) var<storage, read> pointLights: array<PointLight>;
  @group(0) @binding(3) var<storage, read> lightCounts: vec4<u32>;

  @fragment
  fn fs_main() -> @location(0) vec4<f32> {
    let dirLightCount = lightCounts.x;
    var lighting = vec3<f32>(0.0);

    // Process all lights
    for (var i = 0u; i < dirLightCount; i++) {
      let light = directionalLights[i];
      lighting += calculateDirectionalLight(light);
    }

    return vec4<f32>(lighting, 1.0);
  }
`;

// 2. Create storage buffers
const directionalLightsBuffer = backend.createBuffer(
  'directional_lights',
  'storage', // NEW: storage buffer type!
  directionalLightData,
  'dynamic_draw'
);

const pointLightsBuffer = backend.createBuffer(
  'point_lights',
  'storage',
  pointLightData,
  'dynamic_draw'
);

// 3. Create bind group layout with storage buffers
const sceneLayout = backend.createBindGroupLayout({
  entries: [
    { binding: 0, visibility: ['vertex', 'fragment'], type: 'uniform', minBindingSize: 256 },
    { binding: 1, visibility: ['fragment'], type: 'storage', minBindingSize: 512 }, // Dir lights
    { binding: 2, visibility: ['fragment'], type: 'storage', minBindingSize: 512 }, // Point lights
    { binding: 3, visibility: ['fragment'], type: 'storage', minBindingSize: 256 }, // Counts
  ],
});

// 4. Create bind group with all resources
const sceneBindGroup = backend.createBindGroup(sceneLayout, {
  bindings: [
    { binding: 0, resource: sceneUniformBuffer },
    { binding: 1, resource: directionalLightsBuffer },
    { binding: 2, resource: pointLightsBuffer },
    { binding: 3, resource: lightCountsBuffer },
  ],
});

// Now you can render with 100+ dynamic lights!
```

### Example 3: Compute Shader for Light Culling

#### Old API (Not Supported)

```typescript
// Old API: No compute shader support
```

#### New API

```typescript
// New: Full compute pipeline support!

// 1. Create compute shader
const computeShader = `
  @group(0) @binding(0) var<storage, read> lightPositions: array<vec4<f32>>;
  @group(0) @binding(1) var<storage, read> frustumPlanes: array<vec4<f32>>;
  @group(0) @binding(2) var<storage, read_write> visibleLightIndices: array<u32>;

  @compute @workgroup_size(64, 1, 1)
  fn compute_main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let lightIndex = gid.x;
    if (lightIndex >= arrayLength(&lightPositions)) {
      return;
    }

    let lightPos = lightPositions[lightIndex];
    var visible = true;

    // Test against all frustum planes
    for (var i = 0u; i < 6u; i++) {
      let plane = frustumPlanes[i];
      if (dot(lightPos, plane) < 0.0) {
        visible = false;
        break;
      }
    }

    if (visible) {
      let outputIndex = atomicAdd(&visibleLightIndices[0], 1u);
      visibleLightIndices[outputIndex + 1] = lightIndex;
    }
  }
`;

// 2. Create compute pipeline
const { handle: computeShaderHandle } = backend.createShaderWithReflection(
  'light_culler',
  { vertex: computeShader, fragment: '' } // Compute uses vertex field
);

const computeLayout = backend.createBindGroupLayout({
  entries: [
    { binding: 0, visibility: ['compute'], type: 'storage' },
    { binding: 1, visibility: ['compute'], type: 'storage' },
    { binding: 2, visibility: ['compute'], type: 'storage' },
  ],
});

const computePipeline = backend.createComputePipeline({
  shader: computeShaderHandle,
  bindGroupLayouts: [computeLayout],
  entryPoint: 'compute_main',
});

// 3. Dispatch compute
backend.beginFrame();

const computeBindGroup = backend.createBindGroup(computeLayout, {
  bindings: [
    { binding: 0, resource: lightPositionsBuffer },
    { binding: 1, resource: frustumPlanesBuffer },
    { binding: 2, resource: visibleLightIndicesBuffer },
  ],
});

// Dispatch workgroups (e.g., 100 lights / 64 per workgroup = 2 workgroups)
const workgroupCount = Math.ceil(lightCount / 64);
backend.dispatchCompute(computePipeline, workgroupCount, 1, 1);

backend.endFrame();
```

## Performance Monitoring

Use the new performance baseline system to track regressions:

```typescript
import { performanceBaseline } from '@miskatonic/rendering';

// Before migration
performanceBaseline.start();
for (let i = 0; i < 100; i++) {
  renderFrame();
  performanceBaseline.recordFrame({
    frameTime: getFrameTime(),
    drawCalls: getDrawCalls(),
    bufferUpdates: getBufferUpdates(),
    shaderSwitches: getShaderSwitches(),
  });
}
const oldAverage = performanceBaseline.getAverage();

// After migration
performanceBaseline.start();
// ... render with new API
const newAverage = performanceBaseline.getAverage();

// Compare
const comparison = performanceBaseline.compare(oldAverage!, newAverage!);
console.log(`Frame time change: ${comparison.frameTimeChange.toFixed(2)}%`);

// Target: <5% overhead from new API
```

## Checklist for Migration

- [ ] Enable feature flags for testing
- [ ] Identify all shaders using uniform buffers >64KB
- [ ] Convert to storage buffers where needed
- [ ] Create explicit bind group layouts for all shaders
- [ ] Update all DrawCommands to NewDrawCommand format
- [ ] Add compute pipelines for GPU workloads
- [ ] Run performance baseline tests
- [ ] Verify <5% performance overhead
- [ ] Remove all `as any` casts
- [ ] Update tests to use new API

## Breaking Changes (Alpha v0.x.x)

As this is alpha software, backward compatibility is NOT maintained:

**Removed immediately:**
- Old DrawCommand interface (use NewDrawCommand)
- Hardcoded bind group layouts
- `uniformBindings` and `attributeBindings` fields
- Manual uniform buffer management

**New requirements:**
- Must create bind group layouts explicitly
- Must create pipelines with full state
- Must use storage buffers for arrays >64KB
- Must handle resource lifetime manually

## Common Issues

### Issue: "Uniform buffer too large"
**Solution:** Use storage buffers instead:
```typescript
// Old
const buffer = backend.createBuffer('data', 'uniform', largeArray, 'static_draw');

// New
const buffer = backend.createBuffer('data', 'storage', largeArray, 'static_draw');
```

### Issue: "Bind group layout mismatch"
**Solution:** Ensure shader bindings match layout:
```typescript
// Shader: @group(0) @binding(1) var<storage> lights
// Layout must have: { binding: 1, type: 'storage' }
```

### Issue: "Cannot find GPUVertexBufferLayout"
**Solution:** Use backend-agnostic VertexBufferLayout:
```typescript
import type { VertexBufferLayout } from '@miskatonic/rendering';
const layout: VertexBufferLayout = { arrayStride: 24, ... };
```

## Next Steps

1. Review the [Epic 3.14 Tests](./tests/ModernRenderingAPI.test.ts) for more examples
2. Check the [Initiative File](../../planning/initiatives/INIT-003-14-modern-rendering-api.md) for full specification
3. See [WebGPUBackend](./src/backends/WebGPUBackend.ts) for implementation details

## Support

For questions or issues with migration:
- Review bind group descriptor helpers in `src/BindGroupDescriptors.ts`
- See pipeline state presets in `src/PipelineStateDescriptor.ts`
