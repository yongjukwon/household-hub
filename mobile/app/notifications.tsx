import { Stack, useRouter } from 'expo-router'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { GradientBackground } from '@/components/GradientBackground'
import { ListCard } from '@/components/ListCard'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import {
  markNotificationRead,
  notificationCopy,
  useNotifications,
  type InboxNotification,
} from '@/features/notifications'
import { notificationRoute } from '@/lib/notificationLifecycle'
import { useTheme } from '@/theme/tokens'

function relativeTime(value: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime())
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function NotificationsScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  // Approximate iOS compact-header height; @react-navigation/elements'
  // useHeaderHeight is not resolvable in this Expo Router version's
  // dependency tree, so this stands in for it.
  const headerHeight = insets.top + 44
  const router = useRouter()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const query = useNotifications(householdId)

  async function openNotification(notification: InboxNotification) {
    if (householdId && !notification.readAt) {
      await markNotificationRead(householdId, notification)
    }
    router.replace(
      notificationRoute({
        entityType: notification.entityType,
        entityId: notification.entityId,
      }),
    )
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: 'transparent' }]}
      edges={['bottom']}
    >
      <GradientBackground />
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Notifications',
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerTintColor: tokens.ink,
          headerTitleStyle: { color: tokens.ink },
        }}
      />
      <FlatList
        data={query.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight }]}
        ListEmptyComponent={
          query.isLoading ? (
            <LoadingState />
          ) : query.isError ? (
            <ErrorState
              message="Could not load notifications."
              onRetry={() => void query.refetch()}
            />
          ) : (
            <EmptyState
              title="No notifications"
              hint="Partner Calendar activity will appear here."
            />
          )
        }
        renderItem={({ item }) => {
          const copy = notificationCopy(item)
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => void openNotification(item)}
              style={styles.rowWrap}
            >
              <ListCard style={styles.row}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: item.readAt
                        ? 'transparent'
                        : tokens.accent,
                    },
                  ]}
                />
                <View style={styles.text}>
                  <Text
                    style={[
                      styles.title,
                      {
                        color: tokens.ink,
                        fontWeight: item.readAt ? '600' : '800',
                      },
                    ]}
                  >
                    {copy.title}
                  </Text>
                  <Text style={[styles.body, { color: tokens.muted }]}>
                    {copy.body} · {relativeTime(item.createdAt)}
                  </Text>
                </View>
              </ListCard>
            </Pressable>
          )
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  rowWrap: { marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flex: 1 },
  title: { fontSize: 15 },
  body: { fontSize: 13, marginTop: 2 },
})
