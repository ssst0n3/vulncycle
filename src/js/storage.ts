/**
 * 基于浏览器的保存功能模块
 * 提供 LocalStorage 自动保存和文件下载功能
 */

import { logger } from './logger.js';

// 存储键名
const STORAGE_KEY = 'vulncycleinsight_content';
const STORAGE_TIMESTAMP_KEY = 'vulncycleinsight_timestamp';
const STORAGE_HISTORY_KEY = 'vulncycleinsight_history';
const MAX_HISTORY_ENTRIES = 20;

// 自动保存间隔（毫秒）
const AUTO_SAVE_INTERVAL = 2000; // 2秒

export interface SaveStatus {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  content: string;
}

export class StorageManager {
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private lastContent: string = '';
  private saveStatusCallback: ((status: SaveStatus) => void) | null = null;

  /**
   * 保存内容到 LocalStorage
   */
  saveToLocalStorage(content: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, content);
      localStorage.setItem(STORAGE_TIMESTAMP_KEY, new Date().toISOString());
      this.lastContent = content;
      this.addHistoryEntry(content);
    } catch (error) {
      logger.error('保存到 LocalStorage 失败:', error);
      // 如果存储空间不足，尝试清理旧数据
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.clearStorage();
        try {
          localStorage.setItem(STORAGE_KEY, content);
          localStorage.setItem(STORAGE_TIMESTAMP_KEY, new Date().toISOString());
          this.lastContent = content;
          this.addHistoryEntry(content);
        } catch (retryError) {
          logger.error('重试保存失败:', retryError);
        }
      }
    }
  }

  /**
   * 从 LocalStorage 加载内容
   */
  loadFromLocalStorage(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      logger.error('从 LocalStorage 加载失败:', error);
      return null;
    }
  }

  /**
   * 获取最后保存时间
   */
  getLastSavedTime(): Date | null {
    try {
      const timestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY);
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      logger.error('获取保存时间失败:', error);
      return null;
    }
  }

  /**
   * 清除 LocalStorage 中的数据
   */
  clearStorage(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
      localStorage.removeItem(STORAGE_HISTORY_KEY);
      this.lastContent = '';
    } catch (error) {
      logger.error('清除存储失败:', error);
    }
  }

  /**
   * 检查是否有未保存的更改
   */
  hasUnsavedChanges(currentContent: string): boolean {
    return currentContent !== this.lastContent;
  }

  /**
   * 下载内容为 Markdown 文件
   */
  downloadAsFile(content: string, filename?: string): void {
    try {
      // 生成默认文件名（如果未提供）
      if (!filename) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        filename = `vulncycleinsight_${dateStr}.md`;
      }

      // 确保文件名以 .md 结尾
      if (!filename.endsWith('.md')) {
        filename += '.md';
      }

      // 创建 Blob 对象
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      // 触发下载
      document.body.appendChild(link);
      link.click();

      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('下载文件失败:', error);
      alert('下载文件失败，请重试');
    }
  }

  /**
   * 启动自动保存
   */
  startAutoSave(getContent: () => string, onStatusChange?: (status: SaveStatus) => void): void {
    this.saveStatusCallback = onStatusChange || null;

    // 立即保存一次
    const initialContent = getContent();
    if (initialContent) {
      this.saveToLocalStorage(initialContent);
      this.updateStatus();
    }

    // 设置定时器
    this.autoSaveTimer = setInterval(() => {
      const content = getContent();
      if (this.hasUnsavedChanges(content)) {
        this.saveToLocalStorage(content);
        this.updateStatus();
      }
    }, AUTO_SAVE_INTERVAL);
  }

  /**
   * 停止自动保存
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * 手动保存（立即保存）
   */
  manualSave(content: string): void {
    this.saveToLocalStorage(content);
    this.updateStatus();
  }

  /**
   * 更新保存状态并通知回调
   */
  private updateStatus(): void {
    if (this.saveStatusCallback) {
      const status: SaveStatus = {
        isSaving: false,
        lastSaved: this.getLastSavedTime(),
        hasUnsavedChanges: false,
      };
      this.saveStatusCallback(status);
    }
  }

  /**
   * 获取当前保存状态
   */
  getSaveStatus(currentContent: string): SaveStatus {
    return {
      isSaving: false,
      lastSaved: this.getLastSavedTime(),
      hasUnsavedChanges: this.hasUnsavedChanges(currentContent),
    };
  }

  /**
   * 获取历史版本列表（最新在前）
   */
  getHistoryEntries(): HistoryEntry[] {
    return this.readHistoryEntries();
  }

  /**
   * 根据 ID 获取历史版本
   */
  getHistoryEntry(id: string): HistoryEntry | null {
    const entries = this.readHistoryEntries();
    return entries.find(entry => entry.id === id) ?? null;
  }

  /**
   * 初始化历史版本（仅在为空时写入）
   */
  seedHistory(content: string): void {
    if (!content) return;
    const entries = this.readHistoryEntries();
    if (entries.length === 0) {
      this.addHistoryEntry(content);
    }
  }

  private readHistoryEntries(): HistoryEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(entry => this.isValidHistoryEntry(entry));
    } catch (error) {
      logger.error('读取历史版本失败:', error);
      return [];
    }
  }

  private isValidHistoryEntry(entry: unknown): entry is HistoryEntry {
    if (!entry || typeof entry !== 'object') return false;
    const record = entry as HistoryEntry;
    return (
      typeof record.id === 'string' &&
      typeof record.timestamp === 'string' &&
      typeof record.content === 'string'
    );
  }

  private addHistoryEntry(content: string): void {
    try {
      const entries = this.readHistoryEntries();
      if (entries[0]?.content === content) return;
      const entry: HistoryEntry = {
        id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        content,
      };
      const nextEntries = [entry, ...entries].slice(0, MAX_HISTORY_ENTRIES);
      this.writeHistoryEntries(nextEntries);
    } catch (error) {
      logger.error('保存历史版本失败:', error);
    }
  }

  private writeHistoryEntries(entries: HistoryEntry[]): void {
    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(entries));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        const trimmedEntries = entries.slice(0, Math.max(1, Math.floor(MAX_HISTORY_ENTRIES / 2)));
        try {
          localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(trimmedEntries));
        } catch (retryError) {
          logger.error('保存历史版本失败:', retryError);
        }
        return;
      }
      throw error;
    }
  }
}

// 导出单例实例
export const storageManager = new StorageManager();
