/**
 * Vite 配置文件
 * DocMind AI文档问答系统 - 前端构建配置
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件目录路径（ES模块兼容）
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  /* 基础路径：使用相对路径，支持通过子目录代理访问 */
  base: './',
  /* ========== 插件配置 ========== */
  plugins: [
    // React 插件：支持 Fast Refresh、JSX 转换、自动引入 React
    react({
      // 使用 TypeScript 进行 JSX 转换
      include: '**/*.{jsx,tsx}',
      // 开发模式下的 Fast Refresh
      jsxRuntime: 'automatic',
    }),
  ],

  /* ========== 路径解析配置 ========== */
  resolve: {
    // 路径别名，与 tsconfig.json 中的 paths 保持一致
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },

  /* ========== 开发服务器配置 ========== */
  server: {
    // 开发服务器端口
    port: 5173,
    // 自动打开浏览器
    open: false,
    // 监听所有地址
    host: true,
    // 代理配置：将 /api 请求转发到后端服务器
    proxy: {
      '/api': {
        // 目标后端服务器地址
        target: 'http://localhost:3458',
        // 改变请求源（跨域支持）
        changeOrigin: true,
        // 重写路径（可选，这里保持原路径）
        // rewrite: (path) => path.replace(/^\/api/, '/api'),
        // WebSocket 支持
        ws: true,
        // 连接超时（毫秒）
        timeout: 30000,
      },
    },
  },

  /* ========== 构建配置 ========== */
  build: {
    // 构建输出目录
    outDir: 'dist',
    // 静态资源输出目录
    assetsDir: 'assets',
    // 生成 source map（生产环境关闭）
    sourcemap: mode === 'development',
    // 是否清空输出目录
    emptyOutDir: true,
    // Rollup 构建选项
    rollupOptions: {
      // 入口文件
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      // 输出配置
      output: {
        // 入口文件命名
        entryFileNames: 'assets/[name]-[hash].js',
        // 代码块命名
        chunkFileNames: 'assets/[name]-[hash].js',
        // 静态资源命名
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name ?? '';
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(info)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/\.(woff2?|eot|ttf|otf)$/.test(info)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          if (/\.css$/.test(info)) {
            return 'assets/styles/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        // 手动代码分割
        manualChunks: {
          // React 核心库
          'vendor-react': ['react', 'react-dom'],
          // 其他第三方库（后续可添加）
        },
      },
    },
    // CSS 配置
    cssMinify: true,
    // JS 压缩
    minify: 'terser',
    // Terser 配置
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
      },
    },
  },

  /* ========== CSS 配置 ========== */
  css: {
    // CSS 模块配置
    modules: {
      // 作用域样式命名规则
      generateScopedName: mode === 'development'
        ? '[name]__[local]__[hash:base64:5]'
        : '[hash:base64:8]',
    },
    // PostCSS 配置（会自动读取 postcss.config.js）
    postcss: './postcss.config.js',
  },

  /* ========== 预览配置（预览生产构建） ========== */
  preview: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3458',
        changeOrigin: true,
      },
    },
  },

  /* ========== 优化依赖预构建 ========== */
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
    ],
    exclude: [],
  },
}));
