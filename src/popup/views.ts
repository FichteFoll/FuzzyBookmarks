// The popup's two top-level views and the single place that toggles them:
// exactly one is visible at any time, and the focus moves into the visible one.

export type PopupViewName = "select" | "edit";

export interface PopupViews {
  select: HTMLElement;
  edit: HTMLElement;
}

export function showView(
  views: PopupViews,
  name: PopupViewName,
  focusTarget: HTMLElement,
): void {
  views.select.hidden = name !== "select";
  views.edit.hidden = name !== "edit";
  focusTarget.focus();
}
