import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JSONContent } from '@tiptap/react'
import { RichTextEditor } from '@/components/notes/RichTextEditor'

function docWithText(text: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  }
}

describe('RichTextEditor', () => {
  it('renders the provided initial JSON content', () => {
    render(
      <RichTextEditor
        content={docWithText('Hello household')}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Hello household')).toBeInTheDocument()
  })

  describe('debounced onChange', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('does not fire onChange immediately, then fires once after the 800ms window with the updated doc', () => {
      const onChange = vi.fn()
      render(
        <RichTextEditor content={docWithText('Hello')} onChange={onChange} />,
      )

      // Editor content changes via a real UI interaction (the checklist
      // toggle), the same path a keystroke would take through onUpdate.
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Checklist' }))
      })

      expect(onChange).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(799)
      })
      expect(onChange).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(1)
      })

      expect(onChange).toHaveBeenCalledTimes(1)
      const doc = onChange.mock.calls[0][0] as JSONContent
      expect(JSON.stringify(doc)).toContain('taskList')
    })

    it('flushes a pending debounced change on unmount instead of dropping it', () => {
      const onChange = vi.fn()
      const { unmount } = render(
        <RichTextEditor content={docWithText('Hello')} onChange={onChange} />,
      )

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Checklist' }))
      })

      // Well within the 800ms window — nothing has fired yet.
      expect(onChange).not.toHaveBeenCalled()

      unmount()

      expect(onChange).toHaveBeenCalledTimes(1)
      const doc = onChange.mock.calls[0][0] as JSONContent
      expect(JSON.stringify(doc)).toContain('taskList')
    })
  })

  it('renders stored links as clickable anchors that open in a new tab', () => {
    const docWithLink: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
              text: 'a link',
            },
          ],
        },
      ],
    }
    render(<RichTextEditor content={docWithLink} onChange={vi.fn()} />)

    const anchor = document.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor).toHaveAttribute('href', 'https://example.com')
    expect(anchor).toHaveAttribute('target', '_blank')
    expect(anchor).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  describe('external content re-sync (realtime)', () => {
    it('applies a changed content prop while the editor is idle, without firing onChange', () => {
      const onChange = vi.fn()
      const { rerender } = render(
        <RichTextEditor content={docWithText('Original')} onChange={onChange} />,
      )

      act(() => {
        rerender(
          <RichTextEditor
            content={docWithText('Partner edit')}
            onChange={onChange}
          />,
        )
      })

      expect(screen.getByText('Partner edit')).toBeInTheDocument()
      expect(screen.queryByText('Original')).not.toBeInTheDocument()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('does not clobber the editor while it is focused', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const { rerender } = render(
        <RichTextEditor content={docWithText('My draft')} onChange={onChange} />,
      )

      const editable = document.querySelector('.tiptap') as HTMLElement
      await user.click(editable)

      act(() => {
        rerender(
          <RichTextEditor
            content={docWithText('Remote overwrite')}
            onChange={onChange}
          />,
        )
      })

      expect(screen.getByText('My draft')).toBeInTheDocument()
      expect(screen.queryByText('Remote overwrite')).not.toBeInTheDocument()
    })
  })

  describe('markdown input rules', () => {
    // This app is explicitly click/tap-toolbar-only (bullet/blockquote
    // have no toolbar escape) — StarterKit's Markdown input rules must be
    // disabled so typing "# ", "**x**", "- ", "> " doesn't silently format
    // text the user only meant to type literally.
    it('typing "# " at the start of the doc stays a plain paragraph, not a heading', async () => {
      const user = userEvent.setup()
      const emptyDoc: JSONContent = {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      }
      render(<RichTextEditor content={emptyDoc} onChange={vi.fn()} />)

      const editable = document.querySelector('.tiptap') as HTMLElement
      await user.click(editable)
      await user.type(editable, '# ')

      expect(document.querySelector('h1')).toBeNull()
      expect(editable.querySelector('p')).toHaveTextContent('#')
    })
  })
})
