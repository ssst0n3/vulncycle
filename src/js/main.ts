import '../styles/main.css';
import { initEditor } from './editor.js';
import { renderLifecycleView } from './renderer.js';
import type { EditorView } from '@codemirror/view';

// 初始化应用
function initApp(): void {
  const editorContainer = document.getElementById('markdown-editor-container');
  const previewContent = document.getElementById('preview-content');

  if (!editorContainer || !previewContent) {
    console.error('Required DOM elements not found');
    return;
  }

  // 防抖函数
  let updateTimer: ReturnType<typeof setTimeout> | null = null;
  const debouncedUpdate = (markdown: string) => {
    if (updateTimer) {
      clearTimeout(updateTimer);
    }
    updateTimer = setTimeout(() => {
      renderLifecycleView(markdown, previewContent);
    }, 300); // 防抖，300ms 延迟
  };

  // 初始化编辑器（传入更新监听器）
  const editor = initEditor(editorContainer, {
    onUpdate: (view: EditorView) => {
      const markdown = view.state.doc.toString();
      debouncedUpdate(markdown);
    },
  });

  // 初始渲染
  renderLifecycleView(editor.state.doc.toString(), previewContent);

  // 加载模板内容
  loadTemplate(editor, previewContent);

  // 初始化全屏功能
  initFullscreen();
}

// 加载模板
async function loadTemplate(
  editor: EditorView,
  previewContent: HTMLElement
): Promise<void> {
  try {
    const response = await fetch('/TEMPLATE.md');
    if (!response.ok) {
      throw new Error('Failed to load template');
    }
    const text = await response.text();
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: text },
    });
    renderLifecycleView(text, previewContent);
  } catch (err) {
    console.log('无法加载模板文件，使用空编辑器');
    renderLifecycleView('', previewContent);
  }
}

// 初始化全屏功能
function initFullscreen(): void {
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const editorContainer = document.getElementById('editor-container');

  if (!fullscreenBtn || !editorContainer) {
    console.error('Fullscreen elements not found');
    return;
  }

  // 切换全屏状态
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      // 进入全屏
      editorContainer.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      // 退出全屏
      document.exitFullscreen().catch((err) => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  });

  // 监听全屏状态变化，更新按钮图标
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      fullscreenBtn.classList.add('active');
      editorContainer.classList.add('fullscreen-active');
    } else {
      fullscreenBtn.classList.remove('active');
      editorContainer.classList.remove('fullscreen-active');
    }
  });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);

