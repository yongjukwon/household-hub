import { render, screen } from '@testing-library/react-native'

import { RestrictedEditor } from './RestrictedEditor'

const mockEditor = {
  getJSON: jest.fn().mockResolvedValue({ type: 'doc', content: [] }),
  setPlaceholder: jest.fn(),
  toggleHeading: jest.fn(),
  toggleBulletList: jest.fn(),
  toggleOrderedList: jest.fn(),
  toggleTaskList: jest.fn(),
  undo: jest.fn(),
  redo: jest.fn(),
}

jest.mock('@10play/tentap-editor', () => ({
  BulletListBridge: {},
  CoreBridge: {},
  HardBreakBridge: {},
  HeadingBridge: { configureExtension: () => ({}) },
  HistoryBridge: {},
  ListItemBridge: {},
  OrderedListBridge: {},
  PlaceholderBridge: {},
  RichText: () => null,
  TaskListBridge: {},
  useBridgeState: () => ({
    headingLevel: null,
    isBulletListActive: false,
    isOrderedListActive: false,
    isTaskListActive: false,
    canUndo: true,
    canRedo: true,
  }),
  useEditorBridge: () => mockEditor,
}))

describe('RestrictedEditor', () => {
  it('uses a compact horizontal format toolbar above the editor', async () => {
    await render(
      <RestrictedEditor
        content={{ type: 'doc', content: [] }}
        onChange={jest.fn()}
      />,
    )

    const toolbar = screen.getByTestId('note-format-toolbar')
    expect(toolbar.props.horizontal).toBe(true)
    expect(screen.getByLabelText('Body')).toBeOnTheScreen()
    expect(screen.getByLabelText('Checklist')).toBeOnTheScreen()
    expect(screen.getByLabelText('Undo')).toBeOnTheScreen()
    expect(screen.getByLabelText('Heading 1').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ height: 44 })]),
    )
  })
})
