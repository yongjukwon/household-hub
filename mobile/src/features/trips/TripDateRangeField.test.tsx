import { fireEvent, render } from '@testing-library/react-native'

import { TripDateRangeField } from './TripDateRangeField'

describe('TripDateRangeField', () => {
  it('selects a cross-month range from one calendar and commits with Done', async () => {
    const onChange = jest.fn()
    const view = await render(
      <TripDateRangeField
        startDate="2026-07-26"
        endDate="2026-07-27"
        onChange={onChange}
      />,
    )

    expect(view.getByText('Jul 26, 2026 – Jul 27, 2026')).toBeOnTheScreen()

    await fireEvent.press(view.getByLabelText('Trip dates'))
    expect(view.getByText('July 2026')).toBeOnTheScreen()

    await fireEvent.press(view.getByLabelText('Select July 30, 2026'))
    expect(view.getByRole('button', { name: 'Done' })).toBeDisabled()

    await fireEvent.press(view.getByLabelText('Next month'))
    expect(view.getByText('August 2026')).toBeOnTheScreen()
    await fireEvent.press(view.getByLabelText('Select August 2, 2026'))
    await fireEvent.press(view.getByRole('button', { name: 'Done' }))

    expect(onChange).toHaveBeenCalledWith({
      startDate: '2026-07-30',
      endDate: '2026-08-02',
    })
  })

  it('discards a draft range when Cancel is pressed', async () => {
    const onChange = jest.fn()
    const view = await render(
      <TripDateRangeField
        startDate="2026-07-26"
        endDate="2026-07-27"
        onChange={onChange}
      />,
    )

    await fireEvent.press(view.getByLabelText('Trip dates'))
    await fireEvent.press(view.getByLabelText('Select July 30, 2026'))
    await fireEvent.press(view.getByRole('button', { name: 'Cancel' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(view.queryByText('July 2026')).not.toBeOnTheScreen()
  })
})
