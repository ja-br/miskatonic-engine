/**
 * Unified draw command system.
 * Consolidates legacy command types into a single, type-safe interface.
 */

export {
  type DrawCommand,
  type IndexedGeometry,
  type NonIndexedGeometry,
  type IndirectGeometry,
  type ComputeGeometry,
  type DrawDebugInfo,
  isIndexedGeometry,
  isNonIndexedGeometry,
  isIndirectGeometry,
  isComputeGeometry,
  getIndexBufferSize,
  validateWorkgroups
} from './DrawCommand';

export { DrawCommandBuilder } from './DrawCommandBuilder';
