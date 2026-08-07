/**
 * 多文章文档管理模块
 * 管理文章元数据（索引、标题、时间）、当前活动文章 id，
 * 正文与历史版本由 storageManager 按文章 id 隔离存储。
 */

import { logger } from './logger.js';
import {
  storageManager,
  articleKeyFor,
  LEGACY_CONTENT_KEY,
  LEGACY_HISTORY_KEY,
} from './storage.js';

// 存储键名
const ARTICLES_INDEX_KEY = 'vulncycleinsight_articles';
const ACTIVE_ARTICLE_KEY = 'vulncycleinsight_active_article';
const MIGRATED_KEY = 'vulncycleinsight_migrated_v1';

export interface ArticleMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** 手动重命名后锁定标题，不再随正文自动更新 */
  titleLocked?: boolean;
}

export class DocumentStore {
  /**
   * 获取全部文章元数据（按创建时间升序）
   */
  listArticles(): ArticleMeta[] {
    return this.readIndex();
  }

  /**
   * 获取指定文章元数据
   */
  getArticleById(id: string): ArticleMeta | null {
    return this.readIndex().find(meta => meta.id === id) ?? null;
  }

  /**
   * 获取当前活动文章 id（无则返回 null）
   */
  getActiveArticleId(): string | null {
    try {
      const stored = localStorage.getItem(ACTIVE_ARTICLE_KEY);
      if (stored && this.readIndex().some(meta => meta.id === stored)) {
        return stored;
      }
    } catch (error) {
      logger.error('读取活动文章失败:', error);
    }
    return null;
  }

  /**
   * 设置当前活动文章 id
   */
  setActiveArticleId(id: string): void {
    try {
      localStorage.setItem(ACTIVE_ARTICLE_KEY, id);
    } catch (error) {
      logger.error('保存活动文章失败:', error);
    }
  }

  /**
   * 新建文章：写入索引、保存正文、设为活动文章
   */
  createArticle(content: string): ArticleMeta {
    const now = new Date().toISOString();
    const id = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const title = this.extractTitleFromContent(content) ?? this.nextUntitledName();
    const meta: ArticleMeta = { id, title, createdAt: now, updatedAt: now };

    const list = this.readIndex();
    list.push(meta);
    this.writeIndex(list);

    storageManager.setActiveArticleId(id);
    storageManager.manualSave(content);
    this.setActiveArticleId(id);
    return meta;
  }

  /**
   * 更新文章元数据（保存时间、自动提取标题）
   * 标题自动跟随正文中第一个 # 标题；手动重命名后不再自动更新
   */
  touchArticle(id: string, content: string): void {
    const list = this.readIndex();
    const meta = list.find(item => item.id === id);
    if (!meta) return;
    meta.updatedAt = new Date().toISOString();
    if (!meta.titleLocked) {
      const extracted = this.extractTitleFromContent(content);
      if (extracted) {
        meta.title = extracted;
      }
    }
    this.writeIndex(list);
  }

  /**
   * 手动重命名文章（锁定标题）
   */
  renameArticle(id: string, title: string): void {
    const trimmed = title.trim();
    if (!trimmed) return;
    const list = this.readIndex();
    const meta = list.find(item => item.id === id);
    if (!meta) return;
    meta.title = trimmed;
    meta.titleLocked = true;
    this.writeIndex(list);
  }

  /**
   * 删除文章：从索引移除并清理存储
   * 若删除的是活动文章，活动文章切到列表第一篇（无则清空）
   */
  deleteArticle(id: string): void {
    const wasActive = this.getActiveArticleId() === id;
    const list = this.readIndex().filter(meta => meta.id !== id);
    this.writeIndex(list);
    storageManager.removeArticleStorage(id);

    if (wasActive) {
      const next = list[0]?.id ?? null;
      if (next) {
        this.setActiveArticleId(next);
      } else {
        try {
          localStorage.removeItem(ACTIVE_ARTICLE_KEY);
        } catch (error) {
          logger.error('清除活动文章失败:', error);
        }
      }
    }
  }

  /**
   * 旧版单篇数据迁移：将旧键内容与历史迁入一篇文章
   * 仅在标记不存在时执行一次
   */
  migrateLegacyData(): boolean {
    try {
      if (localStorage.getItem(MIGRATED_KEY) !== null) {
        return false;
      }
      // 先写标记：若中途失败则回滚，避免重试时重复建文章
      localStorage.setItem(MIGRATED_KEY, '1');
      const legacyContent = localStorage.getItem(LEGACY_CONTENT_KEY);
      if (legacyContent !== null) {
        const meta = this.createArticle(legacyContent);
        const legacyHistory = localStorage.getItem(LEGACY_HISTORY_KEY);
        if (legacyHistory) {
          localStorage.setItem(articleKeyFor(meta.id, 'history'), legacyHistory);
        }
      }
      return true;
    } catch (error) {
      logger.error('迁移旧数据失败:', error);
      try {
        localStorage.removeItem(MIGRATED_KEY);
      } catch {
        // 忽略回滚失败
      }
      return false;
    }
  }

  /**
   * 从正文中提取标题（第一个 # 标题行），无则返回 null
   */
  private extractTitleFromContent(content: string): string | null {
    for (const line of content.split('\n')) {
      const match = line.match(/^#{1,6}\s+(.+)$/);
      if (match) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * 生成"未命名报告 N"标题（N 从 1 递增避免重复）
   */
  private nextUntitledName(): string {
    const existing = new Set(this.readIndex().map(meta => meta.title));
    let n = 1;
    while (existing.has(`未命名报告 ${n}`)) {
      n += 1;
    }
    return `未命名报告 ${n}`;
  }

  private readIndex(): ArticleMeta[] {
    try {
      const raw = localStorage.getItem(ARTICLES_INDEX_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(meta => this.isValidMeta(meta));
    } catch (error) {
      logger.error('读取文章索引失败:', error);
      return [];
    }
  }

  private writeIndex(list: ArticleMeta[]): void {
    try {
      localStorage.setItem(ARTICLES_INDEX_KEY, JSON.stringify(list));
    } catch (error) {
      logger.error('保存文章索引失败:', error);
    }
  }

  private isValidMeta(meta: unknown): meta is ArticleMeta {
    if (!meta || typeof meta !== 'object') return false;
    const record = meta as ArticleMeta;
    return (
      typeof record.id === 'string' &&
      typeof record.title === 'string' &&
      typeof record.createdAt === 'string' &&
      typeof record.updatedAt === 'string'
    );
  }
}

// 导出单例实例
export const documentStore = new DocumentStore();
