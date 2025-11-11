# Editor Architecture Decisions

**Date:** November 8, 2025
**Status:** Planning Phase

This document outlines key architectural decisions for the Miskatonic Engine editor system.

---

## Core Architecture Decision: Live Editor (Option 1)

**Decision:** The editor IS the running game, not a separate tool.

### What This Means

- Editor UI (React/Solid) renders on top of the live game canvas
- The ECS world is always live, systems are always ticking (or paused)
- "Edit mode" = systems paused or running at slow speed
- "Play mode" = full speed execution
- Switch modes by serializing/deserializing world state
- Gizmos and debug visualization use the same rendering pipeline (different layer)

### Why This Makes Sense

**Aligns with existing architecture:**
- Debug console (Epic 6.1) already executes commands in live game
- Command system built for runtime manipulation
- Hot-reload is a core feature (shaders, assets)
- Performance budget can't afford duplicate worlds in Electron

**Proven patterns:**
- Physics has deterministic serialization (Epic 4.5) - perfect for edit/play switching
- Network has state serialization (Epic 5.2)
- Everything already runs in renderer process

**Industry precedent:**
- Unity and Unreal both use this model
- Natural for engines with live visual feedback

---

## Package Structure

**Decision:** Create `packages/editor` as a new workspace package.

### Structure
```
packages/
├── editor/          # NEW - Editor application
│   ├── src/
│   │   ├── ui/             # React/Solid components
│   │   ├── tools/          # Gizmos, selection, viewport camera
│   │   ├── panels/         # Hierarchy, inspector, asset browser
│   │   └── index.ts        # Editor entry point
│   ├── tests/
│   └── package.json
├── core/            # Existing - no changes needed
├── ecs/             # Existing - stays pure
├── rendering/       # Existing - stays pure
└── ...
```

### Dependency Direction

- `packages/editor` imports from engine packages (one-way dependency)
- Engine packages remain unaware of the editor
- Engine stays pure - no "editor mode" awareness

**Principle:** The editor controls the engine from outside. The engine has no concept of being in an editor.

---

## Editor Tools & API Requirements

### Essential Editor Tools

**Core manipulation:**
- Scene hierarchy viewer
- Entity inspector (component property editor)
- Viewport with transform gizmos
- Asset browser

**Development/debugging:**
- Performance profiler
- Physics visualizer
- Network debugger
- Console (already exists - Epic 6.1)

**Content creation:**
- Material editor
- Prefab system
- Scene save/load

### Critical API Gaps

The following systems need to be built to enable editor development:

**1. Component Reflection/Metadata System (CRITICAL)**
- Editor needs to know what components exist
- What properties each component has
- Property types, ranges, defaults, constraints
- Currently: TypeScript types disappear at runtime

**2. Serialization System (CRITICAL)**
- Scene save/load (needed for edit/play mode switching)
- Prefab system
- Undo/redo support
- Handle entity references (parent/child relationships)

**3. Editor-Only Systems (HIGH)**
- Gizmo rendering (move/rotate/scale manipulators)
- Selection management (what entities are selected)
- Editor camera (separate from game camera)
- Ray picking (click to select entities in viewport)

**4. Profiling/Instrumentation (MEDIUM)**
- Performance counters
- Memory tracking
- Frame timing breakdown by system

**5. Visual Debugging (MEDIUM)**
- Debug drawing API (lines, boxes, spheres)
- Physics visualization (colliders, joints, forces)
- Network visualization (state sync, latency)

---

## Serialization Strategy

**Decision:** JSON in development, binary at build/ship time.

### Development (Editor)
- Save scenes as JSON (human-readable)
- Diff-able in git
- Easy to debug and manually edit if needed
- Merge conflicts are manageable

### Production (Shipped Games)
- Convert JSON to compact binary format at build time
- Faster parsing, smaller file size
- Harder to tamper with
- Optional: encryption or compression

### Precedent
- Unity: YAML in editor, binary at runtime
- Unreal: Text-based .uasset files, binary serialization
- This is industry standard practice

---

## Component Reflection Strategy

**Decision:** Use code generation to create component metadata.

### The Problem

TypeScript types are compile-time only. At runtime, JavaScript doesn't know:
- What properties a component has
- What types those properties are
- What defaults, ranges, or constraints exist

But the editor inspector needs this information to display property editors.

### Why Code Generation

**Benefits:**
- No TypeScript experimental features required
- No runtime overhead from decorators
- Can be fully automated in the build pipeline
- Can generate rich metadata (types, constraints, descriptions)
- Can validate component structure during generation
- Generates type-safe schemas for editor consumption

**vs. Decorators:**
- No "magic" - explicit and clear
- No dependency on experimental TypeScript features
- Can still annotate intent via JSDoc comments

**vs. Manual Registration:**
- No duplication - single source of truth
- Can't forget to update schemas
- Less boilerplate

### Implementation Approach

**Generator tool:**
- Scans TypeScript component files
- Parses AST to extract property names and types
- Reads JSDoc comments for metadata (ranges, descriptions, editor hints)
- Generates TypeScript schema files and/or JSON

**Metadata from JSDoc:**
```typescript
class Transform {
  /**
   * World position of the entity
   * @min -1000
   * @max 1000
   */
  position: Vec3;

  /**
   * Rotation in euler angles
   * @editor rotation-gizmo
   */
  rotation: Vec3;

  /**
   * @min 0.001
   * @default [1, 1, 1]
   */
  scale: Vec3;
}
```

**Build Integration:**
- Run during `npm run dev` in watch mode
- Run during `npm run build`
- Could be standalone: `npm run generate:metadata`
- Per-package generation for monorepo structure

**Output Options:**
- TypeScript files: `packages/*/generated/metadata.ts` (type-safe in editor)
- JSON files: `packages/*/generated/metadata.json` (language-agnostic)
- Both?

**Git Strategy (TBD):**
- Gitignore generated files (cleaner history, forces generation)
- Commit generated files (no build step needed for CI/CD)

---

## Next Steps & Open Questions

### Immediate Priorities

1. **Prove UI + Canvas Coexistence**
   - Integrate React/Solid with running game
   - Handle input routing (UI vs. viewport)
   - Ensure no performance degradation

2. **Build Serialization Foundation**
   - Scene save/load (JSON format)
   - Entity serialization with component data
   - Handle entity references (parents, prefabs)

3. **Implement Code Generator**
   - Component metadata extraction
   - Schema generation
   - Build pipeline integration

4. **Basic Editor UI**
   - Scene hierarchy showing live ECS world
   - Entity selection
   - Basic inspector (read-only to start)

5. **Transform Gizmos**
   - Move/rotate/scale manipulators
   - Ray picking for selection
   - Visual feedback

### Open Questions

**Code Generator:**
- Output format: TypeScript, JSON, or both?
- Gitignore or commit generated files?
- How deep should validation go during generation?

**UI Framework:**
- React or Solid? (need to decide)
- State management strategy?
- How to handle performance with large scenes?

**Serialization Format:**
- JSON structure for scenes?
- How to handle entity ID references?
- Versioning strategy for format changes?

**Editor UX:**
- Edit mode vs. play mode switching UX?
- Undo/redo implementation approach?
- Multi-viewport support from the start?

---

## Principles to Maintain

1. **Engine Purity:** Engine packages stay unaware of the editor
2. **Automation:** Anything that can be automated, should be
3. **Live Feedback:** Changes should be visible immediately when possible
4. **Performance:** Editor must maintain 60 FPS target
5. **Alpha Mindset:** Break APIs freely to discover the right design

---

## Related Documentation

- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - Current implementation status
- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) - Epic roadmap
- [ENGINE_DESIGN.md](ENGINE_DESIGN.md) - Core design principles
- [HLD.md](HLD.md) - High-Level Design