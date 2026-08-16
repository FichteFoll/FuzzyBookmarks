// Commit button caption: keeps #btn-commit's label naming the action a
// commit would actually perform, following the picker's narrowed state,
// the name input and the Shift key while the popup is open,
// and disables the button while that action would change nothing.

import { resolveCommitKind } from "../lib/bookmark-actions";
import { isNarrowed, type PickerState } from "./folder-picker";
import { commitButtonCaption, isTitleChanged, type PopupModel } from "./model";

export interface CommitCaptionOptions {
  button: HTMLButtonElement;
  nameInput: HTMLInputElement;
  model: PopupModel;
  isBusy: () => boolean;
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

  // The button's disabled state has two independent writers: this caption owns
  // "this commit would change nothing", the re-entrancy guard in wireActions
  // owns "an action is in flight" and reports it back through isBusy().
  // Neither may clear the other's reason, so both are read on every update.
  const update = (): void => {
    // The folder fields are still placeholders here: this hand-assembled input
    // knows nothing about the picked folder, so the folder comparison in
    // resolveCommitKind cannot see it yet. The next commit replaces this with
    // the very input a commit would use.
    const kind = resolveCommitKind({
      url: "",
      title: options.nameInput.value,
      existingBookmark: options.existingBookmark,
      queryNarrowed: isNarrowed(options.getPickerState()),
      selectedFolderId: null,
      createFolder: null,
      defaultFolderId: null,
      copyRequested: shiftHeld,
      titleChanged: isTitleChanged(options.model, options.nameInput.value),
    });
    options.button.textContent = commitButtonCaption(kind);
    // After the rename kind exists, "update" is exactly the no-op commit:
    // an existing bookmark, no folder narrowing and no name edit.
    options.button.disabled = options.isBusy() || kind === "update";
  };

  // Firefox reports event.shiftKey (and getModifierState) on the Shift key's
  // own keydown/keyup as the state before the event, which inverted the
  // caption; the event type is unambiguous there. Other key events still carry
  // the truth, which also corrects the state when the popup's first key event
  // already arrives with Shift held.
  //
  // The Shift key is recognized by event.code rather than event.key: with a
  // caps/shift layout option, the release of ShiftLeft arrives as
  // key: "CapsLock", which left the caption stuck on "Copy". event.code names
  // the physical key either way; event.key is still honored so a key remapped
  // to Shift on another code is tracked too.
  const isShiftKey = (event: KeyboardEvent): boolean =>
    event.code === "ShiftLeft" ||
    event.code === "ShiftRight" ||
    event.key === "Shift";

  const trackShift = (event: KeyboardEvent): void => {
    shiftHeld = isShiftKey(event) ? event.type === "keydown" : event.shiftKey;
    update();
  };
  document.addEventListener("keydown", trackShift);
  document.addEventListener("keyup", trackShift);

  // The caption and the disabled state follow the name as the user types.
  options.nameInput.addEventListener("input", () => update());

  // No keyup arrives when Shift is released while the popup is not focused,
  // which would leave the caption stuck on "Copy".
  window.addEventListener("blur", () => {
    shiftHeld = false;
    update();
  });

  update();

  return { update };
}
