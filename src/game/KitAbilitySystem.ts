import type { Game } from './Game';
import { KIT_DEFS } from '../data/kits';
import { v2, v2add, v2mul, v2len, v2dist, v2norm, v2sub, randRange } from '../lib/math';
import { WORLD_W, WORLD_H } from './constants';
import { createEnemy, type Enemy } from './Enemies';
import { CREATURE_DEFS } from '../data/creatures';
import { WEAPON_DEFS } from '../data/weapons';

export class KitAbilitySystem {
  activateKit(kitId: string, game: Game): void {
    if (!game.equippedKits.includes(kitId)) return;
    if ((game.kitCooldowns[kitId] || 0) > 0) return;
    const kdef = KIT_DEFS[kitId];
    if (!kdef) return;
    const tier = game.runKitTiers[kitId] || 1;
    const t3Choice = game.kitT3Choices[kitId] || '';
    let suppressUsedMessage = false;

    switch (kitId) {
      case 'stim_pack': {
        const heal = tier < 2 ? 4 : 5;
        game.player.heal(heal);
        game.player.corruption = Math.min(100, game.player.corruption + 15);
        // Withdrawal perk: re-arm shield
        if (game.hasPerk('withdrawal')) game.stimWithdrawalActive = true;
        // Adrenaline Spike perk: scatter nearby enemies 80px
        if (game.hasPerk('adrenaline_spike')) {
          for (const e of game.enemies.enemies) {
            if (e.hp > 0 && !e.isAlly && v2dist(game.player.pos, e.pos) < 100) {
              const pushDir = v2norm(v2sub(e.pos, game.player.pos));
              e.pos.x += pushDir.x * 80;
              e.pos.y += pushDir.y * 80;
            }
          }
        }
        // T3 clean: speed boost 5s
        if (tier >= 3 && t3Choice === 'clean') game.stimSpeedTimer = 5.0;
        break;
      }
      case 'flash_trap': {
        // Damage and stun all enemies within 80px
        const stunned: Enemy[] = [];
        for (const e of game.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          if (v2dist(game.player.pos, e.pos) < 80) {
            e.hp -= 3;
            e.hitFlash = 0.3;
            e.stunTimer = 2.0;
            stunned.push(e);
            if (e.hp <= 0) game.onEnemyKilled(e);
          }
        }
        // Trap Magnetism perk: stunned enemy pulls 2 nearby
        if (game.hasPerk('trap_magnetism') && stunned.length > 0) {
          const anchor = stunned[0];
          let pulled = 0;
          for (const e of game.enemies.enemies) {
            if (pulled >= 2) break;
            if (e.hp <= 0 || e.isAlly || stunned.includes(e)) continue;
            if (v2dist(anchor.pos, e.pos) < 200) {
              e.pos.x = anchor.pos.x + (Math.random() - 0.5) * 40;
              e.pos.y = anchor.pos.y + (Math.random() - 0.5) * 40;
              e.stunTimer = 1.0;
              pulled++;
            }
          }
        }
        // Fragile State perk: enemies emerging from stun take 2x (marked in enemy update)
        game.explosions.push({ x: game.player.pos.x, y: game.player.pos.y, radius: 0, maxRadius: 120, life: 0.5, maxLife: 0.5, type: 'flash' });
        game.screenFlash = 0.35;
        // Save trap position for resonance combos (linked_fuse, trap_aggro)
        game.lastFlashTrapPos = { x: game.player.pos.x, y: game.player.pos.y };
        break;
      }
      case 'blink_kit': {
        // Phase Shift: invulnerability + enemy slow field
        let duration = 1.5;
        // T2: also stun enemies in range briefly on activation
        if (tier >= 2) {
          for (const e of game.enemies.enemies) {
            if (e.hp > 0 && !e.isAlly && v2dist(game.player.pos, e.pos) < 250) {
              e.stunTimer = 0.5;
            }
          }
          game.explosions.push({ x: game.player.pos.x, y: game.player.pos.y, radius: 0, maxRadius: 250, life: 0.4, maxLife: 0.4, type: 'phase' });
        }
        // T3 clean: extended duration (3s) + fire rate boost (handled in update)
        if (tier >= 3 && t3Choice === 'clean') {
          duration = 3.0;
        }
        // T3 void: corruption damage over time (handled in update)
        if (tier >= 3 && t3Choice === 'void') {
          duration = 2.0;
        }
        game.phaseShiftActive = true;
        game.phaseShiftTimer = duration;
        game.phaseShiftDuration = duration;
        game.screenFlash = 0.2;
        break;
      }
      case 'turret_kit': {
        const turretDur = tier < 2 ? 12 : (tier >= 3 && t3Choice === 'clean' ? 25 : 20);
        const turretDmg = tier < 2 ? 2 : 2;
        game.turrets.push({
          x: game.player.pos.x,
          y: game.player.pos.y,
          life: turretDur, maxLife: turretDur,
          fireTimer: 0, fireRate: tier >= 2 ? 0.1 : 0.35, // T2: burst fire
          damage: turretDmg, range: 250,
        });
        break;
      }
      case 'chain_kit': {
        // Fire tether toward nearest enemy, stun 3s
        let chainNearest: Enemy | null = null;
        let chainDist = 999999;
        let chainNearestIdx = -1;
        for (let i = 0; i < game.enemies.enemies.length; i++) {
          const e = game.enemies.enemies[i];
          if (e.hp <= 0 || e.isAlly) continue;
          const d = v2dist(game.player.pos, e.pos);
          if (d < chainDist) { chainDist = d; chainNearest = e; chainNearestIdx = i; }
        }
        if (chainNearest) {
          chainNearest.stunTimer = 3.0;
          game.explosions.push({ x: chainNearest.pos.x, y: chainNearest.pos.y, radius: 0, maxRadius: 30, life: 0.3, maxLife: 0.3 });
          // T2: arc to second enemy
          if (tier >= 2) {
            let secondDist = 200;
            let secondEnemy: Enemy | null = null;
            for (let i = 0; i < game.enemies.enemies.length; i++) {
              if (i === chainNearestIdx || game.enemies.enemies[i].hp <= 0 || game.enemies.enemies[i].isAlly) continue;
              const d2 = v2dist(chainNearest.pos, game.enemies.enemies[i].pos);
              if (d2 < secondDist) { secondDist = d2; secondEnemy = game.enemies.enemies[i]; }
            }
            if (secondEnemy) {
              secondEnemy.stunTimer = 3.0;
            }
          }
          // T3 clean: chained enemy takes +50% damage (marked)
          if (tier >= 3 && t3Choice === 'clean') {
            (chainNearest as Enemy & { markedTimer?: number; markedDmgBonus?: number }).markedTimer = 5.0;
            (chainNearest as Enemy & { markedDmgBonus?: number }).markedDmgBonus = 1.5;
          }
        }
        break;
      }
      case 'charge_kit': {
        const chargeDmg = tier < 2 ? 2 : 6;
        const kbMult = (tier >= 3 && t3Choice === 'clean') ? 2.0 : 1.0;
        for (const e of game.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          const d = v2dist(game.player.pos, e.pos);
          if (d < 150) {
            const pushDir = v2norm(v2sub(e.pos, game.player.pos));
            e.pos.x += pushDir.x * 200 * kbMult;
            e.pos.y += pushDir.y * 200 * kbMult;
            e.hp -= chargeDmg;
            e.hitFlash = 0.3;
            // T3 clean: stun after knockback
            if (tier >= 3 && t3Choice === 'clean') e.stunTimer = 1.0;
            if (e.hp <= 0) game.onEnemyKilled(e);
          }
        }
        game.explosions.push({ x: game.player.pos.x, y: game.player.pos.y, radius: 0, maxRadius: 150, life: 0.3, maxLife: 0.3 });
        // Aftershock perk: leave slow field
        if (game.hasPerk('aftershock')) {
          game.smokeZones.push({ x: game.player.pos.x, y: game.player.pos.y, radius: 80, life: 3, maxLife: 3, slowing: true });
        }
        break;
      }
      case 'mirage_kit': {
        // T3 clean: 3 decoys instead of 1
        const decoyCount = (tier >= 3 && t3Choice === 'clean') ? 3 : 1;
        for (let di = 0; di < decoyCount; di++) {
          game.decoys.push({
            x: game.player.pos.x + (Math.random() - 0.5) * 40,
            y: game.player.pos.y + (Math.random() - 0.5) * 40,
            hp: 5, life: 6, maxLife: 6,
          });
        }
        break;
      }
      case 'smoke_kit':
        // Smoke zone: de-aggro enemies inside, 6s. T2: slows 40%. T3 void: toxic (1 dmg/s)
        game.smokeZones.push({
          x: game.player.pos.x,
          y: game.player.pos.y,
          radius: 150, life: 6, maxLife: 6,
          slowing: tier >= 2,
          toxic: tier >= 3 && t3Choice === 'void',
        } as typeof game.smokeZones[number]);
        break;
      case 'anchor_kit': {
        // Gravity well: pull enemies. T2: 9s with pulse. T3 clean: damage field. T3 void: explode on end.
        const gwLife = tier >= 2 ? 9 : 4;
        game.gravityWells.push({
          x: game.player.pos.x,
          y: game.player.pos.y,
          radius: 400, life: gwLife, maxLife: gwLife,
          pullSpeed: 120,
          damageField: tier >= 3 && t3Choice === 'clean',
          explodeOnEnd: tier >= 3 && t3Choice === 'void',
        } as typeof game.gravityWells[number]);
        break;
      }
      case 'drone_kit':
        // Persistent drone that orbits, intercepts, attacks
        game.droneActive = true;
        game.dronePos = { x: game.player.pos.x + 50, y: game.player.pos.y };
        game.droneFireTimer = 0;
        game.droneInterceptTimer = 0;
        break;
      case 'familiar_kit':
        // Persistent familiar that orbits and rams
        game.familiarActive = true;
        game.familiarPos = { x: game.player.pos.x + 60, y: game.player.pos.y };
        game.familiarAttackTimer = 0;
        break;
      case 'pack_kit': {
        // T2: spawn 4 allies instead of 2
        const allyCount = tier < 2 ? 2 : 4;
        // Kill existing allies first
        for (const e of game.enemies.enemies) {
          if (e.isAlly) e.hp = 0;
        }
        for (let ai = 0; ai < allyCount; ai++) {
          const angle = (ai / allyCount) * Math.PI * 2;
          const spawnDist = 120;
          const ally = createEnemy('Rift Parasite', {
            x: game.player.pos.x + Math.cos(angle) * spawnDist,
            y: game.player.pos.y + Math.sin(angle) * spawnDist,
          });
          ally.isAlly = true;
          ally.isAggroed = true;
          ally.meleeDmg = 2;
          ally.hp = 12;
          ally.maxHp = 12;
          ally.speed = 160;
          game.enemies.enemies.push(ally);
        }
        break;
      }
      case 'void_surge': {
        // T3 clean: free at 60+ corruption
        let surgeCost = 20;
        if (tier >= 3 && t3Choice === 'clean' && game.player.corruption >= 60) surgeCost = 0;
        if (game.player.corruption >= surgeCost) {
          game.player.corruption -= surgeCost;
          game.voidSurgeActive = true;
          game.voidSurgeTimer = 3;
          // surge_charge: void surge resets charge_kit cooldown instantly
          if (game.hasMod('surge_charge') && game.equippedKits.includes('charge_kit')) {
            game.kitCooldowns['charge_kit'] = 0;
            game.hud.showMessage('CHARGE READY!', 1.5);
          }
          // T3 void: fire ring of 8 bullets
          if (tier >= 3 && t3Choice === 'void') {
            for (let bi = 0; bi < 8; bi++) {
              const angle = (bi / 8) * Math.PI * 2;
              const bdir = { x: Math.cos(angle), y: Math.sin(angle) };
              game.weapons.bullets.push({
                pos: { x: game.player.pos.x + bdir.x * 20, y: game.player.pos.y + bdir.y * 20 },
                vel: { x: bdir.x * 300, y: bdir.y * 300 },
                radius: 5, color: 0x6600cc, damage: 3, life: 0.8, maxLife: 0.8,
                piercing: false, homing: false, bounces: 0, aoeRadius: 0,
                fromPlayer: true, hitSet: new Set(),
              });
            }
          }
        } else {
          game.kitCooldowns[kitId] = 0;
          game.hud.showMessage('NOT ENOUGH CORRUPTION', 1.5);
          return;
        }
        break;
      }
      case 'rupture_kit': {
        const currentCorruption = game.player.corruption;
        if (currentCorruption <= 0) {
          game.kitCooldowns[kitId] = 0;
          suppressUsedMessage = true;
          game.hud.showMessage('NO CORRUPTION TO DETONATE', 1.5);
          break;
        }
        // AOE damage = corruption/5, clear corruption
        const ruptureDmg = Math.floor(currentCorruption / 5);
        const ruptureRadius = 400;
        for (const e of game.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          if (v2dist(game.player.pos, e.pos) < ruptureRadius) {
            e.hp -= ruptureDmg;
            e.hitFlash = 0.3;
            if (e.hp <= 0) game.onEnemyKilled(e);
          }
        }
        game.explosions.push({ x: game.player.pos.x, y: game.player.pos.y, radius: 0, maxRadius: ruptureRadius, life: 0.3, maxLife: 0.3 });
        // Scatter Field perk: 8 shrapnel bullets
        if (game.hasPerk('scatter_field')) {
          for (let si = 0; si < 8; si++) {
            const sAngle = (si / 8) * Math.PI * 2;
            const sDir = { x: Math.cos(sAngle), y: Math.sin(sAngle) };
            game.weapons.bullets.push({
              pos: { x: game.player.pos.x + sDir.x * 15, y: game.player.pos.y + sDir.y * 15 },
              vel: { x: sDir.x * 250, y: sDir.y * 250 },
              radius: 4, color: 0xcc33cc, damage: 3, life: 0.6, maxLife: 0.6,
              piercing: false, homing: false, bounces: 0, aoeRadius: 0,
              fromPlayer: true, hitSet: new Set(),
            });
          }
        }
        game.player.corruption = 0;
        // void_feedback: rupture instantly recharges void_surge
        if (game.hasMod('void_feedback') && game.equippedKits.includes('void_surge')) {
          game.kitCooldowns['void_surge'] = 0;
          game.hud.showMessage('VOID SURGE READY!', 1.5);
        }
        break;
      }
      default:
        break;
    }
    // Set cooldown (tier-adjusted for some kits)
    let cd = kdef.cooldown;
    if (kitId === 'stim_pack' && tier >= 2) cd = 5; // T2: 8->5s
    // T3 mismatch penalty: double cooldown
    if (!suppressUsedMessage && tier >= 3 && t3Choice) {
      const isClean = t3Choice === 'clean';
      if ((isClean && game.player.corruption >= 35) || (!isClean && game.player.corruption < 50)) {
        cd *= 2;
      }
    }
    if (!suppressUsedMessage) game.kitCooldowns[kitId] = cd;
    if (!suppressUsedMessage) game.hud.showMessage(kdef.name.toUpperCase() + ' USED', 1.5);
  }

  update(dt: number, game: Game): void {
    // Update turrets
    for (let i = game.turrets.length - 1; i >= 0; i--) {
      const t = game.turrets[i];
      t.life -= dt;
      if (t.life <= 0) {
        // Overheat perk: turret explodes on death
        if (game.hasPerk('overheat')) {
          game.explosions.push({ x: t.x, y: t.y, radius: 0, maxRadius: 70, life: 0.3, maxLife: 0.3 });
          for (const e of game.enemies.enemies) {
            if (e.hp > 0 && !e.isAlly && v2dist({ x: t.x, y: t.y }, e.pos) < 70) {
              e.hp -= 4; e.hitFlash = 0.3;
              if (e.hp <= 0) game.onEnemyKilled(e);
            }
          }
        }
        game.turrets.splice(i, 1); continue;
      }
      t.fireTimer -= dt;
      if (t.fireTimer <= 0) {
        // Find nearest enemy in range (target_priority: only recently hit enemies)
        let nearest: { pos: { x: number; y: number }; id: number } | null = null;
        let nearDist = t.range;
        for (const e of game.enemies.enemies) {
          if (e.isAlly || e.hp <= 0) continue;
          const d = v2dist({ x: t.x, y: t.y }, e.pos);
          if (d < nearDist) { nearest = e; nearDist = d; }
        }
        if (nearest) {
          t.fireTimer = t.fireRate;
          const dir = v2norm(v2sub(nearest.pos, { x: t.x, y: t.y }));
          const vel = v2mul(dir, 400);
          game.weapons.bullets.push({
            pos: { x: t.x, y: t.y },
            vel,
            radius: 5,
            color: 0x44ffaa,
            damage: t.damage,
            life: 0.8,
            maxLife: 0.8,
            piercing: false,
            homing: false,
            bounces: 0,
            aoeRadius: 0,
            fromPlayer: true,
            hitSet: new Set(),
          });
        }
      }
    }
    // turret_familiar: heal player 1 HP / 5s while turret AND familiar are both active
    if (game.hasMod('turret_familiar') && game.familiarActive && game.turrets.length > 0) {
      game.turretFamiliarHealTimer -= dt;
      if (game.turretFamiliarHealTimer <= 0) {
        game.turretFamiliarHealTimer = 5;
        game.player.hp = Math.min(game.player.hp + 1, game.player.maxHp);
      }
    } else {
      game.turretFamiliarHealTimer = Math.min(game.turretFamiliarHealTimer + dt, 5);
    }

    // Update decoys
    for (let i = game.decoys.length - 1; i >= 0; i--) {
      const dc = game.decoys[i];
      dc.life -= dt;
      if (dc.life <= 0 || dc.hp <= 0) {
        game.decoys.splice(i, 1);
        continue;
      }
      // trap_aggro: decoy auto-moves toward last flash trap position
      if (game.hasMod('trap_aggro') && game.lastFlashTrapPos) {
        const trapD = v2dist({ x: dc.x, y: dc.y }, game.lastFlashTrapPos);
        if (trapD > 20) {
          const trapDir = v2norm(v2sub(game.lastFlashTrapPos, { x: dc.x, y: dc.y }));
          dc.x += trapDir.x * 80 * dt;
          dc.y += trapDir.y * 80 * dt;
        }
      }
      // Magnet Decoy perk: pull enemies within 120px
      if (game.hasPerk('magnet_decoy')) {
        for (const e of game.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          const md = v2dist(e.pos, { x: dc.x, y: dc.y });
          if (md < 120 && md > 5) {
            const pd = v2norm(v2sub({ x: dc.x, y: dc.y }, e.pos));
            e.pos.x += pd.x * 40 * dt;
            e.pos.y += pd.y * 40 * dt;
          }
        }
      }
      // Copycat perk: decoy fires weapon every 3s
      if (game.hasPerk('copycat')) {
        dc.life; // use existing life as timer proxy
        const ccKey = `cc_${i}`;
        if (!game.kitCooldowns[ccKey] || game.kitCooldowns[ccKey] <= 0) {
          game.kitCooldowns[ccKey] = 3;
          let ccBest = 200; let ccTarget: Enemy | null = null;
          for (const e of game.enemies.enemies) {
            if (e.hp <= 0 || e.isAlly) continue;
            const d = v2dist({ x: dc.x, y: dc.y }, e.pos);
            if (d < ccBest) { ccBest = d; ccTarget = e; }
          }
          if (ccTarget) {
            const ccDir = v2norm(v2sub(ccTarget.pos, { x: dc.x, y: dc.y }));
            game.weapons.bullets.push({
              pos: { x: dc.x, y: dc.y }, vel: { x: ccDir.x * 300, y: ccDir.y * 300 },
              radius: 4, color: 0xcc88ff, damage: 2, life: 0.6, maxLife: 0.6,
              piercing: false, homing: false, bounces: 0, aoeRadius: 0,
              fromPlayer: true, hitSet: new Set(),
            });
          }
        } else {
          game.kitCooldowns[ccKey] -= dt;
        }
      }
    }

    // Update smoke zones
    for (let i = game.smokeZones.length - 1; i >= 0; i--) {
      game.smokeZones[i].life -= dt;
      if (game.smokeZones[i].life <= 0) {
        game.smokeZones.splice(i, 1);
        continue;
      }
      const sz = game.smokeZones[i];
      for (const e of game.enemies.enemies) {
        if (e.hp <= 0 || e.isAlly) continue;
        if (v2dist(e.pos, { x: sz.x, y: sz.y }) < sz.radius) {
          // De-aggro (skip for pure corruption zones so they stay hostile)
          if (!sz.corruptionField) e.isAggroed = false;
          // T2: slow enemies 40% (corrupting trail zones slow 30% via vs_slow)
          if (sz.slowing) {
            const _sm = sz.corrupting ? 0.7 : 0.6;
            e.speed = CREATURE_DEFS[e.name]?.speed * _sm || e.speed * _sm;
          }
          // T3 void: toxic damage
          if (sz.toxic) {
            e.hp -= Math.max(1, Math.round(dt));
            e.hitFlash = 0.05;
            if (e.hp <= 0) game.onEnemyKilled(e);
          }
          // Corruption zone damage (zone_damage mastery / tickDamage field)
          if (sz.corruptionField && (sz.tickDamage ?? 0) > 0) {
            e.hp -= (sz.tickDamage!) * dt;
            e.hitFlash = Math.max(e.hitFlash, 0.04);
            if (e.hp <= 0) {
              // Cascade Void: kill inside corruption zone spawns mini zone
              if (game.hasMod('cascade_void') && game.player.weaponId === 'grenade_launcher') {
                game.smokeZones.push({ x: e.pos.x, y: e.pos.y, radius: 60, life: 3, maxLife: 3, corruptionField: true, tickDamage: sz.tickDamage, pull: sz.pull });
              }
              game.onEnemyKilled(e);
            }
          }
          // Void Pull mastery (grenade void): corruption zone pulls enemies inward
          if (sz.pull) {
            const pullDir = v2norm(v2sub({ x: sz.x, y: sz.y }, e.pos));
            e.pos.x += pullDir.x * 60 * dt;
            e.pos.y += pullDir.y * 60 * dt;
          }
        } else {
          // Restore speed when leaving smoke
          if (sz.slowing && CREATURE_DEFS[e.name]) {
            e.speed = CREATURE_DEFS[e.name].speed;
          }
        }
      }
    }

    // Update gravity wells
    for (let i = game.gravityWells.length - 1; i >= 0; i--) {
      game.gravityWells[i].life -= dt;
      if (game.gravityWells[i].life <= 0) {
        // T3 void: explode on end
        const gwEnd = game.gravityWells[i];
        if (gwEnd.explodeOnEnd) {
          const count = gwEnd.enemiesInside || 1;
          const explodeDmg = 3 * count;
          for (const e of game.enemies.enemies) {
            if (e.hp > 0 && !e.isAlly && v2dist(e.pos, { x: gwEnd.x, y: gwEnd.y }) < gwEnd.radius * 0.5) {
              e.hp -= explodeDmg;
              e.hitFlash = 0.3;
              if (e.hp <= 0) game.onEnemyKilled(e);
            }
          }
          game.explosions.push({ x: gwEnd.x, y: gwEnd.y, radius: 0, maxRadius: gwEnd.radius * 0.5, life: 0.3, maxLife: 0.3 });
        }
        // overcharge_drone: drone fires 2x faster for 5s after anchor expires
        if (game.hasMod('overcharge_drone') && game.droneActive) {
          game.droneOverchargeTimer = 5;
        }
        game.gravityWells.splice(i, 1);
        continue;
      }
      const gw = game.gravityWells[i];
      let enemyCount = 0;
      for (const e of game.enemies.enemies) {
        if (e.hp <= 0 || e.isAlly) continue;
        const d = v2dist(e.pos, { x: gw.x, y: gw.y });
        if (d < gw.radius && d > 5) {
          // chain_anchor: tethered (chain-stunned) enemies pulled 2x faster
          const pullForce = (game.hasMod('chain_anchor') && e.stunTimer > 0) ? gw.pullSpeed * 2 : gw.pullSpeed;
          const pullDir = v2norm(v2sub({ x: gw.x, y: gw.y }, e.pos));
          e.pos.x += pullDir.x * pullForce * dt;
          e.pos.y += pullDir.y * pullForce * dt;
          enemyCount++;
          // T3 clean: damage field
          if (gw.damageField) {
            e.hp -= Math.max(1, Math.round(dt));
            if (e.hp <= 0) game.onEnemyKilled(e);
          }
        }
      }
      gw.enemiesInside = Math.max(gw.enemiesInside || 0, enemyCount);
    }

    // Update baton vortices (Consuming Vortex mutation + mastery perks)
    for (let i = game.batonVortices.length - 1; i >= 0; i--) {
      const vt = game.batonVortices[i];
      vt.life -= dt;
      if (vt.life <= 0) { game.batonVortices.splice(i, 1); continue; }
      const vtProgress = 1 - (vt.life / vt.maxLife);
      vt.currentRadius = vt.maxRadius * vtProgress;
      for (const e of game.enemies.enemies) {
        if (e.hp <= 0 || e.isAlly) continue;
        const vd = v2dist(e.pos, { x: vt.x, y: vt.y });
        if (vd < vt.currentRadius && vd > 5) {
          // hunger_field: pull enemies toward vortex center
          if (game.hasMod('hunger_field')) {
            const vtPull = v2norm(v2sub({ x: vt.x, y: vt.y }, e.pos));
            e.pos.x += vtPull.x * 60 * dt;
            e.pos.y += vtPull.y * 60 * dt;
          }
        }
      }
      // overload_void: shockwave when vortex reaches max size
      if (!vt.shockwaveFired && vtProgress >= 0.95 && game.hasMod('overload_void')) {
        vt.shockwaveFired = true;
        const shockR = vt.maxRadius * 1.5;
        game.explosions.push({ x: vt.x, y: vt.y, radius: 0, maxRadius: shockR, life: 0.3, maxLife: 0.3 });
        for (const e of game.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          if (v2dist(e.pos, { x: vt.x, y: vt.y }) < shockR) {
            e.hp -= 4;
            e.hitFlash = 0.2;
            game.damageDealt += 4;
            if (e.hp <= 0) game.onEnemyKilled(e);
          }
        }
      }
    }

    // Update drone
    if (game.droneActive) {
      const orbitAngle = game.elapsed * 2.0 % (Math.PI * 2);
      game.dronePos = { x: game.player.pos.x + Math.cos(orbitAngle) * 50, y: game.player.pos.y + Math.sin(orbitAngle) * 50 };
      game.droneInterceptTimer = Math.max(0, game.droneInterceptTimer - dt);
      if (game.droneOverchargeTimer > 0) game.droneOverchargeTimer -= dt;
      // Drone attack
      game.droneFireTimer -= dt;
      if (game.droneFireTimer <= 0) {
        game.droneFireTimer = (game.droneOverchargeTimer > 0) ? 1.25 : 2.5;
        let droneBestDist = 200;
        let droneBestEnemy: Enemy | null = null;
        for (const e of game.enemies.enemies) {
          if (e.hp <= 0 || e.isAlly) continue;
          const d = v2dist(game.dronePos, e.pos);
          if (d < droneBestDist) { droneBestDist = d; droneBestEnemy = e; }
        }
        if (droneBestEnemy) {
          droneBestEnemy.hp -= 2;
          droneBestEnemy.hitFlash = 0.15;
          if (droneBestEnemy.hp <= 0) game.onEnemyKilled(droneBestEnemy);
          game.explosions.push({ x: game.dronePos.x, y: game.dronePos.y, radius: 0, maxRadius: 8, life: 0.1, maxLife: 0.1 });
        }
      }
      // Drone intercept enemy bullets
      if (game.droneInterceptTimer <= 0) {
        for (let bi = game.enemies.enemyBullets.length - 1; bi >= 0; bi--) {
          const eb = game.enemies.enemyBullets[bi];
          if (v2dist(eb.pos, game.dronePos) < 100) {
            game.enemies.enemyBullets.splice(bi, 1);
            game.droneInterceptTimer = 4;
            // Intercept Link perk: explode on intercept
            if (game.hasPerk('intercept_link')) {
              game.explosions.push({ x: game.dronePos.x, y: game.dronePos.y, radius: 0, maxRadius: 20, life: 0.2, maxLife: 0.2 });
              for (const e of game.enemies.enemies) {
                if (e.hp > 0 && !e.isAlly && v2dist(game.dronePos, e.pos) < 20) {
                  e.hp -= 2; e.hitFlash = 0.15;
                  if (e.hp <= 0) game.onEnemyKilled(e);
                }
              }
            } else {
              game.explosions.push({ x: game.dronePos.x, y: game.dronePos.y, radius: 0, maxRadius: 15, life: 0.2, maxLife: 0.2 });
            }
            break;
          }
        }
      }
      // Leash Break perk: familiar explodes when hit by enemy bullet
      if (game.familiarActive && !game.familiarLeashUsed && game.hasPerk('leash_break')) {
        for (let bi = game.enemies.enemyBullets.length - 1; bi >= 0; bi--) {
          if (v2dist(game.enemies.enemyBullets[bi].pos, game.familiarPos) < 30) {
            game.familiarLeashUsed = true;
            game.familiarActive = false;
            game.enemies.enemyBullets.splice(bi, 1);
            game.explosions.push({ x: game.familiarPos.x, y: game.familiarPos.y, radius: 0, maxRadius: 80, life: 0.3, maxLife: 0.3 });
            for (const e of game.enemies.enemies) {
              if (e.hp > 0 && !e.isAlly && v2dist(game.familiarPos, e.pos) < 80) {
                e.hp -= 5; e.hitFlash = 0.3;
                if (e.hp <= 0) game.onEnemyKilled(e);
              }
            }
            game.hud.showMessage('LEASH BREAK!', 1.5);
            break;
          }
        }
      }
    }

    // Update familiar (fetch dog state machine)
    if (game.familiarActive) {
      const famTier = game.runKitTiers['familiar_kit'] || 1;
      const famT3 = game.kitT3Choices['familiar_kit'] || '';
      const huntRange    = (famTier >= 2 && famT3 === 'clean') ? 250 : 200;
      const cooldownTime = (famTier >= 2 && famT3 === 'clean') ? 1.5 : 2.0;
      const biteDmgMult  = (famTier >= 2 && famT3 === 'void')  ? 2.0 : 1.0;
      const durationMult = (famTier >= 2 && famT3 === 'void')  ? 1.5 : 1.0;
      if (game.familiarCooldown > 0) game.familiarCooldown -= dt;
      if (game.familiarSpeedTimer > 0) game.familiarSpeedTimer -= dt;
      if (game.familiarDmgTimer > 0) game.familiarDmgTimer -= dt;

      switch (game.familiarState) {
        case 'idle': {
          const famOrbit = (game.elapsed * 1.5 + Math.PI) % (Math.PI * 2);
          game.familiarPos = { x: game.player.pos.x + Math.cos(famOrbit) * 50, y: game.player.pos.y + Math.sin(famOrbit) * 50 };
          // Spotter perk: mark highest-HP enemy for +30% damage
          if (game.hasPerk('spotter')) {
            let spotBestHp = 0; let spotBestEnemy: Enemy | null = null;
            for (const e of game.enemies.enemies) {
              if (e.hp > 0 && !e.isAlly && v2dist(game.familiarPos, e.pos) < 160 && e.hp > spotBestHp) {
                spotBestHp = e.hp; spotBestEnemy = e;
              }
            }
            if (spotBestEnemy) { spotBestEnemy.markedTimer = 0.5; spotBestEnemy.markedDmgBonus = 1.3; }
          }
          if (game.familiarCooldown <= 0) game.familiarState = 'hunting';
          break;
        }
        case 'hunting': {
          // Find nearest live enemy within hunt range
          let bestDist = huntRange; let bestEnemy: Enemy | null = null;
          for (const e of game.enemies.enemies) {
            if (e.hp <= 0 || e.isAlly) continue;
            const d = v2dist(game.familiarPos, e.pos);
            if (d < bestDist) { bestDist = d; bestEnemy = e; }
          }
          if (!bestEnemy) {
            // No target in range — orbit while waiting
            const famOrbit = (game.elapsed * 1.5 + Math.PI) % (Math.PI * 2);
            game.familiarPos = { x: game.player.pos.x + Math.cos(famOrbit) * 50, y: game.player.pos.y + Math.sin(famOrbit) * 50 };
            break;
          }
          game.familiarTarget = bestEnemy;
          const toTarget = v2sub(bestEnemy.pos, game.familiarPos);
          const distToTarget = v2len(toTarget);
          if (distToTarget < bestEnemy.radius + 8) {
            game.familiarState = 'biting';
          } else {
            const dir = v2norm(toTarget);
            game.familiarPos.x += dir.x * 250 * dt;
            game.familiarPos.y += dir.y * 250 * dt;
          }
          break;
        }
        case 'biting': {
          const tgt = game.familiarTarget;
          if (tgt && tgt.hp > 0) {
            const wdef = WEAPON_DEFS[game.player.weaponId];
            const baseDmg = (wdef ? wdef.damage : 2) + game.weapons.bonusDamage;
            const biteDmg = baseDmg * 0.5 * biteDmgMult;
            tgt.hp -= biteDmg;
            tgt.hitFlash = 0.15;
            game.familiarBuffToken = tgt.isElite ? 'elite' : (tgt.behavior || 'default');
            if (tgt.hp <= 0) game.onEnemyKilled(tgt);
          } else {
            game.familiarBuffToken = 'default';
          }
          game.familiarGlowColor = game.getFamiliarBuffColor(game.familiarBuffToken);
          game.familiarTarget = null;
          game.familiarState = 'returning';
          break;
        }
        case 'returning': {
          const toPlayer = v2sub(game.player.pos, game.familiarPos);
          const distToPlayer2 = v2len(toPlayer);
          if (distToPlayer2 < 20) {
            game.familiarState = 'delivering';
          } else {
            const dir = v2norm(toPlayer);
            game.familiarPos.x += dir.x * 300 * dt;
            game.familiarPos.y += dir.y * 300 * dt;
          }
          break;
        }
        case 'delivering': {
          game.applyFamiliarBuff(game.familiarBuffToken, durationMult);
          // familiar_bond: buff summoned pack allies +30% speed on delivery
          if (game.hasMod('familiar_bond')) {
            for (const e of game.enemies.enemies) {
              if (!e.isAlly) continue;
              e.speed = Math.min(e.speed * 1.3, 210);
            }
          }
          game.familiarGlowColor = 0x9933ff;
          game.familiarCooldown = cooldownTime;
          game.familiarState = 'idle';
          break;
        }
      }
    }

    // Update void surge
    if (game.voidSurgeActive) {
      game.voidSurgeTimer -= dt;
      // Void Trail perk: drop corruption zones during surge
      if (game.hasPerk('void_trail')) {
        game.voidTrailDropTimer -= dt;
        if (game.voidTrailDropTimer <= 0) {
          game.voidTrailDropTimer = 0.3;
          game.smokeZones.push({ x: game.player.pos.x, y: game.player.pos.y, radius: 60, life: 3, maxLife: 3, toxic: true });
        }
      }
      // Phase Burst perk: push enemies at surge end
      if (game.voidSurgeTimer <= 0) {
        if (game.hasPerk('phase_burst')) {
          for (const e of game.enemies.enemies) {
            if (e.hp > 0 && !e.isAlly && v2dist(game.player.pos, e.pos) < 120) {
              const pd = v2norm(v2sub(e.pos, game.player.pos));
              e.pos.x += pd.x * 80;
              e.pos.y += pd.y * 80;
            }
          }
          game.explosions.push({ x: game.player.pos.x, y: game.player.pos.y, radius: 0, maxRadius: 120, life: 0.3, maxLife: 0.3 });
        }
        game.voidSurgeActive = false;
      }
    }

    // Sacrifice invincibility timer
    if (game.sacrificeInvincibleTimer > 0) game.sacrificeInvincibleTimer -= dt;
    game.player.invincibleTimer = game.sacrificeInvincibleTimer;
    // Withdrawal perk: set absorb flag
    game.player.absorbNextHit = game.stimWithdrawalActive && game.hasPerk('withdrawal');

    // Drain Aura perk: heal 1 HP/2s in rupture void pool (check gravity wells as proxy)
    // Actually this uses void pools from rupture - for now check if player near an explosion
    // Simplified: heal when standing in smoke zones marked toxic (from rupture)

    // Frenzy Aura perk: count allies for fire rate bonus (applied in getModDamageMult area)

    // Spotter perk: familiar marks highest-HP enemy (done in familiar update)

    // Adrenaline timer (for modifier)
    if (game.adrenalineTimer > 0) {
      game.adrenalineTimer -= dt;
      if (game.adrenalineTimer <= 0) game.adrenalineKills = 0;
    }

  }
}
