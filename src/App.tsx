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
import { GroceriesScreen } from '@/features/groceries/GroceriesScreen'
import { GroceryListScreen } from '@/features/groceries/GroceryListScreen'
import { LedgerScreen } from '@/features/ledger/LedgerScreen'
import { StatementMonthScreen } from '@/features/ledger/StatementMonthScreen'
import { NotesScreen } from '@/features/notes/NotesScreen'
import { NoteScreen } from '@/features/notes/NoteScreen'
import { TripsScreen } from '@/features/trips/TripsScreen'
import { TripScreen } from '@/features/trips/TripScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
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
      { path: '/groceries', element: <GroceriesScreen /> },
      { path: '/groceries/:listId', element: <GroceryListScreen /> },
      { path: '/ledger', element: <LedgerScreen /> },
      { path: '/ledger/:yearId', element: <StatementMonthScreen /> },
      { path: '/notes', element: <NotesScreen /> },
      { path: '/notes/:noteId', element: <NoteScreen /> },
      { path: '/trips', element: <TripsScreen /> },
      { path: '/trips/:tripId', element: <TripScreen /> },
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
