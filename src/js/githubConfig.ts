import type { GithubMode } from './githubClient.js';

const STORAGE_KEY = 'vci_github_config';

export type GithubConfig = {
  mode: GithubMode;
  token: string;
  rememberToken: boolean;
  gistId: string;
  gistFilename: string;
  repoOwner: string;
  repoName: string;
  repoBranch: string;
  repoPath: string;
  commitMessage: string;
};

const DEFAULT_CONFIG: GithubConfig = {
  mode: 'local',
  token: '',
  rememberToken: false,
  gistId: '',
  gistFilename: 'reports/{{date}}.md',
  repoOwner: '',
  repoName: '',
  repoBranch: 'main',
  repoPath: 'reports/{{date}}.md',
  commitMessage: 'chore: save report {{datetime}}',
};

export function loadGithubConfig(): GithubConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      token: parsed.rememberToken ? (parsed.token ?? '') : '',
    };
  } catch (error) {
    console.error('Failed to load GitHub config:', error);
    return { ...DEFAULT_CONFIG };
  }
}

export function saveGithubConfig(config: GithubConfig): void {
  try {
    const persistToken = config.rememberToken ? config.token : '';
    const payload = { ...config, token: persistToken };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to save GitHub config:', error);
  }
}

export function clearGithubToken(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.token = '';
    parsed.rememberToken = false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch (error) {
    console.error('Failed to clear GitHub token:', error);
  }
}

export function applyTemplate(value: string): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const datetime = now.toISOString().replace(/[:]/g, '-');
  return value.replace(/{{date}}/g, date).replace(/{{datetime}}/g, datetime);
}
