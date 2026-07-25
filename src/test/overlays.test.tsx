import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'

describe('BottomSheet', () => {
  it('renders its title and content when open', () => {
    render(
      <BottomSheet open onOpenChange={() => {}} title="Add item">
        <p>Sheet body</p>
      </BottomSheet>,
    )
    expect(screen.getByText('Add item')).toBeInTheDocument()
    expect(screen.getByText('Sheet body')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(
      <BottomSheet open={false} onOpenChange={() => {}} title="Add item">
        <p>Sheet body</p>
      </BottomSheet>,
    )
    expect(screen.queryByText('Sheet body')).not.toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  it('shows the prompt and fires onConfirm from the destructive action', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete note?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={onConfirm}
      />,
    )
    expect(screen.getByText('Delete note?')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
