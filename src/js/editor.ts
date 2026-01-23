import { EditorView, lineNumbers } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import { foldGutter, foldKeymap, foldService, codeFolding } from '@codemirror/language';
import { Range, EditorState } from '@codemirror/state';

// 编辑器配置选项
export interface EditorOptions {
  theme?: 'light' | 'dark';
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  autofocus?: boolean;
  onUpdate?: (view: EditorView) => void;
}

// Markdown 标题折叠服务
// 检测 markdown 标题（# 到 ######）并支持折叠到下一个同级或更高级标题
function markdownHeadingFoldService(state: EditorState, start: number, end: number): Range | null {
  const doc = state.doc;
  const startLine = doc.lineAt(start);
  const lineText = startLine.text;
  
  // 检测标题行：以 # 开头，后跟空格和文本
  const headingMatch = lineText.match(/^(#{1,6})\s+(.+)$/);
  if (!headingMatch) {
    return null;
  }
  
  const headingLevel = headingMatch[1].length; // 标题级别（1-6）
  const totalLines = doc.lines;
  
  // 从下一行开始查找，直到找到同级或更高级标题，或文档结束
  let endLine = startLine.number;
  for (let i = startLine.number + 1; i <= totalLines; i++) {
    const currentLine = doc.line(i);
    const currentLineText = currentLine.text;
    
    // 检测标题行
    const currentHeadingMatch = currentLineText.match(/^(#{1,6})\s+/);
    if (currentHeadingMatch) {
      const currentHeadingLevel = currentHeadingMatch[1].length;
      // 如果找到同级或更高级标题，则折叠到此行的前一行
      if (currentHeadingLevel <= headingLevel) {
        endLine = i - 1;
        break;
      }
    }
    
    // 如果到达文档末尾，折叠到最后一行
    if (i === totalLines) {
      endLine = totalLines;
      break;
    }
  }
  
  // 如果没有找到结束位置，折叠到文档末尾
  if (endLine === startLine.number) {
    endLine = totalLines;
  }
  
  // 如果只有一行，无法折叠
  if (endLine <= startLine.number) {
    return null;
  }
  
  const startPos = startLine.to;
  const endLineObj = doc.line(endLine);
  const endPos = endLineObj.to;
  
  return { from: startPos, to: endPos };
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
    // 代码折叠功能 - 必须在行号之前添加，这样折叠槽会显示在行号左侧
    codeFolding(),
    foldService.of(markdownHeadingFoldService),
    foldGutter({
      openText: '▾',
      closedText: '▸',
    }),
    keymap.of([...historyKeymap, ...defaultKeymap, ...foldKeymap]),
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
      // 折叠槽样式 - 紧凑且简洁
      '.cm-foldGutter': {
        width: '0.6em !important',
        minWidth: '0.6em',
        flexShrink: 0,
        backgroundColor: 'transparent',
        paddingRight: '1px',
      },
      // 折叠图标元素 - 只在有折叠内容时显示
      '.cm-foldGutterElement': {
        width: '100%',
        height: '100%',
        display: 'flex !important',
        alignItems: 'center',
        justifyContent: 'flex-start',
        cursor: 'pointer',
        padding: '0',
        paddingLeft: '1px',
        color: '#6b7280 !important',
        fontSize: '0.7em !important',
        lineHeight: '1',
        opacity: '0.6',
        transition: 'opacity 0.15s ease, color 0.15s ease',
        userSelect: 'none',
        fontFamily: 'monospace',
      },
      // 只在悬停或折叠时显示更明显
      '.cm-foldGutterElement:hover': {
        color: '#9ca3af !important',
        opacity: '1',
      },
      '.cm-foldGutterElement.cm-foldGutterElement-folded': {
        color: '#4b5563 !important',
        opacity: '0.7',
      },
      '.cm-foldGutterElement.cm-foldGutterElement-folded:hover': {
        color: '#6b7280 !important',
        opacity: '1',
      },
      // 确保折叠图标内的文本内容可见且对齐
      '.cm-foldGutterElement *': {
        color: 'inherit !important',
        opacity: 'inherit',
        display: 'inline-block',
        verticalAlign: 'middle',
      },
      '.cm-foldPlaceholder': {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#6b7280',
        fontFamily: 'monospace',
        fontSize: '0.85em',
        padding: '0 4px',
        opacity: '0.6',
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

