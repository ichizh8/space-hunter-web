<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes -- APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Space Hunter Web -- Project Context

**Last synced:** 2026-04-19

## What This Is

Space Hunter Web is the HTML5/browser port of Space Hunter, a top-down arena survival shooter originally built in Godot 4.4. This fork uses Next.js 16 + PixiJS 8 + Zustand 5 + TypeScript.

- **Live:** https://ichizh8.github.io/space-hunter-web/
- **Repo:** github.com/ichizh8/space-hunter-web (public)
- **Godot source (reference):** ~/Projects/space-hunter
- **Deploy:** GitHub Pages via `gh workflow run pages.yml -R ichizh8/space-hunter-web`

## Current State (v47)

Game loop: ShipHub -> ContractBoard (3 random contracts) -> Loadout -> Hunt -> Results -> ShipHub

### What's Built
- 12 levels, hard cap at MAX_LEVEL=12, XP curve ~6x slower
- 28 kit perks across 14 kits (2 per kit), 4-slot kit tree with prerequisites
- 11 weapons (Pistol through Chain Rifle), each with Lv1-5 perks + clean/void mutation fork
- 5 contract types: Hunt, Payload Escort, Void Breach, Boss Hunt, Extraction Run
- 8 regular + 8 standard elites + 4 Apex elites (3-phase boss fights)
- Ship Workbench permanent upgrades (HP, reload, mag, move speed, starting credits, corruption resist, kit slots, familiar)
- Biome visuals, pack enemies, elite reworks, familiar kit companion
- 4800x4800 map with rivers, bridges, caves, void pools

### April 6 Session (Latest)
- Elite charge attack reworked (teleporter entrance with long-range charge)
- Pack enemies (groups 3-5, surround behavior)
- Spawn collision fix, flash trap stun fix
- Laser pistol: instant ray-cast beam, +40% damage, +30% range
- Pulse cannon: slower fire rate, AOE pulses
- Sniper: faster bullet, trail VFX, 4-round mag
- Hub upgrades rework: scanner, thrusters, salvage, emergency protocol (% bonuses)
- World drop capsules (7 types), collect cache rebalance
- Apex boss 3-phase rework (300-550 HP)
- Wave scaling: initial 30, hard cap 60, faster time-based scaling

### Architecture
All modules live in `src/game/`. The pattern: each module exports functions that take `game: Game` as a parameter (using `import type` to avoid circular deps).

- Game.ts (~1,469 lines): coordinator -- delegates to 7 extracted modules
  - BulletSystem.ts -- bullet creation, update, collision, rendering
  - SpawnManager.ts -- wave/elite/apex spawning
  - DropSystem.ts -- drop capsule spawning, collection, effects
  - ContractObjectives.ts -- 5 contract type update loops
  - KitAbilitySystem.ts -- kit activation, cooldowns, effects
  - ProgressionManager.ts -- XP, level-up, upgrades, mastery perks
  - VFXManager.ts -- particles, sprites, entity rendering
- Weapons.ts: firing patterns
- Enemies.ts: behavior state machines (7 types)
- Map.ts: biome rendering, getBiome()
- math.ts: line-segment collision helpers
- constants.ts: XP thresholds
- saveStore.ts: devGiveResources

### Remaining Gaps
- Biome vignettes (need PixiJS v8 compatible approach)
- Mastery perk effects (88 perks), resonance combos (10)
- Recipe/crafting, damage floaters, minimap

## Design Docs (iCloud)
Located at `~/Library/Mobile Documents/com~apple~CloudDocs/Claude/space-hunter/`:
- STATE.md -- full game state reference
- BALANCE-SHEET.md -- live balance values
- DESIGN-PROGRESSION.md -- rep/kitchen/contracts/weapons
- DESIGN-PSYCHOLOGY-MASTER.md -- 100 game psychology techniques
- DESIGN-PSYCHOLOGY-SPACEHUNTER.md -- 21 prioritized for Space Hunter
- DESIGN-WEEKLY-CONTRACT.md -- weekly rotating contracts + leaderboard

## Key Context
- Built by Iurii + Claude (fully AI-agentic)
- No em dashes in written output
- No contrast framing ("not just X", "more than X")
