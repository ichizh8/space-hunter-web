import { Graphics } from 'pixi.js';
import { v2, v2add, v2mul, v2len, v2dist, v2sub, v2norm, v2fromAngle, lineSegHitsCircle, randRange } from '../lib/math';
import { WORLD_W, WORLD_H, PLAYER_COLOR } from './constants';
import { CREATURE_DEFS } from '../data/creatures';
import type { Enemy } from './Enemies';
import type { Game } from './Game';

export class BulletSystem {
  /** Process bullet mastery effects, collision detection, explosions, and screen flash. */
  processHits(dt: number, game: Game): void {
    // vs_trail/vs_slow mastery: sniper void bullet drops corruption trail zones each frame
    if (game.player.weaponId === 'sniper_carbine' && game.player.mutated === 'void') {
      const trailLife = game.hasMod('vs_trail') ? 4 : 2;
      const trailSlowing = game.hasMod('vs_slow');
      for (const _tb of game.weapons.bullets) {
        if (_tb.tag !== 'sniper_trail') continue;
        if (Math.random() < 0.25) { // ~15 zones/s at 60fps — sparse enough to avoid spam
          game.smokeZones.push({
            x: _tb.pos.x, y: _tb.pos.y, radius: 22,
            life: trailLife, maxLife: trailLife,
            slowing: trailSlowing, corrupting: true,
          } as typeof game.smokeZones[number]);
        }
      }
    }
    // Swarm Chaos mastery (scatter void): pellets bounce off world walls once
    if (game.hasMod('swarm_chaos') && game.player.weaponId === 'scatter' && game.player.mutated === 'void') {
      for (const b of game.weapons.bullets) {
        if (!b.fromPlayer || b.aoeRadius > 0 || b.homing || b.tag || b._wallBounced) continue;
        const MARGIN = 5;
        let bounced = false;
        if (b.pos.x <= MARGIN || b.pos.x >= WORLD_W - MARGIN) { b.vel.x *= -1; bounced = true; }
        if (b.pos.y <= MARGIN || b.pos.y >= WORLD_H - MARGIN) { b.vel.y *= -1; bounced = true; }
        if (bounced) b._wallBounced = true;
      }
    }

    // Plasma Sword: anchor sweep to player's current position every frame
    const _PLASMA_DEG70 = 70 * Math.PI / 180;
    for (const b of game.weapons.bullets) {
      if (b.tag === 'plasma_slash' && b.aimAngle !== undefined) {
        // Track player so the sword moves with them
        b.pos.x = game.player.pos.x;
        b.pos.y = game.player.pos.y;
        const progress = 1 - (b.life / b.maxLife);
        const sweepAngle = b.aimAngle - _PLASMA_DEG70 + progress * (_PLASMA_DEG70 * 2);
        const outerDist = 110 + game.weapons.radiusBonus + (game.hasMod('wide_arc') ? 40 : 0);
        b.lineStart = v2(b.pos.x + Math.cos(sweepAngle) * 15, b.pos.y + Math.sin(sweepAngle) * 15);
        b.lineEnd   = v2(b.pos.x + Math.cos(sweepAngle) * outerDist, b.pos.y + Math.sin(sweepAngle) * outerDist);
      }
    }

    // Pulse Cannon: periodic AOE damage pulses during flight
    for (const b of game.weapons.bullets) {
      if (b.pulseTimer === undefined || b.life <= 0) continue;
      b.pulseTimer -= dt;
      if (b.pulseTimer <= 0) {
        b.pulseTimer = 0.5;
        const PULSE_RADIUS = 80;
        game.explosions.push({ x: b.pos.x, y: b.pos.y, radius: 0, maxRadius: PULSE_RADIUS, life: 0.35, maxLife: 0.35, type: 'pulse_ring' });
        for (const e of game.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          if (v2dist(b.pos, e.pos) < PULSE_RADIUS) {
            e.hp -= b.damage * 0.5;
            e.hitFlash = 0.1;
            e.isAggroed = true;
            game.damageDealt += b.damage * 0.5;
            if (e.hp <= 0) game.onEnemyKilled(e);
          }
        }
      }
    }

    // Bullet-enemy collision
    for (const bullet of game.weapons.bullets) {
      if (!bullet.fromPlayer) continue;

      // Laser beam: find enemies on line, sorted by distance
      if (bullet.tag === 'laser_beam' && bullet.lineStart && bullet.lineEnd) {
        // Collect all enemies on the beam line, sorted nearest first
        const beamHits: Array<{ enemy: Enemy; dist: number }> = [];
        for (const enemy of game.enemies.enemies) {
          if (enemy.hp <= 0 || enemy.isAlly || bullet.hitSet.has(enemy.id)) continue;
          if (!lineSegHitsCircle(bullet.lineStart, bullet.lineEnd, enemy.pos, enemy.radius + 4)) continue;
          beamHits.push({ enemy, dist: v2dist(bullet.lineStart, enemy.pos) });
        }
        beamHits.sort((a, b) => a.dist - b.dist);

        // How many enemies can we hit? 1 normally, 2 with laser_pierce
        const maxHits = bullet.piercing ? 2 : 1;
        let lastHitEnemy: Enemy | null = null;

        for (let hi = 0; hi < Math.min(beamHits.length, maxHits); hi++) {
          const { enemy: hitEnemy } = beamHits[hi];
          bullet.hitSet.add(hitEnemy.id);
          lastHitEnemy = hitEnemy;

          let finalDmg = bullet.damage;
          if (hitEnemy.markedTimer > 0) finalDmg = Math.floor(finalDmg * hitEnemy.markedDmgBonus);
          // headhunter mastery: +50% damage vs elites
          if (game.hasMod('headhunter') && hitEnemy.isElite) finalDmg = Math.floor(finalDmg * 1.5);
          // armor_pierce mastery: ignore armored affix
          if (hitEnemy.affixes.includes('armored') && !game.hasMod('armor_pierce')) finalDmg = Math.max(1, Math.floor(finalDmg * 0.5));
          if (hitEnemy.affixes.includes('shielded') && hitEnemy.shieldHp > 0) {
            if (hitEnemy.shieldHp >= finalDmg) { hitEnemy.shieldHp -= finalDmg; finalDmg = 0; }
            else { finalDmg -= hitEnemy.shieldHp; hitEnemy.shieldHp = 0; }
          }
          hitEnemy.hp -= finalDmg;
          hitEnemy.hitFlash = 0.1;
          // suppressor mastery: beam doesn't aggro undetected enemies
          if (!game.hasMod('suppressor') || hitEnemy.isAggroed) hitEnemy.isAggroed = true;
          game.damageDealt += bullet.damage;

          // Tracer Rounds: every 3rd hit marks enemy (+25% dmg from all sources 2s)
          if (game.weapons.laserMark) {
            game.weapons.laserHitCount++;
            if (game.weapons.laserHitCount >= 3) {
              game.weapons.laserHitCount = 0;
              hitEnemy.markedTimer = 2.0;
              hitEnemy.markedDmgBonus = 1.25;
              hitEnemy.hitFlash = 0.3; // stronger flash for mark
            }
          }

          // Entropy Beam (void sidearm): plant void seed on hit
          if (game.weapons.voidSeedOnHit) {
            hitEnemy.voidSeeds = (hitEnemy.voidSeeds ?? 0) + 1;
            // void_resonance mastery: each seed adds +5 corruption to enemy
            if (game.hasMod('void_resonance')) {
              const ec = game.enemyCorruption.get(hitEnemy.id) ?? 0;
              game.enemyCorruption.set(hitEnemy.id, ec + 5);
            }
            const seedThreshold = game.hasMod('deep_roots') ? 2 : 3;
            if (hitEnemy.voidSeeds >= seedThreshold) {
              hitEnemy.voidSeeds = 0;
              // AOE detonation: 80px, 5 damage
              for (const nearby of game.enemies.enemies) {
                if (nearby.hp <= 0 || nearby.isAlly || nearby === hitEnemy) continue;
                if (v2dist(hitEnemy.pos, nearby.pos) <= 80) {
                  nearby.hp -= 5;
                  nearby.hitFlash = 0.15;
                  if (nearby.hp <= 0) game.onEnemyKilled(nearby);
                  // seed_spread mastery: detonation plants 1 seed on nearby
                  if (game.hasMod('seed_spread')) nearby.voidSeeds = (nearby.voidSeeds ?? 0) + 1;
                }
              }
              // entropy_field mastery: detonation leaves 3s corruption zone
              if (game.hasMod('entropy_field')) {
                game.smokeZones.push({ x: hitEnemy.pos.x, y: hitEnemy.pos.y, radius: 50, life: 3, maxLife: 3, corruptionField: true, tickDamage: 0, pull: false } as typeof game.smokeZones[number]);
              }
              // VFX: purple explosion at enemy pos
              for (let _p = 0; _p < 12; _p++) {
                const pa = Math.random() * Math.PI * 2;
                const ps = 60 + Math.random() * 80;
                game.particles.push({ x: hitEnemy.pos.x, y: hitEnemy.pos.y, vx: Math.cos(pa) * ps, vy: Math.sin(pa) * ps, life: 0.5, maxLife: 0.5, radius: 3, color: 0xaa44ff });
              }
            }
          }

          if (hitEnemy.hp <= 0) {
            game.onEnemyKilled(hitEnemy);
            // killcam mastery: next shot fires instantly after kill
            if (game.hasMod('killcam')) game.killcamReady = true;
          }
        }

        // Shorten beam to stop at last hit enemy (or the furthest one we pierced through)
        if (lastHitEnemy) {
          const dir = v2norm(v2sub(bullet.lineEnd, bullet.lineStart));
          bullet.lineEnd = v2(lastHitEnemy.pos.x + dir.x * lastHitEnemy.radius, lastHitEnemy.pos.y + dir.y * lastHitEnemy.radius);
        }
        continue;
      }

      // Void beam: piercing line-hit (damages ALL enemies on the line)
      if (bullet.tag === 'void_beam' && bullet.lineStart && bullet.lineEnd) {
        for (const enemy of game.enemies.enemies) {
          if (enemy.hp <= 0 || enemy.isAlly || bullet.hitSet.has(enemy.id)) continue;
          const beamHitW = (enemy.radius + 4) * game.weapons.beamWidthMult;
          if (!lineSegHitsCircle(bullet.lineStart, bullet.lineEnd, enemy.pos, beamHitW)) continue;
          bullet.hitSet.add(enemy.id);
          let finalDmg = bullet.damage;
          if (enemy.markedTimer > 0) finalDmg = Math.floor(finalDmg * enemy.markedDmgBonus);
          if (enemy.affixes.includes('armored')) finalDmg = Math.max(1, Math.floor(finalDmg * 0.5));
          if (enemy.affixes.includes('shielded') && enemy.shieldHp > 0) {
            if (enemy.shieldHp >= finalDmg) { enemy.shieldHp -= finalDmg; finalDmg = 0; }
            else { finalDmg -= enemy.shieldHp; enemy.shieldHp = 0; }
          }
          // Entropy cannon corruption scaling
          if (game.player.weaponId === 'entropy_cannon') {
            const scaleMult = game.weapons.corruptionScaling ? (game.hasMod('res_scaling') ? 4 : 3) : 1;
            const enemyCorr = game.enemyCorruption.get(enemy.id) ?? 0;
            finalDmg *= (1 + scaleMult * game.player.corruption / 30) * (1 + enemyCorr * 0.02);
          }
          enemy.hp -= finalDmg;
          enemy.hitFlash = 0.08;
          enemy.isAggroed = true;
          // Siphon Link: beam on target gives player +2 corruption/s
          if (game.weapons.siphonLink) {
            game.player.corruption = Math.min(100, game.player.corruption + 2 * dt);
          }
          if (enemy.hp <= 0) game.onEnemyKilled(enemy);
        }
        continue;
      }

      for (const enemy of game.enemies.enemies) {
        if (enemy.hp <= 0 || enemy.isAlly) continue;
        // Plasma Sword line-slash: line-segment vs circle, bypass normal circle checkHit
        let dmg: number;
        let prevBounces = 0;
        if (bullet.tag === 'plasma_slash') {
          if (bullet.hitSet.has(enemy.id)) continue;
          if (!lineSegHitsCircle(bullet.lineStart!, bullet.lineEnd!, enemy.pos, enemy.radius + 8)) continue;
          bullet.hitSet.add(enemy.id);
          dmg = bullet.damage;
        } else {
          prevBounces = bullet.bounces;
          dmg = game.weapons.checkHit(bullet, enemy.id, enemy.pos, enemy.radius);
        }
        if (dmg > 0) {
          let finalDmg = dmg;
          // Aimed Shot mastery (lance clean): +50% damage when standing still
          if (game.hasMod('aimed_shot') && game.player.weaponId === 'lance' && v2len(game.player.vel) < 5) {
            finalDmg = Math.floor(finalDmg * 1.5);
          }
          // Vortex Damage mastery (lance void): +50% damage to enemies inside any gravity well
          if (game.hasMod('vortex_damage')) {
            for (const gw of game.gravityWells) {
              if (v2dist(enemy.pos, { x: gw.x, y: gw.y }) < gw.radius) { finalDmg = Math.floor(finalDmg * 1.5); break; }
            }
          }
          // Marked damage bonus
          if (enemy.markedTimer > 0) finalDmg = Math.floor(finalDmg * enemy.markedDmgBonus);
          // Shatter: frozen (cryo-stunned) enemies take +50% from non-flamethrower sources
          if (game.hasMod('shatter') && enemy.stunTimer > 0 && game.player.weaponId !== 'flamethrower') {
            finalDmg = Math.floor(finalDmg * 1.5);
          }
          // Affix: armored halves ranged damage
          if (enemy.affixes.includes('armored')) finalDmg = Math.max(1, Math.floor(finalDmg * 0.5));
          // Apex phase transition invulnerability
          if (enemy.id === game.apexId && game.apexPhaseTransitionTimer > 0) finalDmg = 0;
          // Apex phase 2 shield: 50% damage reduction
          if (enemy.id === game.apexId && game.apexShieldActive) finalDmg = Math.max(1, Math.floor(finalDmg * 0.5));
          // Affix: shielded absorbs damage
          if (enemy.affixes.includes('shielded') && enemy.shieldHp > 0) {
            if (enemy.shieldHp >= finalDmg) { enemy.shieldHp -= finalDmg; finalDmg = 0; }
            else { finalDmg -= enemy.shieldHp; enemy.shieldHp = 0; }
          }
          // Entropy cannon: corruption-scaling damage always active
          if (game.player.weaponId === 'entropy_cannon') {
            // res_scaling: x4 multiplier instead of x3; base: x1 (no scaling without mutation)
            const scaleMult = game.weapons.corruptionScaling ? (game.hasMod('res_scaling') ? 4 : 3) : 1;
            const enemyCorr = game.enemyCorruption.get(enemy.id) ?? 0;
            finalDmg *= (1 + scaleMult * game.player.corruption / 30) * (1 + enemyCorr * 0.02);
            // stable_crit: every 5th shot deals 2x damage
            if (game.hasMod('stable_crit') && game.entropyShotCount % 5 === 0 && game.entropyShotCount > 0) {
              finalDmg *= 2;
            }
            // res_burst: at 80+ corruption, shots create 40px AOE
            if (game.hasMod('res_burst') && game.player.corruption >= 80 && !bullet.hitSet.has(-998)) {
              bullet.hitSet.add(-998);
              game.explosions.push({ x: bullet.pos.x, y: bullet.pos.y, radius: 0, maxRadius: 40, life: 0.3, maxLife: 0.3 });
              for (const other of game.enemies.enemies) {
                if (other.id === enemy.id || other.isAlly || other.hp <= 0) continue;
                if (v2dist(bullet.pos, other.pos) < 40) {
                  other.hp -= finalDmg * 0.5;
                  other.hitFlash = 0.1;
                  other.isAggroed = true;
                  game.damageDealt += finalDmg * 0.5;
                  if (other.hp <= 0) game.onEnemyKilled(other);
                }
              }
            }
          }
          // Flamethrower: corruption_burst — at 80+ corruption the next hit deals 5x
          if (game.player.weaponId === 'flamethrower' && game.hasMod('corruption_burst') && game.corruptionBurstReady) {
            finalDmg *= 5;
            game.corruptionBurstReady = false;
          }
          // vs_damage mastery: sniper void shots deal +4 damage to enemies inside corruption trail
          if (game.hasMod('vs_damage') && bullet.tag === 'sniper_trail') {
            if (game.smokeZones.some(sz => sz.corrupting && v2dist(enemy.pos, { x: sz.x, y: sz.y }) < sz.radius)) {
              finalDmg += 4;
            }
          }
          // sp_damage mastery: chain rifle void +1 damage to slowed enemies
          if (game.hasMod('sp_damage') && game.player.weaponId === 'chain_rifle' && game.player.mutated === 'void') {
            const _baseSpd = CREATURE_DEFS[enemy.name]?.speed ?? enemy.speed;
            if (enemy.speed < _baseSpd * 0.95) finalDmg += 1;
          }
          // Killstreak: sniper consecutive hit bonus (+1 per hit, max +5)
          if (bullet.tag === 'sniper_trail' && game.weapons.killstreak >= 0) {
            finalDmg += Math.min(game.weapons.killstreak, 5);
            game.weapons.killstreak++;
          }
          // Execute threshold (sniper clean)
          if (game.weapons.executeThreshold > 0 && enemy.hp > 0 && (enemy.hp / enemy.maxHp) <= game.weapons.executeThreshold) {
            enemy.hp = 0;
          } else {
            enemy.hp -= finalDmg;
          }
          enemy.hitFlash = 0.1;
          enemy.isAggroed = true;
          game.damageDealt += dmg;
          // Cryo stun (flamethrower clean); deep_freeze upgrades duration 2s → 3s
          if (game.weapons.cryoStun) enemy.stunTimer = game.hasMod('deep_freeze') ? 3.0 : 2.0;
          // Slow on hit (chain rifle void); sp_slow mastery raises cap from 70% to 30% base speed
          if (game.weapons.slowOnHit && CREATURE_DEFS[enemy.name]) {
            const _slowMult = game.hasMod('sp_slow') ? 0.3 : 0.7;
            enemy.speed = Math.max(20, CREATURE_DEFS[enemy.name].speed * _slowMult);
          }
          // vs_burst mastery: sniper void headshot on elite creates 60px corruption burst
          if (game.hasMod('vs_burst') && bullet.tag === 'sniper_trail' && game.player.mutated === 'void' && enemy.isElite) {
            game.smokeZones.push({ x: enemy.pos.x, y: enemy.pos.y, radius: 60, life: 2, maxLife: 2, corrupting: true } as typeof game.smokeZones[number]);
            game.explosions.push({ x: enemy.pos.x, y: enemy.pos.y, radius: 0, maxRadius: 60, life: 0.3, maxLife: 0.3 });
          }
          // cascade mastery: fragments spawn 2 mini-fragments on hit (not on already-cascaded fragments)
          if (game.hasMod('cascade') && bullet.tag === 'fragment') {
            for (let _ci = 0; _ci < 2; _ci++) {
              const _ca = Math.random() * Math.PI * 2;
              game.weapons.bullets.push({
                pos: { x: enemy.pos.x, y: enemy.pos.y },
                vel: { x: Math.cos(_ca) * 180, y: Math.sin(_ca) * 180 },
                radius: 2, color: 0x6611cc, damage: Math.max(1, Math.floor(bullet.damage * 0.5)),
                life: 0.3, maxLife: 0.3,
                piercing: false, homing: false, bounces: 0, aoeRadius: 0,
                fromPlayer: true, hitSet: new Set(), tag: 'fragment_cascaded',
              });
            }
          }
          // entropy_field mastery: fragment hits leave a 0.5s damage patch
          if (game.hasMod('entropy_field') && (bullet.tag === 'fragment' || bullet.tag === 'fragment_cascaded')) {
            game.smokeZones.push({ x: enemy.pos.x, y: enemy.pos.y, radius: 18, life: 0.5, maxLife: 0.5, toxic: true } as typeof game.smokeZones[number]);
          }
          // Baton base knockback (55px) — core identity; Shockwave perk upgrades to 100px + stun
          if (game.player.weaponId === 'baton') {
            const kbDir = v2norm(v2sub(enemy.pos, game.player.pos));
            const kbDist = game.weapons.knockback ? 100 : 55;
            enemy.pos.x += kbDir.x * kbDist;
            enemy.pos.y += kbDir.y * kbDist;
            if (game.weapons.knockback) enemy.stunTimer = Math.max(enemy.stunTimer, 0.5);

            // Arc field on hit (baton clean mutation: Arc Blade)
            if (game.weapons.slowFieldOnLand) {
              const fieldDur = game.hasMod('field_persist') ? 5 : 3;
              game.smokeZones.push({ x: enemy.pos.x, y: enemy.pos.y, radius: 80, life: fieldDur, maxLife: fieldDur, slowing: true });
              // field_chain: jump damage to nearest other enemy within 120px
              if (game.hasMod('field_chain')) {
                let fcBest = 120; let fcTarget: Enemy | null = null;
                for (const other of game.enemies.enemies) {
                  if (other === enemy || other.hp <= 0 || other.isAlly) continue;
                  const fcD = v2dist(enemy.pos, other.pos);
                  if (fcD < fcBest) { fcBest = fcD; fcTarget = other; }
                }
                if (fcTarget) {
                  const jumpDmg = Math.max(1, Math.floor(bullet.damage * 0.5));
                  fcTarget.hp -= jumpDmg;
                  fcTarget.hitFlash = 0.1;
                  game.damageDealt += jumpDmg;
                  if (fcTarget.hp <= 0) game.onEnemyKilled(fcTarget);
                }
              }
            }

            // Void vortex spawn on hit (baton void mutation: Consuming Vortex)
            if (game.weapons.lifesteal) {
              const vortexLife = game.hasMod('vortex_speed') ? 1.0 : 1.5;
              game.batonVortices.push({ x: enemy.pos.x, y: enemy.pos.y, currentRadius: 0, maxRadius: 80, life: vortexLife, maxLife: vortexLife, shockwaveFired: false });
            }

            // deep_drain: heal 1 HP per 2 enemies hit/drained
            if (game.hasMod('deep_drain')) {
              game.batonDrainCounter++;
              if (game.batonDrainCounter >= 2) {
                game.batonDrainCounter -= 2;
                game.player.hp = Math.min(game.player.hp + 1, game.player.maxHp);
              }
            }

            // static_charge: 3rd hit in 3s fires free AOE pulse at player
            if (game.hasMod('static_charge')) {
              game.batonHitTimes.push(game.elapsed);
              game.batonHitTimes = game.batonHitTimes.filter(t => game.elapsed - t <= 3);
              if (game.batonHitTimes.length >= 3) {
                game.batonHitTimes = [];
                const SC_RADIUS = 80;
                game.explosions.push({ x: game.player.pos.x, y: game.player.pos.y, radius: 0, maxRadius: SC_RADIUS, life: 0.35, maxLife: 0.35 });
                for (const other of game.enemies.enemies) {
                  if (other.hp <= 0 || other.isAlly) continue;
                  if (v2dist(game.player.pos, other.pos) < SC_RADIUS) {
                    other.hp -= 3;
                    other.hitFlash = 0.2;
                    game.damageDealt += 3;
                    if (other.hp <= 0) game.onEnemyKilled(other);
                  }
                }
                game.hud.showMessage('STATIC CHARGE!', 1);
              }
            }
          }
          // Lifesteal (baton void) — base per-hit heal
          if (game.weapons.lifesteal) {
            game.player.hp = Math.min(game.player.hp + 1, game.player.maxHp);
          }
          // Singularity on hit (lance void) — mastery perks: nested_vortex (+50% pull), void_attractor (+1s)
          if (game.weapons.singularityOnHit) {
            const pullSpeed = game.hasMod('nested_vortex') ? 180 : 120;
            const vortexLife = game.hasMod('void_attractor') ? 3 : 2;
            game.gravityWells.push({ x: bullet.pos.x, y: bullet.pos.y, radius: 200, life: vortexLife, maxLife: vortexLife, pullSpeed });
          }
          // Slow Field on hit (lance clean mutation) — mastery perks: slow_field_persist (+2s), field_expand (+40px)
          if (game.weapons.slowFieldOnLand && game.player.weaponId === 'lance') {
            const sfLife = game.hasMod('slow_field_persist') ? 5 : 3;
            const sfRadius = 80 + (game.hasMod('field_expand') ? 40 : 0);
            game.smokeZones.push({ x: enemy.pos.x, y: enemy.pos.y, radius: sfRadius, life: sfLife, maxLife: sfLife, slowing: true });
          }
          // Stagger mastery (scatter clean): 15% chance to stun 0.5s per pellet
          if (game.hasMod('stagger') && game.player.weaponId === 'scatter' && Math.random() < 0.15) {
            enemy.stunTimer = Math.max(enemy.stunTimer, 0.5);
          }
          // Contagion mastery (scatter void): chaos pellets spread burn DoT to enemies within 80px
          if (game.hasMod('contagion') && game.player.weaponId === 'scatter' && game.player.mutated === 'void') {
            for (const other of game.enemies.enemies) {
              if (other.id !== enemy.id && other.hp > 0 && !other.isAlly && v2dist(bullet.pos, other.pos) < 80) {
                other.burnTimer = Math.max(other.burnTimer, 2);
              }
            }
          }
          // Payload mastery (dart clean): missile explodes on impact 50px AOE
          if (game.hasMod('payload') && game.player.weaponId === 'dart' && bullet.homing) {
            const PAYLOAD_R = 50;
            game.explosions.push({ x: bullet.pos.x, y: bullet.pos.y, radius: 0, maxRadius: PAYLOAD_R, life: 0.3, maxLife: 0.3 });
            for (const other of game.enemies.enemies) {
              if (other.id !== enemy.id && other.hp > 0 && !other.isAlly && v2dist(bullet.pos, other.pos) < PAYLOAD_R) {
                const splashDmg = Math.max(1, Math.floor(bullet.damage * 0.5));
                other.hp -= splashDmg;
                other.hitFlash = 0.1;
                other.isAggroed = true;
                game.damageDealt += splashDmg;
                if (other.hp <= 0) game.onEnemyKilled(other);
              }
            }
          }
          // Parasite on hit (dart void mutation)
          if (game.weapons.parasiteOnHit && game.player.weaponId === 'dart' && bullet.homing) {
            const dur = game.weapons.parasiteDuration;
            if (enemy.parasiteTimer <= 0) {
              // First application: void_latch reduces meleeDmg 20%
              if (game.hasMod('void_latch') && !game.voidLatchOriginalDamage.has(enemy.id)) {
                game.voidLatchOriginalDamage.set(enemy.id, enemy.meleeDmg);
                enemy.meleeDmg = Math.max(0, Math.floor(enemy.meleeDmg * 0.8));
              }
            }
            enemy.parasiteTimer = Math.max(enemy.parasiteTimer, dur);
          }
          // Corruption on fire (flamethrower void); corr_efficiency reduces gain
          if (game.weapons.corruptionOnFire) {
            const corrGain = game.hasMod('corr_efficiency') ? 0.25 : 0.5;
            game.player.corruption = Math.min(100, game.player.corruption + corrGain);
          }
          // Flamethrower burn DoT — always active; Napalm perk upgrades from 2 to 3 dmg/s
          if (game.player.weaponId === 'flamethrower') {
            enemy.burnTimer = 3; // refresh duration; 2 dmg/s base (3 with Napalm)
          }
          // Pulse cannon bounce mastery effects
          if (game.player.weaponId === 'pulse_cannon') {
            const pulseBounced = !bullet.piercing && bullet.life > 0 && bullet.tag !== 'plasma_slash';
            const pulseFinalHit = !bullet.piercing && bullet.life <= 0 && prevBounces === 0;
            if (pulseBounced) {
              // oc_damage: +2 damage per bounce
              if (game.hasMod('oc_damage')) bullet.damage += 2;
              // vc_corrupt: apply corruption buildup to hit enemy (base 2 from voidBounce, 5 with vc_corrupt)
              if (game.weapons.voidBounce) {
                const corrAmt = game.hasMod('vc_corrupt') ? 5 : 2;
                game.enemyCorruption.set(enemy.id, (game.enemyCorruption.get(enemy.id) ?? 0) + corrAmt);
              }
              // vc_slow: slow enemy 20% on each bounce
              if (game.hasMod('vc_slow') && CREATURE_DEFS[enemy.name]) {
                enemy.speed = Math.max(20, CREATURE_DEFS[enemy.name].speed * 0.8);
              }
              // vc_drain: heal 0.5 HP per bounce (every 2 bounces = 1 HP)
              if (game.hasMod('vc_drain')) {
                game.vcDrainAccum += 0.5;
                if (game.vcDrainAccum >= 1) {
                  game.vcDrainAccum -= 1;
                  game.player.hp = Math.min(game.player.hp + 1, game.player.maxHp);
                }
              }
            }
            // oc_chain: final bounce creates 40px AOE explosion
            if (pulseFinalHit && game.hasMod('oc_chain')) {
              game.explosions.push({ x: bullet.pos.x, y: bullet.pos.y, radius: 0, maxRadius: 40, life: 0.35, maxLife: 0.35 });
              for (const other of game.enemies.enemies) {
                if (other.id === enemy.id || other.isAlly || other.hp <= 0) continue;
                if (v2dist(bullet.pos, other.pos) < 40) {
                  other.hp -= bullet.damage;
                  other.hitFlash = 0.1;
                  other.isAggroed = true;
                  game.damageDealt += bullet.damage;
                  if (other.hp <= 0) game.onEnemyKilled(other);
                }
              }
            }
          }
          // Conductor perk: ricochet off stunned enemies
          if (game.hasPerk('conductor') && enemy.stunTimer > 0 && !(bullet as unknown as { ricocheted?: boolean }).ricocheted) {
            let ricBest = 200; let ricTarget: Enemy | null = null;
            for (const other of game.enemies.enemies) {
              if (other === enemy || other.hp <= 0 || other.isAlly) continue;
              const rd = v2dist(enemy.pos, other.pos);
              if (rd < ricBest) { ricBest = rd; ricTarget = other; }
            }
            if (ricTarget) {
              const ricDir = v2norm(v2sub(ricTarget.pos, enemy.pos));
              game.weapons.bullets.push({
                pos: { x: enemy.pos.x, y: enemy.pos.y },
                vel: { x: ricDir.x * 350, y: ricDir.y * 350 },
                radius: bullet.radius, color: 0x33ccff,
                damage: Math.max(1, Math.floor(finalDmg * 0.5)),
                life: 0.4, maxLife: 0.4,
                piercing: false, homing: false, bounces: 0, aoeRadius: 0,
                fromPlayer: true, hitSet: new Set(),
              });
            }
          }
          // Spawn explosion visual for AOE bullets (grenade)
          if (bullet.aoeRadius > 0 && !bullet.hitSet.has(-999)) {
            bullet.hitSet.add(-999); // prevent duplicate explosions
            game.explosions.push({
              x: bullet.pos.x, y: bullet.pos.y,
              radius: 0, maxRadius: bullet.aoeRadius,
              life: 0.4, maxLife: 0.4,
            });
            // AOE: damage all enemies in radius
            for (const other of game.enemies.enemies) {
              if (other.id === enemy.id || other.isAlly || other.hp <= 0) continue;
              if (v2dist(bullet.pos, other.pos) < bullet.aoeRadius) {
                other.hp -= dmg;
                other.hitFlash = 0.1;
                other.isAggroed = true;
                game.damageDealt += dmg;
                // Concussion mastery (grenade clean): stun 1s
                if (game.hasMod('concussion') && game.player.weaponId === 'grenade_launcher') {
                  other.stunTimer = Math.max(other.stunTimer, 1.0);
                }
                if (other.hp <= 0) {
                  // Cascade Void mastery: enemy killed inside corruption zone spawns mini zone
                  if (game.hasMod('cascade_void') && game.player.weaponId === 'grenade_launcher') {
                    const inCorruptionZone = game.smokeZones.some(sz => sz.corruptionField && v2dist(other.pos, { x: sz.x, y: sz.y }) < sz.radius);
                    if (inCorruptionZone) {
                      game.smokeZones.push({ x: other.pos.x, y: other.pos.y, radius: 60, life: 3, maxLife: 3, corruptionField: true, tickDamage: game.hasMod('zone_damage') ? 2 : 0, pull: game.hasMod('void_pull') });
                    }
                  }
                  game.onEnemyKilled(other);
                }
              }
            }
            // Also stun and apply concussion to the directly-hit enemy
            if (game.hasMod('concussion') && game.player.weaponId === 'grenade_launcher') {
              enemy.stunTimer = Math.max(enemy.stunTimer, 1.0);
            }
            // Void Grenade mutation: leave corruption zone at explosion site
            if (game.weapons.corruptionZoneOnExplode && game.player.weaponId === 'grenade_launcher') {
              const czRadius = 80 + (game.hasMod('corr_zone_expand') ? 40 : 0);
              game.smokeZones.push({ x: bullet.pos.x, y: bullet.pos.y, radius: czRadius, life: 5, maxLife: 5, corruptionField: true, tickDamage: game.hasMod('zone_damage') ? 2 : 0, pull: game.hasMod('void_pull') });
            }
            bullet.life = 0; // consume bullet after explosion
          }
          if (enemy.hp <= 0) {
            game.onEnemyKilled(enemy);
            // ks_chain mastery: sniper kill resets fire cooldown
            if (game.hasMod('ks_chain') && bullet.tag === 'sniper_trail') {
              game.player.fireCooldown = 0;
            }
          }
        }
      }
    }

    // Plasma Sword Deflect: blade arc destroys enemy projectiles and reflects them at enemies
    if (game.weapons.deflect) {
      for (const pb of game.weapons.bullets) {
        if (pb.tag !== 'plasma_slash' || !pb.lineStart || !pb.lineEnd) continue;
        for (let bi = game.enemies.enemyBullets.length - 1; bi >= 0; bi--) {
          const eb = game.enemies.enemyBullets[bi];
          if (!lineSegHitsCircle(pb.lineStart, pb.lineEnd, eb.pos, eb.radius + 6)) continue;
          const ebPos = v2(eb.pos.x, eb.pos.y);
          game.enemies.enemyBullets.splice(bi, 1);
          // Reflect toward nearest enemy
          let nearestEnemy: Enemy | null = null;
          let nearestDist = Infinity;
          for (const e of game.enemies.enemies) {
            if (e.hp <= 0 || e.isAlly) continue;
            const d = v2dist(ebPos, e.pos);
            if (d < nearestDist) { nearestDist = d; nearestEnemy = e; }
          }
          if (nearestEnemy) {
            const dir = v2norm(v2sub(nearestEnemy.pos, ebPos));
            const spd = Math.max(v2len(eb.vel), 300) * 1.5;
            game.weapons.bullets.push({
              pos: ebPos,
              vel: v2mul(dir, spd),
              radius: eb.radius,
              color: 0x00eeff,
              damage: eb.damage * 2,
              life: 2.0, maxLife: 2.0,
              piercing: false, homing: false, bounces: 0, aoeRadius: 0,
              fromPlayer: true, hitSet: new Set(),
              tag: 'deflected',
            });
          }
        }
      }
    }

    // Burn DoT tick — 2 dmg/s base, 3 dmg/s with Napalm perk, refreshed on hit
    const burnDmgPerSec = game.weapons.burnOnHit ? 3 : 2;
    for (const enemy of game.enemies.enemies) {
      if (enemy.burnTimer > 0) {
        enemy.burnTimer -= dt;
        enemy.hp -= burnDmgPerSec * dt;
        enemy.hitFlash = Math.max(enemy.hitFlash, 0.05);
        if (enemy.hp <= 0) game.onEnemyKilled(enemy);
      }
    }

    // Mastery per-frame effects
    // cryo_aura: enemies within 80px of a frozen (cryo-stunned) enemy are slowed 30%
    if (game.hasMod('cryo_aura')) {
      for (const e of game.enemies.enemies) {
        if (e.stunTimer <= 0 || e.isAlly) continue;
        for (const other of game.enemies.enemies) {
          if (other.id === e.id || other.isAlly || other.hp <= 0 || other.stunTimer > 0) continue;
          if (v2dist(e.pos, other.pos) < 80 && CREATURE_DEFS[other.name]) {
            other.speed = Math.max(20, CREATURE_DEFS[other.name].speed * 0.7);
          }
        }
      }
    }
    // corruption_burst: arm the burst flag whenever player corruption >= 80 (resets on use)
    if (game.hasMod('corruption_burst') && game.player.weaponId === 'flamethrower' && game.player.corruption >= 80) {
      game.corruptionBurstReady = true;
    }

    // Process shatter bounce shockwaves (pulse cannon perk)
    for (const sb of game.weapons.shatterBounceQueue) {
      for (const enemy of game.enemies.enemies) {
        if (enemy.hp <= 0 || enemy.isAlly) continue;
        if (v2dist({ x: sb.x, y: sb.y }, enemy.pos) <= 20) {
          enemy.hp -= 1;
          enemy.hitFlash = 0.08;
          if (enemy.hp <= 0) game.onEnemyKilled(enemy);
        }
      }
      // VFX: small blue shockwave
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        game.particles.push({ x: sb.x, y: sb.y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, life: 0.25, maxLife: 0.25, radius: 2, color: 0x44aaff });
      }
    }
    game.weapons.shatterBounceQueue = [];

    // Remove dead enemies
    game.enemies.enemies = game.enemies.enemies.filter(e => e.hp > 0);

    // Remove expired bullets — AOE bullets explode on expiry (grenade landing)
    for (const b of game.weapons.bullets) {
      if (b.life <= 0 && b.aoeRadius > 0 && !b.hitSet.has(-999)) {
        b.hitSet.add(-999);
        game.explosions.push({
          x: b.pos.x, y: b.pos.y,
          radius: 0, maxRadius: b.aoeRadius,
          life: 0.4, maxLife: 0.4,
        });
        // AOE damage at landing point
        for (const enemy of game.enemies.enemies) {
          if (v2dist(b.pos, enemy.pos) < b.aoeRadius) {
            enemy.hp -= b.damage;
            enemy.hitFlash = 0.1;
            enemy.isAggroed = true;
            game.damageDealt += b.damage;
            // Concussion mastery (grenade clean): stun 1s
            if (game.hasMod('concussion') && game.player.weaponId === 'grenade_launcher') {
              enemy.stunTimer = Math.max(enemy.stunTimer, 1.0);
            }
            if (enemy.hp <= 0) {
              // Cascade Void mastery: kill inside corruption zone spawns mini zone
              if (game.hasMod('cascade_void') && game.player.weaponId === 'grenade_launcher') {
                const inCorruptionZone = game.smokeZones.some(sz => sz.corruptionField && v2dist(enemy.pos, { x: sz.x, y: sz.y }) < sz.radius);
                if (inCorruptionZone) {
                  game.smokeZones.push({ x: enemy.pos.x, y: enemy.pos.y, radius: 60, life: 3, maxLife: 3, corruptionField: true, tickDamage: game.hasMod('zone_damage') ? 2 : 0, pull: game.hasMod('void_pull') });
                }
              }
              game.onEnemyKilled(enemy);
            }
          }
        }
        // Void Grenade mutation: leave corruption zone at landing site
        if (game.weapons.corruptionZoneOnExplode && game.player.weaponId === 'grenade_launcher') {
          const czRadius = 80 + (game.hasMod('corr_zone_expand') ? 40 : 0);
          game.smokeZones.push({ x: b.pos.x, y: b.pos.y, radius: czRadius, life: 5, maxLife: 5, corruptionField: true, tickDamage: game.hasMod('zone_damage') ? 2 : 0, pull: game.hasMod('void_pull') });
        }
      }
    }
    // Killstreak reset: if sniper bullet expires without hitting anyone, reset streak
    for (const b of game.weapons.bullets) {
      if (b.life <= 0 && b.tag === 'sniper_trail' && b.hitSet.size === 0 && game.weapons.killstreak > 0) {
        game.weapons.killstreak = 0;
      }
      // Lingering Flames: expired flame particles leave small fire patches
      if (b.life <= 0 && b.tag === 'flame_particle' && game.weapons.lingerFlames && Math.random() < 0.35) {
        game.smokeZones.push({ x: b.pos.x, y: b.pos.y, radius: 18, life: 1.0, maxLife: 1.0, toxic: true } as typeof game.smokeZones[number]);
      }
    }
    game.weapons.bullets = game.weapons.bullets.filter(b => b.life > 0);

    // Update explosions
    for (let i = game.explosions.length - 1; i >= 0; i--) {
      const ex = game.explosions[i];
      ex.life -= dt;
      const progress = 1 - (ex.life / ex.maxLife);
      ex.radius = ex.maxRadius * progress;
      if (ex.life <= 0) game.explosions.splice(i, 1);
    }

    // Decay screen flash
    if (game.screenFlash > 0) game.screenFlash = Math.max(0, game.screenFlash - dt);
  }

  /** Draw all bullets, particles, turrets, decoys, kit zones, and explosions. */
  draw(g: Graphics, game: Game): void {
    g.clear();

    // Draw behavior + biome particles
    for (const p of game.particles) {
      if (!game.camera.isVisible(p.x, p.y, p.radius * 2)) continue;
      const alpha = (p.life / p.maxLife) * 0.75;
      g.circle(p.x, p.y, p.radius * 2).fill({ color: p.color, alpha: alpha * 0.25 });
      g.circle(p.x, p.y, p.radius).fill({ color: p.color, alpha: alpha });
    }

    // Draw smoke/fire zones
    for (const sz of game.smokeZones) {
      if (!game.camera.isVisible(sz.x, sz.y, sz.radius)) continue;
      const alpha = Math.min(sz.life / sz.maxLife, 1) * 0.3;
      if (sz.toxic) {
        // Fire patches: orange-red glow
        g.circle(sz.x, sz.y, sz.radius).fill({ color: 0xff4400, alpha: alpha * 0.5 });
        g.circle(sz.x, sz.y, sz.radius * 0.6).fill({ color: 0xff6622, alpha: alpha * 0.7 });
      } else if (sz.corruptionField) {
        // Purple corruption zone
        g.circle(sz.x, sz.y, sz.radius).fill({ color: 0x6600aa, alpha: alpha * 0.4 });
        g.circle(sz.x, sz.y, sz.radius).stroke({ color: 0x8833cc, width: 1, alpha: alpha * 0.6 });
      } else if (sz.corrupting) {
        // Corruption trail (sniper void)
        g.circle(sz.x, sz.y, sz.radius).fill({ color: 0x4400aa, alpha: alpha * 0.3 });
      } else {
        // Smoke: grey-green
        g.circle(sz.x, sz.y, sz.radius).fill({ color: 0x556655, alpha: alpha * 0.35 });
      }
    }

    for (const b of game.weapons.bullets) {
      if (!game.camera.isVisible(b.pos.x, b.pos.y, b.radius * 3)) continue;
      if (b.tag === 'laser_beam' && b.lineStart && b.lineEnd) {
        const frac = b.life / b.maxLife; // 1→0
        // Outer glow
        g.moveTo(b.lineStart.x, b.lineStart.y).lineTo(b.lineEnd.x, b.lineEnd.y)
          .stroke({ color: 0x00ffcc, width: 10, alpha: frac * 0.15 });
        // Mid beam
        g.moveTo(b.lineStart.x, b.lineStart.y).lineTo(b.lineEnd.x, b.lineEnd.y)
          .stroke({ color: 0x44ffee, width: 3, alpha: frac * 0.9 });
        // White core
        g.moveTo(b.lineStart.x, b.lineStart.y).lineTo(b.lineEnd.x, b.lineEnd.y)
          .stroke({ color: 0xffffff, width: 1, alpha: frac });
        continue;
      }
      if (b.tag === 'void_beam' && b.lineStart && b.lineEnd) {
        const frac = b.life / b.maxLife;
        const bw = game.weapons.beamWidthMult;
        // Wide purple glow
        g.moveTo(b.lineStart.x, b.lineStart.y).lineTo(b.lineEnd.x, b.lineEnd.y)
          .stroke({ color: 0x6600cc, width: 14 * bw, alpha: frac * 0.12 });
        // Mid beam
        g.moveTo(b.lineStart.x, b.lineStart.y).lineTo(b.lineEnd.x, b.lineEnd.y)
          .stroke({ color: 0xaa44ff, width: 5 * bw, alpha: frac * 0.7 });
        // Hot core
        g.moveTo(b.lineStart.x, b.lineStart.y).lineTo(b.lineEnd.x, b.lineEnd.y)
          .stroke({ color: 0xdd88ff, width: 2 * bw, alpha: frac * 0.95 });
        // White center flash
        g.moveTo(b.lineStart.x, b.lineStart.y).lineTo(b.lineEnd.x, b.lineEnd.y)
          .stroke({ color: 0xffffff, width: 0.8 * bw, alpha: frac * 0.6 });
        continue;
      }
      if (b.tag === 'plasma_slash' && b.lineStart && b.lineEnd && b.aimAngle !== undefined) {
        const frac = b.life / b.maxLife; // 1→0 as it expires
        const progress = 1 - frac;
        const DEG70 = 70 * Math.PI / 180;
        const outerDist = 110 + game.weapons.radiusBonus;
        // Trail: ghost slashes at past sweep positions
        for (let t = 1; t <= 4; t++) {
          const ghostProgress = Math.max(0, progress - t * 0.12);
          const ghostAngle = b.aimAngle - DEG70 + ghostProgress * DEG70 * 2;
          const gx1 = b.pos.x + Math.cos(ghostAngle) * 15;
          const gy1 = b.pos.y + Math.sin(ghostAngle) * 15;
          const gx2 = b.pos.x + Math.cos(ghostAngle) * outerDist;
          const gy2 = b.pos.y + Math.sin(ghostAngle) * outerDist;
          const trailAlpha = frac * (0.22 - t * 0.04);
          if (trailAlpha > 0) {
            g.moveTo(gx1, gy1).lineTo(gx2, gy2).stroke({ color: 0x00eeff, width: 8, alpha: trailAlpha });
          }
        }
        // Current blade: outer glow, mid, white core
        g.moveTo(b.lineStart.x, b.lineStart.y)
          .lineTo(b.lineEnd.x, b.lineEnd.y)
          .stroke({ color: 0x00eeff, width: 18, alpha: frac * 0.2 });
        g.moveTo(b.lineStart.x, b.lineStart.y)
          .lineTo(b.lineEnd.x, b.lineEnd.y)
          .stroke({ color: 0x44ddff, width: 6, alpha: frac * 0.85 });
        g.moveTo(b.lineStart.x, b.lineStart.y)
          .lineTo(b.lineEnd.x, b.lineEnd.y)
          .stroke({ color: 0xffffff, width: 2, alpha: frac });
        continue;
      }
      if (b.tag === 'flame_particle') {
        const lifeFrac = b.life / b.maxLife; // 1=fresh, 0=dying
        // Grow from base radius to 2.5x as particle dies
        const growR = b.radius * (1 + (1 - lifeFrac) * 1.5);
        // Color shift: white core -> orange -> dark red as it dies
        if (lifeFrac > 0.7) {
          // Fresh: bright white-orange core
          g.circle(b.pos.x, b.pos.y, growR * 1.5).fill({ color: 0xff6622, alpha: 0.2 * lifeFrac });
          g.circle(b.pos.x, b.pos.y, growR).fill({ color: 0xff8833, alpha: 0.7 * lifeFrac });
          g.circle(b.pos.x, b.pos.y, growR * 0.5).fill({ color: 0xffcc66, alpha: 0.9 * lifeFrac });
        } else if (lifeFrac > 0.3) {
          // Mid: orange glow
          g.circle(b.pos.x, b.pos.y, growR * 1.3).fill({ color: 0x882200, alpha: 0.15 * lifeFrac });
          g.circle(b.pos.x, b.pos.y, growR).fill({ color: 0xff5500, alpha: 0.6 * lifeFrac });
          g.circle(b.pos.x, b.pos.y, growR * 0.4).fill({ color: 0xff8844, alpha: 0.7 * lifeFrac });
        } else {
          // Dying: dark red embers, large and fading
          g.circle(b.pos.x, b.pos.y, growR * 1.2).fill({ color: 0x441100, alpha: 0.1 * lifeFrac });
          g.circle(b.pos.x, b.pos.y, growR).fill({ color: 0x992200, alpha: 0.4 * lifeFrac });
        }
        continue;
      }
      if (b.tag === 'sniper_trail') {
        const spd = v2len(b.vel);
        if (spd > 0) {
          const trailLen = 120;
          const tx = b.pos.x - (b.vel.x / spd) * trailLen;
          const ty = b.pos.y - (b.vel.y / spd) * trailLen;
          g.moveTo(b.pos.x, b.pos.y).lineTo(tx, ty).stroke({ color: 0xffffff, width: 6, alpha: 0.12 });
          g.moveTo(b.pos.x, b.pos.y).lineTo(tx, ty).stroke({ color: 0xddddff, width: 2, alpha: 0.7 * (b.life / b.maxLife) });
        }
        g.circle(b.pos.x, b.pos.y, b.radius * 2.5).fill({ color: 0xffffff, alpha: 0.15 });
        g.circle(b.pos.x, b.pos.y, b.radius).fill({ color: 0xffffff, alpha: 1 });
        continue;
      }
      g.circle(b.pos.x, b.pos.y, b.radius * 3).fill({ color: b.color, alpha: 0.1 });
      g.circle(b.pos.x, b.pos.y, b.radius * 1.5).fill({ color: b.color, alpha: 0.8 });
      g.circle(b.pos.x, b.pos.y, b.radius * 0.8).fill({ color: 0xffffff, alpha: 0.6 });
    }

    // Draw turrets
    for (const t of game.turrets) {
      if (!game.camera.isVisible(t.x, t.y, 20)) continue;
      const alpha = Math.min(t.life / 2, 1);
      // Base
      g.circle(t.x, t.y, 14).fill({ color: 0x112211, alpha: alpha * 0.9 });
      g.circle(t.x, t.y, 14).stroke({ color: 0x44ffaa, width: 2, alpha: alpha * 0.8 });
      // Barrel
      g.circle(t.x, t.y, 6).fill({ color: 0x44ffaa, alpha: alpha * 0.7 });
      g.circle(t.x, t.y, 3).fill({ color: 0xffffff, alpha: alpha * 0.6 });
      // Range indicator
      g.circle(t.x, t.y, t.range).stroke({ color: 0x44ffaa, width: 1, alpha: alpha * 0.08 });
      // Life bar above turret
      const barW = 20;
      const frac = t.life / t.maxLife;
      g.rect(t.x - barW / 2, t.y - 22, barW, 3).fill({ color: 0x111111, alpha: alpha * 0.7 });
      g.rect(t.x - barW / 2, t.y - 22, barW * frac, 3).fill({ color: 0x44ffaa, alpha: alpha * 0.9 });
    }

    // Draw decoys
    for (const dc of game.decoys) {
      if (!game.camera.isVisible(dc.x, dc.y, 18)) continue;
      const dcAlpha = Math.min(dc.life / 1, 1);
      g.circle(dc.x, dc.y, 16).fill({ color: PLAYER_COLOR, alpha: dcAlpha * 0.4 });
      g.circle(dc.x, dc.y, 16).stroke({ color: PLAYER_COLOR, width: 2, alpha: dcAlpha * 0.6 });
      g.circle(dc.x, dc.y, 8).fill({ color: 0xffffff, alpha: dcAlpha * 0.3 });
    }

    // Draw smoke zones
    for (const sz of game.smokeZones) {
      if (!game.camera.isVisible(sz.x, sz.y, sz.radius)) continue;
      const szAlpha = Math.min(sz.life / 2, 1) * 0.15;
      g.circle(sz.x, sz.y, sz.radius).fill({ color: 0x888888, alpha: szAlpha });
      g.circle(sz.x, sz.y, sz.radius).stroke({ color: 0xaaaaaa, width: 1, alpha: szAlpha * 2 });
    }

    // Draw gravity wells
    for (const gw of game.gravityWells) {
      if (!game.camera.isVisible(gw.x, gw.y, gw.radius)) continue;
      const gwAlpha = Math.min(gw.life / 1, 1) * 0.1;
      g.circle(gw.x, gw.y, gw.radius).stroke({ color: 0x6600cc, width: 2, alpha: gwAlpha * 3 });
      g.circle(gw.x, gw.y, gw.radius * 0.5).stroke({ color: 0x9933ff, width: 1, alpha: gwAlpha * 4 });
    }

    // Draw drone
    if (game.droneActive) {
      g.circle(game.dronePos.x, game.dronePos.y, 8).fill({ color: 0x33ccff, alpha: 0.8 });
      g.circle(game.dronePos.x, game.dronePos.y, 8).stroke({ color: 0x66ddff, width: 2, alpha: 0.6 });
      // Intercept range
      g.circle(game.dronePos.x, game.dronePos.y, 100).stroke({ color: 0x33ccff, width: 1, alpha: 0.06 });
    }

    // Draw familiar
    if (game.familiarActive) {
      const famColor = game.familiarState === 'returning' ? game.familiarGlowColor : 0x9933ff;
      const famAlpha = game.familiarState === 'returning' ? 0.6 + Math.sin(game.elapsed * 8) * 0.2 : 0.7;
      g.circle(game.familiarPos.x, game.familiarPos.y, 8).fill({ color: famColor, alpha: famAlpha });
      g.circle(game.familiarPos.x, game.familiarPos.y, 8).stroke({ color: famColor, width: 2, alpha: 0.8 });
      if (game.familiarState === 'returning') {
        const outerAlpha = 0.35 + Math.sin(game.elapsed * 6) * 0.15;
        g.circle(game.familiarPos.x, game.familiarPos.y, 14).stroke({ color: game.familiarGlowColor, width: 2, alpha: outerAlpha });
      }
    }

    // Draw explosions
    for (const ex of game.explosions) {
      if (!game.camera.isVisible(ex.x, ex.y, ex.maxRadius)) continue;
      const alpha = ex.life / ex.maxLife;
      if (ex.type === 'pulse_ring') {
        // Pulse cannon AOE ring: cyan expanding ring
        g.circle(ex.x, ex.y, ex.radius).stroke({ color: 0x44aaff, width: 3, alpha: alpha * 0.85 });
        g.circle(ex.x, ex.y, ex.radius * 0.7).stroke({ color: 0x88ddff, width: 1.5, alpha: alpha * 0.5 });
        g.circle(ex.x, ex.y, ex.radius).fill({ color: 0x44aaff, alpha: alpha * 0.06 });
      } else if (ex.type === 'flash') {
        // Flash trap: bright white/blue concussive blast
        g.circle(ex.x, ex.y, ex.radius).fill({ color: 0xeeeeff, alpha: alpha * 0.55 });
        g.circle(ex.x, ex.y, ex.radius * 0.65).fill({ color: 0xffffff, alpha: alpha * 0.7 });
        g.circle(ex.x, ex.y, ex.radius * 0.3).fill({ color: 0xffffff, alpha: alpha * 0.95 });
        g.circle(ex.x, ex.y, ex.radius).stroke({ color: 0x8899ff, width: 2.5, alpha: alpha * 0.9 });
      } else {
        g.circle(ex.x, ex.y, ex.radius).fill({ color: 0xffaa00, alpha: alpha * 0.15 });
        g.circle(ex.x, ex.y, ex.radius * 0.7).fill({ color: 0xff6600, alpha: alpha * 0.3 });
        g.circle(ex.x, ex.y, ex.radius * 0.3).fill({ color: 0xffffff, alpha: alpha * 0.5 });
        g.circle(ex.x, ex.y, ex.radius).stroke({ color: 0xff4400, width: 2, alpha: alpha * 0.6 });
      }
    }

    for (const b of game.enemies.enemyBullets) {
      if (!game.camera.isVisible(b.pos.x, b.pos.y, b.radius * 3)) continue;
      // Teal color for coral spitter projectiles, red otherwise
      const isCoral = b.color === 0x33ccdd;
      const bulletColor = isCoral ? 0x33ccdd : 0xff2200;
      const bulletGlow = isCoral ? 0x00ffff : 0xff0000;
      g.circle(b.pos.x, b.pos.y, b.radius * 2.5).fill({ color: bulletGlow, alpha: 0.12 });
      g.circle(b.pos.x, b.pos.y, b.radius * 1.5).fill({ color: bulletColor, alpha: 0.8 });
      g.circle(b.pos.x, b.pos.y, b.radius * 0.6).fill({ color: 0xffffff, alpha: 0.7 });
    }

    // Proximity mines (mine_crawler drops)
    for (const m of game.enemies.mines) {
      if (!game.camera.isVisible(m.pos.x, m.pos.y, m.radius * 2)) continue;
      const pulse = m.armed ? (0.4 + Math.abs(Math.sin(game.elapsed * 8)) * 0.5) : 0.25;
      const mineColor = m.armed ? 0xff4400 : 0xcc7722;
      g.circle(m.pos.x, m.pos.y, m.radius).stroke({ color: mineColor, width: 2, alpha: pulse });
      g.circle(m.pos.x, m.pos.y, m.radius * 0.45).fill({ color: mineColor, alpha: pulse * 0.8 });
      // Cross-hair lines
      const hs = m.radius * 0.35;
      g.moveTo(m.pos.x - hs, m.pos.y).lineTo(m.pos.x + hs, m.pos.y).stroke({ color: mineColor, width: 1, alpha: pulse });
      g.moveTo(m.pos.x, m.pos.y - hs).lineTo(m.pos.x, m.pos.y + hs).stroke({ color: mineColor, width: 1, alpha: pulse });
    }

  }
}
