import { useMemo, useState } from 'react'
import { ArrowRightIcon, PlusIcon } from '@heroicons/react/24/outline'
import { formatMoney } from '@household-hub/domain'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/shell/ui/states'
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
export function AssetsTab({ householdId }: { householdId: string }) {
  const assetsQuery = useLedgerAssets(householdId)
  const transfersQuery = useLedgerTransfers(householdId)
  const schedulesQuery = useTransferSchedules(householdId)

  const [assetSheet, setAssetSheet] = useState(false)
  const [editingAsset, setEditingAsset] = useState<LedgerAsset | null>(null)
  const [transferSheet, setTransferSheet] = useState(false)
  const [scheduleSheet, setScheduleSheet] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'transfer' | 'schedule'; id: string; revision: number } | null
  >(null)

  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data])
  const byId = useMemo(() => {
    const map = new Map<string, LedgerAsset>()
    for (const a of assets) map.set(a.id, a)
    return map
  }, [assets])
  const totals = totalsByCurrency(assets)
  const foreign = totals.filter((t) => t.currencyCode !== HOUSEHOLD_CURRENCY)

  function openNewAsset() {
    setEditingAsset(null)
    setAssetSheet(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'transfer') {
      await deleteTransfer(householdId, deleteTarget.id, deleteTarget.revision)
    } else {
      await deleteSchedule(householdId, deleteTarget.id, deleteTarget.revision)
    }
    setDeleteTarget(null)
  }

  if (assetsQuery.isLoading) return <LoadingState />
  if (assetsQuery.isError)
    return <ErrorState message="Could not load assets." onRetry={() => void assetsQuery.refetch()} />

  return (
    <div className="space-y-5">
      <div className="rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-4 shadow-[var(--hh-shadow-card)]">
        <p className="text-sm text-[var(--hh-muted)]">Household total</p>
        <p className="text-2xl font-bold text-[var(--hh-ink)]">
          {formatMoney(householdTotalCents(assets), HOUSEHOLD_CURRENCY)}
        </p>
        {foreign.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--hh-muted)]">
            {foreign.map((t) => (
              <span key={t.currencyCode}>
                {formatMoney(t.totalCents, t.currencyCode)}
              </span>
            ))}
          </div>
        )}
      </div>

      <section>
        <SectionHeader title="Assets" onAdd={openNewAsset} addLabel="New asset" />
        {assets.length === 0 ? (
          <EmptyState title="No assets yet" hint="Add an account to track its balance." />
        ) : (
          <ul className="space-y-2">
            {assets.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAsset(asset)
                    setAssetSheet(true)
                  }}
                  className="flex w-full items-center justify-between rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 text-left shadow-[var(--hh-shadow-card)]"
                >
                  <span className="font-medium text-[var(--hh-ink)]">{asset.name}</span>
                  <span className="tabular-nums text-[var(--hh-ink)]">
                    {formatMoney(asset.balanceCents, asset.currencyCode)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader
          title="Transfers"
          onAdd={() => setTransferSheet(true)}
          addLabel="New transfer"
          disabled={assets.length < 2}
        />
        {(transfersQuery.data ?? []).length === 0 ? (
          <p className="px-1 text-sm text-[var(--hh-muted)]">No transfers yet.</p>
        ) : (
          <ul className="space-y-2">
            {(transfersQuery.data ?? []).map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 shadow-[var(--hh-shadow-card)]"
              >
                <span className="flex items-center gap-2 text-sm text-[var(--hh-ink)]">
                  {byId.get(t.fromAssetId)?.name ?? '—'}
                  <ArrowRightIcon className="h-4 w-4 text-[var(--hh-muted)]" />
                  {byId.get(t.toAssetId)?.name ?? '—'}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-[var(--hh-ink)]">
                    {formatMoney(t.amountCents, HOUSEHOLD_CURRENCY)}
                  </span>
                  <button
                    type="button"
                    aria-label="Delete transfer"
                    onClick={() =>
                      setDeleteTarget({ kind: 'transfer', id: t.id, revision: t.revision })
                    }
                    className="text-sm text-[var(--hh-danger)]"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader
          title="Recurring"
          onAdd={() => setScheduleSheet(true)}
          addLabel="New recurring transfer"
          disabled={assets.length < 2}
        />
        {(schedulesQuery.data ?? []).length === 0 ? (
          <p className="px-1 text-sm text-[var(--hh-muted)]">No recurring transfers.</p>
        ) : (
          <ul className="space-y-2">
            {(schedulesQuery.data ?? []).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 shadow-[var(--hh-shadow-card)]"
              >
                <span className="flex-1 text-sm text-[var(--hh-ink)]">
                  {byId.get(s.fromAssetId)?.name ?? '—'} →{' '}
                  {byId.get(s.toAssetId)?.name ?? '—'}
                  <span className="ml-2 text-[var(--hh-muted)]">
                    {formatMoney(s.amountCents, HOUSEHOLD_CURRENCY)} · {FREQUENCY_LABEL[s.frequency]}
                  </span>
                </span>
                <label className="flex items-center gap-1 text-xs text-[var(--hh-muted)]">
                  <input
                    type="checkbox"
                    checked={s.active}
                    aria-label={`${s.active ? 'Pause' : 'Resume'} recurring transfer`}
                    onChange={(e) => void toggleSchedule(householdId, s, e.target.checked)}
                  />
                  {s.active ? 'On' : 'Off'}
                </label>
                <button
                  type="button"
                  aria-label="Delete recurring transfer"
                  onClick={() =>
                    setDeleteTarget({ kind: 'schedule', id: s.id, revision: s.revision })
                  }
                  className="text-sm text-[var(--hh-danger)]"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {assetSheet && (
        <AssetSheet
          key={editingAsset ? `${editingAsset.id}:${editingAsset.revision}` : 'new'}
          open={assetSheet}
          onOpenChange={(open) => {
            setAssetSheet(open)
            if (!open) setEditingAsset(null)
          }}
          householdId={householdId}
          asset={editingAsset}
          sortOrder={editingAsset?.sortOrder ?? assets.length}
        />
      )}
      {transferSheet && (
        <TransferSheet
          open={transferSheet}
          onOpenChange={setTransferSheet}
          householdId={householdId}
          assets={assets}
        />
      )}
      {scheduleSheet && (
        <ScheduleSheet
          open={scheduleSheet}
          onOpenChange={setScheduleSheet}
          householdId={householdId}
          assets={assets}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={deleteTarget?.kind === 'schedule' ? 'Delete recurring transfer?' : 'Delete transfer?'}
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
      />
    </div>
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
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h3 className="text-sm font-semibold text-[var(--hh-muted)]">{title}</h3>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-label={addLabel}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hh-accent)] text-white disabled:opacity-40"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  )
}
