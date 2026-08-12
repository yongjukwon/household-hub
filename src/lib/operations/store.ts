import type { OperationStore } from '@household-hub/application/operations'

import { db } from '@/lib/db'

/** Web adapter for the shared operation-replay seam. */
export const webOperationStore: OperationStore = {
  addOperation: async (operation) => {
    await db.operations.add(operation)
  },
  listOperations: () => db.operations.orderBy('localSequence').toArray(),
  countOperations: () => db.operations.count(),
  updateOperationAttempt: (operationId, attempts, lastError) =>
    db.operations.update(operationId, { attempts, lastError }).then(() => undefined),
  deleteOperation: (operationId) => db.operations.delete(operationId),
  discardOperation: (record, operationId) =>
    db.transaction(
      'rw',
      db.operations,
      db.discardedOperations,
      async () => {
        await db.discardedOperations.put(record)
        await db.operations.delete(operationId)
      },
    ),
}
