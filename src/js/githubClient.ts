export type GithubMode = 'local' | 'gist' | 'repo';

export type GithubResult<T> = {
  ok: boolean;
  data?: T;
  status?: number;
  error?: string;
};

type Fetcher = typeof fetch;

const API_BASE = 'https://api.github.com';

const headers = (token: string): HeadersInit => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
});

const encodeContent = (content: string): string => {
  // btoa 需要处理非 ASCII 内容
  return btoa(unescape(encodeURIComponent(content)));
};

export type GistSaveParams = {
  token: string;
  gistId?: string;
  filename: string;
  content: string;
  description?: string;
  fetcher?: Fetcher;
};

export type GistReadParams = {
  token: string;
  gistId: string;
  filename?: string;
  fetcher?: Fetcher;
};

export type RepoSaveParams = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  message: string;
  content: string;
  fetcher?: Fetcher;
};

export type RepoReadParams = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  fetcher?: Fetcher;
};

type RepoContentResponse = {
  sha: string;
  content: string;
  encoding: string;
};

export async function saveToGist(
  params: GistSaveParams
): Promise<GithubResult<{ gistId: string }>> {
  const {
    token,
    gistId,
    filename,
    content,
    description = 'VulnCycleInsight report',
    fetcher = fetch,
  } = params;
  const url = gistId ? `${API_BASE}/gists/${gistId}` : `${API_BASE}/gists`;
  const method = gistId ? 'PATCH' : 'POST';
  const body = JSON.stringify({
    description,
    files: {
      [filename]: { content },
    },
  });

  try {
    const res = await fetcher(url, { method, headers: headers(token), body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: formatGithubError(res.status, json) };
    }
    return { ok: true, data: { gistId: json.id } };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function readFromGist(params: GistReadParams): Promise<GithubResult<string>> {
  const { token, gistId, filename, fetcher = fetch } = params;
  try {
    const res = await fetcher(`${API_BASE}/gists/${gistId}`, { headers: headers(token) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: formatGithubError(res.status, json) };
    }
    if (!json.files) {
      return { ok: false, status: res.status, error: 'No files found in gist.' };
    }
    const targetFile = filename ? json.files[filename] : Object.values(json.files)[0];
    if (!targetFile || !targetFile.content) {
      return { ok: false, error: 'Target file not found in gist.' };
    }
    return { ok: true, data: targetFile.content as string };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function saveToRepo(params: RepoSaveParams): Promise<GithubResult<{ sha: string }>> {
  const { token, owner, repo, branch, path, message, content, fetcher = fetch } = params;
  const contentUrl = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponentPath(path)}?ref=${encodeURIComponent(
    branch
  )}`;

  const shaResult = await getRepoFileSha({ token, owner, repo, branch, path, fetcher });
  if (!shaResult.ok && shaResult.status && shaResult.status !== 404) {
    return shaResult as GithubResult<{ sha: string }>;
  }

  const body = JSON.stringify({
    message,
    content: encodeContent(content),
    branch,
    sha: shaResult.data ?? undefined,
  });

  try {
    const res = await fetcher(contentUrl, { method: 'PUT', headers: headers(token), body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: formatGithubError(res.status, json) };
    }
    return { ok: true, data: { sha: json.content?.sha } };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function readFromRepo(params: RepoReadParams): Promise<GithubResult<string>> {
  const { token, owner, repo, branch, path, fetcher = fetch } = params;
  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponentPath(path)}?ref=${encodeURIComponent(branch)}`;
  try {
    const res = await fetcher(url, { headers: headers(token) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: formatGithubError(res.status, json) };
    }
    const data = json as RepoContentResponse;
    if (data.encoding !== 'base64' || !data.content) {
      return { ok: false, error: 'Unexpected content encoding.' };
    }
    const decoded = decodeBase64(data.content);
    return { ok: true, data: decoded };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

async function getRepoFileSha(
  params: Omit<RepoReadParams, 'fetcher'> & { fetcher?: Fetcher }
): Promise<GithubResult<string | null>> {
  const { token, owner, repo, branch, path, fetcher = fetch } = params;
  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponentPath(path)}?ref=${encodeURIComponent(branch)}`;
  try {
    const res = await fetcher(url, { headers: headers(token) });
    if (res.status === 404) {
      return { ok: true, data: null, status: 404 };
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: formatGithubError(res.status, json) };
    }
    const data = json as RepoContentResponse;
    return { ok: true, data: data.sha };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

const decodeBase64 = (value: string): string => {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return atob(value);
  }
};

const encodeURIComponentPath = (path: string): string => {
  return path
    .split('/')
    .map(seg => encodeURIComponent(seg))
    .join('/');
};

const formatGithubError = (status: number, body: Record<string, unknown>): string => {
  if (body?.message) {
    return `${status}: ${String(body.message)}`;
  }
  return `Request failed with status ${status}`;
};
