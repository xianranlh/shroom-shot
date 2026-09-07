import { Pause, Play, RotateCcw, Save, Sparkles } from "lucide-react";
import { useRef } from "react";
import { input } from "@/game/input";
import { newRun, type MapNode } from "@/game/run";
import { clearRunSave, hasRunSave, loadSave } from "@/game/save";
import { patchHud, useHud } from "@/game/store";

async function arena() {
  const { getArena } = await import("@/game/arena-scene");
  return getArena();
}

export function GameOverlays() {
  const hud = useHud();

  return (
    <>
      {hud.screen === "title" && <Title />}
      {hud.screen === "map" && <MapPick />}
      {hud.screen === "dead" && <End title="远征折在林里" sub="菌孢子会记住你走过的路。" />}
      {hud.screen === "win" && <End title="夜孢已散" sub="一次远征，一条随机的路。" />}
      {hud.screen === "arena" && <Hud />}
      {hud.paused && <PauseMenu />}
      {hud.talentChoices.length > 0 && <TalentPick />}
      {hud.itemToast && (
        <div className="pointer-events-none absolute top-24 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-gold/40 bg-surface/90 px-4 py-2 font-display text-lg text-gold">
          {hud.itemToast}
        </div>
      )}
      {hud.screen === "arena" && <TouchPad />}
    </>
  );
}

function Title() {
  const has = useHud((s) => s.hasRun) || hasRunSave();
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-bg/80 px-6 text-center backdrop-blur-sm">
      <p className="mb-2 text-xs tracking-[0.35em] text-moss">SHROOM SHOT</p>
      <h1 className="font-display text-6xl text-fg sm:text-7xl">菇林弹丸</h1>
      <p className="mt-4 max-w-md text-muted">一次远征，一条随机的路。小狐狸、长猎枪、会跳的蘑菇。</p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        {has && (
          <button
            className="min-h-11 rounded-lg bg-primary px-5 py-3 text-fg"
            onClick={() => void continueRun()}
          >
            继续远征
          </button>
        )}
        <button
          className="min-h-11 rounded-lg border border-border bg-surface px-5 py-3 text-fg"
          onClick={() => void startNew()}
        >
          新的远征
        </button>
      </div>
      <p className="mt-8 text-xs text-muted">WASD 移动 · 鼠标瞄准射击 · 空格闪避 · Esc 暂停</p>
    </div>
  );
}

async function startNew() {
  clearRunSave();
  const run = newRun();
  const scn = await waitScene();
  scn?.bindRun(run);
  patchHud({
    screen: "map",
    hasRun: true,
    mapNodes: run.nodes,
    lastSafeId: "",
    currentId: null,
    talentChoices: [],
  });
}

async function continueRun() {
  const save = loadSave();
  if (!save) return startNew();
  const scn = await waitScene();
  scn?.bindRun(save.run);
  patchHud({
    screen: "map",
    hasRun: true,
    mapNodes: save.run.nodes,
    lastSafeId: save.run.lastSafeNodeId,
    currentId: null,
    hp: save.run.hp,
    maxHp: save.run.maxHp,
    level: save.run.level,
    xp: save.run.xp,
  });
}

async function waitScene() {
  for (let i = 0; i < 40; i++) {
    const s = await arena();
    if (s) return s;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

function MapPick() {
  const nodes = useHud((s) => s.mapNodes);
  const last = useHud((s) => s.lastSafeId);
  const reachable = new Set<string>();
  const lastNode = nodes.find((n) => n.id === last);
  if (!lastNode) reachable.add("n0");
  else lastNode.next.forEach((id) => reachable.add(id));

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-bg/85 px-4 py-6 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl">远征图</h2>
        <button className="min-h-11 rounded-lg border border-border px-4 text-sm" onClick={() => patchHud({ screen: "title" })}>
          返回
        </button>
      </div>
      <p className="mb-4 text-sm text-muted">选一条还没走过的路。Boss 房会锁血变身，别想一枪跳阶段。</p>
      <div className="relative mx-auto h-[min(70dvh,520px)] w-full max-w-lg">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {nodes.map((n) =>
            n.next.map((id) => {
              const t = nodes.find((x) => x.id === id);
              if (!t) return null;
              return (
                <line
                  key={n.id + id}
                  x1={n.x}
                  y1={n.y}
                  x2={t.x}
                  y2={t.y}
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth="0.8"
                />
              );
            }),
          )}
        </svg>
        {nodes.map((n) => {
          const open = reachable.has(n.id);
          return (
            <button
              key={n.id}
              disabled={!open}
              onClick={() => void enter(n)}
              className={`absolute min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 text-[11px] ${
                open
                  ? "border-gold bg-primary text-fg"
                  : "border-border bg-surface text-muted"
              }`}
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              {short(n)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function short(n: MapNode) {
  if (n.boss === "king") return "王";
  if (n.boss === "bloom") return "花";
  if (n.boss === "umbra") return "夜";
  return { combat: "战", elite: "精", item: "物", talent: "赋", boss: "王" }[n.kind];
}

async function enter(n: MapNode) {
  const scn = await arena();
  if (!scn) return;
  patchHud({ screen: "arena", paused: false, talentChoices: [] });
  scn.startNode(n);
}

function Hud() {
  const hud = useHud();
  const stage = Math.min(3, hud.portraitStage + 1);
  const hp = hud.maxHp ? hud.hp / hud.maxHp : 0;
  const xp = hud.xpNeed ? hud.xp / hud.xpNeed : 0;
  const boss = hud.bossMax ? hud.bossHp / hud.bossMax : 0;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-3 p-3">
      <img
        src={`/sprites/fox/stage-${stage}.png`}
        alt=""
        className="h-14 w-14 rounded-lg border border-border bg-surface object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            Lv.{hud.level} · 波次 {hud.wave}
          </span>
          <span>{hud.nodeLabel}</span>
        </div>
        <Bar value={hp} color="bg-primary" />
        <Bar value={xp} color="bg-gold" />
        {hud.bossName && (
          <div className="mt-1">
            <div className="text-[11px] text-gold">{hud.bossName}</div>
            <Bar value={boss} color="bg-bloom" />
          </div>
        )}
      </div>
      <button
        className="pointer-events-auto min-h-11 min-w-11 rounded-lg border border-border bg-surface/80 text-fg"
        onClick={() => void arena().then((s) => s?.togglePause())}
        aria-label="暂停"
      >
        <Pause className="mx-auto h-5 w-5" />
      </button>
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg/80">
      <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

function PauseMenu() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/70 px-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-2xl">暂停</h2>
        <div className="mt-5 flex flex-col gap-3">
          <button
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-fg"
            onClick={() => void arena().then((s) => s?.resumePause())}
          >
            <Play className="h-4 w-4" /> 继续
          </button>
          <button
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4"
            onClick={() => void arena().then((s) => s?.saveAndQuit())}
          >
            <Save className="h-4 w-4" /> 保存并返回
          </button>
        </div>
      </div>
    </div>
  );
}

function TalentPick() {
  const choices = useHud((s) => s.talentChoices);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg">
        <h2 className="mb-4 flex items-center gap-2 font-display text-2xl">
          <Sparkles className="h-5 w-5 text-gold" /> 林子让出一点
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {choices.map((t) => (
            <button
              key={t.id}
              className="min-h-24 rounded-xl border border-border bg-surface p-4 text-left"
              onClick={() => void arena().then((s) => s?.pickTalent(t))}
            >
              <div className="font-display text-lg text-gold">{t.name}</div>
              <div className="mt-1 text-sm text-muted">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function End({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-bg/85 px-6 text-center">
      <h2 className="font-display text-4xl">{title}</h2>
      <p className="mt-3 text-muted">{sub}</p>
      <button
        className="mt-8 flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-fg"
        onClick={() => {
          clearRunSave();
          patchHud({ screen: "title", hasRun: false, talentChoices: [], paused: false });
        }}
      >
        <RotateCcw className="h-4 w-4" /> 再走一回
      </button>
    </div>
  );
}

function TouchPad() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-between p-4 sm:hidden">
      <Stick side="move" />
      <div className="flex items-end gap-3">
        <button
          className="pointer-events-auto min-h-14 min-w-14 rounded-full border border-border bg-surface/70 text-sm"
          onPointerDown={(e) => {
            e.preventDefault();
            input.dash = true;
          }}
        >
          闪
        </button>
        <Stick side="aim" />
      </div>
    </div>
  );
}

function Stick({ side }: { side: "move" | "aim" }) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      className="pointer-events-auto h-28 w-28 rounded-full border border-border bg-surface/50"
      onPointerDown={(e) => {
        origin.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!origin.current) return;
        const dx = (e.clientX - origin.current.x) / 48;
        const dy = (e.clientY - origin.current.y) / 48;
        const l = Math.hypot(dx, dy) || 1;
        const nx = dx / Math.max(1, l);
        const ny = dy / Math.max(1, l);
        if (side === "move") {
          input.mx = nx;
          input.my = ny;
        } else {
          input.ax = nx;
          input.ay = ny;
          input.firing = true;
        }
      }}
      onPointerUp={() => {
        origin.current = null;
        if (side === "move") {
          input.mx = 0;
          input.my = 0;
        } else {
          input.ax = 0;
          input.ay = 0;
          input.firing = false;
        }
      }}
    />
  );
}
