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
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { useTheme, type ThemeTokens } from '@/theme/tokens'

/**
 * TenTap's `theme` option (`webview`/`webviewContainer`) only styles the
 * native RN wrapper around the WebView — it has no hook for the editable
 * HTML content's text color or font. Without this, the WebView falls back to
 * its own default (black text, WebKit's serif "standard font"), which reads
 * as broken in dark mode and mismatched everywhere else. `editor.injectCSS`
 * (from `CoreBridge`, part of `EXTENSIONS` below) is the documented mechanism
 * for reaching into the WebView's document — used internally by the library
 * for its own `darkEditorCss` — so we use the same hook to line up the
 * editable text with `tokens.ink` and the app's system-default font stack.
 */
function editorContentCSS(tokens: ThemeTokens): string {
  return `
    body, .ProseMirror {
      color: ${tokens.ink};
      font-family: -apple-system, Roboto, 'Segoe UI', Helvetica, Arial, sans-serif;
    }
    .is-editor-empty:first-child::before {
      color: ${tokens.muted3};
    }
  `
}

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
      webview: { backgroundColor: tokens.card },
      webviewContainer: {
        backgroundColor: tokens.card,
        borderBottomLeftRadius: tokens.radiusCard,
        borderBottomRightRadius: tokens.radiusCard,
      },
    },
    onChange: () => {
      void editor.getJSON().then((json) => {
        onChangeRef.current(json as unknown as RichNoteDocument)
      })
    },
  })

  useEffect(() => {
    editor.setPlaceholder?.(placeholder)
  }, [editor, placeholder])

  // `state.isReady` (via useBridgeState) is unreliable here: TenTap's web
  // side only includes `isReady` on `StateUpdate` messages, which it sends
  // from `onUpdate`/`onSelectionUpdate`/`onTransaction` — none of which fire
  // for a freshly-opened, non-autofocused editor until the user actually
  // interacts with it. The WebView's own `onLoad` (surfaced through
  // `RichText`'s passthrough props) fires once the bundled page has loaded —
  // the same timing TenTap's own bridge-extension CSS (toolbar/placeholder
  // styling) relies on internally — but on iOS, `RichText` deliberately
  // remounts the WebView once right after its first load (a workaround for
  // https://github.com/react-native-webview/react-native-webview/issues/3578),
  // which fires `onLoad` a second time and wipes anything injected on the
  // first. So this re-injects unconditionally on every `onLoad`, not just
  // the transition into a "loaded" state.
  const [webviewLoaded, setWebviewLoaded] = useState(false)
  function injectEditorTheme() {
    editor.injectCSS?.(editorContentCSS(tokens), 'hh-editor-theme')
    setWebviewLoaded(true)
  }
  useEffect(() => {
    if (!webviewLoaded) return
    editor.injectCSS?.(editorContentCSS(tokens), 'hh-editor-theme')
    // Only re-run for a *later* tokens change (e.g. toggling Light/Dark
    // while the note stays open) — the initial injection is handled by
    // `injectEditorTheme` from `onLoad` above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens])

  return (
    <View style={[styles.root, tokens.shadowCard]}>
      <View
        style={[
          styles.frame,
          {
            backgroundColor: tokens.card,
            borderColor: tokens.line,
            borderRadius: tokens.radiusCard,
          },
        ]}
      >
        <Toolbar editor={editor} />
        <View style={styles.editorSurface}>
          <RichText editor={editor} onLoad={injectEditorTheme} />
        </View>
      </View>
    </View>
  )
}

function Toolbar({ editor }: { editor: EditorBridge }) {
  const { tokens } = useTheme()
  const state = useBridgeState(editor)

  return (
    <View
      style={[
        styles.toolbarFrame,
        { backgroundColor: tokens.cardAlt, borderBottomColor: tokens.line },
      ]}
    >
      <ScrollView
        testID="note-format-toolbar"
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.toolbar}
      >
        <ToolbarButton
          label="Body"
          active={!state.headingLevel}
          disabled={!state.headingLevel}
          // Tiptap's toggleHeading converts the node back to a paragraph when
          // it's already that heading level — there's no separate
          // "setParagraph" bridge action.
          onPress={() => {
            if (state.headingLevel) {
              editor.toggleHeading?.(state.headingLevel as 1 | 2 | 3)
            }
          }}
        >
          Aa
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
        <View style={[styles.divider, { backgroundColor: tokens.line }]} />
        <ToolbarButton
          label="Bullet list"
          active={!!state.isBulletListActive}
          onPress={() => editor.toggleBulletList?.()}
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={!!state.isOrderedListActive}
          onPress={() => editor.toggleOrderedList?.()}
        >
          1. List
        </ToolbarButton>
        <ToolbarButton
          label="Checklist"
          active={!!state.isTaskListActive}
          onPress={() => editor.toggleTaskList?.()}
        >
          ☑ List
        </ToolbarButton>
        <View style={[styles.divider, { backgroundColor: tokens.line }]} />
        <ToolbarButton label="Undo" disabled={!state.canUndo} onPress={() => editor.undo?.()}>
          ↶
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={!state.canRedo} onPress={() => editor.redo?.()}>
          ↷
        </ToolbarButton>
      </ScrollView>
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
        {
          backgroundColor: active ? tokens.accent : tokens.card,
          borderColor: active ? tokens.accent : tokens.line,
        },
        disabled && !active && styles.disabled,
      ]}
    >
      <Text style={[styles.toolbarButtonText, { color: active ? tokens.accentContrast : tokens.ink }]}>
        {children}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 320,
  },
  frame: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  editorSurface: { flex: 1, minHeight: 260 },
  toolbarFrame: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  divider: { width: StyleSheet.hairlineWidth, height: 24, marginHorizontal: 2 },
  toolbarButton: {
    minWidth: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
  },
  toolbarButtonText: { fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.3 },
})
