import { formatMoney } from '@household-hub/domain'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'

import { Card } from '@/components/Card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ArrowRightIcon, PlusIcon } from '@/components/icons'
import { ListCard } from '@/components/ListCard'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import {
  operationOutcomeError,
  operationThrownError,
} from '@/lib/operations'
import { useTheme } from '@/theme/tokens'
import {
  HOUSEHOLD_CURRENCY,
  householdTotalCents,
  totalsByCurrency,
  useLedgerAssets,
  useLedgerTransfers,
  useTransferSchedules,
  type LedgerAsset,
  type TransferSchedule,
} from './assets'
import { deleteSchedule, deleteTransfer, toggleSchedule } from './assetMutations'
import { AssetSheet } from './AssetSheet'
import { ScheduleSheet, TransferSheet } from './TransferSheet'

const FREQUENCY_LABEL: Record<TransferSchedule['frequency'], string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  semi_monthly: 'Twice a month',
  monthly: 'Monthly',
}

/** Assets segment: balances, one-off transfers, and recurring transfers. */
export function AssetsTab({
  householdId,
  requestNewAsset = false,
  onExternalAssetCreated,
  onExternalAssetClosed,
}: {
  householdId: string
  requestNewAsset?: boolean
  onExternalAssetCreated?: () => void
  onExternalAssetClosed?: () => void
}) {
  const { tokens } = useTheme()
  const assetsQuery = useLedgerAssets(householdId)
  const transfersQuery = useLedgerTransfers(householdId)
  const schedulesQuery = useTransferSchedules(householdId)

  const [assetSheet, setAssetSheet] = useState(requestNewAsset)
  const [editingAsset, setEditingAsset] = useState<LedgerAsset | null>(null)
  const [externalAssetCreation, setExternalAssetCreation] =
    useState(requestNewAsset)
  const [transferSheet, setTransferSheet] = useState(false)
  const [scheduleSheet, setScheduleSheet] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'transfer' | 'schedule'; id: string; revision: number } | null
  >(null)
  const [operationBusy, setOperationBusy] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)

  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data])
  const byId = useMemo(() => {
    const map = new Map<string, LedgerAsset>()
    for (const a of assets) map.set(a.id, a)
    return map
  }, [assets])
  const totals = totalsByCurrency(assets)
  const foreign = totals.filter((t) => t.currencyCode !== HOUSEHOLD_CURRENCY)

  function openNewAsset() {
    setExternalAssetCreation(false)
    setEditingAsset(null)
    setAssetSheet(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setOperationBusy(true)
    setOperationError(null)
    try {
      const outcome =
        deleteTarget.kind === 'transfer'
          ? await deleteTransfer(
              householdId,
              deleteTarget.id,
              deleteTarget.revision,
            )
          : await deleteSchedule(
              householdId,
              deleteTarget.id,
              deleteTarget.revision,
            )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setOperationError(outcomeError)
        return
      }
      setDeleteTarget(null)
    } catch (failure) {
      setOperationError(
        operationThrownError(failure, 'Could not delete this transfer.'),
      )
    } finally {
      setOperationBusy(false)
    }
  }

  async function handleScheduleToggle(
    schedule: TransferSchedule,
    active: boolean,
  ) {
    setOperationError(null)
    try {
      const outcome = await toggleSchedule(householdId, schedule, active)
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) setOperationError(outcomeError)
    } catch (failure) {
      setOperationError(
        operationThrownError(
          failure,
          'Could not update this recurring transfer.',
        ),
      )
    }
  }

  if (assetsQuery.isLoading) return <LoadingState />
  if (assetsQuery.isError) {
    return <ErrorState message="Could not load assets." onRetry={() => void assetsQuery.refetch()} />
  }

  return (
    <View style={styles.stack}>
      {operationError && !deleteTarget ? (
        <Text style={[styles.operationError, { color: tokens.danger }]}>
          {operationError}
        </Text>
      ) : null}
      <Card>
        <Text style={[styles.totalLabel, { color: tokens.muted }]}>Household total</Text>
        <Text style={[styles.totalValue, { color: tokens.ink }]}>
          {formatMoney(householdTotalCents(assets), HOUSEHOLD_CURRENCY)}
        </Text>
        {foreign.length > 0 ? (
          <View style={styles.foreignRow}>
            {foreign.map((t) => (
              <Text key={t.currencyCode} style={[styles.foreignText, { color: tokens.muted }]}>
                {formatMoney(t.totalCents, t.currencyCode)}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>

      <View>
        <SectionHeader title="Assets" onAdd={openNewAsset} addLabel="New asset" />
        {assets.length === 0 ? (
          <EmptyState title="No assets yet" hint="Add an account to track its balance." />
        ) : (
          assets.map((asset) => (
            <Pressable
              key={asset.id}
              onPress={() => {
                setEditingAsset(asset)
                setAssetSheet(true)
              }}
            >
              <ListCard style={styles.row}>
                <Text style={[styles.rowLabel, { color: tokens.ink }]}>{asset.name}</Text>
                <Text style={[styles.rowValue, { color: tokens.ink }]}>
                  {formatMoney(asset.balanceCents, asset.currencyCode)}
                </Text>
              </ListCard>
            </Pressable>
          ))
        )}
      </View>

      <View>
        <SectionHeader
          title="Transfers"
          onAdd={() => setTransferSheet(true)}
          addLabel="New transfer"
          disabled={assets.length < 2}
        />
        {(transfersQuery.data ?? []).length === 0 ? (
          <Text style={[styles.emptyText, { color: tokens.muted }]}>No transfers yet.</Text>
        ) : (
          (transfersQuery.data ?? []).map((t) => (
            <ListCard key={t.id} style={styles.row}>
              <View style={styles.transferLeft}>
                <Text style={[styles.rowLabel, { color: tokens.ink }]} numberOfLines={1}>
                  {byId.get(t.fromAssetId)?.name ?? '—'}
                </Text>
                <ArrowRightIcon size={14} color={tokens.muted} />
                <Text style={[styles.rowLabel, { color: tokens.ink }]} numberOfLines={1}>
                  {byId.get(t.toAssetId)?.name ?? '—'}
                </Text>
              </View>
              <View style={styles.transferRight}>
                <Text style={[styles.rowValue, { color: tokens.ink }]}>
                  {formatMoney(t.amountCents, HOUSEHOLD_CURRENCY)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete transfer"
                  onPress={() => {
                    setOperationError(null)
                    setDeleteTarget({
                      kind: 'transfer',
                      id: t.id,
                      revision: t.revision,
                    })
                  }}
                  hitSlop={6}
                >
                  <Text style={[styles.deleteLink, { color: tokens.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </ListCard>
          ))
        )}
      </View>

      <View>
        <SectionHeader
          title="Recurring"
          onAdd={() => setScheduleSheet(true)}
          addLabel="New recurring transfer"
          disabled={assets.length < 2}
        />
        {(schedulesQuery.data ?? []).length === 0 ? (
          <Text style={[styles.emptyText, { color: tokens.muted }]}>No recurring transfers.</Text>
        ) : (
          (schedulesQuery.data ?? []).map((s) => (
            <ListCard key={s.id} style={styles.row}>
              <View style={styles.scheduleLeft}>
                <Text style={[styles.rowLabel, { color: tokens.ink }]} numberOfLines={1}>
                  {byId.get(s.fromAssetId)?.name ?? '—'} → {byId.get(s.toAssetId)?.name ?? '—'}
                </Text>
                <Text style={[styles.scheduleMeta, { color: tokens.muted }]}>
                  {formatMoney(s.amountCents, HOUSEHOLD_CURRENCY)} · {FREQUENCY_LABEL[s.frequency]}
                </Text>
              </View>
              <View style={styles.scheduleRight}>
                <Switch
                  value={s.active}
                  onValueChange={(active) =>
                    void handleScheduleToggle(s, active)
                  }
                  trackColor={{ true: tokens.accent }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete recurring transfer"
                  onPress={() => {
                    setOperationError(null)
                    setDeleteTarget({
                      kind: 'schedule',
                      id: s.id,
                      revision: s.revision,
                    })
                  }}
                  hitSlop={6}
                >
                  <Text style={[styles.deleteLink, { color: tokens.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </ListCard>
          ))
        )}
      </View>

      {assetSheet ? (
        <AssetSheet
          key={editingAsset ? `${editingAsset.id}:${editingAsset.revision}` : 'new'}
          open={assetSheet}
          onOpenChange={(open) => {
            setAssetSheet(open)
            if (!open) {
              if (externalAssetCreation) onExternalAssetClosed?.()
              setEditingAsset(null)
              setExternalAssetCreation(false)
            }
          }}
          householdId={householdId}
          asset={editingAsset}
          sortOrder={editingAsset?.sortOrder ?? assets.length}
          onSaved={
            externalAssetCreation ? onExternalAssetCreated : undefined
          }
        />
      ) : null}
      {transferSheet ? (
        <TransferSheet
          open={transferSheet}
          onOpenChange={setTransferSheet}
          householdId={householdId}
          assets={assets}
        />
      ) : null}
      {scheduleSheet ? (
        <ScheduleSheet
          open={scheduleSheet}
          onOpenChange={setScheduleSheet}
          householdId={householdId}
          assets={assets}
        />
      ) : null}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !operationBusy) {
            setOperationError(null)
            setDeleteTarget(null)
          }
        }}
        title={deleteTarget?.kind === 'schedule' ? 'Delete recurring transfer?' : 'Delete transfer?'}
        description="This cannot be undone."
        error={operationError}
        confirmLabel="Delete"
        confirmDisabled={operationBusy}
        onConfirm={() => void confirmDelete()}
      />
    </View>
  )
}

function SectionHeader({
  title,
  onAdd,
  addLabel,
  disabled,
}: {
  title: string
  onAdd: () => void
  addLabel: string
  disabled?: boolean
}) {
  const { tokens } = useTheme()
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: tokens.muted }]}>{title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={addLabel}
        disabled={disabled}
        onPress={onAdd}
        style={[
          styles.sectionAdd,
          { backgroundColor: tokens.accent },
          disabled && styles.disabled,
        ]}
      >
        <PlusIcon size={14} color={tokens.accentContrast} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 20 },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  foreignRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  foreignText: { fontSize: 13 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600' },
  sectionAdd: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, paddingHorizontal: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
  },
  rowLabel: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  rowValue: { fontSize: 14, fontWeight: '600' },
  transferLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  transferRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scheduleLeft: { flex: 1 },
  scheduleMeta: { fontSize: 12, marginTop: 2 },
  scheduleRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deleteLink: { fontSize: 12.5, fontWeight: '600' },
  operationError: { fontSize: 13 },
  disabled: { opacity: 0.4 },
})
