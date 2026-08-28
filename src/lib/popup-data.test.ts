import { afterEach, describe, expect, it, vi } from "vitest";

import type { FolderEntry } from "./folders";
import {
  fetchBookmarksForUrl,
  fetchFolders,
  parsePopupDataRequest,
} from "./popup-data";

type Node = browser.bookmarks.BookmarkTreeNode;

const CACHED_FOLDERS: FolderEntry[] = [
  {
    id: "unfiled_____",
    title: "Other",
    path: "Other",
    parentId: "root________",
  },
  { id: "f-dev", title: "dev", path: "Other/dev", parentId: "unfiled_____" },
];

const LIVE_TREE: Node = {
  id: "root________",
  title: "",
  children: [
    { id: "menu________", title: "Bookmarks Menu", children: [] },
    { id: "unfiled_____", title: "Other Bookmarks", children: [] },
  ],
};

// A complete node, so the pass-through assertion fails if a narrowed
// responder drops a field the popup's selector and model read.
const CACHED_MATCHES: Node[] = [
  {
    id: "b-cached",
    title: "Cached",
    url: "https://example.com/",
    parentId: "f-dev",
    dateAdded: 1_700_000_000_000,
  },
];

const LIVE_MATCHES: Node[] = [
  { id: "b-live", title: "Live", url: "https://example.com/" },
];

interface Stubs {
  sendMessage: ReturnType<typeof vi.fn>;
  getTree: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
}

function stubBrowser(response: {
  sendMessage: () => Promise<unknown>;
  search?: () => Promise<Node[]>;
}): Stubs {
  const stubs: Stubs = {
    sendMessage: vi.fn(response.sendMessage),
    getTree: vi.fn(() => Promise.resolve([LIVE_TREE])),
    search: vi.fn(response.search ?? (() => Promise.resolve(LIVE_MATCHES))),
  };
  vi.stubGlobal("browser", {
    runtime: { sendMessage: stubs.sendMessage },
    bookmarks: { getTree: stubs.getTree, search: stubs.search },
  });
  return stubs;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchFolders", () => {
  it("returns the background page's answer without querying the tree", async () => {
    const stubs = stubBrowser({
      sendMessage: () => Promise.resolve(CACHED_FOLDERS),
    });

    await expect(fetchFolders()).resolves.toEqual(CACHED_FOLDERS);

    expect(stubs.sendMessage).toHaveBeenCalledWith({ type: "get-folders" });
    expect(stubs.getTree).not.toHaveBeenCalled();
  });

  it("falls back to the live query when the message rejects", async () => {
    const stubs = stubBrowser({
      sendMessage: () => Promise.reject(new Error("no listener")),
    });

    const folders = await fetchFolders();

    expect(folders.map((f) => f.path)).toEqual(["Menu", "Other"]);
    expect(stubs.getTree).toHaveBeenCalledTimes(1);
  });

  it("falls back to the live query when nobody answers", async () => {
    const stubs = stubBrowser({
      sendMessage: () => Promise.resolve(undefined),
    });

    const folders = await fetchFolders();

    expect(folders.map((f) => f.id)).toEqual(["menu________", "unfiled_____"]);
    expect(stubs.getTree).toHaveBeenCalledTimes(1);
  });

  it("falls back to the live query when the answer is not an array", async () => {
    const stubs = stubBrowser({
      sendMessage: () => Promise.resolve({ error: "boom" }),
    });

    const folders = await fetchFolders();

    expect(folders.map((f) => f.path)).toEqual(["Menu", "Other"]);
    expect(stubs.getTree).toHaveBeenCalledTimes(1);
  });

  it("falls back to the live query on a malformed response", async () => {
    const stubs = stubBrowser({
      sendMessage: () => Promise.resolve([{ id: "f-dev", title: "dev" }]),
    });

    const folders = await fetchFolders();

    expect(folders.map((f) => f.path)).toEqual(["Menu", "Other"]);
    expect(stubs.getTree).toHaveBeenCalledTimes(1);
  });
});

describe("fetchBookmarksForUrl", () => {
  const url = "https://example.com/";

  it("returns the background page's answer without searching", async () => {
    const stubs = stubBrowser({
      sendMessage: () => Promise.resolve(CACHED_MATCHES),
    });

    await expect(fetchBookmarksForUrl(url)).resolves.toEqual(CACHED_MATCHES);

    expect(stubs.sendMessage).toHaveBeenCalledWith({
      type: "get-bookmarks",
      url,
    });
    expect(stubs.search).not.toHaveBeenCalled();
  });

  it("returns an empty answer from the cache as is", async () => {
    const stubs = stubBrowser({ sendMessage: () => Promise.resolve([]) });

    await expect(fetchBookmarksForUrl(url)).resolves.toEqual([]);

    expect(stubs.search).not.toHaveBeenCalled();
  });

  it("falls back to the live search when the message rejects", async () => {
    const stubs = stubBrowser({
      sendMessage: () => Promise.reject(new Error("no listener")),
    });

    await expect(fetchBookmarksForUrl(url)).resolves.toEqual(LIVE_MATCHES);

    expect(stubs.search).toHaveBeenCalledWith({ url });
  });

  it("falls back to the live search when nobody answers", async () => {
    const stubs = stubBrowser({
      sendMessage: () => Promise.resolve(undefined),
    });

    await expect(fetchBookmarksForUrl(url)).resolves.toEqual(LIVE_MATCHES);

    expect(stubs.search).toHaveBeenCalledWith({ url });
  });

  it("falls back to the live search when the answer is not an array", async () => {
    const stubs = stubBrowser({
      sendMessage: () => Promise.resolve("unexpected"),
    });

    await expect(fetchBookmarksForUrl(url)).resolves.toEqual(LIVE_MATCHES);

    expect(stubs.search).toHaveBeenCalledTimes(1);
  });

  it("falls back to the live search on a malformed response", async () => {
    const stubs = stubBrowser({
      sendMessage: () => Promise.resolve([{ title: "no id" }]),
    });

    await expect(fetchBookmarksForUrl(url)).resolves.toEqual(LIVE_MATCHES);

    expect(stubs.search).toHaveBeenCalledTimes(1);
  });

  it("returns nothing when both the message and the search reject", async () => {
    // A privileged or about: URL makes bookmarks.search reject.
    const stubs = stubBrowser({
      sendMessage: () => Promise.reject(new Error("no listener")),
      search: () => Promise.reject(new Error("unparseable URL")),
    });

    await expect(fetchBookmarksForUrl("about:config")).resolves.toEqual([]);

    expect(stubs.search).toHaveBeenCalledTimes(1);
  });
});

describe("parsePopupDataRequest", () => {
  it("narrows a well-formed folder request", () => {
    expect(parsePopupDataRequest({ type: "get-folders" })).toEqual({
      type: "get-folders",
    });
  });

  it("narrows a well-formed bookmark request", () => {
    expect(
      parsePopupDataRequest({
        type: "get-bookmarks",
        url: "https://example.com/",
      }),
    ).toEqual({ type: "get-bookmarks", url: "https://example.com/" });
  });

  it.each([
    ["a non-object", "get-folders"],
    ["null", null],
    ["undefined", undefined],
    ["an unknown type", { type: "open-popup" }],
    ["a missing type", { url: "https://example.com/" }],
    ["a bookmark request without a url", { type: "get-bookmarks" }],
    [
      "a bookmark request with a non-string url",
      { type: "get-bookmarks", url: 42 },
    ],
  ])("rejects %s", (_name, value) => {
    expect(parsePopupDataRequest(value)).toBeNull();
  });
});
