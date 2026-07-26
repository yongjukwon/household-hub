export { explainDiscard, type DiscardExplanation } from './explain'
export { operationOutcomeError } from './outcome'
export { useHouseholdRealtime } from './realtime'
export {
  getDeviceId,
  nextLocalSequence,
  resetDeviceIdentity,
} from './device'
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
export {
  getOperationStore,
  setOperationStore,
  InMemoryOperationStore,
  type OperationStore,
} from './store'
export type { DiscardedOperation, QueuedOperation } from './types'
