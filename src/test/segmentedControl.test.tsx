import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl } from '@/shell/ui/SegmentedControl'

const options = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

describe('SegmentedControl', () => {
  it('is a labelled radiogroup with one checked radio', () => {
    render(
      <SegmentedControl
        label="Appearance"
        options={[...options]}
        value="dark"
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('radiogroup', { name: 'Appearance' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('calls onChange with the chosen value', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl
        label="Appearance"
        options={[...options]}
        value="system"
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }))
    expect(onChange).toHaveBeenCalledWith('light')
  })
})
