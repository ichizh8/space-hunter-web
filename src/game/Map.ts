import { type Vec2, v2, v2dist, randRange, randInt } from '../lib/math';
import {
  WORLD_W, WORLD_H, GRID_STEP,
  RIVER_COUNT, CAVE_COUNT, VOID_POOL_COUNT, OBSTACLE_COUNT,
  COL_BG, COL_GRID, COL_RIVER, COL_CAVE, COL_VOID_POOL, COL_OBSTACLE,
} from './constants';
import { Graphics } from 'pixi.js';

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

    // Player spawn — center, away from obstacles
    this.spawnPos = v2(WORLD_W / 2, WORLD_H / 2);
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
    gfx.rect(0, 0, WORLD_W, WORLD_H).fill(0x020208);

    // Stars
    for (const star of this.stars) {
      gfx.circle(star.x, star.y, star.size).fill({ color: 0xffffff, alpha: star.brightness * 0.6 });
    }

    // Scanner grid — thin red/blue lines (HAL terminal feel)
    for (let x = 0; x <= WORLD_W; x += GRID_STEP) {
      gfx.moveTo(x, 0).lineTo(x, WORLD_H).stroke({ color: 0xff2200, width: 0.5, alpha: 0.06 });
    }
    for (let y = 0; y <= WORLD_H; y += GRID_STEP) {
      gfx.moveTo(0, y).lineTo(WORLD_W, y).stroke({ color: 0xff2200, width: 0.5, alpha: 0.06 });
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
    gfx.rect(0, 0, WORLD_W, WORLD_H).stroke({ color: 0xcc2200, width: 2, alpha: 0.4 });
    gfx.rect(4, 4, WORLD_W - 8, WORLD_H - 8).stroke({ color: 0xcc2200, width: 1, alpha: 0.15 });
  }

  /** Draw dynamic elements — void pools pulsing + twinkling stars */
  drawDynamic(gfx: Graphics, time: number) {
    gfx.clear();

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
