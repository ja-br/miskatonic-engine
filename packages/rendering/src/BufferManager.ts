import type { BufferUsage } from './types';

/**
 * Buffer descriptor
 */
export interface BufferDescriptor {
  id: string;
  target: 'vertex' | 'index';
  usage: BufferUsage;
  size: number;
  buffer: WebGLBuffer;
}

/**
 * Buffer manager for vertex and index buffer management
 *
 * Features:
 * - Buffer caching by ID
 * - Usage hint tracking
 * - Buffer orphaning for streaming data
 * - Memory usage tracking
 * - Auto cleanup
 */
export class BufferManager {
  private gl: WebGL2RenderingContext;
  private buffers = new Map<string, BufferDescriptor>();
  private totalMemory = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Create a vertex or index buffer
   */
  createBuffer(
    id: string,
    target: 'vertex' | 'index',
    data: ArrayBuffer | ArrayBufferView,
    usage: BufferUsage
  ): BufferDescriptor {
    // Check if buffer already exists
    const existing = this.buffers.get(id);
    if (existing) {
      // Update existing buffer
      return this.updateBuffer(id, data);
    }

    // Create new buffer
    const buffer = this.gl.createBuffer();
    if (!buffer) {
      throw new Error(`Failed to create buffer: ${id}`);
    }

    const glTarget = target === 'vertex' ? this.gl.ARRAY_BUFFER : this.gl.ELEMENT_ARRAY_BUFFER;
    const glUsage = this.mapUsageHint(usage);

    // Bind and upload data
    this.gl.bindBuffer(glTarget, buffer);
    this.gl.bufferData(glTarget, data, glUsage);

    // Calculate size
    const size = data instanceof ArrayBuffer ? data.byteLength : (data as ArrayBufferView).byteLength;
    this.totalMemory += size;

    // Create descriptor
    const descriptor: BufferDescriptor = {
      id,
      target,
      usage,
      size,
      buffer,
    };

    this.buffers.set(id, descriptor);
    return descriptor;
  }

  /**
   * Update buffer data
   */
  updateBuffer(id: string, data: ArrayBuffer | ArrayBufferView, offset: number = 0): BufferDescriptor {
    const descriptor = this.buffers.get(id);
    if (!descriptor) {
      throw new Error(`Buffer not found: ${id}`);
    }

    const glTarget = descriptor.target === 'vertex' ? this.gl.ARRAY_BUFFER : this.gl.ELEMENT_ARRAY_BUFFER;
    const size = data instanceof ArrayBuffer ? data.byteLength : (data as ArrayBufferView).byteLength;

    this.gl.bindBuffer(glTarget, descriptor.buffer);

    // Check if we need to reallocate
    if (offset + size > descriptor.size) {
      // Orphan old buffer and allocate new one
      const glUsage = this.mapUsageHint(descriptor.usage);
      this.gl.bufferData(glTarget, data, glUsage);

      // Update memory tracking
      this.totalMemory -= descriptor.size;
      this.totalMemory += size;
      descriptor.size = size;
    } else {
      // Update sub-region
      this.gl.bufferSubData(glTarget, offset, data);
    }

    return descriptor;
  }

  /**
   * Get buffer descriptor
   */
  getBuffer(id: string): BufferDescriptor | null {
    return this.buffers.get(id) ?? null;
  }

  /**
   * Check if buffer exists
   */
  hasBuffer(id: string): boolean {
    return this.buffers.has(id);
  }

  /**
   * Delete buffer
   */
  deleteBuffer(id: string): void {
    const descriptor = this.buffers.get(id);
    if (descriptor) {
      this.gl.deleteBuffer(descriptor.buffer);
      this.totalMemory -= descriptor.size;
      this.buffers.delete(id);
    }
  }

  /**
   * Get all buffer IDs
   */
  getBufferIds(): string[] {
    return Array.from(this.buffers.keys());
  }

  /**
   * Get total memory usage in bytes
   */
  getTotalMemory(): number {
    return this.totalMemory;
  }

  /**
   * Get buffer count
   */
  getBufferCount(): number {
    return this.buffers.size;
  }

  /**
   * Map usage hint to WebGL constant
   */
  private mapUsageHint(usage: BufferUsage): number {
    switch (usage) {
      case 'static_draw':
        return this.gl.STATIC_DRAW;
      case 'dynamic_draw':
        return this.gl.DYNAMIC_DRAW;
      case 'stream_draw':
        return this.gl.STREAM_DRAW;
      default:
        return this.gl.STATIC_DRAW;
    }
  }

  /**
   * Clean up all buffers
   */
  dispose(): void {
    for (const descriptor of this.buffers.values()) {
      this.gl.deleteBuffer(descriptor.buffer);
    }
    this.buffers.clear();
    this.totalMemory = 0;
  }
}
