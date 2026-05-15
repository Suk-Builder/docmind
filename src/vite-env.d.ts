/**
 * Vite 环境变量类型声明文件
 * 为 TypeScript 提供 Vite 环境变量的类型支持
 */

/// <reference types="vite/client" />

/**
 * 环境变量接口
 * 所有以 VITE_ 开头的环境变量都会在这里声明类型
 */
interface ImportMetaEnv {
  /** API 基础地址 */
  readonly VITE_API_BASE_URL: string;
  /** 应用标题 */
  readonly VITE_APP_TITLE: string;
  /** 应用版本 */
  readonly VITE_APP_VERSION: string;
  /** 运行模式 */
  readonly MODE: string;
  /** 是否开发环境 */
  readonly DEV: boolean;
  /** 是否生产环境 */
  readonly PROD: boolean;
  /** 是否 SSR */
  readonly SSR: boolean;
}

/**
 * ImportMeta 接口扩展
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
