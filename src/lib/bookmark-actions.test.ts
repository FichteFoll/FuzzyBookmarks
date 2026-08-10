import { describe, expect, it } from "vitest";

import { applyCommit, removeBookmark, resolveCommit } from "./bookmark-actions";
import type { CommitInput } from "./bookmark-actions";

function makeInput(overrides: Partial<CommitInput> = {}): CommitInput {
  return {
    url: "https://example.com/",
    title: "Example",
    queryNarrowed: false,
    selectedFolderId: null,
    createFolder: null,
    existingBookmark: null,
    copyRequested: false,
    defaultFolderId: null,
    ...overrides,
  };
}

interface CreatedNode {
  id: string;
  parentId?: string;
  title?: string;
  url?: string;
}

function installFakeBookmarks() {
  let nextId = 1;
  const created: CreatedNode[] = [];
  const moves: { id: string; parentId?: string }[] = [];
  const updates: { id: string; changes: { title?: string; url?: string } }[] =
    [];
  const removed: string[] = [];
  const bookmarks = {
    create(details: Omit<CreatedNode, "id">): Promise<CreatedNode> {
      const node = { id: `node-${nextId++}`, ...details };
      created.push(node);
      return Promise.resolve(node);
    },
    move(
      id: string,
      destination: { parentId?: string },
    ): Promise<{ id: string }> {
      moves.push({ id, ...destination });
      return Promise.resolve({ id });
    },
    update(
      id: string,
      changes: { title?: string; url?: string },
    ): Promise<{ id: string }> {
      updates.push({ id, changes });
      return Promise.resolve({ id });
    },
    remove(id: string): Promise<void> {
      removed.push(id);
      return Promise.resolve();
    },
  };
  (globalThis as { browser?: unknown }).browser = { bookmarks };
  return { created, moves, updates, removed };
}

describe("resolveCommit", () => {
  it("creates in the default folder when nothing is narrowed", () => {
    expect(resolveCommit(makeInput({ defaultFolderId: "default" }))).toEqual({
      kind: "create",
      url: "https://example.com/",
      title: "Example",
      parentId: "default",
    });
  });

  it("falls back to unfiled_____ without a default folder", () => {
    expect(resolveCommit(makeInput())).toMatchObject({
      kind: "create",
      parentId: "unfiled_____",
    });
  });

  it("ignores the selection when not narrowed", () => {
    const input = makeInput({
      selectedFolderId: "selected",
      defaultFolderId: "default",
    });
    expect(resolveCommit(input)).toMatchObject({
      kind: "create",
      parentId: "default",
    });
  });

  it("creates in the selected folder when narrowed", () => {
    const input = makeInput({
      queryNarrowed: true,
      selectedFolderId: "selected",
    });
    expect(resolveCommit(input)).toMatchObject({
      kind: "create",
      parentId: "selected",
    });
  });

  it("falls back to the default folder when narrowed without a selection", () => {
    const input = makeInput({
      queryNarrowed: true,
      defaultFolderId: "default",
    });
    expect(resolveCommit(input)).toMatchObject({
      kind: "create",
      parentId: "default",
    });
  });

  it("treats copy on a non-existing bookmark like create", () => {
    expect(resolveCommit(makeInput({ copyRequested: true }))).toMatchObject({
      kind: "create",
      parentId: "unfiled_____",
    });
    const narrowed = makeInput({
      copyRequested: true,
      queryNarrowed: true,
      selectedFolderId: "selected",
    });
    expect(resolveCommit(narrowed)).toMatchObject({
      kind: "create",
      parentId: "selected",
    });
  });

  it("updates in place for an existing bookmark without narrowing", () => {
    const input = makeInput({
      existingBookmark: { id: "bm", parentId: "home" },
    });
    expect(resolveCommit(input)).toEqual({
      kind: "update",
      bookmarkId: "bm",
      title: "Example",
    });
  });

  it("updates in place when copy is requested without narrowing", () => {
    const input = makeInput({
      existingBookmark: { id: "bm", parentId: "home" },
      copyRequested: true,
    });
    expect(resolveCommit(input)).toMatchObject({
      kind: "update",
      bookmarkId: "bm",
    });
  });

  it("moves an existing bookmark to the narrowed target", () => {
    const input = makeInput({
      existingBookmark: { id: "bm", parentId: "home" },
      queryNarrowed: true,
      selectedFolderId: "selected",
    });
    expect(resolveCommit(input)).toEqual({
      kind: "move",
      bookmarkId: "bm",
      parentId: "selected",
      title: "Example",
    });
  });

  it("copies instead of moving when requested on an existing bookmark", () => {
    const input = makeInput({
      existingBookmark: { id: "bm", parentId: "home" },
      queryNarrowed: true,
      selectedFolderId: "selected",
      copyRequested: true,
    });
    expect(resolveCommit(input)).toEqual({
      kind: "copy",
      url: "https://example.com/",
      title: "Example",
      parentId: "selected",
    });
  });

  it("passes createFolder through and anchors at its parent", () => {
    const createFolder = { parentId: "anchor", segments: ["a", "b"] };
    const input = makeInput({ queryNarrowed: true, createFolder });
    expect(resolveCommit(input)).toEqual({
      kind: "create",
      url: "https://example.com/",
      title: "Example",
      parentId: "anchor",
      createFolder,
    });
  });

  it("moves into a to-be-created folder", () => {
    const createFolder = { parentId: "anchor", segments: ["a"] };
    const input = makeInput({
      existingBookmark: { id: "bm", parentId: "home" },
      queryNarrowed: true,
      createFolder,
    });
    expect(resolveCommit(input)).toMatchObject({
      kind: "move",
      bookmarkId: "bm",
      parentId: "anchor",
      createFolder,
    });
  });
});

describe("applyCommit", () => {
  it("creates a bookmark in the plan's parent folder", async () => {
    const fake = installFakeBookmarks();
    await applyCommit({
      kind: "create",
      url: "https://example.com/",
      title: "Example",
      parentId: "target",
    });
    expect(fake.created).toEqual([
      {
        id: "node-1",
        parentId: "target",
        title: "Example",
        url: "https://example.com/",
      },
    ]);
  });

  it("creates missing folder segments nested in order and files the bookmark in the deepest", async () => {
    const fake = installFakeBookmarks();
    await applyCommit({
      kind: "create",
      url: "https://example.com/",
      title: "Example",
      parentId: "anchor",
      createFolder: { parentId: "anchor", segments: ["a", "b", "c"] },
    });
    const [folderA, folderB, folderC, bookmark] = fake.created;
    expect(folderA).toMatchObject({ parentId: "anchor", title: "a" });
    expect(folderA?.url).toBeUndefined();
    expect(folderB).toMatchObject({ parentId: folderA?.id, title: "b" });
    expect(folderC).toMatchObject({ parentId: folderB?.id, title: "c" });
    expect(bookmark).toMatchObject({
      parentId: folderC?.id,
      title: "Example",
      url: "https://example.com/",
    });
  });

  it("moves and retitles an existing bookmark", async () => {
    const fake = installFakeBookmarks();
    await applyCommit({
      kind: "move",
      bookmarkId: "bm",
      parentId: "target",
      title: "New title",
    });
    expect(fake.updates).toEqual([
      { id: "bm", changes: { title: "New title" } },
    ]);
    expect(fake.moves).toEqual([{ id: "bm", parentId: "target" }]);
    expect(fake.created).toEqual([]);
  });

  it("moves into the deepest created folder", async () => {
    const fake = installFakeBookmarks();
    await applyCommit({
      kind: "move",
      bookmarkId: "bm",
      parentId: "anchor",
      title: "Example",
      createFolder: { parentId: "anchor", segments: ["a", "b"] },
    });
    const [folderA, folderB] = fake.created;
    expect(folderB).toMatchObject({ parentId: folderA?.id, title: "b" });
    expect(fake.moves).toEqual([{ id: "bm", parentId: folderB?.id }]);
  });

  it("copies by creating a new bookmark and leaves the original untouched", async () => {
    const fake = installFakeBookmarks();
    await applyCommit({
      kind: "copy",
      url: "https://example.com/",
      title: "Example",
      parentId: "target",
    });
    expect(fake.created).toEqual([
      {
        id: "node-1",
        parentId: "target",
        title: "Example",
        url: "https://example.com/",
      },
    ]);
    expect(fake.moves).toEqual([]);
    expect(fake.updates).toEqual([]);
    expect(fake.removed).toEqual([]);
  });

  it("updates only the title", async () => {
    const fake = installFakeBookmarks();
    await applyCommit({ kind: "update", bookmarkId: "bm", title: "New title" });
    expect(fake.updates).toEqual([
      { id: "bm", changes: { title: "New title" } },
    ]);
    expect(fake.created).toEqual([]);
    expect(fake.moves).toEqual([]);
  });
});

describe("removeBookmark", () => {
  it("removes the bookmark by id", async () => {
    const fake = installFakeBookmarks();
    await removeBookmark("bm");
    expect(fake.removed).toEqual(["bm"]);
  });
});
