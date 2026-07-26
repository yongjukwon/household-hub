import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SegmentedControl } from '@/components/SegmentedControl'
import { ErrorState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { AssetsTab } from '@/features/ledger/AssetsTab'
import { StatementsTab } from '@/features/ledger/StatementsTab'
import { useTheme } from '@/theme/tokens'

type LedgerSegment = 'statements' | 'assets'

/** Ledger destination: Statements and Assets segments. */
export default function LedgerScreen() {
  const { tokens } = useTheme()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const router = useRouter()
  const params = useLocalSearchParams<{ segment?: string }>()
  const segment: LedgerSegment = params.segment === 'assets' ? 'assets' : 'statements'

  function setSegment(next: LedgerSegment) {
    router.setParams({ segment: next === 'assets' ? 'assets' : undefined })
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]} edges={['bottom']}>
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
          <AssetsTab householdId={householdId} />
        ) : (
          <StatementsTab householdId={householdId} />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 24 },
  segmented: { marginBottom: 16 },
})
