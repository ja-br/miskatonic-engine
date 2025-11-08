import type { ComponentType, Component } from './types';
import type { FieldDescriptor } from './ComponentStorage';
import { createFieldDescriptor } from './ComponentStorage';

/**
 * Component Registry - manages component schemas and field descriptors
 *
 * Components must be registered with their field descriptors before use.
 * This enables the archetype system to create appropriate typed array storage.
 *
 * Example:
 * ```typescript
 * ComponentRegistry.register(Transform, [
 *   createFieldDescriptor('x', 0),
 *   createFieldDescriptor('y', 0),
 *   createFieldDescriptor('z', 0),
 * ]);
 * ```
 */
export class ComponentRegistry {
  private static schemas: Map<ComponentType, FieldDescriptor[]> = new Map();

  /**
   * Register a component type with field descriptors
   *
   * @param type - Component type constructor
   * @param fields - Field descriptors for component properties
   */
  static register<T extends Component>(type: ComponentType<T>, fields: FieldDescriptor[]): void {
    if (this.schemas.has(type)) {
      console.warn(`Component ${type.name} is already registered, overwriting`);
    }
    this.schemas.set(type, fields);
  }

  /**
   * Auto-register a component by creating an instance and inspecting fields
   *
   * @param type - Component type constructor
   * @param sampleInstance - Optional sample instance (uses default constructor if not provided)
   */
  static autoRegister<T extends Component>(type: ComponentType<T>, sampleInstance?: T): void {
    const instance = sampleInstance || new type();
    const fields: FieldDescriptor[] = [];

    // Extract numeric fields from instance
    for (const [key, value] of Object.entries(instance)) {
      // Skip __componentType and non-numeric fields
      if (key === '__componentType' || typeof value !== 'number') {
        continue;
      }

      fields.push(createFieldDescriptor(key, value));
    }

    if (fields.length === 0) {
      throw new Error(
        `Component ${type.name} has no numeric fields. ` +
          `Only numeric fields are supported with typed arrays. ` +
          `Use manual register() for complex components.`
      );
    }

    this.register(type, fields);
  }

  /**
   * Get field descriptors for a component type
   *
   * @param type - Component type constructor
   * @returns Field descriptors, or undefined if not registered
   */
  static getFields<T extends Component>(type: ComponentType<T>): FieldDescriptor[] | undefined {
    return this.schemas.get(type);
  }

  /**
   * Check if a component type is registered
   *
   * @param type - Component type constructor
   */
  static isRegistered<T extends Component>(type: ComponentType<T>): boolean {
    return this.schemas.has(type);
  }

  /**
   * Get all registered component types
   */
  static getAllTypes(): ComponentType[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Clear all registrations (for testing)
   */
  static clear(): void {
    this.schemas.clear();
  }

  /**
   * Get statistics about registered components
   */
  static getStats(): {
    totalComponents: number;
    components: Array<{ name: string; fieldCount: number; fields: string[] }>;
  } {
    const components: Array<{ name: string; fieldCount: number; fields: string[] }> = [];

    for (const [type, fields] of this.schemas) {
      components.push({
        name: type.name,
        fieldCount: fields.length,
        fields: fields.map((f) => f.name),
      });
    }

    return {
      totalComponents: this.schemas.size,
      components,
    };
  }
}

/**
 * Helper decorator for auto-registering components
 *
 * @example
 * ```typescript
 * @RegisterComponent
 * class Position {
 *   constructor(public x = 0, public y = 0, public z = 0) {}
 * }
 * ```
 */
export function RegisterComponent<T extends Component>(constructor: ComponentType<T>): ComponentType<T> {
  ComponentRegistry.autoRegister(constructor);
  return constructor;
}
