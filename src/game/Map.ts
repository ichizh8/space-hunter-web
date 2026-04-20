import { type Vec2, v2, v2dist, randRange, randInt } from '../lib/math';
import {
  WORLD_W, WORLD_H, GRID_STEP,
  RIVER_COUNT, CAVE_COUNT, VOID_POOL_COUNT, OBSTACLE_COUNT,
  COL_BG, COL_GRID, COL_RIVER, COL_CAVE, COL_VOID_POOL, COL_OBSTACLE,
} from './constants';
import { Graphics } from 'pixi.js';
import type { RoomJSON } from '../editor/editorStore';

export interface River { points: Vec2[]; width: number }
export interface Cave { pos: Vec2; radius: number }
export interface VoidPool { pos: Vec2; radius: number; pulse: number }
export interface Obstacle { pos: Vec2; w: number; h: number; obsType: number }
export interface Star { x: number; y: number; size: number; brightness: number; twinkleSpeed: number }

export class GameMap {
  rivers: River[] = [];
  caves: Cave[] = [];
  voidPools: VoidPool[] = [];
  obstacles: Obstacle[] = [];
  stars: Star[] = [];
  spawnPos: Vec2 = v2(WORLD_W / 2, WORLD_H / 2);
  /** Active room dimensions (defaults to WORLD_W/WORLD_H for legacy mode) */
  roomW: number = WORLD_W;
  roomH: number = WORLD_H;

  generate() {
    this.rivers = [];
    this.caves = [];
    this.voidPools = [];
    this.obstacles = [];
    this.stars = [];

    // Star field — 800 stars scattered across the void
    for (let i = 0; i < 800; i++) {
      this.stars.push({
        x: randRange(0, WORLD_W),
        y: randRange(0, WORLD_H),
        size: randRange(0.5, 2.5),
        brightness: randRange(0.15, 0.8),
        twinkleSpeed: randRange(0.5, 3.0),
      });
    }

    // Rivers — flowing from one edge to another
    for (let i = 0; i < RIVER_COUNT; i++) {
      const pts: Vec2[] = [];
      const startX = randRange(400, WORLD_W - 400);
      const segs = randInt(6, 10);
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        pts.push(v2(
          startX + Math.sin(t * Math.PI * 2 + i) * randRange(200, 600),
          t * WORLD_H
        ));
      }
      this.rivers.push({ points: pts, width: randRange(40, 80) });
    }

    // Caves — dark zones
    for (let i = 0; i < CAVE_COUNT; i++) {
      this.caves.push({
        pos: v2(randRange(300, WORLD_W - 300), randRange(300, WORLD_H - 300)),
        radius: randRange(100, 200),
      });
    }

    // Void pools — corruption zones
    for (let i = 0; i < VOID_POOL_COUNT; i++) {
      this.voidPools.push({
        pos: v2(randRange(400, WORLD_W - 400), randRange(400, WORLD_H - 400)),
        radius: randRange(60, 120),
        pulse: 0,
      });
    }

    // Obstacles — solid blocks (obsType: 0=asteroid, 1=void crystal, 2=debris)
    for (let i = 0; i < OBSTACLE_COUNT; i++) {
      this.obstacles.push({
        pos: v2(randRange(100, WORLD_W - 100), randRange(100, WORLD_H - 100)),
        w: randRange(48, 96),
        h: randRange(48, 96),
        obsType: randInt(0, 2),
      });
    }

    // Player spawn — center, nudge away from obstacles if needed
    this.spawnPos = v2(WORLD_W / 2, WORLD_H / 2);
    const PLAYER_R = 18;
    let spawnFound = !this.isBlocked(this.spawnPos.x, this.spawnPos.y, PLAYER_R);
    for (let dist = 30; dist <= 300 && !spawnFound; dist += 30) {
      for (let a = 0; a < Math.PI * 2 && !spawnFound; a += Math.PI / 8) {
        const tx = WORLD_W / 2 + Math.cos(a) * dist;
        const ty = WORLD_H / 2 + Math.sin(a) * dist;
        if (!this.isBlocked(tx, ty, PLAYER_R)) {
          this.spawnPos = v2(tx, ty);
          spawnFound = true;
        }
      }
    }
  }

  /** Build map from a room JSON template instead of random generation */
  /** Scale factor applied to room JSON coordinates so rooms feel arena-sized */
  static ROOM_SCALE = 2.5;

  generateFromRoom(room: RoomJSON) {
    this.rivers = [];
    this.caves = [];
    this.voidPools = [];
    this.obstacles = [];
    this.stars = [];

    const S = GameMap.ROOM_SCALE;
    const w = (room.size?.w ?? 900) * S;
    const h = (room.size?.h ?? 700) * S;
    this.roomW = w;
    this.roomH = h;

    // Star field scaled to room size
    const starCount = Math.max(40, Math.floor((w * h) / 5000));
    for (let i = 0; i < starCount; i++) {
      this.stars.push({
        x: randRange(0, w),
        y: randRange(0, h),
        size: randRange(0.5, 2.0),
        brightness: randRange(0.15, 0.6),
        twinkleSpeed: randRange(0.5, 3.0),
      });
    }

    // Terrain from room JSON (all coords scaled)
    const terrain = room.terrain;
    if (terrain) {
      if (terrain.obstacles) {
        for (const obs of terrain.obstacles) {
          this.obstacles.push({
            pos: v2(obs.pos.x * S, obs.pos.y * S),
            w: obs.w * S,
            h: obs.h * S,
            obsType: obs.obsType ?? 0,
          });
        }
      }
      if (terrain.voidPools) {
        for (const vp of terrain.voidPools) {
          this.voidPools.push({
            pos: v2(vp.pos.x * S, vp.pos.y * S),
            radius: vp.radius * S,
            pulse: Math.random() * Math.PI * 2,
          });
        }
      }
      if (terrain.caves) {
        for (const cave of terrain.caves) {
          this.caves.push({
            pos: v2(cave.pos.x * S, cave.pos.y * S),
            radius: cave.radius * S,
          });
        }
      }
      if (terrain.rivers) {
        for (const river of terrain.rivers) {
          this.rivers.push({
            points: river.points.map((p: { x: number; y: number }) => v2(p.x * S, p.y * S)),
            width: (river.width ?? 50) * S,
          });
        }
      }
    }

    // Player spawn (scaled)
    this.spawnPos = room.playerSpawn
      ? v2(room.playerSpawn.x * S, room.playerSpawn.y * S)
      : v2(w / 2, h - 80);
  }

  /** Check if point is inside an obstacle */
  isBlocked(x: number, y: number, radius: number): boolean {
    for (const obs of this.obstacles) {
      if (x + radius > obs.pos.x - obs.w / 2 && x - radius < obs.pos.x + obs.w / 2 &&
          y + radius > obs.pos.y - obs.h / 2 && y - radius < obs.pos.y + obs.h / 2) {
        return true;
      }
    }
    return false;
  }

  /** Check if point is in river */
  isInRiver(x: number, y: number): boolean {
    for (const river of this.rivers) {
      for (let i = 0; i < river.points.length - 1; i++) {
        const a = river.points[i];
        const b = river.points[i + 1];
        // Simple distance-to-segment check
        const dx = b.x - a.x, dy = b.y - a.y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) continue;
        let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = a.x + t * dx, py = a.y + t * dy;
        const dist = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
        if (dist < river.width / 2) return true;
      }
    }
    return false;
  }

  /** Check if point is in void pool, return corruption rate */
  getVoidCorruption(x: number, y: number): number {
    for (const vp of this.voidPools) {
      if (v2dist({ x, y }, vp.pos) < vp.radius) return 1.5;
    }
    return 0;
  }

  /** Get biome type at position */
  getBiome(x: number, y: number): string {
    if (this.getVoidCorruption(x, y) > 0) return 'void_pool';
    if (this.isInRiver(x, y)) return 'river_bank';
    for (const cave of this.caves) {
      if (v2dist({ x, y }, cave.pos) < cave.radius) return 'cave';
    }
    return 'open';
  }

  /** Draw the map to a static Graphics layer — cosmic HAL 9000 aesthetic */
  drawStatic(gfx: Graphics) {
    gfx.clear();

    // Deep space background
    const W = this.roomW;
    const H = this.roomH;
    gfx.rect(0, 0, W, H).fill(0x020208);

    // ── Biome ground layers (drawn before stars so stars sit on top) ──────────

    // Cave — very dark brownish ground fill
    for (const cave of this.caves) {
      gfx.circle(cave.pos.x, cave.pos.y, cave.radius * 1.3).fill({ color: 0x080405, alpha: 0.92 });
      // Subtle rocky floor dots
      for (let d = 0; d < 18; d++) {
        const a = (d / 18) * Math.PI * 2;
        const r = cave.radius * (0.2 + (d % 5) * 0.14);
        gfx.circle(cave.pos.x + Math.cos(a) * r, cave.pos.y + Math.sin(a) * r, 2 + (d % 3)).fill({ color: 0x1a1015, alpha: 0.7 });
      }
    }

    // Void pool — dark purple ground extending beyond the active pool
    for (const vp of this.voidPools) {
      gfx.circle(vp.pos.x, vp.pos.y, vp.radius * 2.8).fill({ color: 0x0d0015, alpha: 0.8 });
      gfx.circle(vp.pos.x, vp.pos.y, vp.radius * 1.8).fill({ color: 0x180025, alpha: 0.5 });
    }

    // Stars
    for (const star of this.stars) {
      gfx.circle(star.x, star.y, star.size).fill({ color: 0xffffff, alpha: star.brightness * 0.6 });
    }

    // World grid — thin lines (HAL terminal feel)
    for (let x = 0; x <= W; x += GRID_STEP) {
      gfx.moveTo(x, 0).lineTo(x, H).stroke({ color: 0xff2200, width: 0.5, alpha: 0.06 });
    }
    for (let y = 0; y <= H; y += GRID_STEP) {
      gfx.moveTo(0, y).lineTo(W, y).stroke({ color: 0xff2200, width: 0.5, alpha: 0.06 });
    }

    // Energy rivers — glowing cyan plasma streams
    for (const river of this.rivers) {
      if (river.points.length < 2) continue;
      // River bank: tinted ground color
      gfx.moveTo(river.points[0].x, river.points[0].y);
      for (let i = 1; i < river.points.length; i++) gfx.lineTo(river.points[i].x, river.points[i].y);
      gfx.stroke({ color: 0x0088ff, width: river.width * 2.5, alpha: 0.08 });
      // Outer glow
      gfx.moveTo(river.points[0].x, river.points[0].y);
      for (let i = 1; i < river.points.length; i++) {
        gfx.lineTo(river.points[i].x, river.points[i].y);
      }
      gfx.stroke({ color: 0x0044aa, width: river.width * 1.3, alpha: 0.15 });
      // Core
      gfx.moveTo(river.points[0].x, river.points[0].y);
      for (let i = 1; i < river.points.length; i++) {
        gfx.lineTo(river.points[i].x, river.points[i].y);
      }
      gfx.stroke({ color: 0x1155cc, width: river.width * 0.6, alpha: 0.35 });
    }

    // Dark matter caves — deep black with crystal highlights
    for (const cave of this.caves) {
      gfx.circle(cave.pos.x, cave.pos.y, cave.radius * 1.35).fill({ color: 0x050010, alpha: 0.55 });
      gfx.circle(cave.pos.x, cave.pos.y, cave.radius).fill({ color: 0x010003, alpha: 0.92 });
      gfx.circle(cave.pos.x, cave.pos.y, cave.radius).stroke({ color: 0x4400aa, width: 2, alpha: 0.5 });
      // Crystal sparkle dots
      for (let c = 0; c < 8; c++) {
        const cAngle = (c / 8) * Math.PI * 2;
        const cDist = cave.radius * (0.4 + Math.random() * 0.5);
        gfx.circle(cave.pos.x + Math.cos(cAngle) * cDist, cave.pos.y + Math.sin(cAngle) * cDist, 2 + Math.random() * 2).fill({ color: 0x8844ff, alpha: 0.4 + Math.random() * 0.3 });
      }
    }

    // Void pools static: dark corruption ground stain
    for (const vp of this.voidPools) {
      gfx.circle(vp.pos.x, vp.pos.y, vp.radius * 2.0).fill({ color: 0x0a0018, alpha: 0.7 });
      gfx.circle(vp.pos.x, vp.pos.y, vp.radius * 1.5).fill({ color: 0x050010, alpha: 0.85 });
    }

    // Obstacles drawn as sprites in Game.ts obstacleLayer

    // World boundary — red containment field
    gfx.rect(0, 0, W, H).stroke({ color: 0xcc2200, width: 2, alpha: 0.4 });
    gfx.rect(4, 4, W - 8, H - 8).stroke({ color: 0xcc2200, width: 1, alpha: 0.15 });
  }

  /** Draw dynamic elements — void pools pulsing + twinkling stars + biome particles */
  drawDynamic(gfx: Graphics, time: number, _px = 0, _py = 0) {
    gfx.clear();

    // ── Biome particles ───────────────────────────────────────────────────────

    // OPEN — dust motes drifting slowly (deterministic virtual particles)
    const W = this.roomW;
    const H = this.roomH;
    const moteCount = Math.max(20, Math.floor(240 * (W * H) / (4800 * 4800)));
    for (let i = 0; i < moteCount; i++) {
      const bx = (i * 157.31 + 80) % W;
      const by = (i * 211.73 + 80) % H;
      if (this.getBiome(bx, by) !== 'open') continue;
      const ox = Math.sin(time * 0.4 + i * 2.71) * 10;
      const oy = Math.cos(time * 0.35 + i * 1.41) * 10;
      const alpha = 0.12 + Math.sin(time * 1.8 + i * 0.9) * 0.08;
      gfx.circle(bx + ox, by + oy, 0.8 + (i % 3) * 0.35).fill({ color: 0xb8b8d8, alpha });
    }

    // RIVER BANK — animated wavy horizontal lines + blue mist particles
    for (const river of this.rivers) {
      if (river.points.length < 2) continue;
      // 3 wavy overlay lines per river, shifting with time
      for (let w = 0; w < 3; w++) {
        const sideOffset = (w - 1) * river.width * 0.28;
        const phase = time * (0.9 + w * 0.25) + w * 1.3;
        gfx.moveTo(river.points[0].x + sideOffset + Math.sin(phase) * 5, river.points[0].y);
        for (let j = 1; j < river.points.length; j++) {
          const t = j / (river.points.length - 1);
          const wx = river.points[j].x + sideOffset + Math.sin(phase + t * Math.PI * 3.5) * 9;
          gfx.lineTo(wx, river.points[j].y);
        }
        gfx.stroke({ color: 0x3388ff, width: 1.5, alpha: 0.15 + w * 0.06 });
      }
      // Blue mist particles drifting along river
      for (let m = 0; m < 18; m++) {
        const t = (m / 18 + time * 0.018) % 1;
        const si = Math.floor(t * (river.points.length - 1));
        const st = t * (river.points.length - 1) - si;
        const ra = river.points[si], rb = river.points[Math.min(si + 1, river.points.length - 1)];
        const mx = ra.x + (rb.x - ra.x) * st + Math.sin(time * 1.8 + m * 1.7) * river.width * 0.38;
        const my = ra.y + (rb.y - ra.y) * st + Math.cos(time * 1.3 + m * 2.1) * river.width * 0.28;
        const ma = 0.2 + Math.sin(time * 2.5 + m) * 0.12;
        gfx.circle(mx, my, 2 + (m % 4) * 0.7).fill({ color: 0x55bbff, alpha: ma });
      }
    }

    // CAVE — crystal sparkle particles
    for (const cave of this.caves) {
      for (let c = 0; c < 16; c++) {
        const angle = (c / 16) * Math.PI * 2 + c * 0.3;
        const r = cave.radius * (0.25 + (c % 5) * 0.12);
        const cx = cave.pos.x + Math.cos(angle) * r;
        const cy = cave.pos.y + Math.sin(angle) * r;
        const sparkle = 0.5 + Math.sin(time * (1.8 + c * 0.6) + c * 1.7) * 0.5;
        if (sparkle < 0.45) continue;
        const sz = 1 + sparkle * 1.8;
        gfx.circle(cx, cy, sz).fill({ color: 0x99ddff, alpha: sparkle * 0.55 });
        gfx.moveTo(cx - sz * 2.5, cy).lineTo(cx + sz * 2.5, cy)
          .stroke({ color: 0xbbeeff, width: 0.5, alpha: sparkle * 0.35 });
        gfx.moveTo(cx, cy - sz * 2.5).lineTo(cx, cy + sz * 2.5)
          .stroke({ color: 0xbbeeff, width: 0.5, alpha: sparkle * 0.35 });
      }
    }

    // VOID POOL — purple corruption particles floating upward
    for (const vp of this.voidPools) {
      for (let p = 0; p < 22; p++) {
        const angle = (p / 22) * Math.PI * 2 + p * 0.19;
        const baseR = (p % 5 + 1) * (vp.radius * 0.17);
        // Upward drift: each particle cycles from bottom to top of the pool
        const upCycle = ((time * (8 + p * 2.5) + p * 13.7) % (vp.radius * 2)) - vp.radius;
        const vx = vp.pos.x + Math.cos(angle) * baseR + Math.sin(time * 1.2 + p * 0.8) * 6;
        const vy = vp.pos.y + Math.sin(angle) * baseR * 0.5 - upCycle * 0.55;
        if (Math.hypot(vx - vp.pos.x, vy - vp.pos.y) > vp.radius * 1.15) continue;
        const pa = 0.28 + Math.sin(time * 2.2 + p * 1.1) * 0.18;
        gfx.circle(vx, vy, 1.5 + (p % 3) * 0.8).fill({ color: 0x9933ff, alpha: pa });
      }
    }

    // Void pools — pulsing red/purple singularities (HAL's eye)
    for (const vp of this.voidPools) {
      const pulse = 1 + Math.sin(time * 2 + vp.pulse) * 0.2;
      // Outer radiation
      gfx.circle(vp.pos.x, vp.pos.y, vp.radius * pulse * 1.4).fill({ color: 0x330011, alpha: 0.15 });
      // Mid ring
      gfx.circle(vp.pos.x, vp.pos.y, vp.radius * pulse).fill({ color: 0x440022, alpha: 0.3 });
      // Red core ring (HAL eye effect)
      gfx.circle(vp.pos.x, vp.pos.y, vp.radius * pulse * 0.5).stroke({ color: 0xff2200, width: 2, alpha: 0.6 + Math.sin(time * 3) * 0.2 });
      // Inner glow
      gfx.circle(vp.pos.x, vp.pos.y, vp.radius * pulse * 0.25).fill({ color: 0xff3300, alpha: 0.4 });
    }

    // Twinkle some stars
    for (let i = 0; i < this.stars.length; i += 5) {
      const s = this.stars[i];
      const twinkle = 0.3 + Math.sin(time * s.twinkleSpeed + i) * 0.3;
      gfx.circle(s.x, s.y, s.size * 1.5).fill({ color: 0xffffff, alpha: twinkle * 0.3 });
    }

    // Cave sparkle particles — random crystals flicker
    for (const cave of this.caves) {
      const sparkCount = 6;
      for (let s = 0; s < sparkCount; s++) {
        const sparkAngle = (s / sparkCount) * Math.PI * 2 + time * 0.3;
        const sparkDist = cave.radius * (0.3 + (Math.sin(time * 2.1 + s * 1.7) * 0.5 + 0.5) * 0.6);
        const sparkAlpha = 0.15 + Math.sin(time * 3 + s * 2.3) * 0.15;
        gfx.circle(
          cave.pos.x + Math.cos(sparkAngle) * sparkDist,
          cave.pos.y + Math.sin(sparkAngle) * sparkDist,
          2
        ).fill({ color: 0xaa66ff, alpha: sparkAlpha });
      }
    }

    // River bank: animated wavy blue shimmer lines
    for (const river of this.rivers) {
      if (river.points.length < 2) continue;
      const waveOffset = Math.sin(time * 1.5) * 8;
      gfx.moveTo(river.points[0].x, river.points[0].y + waveOffset);
      for (let i = 1; i < river.points.length; i++) {
        const wave = Math.sin(time * 2 + i * 0.8) * 6;
        gfx.lineTo(river.points[i].x, river.points[i].y + wave);
      }
      gfx.stroke({ color: 0x44aaff, width: 3, alpha: 0.12 + Math.sin(time * 1.8) * 0.05 });
    }
  }
}
