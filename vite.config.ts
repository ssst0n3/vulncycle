import { defineConfig } from 'vite';

export default defineConfig({
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
