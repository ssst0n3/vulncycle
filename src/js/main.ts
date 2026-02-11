import '../styles/main.css';
import 'highlight.js/styles/github-dark.css';
import { initEditor } from './editor.js';
import {
  renderLifecycleView,
  renderExploitabilityView,
  renderIntelligenceView,
  renderAnalysisView,
  renderCompletionView,
  updateLifecycleView,
} from './renderer.js';
import { storageManager, type HistoryEntry, type SaveStatus } from './storage.js';
import {
  readFromGist,
  readFromRepo,
  saveToGist,
  saveToRepo,
  type GithubMode,
} from './githubClient.js';
import {
  applyTemplate,
  clearGithubToken,
  loadGithubConfig,
  saveGithubConfig,
  type GithubConfig,
} from './githubConfig.js';
import { EditorView } from '@codemirror/view';

// 视图类型
type ViewType = 'lifecycle' | 'exploitability' | 'intelligence' | 'analysis' | 'completion';

// 当前视图类型
let currentView: ViewType = 'lifecycle';

// 时间轴显示状态
let timelineVisible: boolean = false;

// LocalStorage 键名
const TIMELINE_VISIBLE_KEY = 'vulncycleinsight_timeline_visible';

// 加载时间轴显示状态
function loadTimelineVisibility(): boolean {
  const stored = localStorage.getItem(TIMELINE_VISIBLE_KEY);
  if (stored === null) {
    return false; // 默认隐藏
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
  const timelineToggleBtn = document.getElementById(
    'timeline-toggle-btn'
  ) as HTMLButtonElement | null;
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
  const timelineToggleBtn = document.getElementById(
    'timeline-toggle-btn'
  ) as HTMLButtonElement | null;
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
  stageElements.forEach(stage => {
    const key = getLifecycleStageKey(stage);
    expandedStageKeys.add(key);
  });

  // 捕获子章节状态
  const subsectionElements = container.querySelectorAll('.stage-subsection.expanded');
  subsectionElements.forEach(subsection => {
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
  stageElements.forEach(stage => {
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
  subsectionElements.forEach(subsection => {
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
  } else if (currentView === 'analysis') {
    renderAnalysisView(markdown, container);
  } else {
    renderCompletionView(markdown, container);
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

  // 保存功能回调
  const saveContent = (view: EditorView) => {
    const content = view.state.doc.toString();
    storageManager.manualSave(content);
    showSaveNotification('已保存');
  };

  // 初始化编辑器（传入更新监听器和保存回调）
  const editor = initEditor(editorContainer, {
    onUpdate: (view: EditorView) => {
      const markdown = view.state.doc.toString();
      debouncedUpdate(markdown);
    },
    onSave: saveContent,
  });

  // 初始渲染
  renderCurrentView(editor.state.doc.toString(), previewContent);

  // 初始化折叠/展开功能（事件委托）
  initStageToggle(previewContent, editor);

  // 初始化视图切换功能
  initViewSwitcher(editor, previewContent);

  // 初始化保存功能
  initSaveFeature(editor);

  // 初始化模板功能
  initTemplateFeature(editor, previewContent);

  // 初始化 GitHub 云端存储
  initGithubIntegration(editor, previewContent);

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
  const completionBtn = document.getElementById('completion-view-btn');

  if (!lifecycleBtn || !exploitabilityBtn || !intelligenceBtn || !analysisBtn || !completionBtn) {
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
    completionBtn.classList.toggle('active', viewType === 'completion');

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
  completionBtn.addEventListener('click', () => switchView('completion'));
}

// 加载模板
async function loadTemplate(editor: EditorView, previewContent: HTMLElement): Promise<void> {
  // 优先加载已保存的内容
  const savedContent = storageManager.loadFromLocalStorage();
  if (savedContent !== null) {
    // 如果有已保存的内容（包括空字符串），使用已保存的内容
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
    const templateUrl = new URL(
      'TEMPLATE.md',
      `${window.location.origin}${import.meta.env.BASE_URL}`
    ).toString();
    const response = await fetch(templateUrl);
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

// 初始化模板功能
function initTemplateFeature(editor: EditorView, previewContent: HTMLElement): void {
  const templateBtn = document.getElementById('template-btn') as HTMLButtonElement | null;
  if (!templateBtn) {
    return;
  }

  templateBtn.addEventListener('click', () => {
    void handleTemplateReload(editor, previewContent);
  });
}

async function handleTemplateReload(
  editor: EditorView,
  previewContent: HTMLElement
): Promise<void> {
  const currentContent = editor.state.doc.toString();
  const hasContent = currentContent.trim().length > 0;
  if (hasContent) {
    const confirmed = window.confirm('将使用模板覆盖当前内容，未保存的修改将丢失。是否继续？');
    if (!confirmed) {
      return;
    }
  }

  try {
    const templateUrl = new URL(
      'TEMPLATE.md',
      `${window.location.origin}${import.meta.env.BASE_URL}`
    ).toString();
    const response = await fetch(templateUrl);
    if (!response.ok) {
      throw new Error('Failed to load template');
    }
    const text = await response.text();
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: text },
    });
    renderCurrentView(text, previewContent);
    storageManager.manualSave(text);
    updateSaveStatus(text);
    storageManager.seedHistory(text);
    showSaveNotification('已加载模板');
  } catch (error) {
    console.error('Failed to reload template:', error);
    showSaveNotification('模板加载失败', 'error');
  }
}

// 初始化章节折叠/展开功能
function initStageToggle(previewContent: HTMLElement, editor: EditorView): void {
  previewContent.addEventListener('click', event => {
    const target = event.target as HTMLElement | null;

    const anchorBtn = target?.closest(
      '.stage-anchor-btn, .stage-heading-anchor-btn'
    ) as HTMLButtonElement | null;
    if (anchorBtn) {
      const lineValue = anchorBtn.dataset.line;
      if (lineValue) {
        const lineNumber = Number(lineValue);
        if (!Number.isNaN(lineNumber)) {
          const totalLines = editor.state.doc.lines;
          const clampedLine = Math.min(Math.max(1, lineNumber), totalLines);
          const line = editor.state.doc.line(clampedLine);
          editor.dispatch({
            selection: { anchor: line.from },
            effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 12 }),
          });
        }
      }
      editor.focus();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
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

  // 根据当前设置初始化保存按钮文字
  const config = loadGithubConfig();
  updateSaveBtnLabel(config.mode);

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
      const config = loadGithubConfig();

      if (config.mode === 'local') {
        // Local 模式：保存到浏览器
        storageManager.manualSave(content);
        const now = new Date();
        const timeStr = now.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        showSaveNotification(`已保存到浏览器（${timeStr}）`);
      } else {
        // GitHub 模式：触发 GitHub 保存流程
        const githubSaveBtn = document.getElementById(
          'github-save-btn'
        ) as HTMLButtonElement | null;
        if (githubSaveBtn) {
          githubSaveBtn.click();
        }
      }
    });
  }

  // 下载按钮
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const content = editor.state.doc.toString();
      const filename = generateFilename();
      storageManager.downloadAsFile(content, filename);
      showSaveNotification(`已下载文件: ${filename}`);
    });
  }

  // 定期更新保存状态（检查是否有未保存的更改）
  setInterval(() => {
    const content = editor.state.doc.toString();
    const status = storageManager.getSaveStatus(content);
    updateSaveStatusUI(status);
  }, 1000);
}

type GithubStatusKind = 'info' | 'success' | 'error';

// 更新保存按钮文字以反映当前保存模式
function updateSaveBtnLabel(mode: 'local' | 'gist' | 'repo'): void {
  const saveBtnLabel = document.getElementById('save-btn-label');
  const saveBtn = document.getElementById('save-btn');
  if (!saveBtnLabel || !saveBtn) return;

  const labels: Record<string, { text: string; title: string }> = {
    local: { text: '保存到浏览器', title: '保存到浏览器' },
    gist: { text: '保存到 Gist', title: '保存到 GitHub Gist' },
    repo: { text: '保存到仓库', title: '保存到 GitHub 仓库' },
  };

  const config = labels[mode] || labels.local;
  saveBtnLabel.textContent = config.text;
  saveBtn.title = config.title;
}

function initGithubIntegration(editor: EditorView, previewContent: HTMLElement): void {
  const settingsBtn = document.getElementById('github-settings-btn') as HTMLButtonElement | null;
  const modal = document.getElementById('github-modal');
  const closeTargets = Array.from(
    modal?.querySelectorAll('[data-github-close]') ?? []
  ) as HTMLElement[];
  const modeRadios = Array.from(
    document.querySelectorAll<HTMLInputElement>("input[name='github-mode']")
  );
  const tokenInput = document.getElementById('github-token') as HTMLInputElement | null;
  const rememberInput = document.getElementById('github-remember') as HTMLInputElement | null;
  const clearTokenBtn = document.getElementById('github-clear-token') as HTMLButtonElement | null;
  const gistSection = document.getElementById('github-gist-fields');
  const repoSection = document.getElementById('github-repo-fields');
  const gistIdInput = document.getElementById('github-gist-id') as HTMLInputElement | null;
  const gistFilenameInput = document.getElementById(
    'github-gist-filename'
  ) as HTMLInputElement | null;
  const repoOwnerInput = document.getElementById('github-repo-owner') as HTMLInputElement | null;
  const repoNameInput = document.getElementById('github-repo-name') as HTMLInputElement | null;
  const repoBranchInput = document.getElementById('github-repo-branch') as HTMLInputElement | null;
  const repoPathInput = document.getElementById('github-repo-path') as HTMLInputElement | null;
  const repoUrlInput = document.getElementById('github-repo-url') as HTMLInputElement | null;
  const repoAdvancedToggle = document.getElementById(
    'github-repo-advanced-toggle'
  ) as HTMLButtonElement | null;
  const repoAdvancedSection = document.getElementById('github-repo-advanced') as HTMLElement | null;
  const commitMessageInput = document.getElementById(
    'github-commit-message'
  ) as HTMLInputElement | null;
  const saveBtn = document.getElementById('github-save-btn') as HTMLButtonElement | null;
  const loadBtn = document.getElementById('github-load-btn') as HTMLButtonElement | null;
  const statusEl = document.getElementById('github-status');

  if (
    !settingsBtn ||
    !modal ||
    !modeRadios.length ||
    !tokenInput ||
    !rememberInput ||
    !gistSection ||
    !repoSection ||
    !gistFilenameInput ||
    !repoOwnerInput ||
    !repoNameInput ||
    !repoBranchInput ||
    !repoPathInput ||
    !repoUrlInput ||
    !repoAdvancedToggle ||
    !repoAdvancedSection ||
    !commitMessageInput ||
    !saveBtn ||
    !loadBtn ||
    !statusEl
  ) {
    console.error('GitHub integration elements not found');
    return;
  }

  let config: GithubConfig = loadGithubConfig();
  let busy = false;

  const openModal = () => {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  };

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  };

  settingsBtn.addEventListener('click', () => {
    openModal();
  });

  closeTargets.forEach(node => node.addEventListener('click', closeModal));

  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeModal();
    }
  });

  const setStatus = (text: string, kind: GithubStatusKind = 'info') => {
    statusEl.textContent = text;
    statusEl.className = `github-status ${kind}`;
  };

  const setBusy = (value: boolean) => {
    busy = value;
    const disabled = busy || config.mode === 'local' || !config.token;
    saveBtn.disabled = disabled;
    loadBtn.disabled = disabled;
  };

  const persist = () => {
    saveGithubConfig(config);
  };

  const syncModeUI = () => {
    gistSection.classList.toggle('active', config.mode === 'gist');
    repoSection.classList.toggle('active', config.mode === 'repo');
    modeRadios.forEach(radio => {
      radio.checked = radio.value === config.mode;
    });

    const remoteEnabled = config.mode !== 'local' && Boolean(config.token) && !busy;
    saveBtn.disabled = !remoteEnabled;
    loadBtn.disabled = !remoteEnabled;

    const modeLabel =
      config.mode === 'local'
        ? '当前模式：Local（仅浏览器）'
        : config.mode === 'gist'
          ? '当前模式：Gist'
          : '当前模式：Repo';
    setStatus(modeLabel, 'info');

    // 更新顶部保存按钮文字
    updateSaveBtnLabel(config.mode);
  };

  const applyConfigToInputs = () => {
    tokenInput.value = config.token;
    rememberInput.checked = config.rememberToken;
    if (gistIdInput) gistIdInput.value = config.gistId;
    gistFilenameInput.value = config.gistFilename;
    repoOwnerInput.value = config.repoOwner;
    repoNameInput.value = config.repoName;
    repoBranchInput.value = config.repoBranch;
    repoPathInput.value = config.repoPath;
    commitMessageInput.value = config.commitMessage;
    if (!repoUrlInput.value) {
      repoUrlInput.value = buildRepoFileUrl({
        owner: config.repoOwner,
        repo: config.repoName,
        branch: config.repoBranch,
        path: config.repoPath,
      });
    }
    syncModeUI();
  };

  const updateConfig = (partial: Partial<GithubConfig>) => {
    config = { ...config, ...partial };
    persist();
    syncModeUI();
  };

  const setAdvancedExpanded = (expanded: boolean) => {
    repoAdvancedSection.classList.toggle('collapsed', !expanded);
    repoAdvancedSection.setAttribute('aria-hidden', expanded ? 'false' : 'true');
    repoAdvancedToggle.textContent = expanded ? '收起高级设置' : '展开高级设置';
  };

  const buildRepoFileUrl = (params: {
    owner: string;
    repo: string;
    branch: string;
    path: string;
  }): string => {
    const owner = params.owner.trim();
    const repo = params.repo.trim();
    const branch = params.branch.trim();
    const path = params.path.trim();
    if (!owner || !repo || !branch || !path) {
      return '';
    }
    const normalizedPath = path.replace(/^\/+/, '');
    return `https://github.com/${owner}/${repo}/blob/${branch}/${normalizedPath}`;
  };

  const parseGithubRepoUrl = (
    raw: string
  ): { owner: string; repo: string; branch: string; path: string } | null => {
    const value = raw.trim();
    if (!value) return null;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.hostname !== 'github.com') {
      return null;
    }
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length < 5) {
      return null;
    }
    const [owner, repo, type, branch, ...pathParts] = segments;
    if (!owner || !repo || !branch || !pathParts.length) {
      return null;
    }
    if (type !== 'blob' && type !== 'raw') {
      return null;
    }
    const path = pathParts.map(decodeURIComponent).join('/');
    return { owner, repo, branch, path };
  };

  const ensureToken = (): boolean => {
    if (!config.token) {
      setStatus('请填写 PAT', 'error');
      return false;
    }
    return true;
  };

  const ensureRepoBasics = (): boolean => {
    if (!config.repoOwner.trim() || !config.repoName.trim()) {
      setStatus('请填写 owner/repo', 'error');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (config.mode === 'local') {
      setStatus('当前为 Local 模式，仅保存到浏览器', 'info');
      const now = new Date();
      const timeStr = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      showSaveNotification(`已保存到浏览器（${timeStr}）`);
      return;
    }
    if (!ensureToken()) return;

    setBusy(true);
    setStatus('正在保存到 GitHub...', 'info');
    const content = editor.state.doc.toString();

    if (config.mode === 'gist') {
      const filename = applyTemplate(config.gistFilename || 'reports/{{date}}.md');
      const result = await saveToGist({
        token: config.token,
        gistId: config.gistId || undefined,
        filename,
        content,
      });
      if (result.ok) {
        if (result.data?.gistId && !config.gistId) {
          updateConfig({ gistId: result.data.gistId });
        }
        storageManager.manualSave(content);
        setStatus('已保存到 Gist', 'success');
        const gistId = result.data?.gistId || config.gistId;
        showSaveNotification(`已保存到 Gist: ${gistId}`, 'success');
      } else {
        setStatus(result.error || '保存到 Gist 失败', 'error');
        showSaveNotification(result.error || '保存到 Gist 失败', 'error');
      }
    } else {
      if (!ensureRepoBasics()) {
        setBusy(false);
        return;
      }
      const path = applyTemplate(config.repoPath || 'reports/{{date}}.md');
      const message = applyTemplate(config.commitMessage || 'chore: save report {{datetime}}');
      const result = await saveToRepo({
        token: config.token,
        owner: config.repoOwner.trim(),
        repo: config.repoName.trim(),
        branch: (config.repoBranch || 'main').trim(),
        path,
        message,
        content,
      });
      if (result.ok) {
        storageManager.manualSave(content);
        setStatus('已保存到 Repo', 'success');
        const shaShort = result.data?.sha ? result.data.sha.substring(0, 7) : 'unknown';
        const repoPath = `${config.repoOwner}/${config.repoName}/${path}`;
        showSaveNotification(`已保存到 ${repoPath}（提交: ${shaShort}）`, 'success');
      } else {
        setStatus(result.error || '保存到 Repo 失败', 'error');
        showSaveNotification(result.error || '保存到 Repo 失败', 'error');
      }
    }
    setBusy(false);
  };

  const handleLoad = async () => {
    if (config.mode === 'local') {
      setStatus('当前为 Local 模式，无法从 GitHub 拉取', 'info');
      return;
    }
    if (!ensureToken()) return;

    setBusy(true);
    setStatus('正在从 GitHub 拉取...', 'info');

    if (config.mode === 'gist') {
      if (!config.gistId.trim()) {
        setStatus('请填写 Gist ID', 'error');
        setBusy(false);
        return;
      }
      const filename = config.gistFilename ? applyTemplate(config.gistFilename) : undefined;
      const result = await readFromGist({
        token: config.token,
        gistId: config.gistId,
        filename,
      });
      if (result.ok && typeof result.data === 'string') {
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: result.data },
        });
        renderCurrentView(result.data, previewContent);
        storageManager.manualSave(result.data);
        updateSaveStatus(result.data);
        storageManager.seedHistory(result.data);
        setStatus('已从 Gist 拉取并同步到本地', 'success');
        showSaveNotification('已从 GitHub 拉取');
      } else {
        setStatus(result.error || '从 Gist 拉取失败', 'error');
      }
    } else {
      if (!ensureRepoBasics()) {
        setBusy(false);
        return;
      }
      const path = applyTemplate(config.repoPath || 'reports/{{date}}.md');
      const result = await readFromRepo({
        token: config.token,
        owner: config.repoOwner.trim(),
        repo: config.repoName.trim(),
        branch: (config.repoBranch || 'main').trim(),
        path,
      });
      if (result.ok && typeof result.data === 'string') {
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: result.data },
        });
        renderCurrentView(result.data, previewContent);
        storageManager.manualSave(result.data);
        updateSaveStatus(result.data);
        storageManager.seedHistory(result.data);
        setStatus('已从 Repo 拉取并同步到本地', 'success');
        showSaveNotification('已从 GitHub 拉取');
      } else {
        setStatus(result.error || '从 Repo 拉取失败', 'error');
      }
    }
    setBusy(false);
  };

  modeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const value = radio.value as GithubMode;
      updateConfig({ mode: value });
    });
  });

  tokenInput.addEventListener('input', () => {
    updateConfig({ token: tokenInput.value });
  });

  rememberInput.addEventListener('change', () => {
    updateConfig({ rememberToken: rememberInput.checked });
  });

  clearTokenBtn?.addEventListener('click', () => {
    clearGithubToken();
    config = { ...config, token: '', rememberToken: false };
    applyConfigToInputs();
    setStatus('已清除令牌', 'info');
  });

  gistIdInput?.addEventListener('input', () => {
    updateConfig({ gistId: gistIdInput.value });
  });

  gistFilenameInput.addEventListener('input', () => {
    updateConfig({ gistFilename: gistFilenameInput.value });
  });

  repoOwnerInput.addEventListener('input', () => {
    updateConfig({ repoOwner: repoOwnerInput.value });
    repoUrlInput.value = buildRepoFileUrl({
      owner: repoOwnerInput.value,
      repo: repoNameInput.value,
      branch: repoBranchInput.value || 'main',
      path: repoPathInput.value,
    });
  });

  repoNameInput.addEventListener('input', () => {
    updateConfig({ repoName: repoNameInput.value });
    repoUrlInput.value = buildRepoFileUrl({
      owner: repoOwnerInput.value,
      repo: repoNameInput.value,
      branch: repoBranchInput.value || 'main',
      path: repoPathInput.value,
    });
  });

  repoBranchInput.addEventListener('input', () => {
    updateConfig({ repoBranch: repoBranchInput.value });
    repoUrlInput.value = buildRepoFileUrl({
      owner: repoOwnerInput.value,
      repo: repoNameInput.value,
      branch: repoBranchInput.value || 'main',
      path: repoPathInput.value,
    });
  });

  repoPathInput.addEventListener('input', () => {
    updateConfig({ repoPath: repoPathInput.value });
    repoUrlInput.value = buildRepoFileUrl({
      owner: repoOwnerInput.value,
      repo: repoNameInput.value,
      branch: repoBranchInput.value || 'main',
      path: repoPathInput.value,
    });
  });

  commitMessageInput.addEventListener('input', () => {
    updateConfig({ commitMessage: commitMessageInput.value });
  });

  repoUrlInput.addEventListener('input', () => {
    const parsed = parseGithubRepoUrl(repoUrlInput.value);
    if (!parsed) {
      if (repoUrlInput.value.trim()) {
        setStatus('无法解析该文件地址，请检查格式', 'error');
      } else {
        syncModeUI();
      }
      return;
    }
    repoOwnerInput.value = parsed.owner;
    repoNameInput.value = parsed.repo;
    repoBranchInput.value = parsed.branch;
    repoPathInput.value = parsed.path;
    updateConfig({
      repoOwner: parsed.owner,
      repoName: parsed.repo,
      repoBranch: parsed.branch,
      repoPath: parsed.path,
    });
    setStatus('已从文件地址解析 Repo 信息', 'success');
    setAdvancedExpanded(false);
  });

  repoAdvancedToggle.addEventListener('click', () => {
    const isCollapsed = repoAdvancedSection.classList.contains('collapsed');
    setAdvancedExpanded(isCollapsed);
  });

  saveBtn.addEventListener('click', () => {
    if (busy) return;
    void handleSave();
  });

  loadBtn.addEventListener('click', () => {
    if (busy) return;
    void handleLoad();
  });

  applyConfigToInputs();
  setBusy(false);
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

    entries.forEach(entry => {
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
    items.forEach(item => {
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
  closeTargets.forEach(node => node.addEventListener('click', closeModal));

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
    saveStatusIndicator.textContent = `已暂存 ${timeStr}`;
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

  const removedCount = diffBody.filter(line => line.type !== 'add').length;
  const addedCount = diffBody.filter(line => line.type !== 'remove').length;
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
type NotificationType = 'success' | 'error' | 'info';

function showSaveNotification(message: string, type: NotificationType = 'success'): void {
  const notification = document.createElement('div');
  notification.className = `save-notification ${type}`;

  // Add icon based on type
  const iconMap = {
    success: '✓',
    error: '✗',
    info: 'ℹ',
  };

  notification.innerHTML = `<span class="notification-icon">${iconMap[type]}</span><span class="notification-message">${message}</span>`;
  document.body.appendChild(notification);

  // 触发动画
  requestAnimationFrame(() => {
    notification.classList.add('show');
  });

  // 3秒后移除
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
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
      editorContainer.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      // 退出全屏
      document.exitFullscreen().catch(err => {
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
  const timelineToggleBtn = document.getElementById(
    'timeline-toggle-btn'
  ) as HTMLButtonElement | null;

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
