/**
 * OrbitingLightSystem - Epic 3.18 Phase 3
 *
 * Updates Transform position for entities with OrbitingLight component,
 * moving lights in circular orbits. Optionally updates spot light direction.
 */

import type { World } from '@miskatonic/ecs';
import { Light, Transform, OrbitingLight } from '@miskatonic/ecs';
import type { LightComponentData, TransformComponentData } from '../LightTypes';

/**
 * OrbitingLightSystem
 *
 * Moves lights in circular orbits by updating Transform position.
 * Supports arbitrary orbit axes and optional direction tracking for spot lights.
 *
 * Requires entities to have Transform component.
 *
 * @example
 * ```typescript
 * const system = new OrbitingLightSystem(world);
 *
 * // Update every frame
 * function gameLoop(dt: number) {
 *   system.update(dt);
 * }
 * ```
 */
export class OrbitingLightSystem {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Calculate orthonormal basis vectors for orbit plane
   * Returns two perpendicular vectors in the plane perpendicular to the axis
   */
  private calculateOrbitBasis(axisX: number, axisY: number, axisZ: number): {
    px: number; py: number; pz: number;  // First basis vector
    qx: number; qy: number; qz: number;  // Second basis vector
  } {
    // Create perpendicular vectors to axis (forming orbit plane)
    // First perpendicular: cross product with arbitrary vector
    let px, py, pz;
    if (Math.abs(axisX) < 0.9) {
      // axis is not close to X-axis, use X as reference
      px = 0;
      py = axisZ;
      pz = -axisY;
    } else {
      // axis is close to X-axis, use Y as reference
      px = -axisZ;
      py = 0;
      pz = axisX;
    }

    // Normalize first perpendicular
    const pLen = Math.sqrt(px * px + py * py + pz * pz);
    px /= pLen;
    py /= pLen;
    pz /= pLen;

    // Second perpendicular: cross product of axis and first perpendicular
    const qx = axisY * pz - axisZ * py;
    const qy = axisZ * px - axisX * pz;
    const qz = axisX * py - axisY * px;

    return { px, py, pz, qx, qy, qz };
  }

  /**
   * Update all orbiting lights
   *
   * @param dt - Delta time in seconds
   */
  update(dt: number): void {
    // Query entities with Light, Transform, and OrbitingLight components
    const query = this.world.query().with(Light as any).with(Transform as any).with(OrbitingLight as any).build();
    const results = this.world.executeQuery(query);

    for (const result of results) {
      const light = this.world.getComponent(result.entity, Light as any) as LightComponentData | undefined;
      const transform = this.world.getComponent(result.entity, Transform as any) as TransformComponentData | undefined;
      const orbit = this.world.getComponent(result.entity, OrbitingLight as any) as any;

      if (!light || !transform || !orbit) continue;

      // Update angle - let it accumulate naturally (cos/sin are periodic)
      orbit.currentAngle += orbit.speed * dt;

      // Calculate orthonormal basis vectors for the orbit plane
      const { px, py, pz, qx, qy, qz } = this.calculateOrbitBasis(orbit.axisX, orbit.axisY, orbit.axisZ);

      // Calculate position using rotation matrix
      const cosAngle = Math.cos(orbit.currentAngle);
      const sinAngle = Math.sin(orbit.currentAngle);

      transform.x =
        orbit.centerX + orbit.radius * (cosAngle * px + sinAngle * qx);
      transform.y =
        orbit.centerY + orbit.radius * (cosAngle * py + sinAngle * qy);
      transform.z =
        orbit.centerZ + orbit.radius * (cosAngle * pz + sinAngle * qz);

      // Update spot light direction to face center (if requested)
      if (orbit.faceCenter === 1 && light.type === 2) {
        // Spot light type
        const dx = orbit.centerX - transform.x;
        const dy = orbit.centerY - transform.y;
        const dz = orbit.centerZ - transform.z;

        // Normalize direction
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len > 1e-6) {
          light.directionX = dx / len;
          light.directionY = dy / len;
          light.directionZ = dz / len;
        }
      }

      // Write back modified components
      this.world.setComponent(result.entity, OrbitingLight as any, orbit as any);
      this.world.setComponent(result.entity, Transform as any, transform as any);
      this.world.setComponent(result.entity, Light as any, light as any);
    }
  }

  /**
   * Reset all orbiting lights to start angle
   */
  reset(): void {
    const query = this.world.query().with(Light as any).with(Transform as any).with(OrbitingLight as any).build();
    const results = this.world.executeQuery(query);

    for (const result of results) {
      const light = this.world.getComponent(result.entity, Light as any) as LightComponentData | undefined;
      const transform = this.world.getComponent(result.entity, Transform as any) as TransformComponentData | undefined;
      const orbit = this.world.getComponent(result.entity, OrbitingLight as any) as any;

      if (!light || !transform || !orbit) continue;
      orbit.currentAngle = 0;

      // Calculate orthonormal basis vectors for the orbit plane
      const { px, py, pz } = this.calculateOrbitBasis(orbit.axisX, orbit.axisY, orbit.axisZ);

      // angle = 0, so sin(0) = 0, cos(0) = 1
      // Only need first perpendicular vector (px, py, pz)
      transform.x = orbit.centerX + orbit.radius * px;
      transform.y = orbit.centerY + orbit.radius * py;
      transform.z = orbit.centerZ + orbit.radius * pz;

      if (orbit.faceCenter === 1 && light.type === 2) {
        const dx = orbit.centerX - transform.x;
        const dy = orbit.centerY - transform.y;
        const dz = orbit.centerZ - transform.z;

        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len > 1e-6) {
          light.directionX = dx / len;
          light.directionY = dy / len;
          light.directionZ = dz / len;
        }
      }

      // Write back modified components
      this.world.setComponent(result.entity, OrbitingLight as any, orbit as any);
      this.world.setComponent(result.entity, Transform as any, transform as any);
      this.world.setComponent(result.entity, Light as any, light as any);
    }
  }
}
