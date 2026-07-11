import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  QueryClient,
  QueryClientProvider,
  type UseQueryResult,
} from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplatePicker } from '@/components/pages/TemplatePicker'
import { NAV_ITEMS } from '@/components/layout/nav-items'
import { mockFromResult, resetSupabaseMocks } from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

vi.mock('@/hooks/useHousehold', () => ({
  useHousehold: vi.fn(),
}))

import { useHousehold, type HouseholdData } from '@/hooks/useHousehold'
const mockUseHousehold = vi.mocked(useHousehold)

const notesItem = NAV_ITEMS.find((item) => item.section === 'notes')!

function renderPicker() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TemplatePicker open onOpenChange={vi.fn()} navItem={notesItem} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TemplatePicker', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    const household: HouseholdData = {
      id: 'household-1',
      name: 'Our Household',
      members: [],
    }
    // Only `.data` matters to useCreatePage; the rest of UseQueryResult is
    // irrelevant here, hence the cast.
    mockUseHousehold.mockReturnValue({
      data: household,
    } as UseQueryResult<HouseholdData>)
  })

  it('keeps the dialog open and shows an inline error when the create mutation fails', async () => {
    mockFromResult(null, new Error('insert blew up'))

    renderPicker()

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'My page' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/couldn.t create the page/i)
    // Dialog stayed open: the title field (with its value) is still there.
    expect(screen.getByLabelText('Title')).toHaveValue('My page')
  })

  it('clears the error on a successful retry', async () => {
    mockFromResult(null, new Error('insert blew up'))

    renderPicker()

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'My page' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await screen.findByRole('alert')

    mockFromResult({
      id: 'page-1',
      household_id: 'household-1',
      section: 'notes',
      template: 'blank',
      title: 'My page',
      content: { type: 'doc', content: [] },
      created_by: 'user-1',
      archived: false,
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-10T00:00:00.000Z',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
  })
})
