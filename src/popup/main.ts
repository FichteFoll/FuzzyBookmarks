// FuzzyBookmarks popup entry point.
// Renders the current-page/bookmark info, wires the folder picker,
// the multi-bookmark selector, and the commit/remove actions.

import {
  applyCommit,
  removeBookmark,
  resolveCommit,
  type CommitPlan,
} from "../lib/bookmark-actions";
import {
  listFolders,
  resolveCreatePath,
  type FolderEntry,
} from "../lib/folders";
import {
  getRecentFolderIds,
  recordFolderUse,
  rememberSelection,
} from "../lib/query-memory";
import { getSettings } from "../lib/settings";
import {
  setupFolderPicker,
  type FolderPickerHandle,
  type PickerItem,
} from "./folder-picker";
import { derivePopupModel, type PopupModel } from "./model";
import {
  buildCommitInput,
  buildSelectorRows,
  pickBookmark,
  FALLBACK_PARENT_ID,
} from "./selector";

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element in popup.html`);
  }
  return element as T;
}

function describeSelection(item: PickerItem | null): string {
  if (!item) return "";
  if (item.kind === "create") return item.title;
  return item.entry.path;
}

interface CommitContext {
  url: string;
  model: PopupModel;
  folders: FolderEntry[];
  defaultFolderId: string | null;
  picker: FolderPickerHandle;
  titleInput: HTMLInputElement;
}

async function commit(
  context: CommitContext,
  copyRequested: boolean,
): Promise<void> {
  const { model } = context;
  const input = buildCommitInput({
    url: context.url,
    title: context.titleInput.value,
    picker: context.picker.getState(),
    folders: context.folders,
    existingBookmark:
      model.bookmarkId !== null && model.folderId !== null
        ? { id: model.bookmarkId, parentId: model.folderId }
        : null,
    copyRequested,
    defaultFolderId: context.defaultFolderId,
  });
  const plan = resolveCommit(input);
  await applyCommit(plan);
  await recordCommit(context, plan);
  window.close();
}

// Req 24: record folder recency on every successful create/move/copy;
// req 10: remember the folder only for a non-empty query.
async function recordCommit(
  context: CommitContext,
  plan: CommitPlan,
): Promise<void> {
  const targetFolderId = await resolveTargetFolderId(context, plan);
  if (targetFolderId === null) return;
  await recordFolderUse(targetFolderId);
  const query = context.picker.getState().query.trim();
  if (query === "") return;
  await rememberSelection(query, targetFolderId);
}

async function resolveTargetFolderId(
  context: CommitContext,
  plan: CommitPlan,
): Promise<string | null> {
  if (plan.kind === "update") return null;
  if (!plan.createFolder) return plan.parentId;
  // applyCommit does not report the folders it created;
  // re-resolve the create path against a fresh folder list
  // to learn the deepest created folder's id.
  const selected = context.picker.getSelectedItem();
  if (selected?.kind !== "create") return null;
  const folders = await listFolders();
  const { parentId, missingSegments } = resolveCreatePath(
    selected.title,
    folders,
    context.defaultFolderId ?? FALLBACK_PARENT_ID,
  );
  return missingSegments.length === 0 ? parentId : null;
}

function wireActions(context: CommitContext): void {
  const removeButton = getElement<HTMLButtonElement>("btn-remove");
  const commitButton = getElement<HTMLButtonElement>("btn-commit");

  // Re-entrancy guard: the popup stays open until the async mutation
  // resolves, so a held Enter or a double click must not launch a
  // second, concurrent commit/remove.
  let actionInFlight = false;
  const runExclusive = (action: () => Promise<void>): void => {
    if (actionInFlight) return;
    actionInFlight = true;
    commitButton.disabled = true;
    removeButton.disabled = true;
    void action().catch((error: unknown) => {
      // Re-enable the form so the user can retry after a failure.
      actionInFlight = false;
      commitButton.disabled = false;
      removeButton.disabled = !context.model.removeEnabled;
      console.error(error);
    });
  };

  commitButton.addEventListener("click", () =>
    runExclusive(() => commit(context, false)),
  );
  removeButton.addEventListener("click", () => {
    const bookmarkId = context.model.bookmarkId;
    if (bookmarkId === null) return;
    runExclusive(() => removeBookmark(bookmarkId).then(() => window.close()));
  });

  // Enter anywhere in the form commits; Shift+Enter copies instead.
  // On the remove button, Enter falls through to the native click.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (event.target === removeButton) return;
    event.preventDefault();
    if (event.repeat) return;
    runExclusive(() => commit(context, event.shiftKey));
  });
}

async function chooseBookmark(
  bookmarks: browser.bookmarks.BookmarkTreeNode[],
  folders: FolderEntry[],
): Promise<browser.bookmarks.BookmarkTreeNode | undefined> {
  if (bookmarks.length <= 1) return bookmarks[0];
  const rows = buildSelectorRows(bookmarks, folders);
  const picked = await pickBookmark(getElement("bookmark-selector"), rows);
  getElement<HTMLInputElement>("folder-input").focus();
  return bookmarks.find((bookmark) => bookmark.id === picked.bookmarkId);
}

async function initPopup(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? null;
  const [folders, recentFolderIds, settings, matchingBookmarks] =
    await Promise.all([
      listFolders(),
      getRecentFolderIds(),
      getSettings(),
      url !== null ? browser.bookmarks.search({ url }) : [],
    ]);

  const bookmark = await chooseBookmark(matchingBookmarks, folders);
  const model = derivePopupModel(
    tab ?? { title: "", favIconUrl: undefined, url: undefined },
    bookmark ? [bookmark] : [],
  );

  getElement<HTMLImageElement>("favicon").src = model.favIconUrl ?? "";
  getElement<HTMLHeadingElement>("page-title").textContent = model.pageTitle;
  const titleInput = getElement<HTMLInputElement>("title-input");
  titleInput.value = model.pageTitle;
  getElement<HTMLButtonElement>("btn-remove").disabled = !model.removeEnabled;
  getElement<HTMLButtonElement>("btn-commit").textContent = model.commitLabel;

  getElement("meta-date").textContent = model.dateAdded
    ? new Date(model.dateAdded).toLocaleString()
    : "";

  const folderById = new Map<string, FolderEntry>(
    folders.map((folder) => [folder.id, folder]),
  );
  const metaFolder = getElement("meta-folder");
  metaFolder.textContent = model.folderId
    ? (folderById.get(model.folderId)?.path ?? "")
    : "";

  const picker = setupFolderPicker({
    input: getElement<HTMLInputElement>("folder-input"),
    list: getElement<HTMLUListElement>("folder-list"),
    folders,
    currentFolderId: model.folderId,
    recentFolderIds,
    onSelectionChange: (item) => {
      metaFolder.textContent = describeSelection(item);
    },
  });

  if (url === null) return;
  wireActions({
    url,
    model,
    folders,
    defaultFolderId: settings.defaultFolderId,
    picker,
    titleInput,
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Explicit focus: autofocus alone is unreliable in extension popups.
  getElement<HTMLInputElement>("folder-input").focus();
  void initPopup();
});
