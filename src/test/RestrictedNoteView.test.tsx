import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RichNoteDocument } from '@household-hub/domain'
import { RestrictedNoteView } from '@/features/notes/RestrictedNoteView'

describe('RestrictedNoteView', () => {
  it('renders headings, paragraphs, bullet and numbered lists', () => {
    const document: RichNoteDocument = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Before we leave' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Remember passports.' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Chargers' }] }] }] },
        { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Check in' }] }] }] },
      ],
    }
    const { container } = render(<RestrictedNoteView document={document} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Before we leave' })).toBeInTheDocument()
    expect(screen.getByText('Remember passports.')).toBeInTheDocument()
    expect(container.querySelector('ul')).toHaveTextContent('Chargers')
    expect(container.querySelector('ol')).toHaveTextContent('Check in')
  })

  it('renders checked and unchecked checklist items semantically', () => {
    render(
      <RestrictedNoteView
        document={{
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [
              { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Passport' }] }] },
              { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Insurance' }] }] },
            ],
          }],
        }}
      />,
    )
    expect(screen.getByRole('checkbox', { name: 'Passport' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Insurance' })).toBeChecked()
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).toBeDisabled()
    }
  })

  it('renders empty and unknown content safely', () => {
    const { container } = render(
      <RestrictedNoteView
        document={{
          type: 'doc',
          content: [
            { type: 'paragraph' },
            { type: 'unsupported', content: [{ type: 'text', text: 'Hidden' }] },
          ],
        }}
      />,
    )
    expect(container).toHaveTextContent('')
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
  })
})
