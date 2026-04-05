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
  // Extended behavior state
  phase: number;        // generic phase for state-machine behaviors (0-based)
  phaseTimer: number;   // countdown timer for current phase
  lockAngle: number;    // locked aim direction (charge rush, burst dash)
  packAngle: number;    // surround angle for pack coordination
  woundedFlee: boolean; // true once set when HP drops below 20%
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
    phase: 0,
    phaseTimer: 0,
    lockAngle: 0,
    packAngle: (nextEnemyId * 1.2566) % (Math.PI * 2), // spread across circle using golden-ish increment
    woundedFlee: false,
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

      // Wounded flee / berserk: triggers once below 20% HP (elites never flee)
      if (!e.woundedFlee && e.hp < e.maxHp * 0.2 && !e.isElite) {
        e.woundedFlee = true;
      }

      if (e.woundedFlee) {
        // Aggressive types go berserk; others flee
        if (e.behavior === 'charge' || e.behavior === 'burst' || e.behavior === 'pack') {
          e.vel = v2mul(dirToPlayer, e.speed * 1.8); // berserk rush
        } else {
          e.vel = v2mul(v2norm(v2sub(e.pos, player.pos)), e.speed * 1.2); // flee
        }
      } else {
      switch (e.behavior) {
        case 'charge': {
          // Phase 0: approach at reduced speed
          // Phase 1: telegraph (stop + pulse, 0.5s)
          // Phase 2: rush at locked angle (0.75s)
          // Phase 3: recovery deceleration (0.7s) then cooldown
          e.phaseTimer -= dt;
          if (e.phase === 0) {
            e.vel = v2mul(dirToPlayer, e.speed * 0.65);
            if (distToPlayer < 260 && e.phaseTimer <= 0) {
              e.phase = 1;
              e.phaseTimer = 0.5;
              e.vel = v2(0, 0);
            }
          } else if (e.phase === 1) {
            // Telegraph: stop and flash
            e.vel = v2mul(e.vel, 0.7);
            e.hitFlash = 0.08; // visual pulse
            if (e.phaseTimer <= 0) {
              e.lockAngle = Math.atan2(toTarget.y, toTarget.x);
              e.phase = 2;
              e.phaseTimer = 0.75;
            }
          } else if (e.phase === 2) {
            // Rush: full speed in locked direction
            e.vel = v2mul(v2fromAngle(e.lockAngle), e.speed * 2.6);
            // Knockback on melee contact during rush (applied in melee block below)
            if (e.phaseTimer <= 0) {
              e.phase = 3;
              e.phaseTimer = 0.7;
            }
          } else {
            // Recovery: brake
            e.vel = v2mul(e.vel, 0.82);
            if (e.phaseTimer <= 0) {
              e.phase = 0;
              e.phaseTimer = randRange(1.2, 2.5); // cooldown before next charge
            }
          }
          break;
        }

        case 'flank': {
          // Orbit player at ~190px, switch sides periodically, lunge to attack
          e.flankTimer -= dt;
          if (e.flankTimer <= 0) {
            e.flankSide *= -1;
            e.flankTimer = randRange(2.5, 5);
          }
          const orbitDist = 190;
          const perp = v2(-dirToPlayer.y * e.flankSide, dirToPlayer.x * e.flankSide);
          if (distToPlayer > orbitDist * 1.6) {
            // Too far — close in quickly
            e.vel = v2mul(dirToPlayer, e.speed);
          } else {
            // Orbit: blend toward orbit radius + tangential movement
            const distErr = distToPlayer - orbitDist;
            const radial = v2mul(dirToPlayer, distErr * 0.008);
            const orbitDir = v2norm(v2add(perp, radial));
            e.vel = v2mul(orbitDir, e.speed);
          }
          // Lunge when close enough from a flanking position
          if (distToPlayer < 110) {
            e.vel = v2mul(dirToPlayer, e.speed * 1.6);
          }
          break;
        }

        case 'burst': {
          // Phase 0 (idle, wait): hold at safe range
          // Phase 1 (dash in): fast dash toward locked angle
          // Phase 2 (retreat): dash away at speed
          e.burstTimer -= dt;
          if (e.burstTimer <= 0) {
            e.burstActive = !e.burstActive;
            if (e.burstActive) {
              // Start dash
              e.lockAngle = Math.atan2(toTarget.y, toTarget.x);
              e.burstTimer = 0.5;
            } else {
              // Retreat phase
              e.lockAngle = Math.atan2(-toTarget.y, -toTarget.x); // away from player
              e.burstTimer = randRange(1.0, 2.2);
            }
          }
          if (e.burstActive) {
            e.vel = v2mul(v2fromAngle(e.lockAngle), e.speed * 2.4);
          } else {
            // Retreat or idle at safe range
            if (distToPlayer < 280) {
              e.vel = v2mul(v2fromAngle(e.lockAngle), e.speed * 1.1);
            } else {
              e.vel = v2mul(e.vel, 0.88); // hold at distance
            }
          }
          break;
        }

        case 'strafe': {
          // Orbit at ~220px, switch direction frequently, random dodge bursts
          e.strafeTimer -= dt;
          if (e.strafeTimer <= 0) {
            e.strafeDir *= -1;
            e.strafeTimer = randRange(0.7, 1.6);
          }
          e.flankTimer -= dt;
          const preferredDist = 220;
          const perpS = v2(-dirToPlayer.y * e.strafeDir, dirToPlayer.x * e.strafeDir);
          if (distToPlayer < preferredDist - 35) {
            // Too close — strafe away
            e.vel = v2mul(v2norm(v2add(v2mul(perpS, 1.4), v2norm(v2sub(e.pos, player.pos)))), e.speed);
          } else if (distToPlayer > preferredDist + 50) {
            // Too far — close while strafing
            e.vel = v2mul(v2norm(v2add(perpS, v2mul(dirToPlayer, 0.7))), e.speed);
          } else {
            // At range — pure strafe; occasional dodge burst
            if (e.flankTimer <= 0 && Math.random() < 0.4) {
              e.vel = v2mul(perpS, e.speed * 1.9); // burst dodge
              e.flankTimer = randRange(1.5, 3.0);
            } else {
              if (e.flankTimer <= 0) e.flankTimer = randRange(0.4, 1.2);
              e.vel = v2mul(perpS, e.speed);
            }
          }
          break;
        }

        case 'pack': {
          // Surround player: each enemy holds a different angle around the player.
          // Rotate angle slowly; lunge when at position; flee if isolated.
          e.packAngle += dt * 0.35 * e.flankSide;
          e.flankTimer -= dt;
          if (e.flankTimer <= 0) {
            if (Math.random() < 0.25) e.flankSide *= -1; // occasionally reverse orbit
            e.flankTimer = randRange(1.8, 4.0);
          }
          const packOrbit = 140;
          const targetPos = v2(
            player.pos.x + Math.cos(e.packAngle) * packOrbit,
            player.pos.y + Math.sin(e.packAngle) * packOrbit,
          );
          const toTargetPos = v2sub(targetPos, e.pos);
          const toTargetDist = v2len(toTargetPos);

          // Check isolation: flee if no pack-mates within 200px
          let hasNearby = false;
          for (const other of this.enemies) {
            if (other === e || other.hp <= 0 || other.behavior !== 'pack') continue;
            if (v2dist(other.pos, e.pos) < 200) { hasNearby = true; break; }
          }
          if (!hasNearby && distToPlayer > 80) {
            // Isolated — back off briefly
            e.vel = v2mul(v2norm(v2sub(e.pos, player.pos)), e.speed * 0.8);
          } else if (distToPlayer < 70) {
            // Inside attack range — press in
            e.vel = v2mul(dirToPlayer, e.speed * 1.3);
          } else if (toTargetDist > 25) {
            // Move to surround position
            e.vel = v2mul(v2norm(toTargetPos), e.speed);
          } else {
            // Hold position
            e.vel = v2mul(e.vel, 0.85);
          }
          break;
        }

        case 'lurker': {
          // Phase 0: hide / patrol slowly near aggroOrigin
          // Phase 1: brief pause then pounce
          // Phase 2: retreat to a new hide spot
          e.phaseTimer -= dt;
          if (e.phase === 0) {
            // Dormant — drift slowly, wait for player
            e.vel = v2mul(e.vel, 0.88);
            if (distToPlayer < 200) {
              e.phase = 1;
              e.phaseTimer = 0.25; // brief wind-up pause
            }
          } else if (e.phase === 1) {
            if (e.phaseTimer > 0) {
              e.vel = v2mul(e.vel, 0.6); // freeze briefly
            } else {
              // Pounce
              e.vel = v2mul(dirToPlayer, e.speed * 2.3);
              if (distToPlayer < 100 || e.phaseTimer < -0.8) {
                // Struck or overshoot — retreat
                e.phase = 2;
                e.phaseTimer = randRange(1.2, 2.0);
                // Pick a new hide spot near obstacles (just offset from current)
                const hideAngle = Math.random() * Math.PI * 2;
                e.aggroOrigin = v2(
                  e.pos.x + Math.cos(hideAngle) * randRange(150, 280),
                  e.pos.y + Math.sin(hideAngle) * randRange(150, 280),
                );
              }
            }
          } else {
            // Retreat to hide spot
            const toHide = v2sub(e.aggroOrigin, e.pos);
            e.vel = v2mul(v2norm(toHide), e.speed * 1.3);
            if (v2len(toHide) < 60 || e.phaseTimer <= 0) {
              e.phase = 0;
            }
          }
          break;
        }

        case 'patrol_river': {
          // Unpredictable zigzag patrol; occasionally rushes at player
          e.flankTimer -= dt;
          if (e.flankTimer <= 0) {
            // Pick a new patrol angle with some bias toward player
            const bias = Math.atan2(toTarget.y, toTarget.x);
            const spread = Math.PI * 0.9;
            e.lockAngle = bias + (Math.random() - 0.5) * spread;
            e.flankTimer = randRange(1.0, 3.0);
          }
          if (distToPlayer < 180) {
            // Engage: rush and circle
            const perp = v2(-dirToPlayer.y * e.strafeDir, dirToPlayer.x * e.strafeDir);
            e.vel = v2mul(v2norm(v2add(dirToPlayer, perp)), e.speed * 0.85);
            // Random strafe flip
            e.strafeTimer -= dt;
            if (e.strafeTimer <= 0) {
              e.strafeDir *= -1;
              e.strafeTimer = randRange(0.8, 2.0);
            }
          } else {
            // Patrol along current angle
            e.vel = v2mul(v2fromAngle(e.lockAngle), e.speed * 0.75);
          }
          break;
        }

        default:
          e.vel = v2mul(dirToPlayer, e.speed);
      }
      } // end non-wounded block

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
        // Charge rush knockback: shove player away
        if (e.behavior === 'charge' && e.phase === 2) {
          const kbDir = v2norm(v2sub(player.pos, e.pos));
          player.pos.x = Math.max(player.radius, Math.min(WORLD_W - player.radius, player.pos.x + kbDir.x * 90));
          player.pos.y = Math.max(player.radius, Math.min(WORLD_H - player.radius, player.pos.y + kbDir.y * 90));
        }
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
