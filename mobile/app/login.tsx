import { useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { GradientBackground } from '@/components/GradientBackground'
import { signInWithProvider, type OAuthProvider } from '@/lib/auth/oauth'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/theme/tokens'

const testAuthEnabled = process.env.EXPO_PUBLIC_ENABLE_TEST_AUTH === 'true'

export default function LoginScreen() {
  const { tokens } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function withBusy(run: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    try {
      const message = await run()
      if (message) setError(message)
    } finally {
      setBusy(false)
    }
  }

  const onProvider = (provider: OAuthProvider) =>
    withBusy(async () => {
      const outcome = await signInWithProvider(provider)
      return outcome.status === 'error' ? outcome.message : null
    })

  const onPassword = () =>
    withBusy(async () => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      return signInError?.message ?? null
    })

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]}>
      <GradientBackground />
      <View style={styles.body}>
        <Text style={styles.mark}>🐰🐧</Text>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: tokens.ink }]}
        >
          Household Hub
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          disabled={busy}
          onPress={() => onProvider('google')}
          style={[styles.provider, { borderColor: tokens.line }]}
        >
          <Text style={[styles.providerText, { color: tokens.ink }]}>
            Continue with Google
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          disabled={busy}
          onPress={() => onProvider('apple')}
          style={[styles.provider, { borderColor: tokens.line }]}
        >
          <Text style={[styles.providerText, { color: tokens.ink }]}>
            Continue with Apple
          </Text>
        </Pressable>

        {testAuthEnabled ? (
          <View style={styles.testBlock}>
            <Text style={[styles.testLabel, { color: tokens.muted }]}>
              Local test sign-in
            </Text>
            <TextInput
              accessibilityLabel="Email"
              placeholder="email"
              placeholderTextColor={tokens.muted3}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={[
                styles.input,
                { borderColor: tokens.line, color: tokens.ink },
              ]}
            />
            <TextInput
              accessibilityLabel="Password"
              placeholder="password"
              placeholderTextColor={tokens.muted3}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={[
                styles.input,
                { borderColor: tokens.line, color: tokens.ink },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              disabled={busy}
              onPress={onPassword}
              style={[styles.primary, { backgroundColor: tokens.accent }]}
            >
              <Text style={[styles.primaryText, { color: tokens.accentContrast }]}>
                Sign in
              </Text>
            </Pressable>
          </View>
        ) : null}

        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: tokens.danger }]}>
            {error}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  mark: { fontSize: 40, textAlign: 'center' },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  provider: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  providerText: { fontSize: 16, fontWeight: '600' },
  testBlock: { marginTop: 16, gap: 10 },
  testLabel: { fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  primary: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { fontSize: 16, fontWeight: '600' },
  error: { fontSize: 14, textAlign: 'center' },
})
