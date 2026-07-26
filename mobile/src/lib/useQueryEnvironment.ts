import NetInfo from '@react-native-community/netinfo'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppState } from 'react-native'

/** Connects React Query's pause/resume behavior to native connectivity/focus. */
export function useQueryEnvironment(): void {
  useEffect(
    () =>
      onlineManager.setEventListener((setOnline) =>
        NetInfo.addEventListener((state) => {
          setOnline(
            state.isConnected !== false &&
              state.isInternetReachable !== false,
          )
        }),
      ),
    [],
  )

  useEffect(
    () =>
      focusManager.setEventListener((setFocused) => {
        const subscription = AppState.addEventListener('change', (state) => {
          setFocused(state === 'active')
        })
        return () => subscription.remove()
      }),
    [],
  )
}
