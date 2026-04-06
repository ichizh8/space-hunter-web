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
  burnTimer: number;
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
  // Elite-specific aggro/attack state
  eliteChargeTimer: number;    // cooldown for long-range charge attack; 0 = ready
  eliteAttackTimer: number;    // time until next attack fires
  eliteAttackCycle: number;    // which attack fires next: 0=aoe, 1=dash, 2=burst (cycles)
  eliteSummonTimer: number;    // 15s cooldown for summoning minions
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
    burnTimer: 0,
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
    eliteChargeTimer: 0,
    eliteAttackTimer: 3.0,
    eliteAttackCycle: 0,
    eliteSummonTimer: 15,
  };
}

export class EnemySystem {
  enemies: Enemy[] = [];
  enemyBullets: Array<{ pos: Vec2; vel: Vec2; radius: number; damage: number; life: number; color: number }> = [];
  _pendingSummons: Vec2[] = [];
  _pendingImpacts: Vec2[] = [];

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
      const def = CREATURE_DEFS[name];
      const aggroed = Math.random() < 0.6;

      if (def?.behavior === 'pack') {
        // Spawn a cluster of 3-5 pack enemies together
        const packSize = randInt(3, 5);
        for (let p = 0; p < packSize; p++) {
          const offset = v2(
            (Math.random() - 0.5) * 80,
            (Math.random() - 0.5) * 80,
          );
          this.enemies.push(createEnemy(name, v2add(pos, offset), aggroed));
        }
        // Spawning a pack counts as one wave slot; skip remaining pack members
        continue;
      }

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
          // Orbit near player if no targets, do not stack on top of them
          const offset = v2sub(e.pos, player.pos);
          const dist = v2len(offset);
          if (dist < 90) {
            const away = dist > 0.5 ? v2norm(offset) : v2fromAngle(Math.random() * Math.PI * 2);
            e.vel = v2mul(away, e.speed * 0.8);
          } else if (dist > 150) {
            const dir = v2norm(v2sub(player.pos, e.pos));
            e.vel = v2mul(dir, e.speed * 0.45);
          } else {
            const tangent = v2fromAngle(Math.atan2(offset.y, offset.x) + Math.PI / 2);
            e.vel = v2mul(tangent, e.speed * 0.4);
          }
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

      // Leash check (elites never de-aggro)
      if (!e.isElite && e.isAggroed && v2dist(e.pos, e.aggroOrigin) > e.leash && distToPlayer > e.detection) {
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

        case 'elite': {
          // Aggro lock: always move toward player, no leash/de-aggro
          e.isAggroed = true;

          // Direct-to-player direction (ignores decoys)
          const eliteToPlayer = v2sub(player.pos, e.pos);
          const eliteDist = v2len(eliteToPlayer);
          const eliteDir = eliteDist > 0.5 ? v2norm(eliteToPlayer) : v2fromAngle(0);

          // Summon minions every 15s
          e.eliteSummonTimer -= dt;
          if (e.eliteSummonTimer <= 0) {
            e.eliteSummonTimer = 15;
            const minionCount = 2 + Math.floor(Math.random() * 2);
            for (let mi = 0; mi < minionCount; mi++) {
              const mAngle = Math.random() * Math.PI * 2;
              const mDist = 50 + Math.random() * 80;
              this._pendingSummons.push(v2(
                e.pos.x + Math.cos(mAngle) * mDist,
                e.pos.y + Math.sin(mAngle) * mDist,
              ));
            }
            e.hitFlash = 0.1;
          }

          e.phaseTimer -= dt;
          e.eliteAttackTimer -= dt;
          e.eliteChargeTimer = Math.max(0, e.eliteChargeTimer - dt);

          if (e.phase === 0) {
            // Long-range charge when far from player (takes priority over normal attacks)
            if (e.eliteChargeTimer <= 0 && eliteDist > 400) {
              e.phase = 30;
              e.phaseTimer = 1.5;
              e.aggroOrigin = v2(player.pos.x, player.pos.y); // lock target now
              e.vel = v2(0, 0);
            } else {
            // Default: charge toward player at 35% speed bonus
            e.vel = v2mul(eliteDir, e.speed * 1.35);

            if (e.eliteAttackTimer <= 0) {
              const attackType = e.eliteAttackCycle % 3;
              e.eliteAttackCycle++;

              if (attackType === 0) {
                // AOE Slam — initiate regardless; move toward player first if needed
                e.phase = 10;
                e.phaseTimer = 0.8;
                e.vel = v2(0, 0);
              } else if (attackType === 1) {
                // Dash Attack — lock direction toward current player pos
                e.phase = 20;
                e.phaseTimer = 0.5;
                e.lockAngle = Math.atan2(eliteToPlayer.y, eliteToPlayer.x);
                e.vel = v2mul(e.vel, 0.2);
              } else {
                // Projectile Burst — fire immediately and reset timer
                const spreadCount = 5 + Math.floor(Math.random() * 4);
                const baseAngle = Math.atan2(eliteToPlayer.y, eliteToPlayer.x);
                const spread = Math.PI / 3;
                for (let si = 0; si < spreadCount; si++) {
                  const a = baseAngle - spread / 2 + (si / Math.max(1, spreadCount - 1)) * spread;
                  this.enemyBullets.push({
                    pos: v2(e.pos.x, e.pos.y),
                    vel: v2fromAngle(a, 230),
                    radius: 5,
                    damage: Math.max(1, Math.round(e.meleeDmg * 0.7)),
                    life: 2.5,
                    color: 0xff4400,
                  });
                }
                e.hitFlash = 0.08;
                e.eliteAttackTimer = randRange(3, 6);
              }
            }
            } // end else (not charging)
          } else if (e.phase === 10) {
            // AOE charge: slow drift toward player, expanding pulse visual
            e.vel = v2mul(eliteDir, e.speed * 0.3);
            e.hitFlash = 0.04 + Math.sin(e.phaseTimer * 20) * 0.03;
            if (e.phaseTimer <= 0) {
              // Detonate
              e.phase = 11;
              e.phaseTimer = 0.2;
              if (eliteDist < 120 + e.radius) {
                player.takeDamage(e.meleeDmg * 2);
              }
              e.meleeCooldown = 0.8; // suppress normal melee right after
            }
          } else if (e.phase === 11) {
            // AOE flash
            e.hitFlash = e.phaseTimer / 0.2 * 0.4;
            e.vel = v2mul(e.vel, 0.5);
            if (e.phaseTimer <= 0) {
              e.phase = 0;
              e.eliteAttackTimer = randRange(3, 6);
            }
          } else if (e.phase === 20) {
            // Dash charge: freeze, lock angle already set
            e.vel = v2mul(e.vel, 0.6);
            if (e.phaseTimer <= 0) {
              e.phase = 21;
              e.phaseTimer = 0.45;
            }
          } else if (e.phase === 21) {
            // Dashing at 3x speed
            e.vel = v2mul(v2fromAngle(e.lockAngle), e.speed * 3.0);
            // Damage on close pass (meleeCooldown prevents spamming)
            if (eliteDist < 35 + e.radius + player.radius && e.meleeCooldown <= 0) {
              player.takeDamage(e.meleeDmg * 1.5);
              e.meleeCooldown = 0.5;
            }
            if (e.phaseTimer <= 0) {
              e.phase = 22;
              e.phaseTimer = 0.4;
            }
          } else if (e.phase === 22) {
            // Dash recovery: brake
            e.vel = v2mul(e.vel, 0.75);
            if (e.phaseTimer <= 0) {
              e.phase = 0;
              e.eliteAttackTimer = randRange(2, 5);
            }
          } else if (e.phase === 30) {
            // Long-range charge wind-up: stop moving, glow brighter
            // aggroOrigin holds the locked target position (set when phase started)
            e.vel = v2(0, 0);
            e.hitFlash = 0.05 + Math.abs(Math.sin(e.phaseTimer * 10)) * 0.12;
            if (e.phaseTimer <= 0) {
              // Lock angle toward stored target
              const cdx = e.aggroOrigin.x - e.pos.x;
              const cdy = e.aggroOrigin.y - e.pos.y;
              e.lockAngle = Math.atan2(cdy, cdx);
              e.phase = 31;
              e.phaseTimer = 0.3;
            }
          } else if (e.phase === 31) {
            // Charging at extreme speed toward locked target position
            e.vel = v2fromAngle(e.lockAngle, 2000);
            const distToTarget = v2dist(e.pos, e.aggroOrigin);
            // Impact when close to target OR time runs out
            if (distToTarget < 100 + e.radius || e.phaseTimer <= 0) {
              // AOE damage in 80px radius
              if (v2dist(e.pos, player.pos) < 80 + e.radius + player.radius) {
                player.takeDamage(e.meleeDmg * 2);
              }
              this._pendingImpacts.push(v2(e.aggroOrigin.x, e.aggroOrigin.y));
              e.phase = 32;
              e.phaseTimer = 0.8;
              e.vel = v2(0, 0);
              e.meleeCooldown = 0.8;
              e.eliteChargeTimer = 8 + Math.random() * 4; // 8-12s cooldown
            }
          } else if (e.phase === 32) {
            // Charge recovery: slow movement, briefly vulnerable
            e.vel = v2mul(eliteDir, e.speed * 0.5);
            if (e.phaseTimer <= 0) {
              e.phase = 0;
              e.eliteAttackTimer = randRange(2, 4);
            }
          }
          break;
        }

        default: {
          // Stop at melee range; strafe instead of stacking
          const meleeStop = ENEMY_MELEE_RANGE + e.radius + player.radius;
          if (distToPlayer > meleeStop + 10) {
            e.vel = v2mul(dirToPlayer, e.speed);
          } else {
            // At melee range — strafe laterally so enemy doesn't push into player
            e.strafeTimer -= dt;
            if (e.strafeTimer <= 0) {
              e.strafeDir *= -1;
              e.strafeTimer = randRange(0.8, 2.0);
            }
            const perp = v2(-dirToPlayer.y * e.strafeDir, dirToPlayer.x * e.strafeDir);
            e.vel = v2mul(perp, e.speed * 0.5);
          }
          break;
        }
      }
      } // end non-wounded block

      // Move with collision
      const newX = e.pos.x + e.vel.x * dt;
      const newY = e.pos.y + e.vel.y * dt;
      if (!map.isBlocked(newX, e.pos.y, e.radius)) e.pos.x = newX;
      if (!map.isBlocked(e.pos.x, newY, e.radius)) e.pos.y = newY;
      e.pos.x = Math.max(e.radius, Math.min(WORLD_W - e.radius, e.pos.x));
      e.pos.y = Math.max(e.radius, Math.min(WORLD_H - e.radius, e.pos.y));

      // Enforce minimum distance from player — prevent stacking on top of player
      const minPlayerDist = e.radius + player.radius + 2;
      if (distToPlayer < minPlayerDist) {
        const repulseDir = distToPlayer > 0.5
          ? v2norm(v2sub(e.pos, player.pos))
          : v2fromAngle(Math.random() * Math.PI * 2);
        const overlap = minPlayerDist - distToPlayer;
        e.pos.x += repulseDir.x * overlap;
        e.pos.y += repulseDir.y * overlap;
      }

      // Melee attack, allies never hit the player
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

      // Player auto-targeting and projectiles should ignore Pack/Familiar allies, they are friendly summons
      if (e.isAlly) continue;

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

    // Spawn elite-summoned minions after main loop (safe to push now)
    for (const spawnPos of this._pendingSummons) {
      const biome = map.getBiome(spawnPos.x, spawnPos.y);
      const pool = BIOME_POOLS[biome] || BIOME_POOLS.open;
      const name = pick(pool);
      this.enemies.push(createEnemy(name, spawnPos, true));
    }
    this._pendingSummons = [];

    // Enemy-to-enemy separation — prevent stacking on each other
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i];
      if (a.hp <= 0) continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j];
        if (b.hp <= 0) continue;
        const sep = v2dist(a.pos, b.pos);
        const minSep = a.radius + b.radius + 2;
        if (sep < minSep && sep > 0.1) {
          const push = v2norm(v2sub(a.pos, b.pos));
          const half = (minSep - sep) * 0.5;
          a.pos.x += push.x * half;
          a.pos.y += push.y * half;
          b.pos.x -= push.x * half;
          b.pos.y -= push.y * half;
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
