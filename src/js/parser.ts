import { extractStageNumber } from './config.js';

// 元数据项接口
export interface MetadataItem {
  label: string; // 字段标签
  value: string; // 字段值
  type: 'time' | 'person' | 'version' | 'link' | 'text'; // 字段类型
  icon?: string; // 图标(可选)
}

// 章节元数据接口
export interface StageMetadata {
  items: MetadataItem[]; // 元数据项列表
}

// 生命周期阶段接口
export interface LifecycleStage {
  title: string;
  stageNum: number | null;
  content: string;
  metadata?: StageMetadata; // 元数据(可选)
}

// 解析 Markdown 并提取生命周期阶段
export function parseLifecycleStages(markdown: string): LifecycleStage[] {
  const stages: LifecycleStage[] = [];
  const lines = markdown.split('\n');
  let currentStage: { title: string; stageNum: number | null } | null = null;
  let currentContent: string[] = [];
  let inFrontMatter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 处理 front matter
    if (line.match(/^---\s*$/)) {
      inFrontMatter = !inFrontMatter;
      continue;
    }
    if (inFrontMatter) {
      continue;
    }

    // 检测二级标题（##）
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      // 保存前一个阶段
      if (currentStage) {
        const content = currentContent.join('\n').trim();
        const metadata = extractStageMetadata(content);
        stages.push({
          title: currentStage.title,
          stageNum: currentStage.stageNum,
          content,
          metadata: metadata.items.length > 0 ? metadata : undefined,
        });
      }

      // 开始新阶段
      const title = h2Match[1].trim();
      const stageNum = extractStageNumber(title);
      currentStage = { title, stageNum };
      currentContent = [];
      continue;
    }

    // 检测一级标题（#）- 作为文档标题，跳过
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match && !currentStage) {
      continue;
    }

    // 收集内容
    if (currentStage) {
      currentContent.push(line);
    }
  }

  // 保存最后一个阶段
  if (currentStage) {
    const content = currentContent.join('\n').trim();
    const metadata = extractStageMetadata(content);
    stages.push({
      title: currentStage.title,
      stageNum: currentStage.stageNum,
      content,
      metadata: metadata.items.length > 0 ? metadata : undefined,
    });
  }

  return stages;
}

// 提取文档标题
export function extractTitle(markdown: string): string {
  const lines = markdown.split('\n');
  // 跳过 front matter
  let inFrontMatter = false;
  for (const line of lines) {
    if (line.match(/^---\s*$/)) {
      inFrontMatter = !inFrontMatter;
      continue;
    }
    if (inFrontMatter) continue;

    const match = line.match(/^#\s+(.+)$/);
    if (match) {
      return match[1].trim();
    }
  }
  return '漏洞研究报告';
}

// 提取章节元数据（只提取章节开头区域的元数据，在第一个子标题之前）
export function extractStageMetadata(content: string): StageMetadata {
  const items: MetadataItem[] = [];
  const lines = content.split('\n');
  
  // 时间相关的关键字
  const timeKeywords = ['时间', 'date', 'time'];
  // 人员相关的关键字
  const personKeywords = ['者', '人员', '研究者', '提交者', '审查者', '开发者', '发现者', 'author', 'researcher', 'developer'];
  // 版本相关的关键字
  const versionKeywords = ['版本', 'version', 'release'];
  // 链接相关的关键字
  const linkKeywords = ['PR', 'Commit', 'CVE', 'CWE', 'URL', 'Link', '链接', '地址'];
  
  // 用于记录已处理的行,避免重复提取
  const processedLines = new Set<number>();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 遇到子标题（### 或更低级别）时停止提取，只提取章节开头区域的元数据
    if (line.match(/^#{3,}\s+/)) {
      break;
    }
    
    // 跳过已处理的行
    if (processedLines.has(i)) {
      continue;
    }
    
    // 匹配列表项格式：- **字段名**：值
    // 支持中文冒号和英文冒号
    const match = line.match(/^-\s*\*\*([^*]+)\*\*[：:]\s*(.+)$/);
    if (!match) {
      continue;
    }
    
    const label = match[1].trim();
    let value = match[2].trim();
    
    // 跳过空值或占位符
    if (!value || value === '...' || value === 'N/A' || value === 'TBD') {
      continue;
    }
    
    // 处理可能的括号内容(如"需要修改")
    if (value.includes('需要修改') || value.includes('待填写')) {
      continue; // 跳过未填写的字段
    }
    
    // 检查是否为 Markdown 链接格式 [text](url)
    const isMarkdownLink = /^\[.+\]\(.+\)$/.test(value);
    
    // 如果不是 Markdown 链接，移除括号内的注释内容（如 "2024-01-01 (待修改)"）
    if (!isMarkdownLink) {
      value = value.replace(/\s*\([^)]*\)\s*$/, '').trim();
    }
    
    // 判断字段类型
    let type: MetadataItem['type'] = 'text';
    let icon: string | undefined;
    
    // 检查是否为时间类型
    if (timeKeywords.some(keyword => label.includes(keyword))) {
      type = 'time';
      icon = '🕒';
    }
    // 检查是否为人员类型
    else if (personKeywords.some(keyword => label.includes(keyword))) {
      type = 'person';
      icon = '👤';
    }
    // 检查是否为版本类型
    else if (versionKeywords.some(keyword => label.toLowerCase().includes(keyword.toLowerCase()))) {
      type = 'version';
      icon = '📦';
    }
    // 检查是否为链接类型
    else if (linkKeywords.some(keyword => label.includes(keyword)) || value.startsWith('http') || value.includes('://')) {
      type = 'link';
      icon = '🔗';
    }
    
    // 添加到元数据列表
    items.push({
      label,
      value,
      type,
      icon,
    });
    
    processedLines.add(i);
  }
  
  return { items };
}

