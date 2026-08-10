import { describe, expect, it } from "vitest";

import { getSettings, updateSettings } from "./settings";

function installFakeStorage(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const local = {
    get(key: string): Promise<Record<string, unknown>> {
      return Promise.resolve(
        key in data ? { [key]: structuredClone(data[key]) } : {},
      );
    },
    set(items: Record<string, unknown>): Promise<void> {
      Object.assign(data, structuredClone(items));
      return Promise.resolve();
    },
  };
  (globalThis as { browser?: unknown }).browser = { storage: { local } };
  return data;
}

describe("getSettings", () => {
  it("returns defaults when storage is empty", async () => {
    installFakeStorage();
    expect(await getSettings()).toEqual({ defaultFolderId: null });
  });
});

describe("updateSettings", () => {
  it("persists the patch under the settings key", async () => {
    const data = installFakeStorage();
    await updateSettings({ defaultFolderId: "folder-1" });
    expect(data["settings"]).toEqual({ defaultFolderId: "folder-1" });
    expect(await getSettings()).toEqual({ defaultFolderId: "folder-1" });
  });

  it("merges the patch with existing settings", async () => {
    installFakeStorage();
    await updateSettings({ defaultFolderId: "folder-1" });
    await updateSettings({});
    expect(await getSettings()).toEqual({ defaultFolderId: "folder-1" });
  });
});
