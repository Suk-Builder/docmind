/**
 * useDocuments 自定义 Hook
 * 管理文档相关的所有 API 操作
 */

import { useState, useCallback } from 'react';
import type { Document, DocumentListItem, UseDocumentsReturn } from '../types';

const API_BASE = './api';
const REQUEST_TIMEOUT = 30000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw error;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || errorData.message || `请求失败（状态码: ${response.status}）`;
    throw new Error(errorMessage);
  }
  const data = await response.json();
  // server.js 返回格式: { success: true, data: {...} }
  return data.data as T;
}

export function useDocuments(): UseDocumentsReturn {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await handleResponse<DocumentListItem[]>(
        await fetchWithTimeout(`${API_BASE}/documents`)
      );
      setDocuments(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取文档列表失败';
      setError(message);
      console.error('[useDocuments] fetchDocuments error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadDocument = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetchWithTimeout(`${API_BASE}/documents`, {
        method: 'POST',
        body: formData,
      });
      const result = await handleResponse<{ id: string }>(response);
      await fetchDocuments();
      return { success: true, documentId: result.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : '上传文档失败';
      setError(message);
      console.error('[useDocuments] uploadDocument error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchDocuments]);

  const deleteDocument = useCallback(async (docId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await fetchWithTimeout(`${API_BASE}/documents/${docId}`, { method: 'DELETE' });
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
      if (currentDocument?.id === docId) {
        setCurrentDocument(null);
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除文档失败';
      setError(message);
      console.error('[useDocuments] deleteDocument error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentDocument]);

  const getDocument = useCallback(async (docId: string): Promise<Document | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await handleResponse<Document>(
        await fetchWithTimeout(`${API_BASE}/documents/${docId}`)
      );
      if (data) {
        setCurrentDocument(data);
      }
      return data || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取文档详情失败';
      setError(message);
      console.error('[useDocuments] getDocument error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    documents,
    loading,
    error,
    currentDocument,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    getDocument,
    clearError,
    setCurrentDocument,
  };
}

export default useDocuments;
