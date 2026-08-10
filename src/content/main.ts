import { isBookmarkShortcut } from "./keys";

// Bubble phase so page handlers run first and can claim Ctrl+D for themselves.
window.addEventListener("keydown", (e) => {
  if (!isBookmarkShortcut(e)) return;
  e.preventDefault();
  void browser.runtime.sendMessage({ type: "open-popup" });
});
