import NetInfo from '@react-native-community/netinfo'

/**
 * Whether the device currently has a usable connection. `isInternetReachable`
 * is often `null` (unknown) right after a transition, so we only treat an
 * explicit `false` as offline — a hidden network drop surfaces as a transport
 * failure that stops the flush, not as a silently skipped command.
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch()
  return state.isConnected !== false && state.isInternetReachable !== false
}

/** Subscribes to reconnects; returns an unsubscribe. */
export function onReconnect(handler: () => void): () => void {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) handler()
  })
}
