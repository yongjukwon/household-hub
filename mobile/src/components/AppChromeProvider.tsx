import { useState, type ReactNode } from 'react'

import {
  AppChromeRegistrationContext,
  AppChromeStateContext,
  type AppChromeConfiguration,
} from './AppChrome'

/** Holds the one screen-owned header configuration visible around tab routes. */
export function AppChromeProvider({ children }: { children: ReactNode }) {
  const [configuration, setConfiguration] = useState<AppChromeConfiguration | null>(null)

  return (
    <AppChromeRegistrationContext.Provider value={setConfiguration}>
      <AppChromeStateContext.Provider value={configuration}>
        {children}
      </AppChromeStateContext.Provider>
    </AppChromeRegistrationContext.Provider>
  )
}
