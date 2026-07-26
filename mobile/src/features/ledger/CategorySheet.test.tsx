import {
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { CategorySheet } from './CategorySheet'

const mockSaveCategory = jest.fn()
const mockSaveLimit = jest.fn()
const mockDeleteCategory = jest.fn()

jest.mock('./statementMutations', () => ({
  saveCategory: (...args: unknown[]) => mockSaveCategory(...args),
  saveLimit: (...args: unknown[]) => mockSaveLimit(...args),
  deleteCategory: (...args: unknown[]) => mockDeleteCategory(...args),
}))

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

const baseProps = {
  open: true,
  householdId: '11111111-1111-4111-8111-111111111111',
  yearId: '22222222-2222-4222-8222-222222222222',
  month: 7,
  existing: null,
  nextSortOrder: 0,
}

function discarded(explanation: string) {
  return {
    status: 'discarded',
    operationId: '33333333-3333-4333-8333-333333333333',
    discarded: { explanation },
  }
}

describe('CategorySheet operation outcomes', () => {
  beforeEach(() => {
    mockSaveCategory.mockReset()
    mockSaveLimit.mockReset()
    mockDeleteCategory.mockReset()
  })

  it('keeps the form open and shows a rejected category operation', async () => {
    mockSaveCategory.mockResolvedValue(
      discarded('Category name is not allowed'),
    )
    const onOpenChange = jest.fn()
    const view = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <CategorySheet {...baseProps} onOpenChange={onOpenChange} />
      </SafeAreaProvider>,
    )

    await fireEvent.changeText(view.getByLabelText('Name'), 'Food')
    await fireEvent.press(view.getByText('Save'))

    await waitFor(() => {
      expect(view.getByText('Category name is not allowed')).toBeTruthy()
    })
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('keeps the form open when the limit operation is rejected', async () => {
    mockSaveCategory.mockResolvedValue({
      status: 'queued',
      operationId: 'category',
    })
    mockSaveLimit.mockResolvedValue(
      discarded('Monthly limit was rejected'),
    )
    const onOpenChange = jest.fn()
    const view = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <CategorySheet {...baseProps} onOpenChange={onOpenChange} />
      </SafeAreaProvider>,
    )

    await fireEvent.changeText(view.getByLabelText('Name'), 'Food')
    await fireEvent.changeText(view.getByLabelText('Monthly limit'), '400')
    await fireEvent.press(view.getByText('Save'))

    await waitFor(() => {
      expect(view.getByText('Monthly limit was rejected')).toBeTruthy()
    })
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
