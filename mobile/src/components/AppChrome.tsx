import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react'

export type AppChromeMode = 'root' | 'detail' | 'editing'

export interface AppChromeConfiguration {
  mode: AppChromeMode
  title: ReactNode
  showNotifications?: boolean
  onAdd?: () => void
  onBack?: () => void
  onEdit?: () => void
  onCancel?: () => void
  onSave?: () => void
  saveDisabled?: boolean
}

const AppChromeStateContext = createContext<AppChromeConfiguration | null>(null)
const AppChromeRegistrationContext = createContext<
  (configuration: AppChromeConfiguration | null) => void
>(() => undefined)

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

/** Registers a route's centered title and the actions that belong in shared chrome. */
export function useAppChrome(configuration: AppChromeConfiguration): void {
  const register = useContext(AppChromeRegistrationContext)

  useLayoutEffect(() => {
    register(configuration)
    return () => register(null)
  }, [configuration, register])
}

export function useAppChromeConfiguration(): AppChromeConfiguration | null {
  return useContext(AppChromeStateContext)
}
