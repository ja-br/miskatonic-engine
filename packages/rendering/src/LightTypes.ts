/**
 * Light Component Type Interfaces - Epic 3.15
 *
 * Type-safe interfaces for Light and Transform component data.
 * These interfaces define the exact shape of data coming from ECS storage.
 */

/**
 * Light component data interface
 *
 * Matches the structure of the Light component in ECS storage.
 * All fields are present regardless of light type (union storage).
 */
export interface LightComponentData {
  /** Light type: 0=directional, 1=point, 2=spot, 3=ambient */
  type: number;

  /** Enabled flag: 0=disabled, 1=enabled */
  enabled: number;

  /** Color red component (0-1 range) */
  colorR: number;

  /** Color green component (0-1 range) */
  colorG: number;

  /** Color blue component (0-1 range) */
  colorB: number;

  /** Intensity multiplier */
  intensity: number;

  /** Direction X component (for directional/spot lights) */
  directionX: number;

  /** Direction Y component (for directional/spot lights) */
  directionY: number;

  /** Direction Z component (for directional/spot lights) */
  directionZ: number;

  /** Position X component (for point/spot lights without Transform) */
  positionX: number;

  /** Position Y component (for point/spot lights without Transform) */
  positionY: number;

  /** Position Z component (for point/spot lights without Transform) */
  positionZ: number;

  /** Radius for point/spot lights */
  radius: number;

  /** Spot angle in radians (full cone angle) */
  spotAngle: number;

  /** Spot penumbra softness (0-1) */
  spotPenumbra: number;

  /** Casts shadows flag: 0=no shadows, 1=cast shadows */
  castsShadows: number;

  /** Shadow bias to prevent shadow acne */
  shadowBias: number;
}

/**
 * Transform component data interface
 *
 * Minimal interface for transform position data.
 */
export interface TransformComponentData {
  /** Position X */
  x: number;

  /** Position Y */
  y: number;

  /** Position Z */
  z: number;
}
