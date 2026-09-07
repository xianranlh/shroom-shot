import { create } from "zustand";
import { hasRunSave } from "@/game/save";
import type { Talent } from "@/game/talents";
import type { MapNode } from "@/game/run";

export type Screen = "title" | "map" | "arena" | "dead" | "win";

export type Hud = {
  screen: Screen;
  frozen: boolean;
  paused: boolean;
  hasRun: boolean;
  hp: number;
  maxHp: number;
  xp: number;
  xpNeed: number;
  level: number;
  wave: number;
  portraitStage: number;
  nodeLabel: string;
  bossName: string | null;
  bossHp: number;
  bossMax: number;
  talentChoices: Talent[];
  itemToast: string | null;
  mapNodes: MapNode[];
  currentId: string | null;
  lastSafeId: string;
  hint: string;
};

const empty: Hud = {
  screen: "title",
  frozen: false,
  paused: false,
  hasRun: false,
  hp: 100,
  maxHp: 100,
  xp: 0,
  xpNeed: 32,
  level: 1,
  wave: 1,
  portraitStage: 0,
  nodeLabel: "",
  bossName: null,
  bossHp: 0,
  bossMax: 0,
  talentChoices: [],
  itemToast: null,
  mapNodes: [],
  currentId: null,
  lastSafeId: "",
  hint: "WASD 移动 · 鼠标瞄准射击 · 空格闪避",
};

export const useHud = create<Hud>(() => ({ ...empty, hasRun: hasRunSave() }));

export function patchHud(p: Partial<Hud>) {
  useHud.setState(p);
}

export function resetHud() {
  useHud.setState({ ...empty, hasRun: hasRunSave() });
}
