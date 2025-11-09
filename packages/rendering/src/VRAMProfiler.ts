/**
 * Epic 3.8: GPU Memory Management - VRAM Profiler
 *
 * VRAMProfiler tracks GPU memory usage by category and enforces budgets.
 * Provides warnings when approaching limits and prevents VRAM exhaustion.
 *
 * Performance targets:
 * - Total VRAM usage <256MB
 * - Per-category budgets enforced
 * - Real-time usage tracking
 */

export enum VRAMCategory {
  TEXTURES = 'textures',
  VERTEX_BUFFERS = 'vertex_buffers',
  INDEX_BUFFERS = 'index_buffers',
  UNIFORM_BUFFERS = 'uniform_buffers',
  RENDER_TARGETS = 'render_targets',
  OTHER = 'other',
}

export interface VRAMBudget {
  textures: number;
  vertexBuffers: number;
  indexBuffers: number;
  uniformBuffers: number;
  renderTargets: number;
  other: number;
  total: number;
}

export interface VRAMUsage {
  category: VRAMCategory;
  bytes: number;
  allocations: number;
}

export interface VRAMStats {
  totalUsed: number;
  totalBudget: number;
  utilizationPercent: number;
  byCategory: Map<VRAMCategory, VRAMUsage>;
  warnings: string[];
  overBudget: boolean;
}

interface Allocation {
  id: string;
  category: VRAMCategory;
  bytes: number;
  timestamp: number;
}

/**
 * VRAMProfiler - Track and enforce GPU memory budgets
 *
 * Default budgets (256MB total):
 * - Textures: 128MB (50%)
 * - Vertex Buffers: 64MB (25%)
 * - Index Buffers: 32MB (12.5%)
 * - Render Targets: 24MB (9.4%)
 * - Uniform Buffers: 4MB (1.6%)
 * - Other: 4MB (1.6%)
 *
 * Usage:
 * ```typescript
 * const profiler = new VRAMProfiler();
 * profiler.allocate('texture_grass', VRAMCategory.TEXTURES, 1024 * 1024);
 * profiler.deallocate('texture_grass');
 * ```
 */
export class VRAMProfiler {
  private allocations = new Map<string, Allocation>();
  private budget: VRAMBudget;
  private warningThreshold = 0.8; // Warn at 80% usage
  private errorThreshold = 0.95; // Error at 95% usage

  constructor(totalBudget: number = 256 * 1024 * 1024) { // 256MB default
    this.budget = {
      textures: totalBudget * 0.50,        // 128MB
      vertexBuffers: totalBudget * 0.25,   // 64MB
      indexBuffers: totalBudget * 0.125,   // 32MB
      renderTargets: totalBudget * 0.094,  // 24MB
      uniformBuffers: totalBudget * 0.016, // 4MB
      other: totalBudget * 0.016,          // 4MB
      total: totalBudget,
    };
  }

  /**
   * Allocate VRAM for a resource
   * Returns false if allocation would exceed budget
   */
  allocate(id: string, category: VRAMCategory, bytes: number): boolean {
    // Check if already allocated
    if (this.allocations.has(id)) {
      console.warn(`VRAMProfiler: Resource ${id} already allocated`);
      return false;
    }

    // Check budget
    const currentUsage = this.getCategoryUsage(category);
    const categoryBudget = this.getCategoryBudget(category);

    if (currentUsage + bytes > categoryBudget) {
      console.error(
        `VRAMProfiler: Allocation would exceed ${category} budget ` +
        `(${this.formatBytes(currentUsage + bytes)} > ${this.formatBytes(categoryBudget)})`
      );
      return false;
    }

    // Check total budget
    const totalUsage = this.getTotalUsage();
    if (totalUsage + bytes > this.budget.total) {
      console.error(
        `VRAMProfiler: Allocation would exceed total VRAM budget ` +
        `(${this.formatBytes(totalUsage + bytes)} > ${this.formatBytes(this.budget.total)})`
      );
      return false;
    }

    // Allocate
    this.allocations.set(id, {
      id,
      category,
      bytes,
      timestamp: Date.now(),
    });

    // Check for warnings
    this.checkWarnings(category);

    return true;
  }

  /**
   * Deallocate VRAM for a resource
   */
  deallocate(id: string): void {
    this.allocations.delete(id);
  }

  /**
   * Update allocation size (e.g., texture resize)
   */
  resize(id: string, newBytes: number): boolean {
    const allocation = this.allocations.get(id);
    if (!allocation) {
      console.warn(`VRAMProfiler: Cannot resize unknown allocation ${id}`);
      return false;
    }

    const delta = newBytes - allocation.bytes;
    const currentUsage = this.getCategoryUsage(allocation.category);
    const categoryBudget = this.getCategoryBudget(allocation.category);

    if (currentUsage + delta > categoryBudget) {
      console.error(
        `VRAMProfiler: Resize would exceed ${allocation.category} budget`
      );
      return false;
    }

    allocation.bytes = newBytes;
    this.checkWarnings(allocation.category);

    return true;
  }

  /**
   * Get current usage for a category
   */
  private getCategoryUsage(category: VRAMCategory): number {
    let total = 0;
    for (const allocation of this.allocations.values()) {
      if (allocation.category === category) {
        total += allocation.bytes;
      }
    }
    return total;
  }

  /**
   * Get budget for a category
   */
  private getCategoryBudget(category: VRAMCategory): number {
    switch (category) {
      case VRAMCategory.TEXTURES:
        return this.budget.textures;
      case VRAMCategory.VERTEX_BUFFERS:
        return this.budget.vertexBuffers;
      case VRAMCategory.INDEX_BUFFERS:
        return this.budget.indexBuffers;
      case VRAMCategory.UNIFORM_BUFFERS:
        return this.budget.uniformBuffers;
      case VRAMCategory.RENDER_TARGETS:
        return this.budget.renderTargets;
      case VRAMCategory.OTHER:
        return this.budget.other;
    }
  }

  /**
   * Get total VRAM usage
   */
  private getTotalUsage(): number {
    let total = 0;
    for (const allocation of this.allocations.values()) {
      total += allocation.bytes;
    }
    return total;
  }

  /**
   * Check for budget warnings
   * Note: This logs to console but doesn't return warnings.
   * Use getStats() to get warning list.
   */
  private checkWarnings(category: VRAMCategory): void {
    const usage = this.getCategoryUsage(category);
    const budget = this.getCategoryBudget(category);
    const utilization = usage / budget;

    if (utilization >= this.errorThreshold) {
      console.error(
        `VRAMProfiler: ${category} at ${(utilization * 100).toFixed(1)}% capacity ` +
        `(${this.formatBytes(usage)} / ${this.formatBytes(budget)})`
      );
    } else if (utilization >= this.warningThreshold) {
      console.warn(
        `VRAMProfiler: ${category} at ${(utilization * 100).toFixed(1)}% capacity ` +
        `(${this.formatBytes(usage)} / ${this.formatBytes(budget)})`
      );
    }
  }

  /**
   * Get comprehensive VRAM statistics
   */
  getStats(): VRAMStats {
    const byCategory = new Map<VRAMCategory, VRAMUsage>();
    const warnings: string[] = [];

    // Calculate usage by category
    for (const category of Object.values(VRAMCategory)) {
      const catValue = category as VRAMCategory;
      const bytes = this.getCategoryUsage(catValue);
      const allocations = Array.from(this.allocations.values()).filter(
        a => a.category === catValue
      ).length;

      byCategory.set(catValue, {
        category: catValue,
        bytes,
        allocations,
      });

      // Check for warnings
      const budget = this.getCategoryBudget(catValue);
      const utilization = bytes / budget;

      if (utilization >= this.warningThreshold) {
        warnings.push(
          `${catValue}: ${(utilization * 100).toFixed(1)}% ` +
          `(${this.formatBytes(bytes)} / ${this.formatBytes(budget)})`
        );
      }
    }

    const totalUsed = this.getTotalUsage();
    const totalBudget = this.budget.total;
    const utilizationPercent = (totalUsed / totalBudget) * 100;
    const overBudget = totalUsed > totalBudget;

    return {
      totalUsed,
      totalBudget,
      utilizationPercent,
      byCategory,
      warnings,
      overBudget,
    };
  }

  /**
   * Get budget configuration
   */
  getBudget(): VRAMBudget {
    return { ...this.budget };
  }

  /**
   * Set custom budget (overrides defaults)
   */
  setBudget(budget: Partial<VRAMBudget>): void {
    if (budget.total !== undefined) {
      this.budget.total = budget.total;
    }
    if (budget.textures !== undefined) {
      this.budget.textures = budget.textures;
    }
    if (budget.vertexBuffers !== undefined) {
      this.budget.vertexBuffers = budget.vertexBuffers;
    }
    if (budget.indexBuffers !== undefined) {
      this.budget.indexBuffers = budget.indexBuffers;
    }
    if (budget.uniformBuffers !== undefined) {
      this.budget.uniformBuffers = budget.uniformBuffers;
    }
    if (budget.renderTargets !== undefined) {
      this.budget.renderTargets = budget.renderTargets;
    }
    if (budget.other !== undefined) {
      this.budget.other = budget.other;
    }
  }

  /**
   * Set warning threshold (0-1)
   */
  setWarningThreshold(threshold: number): void {
    this.warningThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Set error threshold (0-1)
   */
  setErrorThreshold(threshold: number): void {
    this.errorThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Clear all allocations
   */
  clear(): void {
    this.allocations.clear();
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${bytes} bytes`;
  }

  /**
   * Get all allocations (for debugging)
   */
  getAllocations(): Allocation[] {
    return Array.from(this.allocations.values());
  }

  /**
   * Get largest allocations (for debugging)
   */
  getLargestAllocations(count: number = 10): Allocation[] {
    return Array.from(this.allocations.values())
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, count);
  }
}
