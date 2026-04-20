import type * as PIXI from 'pixi.js';
import type { LoadedRoom, Vec2 } from './types';
import type { InteractionTarget } from './InteractionSystem';
import type { CombatState } from './CombatRuntime';
import {
  COL_BG,
  COL_GRID,
  COL_CAVE,
  COL_VOID_POOL,
  COL_OBSTACLE,
  GRID_STEP,
  PLAYER_RADIUS,
  PLAYER_COLOR,
} from '../constants';

const COL_INTER    = 0xffcc00;
const COL_DOOR     = 0x44ccff;
const COL_DOOR_LOCK = 0x556677;
const COL_SPAWN    = 0xff6644;
const COL_TRIGGER  = 0xffaa44;
const COL_HILIGHT  = 0xffffff;

export interface RenderCamera {
  x: number;
  y: number;
  zoom: number;
}

export interface Screen {
  w: number;
  h: number;
}

// Draws the full room in immediate-mode into a single PIXI.Graphics.
// No text rendering yet — labels live on the prompt UI above the canvas.
//
// `drawPlayerCircle` is a fallback: when RoomRuntime could not load the
// player Sprite, we draw a cyan circle here so the player is still visible.
export function drawRoom(
  gfx: PIXI.Graphics,
  room: LoadedRoom,
  camera: RenderCamera,
  screen: Screen,
  player: Vec2,
  target: InteractionTarget | null,
  debug: boolean,
  combat: CombatState | null = null,
  mouse: Vec2 | null = null,
  drawPlayerCircle: boolean = true
): void {
  const { w: W, h: H } = screen;

  gfx.clear();
  gfx.rect(0, 0, W, H).fill(COL_BG);

  const toS = (wx: number, wy: number) => ({
    sx: (wx - camera.x) * camera.zoom + W / 2,
    sy: (wy - camera.y) * camera.zoom + H / 2,
  });
  const r2s = (r: number) => r * camera.zoom;

  // Grid
  const wl = (0 - W / 2) / camera.zoom + camera.x;
  const wt = (0 - H / 2) / camera.zoom + camera.y;
  const wr = (W - W / 2) / camera.zoom + camera.x;
  const wb = (H - H / 2) / camera.zoom + camera.y;
  const startGX = Math.floor(wl / GRID_STEP) * GRID_STEP;
  const startGY = Math.floor(wt / GRID_STEP) * GRID_STEP;

  gfx.setStrokeStyle({ width: 1, color: COL_GRID, alpha: 0.3 });
  for (let gx = startGX; gx <= wr; gx += GRID_STEP) {
    const { sx } = toS(gx, 0);
    gfx.moveTo(sx, 0).lineTo(sx, H).stroke();
  }
  for (let gy = startGY; gy <= wb; gy += GRID_STEP) {
    const { sy } = toS(0, gy);
    gfx.moveTo(0, sy).lineTo(W, sy).stroke();
  }

  // Room boundary
  const { sx: bx1, sy: by1 } = toS(0, 0);
  const { sx: bx2, sy: by2 } = toS(room.size.w, room.size.h);
  gfx.rect(bx1, by1, bx2 - bx1, by2 - by1).stroke({ width: 2, color: 0x334455, alpha: 0.8 });

  // Caves
  for (const c of room.terrain.caves) {
    const { sx, sy } = toS(c.pos.x, c.pos.y);
    gfx.circle(sx, sy, r2s(c.radius)).fill({ color: COL_CAVE, alpha: 0.85 });
  }
  // Void pools
  for (const v of room.terrain.voidPools) {
    const { sx, sy } = toS(v.pos.x, v.pos.y);
    gfx.circle(sx, sy, r2s(v.radius)).fill({ color: COL_VOID_POOL, alpha: 0.85 });
  }
  // Obstacles
  for (const o of room.terrain.obstacles) {
    const { sx, sy } = toS(o.x, o.y);
    gfx.rect(sx, sy, r2s(o.w), r2s(o.h)).fill({ color: COL_OBSTACLE, alpha: 0.9 });
  }

  // Debug overlays for zones (invisible at runtime when debug false)
  if (debug) {
    for (const sz of room.spawnZones) {
      const { sx, sy } = toS(sz.rect.x, sz.rect.y);
      gfx
        .rect(sx, sy, r2s(sz.rect.w), r2s(sz.rect.h))
        .stroke({ width: 1, color: COL_SPAWN, alpha: 0.5 });
    }
    for (const tr of room.triggers) {
      if (!tr.rect) continue;
      const { sx, sy } = toS(tr.rect.x, tr.rect.y);
      gfx
        .rect(sx, sy, r2s(tr.rect.w), r2s(tr.rect.h))
        .stroke({ width: 1, color: COL_TRIGGER, alpha: tr.fired ? 0.2 : 0.5 });
    }
  }

  // Interactables
  for (const e of room.interactables) {
    const { sx, sy } = toS(e.pos.x, e.pos.y);
    const r = r2s(e.radius);
    gfx.circle(sx, sy, r).fill({ color: COL_INTER, alpha: 0.2 });
    gfx.circle(sx, sy, r).stroke({ width: 1.5, color: COL_INTER, alpha: 0.85 });
    gfx.circle(sx, sy, r2s(6)).fill({ color: COL_INTER, alpha: 1 });
    if (target && target.kind === 'interactable' && target.ref.id === e.id) {
      gfx.circle(sx, sy, r + 4).stroke({ width: 2, color: COL_HILIGHT, alpha: 0.9 });
    }
  }

  // Doors (drawn as diamonds)
  for (const d of room.doors) {
    if (d.consumed) continue;
    const { sx, sy } = toS(d.pos.x, d.pos.y);
    const r = r2s(d.radius);
    const locked = d.requiresCleared && !room.cleared;
    const color = locked ? COL_DOOR_LOCK : COL_DOOR;
    gfx
      .moveTo(sx, sy - r)
      .lineTo(sx + r, sy)
      .lineTo(sx, sy + r)
      .lineTo(sx - r, sy)
      .closePath()
      .fill({ color, alpha: locked ? 0.2 : 0.4 })
      .stroke({ width: 1.5, color, alpha: 0.95 });
    if (target && target.kind === 'door' && target.ref.id === d.id) {
      gfx.circle(sx, sy, r + 6).stroke({ width: 2, color: COL_HILIGHT, alpha: 0.9 });
    }
  }

  // Enemies (behind player so they can be shot through)
  if (combat) {
    for (const e of combat.enemies) {
      const { sx, sy } = toS(e.pos.x, e.pos.y);
      const r = r2s(e.radius);
      gfx.circle(sx, sy, r).fill({ color: e.color, alpha: 0.9 });
      gfx.circle(sx, sy, r).stroke({ width: 1.5, color: 0x000000, alpha: 0.6 });
      // HP bar
      if (e.hp < e.maxHp) {
        const barW = Math.max(20, r2s(e.radius * 1.6));
        const barH = 3;
        const frac = Math.max(0, e.hp / e.maxHp);
        gfx.rect(sx - barW / 2, sy - r - 8, barW, barH).fill({ color: 0x442222, alpha: 0.9 });
        gfx.rect(sx - barW / 2, sy - r - 8, barW * frac, barH).fill({ color: 0x33e633, alpha: 1 });
      }
    }
    // Bullets
    for (const b of combat.bullets) {
      const { sx, sy } = toS(b.pos.x, b.pos.y);
      gfx.circle(sx, sy, r2s(b.radius)).fill({ color: 0xe6cc33, alpha: 1 });
    }
  }

  // Player (fallback circle; real sprite is drawn by RoomRuntime when loaded)
  if (drawPlayerCircle) {
    const { sx: px, sy: py } = toS(player.x, player.y);
    gfx.circle(px, py, r2s(PLAYER_RADIUS)).fill({ color: PLAYER_COLOR, alpha: 1 });
  }

  // Mouse reticle (only in combat mode)
  if (combat && mouse) {
    const { sx: mx, sy: my } = toS(mouse.x, mouse.y);
    const rr = 10;
    gfx
      .circle(mx, my, rr).stroke({ width: 1, color: 0xffffff, alpha: 0.6 })
      .moveTo(mx - rr - 4, my).lineTo(mx - rr + 2, my).stroke({ width: 1, color: 0xffffff, alpha: 0.6 })
      .moveTo(mx + rr - 2, my).lineTo(mx + rr + 4, my).stroke({ width: 1, color: 0xffffff, alpha: 0.6 })
      .moveTo(mx, my - rr - 4).lineTo(mx, my - rr + 2).stroke({ width: 1, color: 0xffffff, alpha: 0.6 })
      .moveTo(mx, my + rr - 2).lineTo(mx, my + rr + 4).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
  }
}
