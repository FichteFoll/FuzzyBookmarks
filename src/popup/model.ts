// Popup data model: what the popup shows about the current page
// and, if it exists, the bookmark already filed for it.

import type { CommitKind } from "../lib/bookmark-actions";

export interface PopupModel {
  pageTitle: string;
  favIconUrl: string | null;
  bookmarkId: string | null;
  folderId: string | null;
  dateAdded: number | null;
  removeEnabled: boolean;
}

// Keyed by kind so a new commit kind cannot be forgotten here.
const COMMIT_CAPTIONS: Record<CommitKind, string> = {
  create: "Create",
  update: "Save",
  rename: "Rename",
  move: "Move",
  copy: "Copy",
};

export function commitButtonCaption(kind: CommitKind): string {
  return COMMIT_CAPTIONS[kind];
}

// The single definition of "the user edited the name":
// the caption and the commit it describes must agree on it.
export function isTitleChanged(
  model: PopupModel,
  currentTitle: string,
): boolean {
  return currentTitle !== model.pageTitle;
}

type PopupTab = Pick<browser.tabs.Tab, "title" | "favIconUrl" | "url">;
type PopupBookmark = Pick<
  browser.bookmarks.BookmarkTreeNode,
  "id" | "title" | "parentId" | "dateAdded"
>;

export function derivePopupModel(
  tab: PopupTab,
  bookmarks: PopupBookmark[],
): PopupModel {
  const favIconUrl = tab.favIconUrl ?? null;
  const [bookmark] = bookmarks;

  if (!bookmark) {
    return {
      pageTitle: tab.title ?? "",
      favIconUrl,
      bookmarkId: null,
      folderId: null,
      dateAdded: null,
      removeEnabled: false,
    };
  }

  return {
    pageTitle: bookmark.title,
    favIconUrl,
    bookmarkId: bookmark.id,
    folderId: bookmark.parentId ?? null,
    dateAdded: bookmark.dateAdded ?? null,
    removeEnabled: true,
  };
}

export async function loadPopupModel(): Promise<PopupModel> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const activeTab: PopupTab = tab ?? {
    title: "",
    favIconUrl: undefined,
    url: undefined,
  };

  if (!activeTab.url) {
    return derivePopupModel(activeTab, []);
  }

  const bookmarks = await browser.bookmarks.search({ url: activeTab.url });
  return derivePopupModel(activeTab, bookmarks);
}
