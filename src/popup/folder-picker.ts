// Folder picker: fuzzy folder input with an always-visible result list.
// Pure reducers (computeList, moveSelection, isNarrowed) hold the behavior;
// setupFolderPicker is a thin DOM layer over them.

import type { FolderEntry } from "../lib/folders";
import { matchFolders, type FolderMatch } from "../lib/fuzzy";
import { pickSelectedIndex, recallSelection } from "../lib/query-memory";

// fuzzysort may score every folder; the DOM never renders more than this.
export const RENDER_CAP = 50;

export type PickerItem =
  | {
      kind: "folder";
      entry: FolderEntry;
      highlightRanges: Array<[number, number]>;
    }
  | { kind: "create"; title: string };

export interface PickerState {
  query: string;
  items: PickerItem[];
  selectedIndex: number;
  userNavigated: boolean;
}

export function computeList(
  query: string,
  folders: FolderEntry[],
  rememberedFolderId: string | null,
  recentFolderIds: string[],
  currentFolderId: string | null,
  createFolderAllowed: boolean,
): PickerState {
  const trimmed = query.trim();
  const matches = matchFolders(query, folders);
  const ordered =
    trimmed === ""
      ? orderForEmptyQuery(matches, recentFolderIds, currentFolderId)
      : matches;

  const rendered = ordered.slice(0, RENDER_CAP);
  pullRememberedIntoView(rendered, ordered, rememberedFolderId);

  const items: PickerItem[] = rendered.map((match) => ({
    kind: "folder",
    entry: match.entry,
    highlightRanges: match.highlightRanges,
  }));
  if (
    createFolderAllowed &&
    trimmed !== "" &&
    !hasExactMatch(matches, trimmed)
  ) {
    items.push({ kind: "create", title: trimmed });
  }

  return {
    query,
    items,
    selectedIndex: pickSelectedIndex(rendered, rememberedFolderId),
    userNavigated: false,
  };
}

export function moveSelection(state: PickerState, delta: 1 | -1): PickerState {
  const count = state.items.length;
  if (count === 0) return state;
  return {
    ...state,
    selectedIndex: (state.selectedIndex + delta + count) % count,
    userNavigated: true,
  };
}

// Req 12: Enter "without narrowing down the list" files into the default
// folder; any typed query or explicit arrow navigation counts as narrowing.
export function isNarrowed(state: PickerState): boolean {
  return state.query.trim() !== "" || state.userNavigated;
}

// Req 24: with an empty query, show the edited bookmark's current folder
// first, then recently used folders, then the rest in tree order.
function orderForEmptyQuery(
  matches: FolderMatch[],
  recentFolderIds: string[],
  currentFolderId: string | null,
): FolderMatch[] {
  const byId = new Map(matches.map((match) => [match.entry.id, match]));
  const front: FolderMatch[] = [];
  const frontIds = new Set<string>();
  for (const id of [currentFolderId, ...recentFolderIds]) {
    if (id === null || frontIds.has(id)) continue;
    const match = byId.get(id);
    if (!match) continue;
    front.push(match);
    frontIds.add(id);
  }
  return [
    ...front,
    ...matches.filter((match) => !frontIds.has(match.entry.id)),
  ];
}

// Req 10 within the rendered list: a remembered folder ranked below the
// render cap replaces the last visible entry.
function pullRememberedIntoView(
  rendered: FolderMatch[],
  ordered: FolderMatch[],
  rememberedFolderId: string | null,
): void {
  if (rememberedFolderId === null) return;
  if (rendered.some((match) => match.entry.id === rememberedFolderId)) return;
  const remembered = ordered.find(
    (match) => match.entry.id === rememberedFolderId,
  );
  if (!remembered) return;
  rendered[rendered.length - 1] = remembered;
}

function hasExactMatch(matches: FolderMatch[], trimmedQuery: string): boolean {
  const query = trimmedQuery.toLowerCase();
  return matches.some(
    (match) =>
      match.entry.path.toLowerCase() === query ||
      match.entry.title.toLowerCase() === query,
  );
}

export interface FolderPickerOptions {
  input: HTMLInputElement;
  list: HTMLUListElement;
  folders: FolderEntry[];
  currentFolderId: string | null;
  recentFolderIds: string[];
  onSelectionChange?: (item: PickerItem | null) => void;
}

export interface FolderPickerHandle {
  getState(): PickerState;
  getSelectedItem(): PickerItem | null;
}

export function setupFolderPicker(
  options: FolderPickerOptions,
): FolderPickerHandle {
  const { input, list } = options;
  let state: PickerState = {
    query: "",
    items: [],
    selectedIndex: 0,
    userNavigated: false,
  };
  let generation = 0;

  const selectedItem = (): PickerItem | null =>
    state.items[state.selectedIndex] ?? null;

  const notifySelection = (): void => {
    options.onSelectionChange?.(selectedItem());
  };

  const applySelection = (): void => {
    for (let i = 0; i < list.children.length; i++) {
      const li = list.children[i] as HTMLElement;
      if (i === state.selectedIndex) {
        li.setAttribute("aria-selected", "true");
        input.setAttribute("aria-activedescendant", li.id);
        li.scrollIntoView({ block: "nearest" });
      } else {
        li.removeAttribute("aria-selected");
      }
    }
    if (state.items.length === 0) {
      input.removeAttribute("aria-activedescendant");
    }
  };

  const selectIndex = (index: number): void => {
    state = { ...state, selectedIndex: index, userNavigated: true };
    applySelection();
    notifySelection();
  };

  const renderItem = (item: PickerItem, index: number): HTMLLIElement => {
    const li = document.createElement("li");
    li.id = `folder-option-${index}`;
    li.setAttribute("role", "option");
    if (item.kind === "create") {
      li.classList.add("create-entry");
      li.textContent = `Create folder "${item.title}"`;
    } else {
      renderHighlighted(li, item.entry.path, item.highlightRanges);
    }
    li.addEventListener("click", () => selectIndex(index));
    return li;
  };

  const render = (): void => {
    list.replaceChildren(...state.items.map(renderItem));
    applySelection();
    notifySelection();
  };

  const recompute = async (query: string): Promise<void> => {
    const thisGeneration = ++generation;
    const remembered = await recallSelection(query);
    // A newer input event superseded this recomputation.
    if (thisGeneration !== generation) return;
    state = computeList(
      query,
      options.folders,
      remembered,
      options.recentFolderIds,
      options.currentFolderId,
      true,
    );
    render();
  };

  input.addEventListener("input", () => void recompute(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    state = moveSelection(state, event.key === "ArrowDown" ? 1 : -1);
    applySelection();
    notifySelection();
  });

  void recompute(input.value);

  return {
    getState: () => state,
    getSelectedItem: selectedItem,
  };
}

function renderHighlighted(
  li: HTMLLIElement,
  path: string,
  ranges: Array<[number, number]>,
): void {
  let position = 0;
  for (const [start, end] of ranges) {
    li.append(path.slice(position, start));
    const mark = document.createElement("mark");
    mark.textContent = path.slice(start, end);
    li.append(mark);
    position = end;
  }
  li.append(path.slice(position));
}
