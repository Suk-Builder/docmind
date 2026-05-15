/**
 * DocMind AI文档问答系统 - 根组件
 * 应用的主入口组件，管理整体布局和状态
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDocuments } from './hooks/useDocuments';
import type { Message, Document } from './types';

/* ========== 类型定义 ========== */

/** 聊天状态 */
interface ChatState {
  /** 是否正在生成回答 */
  isStreaming: boolean;
  /** 当前流式输出的内容 */
  streamingContent: string;
  /** 与当前文档的对话历史 */
  messages: Message[];
}

/**
 * 根组件 App
 */
function App() {
  /* ---------- 使用文档管理 Hook ---------- */
  const {
    documents,
    loading: docLoading,
    error: docError,
    currentDocument,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    getDocument,
    clearError,
    setCurrentDocument,
  } = useDocuments();

  /* ---------- 本地状态 ---------- */

  /** 当前选中的文档ID */
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  /** 用户输入的问题 */
  const [questionInput, setQuestionInput] = useState('');

  /** 聊天状态（按文档ID存储） */
  const [chatStates, setChatStates] = useState<Record<string, ChatState>>({});

  /** 文件上传输入框引用 */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 消息列表滚动引用 */
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /** AbortController 引用（用于中断流式请求） */
  const abortControllerRef = useRef<AbortController | null>(null);

  /* ---------- 派生状态 ---------- */

  /** 当前文档的聊天状态 */
  const currentChat = selectedDocId ? chatStates[selectedDocId] : null;

  /* ---------- 副作用 ---------- */

  // 组件挂载时获取文档列表
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // 文档列表加载完成后自动选中第一个
  useEffect(() => {
    if (documents.length > 0 && !selectedDocId) {
      handleSelectDocument(documents[0].id);
    }
  }, [documents, selectedDocId]);

  // 消息更新时自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat?.messages, currentChat?.streamingContent]);

  // 组件卸载时中断请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /* ---------- 事件处理 ---------- */

  /** 选择文档 */
  const handleSelectDocument = useCallback(
    async (docId: string) => {
      setSelectedDocId(docId);
      await getDocument(docId);
    },
    [getDocument]
  );

  /** 上传文件 */
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const result = await uploadDocument(file);
      if (result?.success) {
        // 上传成功后自动选中新文档
        handleSelectDocument(result.documentId);
      }

      // 清空输入框，允许重复上传同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [uploadDocument, handleSelectDocument]
  );

  /** 删除文档 */
  const handleDeleteDocument = useCallback(
    async (docId: string) => {
      const confirmed = window.confirm('确定要删除该文档吗？此操作不可撤销。');
      if (!confirmed) return;

      await deleteDocument(docId);
      if (selectedDocId === docId) {
        setSelectedDocId(null);
        setCurrentDocument(null);
      }
    },
    [deleteDocument, selectedDocId, setCurrentDocument]
  );

  /** 发送消息 — 使用 fetch POST + ReadableStream 实现 SSE */
  const handleSendMessage = useCallback(async () => {
    if (!selectedDocId || !questionInput.trim()) return;
    const question = questionInput.trim();

    // 创建用户消息
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      createdAt: Date.now(),
    };

    // 更新聊天状态
    setChatStates((prev) => {
      const existing = prev[selectedDocId] || { isStreaming: false, streamingContent: '', messages: [] };
      return {
        ...prev,
        [selectedDocId]: { ...existing, isStreaming: true, streamingContent: '', messages: [...existing.messages, userMessage] },
      };
    });
    setQuestionInput('');

    // 中断之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let fullContent = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: selectedDocId, question }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: '请求失败' }));
        throw new Error(errData.error || `请求失败 (${response.status})`);
      }

      if (!response.body) throw new Error('响应体为空');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('data: ')) {
            const dataContent = trimmed.slice(6);

            if (dataContent === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataContent);
              if (parsed.content) {
                fullContent += parsed.content;
                setChatStates((prev) => {
                  const existing = prev[selectedDocId];
                  if (!existing) return prev;
                  return { ...prev, [selectedDocId]: { ...existing, streamingContent: fullContent } };
                });
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.choices?.[0]?.delta?.content) {
                fullContent += parsed.choices[0].delta.content;
                setChatStates((prev) => {
                  const existing = prev[selectedDocId];
                  if (!existing) return prev;
                  return { ...prev, [selectedDocId]: { ...existing, streamingContent: fullContent } };
                });
              }
            } catch {
              // 非JSON，忽略
            }
          }
        }
      }

      // 完成 — 添加助手消息
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: fullContent || '（无回答内容）',
        createdAt: Date.now(),
      };
      setChatStates((prev) => {
        const existing = prev[selectedDocId];
        if (!existing) return prev;
        return {
          ...prev,
          [selectedDocId]: { ...existing, isStreaming: false, streamingContent: '', messages: [...existing.messages, assistantMessage] },
        };
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // 用户中断，将已有内容保存为消息
        if (fullContent) {
          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: fullContent,
            createdAt: Date.now(),
          };
          setChatStates((prev) => {
            const existing = prev[selectedDocId];
            if (!existing) return prev;
            return {
              ...prev,
              [selectedDocId]: { ...existing, isStreaming: false, streamingContent: '', messages: [...existing.messages, assistantMessage] },
            };
          });
        }
      } else {
        const errorMsg = err instanceof Error ? err.message : '请求失败';
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `❌ 错误：${errorMsg}`,
          createdAt: Date.now(),
        };
        setChatStates((prev) => {
          const existing = prev[selectedDocId];
          if (!existing) return prev;
          return {
            ...prev,
            [selectedDocId]: { ...existing, isStreaming: false, streamingContent: '', messages: [...existing.messages, errorMessage] },
          };
        });
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [selectedDocId, questionInput]);

  /** 键盘事件（Enter 发送） */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  /** 中断生成 */
  const handleAbort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /* ---------- 格式化文件大小 ---------- */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  /* ---------- 格式化时间 ---------- */
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /* ========== 渲染 ========== */

  return (
    <div className="flex h-screen w-full overflow-hidden animate-fade-in">
      {/* ===== 左侧边栏：文档列表 ===== */}
      <aside className="w-72 flex-shrink-0 flex flex-col border-r border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]">
        {/* 侧边栏头部 */}
        <div className="p-4 border-b border-[var(--color-border-light)]">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-[var(--color-text-primary)]">DocMind</h1>
              <p className="text-xs text-[var(--color-text-tertiary)]">AI 文档问答</p>
            </div>
          </div>

          {/* 上传按钮 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={docLoading}
            className="w-full btn-base bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {docLoading ? '上传中...' : '上传文档'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.pdf,.doc,.docx,.md"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* 文档列表 */}
        <div className="flex-1 overflow-y-auto">
          {documents.length === 0 && !docLoading ? (
            <div className="p-6 text-center">
              <svg className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-quaternary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-[var(--color-text-tertiary)]">暂无文档</p>
              <p className="text-xs text-[var(--color-text-quaternary)] mt-1">点击上方按钮上传</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleSelectDocument(doc.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                    selectedDocId === doc.id
                      ? 'bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800'
                      : 'hover:bg-[var(--color-bg-hover)] border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-surface-200 dark:bg-surface-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] text-truncate">
                        {doc.originalName}
                      </p>
                      <p className="text-xs text-[var(--color-text-quaternary)] mt-0.5">
                        {formatFileSize(doc.size)} · {formatTime(doc.createdAt)}
                      </p>
                      {doc.summary && (
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-1 text-truncate-2">
                          {doc.summary}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDocument(doc.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error-50 dark:hover:bg-error-900/20 transition-all flex-shrink-0"
                      title="删除文档"
                    >
                      <svg className="w-4 h-4 text-[var(--color-text-quaternary)] hover:text-error-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {docError && (
          <div className="p-3 mx-3 mb-3 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-error-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-error-600 dark:text-error-400 flex-1">{docError}</p>
              <button onClick={clearError} className="text-xs text-error-500 hover:text-error-700">
                关闭
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ===== 右侧主区域 ===== */}
      <main className="flex-1 flex flex-col min-w-0 bg-[var(--color-bg-primary)]">
        {/* 主区域头部 */}
        {currentDocument && (
          <header className="h-14 flex-shrink-0 flex items-center px-6 border-b border-[var(--color-border-light)]">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-medium text-[var(--color-text-primary)] text-truncate max-w-md">
                  {currentDocument.originalName}
                </h2>
                <p className="text-xs text-[var(--color-text-quaternary)]">
                  {formatFileSize(currentDocument.size)} · {currentDocument.chunks.length} 个片段
                </p>
              </div>
            </div>
          </header>
        )}

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {currentChat && currentChat.messages.length > 0 ? (
            <div className="max-w-3xl mx-auto space-y-6">
              {currentChat.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-brand-500 text-white rounded-tr-sm'
                        : 'bg-[var(--color-bg-card)] border border-[var(--color-border-light)] text-[var(--color-text-primary)] rounded-tl-sm shadow-soft'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    <p className={`text-[10px] mt-1.5 ${message.role === 'user' ? 'text-brand-100' : 'text-[var(--color-text-quaternary)]'}`}>
                      {formatTime(message.createdAt)}
                    </p>
                  </div>
                  {message.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-surface-300 dark:bg-surface-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}

              {/* 流式输出中的内容 */}
              {currentChat.isStreaming && currentChat.streamingContent && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-light)] rounded-2xl rounded-tl-sm px-4 py-3 shadow-soft max-w-[80%]">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed text-[var(--color-text-primary)]">
                      {currentChat.streamingContent}
                      <span className="inline-block w-1.5 h-4 ml-0.5 bg-brand-500 animate-cursor-blink" />
                    </p>
                  </div>
                </div>
              )}

              {/* 思考中加载状态 */}
              {currentChat.isStreaming && !currentChat.streamingContent && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-light)] rounded-2xl rounded-tl-sm px-4 py-3 shadow-soft">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse-soft" />
                      <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse-soft" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse-soft" style={{ animationDelay: '0.4s' }} />
                      <span className="text-xs text-[var(--color-text-tertiary)] ml-1">思考中...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          ) : (
            /* 空状态 */
            <div className="h-full flex items-center justify-center">
              <div className="text-center animate-fade-in">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                  <svg className="w-8 h-8 text-[var(--color-text-quaternary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h3 className="text-base font-medium text-[var(--color-text-secondary)] mb-1">
                  {currentDocument ? '开始对话' : '选择或上传文档'}
                </h3>
                <p className="text-sm text-[var(--color-text-quaternary)]">
                  {currentDocument
                    ? '在下方输入框中提问，AI 将基于文档内容回答'
                    : '从左侧列表选择文档，或上传新文档开始问答'}
                </p>
                {currentDocument && (
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {['这篇文档的主要内容是什么？', '文档中有哪些关键观点？', '请总结一下核心结论'].map(
                      (suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setQuestionInput(suggestion)}
                          className="px-3 py-1.5 text-xs rounded-full border border-[var(--color-border-medium)] text-[var(--color-text-tertiary)] hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors bg-[var(--color-bg-card)]"
                        >
                          {suggestion}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部输入区域 */}
        <div className="flex-shrink-0 border-t border-[var(--color-border-light)] px-6 py-4">
          <div className="max-w-3xl mx-auto">
            {currentDocument ? (
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入问题，按 Enter 发送，Shift+Enter 换行..."
                    rows={1}
                    disabled={currentChat?.isStreaming}
                    className="input-base w-full resize-none py-3 px-4 pr-10 max-h-32 min-h-[44px]"
                    style={{ height: 'auto' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                    }}
                  />
                </div>
                {currentChat?.isStreaming ? (
                  <button
                    onClick={handleAbort}
                    className="btn-base h-11 px-4 bg-error-50 text-error-600 border border-error-200 hover:bg-error-100 transition-colors flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    停止
                  </button>
                ) : (
                  <button
                    onClick={handleSendMessage}
                    disabled={!questionInput.trim()}
                    className="btn-base h-11 px-4 bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    发送
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-2 text-sm text-[var(--color-text-quaternary)]">
                请从左侧选择或上传一个文档以开始对话
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
