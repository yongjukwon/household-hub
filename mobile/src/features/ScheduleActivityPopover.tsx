import { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useTheme } from '@/theme/tokens'
import { notificationCopy, type InboxNotification } from './notifications'

interface ScheduleActivityPopoverProps {
  open: boolean
  topInset: number
  notifications: InboxNotification[]
  onOpenChange: (open: boolean) => void
  onOpenActivity: (notification: InboxNotification, navigate: boolean) => void
  onRemove: (notification: InboxNotification) => void
  onClear: () => void
  loading?: boolean
  error?: boolean
  onRetry?: () => void
}

export function ScheduleActivityPopover({
  open,
  topInset,
  notifications,
  onOpenChange,
  onOpenActivity,
  onRemove,
  onClear,
  loading = false,
  error = false,
  onRetry,
}: ScheduleActivityPopoverProps) {
  const { tokens } = useTheme()
  const [confirmingClear, setConfirmingClear] = useState(false)

  return (
    <>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => onOpenChange(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => onOpenChange(false)}>
          <Pressable
            testID="activity-popover"
            accessibilityRole="none"
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.popover,
              {
                top: topInset + 48,
                backgroundColor: tokens.card,
                borderColor: tokens.line,
              },
              tokens.shadowFloat,
            ]}
          >
            <View style={styles.headingRow}>
              <Text style={[styles.heading, { color: tokens.ink }]}>Activity</Text>
              {notifications.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear all activity"
                  onPress={() => setConfirmingClear(true)}
                >
                  <Text style={[styles.clear, { color: tokens.danger }]}>Clear all</Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView testID="activity-scroll" showsVerticalScrollIndicator>
              {loading ? (
                <Text style={[styles.state, { color: tokens.muted }]}>Loading activity…</Text>
              ) : error ? (
                <Pressable accessibilityRole="button" onPress={onRetry}>
                  <Text style={[styles.state, { color: tokens.danger }]}>Retry activity</Text>
                </Pressable>
              ) : notifications.length === 0 ? (
                <Text style={[styles.state, { color: tokens.muted }]}>No activity yet.</Text>
              ) : notifications.map((notification) => {
                const copy = notificationCopy(notification)
                const unread = !notification.readAt
                const navigate = notification.kind !== 'calendar.event.deleted'
                return (
                  <View
                    key={notification.id}
                    style={[
                      styles.activityRow,
                      {
                        backgroundColor: unread ? tokens.accentSoft : 'transparent',
                        borderColor: tokens.line,
                      },
                    ]}
                  >
                    {unread ? (
                      <View
                        testID="activity-unread-dot"
                        style={[styles.unreadDot, { backgroundColor: tokens.danger }]}
                      />
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${unread ? 'Unread. ' : ''}${copy.title}. ${copy.body}`}
                      onPress={() => onOpenActivity(notification, navigate)}
                      style={styles.activityCopy}
                    >
                      <Text
                        style={[
                          styles.title,
                          { color: unread ? tokens.ink : tokens.muted },
                          unread && styles.unreadTitle,
                        ]}
                      >
                        {copy.title}
                      </Text>
                      <Text style={[styles.body, { color: tokens.muted }]}>{copy.body}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove activity"
                      onPress={() => onRemove(notification)}
                      hitSlop={6}
                    >
                      <Text style={[styles.remove, { color: tokens.muted }]}>Remove</Text>
                    </Pressable>
                  </View>
                )
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <ConfirmDialog
        open={confirmingClear}
        onOpenChange={setConfirmingClear}
        title="Clear all activity?"
        description="This permanently removes all Schedule activity."
        confirmLabel="Clear all"
        onConfirm={() => {
          setConfirmingClear(false)
          onClear()
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  popover: {
    position: 'absolute',
    right: 20,
    left: 44,
    maxHeight: 460,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  heading: { fontSize: 16, fontWeight: '800' },
  clear: { fontSize: 13, fontWeight: '700' },
  state: { textAlign: 'center', paddingVertical: 28, fontSize: 14 },
  activityRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  activityCopy: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  unreadTitle: { fontWeight: '800' },
  body: { fontSize: 12.5, marginTop: 3 },
  remove: { fontSize: 12, fontWeight: '700' },
})
