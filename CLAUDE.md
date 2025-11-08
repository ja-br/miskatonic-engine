# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Breaking Changes Policy

**THIS IS ALPHA SOFTWARE (v0.x.x). BREAKING CHANGES ARE EXPECTED AND NECESSARY.**

### Alpha Development Philosophy
- Version 0.x.x (v0.0.1 through v0.999.999) means NO stability guarantees
- Break APIs freely to discover the right design
- Remove technical debt immediately, don't accumulate it
- If something doesn't break during alpha, it has no visibility and won't improve

### What This Means
- **NO backward compatibility layers or shims**
- **NO deprecated API warnings** - just remove bad APIs
- **NO hesitation to refactor** - break early and often
- **Update all call sites** when APIs change
- **Remove old code** that no longer compiles

### Code Examples

```typescript
// ❌ REJECTED IN ALPHA - backward compatibility code
class Renderer {
  render() { /* new implementation */ }

  /** @deprecated Use render() instead */
  draw() {
    console.warn('draw() is deprecated, use render()');
    return this.render();
  }
}

// ✅ CORRECT FOR ALPHA - just break it
class Renderer {
  render() { /* new implementation */ }
  // draw() deleted entirely
  // Update all call sites to use render()
}
```

### Code Review Guidelines
- Breaking changes that improve design are GOOD
- Maintaining backward compatibility in alpha is a BUG
- "This maintains backward compatibility" should trigger rejection
- Focus on getting the API right, not keeping it stable

### Enforcement
Code reviews MUST reject any PR that:
- Mentions "backward compatibility" positively
- Adds transition helpers or migration code
- Keeps old API alongside new API
- Uses `@deprecated` JSDoc tags
- Has patterns like `legacyFoo()`, `oldBar()`, `compatibilityMode`

### When We Hit v1.0
At that point (and only then), we'll adopt semantic versioning and stability guarantees. Until then, assume everything can and will change.

---

## Project Overview

Miskatonic Engine is a comprehensive game engine built on Electron, designed for creating high-quality desktop 3D games with sophisticated multiplayer capabilities, social features, and metagame systems. This is a full-stack solution that integrates client and server architecture, combining the flexibility of web technologies with the power of native desktop applications.

## Tech Stack

### Frontend (Electron Renderer)
- **Platform**: Electron (Chromium + Node.js)
- **Language**: TypeScript
- **Graphics**: WebGL2/WebGPU (with automatic fallback)
- **Build Tools**: Vite, Webpack 5
- **Target**: 60 FPS on mid-range devices with 1000+ rendered objects
- **Native Integration**: Access to filesystem, native menus, system tray, hardware APIs

### Backend (Game Server)
- **Runtime**: Node.js
- **Framework**: NestJS
- **Networking**: Socket.io (WebSocket), WebRTC for P2P
- **Target**: Support 100+ concurrent players per session, <50ms latency

### Electron Main Process
- **IPC**: Communication between renderer and main process
- **Native APIs**: File system, native dialogs, auto-updater
- **Process Management**: Window management, system integration

### Databases
- **MongoDB**: Player data, game state (100k+ QPS target)
- **Redis**: Caching, sessions, leaderboards (sub-ms latency)
- **Elasticsearch**: Analytics, search, logging
- **DynamoDB**: Alternative cloud-native option

### Infrastructure
- **Containers**: Docker, Kubernetes
- **Cloud**: AWS/GCP
- **CDN**: CloudFlare

## Core Architecture

The engine follows a layered architecture:

```
Electron Main Process (Native APIs, Window Management, IPC)
    ↓
Renderer Process (Game Client)
    ├─ Game Logic (ECS, State Management)
    ├─ Rendering (WebGL2/WebGPU)
    ├─ Physics (Rapier/Cannon-es/Box2D)
    ├─ Input (Keyboard, Mouse, Gamepad)
    └─ Audio (Web Audio API)
    ↓
Network Layer (WebSocket/WebRTC)
    ↓
Game Server (NestJS)
    ├─ Game State (Authoritative)
    ├─ Matchmaking
    ├─ Social Systems
    ├─ Economy
    └─ Analytics
    ↓
Database Layer (MongoDB, Redis, Elasticsearch)
```

### Key Architectural Patterns
- **ECS (Entity Component System)**: Core architecture pattern for the game engine
- **Server-Authoritative**: Game state managed on server for cheat prevention
- **Client Prediction**: Responsive controls with lag compensation for multiplayer
- **Delta Compression**: Efficient state synchronization at 60 tick rate

## Workspace Structure

This is a **monorepo** using npm workspaces. Each package is independently testable and buildable:

```
miskatonic-engine/
├── packages/
│   ├── main/          # Electron main process (window management, native APIs)
│   ├── preload/       # Security boundary (contextBridge for IPC)
│   ├── renderer/      # Game UI and client-side engine
│   ├── shared/        # Shared types and constants
│   ├── ecs/           # Entity Component System core
│   ├── physics/       # Physics abstraction (Rapier/Cannon/Box2D)
│   ├── rendering/     # Rendering pipeline (WebGL2/WebGPU)
│   ├── network/       # State synchronization and networking
│   ├── events/        # Event bus system
│   └── resources/     # Asset management
├── config/            # Build configurations (Webpack, Vite)
├── scripts/           # Development scripts (dev.js, build.js, clean.js)
├── tests/             # Integration and E2E tests
└── docs/              # Architecture and API documentation
```

### Working with Packages

Each package has its own:
- `package.json` with local scripts
- `tsconfig.json` extending from root
- `src/` directory for source code
- `tests/` directory for package-specific tests (some packages)

**Common package commands:**
```bash
# From root, run command in specific workspace
npm test --workspace=@miskatonic/physics
npm run build --workspace=@miskatonic/network

# From package directory, run directly
cd packages/physics
npm test
npm run build
```

## Development Commands

### Root-Level Commands (from project root)

```bash
# Installation
npm install              # Install all dependencies for all workspaces

# Development
npm run dev              # Start full dev environment (main + preload + renderer)
npm run build            # Build all packages for production

# Testing
npm test                 # Run all tests (uses Vitest)
npm run test:unit        # Run unit tests only (tests/unit/)
npm run test:integration # Run integration tests (tests/integration/)
npm run test:e2e         # Run E2E tests with Playwright
npm test -- --coverage   # Run tests with coverage report

# Code Quality
npm run lint             # Lint all TypeScript files
npm run format           # Format code with Prettier
npm run typecheck        # Check TypeScript types across all packages

# Utilities
npm run clean            # Clean all build artifacts
npm run docs             # Generate API documentation with TypeDoc
```

### Package-Specific Testing

```bash
# Test a specific package
npm test --workspace=@miskatonic/physics
npm test --workspace=@miskatonic/network
npm test --workspace=@miskatonic/ecs
npm test --workspace=@miskatonic/events
npm test --workspace=@miskatonic/resources

# Run specific test files from root
npm test -- tests/unit/physics/serialization.test.ts
npm test -- tests/unit/network/DeltaCompression.test.ts

# Test with coverage for specific package (from package directory)
cd packages/physics
npm run test:coverage

# Watch mode for development (from package directory)
cd packages/network
npm run test:watch
```

**Package Test Status:**
- `@miskatonic/ecs`: 65/65 tests passing (Epic 2.1)
- `@miskatonic/events`: 49/49 tests passing (Epic 2.3)
- `@miskatonic/resources`: 91/91 tests passing (Epic 2.4)
- `@miskatonic/physics`: Integration tests passing (Epics 4.1-4.5)
- `@miskatonic/network`: 94.82% coverage (Epic 5.2)

### Build Commands

```bash
# Build individual components
npm run build:main       # Build main process only (Webpack)
npm run build:preload    # Build preload script only (Webpack)
npm run build:renderer   # Build renderer only (Vite)

# Build specific package
npm run build --workspace=@miskatonic/physics
npm run build --workspace=@miskatonic/network
```

## Current Project Status

**Completed Epics (9 of 70+ planned):**

✅ **Epic 1.1-1.2: Electron Foundation** - COMPLETE
- Secure multi-process architecture (main, preload, renderer)
- Type-safe IPC communication with Zod validation
- Security-first design (context isolation, sandboxing, CSP)
- Process monitoring and crash recovery
- Native OS integration (file dialogs, menus, tray, shortcuts, notifications)

✅ **Epic 2.1: ECS Core** - COMPLETE (65/65 tests) **⚠️ NEEDS REFACTORING**
- Archetype-based ECS with generation validation
- Query system with component filtering
- **KNOWN ISSUE**: Uses object arrays instead of cache-efficient typed arrays (see Epic 2.10-2.11)
- **PERFORMANCE IMPACT**: Current implementation ~10x slower than optimal

✅ **Epic 2.3: Event System** - COMPLETE (49/49 tests)
- Production-ready event bus with critical fixes

✅ **Epic 2.4: Resource Management** - COMPLETE (91/91 tests)
- Async loading, reference counting, hot-reload, memory profiling

✅ **Epic 4.1-4.5: Physics Engine** - COMPLETE
- Physics abstraction layer (supports Rapier, Cannon-es, Box2D)
- Collision detection with continuous collision
- Rigid body dynamics with 6 joint types
- Deterministic simulation with state serialization
- Replay system for debugging
- All critical bugs fixed (Epic 4.5)

✅ **Epic 5.2: State Synchronization** - COMPLETE
- Delta compression implementation (94.82% test coverage)
- Interest management (spatial, grid, and always-interested policies)
- State replication with bandwidth optimization

**Critical Next Priorities (P0):**

From recent architecture analyses (November 2025), these are the most critical gaps:

1. **Epic 2.10-2.11: Cache-Efficient ECS Refactoring** (URGENT)
   - Current ECS uses object arrays (not cache-efficient)
   - Need SoA (Structure of Arrays) with typed arrays
   - Expected 10x performance improvement
   - Blocks rendering and game loop work

2. **Epic 2.7-2.9: Main Engine Class & Game Loop**
   - No main engine class exists yet
   - No game loop integration
   - No command/action system
   - Required before rendering can be integrated

3. **Epic 3.9-3.12: Rendering Foundation**
   - Shader system (3.9)
   - Camera system (3.10)
   - Transform hierarchy (3.11)
   - Render queue (3.12)
   - Required before WebGL2/WebGPU backends

4. **Epic 2.13-2.14: Memory Management**
   - GC mitigation strategies
   - Object pooling
   - Frame allocators
   - Memory profiling integration

### Key Documentation Files
- **[DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)**: Detailed epics, user stories, and task breakdowns (split by initiative)
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: System architecture overview with implementation status (November 2025 update)
- **[HLD.md](HLD.md)**: High-Level Design with subsystem architectures and performance budgets
- **[ENGINE_DESIGN.md](ENGINE_DESIGN.md)**: Core design principles (batteries included, swappable preferred)
- **[PRD.md](PRD.md)**: Product Requirements Document
- **[GAME_DESIGN.md](GAME_DESIGN.md)**: Sample game design demonstrating capabilities
- **planning/COMPREHENSIVE_ANALYSIS_SUMMARY_NOVEMBER_2025.md**: Recent architecture analysis identifying critical gaps
- **planning/CACHE_ARCHITECTURE_ANALYSIS.md**: Deep dive on cache-efficient ECS requirements

### When Starting Development

1. **Read these docs first** (in order):
   - [ENGINE_DESIGN.md](ENGINE_DESIGN.md) - Understand core design principles
   - [ARCHITECTURE.md](ARCHITECTURE.md) - Current implementation status and critical priorities
   - [HLD.md](HLD.md) - Review the technical architecture
   - [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) - See the implementation roadmap (organized by initiative)
   - [planning/COMPREHENSIVE_ANALYSIS_SUMMARY_NOVEMBER_2025.md](planning/COMPREHENSIVE_ANALYSIS_SUMMARY_NOVEMBER_2025.md) - Recent analysis of architectural gaps

2. **Critical Context** (November 2025):
   - ECS Core (Epic 2.1) is complete but NEEDS REFACTORING for cache efficiency
   - No main engine class exists yet (Epic 2.7)
   - No game loop integration yet (Epic 2.8)
   - Rendering system is partially designed but not implemented
   - Physics and networking foundations are solid and production-ready

3. **Recommended Next Steps**:
   - **If working on performance**: Start with Epic 2.10-2.11 (Cache-Efficient ECS)
   - **If working on integration**: Start with Epic 2.7-2.9 (Main Engine Class & Game Loop)
   - **If working on rendering**: Start with Epic 3.9-3.12 (Rendering Foundation)
   - **If working on new features**: Check ARCHITECTURE.md for dependencies first

## Known Architectural Issues

**⚠️ CRITICAL: These issues are documented and planned for resolution**

### 1. ECS Performance (Epic 2.10-2.11)
**Issue:** Current ECS implementation uses object arrays instead of cache-efficient typed arrays
- **Impact:** ~10x slower than optimal for component iteration
- **Status:** Works correctly, all tests pass, but performance is suboptimal
- **Resolution:** Planned refactoring to SoA (Structure of Arrays) with typed arrays
- **Timeline:** High priority, blocks optimal rendering performance
- **Reference:** planning/CACHE_ARCHITECTURE_ANALYSIS.md

### 2. Missing Main Engine Integration (Epic 2.7-2.9)
**Issue:** No main engine class or game loop exists yet
- **Impact:** Individual systems (ECS, physics, network) work but aren't integrated
- **Status:** Systems tested independently, integration layer not built
- **Resolution:** Build MiskatonicEngine class with integrated game loop
- **Timeline:** Required before rendering can be properly integrated
- **Reference:** ARCHITECTURE.md section on integration gaps

### 3. Rendering Foundation Missing (Epic 3.9-3.12)
**Issue:** Rendering system designed but not implemented
- **Impact:** Cannot render anything yet despite having ECS and physics
- **Status:** Architecture documented in HLD.md, implementation not started
- **Resolution:** Build shader system, camera, transform hierarchy, render queue
- **Timeline:** Depends on main engine integration (Epic 2.7-2.9)
- **Reference:** planning/RENDERING_ARCHITECTURE_ANALYSIS.md

### 4. Memory Management Not Optimized (Epic 2.13-2.14)
**Issue:** No GC mitigation strategies in place
- **Impact:** Potential frame drops from garbage collection
- **Status:** Basic implementations work, but not optimized for 60 FPS
- **Resolution:** Implement object pooling, frame allocators, GC profiling
- **Timeline:** Medium priority, affects frame stability
- **Reference:** planning/MEMORY_MANAGEMENT_ANALYSIS.md

**When working on the codebase:** Check ARCHITECTURE.md for the latest status of these issues and their planned resolution.

---

## Critical Architectural Decisions

### ECS Architecture
The engine uses **archetype-based ECS** (not sparse set).

**Current Implementation (Epic 2.1):**
- Completed and tested (65/65 tests passing)
- Uses object arrays: `Array<{entity, component1, component2}>`
- Works correctly but is NOT cache-efficient

**Required Refactoring (Epic 2.10-2.11):**
- Must migrate to SoA (Structure of Arrays) with typed arrays
- Target format: `{entity: Uint32Array, position: Float32Array, velocity: Float32Array}`
- Expected 10x performance improvement from cache-friendly sequential iteration
- See [HLD.md](HLD.md) section 2.1 and planning/CACHE_ARCHITECTURE_ANALYSIS.md for details

### Physics Determinism
**All physics must be deterministic** for competitive multiplayer:
- Use fixed timestep (16.67ms via accumulator pattern)
- Avoid floating-point non-determinism
- Verify cross-platform consistency
- State must be fully serializable
- See packages/physics/src/PhysicsWorld.ts for implementation

### Physics Package Architecture
Located in `packages/physics/`:
- **Abstraction Layer**: Physics engine interface for swapping backends
- **Backends**: Located in `src/engines/` directory
  - RapierPhysicsEngine (default, production-ready)
  - CannonPhysicsEngine (alternative)
  - Box2DPhysicsEngine (2D physics)
- **World Management**: PhysicsWorld handles simulation loop with fixed timestep
- **Serialization**: Complete state serialization including bodies, colliders, joints
- **Replay System**: PhysicsReplayPlayer for deterministic replay debugging
- **Determinism Verification**: PhysicsDeterminismVerifier for cross-platform testing

Key files:
- `src/types.ts` - Core physics types and interfaces
- `src/PhysicsWorld.ts` - Main simulation loop and world management (16.4KB)
- `src/PhysicsReplayPlayer.ts` - Replay system for debugging (10.9KB)
- `src/PhysicsSnapshotManager.ts` - Snapshot management for rollback
- `src/PhysicsDeterminismVerifier.ts` - Determinism testing utilities
- `src/engines/` - Physics engine implementations
- `src/index.ts` - Public API exports

### Network Package Architecture
Located in `packages/network/`:
- **Delta Compression**: Path-based diffing for bandwidth optimization (60-80% reduction)
- **State Replication**: Automatic entity synchronization with tick-based updates
- **Interest Management**: Spatial, grid-based, and custom policies for scalability
- **Security**: Input validation, error handling, no remote code execution

Key files:
- `src/DeltaCompression.ts` - Delta compression algorithm with history
- `src/StateReplicationManager.ts` - Entity registration and batch creation
- `src/InterestManagement.ts` - Relevance-based entity filtering
- `src/types.ts` - Complete type system for network state

**Network constraints:**
- MTU: 1200 bytes per batch (safe for most networks)
- Tick rate: 60Hz default (configurable)
- Delta compression: enabled by default
- Interest management: spatial policy with 100-unit radius default

### Rendering Backend Strategy
- **Primary**: WebGPU (next-gen, compute shader support)
- **Fallback**: WebGL2 (compatibility)
- **Abstraction**: Rendering commands must work with both backends transparently
- See DEVELOPMENT_PLAN.md Epic 3.2 for implementation approach

### Network Architecture Constraints
- **Server-authoritative**: All gameplay state validated on server (Epic 5.4)
- **Client prediction**: Required for responsive controls (Epic 5.3)
- **State synchronization**: Delta compression at 60 tick rate (Epic 5.2) ✅ DONE
- **Target**: <50ms latency, support 100+ players per session

### Plugin Security Model
Plugins run in **sandboxed environments** (Epic 2.2). User scripts must never have unrestricted access to:
- Native Node.js APIs
- File system (except approved directories)
- Network APIs (except through engine proxy)
- Other plugins' memory space

## Code Organization Patterns

When implementing, follow these patterns from [ENGINE_DESIGN.md](ENGINE_DESIGN.md):

### API Design Philosophy
```typescript
// ✅ GOOD: Simple, ergonomic API for common cases
engine.physics.createBody({...});

// ❌ BAD: Exposing internal complexity
engine.getSystemManager().getSystem('PhysicsSystem').getWorld().createBody({...});

// ✅ GOOD: Advanced control still available when needed
engine.systems.get(PhysicsSystem).world.setGravity(0, -9.81, 0);
```

### Swappable Systems Pattern
```typescript
// Default configuration (batteries included)
const engine = new MiskatonicEngine({
  physics: new RapierPhysics(),      // default
  renderer: new WebGPURenderer(),    // default
  network: new SocketIOTransport()   // default
});

// Custom configuration (swappable preferred)
const engine = new MiskatonicEngine({
  physics: new CustomPhysicsEngine(),
  renderer: new CustomRenderer(),
  network: new CustomTransport()
});
```

### Package Patterns

**Each package should:**
1. Export a clean public API through `index.ts`
2. Hide implementation details (use internal/ directory if needed)
3. Provide TypeScript types for all public APIs
4. Include comprehensive tests (>80% coverage required)
5. Follow the "batteries included, swappable preferred" philosophy

**Example package structure:**
```
packages/example/
├── src/
│   ├── index.ts              # Public API exports only
│   ├── types.ts              # Public type definitions
│   ├── ExampleManager.ts     # Main implementation
│   └── internal/             # Private implementation details
├── tests/
│   ├── ExampleManager.test.ts
│   └── integration.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts          # If package has custom test config
```

## Testing Strategy

From DEVELOPMENT_PLAN.md "Definition of Done":
- **Code coverage**: >80% required (enforced)
- **Unit tests**: Required for all new code
- **Integration tests**: Must pass before merge
- **Performance benchmarks**: Required for all engine systems
- **Cross-platform testing**: Windows, macOS, Linux

### Testing Best Practices

1. **Unit tests** should be fast and isolated
2. **Integration tests** can use real backends (e.g., Rapier physics)
3. **Mock external dependencies** in unit tests
4. **Use descriptive test names** that explain what's being tested
5. **Test edge cases**: null values, empty arrays, malformed input
6. **Test error handling**: verify graceful degradation

Example test structure:
```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should handle normal case', () => {
      // Test happy path
    });

    it('should handle edge case', () => {
      // Test boundaries
    });

    it('should handle errors gracefully', () => {
      // Test error conditions
    });
  });
});
```

## Electron-Specific Considerations

### Main Process vs Renderer Process
- **Main Process**: Window management, native APIs, file system, IPC, auto-updater
- **Renderer Process**: Game engine, ECS, rendering, physics, game logic
- **Communication**: Typed IPC channel with contextBridge for security (Epic 1.1)

### Security Boundaries
- Context isolation: ALWAYS enabled
- Node integration: DISABLED in renderer (use preload scripts)
- Remote module: NEVER use (deprecated and insecure)
- WebSecurity: NEVER disable (even in development)

### Native Integration Features
Per [ENGINE_DESIGN.md](ENGINE_DESIGN.md):
- Native file dialogs for save/load
- System tray integration
- Global keyboard shortcuts
- Auto-updater with delta patches (Epic 1.3)
- Custom protocol handler (miskatonic://)

## Performance Budgets (60 FPS target)

Critical thresholds:
- **Frame Rate**: 60 FPS target / 30 FPS critical minimum
- **Memory**: 500MB target / 1GB critical maximum
- **Draw Calls**: 500 target / 1000 critical maximum
- **Network**: <50ms target / <150ms critical maximum
- **Physics**: Must complete within 16.67ms frame budget
- **State Sync**: <1200 bytes per network batch

**Any PR that violates critical thresholds must be rejected.**

## Common Development Workflows

### Adding a New Package

1. Create package directory: `packages/my-package/`
2. Add `package.json` with workspace name: `@miskatonic/my-package`
3. Create `tsconfig.json` extending from root
4. Implement in `src/` with clean `index.ts` export
5. Add tests in `tests/` directory
6. Ensure >80% coverage: `npm run test:coverage`

### Running Tests During Development

```bash
# Watch mode for specific package
cd packages/physics
npm run test:watch

# Run specific test file
npm test -- tests/unit/physics/serialization.test.ts

# Debug failing test with verbose output
npm test -- tests/unit/physics/serialization.test.ts --reporter=verbose
```

### Working with Physics System

```typescript
// Create physics world with Rapier backend (default)
const world = new PhysicsWorld(new RapierPhysicsEngine());

// Configure simulation
world.setGravity(0, -9.81, 0);
world.setFixedTimestep(1/60); // 60 FPS

// Create rigid body
const bodyId = world.createRigidBody({
  type: 'dynamic',
  position: { x: 0, y: 10, z: 0 }
});

// Add collider
world.addCollider(bodyId, {
  type: 'sphere',
  radius: 1.0
});

// Update in game loop
const deltaTime = 0.016; // 16ms
world.step(deltaTime);

// Serialize state for networking
const state = world.serialize();

// Deserialize on client
world.deserialize(state);
```

### Working with Network System

```typescript
// Create replication manager
const replication = new StateReplicationManager({
  tickRate: 60,
  useDeltaCompression: true,
  useInterestManagement: true
});

// Register entity for replication
replication.registerEntity(entity);

// Server: Create state batch
const batch = replication.createStateBatch(observerId);
network.send(batch);

// Client: Apply received batch
replication.applyStateBatch(receivedBatch);
```

## Troubleshooting

### Build Errors

```bash
# Clean everything and rebuild
npm run clean
npm install
npm run build
```

### Test Failures

```bash
# Run with verbose output to see details
npm test -- --reporter=verbose

# Check specific test file
npm test -- tests/unit/path/to/test.test.ts
```

### TypeScript Errors

```bash
# Check types across all packages
npm run typecheck

# Check specific package
cd packages/physics
npx tsc --noEmit
```

### Physics Simulation Issues

- Verify fixed timestep is set: `world.setFixedTimestep(1/60)`
- Check determinism: serialize/deserialize state should be identical
- Use replay system for debugging: `PhysicsReplayPlayer`
- Ensure colliders are properly attached to bodies

### Network Synchronization Issues

- Check MTU limits: batches must be <1200 bytes
- Verify delta compression is enabled
- Use interest management to reduce entity count
- Check for serialization errors in console
- Validate state structure before sending
