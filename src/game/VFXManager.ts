import { Sprite } from 'pixi.js';
import { v2len, v2dist, v2fromAngle } from '../lib/math';
import type { Enemy } from './Enemies';
import type { Game } from './Game';

const CREATURE_SPRITE_MAP: Record<string, string> = {
  'Void Leech': 'void_leech',
  'Shadow Crawler': 'shadow_crawler',
  'Abyss Worm': 'abyss_worm',
  'Nether Stalker': 'nether_stalker',
  'Rift Parasite': 'rift_parasite',
  'Cave Lurker': 'cave_lurker',
  'Tide Wraith': 'tide_wraith',
  'Void Spawn': 'void_spawn',
};

export const DIR_NAMES = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'] as const;

function angleTo8Dir(vx: number, vy: number): string {
  if (vx === 0 && vy === 0) return 'south';
  const angle = Math.atan2(vy, vx);
  const norm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const sector = Math.round(norm / (Math.PI / 4)) % 8;
  return DIR_NAMES[sector];
}

export const SPRITES_WITH_DIRS = ['player', 'void_leech', 'shadow_crawler', 'abyss_worm', 'nether_stalker', 'cave_lurker', 'tide_wraith'];

const BEHAVIOR_COLORS: Record<string, number> = {
  charge: 0xFF3333, flank: 0xFF8800, pack: 0x33FF33,
  lurker: 0xAA44FF, burst: 0xFFFF00, strafe: 0x00FFFF, patrol_river: 0x888888,
  mine_crawler: 0xcc7722, sentry_drone: 0xff9933, tide_phantom: 0x22ccbb, coral_spitter: 0x33aacc,
  void_weaver: 0xaa44ff, phase_stalker: 0xdd22ff,
  slag_brute: 0xff5500, cinder_wasp: 0xffaa00,
};

function subtleTint(color: number, strength: number): number {
  const r = Math.round(0xFF + ((color >> 16 & 0xFF) - 0xFF) * strength);
  const g = Math.round(0xFF + ((color >> 8  & 0xFF) - 0xFF) * strength);
  const b = Math.round(0xFF + ((color        & 0xFF) - 0xFF) * strength);
  return (r << 16) | (g << 8) | b;
}

export class VFXManager {
  updateEffects(dt: number, game: Game): void {
    // Process elite charge impacts: screen shake + scorch mark + explosion particles
    for (const impactPos of game.enemies._pendingImpacts) {
      game.shakeTimer = 0.3;
      game.shakeAmt = 6;
      game.scorchMarks.push({ x: impactPos.x, y: impactPos.y, life: 3.0, maxLife: 3.0 });
      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 120;
        game.particles.push({ x: impactPos.x, y: impactPos.y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, life: 0.5, maxLife: 0.5, color: 0xff6600, radius: 4 + Math.random() * 4 });
      }
    }
    game.enemies._pendingImpacts = [];

    // Update scorch marks
    for (let i = game.scorchMarks.length - 1; i >= 0; i--) {
      game.scorchMarks[i].life -= dt;
      if (game.scorchMarks[i].life <= 0) game.scorchMarks.splice(i, 1);
    }
    game.shakeTimer = Math.max(0, game.shakeTimer - dt);

    // Behavior trail particles
    if (game.particles.length < 600) {
      for (const e of game.enemies.enemies) {
        if (e.hp <= 0 || !e.isAggroed) continue;
        const spd = v2len(e.vel);
        switch (e.behavior) {
          case 'charge':
            // Red trail when rushing (phase 2)
            if ((e.phase as number) === 2 && spd > 20) {
              for (let i = 0; i < 3; i++) {
                game.particles.push({ x: e.pos.x + (Math.random()-0.5)*6, y: e.pos.y + (Math.random()-0.5)*6, vx: -e.vel.x*0.15 + (Math.random()-0.5)*20, vy: -e.vel.y*0.15 + (Math.random()-0.5)*20, life: 0.35, maxLife: 0.35, color: 0xff3333, radius: 3 + Math.random()*2 });
              }
            }
            break;
          case 'flank':
            // Orange ghost particles when moving
            if (spd > 30 && Math.random() < 0.4) {
              game.particles.push({ x: e.pos.x, y: e.pos.y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 0.25, maxLife: 0.25, color: 0xff8800, radius: 4 });
            }
            break;
          case 'pack':
            // Green motes floating upward
            if (Math.random() < 0.25) {
              game.particles.push({ x: e.pos.x + (Math.random()-0.5)*e.radius, y: e.pos.y + (Math.random()-0.5)*e.radius, vx: (Math.random()-0.5)*10, vy: -15 - Math.random()*15, life: 0.6, maxLife: 0.6, color: 0x33ff33, radius: 2 });
            }
            break;
          case 'lurker':
            // Dark mist
            if (Math.random() < 0.35) {
              game.particles.push({ x: e.pos.x + (Math.random()-0.5)*e.radius*2, y: e.pos.y + (Math.random()-0.5)*e.radius*2, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, life: 0.8, maxLife: 0.8, color: 0x440066, radius: 5 + Math.random()*3 });
            }
            break;
          case 'burst':
            // Yellow sparks when dashing
            if (e.burstActive && spd > 40) {
              for (let i = 0; i < 2; i++) {
                game.particles.push({ x: e.pos.x + (Math.random()-0.5)*8, y: e.pos.y + (Math.random()-0.5)*8, vx: (Math.random()-0.5)*50, vy: (Math.random()-0.5)*50, life: 0.2, maxLife: 0.2, color: 0xffee00, radius: 3 + Math.random()*2 });
              }
            }
            break;
          case 'strafe':
            // Cyan smoke arc
            if (spd > 20 && Math.random() < 0.45) {
              game.particles.push({ x: e.pos.x + (Math.random()-0.5)*e.radius, y: e.pos.y + (Math.random()-0.5)*e.radius, vx: -e.vel.x*0.1, vy: -e.vel.y*0.1, life: 0.3, maxLife: 0.3, color: 0x00ccff, radius: 3 });
            }
            break;
          case 'elite':
            // Bright trail during long-range charge (phase 31)
            if ((e.phase as number) === 31) {
              for (let i = 0; i < 4; i++) {
                game.particles.push({ x: e.pos.x + (Math.random()-0.5)*e.radius, y: e.pos.y + (Math.random()-0.5)*e.radius, vx: -e.vel.x*0.08 + (Math.random()-0.5)*30, vy: -e.vel.y*0.08 + (Math.random()-0.5)*30, life: 0.2, maxLife: 0.2, color: 0xffcc00, radius: 5 + Math.random()*4 });
              }
            }
            break;
          case 'sentry_drone':
            // Orange spark trail when flying at speed
            if (e.phase === 0 && spd > 60) {
              game.particles.push({ x: e.pos.x, y: e.pos.y, vx: -e.vel.x*0.12 + (Math.random()-0.5)*20, vy: -e.vel.y*0.12 + (Math.random()-0.5)*20, life: 0.18, maxLife: 0.18, color: 0xff9933, radius: 2 + Math.random()*2 });
            }
            break;
          case 'tide_phantom':
            // Teal shimmer while invisible (phase 1)
            if (e.phase === 1 && Math.random() < 0.5) {
              game.particles.push({ x: e.pos.x + (Math.random()-0.5)*e.radius*2, y: e.pos.y + (Math.random()-0.5)*e.radius*2, vx: (Math.random()-0.5)*12, vy: -8 - Math.random()*12, life: 0.5, maxLife: 0.5, color: 0x22ccbb, radius: 3 });
            }
            break;
          case 'void_weaver':
            // Purple void motes orbiting the weaver
            if (Math.random() < 0.35) {
              const a = Math.random() * Math.PI * 2;
              game.particles.push({ x: e.pos.x + Math.cos(a)*e.radius*1.5, y: e.pos.y + Math.sin(a)*e.radius*1.5, vx: Math.cos(a+1.5)*25, vy: Math.sin(a+1.5)*25, life: 0.6, maxLife: 0.6, color: 0xaa44ff, radius: 2.5 });
            }
            break;
          case 'phase_stalker':
            // Magenta trail while phased out
            if (e.phase === 1 && Math.random() < 0.6) {
              game.particles.push({ x: e.pos.x + (Math.random()-0.5)*e.radius, y: e.pos.y + (Math.random()-0.5)*e.radius, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, life: 0.35, maxLife: 0.35, color: 0xdd22ff, radius: 2 + Math.random()*2 });
            }
            break;
          case 'slag_brute':
            // Heat shimmer + embers rising; molten rage (<30% HP) = more intense
            if (Math.random() < (e.hp < e.maxHp * 0.3 ? 0.7 : 0.3)) {
              game.particles.push({ x: e.pos.x + (Math.random()-0.5)*e.radius*1.5, y: e.pos.y + (Math.random()-0.5)*e.radius, vx: (Math.random()-0.5)*10, vy: -15 - Math.random()*20, life: 0.5, maxLife: 0.5, color: e.hp < e.maxHp * 0.3 ? 0xff2200 : 0xff6600, radius: 2 + Math.random()*3 });
            }
            // Wind-up telegraph: bright ring pulse during phase 1
            if (e.phase === 1 && Math.random() < 0.8) {
              const a = Math.random() * Math.PI * 2;
              game.particles.push({ x: e.pos.x + Math.cos(a)*e.radius*2, y: e.pos.y + Math.sin(a)*e.radius*2, vx: Math.cos(a)*30, vy: Math.sin(a)*30, life: 0.3, maxLife: 0.3, color: 0xff4400, radius: 4 });
            }
            break;
          case 'cinder_wasp':
            // Amber spark trail when dashing (phase 0)
            if (e.phase === 0 && spd > 60 && Math.random() < 0.5) {
              game.particles.push({ x: e.pos.x, y: e.pos.y, vx: -e.vel.x*0.1 + (Math.random()-0.5)*15, vy: -e.vel.y*0.1 + (Math.random()-0.5)*15, life: 0.2, maxLife: 0.2, color: 0xffaa00, radius: 2 + Math.random()*2 });
            }
            // Aim glow when hovering (phase 1)
            if (e.phase === 1 && Math.random() < 0.4) {
              game.particles.push({ x: e.pos.x + (Math.random()-0.5)*6, y: e.pos.y + (Math.random()-0.5)*6, vx: 0, vy: 0, life: 0.15, maxLife: 0.15, color: 0xffcc00, radius: 3 });
            }
            break;
        }
      }
    }

    // Update particles
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.life -= dt;
      if (p.life <= 0) { game.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // Biome ambient particles
    game.biomeParticleTimer -= dt;
    if (game.biomeParticleTimer <= 0 && game.particles.length < 600) {
      game.biomeParticleTimer = 0.05;
      const biome = game.map.getBiome(game.player.pos.x, game.player.pos.y);
      const px = game.player.pos.x, py = game.player.pos.y;
      if (biome === 'cave') {
        for (let i = 0; i < 4; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 80 + Math.random() * 120;
          game.particles.push({ x: px + Math.cos(angle)*dist, y: py + Math.sin(angle)*dist, vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5, life: 2.0, maxLife: 2.0, color: 0x110033, radius: 6 + Math.random()*4 });
        }
      } else if (biome === 'void_pool') {
        for (let i = 0; i < 3; i++) {
          game.particles.push({ x: px + (Math.random()-0.5)*200, y: py + 80 + Math.random()*80, vx: (Math.random()-0.5)*10, vy: -20 - Math.random()*25, life: 1.5, maxLife: 1.5, color: 0x6600aa, radius: 3 + Math.random()*3 });
        }
      } else if (biome === 'river_bank') {
        for (let i = 0; i < 2; i++) {
          game.particles.push({ x: px + (Math.random()-0.5)*150, y: py + (Math.random()-0.5)*150, vx: (Math.random()-0.5)*12, vy: -8 - Math.random()*10, life: 1.2, maxLife: 1.2, color: 0x2244ff, radius: 2 + Math.random()*2 });
        }
      }
    }

  }

  getOrCreateEnemySprite(enemy: Enemy, game: Game): Sprite | null {
    const texBase = CREATURE_SPRITE_MAP[enemy.name];
    if (!texBase) return null;
    const dir = angleTo8Dir(enemy.vel.x, enemy.vel.y);
    const dirKey = `${texBase}/${dir}`;
    const fallbackKey = `${texBase}/south`;
    const singleKey = texBase;
    const tex = game.textures[dirKey] || game.textures[fallbackKey] || game.textures[singleKey];
    if (!tex) return null;

    if (game.spritePool.has(enemy.id)) {
      const spr = game.spritePool.get(enemy.id)!;
      spr.texture = tex;
      return spr;
    }

    const spr = new Sprite(tex);
    spr.anchor.set(0.5, 0.5);
    spr.scale.set(2);
    spr.roundPixels = true;
    game.spriteLayer.addChild(spr);
    game.spritePool.set(enemy.id, spr);
    return spr;
  }

  cleanupDeadSprites(game: Game): void {
    const alive = new Set(game.enemies.enemies.map(e => e.id));
    for (const [id, spr] of game.spritePool) {
      if (!alive.has(id)) {
        game.spriteLayer.removeChild(spr);
        spr.destroy();
        game.spritePool.delete(id);
      }
    }
  }

  updateSprites(game: Game): void {
    const isMoving = Math.abs(game.player.vel.x) > 5 || Math.abs(game.player.vel.y) > 5;

    // Player sprite
    if (game.playerSprite) {
      game.playerSprite.x = game.player.pos.x;
      game.playerSprite.y = game.player.pos.y;
      game.playerSprite.alpha = game.player.iFrames > 0 ? 0.4 : 1;
      game.playerSprite.rotation = 0;

      let dir: string;
      if (isMoving) {
        dir = angleTo8Dir(game.player.vel.x, game.player.vel.y);
      } else if (game.player.nearestEnemyPos) {
        dir = angleTo8Dir(game.player.nearestEnemyPos.x - game.player.pos.x, game.player.nearestEnemyPos.y - game.player.pos.y);
      } else {
        dir = 'south';
      }

      if (isMoving) {
        const animTex = game.textures[`player/anim/${dir}/${game.animFrame % 6}`];
        if (animTex) game.playerSprite.texture = animTex;
        else {
          const still = game.textures[`player/${dir}`];
          if (still) game.playerSprite.texture = still;
        }
      } else {
        const still = game.textures[`player/${dir}`];
        if (still) game.playerSprite.texture = still;
      }
      game.playerSprite.tint = game.player.hitFlash > 0 ? 0xff2200 : 0xffffff;
    }

    // Behavior tints for sprites (subtle: 30% toward behavior color)
    const SPRITE_BEHAVIOR_TINTS: Record<string, number> = {
      charge: 0xFF3333, flank: 0xFF8800, pack: 0x33FF33,
      lurker: 0xAA44FF, burst: 0xFFFF00, strafe: 0x00FFFF,
    };

    // Enemy sprites
    for (const e of game.enemies.enemies) {
      const spr = this.getOrCreateEnemySprite(e, game);
      if (!spr) continue;
      spr.x = e.pos.x;
      spr.y = e.pos.y;
      spr.visible = game.camera.isVisible(e.pos.x, e.pos.y, e.radius * 2);
      const rawTint = e.isAlly ? 0x33ffaa : (SPRITE_BEHAVIOR_TINTS[e.behavior] ?? 0xffffff);
      const behaviorTint = subtleTint(rawTint, e.isAlly ? 0.65 : 0.3);
      spr.tint = e.hitFlash > 0 ? 0xff4444 : behaviorTint;

      if (!e.isAlly) spr.scale.set(1);

      // Lurker: semi-transparent + flicker every 2s
      if (e.isAlly) {
        spr.alpha = 0.95;
        spr.scale.set(1.15);
      } else if (e.behavior === 'lurker') {
        const lurkerDormant = (e.phase as number) === 0;
        const flicker = Math.floor(game.elapsed / 2) % 2 === 0 ? 1.0 : 0.6;
        spr.alpha = lurkerDormant ? 0.3 * flicker : 0.5 * flicker;
      } else {
        spr.alpha = 1;
      }

      // Scale up apex enemy sprite
      if (e.id === game.apexId) {
        spr.scale.set(3.5);
        const apexAuraColor = game.apexPhase === 3 ? 0x9900cc : game.apexPhase === 2 ? 0xff8800 : 0xff3300;
        spr.tint = e.hitFlash > 0 ? 0xff4444 : subtleTint(apexAuraColor, 0.3);
        spr.alpha = game.apexPhaseTransitionTimer > 0 ? 0.5 + Math.sin(game.elapsed * 20) * 0.5 : 1;
      }

      const eMoving = Math.abs(e.vel.x) > 3 || Math.abs(e.vel.y) > 3;
      const texBase = CREATURE_SPRITE_MAP[e.name];
      if (texBase && eMoving) {
        const dir = angleTo8Dir(e.vel.x, e.vel.y);
        const animTex = game.textures[`${texBase}/anim/${dir}/${game.animFrame % 4}`];
        if (animTex) spr.texture = animTex;
      }
    }
  }

  drawBiomeVignette(game: Game): void {
    // Disabled: vignette rendering was blacking out the entire screen.
    // TODO: fix fill-then-cut layering before re-enabling.
    game.biomeGfx.clear();
  }

  drawEntities(game: Game): void {
    const g = game.entityGfx;
    g.clear();
    const px = game.player.pos.x, py = game.player.pos.y, pr = game.player.radius;
    const pAlpha = game.player.iFrames > 0 ? 0.4 : 1;
    const hit = game.player.hitFlash > 0;

    game.contractObjectives.draw(g, game, px, py);

    // Player glow ring
    g.circle(px, py, pr * 2.2).fill({ color: 0x0066aa, alpha: 0.06 * pAlpha });
    g.circle(px, py, pr * 1.5).stroke({ color: 0x00aaff, width: 1, alpha: 0.2 * pAlpha });

    // Geometric fallback only if no sprite
    if (!game.playerSprite) {
      const d = pr * 0.9;
      g.moveTo(px, py - d).lineTo(px + d, py).lineTo(px, py + d).lineTo(px - d, py).closePath();
      g.fill({ color: hit ? 0xff2200 : 0x00ccff, alpha: 0.7 * pAlpha });
      g.moveTo(px, py - d).lineTo(px + d, py).lineTo(px, py + d).lineTo(px - d, py).closePath();
      g.stroke({ color: hit ? 0xff4400 : 0x44eeff, width: 2, alpha: pAlpha });
      g.circle(px, py, 3).fill({ color: 0xffffff, alpha: 0.9 * pAlpha });
    }

    // Aim line
    if (game.player.nearestEnemyPos) {
      const dist = 50;
      const ax = px + Math.cos(game.player.aimAngle) * dist;
      const ay = py + Math.sin(game.player.aimAngle) * dist;
      g.moveTo(px, py).lineTo(ax, ay).stroke({ color: 0xff2200, width: 1, alpha: 0.4 });
      g.circle(ax, ay, 4).stroke({ color: 0xff2200, width: 1, alpha: 0.6 });
    }

    // Elite charge warning: pulsing target marker at locked position (phase 30 = wind-up)
    for (const e of game.enemies.enemies) {
      if (!e.isElite || (e.phase as number) !== 30) continue;
      const wx = e.aggroOrigin.x, wy = e.aggroOrigin.y;
      if (!game.camera.isVisible(wx, wy, 80)) continue;
      const pulse = 0.4 + Math.abs(Math.sin(e.phaseTimer * 8)) * 0.6;
      g.circle(wx, wy, 60).stroke({ color: 0xff2200, width: 3, alpha: pulse });
      g.circle(wx, wy, 40).stroke({ color: 0xff6600, width: 2, alpha: pulse * 0.7 });
      g.circle(wx, wy, 15).fill({ color: 0xff2200, alpha: pulse * 0.25 });
    }
    // Scorch marks left after elite charge impact
    for (const mark of game.scorchMarks) {
      if (!game.camera.isVisible(mark.x, mark.y, 80)) continue;
      const alpha = (mark.life / mark.maxLife) * 0.45;
      g.circle(mark.x, mark.y, 80).fill({ color: 0x220000, alpha });
      g.circle(mark.x, mark.y, 60).stroke({ color: 0xff4400, width: 2, alpha: alpha * 0.8 });
    }

    // Enemies
    for (const e of game.enemies.enemies) {
      if (!game.camera.isVisible(e.pos.x, e.pos.y, e.radius * 2)) continue;
      const ex = e.pos.x, ey = e.pos.y;
      // Behavior-based radius scaling
      const erBase = e.radius * 1.5;
      const er = e.behavior === 'charge' ? erBase * 1.2 : e.behavior === 'pack' ? erBase * 0.85 : erBase;
      // Behavior-based color override
      const bColor = BEHAVIOR_COLORS[e.behavior] ?? e.color;
      const col = e.hitFlash > 0 ? 0xffffff : bColor;
      const isVoid = e.voidType;
      const hasSprite = game.spritePool.has(e.id);
      // Lurker: semi-transparent (0.5) + flicker every 2s; fully dormant at 0.3
      const lurkerDormant = e.behavior === 'lurker' && (e.phase as number) === 0;
      const lurkerFlicker = e.behavior === 'lurker' ? (Math.floor(game.elapsed / 2) % 2 === 0 ? 1.0 : 0.6) : 1.0;
      // Tide Phantom / Phase Stalker: almost invisible during phase 1 (invisible phase)
      const phantomAlpha = (e.behavior === 'tide_phantom' || e.behavior === 'phase_stalker') && e.phase === 1
        ? 0.1 + Math.abs(Math.sin(game.elapsed * 5)) * 0.08
        : 1.0;
      const sa = lurkerDormant ? 0.3 * lurkerFlicker : e.behavior === 'lurker' ? 0.5 * lurkerFlicker : phantomAlpha;

      if (e.isAggroed) {
        g.circle(ex, ey, er * 1.6).stroke({ color: col, width: 1.5, alpha: 0.35 * sa });
      }

      if (!hasSprite) {
        if (e.behavior === 'charge') {
          g.moveTo(ex, ey - er).lineTo(ex + er * 0.87, ey + er * 0.5).lineTo(ex - er * 0.87, ey + er * 0.5).closePath();
          g.fill({ color: col, alpha: 0.6 * sa });
          g.moveTo(ex, ey - er).lineTo(ex + er * 0.87, ey + er * 0.5).lineTo(ex - er * 0.87, ey + er * 0.5).closePath();
          g.stroke({ color: col, width: 1.5, alpha: 0.9 * sa });
        } else if (e.behavior === 'pack') {
          g.moveTo(ex, ey - er).lineTo(ex + er * 0.87, ey + er * 0.5).lineTo(ex - er * 0.87, ey + er * 0.5).closePath();
          g.fill({ color: col, alpha: 0.6 * sa });
          g.moveTo(ex, ey - er).lineTo(ex + er * 0.87, ey + er * 0.5).lineTo(ex - er * 0.87, ey + er * 0.5).closePath();
          g.stroke({ color: col, width: 1.5, alpha: 0.9 * sa });
          // Draw thin lines to nearby pack members
          for (const other of game.enemies.enemies) {
            if (other !== e && other.hp > 0 && other.behavior === 'pack' && v2dist(e.pos, other.pos) < 200) {
              g.moveTo(ex, ey).lineTo(other.pos.x, other.pos.y).stroke({ color: 0x33ff33, width: 0.5, alpha: 0.3 });
            }
          }
        } else if (e.behavior === 'strafe' || e.behavior === 'patrol_river') {
          for (let i = 0; i < 6; i++) {
            const a1 = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const a2 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
            if (i === 0) g.moveTo(ex + Math.cos(a1) * er, ey + Math.sin(a1) * er);
            g.lineTo(ex + Math.cos(a2) * er, ey + Math.sin(a2) * er);
          }
          g.closePath().fill({ color: col, alpha: 0.4 * sa });
          for (let i = 0; i < 6; i++) {
            const a1 = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const a2 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
            if (i === 0) g.moveTo(ex + Math.cos(a1) * er, ey + Math.sin(a1) * er);
            g.lineTo(ex + Math.cos(a2) * er, ey + Math.sin(a2) * er);
          }
          g.closePath().stroke({ color: col, width: 1.5, alpha: 0.8 * sa });
        } else if (e.behavior === 'lurker') {
          g.moveTo(ex - er, ey - er).lineTo(ex + er, ey + er).stroke({ color: col, width: 3, alpha: 0.7 * sa });
          g.moveTo(ex + er, ey - er).lineTo(ex - er, ey + er).stroke({ color: col, width: 3, alpha: 0.7 * sa });
        } else if (e.behavior === 'mine_crawler') {
          // Heavy rounded hexagon (amber/rust) + mine-mode pulsing ring
          for (let i = 0; i < 6; i++) {
            const a1 = (i / 6) * Math.PI * 2;
            const a2 = ((i + 1) / 6) * Math.PI * 2;
            if (i === 0) g.moveTo(ex + Math.cos(a1) * er, ey + Math.sin(a1) * er);
            g.lineTo(ex + Math.cos(a2) * er, ey + Math.sin(a2) * er);
          }
          g.closePath().fill({ color: col, alpha: 0.55 * sa });
          for (let i = 0; i < 6; i++) {
            const a1 = (i / 6) * Math.PI * 2;
            const a2 = ((i + 1) / 6) * Math.PI * 2;
            if (i === 0) g.moveTo(ex + Math.cos(a1) * er, ey + Math.sin(a1) * er);
            g.lineTo(ex + Math.cos(a2) * er, ey + Math.sin(a2) * er);
          }
          g.closePath().stroke({ color: col, width: 2.5, alpha: 0.9 * sa });
          if (e.minePhaseActive) {
            const pulse = 0.3 + Math.abs(Math.sin(game.elapsed * 6)) * 0.5;
            g.circle(ex, ey, er * 1.8).stroke({ color: 0xff4400, width: 2, alpha: pulse });
          }
        } else if (e.behavior === 'sentry_drone') {
          // Small diamond / rhombus (amber) + flight direction line
          g.moveTo(ex, ey - er).lineTo(ex + er * 0.7, ey).lineTo(ex, ey + er).lineTo(ex - er * 0.7, ey).closePath();
          g.fill({ color: col, alpha: 0.55 * sa });
          g.moveTo(ex, ey - er).lineTo(ex + er * 0.7, ey).lineTo(ex, ey + er).lineTo(ex - er * 0.7, ey).closePath();
          g.stroke({ color: col, width: 1.5, alpha: 0.9 * sa });
          if (e.phase === 0) {
            const tx = ex + Math.cos(e.lockAngle) * er * 2.5;
            const ty = ey + Math.sin(e.lockAngle) * er * 2.5;
            g.moveTo(ex, ey).lineTo(tx, ty).stroke({ color: col, width: 1, alpha: 0.4 * sa });
          }
        } else if (e.behavior === 'tide_phantom') {
          // Circle that shimmers teal -- full glow when visible, ghostly when not
          g.circle(ex, ey, er).fill({ color: col, alpha: 0.45 * sa });
          g.circle(ex, ey, er).stroke({ color: col, width: 2, alpha: 0.9 * sa });
          if (e.phase === 1) {
            // Extra shimmer ring when invisible
            const shimmer = 0.15 + Math.abs(Math.sin(game.elapsed * 7)) * 0.15;
            g.circle(ex, ey, er * 1.4).stroke({ color: 0x22ccbb, width: 1.5, alpha: shimmer });
          }
        } else if (e.behavior === 'coral_spitter') {
          // Large circle with aim indicator and root tendrils (teal/blue)
          g.circle(ex, ey, er).fill({ color: col, alpha: 0.5 * sa });
          g.circle(ex, ey, er).stroke({ color: col, width: 2.5, alpha: 0.9 * sa });
          // Aim direction line
          const aimX = ex + Math.cos(e.lockAngle) * er * 2;
          const aimY = ey + Math.sin(e.lockAngle) * er * 2;
          g.moveTo(ex, ey).lineTo(aimX, aimY).stroke({ color: col, width: 1.5, alpha: 0.6 * sa });
          // Root tendrils (4 diagonal lines)
          for (let i = 0; i < 4; i++) {
            const ra = (i / 4) * Math.PI * 2 + Math.PI / 4;
            g.moveTo(ex + Math.cos(ra) * er, ey + Math.sin(ra) * er)
              .lineTo(ex + Math.cos(ra) * er * 1.8, ey + Math.sin(ra) * er * 1.8)
              .stroke({ color: col, width: 1, alpha: 0.4 * sa });
          }
        } else if (e.behavior === 'slag_brute') {
          // Heavy octagon with inner heat glow; molten rage = pulsing red core
          const isRaging = e.hp < e.maxHp * 0.3;
          for (let i = 0; i < 8; i++) {
            const a1 = (i / 8) * Math.PI * 2;
            const a2 = ((i + 1) / 8) * Math.PI * 2;
            if (i === 0) g.moveTo(ex + Math.cos(a1) * er, ey + Math.sin(a1) * er);
            g.lineTo(ex + Math.cos(a2) * er, ey + Math.sin(a2) * er);
          }
          g.closePath().fill({ color: col, alpha: 0.6 * sa });
          for (let i = 0; i < 8; i++) {
            const a1 = (i / 8) * Math.PI * 2;
            const a2 = ((i + 1) / 8) * Math.PI * 2;
            if (i === 0) g.moveTo(ex + Math.cos(a1) * er, ey + Math.sin(a1) * er);
            g.lineTo(ex + Math.cos(a2) * er, ey + Math.sin(a2) * er);
          }
          g.closePath().stroke({ color: col, width: 3, alpha: 0.9 * sa });
          if (isRaging) {
            const pulse = 0.4 + Math.abs(Math.sin(game.elapsed * 8)) * 0.4;
            g.circle(ex, ey, er * 0.5).fill({ color: 0xff2200, alpha: pulse });
            g.circle(ex, ey, er * 1.6).stroke({ color: 0xff2200, width: 2, alpha: pulse * 0.5 });
          }
          // Wind-up indicator (phase 1 = about to slam)
          if (e.phase === 1) {
            const warn = 0.5 + Math.abs(Math.sin(game.elapsed * 12)) * 0.5;
            g.circle(ex, ey, er * 2.2).stroke({ color: 0xff4400, width: 2.5, alpha: warn * 0.7 });
          }
        } else if (e.behavior === 'cinder_wasp') {
          // Small triangle / wasp shape (amber) + direction line when dashing
          g.moveTo(ex, ey - er).lineTo(ex + er * 0.8, ey + er * 0.6).lineTo(ex - er * 0.8, ey + er * 0.6).closePath();
          g.fill({ color: col, alpha: 0.55 * sa });
          g.moveTo(ex, ey - er).lineTo(ex + er * 0.8, ey + er * 0.6).lineTo(ex - er * 0.8, ey + er * 0.6).closePath();
          g.stroke({ color: col, width: 1.5, alpha: 0.9 * sa });
          if (e.phase === 0) {
            const tx = ex + Math.cos(e.lockAngle) * er * 2.5;
            const ty = ey + Math.sin(e.lockAngle) * er * 2.5;
            g.moveTo(ex, ey).lineTo(tx, ty).stroke({ color: col, width: 1, alpha: 0.5 * sa });
          } else {
            // Aim glow when hovering
            g.circle(ex, ey, er * 1.3).stroke({ color: 0xffcc00, width: 1.5, alpha: 0.4 * sa });
          }
        } else {
          g.rect(ex - er * 0.7, ey - er * 0.7, er * 1.4, er * 1.4).fill({ color: col, alpha: 0.5 * sa });
          g.rect(ex - er * 0.7, ey - er * 0.7, er * 1.4, er * 1.4).stroke({ color: col, width: 1.5, alpha: 0.8 * sa });
        }
      }

      // Glow ring for sprite enemies — makes behavior color obvious
      if (hasSprite) {
        g.circle(ex, ey, er * 1.2).fill({ color: bColor, alpha: 0.18 * sa });
        g.circle(ex, ey, er * 1.2).stroke({ color: bColor, width: 2.5, alpha: 0.65 * sa });
        // Pack link lines (only needed here for sprite enemies — no-sprite already has them)
        if (e.behavior === 'pack') {
          for (const other of game.enemies.enemies) {
            if (other !== e && other.hp > 0 && other.behavior === 'pack' && v2dist(e.pos, other.pos) < 200) {
              g.moveTo(ex, ey).lineTo(other.pos.x, other.pos.y).stroke({ color: 0x33ff33, width: 1, alpha: 0.4 });
            }
          }
        }
      }

      if (isVoid) {
        g.circle(ex, ey, er * 0.4).fill({ color: 0xff2200, alpha: 0.5 + Math.sin(game.elapsed * 4) * 0.2 });
      }

      // Stunned: white sparkling ring
      if (e.stunTimer > 0) {
        const stunAlpha = 0.5 + Math.sin(game.elapsed * 12) * 0.3;
        g.circle(ex, ey, er * 1.7).stroke({ color: 0xffffff, width: 2.5, alpha: stunAlpha });
        g.circle(ex, ey, er * 1.3).stroke({ color: 0xbbccff, width: 1, alpha: stunAlpha * 0.6 });
      }

      // Pack member link lines already drawn above in shape block
      // Elite: pulsing glow ring using original creature color
      if (e.isElite) {
        const pulseAlpha = 0.3 + Math.sin(game.elapsed * 3) * 0.2;
        const eliteGlowColor = e.id === game.apexId
          ? (game.apexPhase === 3 ? 0x9900cc : game.apexPhase === 2 ? 0xff8800 : 0xff3300)
          : e.color;
        g.circle(ex, ey, er * 2.0).stroke({ color: eliteGlowColor, width: e.id === game.apexId ? 4 : 3, alpha: pulseAlpha });
        g.circle(ex, ey, er * 2.4).stroke({ color: eliteGlowColor, width: 1, alpha: pulseAlpha * 0.4 });
        // Apex: extra large outer aura
        if (e.id === game.apexId) {
          g.circle(ex, ey, er * 3.2).stroke({ color: eliteGlowColor, width: 2, alpha: pulseAlpha * 0.25 });
          g.circle(ex, ey, er * 2.0).fill({ color: eliteGlowColor, alpha: 0.05 + Math.sin(game.elapsed * 2) * 0.02 });
          // Phase 2 shield visual
          if (game.apexShieldActive) {
            const shieldAlpha = 0.4 + Math.sin(game.elapsed * 10) * 0.3;
            g.circle(ex, ey, er * 2.8).stroke({ color: 0x44aaff, width: 3, alpha: shieldAlpha });
            g.circle(ex, ey, er * 2.8).fill({ color: 0x44aaff, alpha: 0.06 });
          }
        }

        // AOE Slam charge-up: expanding pulse ring
        if (e.phase === 10) {
          const chargeRatio = Math.max(0, 1 - e.phaseTimer / 0.8);
          const aoeR = chargeRatio * 120 + er;
          const pA = 0.35 + Math.sin(game.elapsed * 20) * 0.2;
          g.circle(ex, ey, aoeR).stroke({ color: 0xff6600, width: 3, alpha: pA });
          g.circle(ex, ey, aoeR * 0.5).fill({ color: 0xff6600, alpha: 0.12 * chargeRatio });
        }
        // AOE detonation flash
        if (e.phase === 11) {
          const flashA = e.phaseTimer / 0.2;
          g.circle(ex, ey, 120 + er).fill({ color: 0xff8800, alpha: 0.25 * flashA });
          g.circle(ex, ey, 120 + er).stroke({ color: 0xff6600, width: 4, alpha: 0.9 * flashA });
        }
        // Dash charge: preview trail line
        if (e.phase === 20) {
          const trailLen = 280;
          const tx = ex + Math.cos(e.lockAngle) * trailLen;
          const ty = ey + Math.sin(e.lockAngle) * trailLen;
          const ta = 0.2 + Math.sin(game.elapsed * 14) * 0.12;
          g.moveTo(ex, ey).lineTo(tx, ty).stroke({ color: 0xff3300, width: 4, alpha: ta });
          g.circle(tx, ty, 10).stroke({ color: 0xff3300, width: 2, alpha: ta + 0.15 });
        }
        // Dashing: speed trail
        if (e.phase === 21) {
          const trailBack = v2fromAngle(e.lockAngle + Math.PI, er * 3);
          g.moveTo(ex, ey).lineTo(ex + trailBack.x, ey + trailBack.y)
            .stroke({ color: 0xff6600, width: er * 2, alpha: 0.3 });
        }
      }

      if (e.hp < e.maxHp) {
        const bw = er * 2.5;
        const bh = 3;
        const bx = ex - bw / 2;
        const by = ey - er - 10;
        const frac = e.hp / e.maxHp;
        g.rect(bx, by, bw, bh).fill({ color: 0x110000, alpha: 0.8 });
        g.rect(bx, by, bw * frac, bh).fill({ color: e.id === game.apexId ? 0xff8000 : 0xff2200, alpha: 0.9 });
      }
    }

    // ── Drop capsules ──
    game.dropSystem.draw(g, game);

    // ── Ally drones ──
    for (const d of game.allyDrones) {
      if (!game.camera.isVisible(d.x, d.y, 20)) continue;
      const pulseA = 0.7 + Math.sin(game.elapsed * 5) * 0.3;
      g.circle(d.x, d.y, 10).fill({ color: 0xffdd00, alpha: 0.75 * pulseA });
      g.circle(d.x, d.y, 10).stroke({ color: 0xffffff, width: 1.5, alpha: 0.8 });
      g.circle(d.x, d.y, 14).stroke({ color: 0xffdd00, width: 1, alpha: 0.3 });
      // HP bar
      if (d.hp < d.maxHp) {
        const bw = 18;
        g.rect(d.x - bw / 2, d.y - 18, bw, 3).fill({ color: 0x110000, alpha: 0.8 });
        g.rect(d.x - bw / 2, d.y - 18, bw * (d.hp / d.maxHp), 3).fill({ color: 0xffdd00, alpha: 0.9 });
      }
    }

    // ── Boss HP bar (screen-space via camera offset) ──
    if (game.contractType === 'boss_hunt' && game.apexSpawned) {
      const apex = game.enemies.enemies.find(e => e.id === game.apexId);
      if (apex) {
        const barW = Math.min(game.camera.viewW * 0.6, 360);
        const barH = 14;
        const bx = game.camera.x + (game.camera.viewW - barW) / 2;
        const by = game.camera.y + 10;
        const frac = Math.max(0, apex.hp / apex.maxHp);
        const barColor = game.apexPhase === 3 ? 0x9900cc : game.apexPhase === 2 ? 0xff8800 : 0xff3300;
        g.rect(bx, by, barW, barH).fill({ color: 0x110000, alpha: 0.85 });
        g.rect(bx, by, barW * frac, barH).fill({ color: barColor, alpha: 0.9 });
        g.rect(bx, by, barW, barH).stroke({ color: barColor, width: 1, alpha: 0.5 });
        // Phase markers
        for (const pct of [0.6, 0.3]) {
          const mx = bx + barW * pct;
          g.moveTo(mx, by).lineTo(mx, by + barH).stroke({ color: 0xffffff, width: 1.5, alpha: 0.6 });
        }
        // Shield glow
        if (game.apexShieldActive) {
          g.rect(bx, by, barW, barH).stroke({ color: 0x44aaff, width: 3, alpha: 0.7 + Math.sin(game.elapsed * 8) * 0.3 });
        }
        // Name label above bar
        const labelX = game.camera.x + game.camera.viewW / 2;
        const labelY = game.camera.y + 10 + barH + 4;
        // Draw small text indicator using a rect as placeholder (text is in HUD layer)
        const ph = game.apexPhase;
        const phaseColors = [0, 0xff3300, 0xff8800, 0x9900cc];
        g.circle(labelX, labelY + 4, 4).fill({ color: phaseColors[ph] ?? 0xff3300, alpha: 0.8 + Math.sin(game.elapsed * 3) * 0.2 });
      }
    }

    // Screen-edge arrows for off-screen elites
    const camLeft = game.camera.x, camRight = game.camera.x + game.camera.viewW;
    const camTop = game.camera.y, camBottom = game.camera.y + game.camera.viewH;
    for (const e of game.enemies.enemies) {
      if (!e.isElite || e.hp <= 0) continue;
      if (e.pos.x >= camLeft && e.pos.x <= camRight && e.pos.y >= camTop && e.pos.y <= camBottom) continue;
      // Off-screen: draw arrow on screen edge
      const dx = e.pos.x - game.player.pos.x;
      const dy = e.pos.y - game.player.pos.y;
      const angle = Math.atan2(dy, dx);
      const edgeDist = Math.min(game.camera.viewW, game.camera.viewH) * 0.42;
      const arrowX = game.player.pos.x + Math.cos(angle) * edgeDist;
      const arrowY = game.player.pos.y + Math.sin(angle) * edgeDist;
      const sz = 10;
      const pulseA = 0.7 + Math.sin(game.elapsed * 4) * 0.3;
      g.moveTo(arrowX + Math.cos(angle) * sz, arrowY + Math.sin(angle) * sz)
        .lineTo(arrowX + Math.cos(angle + 2.4) * sz, arrowY + Math.sin(angle + 2.4) * sz)
        .lineTo(arrowX + Math.cos(angle - 2.4) * sz, arrowY + Math.sin(angle - 2.4) * sz)
        .closePath().fill({ color: e.color || 0xffdd11, alpha: pulseA });
      g.circle(arrowX, arrowY, sz * 1.5).stroke({ color: e.color || 0xffdd11, width: 1.5, alpha: pulseA * 0.4 });
    }
  }

}
