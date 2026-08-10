// FuzzyBookmarks popup entry point.
// Renders the current-page/bookmark info and wires the folder picker;
// commit wiring (C6) arrives in a later commit.

import { listFolders, type FolderEntry } from "../lib/folders";
import { getRecentFolderIds } from "../lib/query-memory";
import { setupFolderPicker, type PickerItem } from "./folder-picker";
import { loadPopupModel } from "./model";

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

async function initPopup(): Promise<void> {
  const [model, folders, recentFolderIds] = await Promise.all([
    loadPopupModel(),
    listFolders(),
    getRecentFolderIds(),
  ]);

  getElement<HTMLImageElement>("favicon").src = model.favIconUrl ?? "";
  getElement<HTMLHeadingElement>("page-title").textContent = model.pageTitle;
  getElement<HTMLInputElement>("title-input").value = model.pageTitle;
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

  setupFolderPicker({
    input: getElement<HTMLInputElement>("folder-input"),
    list: getElement<HTMLUListElement>("folder-list"),
    folders,
    currentFolderId: model.folderId,
    recentFolderIds,
    onSelectionChange: (item) => {
      metaFolder.textContent = describeSelection(item);
    },
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Explicit focus: autofocus alone is unreliable in extension popups.
  getElement<HTMLInputElement>("folder-input").focus();
  void initPopup();
});
