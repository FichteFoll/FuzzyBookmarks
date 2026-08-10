const FALLBACK_PARENT_ID = "unfiled_____";

export interface CreateFolderSpec {
  parentId: string;
  segments: string[];
}

export interface CommitInput {
  url: string;
  title: string;
  queryNarrowed: boolean;
  selectedFolderId: string | null;
  createFolder: CreateFolderSpec | null;
  existingBookmark: { id: string; parentId: string } | null;
  copyRequested: boolean;
  defaultFolderId: string | null;
}

export type CommitPlan =
  | {
      kind: "create";
      url: string;
      title: string;
      parentId: string;
      createFolder?: CreateFolderSpec;
    }
  | {
      kind: "move";
      bookmarkId: string;
      title: string;
      parentId: string;
      createFolder?: CreateFolderSpec;
    }
  | {
      kind: "copy";
      url: string;
      title: string;
      parentId: string;
      createFolder?: CreateFolderSpec;
    }
  | { kind: "update"; bookmarkId: string; title: string };

export function resolveCommit(input: CommitInput): CommitPlan {
  const { url, title, existingBookmark } = input;

  if (existingBookmark && !input.queryNarrowed) {
    return { kind: "update", bookmarkId: existingBookmark.id, title };
  }

  const target = resolveTarget(input);
  if (!existingBookmark) {
    return { kind: "create", url, title, ...target };
  }
  if (input.copyRequested) {
    return { kind: "copy", url, title, ...target };
  }
  return { kind: "move", bookmarkId: existingBookmark.id, title, ...target };
}

function resolveTarget(input: CommitInput): {
  parentId: string;
  createFolder?: CreateFolderSpec;
} {
  if (input.queryNarrowed && input.createFolder) {
    return {
      parentId: input.createFolder.parentId,
      createFolder: input.createFolder,
    };
  }
  const selected = input.queryNarrowed ? input.selectedFolderId : null;
  return { parentId: selected ?? input.defaultFolderId ?? FALLBACK_PARENT_ID };
}

export async function applyCommit(plan: CommitPlan): Promise<void> {
  switch (plan.kind) {
    case "create":
    case "copy": {
      const parentId = await resolveParentId(plan);
      await browser.bookmarks.create({
        parentId,
        title: plan.title,
        url: plan.url,
      });
      return;
    }
    case "move": {
      const parentId = await resolveParentId(plan);
      await browser.bookmarks.update(plan.bookmarkId, { title: plan.title });
      await browser.bookmarks.move(plan.bookmarkId, { parentId });
      return;
    }
    case "update":
      await browser.bookmarks.update(plan.bookmarkId, { title: plan.title });
      return;
  }
}

async function resolveParentId(plan: {
  parentId: string;
  createFolder?: CreateFolderSpec;
}): Promise<string> {
  if (!plan.createFolder) return plan.parentId;
  let parentId = plan.createFolder.parentId;
  for (const segment of plan.createFolder.segments) {
    const folder = await browser.bookmarks.create({ parentId, title: segment });
    parentId = folder.id;
  }
  return parentId;
}

export async function removeBookmark(id: string): Promise<void> {
  await browser.bookmarks.remove(id);
}
