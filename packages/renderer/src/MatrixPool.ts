/**
 * Object pool for Float32Array matrices
 * Eliminates GC pressure from matrix allocations in render loop
 */
export class MatrixPool {
  private pool: Float32Array[] = [];
  private inUse = new Set<Float32Array>();
  private readonly matrixSize: number;

  constructor(matrixSize: number = 16, initialSize: number = 100) {
    this.matrixSize = matrixSize;

    // Pre-allocate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(new Float32Array(matrixSize));
    }
  }

  /**
   * Get a matrix from the pool
   */
  acquire(): Float32Array {
    let matrix = this.pool.pop();

    if (!matrix) {
      // Pool exhausted, allocate new matrix
      matrix = new Float32Array(this.matrixSize);
    }

    this.inUse.add(matrix);
    return matrix;
  }

  /**
   * Return a matrix to the pool
   */
  release(matrix: Float32Array): void {
    if (!this.inUse.has(matrix)) {
      console.warn('Attempting to release matrix not acquired from pool');
      return;
    }

    this.inUse.delete(matrix);
    this.pool.push(matrix);
  }

  /**
   * Release all matrices back to pool (called at end of frame)
   */
  releaseAll(): void {
    for (const matrix of this.inUse) {
      this.pool.push(matrix);
    }
    this.inUse.clear();
  }

  /**
   * Get pool statistics
   */
  getStats(): { available: number; inUse: number; total: number } {
    return {
      available: this.pool.length,
      inUse: this.inUse.size,
      total: this.pool.length + this.inUse.size
    };
  }
}
