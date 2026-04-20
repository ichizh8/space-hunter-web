# Planet Modifiers -- Physics-First World Identity

**Status:** Design  
**Date:** 2026-04-20  
**Goal:** Each planet feels physically different the moment you land. Movement, weapons, and enemies all respond to the planet's environment. This replaces contract-type variety as the primary source of gameplay variation.

---

## Core Thesis

Right now, variety comes from 5 contract types (Hunt, Payload Escort, Void Breach, Boss Hunt, Extraction Run). But the moment-to-moment gameplay feels the same regardless of planet. The fix: make the planet itself change how the game *feels* at the input level -- movement inertia, bullet physics, weapon behavior, enemy tuning. Contract types become secondary flavor on top of fundamentally different physical experiences.

**Design principle:** The player should know which planet they're on *with their eyes closed*, just from how the controls respond.

---

## 1. Planet Physics Profiles

Each planet defines a `PlanetPhysics` object applied at hunt start.

### Kepler Outpost -- "Training Ground"
The baseline. Everything behaves as expected. New players learn mechanics here without surprises.

```
moveSpeedMult:     1.0       // normal
inertia:           0.0       // instant direction changes (current behavior)
bulletSpeedMult:   1.0       // normal
bulletLifeMult:    1.0       // normal range
fireRateMult:      1.0       // normal
enemySpeedMult:    1.0       // normal
```

**Feel:** Snappy, responsive, arcade. The control scheme players internalize as "default."

### Tidal Flats -- "Momentum World"
Water and tidal forces create momentum-based movement. You slide, bullets drift, everything has weight.

```
moveSpeedMult:     1.10      // slightly faster top speed
inertia:           0.35      // 0=instant stop, 1=ice; 0.35 = noticeable slide
bulletSpeedMult:   0.80      // bullets travel slower through dense atmosphere
bulletLifeMult:    1.25      // compensate: bullets live longer so effective range stays close
fireRateMult:      1.0       // unchanged
enemySpeedMult:    0.90      // enemies also affected by tidal drag
```

**Feel:** Skating on wet ground. Plan your movements. Shotgun/melee rewarded (don't need bullet travel). Sniper penalized (slow bullets = harder to lead shots). The slide creates panic moments when you can't stop before hitting an enemy cluster.

**Weapon-specific overrides:**
- Beam weapons (laser, void beam): range -15% (atmosphere absorbs beams)
- Homing weapons (dart): tracking speed -30% (darts fight the current)
- Melee (plasma sword): +10% reach (momentum carries the swing)
- Scatter: spread widens +15% (pellets drift apart)

### Void Reach -- "Low Gravity"
Alien physics. Everything floats, trajectories arc strangely, the world feels uncanny.

```
moveSpeedMult:     0.85      // slower base movement
inertia:           0.20      // mild float
bulletSpeedMult:   1.30      // bullets fly faster in low-density void
bulletLifeMult:    0.70      // but burn out faster (void energy decay)
fireRateMult:      0.90      // weapons cycle slightly slower (void interference)
enemySpeedMult:    1.10      // void creatures adapted, actually faster here
```

**Feel:** Eerie, floaty, dangerous. Your bullets are fast but short-range. Enemies close distance quickly. Close-quarters combat in a world that makes close quarters uncomfortable. The slight inertia makes dodging require more foresight.

**Weapon-specific overrides:**
- Beam weapons (laser, void beam): range +25%, damage +10% (void energy amplifies beams)
- Grenade launcher: AOE radius +30% (explosions expand in low density)
- Flamethrower: range -25% (flames dissipate in void atmosphere)
- Sniper: bullet speed +20% additional (stacks with global boost, sniper rounds scream here)
- Piercing weapons: pierce +1 additional enemy (less resistance)

### Furnace -- "Heavy World"
Extreme gravity, dense atmosphere, oppressive heat. Everything is harder. The endgame planet.

```
moveSpeedMult:     0.80      // heavy gravity slows you
inertia:           0.0       // but stops are instant (gravity pins you down)
bulletSpeedMult:   0.65      // bullets fight gravity and heat distortion
bulletLifeMult:    0.85      // bullets die faster
fireRateMult:      1.15      // weapons overheat faster (longer cooldown between shots)
enemySpeedMult:    0.80      // enemies also heavy, but hit harder (see enemy mods below)
```

**Feel:** Oppressive, tactical, slow-burn. Every bullet matters because fire rate is worse and bullets are sluggish. Positioning is king because you can't run away easily. Melee becomes viable because closing distance is symmetrical (enemies also slow). The difficulty comes from *weight*, not speed.

**Weapon-specific overrides:**
- Beam weapons (laser, void beam): unchanged (beams ignore atmosphere)
- Scatter: damage +20% (heavy pellets hit harder at close range)
- Grenade launcher: AOE radius -20% (gravity compresses explosions) but damage +15%
- Homing weapons (dart): tracking +40% (slow targets are easy to track)
- Flamethrower: range +20% (heat feeds flames)
- Pulse cannon: bounce count -1 (gravity kills momentum)

---

## 2. The Inertia System

Currently, Player.update() applies velocity directly from input direction:
```ts
this.vel = v2mul(dir, this.speed * speedMod);
```

With inertia, we blend between current velocity and target velocity:
```ts
const targetVel = v2mul(dir, this.speed * speedMod);
const blend = 1 - Math.pow(inertia, dt * 60); // framerate-independent blend
this.vel.x += (targetVel.x - this.vel.x) * blend;
this.vel.y += (targetVel.y - this.vel.y) * blend;
```

At `inertia=0`, blend=1, instant response (current behavior).  
At `inertia=0.35` (Tidal), it takes ~0.3s to fully change direction.  
At `inertia=0.20` (Void), subtle but noticeable float.

**Critical:** Inertia also applies to stopping. When the player releases all input, velocity decays at the same rate. This is what creates the "sliding" feel.

**Enemy inertia:** Enemies get 50% of the planet's inertia value. They're adapted to their world but still affected. This keeps combat feeling consistent with the planet's physics.

---

## 3. Weapon Behavior Matrix

Full modifier table. Values are multipliers applied on top of the planet's global modifiers.

| Weapon | Kepler | Tidal | Void Reach | Furnace |
|--------|--------|-------|------------|---------|
| Laser Pistol | -- | range x0.85 | range x1.25, dmg x1.10 | -- |
| Scatter | -- | spread x1.15 | -- | dmg x1.20 |
| Lance | -- | speed x0.85 | pierce +1 | speed x0.80 |
| Plasma Sword | -- | reach x1.10 | -- | -- |
| Dart | -- | tracking x0.70 | -- | tracking x1.40 |
| Flamer | -- | -- | range x0.75 | range x1.20 |
| Grenade | -- | -- | AOE x1.30 | AOE x0.80, dmg x1.15 |
| Void Beam | -- | range x0.85 | range x1.25, dmg x1.10 | -- |
| Pulse | -- | -- | -- | bounces -1 |
| Sniper | -- | speed x0.85 | speed x1.20 | speed x0.80 |
| Chain Rifle | -- | -- | -- | -- |

**Design intent:** No weapon is uniformly "best." Each planet has a 2-3 weapon meta that rewards experimentation. Players who only use one weapon will hit walls; players who adapt to each planet's physics will thrive.

Weapon meta per planet:
- **Kepler:** Everything works. Learn your weapons here.
- **Tidal:** Melee/scatter/flamer shine. Sniper/dart struggle.
- **Void:** Beam weapons dominate. Sniper is godlike. Flamer useless.
- **Furnace:** Melee/scatter/dart excel. Ranged projectiles suffer across the board.

---

## 4. Enemy Modifiers Per Planet

Beyond speed changes, planets modify enemy behavior:

### Tidal Flats
- All enemies: knockback effectiveness +50% (tidal slide)
- Ranged enemies: projectile speed -20% (their bullets also fight the atmosphere)
- Pack enemies: pack radius wider (drift apart in tidal forces)

### Void Reach
- All enemies: +10% damage dealt (void empowers them)
- Melee enemies: lunge range +20% (low gravity leap)
- Elite enemies: gain a void teleport (short-range blink every 8s)

### Furnace
- All enemies: +25% HP (heat-hardened)
- All enemies: -20% speed (heavy gravity)
- Ranged enemies: fire rate -15% (weapons overheat)
- Boss enemies: +1 additional phase (endgame difficulty)

---

## 5. Contract Type Simplification

### Cut to 3 Types

The 5 contract types added complexity without enough payoff. With planet modifiers creating real mechanical variety, contracts can focus on *objective structure*:

**HUNT** (keep)
Core gameplay. Kill targets, survive, clear rooms. The bread and butter.

**EXTRACTION** (merge Extraction Run + Payload Escort)
Collect/deliver objectives across rooms. Sometimes you gather caches, sometimes you escort a pod. The variant is rolled per contract. Extraction contracts have a timer pressure element.

**SIEGE** (merge Void Breach + Boss Hunt)
Hold position or kill a major target. Defensive gameplay. Void Breach becomes a Siege variant on Void Reach. Boss Hunt becomes a Siege variant on any planet.

### Why This Works
- 3 types x 4 planets = 12 distinct experiences (vs. current 5 types x "same feel" = 5)
- Each planet's physics make the same contract type play differently:
  - Hunt on Tidal = sliding dodge-fights
  - Hunt on Furnace = slow tactical room-clearing
  - Siege on Void = floaty defense against fast void enemies
  - Extraction on Tidal = momentum-based speedrun

### Updated Planet Allowed Types
```
Kepler:     ['hunt', 'extraction']
Tidal:      ['hunt', 'extraction', 'siege']
Void Reach: ['hunt', 'siege']
Furnace:    ['hunt', 'siege']
```

Extraction is available on Kepler and Tidal (the more "navigable" planets). Siege is the advanced contract type for harder planets.

---

## 6. Visual/Audio Planet Identity

Each planet should also signal its modifier through visuals:

**Tidal Flats:**
- Subtle particle drift (floating motes moving laterally)
- Player leaves a wake trail when moving
- Bullet trails are longer, slightly curved
- Ambient: low rumble, distant water

**Void Reach:**
- Screen-edge vignette (purple)
- Faint afterimage on player movement (ghosting)
- Bullets leave void-color trails that linger
- Ambient: unsettling hum, silence punctuated by distortion

**Furnace:**
- Heat shimmer overlay (subtle sine distortion on Y)
- Orange particle embers floating upward
- Bullets glow brighter, leave shorter trails
- Ambient: deep industrial rumble, metal stress sounds

---

## 7. Data Structure

```ts
export interface PlanetPhysics {
  moveSpeedMult: number;
  inertia: number;           // 0 = instant, 1 = ice
  bulletSpeedMult: number;
  bulletLifeMult: number;
  fireRateMult: number;      // >1 = slower fire rate (longer cooldown)
  enemySpeedMult: number;
  enemyHpMult: number;
  enemyDamageMult: number;
  knockbackMult: number;
}

export interface PlanetWeaponMod {
  weaponId: string;
  speedMult?: number;
  rangeMult?: number;
  damageMult?: number;
  spreadMult?: number;
  aoeMult?: number;
  trackingMult?: number;
  piercingAdd?: number;
  bouncesAdd?: number;
  reachMult?: number;        // melee only
}

// Added to existing Planet interface:
export interface Planet {
  // ... existing fields ...
  physics: PlanetPhysics;
  weaponMods: PlanetWeaponMod[];
}
```

---

## 8. Integration Points

### Player.ts
- `update()`: Replace direct velocity assignment with inertia blend
- Read `planetPhysics.inertia` and `planetPhysics.moveSpeedMult` from game state

### Weapons.ts
- `fire()`: Apply `planetPhysics.fireRateMult` to cooldown
- `createBullets()`: Apply `bulletSpeedMult` and `bulletLifeMult` to all bullet creation
- Apply `PlanetWeaponMod` overrides per weapon ID

### Enemies.ts / SpawnManager.ts
- Scale enemy speed by `enemySpeedMult`
- Scale enemy HP by `enemyHpMult` at spawn time
- Scale enemy damage by `enemyDamageMult`

### Game.ts
- Load `PlanetPhysics` from contract's planet at hunt init
- Pass physics to Player, WeaponSystem, SpawnManager
- Apply knockback multiplier in collision handling

### contracts.ts
- Simplify to 3 contract types
- Update `allowedContractTypes` per planet
- Remove payload_escort and void_breach specific fields (merge into extraction/siege)

### ContractObjectives.ts
- Refactor to handle 3 types: hunt, extraction, siege
- Extraction: unify cache collection and pod escort logic
- Siege: unify hold-position and boss-kill logic

---

## 9. Progression Feel

The planet modifier system creates a natural difficulty curve that goes beyond numbers:

1. **Kepler (start):** Standard physics. Learn mechanics, build muscle memory.
2. **Tidal (mid):** Inertia disrupts muscle memory. Forces adaptation. Rewards new weapon choices.
3. **Void (late):** Fast enemies + short bullet range + float = constant pressure. Beam weapons suddenly essential.
4. **Furnace (endgame):** Everything is hard. Slow, heavy, punishing. Mastery of positioning required.

This maps to the psychology principle: **desirable difficulty**. Each planet doesn't just add bigger numbers -- it asks you to *play differently*. That's what keeps the game engaging through 4 planets instead of feeling like the same thing with higher HP enemies.

---

## 10. Room Modifier Interaction

Existing room modifiers (Armory Cache, Dense Pack, Void Fog, etc.) stack multiplicatively with planet modifiers. This creates emergent combinations:

- Dense Pack + Tidal inertia = can't stop sliding into huge packs
- Armory Cache + Furnace fire rate penalty = cancels out, feels normal (relief)
- Void Fog + Void Reach short bullet range = claustrophobic panic
- Volatile (exploding enemies) + Void low gravity = chain explosions with bigger blast radius

No special interaction code needed. The systems compose naturally because they're all multipliers on the same base values.

---

## 11. Implementation Order

**Phase A -- Physics Core (1 task)**
1. Add `PlanetPhysics` to planet data
2. Implement inertia in Player.update()
3. Apply bullet speed/life multipliers in Weapons.ts
4. Apply enemy speed/HP multipliers in SpawnManager

**Phase B -- Weapon Mods (1 task)**
1. Add `PlanetWeaponMod[]` to planet data
2. Apply weapon-specific overrides in WeaponSystem.fire()
3. Test each weapon on each planet for feel

**Phase C -- Contract Simplification (1 task)**
1. Merge contract types: 5 -> 3
2. Update ContractObjectives.ts
3. Update ContractBoard UI
4. Update planet allowedContractTypes

**Phase D -- Visual Identity (later)**
1. Per-planet particle effects
2. Bullet trail modifications
3. Screen effects (vignette, shimmer)

---

## 12. Balance Checkpoints

After each phase, verify:
- [ ] Kepler still feels identical to current gameplay
- [ ] No weapon becomes completely unusable on any planet (floor: 60% effectiveness)
- [ ] No weapon becomes mandatory on any planet (ceiling: 140% effectiveness)
- [ ] Inertia doesn't make the game feel broken (playtest threshold: can dodge a charge enemy)
- [ ] Enemy difficulty scales appropriately (Furnace should be hard, not unfair)
- [ ] Contract board still generates 3 viable options per refresh

---

## Design Decisions Log

| Decision | Rationale |
|----------|-----------|
| Inertia 0.35 max (not higher) | Above 0.4, dodge-ability drops below fun threshold |
| Kepler has zero modifiers | Preserves tutorial/baseline feel, reduces confusion |
| Beam weapons ignore atmosphere | Gives beams a unique planet-agnostic identity |
| Enemies get 50% player inertia | Full inertia on AI feels broken; half feels natural |
| 3 contract types not 2 | Need extraction (mobile) vs siege (stationary) distinction |
| Furnace: instant stop + slow move | Heavy gravity pins you; feels different from Tidal slide |
| Weapon mods are per-planet static | No RNG on weapon feel; players can plan loadouts |
