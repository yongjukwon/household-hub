import { act, fireEvent, render, screen } from '@testing-library/react'
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
})
