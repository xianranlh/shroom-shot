export type Talent = {
  id: string;
  name: string;
  desc: string;
  apply: (s: TalentStats) => void;
};

export type TalentStats = {
  maxHp: number;
  hp: number;
  dmgMul: number;
  fireMul: number;
  speedMul: number;
  dashMul: number;
  rangeMul: number;
};

export function xpToNext(level: number) {
  return 32 * 2 ** (level - 1);
}

export const TALENTS: Talent[] = [
  {
    id: "vita",
    name: "菌血",
    desc: "生命上限 +18，回复 18",
    apply: (s) => {
      s.maxHp += 18;
      s.hp = Math.min(s.maxHp, s.hp + 18);
    },
  },
  {
    id: "fang",
    name: "牙弹",
    desc: "伤害 +22%",
    apply: (s) => {
      s.dmgMul += 0.22;
    },
  },
  {
    id: "swift",
    name: "疾蹄",
    desc: "移速 +16%",
    apply: (s) => {
      s.speedMul += 0.16;
    },
  },
  {
    id: "burst",
    name: "连珠",
    desc: "射速 +22%",
    apply: (s) => {
      s.fireMul += 0.22;
    },
  },
  {
    id: "blink",
    name: "残影",
    desc: "闪避冷却更短、距离更远",
    apply: (s) => {
      s.dashMul += 0.25;
    },
  },
  {
    id: "sight",
    name: "远瞳",
    desc: "射程 +20%",
    apply: (s) => {
      s.rangeMul += 0.2;
    },
  },
];

export function rollTalents(n = 3): Talent[] {
  const pool = [...TALENTS];
  const out: Talent[] = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]!);
  }
  return out;
}
