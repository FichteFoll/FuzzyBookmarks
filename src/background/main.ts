// FuzzyBookmarks background event page (MV3 "background.scripts").

async function openPopup(): Promise<void> {
  try {
    await browser.action.openPopup();
  } catch {
    // openPopup requires a user-input context that may not survive the
    // runtime message; fall back to a standalone popup window.
    await browser.windows.create({
      type: "popup",
      url: "popup/popup.html",
      width: 440,
      height: 560,
    });
  }
}

browser.runtime.onMessage.addListener((message: unknown) => {
  if ((message as { type?: unknown } | null)?.type !== "open-popup") return;
  void openPopup();
});
