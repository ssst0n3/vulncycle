/**
 * 保存位置统一表示模块
 * Local / Gist / Repo 三种保存模式统一为 scheme://path 形式：
 *   local  -> local://browser
 *   gist   -> gist://<gistId>/<filename>
 *   repo   -> github://<owner>/<repo>@<branch>/<path>
 */

export type SaveMode = 'local' | 'gist' | 'repo';

export interface SaveLocationInput {
  mode: SaveMode;
  gistId?: string;
  filename?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  path?: string;
}

export function formatSaveLocation(input: SaveLocationInput): string {
  if (input.mode === 'local') {
    return 'local://browser';
  }
  if (input.mode === 'gist') {
    const gistId = input.gistId?.trim() || '(新建)';
    const filename = input.filename?.trim() || 'reports/{{date}}.md';
    return `gist://${gistId}/${filename}`;
  }
  const owner = input.owner?.trim() || '?';
  const repo = input.repo?.trim() || '?';
  const branch = input.branch?.trim() || 'main';
  const path = input.path?.trim() || 'reports/{{date}}.md';
  return `github://${owner}/${repo}@${branch}/${path}`;
}
