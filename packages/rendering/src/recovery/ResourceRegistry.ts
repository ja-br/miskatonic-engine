/**
 * ResourceRegistry - Epic RENDERING-04, Task 4.2
 *
 * Tracks all GPU resources for recreation after device loss.
 * Stores creation parameters so resources can be recreated exactly.
 *
 * IMPORTANT LIMITATION: Resource data is captured at creation time only.
 * If you call updateBuffer() or updateTexture() after creation, those updates
 * will NOT be reflected in the registry. After device recovery, resources will
 * be recreated with their ORIGINAL creation data.
 *
 * For dynamic resources that change frequently, consider:
 * - Regenerating data from application state after recovery
 * - Using the recovery callback to manually update resources
 * - Storing mutable data in application state, not GPU resources
 *
 * Usage:
 * ```typescript
 * const registry = new ResourceRegistry();
 * registry.register({
 *   type: ResourceType.BUFFER,
 *   id: 'vertexBuffer',
 *   creationParams: { size: 1024, usage: 'static_draw' },
 *   data: vertexData  // Captured at creation, not updated later
 * });
 * ```
 */

import type { BufferUsage, TextureFormat, ShaderSource } from '../types';
import type { PipelineStateDescriptor } from '../PipelineStateDescriptor';

export enum ResourceType {
  BUFFER = 'buffer',
  TEXTURE = 'texture',
  SAMPLER = 'sampler',
  SHADER = 'shader',
  PIPELINE = 'pipeline',
  BIND_GROUP = 'bind_group',
  BIND_GROUP_LAYOUT = 'bind_group_layout'
}

export interface ResourceDescriptor {
  type: ResourceType;
  id: string;
  label?: string;
  creationParams: any; // Type depends on resource type
}

export interface BufferDescriptor extends ResourceDescriptor {
  type: ResourceType.BUFFER;
  creationParams: {
    bufferType: 'vertex' | 'index' | 'uniform' | 'storage';
    size: number;
    usage: BufferUsage;
  };
  data?: ArrayBuffer; // Store data for recreation
}

export interface TextureDescriptor extends ResourceDescriptor {
  type: ResourceType.TEXTURE;
  creationParams: {
    width: number;
    height: number;
    format: TextureFormat;
    minFilter?: string;
    magFilter?: string;
    wrapS?: string;
    wrapT?: string;
    generateMipmaps?: boolean;
  };
  data?: ImageBitmap | ArrayBuffer;
}

export interface ShaderDescriptor extends ResourceDescriptor {
  type: ResourceType.SHADER;
  creationParams: {
    source: ShaderSource;
  };
}

export interface PipelineDescriptor extends ResourceDescriptor {
  type: ResourceType.PIPELINE;
  creationParams: {
    shader: string; // Shader ID
    bindGroupLayouts: string[]; // Layout IDs
    vertexLayouts: any[];
    pipelineState: PipelineStateDescriptor;
  };
}

export interface BindGroupLayoutDescriptor extends ResourceDescriptor {
  type: ResourceType.BIND_GROUP_LAYOUT;
  creationParams: {
    entries: any[];
  };
}

export interface BindGroupDescriptor extends ResourceDescriptor {
  type: ResourceType.BIND_GROUP;
  creationParams: {
    layout: string; // Layout ID
    bindings: any[];
  };
}

export interface SamplerDescriptor extends ResourceDescriptor {
  type: ResourceType.SAMPLER;
  creationParams: {
    minFilter?: string;
    magFilter?: string;
    addressModeU?: string;
    addressModeV?: string;
    addressModeW?: string;
  };
}

export class ResourceRegistry {
  private resources = new Map<string, ResourceDescriptor>();
  private resourcesByType = new Map<ResourceType, Set<string>>();

  /**
   * Register resource for recovery
   * @returns The resource ID
   */
  register(descriptor: ResourceDescriptor): string {
    this.resources.set(descriptor.id, descriptor);

    // Add to type index
    if (!this.resourcesByType.has(descriptor.type)) {
      this.resourcesByType.set(descriptor.type, new Set());
    }
    this.resourcesByType.get(descriptor.type)!.add(descriptor.id);

    return descriptor.id;
  }

  /**
   * Unregister resource (when explicitly destroyed)
   */
  unregister(id: string): void {
    const descriptor = this.resources.get(id);
    if (descriptor) {
      this.resources.delete(id);
      this.resourcesByType.get(descriptor.type)?.delete(id);
    }
  }

  /**
   * Get resource descriptor by ID
   */
  get(id: string): ResourceDescriptor | undefined {
    return this.resources.get(id);
  }

  /**
   * Get all resources of a specific type
   */
  getByType(type: ResourceType): ResourceDescriptor[] {
    const ids = this.resourcesByType.get(type);
    if (!ids) return [];

    return Array.from(ids)
      .map(id => this.resources.get(id))
      .filter((d): d is ResourceDescriptor => d !== undefined);
  }

  /**
   * Get all resources (for full recreation)
   */
  getAll(): ResourceDescriptor[] {
    return Array.from(this.resources.values());
  }

  /**
   * Clear registry (after successful recovery)
   */
  clear(): void {
    this.resources.clear();
    this.resourcesByType.clear();
  }

  /**
   * Get statistics
   */
  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};

    for (const [type, ids] of this.resourcesByType) {
      byType[type] = ids.size;
    }

    return {
      total: this.resources.size,
      byType
    };
  }

  /**
   * Check if a resource is registered
   */
  has(id: string): boolean {
    return this.resources.has(id);
  }

  /**
   * Get count of resources by type
   */
  getTypeCount(type: ResourceType): number {
    return this.resourcesByType.get(type)?.size || 0;
  }
}
