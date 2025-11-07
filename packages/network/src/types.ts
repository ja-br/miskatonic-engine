/**
 * Network State Synchronization Types
 *
 * Core type definitions for state replication, delta compression, and bandwidth optimization
 */

/**
 * Unique identifier for network entities
 */
export type NetworkId = number;

/**
 * Network timestamp in milliseconds
 */
export type NetworkTimestamp = number;

/**
 * Priority level for state updates (higher = more important)
 */
export type UpdatePriority = number;

/**
 * Serializable state value types
 */
export type StateValue =
  | null
  | boolean
  | number
  | string
  | StateValue[]
  | { [key: string]: StateValue };

/**
 * Complete state snapshot of a networked entity
 */
export interface EntityState {
  /** Unique entity identifier */
  id: NetworkId;
  /** Entity type/class name for deserialization */
  type: string;
  /** Entity state data */
  state: Record<string, StateValue>;
  /** Server timestamp when state was captured */
  timestamp: NetworkTimestamp;
  /** Optional priority for bandwidth management */
  priority?: UpdatePriority;
}

/**
 * Delta update containing only changed fields
 */
export interface DeltaUpdate {
  /** Entity identifier */
  id: NetworkId;
  /** Changed fields (path -> new value) */
  changes: Record<string, StateValue>;
  /** Server timestamp */
  timestamp: NetworkTimestamp;
  /** Base timestamp this delta is relative to */
  baseTimestamp: NetworkTimestamp;
}

/**
 * Batch of state updates sent over the network
 */
export interface StateBatch {
  /** Server tick number */
  tick: number;
  /** Server timestamp */
  timestamp: NetworkTimestamp;
  /** Full entity states (for new/important entities) */
  fullStates: EntityState[];
  /** Delta updates (for existing entities) */
  deltas: DeltaUpdate[];
  /** Entity IDs that were destroyed */
  destroyed: NetworkId[];
}

/**
 * Configuration for state replication
 */
export interface ReplicationConfig {
  /** Target updates per second */
  tickRate: number;
  /** Enable delta compression */
  useDeltaCompression: boolean;
  /** Maximum bytes per update batch */
  maxBatchSize: number;
  /** Number of previous states to keep for delta calculation */
  historySize: number;
  /** Enable interest management (only send relevant entities) */
  useInterestManagement: boolean;
  /** Distance threshold for interest (units) */
  interestRadius: number;
}

/**
 * Default replication configuration
 */
export const DEFAULT_REPLICATION_CONFIG: ReplicationConfig = {
  tickRate: 60,
  useDeltaCompression: true,
  maxBatchSize: 1200, // Safe for most MTUs (1500 MTU - IP/UDP/WebSocket overhead)
  historySize: 64,
  useInterestManagement: true,
  interestRadius: 100
};

/**
 * Statistics for monitoring network performance
 */
export interface NetworkStats {
  /** Total bytes sent */
  bytesSent: number;
  /** Total bytes received */
  bytesReceived: number;
  /** Average bytes per second (outbound) */
  outboundBPS: number;
  /** Average bytes per second (inbound) */
  inboundBPS: number;
  /** Number of state updates sent */
  updatesSent: number;
  /** Number of state updates received */
  updatesReceived: number;
  /** Average compression ratio (compressed / uncompressed) */
  compressionRatio: number;
  /** Round-trip time in ms */
  rtt: number;
  /** Packet loss percentage */
  packetLoss: number;
}

/**
 * Interest level for an entity relative to an observer
 */
export enum InterestLevel {
  /** Entity should not be replicated */
  NONE = 0,
  /** Low priority, update infrequently */
  LOW = 1,
  /** Normal priority */
  MEDIUM = 2,
  /** High priority, always update */
  HIGH = 3,
  /** Critical, update immediately */
  CRITICAL = 4
}

/**
 * Interest management policy
 */
export interface InterestPolicy {
  /** Calculate interest level for an entity */
  calculateInterest(observerId: NetworkId, entityId: NetworkId): InterestLevel;
  /** Get all entities of interest to an observer */
  getInterests(observerId: NetworkId): Set<NetworkId>;
}

/**
 * Reliability mode for message delivery
 */
export enum ReliabilityMode {
  /** Fire and forget, no guarantees */
  UNRELIABLE = 'unreliable',
  /** Guaranteed delivery, may arrive out of order */
  RELIABLE = 'reliable',
  /** Guaranteed delivery in order */
  RELIABLE_ORDERED = 'reliable_ordered'
}

/**
 * Network message envelope
 */
export interface NetworkMessage<T = unknown> {
  /** Message type identifier */
  type: string;
  /** Message payload */
  payload: T;
  /** Reliability mode */
  reliability: ReliabilityMode;
  /** Optional channel for ordering */
  channel?: number;
  /** Sender ID (server uses 0) */
  senderId?: NetworkId;
  /** Recipient ID (undefined = broadcast) */
  recipientId?: NetworkId;
}

/**
 * State interpolation configuration
 */
export interface InterpolationConfig {
  /** Interpolation buffer time in ms */
  bufferTime: number;
  /** Maximum extrapolation time in ms */
  maxExtrapolation: number;
  /** Enable smoothing for position updates */
  smoothPosition: boolean;
  /** Enable smoothing for rotation updates */
  smoothRotation: boolean;
}

/**
 * Default interpolation configuration
 */
export const DEFAULT_INTERPOLATION_CONFIG: InterpolationConfig = {
  bufferTime: 100,
  maxExtrapolation: 50,
  smoothPosition: true,
  smoothRotation: true
};
