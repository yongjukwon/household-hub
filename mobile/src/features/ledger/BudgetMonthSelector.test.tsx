import {
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import {
  BUDGET_MONTH_NAVIGATOR_HEIGHT,
  BudgetMonthSelector,
} from './BudgetMonthSelector'

describe('BudgetMonthSelector', () => {
  it('stops at year boundaries and opens all months on demand', async () => {
    const onChange = jest.fn()
    const view = await render(
      <BudgetMonthSelector month={1} onChange={onChange} />,
    )

    expect(view.getByLabelText('Previous month')).toBeDisabled()
    await fireEvent.press(view.getByLabelText('Next month'))
    expect(onChange).toHaveBeenCalledWith(2)

    await view.rerender(
      <BudgetMonthSelector month={12} onChange={onChange} />,
    )
    expect(view.getByLabelText('Next month')).toBeDisabled()

    await view.rerender(
      <BudgetMonthSelector month={7} onChange={onChange} />,
    )
    expect(view.queryByLabelText('Choose January')).toBeNull()
    await fireEvent.press(view.getByLabelText('Choose month, July selected'))
    await waitFor(() => {
      expect(view.getByLabelText('Choose January')).toBeTruthy()
    })

    await fireEvent.press(view.getByLabelText('Choose January'))
    expect(onChange).toHaveBeenCalledWith(1)
    await waitFor(() => {
      expect(view.queryByLabelText('Choose February')).toBeNull()
    })
  })

  it('uses a compact card without shrinking navigation touch targets', async () => {
    const view = await render(
      <BudgetMonthSelector month={7} onChange={jest.fn()} />,
    )

    expect(BUDGET_MONTH_NAVIGATOR_HEIGHT).toBe(48)
    for (const label of [
      'Previous month',
      'Choose month, July selected',
      'Next month',
    ]) {
      const control = view.getByLabelText(label)
      const style = StyleSheet.flatten(control.props.style)
      expect(style.height ?? style.minHeight).toBeGreaterThanOrEqual(44)
    }
  })
})
