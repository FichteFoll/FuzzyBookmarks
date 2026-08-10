import { describe, expect, it } from "vitest";

import { derivePopupModel } from "./model";

describe("derivePopupModel", () => {
  it("derives from the tab alone when the page is not bookmarked", () => {
    const tab = {
      title: "Example Page",
      favIconUrl: "https://example.com/favicon.ico",
      url: "https://example.com/",
    };

    const model = derivePopupModel(tab, []);

    expect(model).toEqual({
      pageTitle: "Example Page",
      favIconUrl: "https://example.com/favicon.ico",
      bookmarkId: null,
      folderId: null,
      dateAdded: null,
      commitLabel: "Create",
      removeEnabled: false,
    });
  });

  it("prefers the bookmark's title, folder id, and dateAdded when one exists", () => {
    const tab = {
      title: "Example Page",
      favIconUrl: "https://example.com/favicon.ico",
      url: "https://example.com/",
    };
    const bookmark = {
      id: "bm1",
      title: "Saved Example",
      parentId: "folder1",
      dateAdded: 1_700_000_000_000,
    };

    const model = derivePopupModel(tab, [bookmark]);

    expect(model).toEqual({
      pageTitle: "Saved Example",
      favIconUrl: "https://example.com/favicon.ico",
      bookmarkId: "bm1",
      folderId: "folder1",
      dateAdded: 1_700_000_000_000,
      commitLabel: "Save",
      removeEnabled: true,
    });
  });
});
