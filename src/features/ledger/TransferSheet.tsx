import { useState } from 'react'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { parseDollarsToCents } from '@/features/moneyInput'
import { deviceTimeZone } from '@/features/household'
import type { LedgerAsset, TransferFrequency } from './assets'
import { saveSchedule, saveTransfer } from './assetMutations'

const field =
  'w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]'
const label = 'block text-sm font-medium text-[var(--hh-muted)]'

function AssetPicker({
  id,
  value,
  onChange,
  assets,
  exclude,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  assets: LedgerAsset[]
  exclude?: string
}) {
  return (
    <select id={id} className={field} value={value} onChange={(e) => onChange(e.target.value)}>
      {assets
        .filter((a) => a.id !== exclude)
        .map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
    </select>
  )
}

/** One-off transfer between two assets. */
export function TransferSheet({
  open,
  onOpenChange,
  householdId,
  assets,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  assets: LedgerAsset[]
}) {
  const [from, setFrom] = useState(assets[0]?.id ?? '')
  const [to, setTo] = useState(assets[1]?.id ?? assets[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const cents = parseDollarsToCents(amount)
    if (!from || !to || from === to || !cents || cents <= 0) {
      setError('Pick two different assets and a positive amount.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveTransfer(
        householdId,
        {
          id: crypto.randomUUID(),
          fromAssetId: from,
          toAssetId: to,
          amountCents: cents,
          occurredAt: new Date().toISOString(),
          note: note || null,
        },
        null,
      )
      setAmount('')
      setNote('')
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="New transfer">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="transfer-from">
              From
            </label>
            <AssetPicker id="transfer-from" value={from} onChange={setFrom} assets={assets} exclude={to} />
          </div>
          <div>
            <label className={label} htmlFor="transfer-to">
              To
            </label>
            <AssetPicker id="transfer-to" value={to} onChange={setTo} assets={assets} exclude={from} />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="transfer-amount">
            Amount
          </label>
          <input
            id="transfer-amount"
            className={field}
            inputMode="decimal"
            value={amount}
            placeholder="0.00"
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="transfer-note">
            Note (optional)
          </label>
          <input
            id="transfer-note"
            className={field}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-[var(--hh-danger)]">{error}</p>}
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="w-full rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          Transfer
        </button>
      </div>
    </BottomSheet>
  )
}

const FREQUENCIES: { value: TransferFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'semi_monthly', label: 'Twice a month' },
  { value: 'monthly', label: 'Monthly' },
]

/** Create a recurring transfer schedule. */
export function ScheduleSheet({
  open,
  onOpenChange,
  householdId,
  assets,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  assets: LedgerAsset[]
}) {
  const [from, setFrom] = useState(assets[0]?.id ?? '')
  const [to, setTo] = useState(assets[1]?.id ?? assets[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<TransferFrequency>('monthly')
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const cents = parseDollarsToCents(amount)
    if (!from || !to || from === to || !cents || cents <= 0) {
      setError('Pick two different assets and a positive amount.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveSchedule(
        householdId,
        {
          id: crypto.randomUUID(),
          fromAssetId: from,
          toAssetId: to,
          amountCents: cents,
          frequency,
          startsAt: new Date(`${startDate}T12:00:00Z`).toISOString(),
          timezone: deviceTimeZone(),
          active: true,
        },
        null,
      )
      setAmount('')
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="New recurring transfer">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="schedule-from">
              From
            </label>
            <AssetPicker id="schedule-from" value={from} onChange={setFrom} assets={assets} exclude={to} />
          </div>
          <div>
            <label className={label} htmlFor="schedule-to">
              To
            </label>
            <AssetPicker id="schedule-to" value={to} onChange={setTo} assets={assets} exclude={from} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="schedule-amount">
              Amount
            </label>
            <input
              id="schedule-amount"
              className={field}
              inputMode="decimal"
              value={amount}
              placeholder="0.00"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className={label} htmlFor="schedule-freq">
              Frequency
            </label>
            <select
              id="schedule-freq"
              className={field}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as TransferFrequency)}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={label} htmlFor="schedule-start">
            Starts
          </label>
          <input
            id="schedule-start"
            type="date"
            className={field}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-[var(--hh-danger)]">{error}</p>}
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="w-full rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          Schedule
        </button>
      </div>
    </BottomSheet>
  )
}
