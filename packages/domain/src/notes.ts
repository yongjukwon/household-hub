import { isRecord } from './validation'

export type RichNoteDocument = {
  type: 'doc'
  content?: RichNoteNode[]
}

export type RichNoteNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: RichNoteNode[]
  text?: string
}

/** Validates the deliberately small TenTap document subset shared by both clients. */
export function isRichNoteJson(value: unknown): value is RichNoteDocument {
  return isNode(value, 'doc')
}

function isNode(value: unknown, expectedType?: string): value is RichNoteNode {
  if (!isRecord(value) || typeof value.type !== 'string') return false
  if (expectedType && value.type !== expectedType) return false
  if ('marks' in value || !hasOnlyNodeFields(value)) return false

  switch (value.type) {
    case 'doc':
      return isContent(value.content, isBlockNode)
    case 'paragraph':
      return value.content === undefined || isContent(value.content, isInlineNode)
    case 'text':
      return typeof value.text === 'string' && value.text.length > 0
    case 'hardBreak':
      return true
    case 'heading':
      return (
        isRecord(value.attrs) &&
        hasOnlyKeys(value.attrs, ['level']) &&
        (value.attrs.level === 1 || value.attrs.level === 2 || value.attrs.level === 3) &&
        (value.content === undefined || isContent(value.content, isInlineNode))
      )
    case 'bulletList':
    case 'orderedList':
      return isContent(value.content, (node) => isNode(node, 'listItem'))
    case 'taskList':
      return isContent(value.content, (node) => isNode(node, 'taskItem'))
    case 'listItem':
    case 'taskItem':
      return (
        (value.type !== 'taskItem' ||
          (isRecord(value.attrs) &&
            hasOnlyKeys(value.attrs, ['checked']) &&
            typeof value.attrs.checked === 'boolean')) &&
        isContent(value.content, isListItemChild)
      )
    default:
      return false
  }
}

function isContent(
  value: unknown,
  predicate: (node: unknown) => boolean,
): value is RichNoteNode[] {
  return Array.isArray(value) && value.every(predicate)
}

function isInlineNode(node: unknown): boolean {
  return isNode(node, 'text') || isNode(node, 'hardBreak')
}

function isBlockNode(node: unknown): boolean {
  return (
    isNode(node, 'paragraph') ||
    isNode(node, 'heading') ||
    isNode(node, 'bulletList') ||
    isNode(node, 'orderedList') ||
    isNode(node, 'taskList')
  )
}

function isListItemChild(node: unknown): boolean {
  return isBlockNode(node)
}

function hasOnlyNodeFields(value: Record<string, unknown>): boolean {
  return hasOnlyKeys(value, ['type', 'attrs', 'content', 'text'])
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key))
}
