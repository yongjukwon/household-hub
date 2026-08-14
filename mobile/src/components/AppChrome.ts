import {
  createContext,
  useContext,
  useLayoutEffect,
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

export const AppChromeStateContext = createContext<AppChromeConfiguration | null>(null)
export const AppChromeRegistrationContext = createContext<
  (configuration: AppChromeConfiguration | null) => void
>(() => undefined)

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
