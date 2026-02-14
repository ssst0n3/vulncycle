import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import {
  parseLifecycleStages,
  extractTitle,
  type LifecycleStage,
  type StageMetadata,
  type StageHeading,
} from './parser.js';
import { logger } from './logger.js';

// HTML 转义函数
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 确保代码块有 hljs 类（后处理函数）
function ensureHljsClass(html: string): string {
  // 使用正则表达式为所有 code 标签添加 hljs 类（如果还没有）
  return html.replace(/<code\s+class="([^"]*)language-[^"]*"([^>]*)>/g, (match, classes, rest) => {
    // 如果已经有 hljs 类，不重复添加
    if (classes.includes('hljs')) {
      return match;
    }
    // 添加 hljs 类
    return `<code class="hljs ${classes}"${rest}>`;
  });
}

const COPY_BUTTON_TEMPLATE = `
  <svg class="copy-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
  <svg class="check-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
`;

function getCodeBlockLanguage(codeEl: Element): string {
  const languageClass = Array.from(codeEl.classList).find(className =>
    className.startsWith('language-')
  );
  if (languageClass) {
    const language = languageClass.replace('language-', '').trim();
    if (language) {
      return language;
    }
  }
  const dataLanguage = codeEl.getAttribute('data-language');
  return dataLanguage && dataLanguage.trim() ? dataLanguage.trim() : 'text';
}

function createCopyButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-block-copy-btn';
  button.title = '复制代码';
  button.setAttribute('aria-label', '复制代码');
  button.innerHTML = COPY_BUTTON_TEMPLATE;
  return button;
}

// 为代码块添加头部（包含语言标签和复制按钮）
function wrapCodeBlocks(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;

  const codeBlocks = Array.from(container.querySelectorAll('pre > code'));
  codeBlocks.forEach(codeEl => {
    const pre = codeEl.parentElement;
    const parent = pre?.parentElement;
    if (!pre || !parent) {
      return;
    }

    if (parent.classList.contains('code-block-wrapper')) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    const header = document.createElement('div');
    header.className = 'code-block-header';
    const langLabel = document.createElement('span');
    langLabel.className = 'code-block-lang';
    langLabel.textContent = getCodeBlockLanguage(codeEl);
    header.appendChild(langLabel);
    header.appendChild(createCopyButton());

    parent.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });

  return container.innerHTML;
}

// 时间信息接口
export interface TimeInfo {
  label: string;
  value: string;
  timestamp: number | null; // 用于排序的时间戳，null 表示无法解析
}

// 解析日期字符串为时间戳
function parseDate(dateStr: string): number | null {
  if (!dateStr || dateStr.includes('需要修改') || dateStr.includes('待填写')) {
    return null;
  }

  // 移除可能的括号内容
  dateStr = dateStr.replace(/\s*\([^)]*\)\s*$/, '').trim();

  // 尝试多种日期格式
  const formats = [
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, // YYYY/MM/DD
    /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/, // YYYY.MM.DD
    /^(\d{4})(\d{2})(\d{2})$/, // YYYYMMDD
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // 月份从 0 开始
      const day = parseInt(match[3], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
  }

  // 尝试直接解析
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.getTime();
  }

  return null;
}

// 提取时间信息
function extractTimeInfo(content: string): TimeInfo[] {
  const timeInfo: TimeInfo[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // 匹配列表项格式：- **时间类型**：值
    // 支持中文冒号和英文冒号，匹配整行直到行尾
    const match = line.match(/-\s*\*\*([^*]+)\*\*[：:]\s*(.+)$/);
    if (match) {
      const fieldName = match[1].trim();
      let fieldValue = match[2].trim();

      // 只提取包含"时间"的字段
      if (fieldName.includes('时间')) {
        // 如果包含"需要修改"，显示为"待填写"
        if (fieldValue.includes('需要修改')) {
          fieldValue = '待填写';
        } else {
          // 移除可能的括号内容（如 "(需要修改)"），但保留日期部分
          fieldValue = fieldValue.replace(/\s*\([^)]*\)\s*$/, '').trim();
        }

        if (fieldValue.length > 0) {
          const timestamp = parseDate(fieldValue);
          timeInfo.push({
            label: fieldName,
            value: fieldValue,
            timestamp: timestamp,
          });
        }
      }
    }
  }

  return timeInfo;
}

// 获取阶段的主要时间（用于显示和分组）
function getPrimaryTimestamp(stage: LifecycleStage): number | null {
  const content = stage.content.trim();
  const timeInfo = extractTimeInfo(content);

  if (timeInfo.length === 0) {
    return null;
  }

  // 优先使用最早的时间戳
  const timestamps = timeInfo
    .map(t => t.timestamp)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);

  return timestamps.length > 0 ? timestamps[0] : null;
}

// 提取内容摘要（精简信息）
function extractSummary(content: string, maxLength: number = 100): string {
  if (!content.trim()) return '';

  // 先按行处理，过滤掉元数据列表项和注释
  const lines = content.split('\n');
  const filteredLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 跳过 HTML 注释行
    if (trimmedLine.match(/^<!--[\s\S]*?-->$/) || trimmedLine.match(/^&lt;!--[\s\S]*?--&gt;$/)) {
      continue;
    }

    // 跳过元数据列表项格式：- **字段名**：值 或 - **字段名**: 值
    if (trimmedLine.match(/^-\s*\*\*[^*]+\*\*[：:]\s*.+$/)) {
      continue;
    }

    filteredLines.push(line);
  }

  const filteredContent = filteredLines.join('\n');

  // 移除 markdown 语法标记，只保留文本
  const text = filteredContent
    .replace(/<!--[\s\S]*?-->/g, '') // 移除 HTML 注释（Markdown 注释格式）
    .replace(/&lt;!--[\s\S]*?--&gt;/g, '') // 移除转义的 HTML 注释
    .replace(/^#{1,6}\s+/gm, '') // 移除标题标记
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // 移除链接，保留文本
    .replace(/`([^`]+)`/g, '$1') // 移除行内代码标记
    .replace(/\*\*([^*]+)\*\*/g, '$1') // 移除加粗标记
    .replace(/\*([^*]+)\*/g, '$1') // 移除斜体标记
    .replace(/^\s*[-*+]\s+/gm, '') // 移除列表标记
    .replace(/^\s*\d+\.\s+/gm, '') // 移除有序列表标记
    .trim();

  // 提取第一段或前几行
  const textLines = text.split('\n').filter(line => line.trim());
  if (textLines.length === 0) return '';

  let summary = textLines[0];
  for (let i = 1; i < Math.min(textLines.length, 3); i++) {
    if ((summary + ' ' + textLines[i]).length <= maxLength) {
      summary += ' ' + textLines[i];
    } else {
      break;
    }
  }

  if (summary.length > maxLength) {
    summary = summary.substring(0, maxLength) + '...';
  }

  return summary;
}

const subsectionHeadingSelector = 'h3, h4, h5, h6';

function normalizeHeadingText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function applyHeadingAnchors(body: HTMLElement, headings?: StageHeading[]): void {
  // 清理旧的锚点
  body.querySelectorAll('.stage-heading-anchor-btn').forEach(btn => btn.remove());

  if (!headings || headings.length === 0) {
    return;
  }

  const headingElements = Array.from(body.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'));

  let cursor = 0;
  headingElements.forEach(el => {
    if (cursor >= headings.length) {
      return;
    }

    const level = Number(el.tagName.replace('H', ''));
    const text = normalizeHeadingText(el.textContent || '');

    // 找到与当前元素匹配的下一个标题数据（级别与文本均匹配）
    let matchedIndex = -1;
    for (let i = cursor; i < headings.length; i += 1) {
      const heading = headings[i];
      if (heading.level === level && normalizeHeadingText(heading.title) === text) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) {
      return;
    }

    const headingInfo = headings[matchedIndex];
    cursor = matchedIndex + 1;

    el.setAttribute('data-heading-title', headingInfo.title);

    if (!headingInfo.line) {
      return;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stage-heading-anchor-btn';
    btn.title = '跳转到编辑器对应位置';
    btn.dataset.line = String(headingInfo.line);
    btn.textContent = '#';

    // 将按钮插入到标题内，放在末尾
    el.appendChild(btn);
  });
}

function applyStageSubsectionsWithState(
  stageBody: HTMLElement,
  subsectionStates?: Map<string, boolean>
): void {
  if (!stageBody.querySelector(subsectionHeadingSelector)) {
    return;
  }

  // 使用传入的状态，如果没有传入则尝试捕获当前状态
  let expandedSubsectionTitles = new Set<string>();

  if (subsectionStates) {
    // 使用传入的状态
    for (const [title, isExpanded] of subsectionStates.entries()) {
      if (isExpanded) {
        expandedSubsectionTitles.add(title);
      }
    }
  } else {
    // 如果没有传入状态，尝试捕获当前状态
    const existingSubsections = stageBody.querySelectorAll('.stage-subsection.expanded');
    existingSubsections.forEach(subsection => {
      const heading = subsection.querySelector(subsectionHeadingSelector);
      if (heading) {
        const titleText =
          heading.getAttribute('data-heading-title') || heading.textContent?.trim() || '';
        expandedSubsectionTitles.add(titleText);
      }
    });
  }

  const fragment = document.createDocumentFragment();
  const childNodes = Array.from(stageBody.childNodes);
  const sectionStack: Array<{ level: number; body: HTMLElement }> = [];

  childNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.matches(subsectionHeadingSelector)) {
        const level = Number(element.tagName.replace('H', ''));
        if (Number.isNaN(level)) {
          fragment.appendChild(element);
          return;
        }

        while (sectionStack.length > 0 && level <= sectionStack[sectionStack.length - 1].level) {
          sectionStack.pop();
        }

        // 检查这个子章节之前是否是展开的
        // 使用 data-heading-title 属性获取标题，避免包含锚点按钮的文本
        const titleText =
          element.getAttribute('data-heading-title') || element.textContent?.trim() || '';
        const wasExpanded = expandedSubsectionTitles.has(titleText);

        const section = document.createElement('div');
        section.className = wasExpanded
          ? 'stage-subsection expanded'
          : 'stage-subsection collapsed';

        const header = document.createElement('div');
        header.className = 'stage-subsection-header';

        const icon = document.createElement('span');
        icon.className = 'stage-subsection-toggle-icon';
        icon.textContent = wasExpanded ? '▼' : '▶';

        header.appendChild(icon);
        header.appendChild(element);
        section.appendChild(header);

        const body = document.createElement('div');
        body.className = 'stage-subsection-body';
        section.appendChild(body);

        const parentBody =
          sectionStack.length > 0 ? sectionStack[sectionStack.length - 1].body : null;
        if (parentBody) {
          parentBody.appendChild(section);
        } else {
          fragment.appendChild(section);
        }

        sectionStack.push({ level, body });
        return;
      }
    }

    if (sectionStack.length > 0) {
      sectionStack[sectionStack.length - 1].body.appendChild(node);
    } else {
      fragment.appendChild(node);
    }
  });

  stageBody.innerHTML = '';
  stageBody.appendChild(fragment);
}

function applyLifecycleSubsections(container: HTMLElement): void {
  const bodies = container.querySelectorAll<HTMLElement>('.stage-body');
  bodies.forEach(body => applyStageSubsectionsWithState(body));
}

function applyLifecycleHeadingAnchors(container: HTMLElement, timeNodes: TimeNode[]): void {
  timeNodes.forEach((timeNode, nodeIndex) => {
    timeNode.stages.forEach(({ stage }, stageIndex) => {
      const stageElement = container.querySelector<HTMLElement>(
        `.lifecycle-stage[data-node-index="${nodeIndex}"][data-stage-index="${stageIndex}"]`
      );
      if (!stageElement) return;
      const body = stageElement.querySelector<HTMLElement>('.stage-body');
      if (!body) return;
      applyHeadingAnchors(body, stage.headings);
    });
  });
}

// 语言别名映射（将常见别名映射到 highlight.js 支持的语言）
const languageAliases: Record<string, string> = {
  shell: 'bash', // shell 映射到 bash
  zsh: 'bash', // zsh 也使用 bash 高亮
  console: 'bash', // console 映射到 bash
};

// 创建配置了语法高亮的 marked 实例
const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight: (code: string, lang: string | undefined) => {
      if (lang) {
        // 处理语言别名
        const normalizedLang = languageAliases[lang.toLowerCase()] || lang;

        if (hljs.getLanguage(normalizedLang)) {
          try {
            const highlighted = hljs.highlight(code, { language: normalizedLang });
            return highlighted.value;
          } catch (err) {
            logger.warn(`Failed to highlight code with language "${normalizedLang}":`, err);
            return escapeHtml(code);
          }
        }
      }
      // 如果没有指定语言或语言不支持，尝试自动检测
      try {
        const highlighted = hljs.highlightAuto(code);
        return highlighted.value;
      } catch (err) {
        logger.warn('Failed to auto-highlight code:', err);
        return escapeHtml(code);
      }
    },
  })
);

// 配置 marked 的其他选项
marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderMarkdown = (markdown: string): string => {
  const rendered = marked.parse(markdown);
  if (rendered instanceof Promise) {
    throw new Error('Markdown rendering unexpectedly returned a Promise');
  }
  // 先添加 hljs 类，再包装代码块
  return wrapCodeBlocks(ensureHljsClass(rendered));
};

// 解析 Markdown 链接格式 [text](url)
function parseMarkdownLink(value: string): { text: string; url: string } | null {
  const match = value.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (match) {
    return {
      text: match[1],
      url: match[2],
    };
  }
  return null;
}

// 解析并渲染包含 Markdown 链接的混合文本
// 例如: "Michael Crosby([@crosbymichael](https://github.com/crosbymichael))"
function renderValueWithMarkdownLinks(value: string): string {
  // 先检查是否是完整的 Markdown 链接格式
  const fullLink = parseMarkdownLink(value);
  if (fullLink) {
    return `<a class="metadata-value metadata-link" href="${escapeHtml(fullLink.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(fullLink.text)}</a>`;
  }

  // 检查是否包含 Markdown 链接模式 [text](url)
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const matches = Array.from(value.matchAll(linkPattern));

  if (matches.length === 0) {
    // 没有链接，直接转义返回
    if (value.startsWith('http') || value.includes('://')) {
      return `<a class="metadata-value metadata-link" href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>`;
    }
    return `<span class="metadata-value">${escapeHtml(value)}</span>`;
  }

  // 有链接，需要混合渲染
  let result = '';
  let lastIndex = 0;

  matches.forEach(match => {
    const matchIndex = match.index!;
    const matchLength = match[0].length;

    // 添加链接前的普通文本
    if (matchIndex > lastIndex) {
      const textBefore = value.substring(lastIndex, matchIndex);
      result += escapeHtml(textBefore);
    }

    // 添加链接
    const linkText = match[1];
    const linkUrl = match[2];
    result += `<a class="metadata-value metadata-link" href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`;

    lastIndex = matchIndex + matchLength;
  });

  // 添加剩余的普通文本
  if (lastIndex < value.length) {
    const textAfter = value.substring(lastIndex);
    result += escapeHtml(textAfter);
  }

  return `<span class="metadata-value">${result}</span>`;
}

// 渲染元数据HTML（仅渲染前几个关键元数据，单行显示）
function renderMetadataHtml(metadata: StageMetadata | undefined, maxItems: number = 5): string {
  if (!metadata || metadata.items.length === 0) {
    return '';
  }

  // 保持原始输入顺序，不进行排序
  // 按照模板中的顺序显示：合入时间、提交时间、修复版本、修复者...
  const displayItems = metadata.items.slice(0, maxItems);

  let html = '<div class="stage-metadata">';

  displayItems.forEach((item, index) => {
    // 第一个元数据项添加特殊类名，确保其完整显示
    const itemClass = `metadata-item metadata-${item.type}-item${index === 0 ? ' metadata-item-first' : ''}`;

    html += `<div class="${itemClass}">`;

    if (item.icon) {
      html += `<span class="metadata-icon">${item.icon}</span>`;
    }

    html += `<span class="metadata-label">${escapeHtml(item.label)}</span>`;

    // 渲染值（支持混合格式的 Markdown 链接）
    html += renderValueWithMarkdownLinks(item.value);

    html += `</div>`;
  });

  html += '</div>';

  return html;
}

// 格式化日期显示（竖向2列格式）
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // 左列：年份的每一位数字 + "-" 竖向排列
  const yearWithDash = year + '-';
  const yearChars = yearWithDash
    .split('')
    .map(char => `<span class="date-year-digit">${char}</span>`)
    .join('');

  // 右列：月日的每一位数字和分隔符竖向排列（月份 + "-" + 日期）
  const monthDayWithDash = month + '-' + day;
  const monthDayChars = monthDayWithDash
    .split('')
    .map(char => `<span class="date-month-day-char">${char}</span>`)
    .join('');

  return `<div class="date-columns"><div class="date-column-left">${yearChars}</div><div class="date-column-right">${monthDayChars}</div></div>`;
}

// 格式化日期时间显示（包含年月日）
function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = weekdays[date.getDay()];
  return `${year}年${month}月${day}日 (周${weekday})`;
}

// 时间节点接口
interface TimeNode {
  timestamp: number | null;
  dateLabel: string;
  stages: Array<{
    stage: LifecycleStage;
    timeInfo: TimeInfo[];
    primaryTimestamp: number | null;
  }>;
}

function renderTimelineMarkerHtml(timeNode: TimeNode, isBasicInfoOnly: boolean): string {
  const hasTimestamp = timeNode.timestamp !== null;
  if (hasTimestamp && timeNode.timestamp) {
    return `<div class="timeline-date-label">${formatDate(timeNode.timestamp)}</div>`;
  }
  if (!isBasicInfoOnly) {
    const unknownChars = '未指定'
      .split('')
      .map(char => `<span class="unknown-char">${escapeHtml(char)}</span>`)
      .join('');
    return `<div class="timeline-date-label timeline-date-unknown"><div class="unknown-column">${unknownChars}</div></div>`;
  }
  return '';
}

// 按时间分组阶段（保持原始顺序，不进行时间排序）
function groupStagesByTime(stages: LifecycleStage[]): TimeNode[] {
  const timeMap = new Map<number | string, TimeNode>();
  const nodeOrder: Array<number | string> = []; // 记录节点的出现顺序

  stages.forEach(stage => {
    const primaryTimestamp = getPrimaryTimestamp(stage);
    const timeInfo = extractTimeInfo(stage.content);

    // 使用时间戳作为key，如果没有时间戳则使用特殊key
    const key = primaryTimestamp ?? `no-time-${stage.stageNum ?? 'unknown'}`;

    if (!timeMap.has(key)) {
      let dateLabel: string;
      if (primaryTimestamp !== null) {
        dateLabel = formatDateTime(primaryTimestamp);
      } else {
        dateLabel = '未指定时间';
      }

      timeMap.set(key, {
        timestamp: primaryTimestamp,
        dateLabel,
        stages: [],
      });

      // 记录节点的出现顺序
      nodeOrder.push(key);
    }

    timeMap.get(key)!.stages.push({
      stage,
      timeInfo,
      primaryTimestamp,
    });
  });

  // 按照原始顺序构建结果数组（不进行时间排序）
  const timeNodes: TimeNode[] = nodeOrder.map(key => timeMap.get(key)!);

  return timeNodes;
}

export function updateLifecycleView(markdown: string, container: HTMLElement): boolean {
  if (!markdown.trim()) {
    return false;
  }

  const stages = parseLifecycleStages(markdown);

  if (stages.length === 0) {
    return false;
  }

  const lifecycleRoot = container.querySelector('.lifecycle-container');
  const timelineWrapper = container.querySelector('.timeline-wrapper');
  if (!lifecycleRoot || !timelineWrapper) {
    return false;
  }

  const title = extractTitle(markdown);
  const titleEl = container.querySelector('.lifecycle-title');
  if (titleEl) {
    titleEl.textContent = title;
  }

  const timeNodes = groupStagesByTime(stages);
  const nodeGroups = container.querySelectorAll('.timeline-node-group');
  if (nodeGroups.length !== timeNodes.length) {
    return false;
  }

  for (let nodeIndex = 0; nodeIndex < timeNodes.length; nodeIndex += 1) {
    const timeNode = timeNodes[nodeIndex];
    const nodeGroup = container.querySelector(`.timeline-node-group[data-index="${nodeIndex}"]`);
    if (!nodeGroup) {
      return false;
    }

    const isBasicInfoOnly = timeNode.stages.every(s => s.stage.stageNum === 1);
    nodeGroup.setAttribute('data-timestamp', timeNode.timestamp ? String(timeNode.timestamp) : '');

    const marker = nodeGroup.querySelector('.timeline-marker');
    if (!marker) {
      return false;
    }
    marker.innerHTML = renderTimelineMarkerHtml(timeNode, isBasicInfoOnly);

    const stageElements = nodeGroup.querySelectorAll('.lifecycle-stage');
    if (stageElements.length !== timeNode.stages.length) {
      return false;
    }

    for (let stageIndex = 0; stageIndex < timeNode.stages.length; stageIndex += 1) {
      const { stage } = timeNode.stages[stageIndex];
      const stageElement = nodeGroup.querySelector(
        `.lifecycle-stage[data-stage-index="${stageIndex}"]`
      );
      if (!stageElement) {
        return false;
      }

      const stageNum = stage.stageNum ?? '?';
      stageElement.setAttribute('data-stage', String(stageNum));

      const badge = stageElement.querySelector('.stage-number-badge');
      if (badge) {
        badge.textContent = String(stageNum);
        badge.setAttribute('data-stage', String(stageNum));
      }

      const headerTitle = stageElement.querySelector('.stage-header-title');
      if (headerTitle) {
        headerTitle.textContent = stage.title;
      }

      const anchorBtn = stageElement.querySelector<HTMLButtonElement>('.stage-anchor-btn');
      const headerLeft = stageElement.querySelector('.stage-header-left');
      if (stage.startLine) {
        const lineStr = String(stage.startLine);
        if (anchorBtn) {
          anchorBtn.dataset.line = lineStr;
        } else if (headerLeft) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'stage-anchor-btn';
          btn.title = '跳转到编辑器对应位置';
          btn.dataset.line = lineStr;
          btn.textContent = '#';
          headerLeft.appendChild(btn);
        }
      } else if (anchorBtn) {
        anchorBtn.dataset.line = '';
      }

      const body = stageElement.querySelector<HTMLElement>('.stage-body');
      if (!body) {
        return false;
      }

      // 更新元数据区域
      // 基本信息阶段不显示元数据
      const stageCard = stageElement.querySelector('.stage-card');
      if (stageCard) {
        const existingMetadata = stageCard.querySelector('.stage-metadata');
        if (stage.metadata && stage.metadata.items.length > 0 && stageNum !== 1) {
          const metadataHtml = renderMetadataHtml(stage.metadata);
          if (existingMetadata) {
            // 更新现有元数据
            existingMetadata.outerHTML = metadataHtml;
          } else {
            // 插入新元数据（在header之后）
            const header = stageCard.querySelector('.stage-header');
            if (header && header.nextSibling) {
              header.insertAdjacentHTML('afterend', metadataHtml);
            }
          }
        } else if (existingMetadata) {
          // 移除元数据（包括基本信息阶段的元数据）
          existingMetadata.remove();
        }
      }

      const summary = extractSummary(stage.content.trim());
      const summaryEl = stageElement.querySelector('.stage-summary');
      if (summary) {
        if (summaryEl) {
          summaryEl.textContent = summary;
        } else {
          const newSummary = document.createElement('div');
          newSummary.className = 'stage-summary';
          newSummary.textContent = summary;
          body.parentElement?.insertBefore(newSummary, body);
        }
      } else if (summaryEl) {
        summaryEl.remove();
      }

      // 在更新内容之前，先捕获子章节的展开状态
      const subsectionStates = new Map<string, boolean>();
      const existingSubsections = body.querySelectorAll('.stage-subsection');
      existingSubsections.forEach(subsection => {
        const heading = subsection.querySelector(subsectionHeadingSelector);
        if (heading) {
          const titleText =
            heading.getAttribute('data-heading-title') || heading.textContent?.trim() || '';
          const isExpanded = subsection.classList.contains('expanded');
          subsectionStates.set(titleText, isExpanded);
        }
      });

      if (stage.content.trim()) {
        body.innerHTML = `${renderMarkdown(stage.content.trim())}`;
      } else {
        body.innerHTML = '<p class="stage-empty">暂无内容</p>';
      }

      applyHeadingAnchors(body, stage.headings);

      // 将状态传递给 applyStageSubsections
      applyStageSubsectionsWithState(body, subsectionStates);
    }
  }

  return true;
}

// 渲染生命周期视图
export function renderLifecycleView(markdown: string, container: HTMLElement): void {
  if (!markdown.trim()) {
    container.innerHTML =
      '<div class="lifecycle-container"><p style="text-align: center; color: #999; padding: 40px;">请在左侧输入 Markdown 内容...</p></div>';
    return;
  }

  const title = extractTitle(markdown);
  let stages = parseLifecycleStages(markdown);
  let timeNodes: TimeNode[] = [];

  let html = '<div class="lifecycle-container">';
  html += `<h1 class="lifecycle-title">${escapeHtml(title)}</h1>`;

  if (stages.length === 0) {
    // 如果没有检测到标准阶段，直接渲染整个内容（排除 front matter 和标题）
    const lines = markdown.split('\n');
    let inFrontMatter = false;
    let skipFirstH1 = true;
    const contentLines: string[] = [];

    for (const line of lines) {
      if (line.match(/^---\s*$/)) {
        inFrontMatter = !inFrontMatter;
        continue;
      }
      if (inFrontMatter) continue;
      if (skipFirstH1 && line.match(/^#\s+/)) {
        skipFirstH1 = false;
        continue;
      }
      contentLines.push(line);
    }

    const content = contentLines.join('\n').trim();
    html += '<div class="lifecycle-stages">';
    if (content) {
      html += `<div class="stage-content">${renderMarkdown(content)}</div>`;
    } else {
      html +=
        '<div class="stage-content"><p style="text-align: center; color: #999; padding: 40px;">请在左侧输入 Markdown 内容...</p></div>';
    }
    html += '</div>';
  } else {
    // 按时间分组阶段
    timeNodes = groupStagesByTime(stages);

    html += '<div class="timeline-wrapper">';
    html += '<div class="timeline-container">';

    // 时间轴线条（作为背景）
    html += '<div class="timeline-axis-line"></div>';

    // 时间线内容
    html += '<div class="timeline-content-wrapper">';

    timeNodes.forEach((timeNode, nodeIndex) => {
      const hasTimestamp = timeNode.timestamp !== null;
      const dateStr = hasTimestamp && timeNode.timestamp ? formatDate(timeNode.timestamp) : '';

      // 检查是否只包含基本信息（stageNum === 1）
      const isBasicInfoOnly = timeNode.stages.every(s => s.stage.stageNum === 1);

      // 时间节点组
      html += `<div class="timeline-node-group" data-timestamp="${timeNode.timestamp ?? ''}" data-index="${nodeIndex}">`;

      // 时间轴标记（左侧）
      html += '<div class="timeline-marker">';
      if (hasTimestamp && timeNode.timestamp) {
        html += `<div class="timeline-date-label">${dateStr}</div>`;
      } else if (!isBasicInfoOnly) {
        // 只有非基本信息节点才显示"未指定"，竖向1列显示
        const unknownChars = '未指定'
          .split('')
          .map(char => `<span class="unknown-char">${escapeHtml(char)}</span>`)
          .join('');
        html += `<div class="timeline-date-label timeline-date-unknown"><div class="unknown-column">${unknownChars}</div></div>`;
      }
      // 基本信息节点如果没有时间戳，不显示任何标记
      html += '</div>';

      // 内容区域（右侧）
      html += '<div class="timeline-content-area">';

      // 该时间点的所有阶段
      html += '<div class="timeline-stages-container">';

      timeNode.stages.forEach(({ stage }, stageIndex) => {
        const stageNum = stage.stageNum ?? '?';
        const content = stage.content.trim();
        const summary = extractSummary(content);
        const lineAttr = stage.startLine ? ` data-line="${stage.startLine}"` : '';

        html += `<div class="lifecycle-stage collapsed" data-stage="${stageNum}" data-node-index="${nodeIndex}" data-stage-index="${stageIndex}">`;

        html += '<div class="stage-card">';

        // 阶段头部
        html += '<div class="stage-header">';
        html += '<div class="stage-header-left">';
        html += `<div class="stage-number-badge" data-stage="${stageNum}">${stageNum}</div>`;
        html += `<span class="stage-header-title">${escapeHtml(stage.title)}</span>`;
        html += `<button class="stage-anchor-btn" type="button"${lineAttr} title="跳转到编辑器对应位置">#</button>`;
        html += '</div>';

        // 元数据区域（显示在标题右侧）
        // 基本信息阶段不显示元数据
        if (stage.metadata && stageNum !== 1) {
          html += renderMetadataHtml(stage.metadata);
        }

        html += '<span class="stage-toggle-icon">▼</span>';
        html += '</div>';

        // 摘要（仅在折叠时显示）
        if (summary) {
          html += `<div class="stage-summary">${escapeHtml(summary)}</div>`;
        }

        // 阶段内容
        if (content) {
          html += `<div class="stage-body">${renderMarkdown(content)}</div>`;
        } else {
          html += '<div class="stage-body"><p class="stage-empty">暂无内容</p></div>';
        }

        html += '</div>'; // stage-card
        html += '</div>'; // lifecycle-stage
      });

      html += '</div>'; // timeline-stages-container
      html += '</div>'; // timeline-content-area
      html += '</div>'; // timeline-node-group
    });

    html += '</div>'; // timeline-content-wrapper
    html += '</div>'; // timeline-container
    html += '</div>'; // timeline-wrapper
  }

  html += '</div>';
  container.innerHTML = html;
  applyLifecycleSubsections(container);
  if (timeNodes.length > 0) {
    applyLifecycleHeadingAnchors(container, timeNodes);
  }
}

// 解析漏洞利用阶段的内容
interface ExploitabilitySection {
  title: string;
  content: string;
}

// 提取漏洞利用阶段（第8节）的内容
function extractExploitabilityContent(markdown: string): {
  title: string;
  sections: ExploitabilitySection[];
} {
  const stages = parseLifecycleStages(markdown);
  const exploitStage = stages.find(stage => stage.stageNum === 8);

  if (!exploitStage) {
    return {
      title: '漏洞利用',
      sections: [],
    };
  }

  const sections: ExploitabilitySection[] = [];
  const lines = exploitStage.content.split('\n');
  let currentSection: { title: string; content: string[] } | null = null;

  for (const line of lines) {
    // 检测三级标题（###）
    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      // 保存前一个子节
      if (currentSection) {
        sections.push({
          title: currentSection.title,
          content: currentSection.content.join('\n').trim(),
        });
      }
      // 开始新子节
      currentSection = {
        title: h3Match[1].trim(),
        content: [],
      };
      continue;
    }

    // 收集内容
    if (currentSection) {
      currentSection.content.push(line);
    }
  }

  // 保存最后一个子节
  if (currentSection) {
    sections.push({
      title: currentSection.title,
      content: currentSection.content.join('\n').trim(),
    });
  }

  // 如果没有找到任何三级标题，将整个内容作为一个部分显示
  if (sections.length === 0 && exploitStage.content.trim()) {
    sections.push({
      title: '漏洞利用内容',
      content: exploitStage.content.trim(),
    });
  }

  return {
    title: exploitStage.title,
    sections,
  };
}

// 渲染可利用性视图
export function renderExploitabilityView(markdown: string, container: HTMLElement): void {
  if (!markdown.trim()) {
    container.innerHTML =
      '<div class="exploitability-container"><p style="text-align: center; color: #999; padding: 40px;">请在左侧输入 Markdown 内容...</p></div>';
    return;
  }

  const docTitle = extractTitle(markdown);
  const { title, sections } = extractExploitabilityContent(markdown);

  let html = '<div class="exploitability-container">';
  html += `<h1 class="exploitability-title">${escapeHtml(docTitle)}</h1>`;
  html += `<h2 class="exploitability-main-title">${escapeHtml(title)}</h2>`;

  if (sections.length === 0) {
    html += '<div class="exploitability-empty">';
    html +=
      '<p style="text-align: center; color: #999; padding: 40px;">未找到漏洞利用相关内容，请确保文档包含第8节"漏洞利用"的内容。</p>';
    html += '</div>';
  } else {
    html += '<div class="exploitability-sections">';

    sections.forEach((section, index) => {
      const sectionId = `exploitability-section-${index}`;
      html += `<div class="exploitability-section" id="${sectionId}">`;
      html += `<div class="exploitability-section-header">`;
      html += `<h3 class="exploitability-section-title">${escapeHtml(section.title)}</h3>`;
      html += '</div>';

      if (section.content.trim()) {
        html += `<div class="exploitability-section-content">${renderMarkdown(section.content)}</div>`;
      } else {
        html +=
          '<div class="exploitability-section-content"><p class="section-empty">暂无内容</p></div>';
      }

      html += '</div>';
    });

    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

// 提取漏洞情报阶段（第7节）的内容
function extractIntelligenceContent(markdown: string): {
  title: string;
  content: string;
} {
  const stages = parseLifecycleStages(markdown);
  const intelligenceStage = stages.find(stage => stage.stageNum === 7);

  if (!intelligenceStage) {
    return {
      title: '漏洞情报',
      content: '',
    };
  }

  return {
    title: intelligenceStage.title,
    content: intelligenceStage.content.trim(),
  };
}

// 渲染情报视图
export function renderIntelligenceView(markdown: string, container: HTMLElement): void {
  if (!markdown.trim()) {
    container.innerHTML =
      '<div class="intelligence-container"><p style="text-align: center; color: #999; padding: 40px;">请在左侧输入 Markdown 内容...</p></div>';
    return;
  }

  const docTitle = extractTitle(markdown);
  const { title, content } = extractIntelligenceContent(markdown);

  let html = '<div class="intelligence-container">';
  html += `<h1 class="intelligence-title">${escapeHtml(docTitle)}</h1>`;
  html += `<h2 class="intelligence-main-title">${escapeHtml(title)}</h2>`;

  if (!content) {
    html += '<div class="intelligence-empty">';
    html +=
      '<p style="text-align: center; color: #999; padding: 40px;">未找到漏洞情报相关内容，请确保文档包含第7节"漏洞情报"的内容。</p>';
    html += '</div>';
  } else {
    html += '<div class="intelligence-content">';
    html += `${renderMarkdown(content)}`;
    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

// 提取漏洞原理相关阶段的内容（第2、3、5节）
function extractAnalysisContent(markdown: string): Array<{
  stageNum: number;
  title: string;
  content: string;
}> {
  const stages = parseLifecycleStages(markdown);
  const analysisStages = stages.filter(
    stage =>
      stage.stageNum === 2 || // 漏洞引入
      stage.stageNum === 3 || // 漏洞发现
      stage.stageNum === 5 // 漏洞修复
  );

  return analysisStages.map(stage => ({
    stageNum: stage.stageNum ?? 0,
    title: stage.title,
    content: stage.content.trim(),
  }));
}

// 渲染漏洞原理视图
export function renderAnalysisView(markdown: string, container: HTMLElement): void {
  if (!markdown.trim()) {
    container.innerHTML =
      '<div class="analysis-container"><p style="text-align: center; color: #999; padding: 40px;">请在左侧输入 Markdown 内容...</p></div>';
    return;
  }

  const docTitle = extractTitle(markdown);
  const analysisStages = extractAnalysisContent(markdown);

  let html = '<div class="analysis-container">';
  html += `<h1 class="analysis-title">${escapeHtml(docTitle)}</h1>`;

  if (analysisStages.length === 0) {
    html += '<div class="analysis-empty">';
    html +=
      '<p style="text-align: center; color: #999; padding: 40px;">未找到漏洞原理相关内容，请确保文档包含第2节"漏洞引入"、第3节"漏洞发现"或第5节"漏洞修复"的内容。</p>';
    html += '</div>';
  } else {
    html += '<div class="analysis-sections">';

    analysisStages.forEach((stage, index) => {
      const sectionId = `analysis-section-${index}`;
      const stageGradient = `var(--gradient-stage-${stage.stageNum})`;
      const stageBorderColor = `var(--border-color-stage-${stage.stageNum})`;

      html += `<div class="analysis-section" id="${sectionId}" data-stage="${stage.stageNum}">`;
      html += `<div class="analysis-section-header" style="background: ${stageGradient}; border-bottom-color: ${stageBorderColor};">`;
      html += `<div class="analysis-section-number" data-stage="${stage.stageNum}">${stage.stageNum}</div>`;
      html += `<h3 class="analysis-section-title">${escapeHtml(stage.title)}</h3>`;
      html += '</div>';

      if (stage.content) {
        html += `<div class="analysis-section-content">${renderMarkdown(stage.content)}</div>`;
      } else {
        html += '<div class="analysis-section-content"><p class="section-empty">暂无内容</p></div>';
      }

      html += '</div>';
    });

    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

// 子章节接口
interface Subsection {
  title: string;
  level: number; // 标题级别 (3-6)
  content: string;
  isComplete: boolean; // 是否完成（不包含TODO）
}

const TODO_REGEX = /TODO:/i;

// 解析章节的子章节
function parseSubsections(content: string): Subsection[] {
  const subsections: Subsection[] = [];
  const lines = content.split('\n');

  let currentSubsection: { title: string; level: number; contentLines: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测子章节标题（h3-h6）
    const headingMatch = line.match(/^(#{3,6})\s+(.+)$/);
    if (headingMatch) {
      // 保存前一个子章节
      if (currentSubsection) {
        const subsectionContent = currentSubsection.contentLines.join('\n').trim();
        // 检查是否包含TODO（不区分大小写）
        const hasTodo = TODO_REGEX.test(subsectionContent);
        subsections.push({
          title: currentSubsection.title,
          level: currentSubsection.level,
          content: subsectionContent,
          isComplete: !hasTodo,
        });
      }

      // 开始新子章节
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      currentSubsection = {
        title,
        level,
        contentLines: [],
      };
      continue;
    }

    // 收集内容
    if (currentSubsection) {
      currentSubsection.contentLines.push(line);
    }
  }

  // 保存最后一个子章节
  if (currentSubsection) {
    const subsectionContent = currentSubsection.contentLines.join('\n').trim();
    const hasTodo = TODO_REGEX.test(subsectionContent);
    subsections.push({
      title: currentSubsection.title,
      level: currentSubsection.level,
      content: subsectionContent,
      isComplete: !hasTodo,
    });
  }

  return subsections;
}

// 计算阶段的完成度
interface StageCompletion {
  stageNum: number;
  title: string;
  completion: number; // 0-100
  hasContent: boolean;
  hasMetadata: boolean;
  metadataComplete: boolean;
  subsections: Subsection[]; // 子章节列表
  todos: Array<{ location: string; text: string }>;
  details: {
    totalSubsections: number;
    completedSubsections: number;
    metadataScore: number;
  };
}

function calculateStageCompletion(stage: LifecycleStage): StageCompletion {
  const content = stage.content.trim();
  const hasContent = content.length > 0 && content !== '暂无内容';
  const isBasicInfoStage = stage.stageNum === 1 || stage.title.includes('基本信息');

  // 解析子章节
  const subsections = parseSubsections(content);

  // 如果没有子章节，检查整个内容是否包含TODO
  let completion = 0;
  let totalSubsections = 0;
  let completedSubsections = 0;
  let handledByBasicInfoTable = false;
  const todos: Array<{ location: string; text: string }> = [];

  // 基本信息：根据表格行的填充情况计算完成度（含 TODO 判定）
  if (isBasicInfoStage && hasContent) {
    const lines = content.split('\n');
    const tableLines: string[] = [];
    let inTable = false;

    for (const line of lines) {
      if (/^\s*\|.*\|\s*$/.test(line)) {
        tableLines.push(line);
        inTable = true;
      } else if (inTable) {
        // 表格结束
        break;
      }
    }

    const tableRows = tableLines.map(line =>
      line
        .split('|')
        .slice(1, -1)
        .map(cell => cell.trim())
    );
    const isSeparatorRow = (cells: string[]): boolean =>
      cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));

    // 过滤表头和分隔行，仅保留数据行
    const dataRows =
      tableRows.length >= 2 && isSeparatorRow(tableRows[1]) ? tableRows.slice(2) : tableRows;

    if (dataRows.length > 0) {
      totalSubsections = dataRows.length;
      completedSubsections = dataRows.filter(row => {
        if (row.length === 0) return false;
        return row.every(cell => cell.trim() !== '' && !TODO_REGEX.test(cell));
      }).length;

      // 收集表格 TODO 项
      dataRows.forEach(row => {
        const itemName = row[0] ?? 'Item';
        const columns = ['Details', 'Note'];
        row.forEach((cell, idx) => {
          const colName = columns[idx] ?? `Col${idx + 1}`;
          const isEmpty = cell.trim() === '';
          const hasTodo = TODO_REGEX.test(cell);
          if (isEmpty || hasTodo) {
            todos.push({
              location: `${itemName} - ${colName}`,
              text: isEmpty ? '<empty>' : cell,
            });
          }
        });
      });

      completion = Math.round((completedSubsections / totalSubsections) * 100);
      handledByBasicInfoTable = true;
    }
  }

  if (!handledByBasicInfoTable && subsections.length > 0) {
    // 有子章节：根据子章节完成度计算
    totalSubsections = subsections.length;
    completedSubsections = subsections.filter(s => s.isComplete).length;
    completion =
      totalSubsections > 0 ? Math.round((completedSubsections / totalSubsections) * 100) : 0;

    // 收集子章节中的 TODO 行
    subsections.forEach(subsection => {
      if (!subsection.isComplete) {
        subsection.content.split('\n').forEach(line => {
          if (TODO_REGEX.test(line)) {
            todos.push({ location: `${stage.title} - ${subsection.title}`, text: line.trim() });
          }
        });
      }
    });
  } else if (!handledByBasicInfoTable) {
    // 没有子章节：检查整个内容是否包含TODO
    if (hasContent) {
      const hasTodo = TODO_REGEX.test(content);
      if (hasTodo) {
        content.split('\n').forEach(line => {
          if (TODO_REGEX.test(line)) {
            todos.push({ location: stage.title, text: line.trim() });
          }
        });
      }
      completion = hasTodo ? 0 : 100;
    } else {
      completion = 0;
    }
    totalSubsections = 0;
    completedSubsections = 0;
  }

  // 检查值是否为占位符
  function isPlaceholderValue(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return true;

    // 检查常见的占位符关键词
    if (
      trimmed.includes('需要修改') ||
      trimmed.includes('待填写') ||
      trimmed.includes('待完成') ||
      trimmed.includes('待处理') ||
      trimmed.includes('TBD') ||
      trimmed.includes('N/A') ||
      trimmed === '...'
    ) {
      return true;
    }

    // 检查中文占位符文本
    const chinesePlaceholders = [
      '研究者名称',
      '研究机构/公司',
      '开发者名称',
      '研究者',
      '机构',
      '公司',
      '开发者',
    ];
    if (
      chinesePlaceholders.some(
        placeholder => trimmed === placeholder || trimmed.includes(placeholder)
      )
    ) {
      return true;
    }

    // 检查日期占位符：YYYY-MM-DD 格式或默认占位符日期
    if (
      /^YYYY-MM-DD$/i.test(trimmed) ||
      (trimmed.match(/^\d{4}-\d{2}-\d{2}$/) && trimmed.startsWith('2000-01-01'))
    ) {
      return true;
    }

    // 检查版本占位符：vX.Y.Z, vX.X.X, vX.Y.Z 等格式（包含 X, Y, Z 字母的版本号）
    if (/^v[XxYyZz]\.([XxYyZz]|\d+)\.([XxYyZz]|\d+)$/i.test(trimmed)) {
      return true;
    }

    // 检查编号占位符：SA-XXXX, CVE-XXXX 等格式
    if (/^(SA|CVE|CWE)-[Xx]{2,}$/i.test(trimmed)) {
      return true;
    }

    // 检查示例域名
    if (trimmed.includes('example.com') || trimmed.includes('example.org')) {
      return true;
    }

    // 检查常见的占位符 commit hash（如 def5678, abc1234 等简单模式）
    if (
      /^[a-f0-9]{6,8}$/i.test(trimmed) &&
      (trimmed.toLowerCase().startsWith('def') ||
        trimmed.toLowerCase().startsWith('abc') ||
        trimmed.toLowerCase() === 'commit_sha')
    ) {
      return true;
    }

    // 检查 Markdown 链接中的占位符文本
    const linkMatch = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const linkText = linkMatch[1].trim();
      const linkUrl = linkMatch[2].trim();

      // 检查链接文本是否为占位符
      const placeholderTexts = [
        'username',
        'XXX',
        'commit_sha',
        'commit',
        'sha',
        '研究者名称',
        '开发者名称',
        '研究机构/公司',
        '研究者',
        '机构',
        '公司',
        '开发者',
        'vX.X.X',
        'vX.Y.Z',
        'SA-XXXX',
        'def5678',
        'abc1234',
      ];

      // 检查链接文本是否匹配占位符（支持 @username, #XXX 等格式）
      const normalizedLinkText = linkText.toLowerCase();
      if (
        placeholderTexts.some(placeholder => {
          const normalizedPlaceholder = placeholder.toLowerCase();
          return (
            normalizedLinkText === normalizedPlaceholder ||
            normalizedLinkText === '@' + normalizedPlaceholder ||
            normalizedLinkText === '#' + normalizedPlaceholder ||
            normalizedLinkText.includes(normalizedPlaceholder)
          );
        })
      ) {
        return true;
      }

      // 检查链接 URL 是否包含占位符路径或示例域名
      const normalizedUrl = linkUrl.toLowerCase();
      if (
        normalizedUrl.includes('/username') ||
        normalizedUrl.includes('/xxx') ||
        normalizedUrl.includes('/commit_sha') ||
        normalizedUrl.includes('/commit/commit') ||
        normalizedUrl.includes('/pull/xxx') ||
        normalizedUrl.includes('/org/repo') ||
        normalizedUrl.includes('example.com') ||
        normalizedUrl.includes('example.org')
      ) {
        return true;
      }
    }

    return false;
  }

  // 元数据完成度（作为额外加分，最多20分）
  let metadataScore = 0;
  let hasMetadata = false;
  let metadataComplete = false;
  let completeMetadataItems = 0;

  if (!isBasicInfoStage && stage.metadata && stage.metadata.items.length > 0) {
    const totalItems = stage.metadata.items.length;
    completeMetadataItems = stage.metadata.items.filter(item => {
      return !isPlaceholderValue(item.value);
    }).length;

    // 只有当存在有效（非占位符）元数据项时，才认为有元数据
    hasMetadata = completeMetadataItems > 0;

    // 元数据完成度转换为0-20分
    metadataScore = Math.round((completeMetadataItems / Math.max(totalItems, 1)) * 20);
    metadataComplete = completeMetadataItems === totalItems && totalItems > 0;
  }

  // 最终完成度：子章节完成度 + 元数据加分（但不超过100%）
  const finalCompletion = Math.min(100, completion + metadataScore);

  return {
    stageNum: stage.stageNum ?? 0,
    title: stage.title,
    completion: finalCompletion,
    hasContent,
    hasMetadata,
    metadataComplete,
    subsections,
    todos,
    details: {
      totalSubsections,
      completedSubsections,
      metadataScore,
    },
  };
}

// 渲染完成度
export function renderCompletionView(markdown: string, container: HTMLElement): void {
  if (!markdown.trim()) {
    container.innerHTML =
      '<div class="completion-container"><p style="text-align: center; color: #999; padding: 40px;">请在左侧输入 Markdown 内容...</p></div>';
    return;
  }

  const docTitle = extractTitle(markdown);
  const stages = parseLifecycleStages(markdown);

  // 计算所有阶段的完成度
  const completions: StageCompletion[] = [];

  stages.forEach(stage => {
    if (stage.stageNum !== null) {
      completions.push(calculateStageCompletion(stage));
    }
  });

  // 确保所有9个阶段都有数据（即使不存在也显示为0%）
  const STAGE_KEYWORDS: Record<string, number> = {
    基本信息: 1,
    漏洞引入: 2,
    漏洞发现: 3,
    漏洞上报: 4,
    漏洞修复: 5,
    漏洞公告: 6,
    漏洞情报: 7,
    漏洞利用: 8,
    防护: 9,
  };

  const allStages: StageCompletion[] = [];
  for (let i = 1; i <= 9; i++) {
    const existing = completions.find(c => c.stageNum === i);
    if (existing) {
      allStages.push(existing);
    } else {
      // 从配置中获取阶段名称
      const stageTitle =
        Object.keys(STAGE_KEYWORDS).find(key => STAGE_KEYWORDS[key] === i) || `阶段 ${i}`;
      allStages.push({
        stageNum: i,
        title: stageTitle,
        completion: 0,
        hasContent: false,
        hasMetadata: false,
        metadataComplete: false,
        subsections: [],
        todos: [],
        details: {
          totalSubsections: 0,
          completedSubsections: 0,
          metadataScore: 0,
        },
      });
    }
  }

  // 计算总体完成度
  const totalCompletion = Math.round(
    allStages.reduce((sum, stage) => sum + stage.completion, 0) / allStages.length
  );

  let html = '<div class="completion-container">';
  html += `<h1 class="completion-title">${escapeHtml(docTitle)}</h1>`;

  // 总体完成度卡片
  html += '<div class="completion-overview">';
  html += '<div class="completion-overview-card">';
  html += '<div class="completion-overview-header">';
  html += '<h2>总体完成度</h2>';
  html += `<div class="completion-overview-percentage">${totalCompletion}%</div>`;
  html += '</div>';
  html += '<div class="completion-overview-progress">';
  html += `<div class="completion-overview-progress-bar" style="width: ${totalCompletion}%"></div>`;
  html += '</div>';
  html += `<div class="completion-overview-stats">已完成 ${allStages.filter(s => s.completion >= 80).length} / ${allStages.length} 个阶段</div>`;
  html += '</div>';
  html += '</div>';

  // 各阶段完成度列表
  html += '<div class="completion-stages">';

  allStages.forEach(completion => {
    const stageGradient = `var(--gradient-stage-${completion.stageNum})`;
    const completionClass =
      completion.completion >= 80 ? 'high' : completion.completion >= 50 ? 'medium' : 'low';

    html += `<div class="completion-stage" data-stage="${completion.stageNum}">`;
    html += '<div class="completion-stage-header">';
    html += `<div class="completion-stage-number" data-stage="${completion.stageNum}">${completion.stageNum}</div>`;
    html += `<h3 class="completion-stage-title">${escapeHtml(completion.title)}</h3>`;
    html += `<div class="completion-stage-percentage ${completionClass}">${completion.completion}%</div>`;
    html += '</div>';

    html += '<div class="completion-stage-progress">';
    html += `<div class="completion-stage-progress-bar" style="width: ${completion.completion}%; background: ${stageGradient}"></div>`;
    html += '</div>';

    html += '<div class="completion-stage-details">';

    // 显示子章节完成情况
    if (completion.details.totalSubsections > 0) {
      html += '<div class="completion-stage-detail-item">';
      html += `<span class="completion-detail-label">子章节：</span>`;
      html += `<span class="completion-detail-value">`;
      html += `${completion.details.completedSubsections} / ${completion.details.totalSubsections} 已完成`;
      html += '</span>';
      html += '</div>';

      // 显示子章节列表
      if (completion.subsections.length > 0) {
        html += '<div class="completion-subsections">';
        completion.subsections.forEach(subsection => {
          const subsectionClass = subsection.isComplete ? 'complete' : 'incomplete';
          const subsectionIcon = subsection.isComplete ? '✓' : '✗';
          html += `<div class="completion-subsection ${subsectionClass}">`;
          html += `<span class="completion-subsection-icon">${subsectionIcon}</span>`;
          html += `<span class="completion-subsection-title">${escapeHtml(subsection.title)}</span>`;
          html += '</div>';
        });
        html += '</div>';
      }
    } else {
      // 没有子章节时显示内容状态
      html += '<div class="completion-stage-detail-item">';
      html += `<span class="completion-detail-label">内容：</span>`;
      html += `<span class="completion-detail-value ${completion.hasContent ? 'complete' : 'incomplete'}">`;
      html += completion.hasContent ? '✓ 已填写' : '✗ 未填写';
      html += '</span>';
      html += '</div>';
    }

    // 基本信息阶段不统计元数据
    if (completion.stageNum !== 1) {
      html += '<div class="completion-stage-detail-item">';
      html += `<span class="completion-detail-label">元数据：</span>`;
      if (completion.hasMetadata) {
        html += `<span class="completion-detail-value ${completion.metadataComplete ? 'complete' : 'partial'}">`;
        html += completion.metadataComplete ? '✓ 完整' : '⚠ 部分填写';
        html += ` (+${completion.details.metadataScore}%)</span>`;
      } else {
        html += '<span class="completion-detail-value incomplete">✗ 未填写</span>';
      }
      html += '</div>';
    }

    // TODO 详情
    html += '<div class="completion-stage-detail-item">';
    html += `<span class="completion-detail-label">TODO：</span>`;
    if (completion.todos && completion.todos.length > 0) {
      html += '<div class="completion-detail-value">';
      html += '<div class="completion-todos">';
      completion.todos.forEach(todo => {
        html += `<div class="completion-todo-item"><span class="completion-todo-location">${escapeHtml(todo.location)}</span>: <span class="completion-todo-text">${escapeHtml(todo.text)}</span></div>`;
      });
      html += '</div>';
      html += '</div>';
    } else {
      html += '<span class="completion-detail-value complete">无 TODO</span>';
    }
    html += '</div>';
    html += '</div>';

    html += '</div>';
  });

  html += '</div>';
  html += '</div>';

  container.innerHTML = html;
}
