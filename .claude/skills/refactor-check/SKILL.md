---
name: refactor-check
description: "Anti-spaghetti code analysis and guided refactoring for the Space Hunter codebase. Use whenever the user says 'refactor', 'clean up', 'split this file', 'too big', 'spaghetti', 'god file', 'extract', or before adding a new feature to a file over 500 lines. Also trigger when the user asks 'where should this code go?' or 'how should I organize this?'. Proactively suggest running this when a file grows past 500 lines during a coding session."
---

# Refactor Check

Diagnose spaghetti code and produce a safe, incremental extraction plan. The goal is never a big-bang rewrite -- it's small, testable moves that leave the game working after each step.

## When To Run

- Before adding features to any file over 500 lines
- When a file has grown 200+ lines since the last session
- When you notice the same pattern repeated across files
- When the user says anything that smells like "this is getting messy"

## Step 1: Measure the Mess

Run this analysis on the target file(s):

```
For each file:
1. Total line count
2. Count of functions/methods (top-level + nested)
3. Longest function (name + line count)
4. Count of responsibilities (distinct things the file does)
5. Import count (coupling indicator)
6. Repeated patterns (same logic appearing 2+ times)
```

Present a short summary table like:

| File | Lines | Functions | Longest fn | Responsibilities | Coupling |
|------|-------|-----------|-----------|-----------------|----------|
| Game.ts | 4915 | 42 | updateBullets (180) | 8+ | 14 imports |

## Step 2: Identify Extraction Candidates

Look for these spaghetti signals, in priority order:

1. **God functions** -- any function over 100 lines. These almost always contain separable phases (setup, update, cleanup) that can become their own functions or modules.

2. **Mixed responsibilities** -- a file that handles both rendering AND game logic AND state management. Each responsibility should live in its own module.

3. **Repeated patterns** -- if the same collision check, spawn logic, or state transition appears 3+ times, it should be a shared utility.

4. **Data that travels together** -- groups of parameters always passed around together signal a missing type/class. Extract into an interface or a small manager class.

5. **Feature clusters** -- blocks of code that only interact with each other but happen to live in a larger file. These are natural extraction boundaries.

## Step 3: Propose the Extraction Plan

For each candidate, specify:

- **What to extract**: the exact functions/blocks, with line ranges
- **Where it goes**: new filename and why
- **Dependencies**: what it needs from the parent file (imports, shared state)
- **Risk level**: Low (pure functions, data), Medium (state access), High (tight coupling to game loop)
- **Test strategy**: how to verify nothing broke (visual check, specific scenario, etc.)

Format each extraction as a numbered step that can be done independently. Order by risk: low-risk extractions first, so the codebase improves even if the session gets interrupted.

**Example plan for a file like Game.ts:**
```
1. [LOW] Extract BulletManager → src/game/BulletManager.ts
   - Functions: createBullet(), updateBullets(), checkBulletCollisions()
   - Needs: enemy positions (read-only), map bounds
   - Test: fire weapons at enemies, verify hits register

2. [LOW] Extract SpawnSystem → src/game/SpawnSystem.ts
   - Functions: spawnWave(), getSpawnPosition(), checkSpawnCollision()
   - Needs: enemy count, map data, difficulty scaling
   - Test: play 3 waves, verify enemy counts and positions

3. [MED] Extract CollisionSystem → src/game/CollisionSystem.ts
   - Functions: all checkCollision variants, line-segment helpers
   - Needs: entity positions, hitboxes
   - Test: walk into walls, shoot enemies, test pickup collection
```

## Step 4: Execute (If User Approves)

When the user says go:

1. Extract one module at a time
2. After each extraction, verify the game still runs (npm run build at minimum)
3. Keep the old code commented for one commit, then remove in the next
4. Update imports across all affected files
5. Run through the test scenario before moving to the next extraction

## Rules

- Never extract and restructure in the same step. Move code first, improve it later.
- Preserve exact behavior. Refactoring means changing structure, not logic.
- If a function is called from 5+ places, think twice before moving it -- it might be in the right spot.
- New files should have a single clear purpose expressible in one sentence.
- Prefer composition over inheritance. Prefer plain functions over classes when state is not involved.
- Name files by what they manage, not what they contain: `BulletManager.ts` not `bulletHelpers.ts`.

## Space Hunter Specific Context

The codebase has a known architecture:
- `Game.ts` (~5000 lines) is the main god file -- main loop, bullets, hits, spawning, drawing, drops, VFX
- `Enemies.ts` (~800 lines) handles behavior state machines for 7 enemy types
- `Weapons.ts` (~260 lines) handles firing patterns
- `Map.ts` (~360 lines) handles biome rendering
- `Player.ts` (~200 lines) is relatively clean
- `HUD.ts` (~250 lines) is the heads-up display
- `rooms/` subdirectory has newer, better-structured code (CombatRuntime, RoomRuntime, etc.)

The `rooms/` architecture is the model to follow -- it uses separation of concerns properly. When extracting from Game.ts, aim for modules that match the rooms/ style.

Game.ts likely contains these extractable systems: bullet management, enemy spawning, collision detection, loot/drops, VFX/particles, wave management, world object interaction, scoring/XP. Each of these is a natural module boundary.
