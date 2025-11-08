/**
 * @miskatonic/core - Main engine class and integration layer
 *
 * This package provides the MiskatonicEngine class that coordinates
 * all engine subsystems (ECS, Events, Resources, Physics, Network).
 */

export { MiskatonicEngine } from './MiskatonicEngine';
export { GameLoop, SystemPhase } from './GameLoop';
export type { PhaseSystem, FrameStats, GameLoopConfig } from './GameLoop';
export * from './types';
export * from './commands';
