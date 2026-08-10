// FuzzyBookmarks options page: lets the user pick the default bookmark
// folder used when Enter is pressed without narrowing the folder list.
import { listFolders } from "../lib/folders";
import { getSettings, updateSettings } from "../lib/settings";

async function init(): Promise<void> {
  const select = document.querySelector<HTMLSelectElement>("#default-folder");
  if (!select) return;

  const [folders, settings] = await Promise.all([listFolders(), getSettings()]);

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Firefox default (Other)";
  select.append(defaultOption);

  for (const folder of folders) {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.path;
    select.append(option);
  }

  select.value = settings.defaultFolderId ?? "";

  select.addEventListener("change", () => {
    void updateSettings({ defaultFolderId: select.value || null });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  void init();
});
