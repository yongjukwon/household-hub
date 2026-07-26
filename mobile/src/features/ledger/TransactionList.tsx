import { formatMoney } from '@household-hub/domain'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Card } from '@/components/Card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { operationOutcomeError } from '@/lib/operations'
import { useTheme } from '@/theme/tokens'
import { HOUSEHOLD_CURRENCY, type LedgerAsset } from './assets'
import type { LedgerTransaction, MonthCategory } from './statements'
import { deleteTransaction } from './statementMutations'

export function TransactionList({
  householdId,
  transactions,
  categories,
  assets,
  onEdit,
}: {
  householdId: string
  transactions: LedgerTransaction[]
  categories: MonthCategory[]
  assets: LedgerAsset[]
  onEdit: (transaction: LedgerTransaction) => void
}) {
  const { tokens } = useTheme()
  const [deleting, setDeleting] = useState<LedgerTransaction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const categoryById = new Map(categories.map((entry) => [entry.categoryId, entry.name]))
  const assetById = new Map(assets.map((entry) => [entry.id, entry.name]))

  async function handleDelete() {
    if (!deleting) return
    const outcome = await deleteTransaction(householdId, deleting.id, deleting.revision)
    const outcomeError = operationOutcomeError(outcome)
    if (outcomeError) {
      setError(outcomeError)
      return
    }
    setDeleting(null)
  }

  if (transactions.length === 0) {
    return (
      <Text style={[styles.empty, { color: tokens.muted }]}>No transactions yet.</Text>
    )
  }

  return (
    <View>
      {error ? <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}
      {transactions.map((transaction) => (
        <Card key={transaction.id} style={styles.row}>
          <Pressable onPress={() => onEdit(transaction)} style={styles.rowMain}>
            <Text style={[styles.description, { color: tokens.ink }]} numberOfLines={1}>
              {transaction.description}
            </Text>
            <Text style={[styles.meta, { color: tokens.muted }]} numberOfLines={1}>
              {categoryById.get(transaction.categoryId) ?? 'Category'} ·{' '}
              {assetById.get(transaction.assetId) ?? 'Asset'} ·{' '}
              {new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' }).format(
                new Date(transaction.occurredAt),
              )}
            </Text>
          </Pressable>
          <View style={styles.rowRight}>
            <Text style={[styles.amount, { color: tokens.ink }]}>
              {transaction.kind === 'spending' ? '−' : '+'}
              {formatMoney(transaction.amountCents, HOUSEHOLD_CURRENCY)}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setDeleting(transaction)} hitSlop={6}>
              <Text style={[styles.deleteLink, { color: tokens.danger }]}>Delete</Text>
            </Pressable>
          </View>
        </Card>
      ))}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete transaction?"
        description="The linked Asset posting will be reversed."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, paddingVertical: 10 },
  error: { fontSize: 13, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8, padding: 12 },
  rowMain: { flex: 1 },
  description: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 11.5, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  amount: { fontSize: 14, fontWeight: '700' },
  deleteLink: { fontSize: 11.5, fontWeight: '600', marginTop: 4 },
})
