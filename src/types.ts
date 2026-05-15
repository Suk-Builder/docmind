/**
 * DocMind 全局类型定义文件
 * 包含文档、消息、API请求、组件Props等核心数据类型
 */

/* ========== 文档类型 ========== */

export interface Document {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  content: string;
  summary: string;
  chunks: string[];
  createdAt: number;
}

export interface DocumentListItem {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  summary: string;
  createdAt: number;
}

/* ========== 消息类型 ========== */

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
}

/* ========== API 请求/响应类型 ========== */

export interface ChatRequest {
  docId: string;
  question: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DocumentUploadResult {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  summary: string;
  chunkCount: number;
  createdAt: string;
}

/* ========== SSE 流式类型 ========== */

export interface SSEContentChunk {
  content: string;
}

export interface SSEErrorChunk {
  error: string;
}

/* ========== 组件 Props 类型 ========== */

export interface UploadZoneProps {
  onUpload: (file: File) => void;
  uploading: boolean;
  uploadProgress: string;
}

export interface DocumentListProps {
  documents: DocumentListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}

export interface ChatPanelProps {
  docId: string | null;
  docName: string;
  messages: Message[];
  onSend: (question: string) => void;
  streaming: boolean;
  streamContent: string;
}

/* ========== Hook 类型 ========== */

export interface UseDocumentsReturn {
  documents: DocumentListItem[];
  loading: boolean;
  error: string | null;
  currentDocument: Document | null;
  fetchDocuments: () => Promise<void>;
  uploadDocument: (file: File) => Promise<{ success: boolean; documentId: string } | null>;
  deleteDocument: (docId: string) => Promise<boolean>;
  getDocument: (docId: string) => Promise<Document | null>;
  clearError: () => void;
  setCurrentDocument: (doc: Document | null) => void;
}
