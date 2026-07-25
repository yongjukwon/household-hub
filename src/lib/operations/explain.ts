import type { OperationType } from '@household-hub/domain'

import type { DiscardedOperation } from './types'

const entityNouns: Record<string, string> = {
  calendar_event: 'calendar event',
  grocery_list: 'grocery list',
  grocery_item: 'grocery item',
  ledger_asset: 'asset',
  ledger_year: 'statement year',
  ledger_category: 'category',
  ledger_limit: 'limit',
  ledger_transaction: 'transaction',
  ledger_transfer: 'transfer',
  ledger_transfer_schedule: 'recurring transfer',
  household_note: 'note',
  household_trip: 'trip',
  trip_expense: 'trip expense',
  notification: 'notification',
  household_user_settings: 'settings',
}

function noun(entityType: string): string {
  return entityNouns[entityType] ?? entityType.replace(/_/g, ' ')
}

function verb(type: OperationType): string {
  if (type.endsWith('.delete')) return 'Deleting'
  if (type.endsWith('.clear')) return 'Clearing'
  return 'Saving'
}

export interface DiscardExplanation {
  /** One line naming what the user did that did not stick. */
  failedAction: string
  /** One line naming what happened instead, when the server said. */
  winningAction: string | null
  /** The server's own wording. */
  reason: string
  /** Stable code for a rejection; null for a conflict. */
  code: string | null
}

/**
 * Turns a discard record into the explanation the design requires: what failed,
 * what won, and why. The losing command is never retried or edited, so this
 * text is the only account the user gets — it names the action rather than
 * showing an error code alone.
 */
export function explainDiscard(record: DiscardedOperation): DiscardExplanation {
  const { command } = record
  const failedAction = `${verb(command.type)} your ${noun(command.entityType)} did not go through.`

  if (record.reason === 'conflict') {
    const winner = record.winner
    const winningAction = winner
      ? `${winner.entityId === command.entityId ? 'The same' : 'Another'} ${noun(winner.entityType)} was already ${winner.type.endsWith('.delete') ? 'deleted' : 'changed'} on another device.`
      : 'It had already been changed elsewhere.'

    return {
      failedAction,
      winningAction,
      reason: record.explanation,
      code: null,
    }
  }

  return {
    failedAction,
    winningAction: null,
    reason: record.explanation,
    code: record.code,
  }
}
