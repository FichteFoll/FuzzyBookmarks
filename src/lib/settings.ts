const STORAGE_KEY = "settings";

export interface Settings {
  defaultFolderId: string | null;
}

const DEFAULT_SETTINGS: Settings = { defaultFolderId: null };

export async function getSettings(): Promise<Settings> {
  const stored = (await browser.storage.local.get(STORAGE_KEY)) as Record<
    string,
    Partial<Settings> | undefined
  >;
  return { ...DEFAULT_SETTINGS, ...stored[STORAGE_KEY] };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await browser.storage.local.set({ [STORAGE_KEY]: { ...current, ...patch } });
}
