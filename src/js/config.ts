// 生命周期阶段关键词映射
export const STAGE_KEYWORDS: Record<string, number> = {
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

// 从标题中提取阶段编号
export function extractStageNumber(title: string): number | null {
  // 首先尝试匹配 "数字. 阶段名" 格式
  const match = title.match(/^(\d+)\.?\s*.+$/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 9) {
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

