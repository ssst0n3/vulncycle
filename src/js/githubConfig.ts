import type { GithubMode } from './githubClient.js';
import { logger } from './logger.js';

const STORAGE_KEY = 'vci_github_config';

/**
 * 全局配置：仅保留凭据与偏好（跨报告共享）。
 * 云端保存目标（Gist/Repo 字段）按报告存储，见 GithubTarget。
 */
export type GithubConfig = {
  token: string;
  rememberToken: boolean;
  commitMessage: string;
};

/** 单篇报告的云端保存目标（存于 ArticleMeta.github，未配置则无此字段） */
export interface GithubTarget {
  mode: GithubMode;
  gistId: string;
  gistFilename: string;
  repoOwner: string;
  repoName: string;
  repoBranch: string;
  repoPath: string;
}

/** 全局配置 + 报告目标的合并形状（设置弹窗内的生效配置） */
export type EffectiveGithubConfig = GithubConfig & GithubTarget;

const DEFAULT_CONFIG: GithubConfig = {
  token: '',
  rememberToken: false,
  commitMessage: 'chore: save report {{datetime}}',
};

/** 新报告/未配置报告的干净云端目标：Local 模式，零继承 */
export const DEFAULT_GITHUB_TARGET: GithubTarget = {
  mode: 'local',
  gistId: '',
  gistFilename: 'reports/{{date}}.md',
  repoOwner: '',
  repoName: '',
  repoBranch: 'main',
  repoPath: 'reports/{{date}}.md',
};

export function defaultGithubTarget(): GithubTarget {
  return { ...DEFAULT_GITHUB_TARGET };
}

/** 是否与干净默认完全一致（用于避免给未配置过的报告写入无意义快照） */
export function isDefaultTarget(target: GithubTarget): boolean {
  return (Object.keys(DEFAULT_GITHUB_TARGET) as (keyof GithubTarget)[]).every(
    key => target[key] === DEFAULT_GITHUB_TARGET[key]
  );
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * 规范化报告云端目标：
 * - 兼容旧磁盘字段名（filename/owner/repo/branch/path）
 * - 缺省字段回退到干净默认
 * - 非法 mode 回退为 gist（历史绑定只可能是云端模式）
 */
export function normalizeGithubTarget(raw: unknown): GithubTarget {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const mode: GithubTarget['mode'] =
    record.mode === 'local' || record.mode === 'gist' || record.mode === 'repo'
      ? record.mode
      : 'gist';
  return {
    mode,
    gistId: asString(record.gistId, DEFAULT_GITHUB_TARGET.gistId),
    gistFilename: asString(
      record.gistFilename ?? record.filename,
      DEFAULT_GITHUB_TARGET.gistFilename
    ),
    repoOwner: asString(record.repoOwner ?? record.owner, DEFAULT_GITHUB_TARGET.repoOwner),
    repoName: asString(record.repoName ?? record.repo, DEFAULT_GITHUB_TARGET.repoName),
    repoBranch: asString(record.repoBranch ?? record.branch, DEFAULT_GITHUB_TARGET.repoBranch),
    repoPath: asString(record.repoPath ?? record.path, DEFAULT_GITHUB_TARGET.repoPath),
  };
}

export function loadGithubConfig(): GithubConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // 显式挑键：旧版本残留在存储中的云端目标字段（mode/gistId/repo* 等）不再读取，
    // 下次 saveGithubConfig 写入新形状时自然清除
    return {
      token: parsed.rememberToken === true ? asString(parsed.token, '') : '',
      rememberToken: parsed.rememberToken === true,
      commitMessage: asString(parsed.commitMessage, DEFAULT_CONFIG.commitMessage),
    };
  } catch (error) {
    logger.error('Failed to load GitHub config:', error);
    return { ...DEFAULT_CONFIG };
  }
}

export function saveGithubConfig(config: GithubConfig): void {
  try {
    const persistToken = config.rememberToken ? config.token : '';
    const payload = { ...config, token: persistToken };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    logger.error('Failed to save GitHub config:', error);
  }
}

export function clearGithubToken(): void {
  // 经 load/save 往返重写存储，顺带清除旧版本残留的云端目标字段
  saveGithubConfig({ ...loadGithubConfig(), token: '', rememberToken: false });
}

export function applyTemplate(value: string): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const datetime = now.toISOString().replace(/[:]/g, '-');
  return value.replace(/{{date}}/g, date).replace(/{{datetime}}/g, datetime);
}
