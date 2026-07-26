import {
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AssetSheet } from './AssetSheet'

const mockSaveAsset = jest.fn()
const mockDeleteAsset = jest.fn()

jest.mock('./assetMutations', () => ({
  saveAsset: (...args: unknown[]) => mockSaveAsset(...args),
  deleteAsset: (...args: unknown[]) => mockDeleteAsset(...args),
}))

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

describe('AssetSheet outcomes', () => {
  beforeEach(() => {
    mockSaveAsset.mockReset()
    mockDeleteAsset.mockReset()
  })

  it('reports accepted creation before closing', async () => {
    mockSaveAsset.mockResolvedValue({
      status: 'queued',
      operationId: 'asset',
    })
    const onSaved = jest.fn()
    const onOpenChange = jest.fn()
    const view = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AssetSheet
          open
          onOpenChange={onOpenChange}
          householdId="11111111-1111-4111-8111-111111111111"
          asset={null}
          sortOrder={0}
          onSaved={onSaved}
        />
      </SafeAreaProvider>,
    )

    await fireEvent.changeText(view.getByLabelText('Name'), 'Chequing')
    await fireEvent.press(view.getByText('Save'))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1)
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('keeps the form open when Asset creation is rejected', async () => {
    mockSaveAsset.mockResolvedValue({
      status: 'discarded',
      operationId: 'asset',
      discarded: { explanation: 'Asset could not be created' },
    })
    const onSaved = jest.fn()
    const onOpenChange = jest.fn()
    const view = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AssetSheet
          open
          onOpenChange={onOpenChange}
          householdId="11111111-1111-4111-8111-111111111111"
          asset={null}
          sortOrder={0}
          onSaved={onSaved}
        />
      </SafeAreaProvider>,
    )

    await fireEvent.changeText(view.getByLabelText('Name'), 'Chequing')
    await fireEvent.press(view.getByText('Save'))

    await waitFor(() => {
      expect(view.getByText('Asset could not be created')).toBeTruthy()
    })
    expect(onSaved).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('shows a thrown queue failure instead of leaving an unhandled promise', async () => {
    mockSaveAsset.mockRejectedValue(
      new Error('baseRevision must be a revision of at least 1, got undefined'),
    )
    const onOpenChange = jest.fn()
    const view = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AssetSheet
          open
          onOpenChange={onOpenChange}
          householdId="11111111-1111-4111-8111-111111111111"
          asset={null}
          sortOrder={0}
        />
      </SafeAreaProvider>,
    )

    await fireEvent.changeText(view.getByLabelText('Name'), 'Chequing')
    await fireEvent.press(view.getByText('Save'))

    await waitFor(() => {
      expect(
        view.getByText('This item is out of date. Refresh it and try again.'),
      ).toBeOnTheScreen()
    })
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
