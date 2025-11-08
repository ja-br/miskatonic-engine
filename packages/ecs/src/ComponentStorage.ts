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
 * @template T - Component type
 */
export class ComponentStorage<T> {
  private fields: Map<string, TypedArray> = new Map();
  private fieldDescriptors: FieldDescriptor[];
  private capacity: number;
  private count: number = 0;

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
   */
  get(index: number, fieldName: string): number {
    const array = this.fields.get(fieldName);
    if (!array) {
      throw new Error(`Field ${fieldName} not found in component storage`);
    }
    if (index < 0 || index >= this.count) {
      throw new Error(`Index ${index} out of bounds (count: ${this.count})`);
    }
    return array[index];
  }

  /**
   * Set component field value at index
   */
  set(index: number, fieldName: string, value: number): void {
    const array = this.fields.get(fieldName);
    if (!array) {
      throw new Error(`Field ${fieldName} not found in component storage`);
    }
    if (index < 0 || index >= this.count) {
      throw new Error(`Index ${index} out of bounds (count: ${this.count})`);
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
   * Add a component to storage
   *
   * @param component - Component data as object
   * @returns Index where component was added
   */
  add(component: Partial<T>): number {
    // Grow if needed
    if (this.count >= this.capacity) {
      this.grow();
    }

    const index = this.count++;

    // Set field values from component
    for (const descriptor of this.fieldDescriptors) {
      const value = (component as any)[descriptor.name] ?? descriptor.defaultValue ?? 0;
      this.set(index, descriptor.name, value);
    }

    return index;
  }

  /**
   * Remove component at index using swap-and-pop
   *
   * @param index - Index to remove
   * @returns True if an element was swapped
   */
  remove(index: number): boolean {
    if (index < 0 || index >= this.count) {
      throw new Error(`Index ${index} out of bounds (count: ${this.count})`);
    }

    const lastIndex = this.count - 1;

    // Swap with last element if not already last
    if (index !== lastIndex) {
      for (const [fieldName, array] of this.fields) {
        array[index] = array[lastIndex];
      }
    }

    this.count--;
    return index !== lastIndex;
  }

  /**
   * Get component as object at index
   */
  getComponent(index: number): Partial<T> {
    if (index < 0 || index >= this.count) {
      throw new Error(`Index ${index} out of bounds (count: ${this.count})`);
    }

    const component: any = {};
    for (const descriptor of this.fieldDescriptors) {
      component[descriptor.name] = this.get(index, descriptor.name);
    }
    return component as Partial<T>;
  }

  /**
   * Set component from object at index
   */
  setComponent(index: number, component: Partial<T>): void {
    if (index < 0 || index >= this.count) {
      throw new Error(`Index ${index} out of bounds (count: ${this.count})`);
    }

    for (const descriptor of this.fieldDescriptors) {
      const value = (component as any)[descriptor.name];
      if (value !== undefined) {
        this.set(index, descriptor.name, value);
      }
    }
  }

  /**
   * Get current count of components
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Get current capacity
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Clear all components
   */
  clear(): void {
    this.count = 0;
  }

  /**
   * Grow storage capacity (doubles current capacity)
   */
  private grow(): void {
    const newCapacity = this.capacity * 2;

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
   */
  getMemoryStats(): {
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
      count: this.count,
      utilizationPercent: (this.count / this.capacity) * 100,
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
export function inferArrayType(value: any): TypedArrayConstructor {
  if (Number.isInteger(value)) {
    // Use Int32Array for integers
    return Int32Array;
  } else {
    // Use Float32Array for floating point
    return Float32Array;
  }
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
