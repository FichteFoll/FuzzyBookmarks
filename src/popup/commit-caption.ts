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
        // The caption does not observe the name input yet.
        titleChanged: false,
      }),
    );
  };

  // Firefox reports event.shiftKey on the Shift key's own keydown/keyup as the
  // state before the event, which inverted the caption; the event type is
  // unambiguous there. Other key events still carry the truth, which also
  // corrects the state when the popup's first key event already arrives with
  // Shift held.
  const trackShift = (event: KeyboardEvent): void => {
    shiftHeld =
      event.key === "Shift" ? event.type === "keydown" : event.shiftKey;
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
