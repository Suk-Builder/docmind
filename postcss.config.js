/**
 * PostCSS 配置文件
 * 用于处理 CSS 的后置处理器，包括 Tailwind CSS 和 Autoprefixer
 */

export default {
  // 插件列表
  plugins: {
    // Tailwind CSS 插件：处理 @tailwind 指令并生成实用工具类
    tailwindcss: {},
    // Autoprefixer 插件：自动添加浏览器前缀（-webkit-, -moz- 等）
    autoprefixer: {},
  },
};
