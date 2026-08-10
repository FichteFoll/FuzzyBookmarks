import * as fuzzysort from "fuzzysort";

import type { FolderEntry } from "./folders";

export interface FolderMatch {
  entry: FolderEntry;
  score: number;
  highlightRanges: Array<[number, number]>;
}

export function matchFolders(
  query: string,
  folders: FolderEntry[],
): FolderMatch[] {
  if (query.trim() === "") {
    return folders.map((entry) => ({ entry, score: 0, highlightRanges: [] }));
  }
  const results = fuzzysort.go(query, folders, { key: "path" });
  return results.map((result) => ({
    entry: result.obj,
    score: result.score,
    highlightRanges: mergeIndexesIntoRanges(result.indexes),
  }));
}

// fuzzysort reports matched character positions as sorted single indexes;
// consecutive ones are merged into [start, endExclusive] ranges.
function mergeIndexesIntoRanges(
  indexes: ReadonlyArray<number>,
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const index of indexes) {
    const last = ranges[ranges.length - 1];
    if (last && index === last[1]) {
      last[1] = index + 1;
    } else {
      ranges.push([index, index + 1]);
    }
  }
  return ranges;
}
