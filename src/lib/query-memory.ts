const MEMORY_KEY = "queryMemory";
const RECENCY_KEY = "folderRecency";
const MEMORY_CAP = 500;
const RECENCY_CAP = 50;

// Stored as an oldest-first pair list rather than a plain object,
// because object key order breaks for integer-like query strings.
type MemoryEntries = [query: string, folderId: string][];

async function readMemory(): Promise<MemoryEntries> {
  const stored = (await browser.storage.local.get(MEMORY_KEY)) as Record<
    string,
    MemoryEntries | undefined
  >;
  return stored[MEMORY_KEY] ?? [];
}

export async function rememberSelection(
  query: string,
  folderId: string,
): Promise<void> {
  const key = query.toLowerCase();
  const entries = (await readMemory()).filter(
    ([entryQuery]) => entryQuery !== key,
  );
  entries.push([key, folderId]);
  await browser.storage.local.set({ [MEMORY_KEY]: entries.slice(-MEMORY_CAP) });
}

export async function recallSelection(query: string): Promise<string | null> {
  const key = query.toLowerCase();
  const entry = (await readMemory()).find(([entryQuery]) => entryQuery === key);
  return entry?.[1] ?? null;
}

// Structural subset of fuzzy.ts's FolderMatch,
// declared locally to keep this module independent of the matching core.
export interface FolderMatchLike {
  entry: { id: string };
}

export function pickSelectedIndex(
  matches: readonly FolderMatchLike[],
  rememberedFolderId: string | null,
): number {
  if (rememberedFolderId === null) return 0;
  const index = matches.findIndex(
    (match) => match.entry.id === rememberedFolderId,
  );
  return index === -1 ? 0 : index;
}

export async function getRecentFolderIds(): Promise<string[]> {
  const stored = (await browser.storage.local.get(RECENCY_KEY)) as Record<
    string,
    string[] | undefined
  >;
  return stored[RECENCY_KEY] ?? [];
}

export async function recordFolderUse(folderId: string): Promise<void> {
  const current = await getRecentFolderIds();
  const updated = [folderId, ...current.filter((id) => id !== folderId)].slice(
    0,
    RECENCY_CAP,
  );
  await browser.storage.local.set({ [RECENCY_KEY]: updated });
}
