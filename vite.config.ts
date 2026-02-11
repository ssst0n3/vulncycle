import { defineConfig } from 'vite';
import { execSync } from 'child_process';

// Generate version string from git info: ${tag}-${commit}${dirty}
function getVersion() {
  try {
    // Get short commit hash
    const commit = execSync('git rev-parse --short HEAD').toString().trim();

    // Get the most recent tag
    let tag = '';
    try {
      tag = execSync('git describe --tags --always').toString().trim();
      // If tag contains commit hash, extract just the tag part
      if (tag.includes('-')) {
        const tagMatch = tag.match(/^([^-]+)/);
        if (tagMatch && tagMatch[1] !== commit) {
          tag = tagMatch[1];
        } else {
          tag = '';
        }
      }
    } catch {
      tag = '';
    }

    // Check if working directory is dirty (has uncommitted changes)
    let dirty = '';
    try {
      execSync('git diff --quiet');
    } catch {
      dirty = '-dirty';
    }

    // Format: ${tag}-${commit}${dirty} or ${commit}${dirty} if no tag
    if (tag && tag !== commit) {
      return `${tag}-${commit}${dirty}`;
    }
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
