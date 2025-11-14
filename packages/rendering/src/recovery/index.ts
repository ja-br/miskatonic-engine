/**
 * Device Recovery System - Epic RENDERING-04
 *
 * Automatic GPU device loss recovery with resource recreation.
 */

export { DeviceLossDetector } from './DeviceLossDetector';
export type { DeviceLossInfo, DeviceLossCallback } from './DeviceLossDetector';

export { ResourceRegistry, ResourceType } from './ResourceRegistry';
export type {
  ResourceDescriptor,
  BufferDescriptor,
  TextureDescriptor,
  ShaderDescriptor,
  PipelineDescriptor,
  BindGroupLayoutDescriptor,
  BindGroupDescriptor,
  SamplerDescriptor
} from './ResourceRegistry';

export { DeviceRecoverySystem } from './DeviceRecoverySystem';
export type {
  RecoveryOptions,
  RecoveryProgress,
  RecoveryCallback
} from './DeviceRecoverySystem';
