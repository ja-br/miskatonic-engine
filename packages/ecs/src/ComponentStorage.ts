import type { ComponentType } from './types';

/**
 * Component Storage - manages typed array storage for component fields
 *
 * Implements Structure of Arrays (SoA) pattern for cache-efficient iteration.
 * Each component field is stored in a separate typed array for spatial locality.
 *
 * Performance characteristics (from Epic 2.10 benchmarks):
 * - 4.16x faster iteration than object arrays on Apple Silicon
 * - Expected 5-10x faster on x86 platforms (smaller L1 cache)
 * - Zero GC pressure (no object allocations per frame)
 * - ~12 bytes per component (vs 48 bytes for objects)
 */

/**
 * Field descriptor for component properties
 */
export interface FieldDescriptor {
  /** Field name */
  name: string;

  /** TypedArray constructor (Float32Array, Int32Array, etc.) */
  arrayType: TypedArrayConstructor;

  /** Default value for initialization */
  defaultValue?: number;
}

/**
 * TypedArray constructor type
 */
export type TypedArrayConstructor =
  | Float32ArrayConstructor
  | Float64ArrayConstructor
  | Int8ArrayConstructor
  | Int16ArrayConstructor
  | Int32ArrayConstructor
  | Uint8ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor;

/**
 * TypedArray instance types
 */
export type TypedArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array;

/**
 * Component storage using Structure of Arrays (SoA) pattern
 *
 * This is a stateless data container. The Archetype manages indices and count.
 *
 * @template T - Component type
 */
export class ComponentStorage<T> {
  private fields: Map<string, TypedArray> = new Map();
  private fieldDescriptors: FieldDescriptor[];
  private capacity: number;

  /**
   * Create component storage
   *
   * @param fieldDescriptors - Field definitions for component properties
   * @param initialCapacity - Initial array capacity (will grow as needed)
   */
  constructor(fieldDescriptors: FieldDescriptor[], initialCapacity: number = 256) {
    this.fieldDescriptors = fieldDescriptors;
    this.capacity = initialCapacity;

    // Initialize typed arrays for each field
    for (const descriptor of fieldDescriptors) {
      this.fields.set(descriptor.name, new descriptor.arrayType(initialCapacity));
    }
  }

  /**
   * Get component field value at index
   * Note: No bounds checking - caller (Archetype) is responsible for valid indices
   */
  get(index: number, fieldName: string): number {
    const array = this.fields.get(fieldName);
    if (!array) {
      throw new Error(`Field ${fieldName} not found in component storage`);
    }
    if (index < 0 || index >= this.capacity) {
      throw new Error(`Index ${index} out of bounds (capacity: ${this.capacity})`);
    }
    return array[index];
  }

  /**
   * Set component field value at index
   * Note: No bounds checking against count - caller manages valid range
   */
  set(index: number, fieldName: string, value: number): void {
    const array = this.fields.get(fieldName);
    if (!array) {
      throw new Error(`Field ${fieldName} not found in component storage`);
    }
    if (index < 0 || index >= this.capacity) {
      throw new Error(`Index ${index} out of bounds (capacity: ${this.capacity})`);
    }
    // Type validation
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`Expected finite number, got ${typeof value}: ${value}`);
    }
    array[index] = value;
  }

  /**
   * Get direct access to typed array for a field (for high-performance iteration)
   */
  getArray(fieldName: string): TypedArray | undefined {
    return this.fields.get(fieldName);
  }

  /**
   * Set component data at a specific index
   * Caller (Archetype) is responsible for ensuring index is valid and < count
   *
   * @param index - Index to write to
   * @param component - Component data as object
   */
  setComponentData(index: number, component: Partial<T>): void {
    if (index < 0 || index >= this.capacity) {
      throw new Error(`Index ${index} out of bounds (capacity: ${this.capacity})`);
    }

    // Set field values from component
    for (const descriptor of this.fieldDescriptors) {
      const value = (component as any)[descriptor.name] ?? descriptor.defaultValue ?? 0;
      this.set(index, descriptor.name, value);
    }
  }

  /**
   * Swap component data from lastIndex to targetIndex (for swap-and-pop removal)
   * Caller is responsible for managing count
   *
   * @param targetIndex - Index to write to
   * @param sourceIndex - Index to copy from
   */
  swap(targetIndex: number, sourceIndex: number): void {
    if (targetIndex < 0 || targetIndex >= this.capacity) {
      throw new Error(`Target index ${targetIndex} out of bounds (capacity: ${this.capacity})`);
    }
    if (sourceIndex < 0 || sourceIndex >= this.capacity) {
      throw new Error(`Source index ${sourceIndex} out of bounds (capacity: ${this.capacity})`);
    }

    // Swap all field values
    for (const [fieldName, array] of this.fields) {
      array[targetIndex] = array[sourceIndex];
    }
  }

  /**
   * Get component as object at index
   *
   * NOTE: Returns a plain object, NOT an instance of the component class.
   * This is intentional for the SoA pattern - typed arrays store primitives only.
   *
   * @param index - Index to read from (caller must ensure < archetype.count)
   * @returns Plain object with component data
   */
  getComponent(index: number): Partial<T> {
    if (index < 0 || index >= this.capacity) {
      throw new Error(`Index ${index} out of bounds (capacity: ${this.capacity})`);
    }

    const component: any = {};
    for (const descriptor of this.fieldDescriptors) {
      component[descriptor.name] = this.get(index, descriptor.name);
    }
    return component as Partial<T>;
  }

  /**
   * Set component from object at index
   * Equivalent to setComponentData but keeps existing method name for compatibility
   *
   * @param index - Index to write to
   * @param component - Component data to write
   */
  setComponent(index: number, component: Partial<T>): void {
    if (index < 0 || index >= this.capacity) {
      throw new Error(`Index ${index} out of bounds (capacity: ${this.capacity})`);
    }

    for (const descriptor of this.fieldDescriptors) {
      const value = (component as any)[descriptor.name];
      if (value !== undefined) {
        this.set(index, descriptor.name, value);
      }
    }
  }

  /**
   * Get current capacity
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Grow storage capacity to specified size
   * Called by Archetype when it needs to grow
   *
   * @param newCapacity - New capacity (must be > current capacity)
   */
  growTo(newCapacity: number): void {
    if (newCapacity <= this.capacity) {
      throw new Error(`New capacity ${newCapacity} must be > current capacity ${this.capacity}`);
    }

    // Integer overflow protection
    if (newCapacity > 1073741824) {
      throw new Error(
        `Capacity overflow: requested ${newCapacity}, max allowed is 1073741824 (2^30)`
      );
    }

    for (const [fieldName, oldArray] of this.fields) {
      const descriptor = this.fieldDescriptors.find((d) => d.name === fieldName);
      if (!descriptor) continue;

      // Create new larger array
      const newArray = new descriptor.arrayType(newCapacity);

      // Copy old data
      newArray.set(oldArray);

      // Replace old array
      this.fields.set(fieldName, newArray);
    }

    this.capacity = newCapacity;
  }

  /**
   * Get memory usage statistics
   *
   * @param count - Current entity count (provided by caller/Archetype)
   */
  getMemoryStats(count: number): {
    capacity: number;
    count: number;
    utilizationPercent: number;
    bytesPerComponent: number;
    totalBytes: number;
  } {
    let bytesPerComponent = 0;
    for (const array of this.fields.values()) {
      bytesPerComponent += array.BYTES_PER_ELEMENT;
    }

    return {
      capacity: this.capacity,
      count,
      utilizationPercent: (count / this.capacity) * 100,
      bytesPerComponent,
      totalBytes: bytesPerComponent * this.capacity,
    };
  }
}

/**
 * Component schema definition for registering component types
 */
export interface ComponentSchema<T> {
  /** Component type constructor */
  type: ComponentType<T>;

  /** Field descriptors */
  fields: FieldDescriptor[];
}

/**
 * Helper to infer field type from component property
 */
/**
 * Infer typed array type from default value
 *
 * IMPORTANT: Defaults to Float32Array for safety
 * Most game engine values are floats (positions, rotations, velocities)
 * Integer fields must explicitly specify Int32Array or Uint8Array
 *
 * @param value - Default value (used for type inference)
 * @returns Typed array constructor
 */
export function inferArrayType(value: any): TypedArrayConstructor {
  // Default to Float32Array for all numeric values
  // This is safer for game engines where most values are floats
  // Integer fields (IDs, indices, flags) should explicitly specify their array type
  return Float32Array;
}

/**
 * Helper to create field descriptor from sample component
 */
export function createFieldDescriptor(
  name: string,
  defaultValue: number = 0,
  arrayType?: TypedArrayConstructor
): FieldDescriptor {
  return {
    name,
    arrayType: arrayType || inferArrayType(defaultValue),
    defaultValue,
  };
}
