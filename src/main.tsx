/**
 * DocMind AI文档问答系统 - 应用入口文件
 * 负责挂载 React 应用到 DOM
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// 引入全局样式（包含 Tailwind directives 和自定义样式）
import './index.css';

/**
 * 获取根DOM节点
 * 对应 index.html 中的 <div id="root"></div>
 */
const rootElement = document.getElementById('root');

/**
 * 确保根元素存在，然后创建 React 根节点
 * createRoot 是 React 18+ 的新 API，支持并发特性
 */
if (rootElement) {
  const root = createRoot(rootElement);

  /**
   * 渲染应用
   * StrictMode 用于检测潜在问题：
   * - 检测不安全的生命周期
   * - 检测过时的 API 使用
   * - 检测副作用（双重调用某些函数）
   * - 仅开发环境生效，不影响生产构建
   */
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  // 根元素不存在时的错误提示
  console.error('找不到根元素 #root，请检查 index.html');
}
