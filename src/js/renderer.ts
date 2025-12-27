import { marked } from 'marked';
import { parseLifecycleStages, extractTitle, type LifecycleStage } from './parser.js';

// HTML 转义函数
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

// 渲染生命周期视图
export function renderLifecycleView(markdown: string, container: HTMLElement): void {
  if (!markdown.trim()) {
    container.innerHTML =
      '<div class="lifecycle-container"><p style="text-align: center; color: #999; padding: 40px;">请在左侧输入 Markdown 内容...</p></div>';
    return;
  }

  const title = extractTitle(markdown);
  const stages = parseLifecycleStages(markdown);

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
    html += '<div class="lifecycle-stages">';

    stages.forEach((stage: LifecycleStage) => {
      const stageNum = stage.stageNum ?? '?';
      const content = stage.content.trim();
      const summary = extractSummary(content);

      html += `<div class="lifecycle-stage collapsed" data-stage="${stageNum}">`;
      html += `<div class="stage-indicator"></div>`;
      html += '<div class="stage-content">';
      html += '<div class="stage-header">';
      html += '<span class="stage-header-title">' + escapeHtml(stage.title) + '</span>';
      html += '<span class="stage-toggle-icon">▼</span>';
      html += '</div>';
      
      if (summary) {
        html += `<div class="stage-summary">${escapeHtml(summary)}</div>`;
      }

      if (content) {
        html += `<div class="stage-body">${marked.parse(content)}</div>`;
      } else {
        html +=
          '<div class="stage-body"><p style="color: #999; font-style: italic;">暂无内容</p></div>';
      }

      html += '</div>';
      html += '</div>';
    });

    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

