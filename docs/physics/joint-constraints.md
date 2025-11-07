# Joint Constraint System

The Miskatonic Engine includes a comprehensive joint constraint system built on Rapier Physics, providing 6 types of joints for connecting rigid bodies with various degrees of freedom.

## Overview

Joints constrain the relative motion between two rigid bodies, allowing you to create complex mechanical systems like doors, chains, elevators, ragdolls, and motors.

## Joint Types

### FIXED Joints
**Purpose:** Weld two bodies together rigidly with no relative motion.

**Use Cases:**
- Chain links
- Compound objects made of multiple rigid bodies
- Attaching accessories to moving objects

**Example:**
```typescript
const joint = physicsWorld.createJoint({
  type: JointType.FIXED,
  bodyA: parentHandle,
  bodyB: childHandle,
  anchorA: { position: { x: 0, y: 0, z: 0 } },
  anchorB: { position: { x: 0, y: 0, z: 0 } },
  collideConnected: false
});
```

### REVOLUTE Joints
**Purpose:** Hinge joint allowing rotation around a single axis.

**Features:**
- Configurable rotation axis
- Optional angle limits (min/max)
- Optional motor for powered rotation

**Use Cases:**
- Doors
- Pendulums
- Wheels
- Spinning platforms

**Example:**
```typescript
// Door with angle limits
const doorJoint = physicsWorld.createJoint({
  type: JointType.REVOLUTE,
  bodyA: doorFrameHandle,
  bodyB: doorHandle,
  anchorA: { position: { x: 0, y: 0, z: 0 } },
  anchorB: { position: { x: -0.5, y: 0, z: 0 } },
  axis: { x: 0, y: 1, z: 0 }, // Rotate around Y axis
  limits: { min: 0, max: Math.PI / 2 }, // 0 to 90 degrees
  collideConnected: false
});

// Powered motor
const motorJoint = physicsWorld.createJoint({
  type: JointType.REVOLUTE,
  bodyA: housingHandle,
  bodyB: shaftHandle,
  anchorA: { position: { x: 0, y: 0, z: 0 } },
  anchorB: { position: { x: 0, y: 0, z: 0 } },
  axis: { x: 0, y: 1, z: 0 },
  motor: {
    targetVelocity: 2.0, // rad/s
    maxForce: 10.0
  },
  collideConnected: false
});
```

### PRISMATIC Joints
**Purpose:** Slider joint allowing translation along a single axis.

**Features:**
- Configurable slide axis
- Optional distance limits (min/max)
- Optional motor for powered sliding

**Use Cases:**
- Elevators
- Sliding doors
- Pistons
- Linear actuators

**Example:**
```typescript
const elevatorJoint = physicsWorld.createJoint({
  type: JointType.PRISMATIC,
  bodyA: railHandle,
  bodyB: platformHandle,
  anchorA: { position: { x: 0, y: 0, z: 0 } },
  anchorB: { position: { x: 0, y: 0, z: 0 } },
  axis: { x: 0, y: 1, z: 0 }, // Slide along Y axis
  limits: { min: -4, max: 4 }, // 4 units up/down
  collideConnected: false
});
```

### SPHERICAL Joints
**Purpose:** Ball-and-socket joint allowing free rotation in all directions.

**Use Cases:**
- Ragdoll shoulders/hips
- Camera gimbals
- Universal joints

**Example:**
```typescript
const shoulderJoint = physicsWorld.createJoint({
  type: JointType.SPHERICAL,
  bodyA: torsoHandle,
  bodyB: upperArmHandle,
  anchorA: { position: { x: 1, y: 0, z: 0 } },
  anchorB: { position: { x: 0, y: 0.5, z: 0 } },
  collideConnected: false
});
```

### GENERIC Joints
**Purpose:** 6-DOF (degrees of freedom) joint with per-axis configuration.

**Features:**
- Independent control of linear axes (X, Y, Z)
- Independent control of angular axes (X, Y, Z)
- Per-axis limits

**Use Cases:**
- Complex mechanical systems
- Custom joint behaviors
- Character joint constraints

**Example:**
```typescript
const complexJoint = physicsWorld.createJoint({
  type: JointType.GENERIC,
  bodyA: baseHandle,
  bodyB: armHandle,
  anchorA: { position: { x: 0, y: 0, z: 0 } },
  anchorB: { position: { x: 0, y: 0, z: 0 } },
  linearLimits: {
    x: { min: -1, max: 1 },
    y: { min: -2, max: 2 }
    // Z axis free
  },
  angularLimits: {
    x: { min: -Math.PI / 4, max: Math.PI / 4 }
    // Y and Z axes free
  },
  collideConnected: false
});
```

### SPRING Joints
**Purpose:** Soft distance constraint that behaves like a spring with stiffness and damping.

**Features:**
- Configurable rest length (default: current distance)
- Adjustable spring stiffness
- Adjustable damping to reduce oscillation

**Use Cases:**
- Bungee cords
- Suspension systems
- Soft attachments
- Rope physics

**Example:**
```typescript
// Create a spring rope
const ropeSpring = physicsWorld.createJoint({
  type: JointType.SPRING,
  bodyA: ceilingHandle,
  bodyB: weightHandle,
  anchorA: { position: { x: 0, y: 0, z: 0 } },
  anchorB: { position: { x: 0, y: 0.5, z: 0 } },
  restLength: 2.0,      // 2 meter rest length
  stiffness: 100.0,     // Spring constant
  damping: 5.0,         // Damping coefficient
  collideConnected: false
});

// Auto-calculate rest length from current distance
const autoSpring = physicsWorld.createJoint({
  type: JointType.SPRING,
  bodyA: bodyAHandle,
  bodyB: bodyBHandle,
  anchorA: { position: { x: 0, y: 0, z: 0 } },
  anchorB: { position: { x: 0, y: 0, z: 0 } },
  // restLength omitted - uses current anchor distance
  stiffness: 50.0,
  damping: 2.0
});
```

## Motor Control

Revolute and prismatic joints support motors for powered motion:

```typescript
// Enable motor
physicsWorld.setJointMotor(jointHandle, {
  targetVelocity: 2.0, // rad/s (revolute) or units/s (prismatic)
  maxForce: 10.0       // Maximum force to apply
});

// Update motor speed dynamically
physicsWorld.setJointMotor(jointHandle, {
  targetVelocity: newSpeed,
  maxForce: 10.0
});

// Disable motor
physicsWorld.setJointMotor(jointHandle, null);
```

## Best Practices

### Anchor Points
- Anchor positions are relative to each body's center of mass
- Ensure anchors align correctly to avoid initial constraint violations
- Test anchor positions visually in your scene

### Axis Vectors
- Always use normalized axis vectors (unit length)
- The engine automatically normalizes axes, but providing unit vectors is clearer
- Common axes: `{ x: 1, y: 0, z: 0 }` (X), `{ x: 0, y: 1, z: 0 }` (Y), `{ x: 0, y: 0, z: 1 }` (Z)

### Limits
- Angle limits for revolute joints are in radians
- Distance limits for prismatic joints are in world units
- Ensure min < max for all limits
- Use reasonable limit ranges to avoid instability

### Motor Forces
- Start with moderate forces (5-20) and adjust based on body mass
- Higher forces = more responsive but potentially less stable
- Motors work best with damping on connected bodies

### Spring Parameters
- **Stiffness**: Higher values (100+) create stiffer springs, lower values (1-50) create softer springs
- **Damping**: Start with 10-20% of stiffness value (e.g., stiffness: 100, damping: 10)
- Too little damping causes excessive oscillation
- Too much damping causes sluggish, overdamped behavior
- Use `restLength: 0` (or omit) to automatically use current anchor distance

### Collision
- Set `collideConnected: false` in most cases to prevent connected bodies from colliding
- Only enable collision if you need realistic contact between jointed bodies

### Joint Breaking
- Add `breakForce` to any joint descriptor to make it breakable
- Force is measured in Newtons (N)
- When the force on a joint exceeds `breakForce`, the joint is automatically removed
- Use `onJointBreak()` callback to handle break events (e.g., play sound effects, spawn debris)
- Common breakForce values: 100-500 for weak joints, 1000+ for strong joints
- Set to `0` or omit for unbreakable joints

**Example:**
```typescript
// Create a breakable chain link
const weakLink = physicsWorld.createJoint({
  type: JointType.FIXED,
  bodyA: link1Handle,
  bodyB: link2Handle,
  anchorA: { position: { x: 0, y: 0, z: 0 } },
  anchorB: { position: { x: 0, y: 0, z: 0 } },
  breakForce: 250.0  // Breaks at 250 Newtons
});

// Listen for break events
physicsWorld.onJointBreak((event) => {
  console.log(`Joint ${event.jointHandle} broke with force ${event.force}N`);
  // Play break sound, spawn particles, etc.
});
```

## Performance Considerations

- Each joint adds computational cost to physics simulation
- Complex scenes with many joints (100+) may impact performance
- Profile your specific use case and adjust as needed
- Consider simplifying joint hierarchies for background/distant objects

## Limitations

### Joint Value Queries
The `getJointValue()` method currently returns 0 because Rapier doesn't directly expose joint angles/positions. To get accurate joint state:

```typescript
// Calculate joint angle from body transforms
const bodyATransform = physicsWorld.getPosition(bodyAHandle);
const bodyARotation = physicsWorld.getRotation(bodyAHandle);
const bodyBTransform = physicsWorld.getPosition(bodyBHandle);
const bodyBRotation = physicsWorld.getRotation(bodyBHandle);

// Calculate relative rotation/position based on joint type
// ... (implementation depends on specific joint configuration)
```

### Known Issues
None at this time. All joint types are fully functional.

## Demo

See `packages/renderer/src/joints-demo.ts` for a comprehensive interactive demo showcasing all joint types:
- Chain with FIXED joints
- Door with limited REVOLUTE joint
- Pendulum with free REVOLUTE joint
- Elevator with PRISMATIC joint
- Ragdoll arm with SPHERICAL joints
- Motor with powered REVOLUTE joint

Run the demo:
```bash
npm run dev
# Navigate to http://localhost:5173/joints.html
```

## API Reference

### PhysicsWorld Methods

#### `createJoint(descriptor: JointDescriptor): JointHandle`
Creates a new joint constraint.

#### `removeJoint(handle: JointHandle): void`
Removes a joint and frees its resources.

#### `setJointMotor(handle: JointHandle, motor: JointMotor | null): void`
Sets or updates motor parameters for a joint.

#### `getJointValue(handle: JointHandle): number`
Gets the current angle (revolute) or position (prismatic) of a joint.
Note: Currently returns 0 (see Limitations section).

## Implementation Details

The joint system is implemented in:
- `packages/physics/src/types.ts` - Type definitions
- `packages/physics/src/engines/RapierPhysicsEngine.ts` - Rapier integration
- `packages/physics/src/PhysicsWorld.ts` - Public API

All joints are properly disposed when the physics world is cleaned up, preventing memory leaks.
