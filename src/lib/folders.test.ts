import { afterEach, describe, expect, it, vi } from "vitest";

import type { FolderEntry } from "./folders";
import {
  describeCreatePath,
  listFolders,
  PATH_SEPARATOR,
  resolveCreatePath,
} from "./folders";

type Node = browser.bookmarks.BookmarkTreeNode;

function folder(id: string, title: string, children: Node[] = []): Node {
  return { id, title, children };
}

function bookmark(id: string, title: string, url: string): Node {
  return { id, title, url };
}

function makeTree(): Node {
  return folder("root________", "", [
    folder("menu________", "Bookmarks Menu", [folder("f-recipes", "recipes")]),
    folder("toolbar_____", "Bookmarks Toolbar", [
      bookmark("b-example", "Example", "https://example.com/"),
      folder("f-work", "work", [folder("f-reports", "reports")]),
    ]),
    folder("unfiled_____", "Other Bookmarks", [
      folder("f-dev", "dev", [folder("f-js", "js")]),
      { id: "s-1", title: "", type: "separator" },
    ]),
    folder("mobile______", "Mobile Bookmarks"),
  ]);
}

function stubBookmarksTree(root: Node): void {
  vi.stubGlobal("browser", {
    bookmarks: { getTree: () => Promise.resolve([root]) },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listFolders", () => {
  it("flattens the tree depth-first into full paths", async () => {
    stubBookmarksTree(makeTree());

    const folders = await listFolders();

    expect(folders.map((f) => f.path)).toEqual([
      "Menu",
      ["Menu", "recipes"].join(PATH_SEPARATOR),
      "Toolbar",
      ["Toolbar", "work"].join(PATH_SEPARATOR),
      ["Toolbar", "work", "reports"].join(PATH_SEPARATOR),
      "Other",
      ["Other", "dev"].join(PATH_SEPARATOR),
      ["Other", "dev", "js"].join(PATH_SEPARATOR),
      "Mobile",
    ]);
  });

  it("skips bookmarks and separators", async () => {
    stubBookmarksTree(makeTree());

    const folders = await listFolders();

    const ids = folders.map((f) => f.id);
    expect(ids).not.toContain("b-example");
    expect(ids).not.toContain("s-1");
    expect(ids).not.toContain("root________");
  });

  it("aliases root titles by node id, not by title", async () => {
    stubBookmarksTree(makeTree());

    const folders = await listFolders();

    const other = folders.find((f) => f.id === "unfiled_____");
    expect(other?.path).toBe("Other");
    expect(folders.some((f) => f.path.includes("Other Bookmarks"))).toBe(false);
    expect(folders.find((f) => f.id === "f-js")?.path).toBe("Other/dev/js");
  });

  it("records id and parentId per entry", async () => {
    stubBookmarksTree(makeTree());

    const folders = await listFolders();

    const js = folders.find((f) => f.id === "f-js");
    expect(js).toMatchObject({ title: "js", parentId: "f-dev" });
    const other = folders.find((f) => f.id === "unfiled_____");
    expect(other?.parentId).toBe("root________");
  });
});

describe("resolveCreatePath", () => {
  const folders: FolderEntry[] = [
    {
      id: "menu________",
      title: "Menu",
      path: "Menu",
      parentId: "root________",
    },
    {
      id: "f-recipes",
      title: "recipes",
      path: "Menu/recipes",
      parentId: "menu________",
    },
    {
      id: "unfiled_____",
      title: "Other",
      path: "Other",
      parentId: "root________",
    },
    { id: "f-dev", title: "dev", path: "Other/dev", parentId: "unfiled_____" },
    { id: "f-js", title: "js", path: "Other/dev/js", parentId: "f-dev" },
  ];

  it("returns no missing segments for a fully existing path", () => {
    expect(resolveCreatePath("Other/dev/js", folders, "fb")).toEqual({
      parentId: "f-js",
      missingSegments: [],
    });
  });

  it("returns the unmatched tail below the deepest existing folder", () => {
    expect(resolveCreatePath("Other/dev/js/new/deep", folders, "fb")).toEqual({
      parentId: "f-js",
      missingSegments: ["new", "deep"],
    });
  });

  it("anchors at the root when the first segment is a root alias", () => {
    expect(resolveCreatePath("Menu/recipes/cakes", folders, "fb")).toEqual({
      parentId: "f-recipes",
      missingSegments: ["cakes"],
    });
    // The alias anchors by id even when nothing exists below the root yet.
    expect(resolveCreatePath("Toolbar/quick", folders, "fb")).toEqual({
      parentId: "toolbar_____",
      missingSegments: ["quick"],
    });
  });

  it("anchors a non-alias first segment at fallbackParentId", () => {
    expect(resolveCreatePath("projects/rust", folders, "f-dev")).toEqual({
      parentId: "f-dev",
      missingSegments: ["projects", "rust"],
    });
    expect(resolveCreatePath("dev/new", folders, "unfiled_____")).toEqual({
      parentId: "f-dev",
      missingSegments: ["new"],
    });
  });

  it("matches existing prefix segments case-insensitively", () => {
    expect(resolveCreatePath("other/DEV/Js", folders, "fb")).toEqual({
      parentId: "f-js",
      missingSegments: [],
    });
  });

  it("ignores empty segments and surrounding whitespace", () => {
    expect(resolveCreatePath(" Other //dev/ ", folders, "fb")).toEqual({
      parentId: "f-dev",
      missingSegments: [],
    });
  });

  it("resolves an empty path to the fallback parent", () => {
    expect(resolveCreatePath("", folders, "fb")).toEqual({
      parentId: "fb",
      missingSegments: [],
    });
  });
});

describe("describeCreatePath", () => {
  it("anchors a non-alias path at the anchor path", () => {
    expect(describeCreatePath("ttsx", "Other")).toBe("Other/ttsx");
  });

  it("anchors a nested non-alias path at the anchor path", () => {
    expect(describeCreatePath("dev/js", "Other/Inbox")).toBe(
      "Other/Inbox/dev/js",
    );
  });

  it("canonicalizes a root alias's casing", () => {
    expect(describeCreatePath("other/x", "Toolbar")).toBe("Other/x");
  });

  it("keeps a correctly-cased root alias", () => {
    expect(describeCreatePath("Menu/dev", "Other")).toBe("Menu/dev");
  });

  it("trims segments", () => {
    expect(describeCreatePath(" dev / js ", "Other")).toBe("Other/dev/js");
  });
});
