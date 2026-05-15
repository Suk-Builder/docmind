/**
 * DocumentList - 文档列表组件
 * 展示已上传文档的卡片列表，支持选中高亮和删除操作
 */
import React, { useCallback, useState } from 'react';
import type { DocumentListProps } from '../types';

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 格式化时间戳 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHour = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 30) return `${diffDay} 天前`;

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** 获取文件图标 */
function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const isPdf = mimeType === 'application/pdf' || mimeType.includes('pdf');
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {isPdf ? (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 7h4m-4 4h4m-4 4h4" />
        </>
      ) : (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </>
      )}
    </svg>
  );
}

export default function DocumentList({ documents, selectedId, onSelect, onDelete, loading }: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  /** 处理删除按钮点击 */
  const handleDeleteClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmId === id) {
      // 确认删除
      setDeletingId(id);
      setConfirmId(null);
      onDelete(id);
    } else {
      // 首次点击，显示确认
      setConfirmId(id);
      // 3秒后自动取消确认状态
      setTimeout(() => {
        setConfirmId(prev => prev === id ? null : prev);
      }, 3000);
    }
  }, [confirmId, onDelete]);

  /** 取消删除确认 */
  const handleCancelDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmId(null);
  }, []);

  // 加载中骨架屏
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-stone-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-stone-200 rounded w-3/4" />
                <div className="h-3 bg-stone-200 rounded w-1/2" />
              </div>
            </div>
            <div className="mt-3 h-8 bg-stone-200 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  // 空列表
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-stone-300 bg-stone-50/50">
        <svg className="w-12 h-12 text-stone-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm text-stone-500 font-medium">暂无文档</p>
        <p className="text-xs text-stone-400 mt-1">请上传 PDF 或 TXT 文件</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 scrollbar-thin">
      {documents.map(doc => {
        const isSelected = selectedId === doc.id;
        const isConfirming = confirmId === doc.id;
        const isDeleting = deletingId === doc.id;

        return (
          <div
            key={doc.id}
            onClick={() => !isDeleting && onSelect(doc.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(doc.id);
              }
            }}
            aria-label={`选择文档 ${doc.originalName}`}
            className={`
              relative group rounded-xl border p-4 cursor-pointer
              transition-all duration-200 ease-out
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1
              ${isSelected
                ? 'border-amber-400 bg-amber-50 shadow-md'
                : 'border-stone-200 bg-white hover:border-amber-300 hover:shadow-sm hover:-translate-y-0.5'
              }
              ${isDeleting ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            {/* 头部: 图标 + 文件名 + 大小 */}
            <div className="flex items-start gap-3">
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-lg shrink-0
                ${isSelected ? 'bg-amber-100' : 'bg-stone-100'}
              `}>
                <FileIcon
                  mimeType={doc.mimeType}
                  className={`w-5 h-5 ${isSelected ? 'text-amber-600' : 'text-stone-500'}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-stone-800 truncate" title={doc.originalName}>
                  {doc.originalName}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-stone-400">{formatFileSize(doc.size)}</span>
                  <span className="text-xs text-stone-300">·</span>
                  <span className="text-xs text-stone-400">{formatTime(doc.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* 摘要预览 */}
            {doc.summary && (
              <p className="mt-3 text-xs text-stone-500 leading-relaxed line-clamp-2">
                {doc.summary.slice(0, 80)}{doc.summary.length > 80 ? '...' : ''}
              </p>
            )}

            {/* 删除按钮 */}
            <button
              onClick={(e) => handleDeleteClick(e, doc.id)}
              className={`
                absolute top-3 right-3 flex items-center justify-center
                w-7 h-7 rounded-lg transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-red-400
                ${isConfirming
                  ? 'bg-red-500 text-white shadow-md'
                  : 'bg-stone-100 text-stone-400 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-500'
                }
              `}
              title={isConfirming ? '确认删除' : '删除'}
              aria-label={isConfirming ? '确认删除此文档' : '删除此文档'}
            >
              {isConfirming ? (
                <span className="text-[10px] font-bold">确认</span>
              ) : isDeleting ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>

            {/* 取消删除确认 */}
            {isConfirming && (
              <button
                onClick={handleCancelDelete}
                className="absolute bottom-3 right-3 text-[10px] text-stone-400 hover:text-stone-600 underline focus:outline-none"
                aria-label="取消删除"
              >
                取消
              </button>
            )}

            {/* 选中指示器 */}
            {isSelected && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-amber-500 rounded-r-full" />
            )}
          </div>
        );
      })}
    </div>
  );
}
