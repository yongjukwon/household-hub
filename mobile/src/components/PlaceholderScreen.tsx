import { SafeAreaView } from 'react-native-safe-area-context'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/theme/tokens'

/**
 * Foundation-phase screen body. The five destinations and Settings render this
 * until Task 8 implements the real feature flows against the shared contracts.
 */
export function PlaceholderScreen({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  const { tokens } = useTheme()

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]}>
      <View style={styles.body}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: tokens.ink }]}
        >
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: tokens.muted }]}>
          {subtitle ?? 'Coming soon.'}
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 15, textAlign: 'center' },
})
