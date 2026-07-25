export { getDeviceId, nextLocalSequence, resetDeviceIdentity } from './device'
export {
  applyOptimisticOverlay,
  hasPendingOperations,
  withOptimisticOverlay,
  type EntityRow,
} from './overlay'
export {
  acknowledgeDiscard,
  enqueueOperation,
  flushOperations,
  pendingOperations,
  setOperationQueryClient,
  startOperationSync,
  unacknowledgedDiscards,
  type EnqueueInput,
  type EnqueueOutcome,
  type FlushSummary,
} from './queue'
export type { DiscardedOperation, QueuedOperation } from './types'
