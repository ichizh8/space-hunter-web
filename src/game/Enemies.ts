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
  // Elite affix fields
  affixes: string[];
  shieldHp: number;
  tpTimer: number;
  magneticTimer: number;
  // Marked (for kit perks / chain T3)
  markedTimer: number;
  markedDmgBonus: number;
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
    affixes: [],
    shieldHp: 0,
    tpTimer: 0,
    magneticTimer: 0,
    markedTimer: 0,
    markedDmgBonus: 1,
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
          {
            // Enrage below 30% HP: 40% speed boost for desperation charge
            const rage = e.hp < e.maxHp * 0.3 ? 1.4 : 1.0;
            // Slight weave to dodge bullets (use flankSide as weave offset)
            e.flankTimer -= dt;
            if (e.flankTimer <= 0) {
              e.flankSide = (Math.random() - 0.5) * 0.25;
              e.flankTimer = randRange(0.4, 1.0);
            }
            const weave = v2(-dirToPlayer.y * e.flankSide, dirToPlayer.x * e.flankSide);
            const dir = distToPlayer > 100 ? v2norm(v2add(dirToPlayer, weave)) : dirToPlayer;
            e.vel = v2mul(dir, e.speed * rage);
          }
          break;

        case 'flank':
          e.flankTimer -= dt;
          if (e.flankTimer <= 0) {
            e.flankSide *= -1;
            e.flankTimer = randRange(0.8, 2.0);
          }
          {
            // Arc around the player: mostly perpendicular when far, close aggressively once flanked
            const flankWeight = distToPlayer < 160 ? 0.15 : 0.75;
            const perp = v2(-dirToPlayer.y * e.flankSide, dirToPlayer.x * e.flankSide);
            const dir = v2norm(v2add(v2mul(dirToPlayer, 1 - flankWeight), v2mul(perp, flankWeight)));
            e.vel = v2mul(dir, e.speed);
          }
          break;

        case 'burst':
          e.burstTimer -= dt;
          if (e.burstTimer <= 0) {
            e.burstActive = !e.burstActive;
            // Faster, more frequent dashes; shorter pause
            e.burstTimer = e.burstActive ? 0.45 : randRange(0.6, 1.8);
          }
          e.vel = e.burstActive ? v2mul(dirToPlayer, e.speed * 2.8) : v2mul(e.vel, 0.82);
          break;

        case 'strafe':
          e.strafeTimer -= dt;
          if (e.strafeTimer <= 0) {
            e.strafeDir *= -1;
            e.strafeTimer = randRange(0.7, 1.4);
          }
          if (distToPlayer < 160) {
            // Too close: hard retreat + strafe
            const perp = v2(-dirToPlayer.y * e.strafeDir, dirToPlayer.x * e.strafeDir);
            const retreat = v2mul(dirToPlayer, -1.0);
            e.vel = v2mul(v2norm(v2add(perp, retreat)), e.speed);
          } else if (distToPlayer < 380) {
            // Optimal range: circle aggressively while shooting
            const perp = v2(-dirToPlayer.y * e.strafeDir, dirToPlayer.x * e.strafeDir);
            const close = v2mul(dirToPlayer, 0.2); // slight drift inward
            e.vel = v2mul(v2norm(v2add(perp, close)), e.speed);
          } else {
            // Too far: advance to range
            e.vel = v2mul(dirToPlayer, e.speed * 0.7);
          }
          break;

        case 'pack':
          {
            // Spread members across 4 quadrants to surround player; converge to attack together
            const angleOffset = (e.id % 4) * (Math.PI / 2);
            const packAngle = Math.atan2(dirToPlayer.y, dirToPlayer.x) + angleOffset;
            const spreadDir = v2fromAngle(packAngle, 1);
            if (distToPlayer > 220) {
              // Fan out while advancing
              const dir = v2norm(v2add(v2mul(dirToPlayer, 0.5), v2mul(spreadDir, 0.5)));
              e.vel = v2mul(dir, e.speed);
            } else if (distToPlayer > 100) {
              // Converge and attack from spread angle
              e.vel = v2mul(dirToPlayer, e.speed * 0.8);
            } else {
              // Swarming at close range
              e.vel = v2mul(dirToPlayer, e.speed * 0.4);
            }
          }
          break;

        case 'lurker':
          if (distToPlayer < 130) {
            // Pounce: massive burst at close range
            e.vel = v2mul(dirToPlayer, e.speed * 2.4);
          } else if (distToPlayer < e.detection) {
            // Stalk: creep silently toward player
            e.vel = v2mul(dirToPlayer, e.speed * 0.25);
          } else {
            e.vel = v2mul(e.vel, 0.9); // Idle
          }
          break;

        case 'patrol_river':
          if (distToPlayer < 300) {
            // Actively pursue at full speed and fire
            e.vel = v2mul(dirToPlayer, e.speed);
          } else if (distToPlayer < e.detection) {
            // Close to firing range
            e.vel = v2mul(dirToPlayer, e.speed * 0.5);
          } else {
            // Idle drift along patrol path
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
