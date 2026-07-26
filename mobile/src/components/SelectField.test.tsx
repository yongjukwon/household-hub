import { fireEvent, render, screen } from '@testing-library/react-native'
import { SelectField } from './SelectField'

describe('SelectField', () => {
  const options = [
    { value: '2025', label: '2025', disabled: true },
    { value: '2026', label: '2026' },
  ]

  it('opens a menu on tap instead of showing an always-visible wheel, and skips disabled options', async () => {
    const onChange = jest.fn()
    await render(<SelectField label="Year" value="2026" options={options} onChange={onChange} />)

    // closed: the disabled option's row isn't rendered yet
    expect(screen.queryByText('2025')).toBeNull()

    await fireEvent.press(screen.getByLabelText('Year'))
    // open: the disabled option's row is now visible (menu rendered)
    expect(screen.getByText('2025')).toBeTruthy()

    await fireEvent.press(screen.getByText('2025'))
    expect(onChange).not.toHaveBeenCalled()

    // '2026' appears both as the closed field's current value and as the open
    // menu's row for that option — the menu row is the one rendered second.
    const yearTwentySix = screen.getAllByText('2026')
    expect(yearTwentySix).toHaveLength(2)
    await fireEvent.press(yearTwentySix[1])
    expect(onChange).toHaveBeenCalledWith('2026')
  })
})
