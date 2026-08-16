// FuzzyBookmarks popup entry point.
// Renders the current-page/bookmark info, wires the folder picker,
// the multi-bookmark selector, and the commit/remove actions.

import {
  applyCommit,
  removeBookmark,
  resolveCommit,
  type CommitInput,
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
import { formatAbsoluteTime, formatRelativeTime } from "../lib/relative-time";
import { getSettings } from "../lib/settings";
import { setupCommitCaption, type CommitCaptionHandle } from "./commit-caption";
import { setupFolderPicker, type FolderPickerHandle } from "./folder-picker";
import { derivePopupModel, isTitleChanged, type PopupModel } from "./model";
import {
  buildCommitInput,
  buildSelectorRows,
  pickBookmark,
  FALLBACK_PARENT_ID,
} from "./selector";
import { showView, type PopupViews } from "./views";

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element in popup.html`);
  }
  return element as T;
}

function existingBookmarkOf(
  model: PopupModel,
): { id: string; parentId: string } | null {
  if (model.bookmarkId === null || model.folderId === null) return null;
  return { id: model.bookmarkId, parentId: model.folderId };
}

interface CommitContext {
  model: PopupModel;
  defaultFolderId: string | null;
  picker: FolderPickerHandle;
  buildInput: (copyRequested: boolean) => CommitInput;
  caption: CommitCaptionHandle;
  commitGate: { busy: boolean };
}

async function commit(
  context: CommitContext,
  copyRequested: boolean,
): Promise<void> {
  const input = context.buildInput(copyRequested);
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
  // Neither an update nor a rename targets a folder, so neither records one.
  if (plan.kind === "update" || plan.kind === "rename") return null;
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
  // The commit button's disabled state is written by the caption, which folds
  // this guard in through commitGate; writing it here would clear the caption's
  // own reason ("this commit would change nothing").
  let actionInFlight = false;
  const runExclusive = (action: () => Promise<void>): void => {
    if (actionInFlight) return;
    actionInFlight = true;
    context.commitGate.busy = true;
    context.caption.update();
    removeButton.disabled = true;
    void action().catch((error: unknown) => {
      // Re-enable the form so the user can retry after a failure.
      actionInFlight = false;
      context.commitGate.busy = false;
      context.caption.update();
      removeButton.disabled = !context.model.removeEnabled;
      console.error(error);
    });
  };

  // Enter and a click agree on the modifier: Shift copies in both cases.
  commitButton.addEventListener("click", (event) =>
    runExclusive(() => commit(context, event.shiftKey)),
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
  views: PopupViews,
  bookmarks: browser.bookmarks.BookmarkTreeNode[],
  folders: FolderEntry[],
): Promise<browser.bookmarks.BookmarkTreeNode | undefined> {
  if (bookmarks.length <= 1) return bookmarks[0];
  const rows = buildSelectorRows(bookmarks, folders);
  showView(views, "select", views.select);
  const picked = await pickBookmark(views.select, rows);
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

  const views: PopupViews = {
    select: getElement("select-view"),
    edit: getElement("edit-view"),
  };
  const bookmark = await chooseBookmark(views, matchingBookmarks, folders);
  // Explicit focus: autofocus alone is unreliable in extension popups.
  showView(views, "edit", getElement<HTMLInputElement>("folder-input"));
  const model = derivePopupModel(
    tab ?? { title: "", favIconUrl: undefined, url: undefined },
    bookmark ? [bookmark] : [],
  );

  getElement<HTMLImageElement>("favicon").src = model.favIconUrl ?? "";
  const nameInput = getElement<HTMLInputElement>("name-input");
  nameInput.value = model.pageTitle;
  getElement<HTMLButtonElement>("btn-remove").disabled = !model.removeEnabled;

  const metaDate = getElement("meta-date");
  metaDate.textContent = model.dateAdded
    ? `created ${formatRelativeTime(model.dateAdded, Date.now())}`
    : "";
  metaDate.title = model.dateAdded ? formatAbsoluteTime(model.dateAdded) : "";

  const folderById = new Map<string, FolderEntry>(
    folders.map((folder) => [folder.id, folder]),
  );
  const currentLocation = getElement("current-location");
  if (model.folderId) {
    currentLocation.textContent = `Current: ${folderById.get(model.folderId)?.path ?? ""}`;
    currentLocation.removeAttribute("hidden");
  }

  // The picker and the caption observe each other, so the notification is
  // routed through an indirection the caption handle replaces below.
  let notifyCaption = (): void => {};
  const picker = setupFolderPicker({
    input: getElement<HTMLInputElement>("folder-input"),
    list: getElement<HTMLUListElement>("folder-list"),
    folders,
    currentFolderId: model.folderId,
    recentFolderIds,
    createAnchorPath:
      folderById.get(settings.defaultFolderId ?? FALLBACK_PARENT_ID)?.path ??
      "Other",
    onStateChange: () => notifyCaption(),
  });
  // wireActions runs after this, so it can report a busy commit back to the
  // caption through this gate without a further indirection.
  const commitGate = { busy: false };
  // One construction site for the commit input: the caption must describe the
  // commit that Enter or a click would actually perform.
  // The url ?? "" is what lets the caption exist for a URL-less tab, where
  // initPopup returns before wireActions; the kind never reads url.
  const buildInput = (copyRequested: boolean): CommitInput =>
    buildCommitInput({
      url: url ?? "",
      title: nameInput.value,
      picker: picker.getState(),
      folders,
      existingBookmark: existingBookmarkOf(model),
      copyRequested,
      defaultFolderId: settings.defaultFolderId,
      titleChanged: isTitleChanged(model, nameInput.value),
    });
  // setupCommitCaption assigns the caption right away, so the popup shows the
  // correct action even before the first recomputation and for a URL-less tab.
  const caption = setupCommitCaption({
    button: getElement<HTMLButtonElement>("btn-commit"),
    nameInput,
    isBusy: () => commitGate.busy,
    buildInput,
  });
  notifyCaption = () => caption.update();

  if (url === null) return;
  wireActions({
    model,
    defaultFolderId: settings.defaultFolderId,
    picker,
    buildInput,
    caption,
    commitGate,
  });
}

document.addEventListener("DOMContentLoaded", () => {
  void initPopup();
});
