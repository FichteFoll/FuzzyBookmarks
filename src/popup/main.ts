// FuzzyBookmarks popup entry point.
// Renders the current-page/bookmark info; folder matching (C5) and
// commit wiring (C6) arrive in later commits.

import { loadPopupModel, resolveFolderPath } from "./model";

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element in popup.html`);
  }
  return element as T;
}

async function renderPopup(): Promise<void> {
  const model = await loadPopupModel();

  getElement<HTMLImageElement>("favicon").src = model.favIconUrl ?? "";
  getElement<HTMLHeadingElement>("page-title").textContent = model.pageTitle;
  getElement<HTMLInputElement>("title-input").value = model.pageTitle;
  getElement<HTMLButtonElement>("btn-remove").disabled = !model.removeEnabled;
  getElement<HTMLButtonElement>("btn-commit").textContent = model.commitLabel;

  getElement("meta-date").textContent = model.dateAdded
    ? new Date(model.dateAdded).toLocaleString()
    : "";

  getElement("meta-folder").textContent = model.folderId
    ? await resolveFolderPath(model.folderId)
    : "";
}

document.addEventListener("DOMContentLoaded", () => {
  // Explicit focus: autofocus alone is unreliable in extension popups.
  getElement<HTMLInputElement>("folder-input").focus();
  void renderPopup();
});
