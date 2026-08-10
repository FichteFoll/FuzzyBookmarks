// Popup data model: what the popup shows about the current page
// and, if it exists, the bookmark already filed for it.

export interface PopupModel {
  pageTitle: string;
  favIconUrl: string | null;
  bookmarkId: string | null;
  folderId: string | null;
  dateAdded: number | null;
  commitLabel: "Create" | "Save";
  removeEnabled: boolean;
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
      commitLabel: "Create",
      removeEnabled: false,
    };
  }

  return {
    pageTitle: bookmark.title,
    favIconUrl,
    bookmarkId: bookmark.id,
    folderId: bookmark.parentId ?? null,
    dateAdded: bookmark.dateAdded ?? null,
    commitLabel: "Save",
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
