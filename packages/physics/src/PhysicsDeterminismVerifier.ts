/**
 * Physics Determinism Verifier
 *
 * Tools for verifying deterministic physics simulation
 */

import type { SerializedPhysicsState, Vector3, Quaternion } from './types';

/**
 * Determinism verification result
 */
export interface DeterminismVerificationResult {
  /** Whether the states are deterministic (identical) */
  isDeterministic: boolean;
  /** Total number of bodies compared */
  totalBodies: number;
  /** Number of bodies with mismatches */
  mismatchedBodies: number;
  /** Total number of joints compared */
  totalJoints: number;
  /** Number of joints with mismatches */
  mismatchedJoints: number;
  /** Detailed mismatch information */
  mismatches: DeterminismMismatch[];
  /** Maximum position difference found (meters) */
  maxPositionError: number;
  /** Maximum rotation difference found (radians) */
  maxRotationError: number;
  /** Maximum velocity difference found (m/s) */
  maxVelocityError: number;
}

/**
 * Individual mismatch in determinism verification
 */
export interface DeterminismMismatch {
  /** Type of entity that mismatched */
  type: 'body' | 'joint' | 'gravity' | 'time';
  /** Handle or identifier */
  handle?: number;
  /** Field that mismatched */
  field: string;
  /** Expected value */
  expected: unknown;
  /** Actual value */
  actual: unknown;
  /** Difference magnitude (if applicable) */
  difference?: number;
}

/**
 * Configuration for determinism verification
 */
export interface DeterminismVerifierConfig {
  /** Tolerance for floating point comparisons (meters/radians/m/s) */
  tolerance?: number;
  /** Whether to check time and step count */
  checkTime?: boolean;
  /** Whether to check gravity */
  checkGravity?: boolean;
  /** Whether to check body sleeping state */
  checkSleeping?: boolean;
}

const DEFAULT_CONFIG: Required<DeterminismVerifierConfig> = {
  tolerance: 1e-6, // 1 micrometer / microrad / micrometer per second
  checkTime: true,
  checkGravity: true,
  checkSleeping: true
};

/**
 * Verifies determinism of physics simulations
 *
 * Compare two physics states to ensure they are identical within tolerance.
 * Useful for:
 * - Testing determinism across different runs
 * - Verifying network synchronization
 * - Debugging non-deterministic behavior
 * - Cross-platform consistency checks
 *
 * @example
 * ```typescript
 * const verifier = new PhysicsDeterminismVerifier();
 *
 * // Run simulation twice with same initial conditions
 * const state1 = runSimulation(initialState, 60); // 60 frames
 * const state2 = runSimulation(initialState, 60); // Same 60 frames
 *
 * // Verify they are identical
 * const result = verifier.verify(state1, state2);
 * if (result.isDeterministic) {
 *   console.log('✅ Physics is deterministic!');
 * } else {
 *   console.error('❌ Physics is NOT deterministic!');
 *   console.error(`Found ${result.mismatchedBodies} body mismatches`);
 *   console.error(`Max position error: ${result.maxPositionError}m`);
 * }
 * ```
 */
export class PhysicsDeterminismVerifier {
  private config: Required<DeterminismVerifierConfig>;

  constructor(config: DeterminismVerifierConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Verify that two physics states are deterministic (identical within tolerance)
   * @param expected Expected state
   * @param actual Actual state
   * @returns Verification result with detailed mismatch information
   */
  verify(expected: SerializedPhysicsState, actual: SerializedPhysicsState): DeterminismVerificationResult {
    const mismatches: DeterminismMismatch[] = [];
    let maxPositionError = 0;
    let maxRotationError = 0;
    let maxVelocityError = 0;

    // Check version
    if (expected.version !== actual.version) {
      mismatches.push({
        type: 'time',
        field: 'version',
        expected: expected.version,
        actual: actual.version,
        difference: Math.abs(expected.version - actual.version)
      });
    }

    // Check time
    if (this.config.checkTime) {
      const timeDiff = Math.abs(expected.time - actual.time);
      if (timeDiff > this.config.tolerance) {
        mismatches.push({
          type: 'time',
          field: 'time',
          expected: expected.time,
          actual: actual.time,
          difference: timeDiff
        });
      }

      if (expected.step !== actual.step) {
        mismatches.push({
          type: 'time',
          field: 'step',
          expected: expected.step,
          actual: actual.step,
          difference: Math.abs(expected.step - actual.step)
        });
      }
    }

    // Check gravity
    if (this.config.checkGravity) {
      const gravityDiff = this.vectorDistance(expected.gravity, actual.gravity);
      if (gravityDiff > this.config.tolerance) {
        mismatches.push({
          type: 'gravity',
          field: 'gravity',
          expected: expected.gravity,
          actual: actual.gravity,
          difference: gravityDiff
        });
      }
    }

    // Check bodies
    const expectedBodies = new Map(expected.bodies.map(b => [b.handle, b]));
    const actualBodies = new Map(actual.bodies.map(b => [b.handle, b]));

    let mismatchedBodies = 0;

    // Check all expected bodies exist in actual
    for (const [handle, expectedBody] of expectedBodies.entries()) {
      const actualBody = actualBodies.get(handle);
      if (!actualBody) {
        mismatches.push({
          type: 'body',
          handle,
          field: 'existence',
          expected: 'exists',
          actual: 'missing'
        });
        mismatchedBodies++;
        continue;
      }

      // Check body type
      if (expectedBody.type !== actualBody.type) {
        mismatches.push({
          type: 'body',
          handle,
          field: 'type',
          expected: expectedBody.type,
          actual: actualBody.type
        });
        mismatchedBodies++;
      }

      // Check position
      const posDiff = this.vectorDistance(expectedBody.position, actualBody.position);
      if (posDiff > this.config.tolerance) {
        mismatches.push({
          type: 'body',
          handle,
          field: 'position',
          expected: expectedBody.position,
          actual: actualBody.position,
          difference: posDiff
        });
        maxPositionError = Math.max(maxPositionError, posDiff);
        mismatchedBodies++;
      }

      // Check rotation
      const rotDiff = this.quaternionDistance(expectedBody.rotation, actualBody.rotation);
      if (rotDiff > this.config.tolerance) {
        mismatches.push({
          type: 'body',
          handle,
          field: 'rotation',
          expected: expectedBody.rotation,
          actual: actualBody.rotation,
          difference: rotDiff
        });
        maxRotationError = Math.max(maxRotationError, rotDiff);
        mismatchedBodies++;
      }

      // Check linear velocity
      const linVelDiff = this.vectorDistance(expectedBody.linearVelocity, actualBody.linearVelocity);
      if (linVelDiff > this.config.tolerance) {
        mismatches.push({
          type: 'body',
          handle,
          field: 'linearVelocity',
          expected: expectedBody.linearVelocity,
          actual: actualBody.linearVelocity,
          difference: linVelDiff
        });
        maxVelocityError = Math.max(maxVelocityError, linVelDiff);
        mismatchedBodies++;
      }

      // Check angular velocity
      const angVelDiff = this.vectorDistance(expectedBody.angularVelocity, actualBody.angularVelocity);
      if (angVelDiff > this.config.tolerance) {
        mismatches.push({
          type: 'body',
          handle,
          field: 'angularVelocity',
          expected: expectedBody.angularVelocity,
          actual: actualBody.angularVelocity,
          difference: angVelDiff
        });
        maxVelocityError = Math.max(maxVelocityError, angVelDiff);
        mismatchedBodies++;
      }

      // Check sleeping state
      if (this.config.checkSleeping && expectedBody.isSleeping !== actualBody.isSleeping) {
        mismatches.push({
          type: 'body',
          handle,
          field: 'isSleeping',
          expected: expectedBody.isSleeping,
          actual: actualBody.isSleeping
        });
        mismatchedBodies++;
      }

      // Check enabled state
      if (expectedBody.isEnabled !== actualBody.isEnabled) {
        mismatches.push({
          type: 'body',
          handle,
          field: 'isEnabled',
          expected: expectedBody.isEnabled,
          actual: actualBody.isEnabled
        });
        mismatchedBodies++;
      }
    }

    // Check for extra bodies in actual
    for (const handle of actualBodies.keys()) {
      if (!expectedBodies.has(handle)) {
        mismatches.push({
          type: 'body',
          handle,
          field: 'existence',
          expected: 'missing',
          actual: 'exists'
        });
        mismatchedBodies++;
      }
    }

    // Check joints
    const expectedJoints = new Map(expected.joints.map(j => [j.handle, j]));
    const actualJoints = new Map(actual.joints.map(j => [j.handle, j]));

    let mismatchedJoints = 0;

    for (const [handle, expectedJoint] of expectedJoints.entries()) {
      const actualJoint = actualJoints.get(handle);
      if (!actualJoint) {
        mismatches.push({
          type: 'joint',
          handle,
          field: 'existence',
          expected: 'exists',
          actual: 'missing'
        });
        mismatchedJoints++;
        continue;
      }

      // Check joint type
      if (expectedJoint.type !== actualJoint.type) {
        mismatches.push({
          type: 'joint',
          handle,
          field: 'type',
          expected: expectedJoint.type,
          actual: actualJoint.type
        });
        mismatchedJoints++;
      }

      // Check connected bodies
      if (expectedJoint.bodyA !== actualJoint.bodyA) {
        mismatches.push({
          type: 'joint',
          handle,
          field: 'bodyA',
          expected: expectedJoint.bodyA,
          actual: actualJoint.bodyA
        });
        mismatchedJoints++;
      }

      if (expectedJoint.bodyB !== actualJoint.bodyB) {
        mismatches.push({
          type: 'joint',
          handle,
          field: 'bodyB',
          expected: expectedJoint.bodyB,
          actual: actualJoint.bodyB
        });
        mismatchedJoints++;
      }

      // Check joint value
      const valueDiff = Math.abs(expectedJoint.value - actualJoint.value);
      if (valueDiff > this.config.tolerance) {
        mismatches.push({
          type: 'joint',
          handle,
          field: 'value',
          expected: expectedJoint.value,
          actual: actualJoint.value,
          difference: valueDiff
        });
        mismatchedJoints++;
      }
    }

    // Check for extra joints in actual
    for (const handle of actualJoints.keys()) {
      if (!expectedJoints.has(handle)) {
        mismatches.push({
          type: 'joint',
          handle,
          field: 'existence',
          expected: 'missing',
          actual: 'exists'
        });
        mismatchedJoints++;
      }
    }

    return {
      isDeterministic: mismatches.length === 0,
      totalBodies: Math.max(expected.bodies.length, actual.bodies.length),
      mismatchedBodies,
      totalJoints: Math.max(expected.joints.length, actual.joints.length),
      mismatchedJoints,
      mismatches,
      maxPositionError,
      maxRotationError,
      maxVelocityError
    };
  }

  /**
   * Compute hash of physics state for quick comparison
   * @param state Physics state to hash
   * @returns Hash string (not cryptographically secure, just for comparison)
   */
  hashState(state: SerializedPhysicsState): string {
    // Simple hash using JSON serialization
    // For production, consider using a proper hash function
    return JSON.stringify(state);
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<DeterminismVerifierConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<DeterminismVerifierConfig>> {
    return { ...this.config };
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  private vectorDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Calculate angular distance between two quaternions (in radians)
   * Uses the dot product to compute the angle between rotations
   */
  private quaternionDistance(a: Quaternion, b: Quaternion): number {
    // Normalize quaternions first
    const aMag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z + a.w * a.w);
    const bMag = Math.sqrt(b.x * b.x + b.y * b.y + b.z * b.z + b.w * b.w);

    const aNorm = {
      x: a.x / aMag,
      y: a.y / aMag,
      z: a.z / aMag,
      w: a.w / aMag
    };

    const bNorm = {
      x: b.x / bMag,
      y: b.y / bMag,
      z: b.z / bMag,
      w: b.w / bMag
    };

    // Dot product (handle quaternion double-cover: q and -q represent same rotation)
    let dot = aNorm.x * bNorm.x + aNorm.y * bNorm.y + aNorm.z * bNorm.z + aNorm.w * bNorm.w;
    dot = Math.abs(dot); // Take absolute value to handle double-cover
    dot = Math.min(1, Math.max(-1, dot)); // Clamp for numerical stability

    // Angle between quaternions
    return 2 * Math.acos(dot);
  }
}
