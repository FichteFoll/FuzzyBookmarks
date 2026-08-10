import { beforeEach, describe, expect, it } from "vitest";

import {
  getRecentFolderIds,
  pickSelectedIndex,
  recallSelection,
  recordFolderUse,
  rememberSelection,
} from "./query-memory";

function installFakeStorage(): void {
  const data: Record<string, unknown> = {};
  const local = {
    get(key: string): Promise<Record<string, unknown>> {
      return Promise.resolve(
        key in data ? { [key]: structuredClone(data[key]) } : {},
      );
    },
    set(items: Record<string, unknown>): Promise<void> {
      Object.assign(data, structuredClone(items));
      return Promise.resolve();
    },
  };
  (globalThis as { browser?: unknown }).browser = { storage: { local } };
}

beforeEach(() => {
  installFakeStorage();
});

describe("rememberSelection / recallSelection", () => {
  it("recalls a remembered folder for the exact query", async () => {
    await rememberSelection("dev/js", "folder-js");
    expect(await recallSelection("dev/js")).toBe("folder-js");
  });

  it("matches case-insensitively via lowercasing", async () => {
    await rememberSelection("Dev/JS", "folder-js");
    expect(await recallSelection("dev/js")).toBe("folder-js");
    expect(await recallSelection("DEV/JS")).toBe("folder-js");
  });

  it("returns null for unknown queries", async () => {
    expect(await recallSelection("nope")).toBeNull();
  });

  it("does not recall by prefix or superstring", async () => {
    await rememberSelection("dev", "folder-dev");
    expect(await recallSelection("de")).toBeNull();
    expect(await recallSelection("devx")).toBeNull();
  });

  it("evicts the oldest entry beyond 500", async () => {
    for (let i = 0; i < 500; i++) {
      await rememberSelection(`q${i}`, `f${i}`);
    }
    await rememberSelection("overflow", "f-overflow");
    expect(await recallSelection("q0")).toBeNull();
    expect(await recallSelection("q1")).toBe("f1");
    expect(await recallSelection("overflow")).toBe("f-overflow");
  });

  it("refreshes an updated entry instead of duplicating it", async () => {
    for (let i = 0; i < 500; i++) {
      await rememberSelection(`q${i}`, `f${i}`);
    }
    await rememberSelection("q0", "f0-new");
    await rememberSelection("overflow", "f-overflow");
    expect(await recallSelection("q1")).toBeNull();
    expect(await recallSelection("q0")).toBe("f0-new");
  });
});

describe("pickSelectedIndex", () => {
  const matches = [
    { entry: { id: "a" } },
    { entry: { id: "b" } },
    { entry: { id: "c" } },
  ];

  it("returns the remembered folder's index when present", () => {
    expect(pickSelectedIndex(matches, "b")).toBe(1);
  });

  it("returns 0 without a remembered folder", () => {
    expect(pickSelectedIndex(matches, null)).toBe(0);
  });

  it("returns 0 when the remembered folder is not in the matches", () => {
    expect(pickSelectedIndex(matches, "missing")).toBe(0);
  });

  it("returns 0 for empty matches", () => {
    expect(pickSelectedIndex([], "a")).toBe(0);
  });
});

describe("recordFolderUse / getRecentFolderIds", () => {
  it("returns an empty list initially", async () => {
    expect(await getRecentFolderIds()).toEqual([]);
  });

  it("returns most recently used folders first", async () => {
    await recordFolderUse("a");
    await recordFolderUse("b");
    await recordFolderUse("c");
    expect(await getRecentFolderIds()).toEqual(["c", "b", "a"]);
  });

  it("dedupes re-used folders, moving them to the front", async () => {
    await recordFolderUse("a");
    await recordFolderUse("b");
    await recordFolderUse("a");
    expect(await getRecentFolderIds()).toEqual(["a", "b"]);
  });

  it("caps the list at 50 ids", async () => {
    for (let i = 0; i < 51; i++) {
      await recordFolderUse(`f${i}`);
    }
    const recent = await getRecentFolderIds();
    expect(recent).toHaveLength(50);
    expect(recent[0]).toBe("f50");
    expect(recent).not.toContain("f0");
  });
});
