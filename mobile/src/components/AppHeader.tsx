import { BlurView } from 'expo-blur'
import { usePathname, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/theme/tokens'
import { useAppChromeConfiguration } from './AppChrome'
import {
  backDestinationForPath,
  titleForPath,
} from './appHeaderTitle'
import { BellIcon, ChartBarIcon, ChevronLeftIcon, PencilIcon, PlusIcon } from './icons'

/**
 * Persistent header around tab routes. Each screen registers its centered
 * title and only the actions that make sense in its current state.
 */
export function AppHeader({
  hasUnreadActivity = false,
  onNotificationsPress,
}: {
  hasUnreadActivity?: boolean
  onNotificationsPress?: () => void
} = {}) {
  const { tokens, scheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const backDestination = backDestinationForPath(pathname)
  const registered = useAppChromeConfiguration()
  const chrome = registered ?? {
    mode: backDestination ? 'detail' as const : 'root' as const,
    title: titleForPath(pathname),
    showNotifications: pathname === '/',
  }

  const back = chrome.onBack ?? (backDestination
    ? () => router.replace(backDestination.path)
    : undefined)

  return (
    <View
      style={[
        styles.row,
        { paddingTop: insets.top + 6, backgroundColor: 'transparent' },
      ]}
    >
      <View
        testID="app-header-title-layer"
        pointerEvents={typeof chrome.title === 'string' && !(chrome.mode === 'detail' && chrome.onEdit) ? 'none' : 'auto'}
        style={styles.titleLayer}
      >
        {typeof chrome.title === 'string' ? (
          chrome.mode === 'detail' && chrome.onEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit"
              onPress={chrome.onEdit}
              style={styles.titleWithEdit}
            >
              <Text accessibilityRole="header" style={[styles.title, { color: tokens.ink }]} numberOfLines={1}>
                {chrome.title}
              </Text>
              <PencilIcon size={16} color={tokens.muted} />
            </Pressable>
          ) : (
            <Text accessibilityRole="header" style={[styles.title, { color: tokens.ink }]}>
              {chrome.title}
            </Text>
          )
        ) : (
          <View accessibilityRole="header" style={styles.titleEditor}>
            {chrome.title}
          </View>
        )}
      </View>
      {chrome.mode === 'editing' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          disabled={!chrome.onCancel}
          onPress={chrome.onCancel}
          style={styles.textAction}
        >
          <Text style={[styles.textActionLabel, { color: tokens.muted }]}>Cancel</Text>
        </Pressable>
      ) : backDestination && back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backDestination.label}
          hitSlop={4}
          onPress={back}
        >
          <BlurView
            intensity={30}
            tint={scheme}
            style={[
              styles.iconButton,
              {
                backgroundColor: tokens.glass.fill,
                borderColor: tokens.glass.border,
                borderWidth: 1,
              },
            ]}
          >
            <ChevronLeftIcon size={18} color={tokens.muted} />
          </BlurView>
        </Pressable>
      ) : (
        <View style={styles.leftSpacer} />
      )}
      <View style={styles.actions}>
        {chrome.mode === 'root' && chrome.showNotifications ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={onNotificationsPress}
          >
            <BlurView
              intensity={30}
              tint={scheme}
              style={[
                styles.iconButton,
                {
                  backgroundColor: tokens.glass.fill,
                  borderColor: tokens.glass.border,
                  borderWidth: 1,
                },
              ]}
            >
              <BellIcon size={18} color={tokens.muted} />
              {hasUnreadActivity ? (
                <View
                  testID="notification-unread-indicator"
                  style={[styles.unreadDot, { backgroundColor: tokens.danger }]}
                />
              ) : null}
            </BlurView>
          </Pressable>
        ) : null}
        {chrome.mode === 'root' && chrome.onHistory ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Purchase history" onPress={chrome.onHistory}>
            <BlurView
              intensity={30}
              tint={scheme}
              style={[
                styles.iconButton,
                {
                  backgroundColor: tokens.glass.fill,
                  borderColor: tokens.glass.border,
                  borderWidth: 1,
                },
              ]}
            >
              <ChartBarIcon size={18} color={tokens.muted} />
            </BlurView>
          </Pressable>
        ) : null}
        {chrome.mode === 'root' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add"
            disabled={!chrome.onAdd && registered !== null}
            onPress={chrome.onAdd}
            style={[styles.addButton, { backgroundColor: tokens.accent }]}
          >
            <PlusIcon size={18} color={tokens.accentContrast} />
          </Pressable>
        ) : chrome.mode === 'detail' && chrome.onHistory ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Purchase history" onPress={chrome.onHistory}>
            <BlurView
              intensity={30}
              tint={scheme}
              style={[
                styles.iconButton,
                {
                  backgroundColor: tokens.glass.fill,
                  borderColor: tokens.glass.border,
                  borderWidth: 1,
                },
              ]}
            >
              <ChartBarIcon size={18} color={tokens.muted} />
            </BlurView>
          </Pressable>
        ) : chrome.mode === 'editing' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save"
            disabled={chrome.saveDisabled || !chrome.onSave}
            onPress={chrome.onSave}
            style={styles.textAction}
          >
            <Text style={[styles.textActionLabel, { color: tokens.accent }]}>Save</Text>
          </Pressable>
        ) : <View style={styles.rightSpacer} />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  titleLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 6,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },
  titleWithEdit: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '80%' },
  titleEditor: { alignSelf: 'stretch', alignItems: 'center' },
  leftSpacer: { width: 36, height: 36 },
  rightSpacer: { width: 36, height: 36 },
  actions: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // BlurView doesn't clip its own blur content to borderRadius without
    // this — without it the blur renders as a squared-off ghost rectangle
    // behind the rounded button. No shadow here, so no masksToBounds
    // tradeoff to worry about (see Card.tsx for that case).
    overflow: 'hidden',
  },
  unreadDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textAction: { minWidth: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  textActionLabel: { fontSize: 15, fontWeight: '700' },
})
