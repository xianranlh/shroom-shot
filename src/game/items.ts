export type ItemDef = {
  id: string;
  name: string;
  desc: string;
  apply: (s: ItemStats) => void;
};

export type ItemStats = {
  rangeMul: number;
  dmgMul: number;
  fireMul: number;
  speedMul: number;
  maxHp: number;
  hp: number;
};

export const ITEMS: ItemDef[] = [
  {
    id: "longshot",
    name: "远眺叶",
    desc: "射程 +45%",
    apply: (s) => {
      s.rangeMul += 0.45;
    },
  },
  {
    id: "scope",
    name: "菌核瞄镜",
    desc: "射程 +80%",
    apply: (s) => {
      s.rangeMul += 0.8;
    },
  },
  {
    id: "heart",
    name: "菌心",
    desc: "生命上限 +25，立即回满",
    apply: (s) => {
      s.maxHp += 25;
      s.hp = s.maxHp;
    },
  },
  {
    id: "rapid",
    name: "连发孢",
    desc: "射速 +35%",
    apply: (s) => {
      s.fireMul += 0.35;
    },
  },
  {
    id: "pepper",
    name: "辣孢子",
    desc: "伤害 +30%",
    apply: (s) => {
      s.dmgMul += 0.3;
    },
  },
  {
    id: "boot",
    name: "苔靴",
    desc: "移速 +20%",
    apply: (s) => {
      s.speedMul += 0.2;
    },
  },
];

export function rollItem(owned: string[]): ItemDef {
  const pool = ITEMS.filter((i) => !owned.includes(i.id));
  const src = pool.length ? pool : ITEMS;
  return src[Math.floor(Math.random() * src.length)]!;
}
