// The popup's two top-level views and the single place that toggles them:
// exactly one is visible at any time, and the focus moves into the visible one.

export type PopupViewName = "select" | "edit";

export interface PopupViews {
  select: HTMLElement;
  edit: HTMLElement;
}

// The element the latest view switch meant to focus, for the deferred refocus.
let intendedFocus: HTMLElement | null = null;

export function showView(
  views: PopupViews,
  name: PopupViewName,
  focusTarget: HTMLElement,
): void {
  views.select.hidden = name !== "select";
  views.edit.hidden = name !== "edit";
  focusTarget.focus();
  refocusOnWindowFocus(focusTarget);
}

// A popup opened by a keyboard shortcut can run this before Firefox has given
// its panel the focus, and the panel then takes the focus without restoring
// the element focused before. Re-apply the focus once the window receives it.
function refocusOnWindowFocus(focusTarget: HTMLElement): void {
  if (intendedFocus !== null) {
    intendedFocus = focusTarget;
    return;
  }
  if (document.hasFocus()) return;
  intendedFocus = focusTarget;
  window.addEventListener(
    "focus",
    () => {
      intendedFocus?.focus();
      intendedFocus = null;
    },
    { once: true },
  );
}
