import type { RunState } from "@/game/run";

export const SAVE_VERSION = 3;
const KEY = "shroom-shot-run-v3";

export type RunSave = {
  version: number;
  run: RunState;
};

export function loadSave(): RunSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RunSave;
    if (!data || data.version !== SAVE_VERSION || !data.run) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(run: RunState) {
  const payload: RunSave = { version: SAVE_VERSION, run };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function clearRunSave() {
  localStorage.removeItem(KEY);
}

export function hasRunSave() {
  return loadSave() !== null;
}
