'use client';

import type { Texture, Sprite } from 'pixi.js';
import type { RoomJSON } from '../../editor/editorStore';
import type { LoadedRoom, Vec2, RuntimeDoor } from './types';
import { loadRoom } from './RoomLoader';
import { findInteractionTarget, type InteractionTarget } from './InteractionSystem';
import { drawRoom } from './PlaceholderRenderer';
import {
  dispatchAction,
  installPlaceholderActions,
  registerAction,
} from './ActionRegistry';
import {
  createCombatState,
  spawnBullet,
  tickCombat,
  type CombatState,
} from './CombatRuntime';
import { evaluateTriggers } from './TriggerSystem';
import { PLAYER_BASE_SPEED, PLAYER_BASE_HP, JOY_MAX_DIST, JOY_DEADZONE } from '../constants';

type PlayerDir =
  | 'east' | 'south-east' | 'south' | 'south-west'
  | 'west' | 'north-west' | 'north' | 'north-east';

const DIR_NAMES: PlayerDir[] = [
  'east', 'south-east', 'south', 'south-west',
  'west', 'north-west', 'north', 'north-east',
];

// angle in radians → one of 8 cardinal/ordinal directions
function dirFromAngle(angle: number): PlayerDir {
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const sector = Math.round(a / (Math.PI / 4)) % 8;
  return DIR_NAMES[sector];
}

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export interface HUDSnapshot {
  hp: number;
  maxHp: number;
  kills: number;
  spawned: number;
  cleared: boolean;
}

export interface RoomRuntimeOptions {
  debug?: boolean;
  zoom?: number;
  combat?: boolean;
  initialPlayerPos?: Vec2;  // override room.playerSpawn (e.g. preserve across navigations)
  onInteract?: (target: InteractionTarget) => void;
  onPromptChange?: (prompt: string | null) => void;
  onDoorUse?: (door: RuntimeDoor) => void;
  onPlayerDeath?: () => void;
  onRoomCleared?: () => void;
  onHUD?: (hud: HUDSnapshot) => void;
  // Fires each frame with the net corruption delta for this frame (rate * dt).
  // Void rooms: +2/s, clean rooms: -1/s, river rooms: +1/s, cave: 0
  onBiomeTick?: (delta: number) => void;
}

function biomeCorruptionRate(biome: string): number {
  if (biome.includes('void')) return 2;
  if (biome.includes('clean') || biome.includes('meadow') || biome.includes('plains')) return -1;
  if (biome.includes('river')) return 1; // corruption gain halved vs void
  return 0; // cave and unknown: neutral
}

export interface RoomRuntimeHandle {
  destroy: () => void;
  getRoom: () => LoadedRoom;
  getCombat: () => CombatState;
  getPlayerPos: () => Vec2;
  setPaused: (paused: boolean) => void;
}

export async function createRoomRuntime(
  container: HTMLDivElement,
  json: RoomJSON,
  opts: RoomRuntimeOptions = {}
): Promise<RoomRuntimeHandle> {
  const PIXI = await import('pixi.js');
  const { Application, Graphics } = PIXI;

  PIXI.TextureSource.defaultOptions.scaleMode = 'nearest';
  PIXI.AbstractRenderer.defaultOptions.roundPixels = true;

  const app = new Application();
  await app.init({
    width: container.clientWidth,
    height: container.clientHeight,
    backgroundColor: 0x0a0a14,
    antialias: false,
    roundPixels: true,
    resolution: 1,  // simple: buffer = CSS, click math stays trivial
    autoDensity: false,
  });

  container.appendChild(app.canvas);
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';
  app.canvas.style.touchAction = 'none';
  app.canvas.style.cursor = opts.combat ? 'crosshair' : 'default';

  const gfx = new Graphics();
  app.stage.addChild(gfx);

  // ---- Player sprite -------------------------------------------------------
  // Load 8-direction player stills. Existing art lives at public/sprites/player/{dir}.png.
  // If any load fails, playerTextures will be partial; PlaceholderRenderer still
  // draws a fallback circle when no sprite is available (see drawRoom).
  const playerTextures: Partial<Record<PlayerDir, Texture>> = {};
  await Promise.all(
    DIR_NAMES.map(async (dir) => {
      try {
        const tex = (await PIXI.Assets.load(`${BASE_PATH}/sprites/player/${dir}.png`)) as Texture;
        playerTextures[dir] = tex;
      } catch (e) {
        console.warn(`[room] player sprite '${dir}' failed`, e);
      }
    })
  );

  let playerSprite: Sprite | null = null;
  if (playerTextures['south']) {
    playerSprite = new PIXI.Sprite(playerTextures['south']);
    playerSprite.anchor.set(0.5, 0.5);
    playerSprite.roundPixels = true;
    app.stage.addChild(playerSprite);
  }
  let playerDir: PlayerDir = 'south';

  const room = loadRoom(json);

  // Seed placeholder handlers for interactable action IDs.
  const actionIds = new Set<string>();
  for (const i of room.interactables) actionIds.add(i.action);
  installPlaceholderActions(actionIds);

  // Built-in door action — fires onDoorUse callback if provided; else alerts.
  registerAction('__door_use', (_args, ctx) => {
    const door = ctx.door as RuntimeDoor | undefined;
    if (!door) return;
    door.consumed = true;
    if (opts.onDoorUse) {
      opts.onDoorUse(door);
    } else {
      alert(
        `[door] reward=${door.rewardTag}\nnextPool=${door.nextPool ?? '(none)'}\n\n` +
          `No onDoorUse callback wired.`
      );
    }
  });

  const startPos = opts.initialPlayerPos ?? room.playerSpawn;
  const player: Vec2 = { x: startPos.x, y: startPos.y };
  const camera = { x: player.x, y: player.y, zoom: opts.zoom ?? 1 };

  const combat = createCombatState();
  combat.player.maxHp = PLAYER_BASE_HP;
  combat.player.hp = PLAYER_BASE_HP;

  const keys = new Set<string>();
  let lastE = false;
  let currentPrompt: string | null = null;
  let paused = false;
  const mouse = { x: player.x, y: player.y };  // world coords
  let mouseDown = false;

  // Joystick state (touch input)
  let joyActive = false;
  let joyBase = { x: 0, y: 0 };
  let joyKnob = { x: 0, y: 0 };
  let joyDir = { x: 0, y: 0 };
  let roomClearedFired = false;
  let playerDeathFired = false;
  let lastHUDString = '';

  // ---- Input ---------------------------------------------------------------
  const onKeyDown = (e: KeyboardEvent) => {
    if (paused) return;
    const t = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
    if (t === 'input' || t === 'textarea' || t === 'select') return;
    keys.add(e.key.toLowerCase());
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.key.toLowerCase());
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const screenToWorld = (sx: number, sy: number) => {
    const W = app.renderer.width;
    const H = app.renderer.height;
    return {
      x: (sx - W / 2) / camera.zoom + camera.x,
      y: (sy - H / 2) / camera.zoom + camera.y,
    };
  };

  const onPointerMove = (e: PointerEvent) => {
    const rect = app.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy);
    mouse.x = w.x;
    mouse.y = w.y;
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    mouseDown = true;
    onPointerMove(e);
  };
  const onPointerUp = () => {
    mouseDown = false;
  };
  app.canvas.addEventListener('pointermove', onPointerMove);
  app.canvas.addEventListener('pointerdown', onPointerDown);
  app.canvas.addEventListener('pointerup', onPointerUp);
  app.canvas.addEventListener('pointerleave', onPointerUp);

  const onTouchStart = (e: TouchEvent) => {
    if (paused) return;
    e.preventDefault();
    const t = e.touches[0];
    const rect = app.canvas.getBoundingClientRect();
    const sx = t.clientX - rect.left;
    const sy = t.clientY - rect.top;
    joyActive = true;
    joyBase = { x: sx, y: sy };
    joyKnob = { x: sx, y: sy };
    joyDir = { x: 0, y: 0 };
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!joyActive) return;
    e.preventDefault();
    const t = e.touches[0];
    const rect = app.canvas.getBoundingClientRect();
    const sx = t.clientX - rect.left;
    const sy = t.clientY - rect.top;
    const dx = sx - joyBase.x;
    const dy = sy - joyBase.y;
    const dist = Math.hypot(dx, dy);
    if (dist < JOY_DEADZONE) {
      joyKnob = { x: sx, y: sy };
      joyDir = { x: 0, y: 0 };
      return;
    }
    const clamped = Math.min(dist, JOY_MAX_DIST);
    const nx = dx / dist;
    const ny = dy / dist;
    joyKnob = { x: joyBase.x + nx * clamped, y: joyBase.y + ny * clamped };
    joyDir = { x: nx * (clamped / JOY_MAX_DIST), y: ny * (clamped / JOY_MAX_DIST) };
  };
  const onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    joyActive = false;
    joyDir = { x: 0, y: 0 };
  };
  app.canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  app.canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  app.canvas.addEventListener('touchend', onTouchEnd, { passive: false });

  const ro = new ResizeObserver(() => {
    app.renderer.resize(container.clientWidth, container.clientHeight);
  });
  ro.observe(container);

  // ---- Tick ----------------------------------------------------------------
  const tickerFn = (t: { deltaMS: number }) => {
    const dt = Math.min(0.05, t.deltaMS / 1000);

    // Paused: render only
    if (paused) {
      drawRoom(
        gfx,
        room,
        camera,
        { w: app.renderer.width, h: app.renderer.height },
        player,
        null,
        opts.debug ?? false,
        opts.combat ? combat : null,
        opts.combat ? mouse : null
      );
      return;
    }

    // Biome corruption tick
    if (opts.onBiomeTick) {
      const rate = biomeCorruptionRate(room.biome);
      if (rate !== 0) opts.onBiomeTick(rate * dt);
    }

    // Movement
    let dx = 0;
    let dy = 0;
    if (keys.has('w') || keys.has('arrowup'))    dy -= 1;
    if (keys.has('s') || keys.has('arrowdown'))  dy += 1;
    if (keys.has('a') || keys.has('arrowleft'))  dx -= 1;
    if (keys.has('d') || keys.has('arrowright')) dx += 1;

    // Joystick overrides keyboard
    if (joyActive && Math.hypot(joyDir.x, joyDir.y) > 0.1) {
      dx = joyDir.x;
      dy = joyDir.y;
    }

    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
      playerDir = dirFromAngle(Math.atan2(dy, dx));
    }
    player.x += dx * PLAYER_BASE_SPEED * dt;
    player.y += dy * PLAYER_BASE_SPEED * dt;
    player.x = Math.max(0, Math.min(room.size.w, player.x));
    player.y = Math.max(0, Math.min(room.size.h, player.y));

    // Camera follow
    const follow = Math.min(1, dt * 6);
    camera.x += (player.x - camera.x) * follow;
    camera.y += (player.y - camera.y) * follow;

    // Combat
    if (opts.combat) {
      // Shoot on click (throttled by shootCooldown)
      if (mouseDown && combat.player.shootCooldown <= 0 && combat.player.hp > 0) {
        spawnBullet(combat, player, mouse);
        combat.player.shootCooldown = 0.18;
      }
      tickCombat(combat, dt, room, player);

      // Evaluate triggers (enter, all_enemies_dead)
      evaluateTriggers({ room, combat, player });

      // Emit HUD + clear/death events
      if (!roomClearedFired && room.cleared) {
        roomClearedFired = true;
        opts.onRoomCleared?.();
      }
      if (!playerDeathFired && combat.player.hp <= 0) {
        playerDeathFired = true;
        opts.onPlayerDeath?.();
      }
      const hud: HUDSnapshot = {
        hp: Math.max(0, combat.player.hp),
        maxHp: combat.player.maxHp,
        kills: combat.enemiesKilledTotal,
        spawned: combat.enemiesSpawnedTotal,
        cleared: room.cleared,
      };
      const hudStr = `${hud.hp}/${hud.maxHp}|${hud.kills}/${hud.spawned}|${hud.cleared}`;
      if (hudStr !== lastHUDString) {
        lastHUDString = hudStr;
        opts.onHUD?.(hud);
      }
    } else {
      // Non-combat triggers (e.g. enter-only) still evaluated
      evaluateTriggers({ room, combat, player });
    }

    // Interaction target / prompt
    const target = findInteractionTarget(room, player);
    const newPrompt = target
      ? target.kind === 'interactable'
        ? target.ref.prompt
        : `Press E: Enter — reward ${target.ref.rewardTag}`
      : null;
    if (newPrompt !== currentPrompt) {
      currentPrompt = newPrompt;
      opts.onPromptChange?.(currentPrompt);
    }

    // E press (edge-triggered)
    const eNow = keys.has('e');
    if (eNow && !lastE && target) {
      if (target.kind === 'interactable') {
        dispatchAction(target.ref.action, { room, player });
      } else {
        dispatchAction('__door_use', { room, player, door: target.ref });
      }
      opts.onInteract?.(target);
    }
    lastE = eNow;

    drawRoom(
      gfx,
      room,
      camera,
      { w: app.renderer.width, h: app.renderer.height },
      player,
      target,
      opts.debug ?? false,
      opts.combat ? combat : null,
      opts.combat ? mouse : null,
      /* drawPlayerCircle */ playerSprite === null
    );

    // Joystick overlay
    if (joyActive) {
      gfx.circle(joyBase.x, joyBase.y, 70).stroke({ color: 0xff2200, alpha: 0.18, width: 1.5 });
      gfx.circle(joyBase.x, joyBase.y, 45).stroke({ color: 0xff2200, alpha: 0.12, width: 1 });
      gfx.moveTo(joyBase.x - 70, joyBase.y).lineTo(joyBase.x + 70, joyBase.y).stroke({ color: 0xff2200, width: 0.5, alpha: 0.08 });
      gfx.moveTo(joyBase.x, joyBase.y - 70).lineTo(joyBase.x, joyBase.y + 70).stroke({ color: 0xff2200, width: 0.5, alpha: 0.08 });
      gfx.circle(joyKnob.x, joyKnob.y, 18).fill({ color: 0xff2200, alpha: 0.22 });
      gfx.circle(joyKnob.x, joyKnob.y, 18).stroke({ color: 0xff4400, alpha: 0.55, width: 2.5 });
    }

    // Position/facing of the player sprite (if loaded)
    if (playerSprite) {
      const W = app.renderer.width;
      const H = app.renderer.height;
      playerSprite.x = (player.x - camera.x) * camera.zoom + W / 2;
      playerSprite.y = (player.y - camera.y) * camera.zoom + H / 2;
      playerSprite.scale.set(camera.zoom * 2);
      const tex = playerTextures[playerDir];
      if (tex && playerSprite.texture !== tex) playerSprite.texture = tex;
      playerSprite.alpha = opts.combat && combat.player.hp <= 0 ? 0.3 : 1;
    }
  };
  app.ticker.add(tickerFn);

  return {
    getRoom: () => room,
    getCombat: () => combat,
    getPlayerPos: () => player,
    setPaused: (b: boolean) => {
      paused = b;
      if (b) {
        keys.clear();
        lastE = true;
        mouseDown = false;
        joyActive = false;
        joyDir = { x: 0, y: 0 };
      } else {
        lastE = false;
      }
    },
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      app.canvas.removeEventListener('pointermove', onPointerMove);
      app.canvas.removeEventListener('pointerdown', onPointerDown);
      app.canvas.removeEventListener('pointerup', onPointerUp);
      app.canvas.removeEventListener('pointerleave', onPointerUp);
      app.canvas.removeEventListener('touchstart', onTouchStart);
      app.canvas.removeEventListener('touchmove', onTouchMove);
      app.canvas.removeEventListener('touchend', onTouchEnd);
      ro.disconnect();
      app.ticker.remove(tickerFn);
      playerSprite?.destroy();
      // Remove ONLY our canvas (not all children) — another instance may
      // be mounted in the same container during StrictMode double-effects.
      const ourCanvas = app.canvas;
      app.destroy(true);
      if (ourCanvas && ourCanvas.parentNode === container) {
        container.removeChild(ourCanvas);
      }
    },
  };
}
