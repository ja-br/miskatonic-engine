# Miskatonic Engine: Engine Design Principles

This document outlines the core design principles for **building the Miskatonic Engine itself**. These guide the engine developers, not the game developers who will use the engine.

---

## Core Philosophical Principles

### 1. Batteries Included, Swappable Preferred
**Principle**: Ship with sensible defaults and complete implementations, but allow developers to swap any major system.

**Rationale**: Game developers want to start quickly but need flexibility as projects mature. Provide the full stack out of the box, but don't lock them in.

**Implementation Guidelines**:
- Include default physics engine (Rapier)
- Include default renderer (WebGPU with WebGL2 fallback), but expose low-level rendering API
- Include default networking (Socket.io), but support custom transports
- Abstract major systems behind interfaces
- Document how to implement custom backends

**Engine Architecture**:
```typescript
// Engine provides default implementations
const engine = new MiskatonicEngine({
  physics: new RapierPhysics(),      // default
  renderer: new WebGPURenderer(),    // default
  network: new SocketIOTransport()   // default
});


---

### 2. Electron-Native, Best of Both Worlds
**Principle**: Leverage both native desktop capabilities and modern web technologies.

**Rationale**: Electron provides native OS integration while maintaining web technology benefits. Miskatonic should exploit both worlds fully.

**Implementation Guidelines**:
- Native file system access for asset management and user content
- OS-level integration (menus, tray, notifications, keyboard shortcuts)
- Auto-update system for seamless engine and game updates
- Native module support for performance-critical operations
- Chromium DevTools integration for debugging
- IPC (Inter-Process Communication) between main and renderer
- Hardware access beyond browser sandbox (GPU control, gamepads, etc.)
- Use native Node.js modules where beneficial

**Electron-Native Features**:
- Direct filesystem access (no CORS, no sandbox limits)
- Native menus and dialogs
- System tray integration
- Global keyboard shortcuts
- Auto-updater (Squirrel/AppImage)
- Multi-window support
- Screen capture and recording
- Deep OS integration (Windows registry, macOS keychain, etc.)

---

### 3. API Ergonomics Over Internal Elegance
**Principle**: Optimize the developer-facing API for clarity and ease of use, even if internal implementation is more complex.

**Rationale**: Engine internals can be refactored, but API changes break user code. The API is the product.

**Implementation Guidelines**:
- Simple APIs for common cases (zero config for basic setup)
- Advanced APIs for power users (full control when needed)
- Consistent naming conventions across all APIs
- TypeScript-first design with excellent IntelliSense
- Method chaining where it improves readability
- Comprehensive JSDoc comments on all public APIs

**API Design Example**:
```typescript
// ❌ Exposing internal complexity
engine.getSystemManager().getSystem('PhysicsSystem').getWorld().createBody({...});

// ✅ Simple, ergonomic API
engine.physics.createBody({...});

// ✅ But still expose advanced control
engine.systems.get(PhysicsSystem).world.setGravity(0, -9.81, 0);
```

---

### 4. Performance Budget Enforcement
**Principle**: Define and enforce performance budgets for every engine system.

**Rationale**: Engine performance directly impacts every game built with it. Performance regressions in the engine affect all users.

**Implementation Guidelines**:
- Establish performance budgets per system (CPU time, memory, allocations)
- Automated performance tests in CI/CD
- Benchmark suite comparing against previous versions
- Performance regression detection blocks merges
- Public performance dashboard for transparency

**Performance Budgets (per frame at 60 FPS)**:
| System | CPU Budget | Memory Budget | Notes |
|--------|-----------|---------------|-------|
| ECS Core | 1ms | 50MB | Entity iteration, queries |
| Rendering | 5ms | 200MB | Draw calls, state changes |
| Physics | 2ms | 100MB | Simulation step |
| Networking | 1ms | 50MB | Serialization, sync |
| Audio | 0.5ms | 50MB | Mixing, effects |
| Scripting | 3ms | 100MB | Game logic execution |
| Overhead | 1ms | 50MB | Engine bookkeeping |
| **Total** | **13.5ms** | **600MB** | 2.5ms buffer for games |

---

### 5. ECS as Foundation, Not Afterthought
**Principle**: Entity Component System is the core architectural pattern, not a feature layer.

**Rationale**: ECS provides performance, flexibility, and composability. Half-hearted ECS implementations lose all benefits.

**Implementation Guidelines**:
- Entities are opaque IDs (just integers)
- Components are pure data (POD types, no methods)
- Systems operate on component queries (behavior separated from data)
- Archetypes for cache-efficient iteration
- Query caching and automatic invalidation
- No component inheritance (composition only)

**ECS Architecture**:
```typescript
// Entity: just an ID
type Entity = number;

// Component: pure data
interface Transform {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
}

// System: behavior operating on components
class PhysicsSystem extends System {
  query = Query.all(Transform, RigidBody);

  update(deltaTime: number) {
    for (const [entity, transform, body] of this.query) {
      // Update transform based on physics
    }
  }
}
```

---

### 6. TypeScript-First with Runtime Safety
**Principle**: Provide excellent TypeScript types, but validate at runtime boundaries.

**Rationale**: Game developers make mistakes. Catch errors early with types, catch runtime issues gracefully.

**Implementation Guidelines**:
- Full type coverage with `strict: true`
- Branded types for IDs (prevent mixing entity types)
- Discriminated unions for state machines
- Runtime validation at API boundaries (Zod/io-ts)
- Helpful error messages with suggestions
- Debug mode with extra validation (stripped in production)

**Type Safety Example**:
```typescript
// Branded types prevent confusion
type EntityId = number & { __brand: 'Entity' };
type ComponentId = number & { __brand: 'Component' };

// Can't accidentally mix them
function getEntity(id: EntityId): Entity;
function getComponent(id: ComponentId): Component;

getEntity(componentId); // TypeScript error!

// Runtime validation at boundaries
function loadScene(data: unknown): Scene {
  const validated = SceneSchema.parse(data); // throws if invalid
  return createScene(validated);
}
```

---

### 7. Zero-Cost Abstractions Where Possible
**Principle**: Abstractions should compile away or have negligible runtime cost.

**Rationale**: Engine code runs constantly. Every abstraction penalty multiplies across all games.

**Implementation Guidelines**:
- Use TypeScript enums that compile to numbers
- Inline small functions (trust the JIT)
- Avoid virtual calls in hot paths
- Use typed arrays for numeric data
- Minimize object allocations in game loop
- Pool and reuse objects where beneficial

**Performance Example**:
```typescript
// ❌ Allocates objects every frame
function getEntitiesWithComponent(component: string): Entity[] {
  return entities.filter(e => e.hasComponent(component));
}

// ✅ Zero-allocation iteration
function* queryEntitiesWithComponent(component: ComponentType): Generator<Entity> {
  for (const entity of entities) {
    if (entity.has(component)) yield entity;
  }
}

// ✅ Or reuse array buffer
function queryEntitiesWithComponent(component: ComponentType, outArray: Entity[]): number {
  let count = 0;
  for (const entity of entities) {
    if (entity.has(component)) outArray[count++] = entity;
  }
  return count;
}
```

---

### 8. Observable and Debuggable by Design
**Principle**: Build debugging, profiling, and introspection into the engine from day one.

**Rationale**: Game developers will need to debug their games. The engine must be transparent and observable.

**Implementation Guidelines**:
- Built-in performance profiler with flamegraphs
- Entity inspector showing all components
- System execution order visualization
- Network traffic analyzer
- Memory allocation tracker
- Frame time breakdown visualization
- Debug visualization modes (physics shapes, navmesh, etc.)
- Integration with Chromium DevTools
- Separate debug window (Electron multi-window)

**Debug Features**:
```typescript
// Developer console integration
window.__MISKATONIC__ = {
  engine: engineInstance,
  stats: performanceStats,
  inspector: entityInspector,
  profiler: systemProfiler
};

// Debug rendering overlay
engine.debug.showPhysicsShapes = true;
engine.debug.showBoundingBoxes = true;
engine.debug.showNetworkSync = true;

// Performance markers for Chromium profiler
performance.mark('physics-start');
physicsSystem.update(deltaTime);
performance.measure('physics', 'physics-start');

// Electron-specific: Open separate debug window
ipcRenderer.invoke('open-debug-window', { entityId: 123 });
```

---

### 9. Extensibility Through Composition
**Principle**: Allow developers to extend the engine without forking or modifying engine code.

**Rationale**: Games have unique needs. The engine can't anticipate everything. Make extension easy and safe.

**Implementation Guidelines**:
- Plugin architecture for new systems
- Event hooks at critical engine points
- Custom component registration
- Shader injection points
- Middleware pattern for networking
- Asset loader plugins
- Custom editor tools integration

**Extension Points**:
```typescript
// Plugin system
engine.plugins.register({
  name: 'MyPlugin',
  onInit(engine) { /* setup */ },
  onUpdate(deltaTime) { /* per-frame */ },
  onShutdown() { /* cleanup */ }
});

// Event hooks
engine.events.on('entity:created', (entity) => {
  // Custom logic when entities spawn
});

// Custom components
@Component('CustomBehavior')
class CustomBehavior {
  data: any;
}

// Asset loader extension
engine.assets.registerLoader('custom-format', CustomAssetLoader);
```

---

### 10. Fail-Fast in Development, Fail-Safe in Production
**Principle**: Strict validation and assertions during development, graceful degradation in production.

**Rationale**: Catch developer errors early and loudly, but don't crash player games in production.

**Implementation Guidelines**:
- Debug build with extensive validation and assertions
- Production build strips debug code (via dead code elimination)
- Graceful fallbacks for missing assets (checkerboard texture)
- Error boundaries that prevent engine crash
- Telemetry for production errors (with user consent)
- Clear error messages in development with stack traces

**Environment-Specific Behavior**:
```typescript
// Development: fail loudly
if (DEBUG) {
  assert(entity.isValid(), `Invalid entity ${entity}`);
  if (!component) {
    throw new Error(`Component ${name} not found on entity ${entity}`);
  }
}

// Production: fail safely
if (!entity.isValid()) {
  console.warn(`Invalid entity ${entity}, skipping`);
  return null;
}
if (!component) {
  console.warn(`Component ${name} not found, using default`);
  return DEFAULT_COMPONENT;
}
```

---

### 11. Network-Agnostic Core with Network-Aware Features
**Principle**: Core engine works offline, but networked features are first-class, not bolted on.

**Rationale**: Not all games are multiplayer, but multiplayer games need deep integration.

**Implementation Guidelines**:
- Engine core has no network dependencies
- Networking is an optional system
- State synchronization is a separate concern
- Components can opt-in to network sync
- Deterministic systems for prediction/rollback
- Network transport is swappable (WebSocket, WebRTC, custom)

**Network Architecture**:
```typescript
// Core engine works offline
const engine = new MiskatonicEngine();

// Networking is optional
engine.addSystem(new NetworkSystem({
  transport: new SocketIOTransport(),
  authority: 'server'
}));

// Components opt into sync
@Component('Transform')
@Networked({ syncRate: 20 }) // replicate at 20hz
class Transform {
  @Sync() position: Vec3;
  @Sync() rotation: Quat;
  @NoSync() cachedMatrix: Mat4; // not replicated
}
```

---

### 12. Clean IPC Boundaries
**Principle**: Design clear, type-safe communication between Electron main and renderer processes.

**Rationale**: Electron's multi-process architecture requires careful IPC design. Poor IPC leads to bugs and performance issues.

**Implementation Guidelines**:
- Define typed IPC channels with TypeScript
- Use `contextBridge` for secure renderer-to-main communication
- Never pass complex objects through IPC (serialize to plain objects)
- Batch IPC calls to reduce overhead
- Use streaming for large data transfers
- Main process owns native resources (files, windows)
- Renderer process handles game logic and rendering

**IPC Architecture**:
```typescript
// Preload script (runs in isolated context)
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  writeFile: (path: string, data: string) => ipcRenderer.invoke('file:write', path, data),

  // Window management
  openDevTools: () => ipcRenderer.send('window:open-devtools'),

  // Events from main to renderer
  onGameUpdate: (callback: (data: GameUpdate) => void) => {
    ipcRenderer.on('game:update', (_event, data) => callback(data));
  }
});

// Renderer process (game code)
const data = await window.electronAPI.readFile('save/player.json');

// Main process (handles native operations)
ipcMain.handle('file:read', async (_event, path: string) => {
  const fullPath = path.join(app.getPath('userData'), path);
  return await fs.promises.readFile(fullPath, 'utf-8');
});
```

**IPC Best Practices**:
- Keep IPC calls to minimum in hot paths
- Cache frequently accessed data in renderer
- Use SharedArrayBuffer for high-frequency data sharing
- Stream large assets via custom protocols (`miskatonic://assets/...`)

---

### 13. Documentation as First-Class Deliverable
**Principle**: Documentation is not optional. Undocumented features don't exist.

**Rationale**: The best engine is useless if developers can't learn it. Documentation is part of the product.

**Implementation Guidelines**:
- JSDoc comments on every public API
- API reference auto-generated from code
- Conceptual guides for major systems
- Step-by-step tutorials with live examples
- Architecture decision records (ADRs) for major choices
- Migration guides between versions
- Searchable, versioned documentation site

**Documentation Standards**:
```typescript
/**
 * Creates a rigid body component for physics simulation.
 *
 * @param entity - The entity to attach the body to
 * @param desc - Physics body configuration
 * @returns The created RigidBody component
 *
 * @example
 * ```typescript
 * const body = engine.physics.createBody(entity, {
 *   type: 'dynamic',
 *   mass: 1.0,
 *   shape: { type: 'box', size: [1, 1, 1] }
 * });
 * ```
 *
 * @see {@link RigidBodyDescriptor} for all configuration options
 * @see {@link PhysicsSystem} for physics simulation details
 */
createBody(entity: Entity, desc: RigidBodyDescriptor): RigidBody;
```

---

### 14. Semantic Versioning with Stability Guarantees
**Principle**: Follow semantic versioning strictly. Breaking changes only in major versions.

**Rationale**: Game development takes months/years. Developers need stability and predictable upgrade paths.

**Implementation Guidelines**:
- Major.Minor.Patch versioning (semver)
- Deprecation warnings one minor version before removal
- Stability tiers: experimental, preview, stable
- LTS (Long Term Support) for major versions
- Automated API compatibility checking
- Clear migration guides for breaking changes

**Versioning Policy**:
- **Patch (1.0.x)**: Bug fixes, no API changes
- **Minor (1.x.0)**: New features, backward compatible, deprecations
- **Major (x.0.0)**: Breaking changes, removals, architecture changes
- **Experimental**: `@miskatonic/experimental` - no guarantees
- **Preview**: `@miskatonic/preview` - API may change
- **Stable**: `@miskatonic/engine` - semantic versioning guaranteed

---

### 15. Asset Pipeline as Core Concern
**Principle**: Asset processing is part of the engine, not an afterthought.

**Rationale**: Games are 90% assets, 10% code. Asset workflow affects developer productivity massively.

**Implementation Guidelines**:
- Built-in asset processor (textures, models, audio)
- Watch mode for automatic reprocessing via native file watchers
- Asset optimization (compression, format conversion)
- Sprite sheet generation
- Texture atlas packing
- Audio normalization and compression
- Fast incremental builds (only changed assets)
- Local asset caching (Electron app data folder)
- Optional CDN deployment for distributed games

**Asset Pipeline Features**:
```typescript
// Asset configuration
export default {
  input: './assets',
  output: './dist/assets',
  processors: {
    textures: {
      format: 'ktx2',           // GPU-compressed format
      quality: 'high',
      generateMipmaps: true,
      resize: { maxSize: 2048 }
    },
    models: {
      format: 'glb',
      optimize: true,           // mesh optimization
      compress: true            // geometry compression
    },
    audio: {
      format: 'opus',           // web-optimized codec
      bitrate: 128,
      normalize: true
    }
  },
  // Electron-specific: Local caching
  cache: {
    location: app.getPath('userData') + '/asset-cache',
    maxSize: '2GB'
  },
  // Optional: CDN for online games
  cdn: {
    enabled: false,
    host: 'https://cdn.example.com',
    versioning: 'hash'
  }
};
```

---

### 16. Multiplayer as Architecture, Not Feature
**Principle**: Design core systems to support multiplayer from the beginning.

**Rationale**: Adding multiplayer later requires rewriting everything. Even single-player games benefit from multiplayer-ready architecture.

**Implementation Guidelines**:
- Deterministic systems for client prediction
- Clear separation of simulation and presentation
- State serialization built into ECS
- Replay system (replayable = networkable)
- Server-authoritative validation hooks
- Client-side prediction framework
- Lag compensation utilities

**Multiplayer-Ready Architecture**:
```typescript
// Simulation separated from presentation
class GameSimulation {
  // Pure, deterministic, networkable
  update(state: GameState, inputs: PlayerInputs): GameState {
    return produce(state, draft => {
      applyInputs(draft, inputs);
      updatePhysics(draft);
      updateGameLogic(draft);
    });
  }
}

// Presentation can interpolate/extrapolate
class GamePresentation {
  render(currentState: GameState, previousState: GameState, alpha: number) {
    const interpolated = lerp(previousState, currentState, alpha);
    this.renderer.render(interpolated);
  }
}
```

---

## Principle Application Guidelines

### When Principles Conflict

**Performance vs. API Ergonomics**
- Choose ergonomics for common cases (80%)
- Provide performant low-level API for advanced users (20%)

**Flexibility vs. Simplicity**
- Simple defaults for beginners
- Advanced escape hatches for power users
- Document the performance implications of each approach

**Stability vs. Innovation**
- Stable tier: semantic versioning, no breaking changes
- Preview tier: new features, may change
- Experimental tier: cutting edge, no guarantees

### Decision-Making Framework

When making architectural decisions:
1. **Who is the user?** Game developer or engine developer?
2. **What is the cost?** Performance, bundle size, complexity?
3. **What is the benefit?** Developer productivity, flexibility, performance?
4. **Can we provide both?** Simple API + advanced API?
5. **What's the 80/20?** Optimize for the common case
6. **Is it reversible?** Easy to change later or locked in?

### Measuring Success

Engine success metrics:
- **Adoption**: Number of games built
- **Performance**: Benchmark scores vs. competitors
- **Productivity**: Time to first playable game
- **Developer satisfaction**: NPS score, GitHub stars
- **API stability**: Breaking changes per release
- **Documentation quality**: Time to find answers

---

## Anti-Patterns to Avoid

### 1. Over-Abstraction
**Problem**: Abstracting too early without real use cases.
**Solution**: Wait until you have 3 examples before abstracting.

### 2. Feature Creep
**Problem**: Adding every requested feature bloats the engine.
**Solution**: Evaluate features against core principles. Plugins over built-ins.

### 3. Performance Guessing
**Problem**: Optimizing without profiling (premature optimization).
**Solution**: Measure first, optimize second. Profile-guided optimization.

### 4. API Instability
**Problem**: Breaking changes in minor versions frustrate developers.
**Solution**: Deprecate first, remove later. Long deprecation periods.

### 5. Hidden Magic
**Problem**: Too much implicit behavior confuses developers.
**Solution**: Explicit is better than implicit. Convention with visibility.

---

## Evolution and Governance

### Updating Principles
- Review quarterly with team input
- Gather feedback from external developers
- Update based on production experience
- Remove principles that don't serve the project
- Add principles that emerge from patterns

### Principle Violations
Sometimes principles must be violated. When doing so:
- Document the violation and rationale
- Create tech debt ticket
- Set timeline for resolution
- Ensure violation is localized

### Community Input
- Public RFC process for major changes
- GitHub discussions for architecture decisions
- Developer surveys for pain points
- Office hours for feedback

---

## References and Inspiration

- **Unity Engine**: Industry-standard component model
- **Unreal Engine**: Blueprint visual scripting, robust tooling
- **Babylon.js**: Web-first 3D engine architecture
- **PlayCanvas**: Cloud-first editor and collaboration
- **Bevy Engine**: Modern ECS architecture in Rust
- **flecs**: High-performance ECS design patterns
- **Game Programming Patterns**: Design patterns for games
- **Data-Oriented Design**: Cache-friendly architectures
