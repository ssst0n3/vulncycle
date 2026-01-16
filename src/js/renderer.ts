import { marked } from 'marked';
import { parseLifecycleStages, extractTitle, type LifecycleStage } from './parser.js';

// HTML 转义函数
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

// 配置 marked 解析器
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  mangle: false,
});

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
      html += `<div class="stage-content">${marked.parse(content)}</div>`;
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
        
        // 时间信息条（移动到标题右侧）
        if (timeInfo.length > 0) {
          html += '<div class="stage-time-bar">';
          timeInfo.forEach(time => {
            const timeLabel = time.timestamp !== null 
              ? `<span class="time-label-name">${escapeHtml(time.label)}</span><span class="time-label-value">${escapeHtml(time.value)}</span>`
              : `<span class="time-label-name">${escapeHtml(time.label)}</span><span class="time-label-value time-label-pending">${escapeHtml(time.value)}</span>`;
            html += `<div class="time-item">${timeLabel}</div>`;
          });
          html += '</div>';
        }
        
        html += '<span class="stage-toggle-icon">▼</span>';
        html += '</div>';
        
        // 摘要（仅在折叠时显示）
        if (summary) {
          html += `<div class="stage-summary">${escapeHtml(summary)}</div>`;
        }

        // 阶段内容
        if (content) {
          html += `<div class="stage-body">${marked.parse(content)}</div>`;
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
        html += `<div class="exploitability-section-content">${marked.parse(section.content)}</div>`;
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
    html += `${marked.parse(content)}`;
    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

