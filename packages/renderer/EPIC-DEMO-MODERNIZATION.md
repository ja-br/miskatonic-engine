# EPIC: Demo Modernization - Full Engine Integration

**Status:** Planning
**Priority:** P1 (High - demonstrates engine capabilities)
**Dependencies:** Epic 2.11, 3.2, 3.9, 3.10, 3.11, 3.12

## Overview

Upgrade both demo applications (dice roll and joint constraints) to use the full modern engine architecture, showcasing all new features implemented in recent epics. This will transform the demos from legacy standalone code into proper examples of how to use the Miskatonic Engine.

## Goals

1. **Demonstrate ECS Architecture**: Show proper World/Entity/Component patterns
2. **Showcase Modern Systems**: Use CameraSystem, TransformSystem, RenderQueue
3. **Exhibit Best Practices**: External shaders, proper resource management, clean code
4. **Maintain Functionality**: Keep all existing features working (physics, rendering, controls)
5. **Improve Performance**: Leverage cache-efficient SoA storage and batched rendering

## Current State

### Dice Roll Demo (`index.html` / `demo.ts`)
- ❌ No ECS usage - standalone imperative code
- ❌ Legacy Camera + OrbitControls (standalone)
- ❌ Inline GLSL shader strings
- ❌ Manual draw calls with basic batching
- ❌ Manual matrix calculations
- ✅ Physics integration working (Rapier)
- ✅ Basic rendering functional (WebGL2)

### Joint Constraints Demo (`joints.html` / `joints.ts`)
- ❌ No ECS usage - standalone imperative code
- ❌ Legacy Camera + OrbitControls (standalone)
- ❌ Inline GLSL shader strings
- ❌ Manual draw calls
- ❌ Manual matrix calculations
- ❌ Single motor speed slider (limited control)
- ✅ Physics integration working (joints)
- ✅ Basic rendering functional (WebGL2)

## Target State

### Both Demos After Modernization
- ✅ Full ECS integration with World/Entity/Component
- ✅ CameraSystem + OrbitCameraController (Epic 3.10)
- ✅ External shader files with ShaderManager (Epic 3.9)
- ✅ RenderQueue for automatic batching (Epic 3.12)
- ✅ TransformSystem for hierarchical transforms (Epic 3.11)
- ✅ WebGPU backend support with WebGL2 fallback (Epic 3.2)
- ✅ Proper resource lifecycle management
- ✅ All existing functionality maintained

### Dice Demo Enhancements
- ✅ Exponential slider (1, 2, 4, 8, 16, 32, 64, 128 sets)
- ✅ Additive roll behavior (accumulate dice)
- ✅ Reset button
- ✅ Keyboard shortcuts
- ✅ Visual feedback and polish

### Joints Demo Enhancements
- ✅ Granular controls for each joint constraint
- ✅ Individual object manipulation
- ✅ Joint parameter live editing
- ✅ Constraint visualization toggles

---

## Task Breakdown

### Phase 1: Infrastructure Setup (Foundation)

#### Task 1.1: Create External Shader Files
**Files:**
- `packages/renderer/src/shaders/basic-lighting.vert`
- `packages/renderer/src/shaders/basic-lighting.frag`

**Acceptance Criteria:**
- Extract inline GLSL from demo.ts into separate files
- Add proper shader header comments
- Test shader compilation with ShaderLoader
- Verify rendering output matches current visuals

**Implementation Notes:**
```glsl
// basic-lighting.vert
#version 300 es
precision highp float;

in vec3 a_position;
in vec3 a_normal;

uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat4 u_normalMatrix;

out vec3 v_normal;
out vec3 v_worldPosition;

void main() {
  // ... existing vertex shader logic
}
```

---

#### Task 1.2: Setup Dice Demo ECS Foundation
**Files Modified:**
- `packages/renderer/src/demo.ts`

**Acceptance Criteria:**
- Create World instance
- Initialize TransformSystem and CameraSystem
- Keep physics working alongside ECS
- No visual regressions

**Implementation Steps:**
1. Import `World`, `TransformSystem`, `CameraSystem` from packages
2. Create `this.world = new World()` in constructor
3. Register systems: `world.registerSystem(new TransformSystem(world))`
4. Create main update loop that calls `world.update(deltaTime)`
5. Keep existing physics code working

**Code Structure:**
```typescript
import { World, TransformSystem, Camera as CameraComponent } from '@miskatonic/ecs';
import { CameraSystem, OrbitCameraController } from '@miskatonic/rendering';

export class Demo {
  private world: World;
  private transformSystem: TransformSystem;
  private cameraSystem: CameraSystem;
  private cameraEntity: EntityId;
  private cameraController: OrbitCameraController;

  async initialize(): Promise<boolean> {
    // Create ECS world
    this.world = new World();

    // Register systems
    this.transformSystem = new TransformSystem(this.world);
    this.world.registerSystem(this.transformSystem);

    this.cameraSystem = new CameraSystem(this.world);
    this.world.registerSystem(this.cameraSystem);

    // ... rest of initialization
  }
}
```

---

#### Task 1.3: Setup Joints Demo ECS Foundation
**Files Modified:**
- `packages/renderer/src/joints.ts`

**Acceptance Criteria:**
- Same as Task 1.2 but for joints demo
- All joint constraints still functional
- No visual regressions

---

### Phase 2: Camera System Migration

#### Task 2.1: Migrate Dice Demo Camera to ECS
**Files Modified:**
- `packages/renderer/src/demo.ts`

**Acceptance Criteria:**
- Remove legacy `Camera` and `OrbitControls`
- Create camera entity with Camera component
- Use `OrbitCameraController` from Epic 3.10
- Mouse controls work identically to before
- View/projection matrices update correctly

**Implementation Steps:**
1. Create camera entity: `this.cameraEntity = this.world.createEntity()`
2. Add Transform component to camera entity
3. Add Camera component with perspective projection
4. Create OrbitCameraController instance
5. Wire up mouse events to controller
6. Update rendering to use camera entity's matrices

**Code Example:**
```typescript
// Create camera entity
this.cameraEntity = this.world.createEntity();
this.world.addComponent(this.cameraEntity, Transform, {
  x: 0, y: 25, z: 35,
  // ... other transform fields
});

this.world.addComponent(this.cameraEntity, Camera, {
  projectionType: 0, // Perspective
  fov: Math.PI / 4,
  aspect: this.canvas.width / this.canvas.height,
  near: 0.1,
  far: 300,
  // ... other camera fields
});

// Create orbit controller
this.cameraController = new OrbitCameraController(
  this.cameraEntity,
  this.world,
  35 // initial distance
);

// Wire up mouse events
this.canvas.addEventListener('mousedown', (e) => {
  // ... handle orbit rotation
});
this.canvas.addEventListener('wheel', (e) => {
  this.cameraController.zoom(e.deltaY * 0.01);
});
```

---

#### Task 2.2: Migrate Joints Demo Camera to ECS
**Files Modified:**
- `packages/renderer/src/joints.ts`

**Acceptance Criteria:**
- Same as Task 2.1 but for joints demo
- Camera controls work identically

---

### Phase 3: Render Entity Migration

#### Task 3.1: Convert Dice Bodies to ECS Entities
**Files Modified:**
- `packages/renderer/src/demo.ts`

**Acceptance Criteria:**
- Each dice becomes an ECS entity with Transform component
- Sync Transform from physics body positions
- Ground plane is an entity
- Rendering uses entity transforms
- Physics handles still work

**Implementation Steps:**
1. Create `DiceEntity` component type to link entity to physics handle
2. When creating dice physics bodies, also create ECS entities
3. Add Transform component to each dice entity
4. In physics update loop, sync Transform from physics body
5. Rendering loop iterates entities instead of physics bodies
6. Store entity ID alongside physics handle

**Code Structure:**
```typescript
// Register custom component
@RegisterComponent([
  createFieldDescriptor('bodyHandle', 0, Uint32Array),
  createFieldDescriptor('sides', 6, Uint8Array),
])
class DiceEntity implements Component {
  bodyHandle: number = 0;
  sides: number = 6;
}

// Create dice entity
createDice(x: number, y: number, z: number): EntityId {
  // Create physics body
  const bodyHandle = this.physicsWorld.createRigidBody({ ... });

  // Create ECS entity
  const entity = this.world.createEntity();
  this.world.addComponent(entity, Transform, { x, y, z, ... });
  this.world.addComponent(entity, DiceEntity, {
    bodyHandle,
    sides: 6
  });

  return entity;
}

// Update loop: sync physics to transform
update(deltaTime: number): void {
  // Step physics
  this.physicsWorld.step(deltaTime);

  // Sync transforms from physics
  const query = this.world.query()
    .with(Transform)
    .with(DiceEntity)
    .build();

  for (const { components } of this.world.executeQuery(query)) {
    const transform = components.get(Transform);
    const dice = components.get(DiceEntity);
    const physicsTransform = this.physicsWorld.getRigidBodyTransform(dice.bodyHandle);

    transform.x = physicsTransform.translation.x;
    transform.y = physicsTransform.translation.y;
    transform.z = physicsTransform.translation.z;
    // ... sync rotation
  }
}
```

---

#### Task 3.2: Convert Joint Demo Objects to ECS Entities
**Files Modified:**
- `packages/renderer/src/joints.ts`

**Acceptance Criteria:**
- All joint demo objects are entities
- Transforms sync from physics
- All 6 joint types still functional
- No visual regressions

---

### Phase 4: Shader System Integration

#### Task 4.1: Integrate ShaderManager into Dice Demo
**Files Modified:**
- `packages/renderer/src/demo.ts`

**Acceptance Criteria:**
- ShaderManager loads external shader files
- Shader hot-reload works in dev mode
- Remove inline GLSL strings
- Rendering output unchanged

**Implementation Steps:**
1. Create ShaderManager instance with renderer backend
2. Use ShaderLoader to load external files
3. Replace manual shader compilation with ShaderManager API
4. Test hot-reload by modifying shader and seeing instant update

**Code Example:**
```typescript
import { ShaderManager, ShaderLoader } from '@miskatonic/rendering';

// In initialization
this.shaderManager = new ShaderManager(this.renderer.getBackend());
this.shaderLoader = new ShaderLoader(this.shaderManager, {
  shaderDir: '/src/shaders',
  enableHotReload: process.env.NODE_ENV === 'development'
});

// Load shader
const shader = await this.shaderLoader.load('basic-lighting', {
  features: { LIGHTING: true }
});

// Use shader handle in rendering
this.shaderHandle = shader.handle;
```

---

#### Task 4.2: Integrate ShaderManager into Joints Demo
**Files Modified:**
- `packages/renderer/src/joints.ts`

**Acceptance Criteria:**
- Same as Task 4.1 for joints demo

---

### Phase 5: Render Queue Integration

#### Task 5.1: Use RenderQueue in Dice Demo
**Files Modified:**
- `packages/renderer/src/demo.ts`

**Acceptance Criteria:**
- Replace manual draw calls with RenderQueue
- Automatic batching by material
- Opaque objects sorted front-to-back
- Performance improvement measurable
- No visual regressions

**Implementation Steps:**
1. Create RenderQueue instance
2. Build draw commands for each entity
3. Submit to queue instead of immediate rendering
4. Call `queue.sort()` and `queue.execute()`
5. Measure draw call reduction

**Code Example:**
```typescript
import { RenderQueue } from '@miskatonic/rendering';

// In initialization
this.renderQueue = new RenderQueue();

// In render loop
render(): void {
  this.renderQueue.clear();

  // Get camera matrices from CameraSystem
  const cameraInfo = this.cameraSystem.getCameraInfo(this.cameraEntity);
  this.renderQueue.setCameraInfo(cameraInfo);

  // Submit all dice entities
  const query = this.world.query()
    .with(Transform)
    .with(DiceEntity)
    .build();

  for (const { entity, components } of this.world.executeQuery(query)) {
    const transform = components.get(Transform);
    const worldMatrix = this.transformSystem.getWorldMatrix(entity);

    this.renderQueue.submitDraw({
      shader: this.shaderHandle,
      vertexBuffer: this.cubeVertexBuffer,
      indexBuffer: this.cubeIndexBuffer,
      indexCount: this.cubeIndexCount,
      worldMatrix,
      material: this.diceMaterial,
      transparent: false,
    });
  }

  // Sort and execute
  this.renderQueue.sort();
  this.renderQueue.execute(this.renderer.getBackend());

  // Log stats
  const stats = this.renderQueue.getStats();
  console.log(`Draw calls: ${stats.drawCalls}, Batches: ${stats.batches}`);
}
```

---

#### Task 5.2: Use RenderQueue in Joints Demo
**Files Modified:**
- `packages/renderer/src/joints.ts`

**Acceptance Criteria:**
- Same as Task 5.1 for joints demo

---

### Phase 6: Transform System Integration

#### Task 6.1: Use TransformSystem for Dice Demo
**Files Modified:**
- `packages/renderer/src/demo.ts`

**Acceptance Criteria:**
- TransformSystem manages all entity transforms
- World matrices computed automatically
- Dirty flagging works (only recompute when changed)
- No manual matrix math in demo code

**Implementation Steps:**
1. Remove manual matrix calculations
2. Use `transformSystem.getWorldMatrix(entity)` for rendering
3. Let TransformSystem handle matrix updates
4. Verify performance improvement from dirty flagging

---

#### Task 6.2: Use TransformSystem for Joints Demo
**Files Modified:**
- `packages/renderer/src/joints.ts`

**Acceptance Criteria:**
- Same as Task 6.1 for joints demo
- Hierarchical transforms used for ragdoll arm

**Bonus:**
- Demonstrate parent-child relationships for ragdoll arm joints

---

### Phase 7: Backend Modernization

#### Task 7.1: Add WebGPU Support to Dice Demo
**Files Modified:**
- `packages/renderer/src/demo.ts`
- `packages/renderer/index.html`

**Acceptance Criteria:**
- Detect WebGPU support at runtime
- Use WebGPU if available, fallback to WebGL2
- Add UI toggle to switch backends
- Both backends render identically

**Implementation Steps:**
1. Use BackendFactory to detect and create backend
2. Add radio buttons to HTML for backend selection
3. Allow runtime backend switching
4. Verify feature parity

**Code Example:**
```typescript
import { BackendFactory, RenderBackend } from '@miskatonic/rendering';

// Detect best backend
const support = await BackendFactory.detectSupport();
const preferredBackend = support.webgpu
  ? RenderBackend.WEBGPU
  : RenderBackend.WEBGL2;

console.log('Using backend:', preferredBackend);
console.log('WebGPU support:', support.webgpu);
console.log('WebGL2 support:', support.webgl2);

// Create renderer with preferred backend
this.renderer = new Renderer({
  backend: preferredBackend,
  // ... other config
});
```

**HTML Addition:**
```html
<div class="control-group">
  <div class="slider-label">Renderer Backend</div>
  <label><input type="radio" name="backend" value="webgl2" checked> WebGL2</label>
  <label><input type="radio" name="backend" value="webgpu"> WebGPU</label>
</div>
```

---

#### Task 7.2: Add WebGPU Support to Joints Demo
**Files Modified:**
- `packages/renderer/src/joints.ts`
- `packages/renderer/joints.html`

**Acceptance Criteria:**
- Same as Task 7.1 for joints demo

---

### Phase 8: Polish and Optimization

#### Task 8.1: Add Performance Metrics Display
**Files Modified:**
- `packages/renderer/index.html`
- `packages/renderer/joints.html`
- `packages/renderer/src/demo.ts`
- `packages/renderer/src/joints.ts`

**Acceptance Criteria:**
- Display ECS entity count
- Display archetype statistics
- Display memory usage (from ECS)
- Display render queue stats (batches, draw calls)
- Display backend in use

**HTML Addition:**
```html
<div id="stats">
  <div>FPS: <span id="fps">0</span></div>
  <div>Backend: <span id="backend">WebGL2</span></div>
  <div>Draw Calls: <span id="draw-calls">0</span></div>
  <div>Batches: <span id="batches">0</span></div>
  <div>Entities: <span id="entities">0</span></div>
  <div>Archetypes: <span id="archetypes">0</span></div>
  <div>Memory: <span id="memory">0</span> KB</div>
</div>
```

---

#### Task 8.2: Code Cleanup and Documentation
**Files Modified:**
- `packages/renderer/src/demo.ts`
- `packages/renderer/src/joints.ts`

**Acceptance Criteria:**
- Remove all legacy/commented code
- Add comprehensive JSDoc comments
- Document ECS architecture in comments
- Add README.md explaining demo architecture
- Clean up imports

**Documentation Structure:**
```typescript
/**
 * Dice Rolling Demo - Full ECS Integration
 *
 * This demo showcases the Miskatonic Engine's architecture:
 * - ECS: World/Entity/Component pattern with cache-efficient storage
 * - Physics: Rapier integration with Transform sync
 * - Rendering: WebGL2/WebGPU backends with RenderQueue
 * - Camera: ECS-based camera with OrbitController
 * - Shaders: External files with hot-reload support
 *
 * Architecture:
 * - World contains all entities and systems
 * - TransformSystem manages spatial hierarchy
 * - CameraSystem manages camera matrices
 * - Physics bodies sync to Transform components
 * - RenderQueue batches draw calls by material
 */
```

---

#### Task 8.3: Create Demo Architecture Documentation
**Files Created:**
- `packages/renderer/DEMOS.md`

**Acceptance Criteria:**
- Explain ECS architecture used
- Document how physics integrates with ECS
- Show code examples of entity creation
- Explain rendering pipeline flow
- Provide troubleshooting guide

---

### Phase 9: Testing and Validation

#### Task 9.1: Visual Regression Testing

**Acceptance Criteria:**
- Dice demo looks identical to previous version
- Joints demo looks identical to previous version
- All physics behaviors unchanged
- Camera controls feel identical
- No performance regressions

**Test Cases:**
1. Roll dice with slider at different values (1-128 sets)
2. Verify all dice land correctly
3. Test camera rotation and zoom
4. Verify lighting matches previous version
5. Check FPS is equal or better

---

#### Task 9.2: Performance Benchmarking

**Acceptance Criteria:**
- Measure baseline performance (current version)
- Measure new version performance
- Document performance improvements
- Verify memory usage improvements from SoA

**Metrics to Measure:**
- FPS with 192 dice (32 sets)
- FPS with 384 dice (64 sets)
- FPS with 768 dice (128 sets)
- Draw call count reduction
- Memory usage (ECS stats)
- Frame time breakdown
- Archetype utilization

**Expected Improvements:**
- Draw calls reduced by 50%+ (batching)
- Memory usage reduced by 30%+ (SoA)
- ECS iteration 4x faster (validated in Epic 2.10)

---

#### Task 9.3: Cross-Browser Testing

**Test Matrix:**
- Chrome (WebGL2 + WebGPU)
- Firefox (WebGL2)
- Safari (WebGL2 + WebGPU)
- Edge (WebGL2 + WebGPU)

**Acceptance Criteria:**
- Both demos work in all browsers
- WebGPU fallback to WebGL2 works
- No console errors
- Performance acceptable on all browsers

---

### Phase 10: Dice Demo UX Improvements

#### Task 10.1: Exponential Dice Slider
**Files Modified:**
- `packages/renderer/index.html`
- `packages/renderer/src/demo.ts`
- `packages/renderer/src/index.ts`

**Acceptance Criteria:**
- Slider uses exponential scale (powers of 2)
- Values: 1, 2, 4, 8, 16, 32, 64, 128 dice sets
- Slider has 8 discrete steps
- UI displays current dice count clearly
- Performance tested with 128 sets (768 dice)

**Implementation Details:**
```html
<!-- HTML: Exponential slider -->
<div class="control-group">
  <div class="slider-label">Dice Sets: <span id="dice-sets">1</span></div>
  <div class="slider-container">
    <input type="range" id="dice-slider" min="0" max="7" value="0" step="1">
  </div>
  <div id="dice-count">6 dice total</div>
</div>
```

```typescript
// TypeScript: Convert slider value to exponential
const sliderValue = parseInt(diceSlider.value, 10); // 0-7
const diceSets = Math.pow(2, sliderValue); // 1, 2, 4, 8, 16, 32, 64, 128
demo.setDiceSets(diceSets);
diceSetsEl.textContent = diceSets.toString();

// Update dice count display
const totalDice = diceSets * 6;
diceCountEl.textContent = `${totalDice} dice total`;
```

**Visual Reference:**
```
Slider Position:  0    1    2    3    4     5     6      7
Dice Sets:        1    2    4    8    16    32    64     128
Total Dice:       6    12   24   48   96    192   384    768
```

**Performance Notes:**
- Test FPS with 768 dice (max configuration)
- May need to cap at 64 sets (384 dice) if performance drops below 30 FPS
- Display warning if FPS drops below threshold

---

#### Task 10.2: Additive Roll Dice Button
**Files Modified:**
- `packages/renderer/src/demo.ts`
- `packages/renderer/index.html`

**Acceptance Criteria:**
- "Roll Dice" button adds new dice to scene (does not remove existing)
- Each roll creates dice sets equal to slider value
- Dice accumulate in scene
- Physics handles all dice simultaneously
- No performance degradation until total exceeds budget

**Code Changes:**
```typescript
// Before (old behavior):
public manualRoll(): void {
  const targetDiceCount = this.diceSets * 6;
  const currentDiceCount = this.diceBodies.length;

  if (targetDiceCount > currentDiceCount) {
    this.addMoreDice(targetDiceCount - currentDiceCount);
  } else if (targetDiceCount < currentDiceCount) {
    this.removeExcessDice(targetDiceCount); // REMOVE THIS
  }

  this.respawnDice(); // Respawn ALL dice
}

// After (new behavior):
public manualRoll(): void {
  // Add NEW dice equal to current slider value
  const newDiceCount = this.diceSets * 6;
  this.addMoreDice(newDiceCount);

  // Spawn only the NEW dice (last N added)
  this.respawnNewDice(newDiceCount);
}

private respawnNewDice(count: number): void {
  // Only respawn the last 'count' dice added
  const startIndex = this.diceBodies.length - count;
  for (let i = startIndex; i < this.diceBodies.length; i++) {
    const dice = this.diceBodies[i];
    // Randomize spawn position to avoid overlap
    const spawnX = dice.spawnPos.x + (Math.random() - 0.5) * 5;
    const spawnZ = dice.spawnPos.z + (Math.random() - 0.5) * 5;
    // Respawn at random height
    this.physicsWorld.setRigidBodyPosition(dice.handle, {
      x: spawnX,
      y: 10 + Math.random() * 5,
      z: spawnZ
    });
    // Random velocity
    this.physicsWorld.setRigidBodyLinearVelocity(dice.handle, {
      x: (Math.random() - 0.5) * 2,
      y: Math.random() * 3,
      z: (Math.random() - 0.5) * 2
    });
    // Random angular velocity
    this.physicsWorld.setRigidBodyAngularVelocity(dice.handle, dice.angularVel);
  }
}
```

**UI Update:**
```html
<div id="dice-count">Total: <span id="total-dice">6</span> dice</div>
```

```typescript
// Update total dice count display
updateDiceCountDisplay(): void {
  const totalDiceEl = document.getElementById('total-dice');
  if (totalDiceEl) {
    const totalDice = this.diceBodies.length;
    totalDiceEl.textContent = totalDice.toString();
  }
}
```

---

#### Task 10.3: Add Reset Button
**Files Modified:**
- `packages/renderer/index.html`
- `packages/renderer/src/demo.ts`
- `packages/renderer/src/index.ts`

**Acceptance Criteria:**
- New "Reset" button clears all dice from scene
- Resets to initial state (slider value of dice sets)
- Button styled consistently with existing UI
- Clear visual feedback when pressed
- Physics properly cleans up removed dice

**HTML Addition:**
```html
<div id="controls">
  <div class="control-group">
    <div class="slider-label">Dice Sets: <span id="dice-sets">1</span></div>
    <div class="slider-container">
      <input type="range" id="dice-slider" min="0" max="7" value="0" step="1">
    </div>
    <div id="dice-count">Total: <span id="total-dice">6</span> dice</div>
  </div>

  <div class="control-group">
    <button id="roll-btn">ROLL DICE</button>
  </div>

  <div class="control-group">
    <button id="reset-btn">RESET</button>
  </div>
</div>
```

**CSS Addition:**
```css
#reset-btn {
  background: #c44;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: bold;
  width: 100%;
}

#reset-btn:hover {
  background: #d55;
}

#reset-btn:active {
  background: #a33;
}
```

**TypeScript Implementation:**
```typescript
// In demo.ts
public resetDice(): void {
  // Remove all dice entities from ECS
  const query = this.world.query()
    .with(Transform)
    .with(DiceEntity)
    .build();

  const entitiesToRemove: EntityId[] = [];
  for (const { entity } of this.world.executeQuery(query)) {
    entitiesToRemove.push(entity);
  }

  // Remove entities and physics bodies
  for (const entity of entitiesToRemove) {
    const dice = this.world.getComponent(entity, DiceEntity);
    if (dice) {
      this.physicsWorld.removeRigidBody(dice.bodyHandle);
    }
    this.world.destroyEntity(entity);
  }

  // Clear internal tracking
  this.diceBodies = [];

  // Spawn initial dice set based on slider value
  const initialDiceCount = this.diceSets * 6;
  this.addMoreDice(initialDiceCount);
  this.respawnDice();

  // Update UI
  this.updateDiceCountDisplay();
}

// In index.ts
const resetBtn = document.getElementById('reset-btn');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    demo.resetDice();
  });
}
```

---

#### Task 10.4: Add Keyboard Shortcuts
**Files Modified:**
- `packages/renderer/src/demo.ts`
- `packages/renderer/src/index.ts`
- `packages/renderer/index.html` (add keyboard hint to UI)

**Acceptance Criteria:**
- `Space` or `Enter`: Roll dice
- `R`: Reset dice
- `1-8`: Set slider to position (1 = 1 set, 8 = 128 sets)
- `+`/`=`: Increase slider
- `-`/`_`: Decrease slider
- Keyboard shortcuts displayed in UI
- Shortcuts work when canvas has focus

**HTML Addition:**
```html
<div id="info">
  Miskatonic Engine - 3D Demo<br>
  Mouse: Drag to rotate camera<br>
  <br>
  <strong>Keyboard Shortcuts:</strong><br>
  <div style="color: #888; font-size: 11px;">
    Space/Enter: Roll dice<br>
    R: Reset<br>
    1-8: Set dice count (exponential)<br>
    +/-: Adjust dice count<br>
  </div>
  <br>
  <a href="/joints.html" class="nav-link">View Joint Constraints Demo →</a>
</div>
```

**TypeScript Implementation:**
```typescript
// In index.ts
private setupKeyboardShortcuts(demo: Demo): void {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    // Ignore if typing in input field
    if (e.target instanceof HTMLInputElement) return;

    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault();
        demo.manualRoll();
        break;

      case 'r':
      case 'R':
        e.preventDefault();
        demo.resetDice();
        break;

      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
        e.preventDefault();
        const sliderPosition = parseInt(e.key, 10) - 1; // 0-7
        const diceSets = Math.pow(2, sliderPosition);
        demo.setDiceSets(diceSets);
        this.updateSliderUI(sliderPosition);
        break;

      case '+':
      case '=':
        e.preventDefault();
        this.incrementSlider();
        break;

      case '-':
      case '_':
        e.preventDefault();
        this.decrementSlider();
        break;
    }
  });
}
```

---

#### Task 10.5: Add Visual Feedback and Polish
**Files Modified:**
- `packages/renderer/index.html`
- `packages/renderer/src/demo.ts`

**Acceptance Criteria:**
- Button press animations (scale down on click)
- Dice spawn particle effect (optional)
- Flash effect when dice count changes
- Smooth transitions on UI updates
- Loading indicator during initialization
- Error messages for performance warnings

**CSS Additions:**
```css
/* Button press animation */
button:active {
  transform: scale(0.95);
  transition: transform 0.1s;
}

/* Dice count flash animation */
@keyframes flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; color: #0f0; }
}

.flash {
  animation: flash 0.3s ease-in-out;
}

/* Performance warning */
.warning {
  color: #f80;
  font-weight: bold;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* Loading indicator */
#loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.9);
  padding: 20px 40px;
  border-radius: 8px;
  font-size: 18px;
  color: #0f0;
}
```

---

### Phase 11: Joints Demo Granular Controls

#### Task 11.1: Replace Motor Speed Slider with Granular Controls
**Files Modified:**
- `packages/renderer/joints.html`
- `packages/renderer/src/joints.ts`

**Acceptance Criteria:**
- Remove single motor speed slider
- Add individual controls for each joint constraint
- Controls organized by joint type
- Live parameter updates
- No physics recreation needed

**Current State:**
```html
<!-- Old: Single motor control -->
<div class="control-group">
  <div class="control-label">Motor Control</div>
  <div class="control-row">
    <input type="range" id="motor-speed" min="-5" max="5" step="0.5" value="2" />
    <span id="motor-speed-value">2.0</span>
  </div>
</div>
```

**New Design:**
```html
<!-- New: Granular controls for all joints -->
<div id="controls">
  <!-- Chain (Fixed Joints) -->
  <div class="control-section">
    <div class="section-title">Chain (Fixed)</div>
    <button id="chain-break">Break Link</button>
    <button id="chain-restore">Restore</button>
  </div>

  <!-- Door (Revolute with Limits) -->
  <div class="control-section">
    <div class="section-title">Door (Revolute)</div>
    <div class="control-row">
      <label>Min Angle:</label>
      <input type="range" id="door-min-angle" min="-180" max="0" value="-90" step="5">
      <span id="door-min-value">-90°</span>
    </div>
    <div class="control-row">
      <label>Max Angle:</label>
      <input type="range" id="door-max-angle" min="0" max="180" value="90" step="5">
      <span id="door-max-value">90°</span>
    </div>
    <button id="door-slam">Slam Shut</button>
  </div>

  <!-- Pendulum (Free Revolute) -->
  <div class="control-section">
    <div class="section-title">Pendulum (Revolute)</div>
    <div class="control-row">
      <label>Damping:</label>
      <input type="range" id="pendulum-damping" min="0" max="1" value="0.1" step="0.05">
      <span id="pendulum-damping-value">0.10</span>
    </div>
    <button id="pendulum-push">Push</button>
    <button id="pendulum-stop">Stop</button>
  </div>

  <!-- Elevator (Prismatic) -->
  <div class="control-section">
    <div class="section-title">Elevator (Prismatic)</div>
    <div class="control-row">
      <label>Target Height:</label>
      <input type="range" id="elevator-target" min="0" max="10" value="5" step="0.5">
      <span id="elevator-target-value">5.0m</span>
    </div>
    <div class="control-row">
      <label>Speed:</label>
      <input type="range" id="elevator-speed" min="0.5" max="5" value="2" step="0.5">
      <span id="elevator-speed-value">2.0</span>
    </div>
    <button id="elevator-up">Go Up</button>
    <button id="elevator-down">Go Down</button>
  </div>

  <!-- Ragdoll Arm (Spherical + Revolute) -->
  <div class="control-section">
    <div class="section-title">Ragdoll Arm</div>
    <div class="control-row">
      <label>Shoulder Stiffness:</label>
      <input type="range" id="shoulder-stiffness" min="0" max="100" value="50" step="10">
      <span id="shoulder-stiffness-value">50</span>
    </div>
    <div class="control-row">
      <label>Elbow Angle:</label>
      <input type="range" id="elbow-angle" min="0" max="180" value="90" step="10">
      <span id="elbow-angle-value">90°</span>
    </div>
    <button id="arm-wave">Wave</button>
    <button id="arm-ragdoll">Go Limp</button>
  </div>

  <!-- Motor (Powered Revolute) -->
  <div class="control-section">
    <div class="section-title">Motor (Powered)</div>
    <div class="control-row">
      <label>Speed:</label>
      <input type="range" id="motor-speed" min="-10" max="10" value="2" step="0.5">
      <span id="motor-speed-value">2.0</span>
    </div>
    <div class="control-row">
      <label>Torque:</label>
      <input type="range" id="motor-torque" min="0" max="100" value="50" step="5">
      <span id="motor-torque-value">50</span>
    </div>
    <button id="motor-reverse">Reverse</button>
    <button id="motor-stop">Stop</button>
  </div>

  <!-- Global Controls -->
  <div class="control-section">
    <div class="section-title">Global</div>
    <button id="reset-all">Reset All</button>
    <button id="chaos-mode">Chaos Mode</button>
  </div>
</div>
```

**CSS Additions:**
```css
.control-section {
  margin-bottom: 20px;
  padding: 10px;
  border: 1px solid #333;
  border-radius: 4px;
}

.section-title {
  color: #0f0;
  font-weight: bold;
  margin-bottom: 10px;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.control-row label {
  color: #888;
  font-size: 11px;
  min-width: 80px;
}

.control-row input[type="range"] {
  flex: 1;
  min-width: 100px;
}

.control-row span {
  color: #0f0;
  font-size: 11px;
  min-width: 50px;
  text-align: right;
}

.control-section button {
  width: 100%;
  margin-top: 5px;
  padding: 6px 12px;
  font-size: 12px;
}
```

---

#### Task 11.2: Implement Joint Parameter Live Updates
**Files Modified:**
- `packages/renderer/src/joints.ts`

**Acceptance Criteria:**
- All sliders update joint parameters in real-time
- No physics recreation needed
- Smooth transitions
- Value displays update live
- Physics constraints update correctly

**Implementation:**
```typescript
// Joint handle tracking
private jointHandles = {
  door: null as JointHandle | null,
  pendulum: null as JointHandle | null,
  elevator: null as JointHandle | null,
  shoulder: null as JointHandle | null,
  elbow: null as JointHandle | null,
  motor: null as JointHandle | null,
};

// Wire up door angle limits
const doorMinAngle = document.getElementById('door-min-angle') as HTMLInputElement;
const doorMaxAngle = document.getElementById('door-max-angle') as HTMLInputElement;

doorMinAngle?.addEventListener('input', () => {
  const minDeg = parseFloat(doorMinAngle.value);
  const minRad = (minDeg * Math.PI) / 180;

  if (this.jointHandles.door) {
    this.physicsWorld.setRevoluteJointLimits(this.jointHandles.door, minRad,
      parseFloat(doorMaxAngle.value) * Math.PI / 180);
  }

  document.getElementById('door-min-value')!.textContent = `${minDeg}°`;
});

// Wire up elevator controls
const elevatorTarget = document.getElementById('elevator-target') as HTMLInputElement;
const elevatorSpeed = document.getElementById('elevator-speed') as HTMLInputElement;

elevatorTarget?.addEventListener('input', () => {
  const targetHeight = parseFloat(elevatorTarget.value);

  if (this.jointHandles.elevator) {
    this.physicsWorld.setPrismaticJointTarget(
      this.jointHandles.elevator,
      targetHeight
    );
  }

  document.getElementById('elevator-target-value')!.textContent = `${targetHeight.toFixed(1)}m`;
});

elevatorSpeed?.addEventListener('input', () => {
  const speed = parseFloat(elevatorSpeed.value);

  if (this.jointHandles.elevator) {
    this.physicsWorld.setPrismaticJointMotorSpeed(
      this.jointHandles.elevator,
      speed
    );
  }

  document.getElementById('elevator-speed-value')!.textContent = speed.toFixed(1);
});

// Wire up motor controls
const motorSpeed = document.getElementById('motor-speed') as HTMLInputElement;
const motorTorque = document.getElementById('motor-torque') as HTMLInputElement;

motorSpeed?.addEventListener('input', () => {
  const speed = parseFloat(motorSpeed.value);

  if (this.jointHandles.motor) {
    this.physicsWorld.setRevoluteJointMotorSpeed(
      this.jointHandles.motor,
      speed
    );
  }

  document.getElementById('motor-speed-value')!.textContent = speed.toFixed(1);
});

motorTorque?.addEventListener('input', () => {
  const torque = parseFloat(motorTorque.value);

  if (this.jointHandles.motor) {
    this.physicsWorld.setRevoluteJointMotorTorque(
      this.jointHandles.motor,
      torque
    );
  }

  document.getElementById('motor-torque-value')!.textContent = torque.toString();
});
```

---

#### Task 11.3: Implement Action Buttons
**Files Modified:**
- `packages/renderer/src/joints.ts`

**Acceptance Criteria:**
- All action buttons trigger appropriate behaviors
- Physics state updates correctly
- Visual feedback on button press
- No crashes or errors

**Implementation:**
```typescript
// Door: Slam Shut
document.getElementById('door-slam')?.addEventListener('click', () => {
  if (this.doorBodyHandle) {
    this.physicsWorld.setRigidBodyAngularVelocity(this.doorBodyHandle, {
      x: 0, y: -5, z: 0  // Fast rotation to close
    });
  }
});

// Pendulum: Push
document.getElementById('pendulum-push')?.addEventListener('click', () => {
  if (this.pendulumBodyHandle) {
    this.physicsWorld.applyImpulse(this.pendulumBodyHandle, {
      x: 2, y: 0, z: 0
    });
  }
});

// Pendulum: Stop
document.getElementById('pendulum-stop')?.addEventListener('click', () => {
  if (this.pendulumBodyHandle) {
    this.physicsWorld.setRigidBodyAngularVelocity(this.pendulumBodyHandle, {
      x: 0, y: 0, z: 0
    });
    this.physicsWorld.setRigidBodyLinearVelocity(this.pendulumBodyHandle, {
      x: 0, y: 0, z: 0
    });
  }
});

// Elevator: Go Up
document.getElementById('elevator-up')?.addEventListener('click', () => {
  const elevatorTarget = document.getElementById('elevator-target') as HTMLInputElement;
  elevatorTarget.value = '10';
  elevatorTarget.dispatchEvent(new Event('input'));
});

// Elevator: Go Down
document.getElementById('elevator-down')?.addEventListener('click', () => {
  const elevatorTarget = document.getElementById('elevator-target') as HTMLInputElement;
  elevatorTarget.value = '0';
  elevatorTarget.dispatchEvent(new Event('input'));
});

// Arm: Wave
document.getElementById('arm-wave')?.addEventListener('click', () => {
  // Animate shoulder rotation in a wave pattern
  let angle = 0;
  const waveInterval = setInterval(() => {
    if (this.shoulderBodyHandle) {
      const rotY = Math.sin(angle) * 0.5;
      this.physicsWorld.setRigidBodyRotation(this.shoulderBodyHandle, {
        x: 0, y: rotY, z: 0, w: Math.cos(rotY / 2)
      });
    }
    angle += 0.1;
    if (angle > Math.PI * 2) clearInterval(waveInterval);
  }, 16);
});

// Arm: Go Limp
document.getElementById('arm-ragdoll')?.addEventListener('click', () => {
  if (this.jointHandles.shoulder) {
    this.physicsWorld.setSphericalJointStiffness(this.jointHandles.shoulder, 0);
  }
  if (this.jointHandles.elbow) {
    this.physicsWorld.setRevoluteJointStiffness(this.jointHandles.elbow, 0);
  }
});

// Motor: Reverse
document.getElementById('motor-reverse')?.addEventListener('click', () => {
  const motorSpeed = document.getElementById('motor-speed') as HTMLInputElement;
  motorSpeed.value = (-parseFloat(motorSpeed.value)).toString();
  motorSpeed.dispatchEvent(new Event('input'));
});

// Motor: Stop
document.getElementById('motor-stop')?.addEventListener('click', () => {
  const motorSpeed = document.getElementById('motor-speed') as HTMLInputElement;
  motorSpeed.value = '0';
  motorSpeed.dispatchEvent(new Event('input'));
});

// Reset All
document.getElementById('reset-all')?.addEventListener('click', () => {
  this.resetAllJoints();
});

// Chaos Mode
document.getElementById('chaos-mode')?.addEventListener('click', () => {
  this.enableChaosMode();
});
```

---

#### Task 11.4: Add Constraint Visualization
**Files Modified:**
- `packages/renderer/src/joints.ts`
- `packages/renderer/joints.html`

**Acceptance Criteria:**
- Toggle to show/hide joint constraint visualizations
- Draw lines/axes for joint positions
- Show limits and ranges visually
- Color-coded by constraint type
- No performance impact when disabled

**HTML Addition:**
```html
<div class="control-section">
  <div class="section-title">Visualization</div>
  <label>
    <input type="checkbox" id="show-joints" checked>
    Show Joint Axes
  </label>
  <label>
    <input type="checkbox" id="show-limits" checked>
    Show Limits
  </label>
  <label>
    <input type="checkbox" id="show-forces">
    Show Forces
  </label>
</div>
```

**Implementation:**
```typescript
private visualizationEnabled = {
  joints: true,
  limits: true,
  forces: false,
};

// Wire up toggles
document.getElementById('show-joints')?.addEventListener('change', (e) => {
  this.visualizationEnabled.joints = (e.target as HTMLInputElement).checked;
});

document.getElementById('show-limits')?.addEventListener('change', (e) => {
  this.visualizationEnabled.limits = (e.target as HTMLInputElement).checked;
});

document.getElementById('show-forces')?.addEventListener('change', (e) => {
  this.visualizationEnabled.forces = (e.target as HTMLInputElement).checked;
});

// Render joint visualizations
private renderJointVisualizations(): void {
  if (!this.visualizationEnabled.joints) return;

  // Draw joint axes
  for (const [name, handle] of Object.entries(this.jointHandles)) {
    if (!handle) continue;

    const jointPos = this.physicsWorld.getJointPosition(handle);
    const jointAxis = this.physicsWorld.getJointAxis(handle);

    // Draw axis line
    this.debugRenderer.drawLine(
      jointPos,
      { x: jointPos.x + jointAxis.x, y: jointPos.y + jointAxis.y, z: jointPos.z + jointAxis.z },
      { r: 1, g: 0, b: 0 }
    );

    // Draw position marker
    this.debugRenderer.drawSphere(jointPos, 0.1, { r: 0, g: 1, b: 0 });
  }

  // Draw limits if enabled
  if (this.visualizationEnabled.limits) {
    this.renderJointLimits();
  }

  // Draw forces if enabled
  if (this.visualizationEnabled.forces) {
    this.renderJointForces();
  }
}
```

---

#### Task 11.5: Add Keyboard Shortcuts for Joints Demo
**Files Modified:**
- `packages/renderer/src/joints.ts`
- `packages/renderer/joints.html`

**Acceptance Criteria:**
- `1-6`: Focus on specific joint (chain, door, pendulum, elevator, arm, motor)
- `Space`: Trigger primary action for focused joint
- `R`: Reset all joints
- `V`: Toggle visualization
- Keyboard shortcuts displayed in UI

**HTML Addition:**
```html
<div style="color: #888; font-size: 11px;">
  <strong>Keyboard Shortcuts:</strong><br>
  1-6: Select joint<br>
  Space: Trigger action<br>
  R: Reset all<br>
  V: Toggle visualization<br>
</div>
```

---

## Success Metrics

### Performance Targets
- ✅ FPS: Maintain 60 FPS with 192 dice (32 sets)
- ✅ FPS: Maintain 30 FPS with 384 dice (64 sets)
- ✅ Stress Test: Handle up to 768 dice (128 sets) with graceful degradation
- ✅ Draw Calls: Reduce by 50%+ through batching
- ✅ Memory: Reduce by 30%+ through SoA storage
- ✅ Load Time: Under 2 seconds to first render
- ✅ Additive Rolling: Support multiple rolls without performance cliff

### Code Quality Targets
- ✅ No manual matrix math (use TransformSystem)
- ✅ No inline shaders (use ShaderManager)
- ✅ No direct draw calls (use RenderQueue)
- ✅ All entities managed by ECS
- ✅ Comprehensive JSDoc coverage

### Feature Completeness
- ✅ Both demos fully migrated to ECS
- ✅ WebGPU support with WebGL2 fallback
- ✅ External shaders with hot-reload
- ✅ Camera system with orbit controls
- ✅ Transform system with hierarchical transforms
- ✅ Render queue with automatic batching
- ✅ Performance metrics displayed
- ✅ All existing functionality preserved
- ✅ Dice demo: Exponential slider, additive rolls, reset, keyboard shortcuts
- ✅ Joints demo: Granular controls for all 6 joint types, visualization toggles

---

## Implementation Notes

### Migration Strategy
1. **Incremental**: Migrate one system at a time
2. **Test Early**: Verify visuals after each phase
3. **Keep Physics Separate**: Physics runs alongside ECS (syncs to Transform)
4. **Preserve Behavior**: Users shouldn't notice functional changes

### Physics Integration Pattern
```typescript
// Physics bodies are NOT ECS entities themselves
// Instead: ECS entities have Transform components that sync FROM physics

update(deltaTime: number): void {
  // 1. Step physics simulation
  this.physicsWorld.step(deltaTime);

  // 2. Sync physics transforms to ECS Transform components
  const query = this.world.query()
    .with(Transform)
    .with(PhysicsBody)
    .build();

  for (const { components } of this.world.executeQuery(query)) {
    const transform = components.get(Transform);
    const body = components.get(PhysicsBody);
    const physicsTransform = this.physicsWorld.getTransform(body.handle);

    // Copy physics state to ECS transform
    transform.x = physicsTransform.translation.x;
    transform.y = physicsTransform.translation.y;
    transform.z = physicsTransform.translation.z;
    transform.qx = physicsTransform.rotation.x;
    transform.qy = physicsTransform.rotation.y;
    transform.qz = physicsTransform.rotation.z;
    transform.qw = physicsTransform.rotation.w;
  }

  // 3. Update ECS systems (TransformSystem computes matrices)
  this.world.update(deltaTime);

  // 4. Render using ECS entity transforms
  this.render();
}
```

### Common Pitfalls to Avoid
1. **Don't duplicate state**: Physics is source of truth for position/rotation
2. **Don't sync TO physics**: Only sync FROM physics to Transform
3. **Don't create entities in render loop**: Create during initialization
4. **Don't skip dirty flagging**: Let TransformSystem optimize matrix updates
5. **Don't inline shaders**: Use external files for maintainability

---

## Dependencies

### Required Epics (Must be Complete)
- ✅ Epic 2.1: ECS Core
- ✅ Epic 2.10-2.11: Cache-Efficient SoA Storage
- ✅ Epic 3.2: WebGL2/WebGPU Backend Abstraction
- ✅ Epic 3.9: Shader Management System
- ✅ Epic 3.10: Camera System
- ✅ Epic 3.11: Transform System
- ✅ Epic 3.12: Render Queue

### Package Dependencies
```json
{
  "@miskatonic/ecs": "^0.1.0",
  "@miskatonic/rendering": "^0.1.0",
  "@miskatonic/physics": "^0.1.0"
}
```

---

## Risks and Mitigations

### Risk: Breaking Existing Functionality
**Mitigation:**
- Test after each phase
- Keep screenshots of original for comparison
- Implement feature flags to toggle old/new code

### Risk: Performance Regression
**Mitigation:**
- Benchmark before and after each phase
- Profile with browser DevTools
- Use ECS stats to verify memory improvements

### Risk: Complexity Increase
**Mitigation:**
- Add comprehensive documentation
- Create architecture diagrams
- Provide code examples

---

## Task Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1: Infrastructure | 1.1-1.3 | External shaders, ECS foundation |
| Phase 2: Camera System | 2.1-2.2 | ECS-based camera migration |
| Phase 3: Entity Migration | 3.1-3.2 | Convert objects to entities |
| Phase 4: Shader System | 4.1-4.2 | ShaderManager integration |
| Phase 5: Render Queue | 5.1-5.2 | Automatic batching |
| Phase 6: Transform System | 6.1-6.2 | Matrix management |
| Phase 7: Backend | 7.1-7.2 | WebGPU support |
| Phase 8: Polish | 8.1-8.3 | Metrics, docs, cleanup |
| Phase 9: Testing | 9.1-9.3 | Regression, performance, cross-browser |
| Phase 10: Dice UX | 10.1-10.5 | Exponential slider, additive rolls, reset, shortcuts, polish |
| Phase 11: Joints UX | 11.1-11.5 | Granular controls, live updates, actions, visualization, shortcuts |
| **TOTAL** | **35 tasks** | **Full modernization** |

---

## Definition of Done

- [ ] All 35 tasks completed
- [ ] Both demos fully migrated to ECS architecture
- [ ] All tests passing (TypeScript compilation, visual regression)
- [ ] Performance metrics meet or exceed targets
- [ ] Documentation complete (code comments + DEMOS.md)
- [ ] Cross-browser testing passed
- [ ] WebGPU + WebGL2 backends both functional
- [ ] No functional regressions
- [ ] Code review approved
- [ ] User testing confirms controls feel identical

### Dice Demo Specific
- [ ] Exponential dice slider (1-128 sets)
- [ ] Additive roll dice behavior
- [ ] Reset button functional
- [ ] Keyboard shortcuts working
- [ ] Visual feedback and animations

### Joints Demo Specific
- [ ] Granular controls for all 6 joint types
- [ ] Live parameter updates
- [ ] Action buttons functional
- [ ] Constraint visualization toggles
- [ ] Keyboard shortcuts working

---

## Future Enhancements (Post-Epic)

These are not in scope for this epic but could be added later:

1. **Advanced Camera Controls**
   - FirstPersonCameraController for FPS-style camera
   - Smooth camera transitions
   - Camera shake effects

2. **Material System**
   - PBR materials for realistic lighting
   - Material variations for different dice
   - Normal mapping for detail

3. **Post-Processing Effects**
   - Bloom for glowing dice
   - Motion blur for fast-moving objects
   - SSAO for ambient occlusion

4. **Audio Integration**
   - Dice collision sounds
   - Rolling sound effects
   - UI feedback sounds

5. **Particle Systems**
   - Dust particles when dice land
   - Trail effects for fast dice
   - Impact particles

6. **Advanced Joint Features**
   - Joint stress visualization
   - Breaking force limits
   - Dynamic joint creation/removal

---

## References

- Epic 2.1: ECS Core Implementation
- Epic 2.10-2.11: Cache-Efficient SoA Storage
- Epic 3.2: Backend Abstraction Layer
- Epic 3.9: Shader Management System
- Epic 3.10: Camera System
- Epic 3.11: Transform System
- Epic 3.12: Render Queue Organization
- ARCHITECTURE.md: System Architecture Overview
- ENGINE_DESIGN.md: Design Principles

---

**Epic Created:** 2025-11-08
**Epic Owner:** Development Team
**Status:** Ready for Implementation
