# Electron Process Architecture

## Overview

Miskatonic Engine uses Electron's multi-process architecture with strict security boundaries.

## Process Types

### Main Process

- **Location**: `packages/main/src/`
- **Responsibilities**:
  - Window management and lifecycle
  - Native OS integration (file system, menus, etc.)
  - IPC message routing and validation
  - Process monitoring and crash recovery
  - Security policy enforcement

- **Key Files**:
  - `index.ts` - Application entry point
  - `window/WindowManager.ts` - Window lifecycle
  - `ipc/IPCHandler.ts` - IPC message routing
  - `security/SecurityPolicy.ts` - Security enforcement

### Preload Script

- **Location**: `packages/preload/src/`
- **Responsibilities**:
  - Security boundary between main and renderer
  - Expose controlled API via contextBridge
  - No direct access to Node.js or Electron APIs from renderer

- **Key Files**:
  - `index.ts` - Preload entry point
  - `api/ElectronAPI.ts` - API definition
  - Individual API modules (FileAPI, WindowAPI, SystemAPI)

### Renderer Process

- **Location**: `packages/renderer/src/`
- **Responsibilities**:
  - Game engine (future)
  - User interface
  - Client-side game logic
  - Rendering (WebGPU)

- **Key Files**:
  - `index.ts` - Renderer entry point
  - `ipc/IPCService.ts` - IPC client wrapper
  - `index.html` - Application HTML

## Security Model

### Context Isolation

**ALWAYS ENABLED** - Prevents renderer from accessing Electron/Node.js APIs directly.

### Node Integration

**ALWAYS DISABLED** - Renderer cannot use `require()` or Node.js APIs.

### Sandbox

**ALWAYS ENABLED** - OS-level process isolation.

### Content Security Policy

Strict CSP headers prevent XSS and injection attacks. See `security/CSPConfig.ts`.

## IPC Communication

All communication between processes goes through typed IPC channels:

```
Renderer → window.electronAPI.method()
  → contextBridge (preload)
  → ipcRenderer.invoke()
  → ipcMain.handle() (main)
  → Channel Handler
  → Response
```

Every message is validated using Zod schemas in both directions.
