import { describe, expect, it } from "vitest";
import { isBookmarkShortcut } from "./keys";

type KeyEventLike = Parameters<typeof isBookmarkShortcut>[0];

function event(overrides: Partial<KeyEventLike> = {}): KeyEventLike {
  return {
    key: "d",
    ctrlKey: true,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    defaultPrevented: false,
    ...overrides,
  };
}

describe("isBookmarkShortcut", () => {
  it("matches Ctrl+D", () => {
    expect(isBookmarkShortcut(event())).toBe(true);
  });

  it("matches case-insensitively (uppercase D)", () => {
    expect(isBookmarkShortcut(event({ key: "D" }))).toBe(true);
  });

  it("rejects Ctrl+Alt+D", () => {
    expect(isBookmarkShortcut(event({ altKey: true }))).toBe(false);
  });

  it("rejects Ctrl+Meta+D", () => {
    expect(isBookmarkShortcut(event({ metaKey: true }))).toBe(false);
  });

  it("rejects Ctrl+Shift+D", () => {
    expect(isBookmarkShortcut(event({ shiftKey: true }))).toBe(false);
  });

  it("rejects an event the page already handled", () => {
    expect(isBookmarkShortcut(event({ defaultPrevented: true }))).toBe(false);
  });

  it("rejects other keys", () => {
    expect(isBookmarkShortcut(event({ key: "e" }))).toBe(false);
  });

  it("rejects D without Ctrl", () => {
    expect(isBookmarkShortcut(event({ ctrlKey: false }))).toBe(false);
  });
});
