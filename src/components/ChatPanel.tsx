/**
 * ChatPanel - AI问答面板组件
 * 消息列表、流式打字机效果、代码块渲染、自动滚动
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatPanelProps, Message } from '../types';

/** 生成唯一ID */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 格式化时间 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 简单Markdown解析：代码块 + 普通文本 */
function parseContent(content: string): Array<{ type: 'text' | 'code'; lang?: string; value: string }> {
  const parts: Array<{ type: 'text' | 'code'; lang?: string; value: string }> = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // 代码块之前的文本
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    // 代码块
    parts.push({ type: 'code', lang: match[1] || 'text', value: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }

  // 剩余文本
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
  }

  // 如果没有匹配到任何代码块，返回全部文本
  if (parts.length === 0) {
    parts.push({ type: 'text', value: content });
  }

  return parts;
}

/** 消息气泡组件 */
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const parts = parseContent(message.content);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-[slideUp_0.3s_ease-out]`}>
      <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-2.5`}>
        {/* 头像 */}
        <div className={`
          flex items-center justify-center w-8 h-8 rounded-full shrink-0
          ${isUser ? 'bg-amber-500' : 'bg-stone-200'}
        `}>
          {isUser ? (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
        </div>

        {/* 内容 */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          {/* 标签 */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`text-[11px] font-medium ${isUser ? 'text-amber-600' : 'text-stone-500'}`}>
              {isUser ? '你' : 'AI 助手'}
            </span>
            <span className="text-[10px] text-stone-400">{formatTime(message.createdAt)}</span>
          </div>

          {/* 消息体 */}
          <div className={`
            rounded-2xl px-4 py-2.5 shadow-sm
            ${isUser
              ? 'bg-amber-500 text-white rounded-tr-md'
              : 'bg-white border border-stone-200 text-stone-800 rounded-tl-md'
            }
          `}>
            {parts.map((part, idx) => (
              part.type === 'code' ? (
                <pre
                  key={idx}
                  className={`
                    mt-2 mb-2 p-3 rounded-lg overflow-x-auto text-xs leading-relaxed
                    ${isUser
                      ? 'bg-amber-700/40 text-amber-50'
                      : 'bg-stone-100 text-stone-700 border border-stone-200'
                    }
                  `}
                >
                  {part.lang && part.lang !== 'text' && (
                    <span className={`
                      block text-[10px] uppercase tracking-wider mb-1.5 font-semibold
                      ${isUser ? 'text-amber-200' : 'text-stone-500'}
                    `}>
                      {part.lang}
                    </span>
                  )}
                  <code>{part.value}</code>
                </pre>
              ) : (
                <p key={idx} className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {part.value || '\u00A0'}
                </p>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 流式消息气泡（打字机效果） */
function StreamingBubble({ content }: { content: string }) {
  const parts = parseContent(content);
  const isEmpty = !content || content.trim().length === 0;

  return (
    <div className="flex justify-start animate-[slideUp_0.2s_ease-out]">
      <div className="flex flex-row gap-2.5 max-w-[85%]">
        {/* AI头像 */}
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-stone-200 shrink-0">
          <svg className="w-4 h-4 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        <div className="flex flex-col items-start">
          {/* 标签 */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] font-medium text-stone-500">AI 助手</span>
            <span className="text-[10px] text-amber-500 animate-pulse">思考中...</span>
          </div>

          {/* 消息体 */}
          <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-md px-4 py-2.5 shadow-sm min-w-[80px]">
            {isEmpty ? (
              <div className="flex items-center gap-1 h-5">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            ) : (
              parts.map((part, idx) => (
                part.type === 'code' ? (
                  <pre
                    key={idx}
                    className="mt-2 mb-2 p-3 rounded-lg bg-stone-100 text-stone-700 border border-stone-200 overflow-x-auto text-xs leading-relaxed"
                  >
                    {part.lang && part.lang !== 'text' && (
                      <span className="block text-[10px] uppercase tracking-wider mb-1.5 font-semibold text-stone-500">
                        {part.lang}
                      </span>
                    )}
                    <code>{part.value}</code>
                  </pre>
                ) : (
                  <p key={idx} className="text-sm leading-relaxed whitespace-pre-wrap break-words text-stone-800">
                    {part.value || '\u00A0'}
                  </p>
                )
              ))
            )}
            {/* 光标闪烁 */}
            {!isEmpty && (
              <span className="inline-block w-0.5 h-4 bg-amber-400 ml-0.5 align-middle animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPanel({
  docId,
  docName,
  messages,
  onSend,
  streaming,
  streamContent,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /** 自动滚动到底部 */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // 消息变化或流式内容变化时滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamContent, scrollToBottom]);

  /** 发送消息 */
  const handleSend = useCallback(() => {
    const question = inputValue.trim();
    if (!question || streaming || !docId) return;

    onSend(question);
    setInputValue('');

    // 重置输入框高度
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [inputValue, streaming, docId, onSend]);

  /** 键盘快捷键 */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  /** 输入框自适应高度 */
  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
  }, []);

  // 未选择文档 - 显示占位
  if (!docId) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <div className="flex flex-col items-center max-w-sm text-center">
          {/* 装饰图标 */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
              <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-stone-700 mb-2">
            开始文档问答
          </h3>
          <p className="text-sm text-stone-500 leading-relaxed mb-6">
            请先从左侧面板选择一份文档，AI 助手将基于文档内容为您解答问题
          </p>

          <div className="flex flex-col gap-2.5 w-full">
            {['文档内容的核心要点是什么？', '请总结文档的主要观点', '文档中有哪些关键数据？'].map((hint, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-500"
              >
                <svg className="w-4 h-4 text-stone-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {hint}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部文档信息栏 */}
      <div className="shrink-0 px-5 py-3 border-b border-stone-200 bg-white/80 backdrop-blur-sm rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-stone-800 truncate" title={docName}>
              {docName}
            </h3>
            <p className="text-[11px] text-stone-400">
              {messages.length > 0 ? `共 ${messages.length} 条对话` : '准备就绪，可以开始提问'}
            </p>
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-5 scrollbar-thin"
      >
        {messages.length === 0 && !streaming ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-sm text-stone-500">文档已加载，开始提问吧</p>
            <p className="text-xs text-stone-400 mt-1">AI 将基于文档内容为您解答</p>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {/* 流式消息 */}
            {streaming && <StreamingBubble content={streamContent} />}
          </>
        )}
        {/* 滚动锚点 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="shrink-0 px-4 py-3 border-t border-stone-200 bg-white/80 backdrop-blur-sm rounded-b-2xl">
        <div className="flex items-end gap-2.5">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={streaming ? 'AI 正在思考中...' : '输入问题，按 Enter 发送'}
              disabled={streaming}
              rows={1}
              className={`
                w-full resize-none rounded-xl border px-4 py-2.5 pr-10
                text-sm text-stone-800 placeholder-stone-400
                bg-stone-50 focus:bg-white
                transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed
                max-h-[120px] min-h-[40px]
              `}
              style={{ overflow: 'auto' }}
            />
            {/* 输入长度提示 */}
            {inputValue.length > 0 && (
              <span className="absolute bottom-2 right-3 text-[10px] text-stone-400">
                {inputValue.length}
              </span>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || streaming}
            className={`
              flex items-center justify-center w-10 h-10 rounded-xl
              transition-all duration-200 shrink-0
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1
              ${inputValue.trim() && !streaming
                ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600 hover:shadow-lg active:scale-95'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }
            `}
            aria-label="发送消息"
          >
            {streaming ? (
              <svg className="w-4.5 h-4.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
