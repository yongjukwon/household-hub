import type { RichNoteDocument, RichNoteNode } from '@household-hub/domain'
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { CheckIcon } from '@/components/icons'
import { useTheme } from '@/theme/tokens'

/** Read-only semantic renderer for the shared Tiptap/TenTap note subset. */
export function RestrictedNoteView({ document }: { document: RichNoteDocument }) {
  return (
    <View style={styles.root}>
      {document.content.map((node, index) => (
        <NodeView key={`root-${index}`} node={node} />
      ))}
    </View>
  )
}

function plainText(node: RichNoteNode): string {
  if (node.type === 'text') return node.text ?? ''
  return node.content?.map(plainText).join('') ?? ''
}

function Children({ node }: { node: RichNoteNode }): ReactNode {
  return node.content?.map((child, index) => <NodeView key={index} node={child} />)
}

function InlineChildren({ node }: { node: RichNoteNode }) {
  const { tokens } = useTheme()
  return (
    <Text style={[styles.paragraphText, { color: tokens.ink }]}>
      {node.content?.map((child, index) =>
        child.type === 'hardBreak' ? '\n' : child.text ?? '',
      )}
    </Text>
  )
}

function NodeView({ node }: { node: RichNoteNode }) {
  const { tokens } = useTheme()

  switch (node.type) {
    case 'paragraph':
      return node.content && node.content.length > 0 ? (
        <InlineChildren node={node} />
      ) : (
        <View style={styles.emptyParagraph} />
      )
    case 'heading': {
      const level = node.attrs?.level === 1 || node.attrs?.level === 2 ? node.attrs.level : 3
      const style =
        level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3
      return <Text style={[style, { color: tokens.ink }]}>{plainText(node)}</Text>
    }
    case 'bulletList':
      return (
        <View style={styles.list}>
          {node.content?.map((item, index) => (
            <View key={index} style={styles.listRow}>
              <Text style={[styles.bullet, { color: tokens.ink }]}>{'•'}</Text>
              <View style={styles.listContent}>
                <Children node={item} />
              </View>
            </View>
          ))}
        </View>
      )
    case 'orderedList':
      return (
        <View style={styles.list}>
          {node.content?.map((item, index) => (
            <View key={index} style={styles.listRow}>
              <Text style={[styles.bullet, { color: tokens.ink }]}>{index + 1}.</Text>
              <View style={styles.listContent}>
                <Children node={item} />
              </View>
            </View>
          ))}
        </View>
      )
    case 'taskList':
      return (
        <View style={styles.list}>
          {node.content?.map((item, index) => {
            const checked = item.attrs?.checked === true
            return (
              <View key={index} style={styles.listRow}>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: checked ? 'transparent' : tokens.line,
                      backgroundColor: checked ? tokens.accent : 'transparent',
                    },
                  ]}
                >
                  {checked ? <CheckIcon size={11} color="#FFFFFF" /> : null}
                </View>
                <View style={styles.listContent}>
                  <Children node={item} />
                </View>
              </View>
            )
          })}
        </View>
      )
    case 'listItem':
      return <Children node={node} />
    default:
      return null
  }
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  paragraphText: { fontSize: 15, lineHeight: 22 },
  emptyParagraph: { height: 16 },
  h1: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  h2: { fontSize: 19, fontWeight: '800', marginTop: 4 },
  h3: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  list: { gap: 6 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bullet: { fontSize: 15, width: 18 },
  listContent: { flex: 1 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
})
