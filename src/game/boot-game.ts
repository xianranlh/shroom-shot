import * as Phaser from "phaser";
import { ArenaScene } from "@/game/arena-scene";

export function createGame(parent: HTMLElement) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#1a1424",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: parent.clientWidth || 960,
      height: parent.clientHeight || 640,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    render: { antialias: true, pixelArt: false },
    scene: [ArenaScene],
    audio: { noAudio: true },
  });
}
