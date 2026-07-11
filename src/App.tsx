import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import LoginPage from '@/routes/LoginPage'
import HomePage from '@/routes/HomePage'
import SectionListPage from '@/routes/SectionListPage'
import SettingsPage from '@/routes/SettingsPage'

const queryClient = new QueryClient()

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
      { path: '/budget', element: <SectionListPage title="Budget" /> },
      { path: '/trips', element: <SectionListPage title="Trips" /> },
      { path: '/groceries', element: <SectionListPage title="Groceries" /> },
      { path: '/notes', element: <SectionListPage title="Notes" /> },
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
