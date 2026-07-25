import { useState } from 'react'
import { Screen } from '@/shell/Screen'
import { SegmentedControl } from '@/shell/ui/SegmentedControl'
import { ErrorState } from '@/shell/ui/states'
import { useActiveHousehold } from '@/features/household'
import { AssetsTab } from './AssetsTab'
import { StatementsTab } from './StatementsTab'

type LedgerSegment = 'statements' | 'assets'

/** Ledger destination: Statements and Assets segments. */
export function LedgerScreen() {
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const [segment, setSegment] = useState<LedgerSegment>('statements')

  return (
    <Screen title="Ledger">
      <SegmentedControl
        label="Ledger view"
        className="mb-4"
        options={[
          { value: 'statements', label: 'Statements' },
          { value: 'assets', label: 'Assets' },
        ]}
        value={segment}
        onChange={setSegment}
      />
      {household.isError || !householdId ? (
        <ErrorState message="Could not load your household." />
      ) : segment === 'assets' ? (
        <AssetsTab householdId={householdId} />
      ) : (
        <StatementsTab householdId={householdId} />
      )}
    </Screen>
  )
}
