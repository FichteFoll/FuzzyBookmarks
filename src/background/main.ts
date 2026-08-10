// FuzzyBookmarks background event page (MV3 "background.scripts").

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

browser.runtime.onMessage.addListener((message: unknown) => {
  if ((message as { type?: unknown } | null)?.type !== "open-popup") return;
  void openPopup();
});

const FILLED_ICON = "icons/fuzzybookmarks.svg";

async function isBookmarked(url: string): Promise<boolean> {
  try {
    const matches = await browser.bookmarks.search({ url });
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

// onMoved cannot change whether a URL is bookmarked and is therefore skipped.
browser.bookmarks.onCreated.addListener(() => void updateActiveTabs());
browser.bookmarks.onRemoved.addListener(() => void updateActiveTabs());
browser.bookmarks.onChanged.addListener(() => void updateActiveTabs());

void updateActiveTabs();
