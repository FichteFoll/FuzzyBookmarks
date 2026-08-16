import { describe, expect, it } from "vitest";

import { resolveCommitKind } from "../lib/bookmark-actions";
import type { CommitInput } from "../lib/bookmark-actions";
import { commitButtonCaption, derivePopupModel } from "./model";

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
      removeEnabled: true,
    });
  });
});

describe("commitButtonCaption", () => {
  const existingBookmark = { id: "bm1", parentId: "folder1" };

  const caption = (overrides: Partial<CommitInput>): string =>
    commitButtonCaption(
      resolveCommitKind({
        url: "https://example.com/",
        title: "Example",
        queryNarrowed: false,
        selectedFolderId: null,
        createFolder: null,
        existingBookmark: null,
        copyRequested: false,
        defaultFolderId: null,
        titleChanged: false,
        ...overrides,
      }),
    );

  it("reads Create when the page is not bookmarked yet", () => {
    expect(
      caption({
        existingBookmark: null,
        queryNarrowed: false,
        copyRequested: false,
      }),
    ).toBe("Create");
  });

  it("still reads Create for an unbookmarked page with Shift held", () => {
    expect(
      caption({
        existingBookmark: null,
        queryNarrowed: true,
        copyRequested: true,
      }),
    ).toBe("Create");
  });

  it("reads Save when the page is bookmarked and the list is not narrowed", () => {
    expect(
      caption({ existingBookmark, queryNarrowed: false, copyRequested: false }),
    ).toBe("Save");
  });

  it("still reads Save for a non-narrowed list with Shift held", () => {
    expect(
      caption({ existingBookmark, queryNarrowed: false, copyRequested: true }),
    ).toBe("Save");
  });

  it("reads Rename when only the name of a bookmarked page was edited", () => {
    expect(
      caption({
        existingBookmark,
        queryNarrowed: false,
        copyRequested: false,
        titleChanged: true,
      }),
    ).toBe("Rename");
  });

  it("reads Move when the page is bookmarked and another folder is selected", () => {
    expect(
      caption({
        existingBookmark,
        queryNarrowed: true,
        selectedFolderId: "folder2",
        copyRequested: false,
      }),
    ).toBe("Move");
  });

  it("reads Copy when another folder is committed with Shift held", () => {
    expect(
      caption({
        existingBookmark,
        queryNarrowed: true,
        selectedFolderId: "folder2",
        copyRequested: true,
      }),
    ).toBe("Copy");
  });

  it("reads Rename when the narrowed selection is the bookmark's own folder and the name was edited", () => {
    expect(
      caption({
        existingBookmark,
        queryNarrowed: true,
        selectedFolderId: "folder1",
        copyRequested: false,
        titleChanged: true,
      }),
    ).toBe("Rename");
  });
});
