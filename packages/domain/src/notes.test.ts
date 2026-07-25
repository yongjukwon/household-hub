import { describe, expect, it } from 'vitest'
import { isRichNoteJson } from './index'

describe('isRichNoteJson', () => {
  it('accepts the restricted TenTap-compatible note document', () => {
    expect(
      isRichNoteJson({
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Packing' }],
          },
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Passport' }] },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(true)
  })

  it('rejects links, images, marks, and unsupported heading levels', () => {
    expect(
      isRichNoteJson({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'click', marks: [{ type: 'link' }] }],
          },
        ],
      }),
    ).toBe(false)
    expect(isRichNoteJson({ type: 'doc', content: [{ type: 'image' }] })).toBe(false)
    expect(
      isRichNoteJson({
        type: 'doc',
        content: [{ type: 'heading', attrs: { level: 4 } }],
      }),
    ).toBe(false)
  })
})
