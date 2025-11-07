# Miskatonic Engine: Game Design Best Practices

This document provides guidance for **game developers using the Miskatonic Engine** to build their games. These are recommended patterns and practices for building games with the engine.

---

## Introduction

These principles are recommendations for game developers, not requirements. The Miskatonic Engine is flexible enough to support many approaches. However, following these patterns will help you:
- Build performant games
- Avoid common pitfalls
- Take advantage of engine features
- Create maintainable codebases

---

## Core Game Development Principles

### 1. Composition Over Inheritance
**Principle**: Build game objects by composing components, not through class hierarchies.

**Rationale**: The engine's ECS architecture rewards composition. Deep inheritance hierarchies fight against the system.

**Best Practices**:
```typescript
// ❌ Avoid: Deep inheritance
class Entity → GameObject → Character → Enemy → FlyingEnemy → Boss

// ✅ Prefer: Composition
const boss = engine.entities.create()
  .add(Transform, { position: [0, 0, 0] })
  .add(Health, { max: 1000, current: 1000 })
  .add(Combat, { damage: 50, attackRate: 2.0 })
  .add(Flying, { altitude: 10, speed: 5 })
  .add(AI, { behavior: 'boss-phase-1' })
  .add(Renderable, { model: 'boss-model' });
```

---

### 2. Data-Driven Design
**Principle**: Define game content in data files, not hardcoded in scripts.

**Rationale**: Data-driven design enables designers to iterate without programmer involvement and supports modding.

**Best Practices**:
```typescript
// ❌ Avoid: Hardcoded content
class Sword {
  damage = 25;
  attackSpeed = 1.5;
  range = 2.0;
}

// ✅ Prefer: Data-driven
// weapons.json
{
  "sword": {
    "damage": 25,
    "attackSpeed": 1.5,
    "range": 2.0,
    "model": "sword-01",
    "icon": "sword-icon"
  }
}

// weapons.ts
const weapon = await engine.assets.load<WeaponData>('weapons/sword');
entity.add(Weapon, weapon);
```

---

### 3. Deterministic Gameplay for Multiplayer
**Principle**: Make gameplay logic deterministic when building multiplayer games.

**Rationale**: Enables client prediction, replay systems, and prevents cheating.

**Best Practices**:
- Use engine-provided RNG with fixed seeds
- Avoid `Math.random()` in gameplay code
- Don't rely on frame timing (`deltaTime` is okay if synchronized)
- Make physics deterministic (use engine's deterministic mode)
- Avoid floating-point accumulation errors

```typescript
// ❌ Avoid: Non-deterministic
const criticalHit = Math.random() > 0.9;

// ✅ Prefer: Deterministic RNG
const rng = engine.random.create(seed);
const criticalHit = rng.next() > 0.9;
```

---

### 4. Server Authority for Multiplayer
**Principle**: Server validates all gameplay-affecting actions in multiplayer games.

**Rationale**: Prevents cheating and ensures fair gameplay.

**Best Practices**:
```typescript
// Client: Request action
client.send('attack', { targetId, weaponId });

// Client: Predict locally for responsiveness
localPlayer.playAttackAnimation();

// Server: Validate and broadcast
server.on('attack', (playerId, { targetId, weaponId }) => {
  // Validate: player can attack, target exists, weapon equipped, cooldown passed
  if (!canAttack(playerId, targetId, weaponId)) {
    return; // Reject invalid action
  }

  // Execute authoritative action
  const damage = calculateDamage(playerId, targetId, weaponId);
  applyDamage(targetId, damage);

  // Broadcast result to all clients
  server.broadcast('attack-result', { playerId, targetId, damage });
});

// Client: Apply server result (may correct prediction)
client.on('attack-result', ({ playerId, targetId, damage }) => {
  applyDamage(targetId, damage);
  playHitEffect(targetId);
});
```

---

### 5. Progressive Enhancement for Performance
**Principle**: Implement quality tiers and gracefully degrade on lower-end devices.

**Rationale**: Players have varied hardware. Your game should work everywhere and shine on capable devices.

**Best Practices**:
```typescript
// Detect device capabilities
const capabilities = engine.capabilities.detect();

// Configure quality based on device
const quality = capabilities.gpu.tier >= 3 ? 'ultra' :
                capabilities.gpu.tier >= 2 ? 'high' :
                capabilities.gpu.tier >= 1 ? 'medium' : 'low';

engine.renderer.configure({
  shadows: quality !== 'low',
  shadowQuality: quality === 'ultra' ? 'high' : 'medium',
  postProcessing: quality === 'ultra' || quality === 'high',
  particles: quality !== 'low',
  particleCount: quality === 'ultra' ? 1000 : quality === 'high' ? 500 : 200,
  drawDistance: quality === 'ultra' ? 1000 : quality === 'high' ? 500 : 250
});

// Allow player to override
settings.quality = playerPreference ?? quality;
```

---

### 6. Asset Streaming and Lazy Loading
**Principle**: Don't load everything upfront. Stream assets as needed.

**Rationale**: Faster initial load times and lower memory usage.

**Best Practices**:
```typescript
// ❌ Avoid: Loading everything at start
await engine.assets.loadAll(); // Slow initial load!

// ✅ Prefer: Progressive loading
// Load critical assets first
await engine.assets.load([
  'ui/main-menu',
  'audio/music',
  'textures/loading-screen'
]);

// Show loading screen, stream remaining assets
showLoadingScreen();

// Load by priority
await engine.assets.load('level-1/geometry', { priority: 'high' });
await engine.assets.load('level-1/textures', { priority: 'medium' });
await engine.assets.load('level-2/*', { priority: 'low' }); // Preload next level

// Unload unused assets
engine.assets.unload('level-1/*'); // Free memory when done
```

---

### 7. State Machines for Game Logic
**Principle**: Use state machines for complex entity behaviors and game states.

**Rationale**: Makes logic explicit, testable, and easier to debug than spaghetti conditionals.

**Best Practices**:
```typescript
// Enemy AI state machine
const enemyAI = new StateMachine({
  initial: 'patrol',
  states: {
    patrol: {
      onEnter: () => setPatrolPath(),
      onUpdate: () => {
        moveAlongPath();
        if (playerInRange()) return 'chase';
      }
    },
    chase: {
      onUpdate: () => {
        moveTowardsPlayer();
        if (playerInAttackRange()) return 'attack';
        if (!playerInRange()) return 'patrol';
      }
    },
    attack: {
      onEnter: () => playAttackAnimation(),
      onUpdate: () => {
        if (attackComplete()) {
          dealDamage();
          return 'chase';
        }
      }
    }
  }
});

// Update state machine each frame
enemyAI.update(deltaTime);
```

---

### 8. Object Pooling for Performance
**Principle**: Reuse objects instead of creating and destroying them frequently.

**Rationale**: Reduces garbage collection pauses and allocation overhead.

**Best Practices**:
```typescript
// ❌ Avoid: Creating/destroying each frame
function spawnBullet() {
  const bullet = engine.entities.create();
  bullet.add(Bullet, { speed: 100 });
  // Bullet destroys itself after timeout
}

// ✅ Prefer: Object pooling
const bulletPool = engine.pools.create('bullet', {
  create: () => {
    const bullet = engine.entities.create();
    bullet.add(Bullet, { speed: 100 });
    return bullet;
  },
  reset: (bullet) => {
    bullet.get(Transform).position.set(0, 0, 0);
    bullet.get(Bullet).active = true;
  },
  capacity: 100 // Pre-allocate
});

function spawnBullet(position, direction) {
  const bullet = bulletPool.acquire();
  bullet.get(Transform).position.copy(position);
  bullet.get(Bullet).direction.copy(direction);
}

function despawnBullet(bullet) {
  bullet.get(Bullet).active = false;
  bulletPool.release(bullet); // Return to pool
}
```

---

### 9. Event-Driven Communication
**Principle**: Use events for decoupled communication between systems.

**Rationale**: Reduces tight coupling and makes systems more modular and testable.

**Best Practices**:
```typescript
// ❌ Avoid: Tight coupling
class Player {
  takeDamage(amount: number) {
    this.health -= amount;
    ui.updateHealthBar(this.health); // Tight coupling!
    audio.play('hurt');
    achievements.check('survive-low-health');
  }
}

// ✅ Prefer: Event-driven
class Player {
  takeDamage(amount: number) {
    this.health -= amount;
    engine.events.emit('player:damaged', { amount, health: this.health });
  }
}

// Systems listen independently
engine.events.on('player:damaged', ({ health }) => {
  ui.updateHealthBar(health);
});

engine.events.on('player:damaged', () => {
  audio.play('hurt');
});

engine.events.on('player:damaged', ({ health }) => {
  if (health < 10) achievements.unlock('clutch-survivor');
});
```

---

### 10. Graceful Error Handling
**Principle**: Handle errors gracefully and provide fallbacks.

**Rationale**: Players shouldn't see crashes. Degrade gracefully when things go wrong.

**Best Practices**:
```typescript
// ❌ Avoid: Uncaught errors crash game
const texture = engine.assets.get('character/skin'); // Throws if missing!

// ✅ Prefer: Defensive programming
const texture = engine.assets.get('character/skin')
               ?? engine.assets.get('fallback/checkerboard'); // Fallback

// ✅ Handle asset loading failures
try {
  await engine.assets.load('optional-content');
} catch (error) {
  console.warn('Optional content failed to load:', error);
  // Game continues without it
}

// ✅ Validate user input
function teleportPlayer(position: Vec3) {
  if (!isValidPosition(position)) {
    console.warn('Invalid teleport position:', position);
    return; // Don't teleport
  }
  player.get(Transform).position.copy(position);
}
```

---

## Performance Best Practices

### 11. Minimize Garbage Collection
**Principle**: Reduce object allocations in hot paths.

**Best Practices**:
- Reuse vectors/matrices instead of creating new ones
- Use object pools for frequently created/destroyed objects
- Avoid array methods that allocate (`map`, `filter`) in update loops
- Prefer for loops over array iteration in critical paths

```typescript
// ❌ Avoid: Allocations in game loop
function update() {
  const direction = new Vec3(1, 0, 0); // Allocation every frame!
  const position = entity.getPosition(); // Returns new Vec3
}

// ✅ Prefer: Reuse objects
const tempDirection = new Vec3();
const tempPosition = new Vec3();

function update() {
  tempDirection.set(1, 0, 0); // Reuse existing vector
  entity.getPosition(tempPosition); // Write into provided vector
}
```

---

### 12. Level of Detail (LOD)
**Principle**: Use lower-quality assets for distant objects.

**Best Practices**:
```typescript
// Configure LOD levels
entity.add(LOD, {
  levels: [
    { distance: 0,   model: 'character-high.glb' },   // Close
    { distance: 50,  model: 'character-medium.glb' }, // Medium
    { distance: 100, model: 'character-low.glb' },    // Far
    { distance: 200, model: null }                     // Very far (culled)
  ]
});

// Engine automatically switches based on camera distance
```

---

### 13. Frustum Culling and Occlusion
**Principle**: Don't render what the player can't see.

**Best Practices**:
```typescript
// Enable frustum culling (on by default)
engine.renderer.frustumCulling = true;

// Use occlusion culling for complex scenes
engine.renderer.occlusionCulling = true;

// Mark static geometry for better culling
entity.add(StaticGeometry); // Engine knows it won't move

// Use spatial partitioning for large worlds
engine.world.setSpatialPartitioning('octree'); // or 'bvh', 'grid'
```

---

## Multiplayer Best Practices

### 14. Client Prediction and Reconciliation
**Principle**: Predict player actions locally, reconcile with server.

**Best Practices**:
```typescript
// Client: Predict movement immediately
function onInput(input: PlayerInput) {
  // Store input with sequence number
  pendingInputs.push({ seq: inputSeq++, input });

  // Apply locally for instant feedback
  predictMovement(player, input, deltaTime);

  // Send to server
  client.send('input', { seq: inputSeq, input });
}

// Client: Reconcile with server state
client.on('state', (serverState) => {
  // Server state includes last processed input sequence
  const { lastProcessedSeq, position } = serverState;

  // Remove acknowledged inputs
  pendingInputs = pendingInputs.filter(i => i.seq > lastProcessedSeq);

  // Rewind to server state
  player.position.copy(position);

  // Replay pending inputs
  for (const { input } of pendingInputs) {
    predictMovement(player, input, deltaTime);
  }
});
```

---

### 15. Interpolation for Remote Entities
**Principle**: Smooth out network jitter by interpolating between states.

**Best Practices**:
```typescript
// Buffer received states
const stateBuffer: EntityState[] = [];

client.on('entity-update', (state) => {
  stateBuffer.push({ ...state, receivedAt: now() });
});

// Render with interpolation (100ms in the past)
function render() {
  const renderTime = now() - 100;

  // Find states to interpolate between
  const [before, after] = findBracketingStates(stateBuffer, renderTime);

  if (!before || !after) return; // Not enough data yet

  // Interpolate position
  const t = (renderTime - before.time) / (after.time - before.time);
  const interpolated = Vec3.lerp(before.position, after.position, t);

  entity.get(Transform).position.copy(interpolated);
}
```

---

## Testing and Debugging

### 16. Use Debug Visualization
**Principle**: Visualize game systems during development.

**Best Practices**:
```typescript
// Enable debug rendering
if (DEBUG) {
  engine.debug.showPhysicsShapes = true;
  engine.debug.showBoundingBoxes = true;
  engine.debug.showNavMesh = true;
  engine.debug.showNetworkStats = true;
}

// Custom debug drawing
engine.debug.drawLine(from, to, color);
engine.debug.drawSphere(center, radius, color);
engine.debug.drawText(position, 'Debug Info');
```

---

### 17. Implement Replay System
**Principle**: Record and replay game sessions for debugging.

**Best Practices**:
```typescript
// Record inputs for replay
const recorder = engine.replay.startRecording();

// Save replay to file
await recorder.save('replay-001.rep');

// Load and replay
const replay = await engine.replay.load('replay-001.rep');
replay.play();

// Step through frame by frame
replay.pause();
replay.stepForward();
replay.stepBackward();
```

---

### 18. Automated Testing
**Principle**: Write tests for game logic (not rendering).

**Best Practices**:
```typescript
// Unit test game logic
describe('Combat System', () => {
  it('calculates damage correctly', () => {
    const attacker = createEntity({ damage: 10, critChance: 0 });
    const target = createEntity({ defense: 5 });

    const damage = calculateDamage(attacker, target);
    expect(damage).toBe(5); // 10 - 5 = 5
  });
});

// Integration test with engine
describe('Player Movement', () => {
  it('moves player when input received', async () => {
    const engine = await createTestEngine();
    const player = createPlayer(engine);

    const initialPos = player.get(Transform).position.clone();

    // Simulate input
    engine.input.press('forward');
    engine.update(1/60); // One frame

    const newPos = player.get(Transform).position;
    expect(newPos.z).toBeGreaterThan(initialPos.z);
  });
});
```

---

## Project Structure

### 19. Organize by Feature, Not Type
**Principle**: Group related code by feature/domain, not by technical role.

**Best Practices**:
```
// ❌ Avoid: Organize by type
src/
  components/
    PlayerComponent.ts
    WeaponComponent.ts
    InventoryComponent.ts
  systems/
    PlayerSystem.ts
    WeaponSystem.ts
    InventorySystem.ts

// ✅ Prefer: Organize by feature
src/
  player/
    components.ts
    systems.ts
    ui.ts
    index.ts
  combat/
    components.ts
    systems.ts
    weapons.ts
    index.ts
  inventory/
    components.ts
    systems.ts
    ui.ts
    index.ts
```

---

### 20. Configuration Management
**Principle**: Centralize game configuration and balance values.

**Best Practices**:
```typescript
// config/gameplay.ts
export const GAMEPLAY = {
  player: {
    moveSpeed: 5.0,
    jumpHeight: 2.0,
    maxHealth: 100
  },
  combat: {
    baseDamage: 10,
    critMultiplier: 2.0,
    critChance: 0.1
  },
  economy: {
    startingGold: 100,
    goldPerKill: 10
  }
} as const;

// Easy to tweak, easy to expose to designers
// Can be overridden by data files for modding
```

---

## Summary

These best practices help you:
- ✅ Build performant games that run at 60 FPS
- ✅ Create maintainable codebases that scale
- ✅ Leverage engine features effectively
- ✅ Avoid common pitfalls and gotchas
- ✅ Support multiplayer and modding
- ✅ Debug and test efficiently

Remember: these are guidelines, not rules. Break them when you have good reason, but understand the trade-offs.

---

## Further Reading

- [Miskatonic Engine Documentation](https://docs.miskatonic.dev)
- [ECS Architecture Guide](https://docs.miskatonic.dev/ecs)
- [Multiplayer Networking Guide](https://docs.miskatonic.dev/networking)
- [Performance Optimization Guide](https://docs.miskatonic.dev/performance)
- [Asset Pipeline Guide](https://docs.miskatonic.dev/assets)
