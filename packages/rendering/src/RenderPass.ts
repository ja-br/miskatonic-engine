import type { DrawCommand, ClearCommand } from './types';

/**
 * Render pass target
 */
export type RenderTarget = string | 'screen';

/**
 * Render pass configuration
 */
export interface RenderPassConfig {
  name: string;
  target: RenderTarget; // Framebuffer ID or 'screen'
  clear?: ClearCommand;
  dependencies?: string[]; // Pass names this depends on
}

/**
 * Render pass for multi-pass rendering
 *
 * A render pass represents a single rendering operation to a target.
 * Multiple passes can be chained together for effects like:
 * - Shadow mapping
 * - Post-processing
 * - Deferred rendering
 * - Reflections
 */
export class RenderPass {
  public readonly name: string;
  public readonly target: RenderTarget;
  public readonly clear?: ClearCommand;
  public readonly dependencies: string[];
  private commands: DrawCommand[] = [];
  private static readonly MAX_COMMANDS_PER_PASS = 10000;

  constructor(config: RenderPassConfig) {
    this.name = config.name;
    this.target = config.target;
    this.clear = config.clear;
    this.dependencies = config.dependencies ?? [];
  }

  /**
   * Add draw command to pass
   */
  addCommand(command: DrawCommand): void {
    if (this.commands.length >= RenderPass.MAX_COMMANDS_PER_PASS) {
      throw new Error(`Maximum commands per pass exceeded (${RenderPass.MAX_COMMANDS_PER_PASS}) in pass: ${this.name}`);
    }
    this.commands.push(command);
  }

  /**
   * Get all commands
   */
  getCommands(): readonly DrawCommand[] {
    return this.commands;
  }

  /**
   * Clear all commands
   */
  clearCommands(): void {
    this.commands = [];
  }

  /**
   * Get command count
   */
  getCommandCount(): number {
    return this.commands.length;
  }
}

/**
 * Render pass manager for orchestrating multi-pass rendering
 */
export class RenderPassManager {
  private passes = new Map<string, RenderPass>();
  private executionOrder: string[] = [];

  /**
   * Add render pass
   */
  addPass(pass: RenderPass): void {
    if (this.passes.has(pass.name)) {
      throw new Error(`Render pass already exists: ${pass.name}`);
    }
    this.passes.set(pass.name, pass);
    this.computeExecutionOrder();
  }

  /**
   * Remove render pass
   */
  removePass(name: string): void {
    this.passes.delete(name);
    this.computeExecutionOrder();
  }

  /**
   * Get render pass
   */
  getPass(name: string): RenderPass | null {
    return this.passes.get(name) ?? null;
  }

  /**
   * Get all passes in execution order
   */
  getPasses(): readonly RenderPass[] {
    return this.executionOrder.map((name) => this.passes.get(name)!);
  }

  /**
   * Clear all passes
   */
  clearPasses(): void {
    this.passes.clear();
    this.executionOrder = [];
  }

  /**
   * Compute execution order based on dependencies (topological sort)
   */
  private computeExecutionOrder(): void {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const order: string[] = [];

    const visit = (name: string): void => {
      if (temp.has(name)) {
        throw new Error(`Circular dependency detected in render pass: ${name}`);
      }
      if (visited.has(name)) {
        return;
      }

      temp.add(name);

      const pass = this.passes.get(name);
      if (pass) {
        for (const dep of pass.dependencies) {
          if (!this.passes.has(dep)) {
            throw new Error(`Render pass dependency not found: ${dep} (required by ${name})`);
          }
          visit(dep);
        }
      }

      temp.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of this.passes.keys()) {
      if (!visited.has(name)) {
        visit(name);
      }
    }

    this.executionOrder = order;
  }
}
