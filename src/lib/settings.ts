"use client";

import { useTable } from "./useTable";
import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Omit<Settings, "id"> = {
  daily_new_limit: 20,
  desired_retention: 0.9,
  gating_enabled: true,
  unlock_threshold: 0.7,
};

export function useSettings() {
  const table = useTable("settings");
  const row = table.rows[0];
  const settings: Omit<Settings, "id"> = { ...DEFAULT_SETTINGS, ...row };

  async function save(patch: Partial<Settings>) {
    if (row) await table.update(row.id, patch);
    else await table.insert({ ...DEFAULT_SETTINGS, ...patch });
  }

  return { settings, save, loaded: table.loaded };
}
