import { extractStageNumber } from './config.js';

// 生命周期阶段接口
export interface LifecycleStage {
  title: string;
  stageNum: number | null;
  content: string;
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
        stages.push({
          title: currentStage.title,
          stageNum: currentStage.stageNum,
          content: currentContent.join('\n').trim(),
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
    stages.push({
      title: currentStage.title,
      stageNum: currentStage.stageNum,
      content: currentContent.join('\n').trim(),
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

