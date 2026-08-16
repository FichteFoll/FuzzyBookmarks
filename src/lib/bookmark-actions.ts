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
  titleChanged: boolean;
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
  | { kind: "update"; bookmarkId: string; title: string }
  | { kind: "rename"; bookmarkId: string; title: string };

export type CommitKind = CommitPlan["kind"];

// The single place deciding which action a commit performs,
// so UI captions can name the action without re-deriving the conditions.
export function resolveCommitKind(input: CommitInput): CommitKind {
  if (!input.existingBookmark) return "create";
  // resolveTarget already falls back to the default folder when the list is
  // not narrowed, so the narrowing test must precede the folder comparison.
  if (
    !input.queryNarrowed ||
    !targetsAnotherFolder(input, input.existingBookmark.parentId)
  ) {
    return input.titleChanged ? "rename" : "update";
  }
  return input.copyRequested ? "copy" : "move";
}

export function resolveCommit(input: CommitInput): CommitPlan {
  const { url, title, existingBookmark } = input;
  const kind = resolveCommitKind(input);

  if (!existingBookmark) {
    return { kind: "create", url, title, ...resolveTarget(input) };
  }
  if (kind === "update" || kind === "rename") {
    return { kind, bookmarkId: existingBookmark.id, title };
  }

  const target = resolveTarget(input);
  if (kind === "copy") {
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

// The folder comparison lives beside resolveTarget so the kind and the plan
// can never disagree about where a commit would file the bookmark.
function targetsAnotherFolder(
  input: CommitInput,
  currentParentId: string,
): boolean {
  const target = resolveTarget(input);
  // Segments still to be created always mean a new, different folder.
  if (target.createFolder && target.createFolder.segments.length > 0) {
    return true;
  }
  return target.parentId !== currentParentId;
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
    // A rename is an update that the UI names differently.
    case "rename":
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
