# @miskatonic/renderer

Electron renderer process for the Miskatonic Engine.

## Overview

This package contains the **Electron renderer process** entry point and demo applications. It is **NOT** a reusable library - it's the application layer that runs in Electron's browser window.

For the actual rendering engine API, see [`@miskatonic/rendering`](../rendering/README.md).


## Contents

- **`index.ts`** - Electron renderer process entry point (78 lines)
- **`demo.ts`** - Dice physics demo showcasing physics + rendering integration (1,455 lines)
- **`joints-demo.ts`** - Physics joints demo with 6 joint types and interactive controls (1,299 lines)
- **`IpcServiceClient.ts`** - Communication with Electron main process

## Running the Demos

From the project root:

```bash
# Start the development environment (includes this renderer process)
npm run dev
```

The demos will automatically load in the Electron window. You can switch between demos using the UI controls.

## Architecture

This package integrates multiple engine systems:

- **`@miskatonic/rendering`** - WebGPU/WebGL graphics engine
- **`@miskatonic/physics`** - Rapier/Cannon/Box2D physics simulation
- **`@miskatonic/ecs`** - Entity Component System
- **`@miskatonic/core`** - Engine core with game loop

The demos serve as both examples and performance benchmarks for the engine.

## Key Features Demonstrated

### Dice Physics Demo (`demo.ts`)
- 2,364 dice with Rapier physics simulation
- GPU instancing (99.9% draw call reduction)
- Real-time performance metrics
- 60 FPS target with dynamic timestep

### Joints Demo (`joints-demo.ts`)
- All 6 Rapier joint types:
  - Fixed (weld)
  - Spherical (ball-and-socket)
  - Revolute (hinge)
  - Prismatic (slider)
  - Cylindrical (piston)
  - Universal (Hooke's joint)
- Interactive control panel for joint parameters
- Visual debugging with constraint visualization

## Development Notes

This is a **private package** (`"private": true` in package.json) and is not published to npm. It exists solely as the entry point for the Electron renderer process and to showcase engine capabilities.

For graphics engine documentation and API reference, see the [rendering package README](../rendering/README.md).