/**
 * Mesh Abstraction for High-Level Rendering API
 * Epic 3.14: High-Level Rendering API Wrapper - Task 2.4
 */

import { createCube, createSphere, createPlane, type GeometryData } from '../Geometry';
import { generateId } from './utils';
import type { BackendBufferHandle } from '../backends/IRendererBackend';
import type { IndexedGeometry } from '../commands/DrawCommand';

// Forward declaration
export interface HighLevelRenderer {
  backend: any;
}

export interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * Mesh class - manages vertex and index buffers for geometry
 *
 * Usage:
 * ```typescript
 * const cube = Mesh.Cube(renderer, 2);
 * const geometry = cube.getGeometry();
 * renderer.draw(cube, material, transform);
 * cube.dispose(); // Clean up when done
 * ```
 */
export class Mesh {
  private vertexBuffer?: BackendBufferHandle;
  private indexBuffer?: BackendBufferHandle;
  private vertexCount: number;
  private indexCount: number;
  private indexFormat: 'uint16' | 'uint32';
  private bounds?: BoundingBox;
  private disposed = false;

  public readonly id: string;

  private constructor(
    private renderer: HighLevelRenderer,
    private geometry: GeometryData,
    bounds?: BoundingBox
  ) {
    this.id = generateId('mesh');
    this.vertexCount = geometry.positions.length / 3;
    this.indexCount = geometry.indices.length;
    // Determine format based on actual array type, not index count
    this.indexFormat = geometry.indices instanceof Uint32Array ? 'uint32' : 'uint16';
    this.bounds = bounds;

    this.createBuffers();
  }

  private createBuffers(): void {
    // Interleave vertex data: position (3) + normal (3) + uv (2) = 8 floats per vertex
    const vertexData = new Float32Array(this.vertexCount * 8);

    for (let i = 0; i < this.vertexCount; i++) {
      const offset = i * 8;
      const posOffset = i * 3;
      const uvOffset = i * 2;

      // Position
      vertexData[offset + 0] = this.geometry.positions[posOffset + 0];
      vertexData[offset + 1] = this.geometry.positions[posOffset + 1];
      vertexData[offset + 2] = this.geometry.positions[posOffset + 2];

      // Normal
      vertexData[offset + 3] = this.geometry.normals[posOffset + 0];
      vertexData[offset + 4] = this.geometry.normals[posOffset + 1];
      vertexData[offset + 5] = this.geometry.normals[posOffset + 2];

      // UV
      vertexData[offset + 6] = this.geometry.uvs[uvOffset + 0];
      vertexData[offset + 7] = this.geometry.uvs[uvOffset + 1];
    }

    // Create vertex buffer
    this.vertexBuffer = this.renderer.backend.createBuffer(
      `${this.id}_vertices`,
      'vertex',
      vertexData,
      'static_draw'
    );

    // Create index buffer
    this.indexBuffer = this.renderer.backend.createBuffer(
      `${this.id}_indices`,
      'index',
      this.geometry.indices,
      'static_draw'
    );
  }

  /**
   * Get draw command geometry descriptor
   * Returns indexed geometry configuration for rendering
   */
  getGeometry(): IndexedGeometry {
    if (!this.vertexBuffer || !this.indexBuffer) {
      throw new Error('Mesh buffers not initialized');
    }

    return {
      type: 'indexed',
      vertexBuffers: new Map([[0, this.vertexBuffer]]),
      indexBuffer: this.indexBuffer,
      indexFormat: this.indexFormat,
      indexCount: this.indexCount,
    };
  }

  /**
   * Get bounding box for frustum culling
   * Returns undefined if bounds were not calculated
   */
  getBounds(): BoundingBox | undefined {
    return this.bounds;
  }

  /**
   * Clean up GPU resources
   * Should be called when the mesh is no longer needed
   */
  dispose(): void {
    if (this.disposed) return;

    if (this.vertexBuffer) {
      this.renderer.backend.deleteBuffer(this.vertexBuffer);
      this.vertexBuffer = undefined;
    }
    if (this.indexBuffer) {
      this.renderer.backend.deleteBuffer(this.indexBuffer);
      this.indexBuffer = undefined;
    }

    this.disposed = true;
  }

  // ============================================================================
  // Static factory methods for primitive geometry
  // ============================================================================

  /**
   * Create a cube mesh
   *
   * @param renderer - High-level renderer instance
   * @param size - Side length of the cube (default: 1)
   * @returns Cube mesh with vertex/index buffers
   *
   * @example
   * ```typescript
   * const cube = Mesh.Cube(renderer, 2); // 2x2x2 cube
   * ```
   */
  static Cube(renderer: HighLevelRenderer, size = 1): Mesh {
    const geometry = createCube(size);
    const halfSize = size / 2;
    return new Mesh(renderer, geometry, {
      min: [-halfSize, -halfSize, -halfSize],
      max: [halfSize, halfSize, halfSize],
    });
  }

  /**
   * Create a sphere mesh
   *
   * @param renderer - High-level renderer instance
   * @param radius - Radius of the sphere (default: 1)
   * @param widthSegments - Number of horizontal segments (default: 32)
   * @param heightSegments - Number of vertical segments (default: 16)
   * @returns Sphere mesh with vertex/index buffers
   *
   * @example
   * ```typescript
   * const sphere = Mesh.Sphere(renderer, 1, 32, 16);
   * ```
   */
  static Sphere(
    renderer: HighLevelRenderer,
    radius = 1,
    widthSegments = 32,
    heightSegments = 16
  ): Mesh {
    const geometry = createSphere(radius, widthSegments, heightSegments);
    return new Mesh(renderer, geometry, {
      min: [-radius, -radius, -radius],
      max: [radius, radius, radius],
    });
  }

  /**
   * Create a plane mesh
   *
   * @param renderer - High-level renderer instance
   * @param width - Width of the plane (default: 1)
   * @param height - Height of the plane (default: 1)
   * @param widthSegments - Number of width subdivisions (default: 1)
   * @param heightSegments - Number of height subdivisions (default: 1)
   * @returns Plane mesh with vertex/index buffers
   *
   * @example
   * ```typescript
   * const ground = Mesh.Plane(renderer, 10, 10, 10, 10); // 10x10 subdivided plane
   * ```
   */
  static Plane(
    renderer: HighLevelRenderer,
    width = 1,
    height = 1,
    widthSegments = 1,
    heightSegments = 1
  ): Mesh {
    const geometry = createPlane(width, height, widthSegments, heightSegments);
    const halfW = width / 2;
    const halfH = height / 2;
    return new Mesh(renderer, geometry, {
      min: [-halfW, 0, -halfH],
      max: [halfW, 0, halfH],
    });
  }
}
