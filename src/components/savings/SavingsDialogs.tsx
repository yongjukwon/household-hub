import { useRef, useState, type FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  useCreateSavingsSource,
  useCreateSavingsTransaction,
  useRenameSavingsSource,
  useSaveSavingsDepositRule,
  useUpdateSavingsTransaction,
  todayKey,
  type SavingsDepositRule,
  type SavingsSource,
  type SavingsTransaction,
  type SavingsTransactionType,
} from '@/hooks/useSavings'

const MAX_MONEY = 99_999_999.99
const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/

const selectClassName =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/** Positive money amount or undefined for invalid; blank is undefined too. */
function parseAmount(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed || !MONEY_PATTERN.test(trimmed)) return undefined
  const amount = Number(trimmed)
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_MONEY) {
    return undefined
  }
  return amount
}

interface SourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  /** Editing (rename) when set; creating otherwise. */
  source: SavingsSource | null
}

export function SourceDialog({
  open,
  onOpenChange,
  householdId,
  source,
}: SourceDialogProps) {
  const [name, setName] = useState(source?.name ?? '')
  const [startingAmount, setStartingAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createId = useRef<string | null>(null)
  const createSource = useCreateSavingsSource()
  const renameSource = useRenameSavingsSource()
  const pending = createSource.isPending || renameSource.isPending

  function close() {
    createId.current = null
    setError(null)
    onOpenChange(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Enter a source name.')
      return
    }
    const trimmedAmount = startingAmount.trim()
    // Blank starting amount = 0; zero is allowed as a baseline.
    const parsed = trimmedAmount === '' ? 0 : Number(trimmedAmount)
    if (
      !source &&
      (!Number.isFinite(parsed) ||
        parsed < 0 ||
        parsed > MAX_MONEY ||
        (trimmedAmount !== '' && !MONEY_PATTERN.test(trimmedAmount)))
    ) {
      setError('Enter a starting amount from $0 to $99,999,999.99.')
      return
    }

    setError(null)
    try {
      if (source) {
        await renameSource.mutateAsync({ id: source.id, name: trimmedName })
      } else {
        createId.current ??= crypto.randomUUID()
        await createSource.mutateAsync({
          id: createId.current,
          householdId,
          name: trimmedName,
          startingAmount: parsed,
        })
      }
      close()
    } catch (mutationError) {
      console.error('Failed to save savings source', mutationError)
      setError('Couldn’t save the source — check your connection and try again.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{source ? 'Rename source' : 'New source'}</DialogTitle>
          <DialogDescription>
            {source
              ? 'Rename this savings source.'
              : 'A place your savings live — an account, a fund, cash.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="savings-source-name">Name</Label>
              <Input
                id="savings-source-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="TFSA — Wealthsimple"
                aria-invalid={!!error && !name.trim()}
                required
              />
            </div>
            {!source && (
              <div className="space-y-1.5">
                <Label htmlFor="savings-source-amount">Starting amount</Label>
                <Input
                  id="savings-source-amount"
                  inputMode="decimal"
                  value={startingAmount}
                  onChange={(event) => setStartingAmount(event.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-[var(--meta)]">
                  The balance today. After this, the amount only changes
                  through logged deposits and withdrawals.
                </p>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : source ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface TransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: SavingsSource
  /** Preselected by which menu action opened the dialog. */
  type: SavingsTransactionType
  /** Editing when set; creating otherwise. */
  transaction: SavingsTransaction | null
}

export function TransactionDialog({
  open,
  onOpenChange,
  source,
  type,
  transaction,
}: TransactionDialogProps) {
  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount) : '',
  )
  const [reason, setReason] = useState(transaction?.reason ?? '')
  const [occurredAt, setOccurredAt] = useState(
    transaction?.occurred_at ?? todayKey(),
  )
  const [error, setError] = useState<string | null>(null)
  const createId = useRef<string | null>(null)
  const createTransaction = useCreateSavingsTransaction()
  const updateTransaction = useUpdateSavingsTransaction()
  const pending = createTransaction.isPending || updateTransaction.isPending
  const effectiveType = transaction?.type ?? type
  const isWithdrawal = effectiveType === 'withdrawal'

  function close() {
    createId.current = null
    setError(null)
    onOpenChange(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = parseAmount(amount)
    if (parsedAmount === undefined) {
      setError('Enter an amount from $0.01 to $99,999,999.99.')
      return
    }
    const trimmedReason = reason.trim()
    if (isWithdrawal && !trimmedReason) {
      setError('Enter what the withdrawal was for.')
      return
    }
    if (!occurredAt) {
      setError('Pick a date.')
      return
    }

    const input = {
      id: transaction?.id ?? (createId.current ??= crypto.randomUUID()),
      sourceId: source.id,
      type: effectiveType,
      amount: parsedAmount,
      reason: trimmedReason || null,
      occurredAt,
    }

    setError(null)
    try {
      if (transaction) await updateTransaction.mutateAsync(input)
      else await createTransaction.mutateAsync(input)
      close()
    } catch (mutationError) {
      console.error('Failed to save savings transaction', mutationError)
      // The DB rejects a withdrawal that would take the balance below zero
      // (amount >= 0 check) — surface that case specifically.
      setError(
        isWithdrawal
          ? 'Couldn’t save — check the amount isn’t more than the balance, and that you’re online.'
          : 'Couldn’t save — check your connection and try again.',
      )
    }
  }

  const verb = isWithdrawal ? 'Withdrawal' : 'Deposit'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {transaction ? `Edit ${verb.toLowerCase()}` : verb}
          </DialogTitle>
          <DialogDescription>
            {isWithdrawal
              ? `Taking money out of ${source.name} — the balance updates automatically.`
              : `Adding money to ${source.name} — the balance updates automatically.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="savings-transaction-amount">Amount</Label>
              <Input
                id="savings-transaction-amount"
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="savings-transaction-reason">
                {isWithdrawal ? 'For what' : 'Note'}
              </Label>
              <Input
                id="savings-transaction-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={isWithdrawal ? 'Car repair' : 'Optional'}
                required={isWithdrawal}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="savings-transaction-date">Date</Label>
              <Input
                id="savings-transaction-date"
                type="date"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : transaction ? 'Save' : verb}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface AutoDepositRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: SavingsSource
  /** The existing rule when editing; null to create. */
  rule: SavingsDepositRule | null
}

export function AutoDepositRuleDialog({
  open,
  onOpenChange,
  source,
  rule,
}: AutoDepositRuleDialogProps) {
  const [amount, setAmount] = useState(rule ? String(rule.amount) : '')
  const [day1, setDay1] = useState(String(rule?.day_of_month_1 ?? 1))
  const [day2, setDay2] = useState(String(rule?.day_of_month_2 ?? 15))
  const [startDate, setStartDate] = useState(rule?.start_date ?? todayKey())
  const [active, setActive] = useState(rule?.active ?? true)
  const [description, setDescription] = useState(rule?.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const createId = useRef<string | null>(null)
  const saveRule = useSaveSavingsDepositRule()

  function close() {
    createId.current = null
    setError(null)
    onOpenChange(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = parseAmount(amount)
    if (parsedAmount === undefined) {
      setError('Enter an amount from $0.01 to $99,999,999.99.')
      return
    }
    if (day1 === day2) {
      setError('Pick two different days of the month.')
      return
    }
    if (!startDate) {
      setError('Pick a start date.')
      return
    }

    setError(null)
    try {
      await saveRule.mutateAsync({
        id: rule?.id ?? (createId.current ??= crypto.randomUUID()),
        sourceId: source.id,
        amount: parsedAmount,
        dayOfMonth1: Number(day1),
        dayOfMonth2: Number(day2),
        startDate,
        active,
        description: description.trim() || null,
      })
      close()
    } catch (mutationError) {
      console.error('Failed to save auto-deposit rule', mutationError)
      setError('Couldn’t save the rule — check your connection and try again.')
    }
  }

  const dayOptions = Array.from({ length: 31 }, (_, i) => String(i + 1))

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {rule ? 'Edit auto-deposit' : 'Set up auto-deposit'}
          </DialogTitle>
          <DialogDescription>
            Deposits into {source.name} are logged automatically twice a month
            on these days. Days past a month’s end land on its last day.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="savings-rule-amount">Amount per deposit</Label>
              <Input
                id="savings-rule-amount"
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="savings-rule-day1">First day</Label>
                <select
                  id="savings-rule-day1"
                  className={selectClassName}
                  value={day1}
                  onChange={(event) => setDay1(event.target.value)}
                >
                  {dayOptions.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="savings-rule-day2">Second day</Label>
                <select
                  id="savings-rule-day2"
                  className={selectClassName}
                  value={day2}
                  onChange={(event) => setDay2(event.target.value)}
                >
                  {dayOptions.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="savings-rule-start">Starts</Label>
              <Input
                id="savings-rule-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="savings-rule-description">Note</Label>
              <Input
                id="savings-rule-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Paycheck RRSP contribution"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="savings-rule-active"
                checked={active}
                onCheckedChange={(checked) => setActive(checked === true)}
              />
              <Label htmlFor="savings-rule-active">Active</Label>
            </div>
            {error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveRule.isPending}>
              {saveRule.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
