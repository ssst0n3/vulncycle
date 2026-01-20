import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { parseLifecycleStages, extractTitle, type LifecycleStage, type StageMetadata, type MetadataItem } from './parser.js';

// HTML 转义函数
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 确保代码块有 hljs 类（后处理函数）
function ensureHljsClass(html: string): string {
  // 使用正则表达式为所有 code 标签添加 hljs 类（如果还没有）
  return html.replace(
    /<code\s+class="([^"]*language-[^"]*)"([^>]*)>/g,
    (match, classes, rest) => {
      // 如果已经有 hljs 类，不重复添加
      if (classes.includes('hljs')) {
        return match;
      }
      // 添加 hljs 类
      return `<code class="hljs ${classes}"${rest}>`;
    }
  );
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

// 获取阶段的主要时间（用于排序）
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
  
  // 移除 markdown 语法标记，只保留文本
  const text = content
    .replace(/^#{1,6}\s+/gm, '') // 移除标题标记
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // 移除链接，保留文本
    .replace(/`([^`]+)`/g, '$1') // 移除行内代码标记
    .replace(/\*\*([^*]+)\*\*/g, '$1') // 移除加粗标记
    .replace(/\*([^*]+)\*/g, '$1') // 移除斜体标记
    .replace(/^\s*[-*+]\s+/gm, '') // 移除列表标记
    .replace(/^\s*\d+\.\s+/gm, '') // 移除有序列表标记
    .trim();
  
  // 提取第一段或前几行
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return '';
  
  let summary = lines[0];
  for (let i = 1; i < Math.min(lines.length, 3); i++) {
    if ((summary + ' ' + lines[i]).length <= maxLength) {
      summary += ' ' + lines[i];
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

function applyStageSubsectionsWithState(stageBody: HTMLElement, subsectionStates?: Map<string, boolean>): void {
  if (!stageBody.querySelector(subsectionHeadingSelector)) {
    console.log('[Subsection] 没有发现子章节标题，跳过处理');
    return;
  }

  console.log('[Subsection] 开始处理子章节，传入状态数量:', subsectionStates?.size ?? 0);
  
  // 使用传入的状态，如果没有传入则尝试捕获当前状态
  let expandedSubsectionTitles = new Set<string>();
  
  if (subsectionStates) {
    // 使用传入的状态
    for (const [title, isExpanded] of subsectionStates.entries()) {
      if (isExpanded) {
        expandedSubsectionTitles.add(title);
        console.log('[Subsection] 使用传入状态 - 展开:', title);
      }
    }
  } else {
    // 如果没有传入状态，尝试捕获当前状态
    const existingSubsections = stageBody.querySelectorAll('.stage-subsection.expanded');
    existingSubsections.forEach((subsection) => {
      const heading = subsection.querySelector(subsectionHeadingSelector);
      if (heading) {
        const titleText = heading.textContent?.trim() || '';
        expandedSubsectionTitles.add(titleText);
        console.log('[Subsection] 捕获已展开的子章节:', titleText);
      }
    });
  }

  const fragment = document.createDocumentFragment();
  const childNodes = Array.from(stageBody.childNodes);
  const sectionStack: Array<{ level: number; body: HTMLElement }> = [];

  childNodes.forEach((node) => {
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
        const titleText = element.textContent?.trim() || '';
        const wasExpanded = expandedSubsectionTitles.has(titleText);
        
        const section = document.createElement('div');
        section.className = wasExpanded ? 'stage-subsection expanded' : 'stage-subsection collapsed';

        const header = document.createElement('div');
        header.className = 'stage-subsection-header';

        const icon = document.createElement('span');
        icon.className = 'stage-subsection-toggle-icon';
        icon.textContent = wasExpanded ? '▼' : '▶';

        if (wasExpanded) {
          console.log('[Subsection] 恢复展开状态:', titleText);
        }

        header.appendChild(icon);
        header.appendChild(element);
        section.appendChild(header);

        const body = document.createElement('div');
        body.className = 'stage-subsection-body';
        section.appendChild(body);

        const parentBody = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1].body : null;
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
  console.log('[Subsection] 子章节处理完成');
}

// 保留旧函数签名以兼容其他调用
function applyStageSubsections(stageBody: HTMLElement): void {
  applyStageSubsectionsWithState(stageBody);
}

function applyLifecycleSubsections(container: HTMLElement): void {
  const bodies = container.querySelectorAll<HTMLElement>('.stage-body');
  bodies.forEach((body) => applyStageSubsectionsWithState(body));
}

// 语言别名映射（将常见别名映射到 highlight.js 支持的语言）
const languageAliases: Record<string, string> = {
  'shell': 'bash',  // shell 映射到 bash
  'zsh': 'bash',    // zsh 也使用 bash 高亮
  'console': 'bash', // console 映射到 bash
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
            console.warn(`Failed to highlight code with language "${normalizedLang}":`, err);
            return escapeHtml(code);
          }
        }
      }
      // 如果没有指定语言或语言不支持，尝试自动检测
      try {
        const highlighted = hljs.highlightAuto(code);
        return highlighted.value;
      } catch (err) {
        console.warn('Failed to auto-highlight code:', err);
        return escapeHtml(code);
      }
    },
  })
);

// 配置 marked 的其他选项
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  mangle: false,
});

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

// 渲染元数据HTML（仅渲染前几个关键元数据，单行显示）
function renderMetadataHtml(metadata: StageMetadata | undefined, maxItems: number = 5): string {
  if (!metadata || metadata.items.length === 0) {
    return '';
  }
  
  // 定义类型优先级：时间 > 版本 > 人员 > 链接 > 文本
  const typePriority: Record<MetadataItem['type'], number> = {
    'time': 1,
    'version': 2,
    'person': 3,
    'link': 4,
    'text': 5,
  };
  
  // 按优先级排序元数据项
  const sortedItems = [...metadata.items].sort((a, b) => {
    const priorityDiff = typePriority[a.type] - typePriority[b.type];
    if (priorityDiff !== 0) return priorityDiff;
    // 同类型按原始顺序
    return 0;
  });
  
  // 只取前 maxItems 个
  const displayItems = sortedItems.slice(0, maxItems);
  
  let html = '<div class="stage-metadata">';
  
  displayItems.forEach(item => {
    const itemClass = `metadata-item metadata-${item.type}-item`;
    html += `<div class="${itemClass}">`;
    
    if (item.icon) {
      html += `<span class="metadata-icon">${item.icon}</span>`;
    }
    
    html += `<span class="metadata-label">${escapeHtml(item.label)}</span>`;
    
    // 渲染链接
    if (item.type === 'link') {
      // 尝试解析 Markdown 链接格式 [text](url)
      const mdLink = parseMarkdownLink(item.value);
      if (mdLink) {
        html += `<a class="metadata-value metadata-link" href="${escapeHtml(mdLink.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(mdLink.text)}</a>`;
      }
      // 直接 URL 格式
      else if (item.value.startsWith('http') || item.value.includes('://')) {
        html += `<a class="metadata-value metadata-link" href="${escapeHtml(item.value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.value)}</a>`;
      }
      // 普通文本
      else {
        html += `<span class="metadata-value">${escapeHtml(item.value)}</span>`;
      }
    } else {
      html += `<span class="metadata-value">${escapeHtml(item.value)}</span>`;
    }
    
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
  const yearChars = yearWithDash.split('').map(char => `<span class="date-year-digit">${char}</span>`).join('');
  
  // 右列：月日的每一位数字和分隔符竖向排列（月份 + "-" + 日期）
  const monthDayWithDash = month + '-' + day;
  const monthDayChars = monthDayWithDash.split('').map(char => `<span class="date-month-day-char">${char}</span>`).join('');
  
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

function renderTimeBarHtml(timeInfo: TimeInfo[]): string {
  return timeInfo
    .map((time) => {
      const timeLabel =
        time.timestamp !== null
          ? `<span class="time-label-name">${escapeHtml(time.label)}</span><span class="time-label-value">${escapeHtml(time.value)}</span>`
          : `<span class="time-label-name">${escapeHtml(time.label)}</span><span class="time-label-value time-label-pending">${escapeHtml(time.value)}</span>`;
      return `<div class="time-item">${timeLabel}</div>`;
    })
    .join('');
}

function renderTimelineMarkerHtml(timeNode: TimeNode, isBasicInfoOnly: boolean): string {
  const hasTimestamp = timeNode.timestamp !== null;
  if (hasTimestamp && timeNode.timestamp) {
    return `<div class="timeline-date-label">${formatDate(timeNode.timestamp)}</div>`;
  }
  if (!isBasicInfoOnly) {
    const unknownChars = '未指定'.split('').map(char => `<span class="unknown-char">${escapeHtml(char)}</span>`).join('');
    return `<div class="timeline-date-label timeline-date-unknown"><div class="unknown-column">${unknownChars}</div></div>`;
  }
  return '';
}

// 按时间分组阶段
function groupStagesByTime(stages: LifecycleStage[]): TimeNode[] {
  const timeMap = new Map<number | string, TimeNode>();
  
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
    }
    
    timeMap.get(key)!.stages.push({
      stage,
      timeInfo,
      primaryTimestamp,
    });
  });
  
  // 转换为数组并排序
  const timeNodes: TimeNode[] = Array.from(timeMap.values());
  
  // 分离"基本信息"阶段和其他阶段
  const basicInfoNodes: TimeNode[] = [];
  const otherNodes: TimeNode[] = [];
  
  timeNodes.forEach(node => {
    const hasBasicInfo = node.stages.some(s => s.stage.stageNum === 1);
    if (hasBasicInfo) {
      basicInfoNodes.push(node);
    } else {
      otherNodes.push(node);
    }
  });
  
  // 分离有时间和无时间的其他节点
  const otherNodesWithTime = otherNodes.filter(n => n.timestamp !== null);
  const otherNodesWithoutTime = otherNodes.filter(n => n.timestamp === null);
  
  // 按时间戳排序（从早到晚）
  otherNodesWithTime.sort((a, b) => (a.timestamp as number) - (b.timestamp as number));
  
  // 合并：先显示"基本信息"，再显示其他有时间戳的，最后显示无时间戳的
  return [...basicInfoNodes, ...otherNodesWithTime, ...otherNodesWithoutTime];
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
      const { stage, timeInfo } = timeNode.stages[stageIndex];
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

      const body = stageElement.querySelector<HTMLElement>('.stage-body');
      if (!body) {
        return false;
      }

      // 更新元数据区域
      const stageCard = stageElement.querySelector('.stage-card');
      if (stageCard) {
        const existingMetadata = stageCard.querySelector('.stage-metadata');
        if (stage.metadata && stage.metadata.items.length > 0) {
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
          // 移除元数据
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
      console.log('[Update] 更新 stage body 内容前，捕获子章节状态');
      const subsectionStates = new Map<string, boolean>();
      const existingSubsections = body.querySelectorAll('.stage-subsection');
      existingSubsections.forEach((subsection) => {
        const heading = subsection.querySelector(subsectionHeadingSelector);
        if (heading) {
          const titleText = heading.textContent?.trim() || '';
          const isExpanded = subsection.classList.contains('expanded');
          subsectionStates.set(titleText, isExpanded);
          if (isExpanded) {
            console.log('[Update] 记录展开的子章节:', titleText);
          }
        }
      });

      if (stage.content.trim()) {
        body.innerHTML = `${ensureHljsClass(marked.parse(stage.content.trim()))}`;
      } else {
        body.innerHTML = '<p class="stage-empty">暂无内容</p>';
      }
      
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
      html += `<div class="stage-content">${ensureHljsClass(marked.parse(content))}</div>`;
    } else {
      html += '<div class="stage-content"><p style="text-align: center; color: #999; padding: 40px;">请在左侧输入 Markdown 内容...</p></div>';
    }
    html += '</div>';
  } else {
    // 按时间分组阶段
    const timeNodes = groupStagesByTime(stages);
    
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
      
      // 计算时间范围（如果有多个时间点）
      const allTimestamps = timeNode.stages
        .flatMap(s => s.timeInfo.map(t => t.timestamp))
        .filter((t): t is number => t !== null)
        .sort((a, b) => a - b);
      
      const minTimestamp = allTimestamps.length > 0 ? allTimestamps[0] : null;
      const maxTimestamp = allTimestamps.length > 0 ? allTimestamps[allTimestamps.length - 1] : null;
      const hasTimeRange = minTimestamp !== null && maxTimestamp !== null && minTimestamp !== maxTimestamp;
      
      // 时间节点组
      html += `<div class="timeline-node-group" data-timestamp="${timeNode.timestamp ?? ''}" data-index="${nodeIndex}">`;
      
      // 时间轴标记（左侧）
      html += '<div class="timeline-marker">';
      if (hasTimestamp && timeNode.timestamp) {
        html += `<div class="timeline-date-label">${dateStr}</div>`;
      } else if (!isBasicInfoOnly) {
        // 只有非基本信息节点才显示"未指定"，竖向1列显示
        const unknownChars = '未指定'.split('').map(char => `<span class="unknown-char">${escapeHtml(char)}</span>`).join('');
        html += `<div class="timeline-date-label timeline-date-unknown"><div class="unknown-column">${unknownChars}</div></div>`;
      }
      // 基本信息节点如果没有时间戳，不显示任何标记
      html += '</div>';
      
      // 内容区域（右侧）
      html += '<div class="timeline-content-area">';
      
      // 该时间点的所有阶段
      html += '<div class="timeline-stages-container">';
      
      timeNode.stages.forEach(({ stage, timeInfo, primaryTimestamp }, stageIndex) => {
        const stageNum = stage.stageNum ?? '?';
        const content = stage.content.trim();
        const summary = extractSummary(content);

        html += `<div class="lifecycle-stage collapsed" data-stage="${stageNum}" data-node-index="${nodeIndex}" data-stage-index="${stageIndex}">`;
        
        html += '<div class="stage-card">';
        
        // 阶段头部
        html += '<div class="stage-header">';
        html += '<div class="stage-header-left">';
        html += `<div class="stage-number-badge" data-stage="${stageNum}">${stageNum}</div>`;
        html += `<span class="stage-header-title">${escapeHtml(stage.title)}</span>`;
        html += '</div>';
        
        // 元数据区域（显示在标题右侧）
        if (stage.metadata) {
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
          html += `<div class="stage-body">${ensureHljsClass(marked.parse(content))}</div>`;
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
    html += '<p style="text-align: center; color: #999; padding: 40px;">未找到漏洞利用相关内容，请确保文档包含第8节"漏洞利用"的内容。</p>';
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
        html += `<div class="exploitability-section-content">${ensureHljsClass(marked.parse(section.content))}</div>`;
      } else {
        html += '<div class="exploitability-section-content"><p class="section-empty">暂无内容</p></div>';
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
    html += '<p style="text-align: center; color: #999; padding: 40px;">未找到漏洞情报相关内容，请确保文档包含第7节"漏洞情报"的内容。</p>';
    html += '</div>';
  } else {
    html += '<div class="intelligence-content">';
    html += `${ensureHljsClass(marked.parse(content))}`;
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
  const analysisStages = stages.filter(stage => 
    stage.stageNum === 2 || // 漏洞引入
    stage.stageNum === 3 || // 漏洞发现
    stage.stageNum === 5    // 漏洞修复
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
    html += '<p style="text-align: center; color: #999; padding: 40px;">未找到漏洞原理相关内容，请确保文档包含第2节"漏洞引入"、第3节"漏洞发现"或第5节"漏洞修复"的内容。</p>';
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
        html += `<div class="analysis-section-content">${ensureHljsClass(marked.parse(stage.content))}</div>`;
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

