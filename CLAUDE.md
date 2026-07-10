<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes -- APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Space Hunter Web -- Project Context

**Last synced:** 2026-07-10

## What This Is

Space Hunter Web is the HTML5/browser port of Space Hunter, a top-down arena survival shooter originally built in Godot 4.4. This fork uses Next.js 16 + PixiJS 8 + Zustand 5 + TypeScript.

- **Live:** https://ichizh8.github.io/space-hunter-web/
- **Repo:** github.com/ichizh8/space-hunter-web (public)
- **Godot source (reference):** ~/Projects/space-hunter
- **Deploy:** GitHub Pages, auto on push to main (also `gh workflow run pages.yml -R ichizh8/space-hunter-web`)

## Current State (post room-system pivot, April 20 2026)

Development paused 2026-04-20 mid-pivot from the single 4800x4800 open map to a room-based structure. The room system works but has not been through a full polish/balance pass. That is the resume point.

Game loop: hub room (walkable, tap/E to interact) -> ContractBoard (3 random contracts) -> Loadout -> Hunt (room-to-room progression with doors, boss rooms) -> Results -> hub. Screens: `hub | contracts | loadout | hunt | results` in `src/store/gameStore.ts`.

### What's Built
- Room system: portrait-oriented rooms, doors with labels, enemy indicators, boss room flow, room-to-room progression (`src/game/rooms/`, room JSON in `src/data/rooms/`)
- 5 planets as physics modifiers (kepler, tidal, void_reach, furnace, hollow) -- inertia, bullet speed/life, fire rate, enemy tuning, per-weapon overrides (`src/data/planets.ts`, design: `DESIGN-PLANET-MODIFIERS.md`)
- Phase 3-4 content: Void Reach + Furnace rooms and enemies; The Hollow 4-phase final boss
- 11 weapons with Lv1-5 perks + clean/void mutation fork; latest reworks: Void Swarm (replaced Chain Rifle), laser pistol auto-target, flamethrower particle rework, void beam
- 14 kits, 28 kit perks; Blink reworked into Phase Shift; comprehensive weapon/kit audit replaced boring stat perks with mechanics
- 5 contract types: Hunt, Payload Escort, Void Breach, Boss Hunt, Extraction Run
- 8 regular + 8 standard elites + 4 Apex elites; pack enemies (groups 3-5, surround)
- Kitchen: CookingMinigame (timing bar, 3 rounds), 24 ingredients, recipes
- Ship Workbench permanent upgrades; hub upgrades rework (thrusters/dash, salvage, emergency protocol, % bonuses)
- World drop capsules (7 types); economy rebalance
- Mobile: touch controls, swipe-to-dash, tap-to-interact in hub

### Architecture
All modules live in `src/game/`. The pattern: each module exports functions that take `game: Game` as a parameter (using `import type` to avoid circular deps).

- Game.ts (~2,563 lines): coordinator -- delegates to extracted modules
  - BulletSystem.ts -- bullet creation, update, collision, rendering
  - SpawnManager.ts -- wave/elite/apex spawning
  - DropSystem.ts -- drop capsule spawning, collection, effects
  - ContractObjectives.ts -- 5 contract type update loops
  - KitAbilitySystem.ts -- kit activation, cooldowns, effects
  - ProgressionManager.ts -- XP, level-up, upgrades, mastery perks
  - VFXManager.ts -- particles, sprites, entity rendering
  - Camera.ts, HUD.ts, Player.ts
- rooms/ -- RoomRuntime, CombatRuntime, RoomLoader, InteractionSystem, TriggerSystem, ActionRegistry, PlaceholderRenderer
- Weapons.ts: firing patterns; Enemies.ts: behavior state machines; Map.ts: biome rendering
- src/data/ -- weapons, kits, contracts, planets, elites, creatures, upgrades, ingredients, recipes, modifiers, hal, rooms/ (hub + hunt JSON)
- src/store/ -- gameStore (screen flow), saveStore (persistence, devGiveResources)

### Remaining Gaps
- Room system polish/balance pass (stability fixes landed for doors, spawns, transitions; needs a clean full-loop QA)
- Biome vignettes (need PixiJS v8 compatible approach)
- Mastery perk effects (88 perks), resonance combos (10)
- Damage floaters, minimap
- Stale PR #1 (pack enemies) superseded by later main commits -- close it

## Roadmap (decided July 2026)

Strategy: the web version is the iteration polygon; prove retention/virality on web first, then wrap for iOS. iOS is a distribution channel, not a separate product.

1. **Phase 0 -- stabilize**: finish room-system pivot polish, full clean loop pass
2. **Phase 1 -- addiction core on web**: Daily Contract (shared seed, emoji share card, friend-group leaderboard codes); scripted-generous first session (first capsules hardcoded rich, power spike < 3 min); hunter record board (every completed quest gives small permanent global bonus, Halls of Torment style); every failed run still feeds meta
3. **Phase 2 -- web distribution**: submit to CrazyGames (+50% rev share for 2-month exclusive) and/or Poki; Discord playtest community
4. **Phase 3 -- iOS wrap**: Capacitor 8, game bundled in binary (guideline 4.7 does not apply then; 4.2 cleared via native polish). Constraints: 60fps cap in WKWebView (no 120Hz), pin PixiJS to `preference: 'webgl'`, SFX via native audio plugin (Web Audio latency 500-1000ms in webview), mirror saves to native storage (iOS can evict webview IndexedDB), haptics + Game Center (@capacitor/haptics, @openforge/capacitor-game-connect)
5. **Phase 4 -- App Store release**: launch free, no IAP initially; push permission only after first boss kill; monetize (RevenueCat) after retention is proven (genre benchmarks: D1 26%+, D7 10%+)
6. **Phase 5 -- virality push**: clip-able broken builds (3-second readability), one memeable absurd thing, streamer seeding, weekly contract rotation (DESIGN-WEEKLY-CONTRACT.md)

Design principles adopted: cross-referencing perk synergies over stat percentages (Luck Be a Landlord / Balatro depth engine); mechanic-bearing meta unlocks over flat % (DRG:Survivor's mistake); stacking post-win Danger levels per contract (Ascension matrix); never revoke the power fantasy with a grind wall (Survivor.io's week-2 churn); keep outcome uncertainty visible at commitment moments (Balatro near-miss).

## Design Docs (iCloud)
Located at `~/Library/Mobile Documents/com~apple~CloudDocs/Claude/space-hunter/`:
- STATE.md -- full game state reference
- BALANCE-SHEET.md -- live balance values
- DESIGN-PROGRESSION.md -- rep/kitchen/contracts/weapons
- DESIGN-PSYCHOLOGY-MASTER.md -- 100 game psychology techniques
- DESIGN-PSYCHOLOGY-SPACEHUNTER.md -- 21 prioritized for Space Hunter
- DESIGN-WEEKLY-CONTRACT.md -- weekly rotating contracts + leaderboard
In repo: DESIGN-PLANET-MODIFIERS.md, PERKS-AND-UPGRADES.md

## Key Context
- Built by Iurii + Claude (fully AI-agentic)
- No em dashes in written output
- No contrast framing ("not just X", "more than X")
