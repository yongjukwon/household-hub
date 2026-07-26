import { operationThrownError } from './outcome'

describe('operationThrownError', () => {
  it('turns an invalid revision failure into a recoverable synchronization message', () => {
    expect(
      operationThrownError(
        new Error('baseRevision must be a revision of at least 1, got undefined'),
        'Could not delete this item.',
      ),
    ).toBe('This item is out of date. Refresh it and try again.')
  })

  it('keeps a readable operation error message', () => {
    expect(
      operationThrownError(
        new Error('The network connection was lost.'),
        'Could not save.',
      ),
    ).toBe('The network connection was lost.')
  })

  it('uses the action-specific fallback for an unknown thrown value', () => {
    expect(operationThrownError({ status: 500 }, 'Could not save.')).toBe(
      'Could not save.',
    )
  })
})
