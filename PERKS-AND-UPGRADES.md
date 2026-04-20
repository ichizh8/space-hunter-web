# Space Hunter — Perks & Upgrades Reference

> Generated from source code as of v47. All values are mechanical (from Game.ts runtime).

---

## Table of Contents

1. [Weapon Base Stats](#1-weapon-base-stats)
2. [Weapon Level Perks (Lv2–5)](#2-weapon-level-perks-lv25)
3. [Weapon Mutations (Lv5 Fork)](#3-weapon-mutations-lv5-fork)
4. [Weapon Mastery Perks (Post-Mutation)](#4-weapon-mastery-perks-post-mutation)
5. [Kit Perks](#5-kit-perks)
6. [Resonance Combos](#6-resonance-combos)
7. [Ship Workbench Upgrades](#7-ship-workbench-upgrades)
8. [World Drop Capsules](#8-world-drop-capsules)
9. [Run Modifiers](#9-run-modifiers)
10. [Upgrade Card Selection](#10-upgrade-card-selection)
11. [XP and Leveling](#11-xp-and-leveling)

---

## 1. Weapon Base Stats

| ID | Name | Pattern | Damage | Fire Rate (s) | Bullet Speed | Range | Mag | Reload (s) |
|----|------|---------|--------|-----------|-------------|-------|-----|---------|
| `sidearm` | Laser Pistol | laser | 2.8 | 1.25 | 420 | 286 | 12 | 1.5 |
| `scatter` | Scatter | scatter | 1/pellet | 0.8 | 360 | 180 | 8 | 1.8 |
| `lance` | Lance | piercing | 5 | 1.6 | 260 | 500 | 4 | 2.0 |
| `baton` | Plasma Sword | melee_aoe | 4 | 0.75 | — | 115 (r=40) | ∞ | 0 |
| `dart` | Dart | homing | 2 | 1.1 | 180 | 400 | 6 | 1.5 |
| `flamethrower` | Flamer | cone_stream | 0.5/tick | 0.07 | 180 | 220 | 60 | 2.5 |
| `grenade_launcher` | Grenade | arc_aoe | 8 | 2.5 | 220 | 300 | 2 | 2.0 |
| `entropy_cannon` | Void Beam | beam_stream | 0.4/tick | 0.08 | 800 | 250 | 80 | 1.0 |
| `pulse_cannon` | Pulse | bounce | 3 | 1.0 | 140 | 550 | 8 | 1.5 |
| `sniper_carbine` | Sniper | single | 8 | 2.5 | 1800 | 600 | 4 | 2.5 |
| `chain_rifle` | Chain | single | 1 | 0.1 | 450 | 280 | 40 | 3.0 |

**Weapon unlock costs** (paid once at Workbench):

| Weapon | Cost |
|--------|------|
| Scatter Pistol | 120 cr |
| Void Lance | 150 cr |
| Shock Baton | 130 cr |
| Homing Dart | 80 cr |
| Flamethrower | 180 cr |
| Grenade Launcher | 160 cr |
| Entropy Cannon | 200 cr |
| Pulse Cannon | 200 cr |
| Sniper Carbine | 220 cr |
| Chain Rifle | 200 cr |

---

## 2. Weapon Level Perks (Lv2–5)

Perks are offered as upgrade cards during a run. Level 5 always unlocks the mutation fork.

### Laser Pistol (sidearm)

| Level | Name | Description | Effect |
|-------|------|-------------|--------|
| 2 | Hair Trigger | Fire rate +25% | `fire_rate -0.09s` |
| 3 | Hollow Point | +2 damage per shot | `damage +2` |
| 4 | Overpressure | Bullets pierce 1 enemy | `piercing = true` |
| 5 | Rapid Fire | Fire rate +40%, mag +6 | `fire_rate_mag` |

### Scatter

| Level | Name | Description | Effect |
|-------|------|-------------|--------|
| 2 | Wide Bore | Cone spread +30%, 1 extra pellet | `pellets +1` |
| 3 | Buckshot | +1 damage per pellet | `damage +1` |
| 4 | Incendiary | Pellets slow enemies 20% for 1s | `slow = true` |
| 5 | Salvo | Fire rate +30%, 2 extra pellets | `pellets_rate` |

### Lance

| Level | Name | Description | Effect |
|-------|------|-------------|--------|
| 2 | Charged Shot | Projectile speed +30% | `bullet_speed +84` |
| 3 | Void Core | +3 damage | `damage +3` |
| 4 | Overload | On kill: fires a 2nd lance automatically | `on_kill_lance = true` |
| 5 | Singularity | Explosion on impact, 60px AOE | `explode = true` |

### Plasma Sword (baton)

| Level | Name | Description | Effect |
|-------|------|-------------|--------|
| 2 | Extended Arc | Blade reach +30px | `radius +30` |
| 3 | Shockwave | Enhanced knockback (100px), stuns enemies 0.5s | `damage_knockback` |
| 4 | Deflect | Blade deflects enemy projectiles back at enemies (2x dmg) | `deflect = true` |
| 5 | Chain Lightning | Damage arcs to 2 extra enemies | `chain = true` |

### Dart

| Level | Name | Description | Effect |
|-------|------|-------------|--------|
| 2 | Lock-On | Tracking speed +50% | `tracking x1.5` |
| 3 | Detonator | Explodes on hit, 40px AOE | `explode = true` |
| 4 | Swarm | Fires 2 darts simultaneously | `dual = true` |
| 5 | Voidseeker | On kill: splits into 2 new darts | `split_on_kill = true` |

### Flamer (flamethrower)

| Level | Name | Description | Effect |
|-------|------|-------------|--------|
| 2 | Fuel Tank | Range +30px | `range_bonus +30` |
| 3 | Napalm | Burn 3 dmg/s (base 2), spreads on kill | `burning = true` |
| 4 | Pressurized | Fire rate +30% | `fire_rate -0.036s` |
| 5 | Fork | Clean: Cryo Flamer \| Void: Corruption Spray | `flamer_fork` |

### Grenade Launcher

| Level | Name | Description | Effect |
|-------|------|-------------|--------|
| 2 | Heavy Ordinance | +3 AOE damage | `damage +3` |
| 3 | Cluster Bomb | Explosion spawns 3 mini grenades | `cluster = true` |
| 4 | Stagger | Explosion knocks enemies back 80px | `grenade_knockback = true` |
| 5 | Fork | Clean: Airburst \| Void: Void Grenade | `grenade_fork` |

### Void Beam (entropy_cannon)

| Level | Name | Description | Effect |
|-------|------|-------------|--------|
| 2 | Overcharge | +1 base damage | `damage +1` |
| 3 | Rapid Decay | Rate of fire +20% | `fire_rate -0.016s` |
| 4 | Penetrating | Penetrating rounds (pierce 1) | `piercing = true` |
| 5 | Fork | Clean: Stabilized \| Void: Resonance | `entropy_fork` |

### Pulse Cannon

| Level | Name | Description | Effect |
|-------|------|-------------|--------|
| 2 | Extra Bounce | +1 bounce (5 total) | `bounce_extra +1` |
| 3 | Impact | +1 damage | `damage +1` |
| 4 | Wide Bounce | Bounce radius +60px | `bounce_radius +60` |
| 5 | Fork | Clean: Overclock \| Void: Void Chain | `pulse_fork` |

### Sniper Carbine

| Level | Name | Description | Effect |
|-------|------|-------------|--------|
| 2 | High Caliber | +3 damage | `damage +3` |
| 3 | Long Barrel | Range +100px, speed +100 | `sniper_range = true` |
| 4 | AP Rounds | Penetrates 2 enemies | `piercing = true` |
| 5 | Fork | Clean: Killshot \| Void: Void Slug | `sniper_fork` |

### Chain Rifle

| Level | Name | Description | Effect |
|-------|------|-------------|--------|
| 2 | Hardened Rounds | +1 damage | `damage +1` |
| 3 | Suppression | Slow +20%, stacks higher | `chain_slow_boost = true` |
| 4 | Auto-Crit | Every 10th bullet auto-crits (3x) | `chain_autocrit = true` |
| 5 | Fork | Clean: Precision Mode \| Void: Suppressor | `chain_fork` |

---

## 3. Weapon Mutations (Lv5 Fork)

Offered as **Legendary** upgrade cards at level 5. Availability depends on corruption:
- Clean path shown if corruption **< 35**
- Void path shown if corruption **> 20**
- Both shown if corruption is 21–34

| Weapon | Clean Mutation | Clean Effect | Void Mutation | Void Effect |
|--------|---------------|-------------|--------------|------------|
| Laser Pistol | **Marksman Rifle** | Fire rate halved, damage x3, +50% range. First shot after reload: instant. | **Entropy Gun** | Each bullet splits into 3 fragments on hit. Fragments bounce off walls once. |
| Scatter | **Flechette** | Tighter cone, pellets pierce 2 enemies. | **Chaos Spray** | 270° cone, pellets home slightly. Chip dmg to self if enemies in 40px. |
| Lance | **Null Spear** | Fire rate x2, leaves a 3s slow field where it lands. | **Singularity** | On hit: 2s gravity vortex. Your bullets deal +50% to pulled enemies. |
| Plasma Sword | **Arc Blade** | Melee leaves 3s slow fields on the ground. | **Consuming Vortex** | AOE expands 1.5s. Drains HP from enemies, heals you. |
| Dart | **Smart Missile** | Single large slow missile. Massive damage, perfect tracking. | **Parasite Swarm** | Darts latch on, drain HP 4s. Spreads to 1 nearby enemy on death. |
| Flamer | **Cryo Flamer** | Freezes enemies. No damage, 2s stun per hit. | **Corruption Spray** | +5 corruption/s to player while firing, triple damage. |
| Grenade | **Airburst** | Explodes at max range regardless. Hits everything in 80px. | **Void Grenade** | Explosion leaves a corruption zone for 5s. |
| Void Beam | **Stabilized** | Damage ignores corruption state, stays at 3x multiplier. | **Resonance** | Corruption gain from kills +50%, triple scaling. |
| Pulse Cannon | **Overclock** | Fire rate +50%, limited to 3 bounces. | **Void Chain** | Each bounce adds +2 corruption to enemy, no self damage. |
| Sniper Carbine | **Killshot** | One-shots enemies under 20% HP. | **Void Slug** | Leaves corruption trail along bullet path. |
| Chain Rifle | **Precision Mode** | Fire rate halved, each bullet does 4x damage, no slow. | **Suppressor** | Slowed enemies take +30% from all sources, +50% corruption on hit. |

---

## 4. Weapon Mastery Perks (Post-Mutation)

After mutating, mastery perks unlock as **Rare** cards. Up to 2 are offered per upgrade screen. All 4–5 are available to collect over multiple level-ups.

### Laser Pistol — Clean (Marksman Rifle)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `killcam` | Killcam | After a kill: next shot fires instantly (no cooldown). | Clears `fireCooldown` on next shot after a kill sets `killcamReady = true`. |
| `headhunter` | Headhunter | +50% damage vs elites. | `finalDmg * 1.5` when `enemy.isElite`. |
| `suppressor` | Suppressor | Shots do not aggro nearby undetected enemies. | Skips `isAggroed = true` on non-aggroed enemies. |
| `armor_pierce` | Armor Pierce | Ignore corrupted-path armor on hit. | Bypasses the `armored` affix 0.5x damage reduction. |
| `marksman_reload` | Quick Draw | Reload time -50% for Marksman Rifle. | `reloadTimeMult` halved for sidearm clean. |

### Laser Pistol — Void (Entropy Gun)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `fragment_magnet` | Fragment Magnet | Fragments home slightly toward nearest enemy. | Fragment bullets spawned with `homing: true`. |
| `cascade` | Cascade | Fragments can fragment once more on hit. | Fragments tagged `fragment` trigger another split on hit (once per fragment). |
| `entropy_field` | Entropy Field | Each fragment leaves a 0.5s damage patch. | On fragment hit: spawns a 0.5s damage zone at impact position. |
| `overheat` | Overheat | Every 10th shot fires 2x fragments automatically. | On every 10th sidearm shot, auto-fires 2 extra fragments. |

### Scatter — Clean (Flechette)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `tight_spread` | Tight Spread | Cone narrows further, +1 pellet. | Reduces spread angle; adds 1 to pellet count. |
| `stagger` | Stagger | Each pellet has 15% chance to stun 0.5s. | On each pellet hit: `Math.random() < 0.15` → `enemy.stunTimer = 0.5`. |
| `glass_cannon` | Glass Cannon | +3 pellet damage, -2 max HP. | Pellet damage +3; player `maxHp -2` (applied at mutation time). |
| `penetrator` | Penetrator | Pellets pierce 1 additional enemy. | Scatter pellets gain 1 extra pierce. |

### Scatter — Void (Chaos Spray)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `feedback` | Feedback | Self-chip damage heals at 2x rate. | Chip damage from chaos spray heals player at 2× rate. |
| `swarm_chaos` | Swarm Chaos | Pellets bounce off walls once. | Scatter void pellets bounce off map edges once. |
| `contagion` | Contagion | Enemies hit by chaos spread 5 corruption to nearby. | On scatter void hit: spread +5 corruption to nearby enemies (within ~80px). |
| `frenzy` | Frenzy | Each enemy in 40px increases fire rate 10%. | Each enemy within 40px of player reduces scatter `fireCooldown` by 10% (stacks). |

### Lance — Clean (Null Spear)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `slow_field_persist` | Persistent Field | Slow fields last 5s (was 3s). | `fieldDur = 5` instead of 3 when spawning slow field zones. |
| `chain_null` | Chain Null | Null Spear pierces 2 enemies. | Null Spear bullet pierce count increases by 1 (total 2). |
| `aimed_shot` | Aimed Shot | Lance damage +50% if player is standing still. | `finalDmg *= 1.5` when `v2len(player.vel) < 5`. |
| `field_expand` | Field Expand | Slow field radius +40px. | `sfRadius = 80 + 40 = 120px`. |

### Lance — Void (Singularity)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `nested_vortex` | Nested Vortex | Gravity vortex pulls enemies 50% faster. | `pullSpeed = 180` instead of 120 px/s. |
| `vortex_damage` | Vortex Damage | +50% damage to pulled enemies (stacks). | `finalDmg *= 1.5` for enemies currently being pulled by vortex. |
| `chain_vortex` | Chain Vortex | Killing a pulled enemy spawns mini vortex. | On kill of pulled enemy: spawns smaller gravity vortex at kill position. |
| `void_attractor` | Void Attractor | Vortex lasts 1s longer. | `vortexLife = 3` instead of 2 seconds. |

### Plasma Sword — Clean (Arc Blade)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `field_chain` | Field Chain | Arc fields chain to nearest enemy (jump dmg). | On baton hit: slow fields chain (jump) to nearest enemy with damage. |
| `field_persist` | Field Persist | Arc fields last 5s (was 3s). | `fieldDur = 5` when spawning arc blade slow fields. |
| `wide_arc` | Wide Arc | AOE radius +40px. | `outerDist = 110 + radiusBonus + 40`. |
| `static_charge` | Static Charge | 3rd baton hit in 3s: free AOE pulse. | Tracks hit count within 3s window; on 3rd hit fires free AOE pulse. |

### Plasma Sword — Void (Consuming Vortex)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `vortex_speed` | Vortex Speed | Vortex expansion 50% faster. | `vortexLife = 1.0` instead of 1.5s (faster expansion = faster full size). |
| `deep_drain` | Deep Drain | Drain heals +1 HP per 2 enemies. | On vortex drain hit: heals player +1 HP per 2 enemies drained. |
| `overload_void` | Overload | Full vortex expansion fires a shockwave. | When vortex reaches full size (progress ≥ 0.95): fires knockback shockwave. |
| `hunger_field` | Hunger Field | Vortex zone pulls enemies inward. | Active vortex zone applies inward pull force to enemies within radius. |

### Dart — Clean (Smart Missile)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `missile_burst` | Missile Burst | On elite kill: fire 2 smart missiles instantly. | On `onEnemyKilled` with `isElite = true`: immediately fire 2 smart missiles. |
| `tracking_plus` | Tracking Plus | Missile tracking speed +50%. | Smart missile homing turnSpeed ×1.5. |
| `payload` | Payload | Missile explodes on impact 50px AOE. | On smart missile hit: spawn 50px AOE explosion. |
| `multi_lock` | Multi-Lock | Every 3rd missile fires 2 simultaneously. | On every 3rd dart shot: fire 2 darts instead of 1. |

### Dart — Void (Parasite Swarm)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `rapid_spread` | Rapid Spread | Parasite spreads to 2 enemies on death. | On parasitized enemy death: spread parasite to 2 nearby enemies (was 1). |
| `toxic_cloud` | Toxic Cloud | Parasite death leaves a 3s poison cloud. | On parasitized enemy death: spawn 3s damaging cloud at position. |
| `deep_parasite` | Deep Parasite | Parasite duration 6s (was 4s). | `enemy.parasiteTimer = 6` instead of 4. |
| `void_latch` | Void Latch | Parasitized enemies deal 20% less damage. | On parasite attach: stores original damage; reduces enemy damage output by 20%. |

### Flamer — Clean (Cryo Flamer)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `cryo_range` | Cryo Range | Freeze cone range +40px. | Cryo flamer range increases by 40px. |
| `deep_freeze` | Deep Freeze | Stun duration 3s (was 2s). | `enemy.stunTimer = 3.0` instead of 2.0 on cryo hit. |
| `shatter` | Shatter | Frozen enemies take +50% damage from other sources. | `finalDmg *= 1.5` when `enemy.stunTimer > 0` and attacker is not flamethrower. |
| `cryo_aura` | Cryo Aura | Enemies near frozen targets are slowed 30%. | Each frame: enemies within ~60px of frozen (stunned) enemies receive 30% slow. |

### Flamer — Void (Corruption Spray)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `corr_efficiency` | Corruption Efficiency | Corruption cost reduced to +3/s. | `corrGain = 0.25` per tick (×0.07s ≈ 3.5/s) instead of 0.5 (≈ 7/s). Actually: `corrGain = hasMod('corr_efficiency') ? 0.25 : 0.5` per 0.07s tick. |
| `void_flames` | Void Flames | Flame projectiles pierce 1 enemy. | Corruption spray projectiles get `piercing = true`. |
| `corruption_burst` | Corruption Burst | At 80 corruption: next flame burst deals 5x. | When `player.corruption >= 80` and `corruptionBurstReady`: next flame hit deals `dmg * 5`. |
| `siphon` | Siphon | Kill with flames restores 1 HP. | On `onEnemyKilled` when `enemy.burnTimer > 0` and weapon is flamethrower: `player.heal(1)`. |

### Grenade Launcher — Clean (Airburst)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `wide_burst` | Wide Burst | Airburst radius +30px. | Airburst AOE radius increases by 30px. |
| `carpet_bomb` | Carpet Bomb | Fire 2 grenades side-by-side. | After firing: immediately fire a second grenade at ±15px offset. |
| `concussion` | Concussion | Airburst stuns 1s. | On airburst detonation: `enemy.stunTimer = 1.0` for enemies in AOE. |
| `barrage` | Barrage | Fire rate +25%. | Grenade launcher `fireCooldown` reduced 25%. |

### Grenade Launcher — Void (Void Grenade)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `corr_zone_expand` | Zone Expand | Corruption zone radius +40px. | `czRadius = 80 + 40 = 120px` for void grenade corruption zone. |
| `zone_damage` | Zone Damage | Corruption zone deals 2 dmg/s. | Void grenade smoke zone spawned with `tickDamage = 2`. |
| `void_pull` | Void Pull | Corruption zone pulls enemies inward. | Void grenade smoke zone spawned with `pull = true`. |
| `cascade_void` | Cascade | Enemies killed in zone spawn mini zone. | On enemy kill inside corruption zone: spawn smaller 60px corruption zone (3s, same tick dmg/pull). |

### Void Beam — Clean (Stabilized)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `stable_focus` | Stable Focus | Fire rate +15%. | Entropy cannon fire rate +15% (cooldown ×0.85). |
| `stable_pierce` | Stable Pierce | Pierce 2 enemies. | Entropy cannon beam bullets get `piercing` count = 2. |
| `stable_range` | Stable Range | Range +60px. | Entropy cannon range +60px. |
| `stable_crit` | Stable Crit | Every 5th shot crits (2x). | `entropyShotCount % 5 === 0`: `finalDmg *= 2`. |

### Void Beam — Void (Resonance)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `res_scaling` | Deep Resonance | Corruption scaling x4 instead of x3. | `scaleMult = 4` when `corruptionScaling = true` (was 3). |
| `res_aura` | Corruption Aura | Kills spread +5 corruption to nearby enemies. | On entropy cannon kill: spread +5 corruption to enemies within ~100px. |
| `res_leech` | Void Leech | Kills at 60+ corruption heal 1 HP. | On entropy cannon kill when `player.corruption >= 60`: `player.heal(1)`. |
| `res_burst` | Entropy Burst | At 80+ corruption, shots explode 40px AOE. | When `player.corruption >= 80`: each beam hit spawns 40px AOE damage burst. |

### Pulse Cannon — Clean (Overclock)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `oc_speed` | Quick Pulse | Bullet speed +25%. | Overclock bullet `bulletSpeed * 1.25`. |
| `oc_damage` | Heavy Pulse | +2 damage per bounce. | On each bounce: `bullet.damage += 2`. |
| `oc_range` | Extended Reach | Range +80px. | Overclock pulse range +80px. |
| `oc_chain` | Chain Reaction | Final bounce explodes 40px AOE. | On pulse final bounce (`pulseFinalHit`): spawn 40px AOE explosion. |

### Pulse Cannon — Void (Void Chain)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `vc_corrupt` | Deep Chain | Bounce corruption +3 (5 total). | `corrAmt = 5` per bounce instead of 2. |
| `vc_slow` | Chain Slow | Each bounce slows enemy 20% for 1s. | On bounce hit: apply 20% slow for 1s to hit enemy. |
| `vc_extra` | Extra Bounce | +2 bounces. | Void chain bounce count +2. |
| `vc_drain` | Void Drain | Each bounce heals 0.5 HP. | On each void chain bounce hit: `player.heal(0.5)`. |

### Sniper Carbine — Clean (Killshot)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `ks_execute` | Execute | Killshot threshold raised to 30% HP. | One-shot threshold: `enemy.hp / enemy.maxHp < 0.30` (was 0.20). |
| `ks_reload` | Quick Scope | Reload time -40%. | Killshot `reloadTimeMult` reduced by 40%. |
| `ks_crit` | Vital Shot | Headshot zone +15px radius. | Headshot collision zone radius +15px. |
| `ks_chain` | Chain Kill | Killshot resets fire cooldown. | On killshot hit (sniper_trail tag): `player.fireCooldown = 0`. |

### Sniper Carbine — Void (Void Slug)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `vs_trail` | Lingering Trail | Corruption trail lasts 4s. | `trailLife = 4` instead of 2 for void slug trails. |
| `vs_damage` | Void Penetration | +4 damage to corrupted enemies. | `finalDmg += 4` when bullet tag is `sniper_trail` and enemy has corruption. |
| `vs_slow` | Entropic Slug | Trail slows enemies 30%. | `trailSlowing = true`: enemies in trail get 30% slow. |
| `vs_burst` | Void Impact | Headshots on elites create 60px corruption burst. | On sniper_trail headshot on elite: spawn 60px corruption burst at hit position. |

### Chain Rifle — Clean (Precision Mode)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `pm_damage` | Heavy Rounds | +2 damage in precision mode. | Precision mode bullet `damage += 2`. |
| `pm_pierce` | AP Rounds | Precision shots pierce 1 enemy. | Precision mode shots get `piercing = true`. |
| `pm_range` | Extended Barrel | Range +60px. | Chain rifle range +60px. |
| `pm_crit` | Focused Fire | Every 5th shot crits (2x). | `chainRifleShotCount % 5 === 0` when in clean mutation: `damage *= 2`. |

### Chain Rifle — Void (Suppressor)

| Perk ID | Name | Description | Runtime Effect (Game.ts) |
|---------|------|-------------|--------------------------|
| `sp_slow` | Deep Suppression | Slow cap raised to 70%. | `_slowMult = 0.30` (30% remaining speed) instead of 0.50 (50%) for suppressor. |
| `sp_damage` | Void Rounds | +1 damage to slowed enemies. | `finalDmg += 1` when weapon is chain_rifle void and enemy is slowed. |
| `sp_corrupt` | Corruption Feed | Slowed enemies gain +3 corruption/s. | Each frame: slowed enemies gain +3 corruption per second while slowed. |
| `sp_burst` | Suppression Wave | Every 20th bullet: AOE slow 100px. | `chainRifleShotCount % 20 === 0` when void: spawn 100px AOE slow field. |

---

## 5. Kit Perks

Two perks per kit, offered as upgrade cards during a run. Each can only be taken once.

### Kit Tree

```
Starter:  Stim Pack · Flash Trap
Basic:    Smoke Kit (req: Stim T2) · Blink (req: Flash T2) · Charge (req: Stim T2)
Advanced: Chain (req: Blink T2) · Turret (req: Charge T2) · Familiar (req: Smoke T2) · Mirage (req: Blink T2)
Elite:    Anchor (req: Chain T2) · Drone (req: Turret T2) · Pack (req: Familiar T2)
Apex:     Void Surge (req: Anchor T2 + Chain T3) · Rupture (req: Pack T2 + Familiar T3)
```

**Kit unlock costs** (paid once at Workbench):

| Kit | Unlock | T2 Upgrade | T3 Upgrade |
|-----|--------|-----------|-----------|
| Stim Pack | Free | 60 cr | 120 cr |
| Flash Trap | Free | 80 cr | 160 cr |
| Blink | 120 cr | 100 cr | 200 cr |
| Smoke | 100 cr | 80 cr | 180 cr |
| Charge | 120 cr | 100 cr | 200 cr |
| Chain | 150 cr | 120 cr | 220 cr |
| Turret | 150 cr | 120 cr | 220 cr |
| Familiar | 160 cr | 130 cr | 250 cr |
| Mirage | 180 cr | 140 cr | 260 cr |
| Anchor | 180 cr | 150 cr | 280 cr |
| Drone | 200 cr | 150 cr | 300 cr |
| Pack | 180 cr | 150 cr | 280 cr |
| Void Surge | 220 cr | 180 cr | 320 cr |
| Rupture | 250 cr | 200 cr | 380 cr |

**Kit slot expansion**: 200 cr (slot 3), 400 cr (slot 4)

---

### Kit Perk List

| Kit | Perk ID | Name | Rarity | Description | Runtime Effect |
|-----|---------|------|--------|-------------|----------------|
| Stim Pack | `withdrawal` | Withdrawal | Common | After stim wears off: next hit absorbed (0 dmg). | `player.absorbNextHit = true` when `stimWithdrawalActive`. |
| Stim Pack | `adrenaline_spike` | Adrenaline Spike | Rare | Stim causes nearby enemies to scatter 80px. | On stim use: pushes all enemies within ~120px away by 80px. |
| Flash Trap | `trap_magnetism` | Trap Magnetism | Rare | Stunned enemy pulls 2 nearby enemies toward it. | On trap stun: nearest 2 enemies teleport/move toward the stunned enemy. |
| Flash Trap | `fragile_state` | Fragile State | Common | Enemies emerging from stun take 2x dmg for 1s. | When `enemy.stunTimer` expires: sets `fragileTimer = 1.0`; hits during fragile state deal 2× damage. |
| Smoke Kit | `afterburn` | Afterburn | Common | Enemies exiting smoke are slowed 40% for 2s. | On enemy exiting smoke zone: apply 40% slow for 2s. |
| Smoke Kit | `lure` | Lure | Rare | Multiple enemies inside smoke ignore player and attack each other. | Enemies inside smoke zone: clear `targetingPlayer`, attack nearest other enemy. |
| Familiar Kit | `spotter` | Spotter | Common | Familiar marks highest-HP enemy — your bullets +30% to marked target. | Familiar marks enemy with highest HP; marked enemy has `markedDmgBonus = 1.3`. |
| Familiar Kit | `leash_break` | Leash Break | Rare | If familiar is hit, it explodes once (5 dmg, 80px AOE). | On familiar taking damage: trigger one 5 dmg / 80px AOE explosion (once only, `familiarLeashUsed = true`). |
| Blink Kit | `arrival_strike` | Arrival Strike | Common | Blink arrival pushes nearby enemies away 100px. | On blink land: push all enemies within 120px away by 100px. |
| Blink Kit | `swap` | Swap | Rare | Blink teleports to nearest enemy instead of direction. | On blink activate: teleport to position nearest to enemy instead of aim direction. |
| Chain Kit | `conductor` | Conductor | Rare | While enemy is tethered, your bullets ricochet off them once. | Bullet hitting tethered enemy with `stunTimer > 0`: ricochet to nearest other enemy (once per bullet). |
| Chain Kit | `drag` | Drag | Common | Tethered enemy is slowly pulled toward you 20px/s. | Each frame: tethered enemy (`stunTimer > 0`) moves toward player at 20px/s. |
| Charge Kit | `aftershock` | Aftershock | Common | Charge impact leaves a 3s slow field at landing point. | On charge land: spawn slow field zone at landing position, 3s duration. |
| Charge Kit | `redirect` | Redirect | Rare | Hitting a wall during charge bounces you perpendicular. | On charge wall collision: reflect velocity vector perpendicular to wall. |
| Mirage Kit | `magnet_decoy` | Magnet Decoy | Common | Decoy pulls enemies within 120px toward it. | Active decoy: each frame pulls enemies within 120px toward decoy position. |
| Mirage Kit | `copycat` | Copycat | Rare | Decoy fires your last weapon shot every 3s. | Active decoy: fires copy of last weapon's bullet every 3s from decoy position. |
| Turret Kit | `target_priority` | Target Priority | Common | Turret only fires at enemies you have hit in the last 2s. | Turret checks `enemy.lastHitByPlayer < 2s` before targeting. |
| Turret Kit | `overheat_turret` | Overheat | Rare | Turret explodes on death (70px AOE, 4 dmg) instead of disappearing. | On turret expiration/death: spawn 70px AOE dealing 4 damage. |
| Drone Kit | `intercept_link` | Intercept Link | Rare | Drone-intercepted bullets explode (20px AOE) damaging the shooter. | On drone interception: spawn 20px AOE explosion; deals damage back to shooting enemy. |
| Drone Kit | `shepherd` | Shepherd | Common | Drone slowly herds pickups toward player. | Drone each frame: moves nearby ingredient/capsule pickups toward player position. |
| Pack Kit | `sacrifice` | Sacrifice | Rare | When an ally dies, you gain 2s invincibility. | On `onEnemyKilled` where `enemy.isAlly`: player gets 2s of iFrames. |
| Pack Kit | `frenzy_aura` | Frenzy Aura | Common | Each nearby ally increases your fire rate 8% (max 3). | Each frame: count allies within ~200px (max 3); `fireRateBonus *= (1 - count * 0.08)`. |
| Void Surge | `void_trail` | Void Trail | Common | Surge leaves a corruption zone along your path (3s, +3 corr/s to enemies). | During surge: spawn corruption zone segments along player path; 3s lifetime, +3 corruption/s to enemies in zone. |
| Void Surge | `phase_burst` | Phase Burst | Rare | At surge end: shockwave pushes all enemies 80px. | On surge end: push all enemies within screen range away by 80px. |
| Anchor Kit | `crush_zone` | Crush Zone | Common | Enemies inside anchor pull zone take 2x dmg from all sources. | In `getModDamageMult()`: if enemy within any active gravity well radius, `mult *= 2`. |
| Anchor Kit | `chain_reaction` | Chain Reaction | Rare | Enemies killed inside anchor explosion each spawn a mini void pool. | On enemy death during anchor explosion: spawn mini void pool at kill position. |
| Rupture Kit | `scatter_field` | Scatter | Common | Rupture launches shrapnel in 8 directions (3 dmg each). | On rupture activate: fire 8 projectiles in 45° increments, each dealing 3 damage. |
| Rupture Kit | `drain_aura` | Drain Aura | Rare | While inside rupture field, player regenerates 1 HP per 2s. | While rupture field is active: player heals 1 HP every 2s. |

---

## 6. Resonance Combos

Available as **Legendary** cards when both equipped kits are at Tier 3. Only combos for currently equipped kits appear.

| Perk ID | Name | Kit 1 | Kit 2 | Description | Runtime Effect |
|---------|------|-------|-------|-------------|----------------|
| `linked_fuse` | Linked Fuse | Flash Trap | Blink | Blink teleports you to nearest triggered trap. | On blink activate: teleport to `lastFlashTrapPos` instead of aim direction. |
| `sympathetic_fire` | Sympathetic Fire | Drone | Blink | Drone fires when you fire, not on timer. | On player fire: trigger drone to fire immediately (not waiting for `droneFireTimer`). |
| `overcharge_drone` | Overcharge | Drone | Anchor | Drone fires 2x faster after anchor well expires. | After anchor gravity well expires: set `droneFireRate *= 0.5` for drone. |
| `trap_aggro` | Trap Aggro | Flash Trap | Mirage | Decoy automatically moves toward nearest trap. | Active decoy: each frame moves decoy toward nearest `lastFlashTrapPos`. |
| `void_feedback` | Void Feedback | Void Surge | Rupture | Rupture recharges void surge instantly. | On rupture activate: immediately set void surge `cooldownTimer = 0`. |
| `familiar_bond` | Familiar Bond | Familiar | Pack | Familiar buffs your summoned allies (+30% speed). | While familiar is active: summoned pack allies get `speed *= 1.3`. |
| `smoke_blink` | Smoke Step | Smoke Kit | Blink | Blink always lands in a smoke cloud. | On blink land: ensure landing position is inside or spawn smoke zone at landing. |
| `turret_familiar` | Familiar Link | Turret | Familiar | Turret gains familiar healing aura (1 HP regen/5s to player while turret active). | While both turret and familiar are active: `player.heal(1)` every 5s. |
| `chain_anchor` | Gravity Chain | Chain Kit | Anchor | Tethered enemies are also pulled by anchor wells. | In anchor gravity well update: tethered enemies (`stunTimer > 0`) get `pullForce * 2`. |
| `surge_charge` | Surge Charge | Void Surge | Charge Kit | Void surge resets charge kit cooldown instantly. | On void surge activate: set charge kit `cooldownTimer = 0`. |

---

## 7. Ship Workbench Upgrades

Permanent upgrades purchased with credits between runs. Persist across all contracts.

### Utility Upgrades

| ID | Name | Max Lv | Level 1 | Level 2 | Level 3 | Costs |
|----|------|--------|---------|---------|---------|-------|
| `thrusters` | Thrusters | 3 | Dash (1 charge, 150px, 1.5s CD) | 2 dash charges | Cooldown -40% (0.9s) | 80 / 150 / 250 cr |
| `salvage_module` | Salvage Module | 2 | +30% pickup drop chance (1.3× mult) | Guaranteed extra ingredient from elites | — | 100 / 200 cr |
| `emergency_protocol` | Emergency Protocol | 1 | Once per contract: revive with 3 HP when killed | — | — | 300 cr |

**Thrusters runtime**: `dashMaxCharges = thrusterLevel >= 2 ? 2 : 1`; `dashMaxCooldown = thrusterLevel >= 3 ? 0.9 : 1.5`.

### Passive Bonuses

All cost a flat amount per level and stack linearly. Max 5 levels each.

| ID | Name | Effect per Level | Cost per Level | Max Bonus (Lv5) | Runtime |
|----|------|-----------------|---------------|-----------------|---------|
| `conditioning` | Conditioning | +5% max HP | 40 cr | +25% max HP | `maxHp = round(10 * (1 + level * 0.05))` |
| `reflex_training` | Reflex Training | +3% move speed | 40 cr | +15% move speed | `baseSpeed = round(200 * (1 + level * 0.03))` |
| `trigger_discipline` | Trigger Discipline | +4% fire rate | 50 cr | +20% fire rate | `weapons.fireRateBonus = -(level * 0.04)` |
| `combat_training` | Combat Training | +3% damage | 50 cr | +15% damage | In `getModDamageMult()`: `mult *= (1 + level * 0.03)` |
| `quick_hands` | Quick Hands | -5% reload time | 40 cr | -25% reload time | `player.reloadTimeMult = max(0.5, 1 - level * 0.05)` |

---

## 8. World Drop Capsules

Dropped by enemies on death. Despawn after 30–40 seconds. Collected by walking over them.

### Drop Table

| Type | Color | Normal Drop % | Elite Drop % | Effect |
|------|-------|--------------|-------------|--------|
| `medkit` | Green `0x44ff66` | 5% | 20% | Heal +3 HP |
| `void_purge` | Purple `0xaa44ff` | 3% | 15% | Corruption -15 |
| `damage_burst` | Red `0xff2222` | 2% | 2% | +50% damage for 8s |
| `emp_pulse` | Blue `0x22aaff` | 1% | 1% | Deal 15 dmg to all on-screen enemies |
| `ally_drone` | Yellow `0xffdd00` | 1% | 1% | Deploy ally drone (30 HP, 20s lifespan) |
| `speed_boost` | White `0xffffff` | 3% | 3% | +40% move speed for 10s |
| `shield` | Cyan `0x00ffee` | 2% | 2% | Grant 5 shield hits |

**Special case — Apex boss**: `ally_drone` drop chance = **100%** regardless of salvage level.

**Salvage Module multiplier** applied to all drop chances:
- Level 0: ×1.0 (base)
- Level 1: ×1.3
- Level 2: ×1.6

Drop chances are independent rolls per type — multiple capsules can drop from one kill.

**Detailed effects**:
- `damage_burst`: sets `damageBurstTimer = 8`; `getModDamageMult()` returns `mult *= 1.5` while active.
- `emp_pulse`: deals 15 damage to every on-screen enemy (within camera bounds); kills are credited to player.
- `ally_drone`: pushed to `allyDrones` array: `{ hp: 30, maxHp: 30, life: 20, fireTimer: 0.5 }`.
- `speed_boost`: sets `speedBoostTimer = 10`; `getModSpeedMult()` returns `mult *= 1.4` while active.
- `shield`: `player.shieldHits = max(current, 5)` (sets minimum 5, does not stack above 5).

---

## 9. Run Modifiers

Offered as upgrade cards during runs. Common modifiers are 3× more likely to appear than rare.

### Common Modifiers

| ID | Name | Effect |
|----|------|--------|
| `void_hunger` | Void Hunger | Kill void enemies → heal +1 HP |
| `scavenger` | Scavenger | Ingredient drops also grant +1 essence |
| `void_drain` | Void Drain | Kill void enemies → -3 corruption |
| `tough` | Tough | +3 max HP (heal to full) |
| `speed` | Speed | +25 move speed |
| `reload` | Reload | Reload time -30% |
| `magplus` | Magplus | +4 magazine ammo |
| `pack_hunter` | Pack Hunter | +8% damage per enemy within 200px (no cap) |

### Rare Modifiers

| ID | Name | Effect |
|----|------|--------|
| `adrenaline` | Adrenaline | 3 kills in 3s → +5% speed (stacks); tracked as `adrenalineStacks`; `getModSpeedMult() *= (1 + stacks * 0.05)` |
| `stalker` | Stalker | +40% damage to enemies not targeting you; `!enemy.targetingPlayer → mult *= 1.4` |
| `momentum` | Momentum | +15% bullet speed per consecutive hit; tracked as `momentumHits`; `mult *= (1 + hits * 0.15)` |
| `last_stand` | Last Stand | Below 3 HP: +50% damage AND +30% speed; checked in both `getModDamageMult()` and `getModSpeedMult()` |
| `biome_bond` | Biome Bond | +20% damage in starting biome |
| `precision` | Precision | First shot after reload deals 2× damage; `player.justReloaded → mult *= 2` |
| `dodge` | Dodge | 10% chance to dodge a hit |
| `vamp` | Vamp | 1 in 5 kills heals +1 HP |
| `elite_dmg` | Elite Dmg | +30% damage vs elites; `enemy.isElite → mult *= 1.3` |
| `corruption_resist` | Corruption Resist | Corruption gain -25% |

**Modifier roll weighting**: `common = weight 3, rare = weight 1`. Up to 4 random modifiers added to the pool per upgrade screen (shuffled from unused pool).

---

## 10. Upgrade Card Selection

The upgrade system builds a pool of all available cards, assigns weights, then picks 3.

### Rarity Weights

| Rarity | Weight |
|--------|--------|
| Legendary | 5 |
| Rare | 3 |
| Common | 1.5 |

### Type Weights

| Type | Weight |
|------|--------|
| `mutation` | 6 |
| `resonance` | 5 |
| `mastery` | 4 |
| `weapon_upgrade` | 3 |
| `kit_tier` | 3 |
| `kit_perk` | 2.5 |
| `modifier` | 1 |
| `fallback` | 0.5 |

### Selection Algorithm

1. **Build pool** of all available upgrades filtered by current state:
   - **Mutation (Legendary)**: only if weapon is level 5 and not mutated. Clean shown if `corruption < 35`; void shown if `corruption > 20`.
   - **Weapon upgrade (Common/Rare)**: next level perk if `weaponLevel < 5`. Rarity is `common` for levels 2–3, `rare` for levels 4–5.
   - **Mastery (Rare)**: only if mutated. Up to 2 random available mastery perks from current mutation path (shuffled).
   - **Kit tier (Rare)**: T2 upgrade for each equipped kit not yet at T2.
   - **Kit perks (Common/Rare)**: all un-taken perks for equipped kits.
   - **Resonance (Legendary)**: only if both equipped kits are T3. Only combos matching equipped kits.
   - **Modifiers**: 4 random unused modifiers (shuffled from pool).
   - **Fallbacks (always)**: Field Medkit (common), Void Purge (rare), plus conditional fallbacks.

2. **Compute weight** for each card: `RARITY_WEIGHT[rarity] × TYPE_WEIGHT[type]`

3. **Diversity bonus**: if the type has already been picked in the current 3-card selection, weight is multiplied by **0.15** (strong penalty to avoid duplicating types). Duplicate IDs get weight 0.

4. **Pick 3** using weighted random without replacement.

5. **Sort** final 3: Legendary → Rare → Common.

### Fallback Cards (always in pool)

| Label | Rarity | Effect |
|-------|--------|--------|
| Field Medkit | Common | Restore 3 HP immediately |
| Void Purge | Rare | Reduce corruption by 20 |
| Void Drain | Common | (conditional: if not already taken) |
| Pack Awareness | Common | (conditional: if not already taken) |

---

## 11. XP and Leveling

### XP Thresholds

XP is earned per kill (base 1 per kill, scales with enemy type). Maximum level is **12**.

| Level | XP to Reach | Cumulative Kills (approx) |
|-------|-------------|--------------------------|
| 1→2 | 4 | 4 |
| 2→3 | 7 | 11 |
| 3→4 | 12 | 23 |
| 4→5 | 19 | 42 |
| 5→6 | 28 | 70 |
| 6→7 | 38 | 108 |
| 7→8 | 50 | 158 |
| 8→9 | 65 | 223 |
| 9→10 | 82 | 305 |
| 10→11 | 101 | 406 |
| 11→12 | 122 | 528 |

Total kills to reach max level: **~528**.

### Level Rewards

Each level-up presents an upgrade card screen (3 cards chosen via the selection algorithm above).

### Post-Cap Stat Drip

After reaching level 12, every **80 kills** grants one rotating stat buff (cycles through 4 in order):

| Index | Bonus |
|-------|-------|
| 0 | `player.speed += 5` (+5 flat move speed) |
| 1 | `weapons.fireRateBonus -= 0.02` (+fire rate) |
| 2 | `weapons.bulletSpeedBonus += 15` (+15 flat bullet speed) |
| 3 | +reload bonus (applied in weapon system) |

### Corruption Thresholds

| Name | Range | Effect |
|------|-------|--------|
| CLEAN | 0–15 | No debuffs; clean mutation available |
| VALLEY | 16–35 | Both mutations may be available |
| CORRUPT | 60+ | Void Beam/Resonance scaling active; leech effects active |

> Void mutation becomes available at corruption **> 20**. Clean mutation becomes unavailable at corruption **≥ 35**.
