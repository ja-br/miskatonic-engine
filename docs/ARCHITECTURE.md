# Miskatonic Engine Architecture

**Version:** 3.0
**Date:** November 2025 (Major Update)
**Status:** Living Document
**Update:** 21 new epics added from architecture analyses (cache, memory, integration, rendering)

This document provides a comprehensive overview of the Miskatonic Engine architecture, covering both implemented and planned systems.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Implemented Systems](#implemented-systems)
4. [Planned Systems](#planned-systems)
5. [Package Architecture](#package-architecture)
6. [Data Flow Architecture](#data-flow-architecture)
7. [Security Architecture](#security-architecture)
8. [Performance Architecture](#performance-architecture)
9. [Deployment Architecture](#deployment-architecture)

---

## Executive Summary

Miskatonic Engine is a desktop game engine built on Electron, designed for creating high-quality 3D multiplayer games. The architecture follows a **monorepo workspace structure** with independent packages, each responsible for a specific domain.

### Key Architectural Principles

1. **Electron-Native**: Desktop-first design with full OS integration
2. **Monorepo Structure**: Independent packages with clear boundaries
3. **ECS Architecture**: Entity Component System for game logic
4. **Server-Authoritative**: Multiplayer with server validation
5. **Hot-Swappable Systems**: Pluggable physics engines, renderers, network transports
6. **Type Safety**: Full TypeScript coverage across all packages
7. **Performance-Budgeted**: Every subsystem operates within strict performance constraints

### Current Status (November 2025)

**Implemented:** 10 of 70+ planned epics (21 new epics added November 2025)
- ✅ Electron Foundation (Epic 1.1, 1.2)
- ⚠️ ECS Core (Epic 2.1) - **NEEDS REFACTORING** (uses object arrays, not cache-efficient typed arrays)
- ✅ Event System (Epic 2.3)
- ✅ Resource Management (Epic 2.4)
- ✅ Physics Engine (Epics 4.1-4.5)
- ✅ State Synchronization (Epic 5.2)

**In Progress:** None (awaiting next epic selection)

**Next Priority (URGENT):**
- **P0 CRITICAL:** Epic 2.10-2.11 (Cache-Efficient ECS Refactoring - 10x performance improvement)
- **P0 CRITICAL:** Epic 2.7-2.9 (Main Engine Class, Game Loop, Command System)
- **P0 CRITICAL:** Epic 3.9-3.12 (Rendering Foundation: Shader, Camera, Transform, Render Queue)
- **P0 CRITICAL:** Epic 2.13-2.14 (Memory Management Foundation, GC Mitigation)

---

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Client Application (Electron)                     │
├─────────────────────────────────────────────────────────────────────┤
│  Main Process                  │  Renderer Process                   │
│  ├─ Window Management          │  ├─ Game Engine Core               │
│  ├─ Native File System (✅)    │  │  ├─ ECS Framework (✅)          │
│  ├─ System Integration (✅)    │  │  ├─ Rendering Pipeline (⏳)    │
│  ├─ Auto-Updater (⏳)          │  │  ├─ Physics Simulation (✅)    │
│  ├─ IPC Controller (✅)        │  │  ├─ Audio System (⏳)          │
│  └─ Menus/Tray (✅)            │  │  └─ Input Management (⏳)      │
│                                │  ├─ Game Logic                     │
│                                │  └─ Network Client (✅ partial)    │
├─────────────────────────────────────────────────────────────────────┤
│                         Network Layer (✅ partial)                   │
│  ├─ State Synchronization (✅ Epic 5.2)                             │
│  ├─ Delta Compression (✅)                                           │
│  ├─ Interest Management (✅)                                         │
│  ├─ WebSocket (Socket.io) (⏳)                                      │
│  └─ WebRTC (P2P) (⏳)                                               │
├─────────────────────────────────────────────────────────────────────┤
│                    Game Server (⏳ not started)                      │
│  ├─ NestJS Application Framework                                    │
│  ├─ Game State Management                                           │
│  ├─ Matchmaking Service                                             │
│  ├─ Social Systems                                                  │
│  └─ Analytics Pipeline                                              │
├─────────────────────────────────────────────────────────────────────┤
│                    Data Layer (⏳ not started)                       │
│  ├─ MongoDB (Document Store)                                        │
│  ├─ Redis (Cache & Sessions)                                        │
│  ├─ Elasticsearch (Analytics)                                       │
│  └─ CDN (Asset Distribution)                                        │
└─────────────────────────────────────────────────────────────────────┘

Legend: ✅ Implemented | ⏳ Planned | 🚧 In Progress
```

### Component Layering

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application Layer                        │
│  • Game Logic                                                    │
│  • Game-Specific Systems                                         │
│  • UI/HUD                                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Engine Layer                             │
│  • ECS Framework (✅)                                           │
│  • Event System (✅)                                            │
│  • Resource Management (✅)                                     │
│  • Scene Management (⏳)                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Systems Layer                            │
│  • Physics (✅)      • Rendering (⏳)    • Audio (⏳)         │
│  • Input (⏳)        • Network (✅)       • Animation (⏳)     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Platform Layer                           │
│  • Electron Main (✅)                                           │
│  • Native OS APIs (✅)                                          │
│  • File System (✅)                                             │
│  • IPC (✅)                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implemented Systems

### 1. Platform Foundation (✅ Complete)

**Location:** `packages/main/`, `packages/preload/`
**Status:** Production-ready
**Test Coverage:** 100%

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Electron Main Process                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  WindowManager   │  │   FileSystem     │  │  MenuBuilder │ │
│  │  • Create/Close  │  │   • Read/Write   │  │  • App Menu  │ │
│  │  • Focus/Hide    │  │   • Dialogs      │  │  • Context   │ │
│  │  • Multi-window  │  │   • Validation   │  │  • Actions   │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │   TrayManager    │  │  ShortcutMgr     │  │  IPC Router  │ │
│  │  • Tray Icon     │  │  • Global Keys   │  │  • Channels  │ │
│  │  • Context Menu  │  │  • Bindings      │  │  • Handlers  │ │
│  │  • Notifications │  │  • Conflicts     │  │  • Security  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↕ IPC (Typed, Validated)
┌─────────────────────────────────────────────────────────────────┐
│                    Preload Script (Security Boundary)            │
│  • contextBridge API exposure                                    │
│  • Zod schema validation                                         │
│  • Type-safe interfaces                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                         Renderer Process                         │
│  • Game engine                                                   │
│  • No Node.js access (sandboxed)                                 │
│  • IPC through exposed APIs only                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Features

- **Multi-Process Architecture**: Secure separation between main and renderer
- **Type-Safe IPC**: Full TypeScript types with runtime Zod validation
- **Security-First**: Context isolation, sandboxing, CSP headers
- **OS Integration**: File dialogs, menus, system tray, shortcuts, notifications
- **Process Monitoring**: Crash detection, recovery, health checks

#### Security Boundaries

1. **Main Process**: Full Node.js access, native APIs, file system
2. **Preload Script**: Security boundary with contextBridge
3. **Renderer Process**: Sandboxed, no Node.js, IPC only

### 2. ECS Framework (⚠️ NEEDS REFACTORING)

**Location:** `packages/ecs/`
**Status:** Functional but NOT cache-optimized (10x performance improvement available)
**Test Coverage:** 65/65 tests passing
**Critical Issue:** Uses object arrays (cache-unfriendly) instead of SoA typed arrays (cache-efficient)

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ECS Core Architecture                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     World (Container)                     │  │
│  │  • Entity generation tracking                             │  │
│  │  • Component type registration                            │  │
│  │  • System scheduling                                      │  │
│  │  • Query caching                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Archetype Manager                         │  │
│  │  • Archetype-based storage (not sparse set)              │  │
│  │  • Component storage by archetype                        │  │
│  │  • Cache-friendly contiguous data                        │  │
│  │  • Efficient structural changes                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Query System                         │  │
│  │  • With/Without/Optional filters                          │  │
│  │  • Cached query results                                   │  │
│  │  • Change detection                                       │  │
│  │  • Parallel iteration support                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    System Scheduler                       │  │
│  │  • Topological sort (dependency order)                    │  │
│  │  • Parallel execution groups                              │  │
│  │  • Resource conflict detection                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Design Decisions

1. **Archetype-Based Storage**: Components stored contiguously by archetype for cache efficiency
2. **Generation Validation**: Entity handles include generation counter to detect stale references
3. **Parallel Systems**: Systems can execute in parallel if they don't conflict on resources
4. **Change Detection**: Queries can track entity additions/removals for efficient updates

#### Critical Refactoring Needed (November 2025)

**Current Implementation (Archetype.ts:33):**
```typescript
components: new Map()  // Object arrays - cache-unfriendly
```

**Problem:** Uses "Option A" (object arrays) which is 10x slower than "Option B" (SoA typed arrays)

**Impact:**
- Component iteration: ~10k components/ms (vs >100k possible)
- Memory per component: ~50 bytes (vs ~12 bytes possible)
- GC pressure: ~1000 objects/frame (vs <100 possible)
- Cache performance: Poor spatial locality (scattered objects)

**Solution Required (Epics 2.10-2.11):**
```typescript
// SoA (Structure of Arrays) typed arrays
class ComponentStorage<T> {
  private arrays: Map<keyof T, TypedArray>  // Sequential, cache-friendly
}
```

**Expected Improvement:** 10x faster iteration, 4x less memory, 10x less GC pressure

**Status:** Epic 2.10 (Component Storage Research) must complete before Epic 2.1 can be considered production-ready

#### Usage Pattern

```typescript
// Register components
world.registerComponent('Position', PositionComponent);
world.registerComponent('Velocity', VelocityComponent);

// Create entity
const entity = world.createEntity();
world.addComponent(entity, 'Position', { x: 0, y: 0, z: 0 });
world.addComponent(entity, 'Velocity', { x: 1, y: 0, z: 0 });

// Query entities
const query = world.createQuery()
  .with('Position')
  .with('Velocity')
  .build();

// System updates
for (const entity of query.iter()) {
  const pos = world.getComponent(entity, 'Position');
  const vel = world.getComponent(entity, 'Velocity');
  pos.x += vel.x * deltaTime;
}
```

### 3. Event System (✅ Complete)

**Location:** `packages/events/`
**Status:** Production-ready
**Test Coverage:** 49/49 tests passing

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Event Bus Architecture                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      EventBus Core                        │  │
│  │  • Type-safe event registration                           │  │
│  │  • Priority-based handler execution                       │  │
│  │  • Async/sync event dispatch                              │  │
│  │  • Wildcard pattern matching                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Handler Management                       │  │
│  │  • Handler registration/unregistration                    │  │
│  │  • Priority ordering (0-10)                               │  │
│  │  • Once handlers (auto-unregister)                        │  │
│  │  • Handler cleanup on dispose                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Event Filtering                         │  │
│  │  • Global filters (can block events)                      │  │
│  │  • Per-handler filters                                    │  │
│  │  • Predicate-based filtering                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Performance Features                     │  │
│  │  • Event batching                                          │  │
│  │  • Deferred dispatch                                       │  │
│  │  • Error boundaries (handlers isolated)                   │  │
│  │  • Memory profiling (event counts, handler counts)        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Features

- **Type Safety**: Full TypeScript generics for event payloads
- **Priority System**: 0-10 priority levels for handler ordering
- **Async Support**: Both sync and async event handlers
- **Error Isolation**: Handler errors don't crash the event bus
- **Performance**: Event batching, deferred dispatch, efficient lookup

### 4. Resource Management (✅ Complete)

**Location:** `packages/resources/`
**Status:** Production-ready
**Test Coverage:** 91/91 tests passing

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Resource Management System                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   ResourceManager                         │  │
│  │  • Resource registration                                  │  │
│  │  • Async loading pipeline                                 │  │
│  │  • Reference counting                                      │  │
│  │  • Hot-reload support                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Resource Loaders                       │  │
│  │  • Texture Loader (images, mipmaps)                       │  │
│  │  • Model Loader (GLTF, FBX)                               │  │
│  │  • Audio Loader (MP3, WAV, OGG)                            │  │
│  │  • Shader Loader (WGSL)                                     │  │
│  │  • Custom loaders (plugin system)                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     Cache Layer                           │  │
│  │  • LRU eviction policy                                     │  │
│  │  • Memory budget enforcement                               │  │
│  │  • Weak references for unused resources                   │  │
│  │  • Preload queues                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Memory Profiling                          │  │
│  │  • Resource memory tracking                                │  │
│  │  • Leak detection                                          │  │
│  │  • Usage statistics                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Features

- **Async Loading**: Non-blocking resource loading with progress tracking
- **Reference Counting**: Automatic resource cleanup when no longer referenced
- **Hot Reload**: Live update of resources during development
- **Memory Management**: LRU cache with configurable memory budgets
- **Format Support**: Extensible loader system for any asset type

### 5. Physics Engine (✅ Complete)

**Location:** `packages/physics/`
**Status:** Production-ready
**Test Coverage:** 7 integration tests + manual validation

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Physics Architecture                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    IPhysicsEngine                         │  │
│  │  • Backend abstraction interface                          │  │
│  │  • Swappable implementations                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Physics Backends                         │  │
│  │  • RapierPhysicsEngine (✅ default, deterministic)       │  │
│  │  • CannonPhysicsEngine (✅ alternative)                  │  │
│  │  • Box2DPhysicsEngine (⏳ 2D only)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    PhysicsWorld                           │  │
│  │  • Fixed timestep simulation (16.67ms)                    │  │
│  │  • Accumulator pattern for stability                      │  │
│  │  • Gravity, damping configuration                         │  │
│  │  • Collision callbacks                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Rigid Body System                        │  │
│  │  • Dynamic, kinematic, static bodies                      │  │
│  │  • Forces, impulses, torques                              │  │
│  │  • Mass, inertia properties                               │  │
│  │  • Damping (linear, angular)                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Collision System                         │  │
│  │  • Collider shapes: sphere, box, capsule, cylinder       │  │
│  │  • Compound shapes                                         │  │
│  │  • Continuous Collision Detection (CCD)                   │  │
│  │  • Collision filtering (layers, masks)                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Joint System                           │  │
│  │  • Fixed joints (welding)                                 │  │
│  │  • Revolute joints (hinges)                               │  │
│  │  • Prismatic joints (sliders)                             │  │
│  │  • Spherical joints (ball-socket)                         │  │
│  │  • Spring joints (soft constraints)                       │  │
│  │  • Motor joints (powered movement)                        │  │
│  │  • Joint limits and breaking                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Deterministic Simulation                     │  │
│  │  • State serialization (bodies, colliders, joints)        │  │
│  │  • State deserialization                                  │  │
│  │  • Replay system (PhysicsReplayPlayer)                    │  │
│  │  • Rollback support for networking                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Features

- **Deterministic**: Fixed timestep, full state serialization, replay support
- **Hot-Swappable**: Change physics backend at runtime
- **Collision Detection**: All common shapes + compound shapes + CCD
- **Constraints**: 6 joint types with motors and springs
- **Networking-Ready**: Serialize/deserialize for state synchronization

#### Usage Pattern

```typescript
// Create physics world with Rapier backend
const world = new PhysicsWorld(new RapierPhysicsEngine());
world.setGravity(0, -9.81, 0);
world.setFixedTimestep(1/60);

// Create dynamic body
const bodyId = world.createRigidBody({
  type: 'dynamic',
  position: { x: 0, y: 10, z: 0 }
});

// Add sphere collider
world.addCollider(bodyId, {
  type: 'sphere',
  radius: 1.0
});

// Create joint
const jointId = world.createRevoluteJoint(bodyId1, bodyId2, {
  anchor1: { x: 0, y: 0, z: 0 },
  anchor2: { x: 0, y: 0, z: 0 },
  axis: { x: 0, y: 1, z: 0 }
});

// Simulate
world.step(deltaTime);

// Serialize for networking
const state = world.serialize();
```

### 6. Network State Synchronization (✅ Complete)

**Location:** `packages/network/`
**Status:** Production-ready
**Test Coverage:** 89 tests, 94.82% coverage

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Network Synchronization System                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              StateReplicationManager                      │  │
│  │  • Entity registration                                    │  │
│  │  • Tick-based replication (60Hz default)                  │  │
│  │  • Full state + delta batches                             │  │
│  │  • Interest management integration                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Delta Compression                         │  │
│  │  • Path-based diffing (e.g., "position.x")               │  │
│  │  • 60-80% bandwidth reduction                             │  │
│  │  • History-based (64 snapshots default)                   │  │
│  │  • Null/undefined handling                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               Interest Management                         │  │
│  │  • SpatialInterestPolicy (distance-based)                │  │
│  │  • GridInterestPolicy (cell-based, scalable)             │  │
│  │  • AlwaysInterestedPolicy (debugging)                     │  │
│  │  • Custom policies (plugin system)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Batch Creation                          │  │
│  │  • Full states (new/important entities)                   │  │
│  │  • Delta updates (changed entities)                       │  │
│  │  • Destroyed entities list                                │  │
│  │  • MTU-aware (1200 bytes max)                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Security & Validation                    │  │
│  │  • Input validation (structure checks)                    │  │
│  │  • Error boundaries (graceful degradation)                │  │
│  │  • No remote code execution                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Features

- **Delta Compression**: Only send changed fields, 60-80% bandwidth savings
- **Interest Management**: Filter entities by relevance (spatial, grid-based)
- **Tick-Based**: Consistent 60Hz updates (configurable)
- **Error Resilient**: Handles malformed data, serialization failures
- **Type-Safe**: Full TypeScript with StateValue recursive type

#### Usage Pattern

```typescript
// Server setup
const replication = new StateReplicationManager({
  tickRate: 60,
  useDeltaCompression: true,
  useInterestManagement: true
});

// Register entities
replication.registerEntity(player);
replication.registerEntity(enemy);

// Create batch every tick
const batch = replication.createStateBatch(observerId);
network.send(batch); // <1200 bytes

// Client receives and applies
replication.applyStateBatch(receivedBatch);
```

---

## Planned Systems

### 1. Rendering Pipeline (⏳ Epics 3.1-3.14)

**Priority:** P0 (High)
**Dependencies:** ECS Core (⚠️ needs refactoring), Epic 3.1 (Rendering Foundation)
**Estimated Complexity:** High (10 epics, 21-29 weeks)
**Critical Discovery:** Rendering massively underestimated in original plan - requires 10 separate epics, not 2

#### Planned Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Rendering Pipeline                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Renderer Abstraction                      │  │
│  │  • IRenderer interface                                    │  │
│  │  • WebGPU backend                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  WebGPU Renderer                                        │  │
│  │  • Modern graphics API                                  │  │
│  │  • Compute shaders                                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Material System                         │  │
│  │  • PBR materials (metallic-roughness)                     │  │
│  │  • Shader hot-reload                                      │  │
│  │  • Material instancing                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Render Graph                           │  │
│  │  • Shadow passes                                          │  │
│  │  • Opaque/transparent passes                              │  │
│  │  • Post-processing passes                                 │  │
│  │  • Compute passes (particles, etc.)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Culling & LOD                            │  │
│  │  • Frustum culling                                        │  │
│  │  • Occlusion culling                                      │  │
│  │  • Distance-based LOD                                     │  │
│  │  • Instanced rendering                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Rendering Epics Breakdown (November 2025 Update)

**Epic 3.1-3.2:** Rendering Abstraction & WebGPU Implementation (original plan)
**Epic 3.3:** PBR Material System ✅ Complete
**Epic 3.8:** GPU Memory Management (P1 - IMPORTANT, 2-3 weeks)
**Epic 3.9:** Shader Management System (P0 - CRITICAL, 2-3 weeks)
**Epic 3.10:** Camera System (P0 - CRITICAL, 2 weeks)
**Epic 3.11:** Transform System (P0 - CRITICAL, 2 weeks)
**Epic 3.12:** Render Queue Organization (P0 - CRITICAL, 3-4 weeks)
**Epic 3.13:** Draw Call Batching & Instancing (P1 - IMPORTANT, 2-3 weeks)
**Epic 3.14:** Transparency & Blending (P1 - IMPORTANT, 1-2 weeks)

**Total:** 10 epics, 21-29 weeks (5-7 months)

#### Critical Rendering Gaps Identified

**Shader Management (Epic 3.9):**
- WGSL (WebGPU) shader support
- Shader variant management (lit, skinned, textured, instanced)
- Hot-reload during development (<100ms)
- Include system for shared functions

**Camera System (Epic 3.10):**
- View/projection matrix generation
- Orbit and FPS camera controllers
- Active camera selection
- Multiple camera support (split-screen)

**Transform System (Epic 3.11):**
- ECS Transform → GPU 4×4 matrices
- Hierarchical transforms (parent/child)
- Dirty flag optimization
- <0.5ms for 1000 transforms

**Render Queue (Epic 3.12):**
- Opaque: Front-to-back sorting (minimize overdraw)
- Transparent: Back-to-front sorting (correct blending)
- Alpha-test: By material (minimize state changes)
- <100 draw calls for 1000 objects

**Batching & Instancing (Epic 3.13):**
- Static batching (build-time mesh combining)
- Dynamic batching (runtime, same material)
- Instance rendering (1 call for N objects)
- 10-100x draw call reduction

**Transparency (Epic 3.14):**
- Back-to-front depth sorting
- Depth write control (read but don't write)
- Alpha blending vs alpha-test modes
- <1ms sorting overhead

#### Key Requirements

- **WebGPU Primary**: Next-gen graphics with compute shaders
- **WebGPU-only**: Modern graphics API (WebGL2 removed December 2024)
- **PBR Materials**: Industry-standard physically-based rendering ✅ Complete (Epic 3.3)
- **Performance**: 60 FPS with 1000+ objects (requires all 10 epics)
- **Hot-Reload**: Shader editing during development
- **Draw Call Budget**: <100 calls per frame (vs naive 1000 calls)
- **CPU Budget**: <3ms rendering overhead
- **GPU Budget**: <5ms shader execution

### 2. Client Prediction & Reconciliation (⏳ Epic 5.3)

**Priority:** P0 (High)
**Dependencies:** State Synchronization (✅), Physics (✅)

#### Planned Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Client-Side Prediction                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Input Manager                            │  │
│  │  • Capture player inputs                                  │  │
│  │  • Sequence numbering                                      │  │
│  │  • Send to server                                          │  │
│  │  • Store in input buffer                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               Client-Side Simulation                      │  │
│  │  • Apply inputs immediately (prediction)                  │  │
│  │  • Run physics/logic locally                              │  │
│  │  • Store predicted states                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Server Reconciliation                        │  │
│  │  • Receive authoritative state                            │  │
│  │  • Compare with predicted state                           │  │
│  │  • Rollback if mismatch detected                          │  │
│  │  • Replay inputs from mismatch point                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Entity Interpolation                         │  │
│  │  • Smooth other entities' movements                       │  │
│  │  • Interpolation buffer (100ms default)                   │  │
│  │  • Extrapolation for dropped packets                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Features

- **Immediate Response**: Client predicts movement instantly
- **Server Authority**: Server validates all actions
- **Reconciliation**: Rollback and replay on mismatch
- **Smooth Interpolation**: Other entities interpolated smoothly
- **Lag Compensation**: Handles variable network latency

### 3. Game Server (⏳ Epic 5.4+)

**Priority:** P0 (High)
**Dependencies:** State Synchronization (✅), Client Prediction (⏳)

#### Planned Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Game Server (NestJS)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                Connection Manager                         │  │
│  │  • WebSocket connections (Socket.io)                      │  │
│  │  • Player authentication                                   │  │
│  │  • Session management                                      │  │
│  │  • Heartbeat/keepalive                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               Game State Manager                          │  │
│  │  • Authoritative game state                               │  │
│  │  • Input validation                                        │  │
│  │  • Physics simulation                                      │  │
│  │  • Game logic processing                                   │  │
│  │  • State broadcasting                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Matchmaking Service                       │  │
│  │  • Skill-based matching                                   │  │
│  │  • Lobby management                                        │  │
│  │  • Party system                                            │  │
│  │  • Backfill (join in-progress games)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Social Systems                           │  │
│  │  • Friend lists                                            │  │
│  │  • Guilds/clans                                            │  │
│  │  • Chat (text, voice)                                      │  │
│  │  • Presence (online/offline/in-game)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                Analytics Pipeline                         │  │
│  │  • Player behavior tracking                                │  │
│  │  • Performance metrics                                     │  │
│  │  • Economy tracking                                        │  │
│  │  • Elasticsearch integration                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Audio System (⏳ Epic 2.5)

**Priority:** P1 (Medium)
**Dependencies:** Resource Management (✅)

#### Planned Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Audio System                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Audio Engine (Web Audio API)             │  │
│  │  • AudioContext management                                │  │
│  │  • Master volume control                                   │  │
│  │  • Audio graph routing                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Sound System                           │  │
│  │  • 3D spatial audio                                       │  │
│  │  • Distance attenuation                                   │  │
│  │  • Doppler effect                                          │  │
│  │  • Occlusion/obstruction                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Music System                           │  │
│  │  • Background music playback                              │  │
│  │  • Crossfading                                             │  │
│  │  • Dynamic music (interactive)                            │  │
│  │  • Playlist management                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Mixer System                           │  │
│  │  • Volume groups (SFX, Music, Voice, Master)             │  │
│  │  • EQ/filters                                              │  │
│  │  • Compression/limiting                                    │  │
│  │  • Voice ducking (lower music when voice plays)          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Animation System (⏳ Epic 2.6)

**Priority:** P1 (Medium)
**Dependencies:** ECS (✅), Rendering (⏳)

#### Planned Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Animation System                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Skeletal Animation                           │  │
│  │  • Bone hierarchies                                       │  │
│  │  • Keyframe interpolation (linear, cubic)                │  │
│  │  • Animation blending                                      │  │
│  │  • Inverse kinematics (IK)                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Animation State Machine                      │  │
│  │  • State nodes (idle, walk, run, jump)                   │  │
│  │  • Transitions with blend times                           │  │
│  │  • Parameters (speed, direction, grounded)               │  │
│  │  • Sub-state machines (layers)                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                Animation Retargeting                      │  │
│  │  • Share animations between rigs                          │  │
│  │  • Automatic bone mapping                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Cache Optimization (⏳ Epics 2.10-2.12) - November 2025

**Priority:** P0 (CRITICAL - BLOCKS ECS)
**Dependencies:** None (blocks Epic 2.1)
**Estimated Effort:** 5-7 weeks

#### Critical Discovery

**ECS NOT cache-optimized despite claims.** Current implementation uses object arrays (10x slower than possible).

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cache Optimization Architecture               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Epic 2.10: Component Storage Research (1-2 weeks)              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Benchmark object arrays vs typed arrays                │  │
│  │  • Validate 10x prediction (sequential vs random)        │  │
│  │  • Measure GC impact                                      │  │
│  │  • Make data-driven storage decision                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 2.11: Cache-Efficient ECS Refactoring (3-4 weeks)         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Current (Bad):                                           │  │
│  │    components: Map<ComponentType, any[]>  // Objects     │  │
│  │                                                            │  │
│  │  New (Good):                                              │  │
│  │    components: Map<ComponentType, ComponentStorage>      │  │
│  │    class ComponentStorage<T> {                            │  │
│  │      arrays: Map<keyof T, TypedArray>  // SoA           │  │
│  │    }                                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 2.12: Cache-Aware System Guidelines (1 week)              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Document mandatory iteration patterns                  │  │
│  │  • Component size guidelines (<64 bytes)                 │  │
│  │  • Code review checklist                                  │  │
│  │  • Prevent cache-unfriendly patterns                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Performance Impact

| Metric | Current (Objects) | Target (Typed Arrays) | Improvement |
|--------|-------------------|----------------------|-------------|
| Iteration Speed | ~10k/ms | >100k/ms | **10x faster** |
| Memory/Component | ~50 bytes | ~12 bytes | **4x less** |
| GC Pressure | ~1000/frame | <100/frame | **10x less** |
| Cache Performance | Poor | Excellent | **10-100x** |

#### Cache-Aware Pattern Example

```typescript
// ✅ GOOD: Cache-friendly (sequential archetype iteration)
class MovementSystem {
  update(dt: number) {
    for (const archetype of this.archetypes) {
      const pos = archetype.getStorage(Position);
      const vel = archetype.getStorage(Velocity);

      for (let i = 0; i < archetype.count; i++) {
        pos.x[i] += vel.x[i] * dt;  // Sequential access
        pos.y[i] += vel.y[i] * dt;
        pos.z[i] += vel.z[i] * dt;
      }
    }
  }
}

// ❌ BAD: Cache-unfriendly (10-100x slower)
class MovementSystem {
  update(dt: number) {
    for (const entityId of randomEntityIds) {
      const entity = world.getEntity(entityId);  // Random lookup
      entity.position.add(entity.velocity);       // Pointer chasing
    }
  }
}
```

---

### 7. Memory Management (⏳ Epics 2.13-2.15, 3.8, 5.6) - November 2025

**Priority:** P0 (CRITICAL)
**Dependencies:** Epic 2.13 (foundation for others)
**Estimated Effort:** 9-12 weeks

#### Critical Discovery

**Memory management not treated as first-class concern.** No GC mitigation, no frame allocators, no GPU/VRAM management.

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Memory Management Architecture                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Epic 2.13: Memory Management Foundation (3-4 weeks)            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • ObjectPool<T> (reusable objects)                       │  │
│  │  • FrameAllocator (per-frame temporary data)             │  │
│  │  • GCMonitor (track GC pauses)                            │  │
│  │  • Memory budgets (RAM/VRAM)                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 2.14: GC Mitigation and V8 Tuning (2 weeks)               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • V8 flags tuning (--max-old-space-size, etc.)         │  │
│  │  • GC profiling and analysis                              │  │
│  │  • Allocation hotspot identification                     │  │
│  │  • <5ms GC pause budget enforcement                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 2.15: Memory Leak Detection (1-2 weeks)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Automated leak detection                               │  │
│  │  • Load/unload cycle testing                             │  │
│  │  • GPU resource tracking (buffers, textures)            │  │
│  │  • CI/CD integration (fail on leaks)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 3.8: GPU Memory Management (2-3 weeks)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • GPUBufferPool (reusable GPU buffers)                  │  │
│  │  • TextureAtlas (combine textures)                        │  │
│  │  • VRAM budgets and tracking                              │  │
│  │  • GPU profiling integration                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 5.6: Network Memory Optimization (1-2 weeks)              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • NetworkBufferPool (serialization buffers)             │  │
│  │  • Zero-copy deserialization (write to typed arrays)     │  │
│  │  • <50 allocations per tick (60Hz)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Memory Budgets

**RAM: 500MB target, 1GB critical max**
- ECS: 100MB
- Rendering: 50MB
- Physics: 50MB
- Network: 50MB
- Audio: 50MB
- Assets: 100MB
- Engine: 50MB
- Game Logic: 50MB

**VRAM: 256MB target**
- Textures: 128MB
- Vertex/Index Buffers: 64MB
- Render Targets: 48MB
- Other: 16MB

**GC Budget:**
- Pause time: <5ms (leaves 11.67ms for work)
- Per-frame allocations: <1000 objects (steady state)
- Network allocations: <50 objects/tick
- Rendering allocations: <100 objects/frame

---

### 8. Integration Layer (⏳ Epics 2.7-2.9, 6.1-6.3) - November 2025

**Priority:** P0 (CRITICAL)
**Dependencies:** ECS Core (Epic 2.1)
**Estimated Effort:** 7-10 weeks

#### Critical Discovery

**No integration layer defined.** Epic 2.1 (ECS Core) marked complete but missing main engine class, game loop, command system, debug tools.

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Integration Layer Architecture               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Epic 2.7: Main Engine Class (2-3 weeks)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  class MiskatonicEngine {                                 │  │
│  │    world: World;              // ECS world                │  │
│  │    physics: PhysicsWorld;     // Physics simulation       │  │
│  │    renderer: Renderer;        // Rendering pipeline       │  │
│  │    network: NetworkClient;    // Network client           │  │
│  │    resources: ResourceMgr;    // Asset management         │  │
│  │                                                            │  │
│  │    start(): void;             // Initialize engine        │  │
│  │    update(dt: number): void;  // Frame update             │  │
│  │    shutdown(): void;          // Cleanup                  │  │
│  │  }                                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 2.8: Game Loop Architecture (1-2 weeks)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Phase-based execution:                                   │  │
│  │  1. Input processing                                      │  │
│  │  2. Game logic update                                     │  │
│  │  3. Physics simulation (fixed timestep)                   │  │
│  │  4. Network sync                                           │  │
│  │  5. Rendering (variable timestep)                         │  │
│  │                                                            │  │
│  │  Fixed timestep: 16.67ms (physics)                        │  │
│  │  Variable timestep: Rendering (uncapped)                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 2.9: Command System (1 week)                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Runtime command execution                               │  │
│  │  • Parameter parsing and validation                       │  │
│  │  • Command registry and discovery                         │  │
│  │  • Example: spawn entity 100 50 0                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 6.1: Debug Console (2 weeks)                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • In-game console with ~ key toggle                      │  │
│  │  • Command history (up/down arrows)                       │  │
│  │  • Autocomplete (Tab key)                                 │  │
│  │  • Command suggestions                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 6.2: Runtime Inspection Tools (2-3 weeks)                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Entity list viewer (search, filter)                    │  │
│  │  • Component editor (real-time modification)             │  │
│  │  • System controls (pause, step, restart)                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 6.3: Integrated Profiler (2 weeks)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Per-system timing (CPU)                                │  │
│  │  • Chrome trace export (chrome://tracing)                │  │
│  │  • GPU timing (WebGPU timestamp queries)                  │  │
│  │  • Frame time graphs                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Game Loop Pattern

```typescript
class MiskatonicEngine {
  private fixedTimestep = 1/60;  // Physics: 16.67ms
  private accumulator = 0;

  update(deltaTime: number): void {
    // 1. Input phase
    this.inputSystem.update();

    // 2. Game logic phase
    this.world.update(deltaTime);

    // 3. Physics phase (fixed timestep)
    this.accumulator += deltaTime;
    while (this.accumulator >= this.fixedTimestep) {
      this.physics.step(this.fixedTimestep);
      this.accumulator -= this.fixedTimestep;
    }

    // 4. Network sync phase
    this.network.sendUpdates();
    this.network.receiveUpdates();

    // 5. Rendering phase (variable timestep)
    this.renderer.render(this.world);
  }
}
```

---

### 9. Performance Architecture (⏳ Epics 10.1-10.5) - November 2025

**Priority:** P1 (IMPORTANT)
**Dependencies:** Epic 2.8 (Game Loop)
**Estimated Effort:** 11-16 weeks

#### Critical Discovery

**Using 12.5% of 8-core CPU.** No threading strategy, no parallel systems, no frame budgets.

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Performance Architecture                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Epic 10.1: Threading Architecture (3-4 weeks)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Web Worker architecture                                 │  │
│  │  • Worker pool management                                  │  │
│  │  • Task scheduling and distribution                       │  │
│  │  • SharedArrayBuffer for zero-copy transfer              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 10.2: Parallel System Execution (2-3 weeks)               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • System dependency analysis                              │  │
│  │  • Parallel execution groups                              │  │
│  │  • Read/write conflict detection                          │  │
│  │  • Automatic parallelization                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 10.3: Web Worker Integration (2-3 weeks, OPTIONAL)        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Offload physics to worker                               │  │
│  │  • Offload pathfinding to worker                          │  │
│  │  • Message passing optimization                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 10.4: Frame Budget System (1-2 weeks)                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Per-system frame budgets                                │  │
│  │  • Budget enforcement and warnings                        │  │
│  │  • Automatic degradation (LOD, culling)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Epic 10.5: Performance Monitoring (1-2 weeks)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Real-time FPS counter                                   │  │
│  │  • Frame time graphs (1%, 50%, 99% percentile)          │  │
│  │  • Per-subsystem timing overlay                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Multi-Core Utilization Target

**Current:** 1 core (12.5% of 8 cores)
**Target:** 6-8 cores (75-100% utilization)

**Parallel Systems Example:**
```typescript
// Systems that don't conflict can run in parallel
ParallelGroup1: [MovementSystem, AnimationSystem, ParticleSystem]
ParallelGroup2: [RenderSystem]  // Needs results from Group1
```

---

## Package Architecture

### Workspace Organization

```
miskatonic-engine/
├── packages/
│   ├── main/              ✅ Electron main process
│   ├── preload/           ✅ Security boundary
│   ├── renderer/          ✅ Game client UI
│   ├── shared/            ✅ Common types/constants
│   ├── ecs/               ✅ Entity Component System
│   ├── events/            ✅ Event bus
│   ├── resources/         ✅ Asset management
│   ├── physics/           ✅ Physics abstraction
│   ├── network/           ✅ State synchronization
│   ├── rendering/         ⏳ Rendering pipeline
│   ├── audio/             ⏳ Audio system
│   ├── input/             ⏳ Input management
│   └── animation/         ⏳ Animation system
├── tests/                 ✅ Integration tests
├── scripts/               ✅ Dev scripts
├── config/                ✅ Build configs
└── docs/                  ✅ Documentation
```

### Package Dependencies

```
                    ┌──────────┐
                    │   main   │
                    └────┬─────┘
                         │ IPC
                    ┌────┴─────┐
                    │ renderer │
                    └────┬─────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼─────┐    ┌────▼─────┐    ┌────▼─────┐
   │   ecs    │    │ rendering│    │  physics │
   └────┬─────┘    └────┬─────┘    └────┬─────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                    ┌────▼─────┐
                    │ resources│
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  events  │
                    └──────────┘
```

---

## Data Flow Architecture

### Client-Server Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                            Client                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input → Client Prediction → Render                             │
│    ↓                                                             │
│  Send to Server                                                 │
│                                                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ WebSocket/WebRTC
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                            Server                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Receive Input → Validate → Apply to Game State                │
│                                                                  │
│  Simulate Physics → Update Game Logic → Create State Batch     │
│                                                                  │
│  Apply Interest Management → Delta Compression                  │
│                                                                  │
│  Broadcast to Clients                                            │
│                                                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ State Updates
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                            Client                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Receive State → Reconcile with Prediction → Interpolate Others│
│                                                                  │
│  Update ECS Entities → Render Frame                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Physics Integration Data Flow

```
Game Loop (60 FPS)
  │
  ├─ Read Inputs
  │    └─> InputSystem
  │
  ├─ Update Game Logic
  │    └─> ECS Systems (AI, Movement, etc.)
  │
  ├─ Physics Simulation (Fixed 60 Hz)
  │    ├─> PhysicsWorld.step(deltaTime)
  │    ├─> Apply forces/impulses
  │    ├─> Resolve collisions
  │    └─> Update body transforms
  │
  ├─ Sync Physics → ECS
  │    └─> Copy body positions to ECS components
  │
  ├─ Rendering
  │    └─> Render all entities
  │
  └─ Network Sync (Server only)
       └─> Create state batch → Broadcast
```

---

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                      Security Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Electron Security                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Context isolation: ALWAYS enabled                      │  │
│  │  • Node integration: DISABLED in renderer                 │  │
│  │  • Sandboxed processes                                     │  │
│  │  • Content Security Policy (CSP)                           │  │
│  │  • WebSecurity: NEVER disabled                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Layer 2: IPC Security                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Zod schema validation                                   │  │
│  │  • Rate limiting (100 calls/sec per channel)             │  │
│  │  • Path traversal protection                               │  │
│  │  • Type-safe channels only                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Layer 3: Network Security                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • TLS 1.3 encryption                                      │  │
│  │  • JWT authentication                                       │  │
│  │  • Input validation (server-side)                         │  │
│  │  • Anti-cheat (server authoritative)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  Layer 4: Data Security                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • AES-256 encryption at rest                              │  │
│  │  • Encrypted database connections                          │  │
│  │  • Secure credential storage (OS keychain)                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Anti-Cheat Strategy

```
Client-Side Detection (Advisory Only)
  • Detects suspicious patterns
  • Reports to server
  • No local enforcement

Server-Side Validation (Authoritative)
  • Validates all inputs
  • Physics simulation server-side
  • Movement bounds checking
  • Statistical analysis (speedhacks, aimbots)
  • Replay analysis for contested matches
```

---

## Performance Architecture

### Performance Budgets (Updated November 2025)

```
Per-Frame Budget (16.67ms at 60 FPS)

┌─────────────────────────────────────────────┐
│  Component          │ Budget  │ Critical    │
├─────────────────────────────────────────────┤
│  Input Processing   │  0.5ms  │   1ms      │
│  Game Logic (ECS)   │  3.0ms  │   5ms      │
│  Physics Simulation │  2.0ms  │   4ms      │
│  Rendering (CPU)    │  3.0ms  │   5ms      │
│  Rendering (GPU)    │  5.0ms  │   8ms      │
│  Network Sync       │  1.0ms  │   2ms      │
│  Audio              │  0.5ms  │   1ms      │
│  GC Budget          │  0.0ms  │   5ms      │
│  Other/Overhead     │  1.67ms │   3ms      │
├─────────────────────────────────────────────┤
│  TOTAL              │ 16.67ms │  33ms      │
└─────────────────────────────────────────────┘

CPU Rendering Budget Breakdown (3.0ms):
  • Frustum culling:        0.5ms
  • Transform matrices:     0.5ms
  • Render queue sorting:   1.0ms
  • Draw command generation: 1.0ms

GPU Rendering Budget Breakdown (5.0ms):
  • Vertex shader:          1.0ms
  • Rasterization:          0.5ms
  • Fragment shader:        3.0ms (most expensive!)
  • Depth/blend:            0.5ms

Draw Call Budget:
  • Target:      <100 draw calls per frame
  • Critical:    <500 draw calls
  • Naive 1000 objects: 1000 calls (EXCEEDS BUDGET!)
  • With batching/instancing: <100 calls ✅

Pixel Fill Rate Budget (1920×1080 = 2M pixels):
  • 60 FPS: 120M pixels/sec
  • Fragment shader: <50-100 instructions (guideline)
  • Overdraw: Minimize via opaque front-to-back sorting

GC Budget (NEW):
  • Pause time: <5ms (leaves 11.67ms for work)
  • Per-frame allocations: <1000 objects
  • Network allocations: <50 objects/tick
  • Rendering allocations: <100 objects/frame

If any component exceeds critical threshold:
  • Warning logged
  • Metrics tracked
  • Performance degradation mode activated
  • Automatic LOD/culling adjustments (Epic 10.4)
```

### Memory Budgets

```
Total Memory Budget: 500MB (target) / 1GB (critical)

┌─────────────────────────────────────────────┐
│  Component          │ Budget  │ Critical    │
├─────────────────────────────────────────────┤
│  Engine Core        │  50MB   │  100MB     │
│  Textures           │ 200MB   │  400MB     │
│  Models/Meshes      │ 100MB   │  200MB     │
│  Audio Buffers      │  50MB   │  100MB     │
│  Physics            │  30MB   │   60MB     │
│  Network Buffers    │  10MB   │   20MB     │
│  ECS Entities       │  30MB   │   60MB     │
│  Other              │  30MB   │   60MB     │
└─────────────────────────────────────────────┘
```

### Scalability Targets

```
┌──────────────────────────────────────────────────────────┐
│  Metric                    │ Target    │ Maximum         │
├──────────────────────────────────────────────────────────┤
│  Concurrent Users/Server   │  1,000    │   5,000        │
│  Total Concurrent Users    │  100K     │   1M           │
│  Database QPS              │  10K      │   100K         │
│  Network Latency           │  <50ms    │   <150ms       │
│  State Updates/Sec         │  60       │   120          │
│  Entities per Client       │  500      │   2,000        │
│  Draw Calls per Frame      │  500      │   1,000        │
│  Triangles per Frame       │  1M       │   3M           │
└──────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

### Client Deployment (⏳ Epic 1.4)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client Distribution                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Platform Packages:                                              │
│  ├─ Windows (NSIS installer, auto-updater)                      │
│  ├─ macOS (DMG, code-signed, notarized)                         │
│  └─ Linux (AppImage, Snap, deb/rpm)                             │
│                                                                  │
│  Distribution Channels:                                          │
│  ├─ Direct download (website)                                   │
│  ├─ Steam (Epic 1.4)                                             │
│  ├─ Epic Games Store (future)                                   │
│  └─ itch.io (indie distribution)                                │
│                                                                  │
│  Update System:                                                  │
│  ├─ electron-updater                                             │
│  ├─ Delta updates (bandwidth efficient)                         │
│  ├─ Staged rollouts (5% → 25% → 100%)                          │
│  └─ Rollback on errors                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Server Deployment (⏳ Epic 8.x)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Server Infrastructure                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Container Orchestration (Kubernetes)                            │
│  ├─ Game Server Pods (autoscaling)                              │
│  ├─ Matchmaking Service                                          │
│  ├─ Social Services                                              │
│  └─ Analytics Pipeline                                           │
│                                                                  │
│  Cloud Providers:                                                │
│  ├─ AWS (primary)                                                │
│  │  ├─ EC2 (compute)                                            │
│  │  ├─ RDS (managed databases)                                 │
│  │  ├─ ElastiCache (Redis)                                     │
│  │  └─ CloudFront (CDN)                                         │
│  └─ GCP (alternative)                                            │
│                                                                  │
│  Regions:                                                        │
│  ├─ North America (us-east, us-west)                            │
│  ├─ Europe (eu-west, eu-central)                                │
│  ├─ Asia Pacific (ap-southeast, ap-northeast)                   │
│  └─ South America (sa-east)                                     │
│                                                                  │
│  Databases:                                                      │
│  ├─ MongoDB (sharded, replicated)                               │
│  ├─ Redis (clustered)                                            │
│  └─ Elasticsearch (analytics cluster)                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### CI/CD Pipeline (⏳ Epic 1.4)

```
┌─────────────────────────────────────────────────────────────────┐
│                         CI/CD Pipeline                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Code Push → GitHub                                              │
│       ↓                                                          │
│  Trigger GitHub Actions                                          │
│       ├─ Run linters (ESLint, Prettier)                         │
│       ├─ Type check (tsc --noEmit)                              │
│       ├─ Run tests (Vitest, 80% coverage required)              │
│       ├─ Run E2E tests (Playwright)                             │
│       └─ Performance benchmarks                                  │
│       ↓                                                          │
│  Build Artifacts                                                 │
│       ├─ Electron packages (Windows, macOS, Linux)              │
│       ├─ Server Docker images                                   │
│       └─ CDN assets                                              │
│       ↓                                                          │
│  Deploy Strategy                                                 │
│       ├─ Staging environment (auto-deploy)                      │
│       ├─ QA testing                                              │
│       ├─ Production (manual approval)                           │
│       └─ Rollback on errors                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Decision Records (ADRs)

### ADR-001: Archetype-Based ECS

**Status:** Accepted
**Context:** Need high-performance ECS for game engine
**Decision:** Use archetype-based storage (not sparse set)
**Rationale:**
- Better cache locality (components stored contiguously)
- Faster iteration over entities with same component set
- Trade-off: Slower structural changes (component add/remove)
- Acceptable trade-off: structural changes are rare in game loops

**Consequences:**
- ✅ Excellent iteration performance
- ✅ Cache-friendly memory layout
- ❌ Slower component add/remove operations
- ✅ Overall better for typical game workloads

### ADR-002: Physics Backend Abstraction

**Status:** Accepted
**Context:** Need flexible physics engine support
**Decision:** Create IPhysicsEngine interface with swappable backends
**Rationale:**
- Different games need different physics engines
- 3D games: Rapier, Cannon-es
- 2D games: Box2D
- Performance testing: easy to benchmark different engines

**Consequences:**
- ✅ Hot-swappable physics engines
- ✅ Easy performance comparison
- ✅ Game developers can choose best engine for their needs
- ❌ Additional abstraction overhead (minimal)

### ADR-003: Delta Compression for Networking

**Status:** Accepted
**Context:** Bandwidth optimization for multiplayer
**Decision:** Path-based delta compression with history
**Rationale:**
- Typical state synchronization wastes bandwidth
- Delta compression achieves 60-80% reduction
- Path-based approach handles nested objects elegantly

**Consequences:**
- ✅ Massive bandwidth savings
- ✅ Supports 100+ concurrent players per session
- ❌ Additional CPU cost for diffing (acceptable)
- ✅ Better player experience (lower bandwidth requirements)

### ADR-004: Server-Authoritative Multiplayer

**Status:** Accepted
**Context:** Anti-cheat and competitive integrity
**Decision:** Server validates all gameplay state
**Rationale:**
- Client-authoritative is vulnerable to cheating
- Competitive games require trust in game state
- Server authority is industry standard

**Consequences:**
- ✅ Cheat-resistant architecture
- ✅ Fair competitive gameplay
- ❌ Higher server costs
- ❌ Requires client prediction for responsiveness (Epic 5.3)

### ADR-005: Electron for Desktop Platform

**Status:** Accepted
**Context:** Cross-platform desktop game engine
**Decision:** Build on Electron framework
**Rationale:**
- Write once, run on Windows, macOS, Linux
- Access to web technologies (WebGL, WebGPU, Web Audio)
- Native OS integration (file system, menus, tray)
- Large ecosystem and tooling

**Consequences:**
- ✅ Cross-platform by default
- ✅ Fast development with web technologies
- ✅ Easy updates (auto-updater)
- ❌ Higher memory usage than native
- ❌ Larger distribution size

### ADR-006: TypeScript for Type Safety

**Status:** Accepted
**Context:** Large codebase requires type safety
**Decision:** Use TypeScript across all packages
**Rationale:**
- Catch errors at compile time
- Better IDE support and refactoring
- Improved documentation through types
- Industry standard for large projects

**Consequences:**
- ✅ Fewer runtime errors
- ✅ Better developer experience
- ✅ Self-documenting code
- ❌ Additional build step
- ✅ Overall massive productivity win

### ADR-007: Cache-Efficient ECS Refactoring (November 2025)

**Status:** Accepted (Pending Implementation)
**Context:** Current ECS implementation uses object arrays (cache-unfriendly), leaving 10x performance on table
**Decision:** Refactor Epic 2.1 to use SoA (Structure of Arrays) typed arrays

**Problem Identified:**
```typescript
// Current (Archetype.ts:33) - "Option A"
components: new Map()  // Object arrays, scattered memory

// Cache analysis shows this is 10x slower than possible
```

**Rationale:**
- **10x iteration performance**: Sequential typed arrays vs scattered objects
- **4x less memory**: 12 bytes/component vs 50 bytes/component
- **10x less GC pressure**: Typed arrays don't create GC pressure
- **Cache efficiency**: Spatial locality (same archetype) + temporal locality (sequential access)
- **Industry standard**: All high-performance ECS implementations use SoA

**Decision Details:**
- Epic 2.10: Benchmark and validate 10x prediction (1-2 weeks)
- Epic 2.11: Refactor to SoA typed arrays (3-4 weeks)
- Epic 2.12: Document cache-aware patterns (1 week)

**New Architecture:**
```typescript
class ComponentStorage<T> {
  private arrays: Map<keyof T, TypedArray>  // SoA, sequential

  get(index: number, field: keyof T): number {
    return this.arrays.get(field)[index];  // Cache-friendly
  }
}
```

**Consequences:**
- ✅ 10x faster component iteration (10k/ms → 100k/ms)
- ✅ 4x less memory per component
- ✅ 10x less GC pressure
- ✅ Cache-friendly memory access patterns
- ❌ Breaking API changes (mitigated with migration guide)
- ❌ 5-7 weeks refactoring effort
- ✅ **Overall: Worth the effort for 10x performance gain**

**Migration Strategy:**
1. Run Epic 2.10 benchmarks to validate predictions
2. Design backward-compatible API if possible
3. Incremental refactoring with continuous testing
4. Maintain all 65 passing tests
5. Provide migration guide for affected code

**Validation Criteria:**
- Benchmark shows 10x improvement (sequential vs random)
- Benchmark shows 10x improvement (new vs old implementation)
- All 65 tests passing
- Production test: 60 FPS with 10k+ entities

---

## Glossary

### Core Concepts
**ECS** - Entity Component System: Data-oriented architecture pattern
**Archetype** - Group of entities with the same component set
**SoA** - Structure of Arrays: Data layout for cache efficiency (e.g., separate x[], y[], z[] arrays)
**AoS** - Array of Structures: Traditional object array layout (e.g., {x, y, z}[])
**Cache Line** - 64 bytes of memory loaded together (spatial locality)
**Spatial Locality** - Accessing nearby memory addresses (cache-friendly)
**Temporal Locality** - Accessing same memory repeatedly (cache-friendly)

### Electron & IPC
**IPC** - Inter-Process Communication: Communication between Electron main and renderer
**Context Isolation** - Security boundary between main and renderer processes
**Preload Script** - Security layer that exposes safe APIs to renderer

### Networking
**Delta Compression** - Send only changed data, not full state
**Interest Management** - Filter entities by relevance to reduce network traffic
**Client Prediction** - Simulate locally for responsive controls
**Server Reconciliation** - Correct client state when server disagrees
**Tick Rate** - Server update frequency (e.g., 60Hz = 60 updates/sec)

### Rendering
**WebGPU** - Modern graphics API for web
**PBR** - Physically Based Rendering: Realistic material lighting model
**LOD** - Level of Detail: Reduce detail based on distance
**Draw Call** - Command to GPU to render objects
**Batching** - Combining multiple objects into single draw call
**Instancing** - Rendering N copies of object in single draw call
**Shader** - GPU program (vertex shader, fragment shader)
**WGSL** - WebGPU Shading Language

### Physics
**CCD** - Continuous Collision Detection: Prevent tunneling at high speeds
**Deterministic** - Same inputs always produce same outputs (required for physics replay)
**Rapier** - Rust-based physics engine (default for Miskatonic)
**Fixed Timestep** - Physics simulation runs at constant rate (e.g., 60Hz)

### Memory Management
**GC** - Garbage Collection: Automatic memory cleanup (can cause pauses)
**Object Pool** - Reusable object cache to reduce allocations
**Frame Allocator** - Per-frame temporary memory (cleared each frame)
**VRAM** - Video RAM: GPU memory for textures, buffers, etc.
**Typed Array** - Fixed-type array (e.g., Float32Array) with no GC pressure

### Performance
**Frame Budget** - Time allowed per frame (16.67ms at 60 FPS)
**Profiling** - Measuring performance to find bottlenecks
**Worker** - Background thread (Web Worker in browser)
**Parallel Systems** - ECS systems running simultaneously

### Backend & Infrastructure
**NestJS** - Node.js framework for building server applications
**Zod** - TypeScript-first schema validation library
**V8** - JavaScript engine (in Chrome, Node.js, Electron)

---

**Document Status:** Living Document - Updated as architecture evolves
**Last Updated:** November 2025 (Major Update: 21 new epics added)
**Version:** 3.0 (reflects November 2025 architecture analyses)
**Next Review:** After Epic 2.10-2.11 (Cache-Efficient ECS Refactoring) completion

---

## November 2025 Update Summary

This document was significantly updated in November 2025 based on three critical architecture analyses:

1. **Integration Architecture Analysis** → 13 new epics (2.7-2.9, 6.1-6.3, 10.1-10.5)
2. **Cache Architecture Analysis** → 3 new epics (2.10-2.12)
3. **Memory Management Analysis** → 5 new epics (2.13-2.15, 3.8, 5.6)

**Total:** 21 new epics added across 4 initiatives (INIT-002, INIT-003, INIT-005, INIT-006, INIT-010)

**Critical Findings:**
- Epic 2.1 (ECS Core) NOT cache-optimized - **10x performance improvement available**
- No integration layer (main engine class, game loop, debug tools)
- No memory management strategy (GC mitigation, frame allocators, GPU/VRAM)
- Rendering massively underestimated (10 epics needed, not 2)

**New Total Epic Count:** 70+ epics (was 50+)

**Priority Changes:**
- Epic 2.1 status: ✅ Complete → ⚠️ **NEEDS REFACTORING**
- Epic 6.1 priority: P2 → **P0 CRITICAL** (Debug Console essential for development)
- Epic 10.1-10.5 priority: Undefined → **P1 IMPORTANT** (Performance architecture)

**See Also:**
- `/planning/COMPREHENSIVE_ANALYSIS_SUMMARY_NOVEMBER_2025.md` - Full analysis summary
- `/planning/CACHE_EPIC_UPDATES_NOVEMBER_2025.md` - Cache optimization details
- `/planning/RENDERING_EPIC_UPDATES_NOVEMBER_2025.md` - Rendering architecture details
- `/planning/initiatives/INIT-002-Core-Engine-Systems.md` - Updated with Epics 2.7-2.15
- `/planning/initiatives/INIT-003-Rendering-Graphics.md` - Updated with Epics 3.8-3.14
- `/planning/initiatives/INIT-005-Networking-Multiplayer.md` - Updated with Epic 5.6
- `/planning/initiatives/INIT-006-Development-Tools.md` - Updated with Epics 6.1-6.3
- `/planning/initiatives/INIT-010-Performance-Optimization.md` - Updated with Epics 10.1-10.5
