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

// Bookmark root node ids are stable across profiles and locales;
// aliasing by id (rather than title) keeps paths correct
// even for renamed or localized roots.
// This mirrors the root-alias rule that will live in src/lib/folders.ts (C2);
// duplicated here only because that module does not exist yet in this worktree.
const ROOT_ALIASES: Record<string, string> = {
  menu________: "Menu",
  toolbar_____: "Toolbar",
  unfiled_____: "Other",
  mobile______: "Mobile",
};

// Resolves the full "/"-separated folder path for #meta-folder
// by walking the parentId chain up to (and including) the aliased root.
export async function resolveFolderPath(folderId: string): Promise<string> {
  const segments: string[] = [];
  let currentId: string | undefined = folderId;

  while (currentId) {
    const [node] = await browser.bookmarks.get(currentId);
    if (!node) break;

    const alias = ROOT_ALIASES[node.id];
    segments.unshift(alias ?? node.title);
    if (alias) break;

    currentId = node.parentId;
  }

  return segments.join("/");
}
