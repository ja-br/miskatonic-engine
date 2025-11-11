# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Breaking Changes Policy

**THIS IS ALPHA SOFTWARE (v0.x.x). BREAKING CHANGES ARE EXPECTED AND NECESSARY.**

### Alpha Development Philosophy
- Version 0.x.x means NO stability guarantees
- Break APIs freely to discover the right design
- Remove technical debt immediately, don't accumulate it
- If something doesn't break during alpha, it won't improve

### What This Means
- **NO backward compatibility layers or shims**
- **NO deprecated API warnings** - just remove bad APIs
- **NO hesitation to refactor** - break early and often
- **Update all call sites** when APIs change
- **Remove old code** that no longer compiles

### Code Review Guidelines
- Breaking changes that improve design are GOOD
- Maintaining backward compatibility in alpha is a BUG
- Focus on getting the API right, not keeping it stable

### Enforcement
Code reviews MUST reject any PR that:
- Mentions "backward compatibility" positively
- Adds transition helpers or migration code
- Keeps old API alongside new API
- Uses `@deprecated` JSDoc tags
- Has patterns like `legacyFoo()`, `oldBar()`, `compatibilityMode`

---

## Project Overview

Miskatonic Engine is a comprehensive game engine built on Electron for creating high-quality desktop 3D games with sophisticated multiplayer capabilities. Full-stack solution integrating client and server architecture, combining web technologies with native desktop applications.

## Architecture

```
Electron Main Process (Native APIs, Window Management, IPC)
    ↓
Renderer Process (Game Client)
    ├─ Game Logic (ECS, State Management)
    ├─ Rendering (WebGPU)
    ├─ Physics (Rapier/Cannon-es/Box2D)
    ├─ Input (Keyboard, Mouse, Gamepad)
    └─ Audio (Web Audio API)
    ↓
Network Layer (WebSocket/WebRTC)
    ↓
Game Server (NestJS)
    ├─ Game State (Authoritative)
    ├─ Matchmaking, Social, Economy
    └─ Analytics
    ↓
Database Layer (MongoDB, Redis, Elasticsearch)
```

### Key Patterns
- **ECS (Entity Component System)**: Core architecture pattern
- **Server-Authoritative**: Game state managed on server for cheat prevention
- **Client Prediction**: Responsive controls with lag compensation
- **Delta Compression**: Efficient state synchronization at 60 tick rate

### Tech Stack
- **Frontend**: Electron, TypeScript, WebGPU, Vite/Webpack 5
- **Backend**: Node.js, NestJS, Socket.io, WebRTC
- **Databases**: MongoDB, Redis, Elasticsearch
- **Infrastructure**: Docker, Kubernetes, AWS/GCP, CloudFlare CDN
- **Target**: 60 FPS on mid-range devices, 100+ concurrent players, <50ms latency

## Workspace Structure

Monorepo using npm workspaces. Each package is independently testable and buildable:

```
miskatonic-engine/
├── packages/
│   ├── main/          # Electron main process
│   ├── preload/       # Security boundary (contextBridge)
│   ├── renderer/      # Game UI and client engine
│   ├── shared/        # Shared types and constants
│   ├── core/          # Core engine integration
│   ├── ecs/           # Entity Component System
│   ├── physics/       # Physics abstraction layer
│   ├── rendering/     # Rendering pipeline (WebGPU)
│   ├── network/       # State synchronization
│   ├── events/        # Event bus system
│   ├── resources/     # Asset management
│   └── debug-console/ # In-game developer console
├── config/            # Build configurations
├── scripts/           # Development scripts
├── tests/             # Integration and E2E tests
└── docs/              # Architecture and API docs
```

## Development Commands

### Essential Commands

```bash
# Installation
npm install              # Install all dependencies

# Development
npm run dev              # Start full dev environment
npm run build            # Build all packages for production

# Testing
npm test                 # Run all tests (Vitest)
npm test -- --coverage   # Run with coverage report
npm test --workspace=@miskatonic/physics  # Test specific package

# Code Quality
npm run lint             # Lint TypeScript
npm run format           # Format with Prettier
npm run typecheck        # Check TypeScript types

# Utilities
npm run clean            # Clean build artifacts
```

### Package-Specific Work

```bash
# Test specific package
npm test --workspace=@miskatonic/<package>

# Build specific package
npm run build --workspace=@miskatonic/<package>

# Work from package directory
cd packages/physics
npm test
npm run build
```

Example:
```typescript
// Use defaults
const engine = new MiskatonicEngine();

// Or swap implementations
const engine = new MiskatonicEngine({
  physics: new CustomPhysicsEngine(),
  renderer: new CustomRenderer(),
  network: new CustomTransport()
});
```

### Package Standards
1. Export clean public API through `index.ts`
2. Hide implementation details (use internal/ directory)
3. Provide TypeScript types for all public APIs
4. Include comprehensive tests (>80% coverage required)
5. Follow "batteries included, swappable preferred" philosophy

### Documentation Standards

**CRITICAL: Package directories should contain ONLY code and minimal documentation.**

#### Package Documentation Rules

1. **Allowed in packages/**:
   - `README.md` - Package overview and API usage (max 250 lines)
   - `COMMANDS.md` or similar - Package-specific API reference (if needed)
   - Source code and tests only

2. **NEVER add to packages/**:
   - Epic tracking files (EPIC_*.md) → Goes in `planning/epics/`
   - Design documents → Goes in `planning/` or `docs/`
   - Migration guides → Goes in `docs/migrations/`
   - Architecture documents → Goes in `docs/` or root
   - Progress/status reports → Goes in `planning/`
   - Phase summaries → Goes in `planning/`
   - Roadmaps → Goes in `planning/`
   - Performance analysis → Goes in `planning/`
   - Usage guides (non-API) → Goes in `docs/guides/`

3. **If you're about to create a .md file in packages/**, ask yourself:
   - Is this tracking progress? → `planning/`
   - Is this a design doc? → `planning/` or `docs/`
   - Is this a migration guide? → `docs/migrations/`
   - Is this a usage guide? → `docs/guides/`
   - Is this API documentation? → Can stay IF under 100 lines, otherwise `docs/api/`

#### What NOT to Include in READMEs

1. **Engineering History**
   - ❌ "Critical Fixes Applied" sections with implementation details
   - ❌ Detailed test coverage breakdowns (just show total)
   - ❌ Roadmap/epic tracking (belongs in project docs)
   - ❌ "Production Readiness" sections with architectural notes
   - ✅ Keep: High-level feature list, essential usage patterns

2. **Redundant API Documentation**
   - ❌ Listing every method with brief descriptions
   - ❌ Showing full TypeScript signatures (IDE provides this)
   - ❌ Documenting obvious methods (getStats(), clear(), etc.)
   - ✅ Keep: Link to TypeDoc, ultra-brief grouped list if needed

3. **Excessive Code Examples**
   - ❌ Complete game loops with requestAnimationFrame boilerplate
   - ❌ Full GLSL shader source code in Quick Start
   - ❌ Multiple examples showing the same pattern
   - ❌ Examples that repeat Quick Start in different sections
   - ✅ Keep: One minimal Quick Start, one advanced example, link to full examples

4. **Verbose Subsections**
   - ❌ 6+ subsections in "Usage Examples" or "Architecture"
   - ❌ Every subsection with full code example
   - ❌ Showing every configuration option inline
   - ✅ Keep: Group related concepts, show representative examples only

5. **Over-Explained Concepts**
   - ❌ "How X Works" with numbered implementation details
   - ❌ Multiple subsections explaining one feature (e.g., 4 subsections on query caching)
   - ❌ Repetitive good/bad comparisons (one is enough)
   - ✅ Keep: Brief explanation, one clear example, move deep-dives to guides

#### README Structure Guidelines

**Optimal structure:**
```
# Package Name
Brief description

## Features (bullet list)
## Installation
## Quick Start (minimal working example, <50 lines)
## Core Concepts (describe WHAT, not HOW)
## Usage (show HOW with concise examples)
## Performance/Best Practices (bullets + minimal code)
## API Reference (grouped list or link to TypeDoc)
## License
```

**Length targets:**
- Quick Start: 30-50 lines
- Total README: 150-250 lines
- If >300 lines, extract content to separate guides

#### Specific Anti-Patterns to Avoid

1. **The "Complete Game Loop" Bloat**
   - Don't show full render loops, game loops, or application scaffolding
   - Show just the package-specific parts
   - Reference complete examples in separate files

2. **The "Show Every Field" Bloat**
   - Don't console.log every stat field with comments
   - Show 2-3 key examples, list the rest

3. **The "Explain Implementation" Bloat**
   - Don't explain internal caching mechanisms in detail
   - Don't list all implementation features (mutex-protected, bounded timers, etc.)
   - Focus on user-facing behavior

4. **The "Repeat in Multiple Places" Bloat**
   - Don't show the same API pattern 3+ times (Quick Start, Core Concepts, Examples)
   - Show once, reference from elsewhere

5. **The "Configuration Showcase" Bloat**
   - Don't show 20+ lines of config with inline comments on every field
   - Show minimal config, reference TypeScript types for full options

#### When to Extract Content

Move to separate files when:
- Command system documentation >50 lines → COMMANDS.md
- Production configuration details → DEPLOYMENT.md or Production.md
- Detailed performance tuning → PERFORMANCE.md
- Multiple complete examples → examples/ directory
- Architecture deep-dives → ARCHITECTURE.md
- Migration guides → MIGRATION.md

#### README Review Checklist

Before finalizing a README, check:
- [ ] Quick Start is <50 lines
- [ ] Total length is <300 lines
- [ ] No redundant examples (same pattern shown 2+ times)
- [ ] No engineering history or "how we built it"
- [ ] No full API method listings (link to TypeDoc instead)
- [ ] No complete application scaffolding (game loops, etc.)
- [ ] Configuration examples are minimal
- [ ] Each code example teaches something new
- [ ] All subsections are necessary (not just "nice to have")
- [ ] Content that could be separate guides has been extracted

## Testing Requirements

From DEVELOPMENT_PLAN.md "Definition of Done":
- **Code coverage**: >80% required (enforced)
- **Unit tests**: Required for all new code
- **Integration tests**: Must pass before merge
- **Performance benchmarks**: Required for all engine systems
- **Cross-platform testing**: Windows, macOS, Linux

### Testing Best Practices
1. Unit tests should be fast and isolated
2. Integration tests can use real backends (e.g., Rapier physics)
3. Mock external dependencies in unit tests
4. Use descriptive test names that explain what's being tested
5. Test edge cases: null values, empty arrays, malformed input
6. Test error handling: verify graceful degradation

## Electron-Specific Considerations

### Process Separation
- **Main Process**: Window management, native APIs, file system, IPC, auto-updater
- **Renderer Process**: Game engine, ECS, rendering, physics, game logic
- **Communication**: Typed IPC channel with contextBridge for security

### Security Boundaries
- Context isolation: ALWAYS enabled
- Node integration: DISABLED in renderer (use preload scripts)
- Remote module: NEVER use (deprecated and insecure)
- WebSecurity: NEVER disable (even in development)

### Native Features
- Native file dialogs for save/load
- System tray integration
- Global keyboard shortcuts
- Auto-updater with delta patches
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

## Common Workflows

### Adding a New Package

1. Create package directory: `packages/my-package/`
2. Add `package.json` with workspace name: `@miskatonic/my-package`
3. Create `tsconfig.json` extending from root
4. Implement in `src/` with clean `index.ts` export
5. Add tests in `tests/` directory
6. Verify coverage: `npm run test:coverage`

### Running Tests During Development

```bash
# Watch mode for specific package
cd packages/physics
npm run test:watch

# Run specific test file
npm test -- tests/unit/physics/serialization.test.ts

# Debug with verbose output
npm test -- --reporter=verbose
```

### Quick Start Example

```typescript
import { MiskatonicEngine, SystemPhase } from '@miskatonic/core';

// Create engine
const engine = new MiskatonicEngine({
  fixedTimestep: 1/60,  // 60 FPS for physics
  maxFrameTime: 0.25    // Cap delta to avoid spiral of death
});

// Register systems
engine.registerSystem({
  name: 'MyGameSystem',
  phase: SystemPhase.UPDATE,
  update(dt: number) {
    // Game logic here
  }
});

// Start engine
engine.start();

// Access subsystems
engine.world;      // ECS World
engine.events;     // Event bus
engine.resources;  // Resource manager
engine.commands;   // Command system
```

## Key Documentation

- **ENGINE_DESIGN.md**: Detailed architecture and design decisions
- **DEVELOPMENT_PLAN.md**: Epic tracking and roadmap
- **Package READMEs**: Specific usage examples and API docs
- **TypeDoc**: Generated API documentation (`npm run docs`)
