// Commit button caption: keeps #btn-commit's label naming the action a
// commit would actually perform, following the picker's narrowed state
// and the Shift key while the popup is open.

import { resolveCommitKind } from "../lib/bookmark-actions";
import { isNarrowed, type PickerState } from "./folder-picker";
import { commitButtonCaption } from "./model";

export interface CommitCaptionOptions {
  button: HTMLButtonElement;
  getPickerState: () => PickerState;
  existingBookmark: { id: string; parentId: string } | null;
}

export interface CommitCaptionHandle {
  update(): void;
}

export function setupCommitCaption(
  options: CommitCaptionOptions,
): CommitCaptionHandle {
  let shiftHeld = false;

  // Only the caption is written here; the re-entrancy guard in wireActions
  // owns the button's disabled state.
  const update = (): void => {
    options.button.textContent = commitButtonCaption(
      resolveCommitKind({
        existingBookmark: options.existingBookmark,
        queryNarrowed: isNarrowed(options.getPickerState()),
        copyRequested: shiftHeld,
      }),
    );
  };

  // Read event.shiftKey instead of testing event.key === "Shift": that also
  // corrects the state when the popup's first key event already carries a
  // held Shift.
  const trackShift = (event: KeyboardEvent): void => {
    shiftHeld = event.shiftKey;
    update();
  };
  document.addEventListener("keydown", trackShift);
  document.addEventListener("keyup", trackShift);

  // No keyup arrives when Shift is released while the popup is not focused,
  // which would leave the caption stuck on "Copy".
  window.addEventListener("blur", () => {
    shiftHeld = false;
    update();
  });

  update();

  return { update };
}
