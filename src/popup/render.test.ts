// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { formatAbsoluteTime, formatRelativeTime } from "../lib/relative-time";
import type { PopupModel } from "./model";
import {
  applyBookmarkDetails,
  renderTabBasics,
  type PopupElements,
} from "./render";

const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);
const DATE_ADDED = NOW - 3 * 24 * 60 * 60 * 1000;

function setupElements(): PopupElements {
  const elements: PopupElements = {
    favicon: document.createElement("img"),
    nameInput: document.createElement("input"),
    metaDate: document.createElement("span"),
    currentLocation: document.createElement("p"),
    removeButton: document.createElement("button"),
  };
  elements.currentLocation.setAttribute("hidden", "");
  document.body.replaceChildren(
    elements.favicon,
    elements.nameInput,
    elements.metaDate,
    elements.currentLocation,
    elements.removeButton,
  );
  return elements;
}

function bookmarkedModel(): PopupModel {
  return {
    pageTitle: "Filed title",
    favIconUrl: "https://example.com/icon.png",
    bookmarkId: "b1",
    folderId: "f1",
    dateAdded: DATE_ADDED,
    removeEnabled: true,
  };
}

describe("renderTabBasics", () => {
  it("sets the favicon and the name from the tab alone", () => {
    const elements = setupElements();

    renderTabBasics(elements, {
      title: "Tab title",
      favIconUrl: "https://example.com/icon.png",
    });

    expect(elements.favicon.src).toBe("https://example.com/icon.png");
    expect(elements.nameInput.value).toBe("Tab title");
    expect(elements.removeButton.disabled).toBe(true);
  });
});

describe("applyBookmarkDetails", () => {
  it("fills name, date and location and enables removal for a bookmark", () => {
    const elements = setupElements();

    applyBookmarkDetails(elements, bookmarkedModel(), {
      folderPath: "dev/js",
      nameEdited: false,
      now: NOW,
    });

    expect(elements.nameInput.value).toBe("Filed title");
    expect(elements.removeButton.disabled).toBe(false);
    expect(elements.metaDate.textContent).toBe(
      `created ${formatRelativeTime(DATE_ADDED, NOW)}`,
    );
    expect(elements.metaDate.title).toBe(formatAbsoluteTime(DATE_ADDED));
    expect(elements.currentLocation.textContent).toBe("Current: dev/js");
    expect(elements.currentLocation.hasAttribute("hidden")).toBe(false);
  });

  it("leaves a name the user already edited untouched", () => {
    const elements = setupElements();
    elements.nameInput.value = "My own name";

    applyBookmarkDetails(elements, bookmarkedModel(), {
      folderPath: "dev/js",
      nameEdited: true,
      now: NOW,
    });

    expect(elements.nameInput.value).toBe("My own name");
  });

  it("leaves the current location hidden without a folder path", () => {
    const elements = setupElements();

    applyBookmarkDetails(
      elements,
      {
        pageTitle: "Unfiled page",
        favIconUrl: null,
        bookmarkId: null,
        folderId: null,
        dateAdded: null,
        removeEnabled: false,
      },
      { folderPath: null, nameEdited: false, now: NOW },
    );

    expect(elements.currentLocation.hasAttribute("hidden")).toBe(true);
    expect(elements.currentLocation.textContent).toBe("");
    expect(elements.metaDate.textContent).toBe("");
    expect(elements.removeButton.disabled).toBe(true);
  });
});
