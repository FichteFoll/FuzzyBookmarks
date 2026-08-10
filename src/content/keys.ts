export function isBookmarkShortcut(
  e: Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "altKey" | "metaKey" | "shiftKey" | "defaultPrevented"
  >,
): boolean {
  return (
    e.key.toLowerCase() === "d" &&
    e.ctrlKey &&
    !e.altKey &&
    !e.metaKey &&
    !e.shiftKey &&
    // A page that already handled Ctrl+D (e.g. a spreadsheet fill-down) wins.
    !e.defaultPrevented
  );
}
