/**
 * UploadZone - 拖拽上传组件
 * 支持拖拽文件上传 + 点击选择文件，限制PDF和TXT格式，最大10MB
 */
import React, { useCallback, useRef, useState } from 'react';
import type { UploadZoneProps } from '../types';

const ALLOWED_TYPES = ['application/pdf', 'text/plain'];
const ALLOWED_EXTENSIONS = ['.pdf', '.txt'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 验证文件类型和大小 */
function validateFile(file: File): string | null {
  const isAllowedType = ALLOWED_TYPES.includes(file.type) ||
    ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
  if (!isAllowedType) {
    return '仅支持 .pdf 和 .txt 格式的文件';
  }
  if (file.size > MAX_SIZE) {
    return `文件大小不能超过 ${formatFileSize(MAX_SIZE)}`;
  }
  if (file.size === 0) {
    return '文件不能为空';
  }
  return null;
}

export default function UploadZone({ onUpload, uploading, uploadProgress }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  /** 清除状态提示 */
  const clearStatus = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  /** 处理文件选择 */
  const handleFile = useCallback(async (file: File) => {
    clearStatus();
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      await onUpload(file);
      setSuccess(`「${file.name}」上传成功`);
      // 3秒后清除成功提示
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('上传失败，请稍后重试');
    }
  }, [onUpload, clearStatus]);

  /** 点击选择文件 */
  const handleClick = useCallback(() => {
    if (uploading) return;
    inputRef.current?.click();
  }, [uploading]);

  /** 文件输入变化 */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // 重置input以便可以重复选择同一文件
    e.target.value = '';
  }, [handleFile]);

  /** 拖拽进入 */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragging(true);
    clearStatus();
  }, [clearStatus]);

  /** 拖拽离开 */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  /** 拖拽悬停 */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /** 放置文件 */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  return (
    <div className="w-full">
      {/* 隐藏的文件输入 */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt"
        className="hidden"
        onChange={handleInputChange}
        aria-label="选择文件"
      />

      {/* 拖拽区域 */}
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        role="button"
        tabIndex={uploading ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-label="点击或拖拽文件到此处上传"
        className={`
          relative flex flex-col items-center justify-center
          w-full px-6 py-8 rounded-xl border-2 border-dashed
          transition-all duration-200 ease-in-out cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2
          ${isDragging
            ? 'border-amber-500 bg-amber-50 scale-[1.02]'
            : 'border-stone-300 bg-white hover:border-amber-400 hover:bg-amber-50/50'
          }
          ${uploading ? 'opacity-70 cursor-not-allowed' : ''}
        `}
      >
        {uploading ? (
          /* 上传中状态 */
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-3 border-amber-200" />
              <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-amber-500 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-stone-600">
                正在上传...
              </p>
              {uploadProgress && (
                <p className="text-xs text-stone-400 mt-1">{uploadProgress}</p>
              )}
            </div>
          </div>
        ) : (
          /* 默认状态 */
          <>
            <div className={`
              flex items-center justify-center w-14 h-14 rounded-full mb-3
              transition-colors duration-200
              ${isDragging ? 'bg-amber-100' : 'bg-amber-50'}
            `}>
              <svg
                className={`w-7 h-7 transition-colors duration-200 ${isDragging ? 'text-amber-600' : 'text-amber-500'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-stone-700 text-center">
              {isDragging ? '松开以上传文件' : '点击选择或拖拽文件到此处'}
            </p>
            <p className="text-xs text-stone-400 mt-1.5 text-center">
              支持 PDF、TXT 格式，最大 10MB
            </p>
          </>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mt-3 flex items-start gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 animate-[fadeIn_0.2s_ease-out]">
          <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 成功提示 */}
      {success && (
        <div className="mt-3 flex items-start gap-2 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 animate-[fadeIn_0.2s_ease-out]">
          <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-700">{success}</p>
        </div>
      )}
    </div>
  );
}
