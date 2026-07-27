import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { FloatingActionButton } from '@/components/FloatingActionButton'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ErrorState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { AssetsTab } from '@/features/ledger/AssetsTab'
import { NewYearSheet } from '@/features/ledger/NewYearSheet'
import { StatementsTab } from '@/features/ledger/StatementsTab'
import { useLedgerYears } from '@/features/ledger/statements'
import { useTheme } from '@/theme/tokens'

type LedgerSegment = 'statements' | 'assets'

/** Ledger destination: Statements and Assets segments. */
export default function LedgerScreen() {
  const { tokens } = useTheme()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const router = useRouter()
  const params = useLocalSearchParams<{
    segment?: string
    newAsset?: string
    returnYearId?: string
    returnTransactionKind?: string
  }>()
  const segment: LedgerSegment = params.segment === 'assets' ? 'assets' : 'statements'
  const years = useLedgerYears(householdId)
  const [newYearOpen, setNewYearOpen] = useState(false)

  function setSegment(next: LedgerSegment) {
    router.setParams({ segment: next === 'assets' ? 'assets' : undefined })
  }

  function handleExternalAssetCreated() {
    if (
      !params.returnYearId ||
      (params.returnTransactionKind !== 'income' &&
        params.returnTransactionKind !== 'spending')
    ) {
      return
    }
    router.replace({
      pathname: '/ledger/[yearId]',
      params: {
        yearId: params.returnYearId,
        transactionKind: params.returnTransactionKind,
      },
    })
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.segmented}>
          <SegmentedControl
            label="Ledger view"
            value={segment}
            onChange={setSegment}
            options={[
              { value: 'statements', label: 'Statements' },
              { value: 'assets', label: 'Assets' },
            ]}
          />
        </View>
        {household.isError || !householdId ? (
          <ErrorState message="Could not load your household." />
        ) : segment === 'assets' ? (
          <AssetsTab
            householdId={householdId}
            requestNewAsset={params.newAsset === '1'}
            onExternalAssetCreated={handleExternalAssetCreated}
            onExternalAssetClosed={() =>
              router.setParams({
                newAsset: undefined,
                returnYearId: undefined,
                returnTransactionKind: undefined,
              })
            }
          />
        ) : (
          <StatementsTab
            householdId={householdId}
            onCreateYear={() => setNewYearOpen(true)}
          />
        )}
      </ScrollView>

      {segment === 'statements' ? (
        <FloatingActionButton
          accessibilityLabel="New statement year"
          onPress={() => setNewYearOpen(true)}
        />
      ) : null}

      {householdId ? (
        <NewYearSheet
          open={newYearOpen}
          onOpenChange={setNewYearOpen}
          householdId={householdId}
          years={years.data ?? []}
        />
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 90 },
  segmented: { marginBottom: 16 },
})
