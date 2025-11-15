/**
 * VertexLayoutBuilder - Epic RENDERING-06 Task 6.1
 *
 * Fluent builder for vertex layouts.
 * Reduces 15+ lines of layout code to 5 lines with type safety.
 *
 * @example
 * ```typescript
 * // Simple PBR layout
 * const layout = VertexLayoutBuilder.PBR().build();
 *
 * // Custom layout
 * const layout = new VertexLayoutBuilder()
 *   .position(0)
 *   .normal(1)
 *   .uv(2)
 *   .build();
 * ```
 */

import type { VertexBufferLayout } from '../backends/IRendererBackend';

/**
 * Fluent builder for vertex buffer layouts
 */
export class VertexLayoutBuilder {
  private attributes: Array<{
    shaderLocation: number;
    offset: number;
    format: string;
  }> = [];
  private stride = 0;
  private stepMode: 'vertex' | 'instance' = 'vertex';
  private autoOffset = true;

  /**
   * Add position attribute (float32x3)
   */
  position(location: number, offset?: number): this {
    return this.addAttribute(location, 'float32x3', offset, 12);
  }

  /**
   * Add normal attribute (float32x3)
   */
  normal(location: number, offset?: number): this {
    return this.addAttribute(location, 'float32x3', offset, 12);
  }

  /**
   * Add UV coordinate attribute (float32x2)
   */
  uv(location: number, offset?: number): this {
    return this.addAttribute(location, 'float32x2', offset, 8);
  }

  /**
   * Add color attribute (float32x4)
   */
  color(location: number, offset?: number): this {
    return this.addAttribute(location, 'float32x4', offset, 16);
  }

  /**
   * Add tangent attribute (float32x4)
   */
  tangent(location: number, offset?: number): this {
    return this.addAttribute(location, 'float32x4', offset, 16);
  }

  /**
   * Add custom attribute
   */
  custom(location: number, format: string, offset?: number): this {
    const size = this.getFormatSize(format);
    return this.addAttribute(location, format, offset, size);
  }

  /**
   * Add instance matrix (4x vec4) starting at location
   */
  instanceMatrix(startLocation: number): this {
    this.stepMode = 'instance';
    for (let i = 0; i < 4; i++) {
      this.addAttribute(startLocation + i, 'float32x4', undefined, 16);
    }
    return this;
  }

  /**
   * Add instance color
   */
  instanceColor(location: number): this {
    this.stepMode = 'instance';
    return this.addAttribute(location, 'float32x4', undefined, 16);
  }

  /**
   * Set step mode explicitly
   */
  setStepMode(mode: 'vertex' | 'instance'): this {
    this.stepMode = mode;
    return this;
  }

  /**
   * Disable automatic offset calculation
   */
  manualOffsets(): this {
    this.autoOffset = false;
    return this;
  }

  /**
   * Build final vertex buffer layout
   */
  build(): VertexBufferLayout {
    if (this.attributes.length === 0) {
      throw new Error('No attributes added to vertex layout');
    }

    return {
      arrayStride: this.stride,
      stepMode: this.stepMode,
      attributes: this.attributes
    };
  }

  /**
   * Create common PBR vertex layout (position, normal, uv, tangent)
   */
  static PBR(startLocation = 0): VertexLayoutBuilder {
    return new VertexLayoutBuilder()
      .position(startLocation)
      .normal(startLocation + 1)
      .uv(startLocation + 2)
      .tangent(startLocation + 3);
  }

  /**
   * Create simple vertex layout (position, uv)
   */
  static Simple(startLocation = 0): VertexLayoutBuilder {
    return new VertexLayoutBuilder()
      .position(startLocation)
      .uv(startLocation + 1);
  }

  /**
   * Create colored vertex layout (position, color)
   */
  static Colored(startLocation = 0): VertexLayoutBuilder {
    return new VertexLayoutBuilder()
      .position(startLocation)
      .color(startLocation + 1);
  }

  /**
   * Create position-only layout (simplest)
   */
  static PositionOnly(location = 0): VertexLayoutBuilder {
    return new VertexLayoutBuilder().position(location);
  }

  /**
   * Create position + normal layout (for lighting)
   */
  static Lit(startLocation = 0): VertexLayoutBuilder {
    return new VertexLayoutBuilder()
      .position(startLocation)
      .normal(startLocation + 1);
  }

  // Private implementation

  private addAttribute(
    location: number,
    format: string,
    offset: number | undefined,
    size: number
  ): this {
    const actualOffset = offset ?? (this.autoOffset ? this.stride : 0);

    this.attributes.push({
      shaderLocation: location,
      offset: actualOffset,
      format
    });

    this.stride = Math.max(this.stride, actualOffset + size);

    return this;
  }

  private getFormatSize(format: string): number {
    const sizes: Record<string, number> = {
      'float32': 4,
      'float32x2': 8,
      'float32x3': 12,
      'float32x4': 16,
      'sint32': 4,
      'sint32x2': 8,
      'sint32x3': 12,
      'sint32x4': 16,
      'uint32': 4,
      'uint32x2': 8,
      'uint32x3': 12,
      'uint32x4': 16,
      'sint16x2': 4,
      'sint16x4': 8,
      'uint16x2': 4,
      'uint16x4': 8,
      'sint8x2': 2,
      'sint8x4': 4,
      'uint8x2': 2,
      'uint8x4': 4,
      'unorm8x2': 2,
      'unorm8x4': 4,
      'snorm8x2': 2,
      'snorm8x4': 4,
      'unorm16x2': 4,
      'unorm16x4': 8,
      'snorm16x2': 4,
      'snorm16x4': 8,
      'float16x2': 4,
      'float16x4': 8
    };

    const size = sizes[format];
    if (size === undefined) {
      throw new Error(`Unknown vertex format: "${format}". Valid formats: ${Object.keys(sizes).join(', ')}`);
    }
    return size;
  }
}
