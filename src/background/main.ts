// FuzzyBookmarks background event page (MV3 "background.scripts").

import { listFolders } from "../lib/folders";
import { parsePopupDataRequest } from "../lib/popup-data";
import { createBookmarkCache } from "./cache";

// The only cache of the popup's bookmark data. It lives in this page's
// memory, so no browsing URL is written to disk.
const cache = createBookmarkCache({
  loadFolders: listFolders,
  searchUrl: (url) => browser.bookmarks.search({ url }),
});

async function openPopup(): Promise<void> {
  try {
    await browser.action.openPopup();
  } catch {
    // openPopup requires a user-input context that may not survive the
    // runtime message; fall back to a standalone popup window.
    await browser.windows.create({
      type: "popup",
      url: "popup/popup.html",
      width: 440,
      height: 560,
    });
  }
}

// Returning a promise is how Firefox sends a response back to the sender;
// returning undefined leaves the message to any other listener.
browser.runtime.onMessage.addListener((message: unknown) => {
  const request = parsePopupDataRequest(message);
  if (request?.type === "get-folders") return cache.getFolders();
  if (request?.type === "get-bookmarks") {
    // An unsearchable URL answers with an empty list rather than rejecting
    // the popup's send, which the popup could not tell from a missing page.
    return cache.getBookmarksForUrl(request.url).catch(() => []);
  }

  if ((message as { type?: unknown } | null)?.type !== "open-popup") return;
  void openPopup();
});

const FILLED_ICON = "icons/fuzzybookmarks.svg";

async function isBookmarked(url: string): Promise<boolean> {
  try {
    const matches = await cache.getBookmarksForUrl(url);
    return matches.length > 0;
  } catch {
    // search() rejects for URLs it cannot parse (privileged pages, "about:").
    return false;
  }
}

async function updateIcon(
  tabId: number,
  url: string | undefined,
): Promise<void> {
  if (!url) return;
  const path = (await isBookmarked(url)) ? FILLED_ICON : null;
  // `path: null` resets the tab to the manifest default (the outline icon),
  // which stays theme-aware on its own; the bundled types omit the null.
  await browser.action.setIcon({
    tabId,
    path,
  } as browser.action._SetIconDetails);
}

async function updateActiveTabs(): Promise<void> {
  const tabs = await browser.tabs.query({ active: true });
  await Promise.all(
    tabs
      .filter(
        (tab): tab is browser.tabs.Tab & { id: number } => tab.id !== undefined,
      )
      .map((tab) => updateIcon(tab.id, tab.url)),
  );
}

// Listeners are registered at the top level: the event page can be suspended
// and re-woken at any time.
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Per-tab icons reset on navigation, so re-evaluate whenever the URL changes.
  if (!changeInfo.url) return;
  void updateIcon(tabId, changeInfo.url);
});

browser.tabs.onActivated.addListener(({ tabId }) => {
  void browser.tabs.get(tabId).then((tab) => updateIcon(tabId, tab.url));
});

const onBookmarkMutation = () => {
  cache.invalidate();
  void updateActiveTabs();
};

browser.bookmarks.onCreated.addListener(onBookmarkMutation);
browser.bookmarks.onRemoved.addListener(onBookmarkMutation);
browser.bookmarks.onChanged.addListener(onBookmarkMutation);

// A move rewrites the folder's own path, its parentId and every descendant
// path, so the cached folder list must go; it cannot change whether a URL is
// bookmarked, so the icons stay as they are. onChildrenReordered changes no
// path and needs neither.
browser.bookmarks.onMoved.addListener(() => cache.invalidate());

void updateActiveTabs();
// Warm the folder list on this page's wake, so the tree walk happens here
// instead of on the popup's critical path.
void cache.getFolders();
