import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import {
  getStoredAppearance,
  persistAppearance,
  type Appearance,
} from '@/lib/appearance'

interface AppearanceContextValue {
  appearance: Appearance
  setAppearance: (next: Appearance) => void
}

const AppearanceContext = createContext<AppearanceContextValue>({
  appearance: 'system',
  setAppearance: () => {},
})

/** Loads the persisted Light/Dark/System choice and exposes it app-wide. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>('system')

  useEffect(() => {
    let active = true
    void getStoredAppearance().then((stored) => {
      if (active) setAppearanceState(stored)
    })
    return () => {
      active = false
    }
  }, [])

  function setAppearance(next: Appearance) {
    setAppearanceState(next)
    void persistAppearance(next)
  }

  return (
    <AppearanceContext.Provider value={{ appearance, setAppearance }}>
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance(): AppearanceContextValue {
  return useContext(AppearanceContext)
}
