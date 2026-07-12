import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditableTitle } from '@/components/pages/EditableTitle'
import type { PageRow } from '@/hooks/usePages'
import { mockFrom, mockFromResult, resetSupabaseMocks } from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

const page: PageRow = {
  id: 'page-1',
  household_id: 'household-1',
  section: 'notes',
  template: 'blank',
  title: 'Groceries',
  content: { type: 'doc', content: [] },
  created_by: 'user-1',
  archived: false,
  start_date: null,
  end_date: null,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
}

function renderTitle() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <EditableTitle page={page} />
    </QueryClientProvider>,
  )
}

describe('EditableTitle', () => {
  beforeEach(resetSupabaseMocks)

  it('renders the title as a heading', () => {
    renderTitle()
    expect(
      screen.getByRole('heading', { name: 'Groceries' }),
    ).toBeInTheDocument()
  })

  it('edits and saves the title on Enter', async () => {
    const builder = mockFromResult({ ...page, title: 'Costco' })
    const user = userEvent.setup()
    renderTitle()

    await user.click(screen.getByRole('button', { name: 'Groceries' }))
    const input = screen.getByRole('textbox', { name: 'Page title' })
    await user.clear(input)
    await user.type(input, 'Costco{Enter}')

    await waitFor(() =>
      expect(builder.update).toHaveBeenCalledWith({ title: 'Costco' }),
    )
    expect(builder.eq).toHaveBeenCalledWith('id', 'page-1')
  })

  it('cancels on Escape without saving', async () => {
    const user = userEvent.setup()
    renderTitle()

    await user.click(screen.getByRole('button', { name: 'Groceries' }))
    const input = screen.getByRole('textbox', { name: 'Page title' })
    await user.clear(input)
    await user.type(input, 'Discarded{Escape}')

    expect(
      screen.getByRole('heading', { name: 'Groceries' }),
    ).toBeInTheDocument()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('does not save a blank or unchanged title', async () => {
    const user = userEvent.setup()
    renderTitle()

    await user.click(screen.getByRole('button', { name: 'Groceries' }))
    const input = screen.getByRole('textbox', { name: 'Page title' })
    await user.clear(input)
    await user.type(input, '   {Enter}')

    expect(mockFrom).not.toHaveBeenCalled()
    expect(
      screen.getByRole('heading', { name: 'Groceries' }),
    ).toBeInTheDocument()
  })
})
