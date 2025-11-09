/**
 * MatrixStorage - Epic 3.11.5
 *
 * Contiguous typed array storage for transform matrices.
 * Eliminates allocations in hot paths by pre-allocating all matrices.
 *
 * Design:
 * - All local matrices in one contiguous Float32Array
 * - All world matrices in one contiguous Float32Array
 * - Each entity gets an index into these arrays
 * - Matrices accessed via subarray() for zero-copy views
 *
 * Performance:
 * - Zero allocations during updates
 * - Cache-friendly sequential access
 * - Grows capacity as needed (rare, only when entities added)
 *
 * Memory Layout:
 * localMatrices:  [entity0_mat4][entity1_mat4][entity2_mat4]...
 * worldMatrices:  [entity0_mat4][entity1_mat4][entity2_mat4]...
 *
 * Each mat4 = 16 × Float32 = 64 bytes
 * Total per entity: 128 bytes (local + world)
 */

export class MatrixStorage {
  private localMatrices: Float32Array;
  private worldMatrices: Float32Array;
  private capacity: number;
  private nextIndex: number = 0;
  private freeIndices: number[] = [];

  /**
   * Create matrix storage with initial capacity
   *
   * @param initialCapacity - Number of entities to pre-allocate for (default: 1024)
   */
  constructor(initialCapacity: number = 1024) {
    this.capacity = initialCapacity;
    // Pre-allocate: 16 floats per matrix × capacity
    this.localMatrices = new Float32Array(initialCapacity * 16);
    this.worldMatrices = new Float32Array(initialCapacity * 16);

    // Initialize all matrices to identity
    for (let i = 0; i < initialCapacity; i++) {
      this.setIdentity(i);
    }
  }

  /**
   * Allocate a matrix index for a new entity
   *
   * @returns Matrix index to use for this entity
   */
  allocate(): number {
    // Reuse free index if available
    if (this.freeIndices.length > 0) {
      return this.freeIndices.pop()!;
    }

    // Grow if needed
    if (this.nextIndex >= this.capacity) {
      console.warn(`MatrixStorage.grow() called: ${this.capacity} → ${this.capacity * 2} (nextIndex: ${this.nextIndex})`);
      this.grow();
    }

    return this.nextIndex++;
  }

  /**
   * Free a matrix index (entity destroyed)
   *
   * @param index - Matrix index to free
   */
  free(index: number): void {
    if (index >= 0 && index < this.capacity) {
      this.freeIndices.push(index);
      // Reset to identity for next use
      this.setIdentity(index);
    }
  }

  /**
   * Get local matrix for entity (zero-copy view)
   *
   * Returns a subarray view into the contiguous storage.
   * Modifications to this view directly update the storage.
   *
   * @param index - Matrix index
   * @returns Float32Array view (16 elements)
   * @throws Error if index is out of bounds
   */
  getLocalMatrix(index: number): Float32Array {
    if (index < 0 || index >= this.capacity) {
      throw new Error(`MatrixStorage: Invalid local matrix index ${index} (capacity: ${this.capacity})`);
    }

    const offset = index * 16;
    return this.localMatrices.subarray(offset, offset + 16);
  }

  /**
   * Get world matrix for entity (zero-copy view)
   *
   * Returns a subarray view into the contiguous storage.
   * Modifications to this view directly update the storage.
   *
   * @param index - Matrix index
   * @returns Float32Array view (16 elements)
   * @throws Error if index is out of bounds
   */
  getWorldMatrix(index: number): Float32Array {
    if (index < 0 || index >= this.capacity) {
      throw new Error(`MatrixStorage: Invalid world matrix index ${index} (capacity: ${this.capacity})`);
    }

    const offset = index * 16;
    return this.worldMatrices.subarray(offset, offset + 16);
  }

  /**
   * Set local matrix from source (copies data)
   *
   * @param index - Matrix index
   * @param source - Source matrix (16 floats)
   * @throws Error if index is out of bounds
   */
  setLocalMatrix(index: number, source: Float32Array): void {
    if (index < 0 || index >= this.capacity) {
      throw new Error(`MatrixStorage: Invalid local matrix index ${index} (capacity: ${this.capacity})`);
    }

    const offset = index * 16;
    this.localMatrices.set(source, offset);
  }

  /**
   * Set world matrix from source (copies data)
   *
   * @param index - Matrix index
   * @param source - Source matrix (16 floats)
   * @throws Error if index is out of bounds
   */
  setWorldMatrix(index: number, source: Float32Array): void {
    if (index < 0 || index >= this.capacity) {
      throw new Error(`MatrixStorage: Invalid world matrix index ${index} (capacity: ${this.capacity})`);
    }

    const offset = index * 16;
    this.worldMatrices.set(source, offset);
  }

  /**
   * Set matrix to identity
   *
   * @param index - Matrix index
   */
  private setIdentity(index: number): void {
    const localOffset = index * 16;
    const worldOffset = index * 16;

    // Identity matrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
    for (let i = 0; i < 16; i++) {
      this.localMatrices[localOffset + i] = i % 5 === 0 ? 1 : 0;
      this.worldMatrices[worldOffset + i] = i % 5 === 0 ? 1 : 0;
    }
  }

  /**
   * Grow storage capacity (doubles current size)
   *
   * This is expensive but rare (only when adding entities beyond capacity).
   * Pre-allocate enough capacity to avoid this in production.
   */
  private grow(): void {
    const MAX_CAPACITY = 65536; // Hard limit: 65K entities = ~8MB per array
    const newCapacity = Math.min(this.capacity * 2, MAX_CAPACITY);

    if (newCapacity === this.capacity) {
      throw new Error(`MatrixStorage: Cannot grow beyond ${MAX_CAPACITY} entities`);
    }

    // Allocate new larger arrays
    const newLocal = new Float32Array(newCapacity * 16);
    const newWorld = new Float32Array(newCapacity * 16);

    // Copy existing data
    newLocal.set(this.localMatrices);
    newWorld.set(this.worldMatrices);

    // Initialize new matrices to identity
    for (let i = this.capacity; i < newCapacity; i++) {
      const offset = i * 16;
      for (let j = 0; j < 16; j++) {
        newLocal[offset + j] = j % 5 === 0 ? 1 : 0;
        newWorld[offset + j] = j % 5 === 0 ? 1 : 0;
      }
    }

    // Replace old arrays
    this.localMatrices = newLocal;
    this.worldMatrices = newWorld;
    this.capacity = newCapacity;
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    capacity: number;
    used: number;
    free: number;
    memoryBytes: number;
    utilization: number;
  } {
    const used = this.nextIndex - this.freeIndices.length;
    const memoryBytes = this.capacity * 16 * 4 * 2; // 16 floats × 4 bytes × 2 arrays

    return {
      capacity: this.capacity,
      used,
      free: this.capacity - used,
      memoryBytes,
      utilization: (used / this.capacity) * 100,
    };
  }

  /**
   * Get current capacity
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Get number of allocated matrices
   */
  getUsedCount(): number {
    return this.nextIndex - this.freeIndices.length;
  }

  /**
   * Clear all matrices (reset to identity)
   */
  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.setIdentity(i);
    }
    this.nextIndex = 0;
    this.freeIndices = [];
  }
}
