import { defineConfig } from 'vite';
import { execSync } from 'child_process';

// Generate version string from git info
// If current commit matches the tag's commit, only show the tag
// Format: ${tag}${dirty} or ${tag}-${commit}${dirty}
function getVersion() {
  try {
    // Get short commit hash
    const commit = execSync('git rev-parse --short HEAD').toString().trim();

    // Get the most recent tag with commit info
    let tagInfo = '';
    try {
      tagInfo = execSync('git describe --tags --always').toString().trim();
    } catch {
      tagInfo = '';
    }

    // Check if working directory is dirty (has uncommitted changes)
    let dirty = '';
    try {
      execSync('git diff --quiet');
    } catch {
      dirty = '-dirty';
    }

    // Parse tag info: format can be "v1.0.0" or "v1.0.0-N-g<hash>"
    let tag = '';
    let tagCommit = '';
    let commitsSinceTag = 0;

    if (tagInfo) {
      if (tagInfo.includes('-')) {
        const parts = tagInfo.split('-');
        tag = parts[0];
        commitsSinceTag = parseInt(parts[1], 10);
        // Extract commit hash from format like "N-g<hash>"
        const hashPart = parts[2] || '';
        if (hashPart.startsWith('g')) {
          tagCommit = hashPart.substring(1);
        }
      } else {
        // No dash means we're exactly on the tag
        tag = tagInfo;
        tagCommit = commit;
        commitsSinceTag = 0;
      }
    }

    // If we're exactly on the tag commit (no commits since tag)
    // and the tag commit matches current HEAD, show only the tag
    if (tag && commitsSinceTag === 0 && tagCommit === commit) {
      return `${tag}${dirty}`;
    }

    // If we have a tag but not on the tag commit, show tag-commit-dirty
    if (tag) {
      return `${tag}-${commit}${dirty}`;
    }

    // No tag found, just show commit-dirty
    return `${commit}${dirty}`;
  } catch {
    return 'unknown';
  }
}

const version = getVersion();

export default defineConfig({
  base: '/vulncycle/',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    port: Number(process.env.PORT ?? 0) || 0,
    host: '0.0.0.0', // 允许外部访问，Docker 环境需要
    open: false, // Docker 环境中不自动打开浏览器
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild', // 使用 esbuild 进行更快的构建
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: ['@codemirror/view', '@codemirror/state', '@codemirror/lang-markdown'],
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      '@codemirror/view',
      '@codemirror/state',
      '@codemirror/lang-markdown',
      '@codemirror/commands',
      '@codemirror/theme-one-dark',
    ],
  },
});
