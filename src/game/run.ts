import { ITEMS, type ItemStats } from "@/game/items";
import { TALENTS, xpToNext, type TalentStats } from "@/game/talents";

export type NodeKind = "combat" | "elite" | "item" | "talent" | "boss";
export type BossKind = "king" | "bloom" | "umbra";

export type MapNode = {
  id: string;
  kind: NodeKind;
  act: number;
  x: number;
  y: number;
  next: string[];
  boss?: BossKind;
};

export type RunState = ItemStats &
  TalentStats & {
    level: number;
    xp: number;
    wave: number;
    items: string[];
    talents: string[];
    currentNodeId: string | null;
    lastSafeNodeId: string;
    nodes: MapNode[];
    dead: boolean;
    won: boolean;
  };

export const BOSS_LABEL: Record<BossKind, string> = {
  king: "大王菇",
  bloom: "花冠菇",
  umbra: "夜孢君",
};

export function makeMap(): MapNode[] {
  const n = (
    id: string,
    kind: NodeKind,
    act: number,
    x: number,
    y: number,
    next: string[],
    boss?: BossKind,
  ): MapNode => ({ id, kind, act, x, y, next, boss });
  return [
    n("n0", "combat", 1, 18, 78, ["n1", "n2"]),
    n("n1", "item", 1, 34, 58, ["n3"]),
    n("n2", "elite", 1, 34, 88, ["n3"]),
    n("n3", "talent", 1, 50, 72, ["n4"]),
    n("n4", "boss", 1, 66, 72, ["n5"], "king"),
    n("n5", "combat", 2, 18, 42, ["n6", "n7"]),
    n("n6", "item", 2, 36, 28, ["n8"]),
    n("n7", "elite", 2, 36, 52, ["n8"]),
    n("n8", "boss", 2, 56, 40, ["n9"], "bloom"),
    n("n9", "combat", 3, 72, 28, ["n10"]),
    n("n10", "talent", 3, 84, 40, ["n11"]),
    n("n11", "elite", 3, 84, 58, ["n12"]),
    n("n12", "boss", 3, 72, 72, [], "umbra"),
  ];
}

export function newRun(): RunState {
  return {
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    wave: 1,
    rangeMul: 1,
    dmgMul: 1,
    fireMul: 1,
    speedMul: 1,
    dashMul: 1,
    items: [],
    talents: [],
    currentNodeId: null,
    lastSafeNodeId: "",
    nodes: makeMap(),
    dead: false,
    won: false,
  };
}

export function recompute(run: RunState) {
  const stats = {
    maxHp: 100,
    hp: run.hp,
    rangeMul: 1,
    dmgMul: 1,
    fireMul: 1,
    speedMul: 1,
    dashMul: 1,
  };
  for (const id of run.talents) TALENTS.find((t) => t.id === id)?.apply(stats);
  for (const id of run.items) ITEMS.find((i) => i.id === id)?.apply(stats);
  run.maxHp = stats.maxHp;
  run.rangeMul = stats.rangeMul;
  run.dmgMul = stats.dmgMul;
  run.fireMul = stats.fireMul;
  run.speedMul = stats.speedMul;
  run.dashMul = stats.dashMul;
  run.hp = Math.min(Math.max(run.hp, stats.hp), run.maxHp);
}

export function portraitStage(level: number) {
  return Math.min(2, Math.floor((level - 1) / 3));
}

export function xpNeed(level: number) {
  return xpToNext(level);
}

export function waveCountMul(wave: number) {
  return Math.min(8, 2 ** Math.floor(wave / 3));
}

export function waveStatStacks(wave: number) {
  return Math.floor(wave / 5);
}

export function bossPowerMul(wave: number) {
  return Math.min(8, 2 ** Math.floor(wave / 5));
}
