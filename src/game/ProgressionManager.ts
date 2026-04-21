import { type UpgradeCard, type ProgressionState, generateUpgrades } from '../data/upgrades';
import { createEnemy, type Enemy } from './Enemies';
import { CREATURE_DEFS } from '../data/creatures';
import { WEAPON_DEFS, WEAPON_MUTATIONS } from '../data/weapons';
import { KIT_DEFS } from '../data/kits';
import { v2, v2fromAngle, v2dist, randRange } from '../lib/math';
import { halSay, HAL_FIRST_KILL, HAL_ELITE_SPAWNED } from '../data/hal';
import type { Game } from './Game';

export class ProgressionManager {
  onEnemyKilled(enemy: Enemy, game: Game): void {
    // Sacrifice perk: ally death grants 2s invincibility
    if (enemy.isAlly && game.hasPerk('sacrifice')) {
      game.sacrificeInvincibleTimer = 2;
      game.hud.showMessage('SACRIFICE! 2s INVINCIBLE', 1.5);
    }

    // Chain Reaction perk: enemy killed in gravity well spawns corruption zone
    if (game.hasPerk('chain_reaction') && !enemy.isAlly) {
      for (const gw of game.gravityWells) {
        if (v2dist(enemy.pos, { x: gw.x, y: gw.y }) < gw.radius) {
          game.smokeZones.push({ x: enemy.pos.x, y: enemy.pos.y, radius: 40, life: 5, maxLife: 5, toxic: true });
          break;
        }
      }
    }

    // ── Mastery perk effects on kill ──

    // Missile Burst mastery (dart clean): elite kill fires 2 homing missiles
    if (!enemy.isAlly && enemy.isElite && game.hasMod('missile_burst') && game.player.weaponId === 'dart') {
      for (let mb = 0; mb < 2; mb++) {
        const angle = game.player.aimAngle + randRange(-0.4, 0.4);
        game.weapons.bullets.push({
          pos: v2(game.player.pos.x, game.player.pos.y),
          vel: v2fromAngle(angle, 180),
          radius: 4, color: 0x44ff66, damage: game.weapons.bonusDamage + 2,
          life: 3.0, maxLife: 3.0, piercing: false, homing: true,
          bounces: 0, aoeRadius: 0, fromPlayer: true, hitSet: new Set(),
        });
      }
    }

    // Chain Vortex mastery (lance void): killing a pulled enemy spawns a mini vortex
    if (!enemy.isAlly && game.hasMod('chain_vortex') && game.player.weaponId === 'lance') {
      for (const gw of game.gravityWells) {
        if (v2dist(enemy.pos, { x: gw.x, y: gw.y }) < gw.radius) {
          game.gravityWells.push({ x: enemy.pos.x, y: enemy.pos.y, radius: 100, life: 2, maxLife: 2, pullSpeed: 80 });
          break;
        }
      }
    }

    // Rapid Spread mastery (dart void): parasitized enemy death jumps parasite to 2 nearby
    if (!enemy.isAlly && enemy.parasiteTimer > 0 && game.hasMod('rapid_spread') && game.player.weaponId === 'dart') {
      let spread = 2;
      for (const other of game.enemies.enemies) {
        if (spread <= 0) break;
        if (other.id !== enemy.id && other.hp > 0 && !other.isAlly && other.parasiteTimer <= 0 && v2dist(enemy.pos, other.pos) < 120) {
          other.parasiteTimer = game.weapons.parasiteDuration;
          if (game.hasMod('void_latch') && !game.voidLatchOriginalDamage.has(other.id)) {
            game.voidLatchOriginalDamage.set(other.id, other.meleeDmg);
            other.meleeDmg = Math.max(0, Math.floor(other.meleeDmg * 0.8));
          }
          spread--;
        }
      }
    }

    // Toxic Cloud mastery (dart void): parasitized enemy death leaves poison cloud 3s
    if (!enemy.isAlly && enemy.parasiteTimer > 0 && game.hasMod('toxic_cloud') && game.player.weaponId === 'dart') {
      game.smokeZones.push({ x: enemy.pos.x, y: enemy.pos.y, radius: 60, life: 3, maxLife: 3, toxic: true });
    }

    // Multiplier affix: spawn 2 copies at 30% HP
    if (enemy.affixes.includes('multiplier') && !enemy.name.startsWith('Copy:')) {
      for (let mc = 0; mc < 2; mc++) {
        const copy = createEnemy('Void Leech', {
          x: enemy.pos.x + (Math.random() - 0.5) * 60,
          y: enemy.pos.y + (Math.random() - 0.5) * 60,
        }, true);
        copy.name = `Copy: ${enemy.name}`;
        copy.hp = Math.floor(enemy.maxHp * 0.3);
        copy.maxHp = copy.hp;
        copy.speed = enemy.speed;
        copy.radius = enemy.radius * 0.8;
        copy.color = enemy.color;
        copy.meleeDmg = enemy.meleeDmg;
        copy.isElite = false;
        game.enemies.enemies.push(copy);
      }
    }

    game.totalKills++;
    game.targetCount++;
    game.halKillsSinceStreak++;
    game.halKillStreakTimer = 4;

    // Modifier effects on kill
    const isVoidEnemy = enemy.voidType;
    if (game.hasMod('void_hunger') && isVoidEnemy) {
      game.player.hp = Math.min(game.player.hp + 1, game.player.maxHp);
    }
    if (game.hasMod('void_drain') && isVoidEnemy) {
      game.player.corruption = Math.max(0, game.player.corruption - 3);
    }
    if (game.hasMod('vamp')) {
      game.killsSinceLastHeal++;
      if (game.killsSinceLastHeal >= 5) {
        game.killsSinceLastHeal = 0;
        game.player.hp = Math.min(game.player.hp + 1, game.player.maxHp);
      }
    }
    if (game.hasMod('adrenaline')) {
      game.adrenalineKills++;
      game.adrenalineTimer = 3;
      if (game.adrenalineKills >= 3) {
        game.adrenalineStacks++;
        game.adrenalineKills = 0;
      }
    }
    if (game.hasMod('momentum')) {
      game.momentumHits++;
    }

    // Mastery perk kill effects
    // siphon: flame kill restores 1 HP (enemy still burning)
    if (game.hasMod('siphon') && enemy.burnTimer > 0 && game.player.weaponId === 'flamethrower') {
      game.player.hp = Math.min(game.player.hp + 1, game.player.maxHp);
    }
    // res_leech: entropy cannon kill at 60+ corruption heals 1 HP
    if (game.hasMod('res_leech') && game.player.weaponId === 'entropy_cannon' && game.player.corruption >= 60) {
      game.player.hp = Math.min(game.player.hp + 1, game.player.maxHp);
    }
    // res_aura: entropy cannon kill spreads 5 corruption buildup to nearby enemies within 100px
    if (game.hasMod('res_aura') && game.player.weaponId === 'entropy_cannon') {
      for (const other of game.enemies.enemies) {
        if (other.id === enemy.id || other.isAlly || other.hp <= 0) continue;
        if (v2dist(enemy.pos, other.pos) < 100) {
          game.enemyCorruption.set(other.id, (game.enemyCorruption.get(other.id) ?? 0) + 5);
        }
      }
    }
    // Clean up enemy corruption tracking on death
    game.enemyCorruption.delete(enemy.id);


    // HAL: first kill
    if (game.totalKills === 1 && game.halCooldown <= 0) {
      game.hud.showHalMessage(halSay(HAL_FIRST_KILL), 3);
      game.halCooldown = 5;
    }
    if (enemy.isElite && game.halCooldown <= 0) {
      game.hud.showHalMessage(halSay(HAL_ELITE_SPAWNED), 3);
      game.halCooldown = 6;
    }
    if (enemy.isElite) {
      game.eliteKills++;
      // Hunt contract: only elites count toward objective
      if (game.contractType === 'hunt') {
        game.eliteKillsForContract++;
        const remaining = Math.max(0, game.targetTotal - game.eliteKillsForContract);
        if (remaining > 0) {
          game.hud.showMessage(`ELITE DOWN — ${remaining} LEFT`, 2);
        }
      }
      // Stim T3 void: cooldown reset on elite kill
      if ((game.runKitTiers['stim_pack'] || 0) >= 3 && game.kitT3Choices['stim_pack'] === 'void') {
        game.kitCooldowns['stim_pack'] = 0;
      }
    }

    // Drop ingredient
    const def = CREATURE_DEFS[enemy.name];
    if (def && Math.random() < 0.3) {
      game.ingredients.push({ id: `ingredient_${def.ingredient.id}`, name: def.ingredient.name });
    }
    // Salvage module: guaranteed extra ingredient from elites
    if (enemy.isElite && (game.shipUpgrades.salvage_module ?? 0) >= 2 && def) {
      game.ingredients.push({ id: `ingredient_${def.ingredient.id}`, name: def.ingredient.name });
    }

    // World drop capsules
    game.dropSystem.onKill(enemy, game);
  }

  getProgressionState(game: Game): ProgressionState {
    return {
      weaponId: game.player.weaponId,
      weaponLevel: game.weaponLevel,
      weaponMutated: game.player.mutated !== '',
      weaponMutationType: game.player.mutated,
      corruption: game.player.corruption,
      equippedKits: game.equippedKits,
      kitTiers: { ...game.runKitTiers },
      kitPerksTaken: game.kitPerksTaken,
      masteryTaken: game.masteryTaken,
      resonanceTaken: game.resonanceTaken,
      modifiersTaken: game.activeModifiers,
      kitT3Pending: game.kitT3Pending,
    };
  }

  applyUpgrade(card: UpgradeCard, game: Game): void {
    switch (card.type) {
      case 'weapon_upgrade': {
        game.weaponLevel++;
        const wdef = WEAPON_DEFS[game.player.weaponId];
        // Apply perk effect
        if (card.perkEffect === 'damage' && typeof card.perkValue === 'number') {
          // Stored as bonus damage on active modifiers for getModDamageMult
          game.weapons.bonusDamage = (game.weapons.bonusDamage ?? 0) + card.perkValue;
        } else if (card.perkEffect === 'fire_rate' && typeof card.perkValue === 'number') {
          game.weapons.fireRateBonus = (game.weapons.fireRateBonus ?? 0) + card.perkValue;
        } else if (card.perkEffect === 'piercing') {
          game.weapons.piercingCount = (game.weapons.piercingCount ?? 0) + 1;
        } else if (card.perkEffect === 'beam_width') {
          game.weapons.beamWidthMult = 2.0;
        } else if (card.perkEffect === 'fire_rate_mag') {
          game.weapons.fireRateBonus = (game.weapons.fireRateBonus ?? 0) - 0.18;
          game.player.magSize += 6;
        } else if (card.perkEffect === 'pellets') {
          game.weapons.extraPellets = (game.weapons.extraPellets ?? 0) + 1;
        } else if (card.perkEffect === 'pellets_rate') {
          game.weapons.extraPellets = (game.weapons.extraPellets ?? 0) + 2;
          game.weapons.fireRateBonus = (game.weapons.fireRateBonus ?? 0) - 0.24;
        } else if (card.perkEffect === 'bullet_speed' && typeof card.perkValue === 'number') {
          game.weapons.bulletSpeedBonus = (game.weapons.bulletSpeedBonus ?? 0) + card.perkValue;
        } else if (card.perkEffect === 'range_bonus' && typeof card.perkValue === 'number') {
          game.weapons.rangeBonus = (game.weapons.rangeBonus ?? 0) + card.perkValue;
        } else if (card.perkEffect === 'radius' && typeof card.perkValue === 'number') {
          game.weapons.radiusBonus = (game.weapons.radiusBonus ?? 0) + card.perkValue;
        } else if (card.perkEffect === 'bounce_extra' && typeof card.perkValue === 'number') {
          game.weapons.bounceExtra = (game.weapons.bounceExtra ?? 0) + card.perkValue;
        } else if (card.perkEffect === 'bounce_radius' && typeof card.perkValue === 'number') {
          game.weapons.bounceRadiusBonus = (game.weapons.bounceRadiusBonus ?? 0) + card.perkValue;
        } else if (card.perkEffect === 'sniper_range') {
          game.weapons.rangeBonus = (game.weapons.rangeBonus ?? 0) + 100;
          game.weapons.bulletSpeedBonus = (game.weapons.bulletSpeedBonus ?? 0) + 100;
        } else if (card.perkEffect === 'damage_knockback' && typeof card.perkValue === 'number') {
          game.weapons.bonusDamage = (game.weapons.bonusDamage ?? 0) + card.perkValue;
          game.weapons.knockback = true;
        } else if (card.perkEffect === 'burning') {
          game.weapons.burnOnHit = true;
        } else if (card.perkEffect === 'deflect') {
          game.weapons.deflect = true;
        } else if (card.perkEffect === 'laser_range') {
          // Focused Lens: +40% range, +1 damage
          game.weapons.rangeBonus = (game.weapons.rangeBonus ?? 0) + Math.floor(286 * 0.4);
          game.weapons.bonusDamage = (game.weapons.bonusDamage ?? 0) + 1;
        } else if (card.perkEffect === 'laser_mark') {
          game.weapons.laserMark = true;
        } else if (card.perkEffect === 'laser_pierce') {
          game.weapons.laserPierce = true;
        } else if (card.perkEffect === 'lance_trail') {
          game.weapons.lanceTrail = true;
        } else if (card.perkEffect === 'backblast') {
          game.weapons.backblast = true;
        } else if (card.perkEffect === 'proximity_fuse') {
          game.weapons.proximityFuse = true;
        } else if (card.perkEffect === 'siphon_link') {
          game.weapons.siphonLink = true;
        } else if (card.perkEffect === 'shatter_bounce') {
          game.weapons.shatterBounce = true;
        } else if (card.perkEffect === 'killstreak') {
          game.weapons.killstreak = 0; // flag, tracking done in BulletSystem
        } else if (card.perkEffect === 'spin_up') {
          game.weapons.spinUp = true;
        }
        // Boolean perks stored as flags
        game.activeModifiers.push(card.id);
        game.hud.showMessage(`+ ${card.label}`, 2);
        break;
      }
      case 'mutation': {
        game.player.mutated = card.mutationType ?? 'clean';
        const mut = WEAPON_MUTATIONS[game.player.weaponId]?.[game.player.mutated];
        const wid = game.player.weaponId;
        const path = game.player.mutated;

        // Apply mutation stat changes per weapon
        if (wid === 'sidearm' && path === 'clean') {
          // Marksman Beam: fire rate halved, damage x3, +60% range, beam lingers 0.3s
          game.weapons.fireRateBonus += 0.625; // half speed (1.25 -> ~2.5)
          game.weapons.bonusDamage += Math.floor(2.8 * 2); // x3 total
          game.weapons.rangeBonus += Math.floor(286 * 0.6);
          game.weapons.laserLinger = 0.3;
        } else if (wid === 'sidearm' && path === 'void') {
          // Entropy Beam: void seeds on hit, 3 seeds = AOE detonation
          game.weapons.voidSeedOnHit = true;
        } else if (wid === 'scatter' && path === 'clean') {
          // Flechette: tighter spread, pierce 2
          game.weapons.piercingCount += 2;
          game.weapons.bonusDamage += 1;
        } else if (wid === 'scatter' && path === 'void') {
          // Chaos Spray: extra pellets, slight homing
          game.weapons.extraPellets += 3;
        } else if (wid === 'lance' && path === 'clean') {
          // Null Spear: 2x fire rate, slow field on land
          game.weapons.fireRateBonus -= 0.8; // faster
          game.weapons.slowFieldOnLand = true;
        } else if (wid === 'lance' && path === 'void') {
          // Singularity: gravity on hit
          game.weapons.singularityOnHit = true;
        } else if (wid === 'baton' && path === 'clean') {
          // Arc Blade: wider cone, slow fields
          game.weapons.radiusBonus += 20;
          game.weapons.slowFieldOnLand = true;
        } else if (wid === 'baton' && path === 'void') {
          // Consuming Vortex: lifesteal
          game.weapons.lifesteal = true;
        } else if (wid === 'dart' && path === 'clean') {
          // Smart Missile: big slow missile, massive damage
          game.weapons.bonusDamage += 6;
          game.weapons.fireRateBonus += 1.0; // slower
          game.weapons.bulletSpeedBonus -= 60; // slower missile
        } else if (wid === 'dart' && path === 'void') {
          // Parasite Swarm: DOT on hit
          game.weapons.parasiteOnHit = true;
        } else if (wid === 'flamethrower' && path === 'clean') {
          // Cryo Flamer: stun instead of damage
          game.weapons.cryoStun = true;
        } else if (wid === 'flamethrower' && path === 'void') {
          // Corruption Spray: triple damage, player gains corruption
          game.weapons.bonusDamage += 2;
          game.weapons.corruptionOnFire = true;
        } else if (wid === 'grenade_launcher' && path === 'clean') {
          // Airburst: always explode at max range, bigger radius
          game.weapons.radiusBonus += 20;
          game.weapons.airburstOnExpiry = true;
        } else if (wid === 'grenade_launcher' && path === 'void') {
          // Void Grenade: leaves corruption zone
          game.weapons.corruptionZoneOnExplode = true;
        } else if (wid === 'entropy_cannon' && path === 'clean') {
          // Stabilized: flat 3x damage
          game.weapons.bonusDamage += 6;
        } else if (wid === 'entropy_cannon' && path === 'void') {
          // Resonance: corruption scaling triple
          game.weapons.corruptionScaling = true;
        } else if (wid === 'pulse_cannon' && path === 'clean') {
          // Overclock: +50% fire rate
          game.weapons.fireRateBonus -= 0.5;
        } else if (wid === 'pulse_cannon' && path === 'void') {
          // Void Chain: bounces add corruption to enemies
          game.weapons.voidBounce = true;
        } else if (wid === 'sniper_carbine' && path === 'clean') {
          // Killshot: execute enemies under 20% HP
          game.weapons.executeThreshold = 0.2;
        } else if (wid === 'sniper_carbine' && path === 'void') {
          // Void Slug: penetrates all, corruption trail
          game.weapons.piercingCount += 99;
        } else if (wid === 'chain_rifle' && path === 'clean') {
          // Precision Mode: fire rate halved, 4x damage
          game.weapons.fireRateBonus += 0.05; // slower
          game.weapons.bonusDamage += 3;
        } else if (wid === 'chain_rifle' && path === 'void') {
          // Suppressor: slow stacking on hit
          game.weapons.slowOnHit = true;
        }

        game.activeModifiers.push(card.id);
        game.hud.showMessage(`MUTATION: ${mut?.name ?? card.label}`, 3);
        break;
      }
      case 'mastery': {
        game.masteryTaken.push(card.id);
        game.activeModifiers.push(card.id);
        // Apply instant stat changes for mastery perks that modify weapon system values
        if (card.id === 'marksman_reload' && game.player.mutated === 'clean') {
          // Quick Draw: -50% reload time for Marksman Rifle
          game.player.reloadTimeMult = Math.max(0.1, game.player.reloadTimeMult * 0.5);
        } else if (card.id === 'ks_reload') {
          // Quick Scope: -40% sniper reload time
          game.player.reloadTimeMult = Math.max(0.1, game.player.reloadTimeMult * 0.6);
        } else if (card.id === 'ks_execute') {
          // Execute: raise killshot threshold from 20% to 30%
          game.weapons.executeThreshold = Math.max(game.weapons.executeThreshold, 0.3);
        } else if (card.id === 'ks_crit') {
          // Vital Shot: headshot (crit) zone +15px — expand bullet radius so sniper hits more centrally
          game.weapons.radiusBonus = (game.weapons.radiusBonus ?? 0) + 15;
        } else if (card.id === 'pm_damage') {
          // Heavy Rounds: +2 damage in precision mode
          game.weapons.bonusDamage = (game.weapons.bonusDamage ?? 0) + 2;
        } else if (card.id === 'pm_pierce') {
          // AP Rounds: precision shots pierce 1 enemy
          game.weapons.piercingCount = (game.weapons.piercingCount ?? 0) + 1;
        } else if (card.id === 'pm_range') {
          // Extended Barrel: +60px range
          game.weapons.rangeBonus = (game.weapons.rangeBonus ?? 0) + 60;
        }
        // Stat-modifying mastery perks applied at pick time (flamethrower, entropy, pulse)
        if (card.id === 'cryo_range') game.weapons.rangeBonus += 40;
        if (card.id === 'void_flames') game.weapons.piercingCount += 1; // flame particles pierce 1 enemy
        if (card.id === 'stable_focus') game.weapons.fireRateBonus -= 0.012; // ~15% faster (base 0.08s)
        if (card.id === 'stable_pierce') game.weapons.piercingCount += 2;
        if (card.id === 'stable_range') game.weapons.rangeBonus += 60;
        if (card.id === 'oc_speed') game.weapons.bulletSpeedBonus += 35; // 25% of base 140
        if (card.id === 'oc_range') game.weapons.rangeBonus += 80;
        if (card.id === 'vc_extra') game.weapons.bounceExtra += 2;
        this.applyMasteryPerk(card.id, game);
        game.hud.showMessage(`MASTERY: ${card.label}`, 2);
        break;
      }
      case 'kit_tier': {
        const kitId = card.kitId!;
        const newTier = card.newTier ?? 2;
        game.runKitTiers[kitId] = newTier;
        game.player.maxHp += 1;
        game.player.hp = Math.min(game.player.hp + 1, game.player.maxHp);
        game.hud.showMessage(`${(KIT_DEFS[kitId]?.name ?? kitId).toUpperCase()} TIER ${newTier}`, 2);
        break;
      }
      case 'kit_perk': {
        game.kitPerksTaken.push(card.id);
        game.activeModifiers.push(card.id);
        game.hud.showMessage(`+ ${card.label}`, 2);
        break;
      }
      case 'resonance': {
        game.resonanceTaken.push(card.id);
        game.activeModifiers.push(card.id);
        game.hud.showMessage(`RESONANCE: ${card.label}`, 2);
        break;
      }
      case 'modifier': {
        game.activeModifiers.push(card.id);
        // Apply instant modifier effects
        if (card.id === 'tough') { game.player.maxHp += 3; game.player.hp = game.player.maxHp; }
        else if (card.id === 'speed') { game.player.baseSpeed += 25; }
        else if (card.id === 'magplus') { game.player.magSize += 4; }
        else if (card.id === 'dodge') { game.player.dodgeChance = 0.1; }
        else if (card.id === 'corruption_resist') { game.player.corruptionResistMult = 0.75; }
        else if (card.id === 'mastery_dmg') { game.weapons.bonusDamage = (game.weapons.bonusDamage ?? 0) + 2; }
        game.hud.showMessage(`+ ${card.label}`, 2);
        break;
      }
      case 'fallback': {
        if (card.id === 'hp_restore') {
          game.player.hp = Math.min(game.player.hp + 3, game.player.maxHp);
        } else if (card.id === 'corr_purge') {
          game.player.corruption = Math.max(0, game.player.corruption - 20);
        } else if (card.id === 'void_drain_f') {
          game.activeModifiers.push('void_drain');
        } else if (card.id === 'pack_hunter_f') {
          game.activeModifiers.push('pack_hunter');
        }
        game.hud.showMessage(`+ ${card.label}`, 2);
        break;
      }
    }
  }

  applyMasteryPerk(id: string, game: Game): void {
    // ── SCATTER clean ──
    if (id === 'tight_spread') { game.weapons.extraPellets += 1; game.weapons.spreadBonus += 0.08; }
    if (id === 'glass_cannon') {
      game.weapons.bonusDamage += 3;
      game.player.maxHp = Math.max(1, game.player.maxHp - 2);
      game.player.hp = Math.min(game.player.hp, game.player.maxHp);
    }
    if (id === 'penetrator') { game.weapons.piercingCount += 1; }
    // stagger, feedback, swarm_chaos, contagion, frenzy — handled in update/hit loops

    // ── LANCE clean ──
    if (id === 'chain_null') { game.weapons.piercingCount += 2; }
    // slow_field_persist, aimed_shot, field_expand — handled in update/hit loops

    // ── LANCE void ──
    // nested_vortex, vortex_damage, chain_vortex, void_attractor — handled in update/hit loops

    // ── DART clean ──
    if (id === 'tracking_plus') { game.weapons.missileTrackingMult = 1.5; }
    if (id === 'payload') { game.weapons.missileAoeOnHit = true; }
    // missile_burst — handled in onEnemyKilled
    // multi_lock — handled in fire loop

    // ── DART void ──
    if (id === 'deep_parasite') { game.weapons.parasiteDuration = 6; }
    // rapid_spread, toxic_cloud, void_latch — handled in hit/kill loops

    // ── GRENADE LAUNCHER clean ──
    if (id === 'wide_burst') { game.weapons.aoeRadiusBonus += 30; }
    if (id === 'barrage') { game.weapons.fireRateBonus -= 0.5; } // 2.5s base * 0.2 = 0.5 reduction
    // carpet_bomb — handled in fire loop
    // concussion — handled in explosion loop

    // ── GRENADE LAUNCHER void ──
    // corr_zone_expand, zone_damage, void_pull, cascade_void — computed inline using hasMod()
  }

}
