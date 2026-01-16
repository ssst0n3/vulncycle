import '../styles/main.css';
import { initEditor } from './editor.js';
import { renderLifecycleView, renderExploitabilityView } from './renderer.js';
import { storageManager, type SaveStatus } from './storage.js';
import type { EditorView } from '@codemirror/view';

// 视图类型
type ViewType = 'lifecycle' | 'exploitability';

// 当前视图类型
let currentView: ViewType = 'lifecycle';

// 渲染当前视图
function renderCurrentView(markdown: string, container: HTMLElement): void {
  if (currentView === 'lifecycle') {
    renderLifecycleView(markdown, container);
    initStageToggle(); // 初始化折叠/展开功能
  } else {
    renderExploitabilityView(markdown, container);
  }
}

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
      renderCurrentView(markdown, previewContent);
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
  renderCurrentView(editor.state.doc.toString(), previewContent);

  // 初始化视图切换功能
  initViewSwitcher(editor, previewContent);

  // 初始化保存功能
  initSaveFeature(editor);

  // 加载模板内容（或已保存的内容）
  loadTemplate(editor, previewContent);

  // 初始化全屏功能
  initFullscreen();
}

// 初始化视图切换功能
function initViewSwitcher(editor: EditorView, previewContent: HTMLElement): void {
  const lifecycleBtn = document.getElementById('lifecycle-view-btn');
  const exploitabilityBtn = document.getElementById('exploitability-view-btn');

  if (!lifecycleBtn || !exploitabilityBtn) {
    console.error('View switcher buttons not found');
    return;
  }

  const switchView = (viewType: ViewType) => {
    currentView = viewType;
    
    // 更新按钮状态
    if (viewType === 'lifecycle') {
      lifecycleBtn.classList.add('active');
      exploitabilityBtn.classList.remove('active');
    } else {
      lifecycleBtn.classList.remove('active');
      exploitabilityBtn.classList.add('active');
    }

    // 重新渲染当前视图
    const markdown = editor.state.doc.toString();
    renderCurrentView(markdown, previewContent);
  };

  lifecycleBtn.addEventListener('click', () => switchView('lifecycle'));
  exploitabilityBtn.addEventListener('click', () => switchView('exploitability'));
}

// 加载模板
async function loadTemplate(
  editor: EditorView,
  previewContent: HTMLElement
): Promise<void> {
  // 优先加载已保存的内容
  const savedContent = storageManager.loadFromLocalStorage();
  
  if (savedContent) {
    // 如果有已保存的内容，使用已保存的内容
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: savedContent },
    });
    renderCurrentView(savedContent, previewContent);
    updateSaveStatus(savedContent);
    return;
  }

  // 如果没有已保存的内容，加载模板
  try {
    const response = await fetch('/TEMPLATE.md');
    if (!response.ok) {
      throw new Error('Failed to load template');
    }
    const text = await response.text();
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: text },
    });
    renderCurrentView(text, previewContent);
    // 保存模板内容
    storageManager.saveToLocalStorage(text);
    updateSaveStatus(text);
  } catch (err) {
    console.log('无法加载模板文件，使用空编辑器');
    renderCurrentView('', previewContent);
    updateSaveStatus('');
  }
}

// 初始化章节折叠/展开功能
function initStageToggle(): void {
  const stageHeaders = document.querySelectorAll('.stage-header');
  
  stageHeaders.forEach((header) => {
    header.addEventListener('click', () => {
      const stage = header.closest('.lifecycle-stage');
      if (stage) {
        stage.classList.toggle('collapsed');
        stage.classList.toggle('expanded');
        
        // 更新图标
        const icon = header.querySelector('.stage-toggle-icon');
        if (icon) {
          icon.textContent = stage.classList.contains('collapsed') ? '▼' : '▲';
        }
      }
    });
  });
}

// 初始化保存功能
function initSaveFeature(editor: EditorView): void {
  const saveBtn = document.getElementById('save-btn');

  // 启动自动保存
  storageManager.startAutoSave(
    () => editor.state.doc.toString(),
    (status: SaveStatus) => {
      updateSaveStatusUI(status);
    }
  );

  // 手动保存按钮
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const content = editor.state.doc.toString();
      storageManager.manualSave(content);
      
      // 同时下载文件
      const filename = generateFilename();
      storageManager.downloadAsFile(content, filename);
      
      // 显示保存成功提示
      showSaveNotification('已保存并下载文件');
    });
  }

  // 定期更新保存状态（检查是否有未保存的更改）
  setInterval(() => {
    const content = editor.state.doc.toString();
    const status = storageManager.getSaveStatus(content);
    updateSaveStatusUI(status);
  }, 1000);
}

// 更新保存状态
function updateSaveStatus(content: string): void {
  const status = storageManager.getSaveStatus(content);
  updateSaveStatusUI(status);
}

// 更新保存状态 UI
function updateSaveStatusUI(status: SaveStatus): void {
  const saveStatusIndicator = document.getElementById('save-status');
  if (!saveStatusIndicator) return;

  if (status.isSaving) {
    saveStatusIndicator.textContent = '保存中...';
    saveStatusIndicator.className = 'save-status saving';
  } else if (status.hasUnsavedChanges) {
    saveStatusIndicator.textContent = '未保存';
    saveStatusIndicator.className = 'save-status unsaved';
  } else if (status.lastSaved) {
    const timeStr = formatTime(status.lastSaved);
    saveStatusIndicator.textContent = `已保存 ${timeStr}`;
    saveStatusIndicator.className = 'save-status saved';
  } else {
    saveStatusIndicator.textContent = '未保存';
    saveStatusIndicator.className = 'save-status unsaved';
  }
}

// 格式化时间
function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) {
    return '刚刚';
  } else if (minutes < 60) {
    return `${minutes} 分钟前`;
  } else if (hours < 24) {
    return `${hours} 小时前`;
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

// 生成文件名
function generateFilename(): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  return `vulncycleinsight_${dateStr}_${timeStr}.md`;
}

// 显示保存通知
function showSaveNotification(message: string): void {
  const notification = document.createElement('div');
  notification.className = 'save-notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  // 触发动画
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  // 3秒后移除
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
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

