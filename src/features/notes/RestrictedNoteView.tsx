import { Fragment, type ReactNode } from 'react'
import type { RichNoteDocument, RichNoteNode } from '@household-hub/domain'
import './editor.css'

/** Read-only semantic renderer for the shared Tiptap/TenTap note subset. */
export function RestrictedNoteView({
  document,
}: {
  document: RichNoteDocument
}) {
  return (
    <div className="hh-note-content">
      <div className="tiptap">
        {document.content.map((node, index) => renderNode(node, `root-${index}`))}
      </div>
    </div>
  )
}

function renderChildren(node: RichNoteNode, key: string): ReactNode {
  return node.content?.map((child, index) =>
    renderNode(child, `${key}-${index}`),
  )
}

function plainText(node: RichNoteNode): string {
  if (node.type === 'text') return node.text ?? ''
  return node.content?.map(plainText).join('') ?? ''
}

function renderNode(node: RichNoteNode, key: string): ReactNode {
  switch (node.type) {
    case 'text':
      return <Fragment key={key}>{node.text}</Fragment>
    case 'hardBreak':
      return <br key={key} />
    case 'paragraph':
      return <p key={key}>{renderChildren(node, key)}</p>
    case 'heading': {
      const level =
        node.attrs?.level === 1 || node.attrs?.level === 2 ? node.attrs.level : 3
      if (level === 1) return <h1 key={key}>{renderChildren(node, key)}</h1>
      if (level === 2) return <h2 key={key}>{renderChildren(node, key)}</h2>
      return <h3 key={key}>{renderChildren(node, key)}</h3>
    }
    case 'bulletList':
      return <ul key={key}>{renderChildren(node, key)}</ul>
    case 'orderedList':
      return <ol key={key}>{renderChildren(node, key)}</ol>
    case 'listItem':
      return <li key={key}>{renderChildren(node, key)}</li>
    case 'taskList':
      return (
        <ul key={key} data-type="taskList">
          {renderChildren(node, key)}
        </ul>
      )
    case 'taskItem': {
      const checked = node.attrs?.checked === true
      const label = plainText(node)
      return (
        <li key={key} data-checked={checked}>
          <label>
            <input
              type="checkbox"
              checked={checked}
              disabled
              aria-label={label}
              readOnly
            />
          </label>
          <div>{renderChildren(node, key)}</div>
        </li>
      )
    }
    default:
      return null
  }
}
