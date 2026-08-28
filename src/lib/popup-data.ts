import type { FolderEntry } from "./folders";
import { listFolders } from "./folders";

// The single definition of the popup/background message protocol.
// Neither the background page's responder nor the popup's client
// may restate these type strings or payload shapes.
export type PopupDataRequest =
  { type: "get-folders" } | { type: "get-bookmarks"; url: string };

// No timeout guards these sends: sendMessage rejects on its own when no
// listener answers, and every failure mode ends in the live query below.
export async function fetchFolders(): Promise<FolderEntry[]> {
  const response = await send({ type: "get-folders" });
  if (isFolderEntryArray(response)) return response;
  return listFolders();
}

export async function fetchBookmarksForUrl(
  url: string,
): Promise<browser.bookmarks.BookmarkTreeNode[]> {
  const response = await send({ type: "get-bookmarks", url });
  if (isBookmarkNodeArray(response)) return response;

  try {
    return await browser.bookmarks.search({ url });
  } catch {
    // Privileged and about: URLs make the search reject; the popup treats
    // such a page as having no bookmarks, exactly as it did before.
    return [];
  }
}

// The responder side's only way to recognise a request, so the wire strings
// stay confined to this file even though runtime.onMessage hands the
// listener an untyped message.
export function parsePopupDataRequest(value: unknown): PopupDataRequest | null {
  if (!isRecord(value)) return null;

  switch (value.type) {
    case "get-folders":
      return { type: "get-folders" };
    case "get-bookmarks":
      return typeof value.url === "string"
        ? { type: "get-bookmarks", url: value.url }
        : null;
    default:
      return null;
  }
}

async function send(request: PopupDataRequest): Promise<unknown> {
  try {
    return await browser.runtime.sendMessage(request);
  } catch {
    return undefined;
  }
}

function isFolderEntryArray(value: unknown): value is FolderEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry: unknown) =>
        isRecord(entry) &&
        typeof entry.id === "string" &&
        typeof entry.title === "string" &&
        typeof entry.path === "string",
    )
  );
}

function isBookmarkNodeArray(
  value: unknown,
): value is browser.bookmarks.BookmarkTreeNode[] {
  return (
    Array.isArray(value) &&
    value.every(
      (node: unknown) => isRecord(node) && typeof node.id === "string",
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
