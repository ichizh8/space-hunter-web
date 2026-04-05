import { type Vec2, v2, v2sub, v2norm, v2add, v2mul, v2dist, v2len, v2fromAngle, randRange, randInt, pick } from '../lib/math';
import { CREATURE_DEFS, BIOME_POOLS, type CreatureDef } from '../data/creatures';
import { WORLD_W, WORLD_H, ENEMY_MELEE_RANGE, ENEMY_LEASH_DEFAULT } from './constants';
import type { Player } from './Player';
import type { GameMap } from './Map';

export interface Enemy {
  id: number;
  name: string;
  pos: Vec2;
  vel: Vec2;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  color: number;
  detection: number;
  meleeDmg: number;
  ranged: boolean;
  rangedDmg: number;
  rangedCooldown: number;
  rangedTimer: number;
  voidType: boolean;
  behavior: string;
  isAggroed: boolean;
  aggroOrigin: Vec2;
  leash: number;
  isElite: boolean;
  isTarget: boolean;
  hitFlash: number;
  // Behavior state
  flankSide: number;
  flankTimer: number;
  burstTimer: number;
  burstActive: boolean;
  strafeDir: number;
  strafeTimer: number;
  meleeCooldown: number;
  stunTimer: number;
  isAlly: boolean;
}

let nextEnemyId = 1;

export function createEnemy(name: string, pos: Vec2, aggroed = false): Enemy {
  const def = CREATURE_DEFS[name];
  if (!def) throw new Error(`Unknown creature: ${name}`);
  return {
    id: nextEnemyId++,
    name,
    pos: v2(pos.x, pos.y),
    vel: v2(0, 0),
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed,
    radius: def.radius,
    color: def.color,
    detection: def.detection,
    meleeDmg: def.meleeDmg,
    ranged: def.ranged,
    rangedDmg: def.rangedDmg,
    rangedCooldown: def.rangedCooldown,
    rangedTimer: def.rangedCooldown,
    voidType: def.voidType,
    behavior: def.behavior,
    isAggroed: aggroed,
    aggroOrigin: v2(pos.x, pos.y),
    leash: ENEMY_LEASH_DEFAULT,
    isElite: false,
    isTarget: false,
    hitFlash: 0,
    flankSide: Math.random() > 0.5 ? 1 : -1,
    flankTimer: 0,
    burstTimer: randRange(1, 3),
    burstActive: false,
    strafeDir: Math.random() > 0.5 ? 1 : -1,
    strafeTimer: 0,
    meleeCooldown: 0,
    stunTimer: 0,
    isAlly: false,
  };
}

export class EnemySystem {
  enemies: Enemy[] = [];
  enemyBullets: Array<{ pos: Vec2; vel: Vec2; radius: number; damage: number; life: number; color: number }> = [];

  spawnWave(count: number, playerPos: Vec2, map: GameMap, biome?: string) {
    for (let i = 0; i < count; i++) {
      // Spawn away from player
      let pos: Vec2;
      let attempts = 0;
      do {
        pos = v2(randRange(100, WORLD_W - 100), randRange(100, WORLD_H - 100));
        attempts++;
      } while (v2dist(pos, playerPos) < 600 && attempts < 30);

      // Pick creature from biome pool
      const spawnBiome = biome || map.getBiome(pos.x, pos.y);
      const pool = BIOME_POOLS[spawnBiome] || BIOME_POOLS.open;
      const name = pick(pool);
      const aggroed = Math.random() < 0.6;
      this.enemies.push(createEnemy(name, pos, aggroed));
    }
  }

  update(dt: number, player: Player, map: GameMap, decoys?: Array<{ x: number; y: number }>) {
    for (const e of this.enemies) {
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.meleeCooldown = Math.max(0, e.meleeCooldown - dt);

      // Stun check
      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
        e.vel = v2(0, 0);
        continue;
      }

      // Allies attack nearest non-ally enemy instead of player
      if (e.isAlly) {
        let allyTarget: Enemy | null = null;
        let allyDist = 200;
        for (const other of this.enemies) {
          if (other === e || other.hp <= 0 || other.isAlly) continue;
          const d = v2dist(e.pos, other.pos);
          if (d < allyDist) { allyDist = d; allyTarget = other; }
        }
        if (allyTarget) {
          const dir = v2norm(v2sub(allyTarget.pos, e.pos));
          e.vel = v2mul(dir, e.speed);
          if (allyDist < ENEMY_MELEE_RANGE + e.radius + allyTarget.radius && e.meleeCooldown <= 0) {
            allyTarget.hp -= e.meleeDmg;
            allyTarget.hitFlash = 0.15;
            e.meleeCooldown = 1.0;
          }
        } else {
          // Follow player if no targets
          const dir = v2norm(v2sub(player.pos, e.pos));
          e.vel = v2mul(dir, e.speed * 0.5);
        }
        // Apply movement
        const nx = e.pos.x + e.vel.x * dt;
        const ny = e.pos.y + e.vel.y * dt;
        if (!map.isBlocked(nx, e.pos.y, e.radius)) e.pos.x = nx;
        if (!map.isBlocked(e.pos.x, ny, e.radius)) e.pos.y = ny;
        continue;
      }

      const toPlayer = v2sub(player.pos, e.pos);
      const distToPlayer = v2len(toPlayer);

      // Aggro check
      if (!e.isAggroed && distToPlayer < e.detection) {
        e.isAggroed = true;
      }

      // Leash check
      if (e.isAggroed && v2dist(e.pos, e.aggroOrigin) > e.leash && distToPlayer > e.detection) {
        e.isAggroed = false;
      }

      if (!e.isAggroed) {
        // Idle patrol
        e.vel = v2mul(e.vel, 0.95);
        continue;
      }

      // Decoy targeting: if decoy is closer than player, move toward decoy
      let moveTarget = player.pos;
      if (decoys) {
        for (const dc of decoys) {
          const dcDist = v2dist(e.pos, dc);
          if (dcDist < e.detection && dcDist < v2dist(e.pos, moveTarget)) {
            moveTarget = dc;
          }
        }
      }

      // Smoke zone: de-aggro if inside smoke (checked externally via smokeZones)

      // Behavior-specific movement
      const toTarget = v2sub(moveTarget, e.pos);
      const dirToPlayer = v2norm(toTarget);

      switch (e.behavior) {
        case 'charge':
          e.vel = v2mul(dirToPlayer, e.speed);
          break;

        case 'flank':
          e.flankTimer -= dt;
          if (e.flankTimer <= 0) {
            e.flankSide *= -1;
            e.flankTimer = randRange(1, 2.5);
          }
          {
            const perp = v2(-dirToPlayer.y * e.flankSide, dirToPlayer.x * e.flankSide);
            const dir = v2norm(v2add(dirToPlayer, v2mul(perp, 0.6)));
            e.vel = v2mul(dir, e.speed);
          }
          break;

        case 'burst':
          e.burstTimer -= dt;
          if (e.burstTimer <= 0) {
            e.burstActive = !e.burstActive;
            e.burstTimer = e.burstActive ? 0.8 : randRange(1.5, 3);
          }
          e.vel = e.burstActive ? v2mul(dirToPlayer, e.speed * 2) : v2mul(e.vel, 0.9);
          break;

        case 'strafe':
          e.strafeTimer -= dt;
          if (e.strafeTimer <= 0) {
            e.strafeDir *= -1;
            e.strafeTimer = randRange(1, 2);
          }
          if (distToPlayer < 200) {
            // Strafe and keep distance
            const perp = v2(-dirToPlayer.y * e.strafeDir, dirToPlayer.x * e.strafeDir);
            const retreat = v2mul(dirToPlayer, -0.3);
            e.vel = v2mul(v2norm(v2add(perp, retreat)), e.speed);
          } else {
            e.vel = v2mul(dirToPlayer, e.speed * 0.5);
          }
          break;

        case 'pack':
          // Move toward player but stay in a cluster
          e.vel = v2mul(dirToPlayer, e.speed * (distToPlayer > 150 ? 1 : 0.3));
          break;

        case 'lurker':
          if (distToPlayer < 150) {
            e.vel = v2mul(dirToPlayer, e.speed * 1.5); // Fast lunge
          } else {
            e.vel = v2mul(e.vel, 0.9); // Dormant
          }
          break;

        case 'patrol_river':
          if (distToPlayer < 250) {
            e.vel = v2mul(dirToPlayer, e.speed * 0.6);
          } else {
            e.vel = v2mul(e.vel, 0.95);
          }
          break;

        default:
          e.vel = v2mul(dirToPlayer, e.speed);
      }

      // Move with collision
      const newX = e.pos.x + e.vel.x * dt;
      const newY = e.pos.y + e.vel.y * dt;
      if (!map.isBlocked(newX, e.pos.y, e.radius)) e.pos.x = newX;
      if (!map.isBlocked(e.pos.x, newY, e.radius)) e.pos.y = newY;
      e.pos.x = Math.max(e.radius, Math.min(WORLD_W - e.radius, e.pos.x));
      e.pos.y = Math.max(e.radius, Math.min(WORLD_H - e.radius, e.pos.y));

      // Melee attack (skip allies)
      if (!e.isAlly && distToPlayer < ENEMY_MELEE_RANGE + e.radius + player.radius && e.meleeDmg > 0 && e.meleeCooldown <= 0) {
        player.takeDamage(e.meleeDmg);
        e.meleeCooldown = 1.0;
      }

      // Ranged attack
      if (e.ranged && distToPlayer < e.detection) {
        e.rangedTimer -= dt;
        if (e.rangedTimer <= 0) {
          e.rangedTimer = e.rangedCooldown;
          const angle = Math.atan2(toPlayer.y, toPlayer.x);
          this.enemyBullets.push({
            pos: v2(e.pos.x, e.pos.y),
            vel: v2fromAngle(angle, 200),
            radius: 4,
            damage: e.rangedDmg,
            life: 2.0,
            color: 0xff4444,
          });
        }
      }
    }

    // Update enemy bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.life -= dt;
      if (b.life <= 0) { this.enemyBullets.splice(i, 1); continue; }
      b.pos = v2add(b.pos, v2mul(b.vel, dt));

      // Hit player
      if (v2dist(b.pos, player.pos) < b.radius + player.radius) {
        player.takeDamage(b.damage);
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  removeEnemy(id: number) {
    const idx = this.enemies.findIndex(e => e.id === id);
    if (idx >= 0) this.enemies.splice(idx, 1);
  }

  clear() {
    this.enemies = [];
    this.enemyBullets = [];
  }
}
