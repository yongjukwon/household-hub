import type { RichNoteDocument } from '@household-hub/domain'
import {
  BulletListBridge,
  CoreBridge,
  HardBreakBridge,
  HeadingBridge,
  HistoryBridge,
  ListItemBridge,
  OrderedListBridge,
  PlaceholderBridge,
  RichText,
  TaskListBridge,
  useBridgeState,
  useEditorBridge,
  type EditorBridge,
} from '@10play/tentap-editor'
import { useEffect, useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/theme/tokens'

/**
 * Note editor restricted to body, Heading 1-3, bullet/numbered/checklists,
 * undo, and redo — the shared subset `isRichNoteJson` validates and both web
 * (Tiptap) and native (TenTap, which is Tiptap running in a WebView) render.
 * Bridge extensions are assembled individually (not `TenTapStartKit`, which
 * also includes bold/italic/strike/code/link/color/highlight/image/
 * blockquote/dropcursor/underline — none of which the shared document schema
 * permits) so the native editor can only ever produce documents the schema
 * accepts, mirroring web's `StarterKit.configure({ bold: false, ... })`.
 */
const EXTENSIONS = [
  CoreBridge,
  HistoryBridge,
  HeadingBridge.configureExtension({ levels: [1, 2, 3] }),
  BulletListBridge,
  OrderedListBridge,
  ListItemBridge,
  TaskListBridge,
  HardBreakBridge,
  PlaceholderBridge,
]

interface RestrictedEditorProps {
  /** Restricted TenTap-compatible doc. Initial value only — TenTap's WebView
   * editor owns its own state after mount, matching the web editor's
   * uncontrolled `useEditor({ content })` pattern. */
  content: RichNoteDocument
  /** Called with the full local draft on every change; no network save occurs
   * here (content is pulled async via `editor.getJSON()`, TenTap's bridge to
   * the WebView). */
  onChange: (document: RichNoteDocument) => void
  placeholder?: string
}

export function RestrictedEditor({
  content,
  onChange,
  placeholder = 'Start writing…',
}: RestrictedEditorProps) {
  const { tokens } = useTheme()
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditorBridge({
    bridgeExtensions: EXTENSIONS,
    initialContent: content as unknown as object,
    autofocus: false,
    avoidIosKeyboard: true,
    theme: {
      toolbar: { toolbarBody: { display: 'none' } },
      webview: {},
    },
    onChange: () => {
      void editor.getJSON().then((json) => {
        onChangeRef.current(json as unknown as RichNoteDocument)
      })
    },
  })

  return (
    <View style={styles.root}>
      <RichText editor={editor} />
      <Toolbar editor={editor} />
    </View>
  )
}

function Toolbar({ editor }: { editor: EditorBridge }) {
  const { tokens } = useTheme()
  const state = useBridgeState(editor)

  return (
    <View style={[styles.toolbar, { borderTopColor: tokens.line }]}>
      <ToolbarButton
        label="Body"
        active={!state.headingLevel}
        disabled={!state.headingLevel}
        // Tiptap's toggleHeading converts the node back to a paragraph when
        // it's already that heading level — there's no separate "setParagraph"
        // bridge action, so untoggling the currently-active level is the way
        // back to body text.
        onPress={() => {
          if (state.headingLevel) editor.toggleHeading?.(state.headingLevel as 1 | 2 | 3)
        }}
      >
        P
      </ToolbarButton>
      <ToolbarButton
        label="Heading 1"
        active={state.headingLevel === 1}
        onPress={() => editor.toggleHeading?.(1)}
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={state.headingLevel === 2}
        onPress={() => editor.toggleHeading?.(2)}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={state.headingLevel === 3}
        onPress={() => editor.toggleHeading?.(3)}
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        label="Bullet list"
        active={!!state.isBulletListActive}
        onPress={() => editor.toggleBulletList?.()}
      >
        •
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={!!state.isOrderedListActive}
        onPress={() => editor.toggleOrderedList?.()}
      >
        1.
      </ToolbarButton>
      <ToolbarButton
        label="Checklist"
        active={!!state.isTaskListActive}
        onPress={() => editor.toggleTaskList?.()}
      >
        ☑
      </ToolbarButton>
      <View style={styles.toolbarSpacer} />
      <ToolbarButton label="Undo" disabled={!state.canUndo} onPress={() => editor.undo?.()}>
        ↶
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={!state.canRedo} onPress={() => editor.redo?.()}>
        ↷
      </ToolbarButton>
    </View>
  )
}

function ToolbarButton({
  label,
  active,
  disabled,
  onPress,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onPress: () => void
  children: string
}) {
  const { tokens } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.toolbarButton,
        { backgroundColor: active ? tokens.accent : 'transparent' },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.toolbarButtonText, { color: active ? tokens.accentContrast : tokens.ink }]}>
        {children}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 320 },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 8,
  },
  toolbarSpacer: { flex: 1 },
  toolbarButton: {
    minWidth: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  toolbarButtonText: { fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.3 },
})
