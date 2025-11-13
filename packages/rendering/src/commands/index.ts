/**
 * Unified draw command system.
 * Consolidates legacy command types into a single, type-safe interface.
 */

export {
  DrawCommand,
  IndexedGeometry,
  NonIndexedGeometry,
  IndirectGeometry,
  ComputeGeometry,
  DrawDebugInfo,
  isIndexedGeometry,
  isNonIndexedGeometry,
  isIndirectGeometry,
  isComputeGeometry,
  getIndexBufferSize,
  validateWorkgroups
} from './DrawCommand';

export { DrawCommandBuilder } from './DrawCommandBuilder';
