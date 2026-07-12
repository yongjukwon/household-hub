import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TimeSelect } from '@/components/common/TimeSelect'

function renderTimeSelect(value = '') {
  const onChange = vi.fn()
  render(
    <TimeSelect
      value={value}
      onChange={onChange}
      hourLabel="Hour"
      minuteLabel="Minute"
    />,
  )
  return onChange
}

describe('TimeSelect (24-hour, no AM/PM)', () => {
  it('offers 24 hours and 60 minutes with no AM/PM option', () => {
    renderTimeSelect()
    const hour = screen.getByLabelText('Hour') as HTMLSelectElement
    const minute = screen.getByLabelText('Minute') as HTMLSelectElement
    // 24 hours + an empty option; 60 minutes + an empty option.
    expect(hour.options).toHaveLength(25)
    expect(minute.options).toHaveLength(61)
    expect(hour.textContent).not.toMatch(/AM|PM/i)
    // Hours are zero-padded 24-hour values.
    expect([...hour.options].map((o) => o.value)).toContain('23')
  })

  it('reflects an existing HH:MM value in the two selects', () => {
    renderTimeSelect('17:05')
    expect((screen.getByLabelText('Hour') as HTMLSelectElement).value).toBe('17')
    expect((screen.getByLabelText('Minute') as HTMLSelectElement).value).toBe(
      '05',
    )
  })

  it('emits HH:MM, defaulting the minute to 00 when only the hour is picked', async () => {
    const user = userEvent.setup()
    const onChange = renderTimeSelect()
    await user.selectOptions(screen.getByLabelText('Hour'), '09')
    expect(onChange).toHaveBeenLastCalledWith('09:00')
  })

  it('clears the time when the hour is set back to empty', async () => {
    const user = userEvent.setup()
    const onChange = renderTimeSelect('09:30')
    await user.selectOptions(screen.getByLabelText('Hour'), '')
    expect(onChange).toHaveBeenLastCalledWith('')
  })
})
