import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FolderEntry } from "../lib/folders";
import { createBookmarkCache } from "./cache";

type Node = browser.bookmarks.BookmarkTreeNode;

const FOLDERS: FolderEntry[] = [
  {
    id: "unfiled_____",
    title: "Other",
    path: "Other",
    parentId: "root________",
  },
  { id: "f-dev", title: "dev", path: "Other/dev", parentId: "unfiled_____" },
];

function matchesFor(url: string): Node[] {
  return [{ id: `b-${url}`, title: url, url, parentId: "f-dev" }];
}

function setup(overrides: { rewarmDelayMs?: number; urlCacheSize?: number }) {
  const loadFolders = vi.fn(() => Promise.resolve(FOLDERS));
  const searchUrl = vi.fn((url: string) => Promise.resolve(matchesFor(url)));
  const cache = createBookmarkCache({ loadFolders, searchUrl, ...overrides });
  return { cache, loadFolders, searchUrl };
}

describe("createBookmarkCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shares one folder load between overlapping callers", async () => {
    const { cache, loadFolders } = setup({});

    // Both calls are issued before the first load resolves, which is what
    // the memoized promise (rather than a memoized result) has to cover.
    const [first, second] = await Promise.all([
      cache.getFolders(),
      cache.getFolders(),
    ]);

    expect(loadFolders).toHaveBeenCalledTimes(1);
    expect(first).toEqual(FOLDERS);
    expect(second).toEqual(FOLDERS);
  });

  it("searches each URL once and every URL separately", async () => {
    const { cache, searchUrl } = setup({});

    // Both calls for the same URL are issued before the first resolves, so
    // only a promise-memoizing map can answer them with one search.
    const [first, second] = await Promise.all([
      cache.getBookmarksForUrl("https://example.com/"),
      cache.getBookmarksForUrl("https://example.com/"),
    ]);
    await cache.getBookmarksForUrl("https://other.example/");

    expect(searchUrl).toHaveBeenCalledTimes(2);
    expect(searchUrl).toHaveBeenNthCalledWith(1, "https://example.com/");
    expect(searchUrl).toHaveBeenNthCalledWith(2, "https://other.example/");
    expect(second).toEqual(first);
  });

  it("does not cache a rejected load", async () => {
    const { cache, loadFolders } = setup({});
    loadFolders.mockRejectedValueOnce(new Error("no tree"));

    await expect(cache.getFolders()).rejects.toThrow("no tree");
    await expect(cache.getFolders()).resolves.toEqual(FOLDERS);
    expect(loadFolders).toHaveBeenCalledTimes(2);
  });

  it("reloads the folders after an invalidation", async () => {
    const { cache, loadFolders } = setup({});

    await cache.getFolders();
    cache.invalidate();
    await cache.getFolders();

    expect(loadFolders).toHaveBeenCalledTimes(2);
  });

  it("rewarms the folders once, timed from the last invalidation", async () => {
    const { cache, loadFolders } = setup({ rewarmDelayMs: 1000 });

    cache.invalidate();
    await vi.advanceTimersByTimeAsync(600);
    // The second invalidation must replace the pending timer, so nothing
    // loads at 1000ms, where the first one alone would have fired.
    cache.invalidate();
    await vi.advanceTimersByTimeAsync(400);
    expect(loadFolders).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(600);
    expect(loadFolders).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(loadFolders).toHaveBeenCalledTimes(1);
  });

  it("evicts the oldest URL past the cache cap", async () => {
    const { cache, searchUrl } = setup({ urlCacheSize: 2 });

    await cache.getBookmarksForUrl("a");
    await cache.getBookmarksForUrl("b");
    await cache.getBookmarksForUrl("c");
    await cache.getBookmarksForUrl("b");
    await cache.getBookmarksForUrl("a");

    expect(searchUrl.mock.calls.map(([url]) => url)).toEqual([
      "a",
      "b",
      "c",
      "a",
    ]);
  });
});
