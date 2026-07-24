// 生命周期阶段关键词映射
export const STAGE_KEYWORDS: Record<string, number> = {
  基本信息: 1,
  漏洞引入: 2,
  漏洞发现: 3,
  漏洞上报: 4,
  漏洞修复: 5,
  漏洞公告: 6,
  漏洞情报: 7,
  漏洞分析: 8,
  漏洞利用: 9,
  防护: 10,
};

// 中文序号映射（用于二级标题，如 "一、基本信息"）
const CHINESE_STAGE_NUMBERS: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

// 从标题中提取阶段编号
export function extractStageNumber(title: string): number | null {
  // 首先尝试匹配中文序号格式，如 "一、基本信息"
  const chineseMatch = title.match(/^([一二三四五六七八九十])、/);
  if (chineseMatch) {
    const num = CHINESE_STAGE_NUMBERS[chineseMatch[1]];
    if (num !== undefined) {
      return num;
    }
  }

  // 尝试匹配 "数字. 阶段名" 格式
  const match = title.match(/^(\d+)\.?\s*.+$/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 10) {
      return num;
    }
  }

  // 尝试通过关键词匹配
  for (const [keyword, num] of Object.entries(STAGE_KEYWORDS)) {
    if (title.includes(keyword)) {
      return num;
    }
  }

  return null;
}

// 去除阶段标题中的中文序号前缀（如 "一、基本信息" → "基本信息"）
export function stripStageNumberPrefix(title: string): string {
  return title.replace(/^[一二三四五六七八九十]、\s*/, '').trim();
}
