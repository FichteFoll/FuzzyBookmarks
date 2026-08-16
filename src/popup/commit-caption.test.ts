// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { setupCommitCaption, type CommitCaptionHandle } from "./commit-caption";
import type { PickerState } from "./folder-picker";
import type { PopupModel } from "./model";

const EXISTING_BOOKMARK = { id: "bm1", parentId: "folder1" };
const PAGE_TITLE = "Original title";

function pickerState(narrowed: boolean): PickerState {
  return {
    query: narrowed ? "js" : "",
    items: [],
    selectedIndex: 0,
    userNavigated: false,
  };
}

function popupModel(pageTitle: string): PopupModel {
  return {
    pageTitle,
    favIconUrl: null,
    bookmarkId: EXISTING_BOOKMARK.id,
    folderId: EXISTING_BOOKMARK.parentId,
    dateAdded: null,
    removeEnabled: true,
  };
}

function mount(options: {
  existingBookmark?: { id: string; parentId: string } | null;
  narrowed?: boolean;
  pageTitle?: string;
  busy?: boolean;
}): {
  button: HTMLButtonElement;
  nameInput: HTMLInputElement;
  caption: CommitCaptionHandle;
  setNarrowed: (narrowed: boolean) => void;
  setBusy: (busy: boolean) => void;
  typeName: (value: string) => void;
} {
  const button = document.createElement("button");
  const nameInput = document.createElement("input");
  const pageTitle = options.pageTitle ?? PAGE_TITLE;
  nameInput.value = pageTitle;
  document.body.replaceChildren(nameInput, button);
  let narrowed = options.narrowed ?? false;
  let busy = options.busy ?? false;
  const caption = setupCommitCaption({
    button,
    nameInput,
    model: popupModel(pageTitle),
    isBusy: () => busy,
    getPickerState: () => pickerState(narrowed),
    existingBookmark:
      options.existingBookmark === undefined
        ? EXISTING_BOOKMARK
        : options.existingBookmark,
  });
  return {
    button,
    nameInput,
    caption,
    setNarrowed: (value) => {
      narrowed = value;
    },
    setBusy: (value) => {
      busy = value;
    },
    typeName: (value) => {
      nameInput.value = value;
      nameInput.dispatchEvent(new Event("input"));
    },
  };
}

function pressShift(): void {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }),
  );
}

function releaseShift(): void {
  document.dispatchEvent(
    new KeyboardEvent("keyup", { key: "Shift", shiftKey: false }),
  );
}

describe("setupCommitCaption", () => {
  it("captions an existing bookmark with a non-narrowed list as Save", () => {
    const { button } = mount({});

    expect(button.textContent).toBe("Save");
  });

  it("captions a page without a bookmark as Create", () => {
    const { button } = mount({ existingBookmark: null });

    expect(button.textContent).toBe("Create");
  });

  it("switches from Move to Copy while Shift is held", () => {
    const { button } = mount({ narrowed: true });
    expect(button.textContent).toBe("Move");

    pressShift();

    expect(button.textContent).toBe("Copy");
  });

  it("switches back to Move when Shift is released", () => {
    const { button } = mount({ narrowed: true });
    pressShift();

    releaseShift();

    expect(button.textContent).toBe("Move");
  });

  it("switches to Copy when Firefox reports the pre-event modifier state", () => {
    const { button } = mount({ narrowed: true });

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Shift", shiftKey: false }),
    );

    expect(button.textContent).toBe("Copy");
  });

  it("switches back to Move when Firefox reports the pre-event modifier state", () => {
    const { button } = mount({ narrowed: true });
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Shift", shiftKey: false }),
    );
    expect(button.textContent).toBe("Copy");

    document.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Shift", shiftKey: true }),
    );

    expect(button.textContent).toBe("Move");
  });

  // Observed in Firefox with a caps/shift layout option: the release of
  // ShiftLeft arrives as key: "CapsLock" on the same code, carrying the
  // pre-event modifier state.
  it("switches back to Move when the Shift release reports another key", () => {
    const { button } = mount({ narrowed: true });
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Shift",
        code: "ShiftLeft",
        shiftKey: false,
      }),
    );
    expect(button.textContent).toBe("Copy");

    document.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "CapsLock",
        code: "ShiftLeft",
        shiftKey: true,
      }),
    );

    expect(button.textContent).toBe("Move");
  });

  it("tracks the right-hand Shift key by its code as well", () => {
    const { button } = mount({ narrowed: true });

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Shift",
        code: "ShiftRight",
        shiftKey: false,
      }),
    );
    expect(button.textContent).toBe("Copy");

    document.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "CapsLock",
        code: "ShiftRight",
        shiftKey: true,
      }),
    );

    expect(button.textContent).toBe("Move");
  });

  it("takes the modifier state from a key event that is not Shift", () => {
    const { button } = mount({ narrowed: true });

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", shiftKey: true }),
    );

    expect(button.textContent).toBe("Copy");
  });

  it("does not stay stuck on Copy when the popup loses focus", () => {
    const { button } = mount({ narrowed: true });
    pressShift();
    expect(button.textContent).toBe("Copy");

    window.dispatchEvent(new Event("blur"));

    expect(button.textContent).toBe("Move");
  });

  it("keeps Create while Shift is held on an unbookmarked page", () => {
    const { button } = mount({ existingBookmark: null, narrowed: true });

    pressShift();

    expect(button.textContent).toBe("Create");
  });

  it("keeps Save while Shift is held with a non-narrowed list", () => {
    const { button } = mount({});

    pressShift();

    expect(button.textContent).toBe("Save");
  });

  it("switches from Save to Move when update() sees a narrowed state", () => {
    const { button, caption, setNarrowed } = mount({});
    expect(button.textContent).toBe("Save");

    setNarrowed(true);
    caption.update();

    expect(button.textContent).toBe("Move");
  });

  it("disables the commit button when a commit would change nothing", () => {
    const { button } = mount({});

    expect(button.textContent).toBe("Save");
    expect(button.disabled).toBe(true);
  });

  it("captions an edited name as Rename and enables the button", () => {
    const { button, typeName } = mount({});

    typeName("A new title");

    expect(button.textContent).toBe("Rename");
    expect(button.disabled).toBe(false);
  });

  it("returns to a disabled Save when the name is edited back", () => {
    const { button, typeName } = mount({});
    typeName("A new title");

    typeName(PAGE_TITLE);

    expect(button.textContent).toBe("Save");
    expect(button.disabled).toBe(true);
  });

  it("keeps Move when the folder list is narrowed and the name was edited", () => {
    const { button, typeName } = mount({ narrowed: true });

    typeName("A new title");

    expect(button.textContent).toBe("Move");
    expect(button.disabled).toBe(false);
  });

  it("keeps Copy while Shift is held with a narrowed list and an edited name", () => {
    const { button, typeName } = mount({ narrowed: true });
    typeName("A new title");

    pressShift();

    expect(button.textContent).toBe("Copy");
    expect(button.disabled).toBe(false);
  });

  it("keeps Create for an unbookmarked page with an edited name", () => {
    const { button, typeName } = mount({ existingBookmark: null });

    typeName("A new title");

    expect(button.textContent).toBe("Create");
    expect(button.disabled).toBe(false);
  });

  // Both directions of the busy term: neither writer of the button's disabled
  // state may clear the other's reason, so a Rename stays disabled while an
  // action is in flight and becomes enabled again once that action clears.
  it("keeps the button disabled while an action is in flight and enables it again after", () => {
    const { button, caption, typeName, setBusy } = mount({ busy: true });

    typeName("A new title");

    expect(button.textContent).toBe("Rename");
    expect(button.disabled).toBe(true);

    setBusy(false);
    caption.update();

    expect(button.textContent).toBe("Rename");
    expect(button.disabled).toBe(false);
  });
});
