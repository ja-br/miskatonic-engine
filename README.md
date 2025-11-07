# Miskatonic Engine

A comprehensive desktop game engine built on Electron, designed for creating high-quality 3D games with sophisticated multiplayer capabilities, social features, and metagame systems.

## 🎮 Features

### Epic 1.1: Electron Architecture (COMPLETE ✅)

- ✅ **Secure Multi-Process Architecture**
  - Main process with window management
  - Isolated renderer process
  - Sandboxed preload script with contextBridge

- ✅ **Type-Safe IPC Communication**
  - Runtime validation with Zod schemas
  - Full TypeScript type inference
  - Extensible channel handler system

- ✅ **Security-First Design**
  - Context isolation enabled
  - Node integration disabled in renderer
  - Strict Content Security Policy
  - Sandboxed processes

- ✅ **Process Monitoring**
  - Crash detection and recovery
  - Health checks
  - Crash reporting

- ✅ **Development Experience**
  - Hot module reload with Vite
  - VS Code debugging configurations
  - Comprehensive testing setup

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start development environment
npm run dev
```

This will:
1. Start Vite dev server (renderer)
2. Build main and preload processes
3. Launch Electron with hot-reload

### Building

```bash
# Build for production
npm run build

# Create distributable packages (future: Epic 1.4)
npm run dist
```

## 📚 Documentation

- [Development Setup](docs/guides/development-setup.md) - Get started developing
- [Electron Processes](docs/architecture/electron-processes.md) - Architecture overview
- [IPC Protocol](docs/architecture/ipc-protocol.md) - Communication patterns
- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) - Full roadmap
- [CLAUDE.md](CLAUDE.md) - AI assistant guidance

## 🏗️ Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Desktop Framework | Electron 27+ | Cross-platform desktop |
| Language | TypeScript 5.3+ | Type-safe development |
| Build Tools | Vite + Webpack 5 | Module bundling |
| Validation | Zod | Runtime type checking |
| Testing | Vitest | Unit and integration tests |
| Graphics | WebGL2/WebGPU | 3D rendering (future) |
| Physics | Rapier/Cannon/Box2D | Physics simulation (future) |

## 🗂️ Project Structure

```
miskatonic-engine/
├── packages/
│   ├── main/          # Electron main process
│   ├── preload/       # Preload security boundary
│   ├── renderer/      # Game UI and engine
│   └── shared/        # Shared types and constants
├── config/            # Build configurations
├── scripts/           # Development scripts
├── tests/             # Test suites
└── docs/              # Documentation
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run with coverage
npm run test -- --coverage
```

## 🛠️ Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development environment |
| `npm run build` | Build for production |
| `npm run clean` | Clean build artifacts |
| `npm test` | Run tests |
| `npm run lint` | Lint code |
| `npm run format` | Format code with Prettier |
| `npm run typecheck` | Check TypeScript types |

## 🔒 Security

Miskatonic Engine follows Electron security best practices:

- ✅ Context isolation enabled
- ✅ Node integration disabled in renderer
- ✅ Sandbox mode enabled
- ✅ WebSecurity enabled (never disabled)
- ✅ Strict Content Security Policy
- ✅ All IPC messages validated
- ✅ File operations sandboxed to userData directory

See [Security Model](docs/architecture/electron-processes.md#security-model) for details.

## 📋 Current Status

**Epic 1.1: Electron Architecture Setup** - ✅ **COMPLETE**

All acceptance criteria met:
- [x] Main process architecture implemented
- [x] Renderer process isolation configured
- [x] IPC communication layer established
- [x] Security boundaries enforced
- [x] Process monitoring and crash recovery
- [x] Development and production configurations
- [x] Testing infrastructure
- [x] Documentation

### Next Steps

- **Epic 1.2**: Native OS Integration (file dialogs, menus, system tray)
- **Epic 1.3**: Auto-Update System
- **Epic 1.4**: Build & Distribution Pipeline
- **Epic 2.1**: ECS (Entity Component System) Core

See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for the complete roadmap.

## 🎯 Performance Targets

- **Frame Rate**: 60 FPS target / 30 FPS critical minimum
- **Memory**: 500MB target / 1GB critical maximum
- **Load Time**: <3s target / <10s critical
- **Network**: <50ms latency target / <150ms critical

## 📄 License

MIT

## 🤝 Contributing

See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for the project roadmap and contribution guidelines.

---

**Miskatonic Engine** - Built with Electron, TypeScript, and WebGL2/WebGPU
