/**
 * @miskatonic/network
 *
 * Network state synchronization for Miskatonic Engine
 *
 * Features:
 * - Delta compression for bandwidth efficiency
 * - Interest management for scalability
 * - State interpolation for smooth visuals
 * - Bandwidth monitoring
 */

// Core types
export * from './types';

// Delta compression
export { DeltaCompression } from './DeltaCompression';

// State replication
export { StateReplicationManager, type IReplicable } from './StateReplicationManager';

// Interest management
export {
  SpatialInterestPolicy,
  AlwaysInterestedPolicy,
  GridInterestPolicy
} from './InterestManagement';
