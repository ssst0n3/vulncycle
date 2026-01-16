import { EditorView, lineNumbers } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { keymap } from '@codemirror/view';

// 编辑器配置选项
export interface EditorOptions {
  theme?: 'light' | 'dark';
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  autofocus?: boolean;
  onUpdate?: (view: EditorView) => void;
}

// 初始化 CodeMirror 6 编辑器
export function initEditor(
  parentElement: HTMLElement,
  options: EditorOptions = {}
): EditorView {
  const {
    theme = 'dark',
    lineNumbers: showLineNumbers = true,
    lineWrapping: enableLineWrapping = true,
    autofocus: enableAutofocus = true,
    onUpdate,
  } = options;

  const extensions: Extension[] = [
    markdown(),
    history(),
    keymap.of([...historyKeymap, ...defaultKeymap]),
    EditorView.theme({
      '&': {
        height: '100%',
        fontSize: '14px',
        lineHeight: '1.6',
        display: 'flex',
        flexDirection: 'column',
      },
      '.cm-content': {
        padding: '20px',
        minHeight: '100%',
        flex: 1,
      },
      '.cm-scroller': {
        fontFamily: "'Courier New', monospace",
        overflow: 'auto',
        flex: 1,
      },
      '.cm-editor': {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      },
      '.cm-editor.cm-focused': {
        outline: 'none',
      },
    }),
  ];

  if (showLineNumbers) {
    extensions.push(lineNumbers());
  }

  if (enableLineWrapping) {
    extensions.push(EditorView.lineWrapping);
  }

  if (theme === 'dark') {
    extensions.push(oneDark);
  }

  // 添加更新监听器
  if (onUpdate) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onUpdate(update.view);
        }
      })
    );
  }

  const state = EditorState.create({
    doc: '',
    extensions,
  });

  const view = new EditorView({
    state,
    parent: parentElement,
  });

  if (enableAutofocus) {
    view.focus();
  }

  return view;
}

