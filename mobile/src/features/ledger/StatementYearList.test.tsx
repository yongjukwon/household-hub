import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { StatementYearList } from './StatementYearList'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('@/components/BottomSheet', () => {
  const { Text, View } = jest.requireActual('react-native')
  return {
    BottomSheet: ({
      open,
      title,
      children,
    }: {
      open: boolean
      title: string
      children: React.ReactNode
    }) =>
      open ? (
        <View>
          <Text>{title}</Text>
          {children}
        </View>
      ) : null,
  }
})

jest.mock('./StatementYearSummary', () => {
  const { Text } = jest.requireActual('react-native')
  return {
    StatementYearSummary: () => <Text>Annual report</Text>,
  }
})

describe('StatementYearList', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('keeps Budget navigation separate from report and deletion actions', async () => {
    const year = {
      id: '11111111-1111-4111-8111-111111111111',
      year: 2026,
      revision: 1,
    }
    const view = await render(
      <StatementYearList householdId="household" years={[year]} />,
    )

    await fireEvent.press(view.getByLabelText('Show 2026 report'))
    expect(mockPush).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(view.getByText('Annual report')).toBeTruthy()
    })

    await fireEvent.press(view.getByLabelText('Delete 2026 statement'))
    expect(mockPush).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(view.getByText('Delete 2026?')).toBeTruthy()
    })

    await fireEvent.press(view.getByLabelText('Open 2026 budget'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/ledger/[yearId]',
      params: { yearId: year.id },
    })
  })
})
