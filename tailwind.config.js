/**
 * Tailwind CSS 配置文件
 * 使用低饱和度暖色调（amber/orange/stone/slate）
 * 不用蓝紫渐变，营造温暖专业的阅读体验
 */

/** @type {import('tailwindcss').Config} */
export default {
  // 内容路径：扫描这些文件中的类名
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],

  // 暗色模式：使用 class 策略（通过 html 标签的 class 切换）
  darkMode: 'class',

  // 主题配置
  theme: {
    // 扩展默认主题
    extend: {
      /* ========== 自定义颜色：低饱和度暖色调 ========== */
      colors: {
        // 品牌主色：温暖琥珀色
        brand: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#d97706',  // 主色
          600: '#b45309',
          700: '#92400e',
          800: '#78350f',
          900: '#451a03',
        },
        // 暖橙色（用于强调）
        accent: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#ea580c',
          600: '#c2410c',
          700: '#9a3412',
          800: '#7c2d12',
          900: '#431407',
        },
        // 石灰色（用于背景、边框）
        surface: {
          50:  '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        },
        // 石板灰（用于文字）
        ink: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // 语义化颜色
        success: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          50:  '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
        },
      },

      /* ========== 自定义字体 ========== */
      fontFamily: {
        // 无衬线字体栈：Inter + 系统中文字体回退
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Noto Sans SC"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        // 等宽字体（用于代码展示）
        mono: [
          'JetBrains Mono',
          '"Fira Code"',
          'Consolas',
          '"Courier New"',
          'monospace',
        ],
      },

      /* ========== 自定义字号（使用rem） ========== */
      fontSize: {
        'xs':   ['0.75rem',  { lineHeight: '1rem' }],       // 12px
        'sm':   ['0.875rem', { lineHeight: '1.25rem' }],    // 14px
        'base': ['1rem',     { lineHeight: '1.5rem' }],     // 16px
        'lg':   ['1.125rem', { lineHeight: '1.75rem' }],    // 18px
        'xl':   ['1.25rem',  { lineHeight: '1.75rem' }],    // 20px
        '2xl':  ['1.5rem',   { lineHeight: '2rem' }],       // 24px
        '3xl':  ['1.875rem', { lineHeight: '2.25rem' }],    // 30px
        '4xl':  ['2.25rem',  { lineHeight: '2.5rem' }],     // 36px
      },

      /* ========== 自定义间距 ========== */
      spacing: {
        '18': '4.5rem',   // 72px
        '22': '5.5rem',   // 88px
        '30': '7.5rem',   // 120px
      },

      /* ========== 自定义圆角 ========== */
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },

      /* ========== 自定义动画 ========== */
      animation: {
        // 淡入动画
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        // 从下滑入
        'slide-up': 'slideUp 0.4s ease-out forwards',
        // 从右滑入
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        // 打字光标闪烁
        'cursor-blink': 'cursorBlink 1s step-end infinite',
        // 脉冲微光（用于AI思考中）
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        // 旋转加载
        'spin-slow': 'spin 2s linear infinite',
        // 弹跳
        'bounce-soft': 'bounceSoft 0.5s ease-in-out',
      },

      /* ========== 关键帧定义 ========== */
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        cursorBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
      },

      /* ========== 自定义阴影 ========== */
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 4px 6px -4px rgba(0, 0, 0, 0.02)',
        'soft-lg': '0 10px 40px -10px rgba(0, 0, 0, 0.1)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
        'glow': '0 0 20px rgba(217, 119, 6, 0.15)',
      },

      /* ========== 自定义过渡 ========== */
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '400': '400ms',
        '500': '500ms',
      },

      /* ========== 自定义z-index ========== */
      zIndex: {
        'dropdown': '1000',
        'sticky': '1020',
        'fixed': '1030',
        'modal': '1040',
        'popover': '1050',
        'tooltip': '1060',
        'toast': '1070',
      },
    },
  },

  // 插件（可选扩展）
  plugins: [],
};
