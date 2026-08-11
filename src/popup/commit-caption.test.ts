// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { setupCommitCaption, type CommitCaptionHandle } from "./commit-caption";
import type { PickerState } from "./folder-picker";

const EXISTING_BOOKMARK = { id: "bm1", parentId: "folder1" };

function pickerState(narrowed: boolean): PickerState {
  return {
    query: narrowed ? "js" : "",
    items: [],
    selectedIndex: 0,
    userNavigated: false,
  };
}

function mount(options: {
  existingBookmark?: { id: string; parentId: string } | null;
  narrowed?: boolean;
}): {
  button: HTMLButtonElement;
  caption: CommitCaptionHandle;
  setNarrowed: (narrowed: boolean) => void;
} {
  const button = document.createElement("button");
  document.body.replaceChildren(button);
  let narrowed = options.narrowed ?? false;
  const caption = setupCommitCaption({
    button,
    getPickerState: () => pickerState(narrowed),
    existingBookmark:
      options.existingBookmark === undefined
        ? EXISTING_BOOKMARK
        : options.existingBookmark,
  });
  return {
    button,
    caption,
    setNarrowed: (value) => {
      narrowed = value;
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
});
