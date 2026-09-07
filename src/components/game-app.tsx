import { useEffect, useRef } from "react";
import { GameOverlays } from "@/components/game-overlays";
import { hasRunSave } from "@/game/save";
import { patchHud } from "@/game/store";
import { input } from "@/game/input";

export function GameApp() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let game: { destroy: (remove: boolean) => void } | undefined;
    let cancelled = false;

    void import("@/game/boot-game").then(({ createGame }) => {
      if (cancelled || !host.current) return;
      game = createGame(host.current);
      patchHud({ hasRun: hasRunSave() });
    });

    const down = (e: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      input.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      input.keys.delete(e.code);
    };
    const blur = () => input.keys.clear();
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      game?.destroy(true);
    };
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg">
      <div ref={host} className="absolute inset-0 touch-none" />
      <GameOverlays />
    </div>
  );
}
