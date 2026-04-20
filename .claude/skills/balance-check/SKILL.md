---
name: balance-check
description: "Game balance analysis for Space Hunter's weapons, perks, kits, enemies, and progression. Use when the user mentions 'balance', 'overpowered', 'underpowered', 'too easy', 'too hard', 'damage numbers', 'DPS', 'scaling', 'difficulty curve', or asks to tune/tweak any combat or progression values. Also trigger when adding new weapons, perks, kits, or enemy types -- any new content needs a balance sanity check against existing content."
---

# Balance Check

Structured game balance analysis for Space Hunter. Every number in the game is part of a web -- changing one value ripples through weapons, perks, enemies, and progression. This skill helps you see the ripples before they become waves.

## When To Run

- Adding a new weapon, perk, kit, or enemy type
- Changing any damage, HP, fire rate, or speed value
- After a playtest where something felt "off"
- Before any session that touches combat math
- When the user says something "feels too strong" or "nobody would pick this"

## Step 1: Gather Current Values

Read the relevant data files and build comparison tables. The key sources are:

- `src/data/weapons.ts` -- all weapon stats (damage, fire rate, range, mag size, reload)
- `src/data/kits.ts` -- 14 kits with 28 perks (2 per kit), 4-slot tree with prerequisites
- `src/data/creatures.ts` -- enemy HP, damage, speed, behavior
- `src/data/elites.ts` -- elite variants and apex bosses
- `src/data/upgrades.ts` -- Ship Workbench permanent upgrades
- `src/game/constants.ts` -- XP thresholds, level cap (12), scaling values
- `src/game/Game.ts` -- wave scaling, spawn rates, drop rates

Also check the design docs if available:
- `~/Library/Mobile Documents/com~apple~CloudDocs/Claude/space-hunter/BALANCE-SHEET.md`
- `~/Library/Mobile Documents/com~apple~CloudDocs/Claude/space-hunter/STATE.md`

## Step 2: DPS and TTK Analysis

For weapons, calculate:

| Weapon | Damage | Fire Rate | DPS | Mag | Burst DPS | TTK (basic) | TTK (elite) |
|--------|--------|-----------|-----|-----|-----------|-------------|-------------|
| Pistol | ... | ... | ... | ... | ... | ... | ... |

**DPS** = damage * fire rate
**Burst DPS** = (damage * mag size) / (mag size / fire rate)
**TTK** = enemy HP / DPS (time to kill)

Flag any weapon where:
- DPS is 2x+ higher than the next closest weapon at the same unlock tier
- TTK against basic enemies is under 0.3s (too trivial) or over 5s (tedious)
- Burst DPS makes the sustained DPS irrelevant (one-mag kill on everything)

## Step 3: Perk Impact Analysis

For perks and kit bonuses:
- Calculate the effective DPS/survivability change each perk provides
- Flag perks that provide less than 5% improvement (not worth a slot)
- Flag perks that provide more than 50% improvement (mandatory pick, kills build diversity)
- Check for perk combos that stack multiplicatively in unintended ways
- Verify mutation forks (clean vs void) offer genuinely different playstyles, not one dominant path

## Step 4: Enemy Scaling Check

For the wave/difficulty progression:
- At each level bracket (1-4, 5-8, 9-12), calculate player expected DPS vs enemy HP pools
- Check if any enemy type becomes irrelevant (dies too fast to matter) at higher levels
- Verify elite HP/damage scales proportionally with player power growth
- Check apex boss phase transitions -- are phase HP thresholds reachable with all weapon types?
- Verify pack enemies (groups 3-5) don't create impossible damage spikes

## Step 5: Progression Curve

- XP requirements per level (6x slower curve, 12 max)
- Expected time-to-level at each point
- Power increase per level vs difficulty increase per level
- Are there dead zones where player power plateaus but difficulty keeps climbing?
- Are there power spikes where a new unlock trivializes current content?

## Step 6: Report

Summarize findings as:

**Healthy:** Systems that are well-balanced, with reasoning
**Watch:** Values that are borderline, worth monitoring in playtests
**Action needed:** Clear imbalances with specific value suggestions

For each "action needed" item, propose:
- The specific value change (old -> new)
- Why this fixes the imbalance
- What else might be affected by the change

## Rules

- Balance is about player CHOICE. If one option is always correct, something is wrong.
- "Balanced" does not mean "equal." A sniper should kill differently than a shotgun. The goal is that both are viable paths, not that they produce the same DPS.
- Consider the full build, not isolated stats. A weapon that looks weak alone might be strong with the right kit perks.
- Player skill variance matters. A high-skill weapon (sniper) can have higher theoretical DPS than a low-skill weapon (auto-rifle) because it's harder to achieve.
- Fun trumps math. If something is slightly overtuned but feels amazing, note it but don't automatically nerf it.
- Always state assumptions. "Assuming 80% hit rate" or "assuming the player has 2 kit perks unlocked by level 6."
