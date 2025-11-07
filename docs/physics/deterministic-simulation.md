# Deterministic Physics Simulation

The Miskatonic Engine physics system is designed for **100% deterministic** simulation, ensuring identical results across different runs, platforms, and network conditions. This is critical for competitive multiplayer games, replay systems, and lockstep networking.

## What is Determinism?

A physics simulation is **deterministic** if:
- Given the same initial state
- And the same sequence of inputs
- It produces **exactly** the same output every time

This means:
- ✅ Same position, rotation, and velocity for every body
- ✅ Same collision events in the same order
- ✅ Same joint forces and constraints
- ✅ Bit-identical results across platforms (Windows, macOS, Linux)
- ✅ Reproducible results in replays and rollback

## Why Determinism Matters

### Competitive Multiplayer
- **Client-side prediction**: Predict physics locally without desync
- **Lockstep networking**: Synchronize by inputs only (minimal bandwidth)
- **Rollback netcode**: Rewind and fast-forward simulation on input misprediction

### Replay Systems
- **Minimal storage**: Store inputs only, not full state
- **Guaranteed playback**: Replay will match original game exactly
- **Debugging**: Reproduce bugs reliably from saved inputs

### Testing & QA
- **Reproducible bugs**: Bug reports include initial state + inputs
- **Automated testing**: Physics tests give same results every run
- **Cross-platform verification**: Ensure same behavior on all platforms

## Determinism Requirements

### 1. Fixed Timestep (CRITICAL)

**Always use fixed timestep** - variable timestep breaks determinism.

```typescript
const physicsWorld = await PhysicsWorld.create(engine, {
  timestep: 1 / 60, // Fixed 60 FPS physics (16.67ms per step)
  maxSubsteps: 4     // Allow up to 4 substeps per frame
});

// In game loop - use accumulator pattern (handled automatically by PhysicsWorld)
function gameLoop(deltaTime: number) {
  physicsWorld.step(deltaTime); // Internally uses fixed timestep
}
```

**Why it matters**: Floating point math is sensitive to step size. Different timesteps produce different numerical errors, breaking determinism.

### 2. Ordered Input Processing

Process inputs in **deterministic order** every frame.

```typescript
// ❌ BAD: Map iteration order is non-deterministic
for (const [entityId, input] of inputMap) {
  applyInput(entityId, input);
}

// ✅ GOOD: Sort by entity ID for deterministic order
const sortedInputs = Array.from(inputMap.entries()).sort((a, b) => a[0] - b[0]);
for (const [entityId, input] of sortedInputs) {
  applyInput(entityId, input);
}
```

### 3. Avoid Non-Deterministic Operations

Avoid these operations in physics simulation code:

#### Random Numbers
```typescript
// ❌ BAD: Math.random() is non-deterministic
const force = Math.random() * 100;

// ✅ GOOD: Use seeded RNG
import { SeededRNG } from '@miskatonic/core';
const rng = new SeededRNG(1234); // Deterministic seed
const force = rng.next() * 100;
```

#### Current Time
```typescript
// ❌ BAD: Date.now() is non-deterministic
const spawnTime = Date.now();

// ✅ GOOD: Use simulation time
const spawnTime = physicsWorld.serializeState().time;
```

#### Async Operations
```typescript
// ❌ BAD: Network I/O timing is non-deterministic
const data = await fetch('/api/config');
applyPhysicsConfig(data);

// ✅ GOOD: Fetch before simulation starts, then use deterministically
const config = await fetch('/api/config');
const physicsWorld = await PhysicsWorld.create(engine, config);
```

### 4. Consistent Floating Point Math

JavaScript uses IEEE 754 double-precision floats, which are **mostly** deterministic across platforms, but edge cases exist:

#### Math Functions
Most Math functions are deterministic:
- ✅ `Math.sqrt()`, `Math.sin()`, `Math.cos()`, `Math.atan2()`
- ✅ `+`, `-`, `*`, `/`, `Math.abs()`
- ⚠️ `Math.pow()` - May have tiny differences on some platforms
- ⚠️ `Math.exp()`, `Math.log()` - May have tiny differences

For critical calculations, consider using tolerance-based comparisons.

#### Denormalized Numbers
Very small numbers near zero can behave differently across platforms. Rapier physics handles this internally, but be aware when implementing custom physics code.

### 5. Rigid Body Creation Order

Create rigid bodies in **deterministic order** to ensure handle assignment is consistent:

```typescript
// ✅ GOOD: Deterministic creation order
const bodies = [
  { name: 'ground', type: RigidBodyType.STATIC, ... },
  { name: 'player', type: RigidBodyType.DYNAMIC, ... },
  { name: 'enemy1', type: RigidBodyType.DYNAMIC, ... },
].map(desc => physicsWorld.createRigidBody(desc));
```

### 6. Collision Event Handling

Collision events should be processed deterministically:

```typescript
// Collision events are returned in deterministic order from Rapier
const collisionEvents = physicsWorld.getCollisionEvents();

// Process all collision events
for (const event of collisionEvents) {
  // Handle collision (e.g., apply damage, play sound)
  handleCollision(event.bodyA, event.bodyB);
}
```

## State Serialization

The physics engine provides complete state serialization for determinism verification, save/load, and replay:

### Serializing State

```typescript
// Capture current physics state
const state = physicsWorld.serializeState();

// State includes:
// - All rigid body positions, rotations, velocities
// - All joint states and values
// - Simulation time and step count
// - Gravity vector

// Serialize to JSON
const json = JSON.stringify(state);
localStorage.setItem('savedGame', json);
```

### Deserializing State

```typescript
// Load saved state
const json = localStorage.getItem('savedGame');
const state = JSON.parse(json);

// Restore physics world
physicsWorld.deserializeState(state);

// Simulation will continue from this exact state
```

### State Snapshots

Use `PhysicsSnapshotManager` for automatic snapshot capture:

```typescript
import { PhysicsSnapshotManager } from '@miskatonic/physics';

const snapshotManager = new PhysicsSnapshotManager(physicsWorld, {
  maxSnapshots: 600,    // Keep 10 seconds at 60 FPS
  snapshotInterval: 1,  // Capture every frame
  autoCapture: true
});

// In game loop
function gameLoop(deltaTime: number) {
  physicsWorld.step(deltaTime);
  snapshotManager.tick(); // Auto-capture snapshots
}

// Rollback 60 frames (1 second)
snapshotManager.rollback(60);

// Export replay
const replay = snapshotManager.exportReplay();
localStorage.setItem('replay', JSON.stringify(replay));
```

## Determinism Verification

Use `PhysicsDeterminismVerifier` to test determinism:

```typescript
import { PhysicsDeterminismVerifier } from '@miskatonic/physics';

const verifier = new PhysicsDeterminismVerifier({
  tolerance: 1e-6 // 1 micrometer tolerance
});

// Run simulation twice with same initial state
const initialState = physicsWorld.serializeState();

// First run
physicsWorld.deserializeState(initialState);
for (let i = 0; i < 60; i++) {
  physicsWorld.step(1 / 60);
}
const state1 = physicsWorld.serializeState();

// Second run
physicsWorld.deserializeState(initialState);
for (let i = 0; i < 60; i++) {
  physicsWorld.step(1 / 60);
}
const state2 = physicsWorld.serializeState();

// Verify determinism
const result = verifier.verify(state1, state2);

if (result.isDeterministic) {
  console.log('✅ Physics is deterministic!');
} else {
  console.error('❌ Physics is NOT deterministic!');
  console.error(`Body mismatches: ${result.mismatchedBodies}`);
  console.error(`Max position error: ${result.maxPositionError}m`);
  console.error('Mismatches:', result.mismatches);
}
```

## Replay System

Use `PhysicsReplayPlayer` for replay functionality:

```typescript
import { PhysicsReplayPlayer, ReplayPlayerState } from '@miskatonic/physics';

// Record replay using snapshot manager
const snapshotManager = new PhysicsSnapshotManager(physicsWorld);

// ... play game ...

// Export replay
const replay = snapshotManager.exportReplay();

// Later: Load and play replay
const replayPlayer = new PhysicsReplayPlayer(physicsWorld, {
  playbackSpeed: 1.0,
  loop: false
});

replayPlayer.loadReplay(replay);
replayPlayer.play();

// In game loop
function gameLoop() {
  replayPlayer.tick();

  // Check if finished
  if (replayPlayer.getState() === ReplayPlayerState.FINISHED) {
    console.log('Replay finished!');
  }
}

// Controls
replayPlayer.pause();
replayPlayer.stepForward();  // Frame-by-frame
replayPlayer.stepBackward();
replayPlayer.seek(300);      // Jump to frame 300
replayPlayer.setPlaybackSpeed(2.0); // 2x speed
```

## Common Pitfalls

### 1. Sleeping Bodies

Body sleeping state is **not deterministic** by default - it depends on timing.

```typescript
// ❌ BAD: Sleep state affects behavior
if (physicsWorld.isSleeping(bodyHandle)) {
  // Don't apply force
}

// ✅ GOOD: Always apply forces regardless of sleep state
// The physics engine will wake the body automatically
physicsWorld.applyForce(bodyHandle, force);
```

**Solution**: Disable determinism checks for sleeping state:
```typescript
const verifier = new PhysicsDeterminismVerifier({
  checkSleeping: false // Ignore sleep state differences
});
```

### 2. Joint Breaking

Joint breaking depends on force approximation, which may have small numerical differences.

**Solution**: Use higher tolerance for joint breaking forces:
```typescript
const breakForce = 250.0; // Newtons
// Add 5% tolerance: 237.5 - 262.5 N
```

### 3. Collision Detection Order

Rapier returns collisions in deterministic order, but some physics engines don't.

**Mitigation**: If using non-Rapier engine, sort collision events by handle pairs:
```typescript
const collisions = physicsWorld.getCollisionEvents();
collisions.sort((a, b) => {
  if (a.bodyA !== b.bodyA) return a.bodyA - b.bodyA;
  return a.bodyB - b.bodyB;
});
```

### 4. CCD (Continuous Collision Detection)

CCD can introduce minor numerical differences in high-speed collisions.

**Solution**: Use consistent CCD settings:
```typescript
const config = {
  enableCCD: true, // Always enable or always disable
  timestep: 1 / 60  // Fixed timestep
};
```

## Best Practices

### 1. Test Determinism Early
Add determinism tests to your CI pipeline:

```typescript
test('physics is deterministic', () => {
  const verifier = new PhysicsDeterminismVerifier();

  // Run simulation twice
  const state1 = runSimulation(initialState, 60);
  const state2 = runSimulation(initialState, 60);

  const result = verifier.verify(state1, state2);
  expect(result.isDeterministic).toBe(true);
});
```

### 2. Version Your Physics State

Include version numbers in serialized state:

```typescript
const state = physicsWorld.serializeState();
// state.version is automatically included (currently version 1)

// When deserializing
if (state.version !== 1) {
  throw new Error(`Unsupported physics state version: ${state.version}`);
}
```

### 3. Document Non-Deterministic Features

If you add non-deterministic features (e.g., particle effects), document clearly:

```typescript
/**
 * Spawn particle effect (NON-DETERMINISTIC - visual only)
 * Do not use for gameplay logic
 */
function spawnParticles(position: Vector3) {
  // Random particle positions
  const offset = {
    x: Math.random() - 0.5,
    y: Math.random() - 0.5,
    z: Math.random() - 0.5
  };
  // ...
}
```

### 4. Separate Rendering from Simulation

Keep rendering logic separate from physics:

```typescript
// ✅ GOOD: Separate concerns
function physicsStep(deltaTime: number) {
  physicsWorld.step(deltaTime);  // Deterministic
}

function render() {
  // Non-deterministic rendering (interpolation, effects)
  const alpha = physicsWorld.step(deltaTime);
  renderBodies(alpha);
  renderParticles(); // Can use Math.random() safely here
}
```

## Cross-Platform Considerations

### Tested Platforms
The Miskatonic Engine physics is deterministic across:
- ✅ Windows x64
- ✅ macOS x64 (Intel)
- ✅ macOS ARM64 (Apple Silicon)
- ✅ Linux x64

### WASM Determinism
Rapier uses **WebAssembly** which provides consistent floating-point behavior across all platforms. This is a key reason for choosing Rapier over native JavaScript physics engines.

## Performance Impact

Determinism has minimal performance cost:
- Fixed timestep: ~0% overhead (best practice anyway)
- State serialization: ~1-2ms per snapshot (60 FPS = 16.67ms budget)
- Determinism verification: Only for testing, not production

**Recommendation**: Use determinism features in production for save/load and replay. Disable verification in production builds.

## API Reference

See source files for detailed API documentation:
- `packages/physics/src/types.ts` - Serialization types
- `packages/physics/src/PhysicsWorld.ts` - serializeState() / deserializeState()
- `packages/physics/src/PhysicsSnapshotManager.ts` - Snapshot management
- `packages/physics/src/PhysicsDeterminismVerifier.ts` - Determinism verification
- `packages/physics/src/PhysicsReplayPlayer.ts` - Replay playback

## Examples

### Example 1: Save/Load Game

```typescript
// Save game
function saveGame() {
  const state = physicsWorld.serializeState();
  const saveData = {
    physics: state,
    gameState: { score, level, ... }
  };
  localStorage.setItem('savedGame', JSON.stringify(saveData));
}

// Load game
function loadGame() {
  const json = localStorage.getItem('savedGame');
  const saveData = JSON.parse(json);

  physicsWorld.deserializeState(saveData.physics);
  // Restore game state
  score = saveData.gameState.score;
  level = saveData.gameState.level;
}
```

### Example 2: Lockstep Networking

```typescript
// Server: Broadcast inputs only (minimal bandwidth)
server.on('playerInput', (playerId, input) => {
  // Broadcast input to all clients
  broadcast({ playerId, input, frame: currentFrame });
});

// Client: Apply inputs deterministically
client.on('inputBatch', (inputs) => {
  // Sort by player ID for deterministic order
  inputs.sort((a, b) => a.playerId - b.playerId);

  // Apply all inputs
  for (const { playerId, input } of inputs) {
    applyPlayerInput(playerId, input);
  }

  // Step physics
  physicsWorld.step(1 / 60);

  // All clients now have identical state
});
```

### Example 3: Replay with Slow Motion

```typescript
const replayPlayer = new PhysicsReplayPlayer(physicsWorld);
replayPlayer.loadReplay(recordedReplay);

// Slow motion replay
replayPlayer.setPlaybackSpeed(0.25); // 4x slower
replayPlayer.play();

// Skip to interesting moment
replayPlayer.seekByProgress(0.75); // 75% through replay

// Frame-by-frame analysis
replayPlayer.pause();
replayPlayer.stepForward();
```

## Troubleshooting

### "Physics desync between clients"
- ✅ Check: Are you using fixed timestep?
- ✅ Check: Are inputs processed in same order?
- ✅ Check: Are initial states identical?
- ✅ Check: Do all clients use same physics config?

### "Replay doesn't match original game"
- ✅ Check: Are you using Math.random() in simulation?
- ✅ Check: Are you using Date.now() or performance.now()?
- ✅ Check: Are you creating bodies in deterministic order?

### "Determinism test fails with tiny differences"
- Increase tolerance: `new PhysicsDeterminismVerifier({ tolerance: 1e-5 })`
- This is normal for long simulations (numerical drift)
- Consider checksum instead of exact comparison

## Conclusion

Deterministic physics simulation enables:
- ✅ Competitive multiplayer with minimal bandwidth
- ✅ Perfect replay systems
- ✅ Save/load functionality
- ✅ Rollback netcode
- ✅ Reproducible testing

By following the guidelines in this document, your game will have **100% deterministic physics** across all platforms and network conditions.
