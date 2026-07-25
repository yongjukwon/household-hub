import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EditableTitle } from '@/shell/ui/EditableTitle'

describe('EditableTitle', () => {
  it('activates editing and saves a trimmed title with Enter', async () => {
    const onSave = vi.fn().mockResolvedValue(null)
    render(
      <EditableTitle value="Costco" ariaLabel="List name" onSave={onSave} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'List name' }))
    const input = screen.getByRole('textbox', { name: 'List name' })
    await userEvent.clear(input)
    await userEvent.type(input, '  Market  {enter}')

    expect(onSave).toHaveBeenCalledWith('Market')
    expect(
      await screen.findByRole('button', { name: 'List name' }),
    ).toBeInTheDocument()
  })

  it('saves on blur', async () => {
    const onSave = vi.fn().mockResolvedValue(null)
    render(
      <div>
        <EditableTitle value="Costco" ariaLabel="List name" onSave={onSave} />
        <button type="button">Outside</button>
      </div>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'List name' }))
    const input = screen.getByRole('textbox', { name: 'List name' })
    await userEvent.clear(input)
    await userEvent.type(input, 'Market')
    await userEvent.click(screen.getByRole('button', { name: 'Outside' }))

    expect(onSave).toHaveBeenCalledWith('Market')
  })

  it('cancels with Escape without saving', async () => {
    const onSave = vi.fn().mockResolvedValue(null)
    render(
      <EditableTitle value="Costco" ariaLabel="List name" onSave={onSave} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'List name' }))
    await userEvent.type(
      screen.getByRole('textbox', { name: 'List name' }),
      ' changed{escape}',
    )

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Costco')).toBeInTheDocument()
  })

  it('rejects a blank title without calling save', async () => {
    const onSave = vi.fn().mockResolvedValue(null)
    render(
      <EditableTitle value="Costco" ariaLabel="List name" onSave={onSave} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'List name' }))
    const input = screen.getByRole('textbox', { name: 'List name' })
    await userEvent.clear(input)
    await userEvent.keyboard('{Enter}')

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Title cannot be blank')
  })

  it('disables controls while save is pending', async () => {
    let resolveSave!: (value: string | null) => void
    const onSave = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolveSave = resolve
        }),
    )
    render(
      <EditableTitle value="Costco" ariaLabel="List name" onSave={onSave} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'List name' }))
    await userEvent.type(
      screen.getByRole('textbox', { name: 'List name' }),
      ' Market',
    )
    await userEvent.keyboard('{Enter}')

    expect(screen.getByRole('textbox', { name: 'List name' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel title edit' })).toBeDisabled()
    resolveSave(null)
  })

  it('keeps editing and displays an onSave error', async () => {
    const onSave = vi.fn().mockResolvedValue('That name is already in use')
    render(
      <EditableTitle value="Costco" ariaLabel="List name" onSave={onSave} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'List name' }))
    await userEvent.type(
      screen.getByRole('textbox', { name: 'List name' }),
      ' Market',
    )
    await userEvent.keyboard('{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That name is already in use',
    )
    expect(screen.getByRole('textbox', { name: 'List name' })).toBeInTheDocument()
  })
})
