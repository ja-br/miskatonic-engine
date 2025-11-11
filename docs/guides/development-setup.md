# Development Setup

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

## Initial Setup

1. **Install Dependencies**:
```bash
npm install
```

2. **Verify Installation**:
```bash
npm run typecheck
```

## Development Workflow

### Start Development Mode

```bash
npm run dev
```

This will:
1. Start Vite dev server for renderer (http://localhost:5173)
2. Build main and preload processes in watch mode
3. Launch Electron with hot-reload enabled

### Build for Production

```bash
npm run build
```

This creates optimized builds in `dist/`:
- `dist/main/` - Main process
- `dist/preload/` - Preload script
- `dist/renderer/` - Renderer process

### Run Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run with coverage
npm run test -- --coverage
```

### Linting and Formatting

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

### Clean Build Artifacts

```bash
npm run clean
```

## Project Structure

```
miskatonic-engine/
├── packages/
│   ├── main/          # Main process (Electron)
│   ├── preload/       # Preload script (Security boundary)
│   ├── renderer/      # Renderer process (Game UI)
│   └── shared/        # Shared types and constants
├── config/            # Build configurations
├── scripts/           # Build and dev scripts
├── tests/             # Test suites
└── docs/              # Documentation
```

## Debugging

### VS Code

Use the provided debug configurations:

1. **Debug Main Process**: Launches Electron with debugger attached
2. **Debug Renderer Process**: Attaches to Chrome DevTools
3. **Debug All Processes**: Debugs both simultaneously

Press `F5` to start debugging.

### Chrome DevTools

In development mode, DevTools opens automatically. You can also:

```typescript
await window.electronAPI.system.openDevTools();
```

## Common Issues

### Port 5173 Already in Use

If Vite fails to start, another process is using port 5173. Either:
1. Kill the other process
2. Change the port in `packages/renderer/vite.config.ts`

### Module Not Found Errors

Run `npm install` in the root directory. The workspace setup requires dependencies to be installed from root.

### TypeScript Errors

Ensure all packages are built:
```bash
npm run build
```

## Next Steps

- Read [IPC Protocol](../architecture/ipc-protocol.md) to understand communication
- Read [Electron Processes](../architecture/electron-processes.md) for architecture
- See [DEVELOPMENT_PLAN.md](../../planning/DEVELOPMENT_PLAN.md) for roadmap
