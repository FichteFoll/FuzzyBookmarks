import { describe, expect, it } from "vitest";

import type { FolderEntry } from "./folders";
import { matchFolders } from "./fuzzy";

function entry(id: string, path: string): FolderEntry {
  const title = path.split("/").pop() ?? path;
  return { id, title, path };
}

describe("matchFolders", () => {
  it("ranks word-boundary matches above scattered matches", () => {
    const folders = [entry("a", "daja-vu-sites"), entry("b", "dev/js")];

    const matches = matchFolders("djs", folders);

    const paths = matches.map((m) => m.entry.path);
    expect(paths).toContain("dev/js");
    expect(paths).toContain("daja-vu-sites");
    expect(paths.indexOf("dev/js")).toBeLessThan(
      paths.indexOf("daja-vu-sites"),
    );
  });

  it("ranks consecutive runs above spread-out matches", () => {
    const folders = [entry("a", "misc/a1b2c3"), entry("b", "misc/abc")];

    const matches = matchFolders("abc", folders);

    const paths = matches.map((m) => m.entry.path);
    expect(paths.indexOf("misc/abc")).toBeLessThan(
      paths.indexOf("misc/a1b2c3"),
    );
  });

  it("merges consecutive matched indexes into one highlight range", () => {
    const matches = matchFolders("js", [entry("a", "dev/js")]);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.highlightRanges).toEqual([[4, 6]]);
  });

  it("covers exactly the matched characters with separate ranges", () => {
    const matches = matchFolders("dj", [entry("a", "dev/js")]);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.highlightRanges).toEqual([
      [0, 1],
      [4, 5],
    ]);
  });

  it("returns everything in tree order with empty ranges for an empty query", () => {
    const folders = [
      entry("a", "Menu"),
      entry("b", "Toolbar"),
      entry("c", "Other/dev"),
    ];

    for (const query of ["", "   "]) {
      const matches = matchFolders(query, folders);

      expect(matches.map((m) => m.entry)).toEqual(folders);
      expect(matches.every((m) => m.highlightRanges.length === 0)).toBe(true);
    }
  });

  it("drops folders that do not match at all", () => {
    const folders = [entry("a", "dev/js"), entry("b", "recipes")];

    const matches = matchFolders("xyz", folders);

    expect(matches).toEqual([]);
  });
});
