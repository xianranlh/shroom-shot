import * as Phaser from "phaser";
import { input, setKeys } from "@/game/input";
import { rollItem } from "@/game/items";
import { rollTalents, xpToNext, type Talent } from "@/game/talents";
import {
  BOSS_LABEL,
  bossPowerMul,
  portraitStage,
  recompute,
  waveCountMul,
  waveStatStacks,
  type BossKind,
  type MapNode,
  type RunState,
} from "@/game/run";
import { clearRunSave, writeSave } from "@/game/save";
import { patchHud } from "@/game/store";

const WORLD = 2800;
const ORIGIN_Y = 0.82;

type Mob = Phaser.Physics.Arcade.Sprite & {
  hp?: number;
  maxHp?: number;
  kind?: string;
  elite?: boolean;
  hop?: number;
  dying?: boolean;
};

type Boss = Mob & {
  phase?: number;
  lockT?: number;
  skillT?: number;
  skill?: number;
  kindBoss?: BossKind;
};

let sceneRef: ArenaScene | null = null;
export function getArena() {
  return sceneRef;
}

export class ArenaScene extends Phaser.Scene {
  run!: RunState;
  player!: Phaser.Physics.Arcade.Sprite;
  bullets!: Phaser.Physics.Arcade.Group;
  mobs!: Phaser.Physics.Arcade.Group;
  hazards!: Phaser.Physics.Arcade.Group;
  solids!: Phaser.Physics.Arcade.StaticGroup;
  aim = 0;
  fireCd = 0;
  dashT = 0;
  dashCd = 0;
  iFrame = 0;
  moveX = 0;
  moveY = -1;
  roomClear = false;
  spawnLeft = 0;
  waveLocal = 0;
  boss: Boss | null = null;
  node: MapNode | null = null;
  frozen = false;
  ghost?: Phaser.GameObjects.Image;
  vignette?: Phaser.GameObjects.Graphics;

  constructor() {
    super("arena");
  }

  init() {
    this.aim = 0;
    this.fireCd = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.iFrame = 0;
    this.roomClear = false;
    this.spawnLeft = 0;
    this.waveLocal = 0;
    this.boss = null;
    this.frozen = false;
  }

  preload() {
    this.load.image("fox", "/sprites/fox/idle.png");
    this.load.image("foxFlip", "/sprites/fox/idle-flip.png");
    this.load.image("shroom", "/sprites/mushroom-red.png");
    this.load.image("elite", "/sprites/mushroom-elite.png");
    this.load.image("king", "/sprites/boss-king.png");
    this.load.image("king2", "/sprites/boss-king-2.png");
    this.load.image("king3", "/sprites/boss-king-3.png");
    this.load.image("bloom", "/sprites/boss-bloom.png");
    this.load.image("bloom2", "/sprites/boss-bloom-2.png");
    this.load.image("bloom3", "/sprites/boss-bloom-3.png");
    this.load.image("umbra", "/sprites/boss-umbra.png");
    this.load.image("umbra2", "/sprites/boss-umbra-2.png");
    this.load.image("umbra3", "/sprites/boss-umbra-3.png");
    this.load.image("tree", "/sprites/tree.png");
    this.load.image("rock", "/sprites/rock.png");
  }

  create() {
    sceneRef = this;
    this.events.once("shutdown", () => {
      if (sceneRef === this) sceneRef = null;
    });

    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xf6e37a, 1);
    g.fillCircle(7, 7, 6);
    g.generateTexture("pellet", 14, 14);
    g.clear();
    g.fillStyle(0xe8a0b4, 1);
    g.fillCircle(8, 8, 7);
    g.generateTexture("petal", 16, 16);
    g.clear();
    g.fillStyle(0x6ec8d4, 1);
    g.fillCircle(6, 6, 5);
    g.generateTexture("spore", 12, 12);
    g.destroy();

    this.add.rectangle(WORLD / 2, WORLD / 2, WORLD, WORLD, 0x3a2a44);
    for (let i = 0; i < 90; i++) {
      const x = 80 + Math.random() * (WORLD - 160);
      const y = 80 + Math.random() * (WORLD - 160);
      const c = Phaser.Display.Color.GetColor(
        70 + Math.random() * 40,
        90 + Math.random() * 50,
        70 + Math.random() * 30,
      );
      this.add.circle(x, y, 18 + Math.random() * 40, c, 0.25);
    }

    this.physics.world.setBounds(40, 40, WORLD - 80, WORLD - 80);
    this.solids = this.physics.add.staticGroup();
    this.mobs = this.physics.add.group();
    this.bullets = this.physics.add.group({ maxSize: 80 });
    this.hazards = this.physics.add.group({ maxSize: 48 });

    this.player = this.physics.add.sprite(WORLD / 2, WORLD / 2, "fox");
    this.player.setOrigin(0.5, ORIGIN_Y);
    this.player.setScale(0.42);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    pb.setSize(70, 70).setOffset(93, 130);
    pb.setDamping(true).setDrag(0.0001);

    this.ghost = this.add.image(0, 0, "fox").setOrigin(0.5, ORIGIN_Y).setScale(0.42).setAlpha(0).setDepth(9);

    for (let i = 0; i < 18; i++) {
      const x = 200 + Math.random() * (WORLD - 400);
      const y = 200 + Math.random() * (WORLD - 400);
      if (Phaser.Math.Distance.Between(x, y, WORLD / 2, WORLD / 2) < 220) continue;
      const key = Math.random() < 0.55 ? "tree" : "rock";
      const s = this.solids.create(x, y, key) as Phaser.Physics.Arcade.Sprite;
      s.setOrigin(0.5, 0.85).setScale(key === "tree" ? 0.55 : 0.42);
      s.setData("hp", key === "tree" ? 18 : 28);
      const b = s.body as Phaser.Physics.Arcade.StaticBody;
      b.setSize(50, 40).setOffset(100, 160);
    }

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.mobs, this.solids);
    this.physics.add.collider(this.mobs, this.mobs);
    this.physics.add.overlap(this.bullets, this.mobs, (b, m) => this.hitMob(b as Phaser.Physics.Arcade.Image, m as Mob));
    this.physics.add.overlap(this.bullets, this.solids, (b, s) => this.hitSolid(b as Phaser.Physics.Arcade.Image, s as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.player, this.mobs, (_p, m) => this.touchMob(m as Mob));
    this.physics.add.overlap(this.player, this.hazards, (_p, h) => this.touchHazard(h as Phaser.Physics.Arcade.Image));

    this.cameras.main.setBounds(0, 0, WORLD, WORLD);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.applyView();

    this.vignette = this.add.graphics().setScrollFactor(0).setDepth(40).setAlpha(0);

    this.input.keyboard?.on("keydown-ESC", () => this.togglePause());
    this.input.keyboard?.on("keydown-SPACE", () => {
      input.dash = true;
    });

    window.__controlsTest = {
      getYaw: () => Math.atan2(-this.moveX, -this.moveY),
      getSpeed: () => (this.player.body as Phaser.Physics.Arcade.Body).velocity.length() / 200,
      setKeys,
    };
  }

  bindRun(run: RunState) {
    this.run = run;
    recompute(run);
    this.syncHud();
    this.applyView();
  }

  startNode(node: MapNode) {
    this.node = node;
    this.run.currentNodeId = node.id;
    this.roomClear = false;
    this.waveLocal = 0;
    this.run.wave = Math.max(this.run.wave, node.act * 3 - 2);
    this.player.setPosition(WORLD / 2, WORLD / 2);
    this.mobs.clear(true, true);
    this.bullets.clear(true, true);
    this.hazards.clear(true, true);
    this.boss = null;
    this.frozen = false;
    this.cameras.main.fadeIn(250, 20, 16, 24);
    if (node.kind === "boss" && node.boss) this.spawnBoss(node.boss);
    else if (node.kind === "item") this.grantItem();
    else if (node.kind === "talent") this.offerTalents();
    else this.nextWave();
    this.persist(false);
    this.syncHud();
  }

  applyView() {
    if (!this.run) return;
    const z = Math.max(0.66, 0.95 * 0.94 ** (this.run.level - 1));
    this.cameras.main.setZoom(z);
  }

  persist(safe: boolean) {
    if (safe && this.node) this.run.lastSafeNodeId = this.node.id;
    writeSave(this.run);
    this.syncHud();
  }

  syncHud() {
    const b = this.boss;
    patchHud({
      hasRun: true,
      hp: Math.max(0, Math.round(this.run.hp)),
      maxHp: this.run.maxHp,
      xp: this.run.xp,
      xpNeed: xpToNext(this.run.level),
      level: this.run.level,
      wave: this.run.wave,
      portraitStage: portraitStage(this.run.level),
      nodeLabel: this.node ? labelOf(this.node) : "",
      bossName: b?.kindBoss ? BOSS_LABEL[b.kindBoss] : null,
      bossHp: b?.hp ?? 0,
      bossMax: b?.maxHp ?? 0,
      lastSafeId: this.run.lastSafeNodeId,
      mapNodes: this.run.nodes,
    });
  }

  togglePause() {
    if (!this.run || this.run.dead || this.run.won) return;
    if (this.scene.isPaused()) {
      this.scene.resume();
      patchHud({ paused: false, frozen: this.frozen });
    } else {
      this.scene.pause();
      patchHud({ paused: true, frozen: true });
    }
  }

  resumePause() {
    if (this.scene.isPaused()) this.scene.resume();
    patchHud({ paused: false, frozen: this.frozen });
  }

  saveAndQuit() {
    this.persist(false);
    this.run.currentNodeId = null;
    writeSave(this.run);
    this.resumePause();
    patchHud({ screen: "title", hasRun: true });
  }

  update(_t: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.1);
    if (!this.run || this.frozen || this.run.dead || this.run.won) return;
    this.stepInput(dt);
    this.stepMobs(dt);
    this.stepBoss(dt);
    this.stepBullets();
    this.idleBreathe();
    if (this.iFrame > 0) this.iFrame -= dt;
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.dashT > 0) this.dashT -= dt;
    if (!this.roomClear && this.node && (this.node.kind === "combat" || this.node.kind === "elite")) {
      if (this.mobs.countActive(true) === 0 && this.spawnLeft <= 0) this.onWaveClear();
    }
  }

  stepInput(dt: number) {
    let mx = input.mx;
    let my = input.my;
    if (input.keys.has("KeyW") || input.keys.has("ArrowUp")) my -= 1;
    if (input.keys.has("KeyS") || input.keys.has("ArrowDown")) my += 1;
    if (input.keys.has("KeyA") || input.keys.has("ArrowLeft")) mx -= 1;
    if (input.keys.has("KeyD") || input.keys.has("ArrowRight")) mx += 1;
    const ptr = this.input.activePointer;
    const usingStick = Math.hypot(input.ax, input.ay) > 0.2;
    if (usingStick) {
      this.aim = Math.atan2(input.ay, input.ax);
    } else if (ptr) {
      const w = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      this.aim = Math.atan2(w.y - this.player.y, w.x - this.player.x);
    }
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    if (len > 0.05) {
      this.moveX = mx;
      this.moveY = my;
    }
    const speed = 220 * this.run.speedMul * (this.dashT > 0 ? 2.2 * this.run.dashMul : 1);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(mx * speed, my * speed);

    if ((input.dash || input.keys.has("Space")) && this.dashCd <= 0) {
      input.dash = false;
      this.dashT = 0.18;
      this.dashCd = 0.85 / this.run.dashMul;
      this.iFrame = 0.22;
      this.afterimage();
    }

    const flip = Math.cos(this.aim) < 0;
    if (this.player.texture.key !== (flip ? "foxFlip" : "fox")) {
      this.player.setTexture(flip ? "foxFlip" : "fox");
    }

    const wantFire = input.firing || ptr.isDown || usingStick;
    if (wantFire && this.fireCd <= 0) this.shoot();
  }

  shoot() {
    this.fireCd = 0.22 / this.run.fireMul;
    const b = this.bullets.get(this.player.x, this.player.y, "pellet") as Phaser.Physics.Arcade.Image | null;
    if (!b) return;
    const ox = Math.cos(this.aim);
    const oy = Math.sin(this.aim);
    const muzzle = 28;
    b.enableBody(true, this.player.x + ox * muzzle, this.player.y - 18 + oy * muzzle, true, true);
    b.setDepth(12).setScale(1);
    const spd = 520 * (0.7 + 0.3 * this.run.rangeMul);
    b.setVelocity(ox * spd, oy * spd);
    b.setData("ttl", 0.55 * this.run.rangeMul);
    b.setData("dmg", 12 * this.run.dmgMul);
    this.cameras.main.shake(40, 0.002);
  }

  afterimage() {
    const g = this.add
      .image(this.player.x, this.player.y, this.player.texture.key)
      .setOrigin(0.5, ORIGIN_Y)
      .setScale(0.42)
      .setAlpha(0.45)
      .setTint(0xffd6a0)
      .setDepth(8);
    this.tweens.add({ targets: g, alpha: 0, duration: 280, onComplete: () => g.destroy() });
  }

  idleBreathe() {
    const s = 0.42 * (1 + Math.sin(this.time.now / 420) * 0.03);
    this.player.setScale(s);
  }

  nextWave() {
    this.waveLocal += 1;
    this.run.wave += this.waveLocal === 1 ? 0 : 1;
    const elite = this.node?.kind === "elite";
    const n = Math.round((elite ? 4 : 6) * waveCountMul(this.run.wave));
    this.spawnLeft = n;
    for (let i = 0; i < n; i++) this.time.delayedCall(i * 180, () => this.spawnMob(elite && i < 2));
    this.syncHud();
  }

  spawnMob(elite = false) {
    if (this.spawnLeft > 0) this.spawnLeft -= 1;
    const ang = Math.random() * Math.PI * 2;
    const dist = 420 + Math.random() * 260;
    const x = Phaser.Math.Clamp(this.player.x + Math.cos(ang) * dist, 80, WORLD - 80);
    const y = Phaser.Math.Clamp(this.player.y + Math.sin(ang) * dist, 80, WORLD - 80);
    const key = elite ? "elite" : "shroom";
    const m = this.mobs.create(x, y, key) as Mob;
    m.setOrigin(0.5, ORIGIN_Y).setScale(elite ? 0.48 : 0.34).setDepth(6);
    const stacks = waveStatStacks(this.run.wave);
    m.hp = (elite ? 38 : 16) * (1 + stacks * 0.35);
    m.maxHp = m.hp;
    m.kind = elite ? "elite" : "shroom";
    m.elite = elite;
    m.hop = Math.random() * 6;
    const b = m.body as Phaser.Physics.Arcade.Body;
    b.setSize(70, 60).setOffset(90, 140).setBounce(0.1);
  }

  spawnBoss(kind: BossKind) {
    const mul = bossPowerMul(this.run.wave);
    const tex = kind === "king" ? "king" : kind === "bloom" ? "bloom" : "umbra";
    const b = this.mobs.create(WORLD / 2, WORLD / 2 - 180, tex) as Boss;
    b.setOrigin(0.5, ORIGIN_Y).setScale(kind === "umbra" ? 0.72 : 0.85).setDepth(8);
    const hp = (kind === "king" ? 420 : kind === "bloom" ? 480 : 560) * mul;
    b.hp = hp;
    b.maxHp = hp;
    b.phase = 1;
    b.lockT = 0;
    b.skillT = 1.4;
    b.skill = 0;
    b.kindBoss = kind;
    b.kind = "boss";
    const body = b.body as Phaser.Physics.Arcade.Body;
    body.setSize(110, 90).setOffset(70, 130).setImmovable(true);
    this.boss = b;
    this.syncHud();
  }

  stepMobs(dt: number) {
    for (const obj of this.mobs.getChildren()) {
      const m = obj as Mob;
      if (!m.active || m.dying || m.kind === "boss") continue;
      m.hop = (m.hop ?? 0) + dt * 6;
      const squash = 1 + Math.sin(m.hop) * 0.06;
      m.setScale((m.elite ? 0.48 : 0.34) * squash, (m.elite ? 0.48 : 0.34) / squash);
      const dx = this.player.x - m.x;
      const dy = this.player.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      const stacks = waveStatStacks(this.run.wave);
      const spd = (m.elite ? 90 : 70) * (1 + stacks * 0.12);
      (m.body as Phaser.Physics.Arcade.Body).setVelocity((dx / d) * spd, (dy / d) * spd);
    }
  }

  stepBoss(dt: number) {
    const b = this.boss;
    if (!b || !b.active) return;
    if (b.lockT && b.lockT > 0) {
      b.lockT -= dt;
      return;
    }
    b.skillT = (b.skillT ?? 0) - dt;
    if ((b.skillT ?? 0) <= 0) {
      b.skill = ((b.skill ?? 0) + 1) % 3;
      b.skillT = 2.4 - (b.phase ?? 1) * 0.25;
      this.castBoss(b);
    }
    const dx = this.player.x - b.x;
    const dy = this.player.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    const spd = 40 + (b.phase ?? 1) * 12;
    (b.body as Phaser.Physics.Arcade.Body).setVelocity((dx / d) * spd, (dy / d) * spd);
  }

  castBoss(b: Boss) {
    const kind = b.kindBoss ?? "king";
    const skill = b.skill ?? 0;
    if (kind === "king") {
      if (skill === 0) {
        const dx = this.player.x - b.x;
        const dy = this.player.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        (b.body as Phaser.Physics.Arcade.Body).setVelocity((dx / d) * 320, (dy / d) * 320);
        this.time.delayedCall(420, () => (b.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0));
      } else if (skill === 1) {
        for (let i = 0; i < 14; i++) this.hazard("pellet", b.x, b.y, (i / 14) * Math.PI * 2, 220);
      } else {
        for (let i = 0; i < 3; i++) this.spawnMob(false);
      }
    } else if (kind === "bloom") {
      if (skill === 0) {
        const base = Math.atan2(this.player.y - b.y, this.player.x - b.x);
        for (let i = -3; i <= 3; i++) this.hazard("petal", b.x, b.y, base + i * 0.18, 260);
      } else if (skill === 1) {
        const x = this.player.x;
        const y = this.player.y;
        this.time.delayedCall(380, () => {
          this.hazard("petal", x, y, 0, 0);
          this.cameras.main.shake(160, 0.006);
        });
      } else {
        for (const obj of this.mobs.getChildren()) {
          const m = obj as Mob;
          if (m.kind !== "boss" && m.active && m.hp) m.hp = Math.min(m.maxHp ?? m.hp, m.hp + 8);
        }
      }
    } else {
      if (skill === 0) {
        this.cameras.main.setZoom(Math.min(1.15, this.cameras.main.zoom + 0.12));
        this.time.delayedCall(2200, () => this.applyView());
        this.flashVignette();
      } else if (skill === 1) {
        for (let i = 0; i < 2; i++) this.spawnMob(true);
      } else {
        for (let i = 0; i < 10; i++) {
          const x = this.player.x + (Math.random() - 0.5) * 420;
          const y = this.player.y - 380 - Math.random() * 80;
          this.hazard("spore", x, y, Math.PI / 2, 180 + Math.random() * 80);
        }
      }
    }
  }

  flashVignette() {
    const v = this.vignette;
    if (!v) return;
    v.clear();
    v.fillStyle(0x050310, 0.72);
    v.fillRect(0, 0, 1280, 720);
    v.setAlpha(0.85);
    this.tweens.add({ targets: v, alpha: 0, duration: 1600 });
  }

  hazard(tex: string, x: number, y: number, ang: number, spd: number) {
    const h = this.hazards.get(x, y, tex) as Phaser.Physics.Arcade.Image | null;
    if (!h) return;
    h.enableBody(true, x, y, true, true);
    h.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);
    h.setDepth(11);
    h.setData("ttl", 2.2);
    h.setData("dmg", 10 * bossPowerMul(this.run.wave));
  }

  stepBullets() {
    for (const obj of [...this.bullets.getChildren(), ...this.hazards.getChildren()]) {
      const b = obj as Phaser.Physics.Arcade.Image;
      if (!b.active) continue;
      const ttl = (b.getData("ttl") as number) - 0.016;
      b.setData("ttl", ttl);
      if (ttl <= 0) b.disableBody(true, true);
    }
  }

  hitMob(bullet: Phaser.Physics.Arcade.Image, mob: Mob) {
    if (!bullet.active || !mob.active || mob.dying) return;
    bullet.disableBody(true, true);
    this.hurtMob(mob, (bullet.getData("dmg") as number) || 12);
  }

  hitSolid(bullet: Phaser.Physics.Arcade.Image, solid: Phaser.Physics.Arcade.Sprite) {
    if (!bullet.active) return;
    bullet.disableBody(true, true);
    const hp = (solid.getData("hp") as number) - 8;
    solid.setData("hp", hp);
    solid.setTintFill(0xfff3c4);
    this.time.delayedCall(50, () => solid.clearTint());
    if (hp <= 0) {
      this.grantXp(4);
      solid.destroy();
    }
  }

  hurtMob(mob: Mob, dmg: number) {
    if (mob.kind === "boss") {
      const b = mob as Boss;
      const max = b.maxHp ?? 1;
      const floor = b.phase === 1 ? max * 0.66 : b.phase === 2 ? max * 0.33 : 0;
      if (b.lockT && b.lockT > 0) return;
      b.hp = Math.max(floor, (b.hp ?? 0) - dmg);
      b.setTintFill(0xffffff);
      this.time.delayedCall(50, () => b.clearTint());
      if (b.phase === 1 && (b.hp ?? 0) <= max * 0.66 + 0.1) this.lockPhase(b, 2);
      else if (b.phase === 2 && (b.hp ?? 0) <= max * 0.33 + 0.1) this.lockPhase(b, 3);
      else if ((b.hp ?? 0) <= 0) this.killBoss(b);
      this.syncHud();
      return;
    }
    mob.hp = (mob.hp ?? 1) - dmg;
    mob.setTintFill(0xffffff);
    this.time.delayedCall(40, () => mob.clearTint());
    if ((mob.hp ?? 0) <= 0) this.killMob(mob);
  }

  lockPhase(b: Boss, phase: number) {
    b.phase = phase;
    b.lockT = 1.6;
    b.hp = (b.maxHp ?? 1) * (phase === 2 ? 0.66 : 0.33);
    const kind = b.kindBoss ?? "king";
    const tex = `${kind}${phase === 2 ? "2" : "3"}`;
    if (this.textures.exists(tex)) b.setTexture(tex);
    b.setScale((b.scaleX ?? 0.85) * 1.08);
    this.cameras.main.flash(180, 255, 220, 180);
    this.cameras.main.shake(240, 0.01);
    this.syncHud();
  }

  killMob(mob: Mob) {
    mob.dying = true;
    (mob.body as Phaser.Physics.Arcade.Body).stop();
    this.tweens.add({
      targets: mob,
      angle: 420,
      alpha: 0,
      scale: 0.1,
      duration: 380,
      onComplete: () => mob.destroy(),
    });
    this.grantXp(mob.elite ? 18 : 8);
  }

  killBoss(b: Boss) {
    this.killMob(b);
    this.boss = null;
    this.grantXp(80);
    this.time.delayedCall(700, () => this.clearRoom(true));
  }

  touchMob(m: Mob) {
    if (m.dying || this.iFrame > 0) return;
    this.hurtPlayer(m.kind === "boss" ? 16 : m.elite ? 12 : 8);
  }

  touchHazard(h: Phaser.Physics.Arcade.Image) {
    if (!h.active || this.iFrame > 0) return;
    h.disableBody(true, true);
    this.hurtPlayer((h.getData("dmg") as number) || 10);
  }

  hurtPlayer(n: number) {
    if (this.iFrame > 0) return;
    this.iFrame = 0.45;
    this.run.hp -= n;
    this.player.setTint(0xff6b5a);
    this.time.delayedCall(120, () => this.player.clearTint());
    this.cameras.main.shake(120, 0.008);
    if (this.run.hp <= 0) this.die();
    this.syncHud();
  }

  grantXp(n: number) {
    this.run.xp += n;
    while (this.run.xp >= xpToNext(this.run.level)) {
      this.run.xp -= xpToNext(this.run.level);
      this.run.level += 1;
      this.applyView();
      this.offerTalents();
    }
    this.syncHud();
  }

  offerTalents() {
    const choices = rollTalents(3);
    this.frozen = true;
    this.physics.pause();
    patchHud({ talentChoices: choices, frozen: true });
  }

  pickTalent(t: Talent) {
    this.run.talents.push(t.id);
    t.apply(this.run);
    recompute(this.run);
    this.frozen = false;
    this.physics.resume();
    patchHud({ talentChoices: [], frozen: false });
    this.persist(false);
    this.syncHud();
    if (this.node?.kind === "talent" && !this.roomClear) this.clearRoom(true);
  }

  grantItem() {
    const it = rollItem(this.run.items);
    this.run.items.push(it.id);
    it.apply(this.run);
    recompute(this.run);
    patchHud({ itemToast: `${it.name} · ${it.desc}` });
    this.time.delayedCall(1600, () => {
      patchHud({ itemToast: null });
      this.clearRoom(true);
    });
    this.persist(false);
    this.syncHud();
  }

  onWaveClear() {
    if (this.waveLocal < (this.node?.kind === "elite" ? 2 : 3)) {
      this.nextWave();
      return;
    }
    this.clearRoom(true);
  }

  clearRoom(safe: boolean) {
    this.roomClear = true;
    if (this.node?.boss === "umbra") {
      this.run.won = true;
      this.persist(true);
      patchHud({ screen: "win" });
      return;
    }
    this.persist(safe);
    this.run.currentNodeId = null;
    writeSave(this.run);
    patchHud({ screen: "map", currentId: null, lastSafeId: this.run.lastSafeNodeId, mapNodes: this.run.nodes });
  }

  die() {
    this.run.dead = true;
    this.run.hp = 0;
    clearRunSave();
    patchHud({ screen: "dead", hp: 0, hasRun: false, frozen: true });
  }
}

function labelOf(n: MapNode) {
  if (n.kind === "boss" && n.boss) return BOSS_LABEL[n.boss];
  return { combat: "遭遇", elite: "精英", item: "遗物", talent: "天赋", boss: "Boss" }[n.kind];
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
    };
  }
}
