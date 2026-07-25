import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/shell/ui/states'

describe('shell state components', () => {
  it('LoadingState announces status', () => {
    render(<LoadingState label="Loading trips…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading trips…')
  })

  it('EmptyState shows title, hint, and action', () => {
    render(
      <EmptyState
        title="No trips yet"
        hint="Add your first trip."
        action={<button type="button">Add trip</button>}
      />,
    )
    expect(screen.getByText('No trips yet')).toBeInTheDocument()
    expect(screen.getByText('Add your first trip.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add trip' })).toBeInTheDocument()
  })

  it('ErrorState is an alert and retries on click', () => {
    const onRetry = vi.fn()
    render(<ErrorState message="Could not load." onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
