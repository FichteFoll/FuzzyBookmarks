// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { showView, type PopupViews } from "./views";

function setupViews(): { views: PopupViews; input: HTMLInputElement } {
  const select = document.createElement("div");
  // Mirrors #select-view in popup.html, which carries tabindex="-1"
  // so the view switch can focus the container itself.
  select.tabIndex = -1;
  const edit = document.createElement("div");
  const input = document.createElement("input");
  edit.append(input);
  document.body.append(select, edit);
  return { views: { select, edit }, input };
}

describe("showView", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("shows the select view and hides the edit view", () => {
    const { views } = setupViews();

    showView(views, "select", views.select);

    expect(views.select.hidden).toBe(false);
    expect(views.edit.hidden).toBe(true);
    expect(document.activeElement).toBe(views.select);
  });

  it("shows the edit view and hides the select view", () => {
    const { views, input } = setupViews();
    showView(views, "select", views.select);

    showView(views, "edit", input);

    expect(views.select.hidden).toBe(true);
    expect(views.edit.hidden).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  describe("before the popup window has the focus", () => {
    beforeEach(() => {
      vi.spyOn(document, "hasFocus").mockReturnValue(false);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    // Simulates Firefox handing the panel the focus without restoring
    // the element focused before.
    function receiveWindowFocus(): void {
      (document.activeElement as HTMLElement | null)?.blur();
      window.dispatchEvent(new Event("focus"));
    }

    it("refocuses the target once the window receives the focus", () => {
      const { views, input } = setupViews();

      showView(views, "edit", input);
      receiveWindowFocus();

      expect(document.activeElement).toBe(input);
    });

    it("refocuses the target of the latest view switch", () => {
      const { views, input } = setupViews();

      showView(views, "edit", input);
      showView(views, "select", views.select);
      receiveWindowFocus();

      expect(document.activeElement).toBe(views.select);
    });

    it("does not refocus on a later window focus", () => {
      const { views, input } = setupViews();
      showView(views, "edit", input);
      receiveWindowFocus();

      receiveWindowFocus();

      expect(document.activeElement).not.toBe(input);
    });
  });
});
