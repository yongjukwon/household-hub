import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { NAV_ITEMS } from '@/components/layout/nav-items'
import { setupQueryPersistence } from '@/lib/offline/queryPersister'
import LoginPage from '@/routes/LoginPage'
import HomePage from '@/routes/HomePage'
import SectionListPage from '@/routes/SectionListPage'
import PageView from '@/routes/PageView'
import SettingsPage from '@/routes/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Offline reads come from the IndexedDB-persisted cache (maxAge
      // Infinity); gcTime must outlast it or restored entries would be
      // garbage-collected right back out of memory.
      gcTime: Infinity,
    },
  },
})

setupQueryPersistence(queryClient)

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { path: '/', element: <HomePage /> },
      ...NAV_ITEMS.map((navItem) => ({
        path: navItem.path,
        element: <SectionListPage navItem={navItem} />,
      })),
      { path: '/:section/:pageId', element: <PageView /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
])

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
