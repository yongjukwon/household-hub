import { Stack } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/theme/tokens'

export default function SettingsScreen() {
  const { tokens } = useTheme()
  const { session } = useAuth()

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]}>
      <Stack.Screen options={{ headerShown: true, title: 'Settings' }} />
      <View style={styles.body}>
        <Text style={[styles.label, { color: tokens.mutedInk }]}>
          Signed in as
        </Text>
        <Text style={[styles.value, { color: tokens.ink }]}>
          {session?.user.email ?? '—'}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={() => void supabase.auth.signOut()}
          style={[styles.signOut, { borderColor: tokens.border }]}
        >
          <Text style={[styles.signOutText, { color: tokens.accent }]}>
            Sign out
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: 24, gap: 6 },
  label: { fontSize: 13 },
  value: { fontSize: 17, fontWeight: '600', marginBottom: 24 },
  signOut: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { fontSize: 16, fontWeight: '600' },
})
