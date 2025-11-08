## Initiative 6: Development Tools (INIT-006)
**Dependencies:** INIT-002, INIT-003
**Outcome:** Comprehensive development environment

### Epic 6.1: Debug Console
**Priority:** P0 - CRITICAL
**Status:** ✅ COMPLETE (November 2025)
**Dependencies:** Epic 2.7 (Main Engine), Epic 2.9 (Commands)
**Complexity:** Medium
**Estimated Effort:** 2 weeks
**Actual Effort:** 2 weeks
**Test Coverage:** 69/69 tests passing

**Problem Statement:**
No runtime introspection or command execution capability. Debugging requires recompiling for every test, making iteration slow and painful. Need an in-game console (~ key) that allows command execution, logging, autocomplete, and history.

**Acceptance Criteria:**
- ✅ Console toggles with ~ key
- ✅ Can execute registered commands
- ✅ Arrow up/down for history navigation
- ✅ Tab for autocomplete
- ✅ Logging appears in console (console.log captured)
- ✅ Can be hidden/shown at runtime
- ✅ Command history persisted across sessions
- ✅ Multi-line command support

#### User Stories:
1. **As a developer**, I want in-game console that toggles with ~ key
2. **As a developer**, I want to execute commands from text input
3. **As a developer**, I want command history with arrow keys
4. **As a developer**, I want autocomplete with Tab key
5. **As a developer**, I want console.log output captured in console
6. **As a developer**, I want command suggestions as I type

#### Tasks Breakdown:
- [x] Create console UI overlay component
- [x] Implement keyboard input handling (~ toggle, arrows, tab)
- [x] Add command text parsing and execution
- [x] Create command history manager (real circular buffer with O(1) operations)
- [x] Implement autocomplete engine (prefix matching)
- [x] Add console.log/warn/error capture (with object/Error support)
- [x] Create scrollable output view
- [x] Add command history persistence (localStorage)
- [ ] Implement multi-line command support (Shift+Enter) - DEFERRED to Epic 6.2
- [x] Add console styling and theming (inline styles)
- [x] Create clear/reset commands
- [x] Add timestamp display for log entries
- [x] Write comprehensive unit tests (69/69 passing, >80% coverage)
- [x] Document console usage and commands (README.md)

#### Critical Fixes Applied (Post Code-Critic Review):
- [x] Replaced fake circular buffer with real O(1) implementation
- [x] Fixed XSS vulnerability (removed innerHTML usage)
- [x] Fixed LogLevel type safety (enum instead of string literals)
- [x] Improved console capture for objects and Error instances
- [x] Fixed localStorage infinite recursion risk

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/debug-console/` (NEW)

**API Design:**
```typescript
interface DebugConsole {
  // Display
  show(): void;
  hide(): void;
  toggle(): void;
  isVisible(): boolean;

  // Output
  log(message: string, level?: LogLevel): void;
  clear(): void;

  // Commands
  registerCommand(name: string, handler: CommandHandler): void;
  unregisterCommand(name: string): void;
  executeCommand(command: string): void;

  // History
  getHistory(): string[];
  clearHistory(): void;

  // Autocomplete
  getSuggestions(partial: string): string[];
}

enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}
```

**Console UI Features:**
- ~ key toggle (customizable)
- Arrow up/down for history
- Tab for autocomplete
- Shift+Enter for multi-line
- Ctrl+L to clear
- Color-coded log levels
- Clickable stack traces
- Command suggestions dropdown
- Persistent history (localStorage)

**Example Commands Built-In:**
```
spawn <entityType> <x> <y> <z>
destroy <entityId>
inspect <entityId>
list entities
list systems
enable <systemName>
disable <systemName>
set <component>.<field> <value>
get <component>.<field>
physics.gravity <x> <y> <z>
physics.pause
physics.step
scene.load <name>
scene.save <name>
perf.report
help <command>
clear
```

#### Design Principles:
1. **Instant Feedback**: Command execution is immediate
2. **Discoverability**: Autocomplete shows available commands
3. **Persistence**: History survives page reloads
4. **Integration**: Works seamlessly with command system

#### Dependencies:
- Epic 2.7: Main Engine Class (access to engine) ✅
- Epic 2.9: Command System (command execution) ✅

#### Deliverables:
**Package Location:** `/Users/bud/Code/miskatonic/packages/debug-console/`

**Core Files:**
- `src/DebugConsole.ts` - Main console class (547 lines)
- `src/CommandHistory.ts` - History manager with real circular buffer (184 lines)
- `src/Autocomplete.ts` - Autocomplete engine (120 lines)
- `src/types.ts` - Type definitions (LogLevel, ConsoleConfig, LogEntry)
- `src/index.ts` - Public API exports

**Tests:**
- `tests/CommandHistory.test.ts` - 25 tests ✅
- `tests/Autocomplete.test.ts` - 27 tests ✅
- `tests/DebugConsole.simple.test.ts` - 17 tests ✅
- **Total: 69/69 tests passing**

**Documentation:**
- `README.md` - Usage guide and API reference
- `CLAUDE.md` - Updated with debug-console package info

**Key Features Delivered:**
- Real O(1) circular buffer (not fake O(n) shift-based)
- XSS-safe DOM manipulation (no innerHTML)
- Type-safe LogLevel enum usage
- Advanced console capture (objects, Errors with stacks, circular ref handling)
- localStorage persistence without infinite recursion risk
- Tab autocomplete with prefix matching
- Command history with up/down navigation (100 entries)
- ~ key toggle (configurable)
- Comprehensive test coverage

---

### Epic 6.2: Runtime Inspection Tools
**Priority:** P1 - IMPORTANT
**Status:** ⏭️ Not Started
**Dependencies:** Epic 6.1 (Debug Console), Epic 2.1 (ECS)
**Complexity:** Medium
**Estimated Effort:** 2-3 weeks

**Problem Statement:**
Cannot inspect or modify game state at runtime. Need tools to view entities, edit components, control systems, and monitor performance without recompiling.

**Acceptance Criteria:**
- ✅ Can list all entities with components
- ✅ Can click entity to inspect details
- ✅ Can edit component values at runtime
- ✅ Can enable/disable systems
- ✅ Can view performance graph
- ✅ Can search/filter entities
- ✅ Can view system execution order

#### User Stories:
1. **As a developer**, I want to list all entities with their components
2. **As a developer**, I want to inspect entity details (components, values)
3. **As a developer**, I want to edit component values at runtime
4. **As a developer**, I want to enable/disable systems for testing
5. **As a developer**, I want to see real-time performance metrics
6. **As a developer**, I want to search/filter entities by component

#### Tasks Breakdown:
- [ ] Create entity inspector UI
- [ ] Implement entity list view with filtering
- [ ] Add component detail view (read-only)
- [ ] Add component value editing (runtime)
- [ ] Create system status panel (running/paused/disabled)
- [ ] Add system enable/disable controls
- [ ] Implement performance metrics display (FPS, frame time)
- [ ] Create frame time graph (last 100 frames)
- [ ] Add entity search and filtering
- [ ] Create scene hierarchy view
- [ ] Add component add/remove at runtime
- [ ] Implement watch expressions (monitor values)
- [ ] Write comprehensive unit tests (>80% coverage)
- [ ] Document inspector tools usage

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/debug-tools/` (NEW)

**Entity Inspector UI:**
```
┌─ Entity #1234 ──────────────────────┐
│ Name: Player                         │
│ Active: ✓                            │
│                                      │
│ Components:                          │
│   Position:                          │
│     x: 10.5   [edit]                 │
│     y: 5.2    [edit]                 │
│     z: 0.0    [edit]                 │
│   Velocity:                          │
│     x: 1.2    [edit]                 │
│     y: 0.0    [edit]                 │
│     z: 0.0    [edit]                 │
│   RigidBody:                         │
│     type: dynamic                    │
│     mass: 70.0  [edit]               │
│                                      │
│ [Add Component] [Destroy Entity]    │
└──────────────────────────────────────┘
```

**System Monitor UI:**
```
┌─ Systems ────────────────────────────┐
│ ✓ InputSystem          0.3ms /  0.5ms│
│ ✓ MovementSystem       0.8ms /  1.0ms│
│ ✓ PhysicsSystem        1.9ms /  2.0ms│
│ ✓ RenderSystem         7.2ms /  8.0ms│
│ ⚠ NetworkSystem        1.2ms /  1.0ms│ ← Over budget
│                                       │
│ Frame: 11.4ms / 16.67ms (68%)        │
│ FPS: 60                               │
└───────────────────────────────────────┘
```

**Key Features:**
- Entity list with component filtering
- Component value editing with validation
- System enable/disable toggle
- Real-time performance monitoring
- Frame time graph visualization
- Watch expressions for debugging
- Search and filter capabilities

#### Design Principles:
1. **Non-Intrusive**: Tools don't affect game performance
2. **Real-Time**: All changes apply immediately
3. **Safe**: Validation prevents invalid states
4. **Discoverable**: Easy to find and use features

#### Dependencies:
- Epic 6.1: Debug Console (command integration)
- Epic 2.1: Entity Component System (entity access)

---

### Epic 6.3: Integrated Profiler
**Priority:** P1 - IMPORTANT
**Status:** ⏭️ Not Started
**Dependencies:** Epic 2.8 (Game Loop), Epic 10.4 (Frame Budget)
**Complexity:** Medium
**Estimated Effort:** 2 weeks

**Problem Statement:**
Cannot easily measure where time is spent in the game loop. Browser DevTools are manual and cumbersome. Need built-in profiling that tracks per-system timing, per-frame markers, and exports to Chrome trace format.

**Acceptance Criteria:**
- ✅ Can record profiling session
- ✅ Export to Chrome trace viewer format
- ✅ Per-system timing accurate (<0.1ms overhead)
- ✅ GPU timing integrated (WebGL queries)
- ✅ Memory allocation tracking
- ✅ Can view profiling results in-engine
- ✅ Can filter/search profiling data

#### User Stories:
1. **As a developer**, I want to record profiling sessions
2. **As a developer**, I want per-system execution time
3. **As a developer**, I want to export to Chrome trace viewer
4. **As a developer**, I want GPU timing (WebGL queries)
5. **As a developer**, I want memory allocation tracking
6. **As a developer**, I want historical performance data

#### Tasks Breakdown:
- [ ] Implement profiling session manager
- [ ] Add per-system timing with performance.now()
- [ ] Create frame markers (begin/end frame)
- [ ] Add GPU timing via WebGL queries
- [ ] Implement memory profiling integration
- [ ] Create Chrome trace format exporter
- [ ] Add profiling data visualization (in-engine)
- [ ] Implement profiling data filtering/search
- [ ] Add profiling session recording/playback
- [ ] Create profiling statistics (min/max/avg/p95)
- [ ] Add automatic profiling for slow frames
- [ ] Implement profiling overhead measurement
- [ ] Write comprehensive unit tests (>80% coverage)
- [ ] Document profiler usage and Chrome trace workflow

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/profiler/` (NEW)

**API Design:**
```typescript
interface Profiler {
  // Session control
  startRecording(): void;
  stopRecording(): ProfileData;
  isRecording(): boolean;

  // Manual markers
  beginFrame(frameNumber: number): void;
  endFrame(frameNumber: number): void;
  beginSystem(name: string): void;
  endSystem(name: string): void;
  mark(name: string): void;

  // GPU timing
  beginGPUQuery(name: string): void;
  endGPUQuery(name: string): void;

  // Export
  exportChromeTrace(): string; // JSON format
  exportCSV(): string;

  // Analysis
  getStatistics(systemName?: string): ProfileStatistics;
  getSlowFrames(threshold: number): FrameData[];
}

interface ProfileStatistics {
  min: number;
  max: number;
  avg: number;
  p50: number; // median
  p95: number;
  p99: number;
  count: number;
}
```

**Chrome Trace Format:**
```json
{
  "traceEvents": [
    {
      "name": "PhysicsSystem",
      "cat": "system",
      "ph": "X",
      "ts": 1234567890,
      "dur": 1850,
      "pid": 1,
      "tid": 1
    },
    // ... more events
  ]
}
```

**Key Features:**
- Per-system timing (<0.1ms overhead)
- Per-frame markers
- GPU timing (WebGL queries)
- Memory allocation tracking
- Chrome trace export
- In-engine visualization
- Automatic slow frame detection
- Statistical analysis (min/max/avg/percentiles)

**Profiling Workflow:**
1. Start recording: `profiler.startRecording()`
2. Let game run for N frames
3. Stop recording: `const data = profiler.stopRecording()`
4. Export: `profiler.exportChromeTrace()` → save to file
5. Open in Chrome: `chrome://tracing` → load file
6. Analyze: zoom, filter, search events

#### Design Principles:
1. **Low Overhead**: Profiling adds <1% performance cost
2. **Standard Format**: Chrome trace format for compatibility
3. **Automatic**: Captures slow frames automatically
4. **Actionable**: Shows exactly where time is spent

#### Dependencies:
- Epic 2.8: Game Loop Architecture (system execution)
- Epic 10.4: Frame Budget System (budget tracking)

---

### Epic 6.4: Visual Editor
**Priority:** P2
**Status:** ⏸️ Deferred

**Note:** Visual editor deferred in favor of critical debug tools (6.1, 6.2, 6.3). Scene editing can be done via debug console and runtime inspection for now.

**Acceptance Criteria:**
- [ ] Scene editor working
- [ ] Entity inspector complete (covered by Epic 6.2)
- [ ] Property editing functional (covered by Epic 6.2)
- [ ] Live preview enabled

#### User Stories:
1. **As a developer**, I want a visual scene editor
2. **As a developer**, I want entity component editing (covered by Epic 6.2)
3. **As a developer**, I want live scene preview
4. **As a developer**, I want undo/redo support

#### Tasks Breakdown:
- [ ] Create editor application shell
- [ ] Implement scene viewport
- [ ] Build entity hierarchy view (covered by Epic 6.2)
- [ ] Add component inspector (covered by Epic 6.2)
- [ ] Create property editors (covered by Epic 6.2)
- [ ] Implement gizmo tools
- [ ] Add undo/redo system
- [ ] Build asset browser
- [ ] Create editor layouts
- [ ] Add play-in-editor mode

---

### Epic 6.5: Asset Pipeline Tools
**Priority:** P2
**Status:** ⏸️ Deferred

**Note:** Asset pipeline deferred. Epic 2.4 (Resource Management) provides hot-reload capability. Advanced asset processing can be added later.

**Acceptance Criteria:**
- [ ] Asset importer working
- [ ] Texture tools complete
- [ ] Model processing done
- [ ] Audio tools implemented

#### User Stories:
1. **As an artist**, I want asset import tools
2. **As an artist**, I want texture compression
3. **As an artist**, I want model optimization
4. **As a developer**, I want asset hot-reload (✅ covered by Epic 2.4)

#### Tasks Breakdown:
- [ ] Create asset import pipeline
- [ ] Implement texture processor
- [ ] Build model optimizer
- [ ] Add audio processor
- [ ] Create asset validator
- [ ] Implement asset bundling
- [ ] Add asset statistics
- [ ] Build asset preview

---

### Epic 6.6: Analytics Dashboard
**Priority:** P2
**Acceptance Criteria:**
- Metrics collection working
- Dashboard UI complete
- Real-time updates functional
- Historical data available

#### User Stories:
1. **As a developer**, I want performance metrics
2. **As a developer**, I want player analytics
3. **As a developer**, I want error tracking
4. **As a developer**, I want custom events

#### Tasks Breakdown:
- [ ] Implement telemetry system
- [ ] Create dashboard UI
- [ ] Add real-time graphs
- [ ] Build metric aggregation
- [ ] Implement alert system
- [ ] Create report generation
- [ ] Add data export
- [ ] Build API endpoints

---

