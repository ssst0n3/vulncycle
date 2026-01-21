import '../styles/main.css';
import 'highlight.js/styles/github-dark.css';
import { initEditor } from './editor.js';
import {
  renderLifecycleView,
  renderExploitabilityView,
  renderIntelligenceView,
  renderAnalysisView,
  updateLifecycleView,
} from './renderer.js';
import { storageManager, type HistoryEntry, type SaveStatus } from './storage.js';
import type { EditorView } from '@codemirror/view';

// 视图类型
type ViewType = 'lifecycle' | 'exploitability' | 'intelligence' | 'analysis';

// 当前视图类型
let currentView: ViewType = 'lifecycle';

// 时间轴显示状态
let timelineVisible: boolean = true;

// LocalStorage 键名
const TIMELINE_VISIBLE_KEY = 'vulncycleinsight_timeline_visible';

// 加载时间轴显示状态
function loadTimelineVisibility(): boolean {
  const stored = localStorage.getItem(TIMELINE_VISIBLE_KEY);
  if (stored === null) {
    return true; // 默认显示
  }
  return stored === 'true';
}

// 保存时间轴显示状态
function saveTimelineVisibility(visible: boolean): void {
  localStorage.setItem(TIMELINE_VISIBLE_KEY, visible.toString());
}

// 应用时间轴显示状态到DOM
function applyTimelineVisibility(): void {
  const previewContent = document.getElementById('preview-content');
  if (!previewContent) return;
  
  const lifecycleContainer = previewContent.querySelector('.lifecycle-container');
  if (!lifecycleContainer) return;
  
  if (timelineVisible) {
    lifecycleContainer.classList.remove('timeline-hidden');
  } else {
    lifecycleContainer.classList.add('timeline-hidden');
  }
}

// 更新时间轴按钮的显示状态
function updateTimelineToggleButton(): void {
  const timelineToggleBtn = document.getElementById('timeline-toggle-btn') as HTMLButtonElement | null;
  if (!timelineToggleBtn) return;
  
  if (timelineVisible) {
    timelineToggleBtn.classList.add('active');
    timelineToggleBtn.title = '隐藏时间轴';
  } else {
    timelineToggleBtn.classList.remove('active');
    timelineToggleBtn.title = '显示时间轴';
  }
}

// 更新时间轴控制按钮的可见性（仅在生命周期视图显示）
function updateTimelineToggleVisibility(): void {
  const timelineToggleBtn = document.getElementById('timeline-toggle-btn') as HTMLButtonElement | null;
  if (!timelineToggleBtn) return;
  
  if (currentView === 'lifecycle') {
    timelineToggleBtn.style.display = 'flex';
  } else {
    timelineToggleBtn.style.display = 'none';
  }
}

type LifecycleViewState = {
  expandedStageKeys: Set<string>;
  expandedSubsectionKeys: Set<string>;
  scrollTop: number;
};

function getLifecycleStageKey(stage: Element): string {
  const nodeIndex = stage.getAttribute('data-node-index') ?? '';
  const stageIndex = stage.getAttribute('data-stage-index') ?? '';
  const stageNum = stage.getAttribute('data-stage') ?? '';
  return `${nodeIndex}:${stageIndex}:${stageNum}`;
}

function getSubsectionKey(subsection: Element): string {
  // 查找最近的 lifecycle-stage 父元素
  const stage = subsection.closest('.lifecycle-stage');
  if (!stage) return '';
  
  const stageKey = getLifecycleStageKey(stage);
  
  // 在该 stage 中找到这个 subsection 的索引
  const subsections = Array.from(stage.querySelectorAll('.stage-subsection'));
  const index = subsections.indexOf(subsection);
  
  return `${stageKey}:subsection-${index}`;
}

function captureLifecycleState(container: HTMLElement): LifecycleViewState {
  const expandedStageKeys = new Set<string>();
  const expandedSubsectionKeys = new Set<string>();
  
  // 捕获主章节状态
  const stageElements = container.querySelectorAll('.lifecycle-stage.expanded');
  stageElements.forEach((stage) => {
    const key = getLifecycleStageKey(stage);
    expandedStageKeys.add(key);
  });
  
  // 捕获子章节状态
  const subsectionElements = container.querySelectorAll('.stage-subsection.expanded');
  subsectionElements.forEach((subsection) => {
    const key = getSubsectionKey(subsection);
    if (key) {
      expandedSubsectionKeys.add(key);
    }
  });
  
  return {
    expandedStageKeys,
    expandedSubsectionKeys,
    scrollTop: container.scrollTop,
  };
}

function restoreLifecycleState(container: HTMLElement, state: LifecycleViewState): void {
  // 恢复主章节状态
  const stageElements = container.querySelectorAll('.lifecycle-stage');
  stageElements.forEach((stage) => {
    const key = getLifecycleStageKey(stage);
    if (state.expandedStageKeys.has(key)) {
      stage.classList.remove('collapsed');
      stage.classList.add('expanded');
    }
    const icon = stage.querySelector('.stage-toggle-icon');
    if (icon) {
      icon.textContent = stage.classList.contains('collapsed') ? '▼' : '▲';
    }
  });
  
  // 恢复子章节状态
  const subsectionElements = container.querySelectorAll('.stage-subsection');
  subsectionElements.forEach((subsection) => {
    const key = getSubsectionKey(subsection);
    if (key) {
      if (state.expandedSubsectionKeys.has(key)) {
        subsection.classList.remove('collapsed');
        subsection.classList.add('expanded');
        const icon = subsection.querySelector('.stage-subsection-toggle-icon');
        if (icon) {
          icon.textContent = '▼';
        }
      }
    }
  });
  
  container.scrollTop = state.scrollTop;
}

// 渲染当前视图
function renderCurrentView(markdown: string, container: HTMLElement): void {
  const initialScrollTop = container.scrollTop;
  let lifecycleState: LifecycleViewState | null = null;

  if (currentView === 'lifecycle') {
    if (updateLifecycleView(markdown, container)) {
      return;
    }
    lifecycleState = captureLifecycleState(container);
  }

  if (currentView === 'lifecycle') {
    renderLifecycleView(markdown, container);
  } else if (currentView === 'exploitability') {
    renderExploitabilityView(markdown, container);
  } else if (currentView === 'intelligence') {
    renderIntelligenceView(markdown, container);
  } else {
    renderAnalysisView(markdown, container);
  }

  if (currentView === 'lifecycle' && lifecycleState) {
    restoreLifecycleState(container, lifecycleState);
  } else {
    container.scrollTop = initialScrollTop;
  }
  
  // 应用时间轴显示状态（仅在生命周期视图）
  if (currentView === 'lifecycle') {
    applyTimelineVisibility();
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

  // 初始化折叠/展开功能（事件委托）
  initStageToggle(previewContent);

  // 初始化视图切换功能
  initViewSwitcher(editor, previewContent);

  // 初始化保存功能
  initSaveFeature(editor);

  // 初始化历史版本功能
  initHistoryModal(editor, previewContent);

  // 加载模板内容（或已保存的内容）
  loadTemplate(editor, previewContent);

  // 初始化全屏功能
  initFullscreen();
  
  // 初始化时间轴控制功能
  initTimelineToggle();
}

// 初始化视图切换功能
function initViewSwitcher(editor: EditorView, previewContent: HTMLElement): void {
  const lifecycleBtn = document.getElementById('lifecycle-view-btn');
  const exploitabilityBtn = document.getElementById('exploitability-view-btn');
  const intelligenceBtn = document.getElementById('intelligence-view-btn');
  const analysisBtn = document.getElementById('analysis-view-btn');

  if (!lifecycleBtn || !exploitabilityBtn || !intelligenceBtn || !analysisBtn) {
    console.error('View switcher buttons not found');
    return;
  }

  const switchView = (viewType: ViewType) => {
    currentView = viewType;
    
    // 更新按钮状态
    lifecycleBtn.classList.toggle('active', viewType === 'lifecycle');
    exploitabilityBtn.classList.toggle('active', viewType === 'exploitability');
    intelligenceBtn.classList.toggle('active', viewType === 'intelligence');
    analysisBtn.classList.toggle('active', viewType === 'analysis');

    // 更新时间轴控制按钮的可见性
    updateTimelineToggleVisibility();

    // 重新渲染当前视图
    const markdown = editor.state.doc.toString();
    renderCurrentView(markdown, previewContent);
    
    // 应用时间轴显示状态
    applyTimelineVisibility();
  };

  lifecycleBtn.addEventListener('click', () => switchView('lifecycle'));
  exploitabilityBtn.addEventListener('click', () => switchView('exploitability'));
  intelligenceBtn.addEventListener('click', () => switchView('intelligence'));
  analysisBtn.addEventListener('click', () => switchView('analysis'));
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
    storageManager.seedHistory(savedContent);
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
    storageManager.seedHistory(text);
  } catch (err) {
    console.log('无法加载模板文件，使用空编辑器');
    renderCurrentView('', previewContent);
    updateSaveStatus('');
  }
}

// 初始化章节折叠/展开功能
function initStageToggle(previewContent: HTMLElement): void {
  previewContent.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const subsectionHeader = target?.closest('.stage-subsection-header');
    if (subsectionHeader) {
      const subsection = subsectionHeader.closest('.stage-subsection');
      if (!subsection) return;

      subsection.classList.toggle('collapsed');
      subsection.classList.toggle('expanded');

      const icon = subsectionHeader.querySelector('.stage-subsection-toggle-icon');
      if (icon) {
        icon.textContent = subsection.classList.contains('collapsed') ? '▶' : '▼';
      }
      return;
    }

    // 如果点击的是链接，不处理展开/折叠，让链接正常跳转
    if (target?.closest('.metadata-link')) {
      return;
    }

    const header = target?.closest('.stage-header');
    if (!header) return;

    const stage = header.closest('.lifecycle-stage');
    if (!stage) return;

    stage.classList.toggle('collapsed');
    stage.classList.toggle('expanded');

    const icon = header.querySelector('.stage-toggle-icon');
    if (icon) {
      icon.textContent = stage.classList.contains('collapsed') ? '▼' : '▲';
    }
  });
}

// 初始化保存功能
function initSaveFeature(editor: EditorView): void {
  const saveBtn = document.getElementById('save-btn');
  const downloadBtn = document.getElementById('download-btn');

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

      // 显示保存成功提示
      showSaveNotification('已保存');
    });
  }

  // 下载按钮
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const content = editor.state.doc.toString();
      const filename = generateFilename();
      storageManager.downloadAsFile(content, filename);
      showSaveNotification('已下载文件');
    });
  }

  // 定期更新保存状态（检查是否有未保存的更改）
  setInterval(() => {
    const content = editor.state.doc.toString();
    const status = storageManager.getSaveStatus(content);
    updateSaveStatusUI(status);
  }, 1000);
}

// 初始化历史版本弹窗功能
function initHistoryModal(editor: EditorView, previewContent: HTMLElement): void {
  const historyBtn = document.getElementById('history-btn') as HTMLButtonElement | null;
  const modal = document.getElementById('history-modal') as HTMLElement | null;
  const listContainer = document.getElementById('history-list-items') as HTMLElement | null;
  const diffContent = document.getElementById('history-diff-content') as HTMLElement | null;
  const restoreBtn = document.getElementById('history-restore-btn') as HTMLButtonElement | null;
  const closeTargets = Array.from(
    document.querySelectorAll('[data-history-close]')
  ) as HTMLElement[];

  if (!historyBtn || !modal || !listContainer || !diffContent || !restoreBtn) {
    console.error('History modal elements not found');
    return;
  }

  let currentContentSnapshot = '';
  let selectedEntry: HistoryEntry | null = null;

  const openModal = () => {
    currentContentSnapshot = editor.state.doc.toString();
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    refreshHistoryList();
  };

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    selectedEntry = null;
    restoreBtn.disabled = true;
  };

  const refreshHistoryList = () => {
    const entries = storageManager.getHistoryEntries();
    listContainer.innerHTML = '';
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = '暂无历史版本';
      listContainer.appendChild(empty);
      diffContent.textContent = '';
      restoreBtn.disabled = true;
      return;
    }

    entries.forEach((entry) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'history-item';
      item.dataset.historyId = entry.id;
      item.innerHTML = `
        <div class="history-item-time">${formatHistoryTime(new Date(entry.timestamp))}</div>
        <div class="history-item-preview">${escapeHtml(getHistoryPreview(entry.content))}</div>
      `;
      item.addEventListener('click', () => {
        selectEntry(entry);
        highlightSelected(entry.id);
      });
      listContainer.appendChild(item);
    });

    selectEntry(entries[0]);
    highlightSelected(entries[0].id);
  };

  const highlightSelected = (id: string) => {
    const items = listContainer.querySelectorAll('.history-item');
    items.forEach((item) => {
      const match = (item as HTMLElement).dataset.historyId === id;
      item.classList.toggle('active', match);
    });
  };

  const selectEntry = (entry: HistoryEntry) => {
    selectedEntry = entry;
    restoreBtn.disabled = false;
    const diffLines = buildUnifiedDiff(currentContentSnapshot, entry.content);
    diffContent.innerHTML = diffLines.map(renderDiffLine).join('\n');
  };

  historyBtn.addEventListener('click', openModal);
  closeTargets.forEach((node) => node.addEventListener('click', closeModal));

  restoreBtn.addEventListener('click', () => {
    if (!selectedEntry) return;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: selectedEntry.content },
    });
    renderCurrentView(selectedEntry.content, previewContent);
    storageManager.manualSave(selectedEntry.content);
    updateSaveStatus(selectedEntry.content);
    showSaveNotification('已恢复历史版本');
    closeModal();
  });
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

// 格式化历史版本时间
function formatHistoryTime(date: Date): string {
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getHistoryPreview(content: string): string {
  const firstLine = content.split('\n')[0]?.trim() ?? '';
  if (!firstLine) {
    return '（空内容）';
  }
  const maxLength = 20;
  return firstLine.length > maxLength ? `${firstLine.slice(0, maxLength)}…` : firstLine;
}

type DiffLine = { type: 'context' | 'add' | 'remove' | 'header' | 'hunk'; content: string };

function buildUnifiedDiff(current: string, target: string): DiffLine[] {
  const currentLines = current.split('\n');
  const targetLines = target.split('\n');
  const dp = buildLcsTable(currentLines, targetLines);
  const diffBody: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < currentLines.length && j < targetLines.length) {
    if (currentLines[i] === targetLines[j]) {
      diffBody.push({ type: 'context', content: currentLines[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      diffBody.push({ type: 'remove', content: currentLines[i] });
      i += 1;
    } else {
      diffBody.push({ type: 'add', content: targetLines[j] });
      j += 1;
    }
  }
  while (i < currentLines.length) {
    diffBody.push({ type: 'remove', content: currentLines[i] });
    i += 1;
  }
  while (j < targetLines.length) {
    diffBody.push({ type: 'add', content: targetLines[j] });
    j += 1;
  }

  const headerLines: DiffLine[] = [
    { type: 'header', content: '--- 当前内容' },
    { type: 'header', content: '+++ 选中版本' },
  ];

  const removedCount = diffBody.filter((line) => line.type !== 'add').length;
  const addedCount = diffBody.filter((line) => line.type !== 'remove').length;
  const hunkLine: DiffLine = {
    type: 'hunk',
    content: `@@ -1,${Math.max(removedCount, 0)} +1,${Math.max(addedCount, 0)} @@`,
  };

  return [...headerLines, hunkLine, ...diffBody];
}

function buildLcsTable(a: string[], b: string[]): number[][] {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }
  return dp;
}

function renderDiffLine(line: DiffLine): string {
  const prefix =
    line.type === 'add'
      ? '+'
      : line.type === 'remove'
        ? '-'
        : line.type === 'header' || line.type === 'hunk'
          ? ''
          : ' ';
  const className =
    line.type === 'add'
      ? 'diff-add'
      : line.type === 'remove'
        ? 'diff-remove'
        : line.type === 'header'
          ? 'diff-header'
          : line.type === 'hunk'
            ? 'diff-hunk'
            : 'diff-context';
  return `<span class="${className}">${escapeHtml(prefix + line.content)}</span>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

// 初始化时间轴控制功能
function initTimelineToggle(): void {
  const timelineToggleBtn = document.getElementById('timeline-toggle-btn') as HTMLButtonElement | null;
  
  if (!timelineToggleBtn) {
    console.error('Timeline toggle button not found');
    return;
  }
  
  // 从 localStorage 加载时间轴显示状态
  timelineVisible = loadTimelineVisibility();
  
  // 初始化按钮显示状态
  updateTimelineToggleButton();
  updateTimelineToggleVisibility();
  
  // 应用时间轴显示状态
  applyTimelineVisibility();
  
  // 添加按钮点击事件监听
  timelineToggleBtn.addEventListener('click', () => {
    // 切换状态
    timelineVisible = !timelineVisible;
    
    // 保存到 localStorage
    saveTimelineVisibility(timelineVisible);
    
    // 更新按钮状态
    updateTimelineToggleButton();
    
    // 应用到DOM
    applyTimelineVisibility();
  });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);

