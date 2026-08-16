import { describe, expect, it } from "vitest";

import { resolveCommit } from "../lib/bookmark-actions";
import type { FolderEntry } from "../lib/folders";
import type { PickerItem, PickerState } from "./folder-picker";
import {
  buildCommitInput,
  buildSelectorRows,
  type CommitFormState,
} from "./selector";

function folder(id: string, path: string, parentId?: string): FolderEntry {
  const segments = path.split("/");
  return { id, title: segments[segments.length - 1] ?? path, path, parentId };
}

describe("buildSelectorRows", () => {
  const folders = [
    folder("dev", "Other/dev", "unfiled_____"),
    folder("news", "Menu/news", "menu________"),
  ];

  it("maps title, folder path, and date added per bookmark", () => {
    const rows = buildSelectorRows(
      [{ id: "b1", title: "Example", parentId: "dev", dateAdded: 1000 }],
      folders,
    );

    expect(rows).toEqual([
      {
        bookmarkId: "b1",
        title: "Example",
        folderPath: "Other/dev",
        dateAdded: 1000,
      },
    ]);
  });

  it("sorts rows by dateAdded descending", () => {
    const rows = buildSelectorRows(
      [
        { id: "old", title: "Old", parentId: "dev", dateAdded: 1000 },
        { id: "new", title: "New", parentId: "news", dateAdded: 3000 },
        { id: "mid", title: "Mid", parentId: "dev", dateAdded: 2000 },
      ],
      folders,
    );

    expect(rows.map((row) => row.bookmarkId)).toEqual(["new", "mid", "old"]);
  });

  it("tolerates unknown folders and missing dates, sorting dateless rows last", () => {
    const rows = buildSelectorRows(
      [
        { id: "b1", title: "Dateless", parentId: "gone" },
        { id: "b2", title: "Dated", parentId: "dev", dateAdded: 1000 },
      ],
      folders,
    );

    expect(rows).toEqual([
      {
        bookmarkId: "b2",
        title: "Dated",
        folderPath: "Other/dev",
        dateAdded: 1000,
      },
      { bookmarkId: "b1", title: "Dateless", folderPath: "", dateAdded: null },
    ]);
  });
});

describe("buildCommitInput", () => {
  const folders = [
    folder("dev", "Other/dev", "unfiled_____"),
    folder("js", "Other/dev/js", "dev"),
  ];

  function pickerState(
    query: string,
    items: PickerItem[],
    selectedIndex = 0,
    userNavigated = false,
  ): PickerState {
    return { query, items, selectedIndex, userNavigated };
  }

  function folderItem(entry: FolderEntry): PickerItem {
    return { kind: "folder", entry, highlightRanges: [] };
  }

  function form(overrides: Partial<CommitFormState>): CommitFormState {
    return {
      url: "https://example.com/",
      title: "Example",
      picker: pickerState("", []),
      folders,
      existingBookmark: null,
      copyRequested: false,
      defaultFolderId: null,
      titleChanged: false,
      ...overrides,
    };
  }

  it("assembles a narrowed new-bookmark commit targeting the selected folder", () => {
    const dev = folders[0]!;
    const input = buildCommitInput(
      form({ picker: pickerState("dev", [folderItem(dev)]) }),
    );

    expect(input).toEqual({
      url: "https://example.com/",
      title: "Example",
      queryNarrowed: true,
      selectedFolderId: "dev",
      createFolder: null,
      existingBookmark: null,
      copyRequested: false,
      defaultFolderId: null,
      titleChanged: false,
    });
    expect(resolveCommit(input)).toMatchObject({
      kind: "create",
      parentId: "dev",
    });
  });

  it("treats arrow navigation without a query as narrowing", () => {
    const js = folders[1]!;
    const input = buildCommitInput(
      form({
        picker: pickerState(
          "",
          [folderItem(folders[0]!), folderItem(js)],
          1,
          true,
        ),
      }),
    );

    expect(input.queryNarrowed).toBe(true);
    expect(input.selectedFolderId).toBe("js");
  });

  it("assembles an unnarrowed existing-bookmark commit that updates in place", () => {
    const input = buildCommitInput(
      form({
        picker: pickerState("", [folderItem(folders[0]!)]),
        existingBookmark: { id: "b1", parentId: "dev" },
      }),
    );

    expect(input.queryNarrowed).toBe(false);
    expect(input.existingBookmark).toEqual({ id: "b1", parentId: "dev" });
    expect(resolveCommit(input)).toEqual({
      kind: "update",
      bookmarkId: "b1",
      title: "Example",
    });
  });

  it("carries an edited name through as a rename", () => {
    const input = buildCommitInput(
      form({
        picker: pickerState("", [folderItem(folders[0]!)]),
        existingBookmark: { id: "b1", parentId: "dev" },
        title: "Edited",
        titleChanged: true,
      }),
    );

    expect(input.titleChanged).toBe(true);
    expect(resolveCommit(input)).toEqual({
      kind: "rename",
      bookmarkId: "b1",
      title: "Edited",
    });
  });

  it("assembles a shift+enter copy for an existing bookmark", () => {
    const js = folders[1]!;
    const input = buildCommitInput(
      form({
        picker: pickerState("js", [folderItem(js)]),
        existingBookmark: { id: "b1", parentId: "dev" },
        copyRequested: true,
      }),
    );

    expect(input.copyRequested).toBe(true);
    expect(resolveCommit(input)).toMatchObject({
      kind: "copy",
      parentId: "js",
    });
  });

  it("resolves a create-folder selection into parent and missing segments", () => {
    const input = buildCommitInput(
      form({
        picker: pickerState("Other/dev/new", [
          { kind: "create", title: "Other/dev/new" },
        ]),
      }),
    );

    expect(input.selectedFolderId).toBeNull();
    expect(input.createFolder).toEqual({ parentId: "dev", segments: ["new"] });
  });

  it("anchors a rootless create path at the default folder", () => {
    const input = buildCommitInput(
      form({
        picker: pickerState("brand-new", [
          { kind: "create", title: "brand-new" },
        ]),
        defaultFolderId: "dev",
      }),
    );

    expect(input.createFolder).toEqual({
      parentId: "dev",
      segments: ["brand-new"],
    });
  });

  it("anchors a rootless create path at Other Bookmarks without a default folder", () => {
    const input = buildCommitInput(
      form({
        picker: pickerState("brand-new", [
          { kind: "create", title: "brand-new" },
        ]),
      }),
    );

    expect(input.createFolder).toEqual({
      parentId: "unfiled_____",
      segments: ["brand-new"],
    });
  });

  it("passes no folder selection through as nulls", () => {
    const input = buildCommitInput(form({ picker: pickerState("", []) }));

    expect(input.selectedFolderId).toBeNull();
    expect(input.createFolder).toBeNull();
  });
});
