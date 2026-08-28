// The popup's element writes, split into the stage the active tab alone can
// paint and the stage that needs the bookmark data, so the popup appears
// before any bookmark query resolves.

import { formatAbsoluteTime, formatRelativeTime } from "../lib/relative-time";
import type { PopupModel } from "./model";

export interface PopupElements {
  favicon: HTMLImageElement;
  nameInput: HTMLInputElement;
  metaDate: HTMLElement;
  currentLocation: HTMLElement;
  removeButton: HTMLButtonElement;
}

export function renderTabBasics(
  elements: PopupElements,
  tab: Pick<browser.tabs.Tab, "title" | "favIconUrl">,
): void {
  elements.favicon.src = tab.favIconUrl ?? "";
  elements.nameInput.value = tab.title ?? "";
  // No bookmark is known yet, so nothing can be removed.
  elements.removeButton.disabled = true;
}

// `now` is injected rather than read from the clock so the relative date is
// deterministic in tests.
export function applyBookmarkDetails(
  elements: PopupElements,
  model: PopupModel,
  options: { folderPath: string | null; nameEdited: boolean; now: number },
): void {
  // A name the user typed while the bookmark data was in flight wins.
  if (!options.nameEdited) {
    elements.nameInput.value = model.pageTitle;
  }
  elements.removeButton.disabled = !model.removeEnabled;
  elements.metaDate.textContent = model.dateAdded
    ? `created ${formatRelativeTime(model.dateAdded, options.now)}`
    : "";
  elements.metaDate.title = model.dateAdded
    ? formatAbsoluteTime(model.dateAdded)
    : "";
  if (options.folderPath === null) return;
  elements.currentLocation.textContent = `Current: ${options.folderPath}`;
  elements.currentLocation.removeAttribute("hidden");
}
