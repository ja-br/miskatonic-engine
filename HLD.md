# High-Level Design Document: Miskatonic Engine

**Version:** 4.0
**Date:** November 2025
**Status:** Living Document
**Classification:** Technical Architecture Document

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Core Subsystems Design](#core-subsystems-design)
4. [Engine Integration Layer](#engine-integration-layer)
5. [System Integration Points](#system-integration-points)
6. [Data Flow Architecture](#data-flow-architecture)
7. [Security Architecture](#security-architecture)
8. [Performance Architecture](#performance-architecture)
9. [Development Tools & Debugging](#development-tools--debugging)
10. [Threading & Concurrency](#threading--concurrency)
11. [Deployment & Operations](#deployment--operations)
12. [Architecture Decision Records](#architecture-decision-records)
13. [Glossary](#glossary)

---

## Executive Summary

Miskatonic Engine is a comprehensive desktop game engine built on Electron, designed to enable developers to create high-quality 3D games with sophisticated multiplayer capabilities. This High-Level Design document outlines the technical architecture, core subsystems, and integration patterns that form the foundation of the engine.

### Key Architectural Principles
- **Electron-Native Architecture**: Desktop-first design leveraging both web technologies and native OS capabilities
- **Entity Component System (ECS)**: Data-oriented architecture for performance and flexibility
- **Server-Authoritative Multiplayer**: Built-in support for competitive multiplayer gaming
- **Hot-Swappable Systems**: Modular design allowing developers to swap physics engines, renderers, and network transports
- **Performance-Budgeted**: Each subsystem operates within strict performance constraints

### Document Purpose
This document serves as the primary technical reference for:
- Engineering teams implementing the engine
- Game developers understanding the architecture
- System architects planning integrations
- DevOps teams planning deployments

---

## System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Application (Electron)                │
├─────────────────────────────────────────────────────────────────────┤
│  Main Process                    │  Renderer Process                 │
│  ├─ Window Management            │  ├─ Game Engine Core             │
│  ├─ Native File System           │  │  ├─ ECS Framework            │
│  ├─ System Integration           │  │  ├─ Rendering Pipeline       │
│  ├─ Auto-Updater                 │  │  ├─ Physics Simulation       │
│  └─ IPC Controller               │  │  ├─ Audio System             │
│                                  │  │  └─ Input Management         │
│                                  │  ├─ Game Logic                  │
│                                  │  └─ Network Client              │
├─────────────────────────────────────────────────────────────────────┤
│                         Network Layer                                │
│  ├─ WebSocket (Socket.io)                                           │
│  ├─ WebRTC (P2P)                                                    │
│  └─ Custom Protocols (miskatonic://)                                │
├─────────────────────────────────────────────────────────────────────┤
│                         Game Server (Cloud/On-Premise)               │
│  ├─ NestJS Application Framework                                     │
│  ├─ Game State Management                                            │
│  ├─ Matchmaking Service                                              │
│  ├─ Social Systems                                                   │
│  └─ Analytics Pipeline                                               │
├─────────────────────────────────────────────────────────────────────┤
│                         Data Layer                                   │
│  ├─ MongoDB (Document Store)                                         │
│  ├─ Redis (Cache & Sessions)                                         │
│  ├─ Elasticsearch (Analytics)                                        │
│  └─ CDN (Asset Distribution)                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                     Miskatonic Engine Core                     │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  ECS Core    │  │  Rendering   │  │   Physics    │       │
│  │              │  │   Engine     │  │   Engine     │       │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤       │
│  │ • Entities   │  │ • WebGL2     │  │ • Rapier     │       │
│  │ • Components │  │ • WebGPU     │  │ • Cannon-es  │       │
│  │ • Systems    │  │ • PBR        │  │ • Box2D      │       │
│  │ • Queries    │  │ • LOD        │  │ • Collision  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Networking  │  │    Audio     │  │    Input     │       │
│  │              │  │              │  │              │       │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤       │
│  │ • Socket.io  │  │ • Web Audio  │  │ • Keyboard   │       │
│  │ • WebRTC     │  │ • Spatial    │  │ • Mouse      │       │
│  │ • State Sync │  │ • Effects    │  │ • Gamepad    │       │
│  │ • Prediction │  │ • Music      │  │ • Touch      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    Asset     │  │  Development │  │   Platform   │       │
│  │  Management  │  │    Tools     │  │ Integration  │       │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤       │
│  │ • Pipeline   │  │ • Editor     │  │ • Electron   │       │
│  │ • Streaming  │  │ • Debugger   │  │ • Steam      │       │
│  │ • Caching    │  │ • Profiler   │  │ • Discord    │       │
│  │ • Hot-reload │  │ • Inspector  │  │ • Twitch     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

### 1.3 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Desktop Framework** | Electron 25+ | Cross-platform desktop application |
| **Language** | TypeScript 5.0+ | Type-safe development |
| **Graphics** | WebGL2, WebGPU | 3D rendering |
| **Build System** | Vite, Webpack 5 | Module bundling and HMR |
| **Process Management** | Node.js 18+ | Main process runtime |
| **Server Framework** | NestJS | Backend services |
| **Networking** | Socket.io, WebRTC | Real-time communication |
| **Databases** | MongoDB, Redis, Elasticsearch | Data persistence |
| **Container** | Docker, Kubernetes | Deployment orchestration |
| **Cloud** | AWS/GCP | Infrastructure |

### 1.4 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Production Environment                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────┐  ┌────────────────────────┐   │
│  │   Load Balancer (ALB)   │  │     CDN (CloudFlare)    │   │
│  └───────────┬────────────┘  └────────────┬───────────┘   │
│              │                              │                │
│  ┌───────────▼────────────────────────────▼───────────┐   │
│  │           API Gateway (Kong/AWS API Gateway)         │   │
│  └───────────┬─────────────────────────────────────────┘   │
│              │                                              │
│  ┌───────────▼────────────┐                                │
│  │   Kubernetes Cluster    │                                │
│  ├────────────────────────┤                                │
│  │  ┌──────────────────┐  │  ┌──────────────────┐        │
│  │  │  Game Servers    │  │  │ Matchmaking Svc  │        │
│  │  │  (Pods)          │  │  │  (Pods)          │        │
│  │  └──────────────────┘  │  └──────────────────┘        │
│  │  ┌──────────────────┐  │  ┌──────────────────┐        │
│  │  │  Social Services │  │  │  Analytics Svc   │        │
│  │  │  (Pods)          │  │  │  (Pods)          │        │
│  │  └──────────────────┘  │  └──────────────────┘        │
│  └────────────────────────┘                                │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │                 Database Cluster                     │   │
│  ├────────────────────────────────────────────────────┤   │
│  │  MongoDB     │  Redis      │  Elasticsearch         │   │
│  │  (Replica    │  (Cluster)  │  (Cluster)             │   │
│  │   Sets)      │             │                        │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Subsystems Design

### 2.1 Entity Component System (ECS)

#### 2.1.1 Architecture

```
┌───────────────────────────────────────────────────────────┐
│                      ECS Framework                         │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  Entity Manager                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │  • Entity Creation/Destruction                    │    │
│  │  • Entity ID Generation (uint32)                  │    │
│  │  • Entity Recycling Pool                          │    │
│  │  • Entity Version Tracking                        │    │
│  └──────────────────────────────────────────────────┘    │
│                           │                                │
│  Component Storage        ▼                                │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Archetype Storage                                │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐  │    │
│  │  │ Archetype A│ │ Archetype B│ │ Archetype C│  │    │
│  │  │[T,P,R]     │ │[T,P,H]     │ │[T,R,H,A]   │  │    │
│  │  └────────────┘ └────────────┘ └────────────┘  │    │
│  │  T=Transform, P=Physics, R=Render, H=Health     │    │
│  └──────────────────────────────────────────────────┘    │
│                           │                                │
│  System Executor          ▼                                │
│  ┌──────────────────────────────────────────────────┐    │
│  │  System Pipeline (Ordered Execution)              │    │
│  │  1. Input System                                  │    │
│  │  2. Physics System                                │    │
│  │  3. Game Logic Systems                            │    │
│  │  4. Animation System                              │    │
│  │  5. Rendering System                              │    │
│  └──────────────────────────────────────────────────┘    │
│                           │                                │
│  Query Engine             ▼                                │
│  ┌──────────────────────────────────────────────────┐    │
│  │  • Query Caching                                  │    │
│  │  • Archetype Iteration                            │    │
│  │  • Component Filters                              │    │
│  │  • Change Detection                               │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

#### 2.1.2 Component Model

```typescript
// Component Definition
interface Component {
  readonly id: ComponentId;
  readonly size: number;
  readonly networked?: boolean;
}

// Entity Definition
type Entity = number & { __brand: 'Entity' };

// System Definition
abstract class System {
  abstract readonly query: Query;
  abstract update(deltaTime: number): void;
}

// Query Definition
class Query {
  static all(...components: ComponentType[]): Query;
  static any(...components: ComponentType[]): Query;
  static not(...components: ComponentType[]): Query;
}
```

#### 2.1.3 Performance Characteristics

| Operation | Complexity | Target Time |
|-----------|------------|-------------|
| Entity Creation | O(1) | < 0.001ms |
| Component Add/Remove | O(1) amortized | < 0.01ms |
| Query Iteration | O(n) | < 0.1ms per 1000 entities |
| System Update | O(n) | < 1ms total |
| Archetype Move | O(c) | < 0.1ms |

#### 2.1.4 Component Storage Strategy

**Storage Architecture: Structure of Arrays (SoA)**

Miskatonic Engine uses **Structure of Arrays (SoA)** backed by **typed arrays** for component storage. This architecture is specifically designed for CPU cache efficiency.

**Why Cache Efficiency Matters:**

Modern CPUs load memory in 64-byte cache lines. Sequential access patterns can be 10-100x faster than random access due to cache locality. ECS architecture exists primarily to exploit this cache behavior.

**Cache Principles:**
- **Spatial Locality**: Related data stored physically close in memory
- **Temporal Locality**: Recently accessed data likely to be accessed again soon
- **Sequential Access**: Iterating contiguously loaded data maximizes cache line utilization
- **Small Structures**: Components <64 bytes fit more efficiently in cache lines

**SoA Storage Layout:**

```typescript
// Structure of Arrays (SoA) - Cache-Friendly
class PositionStorage {
  // All X values contiguous in memory
  x: Float32Array;  // [x0, x1, x2, x3, x4, ...]
  y: Float32Array;  // [y0, y1, y2, y3, y4, ...]
  z: Float32Array;  // [z0, z1, z2, z3, z4, ...]

  constructor(capacity: number) {
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
  }
}

// Archetype contains multiple component storages
class Archetype {
  entityIds: Uint32Array;
  entityCount: number;

  // Component storages (SoA)
  positions?: PositionStorage;
  velocities?: VelocityStorage;
  healths?: HealthStorage;

  // Sequential iteration is cache-friendly
  iterate<T>(component: ComponentStorage<T>, callback: (index: number) => void) {
    for (let i = 0; i < this.entityCount; i++) {
      callback(i);
    }
  }
}
```

**Cache Benefits:**

```typescript
// Sequential access: Loading positions.x[0] brings x[1-7] into cache
// Cache line: 64 bytes / 4 bytes per Float32 = 16 values per cache line
for (let i = 0; i < count; i++) {
  positions.x[i] += velocities.x[i] * dt;  // Next 15 accesses are cache hits
}

// Performance: L1 cache hit = 0.5ns, RAM access = 100ns
// Speedup: 200x for cached accesses
```

**Why NOT Array of Structures (AoS):**

```typescript
// Array of Structures (AoS) - Cache-Unfriendly (NOT USED)
interface Position { x: number; y: number; z: number; }
const positions: Position[] = [];

// Problems:
// 1. Objects potentially scattered in memory (poor spatial locality)
// 2. Pointer chasing (object reference → actual data)
// 3. GC pressure (many small object allocations)
// 4. Unpredictable memory layout (V8 decides)
// 5. ~10x slower than typed arrays (benchmarked)
```

**Component Storage API:**

```typescript
// Component registration
interface ComponentType<T> {
  id: ComponentId;
  size: number;
  create: (capacity: number) => ComponentStorage<T>;
}

// Storage interface
interface ComponentStorage<T> {
  capacity: number;
  count: number;

  // SoA-backed accessors
  get(index: number): T;
  set(index: number, value: T): void;

  // Direct typed array access for hot loops
  getRaw(field: keyof T): TypedArray;

  // Growth management
  grow(newCapacity: number): void;
}
```

**Performance Validation:**

| Metric | Target | Validation Method |
|--------|--------|-------------------|
| Sequential vs Random | 10x difference | Benchmark (performance.now) |
| Component Iteration | >100k/ms | Frame profiler |
| GC Pressure | <100 objects/frame | Chrome DevTools |
| Cache Friendliness | Sequential 10x faster | A/B benchmark |

#### 2.1.5 Cache-Aware Iteration Patterns

**Mandatory Pattern: Sequential Archetype Iteration**

All systems MUST iterate sequentially over archetypes to maintain cache efficiency. Random entity access destroys cache performance.

**GOOD: Sequential Iteration (Cache-Friendly)**

```typescript
class MovementSystem extends System {
  query = Query.all(Position, Velocity);

  update(dt: number) {
    // Iterate over matching archetypes
    for (const archetype of this.matchingArchetypes) {
      const positions = archetype.getComponent(Position);
      const velocities = archetype.getComponent(Velocity);

      // Sequential access within archetype (cache-friendly)
      for (let i = 0; i < archetype.entityCount; i++) {
        positions.x[i] += velocities.x[i] * dt;
        positions.y[i] += velocities.y[i] * dt;
        positions.z[i] += velocities.z[i] * dt;
      }
    }
  }
}
```

**Cache Benefits:**
- Sequential access pattern
- Predictable memory access (CPU prefetcher helps)
- Maximum cache line utilization
- Related data processed together (x, y, z)

**BAD: Random Entity Access (Cache-Unfriendly - AVOID)**

```typescript
// ANTI-PATTERN: Do not implement systems like this
class MovementSystem {
  update(dt: number) {
    for (const entityId of this.entities) {
      // Random lookup - cache miss likely
      const entity = world.getEntity(entityId);

      // Pointer chasing - more cache misses
      entity.position.add(entity.velocity);
    }
  }
}

// Problems:
// 1. Random access pattern (cache misses)
// 2. Unpredictable memory jumps
// 3. 10-100x slower than sequential
```

**Loop Ordering Guidelines:**

```typescript
// GOOD: Process entire archetype before moving to next
for (const archetype of archetypes) {
  // Complete all work for this archetype
  processArchetype(archetype);
}

// GOOD: Related operations in same loop
for (let i = 0; i < count; i++) {
  positions.x[i] += velocities.x[i] * dt;
  positions.y[i] += velocities.y[i] * dt;
  positions.z[i] += velocities.z[i] * dt;
}

// BAD: Separate loops for related data
for (let i = 0; i < count; i++) {
  positions.x[i] += velocities.x[i] * dt;
}
for (let i = 0; i < count; i++) {  // Re-loading same indices
  positions.y[i] += velocities.y[i] * dt;
}
```

**Access Pattern Rules:**

1. **Sequential First**: Default to sequential iteration
2. **Random Only When Necessary**: Justify all random access
3. **Batch Processing**: Complete archetype before switching
4. **Minimize Archetype Switches**: Reduce cache thrashing
5. **Hot Data First**: Process frequently accessed components early

**Query Result Caching:**

```typescript
class System {
  private cachedArchetypes: Archetype[] = [];
  private cacheVersion: number = 0;

  update(dt: number) {
    // Reuse archetype list (temporal locality)
    if (this.cacheVersion !== world.archetypeVersion) {
      this.cachedArchetypes = world.query(this.query);
      this.cacheVersion = world.archetypeVersion;
    }

    // Iterate cached results
    for (const archetype of this.cachedArchetypes) {
      this.processArchetype(archetype, dt);
    }
  }
}
```

#### 2.1.6 Component Design Guidelines

**Component Size Guidelines:**

Components should be **small and focused** to maximize cache efficiency. Target <64 bytes as a mental model (64-byte cache line).

**GOOD: Small, Focused Components**

```typescript
// Position: 12 bytes (3 × Float32)
interface Position {
  x: number;  // 4 bytes
  y: number;  // 4 bytes
  z: number;  // 4 bytes
}

// Velocity: 12 bytes
interface Velocity {
  x: number;
  y: number;
  z: number;
}

// Health: 4 bytes
interface Health {
  value: number;  // 4 bytes
}

// Benefits:
// - ~5 positions fit in 64-byte cache line
// - Clear separation of concerns
// - Optimal cache utilization
```

**BAD: Large, Unfocused Components**

```typescript
// Character: 80+ bytes (AVOID)
interface Character {
  // Position data
  x: number;           // 8 bytes
  y: number;           // 8 bytes
  z: number;           // 8 bytes

  // Velocity data
  vx: number;          // 8 bytes
  vy: number;          // 8 bytes
  vz: number;          // 8 bytes

  // Gameplay data
  health: number;      // 8 bytes
  mana: number;        // 8 bytes
  level: number;       // 8 bytes
  experience: number;  // 8 bytes
  // Total: 80 bytes - spans multiple cache lines
}

// Problems:
// - Loading position also loads health (wasted cache)
// - Movement system loads all data just to access x, y, z
// - Poor cache line utilization
// - Hot data (position) mixed with cold data (experience)
```

**Design Rules:**

1. **Single Responsibility**: One component = one concern
2. **Size Target**: <64 bytes preferred
3. **Split Large Components**: Break into multiple small components
4. **Hot/Cold Separation**: Frequently accessed data separate from rare data
5. **Use Float32 When Possible**: 4 bytes vs 8 bytes for number (Float64)

**Component Splitting Example:**

```typescript
// Instead of large Character component, use:

// Hot data (every frame)
Position { x, y, z }              // 12 bytes
Velocity { x, y, z }              // 12 bytes
Renderable { mesh, material }     // 8 bytes

// Warm data (frequent)
Health { current, max }           // 8 bytes
Stamina { current, max }          // 8 bytes

// Cold data (infrequent)
Inventory { items[] }             // Variable
QuestProgress { quests[] }        // Variable
Statistics { level, exp, stats }  // Variable

// Systems only load what they need:
// - MovementSystem: Position + Velocity (24 bytes)
// - RenderSystem: Position + Renderable (20 bytes)
// - CombatSystem: Health + Stamina (16 bytes)
```

**Type Selection for Cache Efficiency:**

```typescript
// Prefer Float32 over Float64 when precision allows
class PositionStorage {
  x: Float32Array;  // 4 bytes each - 16 per cache line
  y: Float32Array;
  z: Float32Array;
}

// Use appropriate integer types
class EntityStorage {
  ids: Uint32Array;       // 4 bytes - enough for 4 billion entities
  flags: Uint8Array;      // 1 byte - boolean flags
  archetypeIds: Uint16Array;  // 2 bytes - up to 65k archetypes
}

// Memory savings example:
// 10,000 entities with Position
// Float64: 10,000 × 3 × 8 = 240 KB
// Float32: 10,000 × 3 × 4 = 120 KB
// Savings: 50% memory, better cache utilization
```

**Archetype Organization Strategy:**

Archetypes are created based on component combinations, with consideration for access patterns:

```typescript
// Common archetypes organized by access frequency

// HOT: Every frame, high entity count
Archetype: [Position, Velocity, Renderable]
Example: Moving visible objects (most game entities)

// WARM: Frequent, moderate entity count
Archetype: [Position, Velocity, Health, AI]
Example: NPCs and enemies

// COLD: Infrequent, low entity count
Archetype: [Position, Inventory, QuestProgress]
Example: Interactive objects

// Spatial locality maintained within each archetype
// Systems benefit from processing similar entities together
```

### 2.2 Rendering Pipeline

#### 2.2.1 Pipeline Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Rendering Pipeline                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Scene Graph                                            │
│  ┌────────────────────────────────────────────────┐    │
│  │  Root                                           │    │
│  │   ├─ Static Geometry                            │    │
│  │   ├─ Dynamic Objects                            │    │
│  │   ├─ Lights                                     │    │
│  │   └─ Cameras                                    │    │
│  └────────────────────────────────────────────────┘    │
│                         │                               │
│  Culling Stage          ▼                               │
│  ┌────────────────────────────────────────────────┐    │
│  │  1. Frustum Culling                            │    │
│  │  2. Occlusion Culling (optional)               │    │
│  │  3. LOD Selection                              │    │
│  │  4. Batch Generation                           │    │
│  └────────────────────────────────────────────────┘    │
│                         │                               │
│  Command Generation     ▼                               │
│  ┌────────────────────────────────────────────────┐    │
│  │  Render Queue                                  │    │
│  │  ├─ Opaque Pass                                │    │
│  │  ├─ Transparent Pass                           │    │
│  │  ├─ Shadow Pass                                │    │
│  │  └─ Post-Process Pass                          │    │
│  └────────────────────────────────────────────────┘    │
│                         │                               │
│  GPU Execution          ▼                               │
│  ┌────────────────────────────────────────────────┐    │
│  │  WebGL2 / WebGPU Backend                       │    │
│  │  ├─ State Management                           │    │
│  │  ├─ Buffer Management                          │    │
│  │  ├─ Shader Programs                            │    │
│  │  └─ Draw Calls                                 │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### 2.2.2 Rendering Features

| Feature | Description | Performance Target |
|---------|-------------|-------------------|
| **PBR Materials** | Physically Based Rendering | 60 FPS with 100+ materials |
| **Instanced Rendering** | GPU instancing for repeated objects | 10,000+ instances |
| **Shadow Mapping** | Cascaded shadow maps | 4 cascades, 2048x2048 |
| **Post-Processing** | Screen-space effects | < 2ms total |
| **LOD System** | Automatic level-of-detail | 3-5 LOD levels |
| **Culling** | Frustum + Occlusion | < 0.5ms |

#### 2.2.3 Shader System

```
┌──────────────────────────────────────────┐
│          Shader Pipeline                  │
├──────────────────────────────────────────┤
│                                           │
│  Shader Graph Editor                      │
│  ┌─────────────────────────────────┐     │
│  │  Node-based visual editor       │     │
│  │  Real-time preview              │     │
│  │  Hot-reload support             │     │
│  └──────────┬──────────────────────┘     │
│             │                             │
│             ▼                             │
│  Shader Compiler                          │
│  ┌─────────────────────────────────┐     │
│  │  GLSL ES 3.0 / WGSL            │     │
│  │  Optimization passes            │     │
│  │  Cross-compilation              │     │
│  └──────────┬──────────────────────┘     │
│             │                             │
│             ▼                             │
│  Shader Cache                             │
│  ┌─────────────────────────────────┐     │
│  │  Compiled programs              │     │
│  │  Uniform buffers                │     │
│  │  Pipeline states                │     │
│  └─────────────────────────────────┘     │
│                                           │
└──────────────────────────────────────────┘
```

### 2.3 Physics System

#### 2.3.1 Physics Architecture

```
┌────────────────────────────────────────────────┐
│              Physics System                     │
├────────────────────────────────────────────────┤
│                                                 │
│  Physics Engine Interface                       │
│  ┌──────────────────────────────────────┐     │
│  │  Abstract Physics API                 │     │
│  │  • createBody()                       │     │
│  │  • step()                             │     │
│  │  • raycast()                          │     │
│  │  • queryRegion()                      │     │
│  └──────────┬───────────────────────────┘     │
│             │                                   │
│      ┌──────┴──────┬──────────┬──────────┐    │
│      ▼             ▼          ▼           ▼    │
│  ┌────────┐ ┌──────────┐ ┌────────┐          │
│  │ Rapier │ │Cannon-es │ │ Box2D  │          │
│  │ (WASM) │ │   (JS)   │ │ (WASM) │          │
│  └────────┘ └──────────┘ └────────┘          │
│                                                 │
│  Collision Detection                            │
│  ┌──────────────────────────────────────┐     │
│  │  Broad Phase                         │     │
│  │  • Spatial Hashing                   │     │
│  │  • Sweep and Prune                   │     │
│  │  • BVH Trees                         │     │
│  └──────────────────────────────────────┘     │
│  ┌──────────────────────────────────────┐     │
│  │  Narrow Phase                        │     │
│  │  • GJK Algorithm                     │     │
│  │  • EPA Algorithm                     │     │
│  │  • Continuous Collision              │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Constraint Solver                              │
│  ┌──────────────────────────────────────┐     │
│  │  • Position Constraints              │     │
│  │  • Velocity Constraints              │     │
│  │  • Joint Constraints                 │     │
│  │  • Contact Constraints               │     │
│  └──────────────────────────────────────┘     │
│                                                 │
└────────────────────────────────────────────────┘
```

#### 2.3.2 Deterministic Simulation

| Requirement | Implementation | Validation |
|-------------|---------------|------------|
| **Fixed Timestep** | 60Hz (16.67ms) | Frame-independent |
| **Deterministic Math** | Fixed-point for critical paths | Bit-identical results |
| **State Serialization** | Binary format | Checksums for validation |
| **Replay System** | Input recording | Frame-perfect replay |

### 2.4 Networking System

#### 2.4.1 Network Architecture

```
┌─────────────────────────────────────────────────┐
│            Networking System                     │
├─────────────────────────────────────────────────┤
│                                                  │
│  Client-Side Networking                          │
│  ┌───────────────────────────────────────┐     │
│  │  Connection Manager                    │     │
│  │  • WebSocket Connection                │     │
│  │  • WebRTC Peer Connections             │     │
│  │  • Reconnection Logic                  │     │
│  └───────────────────────────────────────┘     │
│                                                  │
│  ┌───────────────────────────────────────┐     │
│  │  Client Prediction                     │     │
│  │  • Input Buffer                        │     │
│  │  • State Prediction                    │     │
│  │  • Reconciliation                      │     │
│  └───────────────────────────────────────┘     │
│                                                  │
│  ┌───────────────────────────────────────┐     │
│  │  Interpolation Buffer                  │     │
│  │  • Remote Entity States                │     │
│  │  • Smooth Movement                     │     │
│  │  • Lag Compensation                    │     │
│  └───────────────────────────────────────┘     │
│                                                  │
│  Server-Side Networking                          │
│  ┌───────────────────────────────────────┐     │
│  │  Session Manager                       │     │
│  │  • Player Sessions                     │     │
│  │  • Room Management                     │     │
│  │  • State Broadcasting                  │     │
│  └───────────────────────────────────────┘     │
│                                                  │
│  ┌───────────────────────────────────────┐     │
│  │  State Synchronization                 │     │
│  │  • Delta Compression                   │     │
│  │  • Priority System                     │     │
│  │  • Interest Management                 │     │
│  └───────────────────────────────────────┘     │
│                                                  │
│  ┌───────────────────────────────────────┐     │
│  │  Anti-Cheat System                     │     │
│  │  • Input Validation                    │     │
│  │  • State Verification                  │     │
│  │  • Statistical Analysis                │     │
│  └───────────────────────────────────────┘     │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### 2.4.2 State Synchronization Protocol

```
Client → Server:
{
  type: "input",
  sequence: 12345,
  timestamp: 1699999999,
  inputs: [
    { key: "forward", state: "pressed" },
    { key: "mouse", x: 123, y: 456 }
  ]
}

Server → Client:
{
  type: "state",
  sequence: 12345,
  timestamp: 1699999999,
  entities: [
    {
      id: 1,
      components: {
        transform: { x: 10, y: 20, z: 30 },
        velocity: { x: 1, y: 0, z: 0 }
      }
    }
  ],
  lastProcessedInput: 12344
}
```

### 2.5 Asset Management System

#### 2.5.1 Asset Pipeline

```
┌──────────────────────────────────────────────┐
│          Asset Management System              │
├──────────────────────────────────────────────┤
│                                               │
│  Asset Import Pipeline                        │
│  ┌─────────────────────────────────────┐    │
│  │  Source Assets                       │    │
│  │  • Textures (.png, .jpg, .exr)      │    │
│  │  • Models (.fbx, .obj, .gltf)       │    │
│  │  • Audio (.wav, .mp3, .ogg)         │    │
│  │  • Shaders (.glsl, .wgsl)           │    │
│  └──────────┬──────────────────────────┘    │
│             │                                 │
│             ▼                                 │
│  Asset Processing                             │
│  ┌─────────────────────────────────────┐    │
│  │  • Texture Compression (KTX2)       │    │
│  │  • Mesh Optimization                │    │
│  │  • Audio Normalization              │    │
│  │  • Mipmap Generation                │    │
│  │  • Atlas Packing                    │    │
│  └──────────┬──────────────────────────┘    │
│             │                                 │
│             ▼                                 │
│  Asset Storage                                │
│  ┌─────────────────────────────────────┐    │
│  │  Local Cache                        │    │
│  │  • Electron App Data                │    │
│  │  • Version Control                  │    │
│  │  • Content Addressing               │    │
│  └─────────────────────────────────────┘    │
│                                               │
│  Runtime Asset Loading                        │
│  ┌─────────────────────────────────────┐    │
│  │  • Priority Queue                   │    │
│  │  • Streaming                        │    │
│  │  • Reference Counting               │    │
│  │  • Hot Reload                       │    │
│  └─────────────────────────────────────┘    │
│                                               │
└──────────────────────────────────────────────┘
```

#### 2.5.2 Asset Loading Strategy

| Priority Level | Assets | Loading Time | Memory Budget |
|---------------|---------|--------------|---------------|
| **Critical** | Core UI, Loading Screen | < 500ms | 50MB |
| **High** | Player Models, Essential Textures | < 2s | 200MB |
| **Medium** | Environment, NPCs | < 5s | 300MB |
| **Low** | Distant LODs, Optional Content | Background | 150MB |

---

## Engine Integration Layer

### 4.1 Main Engine Class (MiskatonicEngine)

**Critical Gap Addressed**: Individual systems (ECS, Physics, Network) exist but have no coordination layer.

#### 4.1.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MiskatonicEngine                          │
│                   (Central Coordinator)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Initialization & Lifecycle                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • async create(config)                             │   │
│  │  • async initialize()                               │   │
│  │  • start() / stop() / pause() / resume()           │   │
│  │  • async shutdown()                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│  System Access            ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  get world(): World           // ECS                │   │
│  │  get events(): EventBus       // Events            │   │
│  │  get resources(): ResourceMgr // Assets            │   │
│  │  get physics(): PhysicsWorld  // Physics           │   │
│  │  get network(): StateReplication // Network        │   │
│  │  get renderer(): IRenderer    // Rendering         │   │
│  │  get input(): InputManager    // Input             │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│  Configuration            ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • EngineConfig (targetFPS, physics, rendering)    │   │
│  │  • updateConfig(partial)                            │   │
│  │  • getConfig(): Readonly<EngineConfig>             │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│  Debug & Profiling        ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  get console(): DebugConsole                        │   │
│  │  get profiler(): Profiler                           │   │
│  │  get currentFrame(): number                         │   │
│  │  get fps(): number                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 4.1.2 Configuration Schema

```typescript
interface EngineConfig {
  // Core settings
  targetFPS: number;              // Default: 60
  fixedTimestep: number;          // Default: 1/60
  maxDeltaTime: number;           // Default: 0.1 (spiral of death prevention)

  // System configuration
  physics: {
    backend: 'rapier' | 'cannon' | 'box2d';
    gravity: Vector3;
    enableCCD: boolean;
  };

  rendering: {
    backend: 'webgpu' | 'webgl2';
    antialiasing: boolean;
    shadows: boolean;
  };

  network: {
    tickRate: number;
    useDeltaCompression: boolean;
    useInterestManagement: boolean;
  };

  // Development
  debug: {
    showConsole: boolean;
    showFPS: boolean;
    showProfiler: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };

  // Performance
  performance: {
    budgets: FrameBudgets;
    adaptiveQuality: boolean;
  };
}
```

#### 4.1.3 Usage Pattern

```typescript
// Simple initialization (batteries included)
const engine = await MiskatonicEngine.create({});
engine.start();

// Advanced initialization (swappable preferred)
const engine = await MiskatonicEngine.create({
  physics: {
    backend: 'rapier',
    gravity: { x: 0, y: -9.81, z: 0 },
    enableCCD: true,
  },
  rendering: {
    backend: 'webgpu',
    shadows: true,
    antialiasing: true,
  },
  debug: {
    showConsole: true,
    showFPS: true,
  }
});

await engine.initialize();
engine.start();

// Access subsystems
const player = engine.world.createEntity();
engine.physics.createRigidBody({ type: 'dynamic' });
engine.resources.load('player-model.gltf');
```

### 4.2 Game Loop Architecture

**Critical Gap Addressed**: No documented execution order or frame timing strategy.

#### 4.2.1 Phase-Based Execution Model

```
┌──────────────────────────────────────────────────────────┐
│                    Frame Execution                        │
│                  (16.67ms @ 60 FPS)                       │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Frame Start (t=0ms)                                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  • Frame counter increment                       │    │
│  │  • Delta time calculation                        │    │
│  │  • Profiler frame start marker                  │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                 │
│  Phase 1: INPUT (Variable Timestep)                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  InputSystem.update(deltaTime)                  │    │
│  │  • Capture keyboard, mouse, gamepad             │    │
│  │  • Map to actions                               │    │
│  │  • Buffer for network send                      │    │
│  │  Budget: 0.5ms                                  │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                 │
│  Phase 2: PRE_UPDATE                                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  • Entity spawning/despawning                   │    │
│  │  • Component structural changes                 │    │
│  │  Budget: 0.5ms                                  │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                 │
│  Phase 3: UPDATE (Variable Timestep)                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Game Logic Systems (ordered by dependencies)   │    │
│  │  • Movement System                               │    │
│  │  • AI System                                     │    │
│  │  • Game Rules System                             │    │
│  │  Budget: 3.0ms                                  │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                 │
│  Phase 4: PHYSICS (Fixed Timestep)                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Physics Accumulator Pattern                     │    │
│  │  while (accumulator >= fixedTimestep):          │    │
│  │    PhysicsWorld.step(16.67ms)                   │    │
│  │    accumulator -= fixedTimestep                 │    │
│  │  Budget: 2.0ms                                  │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                 │
│  Phase 5: POST_UPDATE                                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │  • Camera following                              │    │
│  │  • Late transforms                               │    │
│  │  • Animation finalization                        │    │
│  │  Budget: 1.0ms                                  │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                 │
│  Phase 6: RENDER (Variable Timestep)                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  alpha = accumulator / fixedTimestep            │    │
│  │  Renderer.render(alpha) // interpolation        │    │
│  │  • Frustum culling                               │    │
│  │  • Draw call batching                            │    │
│  │  • Post-processing                               │    │
│  │  Budget: 8.0ms                                  │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                 │
│  Phase 7: NETWORK (Variable Rate)                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  if (isServer):                                 │    │
│  │    StateReplication.tick()                      │    │
│  │    • Create state batches                       │    │
│  │    • Broadcast to clients                       │    │
│  │  Budget: 1.0ms                                  │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                 │
│  Frame End                                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  • Performance metrics collection                │    │
│  │  • Budget overrun warnings                       │    │
│  │  • Schedule next frame (requestAnimationFrame)  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

#### 4.2.2 System Execution Order

```typescript
enum SystemPhase {
  PRE_UPDATE,   // Structural changes
  UPDATE,       // Main game logic
  POST_UPDATE,  // Late logic (camera, animation)
  RENDER,       // Rendering preparation
}

interface SystemDependencies {
  runAfter?: System[];
  runBefore?: System[];
  phase: SystemPhase;
}

abstract class System {
  abstract name: string;
  abstract budget: number; // milliseconds
  abstract dependencies: SystemDependencies;
  abstract update(deltaTime: number): void;

  // Optional lifecycle
  initialize?(): void;
  shutdown?(): void;
  onPause?(): void;
  onResume?(): void;
}
```

#### 4.2.3 Fixed vs Variable Timestep Strategy

| Subsystem | Timestep | Reason |
|-----------|----------|--------|
| **Input** | Variable | Must be responsive to user actions |
| **Game Logic** | Variable | Adapt to frame rate |
| **Physics** | Fixed (16.67ms) | Deterministic, networking requirement |
| **Rendering** | Variable | Interpolate for smooth visuals |
| **Network** | Variable (60Hz target) | Adapt to network conditions |

### 4.3 Frame Budget System

**Critical Gap Addressed**: No runtime enforcement of performance budgets.

#### 4.3.1 Budget Architecture

```
┌─────────────────────────────────────────────────────┐
│              Frame Budget Manager                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Budget Definition                                   │
│  ┌────────────────────────────────────────────┐    │
│  │  interface SystemBudget {                  │    │
│  │    system: string;                         │    │
│  │    targetMs: number;  // Ideal             │    │
│  │    criticalMs: number; // Maximum          │    │
│  │    adaptiveQuality: boolean; // Auto-scale │    │
│  │  }                                         │    │
│  └────────────────────────────────────────────┘    │
│                      │                              │
│  Per-Frame Tracking  ▼                              │
│  ┌────────────────────────────────────────────┐    │
│  │  for each system:                          │    │
│  │    start = performance.now()               │    │
│  │    system.update(deltaTime)                │    │
│  │    elapsed = performance.now() - start     │    │
│  │                                            │    │
│  │    if (elapsed > budget.criticalMs):      │    │
│  │      console.warn(`System overrun`)        │    │
│  │      trigger adaptive quality              │    │
│  └────────────────────────────────────────────┘    │
│                      │                              │
│  Adaptive Quality    ▼                              │
│  ┌────────────────────────────────────────────┐    │
│  │  if (frameTime > 20ms):                    │    │
│  │    qualityLevel -= 0.1                     │    │
│  │    applyQualityReduction()                 │    │
│  │                                            │    │
│  │  if (frameTime < 13ms):                    │    │
│  │    qualityLevel += 0.05                    │    │
│  │    applyQualityIncrease()                  │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### 4.3.2 Default Budget Allocation

```typescript
const DEFAULT_BUDGETS: SystemBudget[] = [
  { system: 'Input',     targetMs: 0.5,  criticalMs: 1.0,  adaptiveQuality: false },
  { system: 'PreUpdate', targetMs: 0.5,  criticalMs: 1.0,  adaptiveQuality: false },
  { system: 'GameLogic', targetMs: 3.0,  criticalMs: 5.0,  adaptiveQuality: true  },
  { system: 'Physics',   targetMs: 2.0,  criticalMs: 4.0,  adaptiveQuality: true  },
  { system: 'PostUpdate',targetMs: 1.0,  criticalMs: 2.0,  adaptiveQuality: false },
  { system: 'Rendering', targetMs: 8.0,  criticalMs: 12.0, adaptiveQuality: true  },
  { system: 'Network',   targetMs: 1.0,  criticalMs: 2.0,  adaptiveQuality: false },
  { system: 'Overhead',  targetMs: 1.67, criticalMs: 3.0,  adaptiveQuality: false },
];
// Total: 16.67ms (60 FPS)
```

#### 4.3.3 Adaptive Quality Actions

| Quality Level | Rendering Adjustments | Physics Adjustments | AI Adjustments |
|--------------|----------------------|---------------------|----------------|
| **1.0 (High)** | Full shadows, MSAA4x | 60Hz, 2 substeps | Full pathfinding |
| **0.8** | Shadows, MSAA2x | 60Hz, 1 substep | Reduced checks |
| **0.6 (Medium)** | No shadows, FXAA | 60Hz, 1 substep | Update 30Hz |
| **0.5 (Low)** | No shadows, no AA | 30Hz interpolated | Update 15Hz |

---

## System Integration Points

### 3.1 Electron IPC Integration

#### 3.1.1 IPC Architecture

```
┌────────────────────────────────────────────────────┐
│              IPC Communication Layer                │
├────────────────────────────────────────────────────┤
│                                                     │
│  Main Process                 Renderer Process      │
│  ┌──────────────┐            ┌──────────────┐     │
│  │              │            │              │     │
│  │  IPC Handler │◄──────────►│  IPC Client  │     │
│  │              │    IPC     │              │     │
│  └──────────────┘            └──────────────┘     │
│         │                            │              │
│         ▼                            ▼              │
│  ┌──────────────┐            ┌──────────────┐     │
│  │   Native     │            │   Game       │     │
│  │   APIs       │            │   Engine     │     │
│  └──────────────┘            └──────────────┘     │
│                                                     │
│  Preload Script (Isolated Context)                  │
│  ┌────────────────────────────────────────────┐   │
│  │  contextBridge.exposeInMainWorld('api', {  │   │
│  │    file: {                                  │   │
│  │      read: (path) => invoke('file:read'),  │   │
│  │      write: (path, data) => ...            │   │
│  │    },                                       │   │
│  │    window: {                                │   │
│  │      minimize: () => send('window:min'),   │   │
│  │      fullscreen: () => ...                 │   │
│  │    }                                        │   │
│  │  });                                        │   │
│  └────────────────────────────────────────────┘   │
│                                                     │
└────────────────────────────────────────────────────┘
```

#### 3.1.2 IPC Channels

| Channel | Direction | Purpose | Payload Size |
|---------|-----------|---------|--------------|
| `file:read` | Renderer→Main | Read file from disk | < 10MB |
| `file:write` | Renderer→Main | Save game data | < 10MB |
| `window:state` | Main→Renderer | Window events | < 1KB |
| `update:available` | Main→Renderer | Auto-update notification | < 1KB |
| `gpu:info` | Renderer→Main | GPU capabilities query | < 10KB |

### 3.2 Network-Game Logic Integration

#### 3.2.1 Client-Server Boundary

```
┌──────────────────────────────────────────────────┐
│         Client-Server Integration Model           │
├──────────────────────────────────────────────────┤
│                                                   │
│  Client Side                                      │
│  ┌─────────────────────────────────────────┐    │
│  │  Input Capture                           │    │
│  │     │                                    │    │
│  │     ▼                                    │    │
│  │  Local Prediction                        │    │
│  │     │                                    │    │
│  │     ▼                                    │    │
│  │  Send to Server                          │    │
│  └─────────────────────────────────────────┘    │
│                    │                              │
│                    ▼ Network                      │
│                    │                              │
│  Server Side       ▼                              │
│  ┌─────────────────────────────────────────┐    │
│  │  Receive Input                           │    │
│  │     │                                    │    │
│  │     ▼                                    │    │
│  │  Validate & Authorize                    │    │
│  │     │                                    │    │
│  │     ▼                                    │    │
│  │  Update Game State                       │    │
│  │     │                                    │    │
│  │     ▼                                    │    │
│  │  Broadcast State                         │    │
│  └─────────────────────────────────────────┘    │
│                    │                              │
│                    ▼ Network                      │
│  Client Side       │                              │
│  ┌─────────────────────────────────────────┐    │
│  │  Receive State                           │    │
│  │     │                                    │    │
│  │     ▼                                    │    │
│  │  Reconcile with Prediction               │    │
│  │     │                                    │    │
│  │     ▼                                    │    │
│  │  Interpolate Remote Entities             │    │
│  └─────────────────────────────────────────┘    │
│                                                   │
└──────────────────────────────────────────────────┘
```

### 3.3 Physics-Rendering Integration

#### 3.3.1 Synchronization Model

```
Fixed Update (60Hz)          Variable Update
┌─────────────┐              ┌─────────────┐
│   Physics   │              │  Rendering  │
│   Timestep  │              │   Timestep  │
├─────────────┤              ├─────────────┤
│  t = 0.000  │              │  t = 0.000  │
│  t = 0.016  │              │  t = 0.008  │
│  t = 0.033  │◄─Interpolate─│  t = 0.016  │
│  t = 0.050  │              │  t = 0.024  │
│  t = 0.066  │              │  t = 0.033  │
│  t = 0.083  │◄─Interpolate─│  t = 0.041  │
└─────────────┘              └─────────────┘

Alpha = (render_time - last_physics) / physics_step
Interpolated = lerp(last_state, current_state, alpha)
```

### 3.4 Database-Server Integration

#### 3.4.1 Data Access Layer

```
┌──────────────────────────────────────────────┐
│          Data Access Architecture             │
├──────────────────────────────────────────────┤
│                                               │
│  Application Layer                            │
│  ┌─────────────────────────────────────┐    │
│  │  Game Server (NestJS)               │    │
│  │  • Controllers                      │    │
│  │  • Services                         │    │
│  │  • DTOs                             │    │
│  └──────────┬──────────────────────────┘    │
│             │                                 │
│  Repository Layer                             │
│  ┌─────────────────────────────────────┐    │
│  │  • Player Repository                │    │
│  │  • Match Repository                 │    │
│  │  • Inventory Repository             │    │
│  │  • Analytics Repository             │    │
│  └──────────┬──────────────────────────┘    │
│             │                                 │
│  Cache Layer                                  │
│  ┌─────────────────────────────────────┐    │
│  │  Redis Cache                        │    │
│  │  • Session Data                     │    │
│  │  • Leaderboards                     │    │
│  │  • Hot Data                         │    │
│  └──────────┬──────────────────────────┘    │
│             │                                 │
│  Persistence Layer                            │
│  ┌─────────────────────────────────────┐    │
│  │  MongoDB                            │    │
│  │  • Player Profiles                  │    │
│  │  • Game States                      │    │
│  │  • Match History                    │    │
│  └─────────────────────────────────────┘    │
│                                               │
└──────────────────────────────────────────────┘
```

### 3.5 Plugin System Integration

#### 3.5.1 Plugin Architecture

```typescript
interface EnginePlugin {
  name: string;
  version: string;
  dependencies?: string[];

  // Lifecycle hooks
  onInit(engine: Engine): void;
  onUpdate?(deltaTime: number): void;
  onRender?(renderer: Renderer): void;
  onShutdown?(): void;

  // System registration
  systems?: System[];
  components?: ComponentDefinition[];

  // Asset loaders
  assetLoaders?: Map<string, AssetLoader>;

  // Event handlers
  eventHandlers?: Map<string, EventHandler>;
}

// Plugin Registration
engine.plugins.register(new CustomPhysicsPlugin());
engine.plugins.register(new ProceduralGenerationPlugin());
engine.plugins.register(new AIBehaviorPlugin());
```

---

## Data Flow Architecture

### 4.1 Game Loop Data Flow

```
┌──────────────────────────────────────────────────────┐
│                 Main Game Loop (60 FPS)              │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Start Frame                                          │
│     │                                                 │
│     ▼                                                 │
│  ┌──────────────────┐                                │
│  │ Process Input    │ ◄─── Keyboard, Mouse, Gamepad  │
│  └────────┬─────────┘                                │
│           │                                           │
│           ▼                                           │
│  ┌──────────────────┐                                │
│  │ Update Systems   │                                │
│  │ • Input System   │                                │
│  │ • Physics System │ ◄─── Fixed timestep (16.67ms)  │
│  │ • Game Logic     │                                │
│  │ • Animation      │                                │
│  │ • AI Systems     │                                │
│  └────────┬─────────┘                                │
│           │                                           │
│           ▼                                           │
│  ┌──────────────────┐                                │
│  │ Network Sync     │                                │
│  │ • Send Inputs    │ ───► Server                    │
│  │ • Receive State  │ ◄─── Server                    │
│  │ • Reconcile      │                                │
│  └────────┬─────────┘                                │
│           │                                           │
│           ▼                                           │
│  ┌──────────────────┐                                │
│  │ Render Frame     │                                │
│  │ • Culling        │                                │
│  │ • Draw Calls     │ ───► GPU                       │
│  │ • Post-Process   │                                │
│  └────────┬─────────┘                                │
│           │                                           │
│           ▼                                           │
│  ┌──────────────────┐                                │
│  │ Audio Update     │ ───► Audio Context             │
│  └────────┬─────────┘                                │
│           │                                           │
│           ▼                                           │
│  End Frame / VSync                                    │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### 4.2 Multiplayer State Synchronization Flow

```
┌─────────────────────────────────────────────────────┐
│         Multiplayer State Synchronization            │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Timeline:                                          │
│  ════════════════════════════════════════════►      │
│                                                      │
│  Client A (Local Player)                            │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐      │
│  │ I₁  │ P₁  │ I₂  │ P₂  │ I₃  │ P₃  │ R₁  │      │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘      │
│    ↓     ↓     ↓     ↓     ↓     ↓     ↑           │
│    └─────┴─────┴─────┼─────┴─────┴─────┘           │
│                      ▼                              │
│  Network Layer   ~~~~~~~~~~~~                       │
│                      ▼                              │
│  Server                                             │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐      │
│  │ V₁  │ S₁  │ V₂  │ S₂  │ V₃  │ S₃  │ B₁  │      │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘      │
│                                          ↓           │
│                      ┌───────────────────┘          │
│                      ▼                              │
│  Network Layer   ~~~~~~~~~~~~                       │
│                      ▼                              │
│  Client B (Remote Player)                           │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐      │
│  │ R₁  │ I₁  │ R₂  │ I₂  │ R₃  │ I₃  │ A₁  │      │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘      │
│                                                      │
│  Legend:                                            │
│  I = Input, P = Prediction, R = Reconciliation      │
│  V = Validation, S = Simulation, B = Broadcast      │
│  A = Apply State, I = Interpolation                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 4.3 Asset Loading Pipeline Flow

```
┌──────────────────────────────────────────────┐
│           Asset Loading Pipeline               │
├──────────────────────────────────────────────┤
│                                               │
│  Asset Request                                │
│     │                                         │
│     ▼                                         │
│  ┌────────────────┐                          │
│  │ Cache Check    │                          │
│  └───┬────────┬───┘                          │
│      │ Hit    │ Miss                         │
│      ▼        ▼                              │
│  Return   ┌────────────────┐                 │
│  Cached   │ Priority Queue  │                 │
│  Asset    └────────┬────────┘                │
│                    │                          │
│                    ▼                          │
│           ┌────────────────┐                 │
│           │ Load from Disk │                 │
│           └────────┬────────┘                │
│                    │                          │
│                    ▼                          │
│           ┌────────────────┐                 │
│           │ Process Asset  │                 │
│           │ • Decompress   │                 │
│           │ • Parse        │                 │
│           │ • Validate     │                 │
│           └────────┬────────┘                │
│                    │                          │
│                    ▼                          │
│           ┌────────────────┐                 │
│           │ GPU Upload     │                 │
│           │ • Textures     │                 │
│           │ • Buffers      │                 │
│           │ • Shaders      │                 │
│           └────────┬────────┘                │
│                    │                          │
│                    ▼                          │
│           ┌────────────────┐                 │
│           │ Update Cache   │                 │
│           └────────┬────────┘                │
│                    │                          │
│                    ▼                          │
│           Return Asset                        │
│                                               │
└──────────────────────────────────────────────┘
```

### 4.4 Input Processing Flow

```
┌──────────────────────────────────────────┐
│         Input Processing Pipeline          │
├──────────────────────────────────────────┤
│                                           │
│  Hardware Input                           │
│  ┌─────────────────────────────────┐    │
│  │ Keyboard │ Mouse │ Gamepad      │    │
│  └────┬─────┴───┬───┴──────┬──────┘    │
│       └─────────┼──────────┘            │
│                 ▼                        │
│  Browser Event System                     │
│  ┌─────────────────────────────────┐    │
│  │ keydown, mouseMove, gamepadAPI  │    │
│  └──────────────┬──────────────────┘    │
│                 ▼                        │
│  Input Manager                            │
│  ┌─────────────────────────────────┐    │
│  │ • Event Normalization           │    │
│  │ • Dead Zone Processing          │    │
│  │ • Input Buffering               │    │
│  └──────────────┬──────────────────┘    │
│                 ▼                        │
│  Action Mapping                           │
│  ┌─────────────────────────────────┐    │
│  │ Raw Input → Game Actions        │    │
│  │ "W" → "move_forward"            │    │
│  │ "Mouse1" → "attack"             │    │
│  └──────────────┬──────────────────┘    │
│                 ▼                        │
│  Input System (ECS)                       │
│  ┌─────────────────────────────────┐    │
│  │ Process Actions                  │    │
│  │ Update Components                │    │
│  └──────────────┬──────────────────┘    │
│                 ▼                        │
│  Game Logic Response                      │
│                                           │
└──────────────────────────────────────────┘
```

---

## Security Architecture

### 5.1 Security Layers

```
┌────────────────────────────────────────────────┐
│              Security Architecture              │
├────────────────────────────────────────────────┤
│                                                 │
│  Application Security                           │
│  ┌──────────────────────────────────────┐     │
│  │  Electron Security                    │     │
│  │  • Context Isolation                  │     │
│  │  • Preload Scripts                    │     │
│  │  • CSP Headers                        │     │
│  │  • Sandbox Mode                       │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Network Security                               │
│  ┌──────────────────────────────────────┐     │
│  │  • TLS 1.3 Encryption                 │     │
│  │  • Certificate Pinning                │     │
│  │  • DDoS Protection                    │     │
│  │  • Rate Limiting                      │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Authentication & Authorization                 │
│  ┌──────────────────────────────────────┐     │
│  │  • OAuth 2.0 / JWT                    │     │
│  │  • 2FA Support                        │     │
│  │  • RBAC (Role-Based Access)          │     │
│  │  • Session Management                 │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Game Security                                  │
│  ┌──────────────────────────────────────┐     │
│  │  Anti-Cheat System                    │     │
│  │  • Server Authority                   │     │
│  │  • Input Validation                   │     │
│  │  • State Verification                 │     │
│  │  • Statistical Detection              │     │
│  │  • Memory Protection                  │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Data Security                                  │
│  ┌──────────────────────────────────────┐     │
│  │  • Encryption at Rest (AES-256)       │     │
│  │  • Encryption in Transit (TLS)        │     │
│  │  • PII Protection                     │     │
│  │  • GDPR/CCPA Compliance               │     │
│  └──────────────────────────────────────┘     │
│                                                 │
└────────────────────────────────────────────────┘
```

### 5.2 Anti-Cheat System

```
┌──────────────────────────────────────────┐
│         Anti-Cheat Architecture           │
├──────────────────────────────────────────┤
│                                           │
│  Client-Side Detection                    │
│  ┌─────────────────────────────────┐    │
│  │  • Process Monitoring            │    │
│  │  • Memory Integrity              │    │
│  │  • File Integrity                │    │
│  └──────────┬──────────────────────┘    │
│             │                             │
│  Server-Side Validation                   │
│  ┌─────────────────────────────────┐    │
│  │  Input Validation                │    │
│  │  • Movement Speed                │    │
│  │  • Action Rate                   │    │
│  │  • Impossible States             │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  Statistical Analysis            │    │
│  │  • Aim Patterns                  │    │
│  │  • Win Rates                     │    │
│  │  • Behavioral Anomalies          │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  Replay Analysis                 │    │
│  │  • Manual Review                 │    │
│  │  • Automated Detection           │    │
│  │  • Machine Learning              │    │
│  └─────────────────────────────────┘    │
│                                           │
│  Response System                          │
│  ┌─────────────────────────────────┐    │
│  │  • Warning                       │    │
│  │  • Temporary Ban                 │    │
│  │  • Permanent Ban                 │    │
│  │  • Hardware Ban                  │    │
│  └─────────────────────────────────┘    │
│                                           │
└──────────────────────────────────────────┘
```

### 5.3 Data Protection

| Data Type | Protection Method | Storage | Access Control |
|-----------|------------------|---------|----------------|
| **Passwords** | Bcrypt (12 rounds) | MongoDB | Admin only |
| **Game State** | AES-256 | MongoDB | Server only |
| **Session Data** | JWT Signed | Redis | Token-based |
| **Player Data** | Encrypted | MongoDB | Owner + Admin |
| **Payment Info** | Tokenized | External | PCI Compliant |

---

## Performance Architecture

### 6.1 Performance Budget Allocation

```
┌───────────────────────────────────────────────┐
│     Frame Budget (16.67ms @ 60 FPS)           │
├───────────────────────────────────────────────┤
│                                                │
│  ┌──────────────────────────────────────┐    │
│  │ Input Processing          0.5ms  (3%) │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ ECS System Updates        1.0ms  (6%) │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ Physics Simulation        2.0ms (12%) │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ Game Logic               3.0ms (18%) │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ Animation                1.0ms  (6%) │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ Rendering                5.0ms (30%) │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ Network                  1.0ms  (6%) │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ Audio                    0.5ms  (3%) │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ Overhead                 1.0ms  (6%) │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ Safety Buffer            1.67ms (10%) │    │
│  └──────────────────────────────────────┘    │
│                                                │
│  Total Used: 16.67ms (100%)                   │
│                                                │
└───────────────────────────────────────────────┘
```

### 6.2 Memory Budget

#### 6.2.1 RAM Budget Allocation

```
┌─────────────────────────────────────────┐
│    RAM Budget (500MB Target / 1GB Max)  │
├─────────────────────────────────────────┤
│                                          │
│  ┌───────────────────────────────┐     │
│  │ ECS Components    100MB (20%) │     │
│  └───────────────────────────────┘     │
│  ┌───────────────────────────────┐     │
│  │ Rendering (CPU)    50MB (10%) │     │
│  └───────────────────────────────┘     │
│  ┌───────────────────────────────┐     │
│  │ Physics            50MB (10%) │     │
│  └───────────────────────────────┘     │
│  ┌───────────────────────────────┐     │
│  │ Network            50MB (10%) │     │
│  └───────────────────────────────┘     │
│  ┌───────────────────────────────┐     │
│  │ Audio              50MB (10%) │     │
│  └───────────────────────────────┘     │
│  ┌───────────────────────────────┐     │
│  │ Assets (CPU)      100MB (20%) │     │
│  └───────────────────────────────┘     │
│  ┌───────────────────────────────┐     │
│  │ Engine Overhead    50MB (10%) │     │
│  └───────────────────────────────┘     │
│  ┌───────────────────────────────┐     │
│  │ Game Logic         50MB (10%) │     │
│  └───────────────────────────────┘     │
│                                          │
│  Target: 500MB | Critical: 1GB          │
└─────────────────────────────────────────┘
```

#### 6.2.2 VRAM Budget Allocation

```
┌─────────────────────────────────────────┐
│         VRAM Budget (256MB Target)       │
├─────────────────────────────────────────┤
│                                          │
│  ┌───────────────────────────────┐     │
│  │ Textures          128MB (50%) │     │
│  └───────────────────────────────┘     │
│  ┌───────────────────────────────┐     │
│  │ Vertex Buffers     32MB (13%) │     │
│  └───────────────────────────────┘     │
│  ┌───────────────────────────────┐     │
│  │ Index Buffers      32MB (13%) │     │
│  └───────────────────────────────┘     │
│  ┌───────────────────────────────┐     │
│  │ Render Targets     48MB (19%) │     │
│  └───────────────────────────────┘     │
│  ┌───────────────────────────────┐     │
│  │ Uniform Buffers     8MB  (3%) │     │
│  └───────────────────────────────┘     │
│  ┌───────────────────────────────┐     │
│  │ Other/Reserve       8MB  (3%) │     │
│  └───────────────────────────────┘     │
│                                          │
└─────────────────────────────────────────┘
```

#### 6.2.3 Garbage Collection Budget

**JavaScript/V8 Reality:**

Miskatonic runs on V8 (Electron), which uses garbage collection. GC pauses directly impact frame time and must be budgeted.

```
┌─────────────────────────────────────────┐
│         GC Budget & Constraints          │
├─────────────────────────────────────────┤
│                                          │
│  Frame Budget:        16.67ms (60 FPS)  │
│  GC Pause Budget:      5.00ms (max)     │
│  Available for Work:  11.67ms           │
│                                          │
│  ┌───────────────────────────────┐     │
│  │ Per-Frame Allocations         │     │
│  │ Target: <1000 objects         │     │
│  │ Critical: <2000 objects       │     │
│  └───────────────────────────────┘     │
│                                          │
│  ┌───────────────────────────────┐     │
│  │ Network Allocations           │     │
│  │ Target: <50 objects/tick      │     │
│  │ Critical: <100 objects/tick   │     │
│  └───────────────────────────────┘     │
│                                          │
│  ┌───────────────────────────────┐     │
│  │ Rendering Allocations         │     │
│  │ Target: <100 objects/frame    │     │
│  │ Critical: <200 objects/frame  │     │
│  └───────────────────────────────┘     │
│                                          │
└─────────────────────────────────────────┘
```

**Why GC Matters:**

| Scenario | Frame Time Breakdown |
|----------|---------------------|
| **Good (No GC)** | 15.0ms work + 0ms GC = 60 FPS ✅ |
| **Acceptable** | 11.0ms work + 5ms GC = 60 FPS ✅ |
| **Bad (Long GC)** | 10.0ms work + 10ms GC = 50 FPS ❌ |
| **Terrible** | 8.0ms work + 20ms GC = 36 FPS ❌ |

**GC Mitigation Strategy:**
- Object pooling for frequently allocated types
- Frame allocators for temporary data
- Typed arrays for component storage (minimal GC pressure)
- Pre-allocation of major buffers at startup

### 6.3 Memory Management Patterns

#### 6.3.1 Object Pooling

**Purpose:** Reuse objects to minimize GC pressure.

**Implementation Pattern:**

```typescript
class ObjectPool<T> {
  private pool: T[];
  private available: T[];
  private inUse: Set<T>;

  constructor(
    private factory: () => T,
    private reset: (obj: T) => void,
    initialSize: number,
    private maxSize: number = Infinity
  ) {
    this.pool = [];
    this.available = [];
    this.inUse = new Set();

    // Pre-allocate
    for (let i = 0; i < initialSize; i++) {
      const obj = factory();
      this.pool.push(obj);
      this.available.push(obj);
    }
  }

  acquire(): T {
    let obj = this.available.pop();

    if (!obj) {
      if (this.pool.length >= this.maxSize) {
        throw new Error(`Pool exhausted: max ${this.maxSize}`);
      }
      obj = this.factory();
      this.pool.push(obj);
    }

    this.inUse.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (!this.inUse.has(obj)) return;
    this.reset(obj);
    this.inUse.delete(obj);
    this.available.push(obj);
  }
}
```

**Pooling Candidates:**
- Event objects (frequent creation/destruction)
- Network packets (60 ticks/second)
- Collision results (physics queries)
- Temporary rendering objects (culling, sorting)

#### 6.3.2 Frame Allocators

**Purpose:** Temporary per-frame allocations without GC pressure.

**Implementation Pattern:**

```typescript
class FrameAllocator {
  private buffer: ArrayBuffer;
  private offset: number = 0;
  private highWaterMark: number = 0;

  constructor(sizeBytes: number) {
    this.buffer = new ArrayBuffer(sizeBytes);
  }

  allocateFloat32(count: number): Float32Array {
    const bytes = count * 4;
    if (this.offset + bytes > this.buffer.byteLength) {
      throw new Error(`FrameAllocator overflow`);
    }

    const view = new Float32Array(this.buffer, this.offset, count);
    this.offset += bytes;
    this.highWaterMark = Math.max(this.highWaterMark, this.offset);
    return view;
  }

  allocateUint32(count: number): Uint32Array {
    const bytes = count * 4;
    const view = new Uint32Array(this.buffer, this.offset, count);
    this.offset += bytes;
    return view;
  }

  reset(): void {
    this.offset = 0;
  }

  getUsage(): number {
    return this.offset;
  }
}

// Subsystem allocators
const renderAllocator = new FrameAllocator(1024 * 1024); // 1MB
const physicsAllocator = new FrameAllocator(512 * 1024); // 512KB
const networkAllocator = new FrameAllocator(256 * 1024); // 256KB

// Reset at frame start
function gameLoop() {
  renderAllocator.reset();
  physicsAllocator.reset();
  networkAllocator.reset();

  // Use during frame
  const cullingResults = renderAllocator.allocateUint32(1000);
  const collisionPairs = physicsAllocator.allocateUint32(500);

  // Automatically "freed" at next frame's reset
}
```

**Use Cases:**
- Rendering: Culling results, sorting keys, draw batching
- Physics: Collision pairs, solver temporaries, query results
- Network: Serialization staging, delta compression buffers
- AI: Pathfinding temporaries, behavior tree scratch space

#### 6.3.3 GC Monitoring

**V8 Tuning Flags (Electron):**

```json
{
  "scripts": {
    "dev": "electron . --max-old-space-size=512 --expose-gc --trace-gc"
  }
}
```

**Flags:**
- `--max-old-space-size=512`: Enforce 512MB heap limit
- `--expose-gc`: Enable manual GC triggering (testing only)
- `--trace-gc`: Log GC events for profiling
- `--trace-gc-verbose`: Detailed GC logging

**GC Monitoring API:**

```typescript
import v8 from 'v8';

class GCMonitor {
  private gcPauses: number[] = [];
  private maxHistory = 600; // 10 seconds at 60 FPS

  recordGCPause(durationMs: number): void {
    this.gcPauses.push(durationMs);
    if (this.gcPauses.length > this.maxHistory) {
      this.gcPauses.shift();
    }

    if (durationMs > 5.0) {
      console.warn(`Long GC pause: ${durationMs.toFixed(2)}ms`);
    }
  }

  getAveragePause(): number {
    if (this.gcPauses.length === 0) return 0;
    return this.gcPauses.reduce((a, b) => a + b, 0) / this.gcPauses.length;
  }

  getMaxPause(): number {
    return Math.max(...this.gcPauses, 0);
  }

  getHeapStats() {
    return v8.getHeapStatistics();
  }
}
```

**Integration with Frame Budget:**

```typescript
// Before frame
const heapBefore = v8.getHeapStatistics().used_heap_size;
const frameStart = performance.now();

// Run frame
updateGame(deltaTime);

// After frame
const frameEnd = performance.now();
const heapAfter = v8.getHeapStatistics().used_heap_size;

const frameTime = frameEnd - frameStart;
const allocated = heapAfter - heapBefore;

if (frameTime > 16.67) {
  console.warn(`Frame overrun: ${frameTime.toFixed(2)}ms`);
}

if (allocated > 100000) { // 100KB
  console.warn(`High allocation: ${allocated} bytes`);
}
```

### 6.4 Optimization Strategies

| System | Strategy | Expected Gain |
|--------|----------|---------------|
| **Rendering** | Instanced rendering, Batching | 50% fewer draw calls |
| **Physics** | Spatial partitioning, Sleep states | 30% CPU reduction |
| **Memory** | Object pooling, Typed arrays | 40% GC reduction |
| **Network** | Delta compression, Priority queues | 60% bandwidth saving |
| **Assets** | Texture compression, LOD | 50% memory usage |

### 6.4 Performance Monitoring

```
┌──────────────────────────────────────────┐
│       Performance Monitoring System        │
├──────────────────────────────────────────┤
│                                           │
│  Real-time Metrics                        │
│  ┌─────────────────────────────────┐    │
│  │ • FPS Counter                    │    │
│  │ • Frame Time Graph               │    │
│  │ • Memory Usage                   │    │
│  │ • Network Latency                │    │
│  │ • Draw Call Count                │    │
│  └─────────────────────────────────┘    │
│                                           │
│  Profiling Tools                          │
│  ┌─────────────────────────────────┐    │
│  │ • CPU Profiler (Flamegraph)      │    │
│  │ • GPU Profiler (WebGL Inspector) │    │
│  │ • Memory Profiler                │    │
│  │ • Network Profiler               │    │
│  └─────────────────────────────────┘    │
│                                           │
│  Analytics Collection                     │
│  ┌─────────────────────────────────┐    │
│  │ • Performance Events             │    │
│  │ • Error Tracking                 │    │
│  │ • User Hardware Stats            │    │
│  │ • Gameplay Metrics               │    │
│  └─────────────────────────────────┘    │
│                                           │
└──────────────────────────────────────────┘
```

---

## Development Tools & Debugging

### 9.1 Debug Console

**Critical Gap Addressed**: No runtime introspection or command execution capability.

#### 9.1.1 Console Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Debug Console                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  User Interface                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  Toggle: ~ key                              │    │
│  │  ┌──────────────────────────────────────┐  │    │
│  │  │ Output Window (scrollable)           │  │    │
│  │  │ > spawn player 0 0 0                 │  │    │
│  │  │ ✓ Created entity #1234               │  │    │
│  │  │ > physics.gravity 0 -20 0            │  │    │
│  │  │ ✓ Gravity updated                    │  │    │
│  │  └──────────────────────────────────────┘  │    │
│  │  ┌──────────────────────────────────────┐  │    │
│  │  │ Input: _█                            │  │    │
│  │  └──────────────────────────────────────┘  │    │
│  │  [History: ↑↓] [Autocomplete: Tab]        │    │
│  └────────────────────────────────────────────┘    │
│                         │                            │
│  Command System         ▼                            │
│  ┌────────────────────────────────────────────┐    │
│  │  registerCommand(name, handler)            │    │
│  │  executeCommand(command)                   │    │
│  │  getSuggestions(partial)                   │    │
│  └────────────────────────────────────────────┘    │
│                         │                            │
│  Built-in Commands      ▼                            │
│  ┌────────────────────────────────────────────┐    │
│  │  spawn <type> <x> <y> <z>                  │    │
│  │  destroy <entityId>                        │    │
│  │  inspect <entityId>                        │    │
│  │  list entities | systems                   │    │
│  │  enable | disable <systemName>             │    │
│  │  set <component>.<field> <value>           │    │
│  │  physics.pause | step | gravity            │    │
│  │  scene.load | save <name>                  │    │
│  │  perf.report                               │    │
│  │  help <command>                            │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### 9.1.2 Command Registration

```typescript
interface DebugConsole {
  // Display
  show(): void;
  hide(): void;
  toggle(): void;

  // Output
  log(message: string, level?: LogLevel): void;
  clear(): void;

  // Commands
  registerCommand(name: string, handler: CommandHandler): void;
  executeCommand(command: string): void;

  // Autocomplete
  getSuggestions(partial: string): string[];
}

type CommandHandler = (args: string[]) => void | Promise<void>;

// Example registration
engine.console.registerCommand('spawn', (args) => {
  const [type, x, y, z] = args;
  const entity = engine.world.createEntity();
  engine.world.addComponent(entity, 'Transform', {
    position: { x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) }
  });
  engine.console.log(`Created entity #${entity}`, 'success');
});
```

### 9.2 Runtime Inspection Tools

**Critical Gap Addressed**: Can't inspect or modify engine state at runtime.

#### 9.2.1 Entity Inspector

```
┌─────────────────────────────────────────────────┐
│              Entity Inspector                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  Entity #1234 "Player"                          │
│  ┌─────────────────────────────────────────┐   │
│  │ Active: ✓                                │   │
│  │                                          │   │
│  │ Components:                              │   │
│  │ ┌────────────────────────────────────┐  │   │
│  │ │ Transform                           │  │   │
│  │ │   position: [10.5, 5.2, 0.0]       │  │   │
│  │ │   rotation: [0, 90, 0]             │  │   │
│  │ │   scale: [1, 1, 1]                 │  │   │
│  │ └────────────────────────────────────┘  │   │
│  │ ┌────────────────────────────────────┐  │   │
│  │ │ Velocity                            │  │   │
│  │ │   linear: [1.2, 0.0, 0.0]          │  │   │
│  │ │   angular: [0, 0, 0]               │  │   │
│  │ └────────────────────────────────────┘  │   │
│  │ ┌────────────────────────────────────┐  │   │
│  │ │ Health                              │  │   │
│  │ │   current: 75 / 100                │  │   │
│  │ │   regeneration: 1.0/s              │  │   │
│  │ └────────────────────────────────────┘  │   │
│  │                                          │   │
│  │ [Edit Values] [Add Component] [Destroy] │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### 9.2.2 System Monitor

```
┌─────────────────────────────────────────────────┐
│              System Monitor                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  ✓ InputSystem          0.3ms /  0.5ms (60%)   │
│  ✓ MovementSystem       0.8ms /  1.0ms (80%)   │
│  ✓ PhysicsSystem        1.9ms /  2.0ms (95%)   │
│  ✓ RenderSystem         7.2ms /  8.0ms (90%)   │
│  ⚠ NetworkSystem        1.2ms /  1.0ms (120%)  │ ← Over budget
│                                                  │
│  Frame: 11.4ms / 16.67ms (68%)                  │
│  FPS: 60                                        │
│  Quality: 1.0 (High)                            │
│                                                  │
│  [Pause] [Step Frame] [Reset]                  │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 9.3 Integrated Profiler

**Critical Gap Addressed**: Can't measure where time is spent.

#### 9.3.1 Profiler Architecture

```
┌──────────────────────────────────────────────┐
│           Integrated Profiler                 │
├──────────────────────────────────────────────┤
│                                               │
│  Instrumentation                              │
│  ┌─────────────────────────────────────┐    │
│  │  Mark API (compatible with Chrome)  │    │
│  │  • performance.mark('start')         │    │
│  │  • performance.measure('span')       │    │
│  └─────────────────────────────────────┘    │
│                      │                        │
│  Data Collection     ▼                        │
│  ┌─────────────────────────────────────┐    │
│  │  Per-System Timing                   │    │
│  │  • Enter/exit timestamps             │    │
│  │  • Call stack tracking               │    │
│  │  • GPU timing queries                │    │
│  └─────────────────────────────────────┘    │
│                      │                        │
│  Visualization       ▼                        │
│  ┌─────────────────────────────────────┐    │
│  │  • Flamegraph (call tree)            │    │
│  │  • Timeline (frame by frame)         │    │
│  │  • Summary statistics                │    │
│  └─────────────────────────────────────┘    │
│                      │                        │
│  Export              ▼                        │
│  ┌─────────────────────────────────────┐    │
│  │  Chrome Trace Format (.json)         │    │
│  │  • chrome://tracing compatible       │    │
│  │  • Full thread information           │    │
│  │  • GPU events included               │    │
│  └─────────────────────────────────────┘    │
│                                               │
└──────────────────────────────────────────────┘
```

#### 9.3.2 Profiling API

```typescript
interface Profiler {
  // Recording
  startRecording(): void;
  stopRecording(): ProfileData;

  // Frame markers
  recordFrame(frameTime: number, systemTimes: Map<string, number>): void;

  // Export
  exportChromeTrace(): string;
  exportCSV(): string;

  // Stats
  getAverageFPS(seconds?: number): number;
  getSlowestFrames(count: number): FrameMetrics[];
  getSystemStats(systemName: string): SystemStats;
}

interface FrameMetrics {
  frameNumber: number;
  timestamp: number;
  totalTime: number;
  systemTimes: Map<string, number>;
  fps: number;
  droppedFrames: number;
}
```

---

## Threading & Concurrency

### 10.1 Threading Architecture

**Critical Gap Addressed**: Single-threaded execution, not utilizing multi-core CPUs.

#### 10.1.1 Threading Model

```
┌──────────────────────────────────────────────────────┐
│                Threading Architecture                 │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Main Thread (Renderer Process)                       │
│  ┌───────────────────────────────────────────────┐  │
│  │  • Game Loop Coordination                      │  │
│  │  • Input Processing                            │  │
│  │  • ECS System Scheduling                       │  │
│  │  • Rendering (WebGL context - must be main)   │  │
│  │  • DOM manipulation (must be main)            │  │
│  └───────────────────────────────────────────────┘  │
│                         │                             │
│                         ├─────────────────┐          │
│                         │                 │          │
│  Web Worker 1           │                 │  Worker 2│
│  ┌─────────────────────▼─────┐  ┌────────▼─────┐   │
│  │  Physics Simulation        │  │  AI System    │   │
│  │  • RigidBody integration   │  │  • Pathfinding│   │
│  │  • Collision detection     │  │  • Behavior   │   │
│  │  • Constraint solving      │  │  • Decision   │   │
│  └────────────────────────────┘  └───────────────┘   │
│                         ↕                  ↕          │
│  Shared Memory (SharedArrayBuffer)                    │
│  ┌───────────────────────────────────────────────┐  │
│  │  Physics State                                 │  │
│  │  • Body transforms (Float32Array)             │  │
│  │  • Velocities (Float32Array)                  │  │
│  │  • Dirty flags (Uint8Array)                   │  │
│  └───────────────────────────────────────────────┘  │
│                                                       │
└──────────────────────────────────────────────────────┘
```

#### 10.1.2 System Thread Safety Categories

| Category | Systems | Threading | Synchronization |
|----------|---------|-----------|-----------------|
| **Main-Only** | Rendering, DOM, Input | Single-threaded | N/A |
| **Parallel-Safe (Read)** | Queries, Collision tests | Multi-threaded | None (immutable) |
| **Parallel-Safe (Write)** | Component updates | Multi-threaded | Atomics, locks |
| **Worker-Isolated** | Physics, AI, Asset processing | Web Workers | Message passing |

#### 10.1.3 Synchronization Points

```
Frame Timeline (Multi-threaded):

0ms    ─┬─ Frame Start (SYNC POINT 1)
        │  • Main thread waits for workers
        │  • Flush deferred operations
        │  • Commit entity changes
        │
        ├─ Parallel Execution (0-8ms)
        │  ├─ Main: Input + Game Logic
        │  ├─ Worker 1: Physics simulation
        │  └─ Worker 2: AI pathfinding
        │
8ms    ─┼─ SYNC POINT 2
        │  • Main waits for workers
        │  • Copy physics results via SharedArrayBuffer
        │  • Resolve any conflicts
        │
        ├─ Main Thread Only (8-16ms)
        │  • Camera updates
        │  • Rendering pipeline
        │  • WebGL commands
        │
16.67ms ─┴─ Frame End
```

### 10.2 Parallel System Execution

**Critical Gap Addressed**: Systems run sequentially, wasting CPU cores.

#### 10.2.1 Dependency Graph

```typescript
interface SystemDependencyGraph {
  nodes: Map<string, SystemNode>;
  edges: Map<string, string[]>; // system -> dependencies

  // Computed properties
  executionGroups: SystemGroup[]; // Systems that can run in parallel
}

interface SystemGroup {
  systems: System[];
  canExecuteInParallel: boolean;
  estimatedDuration: number;
}

// Example
const graph = {
  executionGroups: [
    {
      systems: [InputSystem], // Group 1 (sequential)
      canExecuteInParallel: false,
      estimatedDuration: 0.5
    },
    {
      systems: [MovementSystem, AISystem, AnimationSystem], // Group 2 (parallel)
      canExecuteInParallel: true,
      estimatedDuration: 2.0
    },
    {
      systems: [PhysicsSystem], // Group 3 (sequential, depends on Group 2)
      canExecuteInParallel: false,
      estimatedDuration: 2.0
    },
    {
      systems: [RenderingSystem], // Group 4 (sequential, main thread only)
      canExecuteInParallel: false,
      estimatedDuration: 8.0
    }
  ]
};
```

#### 10.2.2 Parallel Execution Strategy

```typescript
async function executeSystemGroup(group: SystemGroup, deltaTime: number): Promise<void> {
  if (group.canExecuteInParallel) {
    // Execute systems in parallel using Promise.all
    await Promise.all(
      group.systems.map(system =>
        executeSystemAsync(system, deltaTime)
      )
    );
  } else {
    // Execute sequentially
    for (const system of group.systems) {
      await executeSystemAsync(system, deltaTime);
    }
  }
}

// Main game loop
async function tick() {
  for (const group of dependencyGraph.executionGroups) {
    await executeSystemGroup(group, deltaTime);
  }
}
```

### 10.3 Web Worker Integration

**Critical Gap Addressed**: Heavy subsystems block the main thread.

#### 10.3.1 Worker Communication Pattern

```typescript
// Main Thread
class PhysicsWorkerProxy {
  private worker: Worker;
  private sharedState: SharedArrayBuffer;

  constructor() {
    this.worker = new Worker('physics-worker.js');
    this.sharedState = new SharedArrayBuffer(1024 * 1024); // 1MB

    this.worker.postMessage({
      type: 'init',
      sharedState: this.sharedState
    });
  }

  step(deltaTime: number): void {
    // Signal worker to simulate
    Atomics.store(controlArray, 0, 1); // Start signal
    Atomics.notify(controlArray, 0);

    // Wait for completion (or timeout)
    Atomics.wait(controlArray, 0, 1, 4); // 4ms timeout

    // Read results from SharedArrayBuffer
    this.syncPhysicsToECS();
  }
}

// Worker Thread (physics-worker.js)
let physicsWorld: PhysicsWorld;

self.onmessage = (e) => {
  if (e.data.type === 'init') {
    physicsWorld = new PhysicsWorld(new RapierPhysicsEngine());
    // Setup shared memory views
  }
};

// Worker loop
while (true) {
  Atomics.wait(controlArray, 0, 0); // Wait for signal

  // Simulate physics
  physicsWorld.step(1/60);

  // Write results to shared memory
  writePhysicsState(sharedState);

  // Signal completion
  Atomics.store(controlArray, 0, 0);
  Atomics.notify(controlArray, 0);
}
```

#### 10.3.2 Performance Expectations

| Subsystem | Thread | Expected Speedup | Communication Overhead |
|-----------|--------|------------------|------------------------|
| **Physics** | Worker | 40-60% faster | <0.5ms per frame |
| **AI Pathfinding** | Worker | 50-80% faster | <0.1ms per frame |
| **Asset Processing** | Worker | 200%+ faster | Async (no blocking) |
| **Audio Decoding** | Worker | 150%+ faster | Async (no blocking) |

---

## Deployment & Operations

### 7.1 Client Deployment

```
┌────────────────────────────────────────────┐
│         Client Deployment Pipeline          │
├────────────────────────────────────────────┤
│                                             │
│  Development                                │
│  ┌──────────────────────────────────┐     │
│  │  Source Code (TypeScript)         │     │
│  └─────────────┬────────────────────┘     │
│                ▼                            │
│  Build Process                              │
│  ┌──────────────────────────────────┐     │
│  │  • TypeScript Compilation         │     │
│  │  • Webpack Bundling               │     │
│  │  • Asset Processing               │     │
│  │  • Electron Packaging             │     │
│  └─────────────┬────────────────────┘     │
│                ▼                            │
│  Platform Packages                          │
│  ┌──────────────────────────────────┐     │
│  │  Windows   │  macOS   │  Linux    │     │
│  │  (.exe)    │  (.dmg)  │  (.AppImage) │  │
│  └─────────────┬────────────────────┘     │
│                ▼                            │
│  Code Signing                               │
│  ┌──────────────────────────────────┐     │
│  │  • Windows (Authenticode)         │     │
│  │  • macOS (Developer ID)           │     │
│  │  • Linux (GPG)                    │     │
│  └─────────────┬────────────────────┘     │
│                ▼                            │
│  Distribution                               │
│  ┌──────────────────────────────────┐     │
│  │  Steam  │  Epic  │  Direct Download │   │
│  └──────────────────────────────────┘     │
│                                             │
│  Auto-Update System                         │
│  ┌──────────────────────────────────┐     │
│  │  • Differential Updates           │     │
│  │  • Rollback Support               │     │
│  │  • Staged Rollout                │     │
│  └──────────────────────────────────┘     │
│                                             │
└────────────────────────────────────────────┘
```

### 7.2 Server Deployment

```
┌──────────────────────────────────────────┐
│        Server Deployment Architecture      │
├──────────────────────────────────────────┤
│                                           │
│  CI/CD Pipeline                           │
│  ┌─────────────────────────────────┐    │
│  │  GitHub Actions                  │    │
│  │  • Test Suite                    │    │
│  │  • Build Docker Images           │    │
│  │  • Push to Registry              │    │
│  └──────────┬──────────────────────┘    │
│             ▼                             │
│  Container Registry                        │
│  ┌─────────────────────────────────┐    │
│  │  Docker Hub / ECR                │    │
│  │  • Game Server Image             │    │
│  │  • Matchmaking Image             │    │
│  │  • Analytics Image               │    │
│  └──────────┬──────────────────────┘    │
│             ▼                             │
│  Kubernetes Deployment                     │
│  ┌─────────────────────────────────┐    │
│  │  Production Cluster              │    │
│  │  ┌───────────────────────┐      │    │
│  │  │ Game Server Pods       │      │    │
│  │  │ • Auto-scaling         │      │    │
│  │  │ • Health Checks        │      │    │
│  │  │ • Rolling Updates      │      │    │
│  │  └───────────────────────┘      │    │
│  └─────────────────────────────────┘    │
│                                           │
│  Infrastructure as Code                    │
│  ┌─────────────────────────────────┐    │
│  │  Terraform                       │    │
│  │  • VPC Configuration             │    │
│  │  • Database Clusters             │    │
│  │  • Load Balancers                │    │
│  │  • CDN Configuration             │    │
│  └─────────────────────────────────┘    │
│                                           │
└──────────────────────────────────────────┘
```

### 7.3 Monitoring & Observability

```
┌──────────────────────────────────────────┐
│      Monitoring & Observability Stack      │
├──────────────────────────────────────────┤
│                                           │
│  Metrics Collection                        │
│  ┌─────────────────────────────────┐    │
│  │  Prometheus                      │    │
│  │  • Server Metrics                │    │
│  │  • Game Metrics                  │    │
│  │  • Business KPIs                 │    │
│  └──────────┬──────────────────────┘    │
│             │                             │
│  Logging                                   │
│  ┌─────────────────────────────────┐    │
│  │  ELK Stack                       │    │
│  │  • Elasticsearch                 │    │
│  │  • Logstash                      │    │
│  │  • Kibana                        │    │
│  └──────────┬──────────────────────┘    │
│             │                             │
│  Tracing                                   │
│  ┌─────────────────────────────────┐    │
│  │  Jaeger / OpenTelemetry          │    │
│  │  • Request Tracing               │    │
│  │  • Performance Analysis          │    │
│  │  • Dependency Mapping            │    │
│  └──────────┬──────────────────────┘    │
│             │                             │
│  Alerting                                  │
│  ┌─────────────────────────────────┐    │
│  │  AlertManager                    │    │
│  │  • Threshold Alerts              │    │
│  │  • Anomaly Detection             │    │
│  │  • Escalation Policies           │    │
│  └──────────┬──────────────────────┘    │
│             │                             │
│  Dashboards                                │
│  ┌─────────────────────────────────┐    │
│  │  Grafana                         │    │
│  │  • System Health                 │    │
│  │  • Game Analytics                │    │
│  │  • Business Metrics              │    │
│  └─────────────────────────────────┘    │
│                                           │
└──────────────────────────────────────────┘
```

### 7.4 Scalability Strategy

| Component | Scaling Strategy | Trigger | Target |
|-----------|-----------------|---------|--------|
| **Game Servers** | Horizontal (K8s HPA) | CPU > 70% | < 2s scale time |
| **Database** | Read Replicas | Queries > 5k/s | < 100ms latency |
| **Cache** | Redis Cluster | Memory > 80% | < 1ms latency |
| **CDN** | Geographic Distribution | Latency > 50ms | Global < 50ms |
| **Load Balancer** | Multi-region | Requests > 10k/s | 99.99% uptime |

---


---

## Glossary

| Term | Definition |
|------|------------|
| **ECS** | Entity Component System - architectural pattern separating data from behavior |
| **SoA** | Structure of Arrays - memory layout storing each component field in separate arrays |
| **AoS** | Array of Structures - memory layout storing complete objects in array (not used) |
| **Cache Line** | 64-byte unit of memory loaded by CPU cache (L1/L2/L3) |
| **Spatial Locality** | Property where related data is stored physically close in memory |
| **Temporal Locality** | Property where recently accessed data is likely to be accessed again soon |
| **GC** | Garbage Collection - automatic memory management in V8/JavaScript |
| **Frame Allocator** | Pre-allocated buffer for temporary per-frame data (zero GC pressure) |
| **Object Pool** | Reusable object cache to minimize allocation pressure |
| **IPC** | Inter-Process Communication - communication between Electron main and renderer |
| **WebGPU** | Next-generation web graphics API, successor to WebGL |
| **PBR** | Physically Based Rendering - realistic material rendering |
| **LOD** | Level of Detail - reduced complexity for distant objects |
| **HPA** | Horizontal Pod Autoscaler - Kubernetes automatic scaling |
| **CSP** | Content Security Policy - browser security headers |
| **RBAC** | Role-Based Access Control - authorization model |
| **WebRTC** | Web Real-Time Communication - P2P networking |
| **CDN** | Content Delivery Network - distributed asset hosting |
| **JWT** | JSON Web Token - stateless authentication |
| **DTM** | Delta Time - time elapsed between frames |
| **CCU** | Concurrent Users - simultaneously connected players |
| **QPS** | Queries Per Second - database throughput metric |
| **GC** | Garbage Collection - automatic memory management |

---

## Appendices

### Appendix A: Performance Benchmarks

| Benchmark | Target | Measured | Status |
|-----------|--------|----------|---------|
| Entity Iteration (10k) | < 1ms | - | Pending |
| Draw Calls | < 500 | - | Pending |
| Physics Bodies (1k) | < 2ms | - | Pending |
| Network Sync (100 players) | < 50ms | - | Pending |
| Asset Load (100MB) | < 3s | - | Pending |

### Appendix B: API Examples

```typescript
// Creating an entity with components
const player = engine.entities.create()
  .add(Transform, { position: [0, 0, 0] })
  .add(Health, { max: 100, current: 100 })
  .add(PlayerController, { speed: 5.0 });

// Defining a system
class MovementSystem extends System {
  query = Query.all(Transform, Velocity);

  update(deltaTime: number) {
    for (const [entity, transform, velocity] of this.query) {
      transform.position.x += velocity.x * deltaTime;
      transform.position.y += velocity.y * deltaTime;
      transform.position.z += velocity.z * deltaTime;
    }
  }
}

// Registering a plugin
engine.plugins.register({
  name: 'CustomPhysics',
  version: '1.0.0',
  onInit(engine) {
    engine.physics.setBackend(new CustomPhysicsEngine());
  }
});
```

### Appendix C: Configuration Examples

```typescript
// Engine configuration
const config: EngineConfig = {
  renderer: {
    backend: 'webgpu',
    antialias: true,
    shadows: true,
    maxDrawCalls: 500
  },
  physics: {
    engine: 'rapier',
    gravity: [0, -9.81, 0],
    timestep: 1/60
  },
  networking: {
    transport: 'websocket',
    tickRate: 60,
    interpolationDelay: 100
  },
  performance: {
    targetFPS: 60,
    adaptiveQuality: true,
    memoryLimit: 600
  }
};
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Nov 2024 | Engineering Team | Initial draft |
| 2.0 | Nov 2025 | Engineering Team | Integration architecture update: Added Engine Integration Layer (§4), Development Tools & Debugging (§9), Threading & Concurrency (§10), 6 new ADRs (ADR-006 through ADR-011) |
| 3.0 | Nov 2025 | Engineering Team | Cache architecture update: Added Component Storage Strategy (§2.1.4), Cache-Aware Iteration Patterns (§2.1.5), Component Design Guidelines (§2.1.6), 2 new ADRs (ADR-012: SoA Typed Arrays, ADR-013: Sequential Iteration), expanded glossary with cache terms |
| 4.0 | Nov 2025 | Engineering Team | Memory management update: Added GC Budget (§6.2.3), Memory Management Patterns (§6.3), Object Pooling, Frame Allocators, GC Monitoring, ADR-014 (Object Pooling and Frame Allocators), updated RAM/VRAM budgets |

## Review and Approval

- [ ] Technical Lead
- [ ] Engineering Team
- [ ] Architecture Board
- [ ] Product Management

---

*End of High-Level Design Document*