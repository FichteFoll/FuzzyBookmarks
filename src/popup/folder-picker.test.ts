// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";

import type { FolderEntry } from "../lib/folders";
import {
  computeList,
  isNarrowed,
  moveSelection,
  RENDER_CAP,
  setupFolderPicker,
  type PickerItem,
  type PickerState,
} from "./folder-picker";

function folder(id: string, path: string): FolderEntry {
  const segments = path.split("/");
  return { id, title: segments[segments.length - 1] ?? path, path };
}

function compute(
  query: string,
  folders: FolderEntry[],
  options: {
    remembered?: string | null;
    recent?: string[];
    current?: string | null;
    createAllowed?: boolean;
  } = {},
): PickerState {
  return computeList(
    query,
    folders,
    options.remembered ?? null,
    options.recent ?? [],
    options.current ?? null,
    options.createAllowed ?? true,
  );
}

function itemIds(items: PickerItem[]): (string | null)[] {
  return items.map((item) => (item.kind === "folder" ? item.entry.id : null));
}

describe("computeList", () => {
  describe("create-folder entry", () => {
    const folders = [folder("a", "dev/js"), folder("b", "recipes")];

    it("appends a create entry when nothing matches the query exactly", () => {
      const state = compute("newstuff", folders);

      const last = state.items[state.items.length - 1];
      expect(last).toEqual({ kind: "create", title: "newstuff" });
    });

    it("appends the create entry after fuzzy (non-exact) matches", () => {
      const state = compute("de", folders);

      expect(state.items[0]).toMatchObject({
        kind: "folder",
        entry: { id: "a" },
      });
      expect(state.items[state.items.length - 1]).toEqual({
        kind: "create",
        title: "de",
      });
    });

    it("omits the create entry when a path matches exactly", () => {
      const state = compute("dev/js", folders);

      expect(state.items.every((item) => item.kind === "folder")).toBe(true);
    });

    it("omits the create entry when a title matches exactly", () => {
      const state = compute("js", folders);

      expect(state.items.every((item) => item.kind === "folder")).toBe(true);
    });

    it("compares the exact match case-insensitively", () => {
      const state = compute("DEV/JS", folders);

      expect(state.items.every((item) => item.kind === "folder")).toBe(true);
    });

    it("trims the query before matching and labeling", () => {
      const state = compute("  newstuff  ", folders);

      const last = state.items[state.items.length - 1];
      expect(last).toEqual({ kind: "create", title: "newstuff" });
    });

    it("never offers a create entry for an empty query", () => {
      const state = compute("", folders);

      expect(state.items.every((item) => item.kind === "folder")).toBe(true);
    });

    it("omits the create entry when createFolderAllowed is false", () => {
      const state = compute("newstuff", folders, { createAllowed: false });

      expect(state.items.every((item) => item.kind === "folder")).toBe(true);
    });
  });

  describe("remembered folder", () => {
    it("preselects the remembered folder even when it is not first", () => {
      const folders = [
        folder("a", "dev/js"),
        folder("b", "dev/json"),
        folder("c", "dev/js-old"),
      ];

      const state = compute("js", folders, { remembered: "c" });

      const rememberedIndex = itemIds(state.items).indexOf("c");
      expect(rememberedIndex).toBeGreaterThan(0);
      expect(state.selectedIndex).toBe(rememberedIndex);
    });

    it("falls back to the first entry when nothing is remembered", () => {
      const folders = [folder("a", "dev/js"), folder("b", "dev/json")];

      const state = compute("js", folders);

      expect(state.selectedIndex).toBe(0);
    });

    it("pulls a remembered folder ranked below the cap into the list, replacing the last entry", () => {
      const folders = Array.from({ length: 60 }, (_, i) =>
        folder(`f${i}`, `proj-${String(i).padStart(2, "0")}`),
      );

      const state = compute("", folders, { remembered: "f55" });

      expect(state.items).toHaveLength(RENDER_CAP);
      const ids = itemIds(state.items);
      expect(ids[RENDER_CAP - 1]).toBe("f55");
      expect(ids.slice(0, RENDER_CAP - 1)).toEqual(
        folders.slice(0, RENDER_CAP - 1).map((f) => f.id),
      );
      expect(state.selectedIndex).toBe(RENDER_CAP - 1);
    });

    it("pulls a remembered fuzzy match ranked below the cap into the list", () => {
      const folders = Array.from({ length: 60 }, (_, i) =>
        folder(`f${i}`, `proj-${String(i).padStart(2, "0")}`),
      );

      const state = compute("proj", folders, { remembered: "f59" });

      const folderItems = state.items.filter((item) => item.kind === "folder");
      expect(folderItems).toHaveLength(RENDER_CAP);
      const ids = itemIds(state.items);
      expect(ids).toContain("f59");
      expect(state.selectedIndex).toBe(ids.indexOf("f59"));
    });
  });

  describe("empty-query ordering", () => {
    const folders = [
      folder("t1", "Menu"),
      folder("t2", "Toolbar"),
      folder("t3", "Other"),
      folder("t4", "Other/dev"),
      folder("t5", "Other/recipes"),
    ];

    it("orders current folder first, then recent folders, then tree order", () => {
      const state = compute("", folders, {
        current: "t4",
        recent: ["t5", "t2"],
      });

      expect(itemIds(state.items)).toEqual(["t4", "t5", "t2", "t1", "t3"]);
    });

    it("does not duplicate the current folder when it is also recent", () => {
      const state = compute("", folders, {
        current: "t4",
        recent: ["t4", "t2"],
      });

      expect(itemIds(state.items)).toEqual(["t4", "t2", "t1", "t3", "t5"]);
    });

    it("ignores recent ids that no longer exist", () => {
      const state = compute("", folders, { recent: ["gone", "t3"] });

      expect(itemIds(state.items)).toEqual(["t3", "t1", "t2", "t4", "t5"]);
    });

    it("keeps plain tree order without current or recent folders", () => {
      const state = compute("", folders);

      expect(itemIds(state.items)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
      expect(state.selectedIndex).toBe(0);
    });
  });

  describe("render cap", () => {
    const folders = Array.from({ length: 60 }, (_, i) =>
      folder(`f${i}`, `proj-${String(i).padStart(2, "0")}`),
    );

    it("caps the rendered list at 50 entries for an empty query", () => {
      const state = compute("", folders);

      expect(state.items).toHaveLength(RENDER_CAP);
    });

    it("does not count the create entry against the cap", () => {
      const state = compute("proj", folders);

      expect(state.items).toHaveLength(RENDER_CAP + 1);
      expect(state.items[RENDER_CAP]).toEqual({
        kind: "create",
        title: "proj",
      });
    });
  });

  it("starts without user navigation", () => {
    const state = compute("js", [folder("a", "dev/js")]);

    expect(state.userNavigated).toBe(false);
  });
});

describe("moveSelection", () => {
  const items: PickerItem[] = [
    { kind: "folder", entry: folder("a", "dev"), highlightRanges: [] },
    { kind: "folder", entry: folder("b", "misc"), highlightRanges: [] },
    { kind: "create", title: "new" },
  ];
  const base: PickerState = {
    query: "x",
    items,
    selectedIndex: 0,
    userNavigated: false,
  };

  it("moves down and marks the state as user-navigated", () => {
    const state = moveSelection(base, 1);

    expect(state.selectedIndex).toBe(1);
    expect(state.userNavigated).toBe(true);
  });

  it("wraps from the last entry to the first", () => {
    const state = moveSelection({ ...base, selectedIndex: 2 }, 1);

    expect(state.selectedIndex).toBe(0);
  });

  it("wraps from the first entry to the last", () => {
    const state = moveSelection(base, -1);

    expect(state.selectedIndex).toBe(2);
  });

  it("leaves an empty list untouched", () => {
    const empty: PickerState = { ...base, items: [] };

    const state = moveSelection(empty, 1);

    expect(state.selectedIndex).toBe(0);
    expect(state.userNavigated).toBe(false);
  });
});

describe("isNarrowed", () => {
  const state = (query: string, userNavigated: boolean): PickerState => ({
    query,
    items: [],
    selectedIndex: 0,
    userNavigated,
  });

  it.each([
    ["", false, false],
    ["   ", false, false],
    ["js", false, true],
    ["", true, true],
    ["js", true, true],
  ])("query %j, navigated %s -> %s", (query, userNavigated, expected) => {
    expect(isNarrowed(state(query, userNavigated))).toBe(expected);
  });
});

describe("setupFolderPicker", () => {
  const folders = [folder("a", "dev/js"), folder("b", "recipes")];

  // recompute awaits recallSelection, which reads storage.local.
  function installFakeStorage(): void {
    const local = {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
    };
    (globalThis as { browser?: unknown }).browser = { storage: { local } };
  }

  // A macrotask turn drains every microtask recompute awaits.
  function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  function mount(withCallback = true): {
    input: HTMLInputElement;
    list: HTMLUListElement;
    states: PickerState[];
  } {
    const input = document.createElement("input");
    const list = document.createElement("ul");
    document.body.replaceChildren(input, list);
    const states: PickerState[] = [];
    setupFolderPicker({
      input,
      list,
      folders,
      currentFolderId: null,
      recentFolderIds: [],
      createAnchorPath: "Other",
      onStateChange: withCallback ? (state) => states.push(state) : undefined,
    });
    return { input, list, states };
  }

  function lastNarrowed(states: PickerState[]): boolean {
    const last = states[states.length - 1];
    if (last === undefined) throw new Error("no state change was notified");
    return isNarrowed(last);
  }

  async function type(input: HTMLInputElement, query: string): Promise<void> {
    input.value = query;
    input.dispatchEvent(new Event("input"));
    await flush();
  }

  beforeEach(() => {
    installFakeStorage();
  });

  it("notifies with a non-narrowed state after the initial recomputation", async () => {
    const { states } = mount();

    await flush();

    expect(states).not.toHaveLength(0);
    expect(lastNarrowed(states)).toBe(false);
  });

  it("notifies with a narrowed state after a query is typed", async () => {
    const { input, states } = mount();
    await flush();

    await type(input, "js");

    expect(lastNarrowed(states)).toBe(true);
  });

  it("notifies with a non-narrowed state after the query is cleared", async () => {
    const { input, states } = mount();
    await flush();
    await type(input, "js");

    await type(input, "");

    expect(lastNarrowed(states)).toBe(false);
  });

  it("notifies with a narrowed state after ArrowDown on an empty query", async () => {
    const { input, states } = mount();
    await flush();

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));

    expect(lastNarrowed(states)).toBe(true);
  });

  it("notifies with a narrowed state after a list item is clicked", async () => {
    const { list, states } = mount();
    await flush();

    const li = list.children[1];
    expect(li).toBeDefined();
    li?.dispatchEvent(new MouseEvent("click"));

    expect(lastNarrowed(states)).toBe(true);
  });

  it("works without an onStateChange callback", async () => {
    const { input, list } = mount(false);
    await flush();

    await type(input, "js");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));

    expect(list.children.length).toBeGreaterThan(0);
  });
});
