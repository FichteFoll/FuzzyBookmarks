export interface FolderEntry {
  id: string;
  title: string;
  path: string;
  parentId?: string;
}

export const PATH_SEPARATOR = "/";

// The visible bookmark roots get short path aliases, mapped by node id
// (not by title, so renamed or localized roots still alias correctly).
const ROOT_ALIASES: Record<string, string> = {
  menu________: "Menu",
  toolbar_____: "Toolbar",
  unfiled_____: "Other",
  mobile______: "Mobile",
};

const ALIAS_TO_ROOT_ID = new Map(
  Object.entries(ROOT_ALIASES).map(([id, alias]) => [alias.toLowerCase(), id]),
);

export async function listFolders(): Promise<FolderEntry[]> {
  const [root] = await browser.bookmarks.getTree();
  if (!root) return [];

  const folders: FolderEntry[] = [];
  const visit = (
    node: browser.bookmarks.BookmarkTreeNode,
    parentPath: string,
  ) => {
    for (const child of node.children ?? []) {
      if (child.url !== undefined || child.type === "separator") continue;
      const title = ROOT_ALIASES[child.id] ?? child.title;
      const path =
        parentPath === "" ? title : parentPath + PATH_SEPARATOR + title;
      folders.push({ id: child.id, title, path, parentId: node.id });
      visit(child, path);
    }
  };
  visit(root, "");
  return folders;
}

export function resolveCreatePath(
  path: string,
  folders: FolderEntry[],
  fallbackParentId: string,
): { parentId: string; missingSegments: string[] } {
  let segments = path
    .split(PATH_SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "");

  let parentId = fallbackParentId;
  const rootId = segments[0] && ALIAS_TO_ROOT_ID.get(segments[0].toLowerCase());
  if (rootId) {
    parentId = rootId;
    segments = segments.slice(1);
  }

  let resolved = 0;
  for (const segment of segments) {
    const child = findChildFolder(folders, parentId, segment);
    if (!child) break;
    parentId = child.id;
    resolved++;
  }
  return { parentId, missingSegments: segments.slice(resolved) };
}

function findChildFolder(
  folders: FolderEntry[],
  parentId: string,
  title: string,
): FolderEntry | undefined {
  const lowerTitle = title.toLowerCase();
  return folders.find(
    (f) => f.parentId === parentId && f.title.toLowerCase() === lowerTitle,
  );
}
