import type { FolderEntry } from "../lib/folders";

export interface BookmarkCacheOptions {
  loadFolders: () => Promise<FolderEntry[]>;
  searchUrl: (url: string) => Promise<browser.bookmarks.BookmarkTreeNode[]>;
  rewarmDelayMs?: number;
  urlCacheSize?: number;
}

export interface BookmarkCache {
  getFolders(): Promise<FolderEntry[]>;
  getBookmarksForUrl(
    url: string,
  ): Promise<browser.bookmarks.BookmarkTreeNode[]>;
  invalidate(): void;
}

const DEFAULT_REWARM_DELAY_MS = 1000;
const DEFAULT_URL_CACHE_SIZE = 50;

export function createBookmarkCache({
  loadFolders,
  searchUrl,
  rewarmDelayMs = DEFAULT_REWARM_DELAY_MS,
  urlCacheSize = DEFAULT_URL_CACHE_SIZE,
}: BookmarkCacheOptions): BookmarkCache {
  // Promises, not results, are cached: callers that overlap in time then
  // share the single in-flight load instead of starting one each.
  let folders: Promise<FolderEntry[]> | null = null;
  const urls = new Map<string, Promise<browser.bookmarks.BookmarkTreeNode[]>>();
  let rewarmTimer: ReturnType<typeof setTimeout> | null = null;

  const getFolders = (): Promise<FolderEntry[]> => {
    if (folders) return folders;

    const pending = loadFolders();
    folders = pending;
    // A rejection must not be served forever; drop it so the next caller
    // retries the load.
    pending.catch(() => {
      if (folders === pending) folders = null;
    });
    return pending;
  };

  const getBookmarksForUrl = (
    url: string,
  ): Promise<browser.bookmarks.BookmarkTreeNode[]> => {
    const cached = urls.get(url);
    if (cached) return cached;

    const pending = searchUrl(url);
    urls.set(url, pending);
    pending.catch(() => {
      if (urls.get(url) === pending) urls.delete(url);
    });
    // Map iteration yields insertion order, so the first key is the oldest.
    if (urls.size > urlCacheSize) {
      const oldest = urls.keys().next();
      if (!oldest.done) urls.delete(oldest.value);
    }
    return pending;
  };

  const invalidate = (): void => {
    folders = null;
    urls.clear();
    // One rewarm per burst: a bookmark import fires many events, and only
    // the last one should pay for a tree walk.
    if (rewarmTimer !== null) clearTimeout(rewarmTimer);
    rewarmTimer = setTimeout(() => {
      rewarmTimer = null;
      void getFolders();
    }, rewarmDelayMs);
  };

  return { getFolders, getBookmarksForUrl, invalidate };
}
