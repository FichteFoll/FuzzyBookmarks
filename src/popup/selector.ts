// Multi-bookmark selector (req 16) and commit-input assembly.
// The row model and buildCommitInput are pure and DOM-free;
// pickBookmark is the thin DOM layer over the rows.

import type { CommitInput } from "../lib/bookmark-actions";
import { resolveCreatePath, type FolderEntry } from "../lib/folders";
import { formatAbsoluteTime, formatRelativeTime } from "../lib/relative-time";
import { isNarrowed, type PickerState } from "./folder-picker";

// Firefox's "Other Bookmarks" root: the create-path anchor
// when no default folder is configured.
export const FALLBACK_PARENT_ID = "unfiled_____";

export interface SelectorRow {
  bookmarkId: string;
  title: string;
  folderPath: string;
  dateAdded: number | null;
}

type SelectorBookmark = Pick<
  browser.bookmarks.BookmarkTreeNode,
  "id" | "title" | "parentId" | "dateAdded"
>;

export function buildSelectorRows(
  bookmarks: readonly SelectorBookmark[],
  folders: readonly FolderEntry[],
): SelectorRow[] {
  const pathById = new Map(folders.map((entry) => [entry.id, entry.path]));
  return bookmarks
    .map((bookmark) => ({
      bookmarkId: bookmark.id,
      title: bookmark.title,
      folderPath: bookmark.parentId
        ? (pathById.get(bookmark.parentId) ?? "")
        : "",
      dateAdded: bookmark.dateAdded ?? null,
    }))
    .sort((a, b) => (b.dateAdded ?? 0) - (a.dateAdded ?? 0));
}

export interface CommitFormState {
  url: string;
  title: string;
  picker: PickerState;
  folders: FolderEntry[];
  existingBookmark: { id: string; parentId: string } | null;
  copyRequested: boolean;
  defaultFolderId: string | null;
  titleChanged: boolean;
}

export function buildCommitInput(form: CommitFormState): CommitInput {
  const selected = form.picker.items[form.picker.selectedIndex] ?? null;

  let selectedFolderId: string | null = null;
  let createFolder: CommitInput["createFolder"] = null;
  if (selected?.kind === "folder") {
    selectedFolderId = selected.entry.id;
  } else if (selected?.kind === "create") {
    const anchor = form.defaultFolderId ?? FALLBACK_PARENT_ID;
    const resolved = resolveCreatePath(selected.title, form.folders, anchor);
    createFolder = {
      parentId: resolved.parentId,
      segments: resolved.missingSegments,
    };
  }

  return {
    url: form.url,
    title: form.title,
    queryNarrowed: isNarrowed(form.picker),
    selectedFolderId,
    createFolder,
    existingBookmark: form.existingBookmark,
    copyRequested: form.copyRequested,
    defaultFolderId: form.defaultFolderId,
    titleChanged: form.titleChanged,
  };
}

export type SelectorChoice =
  { kind: "existing"; bookmarkId: string } | { kind: "new" };

// Shows the selector in `container` and resolves with the picked choice.
// ArrowUp/ArrowDown move the selection (wrapping), Enter or a click picks.
// The container's visibility is the caller's concern (see `showView` in
// `./views`); this function only renders into it and focuses it.
export function pickBookmark(
  container: HTMLElement,
  rows: SelectorRow[],
): Promise<SelectorChoice> {
  return new Promise((resolve) => {
    const optionCount = rows.length + 1;
    let selectedIndex = 0;
    const list = document.createElement("ul");
    list.setAttribute("role", "listbox");

    const applySelection = (): void => {
      for (let i = 0; i < list.children.length; i++) {
        const li = list.children[i] as HTMLElement;
        if (i === selectedIndex) {
          li.setAttribute("aria-selected", "true");
          li.scrollIntoView({ block: "nearest" });
        } else {
          li.removeAttribute("aria-selected");
        }
      }
    };

    rows.forEach((row, index) => {
      const li = renderRow(row);
      li.id = `bookmark-option-${index}`;
      li.addEventListener("click", () =>
        resolve({ kind: "existing", bookmarkId: row.bookmarkId }),
      );
      list.append(li);
    });

    const newBookmarkOption = document.createElement("li");
    newBookmarkOption.setAttribute("role", "option");
    newBookmarkOption.className = "selector-new";
    newBookmarkOption.id = `bookmark-option-${rows.length}`;
    newBookmarkOption.textContent = "New bookmark for this page";
    newBookmarkOption.addEventListener("click", () => resolve({ kind: "new" }));
    list.append(newBookmarkOption);

    // Every handled key is also stopped from propagating:
    // the pick resolves during this very event's dispatch, so the awaiting
    // popup startup reaches `wireActions` and attaches its document-level
    // Enter handler before the event finishes bubbling to `document`.
    container.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        selectedIndex = (selectedIndex + delta + optionCount) % optionCount;
        applySelection();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const row = rows[selectedIndex];
        resolve(
          row
            ? { kind: "existing", bookmarkId: row.bookmarkId }
            : { kind: "new" },
        );
      }
    });

    const heading = document.createElement("p");
    heading.textContent = "Multiple bookmarks exist for this page; pick one:";
    container.replaceChildren(heading, list);
    container.tabIndex = -1;
    container.focus();
    applySelection();
  });
}

function renderRow(row: SelectorRow): HTMLLIElement {
  const li = document.createElement("li");
  li.setAttribute("role", "option");

  const title = document.createElement("span");
  title.className = "selector-title";
  title.textContent = row.title;

  const path = document.createElement("span");
  path.className = "selector-path";
  path.textContent = row.folderPath;

  const date = document.createElement("span");
  date.className = "selector-date";
  date.textContent =
    row.dateAdded === null ? "" : formatRelativeTime(row.dateAdded, Date.now());
  date.title = row.dateAdded === null ? "" : formatAbsoluteTime(row.dateAdded);

  const meta = document.createElement("span");
  meta.className = "selector-meta";
  meta.append(path, date);

  li.append(title, meta);
  return li;
}
