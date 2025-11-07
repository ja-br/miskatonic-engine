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

## Core Systems (Priority Order)

### Phase 1: Foundation (Months 1-6)
1. **Electron Setup**: Main process, renderer process, IPC communication
2. **ECS Architecture**: Core entity-component system
3. **Rendering Pipeline**: WebGL2/WebGPU with PBR materials, instanced rendering, LOD system
4. **Physics Integration**: Support for Rapier, Cannon-es, Box2D with deterministic simulation
5. **Development Tools**: Electron-based visual editor, debugger, profiler, asset pipeline
6. **Native Integration**: File system access, native dialogs, auto-updates

### Phase 2: Multiplayer (Months 7-12)
1. **Networking Layer**: WebSocket + WebRTC with state synchronization
2. **Server Architecture**: Authoritative game server with NestJS
3. **Database Integration**: MongoDB for game state, Redis for sessions
4. **Matchmaking**: Skill-based matching system, room management

### Phase 3: Metagame (Months 13-18)
1. **Progression Systems**: XP/Level, skill trees, achievements, battle pass
2. **Economy Framework**: Virtual currencies, inventory, trading, marketplace
3. **Social Features**: Friends, guilds, chat, presence system
4. **Analytics Pipeline**: Player behavior tracking with Elasticsearch

## Performance Requirements

### Critical Thresholds
- **Frame Rate**: Target 60 FPS (critical threshold: 30 FPS)
- **Load Time**: Target <3s (critical: <10s)
- **Memory**: Target <500MB (critical: <1GB)
- **Network Latency**: Target <50ms (critical: <150ms)
- **Draw Calls**: Target <500 (critical: <1000)
- **Triangles**: Target <1M (critical: <3M)

### Scalability Targets
- CCU per Server: 1,000 (max: 5,000)
- Total CCU: 100,000 (max: 1,000,000)
- Database QPS: 10,000 (max: 100,000)

## Security Requirements

- **Authentication**: OAuth 2.0, JWT tokens, 2FA support
- **Authorization**: Role-based access control (RBAC)
- **Encryption**: TLS 1.3, AES-256 at rest
- **Server-Side Validation**: All inputs must be validated server-side
- **Anti-Cheat**: Server authoritative + statistical detection
- **Sandboxing**: User scripts must run in sandboxed environment

## Key Design Principles

1. **Electron-Native**: Desktop-first with full native OS integration
2. **NoSQL-First Architecture**: Flexible data models for rapid iteration
3. **Deterministic Physics**: 100% consistency across clients for competitive games
4. **Hot-Swappable Systems**: Support multiple physics engines, rendering backends
5. **Type Safety**: Full TypeScript with complete type definitions
6. **Horizontal Scalability**: Design for sharding and distributed systems
7. **Cross-Platform Desktop**: Windows, macOS, Linux support via Electron

## Current Project Status

**Epic 1.1: Electron Architecture Setup is COMPLETE ✅**

The foundational Electron architecture has been fully implemented with:
- Secure multi-process architecture (main, preload, renderer)
- Type-safe IPC communication with Zod validation
- Security-first design (context isolation, sandboxing, CSP)
- Process monitoring and crash recovery
- Full development and build tooling
- Testing infrastructure with Vitest
- Comprehensive documentation

### Key Documentation Files
- **[DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)**: Detailed epics, user stories, and task breakdowns organized by initiative
- **[HLD.md](HLD.md)**: High-Level Design with detailed subsystem architectures and data flows
- **[ENGINE_DESIGN.md](ENGINE_DESIGN.md)**: Core design principles for engine developers (batteries included, swappable preferred)
- **[PRD.md](PRD.md)**: Product Requirements Document with feature specifications and success metrics
- **[GAME_DESIGN.md](GAME_DESIGN.md)**: Sample game design demonstrating engine capabilities

### When Starting Development

1. **Read these docs first** (in order):
   - [ENGINE_DESIGN.md](ENGINE_DESIGN.md) - Understand core design principles
   - [HLD.md](HLD.md) - Review the technical architecture
   - [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) - See the implementation roadmap

2. **Initial Setup Priority** (from DEVELOPMENT_PLAN.md):
   - Initiative 1: Platform Foundation (INIT-001) - Electron setup must come first
   - Initiative 2: Core Engine Systems (INIT-002) - ECS architecture is foundational
   - All other initiatives depend on these two

3. **Development Commands**:
   ```bash
   npm install              # Install all dependencies
   npm run dev              # Start development environment (HMR enabled)
   npm run build            # Build for production
   npm test                 # Run all tests
   npm run test:unit        # Run unit tests only
   npm run lint             # Lint code
   npm run format           # Format code with Prettier
   npm run typecheck        # Check TypeScript types
   npm run clean            # Clean build artifacts
   ```

   See [README.md](README.md) for quick start and [docs/guides/development-setup.md](docs/guides/development-setup.md) for detailed setup instructions.

## Critical Architectural Decisions

### ECS Architecture
The engine uses **archetype-based ECS** (not sparse set). Components are stored contiguously by archetype for cache efficiency. See [HLD.md](HLD.md) section 2.1 for implementation details.

### Physics Determinism
**All physics must be deterministic** for competitive multiplayer. Use fixed timestep (16.67ms), avoid floating-point non-determinism, and verify cross-platform consistency. See DEVELOPMENT_PLAN.md Epic 4.4.

### Rendering Backend Strategy
- **Primary**: WebGPU (next-gen, compute shader support)
- **Fallback**: WebGL2 (compatibility)
- **Abstraction**: Rendering commands must work with both backends transparently
- See DEVELOPMENT_PLAN.md Epic 3.2 for implementation approach

### Network Architecture Constraints
- **Server-authoritative**: All gameplay state validated on server (Epic 5.4)
- **Client prediction**: Required for responsive controls (Epic 5.3)
- **State synchronization**: Delta compression at 60 tick rate (Epic 5.2)
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

## Testing Strategy

From DEVELOPMENT_PLAN.md "Definition of Done":
- **Code coverage**: >80% required
- **Unit tests**: Required for all new code
- **Integration tests**: Must pass before merge
- **Performance benchmarks**: Required for all engine systems
- **Cross-platform testing**: Windows, macOS, Linux

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

Critical thresholds from [CLAUDE.md](CLAUDE.md):
- **Frame Rate**: 60 FPS target / 30 FPS critical minimum
- **Memory**: 500MB target / 1GB critical maximum
- **Draw Calls**: 500 target / 1000 critical maximum
- **Network**: <50ms target / <150ms critical maximum

**Any PR that violates critical thresholds must be rejected.**
