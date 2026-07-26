import { render } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import NoteScreen from '../../../app/(tabs)/notes/[noteId]'
import { useActiveHousehold } from '@/features/household'
import { useNote } from './data'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    noteId: '22222222-2222-4222-8222-222222222222',
  }),
  useRouter: () => ({ replace: jest.fn() }),
}))

jest.mock('@/features/household', () => ({
  useActiveHousehold: jest.fn(),
}))

jest.mock('./data', () => {
  const actual = jest.requireActual('./data')
  return {
    ...actual,
    useNote: jest.fn(),
  }
})

jest.mock('./RestrictedEditor', () => ({
  RestrictedEditor: () => null,
}))

jest.mock('./RestrictedNoteView', () => {
  const { Text } = jest.requireActual('react-native')
  return {
    RestrictedNoteView: () => <Text>Passports</Text>,
  }
})

const mockedHousehold = useActiveHousehold as jest.MockedFunction<
  typeof useActiveHousehold
>
const mockedNote = useNote as jest.MockedFunction<typeof useNote>

beforeEach(() => {
  mockedHousehold.mockReturnValue({
    data: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Rabbit and Penguin',
      members: [],
    },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
  mockedNote.mockReturnValue({
    data: {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Before we leave',
      document: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Passports' }] }],
      },
      revision: 1,
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useNote>)
})

describe('Note deletion controls', () => {
  it('uses the notes-index trash action instead of a detail-page Delete button', async () => {
    const view = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <NoteScreen />
      </SafeAreaProvider>,
    )

    expect(view.getByText('Edit')).toBeOnTheScreen()
    expect(view.queryByText('Delete')).toBeNull()
  })
})
