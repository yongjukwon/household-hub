import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Navigate,
  createBrowserRouter,
  RouterProvider,
} from 'react-router-dom'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { AppShell } from '@/shell/AppShell'
import { PlaceholderScreen } from '@/shell/PlaceholderScreen'
import { CalendarScreen } from '@/features/calendar/CalendarScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { setupQueryPersistence } from '@/lib/offline/queryPersister'
import LoginPage from '@/routes/LoginPage'

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

// Mobile-first shell (Task 5). Calendar is the default destination; there is no
// Home. Feature screens are placeholders until Task 6 fills them; the legacy
// page-based screens remain in the tree, unrouted, until Task 6 retires them.
const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/calendar" replace /> },
      { path: '/calendar', element: <CalendarScreen /> },
      { path: '/groceries', element: <PlaceholderScreen title="Groceries" /> },
      { path: '/ledger', element: <PlaceholderScreen title="Ledger" /> },
      { path: '/notes', element: <PlaceholderScreen title="Notes" /> },
      { path: '/trips', element: <PlaceholderScreen title="Trips" /> },
      {
        path: '/notifications',
        element: <PlaceholderScreen title="Notifications" />,
      },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '*', element: <Navigate to="/calendar" replace /> },
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
