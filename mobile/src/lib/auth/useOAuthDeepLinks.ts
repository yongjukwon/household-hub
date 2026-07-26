import * as Linking from 'expo-linking'
import { useEffect } from 'react'

import { exchangeCallbackUrl } from './oauth'

/**
 * Completes an OAuth sign-in when the provider redirects back through
 * `householdhub://auth/callback`. Handles both a cold start (app launched by the
 * link) and a warm redirect (app already open). Non-auth deep links parse to no
 * code and are ignored, so this is safe to always mount at the root.
 */
export function useOAuthDeepLinks(): void {
  useEffect(() => {
    let active = true

    Linking.getInitialURL().then((url) => {
      if (active && url) void exchangeCallbackUrl(url)
    })

    const sub = Linking.addEventListener('url', ({ url }) => {
      void exchangeCallbackUrl(url)
    })

    return () => {
      active = false
      sub.remove()
    }
  }, [])
}
