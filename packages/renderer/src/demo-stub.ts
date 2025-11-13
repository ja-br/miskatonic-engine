/**
 * DEMO STUB - Epic 3.14 Migration Required
 *
 * The original demo.ts used RenderQueue API which was removed in Epic 3.14.
 * This demo needs a complete refactor to use the new DrawCommand API.
 *
 * TODO: Port demo.ts to Epic 3.14 API (see phase0-validation.ts for reference)
 */

export class Demo {
  constructor(canvas: HTMLCanvasElement) {
    console.warn('Demo is disabled - requires Epic 3.14 migration');
    console.warn('The old demo used RenderQueue which was removed');
    console.warn('See packages/renderer/phase0-validation.html for a working demo');
  }

  async initialize(): Promise<boolean> {
    return false;
  }

  start(): void {
    // No-op
  }

  stop(): void {
    // No-op
  }

  dispose(): void {
    // No-op
  }

  // Stub methods for UI controls
  incrementDiceSets(): void {}
  decrementDiceSets(): void {}
  manualRoll(): void {}
  getDiceSets(): number { return 0; }
  setDiceSets(value: number): void {}
  reset(): void {}
}
