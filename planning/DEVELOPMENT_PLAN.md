# Development Planning: Miskatonic Engine

**Version:** 2.0
**Date:** November 2025
**Status:** Living Document - Split by Initiative

---

## 📋 Document Organization

This development plan has been **split by initiative** for better maintainability. Each initiative is now in its own detailed document.

### Quick Links

**📖 [Complete Initiative Index](initiatives/INDEX.md)** - Start here for full overview

### Individual Initiatives

1. **[INIT-001: Platform Foundation](initiatives/INIT-001-Platform-Foundation.md)** - Electron, OS integration, updates, builds
2. **[INIT-002: Core Engine Systems](initiatives/INIT-002-Core-Engine-Systems.md)** - ECS, events, resources, plugins
3. **[INIT-003: Rendering & Graphics](initiatives/INIT-003-Rendering-Graphics.md)** - WebGPU, PBR, post-processing
4. **[INIT-004: Physics & Simulation](initiatives/INIT-004-Physics-Simulation.md)** - Rapier/Cannon/Box2D, determinism, replay
5. **[INIT-005: Networking & Multiplayer](initiatives/INIT-005-Networking-Multiplayer.md)** - State sync, prediction, server-authoritative
6. **[INIT-006: Development Tools](initiatives/INIT-006-Development-Tools.md)** - Debug console, inspector, profiler
7. **[INIT-007: Asset Pipeline](initiatives/INIT-007-Asset-Pipeline.md)** - Processing, packaging, hot-reload
8. **[INIT-008: Backend Services](initiatives/INIT-008-Backend-Services.md)** - NestJS, matchmaking, social, analytics
9. **[INIT-009: Security & Anti-Cheat](initiatives/INIT-009-Security-Anti-Cheat.md)** - Security hardening, anti-cheat
10. **[INIT-010: Performance & Optimization](initiatives/INIT-010-Performance-Optimization.md)** - Profiling, memory, rendering, network

---

## 🎯 Executive Summary

This document outlines the development plan for Miskatonic Engine, organized into strategic initiatives and tactical epics. Each initiative represents a major domain of work, while epics represent deliverable milestones within those domains.

### Planning Structure

```
Initiative (Domain)
  └─ Epic (Major Deliverable)
      └─ User Stories (Features)
          └─ Tasks (Implementation Details)
```

---

## 📊 Progress Summary

**Completed Epics:** 9 of 50+ planned (18%)

| Epic | Status | Test Coverage | Key Achievement |
|------|--------|---------------|-----------------|
| 1.1 - Electron Architecture | ✅ Complete | Full | Secure multi-process architecture with IPC |
| 1.2 - Native OS Integration | ✅ Complete | Full | File dialogs, menus, tray, shortcuts, notifications |
| 2.1 - ECS Core | ✅ Complete | 65/65 tests | Archetype-based ECS with generation validation |
| 2.3 - Event System | ✅ Complete | 49/49 tests | Production-ready event bus with critical fixes |
| 2.4 - Resource Management | ✅ Complete | 91/91 tests | Async loading, ref counting, hot-reload, memory profiling |
| 4.2 - Collision System | ✅ Complete | Manual validation | All shape types, compound shapes, CCD, callbacks |
| 4.3 - Rigid Body Dynamics | ✅ Complete | Manual validation | 6 joint types, motors, spring joints, joint breaking |
| 4.4 - Deterministic Simulation | ✅ Complete | Integration tests | Serialization, replay, rollback, determinism verification |
| 4.5 - Fix Deterministic Simulation | ✅ Complete | 7 integration tests | All 5 critical bugs fixed, production-ready |

**Current Focus:** Next epic TBD (physics foundation complete)

---

## 🗺️ Initiative Overview

| ID | Initiative | Priority | Status | Progress |
|----|------------|----------|--------|----------|
| INIT-001 | Platform Foundation | P0 | In Progress | 2/4 epics (50%) |
| INIT-002 | Core Engine Systems | P0 | In Progress | 3/5 epics (60%) |
| INIT-003 | Rendering & Graphics | P0 | Planned | 0/5 epics (0%) |
| INIT-004 | Physics & Simulation | P0 | In Progress | 4/5 epics (80%) |
| INIT-005 | Networking & Multiplayer | P0 | In Progress | 2/4 epics (50%) |
| INIT-006 | Development Tools | P1 | Planned | 0/3 epics (0%) |
| INIT-007 | Asset Pipeline | P1 | Planned | 0/2 epics (0%) |
| INIT-008 | Backend Services | P0 | Planned | 0/4 epics (0%) |
| INIT-009 | Security & Anti-Cheat | P1 | Planned | 0/2 epics (0%) |
| INIT-010 | Performance & Optimization | P1 | Planned | 0/4 epics (0%) |

---

## 🏗️ Architectural Foundations

Before diving into initiatives, review these key documents:

### Core Architecture Documents

- **[HLD.md](HLD.md)** - High-Level Design Document (v4.0)
  - System architecture, ECS design, rendering pipeline, physics system
  - Performance budgets (60 FPS, 500MB RAM, 256MB VRAM, <5ms GC)
  - Cache optimization strategy (SoA typed arrays, sequential iteration)
  - Memory management (GC mitigation, object pooling, frame allocators)
  - 14 Architecture Decision Records (ADRs)

- **[CLAUDE.md](../CLAUDE.md)** - Development Guidelines
  - Breaking changes policy (alpha = no backward compatibility)
  - Tech stack and workspace structure
  - Testing strategy (>80% coverage required)
  - Development commands and troubleshooting

- **[ARCHITECTURE.md](../docs/ARCHITECTURE.md)** - Detailed Technical Architecture
  - Package-by-package breakdown
  - Integration patterns
  - Development workflow

### Key Architectural Decisions

See [HLD.md - Architecture Decision Records](HLD.md#architecture-decision-records) for complete list. Highlights:

- **ADR-002:** ECS Architecture (archetype-based for cache efficiency)
- **ADR-003:** Server-Authoritative Multiplayer (anti-cheat)
- **ADR-007:** Phase-Based Game Loop (INPUT → UPDATE → PHYSICS → RENDER → NETWORK)
- **ADR-012:** SoA Typed Arrays for Component Storage (10-100x performance improvement)
- **ADR-013:** Sequential Iteration Requirement (cache-friendly systems)
- **ADR-014:** Object Pooling and Frame Allocators (GC mitigation)

---

## 🎮 Technology Stack

### Frontend (Electron Renderer)
- **Platform:** Electron (Chromium + Node.js)
- **Language:** TypeScript 5.0+
- **Graphics:** WebGPUd
- **Build:** Vite, Webpack 5
- **Target:** 60 FPS on mid-range hardware

### Backend (Game Server)
- **Runtime:** Node.js 18+
- **Framework:** NestJS
- **Networking:** Socket.io (WebSocket), WebRTC (P2P)
- **Target:** 100+ concurrent players, <50ms latency

### Databases
- **MongoDB:** Player data, game state (100k+ QPS target)
- **Redis:** Caching, sessions, leaderboards (sub-ms latency)
- **Elasticsearch:** Analytics, search, logging

### Infrastructure
- **Containers:** Docker, Kubernetes
- **Cloud:** AWS/GCP
- **CDN:** CloudFlare

---

## 🔄 Development Workflow

### Working with Initiatives

1. **Read the Initiative:** Navigate to specific initiative file (e.g., `INIT-001-Platform-Foundation.md`)
2. **Select an Epic:** Choose next unstarted epic within initiative
3. **Review Architecture:** Check HLD.md for relevant subsystem design
4. **Implement User Stories:** Break down into tasks
5. **Follow Definition of Done:** >80% test coverage, benchmarks pass, documentation complete

### Creating New Epics

When creating new epics, ensure:
- Clear acceptance criteria
- User stories in format: "As a [role], I want [feature] so that [benefit]"
- Refined Tasks
- Dependencies identified
- Performance targets defined

### Definition of Done

An epic is complete when:
- ✅ All acceptance criteria met
- ✅ Code coverage >80%
- ✅ Unit and integration tests passing
- ✅ Performance benchmarks passing
- ✅ Documentation updated
- ✅ Code review completed
- ✅ Cross-platform testing done (if applicable)

---

## 📈 Performance Targets

### Frame Budget (60 FPS = 16.67ms)

| System | Target | Critical Max |
|--------|--------|--------------|
| Input | 0.5ms | 1.0ms |
| ECS Systems | 1.0ms | 2.0ms |
| Physics | 2.0ms | 4.0ms |
| Game Logic | 3.0ms | 5.0ms |
| Rendering | 5.0ms | 8.0ms |
| Network | 1.0ms | 2.0ms |
| GC Pauses | <5.0ms | <10.0ms |

### Memory Budgets

- **RAM:** 500MB target, 1GB critical max
- **VRAM:** 256MB target
- **GC Budget:** <5ms pauses, <1000 objects/frame
- **Network:** <50 objects/tick allocation

### Quality Targets

- **FPS:** 60 target, 30 critical minimum
- **Network Latency:** <50ms target, <150ms critical max
- **Draw Calls:** 500 target, 1000 critical max
- **Entity Count:** 1000+ rendered objects at 60 FPS

---

## 🚀 Next Steps

### For Developers

1. **Start Here:** [Initiative Index](initiatives/INDEX.md)
2. **Review Architecture:** [HLD.md](HLD.md)
3. **Setup Environment:** Follow [CLAUDE.md](../CLAUDE.md) setup instructions
4. **Pick an Epic:** Choose from initiative files based on priority
5. **Follow Guidelines:** Adhere to Definition of Done

### For Project Managers

1. **Track Progress:** Use initiative files to monitor epic completion
2. **Update Status:** Mark epics as Complete/In Progress/Blocked
3. **Manage Dependencies:** Ensure prerequisite epics complete before starting dependent work
4. **Review Metrics:** Monitor test coverage and performance benchmarks

### For Architects

1. **Review ADRs:** See [HLD.md](HLD.md#architecture-decision-records) for architectural decisions
2. **Update HLD:** Modify HLD.md when making significant architectural changes
3. **Document Decisions:** Add new ADRs for major technical choices
4. **Maintain Consistency:** Ensure new epics align with established patterns

---

## 📝 Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Nov 2024 | Initial monolithic development plan |
| 2.0 | Nov 2025 | Split by initiative for better maintainability, added INDEX.md |

---

## 📞 Support

- **Documentation:** See [HLD.md](HLD.md), [CLAUDE.md](../CLAUDE.md), [ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- **Issues:** Report at https://github.com/anthropics/claude-code/issues
- **Help:** Run `/help` in Claude Code

---

*This is a living document. For detailed epic breakdowns, see individual initiative files.*
